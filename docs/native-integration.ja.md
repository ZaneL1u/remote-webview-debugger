<!-- i18n-source: d65106286935d00b9911913bf16cf2dfdf7bb300 -->
[English](native-integration.md) | [简体中文](native-integration.zh-CN.md) | [繁體中文](native-integration.zh-TW.md) | 日本語 | [한국어](native-integration.ko.md) | [Español](native-integration.es.md) | [Français](native-integration.fr.md) | [Deutsch](native-integration.de.md) | [Português (Brasil)](native-integration.pt-BR.md) | [Русский](native-integration.ru.md) | [العربية](native-integration.ar.md)

# ネイティブアプリへの組み込み

H5 ページなら `<script>` タグで SDK を読み込めます。自社アプリの中ではさらに良い方法があります。ネイティブコードから、読み込みを開始するすべての WebView に SDK を注入するのです。そうすると：

- アプリ内のすべてのページが、サードパーティのドメインも含め、H5 のコードを変更せずにデバッグ可能になります。
- アプリが `deviceId` を供給しデバイストークンを保持するので、WebView やドメインをまたいでも**デバイスコードは 1 つ**のままです。
- エージェントはネイティブブリッジを通じて**実際のスクリーンショット**（動画、canvas、ネイティブのオーバーレイを含む）を取得できます。
- 承認、確認、引き継ぐ / AI に戻す / 終了のボタンを**ネイティブ UI** にでき、AI の接続中は戻るボタンをロックできます。

管理コンソールに組み込まれたガイド（**ドキュメント → ネイティブアプリを組み込む**）には、ゲートウェイの URL とアプリキーを埋め込んだ同じコードが表示されます。完全で実行可能な参考実装は [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift) で、[モックアプリ](../examples/mock-app/README.md)で使われています。メッセージレベルの詳細は [protocol.ja.md](protocol.ja.md) にあります。

## チェックリスト

1. **同意を得る。** リモートデバッグは、ユーザーが同意した後でのみ有効にしてください（モックアプリは最初にネイティブの同意ダイアログを表示します）。その上で、端末上での接続承認も引き続き適用されます。
2. **SDK を入手する。** npm パッケージ [`remote-webview-debugger`](../sdk/README.ja.md) の `dist/sdk.js` をアプリに同梱すれば、ゲートウェイも CDN もアプリにコードを送り込めなくなります。あるいは、デバッグを有効にしたときに一度だけ、ゲートウェイ（`https://rwd.example.com/v1/sdk.js`）またはバージョンを固定した CDN の URL（`https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js`）からダウンロードします。
3. **起動スクリプトを組み立てる：** SDK のソース、続いて `RemoteWebviewDebugger.run(gatewayUrl, appKey, options)`、さらに（任意で）`status()` をネイティブコードに報告するタイマー。
4. **ドキュメント開始時に注入する。** すべての WebView のメインフレームに、最初のページが読み込まれる前に注入します。これにより、ページのスクリプトが動く前から取得が始まります。
5. **`deviceId` と `deviceToken` を保持する。** アプリのストレージに保存し、両方をすべての WebView に渡します。
6. **スクリーンショットブリッジを登録する。**
7. **ネイティブ UI をつなぐ。** `status()`、`help()`、`nativeControl()`、`nativeDecide()` に接続します。

## アプリ向けの `run()` オプション

