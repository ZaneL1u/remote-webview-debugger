<!-- i18n-source: 4c1d07f81a9ad2916a55470637b38ed6f66dea99 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | Deutsch | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD-MCP-Server (`mcp/`)

`remote-webview-debugger-mcp` verbindet jeden MCP-Agenten – Cursor, Codex, Gemini CLI, Windsurf, Cline, VS Code, opencode, Claude Code, Claude Desktop – mit einem oder mehreren Remote-WebView-Debugger-Gateways. Der Agent startet ihn als lokalen stdio-MCP-Server; er leitet jeden Tool-Aufruf mit Ihrem API-Key an den MCP-Endpunkt des Gateways (`/v1/mcp`) weiter.

- **Jeder Agent, ein Befehl.** `npx -y remote-webview-debugger-mcp`. Nichts zu installieren, keine Laufzeitabhängigkeiten.
- **Mehrere Gateways.** Konfigurieren Sie so viele Gateways, wie Sie möchten, jedes mit eigener Adresse und eigenem API-Key. Die Geräte aller Gateways erscheinen in einer Liste, nach Gateway gekennzeichnet.
- **Übersteht Neustarts.** Wenn ein Gateway neu startet oder das Netzwerk abbricht, öffnet der Server eine neue Sitzung und sendet den Aufruf erneut, falls er das Gateway nie erreicht hat.
- **Keys bleiben aus den Agent-Konfigurationen heraus.** Gateways und Keys liegen in einer Datei, die nur Sie lesen können. In der Konfiguration jedes Agenten steht nur der `npx`-Befehl.

