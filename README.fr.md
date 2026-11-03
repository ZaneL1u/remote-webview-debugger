<!-- i18n-source: ec9fb70e7671315e8d86c5f5ef155ba5953f8179 -->
<div align="center">

# Remote WebView Debugger

**Laissez des agents IA déboguer les WebViews de votre application et vos pages H5 — sur les téléphones de vrais utilisateurs, à distance, via MCP.**

[debugger.site](https://debugger.site) · [Démo en ligne](https://debugger.site/#demo) · [Documentation](docs/architecture.fr.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | Français | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

Un bug qui ne survient que sur le téléphone d'un seul utilisateur, dans une super-app à la WeChat ou dans la WebView de votre propre application, est le plus difficile à déboguer : pas de câble USB, pas de port de débogage distant, aucun moyen de le reproduire sur votre machine. Remote WebView Debugger met plutôt cette page entre les mains de votre agent IA.

- **Une seule balise script** (ou une injection native) met une page en ligne. L'utilisateur voit une petite pastille avec un code d'appareil et peut toucher *Demander une assistance*.
- **Votre agent se connecte via MCP** — Claude Code, Cursor ou n'importe quel client MCP — une fois que l'utilisateur a donné son accord sur l'appareil. Il lit des instantanés d'accessibilité, la console, le réseau et des captures d'écran, et il clique, saisit du texte et fait défiler la page comme une personne, sur toutes les pages et WebViews de cet appareil.
- **L'utilisateur garde la main.** Il voit ce que fait l'IA (curseur de l'agent, carte de tâche avec les étapes prévues, bordure lumineuse) et peut reprendre la main ou terminer la session à tout moment. Les mots de passe, numéros de téléphone et de carte sont masqués avant que quoi que ce soit ne quitte le téléphone.
- **Auto-hébergé.** Un seul binaire Go qui embarque la console web et le SDK ; SQLite ou Postgres.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## Démarrage rapide

Trois étapes : lancer la passerelle, ajouter le SDK à une page, pointer votre agent vers la passerelle.

### 1. Lancer la passerelle

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

Ouvrez `http://<your-host>:8080` et connectez-vous en tant que **`admin`** avec ce mot de passe. Si vous omettez `RWD_ADMIN_PASSWORD`, un mot de passe aléatoire est affiché une seule fois dans `docker logs rwd`. L'image est basée sur Alpine (linux/amd64 et linux/arm64), embarque la console web et le SDK, et conserve tout dans le volume `rwd-data` ; pour mettre à jour, faites un `docker pull` du nouveau tag et recréez le conteneur.

Réglages qui peuvent vous être utiles, passés avec `-e` ([tous les réglages](gateway/README.fr.md)) :

| Variable | Rôle |
|---|---|
| `RWD_ADMIN_EMAIL` | Identifiant de connexion du propriétaire (par défaut `admin`) |
| `RWD_PUBLIC_URL` | L'adresse utilisée par les téléphones et les agents, p. ex. `https://rwd.example.com/v1`, quand elle diffère de celle de votre navigateur |
| `RWD_LANG=zh` | Descriptions et résultats des outils MCP en chinois |
| `RWD_DATABASE_URL` | `postgres://…` pour utiliser Postgres au lieu de SQLite |
| `RWD_TRUST_PROXY=1` | Uniquement derrière votre propre proxy inverse : prendre l'IP et le schéma du client dans `X-Forwarded-*` |

<details>
<summary>Autres façons de la lancer : binaires, Docker Compose avec HTTPS, depuis les sources</summary>

- **Binaire.** Chaque version de la passerelle sur [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) fournit `rwd_<version>_<os>_<arch>.tar.gz` pour Linux et macOS : décompressez l'archive et lancez `./rwd serve --addr :8080`.
- **Docker Compose.** [`deploy/platform`](deploy/platform/README.fr.md) ajoute un Caddy en frontal : derrière votre propre proxy TLS, ou servant lui-même le HTTPS avec un certificat Let's Encrypt (`RWD_DOMAIN=<host>`).
- **Depuis les sources.** `make -j16` (nécessite Go et Node), puis `gateway/bin/rwd-<os>-<arch> serve --addr :8080`.

</details>

### 2. Mettre une page en ligne

Créez un projet dans la console web pour obtenir une clé d'application, puis ajoutez le SDK avec l'adresse de votre passerelle :

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

Le SDK est le paquet npm [`remote-webview-debugger`](sdk/README.fr.md) : chargez-le depuis jsDelivr comme ci-dessus ou depuis unpkg (`https://unpkg.com/remote-webview-debugger@0.2.0/dist/sdk.js`), ou faites `npm install remote-webview-debugger` puis `import { run } from 'remote-webview-debugger'`. Votre passerelle sert aussi la copie qu'elle embarque à l'adresse `/v1/sdk.js`.

Dans une application, injectez le même script au début du document depuis le code natif (iOS `WKUserScript`, Android `addDocumentStartJavaScript`) : voir [l'intégration native](docs/native-integration.fr.md) et le guide intégré à la console web.

### 3. Connecter votre agent

Créez une clé d'API dans la console web (une seule clé donne accès à tous les appareils), puis :

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…et demandez : *« Connecte-toi à l'appareil K7Q2-9M4X et trouve pourquoi le total de la commande affiche `--`. »*

### HTTP ou HTTPS ?

La passerelle parle HTTP en clair et fonctionne très bien ainsi : le SDK choisit `ws://` ou `wss://` d'après l'adresse de la passerelle, et la console web comme MCP fonctionnent avec l'un ou l'autre. Ce qui tranche, c'est **la page que vous déboguez**. Les navigateurs et les WebViews ne laissent pas une page `https://` charger des scripts `http://` ni ouvrir des connexions `ws://` (contenu mixte), même lorsque `sdk.js` lui-même provient du CDN en HTTPS.

| La page que vous déboguez | Passerelle en HTTP simple |
|---|---|
| `http://` : serveur de développement local, environnement de test sur l'intranet | ✅ Fonctionne |
| `https://` dans un navigateur ou une `WKWebView` iOS | ❌ Bloqué comme contenu mixte : servez la passerelle en HTTPS |
| `https://` dans une WebView Android | ⚠️ Seulement si l'application appelle `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`, et uniquement dans les builds de débogage |

En HTTP simple, les clés d'API et les mots de passe de la console web circulent en clair : réservez-le donc à un réseau de confiance. Pour obtenir le HTTPS, lancez la [stack Compose](deploy/platform/README.fr.md) avec `RWD_DOMAIN=<host>` (certificat automatique), ou placez le conteneur derrière votre propre proxy TLS et ajoutez `-e RWD_TRUST_PROXY=1`.

## Fonctionnalités

- **Centré sur l'appareil.** Un appareil (une installation d'application ou un navigateur) a de nombreuses pages ; une seule clé d'API et un seul serveur MCP donnent accès à tous les appareils. L'agent suit les navigations et les WebViews nouvellement ouvertes, et voit une chronologie couvrant toutes les pages.
- **Outils pour l'agent.** Instantanés d'accessibilité avec références d'éléments (l'aria snapshot de Playwright), recherche, clic, remplissage, saisie, touches, sélection, survol, défilement, glisser-déposer, navigation, évaluation de JavaScript, console, réseau avec les corps, stockage, captures d'écran (pont natif ou DOM), actions groupées, attentes et événements.
- **Consentement et contrôle.** Approbation sur l'appareil avec des niveaux (`observe` / `interact` / `advanced`), autorisation automatique facultative, verrouillage de l'écran pendant que l'agent agit, reprendre la main / rendre la main / terminer, confirmation des actions sensibles (`data-rwd-confirm`).
- **Confidentialité.** Les champs de mot de passe, `data-rwd-mask` et des sélecteurs / motifs configurables sont masqués dans les instantanés, les captures d'écran, la console et les données réseau. Le journal d'audit enregistre qui a fait quoi, sans le contenu des pages.
- **Exploitation.** Membres et rôles, clés d'API avec niveau / expiration / liste d'IP autorisées, jetons d'appareil, invitations par QR code, quotas, console web en direct via SSE, métriques Prometheus.
- **11 langues, vos propres styles.** Console web, interface du téléphone et textes destinés à l'agent en anglais, chinois simplifié et traditionnel, français, espagnol, russe, arabe (de droite à gauche), japonais, coréen, allemand et portugais : la console web suit le navigateur (avec un sélecteur), l'interface du téléphone suit le téléphone ou `run({ lang })`, et le côté agent suit `RWD_LANG`. Le SDK de page accepte vos propres packs de langue et formulations, et se personnalise par des variables CSS ([langues et apparence du SDK](sdk/README.fr.md#langues)).
- **Fait bon ménage avec eruda.** Onglet Remote Debugger facultatif dans eruda ; peut charger eruda à la demande pour les développeurs.

## Organisation du dépôt

| Chemin | Contenu |
|---|---|
| [`gateway/`](gateway) | Passerelle Go : WebSocket des pages, REST et authentification de la console web, serveur MCP, audit, métriques |
| [`sdk/`](sdk) | SDK de page (`sdk.js`) et son interface dans la page |
| [`packages/chobitsu/`](packages/chobitsu) | [chobitsu](https://github.com/liriliri/chobitsu) intégré au dépôt, plus notre moteur côté page dans `src/engine/` |
| [`console/`](console) | Console web (React, Vite) |
| [`website/`](website) | [debugger.site](https://debugger.site), avec la démo interactive |
| [`examples/`](examples) | Une boutique de démonstration multipage et une application macOS qui héberge des WKWebViews comme une application iOS |
| [`deploy/platform/`](deploy/platform) | Déploiement Docker Compose |
| [`docs/`](docs) | [Architecture](docs/architecture.fr.md), [protocole](docs/protocol.fr.md), [intégration native](docs/native-integration.fr.md), [publication des versions](docs/releasing.fr.md) |

## Versions

Le SDK de page et la passerelle sont publiés séparément, chacun avec sa propre version, son tag (`sdk-vX.Y.Z`, `gateway-vX.Y.Z`) et son journal des modifications : [SDK](sdk/CHANGELOG.md), [passerelle](gateway/CHANGELOG.md). Une version de la passerelle est livrée avec les binaires `rwd` pour Linux et macOS et l'image `ghcr.io/zanel1u/remote-webview-debugger`. Voir [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) et, pour les mainteneurs, [la publication des versions](docs/releasing.fr.md).

## Développement

```bash
make -j16 check                                      # tests de la passerelle, typecheck du SDK + tests Playwright, build de la console
cd console && PORT=8080 npm run mock & npm run dev   # console face à une passerelle simulée en mémoire
cd website && npm run dev                            # le site web
```

## Remerciements

Le moteur côté page s'appuie sur [chobitsu](https://github.com/liriliri/chobitsu) (MIT) pour la capture de la console et du réseau, et utilise le code d'instantané d'accessibilité de [Playwright](https://github.com/microsoft/playwright) (Apache-2.0). Voir [NOTICE](NOTICE).

## Licence

[MIT](LICENSE)
