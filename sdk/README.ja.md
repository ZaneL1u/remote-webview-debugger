<!-- i18n-source: 8b96028b6553c0ce9fc8b5176a6a613bdaa1228f -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

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
    lang: "en",                  // 任意。言語タグ。デフォルトはブラウザの言語設定から
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
| `setLang(lang?)` | 実行時に UI の言語を切り替えます（アプリ独自の言語設定など）。引数なしで呼ぶとブラウザの言語設定に戻ります。[言語](#言語)を参照 |
| `registerLocale(pack)` | 言語パックを追加するか、同じ `id` の言語パックを置き換えます（配列も渡せます）。[言語](#言語)を参照 |
| `builtinLocales` | 組み込みの言語パックの ID の一覧 |

`run()` のオプション：

| オプション | 説明 |
|---|---|
| `userId` | サインイン中のユーザー。`hello` と一緒に送られます |
| `deviceId` | ネイティブホストからの安定したデバイス ID（指定しない場合は localStorage に保持されます） |
| `helpButton` | 「ヘルプを求める」ボタンを表示します（プロジェクトのポリシーと OR を取ります） |
| `app` | ホストアプリの `{ name, version }` |
| `lang` | 端末のユーザーが目にするすべて（ピル、フローティングウィンドウ、下部バー、ダイアログ、トースト、eruda のタブ、センシティブな操作の「AI が … しようとしています」という説明）の言語：`'ja'` や `'pt-BR'` などの言語タグ。デフォルトはブラウザの言語設定です。[言語](#言語)を参照 |
| `locales` | 追加の言語パック。言語を選ぶ前に登録されます（`registerLocale` と同じ） |
| `messages` | 言語ごとに上書きするメッセージ：`{ en: { ui: { help: 'Contact support' } }, ja: { ui: { help: 'サポートに問い合わせる' } } }` |
| `networkExclude` | エージェントがかき分けて読まなくて済むようにしたいリクエスト。常に 404 になるフォントや解析用ビーコンなど：`['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`。各ルールは URL に対して、大文字小文字を区別しない部分文字列、`*` ワイルドカードのパターン、または `/…/` と書いた場合は正規表現としてマッチします。プロジェクトのポリシーのルールに追加されます。マッチしたリクエストはネットワーク一覧からも `net_fail` タイムラインイベントからも除外されますが、ページは記録を続けるので、エージェントは `includeExcluded` で要求できます |
| `lockScreen` | `false`：エージェントの接続中もページをロックしません（ユーザーはフローティングウィンドウで変更できます）。デフォルトは `true` |
| `theme` | `'auto'`（デフォルト、ページの背景に従う）、`'system'`、`'light'`、`'dark'` |
| `style` | UI の色、フォント、角丸、z-index、位置：`{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`。[スタイルのカスタマイズ](#スタイルのカスタマイズ)を参照 |
| `eruda` | `true` または `{ dock, load, src, name }`：Remote Debugger を eruda 内のタブとして表示します。`load` はページに eruda がない場合に最新の eruda を読み込みます。デフォルトはオフです。プロジェクトのポリシーでリモートからオンにでき、ローカルのオプションがフィールド単位で優先されます |
| `record` | `false`：このページはセッションログを書き込みません（保存済みの内容は削除されません）。デフォルトは `true`。プロジェクトのポリシーで全ページのログをオフにできます |
| `launchId` | このページがアプリのどの起動に属するか。1 つのアプリプロセスのすべての WebView が、セッションログを 1 つのセッションにまとめるために使います。ネイティブホストはここに独自の ID を渡します（または `window.RWDLaunchId` を文字列か、文字列を返す関数として定義します）。指定がなければ、SDK はセッション Cookie とハートビートから起動を推定します |
| `nativeKey`、`deviceToken`、`nativeApproval` | ネイティブホスト向け：`nativeControl` / `nativeDecide` 用のシークレット、ホストが保持するデバイストークン、接続 / 確認の問い合わせをネイティブで行うかどうか |

## 言語

組み込みの言語：英語（`en`）、簡体字中国語（`zh`）、繁体字中国語（`zh-TW`。`zh-HK`、`zh-MO`、`zh-Hant` にも使われます）、フランス語（`fr`）、スペイン語（`es`）、ロシア語（`ru`）、アラビア語（`ar`、右から左へのレイアウト）、日本語（`ja`）、韓国語（`ko`）、ドイツ語（`de`）、ポルトガル語（`pt`、ブラジルポルトガル語。`pt-PT` にも使われます）。

**言語の選び方。** 端末のユーザーの言語は、`run({ lang })` が指定されていればそれ、次に `navigator.languages` を順に見ます。SDK は各タグについて、そのタグ自体、次にそれを短くした形（`pt-BR` → `pt`、`zh-HK` → `zh-TW` → `zh`）を試し、言語パックがある最初の言語を使います。どれもなければ英語になります。言語パックに足りないメッセージも同じ順序でフォールバックするため、一部だけの言語パックでも問題ありません。`setLang('ja')` で実行時に切り替えられ、`status().lang` が使用中の言語パックです。

**読み込み。** 英語と簡体字中国語は `sdk.js` に含まれています。その他の言語パックは、ページで初めて必要になったときにオンデマンドで読み込まれます（その間、UI はフォールバック先の言語で表示されます）：

- `<script>` 版：`sdk.js` と同じ場所にある `locales/<id>.js` から読み込みます（CDN のパス、例えば `…/remote-webview-debugger@0.1.0/dist/locales/ja.js`、または自分のゲートウェイの `/v1/locales/ja.js`）。失敗した場合は `run()` に渡したゲートウェイから読み込みます。この追加のリクエストを避けたい場合は、`sdk.js` の前でも後でもよいので言語パックを自分で読み込んでください：`<script src="…/dist/locales/ja.js"></script>`。
- ES モジュール版：動的 import を使うため、バンドラーは言語ごとに別のチャンクを作ります。最初からバンドルに含めたい場合は、`import ja from 'remote-webview-debugger/locales/ja'` とし、`run(url, key, { locales: [ja] })` に渡します。

**独自の言語パックと文言。** 言語パックは `{ id, name, dir?, ui?, action?, agent? }` です。省略した部分はフォールバック先の言語から取られます：

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Chiedi aiuto' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { ja: { ui: { help: 'サポートに問い合わせる' } } }, // 任意の言語の個別のメッセージを変更
})
```

`ui` は UI のテキスト、`action` は確認ダイアログの「AI が … しようとしています」を補う部分、`agent` はエージェントに返すテキストです。TypeScript の型（`LocalePack`、`Messages`、`UiMessages`、`ActionMessages`、`AgentMessages`）にすべてのキーが列挙されています。基準は `src/locales/en.ts` です。

**2 種類の読み手。** 端末のユーザーには上記で選ばれた言語が使われます。エージェントが読む RPC のエラーメッセージとタイムラインの要約（タップ、ページ内遷移、失敗したリクエスト）はゲートウェイの言語 `welcome.agentLang`（`RWD_LANG`）になり、その言語パックも同じ方法で読み込まれます。welcome で指定されるまでは英語です。最後の値は localStorage の `rwd:alang` に保持されるため、次のページで welcome が届く前のイベントにもその値が使われます。

そのため、中国語話者のユーザーが英語で動くエージェントと協力できます。ダイアログは `AI 想要点击「提交订单」，允许吗？` と尋ね、拒否されればエージェントは `The user denied this action` を受け取ります。

## スタイルのカスタマイズ

UI は `#__rwd`（`<body>` の外）の Shadow DOM 内にあるため、ページの CSS は次の入口を通してしか影響しません：

- **CSS カスタムプロパティ**：`:root` または `#__rwd` に指定します。例：`:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`。
- **`run({ style })`**：同じプロパティを `#__rwd` に設定します。ここでは色に任意の CSS カラーを使えます。
- **`::part()`**：それ以外のスタイルに使います：`#__rwd::part(bar) { … }`。パート：`pill`、`window`、`bar`、`task`、`dialog`、`toast`、`button`、`cursor`、`glow`、`overlay`。内部のクラス名は安定した API ではありません。
- **`theme`**：ライトまたはダークのガラス調（デフォルトはページの背景に従います）。

| プロパティ | `style` フィールド | デフォルト | 対象 |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | ボタン、スイッチ、エージェントのポインター、ハイライト、縁の光 |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | 「終了」ボタン |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | 「ヘルプを求める」、ユーザーが引き継ぎ中の状態 |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | オンラインを示すドット、「コピー済み」 |
| `--rwd-font` | `font` | システムの UI フォント（中国語、日本語、韓国語は言語ごと） | すべてのテキスト |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | デバイスコードとタグ |
| `--rwd-radius` | `radius` | `18px` | フローティングウィンドウ。ダイアログはこれより 2px 大きく、タスクカードとピルは 2px 小さく、ダイアログのボタンは 6px 小さくなります |
| `--rwd-button-radius` | `buttonRadius` | `999px` | ボタン、下部バー、トースト |
| `--rwd-z-index` | `zIndex` | `2147483647` | UI 全体 |
| `--rwd-bar-bottom` | `barBottom` | `14px` | 下部バー（下側のセーフエリアからの距離） |
| `--rwd-task-top` | `taskTop` | `10px` | タスクカード（上側のセーフエリアからの距離） |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | トースト（下側のセーフエリアからの距離） |
| — | `pill: { side, top }` | 右端（右から左に書く言語では左端）、`0.62` | ユーザーがドラッグするまでの、待機中のピルの初期位置。`top` は 0（上端）から 1（下端） |

色を `r, g, b` の 3 つ組で書くのは、半透明の色合いもそれに合わせて変わるようにするためです（Bootstrap の `--bs-*-rgb` と同じ方式）。

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
- `src/i18n.ts`、`src/locales/`、`src/localeLoader*.ts`：言語パック（言語ごとの UI、操作、エージェント向けのテキスト）、言語の選択とフォールバック、オンデマンドの読み込み。`scripts/locales.mjs` が `dist/locales/<id>.js` をビルドします。
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

テストは `test/mock-gateway.mjs` を使います。これはプロトコルのページ側（welcome、制御状態、RPC、presence、トークン、クローズコード、レベル、リモート設定、`agentLang`、接続承認）を実装し、`/v1/sdk.js`、`/v1/locales/` 以下の言語パック、デモショップを配信します。モック自体はレベルをチェックしないため、テストではページ側の強制が検証されます。`test/e2e/` のスペックは、テストで別途指定しない限り `zh-CN` のブラウザと `agentLang: 'zh'` で実行されます。英語は `i18n.spec.ts` が、その他の言語パック、フォールバック、独自の言語パック、スタイル、右から左へのレイアウトは `locales.spec.ts` がカバーします。共存テストは jsdelivr から eruda 3.4.3 と PageSpy 2.4.0 を読み込むため、インターネット接続が必要です。
