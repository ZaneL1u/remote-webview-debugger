<!-- i18n-source: 1de93768d1f6453d5cd81a0a70e3d0d7449a8e4e -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD MCP サーバー（`mcp/`）

`remote-webview-debugger-mcp` は、任意の MCP エージェント（Cursor、Codex、Gemini CLI、Windsurf、Cline、VS Code、opencode、Claude Code、Claude Desktop）を 1 つまたは複数の Remote WebView Debugger ゲートウェイにつなぎます。エージェントはこれをローカルの stdio MCP サーバーとして起動し、サーバーはすべてのツール呼び出しを API キー付きでゲートウェイの MCP エンドポイント（`/v1/mcp`）に転送します。

- **どのエージェントもコマンド 1 つ。** `npx -y remote-webview-debugger-mcp`。インストール不要で、実行時の依存もありません。
- **複数のゲートウェイ。** ゲートウェイはいくつでも設定でき、それぞれに独自のアドレスと API キーを持たせられます。すべてのゲートウェイのデバイスが、ゲートウェイ名のラベル付きで 1 つの一覧に表示されます。
- **再起動にも耐えます。** ゲートウェイが再起動したりネットワークが切れたりすると、サーバーは新しいセッションを開き、ゲートウェイに届かなかった呼び出しを送り直します。
- **キーをエージェントの設定に書きません。** ゲートウェイとキーは、自分だけが読める 1 つのファイルに保存されます。各エージェントの設定には `npx` コマンドだけが書かれます。

