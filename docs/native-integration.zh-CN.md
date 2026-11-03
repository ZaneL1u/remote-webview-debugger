<!-- i18n-source: fdb9482854f20cbffaccb56f28fe428ffee0d6c6 -->
[English](native-integration.md) | 简体中文 | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# App 原生接入

H5 页面用一个 `<script>` 标签就能接入 SDK。在自己的 App 里还可以做得更好：由原生代码在每个 WebView 开始加载时注入 SDK。这样：

- App 里的所有页面都能调试，包括第三方域名，H5 代码不用改；
- 设备在所有 WebView、所有域名下**始终是同一个设备码**，因为 `deviceId` 由 App 提供，设备令牌也由 App 保存；
- agent 能通过原生桥拿到**真实截图**（视频、canvas、原生视图都在内）；
- 接入审批、操作确认以及「接管」「交还 AI」「结束」按钮都可以用**原生界面**，AI 接入期间还能锁住返回键。

控制台自带的接入说明（**接入说明 → App 原生接入**）里有同样的代码，并且已经填好你的网关地址和接入 Key。完整、可运行的参考实现是 [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift)，[模拟 App](../examples/mock-app/README.md) 用的就是它。消息层面的细节见 [protocol.zh-CN.md](protocol.zh-CN.md)。

## 接入清单

1. **征得用户同意。** 用户同意后才开启远程调试（模拟 App 会先弹一个原生的授权说明）。在此之上，设备上的接入审批照常生效。
2. **获取 SDK。** 把 npm 包 [`remote-webview-debugger`](../sdk/README.zh-CN.md) 里的 `dist/sdk.js` 打包进 App，这样网关和 CDN 都无法向 App 推送代码；或者在开启调试时下载一次，来源可以是你的网关（`https://rwd.example.com/v1/sdk.js`）或固定版本的 CDN 地址（`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.1/dist/sdk.js`）。
3. **拼出启动脚本：** SDK 源码，接着 `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`，再加一个（可选的）定时器把 `status()` 报给原生代码。
4. **在文档开始时注入**到每个 WebView 的主 frame，并且在加载第一个页面之前完成，这样记录能在任何页面脚本运行之前开始。
5. **保存 `deviceId` 和 `deviceToken`**，并传给每个 WebView。
6. **注册截图桥。**
7. **把原生界面**接到 `status()`、`help()`、`nativeControl()` 和 `nativeDecide()` 上。

## App 用到的 `run()` 选项

