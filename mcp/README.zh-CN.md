<!-- i18n-source: 4c1d07f81a9ad2916a55470637b38ed6f66dea99 -->
[English](README.md) | 简体中文 | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD MCP 服务（`mcp/`）

`remote-webview-debugger-mcp` 让任何 MCP agent——Cursor、Codex、Gemini CLI、Windsurf、Cline、VS Code、opencode、Claude Code、Claude Desktop——连接到一个或多个 Remote WebView Debugger 网关。agent 把它当作本地 stdio MCP 服务启动；它带着你的 API Key，把每次工具调用转发到网关的 MCP 端点（`/v1/mcp`）。

- **所有 agent，一条命令。** `npx -y remote-webview-debugger-mcp`。不用安装，没有运行时依赖。
- **多个网关。** 想配几个网关就配几个，每个有自己的地址和 API Key。所有网关的设备出现在同一个列表里，并标明所属网关。
- **扛得住重启。** 网关重启或网络断开时，服务会建立新会话；如果调用还没到达网关，就重新发送一次。
- **Key 不写进 agent 配置。** 网关和 Key 放在一个只有你能读的文件里，每个 agent 的配置里只有那条 `npx` 命令。

支持 HTTP 方式 MCP 的 agent 也可以直接连接网关（见[主 README](../README.zh-CN.md#3-接入你的-agent)）。这个包适用于只能运行本地服务的 agent、需要连接多个网关的场景，以及不想把 Key 写进 agent 配置的情况。

## 快速开始

在网关的控制台创建一个 API Key（API Key 页面；一个 Key 可以访问所有设备），然后运行：

```bash
npx -y remote-webview-debugger-mcp init
```

`init` 会询问网关地址和 API Key，并到网关上验证。然后它把 MCP 服务加到这台机器上找到的 agent 里，并询问是否安装 agent skill。重启 agent，然后问它：*「列出在线设备」*。它跟随终端的语言显示（用 `--lang` 可以换），agent 在列表里勾选即可。

`init` 会改动的内容：

| | |
|---|---|
| 网关和 Key | `~/.config/remote-webview-debugger/mcp.json`（权限 0600；Windows 上是 `%APPDATA%\remote-webview-debugger\mcp.json`） |
| agent | 以 `remote-webview-debugger` 为名把服务加到每个 agent 自己的 MCP 配置里，并把原文件备份为 `<file>.bak`。带注释的文件不会被改动，而是给出一段配置让你自己粘贴 |
| skill | 你同意的话，执行 `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g` |

再次运行 `init` 可以添加另一个网关或另一个 agent。已有的网关会保留，同名的网关会被替换。

## agent skill

这个 skill 告诉 agent 什么时候用 Remote WebView Debugger、怎么用：连接、在手机上审批、`set_task`、操作前先拍快照，以及如何排查 bug。它遵循 [Agent Skills](https://agentskills.io) 格式，用 [`skills`](https://github.com/vercel-labs/skills) 安装：

```bash
npx skills add zanel1u/remote-webview-debugger
```

`skills add` 只安装 skill；MCP 服务来自 `init`（或下面的插件）。skill 知道这一点：工具不存在时，它会让 agent 请你运行 `init`。npm 包的 `skills/` 目录里也带有这个 skill。

**插件**会同时安装 MCP 服务和 skill。仍然要运行一次 `init`，好让服务知道你的网关：

- **Claude Code：** `/plugin marketplace add ZaneL1u/remote-webview-debugger`，然后 `/plugin install remote-webview-debugger@remote-webview-debugger`。
- **Gemini CLI：** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`。

## 手动配置 agent

所有 agent 运行的都是同一条命令：`npx -y remote-webview-debugger-mcp@latest`。带上 `@latest`，agent 启动时 npx 就会用上新版本；服务的工具跟随网关。Windows 上请用 `"command": "cmd"` 加 `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`。

网关的等待类工具（`wait_for_device`、`wait_for_control`……）最长可能运行 10 分钟。agent 有工具超时设置的，下面的配置把它调到 660 秒。

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

`~/.gemini/settings.json`（`timeout` 单位是毫秒）：

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

VS Code：用户级 `mcp.json`（命令 **MCP: Open User Configuration**）里是 `servers`，每一项带 `"type": "stdio"`。Cline：**MCP Servers → Configure** 会打开 `cline_mcp_settings.json`，格式与上面的 `mcpServers` 相同，另加 `"timeout": 660`（单位是秒）。

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

## 网关

`init` 会替你写好配置文件，你也可以手动编辑：

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` 是网关地址。`https://rwd.example.com`、`…/v1` 和 `…/v1/mcp` 都可以。
- 每个网关要么有 `apiKey`，要么有 `apiKeyEnv`，指向存放 Key 的环境变量名。
- 网关名只能用小写字母、数字、`-` 和 `_`。agent 看到的就是这些名字。

也可以用环境变量代替配置文件，或者叠加在它之上。环境变量里设置的网关会替换配置文件中同名的网关。在 agent 的 MCP 配置（`env`）里设置，或者在启动 agent 的 shell 里设置：

| 变量 | 含义 |
|---|---|
| `RWD_CONFIG` | 另一个配置文件（或 `--config <file>`） |
| `RWD_URL`、`RWD_API_KEY` | 一个网关，名为 `default`（或 `RWD_NAME`） |
| `RWD_GATEWAYS` | 多个网关：`prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | `RWD_GATEWAYS` 里各个网关的 Key（`RWD_API_KEY_PROD`、`RWD_API_KEY_LAB`） |

## 多个网关

只有一个网关时，服务原样透传工具和结果。有多个网关时：

- `list_devices` 同时询问所有网关，把设备分组列在 `## <gateway> (<host>)` 下面。宕机或拒绝 Key 的网关会在那里显示错误，其他网关照常返回。传入 `gateway` 则只问其中一个。
- `connect_device` 和 `wait_for_device` 接受可选的 `gateway`，或者写成 `<gateway>:<code>` 形式的设备（`prod:K7Q2-9M4X`）。两者都没有时，服务会在所有网关上查找这个设备码，用有它的那个网关。如果多个网关上都有这个设备码，或者设备是用 deviceId 指定的，会让 agent 指明网关。
- `connect_device` 之后，其他所有工具都发往该设备所在的网关，结果以 `[gateway: <name> (<host>)]` 开头。连接另一个网关上的设备时，会先断开之前的设备，免得那台手机一直被锁着。
- `list_gateways`（只有一个网关时也能用）显示每个网关的地址、版本和状态，以及当前连接的设备在哪个网关上。

## 命令

```bash
npx -y remote-webview-debugger-mcp                 # stdio MCP 服务（agent 运行的就是它）
npx -y remote-webview-debugger-mcp init            # 添加网关、配置 agent、安装 skill
npx -y remote-webview-debugger-mcp doctor          # 检查每个网关和 Key；列出找到的 agent
```

`init` 也可以不提问直接运行，适合脚本和团队的配置文档：

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| 选项 | 含义 |
|---|---|
| `--gateway [name=]<url>` | 要添加的网关（可重复）。不写名字时按主机名生成一个 |
| `--api-key <key>` | 它的 API Key（只有一个网关时）。否则依次取 `RWD_API_KEY_<NAME>`、`RWD_API_KEY`，或者提示输入 |
| `--api-key-env <VAR>` | 保存「从 `VAR` 读取 Key」，而不是 Key 本身 |
| `--clients <ids>` | `claude-code`、`cursor`、`codex`、`gemini`、`windsurf`、`cline`、`vscode`、`opencode`、`claude-desktop`，或 `all`、`detected`、`none` |
| `--skill`、`--no-skill` | 安装或不安装 skill（默认询问；带 `-y` 时不安装） |
| `--name <name>` | 服务在 agent 配置里的名字（默认 `remote-webview-debugger`） |
| `--config <file>` | 另一个配置文件。同一次运行里配置的 agent 会带上 `RWD_CONFIG` |
| `--no-verify` | 保存前不验证网关和 Key |
| `-y`、`--yes` | 不提问：配置找到的 agent，除非带 `--skill`，否则不装 skill |

## 故障排查

- **agent 里没有 Remote WebView Debugger 的工具。** `init` 之后要重启 agent。运行 `npx -y remote-webview-debugger-mcp doctor`，检查配置文件和网关是否正常。
- **「rejected the API key」。** Key 被吊销、已过期，或者它的所有者已被移除。在控制台新建一个 Key，用同一个网关名再运行一次 `init`。
- **第一次启动很慢。** npx 第一次会下载这个包，每次有新版本后也会重新下载。之后的启动会用 npx 的缓存。
- **调用 60 秒后超时。** agent 自己的工具超时太短。按[手动配置 agent](#手动配置-agent)里的方法调大。

## 版本

这个包的版本号与网关相同，随网关一起发布（`gateway-vX.Y.Z`，见[发版流程](../docs/releasing.zh-CN.md)）。任何版本都能配合任何网关使用：工具是运行时从网关获取的。

## 开发

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs，单个文件，没有运行时依赖
npm test            # 先构建，再针对两个模拟网关运行单元测试和端到端测试
node dist/cli.mjs doctor
```
