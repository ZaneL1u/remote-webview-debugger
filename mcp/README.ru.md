<!-- i18n-source: 675a8f40bfbb5e3b48c68169205c5b2a3f09866a -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | Русский | [العربية](README.ar.md)

# MCP-сервер RWD (`mcp/`)

`remote-webview-debugger-mcp` подключает любого MCP-агента — Cursor, Codex, Gemini CLI, Windsurf, Cline, VS Code, opencode, Claude Code, Claude Desktop — к одному или нескольким шлюзам Remote WebView Debugger. Агент запускает его как локальный stdio MCP-сервер; сервер пересылает каждый вызов инструмента в MCP-эндпоинт шлюза (`/v1/mcp`) с вашим API-ключом.

- **Любой агент, одна команда.** `npx -y remote-webview-debugger-mcp`. Ничего не нужно устанавливать, никаких зависимостей во время работы.
- **Несколько шлюзов.** Настройте сколько угодно шлюзов, каждый со своим адресом и API-ключом. Устройства со всех шлюзов показываются в одном списке с пометкой шлюза.
- **Переживает перезапуски.** Когда шлюз перезапускается или пропадает сеть, сервер открывает новый сеанс и повторяет вызов, если тот так и не дошёл до шлюза.
- **Ключи не попадают в конфиги агентов.** Шлюзы и ключи хранятся в одном файле, который можете читать только вы. В конфиге каждого агента — только команда `npx`.

