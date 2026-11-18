<!-- i18n-source: 656f4e4e2fa8dd72e4182a210aba6a469d4d348c -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD MCP 서버(`mcp/`)

`remote-webview-debugger-mcp`는 어떤 MCP 에이전트든 — Cursor, Codex, Gemini CLI, Windsurf, Cline, VS Code, opencode, Claude Code, Claude Desktop — 하나 이상의 Remote WebView Debugger 게이트웨이에 연결해요. 에이전트는 이것을 로컬 stdio MCP 서버로 실행하고, 서버는 모든 도구 호출을 API 키와 함께 게이트웨이의 MCP 엔드포인트(`/v1/mcp`)로 전달해요.

- **모든 에이전트에 명령 하나.** `npx -y remote-webview-debugger-mcp`. 설치할 것도, 런타임 의존성도 없어요.
- **여러 게이트웨이.** 게이트웨이를 원하는 만큼 설정할 수 있고, 각각 자체 주소와 API 키를 가져요. 모든 게이트웨이의 기기가 게이트웨이 이름이 붙은 채로 한 목록에 나타나요.
- **재시작도 문제없어요.** 게이트웨이가 재시작되거나 네트워크가 끊기면, 서버는 새 세션을 열고 게이트웨이에 닿지 못한 호출을 다시 보내요.
- **키는 에이전트 설정에 들어가지 않아요.** 게이트웨이와 키는 나만 읽을 수 있는 파일 하나에 저장돼요. 각 에이전트 설정에는 `npx` 명령만 들어가요.

