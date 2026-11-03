<!-- i18n-source: b356ba9005954ef85d8a12f95b7e8e136e054fd4 -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | Español | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# Integración en apps nativas

Una página H5 puede cargar el SDK con una etiqueta `<script>`. Dentro de tu propia app puedes hacerlo mejor: inyectar el SDK desde el código nativo en cada WebView en cuanto empieza a cargar. Así:

- todas las páginas de la app pasan a ser depurables, incluidos los dominios de terceros, sin tocar el código H5;
- el dispositivo conserva **un único código de dispositivo** en todas las WebViews y dominios, porque la app proporciona el `deviceId` y guarda el token de dispositivo;
- el agente obtiene **capturas de pantalla reales** (vídeo, canvas, capas nativas superpuestas) a través de un puente nativo;
- las aprobaciones, las confirmaciones y los botones de tomar el control / devolver el control / finalizar pueden ser **interfaz nativa**, y el botón Atrás puede bloquearse mientras haya una IA conectada.

La guía integrada en la consola web (**Docs → Integrate a native app**) muestra el mismo código con la URL de tu gateway y tu clave de app ya rellenadas. Una referencia completa y ejecutable es [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift), que usa la [app de prueba](../examples/mock-app/README.md). Los detalles a nivel de mensaje están en [protocol.es.md](protocol.es.md).

## Lista de comprobación

1. **Pide consentimiento.** Activa la depuración remota solo después de que el usuario esté de acuerdo (la app de prueba muestra primero un diálogo de consentimiento nativo). La aprobación de conexión en el dispositivo se sigue aplicando además de eso.
2. **Consigue el SDK.** Empaqueta con la app el `dist/sdk.js` del paquete de npm [`remote-webview-debugger`](../sdk/README.es.md), para que ni el gateway ni un CDN puedan enviarle código nunca; o descárgalo una vez al activar la depuración, desde tu gateway (`https://rwd.example.com/v1/sdk.js`) o desde una URL de CDN con la versión fijada (`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js`).
3. **Construye el script de arranque:** el código del SDK, luego `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)` y luego (opcionalmente) un temporizador que informe de `status()` al código nativo.
4. **Inyéctalo al inicio del documento** en el marco principal de cada WebView, antes de que cargue la primera página, para que la captura empiece antes de que se ejecute cualquier script de la página.
5. **Guarda `deviceId` y `deviceToken`** en el almacenamiento de la app y pasa ambos a cada WebView.
6. **Registra el puente de capturas de pantalla.**
7. **Conecta la interfaz nativa** con `status()`, `help()`, `nativeControl()` y `nativeDecide()`.

## Opciones de `run()` para apps

