// Native side of remote-webview-debugger for apps that host WKWebViews.
//
// This file is what an iOS app would copy (it also builds on macOS, which the
// mock app uses). It:
//   - keeps one deviceId per install, shared by every WebView and domain;
//   - remembers whether the user consented to remote debugging;
//   - injects the SDK + config at document start into every WebView it is
//     installed on (`install(into:)`), only while consent is given;
//   - answers the SDK's native screenshot requests with real pixels
//     (WKWebView.takeSnapshot);
//   - reports the SDK state (device code, control state, help) back to native
//     UI, and drives takeover / handback / end from native buttons with a
//     secret only the app knows;
//   - keeps the deviceToken the gateway issued (localStorage is per origin, so
//     the app hands it to every WebView);
//   - shows the attach approval and sensitive-action confirmation as native
//     dialogs (nativeApproval) and answers them with the same secret.

import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#else
import AppKit
#endif

final class RWDNative: NSObject {
    struct Config {
        var gatewayURL: URL      // https://host/v1
        var appKey: String       // rwd_pk_…
        var userId: String?
        var appName: String
        var appVersion: String
        var lang = "en"          // SDK UI language: en | zh
    }

    struct State: Equatable {
        var deviceCode: String?
        var link: String         // idle | connecting | online | polling | rejected | quota | …
        var control: String      // none | observe | agent | user
        var help: Bool
        var label: String?
        var level: String? = nil         // observe | interact | advanced, while an agent is attached
        var helpButton: Bool? = nil      // project config: offer the help entry to this user (nil: not received)
    }

    /// status().pending: a question the user must answer on this device.
    struct Pending: Equatable {
        var kind: String         // attach | confirm
        var requestId: String
        var agentName: String    // attach
        var keyHint: String?     // attach
        var levels: [String]     // attach: offered levels, the last one is what the agent asked for
        var action: String       // confirm: e.g. click "Place order"
        var expiresAt: Date
    }

    static let shared = RWDNative()

    private let defaults = UserDefaults.standard
    private let contentControllers = NSHashTable<WKUserContentController>.weakObjects()
    private let webViews = NSHashTable<WKWebView>.weakObjects()
    private var sdkSource: String?
    /// Lets nativeControl() through; never exposed to page scripts.
    private let nativeKey = UUID().uuidString + UUID().uuidString

    var config: Config?
    /// Called on the main thread whenever the SDK state of the frontmost page changes.
    var onState: ((State) -> Void)?
    /// Called on the main thread when a page asks the user something (or nil when it went away).
    var onPending: ((Pending?) -> Void)?
    private(set) var state = State(deviceCode: nil, link: "idle", control: "none", help: false, label: nil)
    private(set) var pending: Pending?
    private weak var pendingWebView: WKWebView?

    /// One id per install. A real app may prefer its own device identifier.
    let deviceId: String = {
        let key = "rwd.deviceId"
        if let id = UserDefaults.standard.string(forKey: key) { return id }
        let id = UUID().uuidString.lowercased()
        UserDefaults.standard.set(id, forKey: key)
        return id
    }()

    /// Issued by the gateway on this device's first connection; proves later
    /// pages (any domain, any WebView) belong to the same device.
    private(set) var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// The user agreed to remote debugging (persisted until they turn it off).
    var enabled: Bool { defaults.bool(forKey: "rwd.enabled") }

    // MARK: - consent

    /// Turn remote debugging on after the user consented: fetch the SDK, inject
    /// it into every WebView and reload them.
    func enable(completion: @escaping (Error?) -> Void) {
        loadSDK { [weak self] error in
            guard let self else { return }
            if let error { completion(error); return }
            self.defaults.set(true, forKey: "rwd.enabled")
            self.refreshScripts()
            self.reloadAll()
            completion(nil)
        }
    }