HTTP 経由の MCP に対応したエージェントは、ゲートウェイに直接接続することもできます（[メインの README](../README.ja.md#3-エージェントを接続する) を参照）。このパッケージは、ローカルサーバーしか動かせないエージェント、複数のゲートウェイを使う場合、そしてエージェントの設定にキーを書きたくない場合のためのものです。

## クイックスタート

ゲートウェイの管理コンソールで API キーを作成し（API キー。1 つのキーですべてのデバイスに届きます）、次を実行します：

```bash
npx -y remote-webview-debugger-mcp init
```

`init` はゲートウェイのアドレスと API キーを尋ね、それをゲートウェイに照会して確認します。続いて、このマシンで見つかったエージェントに MCP サーバーを追加し、エージェントスキルのインストールを提案します。エージェントを再起動して、こう頼んでください：*「オンラインのデバイスを一覧表示して」*。

`init` が変更するもの：

| | |
|---|---|
| ゲートウェイとキー | `~/.config/remote-webview-debugger/mcp.json`（モード 0600。Windows では `%APPDATA%\remote-webview-debugger\mcp.json`） |
| エージェント | 各エージェント自身の MCP 設定にサーバーを `remote-webview-debugger` として追加し、元のファイルを `<file>.bak` としてバックアップします。コメントを含むファイルには手を付けず、代わりに貼り付け用のスニペットを表示します |
| スキル | 同意した場合は `npx skills add ZaneL1u/remote-webview-debugger --skill remote-webview-debugger -g` |

別のゲートウェイや別のエージェントを追加するには、`init` をもう一度実行します。既存のゲートウェイは残り、同じ名前のゲートウェイは置き換えられます。

## エージェントスキル

スキルは、Remote WebView Debugger をいつ、どう使うかをエージェントに教えます：接続、スマートフォンでの承認、`set_task`、操作前のスナップショット、不具合の調べ方。[Agent Skills](https://agentskills.io) 形式に従っており、[`skills`](https://github.com/vercel-labs/skills) でインストールします：

```bash
npx skills add ZaneL1u/remote-webview-debugger
```

`skills add` がインストールするのはスキルだけで、MCP サーバーは `init`（または後述のプラグイン）から入ります。スキルはこのことを知っていて、ツールが見つからないときは、`init` を実行するようあなたに頼むようエージェントに伝えます。スキルは npm パッケージの `skills/` にも含まれています。

**プラグイン**は MCP サーバーとスキルをまとめてインストールします。それでも、サーバーがゲートウェイを知るように、`init` を一度は実行してください：

- **Claude Code：** `/plugin marketplace add ZaneL1u/remote-webview-debugger` の後に `/plugin install remote-webview-debugger@remote-webview-debugger`。
- **Gemini CLI：** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`。

## エージェントを手動で設定する

どのエージェントも同じコマンド `npx -y remote-webview-debugger-mcp@latest` を実行します。`@latest` を付けると、エージェントの起動時に npx が新しいバージョンを取得します。サーバーのツールはゲートウェイのツールに従います。Windows では `"command": "cmd"` と `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]` を使ってください。

ゲートウェイの待機ツール（`wait_for_device`、`wait_for_control` など）は最大 10 分かかることがあります。ツールのタイムアウトがあるエージェントでは、以下のスニペットでそれを 660 秒に引き上げています。

### Cursor、Windsurf、Claude Desktop

`~/.cursor/mcp.json`、`~/.codeium/windsurf/mcp_config.json`、または `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "remote-webview-debugger": {
      "command": "npx",
      "args": ["-y", "remote-webview-debugger-mcp@latest"]
    }
  }
}
```

### Codex

`~/.codex/config.toml`：

```toml
[mcp_servers.remote-webview-debugger]
command = "npx"
args = ["-y", "remote-webview-debugger-mcp@latest"]
startup_timeout_sec = 30
tool_timeout_sec = 660
```

### Gemini CLI

`~/.gemini/settings.json`（`timeout` はミリ秒）：

```json
{
  "mcpServers": {
    "remote-webview-debugger": {
      "command": "npx",
      "args": ["-y", "remote-webview-debugger-mcp@latest"],
      "timeout": 660000
    }
  }
}
```

### VS Code（GitHub Copilot）と Cline

VS Code：ユーザーの `mcp.json`（コマンド **MCP: Open User Configuration**）には `servers` があり、それぞれに `"type": "stdio"` を指定します。Cline：**MCP Servers → Configure** で `cline_mcp_settings.json` が開きます。これは上の `mcpServers` 形式に `"timeout": 660`（秒）を加えたものを受け付けます。

```json
{
  "servers": {
    "remote-webview-debugger": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "remote-webview-debugger-mcp@latest"]
    }
  }
}
```

### opencode

`~/.config/opencode/opencode.json`：

```json
{
  "mcp": {
    "remote-webview-debugger": {
      "type": "local",
      "command": ["npx", "-y", "remote-webview-debugger-mcp@latest"],
      "enabled": true
    }
  }
}
```

### Claude Code

```bash
claude mcp add -s user remote-webview-debugger -- npx -y remote-webview-debugger-mcp@latest
```

## ゲートウェイ

設定ファイルは `init` が書き込みます。手で編集することもできます：

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` はゲートウェイのアドレスです。`https://rwd.example.com`、`…/v1`、`…/v1/mcp` のいずれも使えます。
- 各ゲートウェイには `apiKey`、またはキーを保持する環境変数の名前を指す `apiKeyEnv` のどちらかを指定します。
- ゲートウェイ名には英小文字、数字、`-`、`_` が使えます。エージェントにはこの名前が見えます。

ファイルの代わりに、またはファイルに加えて環境変数も使えます。環境変数で設定したゲートウェイは、ファイル内の同じ名前のゲートウェイを置き換えます。エージェントの MCP 設定（`env`）か、エージェントを起動するシェルで設定してください：