Agenten, die MCP über HTTP unterstützen, können sich auch direkt mit dem Gateway verbinden (siehe das [Haupt-README](../README.de.md#3-den-agenten-verbinden)). Dieses Paket ist für Agenten, die nur lokale Server starten, für mehrere Gateways und für eine Einrichtung, die keine Keys in Agent-Konfigurationen ablegt.

## Schnellstart

Legen Sie in der Konsole des Gateways einen API-Key an (API-Keys; ein Key erreicht jedes Gerät) und führen Sie dann aus:

```bash
npx -y remote-webview-debugger-mcp init
```

`init` fragt nach der Gateway-Adresse und dem API-Key und prüft beides beim Gateway. Dann trägt es den MCP-Server bei den Agenten ein, die es auf diesem Rechner findet, und bietet an, den Agent-Skill zu installieren. Starten Sie Ihren Agenten neu und fragen Sie ihn: *„Liste die Online-Geräte auf“*. Es spricht die Sprache deines Terminals (`--lang` wählt eine andere) und lässt dich die Agents in einer Liste ankreuzen.

Was `init` ändert:

| | |
|---|---|
| Gateways und Keys | `~/.config/remote-webview-debugger/mcp.json` (Modus 0600; unter Windows `%APPDATA%\remote-webview-debugger\mcp.json`) |
| Agenten | Trägt den Server als `remote-webview-debugger` in die eigene MCP-Konfiguration jedes Agenten ein und sichert die alte Datei als `<file>.bak`. Eine Datei mit Kommentaren bleibt unangetastet; stattdessen erhalten Sie das Snippet zum Einfügen |
| Skill | `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g`, wenn Sie zustimmen |

Führen Sie `init` erneut aus, um ein weiteres Gateway oder einen weiteren Agenten hinzuzufügen. Vorhandene Gateways bleiben erhalten, und ein Gateway mit demselben Namen wird ersetzt.

## Der Agent-Skill

Der Skill sagt dem Agenten, wann und wie er Remote WebView Debugger verwendet: Verbinden, Freigabe auf dem Smartphone, `set_task`, Snapshots vor Aktionen und wie man einem Bug nachgeht. Er folgt dem Format [Agent Skills](https://agentskills.io) und wird mit [`skills`](https://github.com/vercel-labs/skills) installiert:

```bash
npx skills add zanel1u/remote-webview-debugger
```

`skills add` installiert nur den Skill; der MCP-Server kommt von `init` (oder von einem Plugin, siehe unten). Das weiß der Skill: Wenn die Tools fehlen, weist er den Agenten an, Sie zu bitten, `init` auszuführen. Der Skill liegt auch im npm-Paket unter `skills/`.

**Plugins** installieren den MCP-Server und den Skill zusammen. Führen Sie trotzdem einmal `init` aus, damit der Server Ihre Gateways kennt:

- **Claude Code:** `/plugin marketplace add ZaneL1u/remote-webview-debugger`, dann `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI:** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## Einen Agenten von Hand einrichten

Jeder Agent führt denselben Befehl aus: `npx -y remote-webview-debugger-mcp@latest`. Mit `@latest` holt npx beim Start des Agenten eine neue Version; die Tools des Servers folgen denen des Gateways. Unter Windows verwenden Sie `"command": "cmd"` mit `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`.

Die Warte-Tools des Gateways (`wait_for_device`, `wait_for_control`, …) können bis zu 10 Minuten laufen. Wo ein Agent ein Tool-Timeout hat, setzen die Snippets unten es auf 660 Sekunden.

### Cursor, Windsurf, Claude Desktop

`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json` oder `claude_desktop_config.json`:

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

`~/.gemini/settings.json` (`timeout` in Millisekunden):

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

### VS Code (GitHub Copilot) und Cline

VS Code: Die Benutzer-`mcp.json` (Befehl **MCP: Open User Configuration**) hat `servers`, jeweils mit `"type": "stdio"`. Cline: **MCP Servers → Configure** öffnet `cline_mcp_settings.json`, die die `mcpServers`-Form von oben annimmt, plus `"timeout": 660` (Sekunden).

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

`init` schreibt die Konfigurationsdatei für Sie. Sie können sie auch von Hand bearbeiten:

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` ist die Adresse des Gateways. `https://rwd.example.com`, `…/v1` und `…/v1/mcp` funktionieren alle.
- Jedes Gateway hat entweder einen `apiKey` oder einen `apiKeyEnv`, der eine Umgebungsvariable mit dem Key benennt.
- Gateway-Namen bestehen aus Kleinbuchstaben, Ziffern, `-` und `_`. Agenten sehen diese Namen.

Umgebungsvariablen funktionieren statt der Datei oder zusätzlich zu ihr. Ein in der Umgebung gesetztes Gateway ersetzt ein Gateway gleichen Namens aus der Datei. Setzen Sie sie in der MCP-Konfiguration des Agenten (`env`) oder in der Shell, die den Agenten startet:

| Variable | Bedeutung |
|---|---|
| `RWD_CONFIG` | Eine andere Konfigurationsdatei (oder `--config <file>`) |
| `RWD_URL`, `RWD_API_KEY` | Ein Gateway mit dem Namen `default` (oder `RWD_NAME`) |
| `RWD_GATEWAYS` | Mehrere Gateways: `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | Der Key für jedes Gateway in `RWD_GATEWAYS` (`RWD_API_KEY_PROD`, `RWD_API_KEY_LAB`) |

## Mehrere Gateways

Mit einem Gateway reicht der Server Tools und Ergebnisse unverändert durch. Mit mehreren:

- `list_devices` fragt alle Gateways gleichzeitig ab und gruppiert die Geräte unter `## <gateway> (<host>)`. Ein Gateway, das nicht erreichbar ist oder den Key ablehnt, zeigt dort seinen Fehler, und die anderen antworten trotzdem. Übergeben Sie `gateway`, um nur eines abzufragen.
- `connect_device` und `wait_for_device` nehmen ein optionales `gateway` oder ein als `<gateway>:<code>` geschriebenes Gerät (`prod:K7Q2-9M4X`). Ohne beides sucht der Server den Gerätecode auf allen Gateways und verwendet das, das ihn hat. Liegt der Code auf mehreren Gateways oder wird das Gerät per deviceId angegeben, wird der Agent gebeten, das Gateway zu nennen.
- Nach `connect_device` gehen alle anderen Tools an das Gateway dieses Geräts, und das Ergebnis beginnt mit `[gateway: <name> (<host>)]`. Das Anhängen an ein Gerät auf einem anderen Gateway trennt vom vorherigen, damit jenes Smartphone nicht gesperrt bleibt.
- `list_gateways` (auch mit einem Gateway verfügbar) zeigt Adresse, Version und Zustand jedes Gateways und auf welchem das angehängte Gerät liegt.

## Befehle

```bash
npx -y remote-webview-debugger-mcp                 # der stdio-MCP-Server (das, was Agenten ausführen)
npx -y remote-webview-debugger-mcp init            # Gateways hinzufügen, Agenten einrichten, den Skill installieren
npx -y remote-webview-debugger-mcp doctor          # jedes Gateway und jeden Key prüfen; die gefundenen Agenten auflisten
```

`init` läuft auch ohne Rückfragen, für Skripte und Setup-Anleitungen im Team:

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| Option | Bedeutung |
|---|---|
| `--gateway [name=]<url>` | Ein hinzuzufügendes Gateway (wiederholbar). Ohne Namen wird einer aus dem Host gebildet |
| `--api-key <key>` | Sein API-Key (ein Gateway). Sonst aus `RWD_API_KEY_<NAME>`, `RWD_API_KEY` oder per Abfrage |
| `--api-key-env <VAR>` | „Key aus `VAR` lesen“ speichern statt des Keys selbst |
| `--clients <ids>` | `claude-code`, `cursor`, `codex`, `gemini`, `windsurf`, `cline`, `vscode`, `opencode`, `claude-desktop` oder `all`, `detected`, `none` |
| `--skill`, `--no-skill` | Den Skill installieren oder nicht (Standard: fragen; mit `-y`: nicht) |
| `--name <name>` | Der Name des Servers in den Konfigurationen der Agenten (Standard `remote-webview-debugger`) |
| `--config <file>` | Eine andere Konfigurationsdatei. Im selben Lauf eingerichtete Agenten erhalten `RWD_CONFIG` |
| `--no-verify` | Speichern, ohne Gateway und Key zu prüfen |
| `-y`, `--yes` | Keine Rückfragen: die gefundenen Agenten einrichten, kein Skill außer mit `--skill` |

## Fehlerbehebung

- **Der Agent hat keine Remote-WebView-Debugger-Tools.** Starten Sie den Agenten nach `init` neu. Führen Sie `npx -y remote-webview-debugger-mcp doctor` aus, um zu prüfen, ob die Konfigurationsdatei und die Gateways in Ordnung sind.
- **„rejected the API key“.** Der Key wurde widerrufen, ist abgelaufen oder sein Inhaber wurde entfernt. Legen Sie in der Konsole einen neuen Key an und führen Sie `init` mit demselben Gateway-Namen erneut aus.
- **Der erste Start ist langsam.** npx lädt das Paket beim ersten Mal herunter und erneut nach jeder neuen Version. Spätere Starts nutzen den Cache von npx.
- **Ein Aufruf bricht nach 60 Sekunden mit einem Timeout ab.** Das eigene Tool-Timeout des Agenten ist zu kurz. Erhöhen Sie es wie unter [Einen Agenten von Hand einrichten](#einen-agenten-von-hand-einrichten) gezeigt.

## Versionen

Das Paket hat die Version des Gateways und wird mit ihm veröffentlicht (`gateway-vX.Y.Z`, siehe [Releases erstellen](../docs/releasing.de.md)). Jede Version funktioniert mit jedem Gateway: Die Tools kommen zur Laufzeit vom Gateway.

## Entwicklung

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs, eine Datei ohne Laufzeitabhängigkeiten
npm test            # bauen, dann Unit- und End-to-End-Tests gegen zwei Mock-Gateways
node dist/cli.mjs doctor
```
