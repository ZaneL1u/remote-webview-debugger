<!-- i18n-source: d65106286935d00b9911913bf16cf2dfdf7bb300 -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | 繁體中文 | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# App 原生整合

H5 頁面用一個 `<script>` 標籤就能載入 SDK。在你自己的 App 裡還能做得更好：由原生程式碼在每個 WebView 開始載入時注入 SDK。這樣一來：

- App 裡的每個頁面都能除錯，包括第三方網域，而且不必修改 H5 程式碼；
- 裝置在所有 WebView 和網域之間**始終使用同一組裝置碼**，因為 `deviceId` 由 App 提供，裝置權杖也由 App 保存；
- agent 能透過原生橋接取得**真實截圖**（影片、canvas、原生覆蓋層都包含在內）；
- 連線核准、操作確認以及「接管」「交還」「結束」按鈕都可以改用**原生介面**，AI 連線期間還能鎖住返回鍵。

主控台內建的整合指南（**說明文件 → 整合原生 App**）提供同樣的程式碼，並已填好你的閘道網址和接入金鑰。完整、可執行的參考實作是 [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift)，[模擬 App](../examples/mock-app/README.md) 用的就是它。訊息層級的細節請見 [protocol.zh-TW.md](protocol.zh-TW.md)。

## 整合檢查清單

1. **徵得使用者同意。** 使用者同意之後才開啟遠端除錯（模擬 App 會先顯示一個原生的同意對話框）。在此之上，裝置上的連線核准依然有效。
2. **取得 SDK。** 把 npm 套件 [`remote-webview-debugger`](../sdk/README.zh-TW.md) 中的 `dist/sdk.js` 打包進 App，這樣閘道和 CDN 都無法向它推送程式碼；或是在啟用除錯時下載一次，來源可以是你的閘道（`https://rwd.example.com/v1/sdk.js`）或固定版本的 CDN 網址（`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js`）。
3. **組出啟動指令碼：** 先是 SDK 原始碼，接著 `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`，再加上一個（選用的）計時器，把 `status()` 回報給原生程式碼。
4. **在 document start 時注入**到每個 WebView 的主 frame，並且在第一個頁面載入之前完成，讓記錄在任何頁面指令碼執行之前就開始。
5. **把 `deviceId` 和 `deviceToken` 保存**在 App 的儲存空間中，並傳給每個 WebView。
6. **註冊截圖橋接。**
7. **把原生介面**接到 `status()`、`help()`、`nativeControl()` 和 `nativeDecide()`。

## App 適用的 `run()` 選項

