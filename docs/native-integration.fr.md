<!-- i18n-source: 9df5f749e07f20a0f47dbc50ab37d0c462f2092e -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | [日本語](native-integration.ja.md) | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | Français | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# Intégration dans une application native

Une page H5 peut charger le SDK avec une balise `<script>`. Dans votre propre application, vous pouvez faire mieux : injecter le SDK depuis le code natif dans chaque WebView dès qu'elle commence à charger. Ainsi :

- toutes les pages de l'application deviennent débogables, domaines tiers compris, sans modifier le code H5 ;
- l'appareil garde **un seul code d'appareil** d'une WebView et d'un domaine à l'autre, car l'application fournit le `deviceId` et conserve le jeton d'appareil ;
- l'agent obtient de **vraies captures d'écran** (vidéo, canvas, surcouches natives) via un pont natif ;
- les approbations, les confirmations et les boutons reprendre la main / rendre la main / terminer peuvent être une **interface native**, et le bouton Retour peut être verrouillé pendant qu'une IA est connectée.

Le guide intégré à la console web (**Docs → Integrate a native app**) montre le même code, avec l'URL de votre passerelle et votre clé d'application déjà renseignées. Une référence complète et exécutable se trouve dans [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift), utilisée par l'[application de démonstration](../examples/mock-app/README.md). Le détail des messages se trouve dans [protocol.fr.md](protocol.fr.md).

## Liste de contrôle

1. **Demandez le consentement.** N'activez le débogage à distance qu'après l'accord de l'utilisateur (l'application de démonstration affiche d'abord une boîte de dialogue de consentement native). L'approbation du rattachement sur l'appareil s'applique toujours en plus.
2. **Récupérez le SDK.** Embarquez `dist/sdk.js` du paquet npm [`remote-webview-debugger`](../sdk/README.fr.md) dans l'application, pour que ni la passerelle ni un CDN ne puisse jamais lui pousser de code ; ou téléchargez-le une fois à l'activation du débogage, depuis votre passerelle (`https://rwd.example.com/v1/sdk.js`) ou depuis une URL de CDN épinglée (`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js`).
3. **Construisez le script d'amorçage :** le source du SDK, puis `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`, puis (facultatif) un minuteur qui remonte `status()` au code natif.
4. **Injectez-le au début du document** dans le cadre principal de chaque WebView, avant le chargement de la première page, pour que la capture démarre avant l'exécution de tout script de la page.
5. **Conservez `deviceId` et `deviceToken`** dans le stockage de l'application et transmettez-les tous les deux à chaque WebView.
6. **Enregistrez le pont de capture d'écran.**
7. **Branchez l'interface native** sur `status()`, `help()`, `nativeControl()` et `nativeDecide()`.

## Options de `run()` pour les applications

