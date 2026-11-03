<!-- i18n-source: 290e0636713e2be8bacb0501c422ae3a327ae0ea -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Docker Compose でのデプロイ

Docker ホスト上でゲートウェイを動かし、その前段に小さな [Caddy](https://caddyserver.com) を置きます。公開の方法は 2 通りあります。

- **既存の TLS プロキシの背後に置く**（デフォルト）: Caddy は `127.0.0.1:18788` で待ち受け、その前段にある nginx、Caddy、Traefik、ロードバランサーなどが HTTPS を終端します。
- **`RWD_DOMAIN` で直接 HTTPS を提供する**: Caddy 自身がポート 80 と 443 で待ち受け、Let's Encrypt から証明書を取得します。

`deploy.sh` はすべてをローカルでビルドし、ssh でサーバーへ送って、スタックを起動（または再起動）します。ゲートウェイの設定については [gateway/README.ja.md](../../gateway/README.ja.md) を参照してください。

## ファイル

| ファイル | 役割 |
|---|---|
| `Dockerfile` | ゲートウェイのイメージ。Alpine にビルド済みの `rwd` バイナリ（管理コンソールと SDK を組み込み済み）を加えたもの。uid 10001 で、`RWD_ADDR=:8080` と `RWD_DATA=/data/rwd.db` を設定して動作し、`/v1/healthz` でヘルスチェック。GHCR に公開しているのも同じイメージで、単体でも動作 |
| `compose.yml` | 2 つのサービス。`gateway`: Dockerfile からビルドし、`./data` を `/data` にマウント、設定は `.env` から読み込み、`RWD_TRUST_PROXY=1`（到達できるのは Caddy だけ）、ポートは公開しない。`web`: `caddy:2-alpine`。`${BIND:-127.0.0.1}:${PORT:-18788}` で公開し、`./demo` を `/demo/` で配信、それ以外はすべてゲートウェイへプロキシ |
| `Caddyfile` | `:80` で平文 HTTP を提供。`X-Forwarded-*` は `RWD_TRUSTED_PROXIES`（デフォルトはプライベートアドレス帯）からのものだけを信頼 |
| `compose.tls.yml` | 直接 HTTPS 用のオーバーレイ。ポート `443/tcp` と `443/udp`（HTTP/3）を追加し、`Caddyfile.tls` に差し替え、証明書を `caddy-data` ボリュームに保存 |
| `Caddyfile.tls` | 自動取得した証明書で `RWD_DOMAIN` を HTTPS で配信し、HTTP を HTTPS へリダイレクト |
| `deploy.sh` | ビルド、コピー、初回の `.env` 作成、データベースのバックアップ、再起動 |

サーバー上には、`deploy.sh` によって次の構成ができます。

```
~/rwd-platform/
├── .env                      設定（パーミッション 600。初回デプロイ時に作成し、以降は変更しない）
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       サーバーのアーキテクチャ向けのゲートウェイバイナリ
├── data/                     rwd.db（SQLite）と rwd.db.bak-<time> バックアップ
└── demo/platform-demo/       デモショップ。https://rwd.example.com/demo/platform-demo/ で公開
```

## 必要なもの

- **ビルドマシン:** Go、Node.js（npm を含む）、`make`、`ssh`、`scp`、`tar`。
- **サーバー:** Compose プラグイン付きの Docker（`docker compose`）と `openssl`。ssh ユーザーが Docker を実行できる必要があります（たとえば `docker` グループに所属している）。sudo は不要です。サーバーは `alpine:3.22` と `caddy:2-alpine` を pull します。

## 設定（`.env`）

| 変数 | デフォルト | 説明 |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | 初回デプロイ時に生成 | owner のパスワード。**必須**。起動のたびに適用されるため、変更すると `RWD_ADMIN_EMAIL` が指す owner のパスワードが再設定される |
| `RWD_ADMIN_EMAIL` | `admin` | owner アカウント（ログイン名）。作成されるのは初回起動時のみで、後から変更しても owner は増えない。[gateway/README](../../gateway/README.ja.md) を参照 |
| `RWD_PUBLIC_URL` | リクエストから推定 | 公開ゲートウェイ URL（例: `https://rwd.example.com/v1`）。設定を推奨 |
| `RWD_METRICS_TOKEN` | `deploy.sh` が生成 | `/v1/metrics` 用の Bearer トークン |
| `RWD_DATABASE_URL` | `./data` 内の SQLite | `postgres://…` を指定すると代わりに Postgres を使用 |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 監査ログの保持日数 |
| `RWD_LANG` | `en` | エージェント向けテキストの言語: `en`、`zh`、`zh-TW`、`fr`、`es`、`ru`、`ar`、`ja`、`ko`、`de` または `pt` |
| `RWD_MCP_RATE_LIMIT` | — | クライアント IP ごとの 1 分あたりの MCP リクエスト数（未設定なら制限なし）。公開デモについては [deploy/demo](../demo/README.md) を参照 |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Caddy の前段にあるプロキシのアドレス帯（スペース区切りの CIDR、または Caddy の `private_ranges`）。後述 |
| `BIND` | `127.0.0.1` | Caddy を公開するアドレス |
| `PORT` | `18788` | Caddy を公開するポート |
| `RWD_DOMAIN` | — | 直接 HTTPS で使う公開ホスト名（`compose.tls.yml` と併用する場合のみ） |
| `COMPOSE_FILE` | — | `compose.yml:compose.tls.yml` にすると直接 HTTPS が有効になる |

サーバー上で `.env` を編集したら、デプロイ先のディレクトリで `docker compose up -d` を実行して反映します。

## `deploy.sh` によるデプロイ

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` には `ssh` が受け付ける形式なら何でも指定できます（`~/.ssh/config` のエイリアス、`user@host`）。`<amd64|arm64>` はサーバーの CPU アーキテクチャです。`remote-dir` のデフォルトは ssh ユーザーのホームディレクトリにある `rwd-platform` です。スクリプトは次の処理を行います。

1. ローカルで `make platform GOOS=linux GOARCH=<arch>` を実行します（SDK、管理コンソール、ゲートウェイバイナリ）。
2. Dockerfile、compose ファイル、Caddyfile、デモページ、バイナリをサーバーへコピーします。
3. **初回デプロイ時のみ**、ランダムな owner パスワード、`BIND`、`PORT`、後述の任意設定を含む `.env`（パーミッション 600）を書き出し、owner のログイン情報を一度だけ表示します。以降のデプロイで `.env` が上書きされることはなく、新しいバージョンで追加された設定（`RWD_METRICS_TOKEN` など）が欠けている場合に追記するだけです。
4. `data/rwd.db` が存在すれば、ゲートウェイを停止してデータベースを `data/rwd.db.bak-<YYYYmmddHHMMSS>` にコピーし（スキーマのマイグレーションは次回起動時に実行されます）、続いて `data/` の所有者を uid 10001 に修正します。これには sudo ではなく使い捨てのコンテナを使います。
5. `docker compose up -d --build` を実行し、サービスの状態を表示します。

初回デプロイ時の設定は環境変数で渡せます。読み込まれるのは `.env` がまだ存在しないときだけです: `BIND`、`PORT`、`RWD_ADMIN_EMAIL`、`RWD_PUBLIC_URL`、`RWD_TRUSTED_PROXIES`、`RWD_DOMAIN`。

### 既存の TLS プロキシの背後に置く

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy は `127.0.0.1:18788` で公開されます。プロキシの転送先をここに向け、プロキシが次の条件を満たすようにしてください。

- WebSocket のアップグレードを通すこと（ページは `/v1/page` に接続します）。
- レスポンスをバッファリングせず、長時間の接続を許可すること。管理コンソールのライブ更新（`/v1/api/stream`）と MCP はストリーミング HTTP を使います。ゲートウェイは 25 秒ごとにハートビートを送るので、アイドルタイムアウトは 60 秒を超えていれば十分です。
- `X-Forwarded-For`、`X-Forwarded-Proto: https`、元の `Host` を送ること。

nginx の例:

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    server_name rwd.example.com;
    # listen 443 ssl; ssl_certificate …; ssl_certificate_key …;

    location / {
        proxy_pass http://127.0.0.1:18788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

**`RWD_TRUSTED_PROXIES`。** Caddy がプロキシの `X-Forwarded-*` ヘッダーをゲートウェイへ引き渡すのは、プロキシが信頼できるアドレスから接続してきた場合だけです。デフォルトの `private_ranges` は、同じホストやプライベートネットワーク上のプロキシをカバーします。プロキシがパブリックなアドレス（別のサーバー、CDN、クラウドのロードバランサー）から接続してくる場合は、そのアドレス帯を設定してください。そうしないと、ゲートウェイはプロキシをクライアントとして扱います。すべてのリクエストがプロキシの IP から来たように見え（API キーの IP 許可リストや IP ごとのレート制限が機能しなくなります）、平文 HTTP 経由に見えます（管理コンソールの cookie に `Secure` が付きません）。

Caddy を別のアドレスやポートで公開するには、`BIND` と `PORT` を設定します。

### `RWD_DOMAIN` で直接 HTTPS を提供する

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

初回デプロイの前に、ドメインの DNS をサーバーに向け、ポート 80 と 443 を開放してください（TCP。HTTP/3 用に UDP 443 も）。`RWD_DOMAIN` を設定していると、初回デプロイで `RWD_DOMAIN`、`COMPOSE_FILE=compose.yml:compose.tls.yml`、`BIND=0.0.0.0`、`PORT=80`、`RWD_PUBLIC_URL=https://rwd.example.com/v1` が `.env` に書き込まれます。Caddy は証明書を自動で取得・更新し（Caddy の自動 HTTPS により Let's Encrypt から取得）、`caddy-data` ボリュームに保存して、HTTP を HTTPS へリダイレクトします。ポート 80 は ACME チャレンジとリダイレクトのために開けたままにします。

既存のデプロイを直接 HTTPS に切り替えるには、上記の 5 行を `.env` に追加して `docker compose up -d` を実行します。

## 手動でのデプロイ

`deploy.sh` を使わない場合:

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# deploy/platform/* をサーバーへコピーし、バイナリを ./rwd としてコピー
# サーバー上の、そのディレクトリで:
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### リリースイメージを使う

ゲートウェイの各リリースでは、linux/amd64 と linux/arm64 向けのイメージ `ghcr.io/zanel1u/remote-webview-debugger` も公開しています。タグは `<version>`（例: `0.2.0`）、`<major>.<minor>`、`latest` で、管理コンソールと SDK が組み込まれています。自分でビルドする代わりにこれを使うには、`compose.yml` のゲートウェイの `build:` と `image:` の行を `image: ghcr.io/zanel1u/remote-webview-debugger:<version>` に置き換え、バイナリのコピーを省いて `docker compose up -d` で起動します。アップグレードはタグを変えてから `docker compose pull && docker compose up -d` を実行します（`deploy.sh` と同様に、先に `data/` をバックアップしてください）。

Compose を使わずに手早く試すなら、イメージは単体でも動きます。[クイックスタート](../../README.ja.md#1-ゲートウェイを起動する)を参照してください。単体で動かす場合は `X-Forwarded-*` を信頼しないので、自前のプロキシを前段に置くなら `-e RWD_TRUST_PROXY=1` を追加してください。

## アップグレード

同じホスト、アーキテクチャ、ディレクトリを指定して `deploy.sh` をもう一度実行します。再ビルドして新しいバイナリをコピーし、SQLite データベースをバックアップしてスタックを再起動します。`.env` はそのまま残ります。短時間の中断が発生します。ページは自動で再接続します。短い停止なら数秒以内に戻ります。長い停止の後は、ページがいったんポーリングにフォールバックし、数分以内、またはエージェントが接続した時点で WebSocket に戻ることがあります。その時点で接続していたエージェントは、接続し直す必要があります。

## バックアップ

- **自動コピー。** デプロイのたびに、再起動の前に `data/rwd.db` を `data/rwd.db.bak-<time>` にコピーします。これらは溜まっていくので、ときどき古いものを削除してください。
- **定期バックアップ。** SQLite は WAL モードで動くため、ゲートウェイの動作中は最近の書き込みが `rwd.db-wal` に残っていることがあります。一貫性のあるコピーを取るには、ゲートウェイを一時的に停止します。

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **リストア。** ゲートウェイを停止し、`data/rwd.db` をバックアップで置き換え（`rwd.db-wal` / `rwd.db-shm` は削除）、所有者が uid 10001 であることを確認してから、ゲートウェイを起動します。
- `.env` もバックアップしてください。データベースのバックアップには API キーの pepper と管理コンソールのセッションシークレットが含まれるので、非公開で保管してください。

## Postgres

`.env` に `RWD_DATABASE_URL`（例: `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`）を設定し、`docker compose up -d` を実行します。ゲートウェイのコンテナからデータベースに到達できる必要があります（マネージドデータベース、または compose のオーバーライドファイルで自分で追加した `postgres` サービス）。スキーマは起動時に作成されますが、既存の SQLite ファイルからデータが移されることはありません。`deploy.sh` がバックアップするのは SQLite だけなので、Postgres は `pg_dump` やプロバイダーのスナップショットでバックアップしてください。

## 日々の運用

```bash
docker compose ps                                     # 状態
docker compose logs -f gateway                        # ゲートウェイのログ（生成された owner パスワード、エラーなど）
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **owner のパスワードを忘れた場合:** `.env` の `RWD_ADMIN_PASSWORD` を変更して `docker compose up -d` を実行します。起動時に適用されます。
- 1 つのデータベースにつき、ゲートウェイのインスタンスは **1 つ**だけ動かしてください。ライブ状態（接続中のページ、制御状態）はゲートウェイのプロセス内にあります。
- `/demo/` 以下のデモページは任意です。公開したくない場合は `demo/` の中身を削除してください（次回のデプロイで再びコピーされます）。
