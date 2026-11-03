<div align="center">

# Remote WebView Debugger

**Let AI agents debug the WebViews inside your app and your H5 pages — on real users' phones, remotely, over MCP.**

[debugger.site](https://debugger.site) · [Live demo](https://debugger.site/#demo) · [Docs](docs/architecture.md)

English | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

A bug that only happens on one user's phone, inside a WeChat-style super app or your own app's WebView, is the hardest kind to debug: no USB cable, no remote-debugging port, no way to reproduce it on your machine. Remote WebView Debugger puts that page in front of your AI agent instead.

- **One script tag** (or a native injection) puts a page online. The user sees a small pill with a device code, and can tap *Request assistance*.
- **Your agent connects through MCP** — Claude Code, Cursor or any MCP client — after the user approves on the device. It reads accessibility snapshots, console, network and screenshots, and clicks, types and scrolls like a person, across every page and WebView of that device.
- **The user stays in control.** They see what the AI is doing (agent cursor, a task card with the planned steps, a glowing edge) and can take over or end the session at any time. Passwords, phone and card numbers are masked before anything leaves the phone.
- **Self-hosted.** One Go binary with the console and the SDK embedded; SQLite or Postgres.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## Quick start

Three steps: run the gateway, add the SDK to a page, point your agent at the gateway.

### 1. Run the gateway

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

Open `http://<your-host>:8080` and sign in as **`admin`** with that password. Leave `RWD_ADMIN_PASSWORD` out and a random one is printed once in `docker logs rwd`. The image is Alpine-based (linux/amd64 and linux/arm64), embeds the console and the SDK, and keeps everything in the `rwd-data` volume; to upgrade, `docker pull` the new tag and recreate the container.

Settings you may want, passed with `-e` ([all settings](gateway/README.md)):

| Variable | Purpose |
|---|---|
| `RWD_ADMIN_EMAIL` | Owner login name (default `admin`) |
| `RWD_PUBLIC_URL` | The address phones and agents use, e.g. `https://rwd.example.com/v1`, when it differs from the one in your browser |
| `RWD_LANG=zh` | MCP tool descriptions and results in Chinese |
| `RWD_DATABASE_URL` | `postgres://…` to use Postgres instead of SQLite |
| `RWD_TRUST_PROXY=1` | Only behind your own reverse proxy: take the client IP and scheme from `X-Forwarded-*` |

<details>
<summary>Other ways to run it: binaries, Docker Compose with HTTPS, from source</summary>

- **Binary.** Each gateway release on [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) has `rwd_<version>_<os>_<arch>.tar.gz` for Linux and macOS: unpack it and run `./rwd serve --addr :8080`.
- **Docker Compose.** [`deploy/platform`](deploy/platform/README.md) adds a Caddy in front: behind your own TLS proxy, or serving HTTPS itself with a Let's Encrypt certificate (`RWD_DOMAIN=<host>`).
- **From source.** `make -j16` (needs Go and Node), then `gateway/bin/rwd-<os>-<arch> serve --addr :8080`.

</details>

### 2. Put a page online

Create a project in the console to get an app key, then add the SDK with your gateway's address:

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.1/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

The SDK is the npm package [`remote-webview-debugger`](sdk/README.md): load it from jsDelivr as above or from unpkg (`https://unpkg.com/remote-webview-debugger@0.2.1/dist/sdk.js`), or `npm install remote-webview-debugger` and `import { run } from 'remote-webview-debugger'`. Your gateway also serves the copy it embeds at `/v1/sdk.js`.

In an app, inject the same script at document start from native code (iOS `WKUserScript`, Android `addDocumentStartJavaScript`): see [native integration](docs/native-integration.md) and the guide built into the console.

### 3. Connect your agent

Create an API key in the console (one key reaches every device), then:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…and ask: *"Connect to device K7Q2-9M4X and find out why the checkout total shows `--`."*

### HTTP or HTTPS?

The gateway speaks plain HTTP and works fine that way: the SDK picks `ws://` or `wss://` from the gateway address, and the console and MCP work over either. What decides is **the page you debug**. Browsers and WebViews don't let an `https://` page load `http://` scripts or open `ws://` connections (mixed content), even when `sdk.js` itself comes from the HTTPS CDN.

| The page you debug | Gateway over plain HTTP |
|---|---|
| `http://`: local dev server, intranet test environment | ✅ Works |
| `https://` in a browser or an iOS `WKWebView` | ❌ Blocked as mixed content: give the gateway HTTPS |
| `https://` in an Android WebView | ⚠️ Only if the app calls `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`, in debug builds only |

Over plain HTTP, API keys and console passwords travel unencrypted, so keep it to a network you trust. To get HTTPS, run the [Compose stack](deploy/platform/README.md) with `RWD_DOMAIN=<host>` (automatic certificate), or put the container behind your own TLS proxy and add `-e RWD_TRUST_PROXY=1`.

## Features

- **Device-first.** A device (one app install or browser) has many pages; one API key and one MCP server reach every device. The agent follows navigations and newly opened WebViews and sees a cross-page timeline.
- **Agent tools.** Accessibility snapshots with element refs (Playwright's aria snapshot), find, click, fill, type, press, select, hover, scroll, drag, navigate, evaluate, console, network with bodies, storage, screenshots (native bridge or DOM), batched actions, waits and events.
- **Consent and control.** On-device approval with levels (`observe` / `interact` / `advanced`), optional auto-approve, screen lock while the agent operates, take over / hand back / end, confirmation for sensitive actions (`data-rwd-confirm`).
- **Privacy.** Password fields, `data-rwd-mask` and configurable selectors / patterns are masked in snapshots, screenshots, console and network data. The audit log records who did what, without page content.
- **Operations.** Members and roles, API keys with level / expiry / IP allowlist, device tokens, invites by QR code, quotas, live console over SSE, Prometheus metrics.
- **11 languages, your own styles.** Console, phone UI and agent-facing text in English, Simplified and Traditional Chinese, French, Spanish, Russian, Arabic (right to left), Japanese, Korean, German and Portuguese: the console follows the browser (with a switcher), the phone UI follows the phone or `run({ lang })`, and the agent side follows `RWD_LANG`. The page SDK takes your own language packs and wording, and restyles through CSS variables ([SDK languages and styling](sdk/README.md#languages)).
- **Plays well with eruda.** Optional Remote Debugger tab inside eruda; can load eruda for developers on demand.

## Repository layout

| Path | What |
|---|---|
| [`gateway/`](gateway) | Go gateway: page WebSocket, REST and console auth, MCP server, audit, metrics |
| [`sdk/`](sdk) | Page SDK (`sdk.js`) and its in-page UI |
| [`packages/chobitsu/`](packages/chobitsu) | Vendored [chobitsu](https://github.com/liriliri/chobitsu) plus our page-side engine in `src/engine/` |
| [`console/`](console) | Web console (React, Vite) |
| [`website/`](website) | [debugger.site](https://debugger.site), with the interactive demo |
| [`examples/`](examples) | A multi-page demo shop and a macOS app that hosts WKWebViews like an iOS app |
| [`deploy/platform/`](deploy/platform) | Docker Compose deployment |
| [`docs/`](docs) | [Architecture](docs/architecture.md), [protocol](docs/protocol.md), [native integration](docs/native-integration.md), [releasing](docs/releasing.md) |

## Releases

The page SDK and the gateway are released separately, each with its own version, tag (`sdk-vX.Y.Z`, `gateway-vX.Y.Z`) and changelog: [SDK](sdk/CHANGELOG.md), [gateway](gateway/CHANGELOG.md). A gateway release comes with `rwd` binaries for Linux and macOS and the image `ghcr.io/zanel1u/remote-webview-debugger`. See [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) and, for maintainers, [releasing](docs/releasing.md).

## Development

```bash
make -j16 check                                      # gateway tests, SDK typecheck + Playwright tests, console build
cd console && PORT=8080 npm run mock & npm run dev   # console against an in-memory mock gateway
cd website && npm run dev                            # the website
```

## Acknowledgements

The page-side engine builds on [chobitsu](https://github.com/liriliri/chobitsu) (MIT) for console and network capture, and uses [Playwright](https://github.com/microsoft/playwright)'s accessibility snapshot code (Apache-2.0). See [NOTICE](NOTICE).

## License

[MIT](LICENSE)