    func disable() {
        defaults.set(false, forKey: "rwd.enabled")
        for wv in webViews.allObjects {
            wv.evaluateJavaScript("window.RemoteWebviewDebugger && RemoteWebviewDebugger.stop()")
        }
        refreshScripts()
        reloadAll()
        update(State(deviceCode: state.deviceCode, link: "idle", control: "none", help: false, label: nil))
    }

    /// Call at launch: when consent was given earlier, the SDK is fetched again
    /// so pages loaded afterwards are covered.
    func restore(completion: @escaping () -> Void) {
        guard enabled else { completion(); return }
        loadSDK { [weak self] _ in
            self?.refreshScripts()
            completion()
        }
    }

    // MARK: - WebViews

    /// Install on the configuration of every WebView the app creates (before
    /// creating it). Popups created by WebKit share the same content controller.
    func install(into configuration: WKWebViewConfiguration) {
        let ucc = configuration.userContentController
        guard !contentControllers.contains(ucc) else { return }
        contentControllers.add(ucc)
        let proxy = WeakHandler(self)
        ucc.addScriptMessageHandler(proxy, contentWorld: .page, name: "rwdScreenshot")
        ucc.add(proxy, name: "rwdState")
        applyScripts(to: ucc)
    }

    func track(_ webView: WKWebView) {
        webViews.add(webView)
    }

    /// The page the user looks at; its state drives the native UI.
    weak var frontmost: WKWebView? {
        didSet { frontmost?.evaluateJavaScript(statePushJS) }
    }

    func help() {
        frontmost?.evaluateJavaScript("window.RemoteWebviewDebugger && RemoteWebviewDebugger.help(true)")
    }

    /// takeover | handback | end, from native buttons.
    func control(_ action: String) {
        let js = "window.RemoteWebviewDebugger && RemoteWebviewDebugger.nativeControl(\(jsString(nativeKey)), \(jsString(action)))"
        frontmost?.evaluateJavaScript(js)
    }

    /// Answer the pending question: a level (or nil to refuse) for attach,
    /// "allow" (or nil) for confirm.
    func decide(_ requestId: String, _ value: String?) {
        let target = pendingWebView ?? frontmost
        let arg = value.map(jsString) ?? "null"
        let js = "window.RemoteWebviewDebugger && RemoteWebviewDebugger.nativeDecide(\(jsString(nativeKey)), \(jsString(requestId)), \(arg))"
        target?.evaluateJavaScript(js)
        if pending?.requestId == requestId { setPending(nil, from: nil) }
    }

    // MARK: - scripts

