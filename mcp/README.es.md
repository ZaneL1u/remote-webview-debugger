<!-- i18n-source: 656f4e4e2fa8dd72e4182a210aba6a469d4d348c -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Servidor MCP de RWD (`mcp/`)

`remote-webview-debugger-mcp` conecta cualquier agente MCP (Cursor, Codex, Gemini CLI, Windsurf, Cline, VS Code, opencode, Claude Code, Claude Desktop) con uno o varios gateways de Remote WebView Debugger. El agente lo arranca como servidor MCP local por stdio, y este reenvía cada llamada a herramienta al endpoint MCP del gateway (`/v1/mcp`) con tu clave de API.

- **Todos los agentes, un solo comando.** `npx -y remote-webview-debugger-mcp`. No hay nada que instalar ni dependencias en tiempo de ejecución.
- **Varios gateways.** Configura tantos gateways como quieras, cada uno con su propia dirección y su clave de API. Los dispositivos de todos ellos aparecen en una sola lista, etiquetados por gateway.
- **Aguanta los reinicios.** Cuando un gateway se reinicia o se cae la red, el servidor abre una sesión nueva y vuelve a enviar la llamada si nunca llegó al gateway.
- **Las claves no van en la configuración de los agentes.** Los gateways y las claves viven en un archivo que solo tú puedes leer. La configuración de cada agente solo tiene el comando `npx`.

