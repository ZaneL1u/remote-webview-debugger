<!-- i18n-source: a4e7bc52d91627a8d67fac32547089d8321a7d2e -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | 日本語 | [Español](README.es.md) | [Français](README.fr.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD ページ SDK（`sdk/`）

App WebView や H5 ページが読み込む 1 つの JS ファイルです。これにより、AI エージェントが RWD ゲートウェイ（`gateway/`）と MCP を通じてページを調べ、操作できるようになります。プロトコル：[`docs/protocol.ja.md`](../docs/protocol.ja.md)、アーキテクチャ：[`docs/architecture.ja.md`](../docs/architecture.ja.md)。

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // 任意
    deviceId: "…",               // 任意。SDK を注入するネイティブホストが渡す
    helpButton: true,            // 任意。「ヘルプを求める」ボタンを表示する
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // 任意。'en' | 'zh'、デフォルトは navigator.language から
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## SDK の入手

npm に [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) として公開されています。バージョンと変更点：[CHANGELOG](CHANGELOG.md)。

| 用途 | 入手先 |
|---|---|
| CDN からの `<script>` | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js` または `https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`（minify 済みの IIFE、グローバル変数 `RemoteWebviewDebugger`。バージョンを固定し、必要なら `integrity` を追加してください） |
| バンドラー | `npm install remote-webview-debugger` の後、`import { run, status } from 'remote-webview-debugger'`（型付きの ES モジュール）。取得を早く始められるよう、自分のコードより先に import してください。同じページで `<script>` 版を併せて読み込まないでください |
| 自分のゲートウェイ | `https://<gateway>/v1/sdk.js`。ゲートウェイが埋め込んでいるコピーです（SRI 用のコンテンツアドレス方式の URL もあり、管理コンソールが提示します） |
| ネイティブアプリ | パッケージの `dist/sdk.js` を同梱するか、上記のいずれかからダウンロードします。[ネイティブ統合](../docs/native-integration.ja.md)を参照してください |

## API

| API | 説明 |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | ページをオンラインにします（デバイスコード、ピル）。`Promise<{deviceCode, status}>` を返し、再度呼んでも害はありません。オプションは後述します。 |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`。`status` は `idle / connecting / online / polling / stopped / rejected / quota`、`lang` は UI の言語（`run()` の前は `null`）、`logSession` はこのページが書き込むセッションログ（記録していないときは `null`） |
| `stop()` | 切断して UI を取り除きます（console / ネットワークの収集は上限付きで続きます） |
| `setUser(userId)` | ユーザーを変更します。新しい `hello` で一度再接続します |
| `help(on)` | ヘルプを求める / 取り消す |
| `nativeControl(nativeKey, action)` | ネイティブホスト独自の UI から引き継ぐ / AI に戻す / 終了を行います |
| `nativeDecide(nativeKey, requestId, value)` | `nativeApproval` 使用時に `status().pending` に応答します。接続要求にはレベルまたは `null`、センシティブな操作の確認には `'allow'` または `null` |

`run()` のオプション：

| オプション | 説明 |
|---|---|
| `userId` | サインイン中のユーザー。`hello` と一緒に送られます |
| `deviceId` | ネイティブホストからの安定したデバイス ID（指定しない場合は localStorage に保持されます） |
| `helpButton` | 「ヘルプを求める」ボタンを表示します（プロジェクトのポリシーと OR を取ります） |
| `app` | ホストアプリの `{ name, version }` |
| `lang` | 端末のユーザーが目にするすべて（ピル、フローティングウィンドウ、下部バー、ダイアログ、トースト、eruda のタブ、センシティブな操作の「AI が … しようとしています」という説明）の言語：`'en'` または `'zh'`。デフォルト：`navigator.language` が `zh` で始まれば `'zh'`、それ以外は `'en'`。 |
| `networkExclude` | エージェントがかき分けて読まなくて済むようにしたいリクエスト。常に 404 になるフォントや解析用ビーコンなど：`['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`。各ルールは URL に対して、大文字小文字を区別しない部分文字列、`*` ワイルドカードのパターン、または `/…/` と書いた場合は正規表現としてマッチします。プロジェクトのポリシーのルールに追加されます。マッチしたリクエストはネットワーク一覧からも `net_fail` タイムラインイベントからも除外されますが、ページは記録を続けるので、エージェントは `includeExcluded` で要求できます |
| `lockScreen` | `false`：エージェントの接続中もページをロックしません（ユーザーはフローティングウィンドウで変更できます）。デフォルトは `true` |
| `theme` | `'auto'`（デフォルト、ページの背景に従う）、`'system'`、`'light'`、`'dark'` |
| `eruda` | `true` または `{ dock, load, src, name }`：Remote Debugger を eruda 内のタブとして表示します。`load` はページに eruda がない場合に最新の eruda を読み込みます。デフォルトはオフです。プロジェクトのポリシーでリモートからオンにでき、ローカルのオプションがフィールド単位で優先されます |
| `record` | `false`：このページはセッションログを書き込みません（保存済みの内容は削除されません）。デフォルトは `true`。プロジェクトのポリシーで全ページのログをオフにできます |
| `launchId` | このページがアプリのどの起動に属するか。1 つのアプリプロセスのすべての WebView が、セッションログを 1 つのセッションにまとめるために使います。ネイティブホストはここに独自の ID を渡します（または `window.RWDLaunchId` を文字列か、文字列を返す関数として定義します）。指定がなければ、SDK はセッション Cookie とハートビートから起動を推定します |
| `nativeKey`、`deviceToken`、`nativeApproval` | ネイティブホスト向け：`nativeControl` / `nativeDecide` 用のシークレット、ホストが保持するデバイストークン、接続 / 確認の問い合わせをネイティブで行うかどうか |

## 言語

対象は 2 つ、設定も 2 つです：

- **端末のユーザー**：`run({ lang })`、なければブラウザの言語（上記参照）。カタログ：`src/i18n.ts`。
- **エージェント**：RPC のエラーメッセージとタイムラインの要約（タップ、ページ内遷移、失敗したリクエスト）は、ゲートウェイの `welcome.agentLang`（`'en'` / `'zh'`）に従います。welcome で指定されるまでは英語です。最後の値は localStorage の `rwd:alang` に保持されるため、次のページで welcome が届く前のイベントにもその値が使われます。カタログ：`packages/chobitsu/src/engine/rwd/i18n.ts`。

そのため、中国語話者のユーザーが英語で動くエージェントと協力できます。ダイアログは `AI 想要点击「提交订单」，允许吗？` と尋ね、拒否されればエージェントは `The user denied this action` を受け取ります。

## ページ内での動作（プロトコル §6–§8、§11）

- レベル：RPC は `welcome.level` / `control.level` に照らしてチェックされます（`forbidden`、「… レベルが必要です」）。レベルを持たないエージェント（古いゲートウェイ）は `interact` として扱われます。エージェントが接続していないときは、追加の制限は何もかかりません。
- デバイストークンは localStorage の `rwd:dtoken` に、再開トークンは sessionStorage の `rwd:resume`（pageId に紐付く）に保持されます。クローズコード 4401：その間にトークンが変わっていれば（同じデバイスの別のタブがちょうど取得した場合）すぐに一度再試行し、そうでなければ `rejected` となり約 10 分後に再試行します。4409：新しい pageId で再接続します。4429：`quota`、約 5 分後に再試行します。
- アドレスバーの `rwd_invite` は `run()` の時点で取り除かれ（`history.replaceState`）、welcome が届くまで hello と一緒に送られます。
- `welcome.config`：`helpButton`（`run()` のオプションと OR を取る）、`maskSelectors`、`maskPatterns`（スナップショット、console、ネットワークの URL、ストレージの値、タイムラインの要約）、`confirmSelectors`、`networkExclude`（`run()` のオプションのルールに追加）、`sessionLog`。最後の設定は localStorage の `rwd:cfg` に保持され、welcome が届くまで使われます。そのため、セッションログをオフにしたプロジェクトでは、次のページでも welcome が届く前の最初の瞬間からオフのままです。
- スナップショットの末尾には `[Overlays]` セクションがあり、ページの上に浮かぶもの（ポップアップの背景幕、モーダル、ボトムシート）を、タグ、短いテキスト、ビューポートを覆う割合、ref とともに列挙します。背景幕は aria snapshot にノードのない空の要素なので、`eN` ではなく `oN` の ref が付きます。これにより、エージェントは背景幕をタップしてポップアップを閉じられます。
- クリックはまず要素の見えている中心を狙い、次にその内側の 3×3 グリッドの他の位置を狙います。そのため、ボタンに重なったバッジがクリックを妨げることはありません。すべての位置が覆われている場合、RPC は `not_interactable` で失敗し、覆っている要素とその ref を示します。
- 接続とセンシティブな操作のダイアログ（`[data-rwd-confirm]`、`confirmSelectors`、Enter によるフォーム送信を含む）は Shadow DOM 内にあり、信頼されたタップだけを受け付け、表示から 0.4 秒後に有効になります。同じオリジンのタブは、決定済みの接続要求を BroadcastChannel で共有します。

ファイルを読み込むと、console、捕捉されないエラー、ネットワーク（XHR、fetch、WebSocket、sendBeacon、EventSource）の収集がそれぞれ最大 500 件まで始まります。いっぱいになると、通常のログと成功したリクエストから先に破棄されます。レスポンスボディは合計 5 MB、1 件あたり 64 KB までキャッシュされます。そのため、`<head>` の早い位置で同期的に読み込んでください。

## セッションログ（プロトコル §5.4）

これらのバッファは 1 つのページのメモリにすぎません。それと並行して、SDK は端末の IndexedDB（`rwd-log`）に**セッションログ**を書き込みます。これにより、バグの後に接続したエージェントも、バグに至るまでの経緯をすべて読めます：

- 1 つのセッションはアプリの 1 回の起動で、そのオリジンのすべてのページで共有されます：`run({ launchId })`、なければ `window.RWDLaunchId`、それもなければセッション Cookie `rwd_launch` とハートビートから推定します（Cookie セッションが 1 時間以上沈黙していれば新しい起動とみなします）。`status().logSession` が使用中の ID です。
- 記録内容：ページのオープン / ページ内遷移 / フォアグラウンドとバックグラウンドの切り替え / 離脱、ユーザーのタップ・入力・送信・スクロールの停止位置、エージェントの操作系の呼び出しと `rwd.evaluate`、制御状態の変化、すべてのレベルの console、そして完了したすべてのリクエスト（失敗したものは伏せ字処理済みのヘッダーとボディも、各 64 KB まで）。ゲートウェイに到達できるかどうかに関係なく動作します。マスク対象のフィールドは `••••` として保存され、`maskPatterns` は記録を書き込む時点で適用されます。
- 保持：直近 3 回の起動分、各 10 MB まで。それを超えると、通常のログと成功したリクエストから先に破棄されます。ストレージのクォータが 64 MB 未満の場合は現在の起動分のみ、IndexedDB がなければ何も保持しません。
- エージェントは `rwd.log`（`observe`）と `rwd.logDetail`（ヘッダーとボディ用、`advanced`）で読み取ります。それ以外の方法で端末の外に出ることはありません。
- 無効化：ページ単位なら `run({ record: false })`、プロジェクト全体なら `policy.sessionLog: false`。後者は、そのオリジンが保存済みの内容も削除します。

## 構成

- `src/index.ts`：公開 API、セッション、RPC のディスパッチ、制御状態。
- `src/transport.ts`：ページ WebSocket（ネイティブのコンストラクター）、ハートビートのタイムアウト、指数バックオフ、3 回失敗した後は 60 秒ごとの `POST /v1/presence`。
- `src/ids.ts`：deviceId / pageId / openerId。
- `src/launch.ts`：このページがアプリのどの起動に属するか（`launchId`、`window.RWDLaunchId`、`rwd_launch` Cookie）。
- `src/pageWatch.ts`：`page` メッセージ（URL、タイトル、可視状態）とタイムラインイベント（ページ内遷移、ユーザーのタップ）。
- `src/ui.ts`、`src/lock.ts`：Shadow DOM 内のピル、ヘルプボタン、ロック用オーバーレイ、光る縁、操作のハイライト、ダイアログ。エージェントの接続中はユーザーの信頼された入力をブロックし、接続時間を表示します。
- `src/approval.ts`：接続承認とセンシティブな操作の確認（ページのダイアログ、または `nativeDecide` 経由のネイティブホスト）。
- `src/i18n.ts`：ユーザー向け UI のテキスト（en / zh）。
- エージェント側のエンジンは chobitsu と並んで `packages/chobitsu/src/engine/rwd/` にあります：スナップショット、`rwd.query`、操作可能性のチェック、合成入力、キーボード、console / ネットワークのバッファ、スクリーンショット、`rwd.storage`、IndexedDB 上のセッションログ（`coldlog.ts`）、オーバーレイの検出（`overlays.ts`）、レベルと確認のルール（`policy.ts`）、エージェント向けのテキスト（`i18n.ts`）。スナップショットに使う Playwright のソースは `packages/chobitsu/src/engine/vendor/playwright/` にあります。ビルド時にこれらをソースから `dist/sdk.js` にバンドルします。

## ビルドとテスト

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js（IIFE、グローバル RemoteWebviewDebugger、ES2017）、dist/index.mjs + index.d.ts（ES モジュール）
npm run typecheck
npm test             # Playwright：WebKit（iPhone 15）+ Chromium（Pixel 7）
npm run gateway      # ローカルのモックゲートウェイ：http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

テストは `test/mock-gateway.mjs` を使います。これはプロトコルのページ側（welcome、制御状態、RPC、presence、トークン、クローズコード、レベル、リモート設定、`agentLang`、接続承認）を実装し、`/v1/sdk.js` とデモショップを配信します。モック自体はレベルをチェックしないため、テストではページ側の強制が検証されます。`test/e2e/` のスペックは、テストで別途指定しない限り `zh-CN` のブラウザと `agentLang: 'zh'` で実行されます。英語は `i18n.spec.ts` がカバーします。共存テストは jsdelivr から eruda 3.4.3 と PageSpy 2.4.0 を読み込むため、インターネット接続が必要です。