Агенты, которые поддерживают MCP по HTTP, могут подключаться к шлюзу и напрямую (см. [основной README](../README.ru.md#3-подключите-агента)). Этот пакет — для агентов, которые запускают только локальные серверы, для работы с несколькими шлюзами и для настройки, при которой ключи не попадают в конфиги агентов.

## Быстрый старт

Создайте API-ключ в веб-консоли шлюза (API-ключи; один ключ даёт доступ ко всем устройствам), затем выполните:

```bash
npx -y remote-webview-debugger-mcp@latest init
```

`init` спрашивает адрес шлюза и API-ключ и проверяет их на шлюзе. Затем добавляет MCP-сервер в агентов, которых находит на этой машине, и предлагает установить навык агента. Перезапустите агента и попросите: *«покажи устройства в сети»*. Он говорит на языке вашего терминала (`--lang` выбирает другой) и даёт отметить агентов в списке.

Что меняет `init`:

| | |
|---|---|
| Шлюзы и ключи | `~/.config/remote-webview-debugger/mcp.json` (права 0600; в Windows — `%APPDATA%\remote-webview-debugger\mcp.json`) |
| Агенты | Добавляет сервер под именем `remote-webview-debugger` в собственный MCP-конфиг каждого агента, а старый файл сохраняет как `<file>.bak`. Файл с комментариями не трогает — вместо этого выводит фрагмент, который нужно вставить вручную |
| Навык | `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g`, если вы согласитесь |

Запустите `init` ещё раз, чтобы добавить другой шлюз или другого агента. Уже настроенные шлюзы сохраняются, а шлюз с тем же именем заменяется.

## Навык агента

Навык объясняет агенту, когда и как пользоваться Remote WebView Debugger: подключение, одобрение на телефоне, `set_task`, снимки перед действиями и как разбираться в баге. Он следует формату [Agent Skills](https://agentskills.io), а устанавливается через [`skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add zanel1u/remote-webview-debugger
```

`skills add` устанавливает только навык; MCP-сервер появляется после `init` (или из плагина, см. ниже). Навык это учитывает: если инструментов нет, он велит агенту попросить вас запустить `init`. Навык также есть в npm-пакете в каталоге `skills/`.

**Плагины** устанавливают MCP-сервер и навык вместе. Всё равно один раз запустите `init`, чтобы сервер знал ваши шлюзы:

- **Claude Code:** `/plugin marketplace add ZaneL1u/remote-webview-debugger`, затем `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI:** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## Ручная настройка агента

Все агенты запускают одну и ту же команду: `npx -y remote-webview-debugger-mcp@latest`. С `@latest` npx подхватывает новую версию при запуске агента; инструменты сервера следуют за инструментами шлюза. В Windows используйте `"command": "cmd"` с `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`.

Инструменты ожидания шлюза (`wait_for_device`, `wait_for_control`, …) могут работать до 10 минут. Если у агента есть тайм-аут инструментов, фрагменты ниже поднимают его до 660 секунд.

### Cursor, Windsurf, Claude Desktop

`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json` или `claude_desktop_config.json`:

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

`~/.gemini/settings.json` (`timeout` в миллисекундах):

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

### VS Code (GitHub Copilot) и Cline

VS Code: пользовательский `mcp.json` (команда **MCP: Open User Configuration**) содержит `servers`, у каждого — `"type": "stdio"`. Cline: **MCP Servers → Configure** открывает `cline_mcp_settings.json`, который принимает форму `mcpServers`, показанную выше, плюс `"timeout": 660` (в секундах).

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

## Шлюзы

`init` сам записывает файл конфигурации. Его можно править и вручную:

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` — адрес шлюза. Подходят `https://rwd.example.com`, `…/v1` и `…/v1/mcp`.
- У каждого шлюза есть либо `apiKey`, либо `apiKeyEnv` — имя переменной окружения, в которой лежит ключ.
- Имена шлюзов состоят из строчных латинских букв, цифр, `-` и `_`. Агенты видят эти имена.

Переменные окружения можно использовать вместо файла или вдобавок к нему. Шлюз, заданный в окружении, заменяет шлюз из файла с тем же именем. Задайте их в MCP-конфиге агента (`env`) или в оболочке, из которой запускается агент:

| Переменная | Значение |
|---|---|
| `RWD_CONFIG` | Другой файл конфигурации (или `--config <file>`) |
| `RWD_URL`, `RWD_API_KEY` | Один шлюз с именем `default` (или `RWD_NAME`) |
| `RWD_GATEWAYS` | Несколько шлюзов: `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | Ключ для каждого шлюза из `RWD_GATEWAYS` (`RWD_API_KEY_PROD`, `RWD_API_KEY_LAB`) |

## Несколько шлюзов

С одним шлюзом сервер передаёт инструменты и результаты без изменений. С несколькими:

- `list_devices` опрашивает все шлюзы сразу и группирует устройства под заголовками `## <gateway> (<host>)`. Если шлюз недоступен или отклоняет ключ, там показывается его ошибка, а остальные всё равно отвечают. Передайте `gateway`, чтобы опросить только один.
- `connect_device` и `wait_for_device` принимают необязательный `gateway` или устройство в виде `<gateway>:<code>` (`prod:K7Q2-9M4X`). Если нет ни того ни другого, сервер ищет код устройства на всех шлюзах и использует тот, где он есть. Если код найден на нескольких шлюзах или устройство задано через deviceId, агента просят указать шлюз.
- После `connect_device` все остальные инструменты идут на шлюз этого устройства, а результат начинается с `[gateway: <name> (<host>)]`. Подключение к устройству на другом шлюзе отключает от предыдущего, чтобы тот телефон не остался заблокированным.
- `list_gateways` (доступен и с одним шлюзом) показывает адрес, версию и состояние каждого шлюза, а также на каком из них находится подключённое устройство.

## Команды

```bash
npx -y remote-webview-debugger-mcp                 # stdio MCP-сервер (его запускают агенты)
npx -y remote-webview-debugger-mcp@latest init            # добавить шлюзы, настроить агентов, установить навык
npx -y remote-webview-debugger-mcp@latest doctor          # проверить все шлюзы и ключи; показать найденных агентов
```

`init` работает и без вопросов — для скриптов и командных инструкций по настройке:

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp@latest init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| Параметр | Значение |
|---|---|
| `--gateway [name=]<url>` | Шлюз, который нужно добавить (можно повторять). Без имени оно составляется из хоста |
| `--api-key <key>` | Его API-ключ (для одного шлюза). Иначе берётся из `RWD_API_KEY_<NAME>`, `RWD_API_KEY` или запрашивается |
| `--api-key-env <VAR>` | Сохранить «читать ключ из `VAR`» вместо самого ключа |
| `--clients <ids>` | `claude-code`, `cursor`, `codex`, `gemini`, `windsurf`, `cline`, `vscode`, `opencode`, `claude-desktop` или `all`, `detected`, `none` |
| `--skill`, `--no-skill` | Установить навык или нет (по умолчанию — спросить; с `-y` — не устанавливать) |
| `--name <name>` | Имя сервера в конфигах агентов (по умолчанию `remote-webview-debugger`) |
| `--config <file>` | Другой файл конфигурации. Агенты, настроенные в том же запуске, получают `RWD_CONFIG` |
| `--no-verify` | Сохранить, не проверяя шлюз и ключ |
| `-y`, `--yes` | Без вопросов: настроить найденных агентов, навык — только с `--skill` |

## Решение проблем

- **У агента нет инструментов Remote WebView Debugger.** Перезапустите агента после `init`. Запустите `npx -y remote-webview-debugger-mcp@latest doctor`, чтобы проверить, что с файлом конфигурации и шлюзами всё в порядке.
- **«rejected the API key».** Ключ отозван, истёк или его владелец удалён. Создайте новый ключ в веб-консоли и снова запустите `init` с тем же именем шлюза.
- **Первый запуск медленный.** npx скачивает пакет в первый раз и снова после каждой новой версии. Последующие запуски используют кэш npx.
- **Вызов прерывается по тайм-ауту через 60 секунд.** Собственный тайм-аут инструментов у агента слишком короткий. Увеличьте его, как показано в разделе [Ручная настройка агента](#ручная-настройка-агента).

## Версии

У пакета та же версия, что у шлюза, и выпускается он вместе с ним (`gateway-vX.Y.Z`, см. [выпуск релизов](../docs/releasing.ru.md)). Любая версия работает с любым шлюзом: инструменты приходят со шлюза во время работы.

## Разработка

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs, один файл без зависимостей во время работы
npm test            # сборка, затем модульные и сквозные тесты с двумя mock-шлюзами
node dist/cli.mjs doctor
```
