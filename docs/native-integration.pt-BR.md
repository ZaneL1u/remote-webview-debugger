<!-- i18n-source: d65106286935d00b9911913bf16cf2dfdf7bb300 -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | Português (Brasil) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# Integração com apps nativos

Uma página H5 pode carregar o SDK com uma tag `<script>`. Dentro do seu próprio app dá para fazer melhor: injete o SDK a partir do código nativo em cada WebView assim que ela começa a carregar. Com isso:

- todas as páginas do app passam a ser depuráveis, inclusive as de domínios de terceiros, sem nenhuma mudança no código H5;
- o dispositivo mantém **um único código do dispositivo** entre WebViews e domínios, porque o app fornece o `deviceId` e guarda o token do dispositivo;
- o agente recebe **capturas de tela reais** (vídeo, canvas, sobreposições nativas) por meio de uma bridge nativa;
- aprovações, confirmações e os botões de assumir / devolver à IA / encerrar podem ser **interface nativa**, e o botão voltar pode ser bloqueado enquanto uma IA estiver conectada.

O guia embutido no console (**Documentação → Integrar um app nativo**) mostra o mesmo código já com a URL do seu gateway e a chave do app preenchidas. Uma referência completa e executável é [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift), usada pelo [app de simulação](../examples/mock-app/README.md). Os detalhes no nível das mensagens estão em [protocol.pt-BR.md](protocol.pt-BR.md).

## Checklist

1. **Peça consentimento.** Ative a depuração remota só depois que o usuário concordar (o app de simulação mostra primeiro um diálogo nativo de consentimento). A aprovação da conexão no dispositivo continua valendo por cima disso.
2. **Obtenha o SDK.** Empacote com o app o `dist/sdk.js` do pacote npm [`remote-webview-debugger`](../sdk/README.pt-BR.md), para que nem o gateway nem uma CDN consigam enviar código para ele; ou baixe-o uma vez quando a depuração for ativada, do seu gateway (`https://rwd.example.com/v1/sdk.js`) ou de uma URL de CDN com versão fixada (`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js`).
3. **Monte o script de inicialização:** o código-fonte do SDK, depois `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)` e depois (opcionalmente) um timer que informa `status()` ao código nativo.
4. **Injete-o no início do documento** no frame principal de cada WebView, antes de a primeira página carregar, para que a captura comece antes de qualquer script da página rodar.
5. **Guarde `deviceId` e `deviceToken`** no armazenamento do app e passe os dois para cada WebView.
6. **Registre a bridge de capturas de tela.**
7. **Conecte a interface nativa** a `status()`, `help()`, `nativeControl()` e `nativeDecide()`.

## Opções de `run()` para apps

