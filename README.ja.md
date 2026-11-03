<!-- i18n-source: 9d368db4a362be21a3c387a4cc6eee7935f0427d -->
<div align="center">

# Remote WebView Debugger

**アプリ内の WebView や H5 ページを、実際のユーザーのスマートフォン上で、MCP 経由でリモートから AI エージェントにデバッグさせます。**

[debugger.site](https://debugger.site) · [ライブデモ](https://debugger.site/#demo) · [ドキュメント](docs/architecture.ja.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

特定のユーザーのスマートフォンでしか起きない不具合、それも WeChat のようなスーパーアプリや自社アプリの WebView の中で起きるものは、最もデバッグしにくい種類のバグです。USB ケーブルもリモートデバッグ用ポートもなく、手元のマシンで再現する手段もありません。Remote WebView Debugger は、そのページを AI エージェントの目の前に持ってきます。

- **script タグ 1 つ**（またはネイティブからの注入）でページがオンラインになります。ユーザーにはデバイスコード付きの小さなピルが表示され、*ヘルプを求める* をタップできます。
- **エージェントは MCP で接続します**。Claude Code、Cursor など任意の MCP クライアントが、端末上でユーザーが承認した後に接続します。アクセシビリティスナップショット、console、ネットワーク、スクリーンショットを読み取り、人と同じようにクリック・入力・スクロールでき、その端末のすべてのページと WebView をまたいで操作します。
- **主導権は常にユーザーにあります。** AI が何をしているか（エージェントのカーソル、予定の手順を示すタスクカード、光る画面の縁）が見え、いつでも引き継いだりセッションを終了したりできます。パスワード、電話番号、カード番号は、端末から何かが送られる前にマスクされます。
- **セルフホスト。** 管理コンソールと SDK を埋め込んだ Go のバイナリ 1 つで動き、データベースは SQLite または Postgres です。

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## クイックスタート

手順は 3 つです。ゲートウェイを起動し、ページに SDK を追加し、エージェントの接続先をゲートウェイに向けます。

### 1. ゲートウェイを起動する

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

`http://<your-host>:8080` を開き、**`admin`** とそのパスワードでサインインします。`RWD_ADMIN_PASSWORD` を指定しなかった場合は、ランダムなパスワードが `docker logs rwd` に一度だけ出力されます。イメージは Alpine ベース（linux/amd64 と linux/arm64）で、管理コンソールと SDK を埋め込み、すべてのデータを `rwd-data` ボリュームに保存します。アップグレードするには、新しいタグを `docker pull` してコンテナを作り直します。

必要に応じて `-e` で渡す設定（[すべての設定](gateway/README.ja.md)）：

| 変数 | 用途 |
|---|---|
| `RWD_ADMIN_EMAIL` | オーナーのログイン名（デフォルトは `admin`） |
| `RWD_PUBLIC_URL` | スマートフォンとエージェントが使うアドレス（例：`https://rwd.example.com/v1`）。ブラウザで開いているアドレスと異なる場合に指定します |
| `RWD_LANG=zh` | MCP ツールの説明と結果を中国語にします |
| `RWD_DATABASE_URL` | `postgres://…` を指定すると SQLite の代わりに Postgres を使います |
| `RWD_TRUST_PROXY=1` | 自前のリバースプロキシの背後でのみ使用：クライアント IP とスキームを `X-Forwarded-*` から取得します |

<details>
<summary>その他の起動方法：バイナリ、HTTPS 付きの Docker Compose、ソースから</summary>

- **バイナリ。** [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) の各ゲートウェイリリースには、Linux と macOS 用の `rwd_<version>_<os>_<arch>.tar.gz` があります。展開して `./rwd serve --addr :8080` を実行します。
- **Docker Compose。** [`deploy/platform`](deploy/platform/README.ja.md) は前段に Caddy を置きます。自前の TLS プロキシの背後に置くことも、Let's Encrypt の証明書で自ら HTTPS を提供すること（`RWD_DOMAIN=<host>`）もできます。
- **ソースから。** `make -j16`（Go と Node が必要）の後、`gateway/bin/rwd-<os>-<arch> serve --addr :8080` を実行します。

</details>

### 2. ページをオンラインにする

管理コンソールでプロジェクトを作成してアプリキーを取得し、ゲートウェイのアドレスを指定して SDK を追加します：

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

SDK は npm パッケージ [`remote-webview-debugger`](sdk/README.ja.md) です。上記のように jsDelivr から読み込むほか、unpkg（`https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`）からも読み込めます。`npm install remote-webview-debugger` して `import { run } from 'remote-webview-debugger'` することもできます。ゲートウェイ自身も、埋め込んでいるコピーを `/v1/sdk.js` で配信しています。

アプリでは、同じスクリプトをネイティブコードからドキュメント開始時に注入します（iOS は `WKUserScript`、Android は `addDocumentStartJavaScript`）。[ネイティブ統合](docs/native-integration.ja.md)と、管理コンソールに組み込まれたガイドを参照してください。

### 3. エージェントを接続する

管理コンソールで API キーを作成し（1 つのキーですべての端末に届きます）、次を実行します：

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…そしてこう頼みます：*「デバイス K7Q2-9M4X に接続して、決済の合計金額が `--` と表示される原因を調べて」*

### HTTP か HTTPS か

ゲートウェイは平文の HTTP で通信し、そのままでも問題なく動作します。SDK はゲートウェイのアドレスに応じて `ws://` と `wss://` を選び、管理コンソールと MCP もどちらでも動きます。決め手になるのは**デバッグするページ**です。ブラウザや WebView は、`https://` のページが `http://` のスクリプトを読み込んだり `ws://` 接続を開いたりすること（混在コンテンツ）を許可しません。`sdk.js` 自体を HTTPS の CDN から読み込んでいても同じです。

| デバッグするページ | 平文 HTTP のゲートウェイ |
|---|---|
| `http://`：ローカル開発サーバー、社内ネットワークのテスト環境 | ✅ 動作します |
| ブラウザまたは iOS の `WKWebView` 内の `https://` | ❌ 混在コンテンツとしてブロックされます：ゲートウェイを HTTPS にしてください |
| Android WebView 内の `https://` | ⚠️ アプリが `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)` を呼んでいる場合のみ。デバッグビルドに限ります |

平文 HTTP では API キーや管理コンソールのパスワードが暗号化されずに流れるため、信頼できるネットワーク内だけで使ってください。HTTPS にするには、[Compose 構成](deploy/platform/README.ja.md)を `RWD_DOMAIN=<host>` 付きで起動する（証明書は自動取得）か、コンテナを自前の TLS プロキシの背後に置いて `-e RWD_TRUST_PROXY=1` を追加します。

## 機能

- **デバイス中心。** 1 台のデバイス（アプリの 1 インストール、または 1 つのブラウザ）は複数のページを持ちます。1 つの API キーと 1 つの MCP サーバーですべての端末に届きます。エージェントは遷移や新しく開いた WebView を追いかけ、ページをまたいだタイムラインを参照できます。
- **エージェント向けツール。** 要素 ref 付きのアクセシビリティスナップショット（Playwright の aria snapshot）、検索、クリック、フォーム入力、文字入力、キー押下、選択、ホバー、スクロール、ドラッグ、ナビゲーション、スクリプト実行、console、ボディ付きのネットワーク、ストレージ、スクリーンショット（ネイティブブリッジまたは DOM）、一括操作、待機とイベント。
- **同意と主導権。** レベル（`observe` / `interact` / `advanced`）付きの端末上での承認、任意の自動許可、エージェント操作中の画面ロック、引き継ぐ / AI に戻す / 終了、センシティブな操作の確認（`data-rwd-confirm`）。
- **プライバシー。** パスワード欄、`data-rwd-mask`、設定可能なセレクターやパターンは、スナップショット、スクリーンショット、console、ネットワークのデータ上でマスクされます。監査ログは誰が何をしたかを記録し、ページの内容は記録しません。
- **運用。** メンバーとロール、レベル・有効期限・IP 許可リスト付きの API キー、デバイストークン、QR コードによる招待、クォータ、SSE によるリアルタイムの管理コンソール、Prometheus メトリクス。
- **11 言語対応、スタイルも自由に。** 管理コンソール、スマートフォン側の UI、エージェント向けのテキストは、英語、簡体字中国語、繁体字中国語、フランス語、スペイン語、ロシア語、アラビア語（右から左）、日本語、韓国語、ドイツ語、ポルトガル語に対応しています。管理コンソールはブラウザの言語に従い（切り替えも可能）、スマートフォン側の UI は端末の言語または `run({ lang })` に、エージェント側は `RWD_LANG` に従います。ページ SDK には独自の言語パックや文言を追加でき、CSS 変数で見た目を変えられます（[SDK の言語とスタイル](sdk/README.ja.md#言語)）。
- **eruda と共存できます。** eruda の中に Remote Debugger タブを追加でき、開発者向けに必要に応じて eruda を読み込むこともできます。

## リポジトリ構成

| パス | 内容 |
|---|---|
| [`gateway/`](gateway) | Go 製ゲートウェイ：ページ WebSocket、REST と管理コンソールの認証、MCP サーバー、監査、メトリクス |
| [`sdk/`](sdk) | ページ SDK（`sdk.js`）とそのページ内 UI |
| [`packages/chobitsu/`](packages/chobitsu) | ベンダリングした [chobitsu](https://github.com/liriliri/chobitsu) と、`src/engine/` にある独自のページ側エンジン |
| [`console/`](console) | 管理コンソール（React、Vite） |
| [`website/`](website) | インタラクティブなデモ付きの [debugger.site](https://debugger.site) |
| [`examples/`](examples) | 複数ページのデモショップと、iOS アプリと同じように WKWebView をホストする macOS アプリ |
| [`deploy/platform/`](deploy/platform) | Docker Compose によるデプロイ |
| [`docs/`](docs) | [アーキテクチャ](docs/architecture.ja.md)、[プロトコル](docs/protocol.ja.md)、[ネイティブ統合](docs/native-integration.ja.md)、[リリース手順](docs/releasing.ja.md) |

## リリース

ページ SDK とゲートウェイは別々にリリースされ、それぞれ独自のバージョン、タグ（`sdk-vX.Y.Z`、`gateway-vX.Y.Z`）、変更履歴を持ちます：[SDK](sdk/CHANGELOG.md)、[ゲートウェイ](gateway/CHANGELOG.md)。ゲートウェイのリリースには Linux と macOS 用の `rwd` バイナリと、イメージ `ghcr.io/zanel1u/remote-webview-debugger` が含まれます。[GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) を参照してください。メンテナー向けには[リリース手順](docs/releasing.ja.md)があります。

## 開発

```bash
make -j16 check                                      # ゲートウェイのテスト、SDK の型チェックと Playwright テスト、管理コンソールのビルド
cd console && PORT=8080 npm run mock & npm run dev   # インメモリのモックゲートウェイに対して管理コンソールを起動
cd website && npm run dev                            # Web サイト
```

## 謝辞

ページ側エンジンは、console とネットワークの取得に [chobitsu](https://github.com/liriliri/chobitsu)（MIT）を土台とし、[Playwright](https://github.com/microsoft/playwright) のアクセシビリティスナップショットのコード（Apache-2.0）を使用しています。[NOTICE](NOTICE) を参照してください。

## ライセンス

[MIT](LICENSE)
