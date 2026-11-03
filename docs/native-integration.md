English | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# Native app integration

An H5 page can load the SDK with a `<script>` tag. Inside your own app you can do better: inject the SDK from native code into every WebView as it starts loading. Then:

- every page in the app becomes debuggable, third-party domains included, with no change to the H5 code;
- the device keeps **one device code** across WebViews and domains, because the app supplies the `deviceId` and keeps the device token;
- the agent gets **real screenshots** (video, canvas, native overlays) through a native bridge;
- approvals, confirmations and the take over / hand back / end buttons can be **native UI**, and the back button can be locked while an AI is connected.

The console's built-in guide (**Docs → Integrate a native app**) shows the same code with your gateway URL and app key filled in. A complete, runnable reference is [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift), used by the [mock app](../examples/mock-app/README.md). Message-level details are in [protocol.md](protocol.md).

## Checklist

1. **Ask for consent.** Turn remote debugging on only after the user agrees (the mock app shows a native consent dialog first). Attach approval on the device still applies on top of that.
2. **Get the SDK.** Bundle `dist/sdk.js` from the npm package [`remote-webview-debugger`](../sdk/README.md) with the app, so neither the gateway nor a CDN can ever push code to it; or download it once when debugging is enabled, from your gateway (`https://rwd.example.com/v1/sdk.js`) or a pinned CDN URL (`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js`).
3. **Build the boot script:** the SDK source, then `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`, then (optionally) a timer that reports `status()` to native code.
4. **Inject it at document start** into the main frame of every WebView, before the first page loads, so capture starts before any page script runs.
5. **Keep `deviceId` and `deviceToken`** in app storage and pass both to every WebView.
6. **Register the screenshot bridge.**
7. **Wire native UI** to `status()`, `help()`, `nativeControl()` and `nativeDecide()`.

## `run()` options for apps