| Opção | O que passar |
|---|---|
| `deviceId` | Um id por instalação (um UUID que você gera uma vez e guarda). Compartilhado por todas as WebViews e todos os domínios, para que o código do dispositivo nunca mude. Mudá-lo cria um novo dispositivo |
| `deviceToken` | O token que o gateway emitiu para este dispositivo (`status().deviceToken`), salvo pelo app; `null` até a primeira conexão. O localStorage é separado por origem, então sem isso uma página em um domínio novo seria rejeitada com o código de fechamento 4401 |
| `userId` | O id do usuário logado, ou `null`. Os agentes podem filtrar por ele (`list_devices userId=…`), o console o mostra e a política `helpButton: listed` o usa. Prefira um id interno opaco a dados pessoais. Quando o usuário entrar ou sair, chame `setUser(id)` ou injete de novo |
| `app` | `{ name, version }` do seu app, mostrado aos agentes e no console |
| `nativeKey` | Um segredo aleatório gerado na inicialização (por exemplo, dois UUIDs) e escrito apenas no script injetado. Exigido por `nativeControl()` e `nativeDecide()`; os scripts da página, inclusive o `evaluate_script` do agente, não conseguem lê-lo |
| `nativeApproval` | `true` para mostrar as aprovações de conexão e as confirmações de ação como diálogos nativos, em vez dos diálogos do SDK dentro da página |
| `helpButton` | `false` se o app tiver a própria entrada de “Solicitar assistência” |
| `lang` | O idioma do seu app como tag (`'en'`, `'zh'`, `'ja'`, `'pt-BR'`…; veja os [idiomas do SDK](../sdk/README.pt-BR.md#idiomas)); o padrão segue `navigator.languages` |
| `lockScreen`, `theme`, `eruda` | Como nas páginas H5, veja [protocol.pt-BR.md §10](protocol.pt-BR.md#10-api-javascript-para-hosts) |

## iOS (WKWebView)

Adicione um `WKUserScript` com `injectionTime: .atDocumentStart` e `forMainFrameOnly: true` ao `WKUserContentController` de cada `WKWebViewConfiguration`, **antes** de criar o `WKWebView`. Os pop-ups que o WebKit cria para `window.open` / `target=_blank` reutilizam a configuração que você retorna de `webView(_:createWebViewWith:…)`, então recebem os mesmos scripts. Os user scripts valem para navegações que começam depois de eles serem adicionados; recarregue as WebViews abertas depois de ativar a depuração. A bridge de capturas de tela exige iOS 14 (`WKScriptMessageHandlerWithReply`).

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // controla a barra de status, os botões e os diálogos nativos

    private let nativeKey = UUID().uuidString + UUID().uuidString   // nunca exposto às páginas
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// Um id por instalação, compartilhado por todas as WebViews e domínios.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// Emitido pelo gateway na primeira conexão; toda página seguinte precisa apresentá-lo.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// Chame depois que o usuário concordar com a depuração remota.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// Chame para cada WKWebViewConfiguration, antes de criar o WKWebView.
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
            "helpButton": false,          // o app tem a própria entrada de assistência
            "nativeKey": nativeKey,
            "nativeApproval": true,       // diálogos nativos para aprovações e confirmações
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

    // Botões e diálogos nativos. Chame-os na WebView que o usuário está vendo
    // (para nativeDecide: aquela cujo status informou a solicitação pendente).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // nível / "allow", ou nil para recusar
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState: status() de uma página, a cada 500 ms.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // as páginas abertas daqui em diante o levam
        }
        onStatus?(status)
    }

    // rwdScreenshot: pixels reais para take_screenshot.
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

    private func js(_ s: String) -> String {   // um literal de string JSON
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

O `WKUserContentController` retém os seus message handlers. Este esboço é um singleton, então isso não causa problema; se o seu handler não for, registre um proxy fraco, como faz o `RWDNative.swift`. A referência também só informa o status quando ele muda e acompanha qual WebView está na frente.

## Android (WebView)

Use `WebViewCompat.addDocumentStartJavaScript` do AndroidX WebKit (`androidx.webkit:webkit`) quando `WebViewFeature.DOCUMENT_START_SCRIPT` for suportado, e chame-o antes de `loadUrl`. A WebView precisa de `javaScriptEnabled` e `domStorageEnabled`. As regras de origem decidem onde o script roda: passe os `allowedOrigins` do seu projeto, ou `setOf("*")` para todas as páginas.

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // nunca exposto às páginas
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** Um id por instalação, compartilhado por todas as WebViews e domínios. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** Chame depois que o usuário concordar com a depuração remota. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** Chame para cada WebView, antes de loadUrl. */
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
            fallback(webView, boot)   // veja abaixo
        }
    }

    // Botões e diálogos nativos: takeover | handback | end; um nível / "allow", ou null para recusar.
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
                prefs.edit().putString("deviceToken", token).apply()   // as WebViews instaladas daqui em diante o levam
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** Chamado pelo SDK em uma thread de segundo plano para take_screenshot; retorna uma data URL JPEG. */
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

Este é um esboço de referência que não foi compilado em um projeto Android real (imports omitidos); o guia do console tem a versão completa com os imports. Observações:

- **Alternativa sem `DOCUMENT_START_SCRIPT`.** Em builds da WebView que não têm esse recurso, injete o mesmo script em `WebViewClient.onPageFinished` com `evaluateJavascript`, protegido por `if (!window.RemoteWebviewDebugger) { … }` para que rode uma vez por documento. A captura então começa depois que a página carregou, e as primeiras mensagens de console e requisições dela se perdem.
- **As interfaces JavaScript ficam visíveis para todas as páginas** carregadas naquela WebView, seja qual for a origem. Adicione as bridges só enquanto a depuração remota estiver ativa, nunca exponha o `nativeKey` por meio delas e trate o que `post()` recebe como entrada não confiável.
- `webView.draw()` não captura conteúdo renderizado por hardware, como vídeo. Para os pixels de verdade, use `PixelCopy` na janela (API 26+).

