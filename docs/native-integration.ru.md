<!-- i18n-source: 3b2e4097b7707b70544438e01ec3bee6e95adbed -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | Русский | [العربية](native-integration.ar.md)

# Интеграция с нативным приложением

H5-страница может загрузить SDK тегом `<script>`. В собственном приложении можно сделать лучше: внедрять SDK из нативного кода в каждый WebView в момент начала загрузки. Тогда:

- отлаживать можно любую страницу в приложении, включая сторонние домены, без изменений в H5-коде;
- у устройства **один код устройства** во всех WebView и доменах, потому что приложение передаёт `deviceId` и хранит токен устройства;
- агент получает **настоящие скриншоты** (видео, canvas, нативные оверлеи) через нативный мост;
- одобрения, подтверждения и кнопки «Перехватить» / «Вернуть ИИ» / «Завершить» могут быть **нативным интерфейсом**, а кнопку «Назад» можно блокировать, пока подключён ИИ.

Встроенное в веб-консоль руководство (**Docs → Integrate a native app**) показывает тот же код с уже подставленными URL вашего шлюза и ключом приложения. Полная работающая эталонная реализация — [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift), её использует [mock-приложение](../examples/mock-app/README.md). Подробности на уровне сообщений — в [protocol.ru.md](protocol.ru.md).

## Чек-лист

1. **Спросите согласие.** Включайте удалённую отладку только после того, как пользователь согласится (mock-приложение сначала показывает нативный диалог согласия). Одобрение подключения на устройстве при этом всё равно действует.
2. **Получите SDK.** Встройте `dist/sdk.js` из npm-пакета [`remote-webview-debugger`](../sdk/README.ru.md) в приложение — тогда ни шлюз, ни CDN никогда не смогут подсунуть ему код; или скачайте его один раз при включении отладки с вашего шлюза (`https://rwd.example.com/v1/sdk.js`) либо по закреплённому URL на CDN (`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js`).
3. **Соберите загрузочный скрипт:** исходный код SDK, затем `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`, затем (по желанию) таймер, который передаёт `status()` в нативный код.
4. **Внедряйте его в начале документа** в главный фрейм каждого WebView, до загрузки первой страницы, чтобы перехват начинался раньше, чем выполнится любой скрипт страницы.
5. **Храните `deviceId` и `deviceToken`** в хранилище приложения и передавайте оба в каждый WebView.
6. **Зарегистрируйте мост для скриншотов.**
7. **Подключите нативный интерфейс** к `status()`, `help()`, `nativeControl()` и `nativeDecide()`.

## Параметры `run()` для приложений

