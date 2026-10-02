// Ready-to-copy integration snippets with the project's values filled in. Their comments follow the UI
// language (read at call time, so callers re-render them on a language change).

import { getT } from '@/i18n'

const q = (s: string) => JSON.stringify(s)

const s = () => getT().integration.snippets

/** Pads each code part to the widest one so the trailing `//` comments line up. */
function aligned(rows: [code: string, comment: string][], indent: string) {
  const width = Math.max(...rows.map(([code]) => code.length))
  return rows.map(([code, comment]) => `${indent}${code.padEnd(width)} // ${comment}`).join('\n')
}

export function h5Snippet(gateway: string, appKey: string) {
  const t = s()
  return `<!-- ${t.h5Head} -->
<script src="${gateway}/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run(${q(gateway)}, ${q(appKey)}, {
    userId: null,       // ${t.userIdOptional}
    helpButton: true,   // ${t.helpButton}
  })
</script>`
}

/** SRI value for the `integrity` attribute; tolerates a gateway that returns the bare base64 digest. */
export function sriValue(integrity: string) {
  return /^sha(256|384|512)-/.test(integrity) ? integrity : `sha384-${integrity}`
}

export function pinnedSdkUrl(gateway: string, version: string) {
  return `${gateway}/sdk/${encodeURIComponent(version)}/sdk.js`
}

/** Same as h5Snippet, but loads an exact SDK version guarded by Subresource Integrity (section 16). */
export function h5PinnedSnippet(gateway: string, appKey: string, version: string, integrity: string) {
  const t = s()
  return `<!-- ${t.h5Pinned(version)} -->
<script src="${pinnedSdkUrl(gateway, version)}"
        integrity="${sriValue(integrity)}"
        crossorigin="anonymous"></script>
<script>
  RemoteWebviewDebugger.run(${q(gateway)}, ${q(appKey)}, {
    userId: null,       // ${t.userIdOptional}
    helpButton: true,   // ${t.helpButton}
  })
</script>`
}

export function iosSnippet(gateway: string, appKey: string) {
  const t = s()
  return `import WebKit

/// ${t.iosInstall}
enum RemoteWebviewDebugger {
    static let gateway = ${q(gateway)}
    static let appKey = ${q(appKey)}

    /// ${t.deviceIdPerInstall}
    static var deviceId: String {
        let key = "rwd.deviceId"
        if let id = UserDefaults.standard.string(forKey: key) { return id }
        let id = UUID().uuidString.lowercased()
        UserDefaults.standard.set(id, forKey: key)
        return id
    }

    static func install(into controller: WKUserContentController,
                        userId: String?,
                        completion: @escaping () -> Void) {
        let url = URL(string: "\\(gateway)/sdk.js")!
        URLSession.shared.dataTask(with: url) { data, _, _ in
            DispatchQueue.main.async {
                defer { completion() }
                guard let data, let sdk = String(data: data, encoding: .utf8) else { return }
                let info = Bundle.main.infoDictionary
                let options: [String: Any] = [
                    "deviceId": deviceId,
                    "userId": userId ?? NSNull(),
                    "helpButton": true,
                    "app": [
                        "name": info?["CFBundleName"] as? String ?? "",
                        "version": info?["CFBundleShortVersionString"] as? String ?? "",
                    ],
                ]
                let json = String(data: try! JSONSerialization.data(withJSONObject: options), encoding: .utf8)!
                let source = sdk + "\\n;RemoteWebviewDebugger.run(\\"\\(gateway)\\", \\"\\(appKey)\\", \\(json));"
                controller.addUserScript(WKUserScript(source: source,
                                                      injectionTime: .atDocumentStart,
                                                      forMainFrameOnly: true))
            }
        }.resume()
    }
}

// ${t.usage}
// let config = WKWebViewConfiguration()
// RemoteWebviewDebugger.install(into: config.userContentController, userId: currentUserId) {
//     webView.load(URLRequest(url: pageURL))
// }`
}

