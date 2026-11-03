<!-- i18n-source: b356ba9005954ef85d8a12f95b7e8e136e054fd4 -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | العربية

<div dir="rtl">

# التكامل مع التطبيقات الأصلية

يمكن لصفحة H5 تحميل SDK بوسم `<script>`. أما داخل تطبيقك أنت فبوسعك أن تفعل ما هو أفضل: أن تحقن SDK من الشيفرة الأصلية في كل WebView لحظة بدء تحميلها. عندها:

- تصبح كل صفحة في التطبيق قابلة للتصحيح، بما فيها نطاقات الأطراف الثالثة، دون أي تغيير في شيفرة H5؛
- يحتفظ الجهاز بـ **رمز جهاز واحد** عبر كل الـ WebViews والنطاقات، لأن التطبيق يوفّر `deviceId` ويحتفظ بتوكن الجهاز؛
- يحصل الوكيل على **لقطات شاشة حقيقية** (الفيديو، canvas، الطبقات الأصلية) عبر جسر أصلي؛
- يمكن أن تكون الموافقات والتأكيدات وأزرار تولّي التحكم / إعادة التحكم / الإنهاء **واجهة أصلية**، ويمكن قفل زر الرجوع ما دام ذكاء اصطناعي متصلًا.

يعرض الدليل المدمج في لوحة التحكم (`Docs → Integrate a native app`) الشيفرة نفسها وقد مُلئ فيها عنوان بوابتك ومفتاح تطبيقك. والمرجع الكامل القابل للتشغيل هو [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift)، الذي يستخدمه [التطبيق التجريبي](../examples/mock-app/README.md). وتفاصيل مستوى الرسائل في [protocol.ar.md](protocol.ar.md).

## قائمة التحقق

1. **اطلب الموافقة.** لا تفعّل التصحيح عن بُعد إلا بعد موافقة المستخدم (يعرض التطبيق التجريبي أولًا مربع حوار موافقة أصليًا). وتظل الموافقة على الربط على الجهاز سارية فوق ذلك.
2. **احصل على SDK.** ضمّن `dist/sdk.js` من حزمة npm [`remote-webview-debugger`](../sdk/README.ar.md) في التطبيق، فلا تستطيع البوابة ولا أي CDN دفع شيفرة إليه أبدًا؛ أو نزّله مرة واحدة عند تفعيل التصحيح، من بوابتك (`https://rwd.example.com/v1/sdk.js`) أو من عنوان CDN مثبَّت الإصدار (`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js`).
3. **ابنِ سكربت الإقلاع:** مصدر SDK، ثم `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`، ثم (اختياريًا) مؤقِّت يبلّغ الشيفرة الأصلية بـ `status()`.
4. **احقنه عند بدء المستند** في الإطار الرئيسي لكل WebView، قبل تحميل الصفحة الأولى، كي يبدأ الالتقاط قبل تشغيل أي سكربت للصفحة.
5. **احتفظ بـ `deviceId` و `deviceToken`** في تخزين التطبيق ومرّرهما كليهما إلى كل WebView.
6. **سجّل جسر لقطات الشاشة.**
7. **اربط الواجهة الأصلية** بـ `status()` و `help()` و `nativeControl()` و `nativeDecide()`.

## خيارات `run()` للتطبيقات

