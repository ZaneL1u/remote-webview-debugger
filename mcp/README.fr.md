<!-- i18n-source: 656f4e4e2fa8dd72e4182a210aba6a469d4d348c -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | Français | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Serveur MCP RWD (`mcp/`)

`remote-webview-debugger-mcp` connecte n'importe quel agent MCP — Cursor, Codex, Gemini CLI, Windsurf, Cline, VS Code, opencode, Claude Code, Claude Desktop — à une ou plusieurs passerelles Remote WebView Debugger. L'agent le lance comme serveur MCP stdio local ; il transmet chaque appel d'outil au point de terminaison MCP de la passerelle (`/v1/mcp`) avec votre clé d'API.

- **Tous les agents, une seule commande.** `npx -y remote-webview-debugger-mcp`. Rien à installer, aucune dépendance à l'exécution.
- **Plusieurs passerelles.** Configurez autant de passerelles que vous voulez, chacune avec son adresse et sa clé d'API. Les appareils de toutes ces passerelles apparaissent dans une seule liste, étiquetés par passerelle.
- **Résiste aux redémarrages.** Quand une passerelle redémarre ou que le réseau tombe, le serveur ouvre une nouvelle session et renvoie l'appel s'il n'a jamais atteint la passerelle.
- **Les clés restent hors des configurations des agents.** Passerelles et clés se trouvent dans un fichier que vous seul pouvez lire. La configuration de chaque agent ne contient que la commande `npx`.

