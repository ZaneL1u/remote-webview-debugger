<!-- i18n-source: 2b1a4c4698c0c1c90cb95a52c17aaab9848c06e2 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# rwd ゲートウェイ

Remote WebView Debugger の Go 製サーバーです。ページの接続、デバイスのオンライン状態、制御状態、ホスト型 MCP エンドポイント、管理コンソールの REST API に加えて、組み込みの管理コンソールとページ SDK を提供します。バイナリ 1 つでサーバー全体が動きます。

- プロトコル: [docs/protocol.ja.md](../docs/protocol.ja.md)
- アーキテクチャ、同意モデル、セキュリティ上の注意: [docs/architecture.ja.md](../docs/architecture.ja.md)
- Docker Compose でのデプロイ: [deploy/platform/README.ja.md](../deploy/platform/README.ja.md)

## ビルドと実行

管理コンソールと SDK をビルドしてバイナリに埋め込むため、ビルドには Go（バージョンは `go.mod` を参照）と Node.js（npm を含む）が必要です。リポジトリのルートで次を実行します。

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # クロスコンパイル（amd64 または arm64）

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

http://localhost:8080 を開き、指定したメールアドレスとパスワードでサインインします。ページとエージェントが使うゲートウェイ URL は `http://localhost:8080/v1` です（本番環境では `https://rwd.example.com/v1` など）。

`gateway/` 内で `go build ./cmd/rwd` を実行してもビルドできますが、そのバイナリには管理コンソールと SDK の代わりにプレースホルダーしか入りません。`rwd version` と `/v1/healthz` が返すバージョンは、`make` が直近の `gateway-vX.Y.Z` タグから決めます（タグちょうどなら `0.2.0`、その後のコミットでは `0.2.0-3-gabc1234`、タグがなければ `0.0.0-dev`）。`RWD_VERSION=…` で上書きもできます。Linux と macOS（amd64、arm64）向けのリリース済みバイナリは、各 `gateway-v*` の [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases) に添付されています。変更点は [CHANGELOG](CHANGELOG.md) を参照してください。

## コマンド

```
rwd serve [flags]                       ゲートウェイを起動
rwd mcp --gateway https://host/v1       ローカルのエージェント向け stdio MCP ブリッジ（API キーは RWD_API_KEY から取得）
rwd version                             バージョンを表示
```

## 設定（`rwd serve`）

すべてのフラグに対応する環境変数があります。コマンドラインで指定したフラグが優先されます。