| الخيار | ما تمرّره |
|---|---|
| `deviceId` | معرّف واحد لكل تثبيت (UUID تولّده مرة واحدة وتخزّنه). تتشاركه كل WebView وكل نطاق، فلا يتغير رمز الجهاز أبدًا. وتغييره يُنشئ جهازًا جديدًا |
| `deviceToken` | التوكن الذي أصدرته البوابة لهذا الجهاز (`status().deviceToken`)، ويحفظه التطبيق؛ وقيمته `null` حتى الاتصال الأول. التخزين localStorage خاص بكل أصل (origin)، فبدون هذا تُرفض الصفحة على نطاق جديد برمز الإغلاق 4401 |
| `userId` | معرّف المستخدم المسجَّل دخوله لديك، أو `null`. يستطيع الوكلاء التصفية به (`list_devices userId=…`)، وتعرضه لوحة التحكم، ويستخدمه الخيار `helpButton: listed` في السياسة. فضّل معرّفًا داخليًا مُعتِمًا على البيانات الشخصية. حين يسجّل المستخدم دخوله أو خروجه، استدعِ `setUser(id)` أو أعد الحقن |
| `app` | `{ name, version }` لتطبيقك، ويُعرض للوكلاء وفي لوحة التحكم |
| `nativeKey` | سرّ عشوائي يُولَّد عند التشغيل (مثل UUID مرتين متتاليتين) ولا يُكتب إلا في السكربت المحقون. يستلزمه `nativeControl()` و `nativeDecide()`؛ ولا تستطيع سكربتات الصفحة قراءته، بما فيها `evaluate_script` الخاص بالوكيل |
| `nativeApproval` | `true` لعرض الموافقات على الربط وتأكيدات الإجراءات كمربعات حوار أصلية بدلًا من مربعات الحوار التي يعرضها SDK داخل الصفحة |
| `helpButton` | `false` إن كان للتطبيق مدخل «طلب المساعدة» خاص به |
| `lang` | لغة تطبيقك كوسم لغة (`'en'`، `'zh'`، `'ja'`، `'pt-BR'`…؛ انظر [لغات SDK](../sdk/README.ar.md#اللغات))؛ والافتراضي يتبع `navigator.languages` |
| `lockScreen`، `theme`، `eruda` | كما في صفحات H5، انظر [protocol.ar.md §10](protocol.ar.md#10-واجهة-javascript-للتطبيق-المضيف) |

## iOS (WKWebView)

أضف `WKUserScript` بـ `injectionTime: .atDocumentStart` و `forMainFrameOnly: true` إلى `WKUserContentController` الخاص بكل `WKWebViewConfiguration`، **قبل** إنشاء `WKWebView`. النوافذ المنبثقة التي ينشئها WebKit لـ `window.open` / `target=_blank` تعيد استخدام الإعداد الذي تعيده من `webView(_:createWebViewWith:…)`، فتحصل على السكربتات نفسها. تنطبق سكربتات المستخدم على عمليات التنقل التي تبدأ بعد إضافتها؛ لذا أعد تحميل الـ WebViews المفتوحة بعد تفعيل التصحيح. يحتاج جسر لقطات الشاشة إلى iOS 14 (`WKScriptMessageHandlerWithReply`).

<div dir="ltr">

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // يقود شريط الحالة والأزرار ومربعات الحوار الأصلية

    private let nativeKey = UUID().uuidString + UUID().uuidString   // لا يُكشف للصفحات أبدًا
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// معرّف واحد لكل تثبيت، تتشاركه كل WebView وكل نطاق.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// تصدره البوابة عند أول اتصال؛ ويجب على كل صفحة لاحقة تقديمه.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// استدعِها بعد موافقة المستخدم على التصحيح عن بُعد.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// استدعِها لكل WKWebViewConfiguration، قبل إنشاء WKWebView.
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
            "helpButton": false,          // للتطبيق مدخل مساعدة خاص به
            "nativeKey": nativeKey,
            "nativeApproval": true,       // مربعات حوار أصلية للموافقات والتأكيدات
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

    // الأزرار ومربعات الحوار الأصلية. استدعِها على WebView التي ينظر إليها المستخدم
    // (لـ nativeDecide: تلك التي أبلغت حالتُها عن الطلب المعلّق).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // مستوى / "allow"، أو nil للرفض
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState: قيمة status() لصفحة، كل 500 ms.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // الصفحات التي تُفتح من الآن فصاعدًا تحمله
        }
        onStatus?(status)
    }

    // rwdScreenshot: بكسلات حقيقية لـ take_screenshot.
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

    private func js(_ s: String) -> String {   // سلسلة JSON حرفية
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

</div>

يحتفظ `WKUserContentController` بمراجع قوية لمعالجات الرسائل الخاصة به. هذا المخطط كائن مفرد (singleton)، فلا ضرر في ذلك؛ أما إن لم يكن معالجك كذلك، فسجّل وكيلًا ضعيف المرجع (weak proxy) كما يفعل `RWDNative.swift`. ولا يبلّغ المرجع عن الحالة إلا حين تتغير، ويتتبع أيّ WebView في المقدّمة.

## Android (WebView)

استخدم `WebViewCompat.addDocumentStartJavaScript` من AndroidX WebKit (`androidx.webkit:webkit`) حين تكون `WebViewFeature.DOCUMENT_START_SCRIPT` مدعومة، واستدعِه قبل `loadUrl`. تحتاج WebView إلى `javaScriptEnabled` و `domStorageEnabled`. وقواعد الأصل (origin) تحدد أين يعمل السكربت: مرّر `allowedOrigins` الخاصة بمشروعك، أو `setOf("*")` لكل الصفحات.

<div dir="ltr">

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // لا يُكشف للصفحات أبدًا
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** معرّف واحد لكل تثبيت، تتشاركه كل WebView وكل نطاق. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** استدعِها بعد موافقة المستخدم على التصحيح عن بُعد. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** استدعِها لكل WebView، قبل loadUrl. */
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
            fallback(webView, boot)   // انظر أدناه
        }
    }

    // الأزرار ومربعات الحوار الأصلية: takeover | handback | end؛ مستوى / "allow"، أو null للرفض.
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
                prefs.edit().putString("deviceToken", token).apply()   // الـ WebViews المثبَّتة من الآن فصاعدًا تحمله
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** يستدعيها SDK على خيط في الخلفية لـ take_screenshot؛ وتعيد data URL بصيغة JPEG. */
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

