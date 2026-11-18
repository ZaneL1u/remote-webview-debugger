<!-- i18n-source: 656f4e4e2fa8dd72e4182a210aba6a469d4d348c -->
[English](README.md) | [简体中文](README.zh-CN.md) | 繁體中文 | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD MCP 伺服器（`mcp/`）

`remote-webview-debugger-mcp` 讓任何 MCP agent——Cursor、Codex、Gemini CLI、Windsurf、Cline、VS Code、opencode、Claude Code、Claude Desktop——連接到一個或多個 Remote WebView Debugger 閘道。agent 把它當作本機 stdio MCP 伺服器啟動；它會帶著你的 API 金鑰，把每次工具呼叫轉送到閘道的 MCP 端點（`/v1/mcp`）。

- **所有 agent，一行指令。** `npx -y remote-webview-debugger-mcp`。不需要安裝，沒有執行期相依套件。
- **多個閘道。** 想設定幾個閘道都可以，每個都有自己的位址和 API 金鑰。所有閘道的裝置會出現在同一個清單裡，並標示所屬閘道。
- **撐得過重新啟動。** 閘道重新啟動或網路中斷時，伺服器會建立新的工作階段；如果呼叫還沒送達閘道，就再送一次。
- **金鑰不寫進 agent 設定。** 閘道和金鑰存放在一個只有你能讀取的檔案裡，每個 agent 的設定中只有那行 `npx` 指令。