| Параметр | Что передавать |
|---|---|
| `deviceId` | Один идентификатор на установку (UUID, который вы генерируете один раз и сохраняете). Общий для всех WebView и всех доменов, поэтому код устройства никогда не меняется. Смена идентификатора создаёт новое устройство |
| `deviceToken` | Токен, выданный шлюзом этому устройству (`status().deviceToken`) и сохранённый приложением; `null` до первого подключения. localStorage у каждого origin свой, поэтому без него страница на новом домене была бы отклонена с кодом закрытия 4401 |
| `userId` | Идентификатор вошедшего пользователя или `null`. Агенты могут фильтровать по нему (`list_devices userId=…`), веб-консоль его показывает, и его использует `helpButton: listed` в политике. Лучше передавать непрозрачный внутренний идентификатор, а не персональные данные. Когда пользователь входит или выходит, вызовите `setUser(id)` или внедрите скрипт заново |
| `app` | `{ name, version }` вашего приложения — их видят агенты и веб-консоль |
| `nativeKey` | Случайный секрет, сгенерированный при запуске (например, два UUID) и записанный только во внедряемый скрипт. Нужен для `nativeControl()` и `nativeDecide()`; скрипты страницы, включая `evaluate_script` агента, прочитать его не могут |
| `nativeApproval` | `true`, чтобы показывать одобрения подключения и подтверждения действий нативными диалогами вместо диалогов SDK на странице |
| `helpButton` | `false`, если в приложении есть собственный пункт «Попросить помощь» |
| `lang` | Язык вашего приложения в виде тега (`'en'`, `'zh'`, `'ja'`, `'pt-BR'`…; см. [языки SDK](../sdk/README.ru.md#языки)); по умолчанию следует `navigator.languages` |
| `lockScreen`, `theme`, `eruda` | Как для H5-страниц, см. [protocol.ru.md §10](protocol.ru.md#10-javascript-api-для-хостов) |

## iOS (WKWebView)

Добавьте `WKUserScript` с `injectionTime: .atDocumentStart` и `forMainFrameOnly: true` в `WKUserContentController` каждой `WKWebViewConfiguration` **до** создания `WKWebView`. Всплывающие окна, которые WebKit создаёт для `window.open` / `target=_blank`, используют конфигурацию, возвращённую из `webView(_:createWebViewWith:…)`, поэтому получают те же скрипты. Пользовательские скрипты применяются к переходам, начавшимся после их добавления; после включения отладки перезагрузите открытые WebView. Мосту для скриншотов нужна iOS 14 (`WKScriptMessageHandlerWithReply`).

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // управляет нативной строкой состояния, кнопками и диалогами

    private let nativeKey = UUID().uuidString + UUID().uuidString   // никогда не передаётся страницам
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// Один id на установку, общий для всех WebView и доменов.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// Выдаётся шлюзом при первом подключении; каждая следующая страница должна его предъявить.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// Вызывайте после того, как пользователь согласился на удалённую отладку.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// Вызывайте для каждой WKWebViewConfiguration до создания WKWebView.
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
            "helpButton": false,          // у приложения есть свой пункт помощи
            "nativeKey": nativeKey,
            "nativeApproval": true,       // нативные диалоги для одобрений и подтверждений
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

    // Нативные кнопки и диалоги. Вызывайте их на WebView, который видит пользователь
    // (для nativeDecide — на том, чей status сообщил об ожидающем запросе).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // уровень / "allow" или nil для отказа
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState: status() страницы каждые 500 мс.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // страницы, открытые с этого момента, получат его
        }
        onStatus?(status)
    }

    // rwdScreenshot: настоящие пиксели для take_screenshot.
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

    private func js(_ s: String) -> String {   // строковый литерал JSON
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` удерживает свои обработчики сообщений. В этом наброске используется синглтон, так что это безвредно; если ваш обработчик не синглтон, регистрируйте слабый прокси, как это делает `RWDNative.swift`. Кроме того, эталонная реализация сообщает статус только при его изменении и отслеживает, какой WebView находится на переднем плане.

## Android (WebView)

Используйте `WebViewCompat.addDocumentStartJavaScript` из AndroidX WebKit (`androidx.webkit:webkit`), если поддерживается `WebViewFeature.DOCUMENT_START_SCRIPT`, и вызывайте его до `loadUrl`. В WebView должны быть включены `javaScriptEnabled` и `domStorageEnabled`. Где выполняется скрипт, определяют правила origin: передайте `allowedOrigins` вашего проекта или `setOf("*")` для всех страниц.

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // никогда не передаётся страницам
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** Один id на установку, общий для всех WebView и доменов. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** Вызывайте после того, как пользователь согласился на удалённую отладку. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** Вызывайте для каждого WebView до loadUrl. */
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
            fallback(webView, boot)   // см. ниже
        }
    }

    // Нативные кнопки и диалоги: takeover | handback | end; уровень / "allow" или null для отказа.
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
                prefs.edit().putString("deviceToken", token).apply()   // WebView, настроенные с этого момента, получат его
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** Вызывается SDK в фоновом потоке для take_screenshot; возвращает data URL с JPEG. */
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

Это эталонный набросок, который не компилировался в реальном Android-проекте (импорты опущены); полная версия с импортами — в руководстве веб-консоли. Замечания:

- **Запасной вариант без `DOCUMENT_START_SCRIPT`.** В сборках WebView, где этой возможности нет, внедряйте тот же скрипт из `WebViewClient.onPageFinished` с помощью `evaluateJavascript`, обернув его в `if (!window.RemoteWebviewDebugger) { … }`, чтобы он выполнялся один раз на документ. Перехват тогда начинается после загрузки страницы, и самые ранние сообщения console и запросы теряются.
- **JavaScript-интерфейсы видны каждой странице**, загруженной в этот WebView, независимо от её origin. Добавляйте мосты только на время удалённой отладки, никогда не раскрывайте через них `nativeKey` и считайте то, что приходит в `post()`, недоверенными входными данными.
- `webView.draw()` не захватывает содержимое с аппаратным рендерингом, например видео. Для точных пикселей используйте `PixelCopy` для окна (API 26+).

## Нативная строка состояния, кнопки и диалоги

Опрашивайте `status()` (наброски выше отправляют его каждые 500 мс; эталонная реализация — только при изменениях) и управляйте по нему нативным интерфейсом:

| Поле `status()` | Применение |
|---|---|
| `deviceCode`, `status` | Показывайте код устройства и состояние соединения: `online`, `connecting`, `polling`, `rejected` или `quota` |
| `control` | `observe`: «ИИ просматривает»; `agent`: «ИИ управляет»; в обоих случаях отключайте кнопку «Назад» и жест возврата; `user`: «Вы взяли управление» |
| `level` | Уровень доступа, выданный подключённому агенту |
| `config.helpButton` | Предлагает ли политика проекта помощь этому пользователю; показывайте или скрывайте свой пункт помощи соответственно |
| `pending` | Вопрос к пользователю, см. ниже |
| `deviceToken` | Сохраните его, когда он впервые появится или изменится |

- **Перехватить / Вернуть ИИ / Завершить:** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`; возвращает `false`, если ключ неверный.
- **Попросить помощь:** `help(true)` (и `help(false)` для отмены).
- **Одобрение подключения** (`pending.kind === 'attach'`): покажите `pending.agent.name` и `pending.agent.keyHint`, предложите `pending.levels` (последний — тот, что запросил агент), затем вызовите `nativeDecide(nativeKey, pending.requestId, level)` или передайте `null` для отказа. Ответьте до `pending.expiresAt` (30 секунд).
- **Подтверждение действия** (`pending.kind === 'confirm'`): покажите `pending.action` (например, `click "Place order"`), затем вызовите `nativeDecide(nativeKey, requestId, 'allow')` или передайте `null`.
- Вызывайте `nativeDecide` в том WebView, чей статус сообщил о запросе: шлюз спрашивает страницу на переднем плане.
- Нативные кнопки и диалоги должны реагировать только на собственные нажатия пользователя. Никогда не вызывайте `nativeControl` или `nativeDecide` от имени агента.

## Идентификатор и токен устройства

- Генерируйте `deviceId` один раз на установку и храните его в `UserDefaults` / `SharedPreferences`. Шлюз привязывает код устройства к этому идентификатору; после переустановки будут новый идентификатор и новый код.
- Первый `welcome` содержит токен устройства; SDK отдаёт его как `status().deviceToken`. Сохраните его и с этого момента внедряйте в каждый WebView (наброски заново применяют свои скрипты, когда он меняется). Без него страницы на доменах, которые сами его не сохранили, отклоняются с кодом закрытия 4401 (`status: 'rejected'`).
- Если приложение сохранило `deviceId`, но потеряло токен, с этим идентификатором выйти в сеть уже нельзя. Сгенерируйте новый `deviceId` (устройство получит новый код).

## Открытие страниц по ссылкам-приглашениям

Поддержка может создать в веб-консоли **приглашение** (вкладка **Invites** проекта) с заметкой, например номером обращения. Ссылка — это URL приглашений проекта (или URL, заданный для этого приглашения) плюс `?rwd_invite=<token>`; она одноразовая и по умолчанию истекает через 30 минут. Когда страница с SDK открывает такую ссылку, SDK убирает токен из адресной строки и отправляет его вместе с `hello`; устройство выходит в сеть уже с запросом помощи и помечается в веб-консоли как приглашённое, так что никому не приходится диктовать код устройства.

Для приложения:

1. Укажите в качестве URL приглашений ссылку, которую обрабатывает ваше приложение, например universal link (iOS) или app link (Android) вида `https://m.example.com/help`.
2. Получив её, приложение должно открыть **полный URL вместе со строкой запроса** в WebView с внедрённым SDK (после согласия пользователя, если ваше приложение его спрашивает).
3. Страница должна загружать SDK с **ключом приложения того же проекта**, что и приглашение; приглашения из других проектов игнорируются.

Веб-консоль также показывает ссылку в виде QR-кода; если отсканировать его камерой телефона, откроется universal link.

## Попробуйте

[Mock-приложение](../examples/mock-app/README.md) — это macOS-приложение размером с телефон, которое размещает `WKWebView` точно так же, как iOS-приложение: согласие, внедрение, токен устройства, нативные одобрения и подтверждения, скриншоты и нативная строка состояния — всё подключено. Соберите его с помощью `examples/mock-app/build-app.sh`, направьте на свой шлюз и подключите к нему Claude Code.
