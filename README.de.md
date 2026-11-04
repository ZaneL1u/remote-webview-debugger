<!-- i18n-source: 97148877150ebf8994ca9848eae39bddac0070b4 -->
<div align="center">

# Remote WebView Debugger

**Lassen Sie KI-Agenten die WebViews in Ihrer App und Ihre H5-Seiten debuggen – auf den Smartphones echter Nutzer, aus der Ferne, über MCP.**

[debugger.site](https://debugger.site) · [Live-Demo](https://debugger.site/#demo) · [Dokumentation](docs/architecture.de.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | Deutsch | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

Ein Bug, der nur auf dem Smartphone eines einzigen Nutzers auftritt – in einer Super-App à la WeChat oder in der WebView Ihrer eigenen App –, ist am schwersten zu debuggen: kein USB-Kabel, kein Remote-Debugging-Port, keine Möglichkeit, ihn auf Ihrem Rechner nachzustellen. Remote WebView Debugger bringt diese Seite stattdessen zu Ihrem KI-Agenten.

- **Ein einziges Script-Tag** (oder eine native Injektion) bringt eine Seite online. Der Nutzer sieht ein kleines Badge mit einem Gerätecode und kann auf *Unterstützung anfordern* tippen.
- **Ihr Agent verbindet sich über MCP** – Claude Code, Cursor oder ein beliebiger MCP-Client –, nachdem der Nutzer auf dem Gerät zugestimmt hat. Er liest Barrierefreiheits-Snapshots, Console, Netzwerk und Screenshots, und er klickt, tippt und scrollt wie ein Mensch, über alle Seiten und WebViews dieses Geräts hinweg.
- **Der Nutzer behält die Kontrolle.** Er sieht, was die KI tut (Agent-Cursor, eine Aufgabenkarte mit den geplanten Schritten, ein leuchtender Rand), und kann jederzeit übernehmen oder die Sitzung beenden. Passwörter, Telefon- und Kartennummern werden maskiert, bevor irgendetwas das Smartphone verlässt.
- **Selbst gehostet.** Ein einziges Go-Binary mit eingebetteter Konsole und eingebettetem SDK; SQLite oder Postgres.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## Schnellstart

Drei Schritte: Gateway starten, SDK in eine Seite einbinden, Agent auf das Gateway richten.

### 1. Gateway starten

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

Öffnen Sie `http://<your-host>:8080` und melden Sie sich als **`admin`** mit diesem Passwort an. Lassen Sie `RWD_ADMIN_PASSWORD` weg, wird einmalig ein zufälliges Passwort in `docker logs rwd` ausgegeben. Das Image basiert auf Alpine (linux/amd64 und linux/arm64), enthält die Konsole und das SDK und legt alles im Volume `rwd-data` ab; für ein Upgrade holen Sie das neue Tag per `docker pull` und erstellen den Container neu.

Einstellungen, die Sie eventuell brauchen, übergeben mit `-e` ([alle Einstellungen](gateway/README.de.md)):

| Variable | Zweck |
|---|---|
| `RWD_ADMIN_EMAIL` | Anmeldename des Inhabers (Standard `admin`) |
| `RWD_PUBLIC_URL` | Die Adresse, die Smartphones und Agenten verwenden, z. B. `https://rwd.example.com/v1`, falls sie von der in Ihrem Browser abweicht |
| `RWD_LANG=zh` | MCP-Tool-Beschreibungen und -Ergebnisse auf Chinesisch |
| `RWD_DATABASE_URL` | `postgres://…`, um Postgres statt SQLite zu verwenden |
| `RWD_TRUST_PROXY=1` | Nur hinter Ihrem eigenen Reverse-Proxy: Client-IP und Schema aus `X-Forwarded-*` übernehmen |

<details>
<summary>Weitere Betriebsarten: Binaries, Docker Compose mit HTTPS, aus dem Quellcode</summary>

- **Binary.** Jedes Gateway-Release auf [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) enthält `rwd_<version>_<os>_<arch>.tar.gz` für Linux und macOS: entpacken und `./rwd serve --addr :8080` ausführen.
- **Docker Compose.** [`deploy/platform`](deploy/platform/README.de.md) stellt einen Caddy davor: hinter Ihrem eigenen TLS-Proxy oder mit eigenem HTTPS über ein Let's-Encrypt-Zertifikat (`RWD_DOMAIN=<host>`).
- **Aus dem Quellcode.** `make -j16` (benötigt Go und Node), danach `gateway/bin/rwd-<os>-<arch> serve --addr :8080`.

</details>

### 2. Eine Seite online bringen

Legen Sie in der Konsole ein Projekt an, um einen App-Key zu erhalten, und binden Sie dann das SDK mit der Adresse Ihres Gateways ein:

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

Das SDK ist das npm-Paket [`remote-webview-debugger`](sdk/README.de.md): Laden Sie es wie oben von jsDelivr oder von unpkg (`https://unpkg.com/remote-webview-debugger@0.3.0/dist/sdk.js`), oder installieren Sie es mit `npm install remote-webview-debugger` und `import { run } from 'remote-webview-debugger'`. Ihr Gateway liefert außerdem die eingebettete Kopie unter `/v1/sdk.js` aus.

In einer App injizieren Sie dasselbe Script bei Dokumentbeginn aus nativem Code (iOS `WKUserScript`, Android `addDocumentStartJavaScript`): siehe [native Integration](docs/native-integration.de.md) und die Anleitung in der Konsole.

### 3. Den Agenten verbinden

Legen Sie in der Konsole einen API-Key an (ein Key erreicht jedes Gerät), dann:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…und fragen Sie: *„Verbinde dich mit dem Gerät K7Q2-9M4X und finde heraus, warum die Gesamtsumme im Checkout `--` anzeigt.“*

### HTTP oder HTTPS?

Das Gateway spricht einfaches HTTP und funktioniert damit problemlos: Das SDK wählt `ws://` oder `wss://` anhand der Gateway-Adresse, und Konsole und MCP funktionieren mit beidem. Entscheidend ist **die Seite, die Sie debuggen**. Browser und WebViews erlauben einer `https://`-Seite nicht, `http://`-Scripts zu laden oder `ws://`-Verbindungen zu öffnen (Mixed Content), selbst wenn `sdk.js` selbst vom HTTPS-CDN kommt.

| Die Seite, die Sie debuggen | Gateway über einfaches HTTP |
|---|---|
| `http://`: lokaler Dev-Server, Testumgebung im Intranet | ✅ Funktioniert |
| `https://` in einem Browser oder einer iOS-`WKWebView` | ❌ Als Mixed Content blockiert: Geben Sie dem Gateway HTTPS |
| `https://` in einer Android-WebView | ⚠️ Nur wenn die App `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)` aufruft, und nur in Debug-Builds |

Über einfaches HTTP werden API-Keys und Konsolen-Passwörter unverschlüsselt übertragen; bleiben Sie also in einem Netzwerk, dem Sie vertrauen. Für HTTPS starten Sie den [Compose-Stack](deploy/platform/README.de.md) mit `RWD_DOMAIN=<host>` (automatisches Zertifikat) oder stellen den Container hinter Ihren eigenen TLS-Proxy und ergänzen `-e RWD_TRUST_PROXY=1`.

## Funktionen

- **Geräteorientiert.** Ein Gerät (eine App-Installation oder ein Browser) hat viele Seiten; ein API-Key und ein MCP-Server erreichen jedes Gerät. Der Agent folgt Navigationen und neu geöffneten WebViews und sieht eine seitenübergreifende Zeitleiste.
- **Agent-Tools.** Barrierefreiheits-Snapshots mit Element-Refs (Playwrights Aria-Snapshot), Suchen, Klicken, Ausfüllen, Tippen, Tastendrücke, Auswählen, Hover, Scrollen, Ziehen, Navigieren, Auswerten, Console, Netzwerk mit Bodys, Speicher, Screenshots (native Brücke oder DOM), gebündelte Aktionen, Warten und Ereignisse.
- **Zustimmung und Kontrolle.** Freigabe auf dem Gerät mit Zugriffsstufen (`observe` / `interact` / `advanced`), optional automatisch zulassen, Bildschirmsperre, während der Agent arbeitet, Übernehmen / Zurückgeben / Beenden, Bestätigung sensibler Aktionen (`data-rwd-confirm`).
- **Datenschutz.** Passwortfelder, `data-rwd-mask` und konfigurierbare Selektoren / Muster werden in Snapshots, Screenshots, Console- und Netzwerkdaten maskiert. Das Audit-Log hält fest, wer was getan hat – ohne Seiteninhalte.
- **Betrieb.** Mitglieder und Rollen, API-Keys mit Zugriffsstufe / Ablaufdatum / IP-Zulassungsliste, Geräte-Tokens, Einladungen per QR-Code, Kontingente, Live-Konsole über SSE, Prometheus-Metriken.
- **11 Sprachen, eigene Styles.** Konsole, Smartphone-Oberfläche und Texte für den Agenten auf Englisch, vereinfachtem und traditionellem Chinesisch, Französisch, Spanisch, Russisch, Arabisch (von rechts nach links), Japanisch, Koreanisch, Deutsch und Portugiesisch: Die Konsole folgt dem Browser (mit Umschalter), die Smartphone-Oberfläche folgt dem Smartphone oder `run({ lang })`, und die Agent-Seite folgt `RWD_LANG`. Das Seiten-SDK nimmt eigene Sprachpakete und Formulierungen an und lässt sich über CSS-Variablen umgestalten ([Sprachen und Styling des SDK](sdk/README.de.md#sprachen)).
- **Verträgt sich mit eruda.** Optionaler Remote-Debugger-Tab in eruda; kann eruda bei Bedarf für Entwickler nachladen.

## Aufbau des Repositorys

| Pfad | Inhalt |
|---|---|
| [`gateway/`](gateway) | Go-Gateway: Seiten-WebSocket, REST und Konsolen-Authentifizierung, MCP-Server, Audit, Metriken |
| [`sdk/`](sdk) | Seiten-SDK (`sdk.js`) und seine Oberfläche in der Seite |
| [`packages/chobitsu/`](packages/chobitsu) | Eingebundenes [chobitsu](https://github.com/liriliri/chobitsu) plus unsere seitenseitige Engine in `src/engine/` |
| [`console/`](console) | Web-Konsole (React, Vite) |
| [`website/`](website) | [debugger.site](https://debugger.site) mit der interaktiven Demo |
| [`examples/`](examples) | Ein mehrseitiger Demo-Shop und eine macOS-App, die WKWebViews wie eine iOS-App hostet |
| [`deploy/platform/`](deploy/platform) | Deployment mit Docker Compose |
| [`docs/`](docs) | [Architektur](docs/architecture.de.md), [Protokoll](docs/protocol.de.md), [native Integration](docs/native-integration.de.md), [Releases](docs/releasing.de.md) |

## Releases

Das Seiten-SDK und das Gateway werden getrennt veröffentlicht, jeweils mit eigener Version, eigenem Tag (`sdk-vX.Y.Z`, `gateway-vX.Y.Z`) und eigenem Changelog: [SDK](sdk/CHANGELOG.md), [Gateway](gateway/CHANGELOG.md). Ein Gateway-Release enthält `rwd`-Binaries für Linux und macOS sowie das Image `ghcr.io/zanel1u/remote-webview-debugger`. Siehe [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) und, für Maintainer, [Releases erstellen](docs/releasing.de.md).

## Entwicklung

```bash
make -j16 check                                      # Gateway-Tests, SDK-Typecheck + Playwright-Tests, Konsolen-Build
cd console && PORT=8080 npm run mock & npm run dev   # Konsole gegen ein Mock-Gateway im Speicher
cd website && npm run dev                            # die Website
```

## Danksagungen

Die seitenseitige Engine baut für die Erfassung von Console und Netzwerk auf [chobitsu](https://github.com/liriliri/chobitsu) (MIT) auf und verwendet den Barrierefreiheits-Snapshot-Code von [Playwright](https://github.com/microsoft/playwright) (Apache-2.0). Siehe [NOTICE](NOTICE).

## Lizenz

[MIT](LICENSE)
