<div align="center">

# Remote WebView Debugger

**Let AI agents debug the WebViews inside your app and your H5 pages — on real users' phones, remotely, over MCP.**

[debugger.site](https://debugger.site) · [Live demo](https://debugger.site/#demo) · [Docs](docs/architecture.md) · English | [简体中文](README.zh-CN.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

A bug that only happens on one user's phone, inside a WeChat-style super app or your own app's WebView, is the hardest kind to debug: no USB cable, no remote-debugging port, no way to reproduce it on your machine. Remote WebView Debugger puts that page in front of your AI agent instead.

- **One script tag** (or a native injection) puts a page online. The user sees a small pill with a device code, and can tap *Ask for help*.
- **Your agent connects through MCP** — Claude Code, Cursor or any MCP client — after the user approves on the device. It reads accessibility snapshots, console, network and screenshots, and clicks, types and scrolls like a person, across every page and WebView of that device.
- **The user stays in control.** They see what the AI is doing (agent cursor, a task card with the planned steps, a glowing edge) and can take over or end the session at any time. Passwords, phone and card numbers are masked before anything leaves the phone.
- **Self-hosted.** One Go binary with the console and the SDK embedded; SQLite or Postgres.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## Quick start

### 1. Run the gateway

```bash
make -j16                          # builds gateway/bin/rwd-<os>-<arch> (needs Go and Node)
RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

Open http://localhost:8080 and sign in. For a server, use the Docker Compose setup in [`deploy/platform`](deploy/platform/README.md) — behind your own TLS proxy, or serving HTTPS itself with `RWD_DOMAIN=<host>`. All settings: [`gateway/README.md`](gateway/README.md).

### 2. Put a page online

Create a project in the console to get an app key, then add the SDK:

```html
<script src="https://rwd.example.com/v1/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

In an app, inject the same script at document start from native code (iOS `WKUserScript`, Android `addDocumentStartJavaScript`): see [native integration](docs/native-integration.md) and the guide built into the console.

### 3. Connect your agent

Create an API key in the console (one key reaches every device), then:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…and ask: *"Connect to device K7Q2-9M4X and find out why the checkout total shows `--`."*

## Features

- **Device-first.** A device (one app install or browser) has many pages; one API key and one MCP server reach every device. The agent follows navigations and newly opened WebViews and sees a cross-page timeline.
- **Agent tools.** Accessibility snapshots with element refs (Playwright's aria snapshot), find, click, fill, type, press, select, hover, scroll, drag, navigate, evaluate, console, network with bodies, storage, screenshots (native bridge or DOM), batched actions, waits and events.
- **Consent and control.** On-device approval with levels (`observe` / `interact` / `advanced`), optional auto-approve, screen lock while the agent operates, take over / hand back / end, confirmation for sensitive actions (`data-rwd-confirm`).
- **Privacy.** Password fields, `data-rwd-mask` and configurable selectors / patterns are masked in snapshots, screenshots, console and network data. The audit log records who did what, without page content.
- **Operations.** Members and roles, API keys with level / expiry / IP allowlist, device tokens, invites by QR code, quotas, live console over SSE, Prometheus metrics.
- **Bilingual.** Console, phone UI and agent-facing text in English and Chinese: the console follows the browser (with a switcher), the phone UI follows the phone or `run({ lang })`, and the agent side follows `RWD_LANG`.
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
| [`docs/`](docs) | [Architecture](docs/architecture.md), [protocol](docs/protocol.md), [native integration](docs/native-integration.md) |

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