| 选项 | 传什么 |
|---|---|
| `deviceId` | 每次安装一个 id（生成一次 UUID 并保存）。所有 WebView、所有域名共用，所以设备码不会变。换了 id 就是一台新设备 |
| `deviceToken` | 网关为这台设备签发的令牌（`status().deviceToken`），由 App 保存；第一次连接之前为 `null`。localStorage 按来源隔离，不传它的话，新域名下的页面会被关闭码 4401 拒绝 |
| `userId` | 当前登录用户的 id，或 `null`。agent 可以按它筛选（`list_devices userId=…`），控制台会显示它，策略的 `helpButton: listed` 也按它判断。建议用内部的不透明 id，不要用个人信息。用户登录或退出时调用 `setUser(id)`，或者重新注入 |
| `app` | App 的 `{ name, version }`，agent 和控制台都能看到 |
| `nativeKey` | 启动时生成的随机密钥（比如两个 UUID 拼起来），只写进注入脚本。`nativeControl()` 和 `nativeDecide()` 都要求出示它；页面脚本（包括 agent 的 `evaluate_script`）读不到 |
| `nativeApproval` | 设为 `true` 时，接入审批和操作确认改用原生对话框，SDK 不再在页面里弹窗 |
| `helpButton` | App 有自己的协助入口时设为 `false` |
| `lang` | 与 App 的语言一致的语言标签（`'en'`、`'zh'`、`'ja'`、`'pt-BR'`…，见 [SDK 多语言](../sdk/README.zh-CN.md#多语言)）；默认跟随 `navigator.languages` |
| `lockScreen`、`theme`、`eruda` | 与 H5 页面相同，见 [protocol.zh-CN.md §10](protocol.zh-CN.md#10-宿主-javascript-接口) |

## iOS（WKWebView）

在**创建 `WKWebView` 之前**，往每个 `WKWebViewConfiguration` 的 `WKUserContentController` 里加一个 `injectionTime: .atDocumentStart`、`forMainFrameOnly: true` 的 `WKUserScript`。WebKit 为 `window.open` / `target=_blank` 创建的弹出页面，使用你在 `webView(_:createWebViewWith:…)` 里返回的配置，所以会带上同样的脚本。用户脚本只对添加之后开始的导航生效，开启调试后要把已打开的 WebView 刷新一下。截图桥需要 iOS 14（`WKScriptMessageHandlerWithReply`）。

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // 驱动原生状态条、按钮和对话框

    private let nativeKey = UUID().uuidString + UUID().uuidString   // 绝不暴露给页面
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// 每次安装一个 id，所有 WebView、所有域名共用。
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// 第一次连接时由网关签发，之后每个页面都必须出示。
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// 用户同意远程调试后调用。
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// 对每个 WKWebViewConfiguration 调用，在创建 WKWebView 之前。
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
            "helpButton": false,          // App 有自己的协助入口
            "nativeKey": nativeKey,
            "nativeApproval": true,       // 审批和确认用原生对话框
            "lang": "zh",
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

    // 原生按钮和对话框。在用户正在看的 WebView 上调用
    // （nativeDecide 要在报告了这个待处理请求的 WebView 上调用）。
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // 级别 / "allow"，nil 表示拒绝
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState：页面每 500 毫秒报一次 status()。
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // 之后打开的页面都会带上它
        }
        onStatus?(status)
    }

    // rwdScreenshot：给 take_screenshot 提供真实像素。
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

    private func js(_ s: String) -> String {   // JSON 字符串字面量
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` 会强引用它的消息处理器。上面的示例是单例，所以没有问题；如果你的处理器不是单例，请像 `RWDNative.swift` 那样注册一个弱引用代理。参考实现还只在状态变化时才上报，并且会跟踪哪个 WebView 在最前面。

## Android（WebView）

当 `WebViewFeature.DOCUMENT_START_SCRIPT` 可用时，使用 AndroidX WebKit（`androidx.webkit:webkit`）的 `WebViewCompat.addDocumentStartJavaScript`，并在 `loadUrl` 之前调用。WebView 需要开启 `javaScriptEnabled` 和 `domStorageEnabled`。来源规则决定脚本在哪些页面运行：传项目的 `allowedOrigins`，或者用 `setOf("*")` 表示所有页面。

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // 绝不暴露给页面
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** 每次安装一个 id，所有 WebView、所有域名共用。 */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** 用户同意远程调试后调用。 */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** 对每个 WebView 调用，在 loadUrl 之前。 */
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
            fallback(webView, boot)   // 见下文
        }
    }

    // 原生按钮和对话框：takeover | handback | end；级别 / "allow"，null 表示拒绝。
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
                prefs.edit().putString("deviceToken", token).apply()   // 之后安装的 WebView 都会带上它
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** take_screenshot 时由 SDK 在后台线程调用，返回 JPEG data URL。 */
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

这是一份没有在真实 Android 项目里编译过的参考代码（省略了 import），带 import 的完整版本见控制台的接入说明。注意：

- **不支持 `DOCUMENT_START_SCRIPT` 时的兜底。** 在缺少这个特性的 WebView 版本上，改在 `WebViewClient.onPageFinished` 里用 `evaluateJavascript` 注入同一段脚本，并用 `if (!window.RemoteWebviewDebugger) { … }` 包住，保证每个文档只执行一次。这样记录要等页面加载完才开始，页面最早的 console 消息和请求会漏掉。
- **JavaScript 接口对这个 WebView 里加载的所有页面都可见**，不论来源。只在开启远程调试期间添加这些接口，绝不要通过它们暴露 `nativeKey`，并把 `post()` 收到的内容当作不可信输入。
- `webView.draw()` 截不到视频等硬件渲染的内容。需要真实像素时，在窗口上用 `PixelCopy`（API 26+）。

## 原生状态条、按钮和对话框

轮询 `status()`（上面的示例每 500 毫秒上报一次，参考实现只在变化时上报），用它驱动原生界面：

| `status()` 字段 | 用途 |
|---|---|
| `deviceCode`、`status` | 显示设备码，以及连接状态：`online`、`connecting`、`polling`、`rejected` 或 `quota` |
| `control` | `observe`：显示「AI 正在查看」；`agent`：显示「AI 正在操作」；两者都禁用返回键和侧滑返回；`user`：显示「你已接管」 |
| `level` | 已接入的 agent 获得的级别 |
| `config.helpButton` | 项目策略是否为这个用户提供协助入口，据此显示或隐藏 App 自己的协助入口 |
| `pending` | 需要用户回答的问题，见下文 |
| `deviceToken` | 首次出现或变化时保存 |

- **接管 / 交还 AI / 结束：** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`，密钥不对时返回 `false`。
- **请求协助：** `help(true)`（`help(false)` 取消请求）。
- **接入审批**（`pending.kind === 'attach'`）：展示 `pending.agent.name` 和 `pending.agent.keyHint`，让用户从 `pending.levels` 里选择（最后一个是 agent 申请的级别），然后调用 `nativeDecide(nativeKey, pending.requestId, level)`，传 `null` 表示拒绝。要在 `pending.expiresAt`（30 秒）之前答复。
- **操作确认**（`pending.kind === 'confirm'`）：展示 `pending.action`（如 `点击「提交订单」`），然后调用 `nativeDecide(nativeKey, requestId, 'allow')` 或传 `null`。
- 在报告了这个请求的 WebView 上执行 `nativeDecide`：网关只向前台页面发审批请求。
- 原生按钮和对话框只能响应用户自己的点击。绝不要替 agent 调用 `nativeControl` 或 `nativeDecide`。

## 设备 id 与设备令牌

- 每次安装生成一次 `deviceId`，保存在 `UserDefaults` / `SharedPreferences` 里。网关把设备码分配给这个 id；重装 App 会得到新的 id 和新的设备码。
- 第一个 `welcome` 会带来设备令牌，SDK 通过 `status().deviceToken` 暴露它。保存下来，之后注入到每个 WebView（上面的示例在它变化时会重新应用脚本）。不这样做的话，那些自己没存过令牌的域名下的页面会被关闭码 4401 拒绝（`status: 'rejected'`）。
- 如果 App 保留了 `deviceId` 却丢了令牌，这个 id 就再也无法上线，只能生成新的 `deviceId`（设备码也会变）。

## 通过邀请链接打开页面

客服可以在控制台（项目的「邀请」页）创建**邀请**，备注里写上工单号之类的信息。链接是项目的邀请地址（或者为这个邀请单独填写的地址）加上 `?rwd_invite=<令牌>`，只能用一次，默认 30 分钟后失效。接入了 SDK 的页面打开它时，SDK 会把令牌从地址栏取走、随 `hello` 发给网关；设备一上线就已在请求协助，并在控制台标记为「通过邀请接入」，谁都不用口头报设备码。

在 App 里：

1. 把邀请地址设为 App 能处理的链接，比如 iOS 的通用链接或 Android 的 App Link，例如 `https://m.example.com/help`。
2. App 收到这个链接时，把**完整的 URL（包括查询参数）**加载到注入了 SDK 的 WebView 里（如果 App 需要先征得用户同意，就在同意之后）。
3. 页面必须用与邀请**同一个项目的接入 Key** 加载 SDK；其他项目的邀请会被忽略。

控制台还会把链接显示成二维码，用手机相机扫一下就能打开这个通用链接。

## 动手试试

[模拟 App](../examples/mock-app/README.md) 是一个手机大小的 macOS App，像 iOS App 一样承载 `WKWebView`：授权、注入、设备令牌、原生审批与确认、截图和原生状态条都已经接好。用 `examples/mock-app/build-app.sh` 构建，指向你的网关，再让 Claude Code 连上它。