    private func loadSDK(completion: @escaping (Error?) -> Void) {
        guard let config else {
            completion(NSError(domain: "RWD", code: 1, userInfo: [NSLocalizedDescriptionKey: "Gateway URL and app key are not set"]))
            return
        }
        let url = config.gatewayURL.appendingPathComponent("sdk.js")
        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                if let error { completion(error); return }
                guard (response as? HTTPURLResponse)?.statusCode == 200, let data, let source = String(data: data, encoding: .utf8) else {
                    completion(NSError(domain: "RWD", code: 2, userInfo: [NSLocalizedDescriptionKey: "Couldn't download the SDK: \(url)"]))
                    return
                }
                self.sdkSource = source
                completion(nil)
            }
        }.resume()
    }

    private func refreshScripts() {
        for ucc in contentControllers.allObjects { applyScripts(to: ucc) }
    }

    private func applyScripts(to ucc: WKUserContentController) {
        ucc.removeAllUserScripts()
        guard enabled, let config, let sdkSource else { return }
        let options: [String: Any] = [
            "deviceId": deviceId,
            "userId": config.userId as Any,
            "helpButton": false, // the app has its own help entry
            "app": ["name": config.appName, "version": config.appVersion],
            "lang": config.lang,
            "nativeKey": nativeKey,
            "nativeApproval": true,
            "deviceToken": deviceToken as Any,
        ]
        let optionsJSON = String(data: try! JSONSerialization.data(withJSONObject: options), encoding: .utf8)!
        let boot = """
        \(sdkSource)
        ;(function () {
          if (!window.RemoteWebviewDebugger) return;
          RemoteWebviewDebugger.run(\(jsString(config.gatewayURL.absoluteString)), \(jsString(config.appKey)), \(optionsJSON));
          var last = '';
          function push(force) {
            try {
              var s = RemoteWebviewDebugger.status();
              var p = s.pending;
              var j = JSON.stringify([s.deviceCode, s.status, s.control, s.help, s.label, s.level, s.deviceToken,
                                      s.config && s.config.helpButton, p && p.requestId]);
              if (force || j !== last) { last = j; webkit.messageHandlers.rwdState.postMessage(s); }
            } catch (e) {}
          }
          window.__rwdPushState = function () { push(true); };
          setInterval(push, 400);
        })();
        """
        ucc.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    private var statePushJS: String { "window.__rwdPushState && window.__rwdPushState()" }

    private func reloadAll() {
        for wv in webViews.allObjects { wv.reload() }
    }

    private func update(_ s: State) {
        guard s != state else { return }
        state = s
        onState?(s)
    }

    private func setPending(_ p: Pending?, from webView: WKWebView?) {
        guard p != pending else { return }
        pending = p
        pendingWebView = webView
        onPending?(p)
    }

    fileprivate func receive(_ message: WKScriptMessage) {
        guard message.name == "rwdState", let body = message.body as? [String: Any] else { return }
        if let token = body["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            refreshScripts() // pages loaded from now on (other domains too) carry it
        }
        // Questions come from whichever page the gateway asked (the focused one).
        if let p = body["pending"] as? [String: Any], let id = p["requestId"] as? String {
            let agent = p["agent"] as? [String: Any]
            let expires = (p["expiresAt"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date().addingTimeInterval(30)
            setPending(Pending(kind: p["kind"] as? String ?? "attach", requestId: id,
                               agentName: agent?["name"] as? String ?? "AI assistant", keyHint: agent?["keyHint"] as? String,
                               levels: p["levels"] as? [String] ?? [], action: p["action"] as? String ?? "",
                               expiresAt: expires), from: message.webView)
        } else if message.webView == pendingWebView {
            setPending(nil, from: nil)
        }
        guard message.webView == frontmost else { return }
        let config = body["config"] as? [String: Any]
        update(State(deviceCode: body["deviceCode"] as? String, link: body["status"] as? String ?? "idle",
                     control: body["control"] as? String ?? "none", help: body["help"] as? Bool ?? false,
                     label: body["label"] as? String, level: body["level"] as? String,
                     helpButton: config?["helpButton"] as? Bool))
    }

    /// Real pixels of the WebView, as a JPEG data URL (protocol: rwd.screenshot, source "native").
    fileprivate func screenshot(_ message: WKScriptMessage, reply: @escaping (Any?, String?) -> Void) {
        guard let webView = message.webView else { reply(nil, "no web view"); return }
        webView.takeSnapshot(with: nil) { image, error in
            guard let image, let data = jpegData(image) else {
                reply(nil, error?.localizedDescription ?? "snapshot failed")
                return
            }
            reply("data:image/jpeg;base64," + data.base64EncodedString(), nil)
        }
    }
}

private func jsString(_ s: String) -> String {
    let data = try! JSONSerialization.data(withJSONObject: [s])
    let arr = String(data: data, encoding: .utf8)!
    return String(arr.dropFirst().dropLast())
}

#if canImport(UIKit)
private func jpegData(_ image: UIImage) -> Data? { image.jpegData(compressionQuality: 0.8) }
#else
private func jpegData(_ image: NSImage) -> Data? {
    guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return nil }
    return rep.representation(using: .jpeg, properties: [.compressionFactor: 0.8])
}
#endif

/// WKUserContentController retains its handlers; this breaks the cycle.
private final class WeakHandler: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    weak var target: RWDNative?
    init(_ target: RWDNative) { self.target = target }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.receive(message)
    }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let target else { replyHandler(nil, "gone"); return }
        target.screenshot(message, reply: replyHandler)
    }
}
