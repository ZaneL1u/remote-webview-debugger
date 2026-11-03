<!-- i18n-source: b356ba9005954ef85d8a12f95b7e8e136e054fd4 -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | 한국어 | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# 네이티브 앱 연동

H5 페이지는 `<script>` 태그로 SDK를 불러올 수 있어요. 자사 앱 안에서는 더 나은 방법이 있어요. 네이티브 코드에서 모든 WebView에 로딩이 시작될 때 SDK를 주입하는 거예요. 그러면:

- 서드파티 도메인을 포함해 앱 안의 모든 페이지를 H5 코드 수정 없이 디버깅할 수 있어요.
- 앱이 `deviceId`를 제공하고 기기 토큰을 보관하므로, WebView와 도메인이 달라도 기기가 **기기 코드 하나**를 유지해요.
- 에이전트가 네이티브 브리지를 통해 **실제 스크린샷**(동영상, canvas, 네이티브 오버레이 포함)을 받아요.
- 승인, 확인, 직접 조작 / AI에 맡기기 / 종료 버튼을 **네이티브 UI**로 만들 수 있고, AI가 접속해 있는 동안 뒤로 가기 버튼을 잠글 수 있어요.

콘솔에 내장된 가이드(**문서 → 네이티브 앱 연동**)는 같은 코드를 여러분의 게이트웨이 URL과 앱 키를 채워서 보여 줘요. 실행 가능한 완전한 참고 구현은 [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift)이고, [목업 앱](../examples/mock-app/README.md)이 이를 사용해요. 메시지 수준의 세부 사항은 [protocol.ko.md](protocol.ko.md)에 있어요.

## 체크리스트

1. **동의를 받으세요.** 사용자가 동의한 뒤에만 원격 디버깅을 켜세요(목업 앱은 먼저 네이티브 동의 대화상자를 보여 줘요). 그 위에 기기에서의 접속 승인도 여전히 적용돼요.
2. **SDK를 준비하세요.** npm 패키지 [`remote-webview-debugger`](../sdk/README.ko.md)의 `dist/sdk.js`를 앱에 포함하면 게이트웨이도 CDN도 앱에 코드를 밀어 넣을 수 없어요. 또는 디버깅을 켤 때 한 번, 게이트웨이(`https://rwd.example.com/v1/sdk.js`)나 버전을 고정한 CDN URL(`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js`)에서 다운로드하세요.
3. **부트 스크립트를 만드세요:** SDK 소스, 그다음 `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`, 그리고 (선택적으로) `status()`를 네이티브 코드에 보고하는 타이머.
4. **문서 시작 시점에 주입하세요.** 모든 WebView의 메인 프레임에, 첫 페이지가 로드되기 전에 주입해야 페이지 스크립트가 실행되기 전에 수집이 시작돼요.
5. **`deviceId`와 `deviceToken`을 보관하세요.** 앱 저장소에 두고 둘 다 모든 WebView에 넘기세요.
6. **스크린샷 브리지를 등록하세요.**
7. **네이티브 UI를 연결하세요.** `status()`, `help()`, `nativeControl()`, `nativeDecide()`에 연결하면 돼요.

## 앱용 `run()` 옵션