</div>

هذا مخطط مرجعي لم يُترجَم (compile) في مشروع Android حقيقي (حُذفت عبارات الاستيراد)؛ والنسخة الكاملة مع عبارات الاستيراد موجودة في دليل لوحة التحكم. ملاحظات:

- **البديل في غياب `DOCUMENT_START_SCRIPT`.** على إصدارات WebView التي تفتقر إلى هذه الميزة، احقن السكربت نفسه من `WebViewClient.onPageFinished` عبر `evaluateJavascript`، محميًّا بـ `if (!window.RemoteWebviewDebugger) { … }` كي يعمل مرة واحدة لكل مستند. يبدأ الالتقاط حينها بعد تحميل الصفحة، فتفوته أقدم رسائل console والطلبات.
- **واجهات JavaScript مرئية لكل صفحة** تُحمَّل في تلك الـ WebView، أيًّا كان أصلها. لا تُضف الجسور إلا ما دام التصحيح عن بُعد مفعّلًا، ولا تكشف `nativeKey` عبرها أبدًا، وعامِل ما تستقبله `post()` على أنه إدخال غير موثوق.
- لا يلتقط `webView.draw()` المحتوى المرسوم بالعتاد مثل الفيديو. وللحصول على البكسلات الحقيقية، استخدم `PixelCopy` على النافذة (API 26+).

## شريط الحالة والأزرار ومربعات الحوار الأصلية

استطلع `status()` (المخططان أعلاه يرسلانها كل 500 ms؛ والمرجع لا يرسل إلا التغييرات) وقُد الواجهة الأصلية بها:

| حقل `status()` | الاستخدام |
|---|---|
| `deviceCode`، `status` | اعرض رمز الجهاز وما إذا كان الاتصال `online` أو `connecting` أو `polling` أو `rejected` أو `quota` |
| `control` | `observe`: "الذكاء الاصطناعي يشاهد"؛ `agent`: "الذكاء الاصطناعي يتحكم"؛ وفي كلتا الحالتين عطّل زر الرجوع والسحب للرجوع؛ `user`: "لقد تولّيت التحكم" |
| `level` | المستوى الممنوح للوكيل المرتبط |
| `config.helpButton` | ما إذا كانت سياسة المشروع تعرض المساعدة على هذا المستخدم؛ فأظهر مدخل المساعدة الخاص بك أو أخفه تبعًا لذلك |
| `pending` | سؤال موجّه إلى المستخدم، انظر أدناه |
| `deviceToken` | احفظه حين يظهر أول مرة أو حين يتغير |

