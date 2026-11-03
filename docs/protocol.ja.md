<!-- i18n-source: 35a16a79efa3edc10d542a5bacddd6081aec3a24 -->
[English](protocol.md) | [简体中文](protocol.zh-CN.md) | [繁體中文](protocol.zh-TW.md) | 日本語 | [한국어](protocol.ko.md) | [Español](protocol.es.md) | [Français](protocol.fr.md) | [Deutsch](protocol.de.md) | [Português (Brasil)](protocol.pt-BR.md) | [Русский](protocol.ru.md) | [العربية](protocol.ar.md)

# RWD プロトコル（v1）

このドキュメントは、ゲートウェイ（[`gateway/`](../gateway)）、ページ SDK（[`sdk/`](../sdk)。エンジンは [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine)）、管理コンソール（[`console/`](../console)）、MCP クライアントの間の取り決めです。プロトコルを変更するときは、まずこのドキュメントを変更します。

全体像（コンポーネント、同意モデル、ストレージ、セキュリティ）は [architecture.ja.md](architecture.ja.md) を、アプリへの組み込みは [native-integration.ja.md](native-integration.ja.md) を参照してください。

表記の約束:

- **ゲートウェイ URL** は `https://<host>/v1` の形式です（例: `https://rwd.example.com/v1`）。すべてのエンドポイントはこの下にあり、SDK はほかのアドレスをすべてここから導きます。
- データはすべて JSON です。タイムスタンプは Unix エポックの**ミリ秒**です。
- `Level` は `"observe" | "interact" | "advanced"` のいずれかです（[§6](#6-アクセスレベル) を参照）。
- ここに記載のないフィールドは受信側で無視されます。新しいフィールドは常にオプションなので、古い SDK も新しいゲートウェイでそのまま動作します。

## 目次

1. [エンドポイント](#1-エンドポイント)
2. [識別子](#2-識別子)
3. [ページ接続（WebSocket）](#3-ページ接続websocket)
4. [制御状態](#4-制御状態)
5. [ページ RPC](#5-ページ-rpc)
6. [アクセスレベル](#6-アクセスレベル)
7. [アタッチの承認](#7-アタッチの承認)
8. [センシティブな操作の確認](#8-センシティブな操作の確認)
9. [プレゼンスポーリングによるフォールバック](#9-プレゼンスポーリングによるフォールバック)
10. [ホスト向け JavaScript API](#10-ホスト向け-javascript-api)
11. [プロジェクトポリシー](#11-プロジェクトポリシー)
12. [管理コンソール REST API](#12-管理コンソール-rest-api)
13. [ライブ更新（SSE）](#13-ライブ更新sse)
14. [MCP](#14-mcp)
15. [言語](#15-言語)
16. [運用](#16-運用)

## 1. エンドポイント

| パス | 説明 |
|---|---|
| `GET /v1/sdk.js` | ページ SDK（グローバル変数 `RemoteWebviewDebugger` を公開する IIFE）。`Cache-Control: max-age=300`、`Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | 同じファイルを、内容に応じて決まる不変の URL で配信（1 年間キャッシュ、SRI に対応）。それ以外の `<version>` は 404。[§16](#16-運用) を参照 |
| `GET /v1/locales/<id>.js`、`GET /v1/sdk/<version>/locales/<id>.js` | SDK のオンデマンドの言語パック。`sdk.js` が自身と同じ場所から読み込みます（[§15](#15-言語)）。`Cache-Control: max-age=300` |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Prometheus メトリクス（[§16](#16-運用)） |
| `WS /v1/page?key=<appKey>` | ページ接続（[§3](#3-ページ接続websocket)） |
| `POST /v1/presence` | WebSocket で接続できない場合のポーリングによるフォールバック（[§9](#9-プレゼンスポーリングによるフォールバック)） |
| `/v1/api/…` | 管理コンソール REST API（[§12](#12-管理コンソール-rest-api)） |
| `/v1/mcp` | ホスト型 MCP サーバー。Streamable HTTP、`Authorization: Bearer rwd_sk_live_…`（[§14](#14-mcp)） |
| `/demo/` | `--demo-dir` の静的ファイル。設定した場合のみ |
| その他のパス | 管理コンソールのシングルページアプリ |

`/v1/` 配下の不明なパスには `404 {"error":{"code":"not_found",…}}` を返します。すべてのレスポンスに `X-Content-Type-Options: nosniff` と `Referrer-Policy: no-referrer` が付き、SDK 以外のレスポンスにはさらに `X-Frame-Options: DENY` が付きます。

## 2. 識別子

| 名前 | 形式 | 発行元 |
|---|---|---|
| アプリキー | `rwd_pk_` + base62 の 24 文字 | プロジェクトの作成時に生成。公開情報で、ページのソースに含まれ、ページをオンラインにすることしかできない |
| API キー | `rwd_sk_live_` + base62 の 32 文字 | 管理コンソールで作成し、表示は 1 回のみ。サーバー側の pepper を使った HMAC-SHA256 で保存。管理コンソールには先頭 16 文字（`prefix`、例: `rwd_sk_live_ab12`）が表示され、デバイス側には `"…"` と prefix の末尾 4 文字（`keyHint`）が表示される |
| `deviceId` | UUID v4（`[A-Za-z0-9_-]{1,64}` であれば受け付ける） | SDK が生成して localStorage の `rwd:device` に保存するか、ネイティブホストが `run({ deviceId })` で渡す |
| デバイスコード | `23456789ABCDEFGHJKMNPQRSTUVWXYZ` の文字による `XXXX-XXXX` | ゲートウェイがその `deviceId` を初めて見たときに割り当て、以後変わらない。エージェントがこれで接続する際、大文字小文字・ハイフン・空白は区別しない |
| `pageId` | base62 の 12 文字（`[A-Za-z0-9_-]{1,64}` であれば受け付ける） | SDK が生成し、sessionStorage の `rwd:page` に保存。同じタブ内ではリロードや遷移をまたいで変わらず、タブごとに新しくなる |
| ページラベル | `p1`、`p2`、… | ゲートウェイがデバイスごとに割り当て。ページが 2 分の猶予期間内に再接続する間は維持される |
| セッション（起動）ID | ホストアプリ自身の起動 ID（`[A-Za-z0-9_.:-]` の 4〜128 文字）。なければ SDK が生成する 16 桁の 16 進数 | アプリの 1 回の起動。ページはこの下にセッションログを記録する（[§5.4](#54-セッションログ)）。`rwd.log` の結果以外でゲートウェイに送られることはない |
| `ref` | `e12`、`o3`、… | `eN`: そのページの最新スナップショットに含まれる要素で、そのページの次のスナップショットまで有効。`oN`: スナップショットにノードがない要素（オーバーレイや、クリック位置を覆っている要素など、[§5.3](#53-ページ内での動作)）で、その要素がページに存在する間は有効 |
| デバイストークン | 16 進数 64 文字 | `deviceId` ごとに 1 回だけ発行（[§3.5](#35-デバイストークン再開トークン招待)）。ゲートウェイはハッシュのみを保存 |
| 再開トークン | 16 進数 32 文字 | `welcome` のたびに更新（[§3.5](#35-デバイストークン再開トークン招待)）。ハッシュとして保存 |

## 3. ページ接続（WebSocket）

### 3.1 ライフサイクル

1. ページが `wss://<host>/v1/page?key=<appKey>` を開きます。アップグレードの前に、ゲートウェイは次を確認します。
   - レート制限: クライアント IP ごとに 1 分あたり 120 接続（プレゼンス呼び出しを含む）。超えると `429 rate_limited`
   - アプリキーが存在し、そのプロジェクトが無効化されていないこと。そうでなければ `401 bad_key`
   - プロジェクトに `allowedOrigins` がある場合、`Origin` ヘッダーがそのいずれかに一致すること。そうでなければ `403 origin_not_allowed`
2. テキストフレームのみを使い、1 フレームに 1 つの JSON オブジェクトを載せます。受信メッセージは最大 16 MiB です（スクリーンショットは base64 で届くため）。
3. ページは **5 秒以内**に `hello` を送る必要があります。不正な `hello`（JSON の誤り、`t` の誤り、無効な `deviceId` / `pageId`）は `1008` で切断されます。
4. ゲートウェイは `welcome`（[§3.4](#34-welcome)）で応答するか、プロトコルのクローズコード（[§3.6](#36-クローズコード)）で切断します。
5. ゲートウェイは **25 秒**ごとに `{"t":"hb"}` を送り、あわせて WebSocket の ping も送ります。ping には 10 秒以内に応答する必要があります。SDK は **60 秒**間何も受信しないと再接続します。
6. SDK の再接続は 1 秒から 30 秒まで指数的にバックオフし、各待ち時間は現在の段階の上半分からランダムに選ばれます。**`welcome` を受け取る前に終わった試行が 3 回続く**と、SDK はプレゼンスポーリング（[§9](#9-プレゼンスポーリングによるフォールバック)）に切り替えます。
7. 同じ `pageId` で 2 本目の接続が来ると、1 本目は置き換えられます（`1000 replaced` で切断）。
8. 切断したページは **2 分間の猶予期間**、ラベルと位置を保持します（ページ遷移による再接続は十分この期間内に収まります）。その後はタイムライン上で `closed` になります。次の 2 つの場合は待ち時間が短縮され、作り直された WebView がページ一覧に*再接続中*のまま残らないようにします。
   - **新しい `pageId`** で接続したページがあると、同じ URL（`#` フラグメントは無視）を表示している切断済みページはすべて即座に削除されます。
   - **接続中**のページと同じ URL を表示している切断済みページは、**1.5 秒**後に削除されます。

   いずれの場合も、削除されたページがエージェントの選択中ページだった場合は、選択が生きているページに移り、結果にその旨が表示されます（[§14.3](#143-ツール)）。
9. SDK は `pagehide` でソケットを閉じ（ページが back/forward キャッシュに入れるように）、`pageshow` で再接続します。

各接続には 64 メッセージの送信キューがあります。処理が追いつかないページは、ゲートウェイを遅らせる代わりに `1013 slow consumer` で切断されます。

### 3.2 ページ → ゲートウェイ

```jsonc
{"t":"hello","v":1,"sdk":"<SDK version>",
 "deviceId":"…","pageId":"…","openerId":"<pageId>"|null,
 "userId":"<string>"|null,
 "page":{"url":"…","title":"…","visibility":"visible"|"hidden"},
 "device":{"ua":"…","platform":"ios"|"android"|"web",
           "screen":{"w":393,"h":852,"dpr":3},
           "app":{"name":"…","version":"…"}|null},
 "help":false,
 "deviceToken":"<token>"|null,   // 現行の SDK では常に付く。§3.5 を参照
 "resume":"<token>"|null,        // この pageId が最後に受け取った再開トークン
 "invite":"<token>"|null}        // ?rwd_invite=… から

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // 変化したとき
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // ユーザーがサポートを依頼する / 依頼を取り消す
{"t":"control","action":"takeover"|"handback"|"end"}                // ユーザーのボタン、§4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"id":17,"result":{…}}                                              // RPC 成功、§5
{"id":17,"error":{"code":"not_found","message":"…"}}                // RPC 失敗、§5
```

- `hello`: ゲートウェイが保持するのは `userId`（最大 128 文字）、`ua`（512）、`platform`（16）、`app`、`url`（2048）、`title`（256）です。`screen` は参考情報です。
- `event.summary` はエージェント向けの 1 文で、マスク対象の値はすでに除去されています。例: `TypeError: Cannot read properties of undefined (reading 'orderId')`、`POST /api/order → 405`、`Tapped button "Place order"`。ゲートウェイは各 kind をタイムラインに記録し（最大 300 バイト）、不明な kind は無視します。ページ遷移（ページ内遷移を含む）はイベントではありません。ゲートウェイが `page` メッセージから導き（タイムライン上の `navigated`、[§12.9](#129-タイムラインイベント)）、SDK はセッションログに記録します（[§5.4](#54-セッションログ)）。
- SDK はイベントの重複を除き（2 秒以内の同じ kind・同じ summary）、10 秒あたり最大 30 件まで送ります。オフライン中に発生したイベントと制御操作はキュー（最大 100 メッセージ）で次の `welcome` まで待機します。
- `help` と `control` は、ユーザー自身のタップ（またはネイティブホストからの呼び出し、[§10](#10-ホスト向け-javascript-api)）でのみ送られます。

### 3.3 ゲートウェイ → ページ

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"Support Bot"}|null,"level":"interact"|null,
 "attachedMs":83000|null}                                     // §4、デバイスのすべてのページへ
{"t":"help","on":false}                                       // サポート依頼を解除: エージェントがアタッチした、管理コンソールのメンバーがセッションを終了した、またはユーザーがデバイス上で終了した
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"Support Bot"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7、フォアグラウンドのページへ
{"t":"attach_cancel","requestId":"…"}                         // §7、すべてのページへ
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // 予約済み: SDK は afterMs 後に再接続する
{"id":17,"method":"rwd.snapshot","params":{}}                 // RPC リクエスト、§5
```

`reconnect` は SDK が解釈できますが、現在のゲートウェイは送信しません。

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null,"attachedMs":null},
 "level":null,                       // control.level と同じ
 "resume":"<new resume token>",
 "deviceToken":"<token>",            // この welcome で発行した場合のみ
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},   // または null。下記を参照
 "agentLang":"en",                   // ゲートウェイの言語："en"、"zh"、"zh-TW"、"fr"…、§15
 "task":{…}}                         // アタッチ中のエージェントがタスクを設定している間のみ
```

`config` は、ページが使ったアプリキーのプロジェクトのポリシー（[§11](#11-プロジェクトポリシー)）から来るリモート設定です。`config.helpButton` は、このページの `userId` に対してすでに判定済みです（`all`、または `listed` でそのユーザーがリストに含まれる場合）。`config.networkExclude` は、ページ自身が `run({ networkExclude })` で渡したルールに追加されます（[§10](#10-ホスト向け-javascript-api)）。`config.sessionLog` はセッションログに関するプロジェクトのスイッチで、`false` にすると記録を止め、このオリジンに保存済みのログを削除します（[§5.4](#54-セッションログ)）。`config.eruda` はプロジェクトの eruda ポリシー（[§11](#11-プロジェクトポリシー)）です。`null` や欠落の場合もあり（このフィールドができる前のゲートウェイや、保存済みの `config`）、SDK はこれを `{"dock":false,"load":false}` として扱います。また、ページ自身の `run({ eruda })` がフィールド単位で優先されます（[§10](#10-ホスト向け-javascript-api)）。SDK は最後の `config` を localStorage の `rwd:cfg` に保存し、次のページでは `welcome` が届くまでそれを適用します。

アタッチ要求が保留中で、再接続したページがそのデバイスのフォアグラウンドページである場合、ゲートウェイは `welcome` の直後に `attach_request` を再送します。

### 3.5 デバイストークン、再開トークン、招待

**デバイストークン。** トークン対応の SDK から送られた `deviceId` を初めて見たとき、ゲートウェイは `welcome.deviceToken` でデバイストークンを発行します（ランダムな 32 バイト、16 進数。保存するのはハッシュのみ）。以後、そのデバイスのすべてのページは `hello.deviceToken` でトークンを提示する必要があり、欠落または誤りの場合は **4401** で切断されます。したがって、`deviceId` と公開のアプリキーを知っているだけでは、他人のデバイスに参加できません。

- SDK はトークンを localStorage の `rwd:dtoken` に保存し、`status().deviceToken` として公開します。localStorage はオリジン単位なので、複数のドメインを読み込むネイティブホストはトークンを自分で保持し、`run({ deviceToken })` で渡し返します（[native-integration.ja.md](native-integration.ja.md)）。
- `deviceToken` フィールドを持つ hello（値が `null` でも）はトークン対応とみなされます。このフィールドがない hello は、トークンを保持できない SDK からのものです。ゲートウェイはそのような SDK にはトークンを発行しません（発行すると、そのデバイスの後続のページが締め出されてしまうため）。ただし、いったんトークンを持ったデバイスでは、すべてのページがトークンを提示する必要があります。

**再開トークン。** `welcome` のたびに、`pageId` に紐づいた新しい `resume` トークンが届きます。既知の `pageId` のページが再接続するときは、`hello.resume` が最後に発行されたものと一致する必要があり、一致しない場合は **4409** で切断され、SDK は新しい `pageId` でやり直します。したがって、`pageId` を知っているだけではページになりすませません。

**招待。** ページの URL に `?rwd_invite=<token>` が含まれる場合、SDK はアドレスバーからこのパラメーターを取り除き（`history.replaceState`）、トークンを sessionStorage に保存して、`welcome` が届くまで `hello.invite` で送ります。ゲートウェイは、招待が同じプロジェクトのもので、未使用かつ期限内であれば受け入れます。デバイスは `invited` としてマークされてサポート依頼中になり、タイムラインにはどの招待から来たかが記録され、招待は使用済みになります。無効な招待は何も知らせずに無視されます。[§12.6](#126-デバイス招待) を参照してください。

### 3.6 クローズコード

| コード | 意味 | SDK の対応 |
|---|---|---|
| `1008` | 不正な `hello` | バックオフしながら再接続 |
| `1013` | ページが送信キューの処理に追いつかなかった | バックオフしながら再接続 |
| `4401` | デバイストークンの欠落または誤り | 保存済みトークンがその間に変わっていれば（別のタブがちょうど受け取った場合）すぐに再試行。トークンがまったくなく、`deviceId` が SDK 自身のもの（ホストから渡されたものではない）なら、トークンを運ぶ welcome が失われた（最初のページがハンドシェイクの途中で離れた）ということなので、約 1.5 秒待ち、その間に別のタブがトークンを保存していなければ新しい `deviceId` で最初からやり直す（1 ページにつき最大 2 回）。それ以外は状態を `rejected` にし、約 10 分後に再試行 |
| `4409` | 再開トークンの不一致 | 新しい `pageId` で再接続 |
| `4429` | プロジェクトのオンラインデバイス数の上限（`maxOnlineDevices`）に達した | 状態を `quota` にし、約 5 分後に再試行 |

## 4. 制御状態

各デバイスには制御状態が 1 つあり、ゲートウェイが決定して、`control` メッセージでそのデバイスのすべてのページに通知します。

| 状態 | 意味 | ページの UI |
|---|---|---|
| `none` | エージェントがアタッチしていない | デバイスコードを表示した折りたたみ状態のピル（有効な場合は「サポートを依頼」ボタンも） |
| `observe` | エージェントがアタッチしていて、閲覧のみ | 「AI is viewing」、ユーザー入力はブロック（ユーザーがロックをオフにした場合を除く）、画面の縁が光る、**引き継ぐ**ボタンと**終了**ボタン |
| `agent` | エージェントがページを操作中 | 「AI working」、同じロック・縁・ボタンに加えてエージェントのカーソル |
| `user` | ユーザーが引き継いだ | ロックなし、縁は静止表示、**AI に戻す**ボタンと**終了**ボタン |

状態遷移:

| きっかけ | 変化 |
|---|---|
| エージェントがアタッチする（[§7](#7-アタッチの承認)） | `none` → `observe` |
| エージェントが操作系ツール（click、fill、type、press、select、hover、scroll、drag、navigate、back、reload）を呼び出す | `observe` → `agent`。`user` のときは、ゲートウェイがページに問い合わせずにエラー `takeover` で拒否 |
| `policy.agentIdleMinutes`（デフォルト 2、10 秒ごとに確認）の間、操作がない | `agent` → `observe` |
| ページが `control: takeover` を送る | `observe` / `agent` → `user` |
| ページが `control: handback` を送る | `user` → `agent`（エージェントがアタッチしていなければ `none`） |
| ページが `control: end` を送る | エージェントがデタッチされ、サポート依頼が解除される → `none` |
| エージェントの切断または置き換え、そのキーの失効、`policy.attachMaxMinutes`（デフォルト 60）の期限切れ、または管理コンソールのメンバーによるセッション終了 | → `none` |

ページは、エージェントが操作を始めたときではなく、アタッチした時点（`observe`）からロックされます。アイドルによる `agent` → `observe` の間もロックされたままで、ユーザーが引き継ぐか状態が `none` に戻るまで続きます。

`attachedMs` は、ゲートウェイがメッセージを送った時点で、アタッチ中のエージェントがアタッチしてからの経過時間（ミリ秒）です（エージェントがいなければ `null`）。経過時間で表すので、ページとゲートウェイで時計を合わせる必要がありません。下部バーは `observe`、`agent`、`user` の間これを「Connected · 01:23」のように進むタイマーとして表示し、ページ自身の接続が切れている間は「Connecting…」と表示します。このフィールドがないゲートウェイの場合、SDK はページが最初にエージェントを認識した時点から数えます。

SDK も二重のチェックとして、ユーザーが制御を握っている間は操作系の RPC を `takeover` で拒否します。SDK は状態（とエージェントがアタッチした時刻）を localStorage の `rwd:ctl` に 2 分間保存するので、ページ遷移後の次のページは `welcome` を待たずにすぐロックされ、タイマーも動き続けます。引き継ぎ、AI への返却、終了は、ユーザーの信頼されたタップにしか反応しません。エージェントはこれらを押せず、ネイティブホストは `nativeKey` を提示する必要があります（[§10](#10-ホスト向け-javascript-api)）。

## 5. ページ RPC

### 5.1 エンベロープ

ゲートウェイは 1 つのページに `{"id":<n>,"method":"rwd.…","params":{…}}` を送り、ページは `{"id":<n>,"result":{…}}` または `{"id":<n>,"error":{"code":"…","message":"…"}}` で応答します。ID は接続ごとに一意です。接続が切れると、保留中の呼び出しはすぐに失敗します。

ゲートウェイ側のタイムアウト: MCP の呼び出しは 20 秒、`rwd.click`、`rwd.press`、`submit: true` 付きの `rwd.type` は 45 秒（ユーザーに確認を求める場合があるため、[§8](#8-センシティブな操作の確認)）、管理コンソールの接続テストは 15 秒です。

エラーコード:

| コード | 意味 |
|---|---|
| `not_found` | 古い `ref` または要素の消失、不明な選択肢、不明なリクエスト ID |
| `not_interactable` | 非表示、無効、覆われている、読み取り専用、または 5 秒以内に安定しない |
| `timeout` | 待機が時間切れになった（ページ内またはゲートウェイで） |
| `takeover` | ユーザーが制御を握っている |
| `forbidden` | 許可されたレベル（[§6](#6-アクセスレベル)）を超えている、またはユーザーが確認を拒否した |
| `bad_request` | パラメーターの欠落または不正、不明なメソッド |
| `internal` | その他すべて（メッセージに JavaScript のエラーが入る） |

SDK が書くメッセージはエージェントの言語（`welcome.agentLang`、[§15](#15-言語)）になります。

### 5.2 メソッド

どのメソッドも、それを受け取ったページに対して動作します。

| メソッド | レベル | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<ms>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}`: Playwright の AI 形式（YAML、要素に `[ref=eN]` タグ付き）のアクセシビリティスナップショット。ページの上に何かが浮いている場合は、その後にオーバーレイのセクションが続く（[§5.3](#53-ページ内での動作)） |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}`（条件を 1 つ以上。`limit` は 1〜100） | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`。[§5.4](#54-セッションログ) を参照 | `op` による |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}`: Playwright のキー名。`Control+A` のような組み合わせも可 | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}`（その後ページは再接続する） |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | セッションログの 1 レコードの全体: `{"seq","session","at","kind","page","imp","size","data"}`。ヘッダーとボディを含む（[§5.4](#54-セッションログ)） |

詳細:

- `rwd.query` は `role` を完全一致（大文字小文字を区別しない）で、`name` / `text` を大文字小文字を区別しない部分一致で照合します。`text` は要素自身と子孫のテキストを対象とし、最も内側で一致した要素だけを返します。
- `rwd.fill` はテキスト入力、テキストエリア、`contenteditable` 要素に使えます（`<label>` はその対象のコントロールに置き換えられます）。ネイティブの setter で値を設定し、`input` と `change` を発火するので、React や Vue の制御コンポーネントにも変更が伝わります。`<select>` には `rwd.select` を使います。
- `rwd.type` は、`ref` があればそこにフォーカスし（キャレットは末尾）、なければフォーカス中の要素に入力します。`submit: true` の場合は、その後に Enter を押します。
- `rwd.select` は、各値を選択肢の value、label、テキストと照合します。複数の値を選ぶには `multiple` の select が必要です。
- `rwd.scroll` は、`ref` がなければページをスクロールし、`ref` があればその要素に wheel イベントを発火して、スクロール可能な祖先要素をスクロールします。ユーザーが目で追えるよう、スクロールは約 0.3 秒かけてアニメーションします。
- `rwd.navigate` が受け付けるのは、絶対または相対の `http(s)` URL のみです。遷移、戻る、リロードは、応答を送ってから 50 ミリ秒後に実行されます。
- `rwd.waitFor` は、まず `timeMs`（最大 60 秒）待ち、その後 100 ミリ秒ごとに表示テキスト（`document.body.innerText`）を確認して、`text` が現れ `textGone` が消えるのを待ちます。`timeoutMs` を過ぎると `timeout` で失敗します。
- `rwd.screenshot` は、ホストアプリのネイティブキャプチャーが登録されていて、対象領域がビューポート内にあればそれを使い（`source: "native"`）、そうでなければ DOM を再レンダリングします（`source: "dom"`。canvas、動画、クロスオリジンの画像は空白になることがあります）。`ref` を指定するとその要素で切り抜き、`fullPage` はドキュメント全体をキャプチャーします。[§10](#10-ホスト向け-javascript-api) を参照してください。
- `rwd.console` / `rwd.network` は、`sinceId` があればそれより後の古いほうから `limit` 件を、なければ最新の `limit` 件を返します。進行中のリクエストは `status: 0`、`durationMs: null` です。`type` は `xhr`、`fetch`、`websocket`、`beacon`、`eventsource` のいずれかです。
- `rwd.network` は除外ルール（プロジェクトの `networkExclude` と `run({ networkExclude })`（[§11](#11-プロジェクトポリシー)）、さらにこの呼び出しだけの `exclude`）に一致するリクエストを除外し、その件数を `hidden` で数えます。`includeExcluded: true` を指定するとすべてを返し、`hidden` は 0 のままです。除外されたリクエストも記録はされており、`rwd.networkDetail` で ID を指定すれば取得できます。
- `rwd.networkDetail` は `Cookie`、`Set-Cookie`、`Authorization`、`Proxy-Authorization` ヘッダーを伏せ字にします。ボディはマスクされ、64 KB で切り詰められます。
- `rwd.storage` は最大 500 件を返し、値は 4000 文字で切り詰められます。Cookie はスクリプトから見えるもの（HttpOnly でないもの）です。SDK 自身の `rwd:dtoken` と `rwd:resume` は常にマスクされます。
- `rwd.evaluate` は関数のソースをページのグローバルスコープで評価し、`this = window` で呼び出します。Promise を返しても構いません。結果は JSON として安全な形に変換されます。`undefined` と関数は `null` に、要素は短いタグの説明に、日付は ISO 文字列に、循環参照は `"[Circular]"` になります。

### 5.3 ページ内での動作

- **操作可能性。** ポインター操作は、要素が DOM に接続され、表示され、2 アニメーションフレームにわたって静止し、有効で、画面内にスクロールされ、かつ対象位置でのヒットテストがその要素または子孫に当たるまで（最大 5 秒）待ちます。最初に試す位置は、指で触れるのと同じく要素の表示部分の中心です。そこが何かに覆われている場合は、表示領域内の 3×3 グリッドのほかの位置を試すので、ボタンの上のバッジがクリックを妨げることはありません。すべての位置が覆われている場合、呼び出しは `not_interactable` で失敗し、メッセージに覆っている要素とその `ref` が示されます（*the click point is covered by `<div.popup-mask>` (ref=o1; click it directly…)*）。エージェントは代わりにその要素をクリックできます。ヒットテストでは、SDK 自身の UI とほかのデバッグツール（`.__chobitsu-hide__`、`#eruda`、`#__pageSpy`、`#__vconsole`）を無視します。
- **オーバーレイ。** ポップアップの背景マスク、モーダル、ボトムシートなど、ページの上にレイヤーが浮いている場合、スナップショットの末尾に `[Overlays]` セクションが付きます。ビューポートのいくつかの点でヒットテストを行い、fixed（またはビューポートサイズの absolute）のボックスに収まっていて、ビューポートの 15% 以上を覆い、かつスナップショットの要素の半数を自身が含んでいないもの（含んでいればそれは上に乗ったレイヤーではなく、アプリ自体のルート）を残します。各行には要素のタグ、（除去済みの）テキストの最初の数語、ビューポートに占める割合、`ref` が示されます。テキストもメディアもないレイヤーは背景マスクとして記載されます。空の背景マスクは aria スナップショットにノードがないため `oN` の ref が付きます。これにより、エージェントは背景マスクをタップしてポップアップを閉じられます。
- **合成入力。** クリックでは `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click` を発火し、タッチデバイスではタッチイベントも発火します。これらのイベントは `isTrusted: false` なので、これを確認するページは反応しません。
- **フィードバック。** 入力を発火する前に、対象が一瞬ハイライトされ、ページ上のエージェントのカーソルがそこへ移動します。
- **マスク。** `input[type=password]`、`data-rwd-mask` を持つ要素、プロジェクトの `maskSelectors` の値は、スナップショットとスクリーンショットで `••••` に置き換えられます（ネイティブのスクリーンショットでは灰色のボックスで覆われます）。これらの値と `maskPatterns` に一致するテキストは、console のテキスト、ネットワークの URL とボディ、ストレージの値、イベントの要約でも置き換えられます。
- **スナップショットの範囲。** スナップショットのルートは `<body>` です。SDK の UI は `<html>` の下、`<body>` の外にある Shadow DOM にあります。eruda、PageSpy、vConsole のノードはスナップショットから取り除かれます。
- **バッファー。** console、捕捉されなかったエラー、ネットワーク（XHR、fetch、WebSocket、sendBeacon、EventSource）は、SDK が読み込まれた時点から、それぞれ 500 件のリングバッファーに記録されます。いっぱいになると、通常のログと成功したリクエストから先に破棄され、その件数を `dropped` で数えます。レスポンスボディは合計 5 MB、1 件あたり 64 KB までキャッシュされます。

### 5.4 セッションログ

[§5.3](#53-ページ内での動作) のバッファーは 1 つのページのメモリーにあります。**セッションログ**はその長期版で、アプリの起動以降にこのオリジンで起きたことすべてを、オリジン内のすべてのページが、ゲートウェイに届くかどうかに関係なく **IndexedDB**（データベース `rwd-log`）に書き込みます。そのため、後からアタッチしたエージェントでも、リロードやページをまたいで不具合に至るまでの経緯をすべて読めます。アタッチ中のエージェントが要求しない限り、ログがデバイスの外に出ることはありません。

**1 つのセッションはアプリの 1 回の起動です。** ID は次の順で決まります。

1. `run({ launchId })`: ホストアプリ自身の起動 ID。コールドスタートのたびに生成され、そのプロセスのすべての WebView で共通です。
2. `window.RWDLaunchId`: ホストまたは組み込み用スニペットが定義できます。文字列、または文字列（あるいは文字列の Promise。最大 300 ミリ秒待ちます）を返す関数です。
3. SDK による推定: セッション Cookie `rwd_launch`（有効期限なしなので、アプリのプロセスとともに消えます）と 10 秒ごとのハートビートです。**1 時間**を超えて音沙汰のない Cookie セッションは以前の起動とみなし、新しい ID を始めます。これにより、起動をまたいでセッション Cookie を保持する WebView にも対応します。

セッションの `source` はどれだったかを示します。1 と 2 は `app`、3 は `cookie` です。

**記録される内容。** 各レコードは `seq`（キー、増加する）、`at`、`kind`、`page`（書き込んだページの `pageId`）、`data` を持ちます。

| `kind` | `data` |
|---|---|
| `page` | `event: "open"`（url、title、referrer）、`"nav"`（from、url、title。ページ内遷移も含む）、`"visibility"`（フォアグラウンド / バックグラウンド）、`"hide"`（ページが離れた） |
| `action` | ユーザー自身の（信頼された）入力: `"tap"`（要素の説明）、`"input"`（フィールドの説明と値）、`"submit"`、`"scroll"`（スクロールが止まった位置）。パスワードフィールド、`data-rwd-mask` 要素、`maskSelectors` に一致する要素の値は `••••` として保存され、平文では決して保存されない。その他の値は `maskPatterns` で除去され、200 文字で切り詰められる |
| `agent` | エージェントの操作系の呼び出しと `rwd.evaluate`: メソッド、`ref`、キー、url、値、テキスト、失敗した場合はエラー。読み取り（スナップショット、一覧）は含まない |
| `control` | エージェント名付きの制御状態の変化（[§4](#4-制御状態)） |
| `console` | すべてのレベル。`type`、`text`、`source` 付き |
| `net` | 完了したすべてのリクエスト: method、url、status、type、所要時間、サイズ、エラー。**失敗した**リクエストは、さらに `reqHeaders` / `resHeaders`（`rwd.networkDetail` と同様に伏せ字）と `reqBody` / `resBody`（それぞれ 64 KB で切り詰め）を持つ |

console のエラーと警告、失敗したリクエスト、ユーザーのタップ・入力・送信、エージェントの操作、制御の変化は重要としてマークされ、最も長く保持されます。`problems` と `overview` が選び出す*問題*とは、console のエラーと失敗したリクエストのことです。

**上限。** 直近 **3** 回の起動分を、それぞれ **10 MB** 以内で保持します。超えた場合は、重要でない古いレコード（通常の console ログ、成功したリクエスト）から先に、次にすべての中で古いものから、上限の 80% まで破棄し、その件数を `trimmed` で数えます。`navigator.storage.estimate()` が報告する容量が 64 MB 未満の場合は、現在の起動分だけを保持します。IndexedDB がない場合（一部のプライベートモードなど）は何も記録されず、`rwd.log` は `internal` で失敗します。

**読み取り方。** `rwd.log` は `op` を受け取ります。

```jsonc
// op: "sessions" → 保存されているすべての起動分。新しい順
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview"、params {"session"?} → 1 回の起動分の概要
{"session":{…meta…,"current":true},"first":<ms>,"last":<ms>,
 "pages":[{"at","page","data"}],      // ページの open / nav レコード、直近 60 件
 "problems":[…records…]}              // console のエラーと失敗したリクエスト、直近 20 件

// op: "records"、params {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                       "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                       "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // 次のページを読むには `after` に渡す
 "hidden":0}                          // ネットワークの除外ルールで隠されたリクエスト数（§11）
```

- `session` のデフォルトは現在の起動です（`"current"` も同じ意味）。不明な ID は `not_found` で失敗します。記録中の起動がない場合は、保存されている最新のものが使われます。
- `problems: true` は console のエラーと失敗したリクエストだけに絞ります。`text` はレコードの `data` に対する大文字小文字を区別しない部分一致です。`limit` は 1〜500、デフォルトは 100 です。
- レコードはヘッダーとボディを**含まずに**返ります。ボディがある場合は `data.hasBody` が `true` です。`rwd.logDetail` はその 1 レコードを完全な形で返し、`rwd.networkDetail` と同じく `advanced`（[§6](#6-アクセスレベル)）が必要です。
- ネットワークの除外ルールはここでも適用されます。ルールに一致する `net` レコードは、`includeExcluded` を指定しない限り `records` から除外され、`hidden` で数えられます。

**オフにするには。** `run({ record: false })` は、そのページだけ書き込みを止めます。`policy.sessionLog: false`（[§11](#11-プロジェクトポリシー)）は `welcome.config.sessionLog` としてページに届き、記録を止めて、**そのオリジンに保存済みのログを削除します**。`status().logSession` は、ページが書き込み中のセッション ID で、記録していない場合は `null` です。

## 6. アクセスレベル

| レベル | 許可されるメソッド |
|---|---|
| `observe` | `rwd.ping`、`rwd.snapshot`、`rwd.query`、`rwd.screenshot`、`rwd.console`、`rwd.network`、`rwd.waitFor`、`rwd.log` |
| `interact` | `observe` + `rwd.click`、`rwd.fill`、`rwd.type`、`rwd.press`、`rwd.select`、`rwd.hover`、`rwd.scroll`、`rwd.drag`、`rwd.navigate`、`rwd.back`、`rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`、`rwd.networkDetail`、`rwd.storage`、`rwd.logDetail` |

アタッチのレベルは次のように決まります。

```
min(エージェントが要求したレベル（デフォルト interact）,
    API キーの maxLevel,
    マージ後のプロジェクトポリシーの maxLevel,
    ユーザーがデバイス上で選んだレベル)
```

両側でこれを強制します。ゲートウェイはレベルを超える呼び出しを拒否し（エラー `forbidden`、監査 `policy.denied`）、SDK も実行前に `welcome.level` / `control.level` で再確認します。ゲートウェイは不明なメソッドを `advanced` として扱います。エージェントがアタッチしているのにゲートウェイがレベルを送ってこない場合、SDK は `interact` とみなします。

## 7. アタッチの承認

エージェントが `connect_device` を呼び出すと、ゲートウェイはそのデバイスで開いているページのプロジェクトのポリシーをマージします（[§11](#11-プロジェクトポリシー)）。マージ後の `approval` が `prompt` なら、ユーザーがデバイス上で承認する必要があります。

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"Support Bot","keyHint":"…a91f"},
   "levels":["observe","interact"],   // 提示するレベル。キーとポリシーで上限が決まり、最後がエージェントの要求したレベル
   "expiresInSec":30}
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // 拒否するときは "level": null
← {"t":"attach_cancel","requestId":"…"}                         // タイムアウト、またはエージェントが取り下げた
```

- 要求はデバイスの**フォアグラウンドページ**に送られ、`attach_cancel` はすべてのページに送られます。
- **30 秒**以内に応答がなければタイムアウトとみなします。MCP の呼び出しは応答を待ちます。
- 同じ API キーが同じデバイスで 10 分以内に **3 回**拒否されると、そのキーからそのデバイスへの要求は **10 分間**、確認なしで拒否されます。
- 保留できる要求はデバイスごとに 1 つだけです。
- SDK のダイアログは Shadow DOM の中にあり、信頼されたタップしか受け付けず、表示から 0.4 秒後に有効になります。そのため、エージェントが自分で承認することはできません。同じオリジンのタブは BroadcastChannel で判断を共有します。
- ユーザーは SDK のフローティングウィンドウで、上限レベルを指定して**自動許可**をオンにできます。その場合 SDK は、その上限内で提示された最も高いレベルで即座に応答し、通知を表示します。
- `run({ nativeApproval: true })` の場合、SDK はダイアログを表示しません。代わりに `status().pending` が `{kind:"attach", requestId, agent:{name, keyHint}, levels, expiresAt}` になり、ネイティブホストが `nativeDecide(nativeKey, requestId, level | null)` で応答します。
- 承認されると、ゲートウェイはエージェントをアタッチし（そのデバイスにいたほかのエージェントは置き換えられます）、サポート依頼を解除して（`{"t":"help","on":false}`）、`{"t":"control","state":"observe","agent":{…},"level":"interact","attachedMs":0}` を通知します。ページはすぐにロックされます（[§4](#4-制御状態)）。

`approval: none` の場合、エージェントは算出されたレベルですぐにアタッチします。

**再確認なしで戻ってくる。** エージェントが自分からデバイスを離れた場合（`disconnect_device`、別のデバイスへの接続、または `policy.attachMaxMinutes` の期限切れ）、許可が残ります。**10 分間**は、同じ API キーがそのデバイスに再びアタッチしても端末にダイアログは表示されず、レベルは**前回ユーザーが許可したレベルが上限**になります（`observe` で承認された後に `advanced` を要求しても `observe` のままです）。それ以外の制限は緩和されません。キー、ポリシー、エージェント自身の要求は引き続きレベルの上限となり、デバイスには接続中のページが必要です。このようなアタッチは、通常の `attach.start` に加えて `attach.resume` として監査され（[§12.7](#127-監査ログ)）、ページには `attach_request` ではなく通常の `control` メッセージが届きます。

戻ってきても許可は消費されません。もう一度離れると、新たに 10 分間の枠が始まります。セッションがそれ以外の理由で終わった場合、許可は破棄されます。ユーザーがデバイスで**終了**をタップした、管理コンソールのメンバーが終了した（`POST /devices/:id/end`）、API キーが失効した、別のエージェントがそのデバイスにアタッチしてこのエージェントを置き換えた、ユーザーが要求を拒否した、のいずれかです。また、許可はメモリー上に保持されるため、ゲートウェイのプロセスが終了すると失われます。

## 8. センシティブな操作の確認

エージェントが次の操作をしようとすると、SDK は実行前にユーザーに確認します。

- `[data-rwd-confirm]` またはポリシーの `confirmSelectors` に一致する要素、あるいはその内側にある要素をクリック（`rwd.click`）する。
- そのような要素の上、またはそのような要素を含むフォーム内で Enter を押す（`rwd.press`、または `submit: true` 付きの `rwd.type`）。ただし、テキストエリアやリッチテキストエディター内は除きます。

ダイアログは *AI wants to click "Place order". Allow?* のような文面で、信頼されたタップしか受け付けず、**30 秒**で期限切れになります。拒否またはタイムアウトの場合、RPC は `{"code":"forbidden","message":"The user denied this action"}` で失敗します。同時に開ける確認は 1 つだけで、ユーザーが引き継いだ、エージェントが離れた、接続が切れた、のいずれかでキャンセルされます。

`nativeApproval: true` の場合、`status().pending` は `{kind:"confirm", requestId, action:'click "Place order"', expiresAt}` になり、ホストが `nativeDecide(nativeKey, requestId, "allow" | null)` で応答します。`status().pending` では、保留中の確認が保留中のアタッチ要求より優先されます。

## 9. プレゼンスポーリングによるフォールバック

WebSocket が 3 回続けて失敗すると、SDK は代わりに 60 秒ごとに `POST /v1/presence` を呼び出します。JSON のボディを `Content-Type: text/plain` で送るので、CORS のプリフライトは不要です。ゲートウェイは `Access-Control-Allow-Origin: *` で応答します。

```jsonc
// リクエスト
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// レスポンス
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- ゲートウェイが使うのは `key`、`deviceId`、`userId`、`device.{ua, platform, app}`、`deviceToken`、`help` で、`pageId` と `page` は参考情報です。アプリキーとオリジンは WebSocket と同様に確認され、レート制限も同じです。
- デバイストークンを発行済みのデバイス（[§3.5](#35-デバイストークン再開トークン招待)）は、ここでもトークンを送る必要があります。送らない場合、呼び出しは `401 bad_token` で失敗し、デバイスの情報は何も更新されません。トークンを持たないデバイス（古い SDK）は、トークンなしでポーリングを続けます。
- `help: true` は、`hello.help` と同様にデバイスをサポート依頼中にします。ただし、すでにエージェントがアタッチしている場合は除きます。
- ポーリング中のデバイスは、呼び出しのたびに 90 秒間オンラインとみなされます。
- `connect: true` は、ページに今すぐ WebSocket を開くよう伝えます。エージェントがそのデバイスに対して `connect_device` または `wait_for_device` を呼び出したときに、ゲートウェイがこれを設定します。
- 念のため、SDK は 5 回目のポーリングごとにも WebSocket を再試行します。

## 10. ホスト向け JavaScript API

SDK は `window.RemoteWebviewDebugger` を公開します。ページは `run()` を呼び出し、ネイティブホストは SDK を注入して追加のオプション付きで `run()` を呼び出します（[native-integration.ja.md](native-integration.ja.md) を参照）。

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null: ログイン中のユーザー。エージェントと管理コンソールに表示される
  helpButton,            // 「サポートを依頼」ボタンを表示する（ポリシーの helpButton と OR を取る）
  app,                   // ホストアプリの { name, version }
  lang,                  // 端末のユーザー向け UI の言語タグ。デフォルトは navigator.languages から（§15）
  locales,               // 追加の言語パック。messages：言語ごとの上書き（§15）
  theme,                 // 'auto'（デフォルト）| 'system' | 'light' | 'dark'
  style,                 // 色、フォント、角丸、z-index、位置を --rwd-* CSS プロパティとして指定（sdk/README.ja.md を参照）
  lockScreen,            // エージェントのアタッチ中は入力をブロックする（デフォルト true。ユーザーが変更可能）
  eruda,                 // true | { dock, load, src, name }: eruda 内のタブとして表示する
  networkExclude,        // エージェントが読む内容から除外するリクエスト（§11）
  record,                // セッションログを記録する（デフォルト true。ポリシーでオフにできる、§5.4）
  // ネイティブホスト向け
  deviceId,              // インストールごとに 1 つの ID。すべての WebView とドメインで共有
  deviceToken,           // status().deviceToken のトークン。ホストが保持する
  launchId,              // アプリの今回の起動。プロセス内のすべての WebView で共有（§5.4）
  nativeKey,             // ホストだけが知る秘密。nativeControl / nativeDecide を有効にする
  nativeApproval,        // アタッチ / 確認の問い合わせをホスト自身が表示する
}) // → Promise<{ deviceCode, status }>
```

| 関数 | 説明 |
|---|---|
| `run(gatewayUrl, appKey, options?)` | ページをオンラインにする。ゲートウェイが応答した時点、または 8 秒後にその時点で分かっている内容で resolve する。再度呼び出すと同じ Promise を返す |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`。`status` は `idle`、`connecting`、`online`、`polling`、`rejected`、`quota`、`stopped` のいずれか。`logSession` はこのページが書き込むセッションログで、記録していない場合は `null`（[§5.4](#54-セッションログ)） |
| `help(on = true)` | サポートを依頼する、または依頼を取り消す |
| `setUser(userId)` | ログイン中のユーザーを変更する（SDK は新しい `hello` で再接続する） |
| `stop()` | 切断して UI を取り除く。console とネットワークのキャプチャーは上限付きで続く |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | ネイティブホスト独自の制御ボタン。キーが一致しなければ `false` を返す |
| `nativeDecide(nativeKey, requestId, value)` | `status().pending` に応答する。`attach` にはレベルまたは `null`、`confirm` には `'allow'` または `null`。キー、リクエスト、値が誤っていれば `false` を返す |

**起動 ID。** `run({ launchId })` のほかに、ホストは SDK の実行前に `window.RWDLaunchId` を定義できます。文字列、または文字列か文字列の Promise を返す関数（最大 300 ミリ秒待ちます）です。`[A-Za-z0-9_.:-]` の 4〜128 文字である必要があり、それ以外は無視されて SDK が起動を自分で推定します（[§5.4](#54-セッションログ)）。

`nativeKey` は注入スクリプトにだけ書き込まれ、定数時間で比較されます。ページのスクリプト（エージェントの `evaluate_script` を含む）はこれを読めないので、制御を返したり自分で承認したりすることはできません。

**ネイティブのスクリーンショットブリッジ。** ホストがこれらのいずれかを登録すると、`rwd.screenshot` はそれを使って実際のピクセル（動画、canvas、クロスオリジンの画像、ネイティブのオーバーレイを含む）を取得します。いずれも、表示中の WebView の PNG または JPEG の data URL、あるいは素の base64 を返します。

| ブリッジ | プラットフォーム |
|---|---|
| `window.RWDNativeScreenshot()` | 任意のホスト。`string` または `Promise<string>` を返す |
| `webkit.messageHandlers.rwdScreenshot` | iOS / macOS の `WKWebView`。`WKScriptMessageHandlerWithReply` として登録し、`{type:"screenshot"}` を受け取る |
| `window.RWDAndroid.screenshot()` | Android。`@JavascriptInterface` メソッド |

リファレンス実装: [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift)

## 11. プロジェクトポリシー

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt: アタッチのたびにユーザーがデバイス上で承認する（デフォルト prompt）
  maxLevel: Level                  // このプロジェクトの最高レベル（デフォルト interact）
  maskSelectors: string[]          // 追加でマスクする CSS セレクター（パスワードフィールドと [data-rwd-mask] のほかに）
  maskPatterns: { name: string; regex: string }[]  // マスクするテキストのパターン。電話番号や ID 番号など（JavaScript の正規表現）
  confirmSelectors: string[]       // クリックにユーザーの許可が必要な要素（[data-rwd-confirm] のほかに）
  networkExclude: string[]         // エージェントが読む内容から除外するリクエスト（§5.2）
  sessionLog: boolean              // ページがセッションログを記録する（デフォルト true、§5.4）
  helpButton: 'off' | 'all' | 'listed'   // 「サポートを依頼」ボタンを表示する対象（デフォルト off）
  helpUsers: string[]              // helpButton = listed のときの userId
  agentIdleMinutes: number         // この時間操作がなければ agent → observe（デフォルト 2、最大 120）
  attachMaxMinutes: number         // アタッチはこの時間で終了する（デフォルト 60、最大 1440）
  maxOnlineDevices: number         // 0 = 無制限。超えると新しいデバイスは 4429 で切断される
  maxAgents: number                // このプロジェクトのデバイスに同時にアタッチできるエージェント数。0 = 無制限
  eruda: { dock: boolean; load: boolean }  // run({ eruda }) のリモートのデフォルト。ローカルのオプションがフィールド単位で優先される。
                                           // welcome.config では null や欠落の場合がある（= 両方 false）、§3.4
}
```

- 値は保存時に正規化されます。`none` 以外の `approval` は `prompt` に、無効な `maxLevel` は `interact` になり、数値は範囲内に丸められます。`maskPatterns` はコンパイルできる必要があり、できなければ `400 bad_policy` です。`maskSelectors`、`confirmSelectors`、`networkExclude`、`helpUsers` は空の項目が取り除かれ、それぞれ 50 件まで、`maskPatterns` は 20 件までに切り詰められます。
- **`networkExclude`** は、常に 404 になるフォントや解析用ビーコンなど、エージェントが読まずに済ませたいノイズです。各ルールはリクエスト URL に対して、大文字小文字を区別しない部分一致、`*` ワイルドカードのパターン（`*/404/*`）、または `/…/` と書いた場合は正規表現（フラグは任意、デフォルトは `i`）として照合されます。コンパイルできないルールは何にも一致しません。一致したリクエストはネットワーク一覧と `net_fail` のタイムラインイベントから除外されますが、ページは記録を続けるので、エージェントは `includeExcluded` で取得できます（[§5.2](#52-メソッド)、[§14.3](#143-ツール)）。これは利便性のための機能であり、プライバシーを守る仕組みではありません。ページの外に出してはいけないデータには `maskSelectors` / `maskPatterns` を使ってください。
- **`sessionLog`** は、`false` に設定しない限りオンです。このフィールドができる前に保存されたプロジェクトも同様です。オフにすると、プロジェクトのすべてのページで記録が止まり、それらのデバイスでそのオリジンについて保存済みのログが削除されます。個々のページは `run({ record: false })` で単独でオプトアウトできます（[§5.4](#54-セッションログ)）。
- マスク、確認、ネットワーク除外、セッションログ、サポート依頼、eruda のフィールドは `welcome.config`（[§3.4](#34-welcome)）でページに届きます。ページ自身の `run({ networkExclude })` のルールは、プロジェクトのルールに追加されます。
- **1 台のデバイスに複数のプロジェクト。** デバイスはプロジェクトではなく `deviceId` で識別されます。同じ端末で異なるアプリキーを使って読み込まれたページは、1 台のデバイスのページです。エージェントがアタッチするとき、ゲートウェイは接続中のページのプロジェクトのポリシーをマージし、最も厳しい値を採用します。いずれかのプロジェクトが求めていれば `prompt`、`maxLevel`、`agentIdleMinutes`、`attachMaxMinutes` は最小値、`maxAgents` は 0 以外の最小値です。

## 12. 管理コンソール REST API

### 12.1 規約

- ベースパスは `/v1/api` です。`POST /auth/login` でサインインし、セッションは HttpOnly Cookie の `rwd_session`（12 時間、`SameSite=Lax`、HTTPS では `Secure`）です。アカウントはリクエストのたびに読み直されるので、メンバーの無効化や削除はすぐに反映されます。
- セッションが必要なエンドポイントへの `GET` / `HEAD` 以外のリクエストには `X-RWD-CSRF: 1` が必要で、ない場合は `403 csrf` になります。
- エラーは 4xx/5xx のステータスとともに `{"error":{"code":"…","message":"…"}}` の形で返ります。メッセージはリクエストの言語に従います（[§15](#15-言語)）。
- 主なコード: `401 unauthorized`（未サインイン）、`403 forbidden`（ロールの権限不足）、`403 csrf`、`404 not_found`、`400 bad_request`、`429 rate_limited`、`500 internal`。

ロール: `owner`（メンバー管理を含むすべて）、`admin`（プロジェクト、キー、ポリシー、デバイス、招待、監査）、`member`（プロジェクトとデバイスの閲覧、接続テスト、セッションの終了、デバイス招待の作成、監査ログの閲覧）。以下の表で *member* は、サインイン済みの任意のアカウントを指します。

### 12.2 アカウントとメンバー

| メソッド | パス | ロール | リクエスト | レスポンス |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}` と Cookie。`401 bad_password`。IP ごとに 1 分あたり 10 回を超えると `429 rate_limited`。`email` が空の場合は `admin` とみなす |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`。新しいパスワードは 8〜256 文字。古いパスワードが誤っていれば `400 bad_password` |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity"}` |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<host>/invite/<token>"}`（7 日間有効、1 回限り）。メールアドレスが既存なら `409 conflict` |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`。有効な owner がいなくなる場合は `409 last_owner` |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`。`409 self`、`409 last_owner` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}` を返してサインインする。レート制限はログインと同じ |

最初の owner は、起動時に `RWD_ADMIN_EMAIL`（デフォルト `admin`）と `RWD_ADMIN_PASSWORD` から作成されます（[gateway/README.ja.md](../gateway/README.ja.md) を参照）。メンバー招待は管理コンソールのページ `/invite/:token` で受け付けます。

### 12.3 プロジェクト

| メソッド | パス | ロール | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project`（デフォルトのポリシー付き） |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`。`policy` は現在のポリシーにマージされる |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | 新しいアプリキーを持つ `Project` |
| GET | `/projects/:id/integration` | member | — | `Integration` |

`allowedOrigins` の各項目は `https://m.example.com` のような完全なオリジンで、先頭のラベル 1 つだけワイルドカードにできます。`https://*.example.com` は任意のサブドメインに一致しますが、`https://example.com` 自体には一致しません。空の場合は任意のオリジンを許可します。`inviteUrl` は `http(s)` の URL である必要があります。

### 12.4 API キー

API キーはプロジェクトではなくゲートウェイに属します。1 つのキーですべてのデバイスにアクセスできます。

| メソッド | パス | ロール | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/keys` | member | — | `{"keys":[ApiKey]}` |
| POST | `/keys` | admin | `{"name","maxLevel"?:"interact","expiresInDays"?:90,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}`: キー全体が返るのはこのときだけ |
| DELETE | `/keys/:id` | admin | — | `{"ok":true}`。失効は即時で、そのキーのエージェントはデタッチされ、次の MCP リクエストは 401 になる |

`expiresInDays: 0` は無期限を意味します。`ipAllowlist` には IP または CIDR を指定し、設定するとほかのアドレスからの MCP リクエストは 401 になります。`GET` / `POST /projects/:id/keys` は `/keys` の旧エイリアスです。

### 12.5 デバイスとゲートウェイのステータス

| メソッド | パス | ロール | レスポンス |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}`（`pageSize` ≤ 100）。`online`（デフォルト）: オンラインのデバイス、接続が新しい順。`all`: 既知のすべてのデバイス、新しい順。どちらのモードでも `q` はデバイス ID、デバイスコード（ハイフンは任意）、userId、ユーザーエージェント、システムラベル（どちらの言語でも）、プロジェクト名に一致する |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}`: 最新のページがそのプロジェクトのものであるデバイス（デフォルト `all`、最大 500）。サポート依頼中、オンライン、最終確認が新しい順。`waiting` はサポート依頼中（表示は「対応中」）を意味する |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | 常に `200`: `{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<first 4000 characters>","error"?:{"code","message"}}`。コード: `device_offline`、`no_page`（ページが再接続中）、`timeout`、`takeover`、`internal`、および [§5.1](#51-エンベロープ) の RPC コード |
| POST | `/devices/:id/end` | member | `{"ok":true}`: エージェントをデタッチし、サポート依頼を解除し、制御を `none` に戻す |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |

### 12.6 デバイス招待

招待を使うと、ユーザーはリンクを開くだけで、サポート依頼中の状態でデバイスをオンラインにできます。デバイスコードを読み上げてもらう必要はありません。

| メソッド | パス | ロール | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}`（`link` はトークンを含まない対象 URL。トークンは保存されない） |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | 完全な `link`（`<url>?rwd_invite=<token>`）を持つ `DeviceInvite` |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url` のデフォルトはプロジェクトの `inviteUrl` で、どちらか一方が必要です。`expiresInMinutes` の上限は 7 日です。リンク先のページは、同じプロジェクトのアプリキーで SDK を読み込む必要があります（[§3.5](#35-デバイストークン再開トークン招待)）。

### 12.7 監査ログ

`GET /audit?project=&device=<device code>&actor=&action=&from=&to=&limit=50&before=<id>`（member）→ `{"events":[AuditEvent],"nextBefore":<id>|null}`、新しい順。`limit` ≤ 200。`action` は前方一致です（`attach.` はすべてのアタッチイベントに一致）。`actor` は操作者の ID または名前に一致します。

| アクション | タイミング |
|---|---|
| `auth.login`、`auth.login_failed` | 管理コンソールへのサインイン |
| `member.invite`、`member.accept`、`member.update`、`member.delete` | メンバー管理 |
| `project.create`、`project.update`、`project.delete`、`project.rotate_app_key` | プロジェクト |
| `key.create`、`key.revoke` | API キー |
| `invite.create`、`invite.delete`、`invite.use` | デバイス招待 |
| `attach.request`、`attach.approve`、`attach.deny`、`attach.timeout`、`attach.resume`、`attach.start`、`attach.end` | エージェントのアタッチ。`attach.resume` は、キーが再確認なしで猶予期間内に戻ってきたことを示す（[§7](#7-アタッチの承認)）。`detail: {level}` |
| `rpc` | エージェントからのすべてのページ RPC。`detail: {method, page, latencyMs, error?}` |
| `control.takeover`、`control.handback`、`control.end` | ユーザーのボタン操作 |
| `device.end` | 管理コンソールのメンバーがセッションを終了した |
| `policy.denied` | 許可されたレベルを超える呼び出しが拒否された |

イベントにページの内容やパラメーターの値が含まれることはありません。デフォルトでは 180 日間保持されます（`RWD_AUDIT_RETENTION_DAYS`）。

### 12.8 型

```ts
type Project = {
  id: string; name: string; appKey: string; allowedOrigins: string[]; disabled: boolean
  createdAt: number; policy: Policy; inviteUrl: string
  onlineDevices: number; totalDevices: number
}

type ApiKey = {
  id: string; name: string; prefix: string /* rwd_sk_live_ab12 */
  maxLevel: Level; expiresAt: number | null; ipAllowlist: string[]
  createdAt: number; lastUsedAt: number | null; revokedAt: number | null
}

type Integration = {
  appKey: string; gatewayUrl: string; sdkUrl: string
  firstSeenAt: number | null; onlineDevices: number; lastDevice: Device | null
}

type Device = {
  id: string /* deviceId */; code: string
  projectId: string            // 最新のページのプロジェクト
  projects: string[]           // 接続中のページのプロジェクト
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* オンラインになった時刻。オンラインの間のみ */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; expiresAt: number } | null
  task?: Task                  // アタッチ中のエージェントがタスクを設定している間のみ
  pages: number                // 接続中のページ数
  sdk: string                  // ページが報告した SDK のバージョン
  currentPage: { label: string; url: string; title: string } | null  // ユーザーが見ている可能性が最も高いページ
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // GET /devices のみ
}

type SystemInfo = {            // ユーザーエージェントから解析
  os: string; osVersion: string; model: string; browser: string
  label: string                // 例: "iOS 18.0 · iPhone · WebView"、"Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // ユーザーが見ている可能性が最も高いページ
  selected: boolean            // エージェントが操作対象にしているページ
  openerLabel: string | null; connectedAt: number
}

type TimelineEvent = { at: number; page: string /* ラベル。デバイス全体のイベントは "" */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // 件数の代わりにページの一覧
  timeline: TimelineEvent[]    // 最新 100 件、古い順
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* 招待がまだ受け入れられていない */
  createdAt: number; lastLoginAt: number | null
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* デバイスコード、キーの prefix、メンバーのメールアドレス… */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}
```

### 12.9 タイムラインイベント

各デバイスは直近 300 件のタイムラインイベントをメモリーに保持します。管理コンソールは最新 100 件を、MCP はデフォルトで最新 50 件を表示します。

| `kind` | 意味 |
|---|---|
| `opened` / `closed` | ページが初めて接続した / 猶予期間を過ぎて消えた（[§3.1](#31-ライフサイクル)） |
| `navigated` / `reloaded` | ページが新しい URL に移動した / 同じ URL で再接続した |
| `focus` | ページがフォアグラウンドになった |
| `error` / `console_error` / `net_fail` / `user_tap` | ページから報告されたイベント（[§3.2](#32-ページ--ゲートウェイ)） |
| `help` | ユーザーがサポートを依頼した、依頼を取り消した、または招待から来た |
| `agent` | アタッチ要求、拒否、タイムアウト、アタッチ、タスクの変更 |
| `control` | 制御状態の変化。summary に理由が入る（ユーザーが引き継いだ、AI がアイドル、ユーザーが終了した、…） |
| `offline` | エージェントのアタッチ中に、デバイスの最後のページが消えた |

## 13. ライブ更新（SSE）

`GET /v1/api/stream[?project=<id>][&lang=<tag>]`（member、Cookie 認証）は `text/event-stream` をストリーミングします。

```
retry: 3000

event: device     data: Device                               デバイスが変化した（オンライン、サポート依頼、制御、承認、タスク…）
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   25 秒ごと
```

`project` を指定しない場合は、すべてのプロジェクトのイベントが流れます。`EventSource` はヘッダーを設定できないので、言語は `?lang=` で指定します。処理の遅い購読者は、ゲートウェイを止める代わりにイベントを取りこぼします。管理コンソールは再接続時にデータを取得し直し、ストリームが使えない場合はポーリングに切り替えます。

## 14. MCP

### 14.1 セッション

- エンドポイントは `/v1/mcp`（Streamable HTTP）です。すべてのリクエストに `Authorization: Bearer <API key>` が必要です。キーはリクエストのたびに確認されるので、失効または期限切れのキーや、`ipAllowlist` 外のアドレスからのリクエストは、すぐに 401 になります。
- ゲートウェイは API キーごとにエージェントの状態（アタッチ中のデバイスと選択中のページ）を 1 つ保持します。同じキーを使う MCP セッションはこれを共有します。エージェントが同時にアタッチできるのは 1 台のデバイスだけで、別のデバイスに接続すると最初のデバイスからはデタッチされます。1 つのキーでゲートウェイ上のすべてのデバイスにアクセスできます。
- 1 つのキーでデバイスの検索に 1 分あたり 5 回を超えて失敗すると、その 1 分間の残りは拒否されます。これにより、デバイスコードの推測を防ぎます。

### 14.2 結果

すべてのツールの結果の末尾には、エージェントの前回の呼び出し以降にデバイスで変化した内容（最大 20 行）が付きます。そのため、エージェントはポーリングしなくても新しいページ、遷移、エラー、引き継ぎに気付けます。

```
[Session changes]
- p3 "Checkout" opened (opened by p2)
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- The user took over
```

ページから来た内容（スナップショット、console、ネットワーク、ストレージ、evaluate の結果、タイムライン）はタグで囲まれ、信頼できないデータであることが明示されます。そのため、エージェントはその中に書かれた指示に従いません。

### 14.3 ツール

| ツール | レベル | パラメーター | 説明 |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all`（デフォルト `online`）、`userId?`、`deviceCode?`（大文字小文字を問わず、ハイフンの有無も問わない） | 最大 50 台のデバイス。サポート依頼中のものが先頭 |
| `connect_device` | — | `device`（デバイスコードまたは deviceId）、`level?: Level`（デフォルト `interact`）、`follow?: true` | アタッチする。必要ならまずユーザーに確認する（[§7](#7-アタッチの承認)）。自分からデバイスを離れてから 10 分以内なら、同じキーは再確認なしで、そのとき許可されたレベルを上限として戻れる。フォアグラウンドのページを選択する。デバイスに接続中のページがなければ失敗する（ポーリング中のデバイスには再接続を促す） |
| `disconnect_device` | — | — | デタッチする |
| `wait_for_device` | — | `device`、`timeoutSec?: 60`（最大 300） | デバイスに接続中のページができるまで待つ。ポーリング中のデバイスには再接続を指示する |
| `list_pages` | — | — | デバイスのページ: ラベル、タイトル、URL、選択中かどうか、フォアグラウンド / バックグラウンド、再接続中かどうか、開いたページ |
| `select_page` | — | `page`（ラベル） | 選択中のページを変更する |
| `take_snapshot` | observe | `page?` | ref 付きのアクセシビリティスナップショット。ページの上に浮いているオーバーレイとその ref も含む（[§5.3](#53-ページ内での動作)） |
| `find_elements` | observe | `text?`、`role?`、`name?`、`limit?`、`page?` | スナップショット全体を取らずに要素とその ref を探す（`rwd.query`） |
| `take_screenshot` | observe | `page?`、`fullPage?`、`format?: jpeg\|png` | 画像を返す |
| `wait_for` | observe | `text?`、`textGone?`、`timeSec?`（最大 30） | 選択中のページで待つ |
| `list_console_messages` | observe | `scope?: page\|session`、`types?`、`limit?: 50` | `session` は接続中のすべてのページをまとめ、各行にページを示す |
| `list_network_requests` | observe | `scope?`、`failedOnly?`、`limit?: 50`、`exclude?`、`includeExcluded?` | 同上。ID は `<label>:<id>` の形で表示される。`exclude` は、プロジェクトとページのルール（[§11](#11-プロジェクトポリシー)）に加えて、この呼び出しだけのルールを追加する。ルールで隠されたものがあると結果の末尾に *N requests hidden by the exclude rules* と表示され、`includeExcluded: true` で表示できる |
| `click` / `hover` | interact | `ref` | オーバーレイに阻まれたクリックは `not_interactable` で失敗し、覆っている要素の `ref` が示される。代わりにそれをクリックできる（[§5.3](#53-ページ内での動作)） |
| `fill` | interact | `ref`、`value` | |
| `type_text` | interact | `text`、`ref?`、`submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`、`values` | |
| `scroll` | interact | `ref?`、`dx?`、`dy?`（デフォルト `dy: 600`） | |
| `drag` | interact | `fromRef`、`toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]`（1〜30）、`stopOnError?: true` | `click`、`fill`、`type_text`、`press_key`、`select_option`、`hover`、`scroll`、`wait_for` を順に実行し、まとめて 1 つの結果を返す |
| `get_network_request` | advanced | `id`（一覧の `<label>:<id>`、または選択中のページなら素の ID） | ヘッダーとボディ |
| `get_storage` | advanced | `area: local\|session\|cookie`、`page?` | |
| `evaluate_script` | advanced | `function`、`args?`、`page?` | ページ内で JavaScript を実行する。20,000 文字を超える結果は切り詰められる |
| `get_session_timeline` | — | `limit?: 50` | ページをまたいだデバイスのタイムライン |
| `get_session_overview` | observe | `session?` | 現在の起動のセッションログの概要（[§5.4](#54-セッションログ)）: 開始時刻、保存量、レコード数、訪れたページ、直近 20 件のエラーと失敗したリクエスト、ほかに保持されている起動 |
| `get_session_log` | observe | `session?`、`kinds?`、`problems?`、`page?`、`text?`、`after?`、`limit?`、`seq?`、`exclude?`、`includeExcluded?` | セッションログを 1 レコードずつ `#<seq> <time> <page> <line>` の形で返す。`page` には `p2` のようなラベル、またはログに表示されるページ ID を指定する。`after` には前回の結果の最後の `seq` を渡して先へ進む。`seq` を指定すると、代わりにその 1 レコードを完全な形（ヘッダーとボディ）で表示する（`rwd.logDetail` を呼ぶので `advanced` が必要） |
| `wait_for_page` | — | `urlContains?`、`titleContains?`、`timeoutSec?: 30`（最大 300） | 前回の呼び出し以降に開かれた、または遷移したページを待つ |
| `wait_for_event` | — | `kind?`（[§12.9](#129-タイムラインイベント)）、`page?`、`timeoutSec?: 30`（最大 300） | 条件に合う次のタイムラインイベントを待つ |
| `wait_for_control` | — | `timeoutSec?: 120`（最大 600） | 引き継ぎの後、ユーザーが AI に戻す（または終了する）まで待つ |
| `set_task` | — | `title`（≤ 24 文字）、`steps?`（≤ 12 個、各 ≤ 28 文字）、`current?` | エージェントのタスクと計画を、デバイスのすべてのページの上部に表示する。`current` は実行中のステップで、`current = steps.length` は完了を意味する。ページには `task` として届き（[§3.3](#33-ゲートウェイ--ページ)）、エージェントが離れると消える |

`page?` は、選択を変えずに 1 回の呼び出しだけを別のページ（ラベルで指定）で実行します。アタッチのレベルを超えるツールは "Requires advanced access; this session was granted interact" で失敗し、`policy.denied` として監査されます。

**フォローモード。** `follow: true`（デフォルト）の場合、エージェントの操作で新しいページが開いたとき、ユーザーが別のページをフォアグラウンドにしたとき、または選択中のページが 1.5 秒間消えていたときに、選択中のページが自動的に移り、結果にその旨が表示されます。古いものとして削除された選択中のページ（[§3.1](#31-ライフサイクル)）は、元のエントリーがなくなっているため、`follow` の設定にかかわらず同じ URL を表示しているページに置き換えられます。

### 14.4 ローカル stdio ブリッジ

stdio にしか対応していない MCP クライアント向け:

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

stdio をホスト型の `/v1/mcp` に中継します。`--gateway` は `RWD_GATEWAY` からも指定できます。

## 15. 言語

対応言語：英語（`en`）、簡体字中国語（`zh`）、繁体字中国語（`zh-TW`）、フランス語（`fr`）、スペイン語（`es`）、ロシア語（`ru`）、アラビア語（`ar`、右から左）、日本語（`ja`）、韓国語（`ko`）、ドイツ語（`de`）、ポルトガル語（`pt`）。どの BCP 47 タグも受け付け、最も近い言語に対応付けます：`en-US` → `en`、`zh-CN`、`zh_CN`、`zh-Hans` → `zh`、`zh-HK`、`zh-MO`、`zh-Hant` → `zh-TW`、`fr-CA` → `fr`、`pt-BR`、`pt-PT` → `pt`。`Accept-Language` では、対応言語のうち重みが最も大きいものを選びます。

| 対象 | 内容 | 決め方 |
|---|---|---|
| エージェント | MCP サーバーの instructions、ツールとパラメーターの説明、ツールの結果、`[Session changes]`、エラー | ゲートウェイの `RWD_LANG` / `--lang`（デフォルト `en`） |
| エージェント（ページから） | SDK が書く RPC エラーメッセージとイベントの要約 | ゲートウェイの言語を伝える `welcome.agentLang`。SDK は最後の値を localStorage の `rwd:alang` に保存し、次の `welcome` より前に発生したイベントに使う。値を受け取るまでは英語を使う |
| 管理コンソール | REST と SSE のレスポンスに含まれるエラーメッセージ、タイムラインの要約、システムラベル | リクエストの `?lang=`、次に `Accept-Language`、最後にゲートウェイの言語 |
| 端末のユーザー | SDK のピル、バー、ダイアログ、通知 | `run({ lang })`、なければ `navigator.languages` のうち SDK に言語パックがある（組み込み、またはページが登録した）最初の言語、それもなければ英語。`en` と `zh` 以外の言語パックは、`sdk.js` と同じ場所の `locales/<id>.js` またはゲートウェイ（`/v1/locales/<id>.js`）からオンデマンドで読み込む |

これにより、中国語を話すユーザーと英語で動くエージェントが一緒に作業できます。ダイアログには *AI 想要点击「提交订单」，允许吗？* と表示され、拒否された場合、エージェントは *The user denied this action* を受け取ります。

## 16. 運用

- **メトリクス。** `GET /v1/metrics` は Prometheus のテキスト形式を返します。`RWD_METRICS_TOKEN` を設定すると `Authorization: Bearer <token>` が必要になります。系列: `rwd_online_devices{project}`、`rwd_connected_pages`、`rwd_attached_agents`、`rwd_ws_connections`、`rwd_rpc_total{method,result}`、`rwd_rpc_duration_seconds{method}`（ヒストグラム）、`rwd_http_requests_total{code}`。
- **SDK のバージョン。** キャッシュに使う SDK のバージョンは、ゲートウェイに埋め込まれた `sdk.js` の SHA-256 の先頭 16 進数 12 文字です。そのため、ファイルが変わるたびに `/v1/sdk/<version>/sdk.js` も変わります。`GET /v1/api/config` はこれを `sdkVersion` として、`sdkIntegrity`（`sha384-…`、`integrity` 属性用）とともに返します。管理コンソールは、このバージョンを固定したスニペットを提供します。
- **データベース。** `RWD_DATABASE_URL=postgres://…`（または `postgresql://`）で Postgres を選びます。それ以外の場合は `RWD_DATA`（デフォルト `rwd.db`）が SQLite ファイルになります。スキーマは起動時に作成・マイグレーションされます。
- **レート制限。** 管理コンソールへのサインインと招待の受け入れ: クライアント IP ごとに 1 分あたり 10 回。ページ接続とプレゼンス呼び出し: クライアント IP ごとに 1 分あたり 120 回。クライアント IP を `X-Forwarded-For` から取るのは `--trust-proxy` を指定した場合のみです。同じスイッチで `X-Forwarded-Proto` と `X-Forwarded-Host` も扱いが決まり、これらはセッション Cookie を `Secure` にするかどうかと、`--public-url` が未設定の場合に推定する `gatewayUrl` のスキームとホストを決めます。
- **監査ログの保持期間。** `RWD_AUDIT_RETENTION_DAYS`（デフォルト 180）。古いイベントは 6 時間ごとに削除されます。

ゲートウェイのすべての設定は [gateway/README.ja.md](../gateway/README.ja.md) に記載されています。