| 選項 | 要傳入什麼 |
|---|---|
| `deviceId` | 每次安裝一個 id（產生一次 UUID 並保存）。所有 WebView 和所有網域共用，所以裝置碼永遠不會變。改了 id 就會變成一台新裝置 |
| `deviceToken` | 閘道為這台裝置簽發的權杖（`status().deviceToken`），由 App 保存；第一次連線之前為 `null`。localStorage 依來源隔離，沒有傳入它的話，新網域上的頁面會被以關閉碼 4401 拒絕 |
| `userId` | 目前登入使用者的 id，或 `null`。agent 可以依它篩選（`list_devices userId=…`），主控台會顯示它，策略中的 `helpButton: listed` 也會用到它。建議使用不透明的內部 id，而非個人資料。使用者登入或登出時，呼叫 `setUser(id)` 或重新注入 |
| `app` | 你的 App 的 `{ name, version }`，會顯示給 agent 並出現在主控台 |
| `nativeKey` | 啟動時產生的隨機密鑰（例如兩個 UUID 串接），只寫進注入的指令碼。`nativeControl()` 和 `nativeDecide()` 都要求出示它；頁面指令碼（包括 agent 的 `evaluate_script`）都讀不到 |
| `nativeApproval` | 設為 `true` 時，連線核准和操作確認會改用原生對話框，而不是 SDK 的頁內對話框 |
| `helpButton` | App 有自己的「請求協助」入口時設為 `false` |
| `lang` | 與 App 語言一致的語言標記（`'en'`、`'zh'`、`'ja'`、`'pt-BR'`…，見 [SDK 語言](../sdk/README.zh-TW.md#語言)）；預設跟隨 `navigator.languages` |
| `lockScreen`、`theme`、`eruda` | 與 H5 頁面相同，請見 [protocol.zh-TW.md §10](protocol.zh-TW.md#10-宿主-javascript-介面) |

## iOS（WKWebView）

在**建立 `WKWebView` 之前**，於每個 `WKWebViewConfiguration` 的 `WKUserContentController` 中加入一個 `injectionTime: .atDocumentStart`、`forMainFrameOnly: true` 的 `WKUserScript`。WebKit 為 `window.open` / `target=_blank` 建立的彈出視窗，會沿用你在 `webView(_:createWebViewWith:…)` 中回傳的設定，所以也會帶上同樣的指令碼。使用者指令碼只對加入之後才開始的導覽生效；啟用除錯後，請重新載入已開啟的 WebView。截圖橋接需要 iOS 14（`WKScriptMessageHandlerWithReply`）。

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // 驅動原生狀態列、按鈕和對話框

    private let nativeKey = UUID().uuidString + UUID().uuidString   // 絕不暴露給頁面
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// 每次安裝一個 id，所有 WebView 和網域共用。
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// 第一次連線時由閘道簽發，之後每個頁面都必須出示。
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// 在使用者同意遠端除錯之後呼叫。
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// 對每個 WKWebViewConfiguration 呼叫，且在建立 WKWebView 之前。
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
            "helpButton": false,          // App 有自己的協助入口
            "nativeKey": nativeKey,
            "nativeApproval": true,       // 核准和確認使用原生對話框
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

    // 原生按鈕和對話框。在使用者正在看的 WebView 上呼叫
    // （nativeDecide 則要在回報了這個待處理請求的 WebView 上呼叫）。
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // 等級 / "allow"，nil 表示拒絕
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState：頁面每 500 毫秒回報一次 status()。
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // 之後開啟的頁面都會帶上它
        }
        onStatus?(status)
    }

    // rwdScreenshot：為 take_screenshot 提供真實像素。
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

    private func js(_ s: String) -> String {   // JSON 字串常值
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` 會強參照它的訊息處理器。上面的範例是單例，所以沒有問題；如果你的處理器不是單例，請像 `RWDNative.swift` 那樣註冊一個弱參照代理。參考實作還只會在狀態改變時才回報，並追蹤哪個 WebView 位於最前面。

## Android（WebView）

當 `WebViewFeature.DOCUMENT_START_SCRIPT` 受支援時，使用 AndroidX WebKit（`androidx.webkit:webkit`）的 `WebViewCompat.addDocumentStartJavaScript`，並在 `loadUrl` 之前呼叫。WebView 需要啟用 `javaScriptEnabled` 和 `domStorageEnabled`。來源規則決定指令碼在哪裡執行：傳入專案的 `allowedOrigins`，或用 `setOf("*")` 表示所有頁面。

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // 絕不暴露給頁面
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** 每次安裝一個 id，所有 WebView 和網域共用。 */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** 在使用者同意遠端除錯之後呼叫。 */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** 對每個 WebView 呼叫，且在 loadUrl 之前。 */
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
            fallback(webView, boot)   // 見下文
        }
    }

    // 原生按鈕和對話框：takeover | handback | end；等級 / "allow"，null 表示拒絕。
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
                prefs.edit().putString("deviceToken", token).apply()   // 之後安裝的 WebView 都會帶上它
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** take_screenshot 時由 SDK 在背景執行緒呼叫，回傳 JPEG data URL。 */
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

這是一份尚未在真實 Android 專案中編譯過的參考程式碼（省略了 import）；含 import 的完整版本請見主控台的整合指南。注意事項：

- **不支援 `DOCUMENT_START_SCRIPT` 時的備援做法。** 在缺少這項功能的 WebView 版本上，改從 `WebViewClient.onPageFinished` 以 `evaluateJavascript` 注入同一段指令碼，並用 `if (!window.RemoteWebviewDebugger) { … }` 包起來，確保每份文件只執行一次。如此一來，記錄要等頁面載入完成才開始，頁面最早的 console 訊息和請求會漏掉。
- **JavaScript 介面對這個 WebView 中載入的每個頁面都是可見的**，不論其來源為何。只在遠端除錯開啟期間加入這些橋接，絕不要透過它們暴露 `nativeKey`，並把 `post()` 收到的內容視為不受信任的輸入。
- `webView.draw()` 擷取不到影片等硬體算繪的內容。需要真實像素時，請在視窗上使用 `PixelCopy`（API 26+）。

## 原生狀態列、按鈕和對話框

輪詢 `status()`（上面的範例每 500 毫秒回報一次，參考實作則只在改變時回報），並據此驅動原生介面：

| `status()` 欄位 | 用途 |
|---|---|
| `deviceCode`、`status` | 顯示裝置碼，以及連線狀態是 `online`、`connecting`、`polling`、`rejected` 還是 `quota` |
| `control` | `observe`：「AI 正在檢視」；`agent`：「AI 正在操作」；兩者都要停用返回鍵和滑動返回；`user`：「你已接管」 |
| `level` | 授予已連線 agent 的等級 |
| `config.helpButton` | 專案策略是否為這位使用者提供協助功能；據此顯示或隱藏你自己的協助入口 |
| `pending` | 需要使用者回答的問題，見下文 |
| `deviceToken` | 首次出現或改變時保存下來 |

- **接管 / 交還 / 結束：** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`；密鑰錯誤時回傳 `false`。
- **請求協助：** `help(true)`（`help(false)` 取消請求）。
- **連線核准**（`pending.kind === 'attach'`）：顯示 `pending.agent.name` 和 `pending.agent.keyHint`，讓使用者從 `pending.levels` 中選擇（最後一個是 agent 要求的等級），然後呼叫 `nativeDecide(nativeKey, pending.requestId, level)`，或傳入 `null` 表示拒絕。請在 `pending.expiresAt`（30 秒）之前回覆。
- **操作確認**（`pending.kind === 'confirm'`）：顯示 `pending.action`（例如 `click "Place order"`），然後呼叫 `nativeDecide(nativeKey, requestId, 'allow')` 或傳入 `null`。
- 在回報了這個請求的 WebView 上執行 `nativeDecide`：閘道只會詢問前景頁面。
- 原生按鈕和對話框只能回應使用者自己的點擊。絕不要代替 agent 呼叫 `nativeControl` 或 `nativeDecide`。

## 裝置 id 與權杖

- 每次安裝產生一次 `deviceId`，保存在 `UserDefaults` / `SharedPreferences` 中。閘道會把裝置碼指派給這個 id；重新安裝會得到新的 id 和新的裝置碼。
- 第一個 `welcome` 會帶有裝置權杖，SDK 透過 `status().deviceToken` 提供它。請保存下來，之後注入到每個 WebView（上面的範例在它改變時會重新套用指令碼）。沒有它的話，那些自己沒存過權杖的網域上的頁面會被以關閉碼 4401 拒絕（`status: 'rejected'`）。
- 如果 App 保留了 `deviceId` 卻遺失了權杖，這個 id 就再也無法上線。請產生新的 `deviceId`（裝置會拿到新的裝置碼）。

## 從邀請連結開啟頁面

客服可以在主控台（專案的「邀請」分頁）建立**邀請**，並附上工單編號之類的備註。連結是專案的邀請網址（或為這個邀請另外設定的網址）加上 `?rwd_invite=<token>`；只能使用一次，預設 30 分鐘後失效。載入了 SDK 的頁面開啟它時，SDK 會把權杖從網址列中取出，隨 `hello` 一起送出；裝置一上線就已在請求協助，並在主控台中標示為受邀，沒有人需要口頭唸出裝置碼。

在 App 中：

1. 把邀請網址設為 App 能處理的連結，例如 iOS 的 universal link 或 Android 的 app link，像是 `https://m.example.com/help`。
2. App 收到連結時，把**完整的 URL（包含查詢字串）**載入到已注入 SDK 的 WebView 中（如果你的 App 需要先徵求使用者同意，則在同意之後）。
3. 頁面必須以與邀請**相同專案的接入金鑰**載入 SDK；其他專案的邀請會被忽略。

主控台也會把連結顯示成 QR Code，用手機相機掃描就能開啟這個 universal link。

## 動手試試

[模擬 App](../examples/mock-app/README.md) 是一個手機大小的 macOS App，它承載 `WKWebView` 的方式和 iOS App 完全一樣：同意流程、注入、裝置權杖、原生核准與確認、截圖和原生狀態列都已經串接好。用 `examples/mock-app/build-app.sh` 建置，指向你的閘道，再把 Claude Code 連上它。