export function androidSnippet(gateway: string, appKey: string, allowedOrigins: string[]) {
  const rules = allowedOrigins.length ? allowedOrigins.map((o) => q(o)).join(', ') : q('*')
  const t = s()
  return `import android.content.Context
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.net.URL
import java.util.UUID
import kotlin.concurrent.thread

// ${t.dependency('implementation("androidx.webkit:webkit:1.12.0")')}
// ${t.androidWebViewSettings}
object RemoteWebviewDebugger {
    private const val GATEWAY = ${q(gateway)}
    private const val APP_KEY = ${q(appKey)}

    /** ${t.deviceIdPerInstall} */
    private fun deviceId(context: Context): String {
        val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
        return prefs.getString("deviceId", null)
            ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }
    }

    /** ${t.androidInstall} */
    fun install(webView: WebView, userId: String?, onReady: () -> Unit) {
        val context = webView.context
        thread {
            val sdk = runCatching { URL("$GATEWAY/sdk.js").readText() }.getOrNull()
            webView.post {
                if (sdk != null && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    val pkg = context.packageManager.getPackageInfo(context.packageName, 0)
                    val options = JSONObject()
                        .put("deviceId", deviceId(context))
                        .put("userId", userId ?: JSONObject.NULL)
                        .put("helpButton", true)
                        .put("app", JSONObject()
                            .put("name", context.applicationInfo.loadLabel(context.packageManager).toString())
                            .put("version", pkg.versionName ?: ""))
                    val script = "$sdk\\n;RemoteWebviewDebugger.run(" +
                        "\${JSONObject.quote(GATEWAY)}, \${JSONObject.quote(APP_KEY)}, $options);"
                    WebViewCompat.addDocumentStartJavaScript(webView, script, setOf(${rules}))
                }
                onReady()
            }
        }
    }
}

// ${t.usage}
// RemoteWebviewDebugger.install(webView, currentUserId) { webView.loadUrl(pageUrl) }`
}

export function hostedMcpCommand(gateway: string, key: string) {
  return `claude mcp add --transport http rwd ${gateway}/mcp --header "Authorization: Bearer ${key}"`
}

export function localMcpCommand(gateway: string, key: string) {
  return `claude mcp add rwd -e RWD_API_KEY=${key} -- rwd mcp --gateway ${gateway}`
}

export function mcpJsonConfig(gateway: string, key: string) {
  return JSON.stringify(
    { mcpServers: { rwd: { type: 'http', url: `${gateway}/mcp`, headers: { Authorization: `Bearer ${key}` } } } },
    null,
    2,
  )
}

// ---- Integration guide (routes/docs.tsx) ----

/** Host part of the gateway URL, for CSP. */
export function gatewayOrigins(gateway: string) {
  try {
    const u = new URL(gateway)
    const ws = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return { http: `${u.protocol}//${u.host}`, ws: `${ws}//${u.host}` }
  } catch {
    return { http: 'https://rwd.example.com', ws: 'wss://rwd.example.com' }
  }
}

/** Every run() option, annotated. */
export function h5FullSnippet(gateway: string, appKey: string) {
  const t = s()
  const options = aligned(
    [
      ['userId: window.currentUser?.id ?? null,', t.full.userId],
      ['helpButton: true,', t.full.helpButton],
      [`app: { name: ${q(t.sampleAppName)}, version: "5.12.0" },`, t.full.app],
    ],
    '    ',
  )
  return `<script src="${gateway}/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run(${q(gateway)}, ${q(appKey)}, {
${options}
    // ${t.full.nativeOnly}
    // deviceId, nativeKey, deviceToken, nativeApproval
  }).then(({ deviceCode, status }) => {
    console.log(${q(t.full.deviceCode)}, deviceCode, status) // ${t.full.example} GSJH-EV2J online
  })
</script>`
}

export function jsApiSnippet() {
  const t = s().jsApi
  return `const s = RemoteWebviewDebugger.status()
// { deviceCode: "GSJH-EV2J", status: "online", control: "none", help: false,
//   label: "p1", deviceId, pageId, version, deviceToken, level, config, pending }

RemoteWebviewDebugger.help(true)          // ${t.help}
RemoteWebviewDebugger.setUser("u-42")     // ${t.setUser}
RemoteWebviewDebugger.stop()              // ${t.stop}`
}

