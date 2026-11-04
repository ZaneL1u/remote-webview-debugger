<!-- i18n-source: d65106286935d00b9911913bf16cf2dfdf7bb300 -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | Deutsch | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# Integration in native Apps

Eine H5-Seite kann das SDK mit einem `<script>`-Tag laden. In Ihrer eigenen App geht es besser: Injizieren Sie das SDK aus nativem Code in jede WebView, sobald sie zu laden beginnt. Dann gilt:

- Jede Seite der App wird debugfähig, auch Drittanbieter-Domains, ohne Änderung am H5-Code;
- das Gerät behält **einen Gerätecode** über WebViews und Domains hinweg, weil die App die `deviceId` vorgibt und das Geräte-Token aufbewahrt;
- der Agent erhält über eine native Brücke **echte Screenshots** (Video, Canvas, native Overlays);
- Freigaben, Bestätigungen und die Buttons Übernehmen / Zurückgeben / Beenden können **native Oberfläche** sein, und der Zurück-Button lässt sich sperren, solange eine KI verbunden ist.

Die integrierte Anleitung der Konsole (**Doku → Native App integrieren**) zeigt denselben Code, bereits mit Ihrer Gateway-URL und Ihrem App-Key ausgefüllt. Eine vollständige, lauffähige Referenz ist [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift), die von der [Mock-App](../examples/mock-app/README.md) verwendet wird. Details auf Nachrichtenebene stehen in [protocol.de.md](protocol.de.md).

## Checkliste

1. **Holen Sie die Zustimmung ein.** Schalten Sie Remote-Debugging erst ein, wenn der Nutzer zugestimmt hat (die Mock-App zeigt zuerst einen nativen Zustimmungsdialog). Die Verbindungsfreigabe auf dem Gerät gilt zusätzlich weiterhin.
2. **Besorgen Sie das SDK.** Liefern Sie `dist/sdk.js` aus dem npm-Paket [`remote-webview-debugger`](../sdk/README.de.md) mit der App aus, sodass weder das Gateway noch ein CDN ihr jemals Code unterschieben kann; oder laden Sie es einmalig beim Aktivieren des Debuggings herunter, von Ihrem Gateway (`https://rwd.example.com/v1/sdk.js`) oder von einer festen CDN-URL (`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js`).
3. **Bauen Sie das Boot-Script:** den SDK-Quellcode, danach `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`, danach (optional) einen Timer, der `status()` an den nativen Code meldet.
4. **Injizieren Sie es bei Dokumentbeginn** in den Hauptframe jeder WebView, bevor die erste Seite lädt, damit die Erfassung beginnt, bevor ein Seiten-Script läuft.
5. **Bewahren Sie `deviceId` und `deviceToken`** im App-Speicher auf und übergeben Sie beide an jede WebView.
6. **Registrieren Sie die Screenshot-Brücke.**
7. **Verdrahten Sie die native Oberfläche** mit `status()`, `help()`, `nativeControl()` und `nativeDecide()`.

## `run()`-Optionen für Apps