| フラグ / 環境変数 | デフォルト | 説明 |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | 待ち受けアドレス（平文 HTTP。TLS は前段に置く。[deploy/platform](../deploy/platform/README.ja.md) を参照） |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | データベース。`postgres://` または `postgresql://` で始まる URL なら Postgres、それ以外は SQLite のファイルパス。`RWD_DATABASE_URL` が `RWD_DATA` より優先。スキーマは起動時に作成・マイグレーション |
| `--public-url` / `RWD_PUBLIC_URL` | リクエストごとに推定 | `/v1` で終わる公開ゲートウェイ URL（例: `https://rwd.example.com/v1`）。組み込み用スニペット、招待リンク、`/v1/api/config` で使用。ゲートウェイが自分の公開アドレスを推定できない場合に設定 |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | オフ | クライアント IP を `X-Forwarded-For` から、推定する公開 URL のスキームとホスト（および管理コンソールの cookie に `Secure` を付けるかどうか）を `X-Forwarded-Proto` / `X-Forwarded-Host` から取得。リバースプロキシの背後でのみ有効にすること。そうしないとクライアントがこれらのヘッダーを偽装でき、IP 許可リストやレート制限を回避されてしまう。無効のときは、プロキシが何を送ってきてもすべてのリクエストを平文 HTTP として扱うため、管理コンソールの cookie には `Secure` が付かず、推定した URL も `http://` で始まる（この場合は `--public-url` を設定） |
| `--lang` / `RWD_LANG` | `en` | AI が読むすべてのテキストの言語。MCP の説明、ツールとパラメーターの説明、ツールの結果、`[Session changes]`、エラーが対象。`welcome.agentLang` としてページ SDK にも伝わり、ページ側で生成するエラーやイベントの要約も同じ言語になる。`en`、`zh`（簡体字中国語）、`zh-TW`（繁体字中国語）、`fr`、`es`、`ru`、`ar`、`ja`、`ko`、`de`、`pt` のいずれか。地域付きのタグも受け付け、最も近い言語に対応付ける（`zh-CN` → `zh`、`zh-HK` → `zh-TW`、`pt-BR` → `pt`）。管理コンソールはリクエストごとに言語を選び（`?lang=` または `Accept-Language`）、どちらもなければこの値を使用 |
| `--demo-dir` / `RWD_DEMO_DIR` | — | このディレクトリを `/demo/` で配信（任意。デモページ用） |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0`（制限なし） | クライアント IP ごとに 1 分間に許可する MCP リクエスト数。超えた分には `Retry-After: 60` 付きで `429` を返す。デモのように API キーを公開しているゲートウェイ向け（[deploy/demo](../deploy/demo/README.md)）。プロキシの背後ではクライアント IP を得るために `--trust-proxy` が必要 |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | オフ | 公開デモを運用します。`POST /v1/demo/keys`（サインイン不要、CORS 開放）が訪問者ごとに専用の API キー（レベル `interact`、有効期間 24 時間、IP ごとに 1 時間あたり 5 個まで）を発行するので、訪問者どうしでエージェントを共有することはありません。また `list_devices` には `deviceCode` が必要になり、ほかの訪問者のデバイスを一覧できなくなります。[deploy/demo](../deploy/demo/README.md) を参照 |
| `RWD_ADMIN_EMAIL` | `admin` | owner アカウントのメールアドレス（ログイン名）。owner が作成されるのはデータベースに owner がまだいないとき（初回起動時）だけ。後から変更しても owner が 2 人目として作られることは**なく**、`RWD_ADMIN_PASSWORD` をどの owner に適用するかが変わるだけ |
| `RWD_ADMIN_PASSWORD` | — | owner のパスワード。owner の作成時に使われるほか、その後も**起動のたび**に `RWD_ADMIN_EMAIL` が指す owner のパスワードを再設定するため、アカウントの復旧手段にもなる。そのメールアドレスが owner のものでない場合（別のメンバー、または該当なし）は無視され、ログにその旨と既存の owner が出力される。未設定でデータベースが空なら、ランダムなパスワードを生成してログに一度だけ出力 |
| `RWD_METRICS_TOKEN` | — | 設定すると、`/v1/metrics` に `Authorization: Bearer <token>` が必要になる |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 監査ログの保持日数 |
| `RWD_OIDC_*` | — | シングルサインオン。[後述](#シングルサインオン)を参照 |

その他の注意点:

- ゲートウェイが必要とするシークレット（API キーの pepper と管理コンソールのセッションシークレット）は、初回起動時に生成されてデータベースに保存されます。データベースはバックアップし、バックアップは非公開で保管してください。
- ゲートウェイはライブ状態（接続中のページ、制御状態、タイムライン）をメモリ上に持つため、1 つのデータベースにつきインスタンスは 1 つだけ動かしてください。
- ヘルスチェック: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`。

## シングルサインオン

メンバーは Feishu、Lark、または任意の OpenID Connect プロバイダー（Keycloak、Okta、Microsoft Entra ID、Google、Authing など）でもサインインできます。メールアドレスとパスワードによるサインインも引き続き使えます。プロバイダーとそのクライアント認証情報を設定すると、ログインページに **… でログイン** ボタンが表示されます。