Les agents qui prennent en charge MCP sur HTTP peuvent aussi se connecter directement à la passerelle (voir le [README principal](../README.fr.md#3-connecter-votre-agent)). Ce paquet sert aux agents qui ne lancent que des serveurs locaux, à l'usage de plusieurs passerelles, et à une configuration qui ne met pas les clés dans les configurations des agents.

## Démarrage rapide

Créez une clé d'API dans la console web de la passerelle (Clés d'API ; une seule clé donne accès à tous les appareils), puis lancez :

```bash
npx -y remote-webview-debugger-mcp init
```

`init` demande l'adresse de la passerelle et la clé d'API, et les vérifie auprès de la passerelle. Il ajoute ensuite le serveur MCP aux agents qu'il trouve sur cette machine et propose d'installer le skill de l'agent. Redémarrez votre agent et demandez-lui : *« liste les appareils en ligne »*.

Ce que `init` modifie :

| | |
|---|---|
| Passerelles et clés | `~/.config/remote-webview-debugger/mcp.json` (mode 0600 ; `%APPDATA%\remote-webview-debugger\mcp.json` sous Windows) |
| Agents | Ajoute le serveur sous le nom `remote-webview-debugger` à la configuration MCP propre à chaque agent, et sauvegarde l'ancien fichier sous `<file>.bak`. Un fichier qui contient des commentaires n'est pas modifié ; vous obtenez à la place l'extrait à coller |
| Skill | `npx skills add zanel1u/remote-webview-debugger --skill remote-webview-debugger -g`, si vous acceptez |

Relancez `init` pour ajouter une autre passerelle ou un autre agent. Les passerelles existantes sont conservées, et une passerelle de même nom est remplacée.

## Le skill de l'agent

Le skill indique à l'agent quand utiliser Remote WebView Debugger et comment : la connexion, l'approbation sur le téléphone, `set_task`, les instantanés avant les actions, et la manière d'examiner un bug. Il suit le format [Agent Skills](https://agentskills.io), et s'installe avec [`skills`](https://github.com/vercel-labs/skills) :

```bash
npx skills add zanel1u/remote-webview-debugger
```

`skills add` installe uniquement le skill ; le serveur MCP vient de `init` (ou d'un plugin, ci-dessous). Le skill le sait : quand les outils manquent, il dit à l'agent de vous demander de lancer `init`. Le skill se trouve aussi dans le paquet npm, sous `skills/`.

Les **plugins** installent ensemble le serveur MCP et le skill. Lancez quand même `init` une fois, pour que le serveur connaisse vos passerelles :

- **Claude Code :** `/plugin marketplace add ZaneL1u/remote-webview-debugger`, puis `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI :** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## Configurer un agent à la main

Tous les agents lancent la même commande : `npx -y remote-webview-debugger-mcp@latest`. Avec `@latest`, npx récupère une nouvelle version au démarrage de l'agent ; les outils du serveur suivent ceux de la passerelle. Sous Windows, utilisez `"command": "cmd"` avec `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`.

Les outils d'attente de la passerelle (`wait_for_device`, `wait_for_control`, …) peuvent durer jusqu'à 10 minutes. Quand un agent a un délai d'expiration des outils, les extraits ci-dessous le portent à 660 secondes.

### Cursor, Windsurf, Claude Desktop

`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json` ou `claude_desktop_config.json` :

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

`~/.codex/config.toml` :

```toml
[mcp_servers.remote-webview-debugger]
command = "npx"
args = ["-y", "remote-webview-debugger-mcp@latest"]
startup_timeout_sec = 30
tool_timeout_sec = 660
```

### Gemini CLI

`~/.gemini/settings.json` (`timeout` en millisecondes) :

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

### VS Code (GitHub Copilot) et Cline

VS Code : le `mcp.json` de l'utilisateur (commande **MCP: Open User Configuration**) contient `servers`, chacun avec `"type": "stdio"`. Cline : **MCP Servers → Configure** ouvre `cline_mcp_settings.json`, qui prend la forme `mcpServers` ci-dessus, plus `"timeout": 660` (en secondes).

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

`~/.config/opencode/opencode.json` :

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

## Passerelles

`init` écrit le fichier de configuration pour vous. Vous pouvez aussi le modifier à la main :

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

- `url` est l'adresse de la passerelle. `https://rwd.example.com`, `…/v1` et `…/v1/mcp` fonctionnent tous.
- Chaque passerelle a soit une `apiKey`, soit une `apiKeyEnv` qui nomme une variable d'environnement contenant la clé.
- Les noms de passerelle sont composés de lettres minuscules, de chiffres, de `-` et de `_`. Ce sont ces noms que voient les agents.

Les variables d'environnement peuvent remplacer le fichier, ou s'y ajouter. Une passerelle définie dans l'environnement remplace une passerelle du fichier de même nom. Définissez-les dans la configuration MCP de l'agent (`env`), ou dans le shell qui lance l'agent :

| Variable | Rôle |
|---|---|
| `RWD_CONFIG` | Un autre fichier de configuration (ou `--config <file>`) |
| `RWD_URL`, `RWD_API_KEY` | Une passerelle, nommée `default` (ou `RWD_NAME`) |
| `RWD_GATEWAYS` | Plusieurs passerelles : `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | La clé de chaque passerelle de `RWD_GATEWAYS` (`RWD_API_KEY_PROD`, `RWD_API_KEY_LAB`) |

## Plusieurs passerelles

Avec une seule passerelle, le serveur transmet les outils et les résultats sans les modifier. Avec plusieurs :

- `list_devices` interroge toutes les passerelles à la fois et regroupe les appareils sous `## <gateway> (<host>)`. Une passerelle hors service ou qui refuse la clé y affiche son erreur, et les autres répondent quand même. Passez `gateway` pour n'en interroger qu'une.
- `connect_device` et `wait_for_device` acceptent un `gateway` facultatif, ou un appareil écrit `<gateway>:<code>` (`prod:K7Q2-9M4X`). Sans l'un ni l'autre, le serveur cherche le code d'appareil sur toutes les passerelles et utilise celle qui l'a. Si le code se trouve sur plusieurs passerelles, ou si l'appareil est désigné par son deviceId, l'agent est invité à nommer la passerelle.
- Après `connect_device`, tous les autres outils vont à la passerelle de cet appareil, et le résultat commence par `[gateway: <name> (<host>)]`. Se rattacher à un appareil d'une autre passerelle détache de la précédente, pour que ce téléphone ne reste pas verrouillé.
- `list_gateways` (disponible aussi avec une seule passerelle) affiche l'adresse, la version et l'état de chaque passerelle, et celle sur laquelle se trouve l'appareil rattaché.

## Commandes

```bash
npx -y remote-webview-debugger-mcp                 # le serveur MCP stdio (ce que lancent les agents)
npx -y remote-webview-debugger-mcp init            # ajoute des passerelles, configure les agents, installe le skill
npx -y remote-webview-debugger-mcp doctor          # vérifie chaque passerelle et chaque clé ; liste les agents trouvés
```

`init` fonctionne aussi sans questions, pour les scripts et les documents de configuration d'équipe :

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

| Option | Rôle |
|---|---|
| `--gateway [name=]<url>` | Une passerelle à ajouter (répétable). Sans nom, un nom est construit à partir de l'hôte |
| `--api-key <key>` | Sa clé d'API (une seule passerelle). Sinon depuis `RWD_API_KEY_<NAME>`, `RWD_API_KEY`, ou une question |
| `--api-key-env <VAR>` | Enregistre « lire la clé depuis `VAR` » au lieu de la clé elle-même |
| `--clients <ids>` | `claude-code`, `cursor`, `codex`, `gemini`, `windsurf`, `cline`, `vscode`, `opencode`, `claude-desktop`, ou `all`, `detected`, `none` |
| `--skill`, `--no-skill` | Installer le skill, ou non (par défaut : demander ; avec `-y` : non) |
| `--name <name>` | Le nom du serveur dans les configurations des agents (par défaut `remote-webview-debugger`) |
| `--config <file>` | Un autre fichier de configuration. Les agents configurés lors du même lancement reçoivent `RWD_CONFIG` |
| `--no-verify` | Enregistrer sans vérifier la passerelle et la clé |
| `-y`, `--yes` | Aucune question : configure les agents trouvés, pas de skill sauf avec `--skill` |

## Dépannage

- **L'agent n'a aucun outil Remote WebView Debugger.** Redémarrez l'agent après `init`. Lancez `npx -y remote-webview-debugger-mcp doctor` pour vérifier que le fichier de configuration et les passerelles sont en ordre.
- **« rejected the API key ».** La clé a été révoquée, a expiré, ou son propriétaire a été retiré. Créez une nouvelle clé dans la console web et relancez `init` avec le même nom de passerelle.
- **Le premier démarrage est lent.** npx télécharge le paquet la première fois, puis à chaque nouvelle version. Les démarrages suivants utilisent le cache de npx.
- **Un appel expire au bout de 60 secondes.** Le délai d'expiration des outils propre à l'agent est trop court. Augmentez-le comme indiqué dans [Configurer un agent à la main](#configurer-un-agent-à-la-main).

## Versions

Le paquet porte la version de la passerelle et est publié avec elle (`gateway-vX.Y.Z`, voir [la publication des versions](../docs/releasing.fr.md)). N'importe quelle version fonctionne avec n'importe quelle passerelle : les outils viennent de la passerelle à l'exécution.

## Développement

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs, un seul fichier sans dépendance à l'exécution
npm test            # build, puis tests unitaires et de bout en bout contre deux passerelles simulées
node dist/cli.mjs doctor
```
