<!-- i18n-source: 4c1d07f81a9ad2916a55470637b38ed6f66dea99 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | Português (Brasil) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Servidor MCP do RWD (`mcp/`)

O `remote-webview-debugger-mcp` conecta qualquer agente MCP — Cursor, Codex, Gemini CLI, Windsurf, Cline, VS Code, opencode, Claude Code, Claude Desktop — a um ou mais gateways do Remote WebView Debugger. O agente o inicia como um servidor MCP local via stdio; ele encaminha cada chamada de ferramenta para o endpoint MCP do gateway (`/v1/mcp`) com a sua chave de API.

- **Todos os agentes, um comando.** `npx -y remote-webview-debugger-mcp`. Nada para instalar, sem dependências em tempo de execução.
- **Vários gateways.** Configure quantos gateways quiser, cada um com seu próprio endereço e chave de API. Os dispositivos de todos eles aparecem em uma única lista, identificados pelo gateway.
- **Aguenta reinicializações.** Quando um gateway reinicia ou a rede cai, o servidor abre uma nova sessão e envia a chamada de novo se ela nunca chegou ao gateway.
- **As chaves ficam fora das configs dos agentes.** Gateways e chaves ficam em um arquivo que só você pode ler. A config de cada agente tem apenas o comando `npx`.