export function cspSnippet(gateway: string) {
  const o = gatewayOrigins(gateway)
  return `Content-Security-Policy:
  script-src 'self' ${o.http};
  connect-src 'self' ${o.http} ${o.ws};`
}

export function maskSnippet() {
  const t = s().mask
  return `<!-- ${t.masked} -->
<span class="user-phone" data-rwd-mask>${t.samplePhone}</span>
<input name="idCard" data-rwd-mask>

<!-- ${t.confirm} -->
<button id="submit-order" data-rwd-confirm>${t.placeOrder}</button>`
}

export function swiftNativeSnippet(gateway: string, appKey: string) {
  const t = s()
  const n = t.native
  return `import UIKit
import WebKit

/// ${n.swiftTrimmed}
/// ${n.swiftInstall}
final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = ${q(gateway)}
    let appKey = ${q(appKey)}
    var userId: String?
    var onState: (([String: Any]) -> Void)?   // ${n.swiftOnState}
    var onPending: (([String: Any]?) -> Void)? // ${n.swiftOnPending}

${n.swiftNativeKey.map((line) => `    /// ${line}`).join('\n')}
    private let nativeKey = UUID().uuidString + UUID().uuidString
    private var sdk: String?
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private weak var frontmost: WKWebView?

    /// ${n.swiftDeviceId}
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// ${n.swiftDeviceToken}
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// ${n.swiftEnable}
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    func install(into configuration: WKWebViewConfiguration) {
        let ucc = configuration.userContentController
        controllers.add(ucc)
        ucc.addScriptMessageHandler(self, contentWorld: .page, name: "rwdScreenshot") // ${n.screenshotBridge}
        ucc.add(self, name: "rwdState")
        apply(ucc)
    }

    private func apply(_ ucc: WKUserContentController) {
        ucc.removeAllUserScripts()
        guard let sdk else { return }
        let options: [String: Any] = [
            "deviceId": deviceId,
            "userId": userId as Any,
            "helpButton": false,          // ${n.swiftOwnHelp}
            "app": ["name": ${q(t.sampleAppName)}, "version": "5.12.0"],
            "nativeKey": nativeKey,
            "nativeApproval": true,       // ${n.swiftNativeApproval}
            "deviceToken": deviceToken as Any,
        ]
        let json = String(data: try! JSONSerialization.data(withJSONObject: options), encoding: .utf8)!
        let boot = sdk + """

        ;RemoteWebviewDebugger.run(\\(js(gateway)), \\(js(appKey)), \\(json));
        setInterval(function () {
          try { webkit.messageHandlers.rwdState.postMessage(RemoteWebviewDebugger.status()) } catch (e) {}
        }, 500);
        """
        // ${n.swiftDocumentStart}
        ucc.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    // MARK: ${n.buttons}

    func help() { eval("RemoteWebviewDebugger.help(true)") }
    /// takeover | handback | end
    func control(_ action: String) { eval("RemoteWebviewDebugger.nativeControl(\\(js(nativeKey)), \\(js(action)))") }
    /// ${n.swiftDecide}
    func decide(_ requestId: String, _ value: String?) {
        eval("RemoteWebviewDebugger.nativeDecide(\\(js(nativeKey)), \\(js(requestId)), \\(value.map(js) ?? "null"))")
    }
    func track(frontmost webView: WKWebView) { frontmost = webView }
    private func eval(_ code: String) { frontmost?.evaluateJavaScript("window.RemoteWebviewDebugger && " + code) }

    // MARK: WKScriptMessageHandler

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let s = message.body as? [String: Any] else { return }
        if let token = s["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token                      // ${n.swiftTokenCarried}
            controllers.allObjects.forEach(apply)
        }
        onPending?(s["pending"] as? [String: Any])  // {kind: attach|confirm, requestId, agent, levels, action, expiresAt}
        if message.webView == frontmost { onState?(s) } // {deviceCode, status, control, help, level, …}
    }

    /// ${n.swiftScreenshot}
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

    private func js(_ s: String) -> String {
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}`
}

export function kotlinNativeSnippet(gateway: string, appKey: string, allowedOrigins: string[]) {
  const rules = allowedOrigins.length ? allowedOrigins.map((o) => q(o)).join(', ') : q('*')
  const t = s()
  const n = t.native
  return `// ${n.kotlinReference}
// ${t.dependency('implementation("androidx.webkit:webkit:1.12.0")')}
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.URL
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class Rwd(private val context: Context) {
    private val gateway = ${q(gateway)}
    private val appKey = ${q(appKey)}
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    /** ${n.kotlinNativeKey} */
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()
    private var sdk: String? = null
    var userId: String? = null
    var onState: ((JSONObject) -> Unit)? = null      // ${n.kotlinOnState}
    var onPending: ((JSONObject?) -> Unit)? = null   // ${n.kotlinOnPending}

    /** ${n.kotlinDeviceId} */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** ${n.kotlinEnable} */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        android.os.Handler(context.mainLooper).post(onReady)
    }

    /** ${n.kotlinInstall} */
    fun install(webView: WebView) {
        val sdk = sdk ?: return
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        webView.addJavascriptInterface(ScreenshotBridge(webView), "RWDAndroid") // ${n.screenshotBridge}
        webView.addJavascriptInterface(StateBridge(), "RwdNative")
        val options = JSONObject()
            .put("deviceId", deviceId)
            .put("userId", userId ?: JSONObject.NULL)
            .put("helpButton", false)
            .put("app", JSONObject().put("name", ${q(t.sampleAppName)}).put("version", "5.12.0"))
            .put("nativeKey", nativeKey)
            .put("nativeApproval", true)
            .put("deviceToken", prefs.getString("deviceToken", null) ?: JSONObject.NULL)
        val boot = "$sdk\\n;RemoteWebviewDebugger.run(\${JSONObject.quote(gateway)}, \${JSONObject.quote(appKey)}, $options);" +
            "setInterval(function(){try{RwdNative.post(JSON.stringify(RemoteWebviewDebugger.status()))}catch(e){}},500);"
        WebViewCompat.addDocumentStartJavaScript(webView, boot, setOf(${rules}))
    }

    // ${n.kotlinButtons}
    fun help(webView: WebView) = eval(webView, "RemoteWebviewDebugger.help(true)")
    fun control(webView: WebView, action: String) =
        eval(webView, "RemoteWebviewDebugger.nativeControl(\${JSONObject.quote(nativeKey)}, \${JSONObject.quote(action)})")
    fun decide(webView: WebView, requestId: String, value: String?) = eval(webView,
        "RemoteWebviewDebugger.nativeDecide(\${JSONObject.quote(nativeKey)}, \${JSONObject.quote(requestId)}, " +
            (value?.let { JSONObject.quote(it) } ?: "null") + ")")
    private fun eval(webView: WebView, code: String) =
        webView.evaluateJavascript("window.RemoteWebviewDebugger && $code", null)

    inner class StateBridge {
        @JavascriptInterface
        fun post(json: String) {
            val s = JSONObject(json)
            val token = s.optString("deviceToken")
            if (token.isNotEmpty() && token != prefs.getString("deviceToken", null)) {
                prefs.edit().putString("deviceToken", token).apply() // ${n.kotlinTokenCarried}
            }
            android.os.Handler(context.mainLooper).post {
                onPending?.invoke(s.optJSONObject("pending"))
                onState?.invoke(s)
            }
        }
    }

    /** ${n.kotlinScreenshot} */
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
}`
}

export function cursorMcpConfig(gateway: string, key: string) {
  return JSON.stringify({ mcpServers: { rwd: { url: `${gateway}/mcp`, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)
}

/** For clients that only speak stdio (e.g. Claude Desktop): the local `rwd mcp` bridge. */
export function stdioMcpConfig(gateway: string, key: string) {
  return JSON.stringify(
    { mcpServers: { rwd: { command: 'rwd', args: ['mcp', '--gateway', gateway], env: { RWD_API_KEY: key } } } },
    null,
    2,
  )
}