支援以 HTTP 傳輸 MCP 的 agent 也可以直接連接閘道（請見[主 README](../README.zh-TW.md#3-連接你的-agent)）。這個套件適用於只能執行本機伺服器的 agent、需要連接多個閘道的情境，以及不想把金鑰寫進 agent 設定的情況。

## 快速開始

在閘道的主控台建立一把 API 金鑰（API 金鑰頁面；一把金鑰就能存取所有裝置），然後執行：

```bash
npx -y remote-webview-debugger-mcp init
```

`init` 會詢問閘道位址和 API 金鑰，並向閘道驗證。接著它會把 MCP 伺服器加到這台電腦上找到的 agent 裡，並詢問是否安裝 agent skill。重新啟動 agent，然後問它：*「列出線上裝置」*。

`init` 會變更的內容：

| | |
|---|---|
| 閘道和金鑰 | `~/.config/remote-webview-debugger/mcp.json`（權限 0600；Windows 上是 `%APPDATA%\remote-webview-debugger\mcp.json`） |
| agent | 以 `remote-webview-debugger` 為名把伺服器加到每個 agent 自己的 MCP 設定中，並把原檔案備份為 `<file>.bak`。含有註解的檔案不會被更動，而是提供一段設定讓你自行貼上 |
| skill | 若你同意，執行 `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g` |

再次執行 `init` 可以新增另一個閘道或另一個 agent。既有的閘道會保留，同名的閘道會被取代。

## agent skill

這個 skill 告訴 agent 何時使用 Remote WebView Debugger 以及如何使用：連線、在手機上核准、`set_task`、操作前先取得快照，以及如何調查 bug。它遵循 [Agent Skills](https://agentskills.io) 格式，用 [`skills`](https://github.com/vercel-labs/skills) 安裝：

```bash
npx skills add zanel1u/remote-webview-debugger
```

`skills add` 只會安裝 skill；MCP 伺服器來自 `init`（或下方的外掛）。skill 知道這一點：工具不存在時，它會讓 agent 請你執行 `init`。npm 套件的 `skills/` 目錄中也附有這個 skill。

**外掛**會同時安裝 MCP 伺服器和 skill。仍然請執行一次 `init`，讓伺服器知道你的閘道：

- **Claude Code：** `/plugin marketplace add ZaneL1u/remote-webview-debugger`，然後 `/plugin install remote-webview-debugger@remote-webview-debugger`。
- **Gemini CLI：** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`。

## 手動設定 agent

所有 agent 執行的都是同一行指令：`npx -y remote-webview-debugger-mcp@latest`。加上 `@latest`，agent 啟動時 npx 就會取得新版本；伺服器的工具跟隨閘道。在 Windows 上請使用 `"command": "cmd"` 搭配 `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`。

閘道的等待類工具（`wait_for_device`、`wait_for_control`……）最長可能執行 10 分鐘。agent 有工具逾時設定的，下面的設定會把它調高到 660 秒。

### Cursor、Windsurf、Claude Desktop

`~/.cursor/mcp.json`、`~/.codeium/windsurf/mcp_config.json` 或 `claude_desktop_config.json`：

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

`~/.gemini/settings.json`（`timeout` 單位為毫秒）：

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

### VS Code（GitHub Copilot）和 Cline

VS Code：使用者層級的 `mcp.json`（指令 **MCP: Open User Configuration**）使用 `servers`，每一項都帶有 `"type": "stdio"`。Cline：**MCP Servers → Configure** 會開啟 `cline_mcp_settings.json`，格式與上方的 `mcpServers` 相同，另加 `"timeout": 660`（單位為秒）。

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

## 閘道

`init` 會替你寫好設定檔，你也可以手動編輯：

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` 是閘道位址。`https://rwd.example.com`、`…/v1` 和 `…/v1/mcp` 都可以。
- 每個閘道要嘛有 `apiKey`，要嘛有 `apiKeyEnv`，指向存放金鑰的環境變數名稱。
- 閘道名稱只能使用小寫字母、數字、`-` 和 `_`。agent 看到的就是這些名稱。

也可以用環境變數取代設定檔，或疊加在設定檔之上。環境變數中設定的閘道會取代設定檔中同名的閘道。請在 agent 的 MCP 設定（`env`）中設定，或在啟動 agent 的 shell 中設定：

| 變數 | 意義 |
|---|---|
| `RWD_CONFIG` | 另一個設定檔（或 `--config <file>`） |
| `RWD_URL`、`RWD_API_KEY` | 一個閘道，名為 `default`（或 `RWD_NAME`） |
| `RWD_GATEWAYS` | 多個閘道：`prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | `RWD_GATEWAYS` 中各個閘道的金鑰（`RWD_API_KEY_PROD`、`RWD_API_KEY_LAB`） |

## 多個閘道

只有一個閘道時，伺服器會原封不動地轉送工具和結果。有多個閘道時：

- `list_devices` 會同時詢問所有閘道，把裝置分組列在 `## <gateway> (<host>)` 底下。離線或拒絕金鑰的閘道會在那裡顯示錯誤，其他閘道照常回應。傳入 `gateway` 則只詢問其中一個。
- `connect_device` 和 `wait_for_device` 接受選用的 `gateway`，或寫成 `<gateway>:<code>` 形式的裝置（`prod:K7Q2-9M4X`）。兩者都沒有時，伺服器會在所有閘道上查找這個裝置碼，並使用擁有它的那個閘道。如果多個閘道上都有這個裝置碼，或裝置是以 deviceId 指定的，會請 agent 指明閘道。
- `connect_device` 之後，其他所有工具都會送往該裝置所在的閘道，結果以 `[gateway: <name> (<host>)]` 開頭。連接另一個閘道上的裝置時，會先中斷先前的裝置，以免那支手機一直被鎖住。
- `list_gateways`（只有一個閘道時也能使用）會顯示每個閘道的位址、版本和狀態，以及目前連接的裝置位於哪個閘道。

## 指令

```bash
npx -y remote-webview-debugger-mcp                 # stdio MCP 伺服器（agent 執行的就是它）
npx -y remote-webview-debugger-mcp init            # 新增閘道、設定 agent、安裝 skill
npx -y remote-webview-debugger-mcp doctor          # 檢查每個閘道和金鑰；列出找到的 agent
```

`init` 也可以不提問直接執行，適合腳本和團隊的設定文件：

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| 選項 | 意義 |
|---|---|
| `--gateway [name=]<url>` | 要新增的閘道（可重複）。未指定名稱時依主機名稱產生一個 |
| `--api-key <key>` | 它的 API 金鑰（只有一個閘道時）。否則依序取自 `RWD_API_KEY_<NAME>`、`RWD_API_KEY`，或提示輸入 |
| `--api-key-env <VAR>` | 儲存「從 `VAR` 讀取金鑰」，而不是金鑰本身 |
| `--clients <ids>` | `claude-code`、`cursor`、`codex`、`gemini`、`windsurf`、`cline`、`vscode`、`opencode`、`claude-desktop`，或 `all`、`detected`、`none` |
| `--skill`、`--no-skill` | 安裝或不安裝 skill（預設會詢問；加上 `-y` 時不安裝） |
| `--name <name>` | 伺服器在 agent 設定中的名稱（預設 `remote-webview-debugger`） |
| `--config <file>` | 另一個設定檔。同一次執行中設定的 agent 會帶上 `RWD_CONFIG` |
| `--no-verify` | 儲存前不驗證閘道和金鑰 |
| `-y`、`--yes` | 不提問：設定找到的 agent，除非加上 `--skill`，否則不安裝 skill |

## 疑難排解

- **agent 裡沒有 Remote WebView Debugger 的工具。** `init` 之後請重新啟動 agent。執行 `npx -y remote-webview-debugger-mcp doctor`，確認設定檔和閘道都正常。
- **「rejected the API key」。** 金鑰已被撤銷、已過期，或其擁有者已被移除。在主控台建立一把新的金鑰，再用同一個閘道名稱執行一次 `init`。
- **第一次啟動很慢。** npx 第一次會下載這個套件，每次有新版本後也會重新下載。之後的啟動會使用 npx 的快取。
- **呼叫 60 秒後逾時。** agent 自己的工具逾時太短。請依[手動設定 agent](#手動設定-agent)中的方式調高。

## 版本

這個套件的版本號與閘道相同，並隨閘道一起發布（`gateway-vX.Y.Z`，請見[發布流程](../docs/releasing.zh-TW.md)）。任何版本都能搭配任何閘道使用：工具是在執行時從閘道取得的。

## 開發

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs，單一檔案，沒有執行期相依套件
npm test            # 先建置，再針對兩個模擬閘道執行單元測試和端對端測試
node dist/cli.mjs doctor
```