| Option | What to pass |
|---|---|
| `deviceId` | One id per install (a UUID you generate once and store). Shared by every WebView and every domain, so the device code never changes. Changing it creates a new device |
| `deviceToken` | The token the gateway issued for this device (`status().deviceToken`), saved by the app; `null` until the first connection. localStorage is per origin, so without this a page on a new domain would be rejected with close code 4401 |
| `userId` | Your signed-in user's id, or `null`. Agents can filter by it (`list_devices userId=…`), the console shows it, and the policy's `helpButton: listed` uses it. Prefer an opaque internal id over personal data. When the user signs in or out, call `setUser(id)` or re-inject |
| `app` | `{ name, version }` of your app, shown to agents and in the console |
| `nativeKey` | A random secret generated at launch (e.g. two UUIDs) and written only into the injected script. Required by `nativeControl()` and `nativeDecide()`; page scripts, including the agent's `evaluate_script`, can't read it |
| `nativeApproval` | `true` to show attach approvals and action confirmations as native dialogs instead of the SDK's in-page dialogs |
| `helpButton` | `false` if the app has its own "Get help" entry |
| `lang` | Your app's language as a tag (`'en'`, `'zh'`, `'ja'`, `'pt-BR'`…; see the [SDK languages](../sdk/README.md#languages)); default follows `navigator.languages` |
| `lockScreen`, `theme`, `eruda` | As for H5 pages, see [protocol.md §10](protocol.md#10-javascript-api-for-hosts) |

## iOS (WKWebView)

Add a `WKUserScript` with `injectionTime: .atDocumentStart` and `forMainFrameOnly: true` to the `WKUserContentController` of each `WKWebViewConfiguration`, **before** creating the `WKWebView`. Popups that WebKit creates for `window.open` / `target=_blank` reuse the configuration you return from `webView(_:createWebViewWith:…)`, so they get the same scripts. User scripts apply to navigations that start after they are added; reload open WebViews after enabling debugging. The screenshot bridge needs iOS 14 (`WKScriptMessageHandlerWithReply`).

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // drives the native status bar, buttons and dialogs

    private let nativeKey = UUID().uuidString + UUID().uuidString   // never exposed to pages
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// One id per install, shared by every WebView and domain.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// Issued by the gateway on the first connection; every later page must present it.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// Call after the user agreed to remote debugging.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// Call for every WKWebViewConfiguration, before creating the WKWebView.
    func install(into configuration: WKWebViewConfiguration) {
        let ucc = configuration.userContentController
        controllers.add(ucc)
        ucc.addScriptMessageHandler(self, contentWorld: .page, name: "rwdScreenshot")
        ucc.add(self, name: "rwdState")
        apply(ucc)
    }

    private func apply(_ ucc: WKUserContentController) {
        ucc.removeAllUserScripts()
        guard let sdk else { return }
        let options: [String: Any] = [
            "deviceId": deviceId,
            "deviceToken": deviceToken as Any,
            "userId": userId as Any,
            "app": ["name": "My App", "version": "5.12.0"],
            "helpButton": false,          // the app has its own help entry
            "nativeKey": nativeKey,
            "nativeApproval": true,       // native dialogs for approvals and confirmations
            "lang": "en",
        ]
        let json = String(data: try! JSONSerialization.data(withJSONObject: options), encoding: .utf8)!
        let boot = sdk + """

        ;RemoteWebviewDebugger.run(\(js(gateway)), \(js(appKey)), \(json));
        setInterval(function () {
          try { webkit.messageHandlers.rwdState.postMessage(RemoteWebviewDebugger.status()) } catch (e) {}
        }, 500);
        """
        ucc.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    // Native buttons and dialogs. Call them on the WebView the user is looking at
    // (for nativeDecide: the one whose status reported the pending request).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // level / "allow", or nil to refuse
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState: status() of a page, every 500 ms.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // pages opened from now on carry it
        }
        onStatus?(status)
    }

    // rwdScreenshot: real pixels for take_screenshot.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let webView = message.webView else { return replyHandler(nil, "no web view") }
        webView.takeSnapshot(with: nil) { image, error in
            guard let data = image?.jpegData(compressionQuality: 0.8) else {
                return replyHandler(nil, error?.localizedDescription ?? "snapshot failed")
            }
            replyHandler("data:image/jpeg;base64," + data.base64EncodedString(), nil)
        }
    }

    private func js(_ s: String) -> String {   // a JSON string literal
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` retains its message handlers. This sketch is a singleton, so that is harmless; if your handler isn't, register a weak proxy as `RWDNative.swift` does. The reference also reports status only when it changes and tracks which WebView is in front.

## Android (WebView)

Use `WebViewCompat.addDocumentStartJavaScript` from AndroidX WebKit (`androidx.webkit:webkit`) when `WebViewFeature.DOCUMENT_START_SCRIPT` is supported, and call it before `loadUrl`. The WebView needs `javaScriptEnabled` and `domStorageEnabled`. The origin rules decide where the script runs: pass your project's `allowedOrigins`, or `setOf("*")` for every page.

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // never exposed to pages
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** One id per install, shared by every WebView and domain. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** Call after the user agreed to remote debugging. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** Call for every WebView, before loadUrl. */
    fun install(webView: WebView) {
        val sdk = sdk ?: return
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.addJavascriptInterface(ScreenshotBridge(webView), "RWDAndroid")
        webView.addJavascriptInterface(StatusBridge(), "RwdNative")
        val options = JSONObject()
            .put("deviceId", deviceId)
            .put("deviceToken", prefs.getString("deviceToken", null) ?: JSONObject.NULL)
            .put("userId", userId ?: JSONObject.NULL)
            .put("app", JSONObject().put("name", "My App").put("version", "5.12.0"))
            .put("helpButton", false)
            .put("nativeKey", nativeKey)
            .put("nativeApproval", true)
        val boot = "$sdk\n;RemoteWebviewDebugger.run(${JSONObject.quote(gateway)}, ${JSONObject.quote(appKey)}, $options);" +
            "setInterval(function(){try{RwdNative.post(JSON.stringify(RemoteWebviewDebugger.status()))}catch(e){}},500);"
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, boot, setOf("https://m.example.com"))
        } else {
            fallback(webView, boot)   // see below
        }
    }

    // Native buttons and dialogs: takeover | handback | end; a level / "allow", or null to refuse.
    fun control(webView: WebView, action: String) = eval(webView,
        "RemoteWebviewDebugger.nativeControl(${JSONObject.quote(nativeKey)}, ${JSONObject.quote(action)})")
    fun decide(webView: WebView, requestId: String, value: String?) = eval(webView,
        "RemoteWebviewDebugger.nativeDecide(${JSONObject.quote(nativeKey)}, ${JSONObject.quote(requestId)}, " +
            (value?.let { JSONObject.quote(it) } ?: "null") + ")")
    fun help(webView: WebView) = eval(webView, "RemoteWebviewDebugger.help(true)")
    private fun eval(webView: WebView, code: String) =
        webView.evaluateJavascript("window.RemoteWebviewDebugger && $code", null)

    inner class StatusBridge {
        @JavascriptInterface
        fun post(json: String) {
            val status = JSONObject(json)
            val token = status.optString("deviceToken")
            if (token.isNotEmpty() && token != prefs.getString("deviceToken", null)) {
                prefs.edit().putString("deviceToken", token).apply()   // WebViews installed from now on carry it
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** Called by the SDK on a background thread for take_screenshot; returns a JPEG data URL. */
    class ScreenshotBridge(private val webView: WebView) {
        @JavascriptInterface
        fun screenshot(): String? {
            var result: String? = null
            val done = CountDownLatch(1)
            webView.post {
                runCatching {
                    val bitmap = Bitmap.createBitmap(webView.width, webView.height, Bitmap.Config.ARGB_8888)
                    webView.draw(Canvas(bitmap))
                    val out = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)
                    result = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                }
                done.countDown()
            }
            done.await(3, TimeUnit.SECONDS)
            return result
        }
    }
}
```

This is a reference sketch that hasn't been compiled in a real Android project (imports omitted); the console's guide has the full version with imports. Notes:

- **Fallback without `DOCUMENT_START_SCRIPT`.** On WebView builds that lack the feature, inject the same script from `WebViewClient.onPageFinished` with `evaluateJavascript`, guarded with `if (!window.RemoteWebviewDebugger) { … }` so it runs once per document. Capture then starts after the page has loaded, so its earliest console messages and requests are missed.
- **JavaScript interfaces are visible to every page** loaded in that WebView, whatever its origin. Add the bridges only while remote debugging is on, never expose `nativeKey` through them, and treat what `post()` receives as untrusted input.
- `webView.draw()` doesn't capture hardware-rendered content such as video. For true pixels, use `PixelCopy` on the window (API 26+).

## Native status bar, buttons and dialogs

Poll `status()` (the sketches above post it every 500 ms; the reference only posts changes) and drive native UI from it:

| `status()` field | Use |
|---|---|
| `deviceCode`, `status` | Show the device code and whether the link is `online`, `connecting`, `polling`, `rejected` or `quota` |
| `control` | `observe`: "AI is viewing"; `agent`: "AI in control"; in both, disable the back button and swipe-back; `user`: "You've taken over" |
| `level` | The level granted to the attached agent |
| `config.helpButton` | Whether the project's policy offers help to this user; show or hide your own help entry accordingly |
| `pending` | A question for the user, see below |
| `deviceToken` | Save it when it first appears or changes |

- **Take over / hand back / end:** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`; it returns `false` if the key is wrong.
- **Get help:** `help(true)` (and `help(false)` to cancel).
- **Attach approval** (`pending.kind === 'attach'`): show `pending.agent.name` and `pending.agent.keyHint`, offer `pending.levels` (the last one is what the agent asked for), then call `nativeDecide(nativeKey, pending.requestId, level)`, or pass `null` to refuse. Answer before `pending.expiresAt` (30 seconds).
- **Action confirmation** (`pending.kind === 'confirm'`): show `pending.action` (e.g. `click "Place order"`), then `nativeDecide(nativeKey, requestId, 'allow')` or `null`.
- Run `nativeDecide` in the WebView whose status reported the request: the gateway asks the foreground page.
- Native buttons and dialogs must react only to the user's own taps. Never call `nativeControl` or `nativeDecide` on the agent's behalf.

## Device id and token

- Generate `deviceId` once per install and keep it in `UserDefaults` / `SharedPreferences`. The gateway assigns the device code to this id; a reinstall gets a new id and a new code.
- The first `welcome` carries a device token; the SDK exposes it as `status().deviceToken`. Save it and inject it into every WebView from then on (the sketches re-apply their scripts when it changes). Without it, pages on domains that haven't stored it themselves are rejected with close code 4401 (`status: 'rejected'`).
- If the app keeps a `deviceId` but loses its token, that id can't come online again. Generate a new `deviceId` (the device gets a new code).

## Opening pages from invite links

Support can create an **invite** in the console (a project's **Invites** tab) with a note such as a ticket number. The link is the project's invite URL (or one set for that invite) plus `?rwd_invite=<token>`; it works once and expires after 30 minutes by default. When a page with the SDK opens it, the SDK takes the token out of the address bar and sends it with its `hello`; the device comes online already asking for help and is marked as invited in the console, so nobody has to read out a device code.

For an app:

1. Set the invite URL to a link your app handles, e.g. a universal link (iOS) or app link (Android) such as `https://m.example.com/help`.
2. When the app receives it, open the **full URL, query string included**, in a WebView that has the SDK injected (after the user's consent, if your app asks for it).
3. The page must load the SDK with the **same project's app key** as the invite; invites from other projects are ignored.

The console also shows the link as a QR code; scanning it with the phone's camera opens the universal link.

## Try it

The [mock app](../examples/mock-app/README.md) is a phone-sized macOS app that hosts `WKWebView`s exactly like an iOS app: consent, injection, device token, native approvals and confirmations, screenshots and the native status bar are all wired up. Build it with `examples/mock-app/build-app.sh`, point it at your gateway and connect Claude Code to it.