| 変数 | 意味 |
|---|---|
| `RWD_CONFIG` | 別の設定ファイル（または `--config <file>`） |
| `RWD_URL`、`RWD_API_KEY` | `default`（または `RWD_NAME`）という名前のゲートウェイ 1 つ |
| `RWD_GATEWAYS` | 複数のゲートウェイ：`prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | `RWD_GATEWAYS` の各ゲートウェイのキー（`RWD_API_KEY_PROD`、`RWD_API_KEY_LAB`） |

## 複数のゲートウェイ

ゲートウェイが 1 つなら、サーバーはツールと結果をそのまま中継します。複数ある場合は次のようになります：

- `list_devices` はすべてのゲートウェイに同時に問い合わせ、デバイスを `## <gateway> (<host>)` の下にまとめます。停止中のゲートウェイやキーを拒否したゲートウェイはそこにエラーを表示し、他のゲートウェイはそのまま応答します。1 つだけに問い合わせるには `gateway` を渡します。
- `connect_device` と `wait_for_device` は省略可能な `gateway` を受け取るほか、デバイスを `<gateway>:<code>`（`prod:K7Q2-9M4X`）の形で書くこともできます。どちらもなければ、サーバーはすべてのゲートウェイでデバイスコードを探し、それを持つゲートウェイを使います。コードが複数のゲートウェイにある場合や、デバイスが deviceId で指定された場合は、エージェントにゲートウェイ名を指定するよう求めます。
- `connect_device` の後は、他のすべてのツールがそのデバイスのゲートウェイに送られ、結果は `[gateway: <name> (<host>)]` で始まります。別のゲートウェイのデバイスに接続すると前のデバイスからは切断されるので、そのスマートフォンがロックされたまま残ることはありません。
- `list_gateways`（ゲートウェイが 1 つでも使えます）は、各ゲートウェイのアドレス、バージョン、状態と、接続中のデバイスがどのゲートウェイにあるかを表示します。

## コマンド

```bash
npx -y remote-webview-debugger-mcp                 # stdio MCP サーバー（エージェントが実行するもの）
npx -y remote-webview-debugger-mcp init            # ゲートウェイを追加し、エージェントを設定し、スキルをインストール
npx -y remote-webview-debugger-mcp doctor          # すべてのゲートウェイとキーを確認し、見つかったエージェントを一覧表示
```

`init` は質問なしでも実行でき、スクリプトやチーム向けのセットアップ手順に使えます：

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| オプション | 意味 |
|---|---|
| `--gateway [name=]<url>` | 追加するゲートウェイ（繰り返し指定可）。名前がなければホストから作ります |
| `--api-key <key>` | その API キー（ゲートウェイ 1 つの場合）。指定しなければ `RWD_API_KEY_<NAME>`、`RWD_API_KEY`、またはプロンプトから |
| `--api-key-env <VAR>` | キーそのものではなく「`VAR` からキーを読む」ことを保存します |
| `--clients <ids>` | `claude-code`、`cursor`、`codex`、`gemini`、`windsurf`、`cline`、`vscode`、`opencode`、`claude-desktop`、または `all`、`detected`、`none` |
| `--skill`、`--no-skill` | スキルをインストールする / しない（デフォルト：尋ねる。`-y` のとき：しない） |
| `--name <name>` | エージェントの設定でのサーバー名（デフォルト `remote-webview-debugger`） |
| `--config <file>` | 別の設定ファイル。同じ実行で設定したエージェントには `RWD_CONFIG` が渡されます |
| `--no-verify` | ゲートウェイとキーを確認せずに保存します |
| `-y`、`--yes` | 質問なし：見つかったエージェントを設定し、`--skill` がなければスキルは入れません |

## トラブルシューティング

- **エージェントに Remote WebView Debugger のツールがない。** `init` の後にエージェントを再起動してください。`npx -y remote-webview-debugger-mcp doctor` を実行すると、設定ファイルとゲートウェイに問題がないか確認できます。
- **「rejected the API key」。** キーが取り消されたか、期限切れか、所有者が削除されています。管理コンソールで新しいキーを作成し、同じゲートウェイ名で `init` をもう一度実行してください。
- **初回の起動が遅い。** npx は初回と、新しいバージョンが出るたびにパッケージをダウンロードします。それ以降の起動では npx のキャッシュが使われます。
- **呼び出しが 60 秒でタイムアウトする。** エージェント自身のツールタイムアウトが短すぎます。[エージェントを手動で設定する](#エージェントを手動で設定する)のとおりに引き上げてください。

## バージョン

パッケージはゲートウェイと同じバージョンを持ち、ゲートウェイと一緒にリリースされます（`gateway-vX.Y.Z`。[リリース手順](../docs/releasing.ja.md)を参照）。どのバージョンもどのゲートウェイと組み合わせて使えます。ツールは実行時にゲートウェイから取得されるからです。

## 開発

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs、実行時の依存がない 1 ファイル
npm test            # ビルドしてから、2 つのモックゲートウェイに対してユニットテストと E2E テストを実行
node dist/cli.mjs doctor
```
