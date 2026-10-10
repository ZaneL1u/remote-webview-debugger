// A phone-sized macOS "app" that behaves like an iOS app built on WKWebView:
// a native navigation bar, a stack of WebViews (links with target=_blank and
// window.open push a new WebView, like pushing a view controller), a native
// help button, a consent dialog before remote debugging, native
// takeover / hand back / end buttons, and native dialogs for AI attach
// requests and sensitive-action confirmations. All remote-debugging work
// happens in RWDNative.swift.
//
//   RWDMockApp [--gateway https://host/v1] [--key rwd_pk_…] [--user id]
//              [--start-url URL] [--consent] [--snapshot /tmp/x.png]
//              [--auto-decide interact|observe|advanced|deny]
//
// Debug hooks for automated checks: SIGUSR1 writes a picture of the window to
// --snapshot; SIGUSR2 presses the native takeover / hand back button;
// --auto-decide answers attach / confirm dialogs through the same nativeDecide
// path a tap would take (testing only: a real app always asks the user).

import AppKit
import WebKit

private func levelName(_ level: String) -> String {
    switch level {
    case "observe": return "View only"
    case "advanced": return "Advanced (run scripts, read storage)"
    default: return "View and interact"
    }
}

private let iPhoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RWDMockApp/1.0"
private let defaultGateway = "https://rwd.example.com/v1" // or pass --gateway

struct Options {
    var gateway: String?
    var key: String?
    var user: String?
    var startURL: String?
    var consent = false
    var snapshot = "/tmp/rwd-mock-app.png"
    var autoDecide: String?