| Opción | Qué pasar |
|---|---|
| `deviceId` | Un id por instalación (un UUID que generas una vez y guardas). Lo comparten todas las WebViews y todos los dominios, así que el código de dispositivo nunca cambia. Cambiarlo crea un dispositivo nuevo |
| `deviceToken` | El token que el gateway emitió para este dispositivo (`status().deviceToken`), guardado por la app; `null` hasta la primera conexión. localStorage es por origen, así que sin esto una página en un dominio nuevo sería rechazada con el código de cierre 4401 |
| `userId` | El id de tu usuario con sesión iniciada, o `null`. Los agentes pueden filtrar por él (`list_devices userId=…`), la consola web lo muestra y `helpButton: listed` de la política lo usa. Mejor un id interno opaco que datos personales. Cuando el usuario inicia o cierra sesión, llama a `setUser(id)` o vuelve a inyectar |
| `app` | `{ name, version }` de tu app, que se muestra a los agentes y en la consola web |
| `nativeKey` | Un secreto aleatorio generado al arrancar (p. ej. dos UUID) y escrito solo en el script inyectado. Lo requieren `nativeControl()` y `nativeDecide()`; los scripts de la página, incluido el `evaluate_script` del agente, no pueden leerlo |
| `nativeApproval` | `true` para mostrar las aprobaciones de conexión y las confirmaciones de acciones como diálogos nativos en lugar de los diálogos del SDK dentro de la página |
| `helpButton` | `false` si la app tiene su propia entrada de "Solicitar asistencia" |
| `lang` | El idioma de tu app como etiqueta (`'en'`, `'zh'`, `'ja'`, `'pt-BR'`…; consulta los [idiomas del SDK](../sdk/README.es.md#idiomas)); por defecto sigue a `navigator.languages` |
| `lockScreen`, `theme`, `eruda` | Igual que para las páginas H5; consulta [protocol.es.md §10](protocol.es.md#10-api-de-javascript-para-hosts) |

## iOS (WKWebView)

Añade un `WKUserScript` con `injectionTime: .atDocumentStart` y `forMainFrameOnly: true` al `WKUserContentController` de cada `WKWebViewConfiguration`, **antes** de crear el `WKWebView`. Las ventanas emergentes que WebKit crea para `window.open` / `target=_blank` reutilizan la configuración que devuelves desde `webView(_:createWebViewWith:…)`, así que reciben los mismos scripts. Los user scripts se aplican a las navegaciones que empiezan después de añadirlos; recarga las WebViews abiertas después de activar la depuración. El puente de capturas de pantalla necesita iOS 14 (`WKScriptMessageHandlerWithReply`).

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // controla la barra de estado, los botones y los diálogos nativos

    private let nativeKey = UUID().uuidString + UUID().uuidString   // nunca se expone a las páginas
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// Un id por instalación, compartido por todas las WebViews y dominios.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// Lo emite el gateway en la primera conexión; todas las páginas posteriores deben presentarlo.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// Llámalo después de que el usuario acepte la depuración remota.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// Llámalo para cada WKWebViewConfiguration, antes de crear el WKWebView.
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
            "helpButton": false,          // la app tiene su propia entrada de asistencia
            "nativeKey": nativeKey,
            "nativeApproval": true,       // diálogos nativos para aprobaciones y confirmaciones
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

    // Botones y diálogos nativos. Llámalos sobre la WebView que el usuario está mirando
    // (para nativeDecide: aquella cuyo status informó de la solicitud pendiente).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // nivel / "allow", o nil para rechazar
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState: status() de una página, cada 500 ms.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // las páginas que se abran a partir de ahora lo llevan
        }
        onStatus?(status)
    }

    // rwdScreenshot: píxeles reales para take_screenshot.
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

    private func js(_ s: String) -> String {   // un literal de cadena JSON
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` retiene sus manejadores de mensajes. Este esquema es un singleton, así que no pasa nada; si tu manejador no lo es, registra un proxy débil como hace `RWDNative.swift`. La referencia, además, solo informa del estado cuando cambia y sabe qué WebView está delante.

## Android (WebView)

Usa `WebViewCompat.addDocumentStartJavaScript` de AndroidX WebKit (`androidx.webkit:webkit`) cuando se admita `WebViewFeature.DOCUMENT_START_SCRIPT`, y llámalo antes de `loadUrl`. La WebView necesita `javaScriptEnabled` y `domStorageEnabled`. Las reglas de origen deciden dónde se ejecuta el script: pasa los `allowedOrigins` de tu proyecto, o `setOf("*")` para todas las páginas.

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // nunca se expone a las páginas
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** Un id por instalación, compartido por todas las WebViews y dominios. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** Llámalo después de que el usuario acepte la depuración remota. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** Llámalo para cada WebView, antes de loadUrl. */
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
            fallback(webView, boot)   // ver más abajo
        }
    }

    // Botones y diálogos nativos: takeover | handback | end; un nivel / "allow", o null para rechazar.
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
                prefs.edit().putString("deviceToken", token).apply()   // las WebViews que se instalen a partir de ahora lo llevan
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** El SDK lo llama en un hilo en segundo plano para take_screenshot; devuelve una data URL JPEG. */
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

Este es un esquema de referencia que no se ha compilado en un proyecto Android real (se omiten los imports); la guía de la consola web tiene la versión completa con imports. Notas:

- **Alternativa sin `DOCUMENT_START_SCRIPT`.** En las versiones de WebView que no tienen esta función, inyecta el mismo script desde `WebViewClient.onPageFinished` con `evaluateJavascript`, protegido con `if (!window.RemoteWebviewDebugger) { … }` para que se ejecute una sola vez por documento. En ese caso la captura empieza cuando la página ya ha cargado, así que se pierden sus primeros mensajes de console y sus primeras solicitudes.
- **Las interfaces de JavaScript son visibles para todas las páginas** cargadas en esa WebView, sea cual sea su origen. Añade los puentes solo mientras la depuración remota esté activa, no expongas nunca `nativeKey` a través de ellos y trata lo que recibe `post()` como entrada no confiable.
- `webView.draw()` no captura el contenido renderizado por hardware, como el vídeo. Para obtener los píxeles reales, usa `PixelCopy` sobre la ventana (API 26+).

## Barra de estado, botones y diálogos nativos

Consulta `status()` periódicamente (los esquemas de arriba lo envían cada 500 ms; la referencia solo envía los cambios) y controla la interfaz nativa a partir de él:

| Campo de `status()` | Uso |
|---|---|
| `deviceCode`, `status` | Muestra el código de dispositivo y si la conexión está `online`, `connecting`, `polling`, `rejected` o `quota` |
| `control` | `observe`: "La IA está mirando"; `agent`: "La IA tiene el control"; en ambos, desactiva el botón Atrás y el gesto de deslizar para volver; `user`: "Has tomado el control" |
| `level` | El nivel concedido al agente conectado |
| `config.helpButton` | Si la política del proyecto ofrece asistencia a este usuario; muestra u oculta tu propia entrada de asistencia en consecuencia |
| `pending` | Una pregunta para el usuario, ver más abajo |
| `deviceToken` | Guárdalo cuando aparezca por primera vez o cambie |

- **Tomar control / Devolver / Finalizar:** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`; devuelve `false` si la clave es incorrecta.
- **Solicitar asistencia:** `help(true)` (y `help(false)` para cancelar).
- **Aprobación de conexión** (`pending.kind === 'attach'`): muestra `pending.agent.name` y `pending.agent.keyHint`, ofrece `pending.levels` (el último es el que pidió el agente) y luego llama a `nativeDecide(nativeKey, pending.requestId, level)`, o pasa `null` para rechazar. Responde antes de `pending.expiresAt` (30 segundos).
- **Confirmación de acción** (`pending.kind === 'confirm'`): muestra `pending.action` (p. ej. `click "Place order"`) y luego `nativeDecide(nativeKey, requestId, 'allow')` o `null`.
- Ejecuta `nativeDecide` en la WebView cuyo status informó de la solicitud: el gateway pregunta a la página en primer plano.
- Los botones y diálogos nativos deben reaccionar solo a los toques del propio usuario. Nunca llames a `nativeControl` ni a `nativeDecide` en nombre del agente.

## Id y token del dispositivo

- Genera `deviceId` una vez por instalación y guárdalo en `UserDefaults` / `SharedPreferences`. El gateway asigna el código de dispositivo a este id; una reinstalación obtiene un id nuevo y un código nuevo.
- El primer `welcome` trae un token de dispositivo; el SDK lo expone como `status().deviceToken`. Guárdalo e inyéctalo en cada WebView a partir de entonces (los esquemas vuelven a aplicar sus scripts cuando cambia). Sin él, las páginas de dominios que no lo hayan guardado por su cuenta se rechazan con el código de cierre 4401 (`status: 'rejected'`).
- Si la app conserva un `deviceId` pero pierde su token, ese id ya no puede volver a ponerse en línea. Genera un `deviceId` nuevo (el dispositivo obtiene un código nuevo).

## Abrir páginas desde enlaces de invitación

El equipo de soporte puede crear una **invitación** en la consola web (pestaña **Invites** de un proyecto) con una nota, por ejemplo un número de ticket. El enlace es la URL de invitación del proyecto (o una definida para esa invitación) más `?rwd_invite=<token>`; funciona una sola vez y caduca a los 30 minutos por defecto. Cuando una página con el SDK lo abre, el SDK saca el token de la barra de direcciones y lo envía con su `hello`; el dispositivo se pone en línea con la asistencia ya solicitada y aparece marcado como invitado en la consola web, así que nadie tiene que leer en voz alta un código de dispositivo.

Para una app:

1. Define como URL de invitación un enlace que gestione tu app, p. ej. un universal link (iOS) o un app link (Android) como `https://m.example.com/help`.
2. Cuando la app lo reciba, abre la **URL completa, incluida la query string**, en una WebView que tenga el SDK inyectado (después del consentimiento del usuario, si tu app lo pide).
3. La página debe cargar el SDK con la **clave de app del mismo proyecto** que la invitación; las invitaciones de otros proyectos se ignoran.

La consola web también muestra el enlace como código QR; al escanearlo con la cámara del teléfono se abre el universal link.

## Pruébalo

La [app de prueba](../examples/mock-app/README.md) es una app de macOS del tamaño de un teléfono que aloja `WKWebView`s exactamente como una app de iOS: el consentimiento, la inyección, el token de dispositivo, las aprobaciones y confirmaciones nativas, las capturas de pantalla y la barra de estado nativa están todos conectados. Compílala con `examples/mock-app/build-app.sh`, apúntala a tu gateway y conecta Claude Code a ella.