| Option | Valeur à passer |
|---|---|
| `deviceId` | Un identifiant par installation (un UUID généré une fois et stocké). Partagé par toutes les WebViews et tous les domaines, pour que le code d'appareil ne change jamais. Le modifier crée un nouvel appareil |
| `deviceToken` | Le jeton que la passerelle a émis pour cet appareil (`status().deviceToken`), sauvegardé par l'application ; `null` jusqu'à la première connexion. Le localStorage étant propre à chaque origine, sans lui une page sur un nouveau domaine serait rejetée avec le code de fermeture 4401 |
| `userId` | L'identifiant de votre utilisateur connecté, ou `null`. Les agents peuvent filtrer dessus (`list_devices userId=…`), la console web l'affiche, et le `helpButton: listed` de la politique s'en sert. Préférez un identifiant interne opaque à des données personnelles. Quand l'utilisateur se connecte ou se déconnecte, appelez `setUser(id)` ou réinjectez le script |
| `app` | `{ name, version }` de votre application, affiché aux agents et dans la console web |
| `nativeKey` | Un secret aléatoire généré au lancement (p. ex. deux UUID) et écrit uniquement dans le script injecté. Requis par `nativeControl()` et `nativeDecide()` ; les scripts de la page, y compris le `evaluate_script` de l'agent, ne peuvent pas le lire |
| `nativeApproval` | `true` pour afficher les approbations de rattachement et les confirmations d'action dans des boîtes de dialogue natives plutôt que dans celles du SDK dans la page |
| `helpButton` | `false` si l'application a sa propre entrée « Besoin d'aide » |
| `lang` | La langue de votre application, sous forme d'étiquette (`'en'`, `'zh'`, `'ja'`, `'pt-BR'`… ; voir les [langues du SDK](../sdk/README.fr.md#langues)) ; par défaut, suit `navigator.languages` |
| `lockScreen`, `theme`, `eruda` | Comme pour les pages H5, voir [protocol.fr.md §10](protocol.fr.md#10-api-javascript-pour-les-hôtes) |

## iOS (WKWebView)

Ajoutez un `WKUserScript` avec `injectionTime: .atDocumentStart` et `forMainFrameOnly: true` au `WKUserContentController` de chaque `WKWebViewConfiguration`, **avant** de créer la `WKWebView`. Les popups que WebKit crée pour `window.open` / `target=_blank` réutilisent la configuration que vous renvoyez depuis `webView(_:createWebViewWith:…)` : elles reçoivent donc les mêmes scripts. Les scripts utilisateur s'appliquent aux navigations qui démarrent après leur ajout ; rechargez les WebViews ouvertes après avoir activé le débogage. Le pont de capture d'écran nécessite iOS 14 (`WKScriptMessageHandlerWithReply`).

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // pilote la barre d'état, les boutons et les dialogues natifs

    private let nativeKey = UUID().uuidString + UUID().uuidString   // jamais exposé aux pages
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// Un identifiant par installation, partagé par toutes les WebViews et tous les domaines.
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// Émis par la passerelle à la première connexion ; chaque page suivante doit le présenter.
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// À appeler une fois que l'utilisateur a accepté le débogage à distance.
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// À appeler pour chaque WKWebViewConfiguration, avant de créer la WKWebView.
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
            "helpButton": false,          // l'application a sa propre entrée d'aide
            "nativeKey": nativeKey,
            "nativeApproval": true,       // dialogues natifs pour les approbations et confirmations
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

    // Boutons et dialogues natifs. À appeler sur la WebView que l'utilisateur regarde
    // (pour nativeDecide : celle dont l'état a signalé la demande en attente).
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // niveau / "allow", ou nil pour refuser
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState : status() d'une page, toutes les 500 ms.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // les pages ouvertes désormais le portent
        }
        onStatus?(status)
    }

    // rwdScreenshot : les vrais pixels pour take_screenshot.
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

    private func js(_ s: String) -> String {   // un littéral de chaîne JSON
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` retient ses gestionnaires de messages. Cette esquisse est un singleton, ce n'est donc pas gênant ; si votre gestionnaire n'en est pas un, enregistrez un proxy faible comme le fait `RWDNative.swift`. La référence ne remonte aussi l'état que lorsqu'il change, et suit quelle WebView est au premier plan.

## Android (WebView)

Utilisez `WebViewCompat.addDocumentStartJavaScript` d'AndroidX WebKit (`androidx.webkit:webkit`) lorsque `WebViewFeature.DOCUMENT_START_SCRIPT` est pris en charge, et appelez-le avant `loadUrl`. La WebView a besoin de `javaScriptEnabled` et `domStorageEnabled`. Les règles d'origine déterminent où le script s'exécute : passez les `allowedOrigins` de votre projet, ou `setOf("*")` pour toutes les pages.

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // jamais exposé aux pages
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** Un identifiant par installation, partagé par toutes les WebViews et tous les domaines. */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** À appeler une fois que l'utilisateur a accepté le débogage à distance. */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** À appeler pour chaque WebView, avant loadUrl. */
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
            fallback(webView, boot)   // voir plus bas
        }
    }

    // Boutons et dialogues natifs : takeover | handback | end ; un niveau / "allow", ou null pour refuser.
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
                prefs.edit().putString("deviceToken", token).apply()   // les WebViews installées désormais le portent
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** Appelé par le SDK sur un thread d'arrière-plan pour take_screenshot ; renvoie une data URL JPEG. */
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

Ceci est une esquisse de référence qui n'a pas été compilée dans un vrai projet Android (imports omis) ; le guide de la console web en contient la version complète avec les imports. Remarques :

- **Solution de repli sans `DOCUMENT_START_SCRIPT`.** Sur les versions de WebView qui n'ont pas cette fonctionnalité, injectez le même script depuis `WebViewClient.onPageFinished` avec `evaluateJavascript`, protégé par `if (!window.RemoteWebviewDebugger) { … }` pour qu'il ne s'exécute qu'une fois par document. La capture démarre alors après le chargement de la page, et ses tout premiers messages de console et requêtes sont manqués.
- **Les interfaces JavaScript sont visibles par toutes les pages** chargées dans cette WebView, quelle que soit leur origine. N'ajoutez les ponts que tant que le débogage à distance est actif, n'exposez jamais `nativeKey` à travers eux, et traitez ce que reçoit `post()` comme une entrée non fiable.
- `webView.draw()` ne capture pas le contenu rendu par le matériel, comme la vidéo. Pour obtenir les vrais pixels, utilisez `PixelCopy` sur la fenêtre (API 26+).

## Barre d'état, boutons et boîtes de dialogue natifs

Interrogez `status()` régulièrement (les esquisses ci-dessus le transmettent toutes les 500 ms ; la référence ne transmet que les changements) et pilotez l'interface native à partir de lui :

| Champ de `status()` | Utilisation |
|---|---|
| `deviceCode`, `status` | Afficher le code d'appareil et l'état de la liaison : `online`, `connecting`, `polling`, `rejected` ou `quota` |
| `control` | `observe` : « L'IA regarde » ; `agent` : « L'IA a le contrôle » ; dans les deux cas, désactivez le bouton Retour et le balayage arrière ; `user` : « Vous avez repris la main » |
| `level` | Le niveau accordé à l'agent rattaché |
| `config.helpButton` | Indique si la politique du projet propose l'aide à cet utilisateur ; affichez ou masquez votre propre entrée d'aide en conséquence |
| `pending` | Une question pour l'utilisateur, voir ci-dessous |
| `deviceToken` | Sauvegardez-le dès qu'il apparaît ou qu'il change |

- **Reprendre / Rendre / Terminer :** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')` ; renvoie `false` si la clé est incorrecte.
- **Besoin d'aide :** `help(true)` (et `help(false)` pour annuler).
- **Approbation du rattachement** (`pending.kind === 'attach'`) : affichez `pending.agent.name` et `pending.agent.keyHint`, proposez `pending.levels` (le dernier est celui que l'agent a demandé), puis appelez `nativeDecide(nativeKey, pending.requestId, level)`, ou passez `null` pour refuser. Répondez avant `pending.expiresAt` (30 secondes).
- **Confirmation d'action** (`pending.kind === 'confirm'`) : affichez `pending.action` (p. ex. `click "Place order"`), puis `nativeDecide(nativeKey, requestId, 'allow')` ou `null`.
- Exécutez `nativeDecide` dans la WebView dont l'état a signalé la demande : la passerelle interroge la page au premier plan.
- Les boutons et boîtes de dialogue natifs ne doivent réagir qu'aux touchers de l'utilisateur lui-même. N'appelez jamais `nativeControl` ni `nativeDecide` pour le compte de l'agent.

## Identifiant et jeton d'appareil

- Générez `deviceId` une fois par installation et conservez-le dans `UserDefaults` / `SharedPreferences`. La passerelle associe le code d'appareil à cet identifiant ; une réinstallation obtient un nouvel identifiant et un nouveau code.
- Le premier `welcome` contient un jeton d'appareil ; le SDK l'expose sous `status().deviceToken`. Sauvegardez-le et injectez-le dans chaque WebView à partir de là (les esquisses réappliquent leurs scripts quand il change). Sans lui, les pages sur des domaines qui ne l'ont pas stocké elles-mêmes sont rejetées avec le code de fermeture 4401 (`status: 'rejected'`).
- Si l'application garde un `deviceId` mais perd son jeton, cet identifiant ne peut plus se mettre en ligne. Générez un nouveau `deviceId` (l'appareil reçoit un nouveau code).

## Ouvrir des pages depuis des liens d'invitation

Le support peut créer une **invitation** dans la console web (onglet **Invites** d'un projet) avec une note, par exemple un numéro de ticket. Le lien est l'URL d'invitation du projet (ou celle définie pour cette invitation) suivie de `?rwd_invite=<token>` ; il ne fonctionne qu'une fois et expire par défaut au bout de 30 minutes. Quand une page équipée du SDK l'ouvre, le SDK retire le jeton de la barre d'adresse et l'envoie avec son `hello` ; l'appareil se met en ligne en train de demander de l'aide et apparaît comme invité dans la console web, si bien que personne n'a à lire un code d'appareil à voix haute.

Pour une application :

1. Définissez comme URL d'invitation un lien que votre application gère, p. ex. un universal link (iOS) ou un app link (Android) comme `https://m.example.com/help`.
2. Quand l'application le reçoit, ouvrez l'**URL complète, chaîne de requête comprise**, dans une WebView où le SDK est injecté (après le consentement de l'utilisateur, si votre application le demande).
3. La page doit charger le SDK avec la **clé d'application du même projet** que l'invitation ; les invitations d'autres projets sont ignorées.

La console web affiche aussi le lien sous forme de QR code ; le scanner avec l'appareil photo du téléphone ouvre l'universal link.

## Essayer

L'[application de démonstration](../examples/mock-app/README.md) est une application macOS au format d'un téléphone qui héberge des `WKWebView` exactement comme une application iOS : consentement, injection, jeton d'appareil, approbations et confirmations natives, captures d'écran et barre d'état native sont tous branchés. Construisez-la avec `examples/mock-app/build-app.sh`, pointez-la vers votre passerelle et connectez-y Claude Code.