    static func parse() -> Options {
        var o = Options()
        var it = CommandLine.arguments.dropFirst().makeIterator()
        while let a = it.next() {
            switch a {
            case "--gateway": o.gateway = it.next()
            case "--key": o.key = it.next()
            case "--user": o.user = it.next()
            case "--start-url": o.startURL = it.next()
            case "--consent": o.consent = true
            case "--snapshot": o.snapshot = it.next() ?? o.snapshot
            case "--auto-decide": o.autoDecide = it.next()
            default: break
            }
        }
        return o
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate {
    let options = Options.parse()
    let rwd = RWDNative.shared
    let defaults = UserDefaults.standard

    var window: NSWindow!
    let backButton = NSButton(title: "‹", target: nil, action: nil)
    let titleLabel = NSTextField(labelWithString: "")
    let helpButton = NSButton(title: "Get help", target: nil, action: nil)
    let moreButton = NSButton(title: "⋯", target: nil, action: nil)
    let statusLabel = NSTextField(labelWithString: "")
    let primaryButton = NSButton(title: "", target: nil, action: nil)
    let endButton = NSButton(title: "End", target: nil, action: nil)
    let statusBar = NSView()
    let container = NSView()
    var stack: [WKWebView] = []
    var titleObservers: [NSKeyValueObservation] = []
    let baseConfiguration = WKWebViewConfiguration()
    var signalSources: [DispatchSourceSignal] = []
    var pendingAlert: (alert: NSAlert, requestId: String, timer: Timer)?

    // MARK: settings

    var gateway: String { defaults.string(forKey: "mock.gateway") ?? defaultGateway }
    var appKey: String { defaults.string(forKey: "mock.appKey") ?? "" }
    var userId: String { defaults.string(forKey: "mock.userId") ?? "mock-ios-user" }

    func applyConfig() {
        guard let url = URL(string: gateway), !appKey.isEmpty else { rwd.config = nil; return }
        rwd.config = .init(gatewayURL: url, appKey: appKey, userId: userId, appName: "Demo Shop iOS", appVersion: "3.2.0")
    }

    var startURL: URL {
        if let s = options.startURL ?? defaults.string(forKey: "mock.startURL"), let u = URL(string: s) { return u }
        var c = URLComponents(string: gateway)!
        c.path = "/demo/platform-demo/index.html"
        return c.url!
    }

    // MARK: launch

    func applicationDidFinishLaunching(_ n: Notification) {
        if let g = options.gateway { defaults.set(g, forKey: "mock.gateway") }
        if let k = options.key { defaults.set(k, forKey: "mock.appKey") }
        if let u = options.user { defaults.set(u, forKey: "mock.userId") }
        if let s = options.startURL { defaults.set(s, forKey: "mock.startURL") }
        applyConfig()
        buildMenu()
        buildWindow()
        rwd.onState = { [weak self] _ in self?.render() }
        rwd.onPending = { [weak self] p in self?.presentPending(p) }
        installSignals()

        rwd.install(into: baseConfiguration)
        rwd.restore { [weak self] in
            guard let self else { return }
            self.push(self.makeWebView(configuration: self.baseConfiguration), load: self.startURL)
            if self.options.consent && !self.rwd.enabled {
                self.rwd.enable { error in if let error { self.alert("Couldn't turn on remote debugging", error.localizedDescription) } }
            }
            if self.appKey.isEmpty { self.showSettings() }
        }
        render()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        let editItem = NSMenuItem()
        main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select all", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        NSApp.mainMenu = main
    }

    func buildWindow() {
        let size = NSSize(width: 390, height: 844 + 44 + 30)
        window = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.titled, .closable, .miniaturizable],
                          backing: .buffered, defer: false)
        window.title = "Demo Shop · Mock iOS app"
        window.center()
        let root = window.contentView!
        root.wantsLayer = true

        let nav = NSView(frame: NSRect(x: 0, y: size.height - 44, width: size.width, height: 44))
        nav.autoresizingMask = [.width, .minYMargin]
        nav.wantsLayer = true
        nav.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        let navItems: [(NSButton, Selector)] = [(backButton, #selector(goBack)), (helpButton, #selector(askHelp)), (moreButton, #selector(showMore(_:)))]
        for (b, action) in navItems {
            b.bezelStyle = .inline
            b.target = self
            b.action = action
            nav.addSubview(b)
        }
        backButton.font = .systemFont(ofSize: 22)
        backButton.frame = NSRect(x: 8, y: 6, width: 36, height: 32)
        moreButton.frame = NSRect(x: size.width - 44, y: 8, width: 36, height: 28)
        helpButton.frame = NSRect(x: size.width - 152, y: 8, width: 104, height: 28)
        titleLabel.frame = NSRect(x: 50, y: 12, width: size.width - 210, height: 20)
        titleLabel.alignment = .center
        titleLabel.font = .boldSystemFont(ofSize: 15)
        titleLabel.lineBreakMode = .byTruncatingTail
        nav.addSubview(titleLabel)
        root.addSubview(nav)

        statusBar.frame = NSRect(x: 0, y: size.height - 44 - 30, width: size.width, height: 30)
        statusBar.autoresizingMask = [.width, .minYMargin]
        statusBar.wantsLayer = true
        statusLabel.frame = NSRect(x: 10, y: 7, width: size.width - 150, height: 16)
        statusLabel.font = .systemFont(ofSize: 12)
        statusLabel.lineBreakMode = .byTruncatingTail
        statusBar.addSubview(statusLabel)
        let statusItems: [(NSButton, Selector)] = [(primaryButton, #selector(primaryControl)), (endButton, #selector(endControl))]
        for (b, action) in statusItems {
            b.bezelStyle = .inline
            b.controlSize = .small
            b.target = self
            b.action = action
            statusBar.addSubview(b)
        }
        primaryButton.frame = NSRect(x: size.width - 138, y: 4, width: 74, height: 22)
        endButton.frame = NSRect(x: size.width - 58, y: 4, width: 50, height: 22)
        root.addSubview(statusBar)

        container.frame = NSRect(x: 0, y: 0, width: size.width, height: size.height - 74)
        container.autoresizingMask = [.width, .height]
        root.addSubview(container)
        window.makeKeyAndOrderFront(nil)
    }

    // MARK: WebView stack

    func makeWebView(configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        rwd.install(into: configuration)
        let wv = WKWebView(frame: container.bounds, configuration: configuration)
        wv.autoresizingMask = [.width, .height]
        wv.customUserAgent = iPhoneUA
        wv.uiDelegate = self
        wv.navigationDelegate = self
        if #available(macOS 13.3, *) { wv.isInspectable = true }
        rwd.track(wv)
        return wv
    }

    func push(_ wv: WKWebView, load url: URL? = nil) {
        // Like a covered view controller on iOS, the page underneath leaves the
        // window, so WebKit reports it as hidden (and visible again on pop).
        stack.last?.removeFromSuperview()
        container.addSubview(wv)
        stack.append(wv)
        if let url { wv.load(URLRequest(url: url)) }
        frontChanged()
    }

    func pop() {
        guard stack.count > 1, let top = stack.popLast() else { return }
        top.removeFromSuperview() // closes the page; the gateway sees it go
        if let prev = stack.last {
            prev.frame = container.bounds
            container.addSubview(prev)
        }
        frontChanged()
    }

    func frontChanged() {
        guard let top = stack.last else { return }
        rwd.frontmost = top
        titleObservers = [top.observe(\.title, options: [.initial, .new]) { [weak self] wv, _ in
            DispatchQueue.main.async { self?.titleLabel.stringValue = wv.title ?? "" }
        }]
        render()
    }

    // WKUIDelegate: target=_blank / window.open -> push a new WebView.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let wv = makeWebView(configuration: configuration)
        push(wv)
        return wv
    }

    func webViewDidClose(_ webView: WKWebView) {
        if webView == stack.last { pop() }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        alert("Message from the page", message)
        completionHandler()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { render() }

    // MARK: native UI state

    func render() {
        let s = rwd.state
        let locked = s.control == "agent"
        backButton.isEnabled = !locked && (stack.count > 1 || stack.last?.canGoBack == true)
        helpButton.isEnabled = !locked && rwd.enabled
        helpButton.isHidden = s.helpButton == false // the project turned help off for this user
        helpButton.title = s.help ? "Help requested" : "Get help"
        var text: String
        var color = NSColor.secondaryLabelColor
        if !rwd.enabled {
            text = "Remote debugging is off (turn it on in ⋯)"
        } else {
            let code = s.deviceCode ?? "…"
            let level = s.level.map { " · \(levelName($0))" } ?? ""
            switch s.control {
            case "observe": text = "AI connected\(level) · \(code)"; color = .systemGreen
            case "agent": text = "AI in control, input locked · \(code)"; color = .systemBlue
            case "user": text = "You took over, AI paused · \(code)"; color = .systemOrange
            default:
                switch s.link {
                case "online": text = "Remote debugging on · device code " + code
                case "rejected": text = "Device check failed, try again later"; color = .systemRed
                case "quota": text = "Too many devices online, try again later"; color = .systemOrange
                default: text = "Connecting · " + code
                }
            }
        }
        statusLabel.stringValue = text
        statusLabel.textColor = color
        statusBar.layer?.backgroundColor = color.withAlphaComponent(0.12).cgColor
        let active = rwd.enabled && s.control != "none"
        primaryButton.isHidden = !active || s.control == "observe"
        endButton.isHidden = !active
        primaryButton.title = s.control == "user" ? "Hand back" : "Take over"
    }

    // MARK: attach approval / sensitive-action confirmation

    func presentPending(_ p: RWDNative.Pending?) {
        if let open = pendingAlert, open.requestId != p?.requestId {
            // Answered elsewhere, cancelled by the gateway, or replaced.
            open.timer.invalidate()
            pendingAlert = nil
            if let sheet = window.attachedSheet, sheet == open.alert.window { window.endSheet(sheet, returnCode: .cancel) }
        }
        guard let p, pendingAlert == nil else { return }
        if let auto = options.autoDecide {
            let value: String? = auto == "deny" ? nil : (p.kind == "confirm" ? "allow" : auto)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.rwd.decide(p.requestId, value) }
            return
        }
        let a = NSAlert()
        var levelPicker: NSPopUpButton?
        if p.kind == "confirm" {
            a.messageText = "AI wants to \(p.action)"
            a.informativeText = "This step may have real effects (like placing an order or paying), so it's your call. No answer within 30 seconds counts as a denial."
        } else {
            let key = p.keyHint.map { "(Key \($0)) " } ?? ""
            a.messageText = "“\(p.agentName)” wants to view this page remotely"
            a.informativeText = "\(key)If you allow it, it can see the page (sensitive data is masked) and act within the level you choose. You can take over or end at any time."
            let picker = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 240, height: 26))
            for l in p.levels { picker.addItem(withTitle: levelName(l)); picker.lastItem?.representedObject = l }
            picker.selectItem(at: max(0, p.levels.count - 1))
            a.accessoryView = picker
            levelPicker = picker
        }
        a.addButton(withTitle: "Allow")
        a.addButton(withTitle: "Deny")
        let id = p.requestId
        let timer = Timer.scheduledTimer(withTimeInterval: max(1, p.expiresAt.timeIntervalSinceNow), repeats: false) { [weak self] _ in
            // The gateway times the request out and cancels it; only close the dialog.
            guard let self, let open = self.pendingAlert, open.requestId == id else { return }
            self.pendingAlert = nil
            if let sheet = self.window.attachedSheet { self.window.endSheet(sheet, returnCode: .cancel) }
        }
        pendingAlert = (a, id, timer)
        NSApp.activate(ignoringOtherApps: true)
        a.beginSheetModal(for: window) { [weak self] response in
            guard let self, let open = self.pendingAlert, open.requestId == id else { return }
            open.timer.invalidate()
            self.pendingAlert = nil
            guard response == .alertFirstButtonReturn else {
                if response == .alertSecondButtonReturn { self.rwd.decide(id, nil) }
                return
            }
            self.rwd.decide(id, p.kind == "confirm" ? "allow" : levelPicker?.selectedItem?.representedObject as? String)
        }
    }

    @objc func goBack() {
        guard let top = stack.last else { return }
        if top.canGoBack { top.goBack() } else { pop() }
    }

    @objc func askHelp() { rwd.help() }

    @objc func primaryControl() {
        rwd.control(rwd.state.control == "user" ? "handback" : "takeover")
    }

    @objc func endControl() { rwd.control("end") }

    @objc func showMore(_ sender: NSButton) {
        let m = NSMenu()
        m.addItem(withTitle: rwd.enabled ? "Turn off remote debugging" : "Turn on remote debugging…", action: #selector(toggleRemote), keyEquivalent: "").target = self
        m.addItem(withTitle: "About this device (device code)", action: #selector(showAbout), keyEquivalent: "").target = self
        m.addItem(withTitle: "Open promo page (new WebView)", action: #selector(openPromo), keyEquivalent: "").target = self
        m.addItem(withTitle: "Reload page", action: #selector(reloadTop), keyEquivalent: "").target = self
        m.addItem(.separator())
        m.addItem(withTitle: "Gateway and app key…", action: #selector(showSettings), keyEquivalent: "").target = self
        m.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.height), in: sender)
    }

    @objc func toggleRemote() {
        if rwd.enabled { rwd.disable(); render(); return }
        guard rwd.config != nil else { showSettings(); return }
        let a = NSAlert()
        a.messageText = "Allow support to debug remotely?"
        a.informativeText = "Support (including AI assistants) will be able to view and interact with the web pages in this app to track down your problem. Other apps and system screens are not included.\n\nThe debugging status stays visible on the page, and you can take over or end at any time."
        a.addButton(withTitle: "Agree and turn on")
        a.addButton(withTitle: "Not now")
        guard a.runModal() == .alertFirstButtonReturn else { return }
        rwd.enable { [weak self] error in
            if let error { self?.alert("Couldn't turn on remote debugging", error.localizedDescription) }
            self?.render()
        }
    }

    @objc func showAbout() {
        alert("About this device", "Device code: \(rwd.state.deviceCode ?? "(assigned once remote debugging is on)")\ndeviceId: \(rwd.deviceId)\nUser: \(userId)\nGateway: \(gateway)")
    }

    @objc func openPromo() {
        let url = startURL.deletingLastPathComponent().appendingPathComponent("promo.html")
        push(makeWebView(configuration: baseConfiguration), load: url)
    }

    @objc func reloadTop() { stack.last?.reload() }

    @objc func showSettings() {
        let a = NSAlert()
        a.messageText = "Gateway and app key"
        a.informativeText = "Create a project in the console, then paste its app key here."
        let entries: [(String, String)] = [("Gateway URL", gateway), ("App key (rwd_pk_…)", appKey), ("User ID", userId)]
        let fields: [NSTextField] = entries.map { label, value -> NSTextField in
            let f = NSTextField(string: value)
            f.placeholderString = label
            f.frame.size = NSSize(width: 300, height: 24)
            return f
        }
        let box = NSStackView(views: fields)
        box.orientation = .vertical
        box.frame = NSRect(x: 0, y: 0, width: 300, height: 90)
        a.accessoryView = box
        a.addButton(withTitle: "Save")
        a.addButton(withTitle: "Cancel")
        guard a.runModal() == .alertFirstButtonReturn else { return }
        defaults.set(fields[0].stringValue.trimmingCharacters(in: .whitespaces), forKey: "mock.gateway")
        defaults.set(fields[1].stringValue.trimmingCharacters(in: .whitespaces), forKey: "mock.appKey")
        defaults.set(fields[2].stringValue.trimmingCharacters(in: .whitespaces), forKey: "mock.userId")
        applyConfig()
        if rwd.enabled { rwd.enable { _ in } } else { stack.first?.load(URLRequest(url: startURL)) }
    }

    func alert(_ title: String, _ text: String) {
        let a = NSAlert()
        a.messageText = title
        a.informativeText = text
        a.runModal()
    }

    // MARK: debug hooks

    func installSignals() {
        let hooks: [(Int32, () -> Void)] = [
            (SIGUSR1, { [weak self] in self?.writeSnapshot() }),
            (SIGUSR2, { [weak self] in self?.primaryControl() }),
        ]
        for (sig, handler) in hooks {
            signal(sig, SIG_IGN)
            let src = DispatchSource.makeSignalSource(signal: sig, queue: .main)
            src.setEventHandler { handler() }
            src.resume()
            signalSources.append(src)
        }
    }

    /// Native chrome rendered from its layers, with the frontmost WebView's
    /// real pixels pasted in.
    func writeSnapshot() {
        guard let root = window.contentView, let top = stack.last else { return }
        let scale = window.backingScaleFactor
        let size = root.bounds.size
        top.takeSnapshot(with: nil) { [weak self] web, _ in
            guard let self, let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width * scale),
                pixelsHigh: Int(size.height * scale), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
                let ctx = NSGraphicsContext(bitmapImageRep: rep) else { return }
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = ctx
            ctx.cgContext.scaleBy(x: scale, y: scale)
            NSColor.windowBackgroundColor.setFill()
            NSRect(origin: .zero, size: size).fill()
            root.displayIgnoringOpacity(root.bounds, in: ctx)
            web?.draw(in: self.container.frame)
            NSGraphicsContext.restoreGraphicsState()
            if let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: self.options.snapshot))
            }
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