- **تولّي التحكم / إعادة التحكم / الإنهاء:** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`؛ ويعيد `false` إن كان المفتاح خاطئًا.
- **طلب المساعدة:** `help(true)` (و `help(false)` للإلغاء).
- **الموافقة على الربط** (`pending.kind === 'attach'`): اعرض `pending.agent.name` و `pending.agent.keyHint`، واعرض `pending.levels` (الأخير هو ما طلبه الوكيل)، ثم استدعِ `nativeDecide(nativeKey, pending.requestId, level)`، أو مرّر `null` للرفض. أجب قبل `pending.expiresAt` (30 ثانية).
- **تأكيد الإجراء** (`pending.kind === 'confirm'`): اعرض `pending.action` (مثل `click "Place order"`)، ثم `nativeDecide(nativeKey, requestId, 'allow')` أو `null`.
- شغّل `nativeDecide` في الـ WebView التي أبلغت حالتُها عن الطلب: فالبوابة تسأل الصفحة التي في المقدّمة.
- يجب ألا تستجيب الأزرار ومربعات الحوار الأصلية إلا لنقرات المستخدم نفسه. لا تستدعِ `nativeControl` أو `nativeDecide` أبدًا نيابةً عن الوكيل.

## معرّف الجهاز وتوكنه

- ولّد `deviceId` مرة واحدة لكل تثبيت واحفظه في `UserDefaults` / `SharedPreferences`. تربط البوابة رمز الجهاز بهذا المعرّف؛ وإعادة التثبيت تعني معرّفًا جديدًا ورمزًا جديدًا.
- تحمل أول رسالة `welcome` توكن الجهاز؛ ويتيحه SDK عبر `status().deviceToken`. احفظه واحقنه في كل WebView من حينها (يعيد المخططان تطبيق سكربتاتهما حين يتغير). وبدونه، تُرفض الصفحات على النطاقات التي لم تخزّنه بنفسها برمز الإغلاق 4401 (`status: 'rejected'`).
- إن احتفظ التطبيق بـ `deviceId` لكنه فقد توكنه، فلن يتمكن ذلك المعرّف من الاتصال مجددًا. ولّد `deviceId` جديدًا (ويحصل الجهاز على رمز جديد).

## فتح الصفحات من روابط الدعوة

يستطيع فريق الدعم إنشاء **دعوة** في لوحة التحكم (تبويب **Invites** في المشروع) مع ملاحظة مثل رقم تذكرة. الرابط هو عنوان الدعوة الخاص بالمشروع (أو عنوان مضبوط لتلك الدعوة) مضافًا إليه `?rwd_invite=<token>`؛ ويعمل مرة واحدة وتنتهي صلاحيته بعد 30 دقيقة افتراضيًا. حين تفتحه صفحة فيها SDK، ينتزع SDK التوكن من شريط العنوان ويرسله مع `hello`؛ فيتصل الجهاز بحالة «قيد المساعدة» مسبقًا ويُعلَّم في لوحة التحكم بأنه مدعوّ، فلا يضطر أحد إلى قراءة رمز الجهاز بصوت عالٍ.

بالنسبة إلى التطبيق:

1. اضبط عنوان الدعوة على رابط يعالجه تطبيقك، مثل universal link (iOS) أو app link (Android) من قبيل `https://m.example.com/help`.
2. حين يستقبله التطبيق، افتح **العنوان الكامل، بما فيه سلسلة الاستعلام**، في WebView محقون فيها SDK (بعد موافقة المستخدم، إن كان تطبيقك يطلبها).
3. يجب أن تحمّل الصفحة SDK بـ **مفتاح التطبيق الخاص بالمشروع نفسه** الذي تنتمي إليه الدعوة؛ وتُتجاهل الدعوات القادمة من مشاريع أخرى.

تعرض لوحة التحكم الرابط أيضًا على شكل رمز QR؛ ومسحه بكاميرا الهاتف يفتح الـ universal link.

## جرّبه

[التطبيق التجريبي](../examples/mock-app/README.md) تطبيق macOS بحجم الهاتف يستضيف `WKWebView`s تمامًا كتطبيق iOS: الموافقة، والحقن، وتوكن الجهاز، والموافقات والتأكيدات الأصلية، ولقطات الشاشة، وشريط الحالة الأصلي، كلها موصولة. ابنِه بـ `examples/mock-app/build-app.sh`، ووجّهه إلى بوابتك، ثم صِل Claude Code به.

</div>
