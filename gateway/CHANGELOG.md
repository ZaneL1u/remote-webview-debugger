English | [简体中文](CHANGELOG.zh-CN.md)

# Changelog

The gateway (`rwd` binary and Docker image, with the console and the page SDK embedded). Tags: `gateway-vX.Y.Z`.

## v0.4.2 (2026-11-19)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.4.1...gateway-v0.4.2)

> Embedded page SDK: v0.3.0 (plus unreleased changes)

### 🚀 Enhancements

- **mcp:** init explains where the API key comes from and asks again; agents run it without questions ([432d331](https://github.com/ZaneL1u/remote-webview-debugger/commit/432d331))
- **console:** the onboarding card says to run init in your own terminal and paste the key from step 1 ([0f2ac58](https://github.com/ZaneL1u/remote-webview-debugger/commit/0f2ac58))

## v0.4.1 (2026-11-19)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.4.0...gateway-v0.4.1)

> Embedded page SDK: v0.3.0 (plus unreleased changes)

### 🚀 Enhancements

- long press (click holdMs), and taps land on the right element under CSS zoom ([f7ec9bf](https://github.com/ZaneL1u/remote-webview-debugger/commit/f7ec9bf))
- fewer round trips for agents: click by text, screenshots with actions, on-screen snapshots ([1066d44](https://github.com/ZaneL1u/remote-webview-debugger/commit/1066d44))
- click by text picks the copy a tap reaches; close an open eruda / vConsole panel ([392f2ac](https://github.com/ZaneL1u/remote-webview-debugger/commit/392f2ac))
- **mcp:** init speaks the terminal's language and picks agents from a checklist ([bb88c00](https://github.com/ZaneL1u/remote-webview-debugger/commit/bb88c00))

### 🩹 Fixes

- wait_for over 20 seconds no longer times out ([9054010](https://github.com/ZaneL1u/remote-webview-debugger/commit/9054010))
- **mcp:** init --api-key-env --no-verify saves the variable even when it is not set yet ([a051a4a](https://github.com/ZaneL1u/remote-webview-debugger/commit/a051a4a))
- **mcp:** calls no longer hang on Node 26 against HTTPS gateways ([2d3b156](https://github.com/ZaneL1u/remote-webview-debugger/commit/2d3b156))

### 📖 Documentation

- write the skill source in lower case (npx skills add zanel1u/remote-webview-debugger) ([1346982](https://github.com/ZaneL1u/remote-webview-debugger/commit/1346982))

## v0.4.0 (2026-11-17)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.3.1...gateway-v0.4.0)

> Embedded page SDK: v0.3.0 (plus unreleased changes)

### 🚀 Enhancements

- Chrome DevTools for people from the console ([8562652](https://github.com/ZaneL1u/remote-webview-debugger/commit/8562652))
- single sign-on with Feishu, Lark or OpenID Connect ([9875e75](https://github.com/ZaneL1u/remote-webview-debugger/commit/9875e75))
- console redesign, personal API keys, system health, leavers sync ([066ec01](https://github.com/ZaneL1u/remote-webview-debugger/commit/066ec01))
- refuse API keys whose owner has left Feishu / Lark ([45aea2f](https://github.com/ZaneL1u/remote-webview-debugger/commit/45aea2f))
- the sign-in provider vouches for key owners through refresh tokens ([befb848](https://github.com/ZaneL1u/remote-webview-debugger/commit/befb848))
- **mcp:** stdio MCP package for every agent, several gateways, init and agent skill ([ff0a990](https://github.com/ZaneL1u/remote-webview-debugger/commit/ff0a990))
- **console:** connect agents through the remote-webview-debugger-mcp npm package ([75b6c16](https://github.com/ZaneL1u/remote-webview-debugger/commit/75b6c16))

### 🩹 Fixes

- single sign-on hardening after review ([161ab05](https://github.com/ZaneL1u/remote-webview-debugger/commit/161ab05))
- Feishu / Lark tenant lock, new invite links for accounts without a password ([3af17ec](https://github.com/ZaneL1u/remote-webview-debugger/commit/3af17ec))

## v0.3.1 (2026-11-04)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.3.0...gateway-v0.3.1)

> Embedded page SDK: v0.3.0

## v0.3.0 (2026-11-04)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.2.0...gateway-v0.3.0)

> Embedded page SDK: v0.2.1

### 🚀 Enhancements

- **demo:** the shop takes ?ui=<lang> for the SDK's UI language and tells the website its device code ([75138ad](https://github.com/ZaneL1u/remote-webview-debugger/commit/75138ad))

### 🩹 Fixes

- **deploy:** the public demo serves the SDK's language packs ([b8c89ef](https://github.com/ZaneL1u/remote-webview-debugger/commit/b8c89ef))

## v0.2.0 (2026-11-03)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.1.1...gateway-v0.2.0)

> Embedded page SDK: v0.2.0

### 🚀 Enhancements

- optional per-IP rate limit for MCP requests ([94d71dc](https://github.com/ZaneL1u/remote-webview-debugger/commit/94d71dc))
- **deploy:** a public demo gateway that starts over every day ([373657e](https://github.com/ZaneL1u/remote-webview-debugger/commit/373657e))
- agents and the API in 11 languages; serve the SDK's language packs ([b21b657](https://github.com/ZaneL1u/remote-webview-debugger/commit/b21b657))
- **console:** 11 languages loaded on demand, right to left for Arabic ([80cbd2f](https://github.com/ZaneL1u/remote-webview-debugger/commit/80cbd2f))
- a key per visitor for public demos (--demo-keys) ([086a734](https://github.com/ZaneL1u/remote-webview-debugger/commit/086a734))
- **deploy:** demo visitors get keys of their own ([dd55dda](https://github.com/ZaneL1u/remote-webview-debugger/commit/dd55dda))
- "Request assistance" and "Assisting" instead of "Get help", in every language ([73637cb](https://github.com/ZaneL1u/remote-webview-debugger/commit/73637cb))

### 🩹 Fixes

- **deploy:** one gateway image per compose stack ([fabb2ae](https://github.com/ZaneL1u/remote-webview-debugger/commit/fabb2ae))

### 📖 Documentation

- README and docs in Traditional Chinese, Japanese, Spanish, French, Russian and Arabic ([9ba0aae](https://github.com/ZaneL1u/remote-webview-debugger/commit/9ba0aae))
- translate the MCP rate limit and the per-stack gateway image ([26d9dec](https://github.com/ZaneL1u/remote-webview-debugger/commit/26d9dec))
- languages and styling, in every doc language ([d17b1f5](https://github.com/ZaneL1u/remote-webview-debugger/commit/d17b1f5))
- Korean, German and Brazilian Portuguese, the same 11 languages as the UI ([0161fed](https://github.com/ZaneL1u/remote-webview-debugger/commit/0161fed))
- translate the --demo-keys flag ([ddc67e3](https://github.com/ZaneL1u/remote-webview-debugger/commit/ddc67e3))

## v0.1.1 (2026-11-03)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.1.0...gateway-v0.1.1)

> Embedded page SDK: v0.1.0

### 🩹 Fixes

- **deploy:** the image runs on its own and no longer trusts X-Forwarded-* ([b66d1f9](https://github.com/ZaneL1u/remote-webview-debugger/commit/b66d1f9))

## v0.1.0 (2026-11-03)

First release.

> Embedded page SDK: v0.1.0 (plus unreleased changes)

### 🚀 Enhancements

- Go module and the rwd command ([7e21770](https://github.com/ZaneL1u/remote-webview-debugger/commit/7e21770))
- device codes, page labels and token ids ([4657e69](https://github.com/ZaneL1u/remote-webview-debugger/commit/4657e69))
- store on SQLite or Postgres ([d91fb5c](https://github.com/ZaneL1u/remote-webview-debugger/commit/d91fb5c))
- hub: devices, pages and the control state machine ([8690d5c](https://github.com/ZaneL1u/remote-webview-debugger/commit/8690d5c))
- page connections: hello, welcome, heartbeats, RPC ([c6e177d](https://github.com/ZaneL1u/remote-webview-debugger/commit/c6e177d))
- SSE pub/sub and in-memory stats ([919db2a](https://github.com/ZaneL1u/remote-webview-debugger/commit/919db2a))
- HTTP server: page WebSocket, presence polling, static assets ([86eed06](https://github.com/ZaneL1u/remote-webview-debugger/commit/86eed06))
- console REST API ([4b0779c](https://github.com/ZaneL1u/remote-webview-debugger/commit/4b0779c))
- accounts, roles and session cookies ([60f8226](https://github.com/ZaneL1u/remote-webview-debugger/commit/60f8226))
- hosted MCP server ([a9adf45](https://github.com/ZaneL1u/remote-webview-debugger/commit/a9adf45))
- access levels: observe, interact, advanced ([a6fc951](https://github.com/ZaneL1u/remote-webview-debugger/commit/a6fc951))
- audit log with retention ([74836aa](https://github.com/ZaneL1u/remote-webview-debugger/commit/74836aa))
- describe devices from the user agent (OS, super app, WebView) ([1d1e911](https://github.com/ZaneL1u/remote-webview-debugger/commit/1d1e911))
- /status, /healthz and Prometheus metrics ([c282913](https://github.com/ZaneL1u/remote-webview-debugger/commit/c282913))
- **console:** Vite + React scaffold with shadcn (Base UI) components ([fc442be](https://github.com/ZaneL1u/remote-webview-debugger/commit/fc442be))
- **console:** API client, types, queries and the SSE stream ([486434d](https://github.com/ZaneL1u/remote-webview-debugger/commit/486434d))
- **console:** app shell, login and shared components ([312d6e9](https://github.com/ZaneL1u/remote-webview-debugger/commit/312d6e9))
- **console:** device list and device detail with the live timeline ([c294127](https://github.com/ZaneL1u/remote-webview-debugger/commit/c294127))
- **console:** projects, policy editor and API keys ([80e5754](https://github.com/ZaneL1u/remote-webview-debugger/commit/80e5754))
- **console:** integration guide, snippets and the connection test ([fc9e467](https://github.com/ZaneL1u/remote-webview-debugger/commit/fc9e467))
- **console:** members, device invites by QR code, audit log ([55bcf5d](https://github.com/ZaneL1u/remote-webview-debugger/commit/55bcf5d))
- English and Chinese: RWD_LANG for agents, Accept-Language for the console ([89ce544](https://github.com/ZaneL1u/remote-webview-debugger/commit/89ce544))
- **console:** English and Chinese UI with a language switcher ([9b0cb73](https://github.com/ZaneL1u/remote-webview-debugger/commit/9b0cb73))
- session log: what happened on the device since the app was launched ([0199a39](https://github.com/ZaneL1u/remote-webview-debugger/commit/0199a39))
- **sdk:** lock the page as soon as an agent attaches; show how long it has been connected ([3b4a34b](https://github.com/ZaneL1u/remote-webview-debugger/commit/3b4a34b))

### 🩹 Fixes

- presence checks the device token; longer timeout for a submitting type; end clears help; lenient device codes ([b1027fe](https://github.com/ZaneL1u/remote-webview-debugger/commit/b1027fe))
- X-Forwarded-Proto counts only with --trust-proxy ([7b7157f](https://github.com/ZaneL1u/remote-webview-debugger/commit/7b7157f))
- **hub:** a replaced agent loses its reattach grant ([e40f76a](https://github.com/ZaneL1u/remote-webview-debugger/commit/e40f76a))
- device search matches the same fields online and for all devices ([2dad610](https://github.com/ZaneL1u/remote-webview-debugger/commit/2dad610))
- RWD_ADMIN_EMAIL never adds a second owner ([620f87a](https://github.com/ZaneL1u/remote-webview-debugger/commit/620f87a))

### 🚢 Deployment

- Docker Compose with Caddy, deploy.sh for a remote host ([a4d6d85](https://github.com/ZaneL1u/remote-webview-debugger/commit/a4d6d85))
- optional direct HTTPS with RWD_DOMAIN (Let's Encrypt) ([e2fbf4e](https://github.com/ZaneL1u/remote-webview-debugger/commit/e2fbf4e))

### 📦 Build

- embed the console and the SDK into the gateway binary ([c3bd4eb](https://github.com/ZaneL1u/remote-webview-debugger/commit/c3bd4eb))
- release the SDK and the gateway separately, with bilingual changelogs ([641fb1c](https://github.com/ZaneL1u/remote-webview-debugger/commit/641fb1c))

### 📖 Documentation

- gateway, SDK and deployment READMEs in both languages ([a6fc85f](https://github.com/ZaneL1u/remote-webview-debugger/commit/a6fc85f))
- load the SDK from jsDelivr / unpkg or npm; release binaries and image ([f2308af](https://github.com/ZaneL1u/remote-webview-debugger/commit/f2308af))