| 環境変数 | デフォルト | 説明 |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`、`lark`、`oidc` のいずれか。設定するとシングルサインオンが有効になる。`RWD_OIDC_ISSUER` だけを設定した場合は `oidc` とみなす |
| `RWD_OIDC_CLIENT_ID`、`RWD_OIDC_CLIENT_SECRET` | — | アプリの認証情報（Feishu と Lark では App ID と App Secret）。必須 |
| `RWD_OIDC_ISSUER` | — | OpenID Connect の issuer（例: `https://sso.example.com/realms/acme`）。各エンドポイントはその `/.well-known/openid-configuration` から読み込む（`oidc` のみ） |
| `RWD_OIDC_AUTH_URL`、`RWD_OIDC_TOKEN_URL`、`RWD_OIDC_USERINFO_URL` | プロバイダーの既定値 | エンドポイントを上書き。ディスカバリーに対応していない OpenID Connect プロバイダーでは 3 つすべてを設定 |
| `RWD_OIDC_SCOPES` | `openid profile email`（`oidc`）、なし（Feishu、Lark） | スペース区切りのスコープ。Feishu と Lark では、アカウントにメールアドレスが入るよう `contact:user.email:readonly`（企業メールアドレスも使うなら `contact:user.employee:readonly`）を追加 |
| `RWD_OIDC_NAME` | プロバイダー名 | ログインボタンのラベル（例: `Okta`） |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | 初回サインイン時に作成されるアカウントのロール: `member` または `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | オフ | アカウントを作成しない。サインインできるのは既存のメンバーか招待済みのメンバー（同じメールアドレス）だけ |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | サインインを許可するメールドメイン（カンマ区切り、例: `example.com`） |
| `RWD_OIDC_TRUST_EMAIL=1` | オフ | `oidc` のみ。`email_verified` を送らないプロバイダー（Microsoft Entra ID）のメールアドレスも信頼する。メールアドレスを組織で管理しているシングルテナントのプロバイダーでのみ使用 |
| `RWD_OIDC_TENANT` | — | Feishu と Lark のみ。組織の `tenant_key`。ほかの組織のユーザーは拒否される（`sso_error=tenant`）。シングルサインオンごとの `auth.login` 監査記録に `tenant` が記録される |

プロバイダーには次のリダイレクト URL を登録してください。完全に一致している必要があります: `https://<host>/v1/api/auth/oidc/callback`。つまり `RWD_PUBLIC_URL` のオリジン（未設定ならリクエストのオリジン）の後ろに `/v1/api/auth/oidc/callback` を付けたものです。プロキシの背後では、この URL が変わらないよう `RWD_PUBLIC_URL` を設定してください。

ある ID の初回サインインでは、同じメールアドレスのメンバーに紐付けられます（招待されたメンバーは招待時のロールのままで、招待は使用済みになります）。該当するメンバーがいなければ、`RWD_OIDC_INVITE_ONLY=1` でない限り `RWD_OIDC_DEFAULT_ROLE` のアカウントが作成されます。2 回目以降はプロバイダーの subject（Feishu と Lark では `open_id`）でアカウントを探すので、メールアドレスが変わっても問題ありません。プロバイダーの別の ID に紐付け済みのアカウントには改めて紐付けられず（メールボックスが別の人に割り当て直された場合は `sso_error=conflict` になります）、無効化されたメンバーの招待はそのまま残ります。OpenID Connect プロバイダーのメールアドレスは `email_verified: true` の場合（または `RWD_OIDC_TRUST_EMAIL=1` のとき）だけ使われ、メールアドレスのないアカウントのログイン名は `<provider>:<subject>` になります。owner はこれらのメンバーをほかのメンバーと同様に **メンバー** ページで管理できます。ロールの変更、無効化、削除が可能で、無効化されたメンバーはどちらの方法でもサインインできません。シングルサインオンで作成されたアカウントにはパスワードがありません。ゲートウェイは受け取ったばかりのアクセストークンでプロバイダーの userinfo エンドポイントからユーザー情報を読み取ります（PKCE 付きの認可コードフロー）。ID トークンは使いません。開始とコールバックはクライアント IP ごとに 1 分あたり 60 回までです（プロキシの背後では `--trust-proxy` を有効にしてください。そうしないと全員がプロキシの IP を共有します）。

**誰がサインインできるか。** 初回サインインでどの既存メンバーになるかはプロバイダーのメールアドレスで決まり、owner も例外ではありません。そのため、プロバイダーでメールアドレスを設定できる人は、それらのアカウントを乗っ取れます。Feishu や Lark ではカスタムアプリを使ってください。サインインできるのは組織内のユーザーだけで、メールアドレスも組織のものになります。ストアアプリや、関連組織と共有したアプリでは、ほかの組織のユーザーもサインインできます。その場合は `RWD_OIDC_TENANT` を設定してください。誰でもサインインできる OpenID Connect プロバイダー（Google、マルチテナントの Entra ID）では、`RWD_OIDC_ALLOWED_DOMAINS` か `RWD_OIDC_INVITE_ONLY=1` を設定してください。設定しないと誰でもアカウントを持ててしまいます（起動時にログで警告されます）。また、そうしたプロバイダーでは `RWD_OIDC_TRUST_EMAIL=1` を決して設定しないでください。