Los agentes que admiten MCP por HTTP también pueden conectarse directamente al gateway (consulta el [README principal](../README.es.md#3-conecta-tu-agente)). Este paquete es para los agentes que solo ejecutan servidores locales, para trabajar con varios gateways y para una configuración que no pone claves en la configuración de los agentes.

## Inicio rápido

Crea una clave de API en la consola web del gateway (Claves de API; una sola clave llega a todos los dispositivos) y luego ejecuta:

```bash
npx -y remote-webview-debugger-mcp init
```

`init` pide la dirección del gateway y la clave de API, y las comprueba contra el gateway. Después añade el servidor MCP a los agentes que encuentra en esta máquina y ofrece instalar la skill del agente. Reinicia tu agente y pídele: *"lista los dispositivos en línea"*.

Qué cambia `init`:

| | |
|---|---|
| Gateways y claves | `~/.config/remote-webview-debugger/mcp.json` (modo 0600; `%APPDATA%\remote-webview-debugger\mcp.json` en Windows) |
| Agentes | Añade el servidor como `remote-webview-debugger` a la configuración MCP propia de cada agente y guarda una copia del archivo anterior como `<file>.bak`. Un archivo con comentarios no se toca; en su lugar recibes el fragmento para pegarlo |
| Skill | `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g`, si aceptas |

Vuelve a ejecutar `init` para añadir otro gateway u otro agente. Los gateways existentes se conservan, y un gateway con el mismo nombre se reemplaza.

## La skill del agente

La skill le dice al agente cuándo usar Remote WebView Debugger y cómo: conectarse, la aprobación en el teléfono, `set_task`, instantáneas antes de actuar y cómo investigar un bug. Sigue el formato [Agent Skills](https://agentskills.io) y se instala con [`skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add zanel1u/remote-webview-debugger
```

`skills add` solo instala la skill; el servidor MCP lo pone `init` (o un plugin, más abajo). La skill lo sabe: cuando faltan las herramientas, le dice al agente que te pida ejecutar `init`. La skill también va en el paquete de npm, en `skills/`.

**Los plugins** instalan el servidor MCP y la skill a la vez. Ejecuta `init` una vez de todos modos, para que el servidor conozca tus gateways:

- **Claude Code:** `/plugin marketplace add ZaneL1u/remote-webview-debugger` y luego `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI:** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## Configura un agente a mano

Todos los agentes ejecutan el mismo comando: `npx -y remote-webview-debugger-mcp@latest`. Con `@latest`, npx toma la versión nueva cuando arranca el agente; las herramientas del servidor siguen a las del gateway. En Windows, usa `"command": "cmd"` con `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`.

Las herramientas de espera del gateway (`wait_for_device`, `wait_for_control`, …) pueden tardar hasta 10 minutos. Cuando un agente tiene un tiempo límite para las herramientas, los fragmentos de abajo lo suben a 660 segundos.

### Cursor, Windsurf, Claude Desktop

`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json` o `claude_desktop_config.json`:

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

`~/.gemini/settings.json` (`timeout` en milisegundos):

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

### VS Code (GitHub Copilot) y Cline

VS Code: el `mcp.json` de usuario (comando **MCP: Open User Configuration**) tiene `servers`, cada uno con `"type": "stdio"`. Cline: **MCP Servers → Configure** abre `cline_mcp_settings.json`, que usa la forma `mcpServers` de arriba, más `"timeout": 660` (segundos).

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

`init` escribe el archivo de configuración por ti. También puedes editarlo a mano:

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` es la dirección del gateway. Sirven `https://rwd.example.com`, `…/v1` y `…/v1/mcp`.
- Cada gateway tiene o bien un `apiKey`, o bien un `apiKeyEnv` con el nombre de una variable de entorno que contiene la clave.
- Los nombres de gateway usan letras minúsculas, dígitos, `-` y `_`. Los agentes ven estos nombres.

Las variables de entorno sirven en lugar del archivo o además de él. Un gateway definido en el entorno reemplaza al gateway del archivo con el mismo nombre. Defínelas en la configuración MCP del agente (`env`) o en la shell que arranca el agente:

| Variable | Significado |
|---|---|
| `RWD_CONFIG` | Otro archivo de configuración (o `--config <file>`) |
| `RWD_URL`, `RWD_API_KEY` | Un gateway, llamado `default` (o `RWD_NAME`) |
| `RWD_GATEWAYS` | Varios gateways: `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | La clave de cada gateway de `RWD_GATEWAYS` (`RWD_API_KEY_PROD`, `RWD_API_KEY_LAB`) |

## Varios gateways

Con un solo gateway, el servidor deja pasar las herramientas y los resultados sin cambios. Con varios:

- `list_devices` pregunta a todos los gateways a la vez y agrupa los dispositivos bajo `## <gateway> (<host>)`. Un gateway caído o que rechaza la clave muestra ahí su error, y los demás siguen respondiendo. Pasa `gateway` para preguntar solo a uno.
- `connect_device` y `wait_for_device` aceptan un `gateway` opcional, o un dispositivo escrito como `<gateway>:<code>` (`prod:K7Q2-9M4X`). Sin ninguno de los dos, el servidor busca el código de dispositivo en todos los gateways y usa el que lo tiene. Si el código está en varios gateways, o el dispositivo se indica por deviceId, se le pide al agente que diga el gateway.
- Después de `connect_device`, todas las demás herramientas van al gateway de ese dispositivo, y el resultado empieza por `[gateway: <name> (<host>)]`. Conectarse a un dispositivo de otro gateway desconecta del anterior, para que ese teléfono no se quede bloqueado.
- `list_gateways` (disponible también con un solo gateway) muestra la dirección, la versión y el estado de cada gateway, y en cuál está el dispositivo conectado.

## Comandos

```bash
npx -y remote-webview-debugger-mcp                 # el servidor MCP por stdio (lo que ejecutan los agentes)
npx -y remote-webview-debugger-mcp init            # añade gateways, configura agentes, instala la skill
npx -y remote-webview-debugger-mcp doctor          # comprueba cada gateway y clave; lista los agentes encontrados
```

`init` también funciona sin preguntas, para scripts y para la documentación de configuración de un equipo:

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| Opción | Significado |
|---|---|
| `--gateway [name=]<url>` | Un gateway que añadir (se puede repetir). Sin nombre, se genera uno a partir del host |
| `--api-key <key>` | Su clave de API (un solo gateway). Si no, se toma de `RWD_API_KEY_<NAME>`, `RWD_API_KEY` o se pregunta |
| `--api-key-env <VAR>` | Guarda "leer la clave de `VAR`" en lugar de la propia clave |
| `--clients <ids>` | `claude-code`, `cursor`, `codex`, `gemini`, `windsurf`, `cline`, `vscode`, `opencode`, `claude-desktop`, o `all`, `detected`, `none` |
| `--skill`, `--no-skill` | Instala la skill, o no (por defecto: pregunta; con `-y`: no) |
| `--name <name>` | El nombre del servidor en la configuración de los agentes (por defecto `remote-webview-debugger`) |
| `--config <file>` | Otro archivo de configuración. Los agentes configurados en la misma ejecución reciben `RWD_CONFIG` |
| `--no-verify` | Guarda sin comprobar el gateway ni la clave |
| `-y`, `--yes` | Sin preguntas: configura los agentes encontrados, sin skill salvo con `--skill` |

## Solución de problemas

- **El agente no tiene herramientas de Remote WebView Debugger.** Reinicia el agente después de `init`. Ejecuta `npx -y remote-webview-debugger-mcp doctor` para comprobar que el archivo de configuración y los gateways están bien.
- **"rejected the API key".** La clave se revocó, caducó o se eliminó a su propietario. Crea una clave nueva en la consola web y vuelve a ejecutar `init` con el mismo nombre de gateway.
- **El primer arranque es lento.** npx descarga el paquete la primera vez, y otra vez con cada versión nueva. Los arranques siguientes usan la caché de npx.
- **Una llamada agota el tiempo a los 60 segundos.** El tiempo límite de herramientas del propio agente es demasiado corto. Súbelo como se indica en [Configura un agente a mano](#configura-un-agente-a-mano).

## Versiones

El paquete tiene la versión del gateway y se publica con él (`gateway-vX.Y.Z`, consulta [publicación de versiones](../docs/releasing.es.md)). Cualquier versión funciona con cualquier gateway: las herramientas vienen del gateway en tiempo de ejecución.

## Desarrollo

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs, un solo archivo sin dependencias en tiempo de ejecución
npm test            # build y luego tests unitarios y de extremo a extremo contra dos gateways simulados
node dist/cli.mjs doctor
```
