English | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD MCP server (`mcp/`)

`remote-webview-debugger-mcp` connects any MCP agent — Cursor, Codex, Gemini CLI, Windsurf, Cline, VS Code, opencode, Claude Code, Claude Desktop — to one or more Remote WebView Debugger gateways. The agent starts it as a local stdio MCP server; it forwards every tool call to the gateway's MCP endpoint (`/v1/mcp`) with your API key.

- **Every agent, one command.** `npx -y remote-webview-debugger-mcp`. Nothing to install, no runtime dependencies.
- **Several gateways.** Configure as many gateways as you like, each with its own address and API key. Devices from all of them show up in one list, labeled by gateway.
- **Rides out restarts.** When a gateway restarts or the network drops, the server opens a new session and sends the call again if it never reached the gateway.
- **Keys stay out of agent configs.** Gateways and keys live in one file that only you can read. Each agent's config just has the `npx` command.

Agents that support MCP over HTTP can also connect to the gateway directly (see the [main README](../README.md#3-connect-your-agent)). This package is for agents that only run local servers, for several gateways, and for a setup that doesn't put keys into agent configs.

## Quick start

Create an API key in the gateway's console (API Key; one key reaches every device), then run:

```bash
npx -y remote-webview-debugger-mcp init
```

`init` asks for the gateway address and the API key, and checks them against the gateway. Then it adds the MCP server to the agents it finds on this machine and offers to install the agent skill. Restart your agent and ask it: *"list online devices"*.

What `init` changes:

| | |
|---|---|
| Gateways and keys | `~/.config/remote-webview-debugger/mcp.json` (mode 0600; `%APPDATA%\remote-webview-debugger\mcp.json` on Windows) |
| Agents | Adds the server as `remote-webview-debugger` to each agent's own MCP config, and backs up the old file as `<file>.bak`. A file with comments isn't touched; you get the snippet to paste instead |
| Skill | `npx skills add ZaneL1u/remote-webview-debugger --skill remote-webview-debugger -g`, if you agree |

Run `init` again to add another gateway or another agent. Existing gateways are kept, and a gateway with the same name is replaced.

## The agent skill

The skill tells the agent when to use Remote WebView Debugger and how: connect, approval on the phone, `set_task`, snapshots before actions, and how to look into a bug. It follows the [Agent Skills](https://agentskills.io) format, and you install it with [`skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add ZaneL1u/remote-webview-debugger
```

`skills add` only installs the skill; the MCP server comes from `init` (or from a plugin, below). The skill knows this: when the tools are missing, it tells the agent to ask you to run `init`. The skill is also in the npm package under `skills/`.

**Plugins** install the MCP server and the skill together. Run `init` once anyway, so that the server knows your gateways:

- **Claude Code:** `/plugin marketplace add ZaneL1u/remote-webview-debugger`, then `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI:** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## Set up an agent by hand

Every agent runs the same command: `npx -y remote-webview-debugger-mcp@latest`. With `@latest`, npx picks up a new version when the agent starts; the server's tools follow the gateway's. On Windows, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`.

The gateway's wait tools (`wait_for_device`, `wait_for_control`, …) can run up to 10 minutes. Where an agent has a tool timeout, the snippets below raise it to 660 seconds.

### Cursor, Windsurf, Claude Desktop

`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, or `claude_desktop_config.json`:

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

`~/.codex/config.toml`:

```toml
[mcp_servers.remote-webview-debugger]
command = "npx"
args = ["-y", "remote-webview-debugger-mcp@latest"]
startup_timeout_sec = 30
tool_timeout_sec = 660
```

### Gemini CLI

`~/.gemini/settings.json` (`timeout` in milliseconds):

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

### VS Code (GitHub Copilot) and Cline

VS Code: the user `mcp.json` (command **MCP: Open User Configuration**) has `servers`, each with `"type": "stdio"`. Cline: **MCP Servers → Configure** opens `cline_mcp_settings.json`, which takes the `mcpServers` form above, plus `"timeout": 660` (seconds).

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

`~/.config/opencode/opencode.json`:

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

## Gateways

`init` writes the config file for you. You can also edit it by hand:

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` is the gateway's address. `https://rwd.example.com`, `…/v1` and `…/v1/mcp` all work.
- Each gateway has either an `apiKey`, or an `apiKeyEnv` that names an environment variable holding the key.
- Gateway names are lower-case letters, digits, `-` and `_`. Agents see these names.

Environment variables work instead of the file, or on top of it. A gateway set in the environment replaces a file gateway with the same name. Set them in the agent's MCP config (`env`), or in the shell that starts the agent:

| Variable | Meaning |
|---|---|
| `RWD_CONFIG` | Another config file (or `--config <file>`) |
| `RWD_URL`, `RWD_API_KEY` | One gateway, named `default` (or `RWD_NAME`) |
| `RWD_GATEWAYS` | Several gateways: `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | The key for each gateway in `RWD_GATEWAYS` (`RWD_API_KEY_PROD`, `RWD_API_KEY_LAB`) |

## Several gateways

With one gateway, the server passes tools and results through unchanged. With several:

- `list_devices` asks every gateway at once and groups the devices under `## <gateway> (<host>)`. A gateway that is down or rejects the key shows its error there, and the others still answer. Pass `gateway` to ask only one.
- `connect_device` and `wait_for_device` take an optional `gateway`, or a device written as `<gateway>:<code>` (`prod:K7Q2-9M4X`). Without either, the server looks up the device code on every gateway and uses the one that has it. If the code is on several gateways, or the device is given by deviceId, the agent is asked to name the gateway.
- After `connect_device`, every other tool goes to that device's gateway, and the result starts with `[gateway: <name> (<host>)]`. Attaching to a device on another gateway detaches from the previous one, so that phone isn't left locked.
- `list_gateways` (also available with one gateway) shows each gateway's address, version and state, and which one the attached device is on.

## Commands

```bash
npx -y remote-webview-debugger-mcp                 # the stdio MCP server (what agents run)
npx -y remote-webview-debugger-mcp init            # add gateways, set up agents, install the skill
npx -y remote-webview-debugger-mcp doctor          # check every gateway and key; list the agents found
```

`init` also runs without questions, for scripts and team setup docs:

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| Option | Meaning |
|---|---|
| `--gateway [name=]<url>` | A gateway to add (repeatable). Without a name, one is made from the host |
| `--api-key <key>` | Its API key (one gateway). Otherwise from `RWD_API_KEY_<NAME>`, `RWD_API_KEY`, or a prompt |
| `--api-key-env <VAR>` | Store "read the key from `VAR`" instead of the key itself |
| `--clients <ids>` | `claude-code`, `cursor`, `codex`, `gemini`, `windsurf`, `cline`, `vscode`, `opencode`, `claude-desktop`, or `all`, `detected`, `none` |
| `--skill`, `--no-skill` | Install the skill, or don't (default: ask; with `-y`: don't) |
| `--name <name>` | The server's name in the agents' configs (default `remote-webview-debugger`) |
| `--config <file>` | Another config file. Agents set up in the same run get `RWD_CONFIG` |
| `--no-verify` | Save without checking the gateway and key |
| `-y`, `--yes` | No questions: set up the agents found, no skill unless `--skill` |

## Troubleshooting

- **The agent has no Remote WebView Debugger tools.** Restart the agent after `init`. Run `npx -y remote-webview-debugger-mcp doctor` to check that the config file and the gateways are fine.
- **"rejected the API key".** The key was revoked, expired, or its owner was removed. Create a new key in the console and run `init` again with the same gateway name.
- **The first start is slow.** npx downloads the package the first time, and again after each new version. Later starts use npx's cache.
- **A call times out after 60 seconds.** The agent's own tool timeout is too short. Raise it as shown in [Set up an agent by hand](#set-up-an-agent-by-hand).

## Versions

The package has the gateway's version, and is released with it (`gateway-vX.Y.Z`, see [releasing](../docs/releasing.md)). Any version works with any gateway: the tools come from the gateway at run time.

## Development

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs, one file with no runtime dependencies
npm test            # build, then unit and end-to-end tests against two mock gateways
node dist/cli.mjs doctor
```
