[English](CHANGELOG.md) | 简体中文

# 更新日志

网关（`rwd` 二进制和 Docker 镜像，内嵌控制台和页面 SDK）。tag 形如 `gateway-vX.Y.Z`。

## v0.3.0 (2026-11-04)

[对比变更](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.2.0...gateway-v0.3.0)

> 内嵌页面 SDK：v0.2.1

### 🚀 新功能

- **demo:** 演示商城支持 `?ui=<lang>` 指定 SDK 界面语言，并把设备码告诉官网 ([75138ad](https://github.com/ZaneL1u/remote-webview-debugger/commit/75138ad))

### 🩹 修复

- **deploy:** 公开 demo 放行 SDK 语言包，非中英文手机不再退回英文 ([b8c89ef](https://github.com/ZaneL1u/remote-webview-debugger/commit/b8c89ef))

## v0.2.0 (2026-11-03)

[对比变更](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.1.1...gateway-v0.2.0)

> 内嵌页面 SDK：v0.2.0

### 🚀 新功能

- optional per-IP rate limit for MCP requests ([94d71dc](https://github.com/ZaneL1u/remote-webview-debugger/commit/94d71dc))
- **deploy:** a public demo gateway that starts over every day ([373657e](https://github.com/ZaneL1u/remote-webview-debugger/commit/373657e))
- 网关面向 agent 的文案和 API 错误信息支持 11 种语言，按 Accept-Language 自动选择；新增 /v1/locales/ 托管 SDK 的按需语言包 ([b21b657](https://github.com/ZaneL1u/remote-webview-debugger/commit/b21b657))
- **console:** 控制台支持 11 种语言，跟随浏览器语言并可手动切换，语言包按需加载；阿拉伯语从右到左排版 ([80cbd2f](https://github.com/ZaneL1u/remote-webview-debugger/commit/80cbd2f))
- a key per visitor for public demos (--demo-keys) ([086a734](https://github.com/ZaneL1u/remote-webview-debugger/commit/086a734))
- **deploy:** demo visitors get keys of their own ([dd55dda](https://github.com/ZaneL1u/remote-webview-debugger/commit/dd55dda))
- 「求助」改为「请求协助」，设备状态显示为「协助中」，11 种语言的手机界面、控制台和面向 agent 的文案一起调整 ([73637cb](https://github.com/ZaneL1u/remote-webview-debugger/commit/73637cb))

### 🩹 修复

- **deploy:** one gateway image per compose stack ([fabb2ae](https://github.com/ZaneL1u/remote-webview-debugger/commit/fabb2ae))

### 📖 文档

- README and docs in Traditional Chinese, Japanese, Spanish, French, Russian and Arabic ([9ba0aae](https://github.com/ZaneL1u/remote-webview-debugger/commit/9ba0aae))
- translate the MCP rate limit and the per-stack gateway image ([26d9dec](https://github.com/ZaneL1u/remote-webview-debugger/commit/26d9dec))
- 文档：说明 11 种语言、语言包加载与自定义、样式覆盖（CSS 变量、run({ style })、::part），并同步到各语言译本 ([d17b1f5](https://github.com/ZaneL1u/remote-webview-debugger/commit/d17b1f5))
- 文档新增韩语、德语、巴西葡萄牙语译本，与界面的 11 种语言一致；所有文档的语言切换行列出全部语言 ([0161fed](https://github.com/ZaneL1u/remote-webview-debugger/commit/0161fed))
- 网关 README 的 --demo-keys 说明同步到各语言译本 ([ddc67e3](https://github.com/ZaneL1u/remote-webview-debugger/commit/ddc67e3))

## v0.1.1 (2026-11-03)

[对比变更](https://github.com/ZaneL1u/remote-webview-debugger/compare/gateway-v0.1.0...gateway-v0.1.1)

> 内嵌页面 SDK：v0.1.0

### 🩹 修复

- **deploy:** 镜像可以直接 docker run 单独运行，默认不再信任 X-Forwarded-* 请求头；新增健康检查 ([b66d1f9](https://github.com/ZaneL1u/remote-webview-debugger/commit/b66d1f9))

## v0.1.0 (2026-11-03)

首个版本。

> 内嵌页面 SDK：v0.1.0（含未发版的改动）

### 🚀 新功能

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

### 🩹 修复

- presence checks the device token; longer timeout for a submitting type; end clears help; lenient device codes ([b1027fe](https://github.com/ZaneL1u/remote-webview-debugger/commit/b1027fe))
- X-Forwarded-Proto counts only with --trust-proxy ([7b7157f](https://github.com/ZaneL1u/remote-webview-debugger/commit/7b7157f))
- **hub:** a replaced agent loses its reattach grant ([e40f76a](https://github.com/ZaneL1u/remote-webview-debugger/commit/e40f76a))
- device search matches the same fields online and for all devices ([2dad610](https://github.com/ZaneL1u/remote-webview-debugger/commit/2dad610))
- RWD_ADMIN_EMAIL never adds a second owner ([620f87a](https://github.com/ZaneL1u/remote-webview-debugger/commit/620f87a))

### 🚢 部署

- Docker Compose with Caddy, deploy.sh for a remote host ([a4d6d85](https://github.com/ZaneL1u/remote-webview-debugger/commit/a4d6d85))
- optional direct HTTPS with RWD_DOMAIN (Let's Encrypt) ([e2fbf4e](https://github.com/ZaneL1u/remote-webview-debugger/commit/e2fbf4e))

### 📦 构建

- embed the console and the SDK into the gateway binary ([c3bd4eb](https://github.com/ZaneL1u/remote-webview-debugger/commit/c3bd4eb))
- release the SDK and the gateway separately, with bilingual changelogs ([641fb1c](https://github.com/ZaneL1u/remote-webview-debugger/commit/641fb1c))

### 📖 文档

- gateway, SDK and deployment READMEs in both languages ([a6fc85f](https://github.com/ZaneL1u/remote-webview-debugger/commit/a6fc85f))
- load the SDK from jsDelivr / unpkg or npm; release binaries and image ([f2308af](https://github.com/ZaneL1u/remote-webview-debugger/commit/f2308af))