HTTP로 MCP를 쓸 수 있는 에이전트는 게이트웨이에 직접 접속할 수도 있어요([메인 README](../README.ko.md#3-에이전트-연결하기) 참고). 이 패키지는 로컬 서버만 실행하는 에이전트, 여러 게이트웨이를 쓰는 경우, 그리고 에이전트 설정에 키를 넣지 않으려는 경우를 위한 거예요.

## 빠른 시작

게이트웨이의 콘솔에서 API 키를 만든 뒤(API 키, 키 하나로 모든 기기에 접근할 수 있어요) 다음을 실행하세요.

```bash
npx -y remote-webview-debugger-mcp init
```

`init`은 게이트웨이 주소와 API 키를 묻고, 게이트웨이에 확인해요. 그런 다음 이 컴퓨터에서 찾은 에이전트에 MCP 서버를 추가하고, 에이전트 스킬 설치를 제안해요. 에이전트를 다시 시작하고 이렇게 요청하세요: *“온라인 기기 목록을 보여 줘.”*

`init`이 바꾸는 것:

| | |
|---|---|
| 게이트웨이와 키 | `~/.config/remote-webview-debugger/mcp.json`(모드 0600, Windows에서는 `%APPDATA%\remote-webview-debugger\mcp.json`) |
| 에이전트 | 각 에이전트의 MCP 설정에 서버를 `remote-webview-debugger`로 추가하고, 기존 파일을 `<file>.bak`으로 백업해요. 주석이 있는 파일은 건드리지 않고, 대신 붙여 넣을 스니펫을 보여 줘요 |
| 스킬 | 동의하면 `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g` |

다른 게이트웨이나 다른 에이전트를 추가하려면 `init`을 다시 실행하세요. 기존 게이트웨이는 유지되고, 같은 이름의 게이트웨이는 교체돼요.

## 에이전트 스킬

스킬은 에이전트에게 Remote WebView Debugger를 언제, 어떻게 쓸지 알려 줘요: 연결, 휴대폰에서의 승인, `set_task`, 동작 전 스냅샷, 버그를 살펴보는 방법. [Agent Skills](https://agentskills.io) 형식을 따르고, [`skills`](https://github.com/vercel-labs/skills)로 설치해요.

```bash
npx skills add zanel1u/remote-webview-debugger
```

`skills add`는 스킬만 설치하고, MCP 서버는 `init`(또는 아래의 플러그인)으로 들어와요. 스킬도 이 사실을 알고 있어서, 도구가 없으면 `init`을 실행해 달라고 사용자에게 요청하라고 에이전트에게 알려 줘요. 스킬은 npm 패키지의 `skills/`에도 들어 있어요.

**플러그인**은 MCP 서버와 스킬을 함께 설치해요. 그래도 서버가 게이트웨이를 알 수 있도록 `init`을 한 번은 실행하세요.

- **Claude Code:** `/plugin marketplace add ZaneL1u/remote-webview-debugger` 후 `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI:** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## 에이전트 직접 설정하기

모든 에이전트는 같은 명령 `npx -y remote-webview-debugger-mcp@latest`를 실행해요. `@latest`가 있으면 에이전트가 시작될 때 npx가 새 버전을 가져와요. 서버의 도구는 게이트웨이의 도구를 따라가요. Windows에서는 `"command": "cmd"`와 `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`를 쓰세요.

게이트웨이의 대기 도구(`wait_for_device`, `wait_for_control` 등)는 최대 10분까지 걸릴 수 있어요. 도구 타임아웃이 있는 에이전트라면 아래 스니펫에서 그 값을 660초로 늘려 두었어요.

### Cursor, Windsurf, Claude Desktop

`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json` 또는 `claude_desktop_config.json`:

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

`~/.gemini/settings.json`(`timeout`은 밀리초):

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

### VS Code(GitHub Copilot)와 Cline

VS Code: 사용자 `mcp.json`(명령 **MCP: Open User Configuration**)에는 `servers`가 있고, 각각 `"type": "stdio"`를 지정해요. Cline: **MCP Servers → Configure**를 누르면 `cline_mcp_settings.json`이 열리는데, 위의 `mcpServers` 형식에 `"timeout": 660`(초)을 더해서 쓰면 돼요.

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

## 게이트웨이

설정 파일은 `init`이 대신 써 줘요. 직접 편집할 수도 있어요.

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url`은 게이트웨이 주소예요. `https://rwd.example.com`, `…/v1`, `…/v1/mcp` 모두 돼요.
- 각 게이트웨이에는 `apiKey`, 또는 키를 담은 환경 변수의 이름을 가리키는 `apiKeyEnv` 중 하나가 있어요.
- 게이트웨이 이름은 영문 소문자, 숫자, `-`, `_`로 이루어져요. 에이전트에게 이 이름이 보여요.

파일 대신, 또는 파일에 더해 환경 변수를 쓸 수도 있어요. 환경 변수로 설정한 게이트웨이는 파일에 있는 같은 이름의 게이트웨이를 대체해요. 에이전트의 MCP 설정(`env`)이나 에이전트를 실행하는 셸에서 설정하세요.

| 변수 | 의미 |
|---|---|
| `RWD_CONFIG` | 다른 설정 파일(또는 `--config <file>`) |
| `RWD_URL`, `RWD_API_KEY` | `default`(또는 `RWD_NAME`)라는 이름의 게이트웨이 하나 |
| `RWD_GATEWAYS` | 여러 게이트웨이: `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | `RWD_GATEWAYS`에 있는 각 게이트웨이의 키(`RWD_API_KEY_PROD`, `RWD_API_KEY_LAB`) |

## 여러 게이트웨이

게이트웨이가 하나면 서버는 도구와 결과를 그대로 전달해요. 여러 개라면:

- `list_devices`는 모든 게이트웨이에 한꺼번에 물어보고, 기기를 `## <gateway> (<host>)` 아래에 묶어요. 꺼져 있거나 키를 거부한 게이트웨이는 그 자리에 오류를 보여 주고, 나머지는 그대로 응답해요. 하나에만 물어보려면 `gateway`를 넘기세요.
- `connect_device`와 `wait_for_device`는 선택적인 `gateway`를 받거나, 기기를 `<gateway>:<code>`(`prod:K7Q2-9M4X`) 형태로 쓸 수 있어요. 둘 다 없으면 서버가 모든 게이트웨이에서 기기 코드를 찾아 그 코드가 있는 게이트웨이를 써요. 코드가 여러 게이트웨이에 있거나 기기를 deviceId로 지정했다면, 에이전트에게 게이트웨이 이름을 알려 달라고 해요.
- `connect_device` 이후에는 다른 모든 도구가 그 기기의 게이트웨이로 가고, 결과는 `[gateway: <name> (<host>)]`로 시작해요. 다른 게이트웨이의 기기에 연결하면 이전 기기에서는 연결이 끊기므로, 그 휴대폰이 잠긴 채로 남지 않아요.
- `list_gateways`(게이트웨이가 하나여도 쓸 수 있어요)는 각 게이트웨이의 주소, 버전, 상태와, 연결된 기기가 어느 게이트웨이에 있는지 보여 줘요.

## 명령어

```bash
npx -y remote-webview-debugger-mcp                 # stdio MCP 서버(에이전트가 실행하는 것)
npx -y remote-webview-debugger-mcp init            # 게이트웨이 추가, 에이전트 설정, 스킬 설치
npx -y remote-webview-debugger-mcp doctor          # 모든 게이트웨이와 키를 확인하고, 찾은 에이전트를 나열
```

`init`은 질문 없이도 실행돼서, 스크립트나 팀 설정 문서에 쓸 수 있어요.

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| 옵션 | 의미 |
|---|---|
| `--gateway [name=]<url>` | 추가할 게이트웨이(여러 번 지정 가능). 이름이 없으면 호스트로 만들어요 |
| `--api-key <key>` | 그 API 키(게이트웨이 하나일 때). 없으면 `RWD_API_KEY_<NAME>`, `RWD_API_KEY` 또는 프롬프트에서 받아요 |
| `--api-key-env <VAR>` | 키 자체 대신 "`VAR`에서 키를 읽기"를 저장해요 |
| `--clients <ids>` | `claude-code`, `cursor`, `codex`, `gemini`, `windsurf`, `cline`, `vscode`, `opencode`, `claude-desktop`, 또는 `all`, `detected`, `none` |
| `--skill`, `--no-skill` | 스킬을 설치하거나 설치하지 않아요(기본값: 물어봄, `-y`일 때: 설치 안 함) |
| `--name <name>` | 에이전트 설정에 쓰일 서버 이름(기본값 `remote-webview-debugger`) |
| `--config <file>` | 다른 설정 파일. 같은 실행에서 설정한 에이전트는 `RWD_CONFIG`를 받아요 |
| `--no-verify` | 게이트웨이와 키를 확인하지 않고 저장해요 |
| `-y`, `--yes` | 질문 없음: 찾은 에이전트를 설정하고, `--skill`이 없으면 스킬은 설치하지 않아요 |

## 문제 해결

- **에이전트에 Remote WebView Debugger 도구가 없어요.** `init` 후에 에이전트를 다시 시작하세요. `npx -y remote-webview-debugger-mcp doctor`를 실행하면 설정 파일과 게이트웨이에 문제가 없는지 확인할 수 있어요.
- **"rejected the API key".** 키가 폐기되었거나 만료되었거나, 키 소유자가 삭제되었어요. 콘솔에서 새 키를 만들고 같은 게이트웨이 이름으로 `init`을 다시 실행하세요.
- **처음 시작이 느려요.** npx는 처음, 그리고 새 버전이 나올 때마다 패키지를 내려받아요. 이후에는 npx 캐시를 써요.
- **호출이 60초 후 타임아웃돼요.** 에이전트 자체의 도구 타임아웃이 너무 짧아요. [에이전트 직접 설정하기](#에이전트-직접-설정하기)에 나온 대로 늘리세요.

## 버전

패키지는 게이트웨이와 같은 버전을 쓰고, 게이트웨이와 함께 릴리스돼요(`gateway-vX.Y.Z`, [릴리스](../docs/releasing.ko.md) 참고). 어떤 버전이든 어떤 게이트웨이와도 함께 쓸 수 있어요. 도구는 실행 시점에 게이트웨이에서 가져오니까요.

## 개발

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs, 런타임 의존성 없는 파일 하나
npm test            # 빌드한 뒤, 두 개의 목 게이트웨이를 상대로 단위 테스트와 E2E 테스트 실행
node dist/cli.mjs doctor
```