| オプション | 渡す値 |
|---|---|
| `deviceId` | インストールごとに 1 つの ID（一度生成して保存する UUID）。すべての WebView とすべてのドメインで共有されるため、デバイスコードは変わりません。変更すると新しいデバイスになります |
| `deviceToken` | ゲートウェイがこのデバイスに発行し、アプリが保存しておいたトークン（`status().deviceToken`）。最初の接続までは `null` です。localStorage はオリジンごとなので、これがないと新しいドメインのページはクローズコード 4401 で拒否されます |
| `userId` | サインイン中のユーザーの ID、または `null`。エージェントはこれで絞り込め（`list_devices userId=…`）、管理コンソールにも表示され、ポリシーの `helpButton: listed` でも使われます。個人情報ではなく、不透明な内部 ID を使うことをおすすめします。ユーザーがサインイン・サインアウトしたら、`setUser(id)` を呼ぶか再注入してください |
| `app` | アプリの `{ name, version }`。エージェントと管理コンソールに表示されます |
| `nativeKey` | 起動時に生成し（例：UUID を 2 つ連結）、注入するスクリプトにだけ書き込むランダムなシークレット。`nativeControl()` と `nativeDecide()` に必要です。ページのスクリプトからは、エージェントの `evaluate_script` も含めて読めません |
| `nativeApproval` | `true` にすると、接続承認と操作の確認を SDK のページ内ダイアログではなくネイティブのダイアログで表示します |
| `helpButton` | アプリ独自の「サポートを依頼」入口がある場合は `false` |
| `lang` | アプリの言語を表す言語タグ（`'en'`、`'zh'`、`'ja'`、`'pt-BR'` など。[SDK の言語](../sdk/README.ja.md#言語)を参照）。デフォルトは `navigator.languages` に従います |
| `lockScreen`、`theme`、`eruda` | H5 ページと同じです。[protocol.ja.md §10](protocol.ja.md#10-ホスト向け-javascript-api) を参照してください |

## iOS（WKWebView）

各 `WKWebViewConfiguration` の `WKUserContentController` に、`injectionTime: .atDocumentStart` と `forMainFrameOnly: true` を指定した `WKUserScript` を、`WKWebView` の作成**前**に追加します。WebKit が `window.open` / `target=_blank` のために作るポップアップは、`webView(_:createWebViewWith:…)` から返した設定を再利用するので、同じスクリプトが適用されます。ユーザースクリプトは追加後に始まるナビゲーションにのみ適用されるため、デバッグを有効にした後は開いている WebView をリロードしてください。スクリーンショットブリッジには iOS 14（`WKScriptMessageHandlerWithReply`）が必要です。

```swift
import WebKit

final class RWD: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    static let shared = RWD()
    let gateway = "https://rwd.example.com/v1"
    let appKey = "rwd_pk_…"
    var userId: String?
    var onStatus: (([String: Any]) -> Void)?           // ネイティブのステータスバー、ボタン、ダイアログを駆動する

    private let nativeKey = UUID().uuidString + UUID().uuidString   // ページには決して公開しない
    private let defaults = UserDefaults.standard
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private var sdk: String?

    /// インストールごとに 1 つの ID。すべての WebView とドメインで共有する。
    lazy var deviceId: String = {
        if let id = defaults.string(forKey: "rwd.deviceId") { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: "rwd.deviceId")
        return id
    }()

    /// 最初の接続時にゲートウェイが発行する。以降のページはすべてこれを提示する必要がある。
    private var deviceToken: String? {
        get { defaults.string(forKey: "rwd.deviceToken") }
        set { defaults.set(newValue, forKey: "rwd.deviceToken") }
    }

    /// ユーザーがリモートデバッグに同意した後に呼ぶ。
    func enable(completion: @escaping () -> Void) {
        URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
            DispatchQueue.main.async {
                self.sdk = data.flatMap { String(data: $0, encoding: .utf8) }
                self.controllers.allObjects.forEach(self.apply)
                completion()
            }
        }.resume()
    }

    /// すべての WKWebViewConfiguration に対して、WKWebView を作成する前に呼ぶ。
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
            "helpButton": false,          // アプリに独自のサポート依頼入口がある
            "nativeKey": nativeKey,
            "nativeApproval": true,       // 承認と確認はネイティブのダイアログで
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

    // ネイティブのボタンとダイアログ。ユーザーが見ている WebView に対して呼ぶ
    // （nativeDecide は、保留中のリクエストを status で報告した WebView に対して呼ぶ）。
    func help(in webView: WKWebView) { eval(webView, "RemoteWebviewDebugger.help(true)") }
    func control(_ action: String, in webView: WKWebView) {          // takeover | handback | end
        eval(webView, "RemoteWebviewDebugger.nativeControl(\(js(nativeKey)), \(js(action)))")
    }
    func decide(_ requestId: String, _ value: String?, in webView: WKWebView) {  // レベル / "allow"、拒否するなら nil
        eval(webView, "RemoteWebviewDebugger.nativeDecide(\(js(nativeKey)), \(js(requestId)), \(value.map(js) ?? "null"))")
    }
    private func eval(_ webView: WKWebView, _ code: String) {
        webView.evaluateJavaScript("window.RemoteWebviewDebugger && " + code)
    }

    // rwdState：ページの status() を 500 ms ごとに受け取る。
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let status = message.body as? [String: Any] else { return }
        if let token = status["deviceToken"] as? String, !token.isEmpty, token != deviceToken {
            deviceToken = token
            controllers.allObjects.forEach(apply)   // これ以降に開くページはトークンを持つ
        }
        onStatus?(status)
    }

    // rwdScreenshot：take_screenshot 用の実際のピクセル。
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

    private func js(_ s: String) -> String {   // JSON の文字列リテラル
        let data = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }
}
```

`WKUserContentController` はメッセージハンドラーを強参照で保持します。このスケッチはシングルトンなので問題ありませんが、ハンドラーがシングルトンでない場合は、`RWDNative.swift` のように weak なプロキシを登録してください。参考実装では、状態が変わったときだけ報告し、どの WebView が前面にあるかも追跡しています。

## Android（WebView）

`WebViewFeature.DOCUMENT_START_SCRIPT` がサポートされている場合は AndroidX WebKit（`androidx.webkit:webkit`）の `WebViewCompat.addDocumentStartJavaScript` を使い、`loadUrl` の前に呼びます。WebView には `javaScriptEnabled` と `domStorageEnabled` が必要です。スクリプトが動く場所はオリジンのルールで決まります。プロジェクトの `allowedOrigins` を渡すか、すべてのページなら `setOf("*")` を渡します。

```kotlin
// implementation("androidx.webkit:webkit:1.12.0")
class Rwd(private val context: Context) {
    private val gateway = "https://rwd.example.com/v1"
    private val appKey = "rwd_pk_…"
    private val prefs = context.getSharedPreferences("rwd", Context.MODE_PRIVATE)
    private val nativeKey = UUID.randomUUID().toString() + UUID.randomUUID().toString()  // ページには決して公開しない
    private var sdk: String? = null
    var userId: String? = null
    var onStatus: ((JSONObject) -> Unit)? = null

    /** インストールごとに 1 つの ID。すべての WebView とドメインで共有する。 */
    val deviceId: String = prefs.getString("deviceId", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }

    /** ユーザーがリモートデバッグに同意した後に呼ぶ。 */
    fun enable(onReady: () -> Unit) = thread {
        sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
        Handler(context.mainLooper).post(onReady)
    }

    /** すべての WebView に対して、loadUrl の前に呼ぶ。 */
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
            fallback(webView, boot)   // 後述
        }
    }

    // ネイティブのボタンとダイアログ：takeover | handback | end。レベル / "allow"、拒否するなら null。
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
                prefs.edit().putString("deviceToken", token).apply()   // これ以降に install する WebView はトークンを持つ
            }
            Handler(context.mainLooper).post { onStatus?.invoke(status) }
        }
    }

    /** take_screenshot のために SDK がバックグラウンドスレッドで呼ぶ。JPEG の data URL を返す。 */
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

これは実際の Android プロジェクトでコンパイルしていない参考用のスケッチです（import は省略しています）。管理コンソールのガイドに import を含む完全版があります。注意点：

- **`DOCUMENT_START_SCRIPT` がない場合のフォールバック。** この機能がない WebView のビルドでは、同じスクリプトを `WebViewClient.onPageFinished` から `evaluateJavascript` で注入し、ドキュメントごとに一度だけ実行されるよう `if (!window.RemoteWebviewDebugger) { … }` で囲みます。この場合、取得はページの読み込み後に始まるため、最初期の console メッセージやリクエストは取りこぼします。
- **JavaScript インターフェースは、その WebView に読み込まれるすべてのページから見えます。** オリジンは問いません。ブリッジはリモートデバッグが有効な間だけ追加し、`nativeKey` を決してブリッジ経由で公開せず、`post()` が受け取るものは信頼できない入力として扱ってください。
- `webView.draw()` は動画のようなハードウェア描画のコンテンツをキャプチャしません。本当のピクセルが必要なら、ウィンドウに対して `PixelCopy`（API 26 以上）を使ってください。

## ネイティブのステータスバー、ボタン、ダイアログ

`status()` をポーリングし（上のスケッチは 500 ms ごとに送信し、参考実装は変化があったときだけ送信します）、それに基づいてネイティブ UI を動かします：

| `status()` のフィールド | 用途 |
|---|---|
| `deviceCode`、`status` | デバイスコードと、接続が `online`、`connecting`、`polling`、`rejected`、`quota` のどれかを表示します |
| `control` | `observe`：「AI が閲覧中」、`agent`：「AI が操作中」。どちらの場合も戻るボタンとスワイプでの戻る操作を無効にします。`user`：「あなたが引き継いでいます」 |
| `level` | 接続中のエージェントに許可されたレベル |
| `config.helpButton` | プロジェクトのポリシーがこのユーザーにサポートを提供するかどうか。これに応じて独自のサポート依頼入口を表示・非表示にします |
| `pending` | ユーザーへの問い合わせ。後述します |
| `deviceToken` | 初めて現れたとき、または変わったときに保存します |

- **引き継ぐ / AI に戻す / 終了：** `nativeControl(nativeKey, 'takeover' | 'handback' | 'end')`。キーが間違っていれば `false` を返します。
- **サポートを依頼：** `help(true)`（取り消すには `help(false)`）。
- **接続承認**（`pending.kind === 'attach'`）：`pending.agent.name` と `pending.agent.keyHint` を表示し、`pending.levels`（最後の要素がエージェントの要求したレベル）を選択肢として示してから、`nativeDecide(nativeKey, pending.requestId, level)` を呼びます。拒否する場合は `null` を渡します。`pending.expiresAt`（30 秒）までに応答してください。
- **操作の確認**（`pending.kind === 'confirm'`）：`pending.action`（例：`click "Place order"`）を表示してから、`nativeDecide(nativeKey, requestId, 'allow')` または `null` を呼びます。
- `nativeDecide` は、そのリクエストを status で報告した WebView で実行してください。ゲートウェイは前面のページに問い合わせます。
- ネイティブのボタンとダイアログは、ユーザー自身のタップにだけ反応しなければなりません。エージェントの代わりに `nativeControl` や `nativeDecide` を呼んではいけません。

## デバイス ID とトークン

- `deviceId` はインストールごとに一度生成し、`UserDefaults` / `SharedPreferences` に保存します。ゲートウェイはこの ID にデバイスコードを割り当てます。再インストールすると新しい ID と新しいコードになります。
- 最初の `welcome` にはデバイストークンが含まれており、SDK はそれを `status().deviceToken` として公開します。これを保存し、以降はすべての WebView に注入してください（スケッチでは、トークンが変わるとスクリプトを再適用しています）。これがないと、自分でトークンを保存していないドメインのページはクローズコード 4401（`status: 'rejected'`）で拒否されます。
- アプリが `deviceId` を保持したままトークンを失うと、その ID は二度とオンラインになれません。新しい `deviceId` を生成してください（デバイスには新しいコードが割り当てられます）。

## 招待リンクからページを開く

サポート担当者は管理コンソール（プロジェクトの **招待** タブ）で、チケット番号などのメモを付けて**招待**を作成できます。リンクはプロジェクトの招待 URL（またはその招待用に設定した URL）に `?rwd_invite=<token>` を付けたもので、一度だけ使え、デフォルトでは 30 分で期限切れになります。SDK を組み込んだページがこのリンクを開くと、SDK はアドレスバーからトークンを取り除き、`hello` と一緒に送ります。デバイスは最初からサポート依頼中の状態でオンラインになり、管理コンソールでは招待済みとしてマークされるので、誰もデバイスコードを読み上げる必要がありません。

アプリの場合：

1. 招待 URL を、アプリが処理するリンクに設定します。例えば `https://m.example.com/help` のような、ユニバーサルリンク（iOS）やアプリリンク（Android）です。
2. アプリがそれを受け取ったら、**クエリ文字列を含む完全な URL** を、SDK を注入した WebView で開きます（アプリが同意を求める場合は、ユーザーの同意を得た後に）。
3. ページは招待と**同じプロジェクトのアプリキー**で SDK を読み込む必要があります。他のプロジェクトの招待は無視されます。

管理コンソールはリンクを QR コードとしても表示します。スマートフォンのカメラで読み取るとユニバーサルリンクが開きます。

## 試してみる

[モックアプリ](../examples/mock-app/README.md)は、iOS アプリとまったく同じように `WKWebView` をホストする、スマートフォンサイズの macOS アプリです。同意、注入、デバイストークン、ネイティブの承認と確認、スクリーンショット、ネイティブのステータスバーがすべて組み込まれています。`examples/mock-app/build-app.sh` でビルドし、ゲートウェイを指定して、Claude Code から接続してみてください。