## Barra de status, botões e diálogos nativos

Consulte `status()` periodicamente (os esboços acima o enviam a cada 500 ms; a referência só envia as mudanças) e controle a interface nativa a partir dele:

| Campo de `status()` | Uso |
|---|---|
| `deviceCode`, `status` | Mostre o código do dispositivo e se a conexão está `online`, `connecting`, `polling`, `rejected` ou `quota` |
| `control` | `observe`: “IA observando”; `agent`: “IA no controle”; nos dois casos, desative o botão voltar e o gesto de voltar; `user`: “Você assumiu o controle” |
| `level` | O nível concedido ao agente conectado |
| `config.helpButton` | Se a política do projeto oferece assistência a este usuário; mostre ou esconda a sua própria entrada de assistência de acordo |
| `pending` | Uma pergunta para o usuário, veja abaixo |
| `deviceToken` | Salve-o quando ele aparecer pela primeira vez ou mudar |

- **Assumir / devolver à IA / encerrar:** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`; retorna `false` se a chave estiver errada.
- **Solicitar assistência:** `help(true)` (e `help(false)` para cancelar).
- **Aprovação de conexão** (`pending.kind === 'attach'`): mostre `pending.agent.name` e `pending.agent.keyHint`, ofereça `pending.levels` (o último é o que o agente pediu) e depois chame `nativeDecide(nativeKey, pending.requestId, level)`, ou passe `null` para recusar. Responda antes de `pending.expiresAt` (30 segundos).
- **Confirmação de ação** (`pending.kind === 'confirm'`): mostre `pending.action` (por exemplo `click "Place order"`) e depois chame `nativeDecide(nativeKey, requestId, 'allow')` ou passe `null`.
- Execute `nativeDecide` na WebView cujo status informou a solicitação: o gateway pergunta à página em primeiro plano.
- Botões e diálogos nativos devem reagir apenas aos toques do próprio usuário. Nunca chame `nativeControl` ou `nativeDecide` em nome do agente.

## Id e token do dispositivo

- Gere o `deviceId` uma vez por instalação e guarde-o em `UserDefaults` / `SharedPreferences`. O gateway atribui o código do dispositivo a esse id; uma reinstalação recebe um novo id e um novo código.
- O primeiro `welcome` traz um token do dispositivo; o SDK o expõe como `status().deviceToken`. Salve-o e injete-o em todas as WebViews a partir daí (os esboços reaplicam os scripts quando ele muda). Sem ele, as páginas em domínios que ainda não o guardaram são rejeitadas com o código de fechamento 4401 (`status: 'rejected'`).
- Se o app mantiver um `deviceId` mas perder o token, esse id não consegue mais ficar online. Gere um novo `deviceId` (o dispositivo recebe um novo código).

## Abrindo páginas a partir de links de convite

O suporte pode criar um **convite** no console (aba **Convites** de um projeto) com uma observação, como o número de um chamado. O link é a URL de convite do projeto (ou uma definida para aquele convite) mais `?rwd_invite=<token>`; ele funciona uma vez e expira em 30 minutos por padrão. Quando uma página com o SDK o abre, o SDK tira o token da barra de endereço e o envia com o `hello`; o dispositivo fica online com a assistência já solicitada e aparece como convidado no console, então ninguém precisa ler um código do dispositivo em voz alta.

Para um app:

1. Defina como URL de convite um link que o seu app trate, por exemplo um universal link (iOS) ou app link (Android) como `https://m.example.com/help`.
2. Quando o app o receber, abra a **URL completa, com a query string**, em uma WebView que tenha o SDK injetado (depois do consentimento do usuário, se o seu app pedir).
3. A página precisa carregar o SDK com a **chave do app do mesmo projeto** do convite; convites de outros projetos são ignorados.

O console também mostra o link como QR code; escaneá-lo com a câmera do celular abre o universal link.

## Experimente

O [app de simulação](../examples/mock-app/README.md) é um app macOS do tamanho de um celular que hospeda `WKWebView`s exatamente como um app iOS: consentimento, injeção, token do dispositivo, aprovações e confirmações nativas, capturas de tela e a barra de status nativa já estão todos conectados. Compile-o com `examples/mock-app/build-app.sh`, aponte-o para o seu gateway e conecte o Claude Code a ele.