| Option | Was Sie übergeben |
|---|---|
| `deviceId` | Eine ID pro Installation (eine UUID, die Sie einmal erzeugen und speichern). Wird von jeder WebView und jeder Domain geteilt, sodass sich der Gerätecode nie ändert. Eine Änderung erzeugt ein neues Gerät |
| `deviceToken` | Das Token, das das Gateway für dieses Gerät ausgestellt hat (`status().deviceToken`), von der App gespeichert; `null` bis zur ersten Verbindung. localStorage gilt pro Origin, ohne dies würde eine Seite auf einer neuen Domain mit dem Close-Code 4401 abgewiesen |
| `userId` | Die ID Ihres angemeldeten Nutzers oder `null`. Agenten können danach filtern (`list_devices userId=…`), die Konsole zeigt sie an, und `helpButton: listed` der Richtlinie verwendet sie. Bevorzugen Sie eine opake interne ID statt personenbezogener Daten. Wenn sich der Nutzer an- oder abmeldet, rufen Sie `setUser(id)` auf oder injizieren erneut |
| `app` | `{ name, version }` Ihrer App, angezeigt für Agenten und in der Konsole |
| `nativeKey` | Ein zufälliges Geheimnis, beim Start erzeugt (z. B. zwei UUIDs) und nur in das injizierte Script geschrieben. Erforderlich für `nativeControl()` und `nativeDecide()`; Seiten-Scripts, auch das `evaluate_script` des Agenten, können es nicht lesen |
| `nativeApproval` | `true`, um Verbindungsfreigaben und Bestätigungen von Aktionen als native Dialoge statt als Dialoge des SDK in der Seite anzuzeigen |
| `helpButton` | `false`, wenn die App einen eigenen Eintrag „Unterstützung anfordern“ hat |
| `lang` | Die Sprache Ihrer App als Tag (`'en'`, `'zh'`, `'ja'`, `'pt-BR'`…; siehe die [Sprachen des SDK](../sdk/README.de.md#sprachen)); standardmäßig folgt sie `navigator.languages` |
| `lockScreen`, `theme`, `eruda` | Wie bei H5-Seiten, siehe [protocol.de.md §10](protocol.de.md#10-javascript-api-für-hosts) |

## iOS (WKWebView)

Fügen Sie dem `WKUserContentController` jeder `WKWebViewConfiguration` ein `WKUserScript` mit `injectionTime: .atDocumentStart` und `forMainFrameOnly: true` hinzu, und zwar **bevor** Sie die `WKWebView` erstellen. Popups, die WebKit für `window.open` / `target=_blank` erzeugt, verwenden die Konfiguration wieder, die Sie aus `webView(_:createWebViewWith:…)` zurückgeben, und erhalten so dieselben Scripts. User-Scripts gelten für Navigationen, die nach dem Hinzufügen beginnen; laden Sie offene WebViews nach dem Aktivieren des Debuggings neu. Die Screenshot-Brücke benötigt iOS 14 (`WKScriptMessageHandlerWithReply`).

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // steuert native Statusleiste, Buttons und Dialoge

    private let nativeKey = UUID().uuidString + UUID().uuidString   // wird Seiten nie zugänglich gemacht
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// Eine ID pro Installation, geteilt von jeder WebView und Domain.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// Vom Gateway bei der ersten Verbindung ausgestellt; jede spätere Seite muss es vorlegen.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// Aufrufen, nachdem der Nutzer dem Remote-Debugging zugestimmt hat.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// Für jede WKWebViewConfiguration aufrufen, bevor die WKWebView erstellt wird.
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
            "helpButton": false,          // die App hat einen eigenen Unterstützungs-Eintrag
            "nativeKey": nativeKey,
            "nativeApproval": true,       // native Dialoge für Freigaben und Bestätigungen
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

    // Native Buttons und Dialoge. Auf der WebView aufrufen, die der Nutzer gerade sieht
    // (bei nativeDecide: auf der, deren Status die offene Anfrage gemeldet hat).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // Stufe / "allow", oder nil zum Ablehnen
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState: status() einer Seite, alle 500 ms.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // ab jetzt geöffnete Seiten tragen es
        }
        onStatus?(status)
    }

    // rwdScreenshot: echte Pixel für take_screenshot.
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

    private func js(_ s: String) -> String {   // ein JSON-String-Literal
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` hält seine Message-Handler fest. Diese Skizze ist ein Singleton, daher ist das unschädlich; ist Ihr Handler keiner, registrieren Sie einen schwachen Proxy, wie es `RWDNative.swift` tut. Die Referenz meldet den Status außerdem nur bei Änderungen und verfolgt, welche WebView im Vordergrund ist.

## Android (WebView)

Verwenden Sie `WebViewCompat.addDocumentStartJavaScript` aus AndroidX WebKit (`androidx.webkit:webkit`), wenn `WebViewFeature.DOCUMENT_START_SCRIPT` unterstützt wird, und rufen Sie es vor `loadUrl` auf. Die WebView benötigt `javaScriptEnabled` und `domStorageEnabled`. Die Origin-Regeln entscheiden, wo das Script läuft: Übergeben Sie die `allowedOrigins` Ihres Projekts oder `setOf("*")` für jede Seite.

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // wird Seiten nie zugänglich gemacht
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** Eine ID pro Installation, geteilt von jeder WebView und Domain. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** Aufrufen, nachdem der Nutzer dem Remote-Debugging zugestimmt hat. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** Für jede WebView aufrufen, vor loadUrl. */
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
            fallback(webView, boot)   // siehe unten
        }
    }

    // Native Buttons und Dialoge: takeover | handback | end; eine Stufe / "allow", oder null zum Ablehnen.
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
                prefs.edit().putString("deviceToken", token).apply()   // ab jetzt eingerichtete WebViews tragen es
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** Vom SDK für take_screenshot auf einem Hintergrund-Thread aufgerufen; liefert eine JPEG-Data-URL. */
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

Dies ist eine Referenzskizze, die nicht in einem echten Android-Projekt kompiliert wurde (Imports weggelassen); die Anleitung in der Konsole enthält die vollständige Fassung mit Imports. Hinweise:

- **Fallback ohne `DOCUMENT_START_SCRIPT`.** Auf WebView-Versionen ohne dieses Feature injizieren Sie dasselbe Script in `WebViewClient.onPageFinished` mit `evaluateJavascript`, abgesichert mit `if (!window.RemoteWebviewDebugger) { … }`, damit es einmal pro Dokument läuft. Die Erfassung beginnt dann erst, nachdem die Seite geladen ist, sodass ihre frühesten Console-Ausgaben und Requests fehlen.
- **JavaScript-Interfaces sind für jede Seite sichtbar**, die in dieser WebView geladen wird, unabhängig von ihrem Origin. Fügen Sie die Brücken nur hinzu, solange Remote-Debugging eingeschaltet ist, machen Sie `nativeKey` nie über sie zugänglich, und behandeln Sie, was `post()` empfängt, als nicht vertrauenswürdige Eingabe.
- `webView.draw()` erfasst keine hardwaregerenderten Inhalte wie Videos. Für echte Pixel verwenden Sie `PixelCopy` auf dem Fenster (API 26+).

## Native Statusleiste, Buttons und Dialoge

Fragen Sie `status()` regelmäßig ab (die Skizzen oben senden es alle 500 ms; die Referenz sendet nur Änderungen) und steuern Sie damit die native Oberfläche:

| `status()`-Feld | Verwendung |
|---|---|
| `deviceCode`, `status` | Gerätecode anzeigen und ob die Verbindung `online`, `connecting`, `polling`, `rejected` oder `quota` ist |
| `control` | `observe`: „KI sieht zu“; `agent`: „KI arbeitet“; in beiden Fällen den Zurück-Button und die Zurück-Wischgeste deaktivieren; `user`: „Sie haben übernommen“ |
| `level` | Die Zugriffsstufe, die dem verbundenen Agenten gewährt wurde |
| `config.helpButton` | Ob die Richtlinie des Projekts diesem Nutzer Unterstützung anbietet; blenden Sie Ihren eigenen Unterstützungs-Eintrag entsprechend ein oder aus |
| `pending` | Eine Frage an den Nutzer, siehe unten |
| `deviceToken` | Speichern Sie es, sobald es zum ersten Mal auftaucht oder sich ändert |

- **Übernehmen / Zurückgeben / Beenden:** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`; liefert `false`, wenn der Key falsch ist.
- **Unterstützung anfordern:** `help(true)` (und `help(false)`, um die Anfrage abzubrechen).
- **Verbindungsfreigabe** (`pending.kind === 'attach'`): Zeigen Sie `pending.agent.name` und `pending.agent.keyHint` an, bieten Sie `pending.levels` an (die letzte ist die, die der Agent angefragt hat), und rufen Sie dann `nativeDecide(nativeKey, pending.requestId, level)` auf, oder übergeben Sie `null` zum Ablehnen. Antworten Sie vor `pending.expiresAt` (30 Sekunden).
- **Bestätigung einer Aktion** (`pending.kind === 'confirm'`): Zeigen Sie `pending.action` an (z. B. `click "Place order"`), dann `nativeDecide(nativeKey, requestId, 'allow')` oder `null`.
- Führen Sie `nativeDecide` in der WebView aus, deren Status die Anfrage gemeldet hat: Das Gateway fragt die Seite im Vordergrund.
- Native Buttons und Dialoge dürfen nur auf die eigenen Taps des Nutzers reagieren. Rufen Sie `nativeControl` oder `nativeDecide` nie im Namen des Agenten auf.

## Geräte-ID und Token

- Erzeugen Sie `deviceId` einmal pro Installation und bewahren Sie sie in `UserDefaults` / `SharedPreferences` auf. Das Gateway ordnet dieser ID den Gerätecode zu; eine Neuinstallation erhält eine neue ID und einen neuen Code.
- Das erste `welcome` enthält ein Geräte-Token; das SDK stellt es als `status().deviceToken` bereit. Speichern Sie es und injizieren Sie es von da an in jede WebView (die Skizzen wenden ihre Scripts erneut an, wenn es sich ändert). Ohne das Token werden Seiten auf Domains, die es nicht selbst gespeichert haben, mit dem Close-Code 4401 abgewiesen (`status: 'rejected'`).
- Behält die App eine `deviceId`, verliert aber ihr Token, kann diese ID nicht mehr online gehen. Erzeugen Sie eine neue `deviceId` (das Gerät erhält einen neuen Code).

## Seiten aus Einladungslinks öffnen

Der Support kann in der Konsole eine **Einladung** erstellen (Tab **Einladungen** eines Projekts), mit einer Notiz wie einer Ticketnummer. Der Link ist die Einladungs-URL des Projekts (oder eine für diese Einladung festgelegte) plus `?rwd_invite=<token>`; er funktioniert einmal und läuft standardmäßig nach 30 Minuten ab. Öffnet eine Seite mit dem SDK ihn, nimmt das SDK das Token aus der Adressleiste und sendet es mit seinem `hello`; das Gerät geht bereits mit einer Unterstützungsanfrage online und ist in der Konsole als eingeladen markiert, sodass niemand einen Gerätecode vorlesen muss.

Für eine App:

1. Legen Sie als Einladungs-URL einen Link fest, den Ihre App verarbeitet, z. B. einen Universal Link (iOS) oder App Link (Android) wie `https://m.example.com/help`.
2. Wenn die App ihn empfängt, öffnen Sie die **vollständige URL samt Query-String** in einer WebView, in die das SDK injiziert ist (nach der Zustimmung des Nutzers, falls Ihre App danach fragt).
3. Die Seite muss das SDK mit dem **App-Key desselben Projekts** laden wie die Einladung; Einladungen aus anderen Projekten werden ignoriert.

Die Konsole zeigt den Link auch als QR-Code; scannt man ihn mit der Kamera des Smartphones, öffnet sich der Universal Link.

## Ausprobieren

Die [Mock-App](../examples/mock-app/README.md) ist eine macOS-App in Smartphone-Größe, die `WKWebView`s genau wie eine iOS-App hostet: Zustimmung, Injektion, Geräte-Token, native Freigaben und Bestätigungen, Screenshots und die native Statusleiste sind alle verdrahtet. Bauen Sie sie mit `examples/mock-app/build-app.sh`, richten Sie sie auf Ihr Gateway und verbinden Sie Claude Code damit.