**アプリの変更、または無効化。** Feishu と Lark の `open_id` は 1 つのアプリに属します。別の App ID に切り替えると、メンバーはメールアドレスで紐付け直され、メールアドレスのないアカウント（`feishu:…`）は削除してから招待し直す必要があります。シングルサインオンで作成されたアカウントにはパスワードがありません。シングルサインオンを無効にする前などに、owner が**メンバー**ページの**新しいリンク**で、パスワードを設定するための招待リンクを発行できます（紛失した招待の再発行にも使えます）。

**Feishu または Lark。** [Feishu Open Platform](https://open.feishu.cn/app)（Lark は [open.larksuite.com](https://open.larksuite.com/app)）で、組織内のユーザーだけが使えるカスタムアプリ（企业自建应用）を作成し、次の手順を行います。

1. **Credentials & Basic Info**（認証情報と基本情報）にある App ID と App Secret を `RWD_OIDC_CLIENT_ID` と `RWD_OIDC_CLIENT_SECRET` に設定します。
2. **Security Settings → Redirect URLs**（セキュリティ設定 → リダイレクト URL）に、上記のリダイレクト URL を追加します。
3. **Permissions & Scopes**（権限とスコープ）で `contact:user.email:readonly`（企業メールアドレスも使うなら `contact:user.employee:readonly`）を追加し、同じスコープを `RWD_OIDC_SCOPES` にも列挙します。
4. アプリの利用範囲（availability）をサインインさせたいユーザーに設定し、バージョンを作成して公開すると、設定が反映されます。

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

## エージェントの接続

管理コンソール（**API キー**）で API キーを作成し、ホスト型 MCP エンドポイントをクライアントに追加します。Claude Code の例:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

stdio しか扱えないクライアントには、同じバイナリが stdio をホスト型エンドポイントへ中継します。

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| `rwd mcp` の設定 | 説明 |
|---|---|
| `--gateway` / `RWD_GATEWAY` | `/v1` で終わるゲートウェイ URL |
| `RWD_API_KEY` | API キー（プロセス一覧に表示されないよう、環境変数でのみ指定） |

1 つのキーでゲートウェイ上のすべてのデバイスにアクセスできます。ツールの一覧は [protocol.ja.md §14](../docs/protocol.ja.md#14-mcp) にあります。

## ソースの構成

```
cmd/rwd/            エントリーポイント: serve、mcp（stdio ブリッジ）、version
internal/store/     SQLite / Postgres: プロジェクトとポリシー、メンバー、API キー（HMAC。レベル、有効期限、
                    IP 許可リスト）、デバイスとデバイストークン、デバイスの招待、監査ログ、設定
internal/hub/       ライブ状態: デバイス、ページ、制御状態マシン、接続の承認、レベルの検査、
                    タイムライン、RPC のルーティング、SSE の購読、メトリクス
internal/server/    HTTP: ページの WebSocket、オンライン状態のポーリング、REST（サインインとロール）、MCP ツール、
                    SSE、/v1/metrics、静的ファイル
internal/i18n/      エージェントと管理コンソール向けのテキスト（11 言語）
internal/ids/       アプリキー、API キー、デバイスコード、シークレット
internal/web/       組み込みの管理コンソールと SDK（`make gateway` が配置。それ以外はプレースホルダー）
scripts/embed.sh    console/dist と sdk.js を go:embed 用に internal/web へ配置
```

## テスト

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` は、シミュレートしたページと MCP クライアントで一連の流れを通して検証します。対象は、デバイスコードによる接続、デバイス上での承認（許可、拒否、連続した拒否とロックアウト、閲覧のみ）、猶予期間内の再接続で再承認が不要なこと、レベルの検査、スナップショット、最初の操作での画面ロック、ページをまたいだ追従と再作成された WebView に置き換えられたページの破棄、ユーザーによる引き継ぎと AI への返却、一括操作、ユーザーによる終了、監査記録、デバイストークン（4401）、再開トークン（4409）、クォータ（4429）、ワンタイム招待、キーの有効期限と IP 許可リスト、即時失効、メンバーの招待とロール、SSE とメトリクス、そして認証の失敗です。

同じテストを Postgres に対しても実行できます（テストごとに一時スキーマを使います）。

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

リポジトリのルートで `make -j16 check` を実行すると、CI と同じゲートウェイ、SDK、管理コンソールのチェックが走ります。