| 옵션 | 넘길 값 |
|---|---|
| `deviceId` | 설치마다 ID 하나(한 번 생성해 저장해 두는 UUID). 모든 WebView와 모든 도메인이 공유하므로 기기 코드가 바뀌지 않아요. 바꾸면 새 기기가 생겨요 |
| `deviceToken` | 게이트웨이가 이 기기에 발급한 토큰(`status().deviceToken`)으로, 앱이 저장해 둬요. 첫 연결 전에는 `null`이에요. localStorage는 출처별로 나뉘므로, 이 값이 없으면 새 도메인의 페이지는 종료 코드 4401로 거부돼요 |
| `userId` | 로그인한 사용자의 ID, 또는 `null`. 에이전트가 이 값으로 필터링할 수 있고(`list_devices userId=…`), 콘솔에 표시되며, 정책의 `helpButton: listed`가 이 값을 사용해요. 개인정보보다는 불투명한 내부 ID를 쓰세요. 사용자가 로그인하거나 로그아웃하면 `setUser(id)`를 호출하거나 다시 주입하세요 |
| `app` | 앱의 `{ name, version }`. 에이전트와 콘솔에 표시돼요 |
| `nativeKey` | 앱 실행 시 생성해(예: UUID 두 개) 주입 스크립트에만 넣는 무작위 비밀 값. `nativeControl()`과 `nativeDecide()`에 필요하고, 페이지 스크립트(에이전트의 `evaluate_script` 포함)는 읽을 수 없어요 |
| `nativeApproval` | `true`이면 접속 승인과 작업 확인을 SDK의 페이지 내 대화상자 대신 네이티브 대화상자로 보여 줘요 |
| `helpButton` | 앱에 자체 “지원 요청” 진입점이 있으면 `false` |
| `lang` | 앱의 언어 태그(`'en'`, `'zh'`, `'ja'`, `'pt-BR'`…. [SDK 언어](../sdk/README.ko.md#언어) 참고). 기본값은 `navigator.languages`를 따라요 |
| `lockScreen`, `theme`, `eruda` | H5 페이지와 같아요. [protocol.ko.md §10](protocol.ko.md#10-호스트용-javascript-api) 참고 |

## iOS (WKWebView)

각 `WKWebViewConfiguration`의 `WKUserContentController`에 `injectionTime: .atDocumentStart`, `forMainFrameOnly: true`로 `WKUserScript`를 추가하세요. `WKWebView`를 만들기 **전에** 해야 해요. WebKit이 `window.open` / `target=_blank`용으로 만드는 팝업은 `webView(_:createWebViewWith:…)`에서 반환한 configuration을 재사용하므로 같은 스크립트가 적용돼요. 사용자 스크립트는 추가된 뒤에 시작되는 페이지 이동에 적용되니, 디버깅을 켠 뒤에는 열려 있는 WebView를 새로고침하세요. 스크린샷 브리지에는 iOS 14(`WKScriptMessageHandlerWithReply`)가 필요해요.

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // 네이티브 상태 표시줄, 버튼, 대화상자를 갱신

    private let nativeKey = UUID().uuidString + UUID().uuidString   // 페이지에는 절대 노출하지 않음
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// 설치마다 ID 하나. 모든 WebView와 도메인이 공유한다.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// 첫 연결 때 게이트웨이가 발급한다. 이후의 모든 페이지가 이 값을 제시해야 한다.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// 사용자가 원격 디버깅에 동의한 뒤 호출한다.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// 모든 WKWebViewConfiguration에 대해, WKWebView를 만들기 전에 호출한다.
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
            "helpButton": false,          // 앱에 자체 지원 요청 진입점이 있음
            "nativeKey": nativeKey,
            "nativeApproval": true,       // 승인과 확인은 네이티브 대화상자로
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

    // 네이티브 버튼과 대화상자. 사용자가 보고 있는 WebView에서 호출한다
    // (nativeDecide는 대기 중인 요청을 status로 보고한 WebView에서).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // 권한 수준 / "allow", 거부하려면 nil
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState: 페이지의 status()를 500 ms마다 받는다.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // 이제부터 열리는 페이지는 토큰을 가진다
        }
        onStatus?(status)
    }

    // rwdScreenshot: take_screenshot용 실제 픽셀.
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

    private func js(_ s: String) -> String {   // JSON 문자열 리터럴
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController`는 메시지 핸들러를 강하게 참조해요. 이 예시는 싱글턴이라 문제가 없지만, 핸들러가 싱글턴이 아니라면 `RWDNative.swift`처럼 약한 참조 프록시를 등록하세요. 참고 구현은 상태가 바뀔 때만 보고하고, 어느 WebView가 앞에 있는지도 추적해요.

## Android (WebView)

`WebViewFeature.DOCUMENT_START_SCRIPT`를 지원하면 AndroidX WebKit(`androidx.webkit:webkit`)의 `WebViewCompat.addDocumentStartJavaScript`를 쓰고, `loadUrl`보다 먼저 호출하세요. WebView에는 `javaScriptEnabled`와 `domStorageEnabled`가 필요해요. 스크립트가 실행될 곳은 출처 규칙이 정해요. 프로젝트의 `allowedOrigins`를 넘기거나, 모든 페이지라면 `setOf("*")`를 넘기세요.

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // 페이지에는 절대 노출하지 않음
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** 설치마다 ID 하나. 모든 WebView와 도메인이 공유한다. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** 사용자가 원격 디버깅에 동의한 뒤 호출한다. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** 모든 WebView에 대해, loadUrl 전에 호출한다. */
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
            fallback(webView, boot)   // 아래 참고
        }
    }

    // 네이티브 버튼과 대화상자: takeover | handback | end. 권한 수준 / "allow", 거부하려면 null.
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
                prefs.edit().putString("deviceToken", token).apply()   // 이제부터 install하는 WebView는 토큰을 가진다
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** take_screenshot 때 SDK가 백그라운드 스레드에서 호출한다. JPEG data URL을 반환한다. */
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

이 코드는 실제 Android 프로젝트에서 컴파일해 보지 않은 참고용 예시예요(import 생략). import까지 포함한 전체 버전은 콘솔의 가이드에 있어요. 참고 사항:

- **`DOCUMENT_START_SCRIPT`가 없을 때의 대안.** 이 기능이 없는 WebView 빌드에서는 `WebViewClient.onPageFinished`에서 `evaluateJavascript`로 같은 스크립트를 주입하고, 문서마다 한 번만 실행되도록 `if (!window.RemoteWebviewDebugger) { … }`로 감싸세요. 이 경우 수집이 페이지 로드 후에 시작되므로, 가장 이른 console 메시지와 요청은 놓쳐요.
- **JavaScript 인터페이스는 그 WebView에 로드된 모든 페이지에서 보여요.** 출처와 상관없어요. 브리지는 원격 디버깅이 켜져 있는 동안에만 추가하고, 브리지를 통해 `nativeKey`를 절대 노출하지 말고, `post()`가 받는 값은 신뢰할 수 없는 입력으로 다루세요.
- `webView.draw()`는 동영상처럼 하드웨어로 렌더링되는 콘텐츠를 캡처하지 못해요. 실제 픽셀이 필요하면 창에 `PixelCopy`를 쓰세요(API 26+).

## 네이티브 상태 표시줄, 버튼, 대화상자

`status()`를 폴링하고(위 예시는 500 ms마다 보내고, 참고 구현은 바뀔 때만 보내요) 그 값으로 네이티브 UI를 갱신하세요.

| `status()` 필드 | 용도 |
|---|---|
| `deviceCode`, `status` | 기기 코드와 연결 상태(`online`, `connecting`, `polling`, `rejected`, `quota`)를 표시해요 |
| `control` | `observe`: “AI 보는 중”, `agent`: “AI 조작 중”. 둘 다 뒤로 가기 버튼과 스와이프로 뒤로 가기를 막으세요. `user`: “직접 조작 중” |
| `level` | 접속한 에이전트에게 허용된 권한 수준 |
| `config.helpButton` | 프로젝트 정책이 이 사용자에게 지원을 제공하는지 여부. 이에 따라 앱 자체의 지원 요청 진입점을 보이거나 숨기세요 |
| `pending` | 사용자에게 묻는 질문. 아래 참고 |
| `deviceToken` | 처음 나타나거나 바뀌면 저장하세요 |

- **직접 조작 / AI에 맡기기 / 종료:** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`. 키가 틀리면 `false`를 반환해요.
- **지원 요청:** `help(true)`(취소하려면 `help(false)`).
- **접속 승인**(`pending.kind === 'attach'`): `pending.agent.name`과 `pending.agent.keyHint`를 보여 주고 `pending.levels`를 선택지로 제시한 뒤(마지막 항목이 에이전트가 요청한 수준이에요), `nativeDecide(nativeKey, pending.requestId, level)`을 호출하세요. 거부하려면 `null`을 넘기세요. `pending.expiresAt`(30초) 전에 응답해야 해요.
- **작업 확인**(`pending.kind === 'confirm'`): `pending.action`(예: `click "Place order"`)을 보여 준 뒤 `nativeDecide(nativeKey, requestId, 'allow')` 또는 `null`을 호출하세요.
- `nativeDecide`는 그 요청을 status로 보고한 WebView에서 실행하세요. 게이트웨이는 포그라운드 페이지에 물어봐요.
- 네이티브 버튼과 대화상자는 사용자 자신의 탭에만 반응해야 해요. 에이전트를 대신해 `nativeControl`이나 `nativeDecide`를 호출하면 절대 안 돼요.

## 기기 ID와 토큰

- `deviceId`는 설치마다 한 번 생성해 `UserDefaults` / `SharedPreferences`에 보관하세요. 게이트웨이는 이 ID에 기기 코드를 부여해요. 앱을 다시 설치하면 새 ID와 새 코드를 받아요.
- 첫 `welcome`에 기기 토큰이 담겨 오고, SDK는 이를 `status().deviceToken`으로 노출해요. 저장해 두고 그 뒤로는 모든 WebView에 주입하세요(예시 코드는 토큰이 바뀌면 스크립트를 다시 적용해요). 토큰이 없으면, 스스로 토큰을 저장해 두지 않은 도메인의 페이지는 종료 코드 4401(`status: 'rejected'`)로 거부돼요.
- 앱이 `deviceId`는 갖고 있는데 토큰을 잃어버리면 그 ID로는 다시 온라인이 될 수 없어요. 새 `deviceId`를 생성하세요(기기는 새 코드를 받아요).

## 초대 링크로 페이지 열기

지원 담당자는 콘솔(프로젝트의 **초대** 탭)에서 티켓 번호 같은 메모와 함께 **초대**를 만들 수 있어요. 링크는 프로젝트의 초대 URL(또는 그 초대에 지정한 URL)에 `?rwd_invite=<token>`을 붙인 것이고, 한 번만 쓸 수 있으며 기본적으로 30분 후 만료돼요. SDK가 들어 있는 페이지가 이 링크를 열면 SDK는 주소 표시줄에서 토큰을 꺼내 `hello`와 함께 보내요. 기기는 처음부터 지원을 요청한 상태로 온라인이 되고 콘솔에 초대받은 기기로 표시되므로, 아무도 기기 코드를 불러 줄 필요가 없어요.

앱에서는:

1. 초대 URL을 앱이 처리하는 링크로 설정하세요. 예를 들어 `https://m.example.com/help` 같은 유니버설 링크(iOS)나 앱 링크(Android)예요.
2. 앱이 링크를 받으면 **쿼리 문자열까지 포함한 전체 URL**을 SDK가 주입된 WebView에서 여세요(앱이 동의를 묻는다면 사용자가 동의한 뒤에).
3. 페이지는 초대와 **같은 프로젝트의 앱 키**로 SDK를 불러와야 해요. 다른 프로젝트의 초대는 무시돼요.

콘솔은 링크를 QR 코드로도 보여 줘요. 휴대폰 카메라로 스캔하면 유니버설 링크가 열려요.

## 직접 해 보기

[목업 앱](../examples/mock-app/README.md)은 휴대폰 크기의 macOS 앱으로, iOS 앱과 똑같이 `WKWebView`를 호스팅해요. 동의, 주입, 기기 토큰, 네이티브 승인과 확인, 스크린샷, 네이티브 상태 표시줄이 모두 연결되어 있어요. `examples/mock-app/build-app.sh`로 빌드하고, 게이트웨이를 가리키게 한 뒤 Claude Code를 접속시켜 보세요.