Agentes que suportam MCP via HTTP também podem se conectar diretamente ao gateway (veja o [README principal](../README.pt-BR.md#3-conecte-seu-agente)). Este pacote é para agentes que só executam servidores locais, para vários gateways e para uma configuração que não coloca chaves nas configs dos agentes.

## Início rápido

Crie uma chave de API no console do gateway (Chaves de API; uma chave alcança todos os dispositivos) e depois execute:

```bash
npx -y remote-webview-debugger-mcp init
```

O `init` pede o endereço do gateway e a chave de API e os verifica no gateway. Depois, adiciona o servidor MCP aos agentes que encontra nesta máquina e oferece instalar a skill do agente. Reinicie o agente e peça: *“liste os dispositivos online”*. Ele fala o idioma do seu terminal (`--lang` escolhe outro) e deixa você marcar os agentes numa lista.

O que o `init` altera:

| | |
|---|---|
| Gateways e chaves | `~/.config/remote-webview-debugger/mcp.json` (modo 0600; `%APPDATA%\remote-webview-debugger\mcp.json` no Windows) |
| Agentes | Adiciona o servidor como `remote-webview-debugger` à config MCP de cada agente e faz backup do arquivo antigo como `<file>.bak`. Um arquivo com comentários não é alterado; em vez disso, você recebe o trecho para colar |
| Skill | `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g`, se você concordar |

Execute o `init` de novo para adicionar outro gateway ou outro agente. Os gateways existentes são mantidos, e um gateway com o mesmo nome é substituído.

## A skill do agente

A skill diz ao agente quando usar o Remote WebView Debugger e como: conectar, a aprovação no celular, `set_task`, snapshots antes das ações e como investigar um bug. Ela segue o formato [Agent Skills](https://agentskills.io) e é instalada com o [`skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add zanel1u/remote-webview-debugger
```

O `skills add` só instala a skill; o servidor MCP vem do `init` (ou de um plugin, abaixo). A skill sabe disso: quando as ferramentas estão faltando, ela diz ao agente para pedir que você execute o `init`. A skill também está no pacote npm, em `skills/`.

**Plugins** instalam o servidor MCP e a skill juntos. Execute o `init` uma vez mesmo assim, para que o servidor conheça seus gateways:

- **Claude Code:** `/plugin marketplace add ZaneL1u/remote-webview-debugger` e depois `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI:** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## Configure um agente manualmente

Todos os agentes executam o mesmo comando: `npx -y remote-webview-debugger-mcp@latest`. Com `@latest`, o npx pega uma nova versão quando o agente inicia; as ferramentas do servidor acompanham as do gateway. No Windows, use `"command": "cmd"` com `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`.

As ferramentas de espera do gateway (`wait_for_device`, `wait_for_control`, …) podem durar até 10 minutos. Quando um agente tem um timeout de ferramenta, os trechos abaixo o aumentam para 660 segundos.

### Cursor, Windsurf, Claude Desktop

`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json` ou `claude_desktop_config.json`:

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

`~/.gemini/settings.json` (`timeout` em milissegundos):

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

### VS Code (GitHub Copilot) e Cline

VS Code: o `mcp.json` do usuário (comando **MCP: Open User Configuration**) tem `servers`, cada um com `"type": "stdio"`. Cline: **MCP Servers → Configure** abre o `cline_mcp_settings.json`, que usa a forma `mcpServers` acima, mais `"timeout": 660` (segundos).

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

O `init` escreve o arquivo de configuração para você. Você também pode editá-lo à mão:

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` é o endereço do gateway. `https://rwd.example.com`, `…/v1` e `…/v1/mcp` funcionam.
- Cada gateway tem um `apiKey` ou um `apiKeyEnv`, que indica uma variável de ambiente com a chave.
- Os nomes de gateway usam letras minúsculas, dígitos, `-` e `_`. Os agentes veem esses nomes.

Variáveis de ambiente funcionam no lugar do arquivo ou junto com ele. Um gateway definido no ambiente substitui um gateway do arquivo com o mesmo nome. Defina-as na config MCP do agente (`env`) ou no shell que inicia o agente:

| Variável | Significado |
|---|---|
| `RWD_CONFIG` | Outro arquivo de configuração (ou `--config <file>`) |
| `RWD_URL`, `RWD_API_KEY` | Um gateway, chamado `default` (ou `RWD_NAME`) |
| `RWD_GATEWAYS` | Vários gateways: `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | A chave de cada gateway em `RWD_GATEWAYS` (`RWD_API_KEY_PROD`, `RWD_API_KEY_LAB`) |

## Vários gateways

Com um gateway, o servidor repassa as ferramentas e os resultados sem alteração. Com vários:

- `list_devices` consulta todos os gateways ao mesmo tempo e agrupa os dispositivos sob `## <gateway> (<host>)`. Um gateway fora do ar ou que rejeita a chave mostra o erro ali, e os outros continuam respondendo. Passe `gateway` para consultar só um.
- `connect_device` e `wait_for_device` aceitam um `gateway` opcional, ou um dispositivo escrito como `<gateway>:<code>` (`prod:K7Q2-9M4X`). Sem nenhum dos dois, o servidor procura o código do dispositivo em todos os gateways e usa aquele que o tem. Se o código estiver em vários gateways, ou se o dispositivo for indicado por deviceId, o agente é solicitado a informar o gateway.
- Depois de `connect_device`, todas as outras ferramentas vão para o gateway daquele dispositivo, e o resultado começa com `[gateway: <name> (<host>)]`. Conectar a um dispositivo em outro gateway desconecta do anterior, para que aquele celular não fique bloqueado.
- `list_gateways` (disponível também com um gateway) mostra o endereço, a versão e o estado de cada gateway, e em qual deles está o dispositivo conectado.

## Comandos

```bash
npx -y remote-webview-debugger-mcp                 # o servidor MCP via stdio (o que os agentes executam)
npx -y remote-webview-debugger-mcp init            # adiciona gateways, configura agentes, instala a skill
npx -y remote-webview-debugger-mcp doctor          # verifica cada gateway e chave; lista os agentes encontrados
```

O `init` também roda sem perguntas, para scripts e documentação de configuração de equipe:

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| Opção | Significado |
|---|---|
| `--gateway [name=]<url>` | Um gateway a adicionar (pode ser repetido). Sem nome, um é gerado a partir do host |
| `--api-key <key>` | A chave de API dele (um gateway). Caso contrário, vem de `RWD_API_KEY_<NAME>`, `RWD_API_KEY` ou de uma pergunta |
| `--api-key-env <VAR>` | Guarda "ler a chave de `VAR`" em vez da própria chave |
| `--clients <ids>` | `claude-code`, `cursor`, `codex`, `gemini`, `windsurf`, `cline`, `vscode`, `opencode`, `claude-desktop`, ou `all`, `detected`, `none` |
| `--skill`, `--no-skill` | Instala a skill, ou não (padrão: pergunta; com `-y`: não instala) |
| `--name <name>` | O nome do servidor nas configs dos agentes (padrão `remote-webview-debugger`) |
| `--config <file>` | Outro arquivo de configuração. Os agentes configurados na mesma execução recebem `RWD_CONFIG` |
| `--no-verify` | Salva sem verificar o gateway e a chave |
| `-y`, `--yes` | Sem perguntas: configura os agentes encontrados, sem skill a menos que haja `--skill` |

## Solução de problemas

- **O agente não tem as ferramentas do Remote WebView Debugger.** Reinicie o agente depois do `init`. Execute `npx -y remote-webview-debugger-mcp doctor` para verificar se o arquivo de configuração e os gateways estão ok.
- **"rejected the API key".** A chave foi revogada, expirou ou o dono dela foi removido. Crie uma nova chave no console e execute o `init` de novo com o mesmo nome de gateway.
- **A primeira inicialização é lenta.** O npx baixa o pacote na primeira vez, e de novo a cada nova versão. As inicializações seguintes usam o cache do npx.
- **Uma chamada expira depois de 60 segundos.** O timeout de ferramenta do próprio agente é curto demais. Aumente-o como mostrado em [Configure um agente manualmente](#configure-um-agente-manualmente).

## Versões

O pacote tem a versão do gateway e é publicado junto com ele (`gateway-vX.Y.Z`, veja [publicação de versões](../docs/releasing.pt-BR.md)). Qualquer versão funciona com qualquer gateway: as ferramentas vêm do gateway em tempo de execução.

## Desenvolvimento

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs, um único arquivo sem dependências em tempo de execução
npm test            # build e depois testes unitários e de ponta a ponta contra dois gateways simulados
node dist/cli.mjs doctor
```
