<!-- i18n-source: 8aea4dc120575de41a0827859bcf05eb445e030f -->
<div align="center">

# Remote WebView Debugger

**让 AI agent 通过 MCP，远程调试真实用户手机上的 App WebView 和 H5 页面。**

[debugger.site](https://debugger.site/zh/) · [在线演示](https://debugger.site/zh/#demo) · [文档](docs/architecture.zh-CN.md)

[English](README.md) | 简体中文 | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

只在某个用户手机上出现、又藏在超级 App 或自家 App 的 WebView 里的 bug 最难查：插不了数据线，开不了远程调试端口，在自己电脑上也复现不出来。Remote WebView Debugger 换个思路，把那个页面直接交到你的 AI agent 手里。

- **一行脚本**（或原生注入）就能让页面上线。用户会看到一个带设备码的小胶囊，遇到问题可以点「求助」。
- **agent 通过 MCP 接入**：Claude Code、Cursor 或任何 MCP 客户端，在用户于手机上同意之后即可连接。它能读取无障碍快照、console、网络请求和截图，也能像人一样点击、输入、滚动，覆盖这台设备上的所有页面和 WebView。
- **用户始终掌握主动权。** AI 在做什么一目了然（agent 光标、列出计划步骤的任务卡片、边缘光圈），用户随时可以接管或结束。密码、手机号、银行卡号在离开手机之前就已打码。
- **自托管。** 一个 Go 二进制文件，内嵌控制台和 SDK；数据库可选 SQLite 或 Postgres。

```
Claude Code / Cursor ──MCP (HTTPS)──▶ 网关 ──WebSocket──▶ 页面里的 SDK ──▶ DOM · console · 网络
                                        ▲
                                     Web 控制台
```

## 快速开始

三步：运行网关，在页面里加上 SDK，把你的 agent 接到网关。

### 1. 运行网关

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

打开 `http://<你的主机>:8080`，用 **`admin`** 和上面的密码登录。不设 `RWD_ADMIN_PASSWORD` 的话，会生成一个随机密码，在 `docker logs rwd` 里打印一次。镜像基于 Alpine（linux/amd64 和 linux/arm64），内嵌控制台和 SDK，数据都在 `rwd-data` 卷里；升级时 `docker pull` 新的 tag，再重建容器即可。

常用配置，用 `-e` 传入（[全部配置项](gateway/README.zh-CN.md)）：

| 变量 | 作用 |
|---|---|
| `RWD_ADMIN_EMAIL` | 管理员登录名（默认 `admin`） |
| `RWD_PUBLIC_URL` | 手机和 agent 访问网关用的地址，例如 `https://rwd.example.com/v1`，在它和你浏览器里的地址不一样时设置 |
| `RWD_LANG=zh` | MCP 工具说明和返回结果使用中文 |
| `RWD_DATABASE_URL` | 设为 `postgres://…` 时改用 Postgres，默认 SQLite |
| `RWD_TRUST_PROXY=1` | 只在你自己的反向代理后面开启：从 `X-Forwarded-*` 取客户端 IP 和协议 |

<details>
<summary>其他运行方式：二进制、带 HTTPS 的 Docker Compose、从源码构建</summary>

- **二进制。** [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) 上每个网关版本都有 Linux 和 macOS 的 `rwd_<版本>_<os>_<arch>.tar.gz`，解压后运行 `./rwd serve --addr :8080`。
- **Docker Compose。** [`deploy/platform`](deploy/platform/README.zh-CN.md) 在前面加了一个 Caddy：可以放在你已有的 TLS 反向代理后面，也可以设置 `RWD_DOMAIN=<域名>`，自动申请 Let's Encrypt 证书直接提供 HTTPS。
- **从源码构建。** `make -j16`（需要 Go 和 Node），然后运行 `gateway/bin/rwd-<os>-<arch> serve --addr :8080`。

</details>

### 2. 让页面上线

在控制台新建项目拿到接入 Key，然后在页面里加上 SDK，填上你的网关地址：

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

SDK 发布为 npm 包 [`remote-webview-debugger`](sdk/README.zh-CN.md)：可以像上面这样从 jsDelivr 加载，也可以用 unpkg（`https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`），或者 `npm install remote-webview-debugger` 后 `import { run } from 'remote-webview-debugger'`。网关自己也在 `/v1/sdk.js` 提供它内嵌的那一份。

App 里的 WebView 需要在原生代码中于 document start 时注入同样的脚本（iOS 用 `WKUserScript`，Android 用 `addDocumentStartJavaScript`），详见[原生接入](docs/native-integration.zh-CN.md)和控制台内置的接入指南。

### 3. 接入你的 agent

在控制台创建一个 API Key（一个 Key 可以访问所有设备），然后：

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

接着直接问它：*「连接设备 K7Q2-9M4X，查一下为什么结算页的合计显示 `--`。」*

### 用 HTTP 还是 HTTPS？

网关本身只用明文 HTTP 也能正常工作：SDK 会根据网关地址自动选 `ws://` 或 `wss://`，控制台和 MCP 两种都能用。真正起决定作用的是**你要调试的页面**：浏览器和 WebView 不允许 `https://` 页面加载 `http://` 脚本或建立 `ws://` 连接（混合内容），哪怕 `sdk.js` 本身是从 HTTPS 的 CDN 加载的也一样。

| 要调试的页面 | 网关只用 HTTP |
|---|---|
| `http://`：本地开发服务器、内网测试环境 | ✅ 可以 |
| 浏览器或 iOS `WKWebView` 里的 `https://` 页面 | ❌ 会被当作混合内容拦截，网关需要 HTTPS |
| Android WebView 里的 `https://` 页面 | ⚠️ 只有 App 调用了 `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)` 才行，只建议在测试包里这样做 |

走明文 HTTP 时，API Key 和控制台密码都不加密，只适合在可信的网络里使用。需要 HTTPS 时，用 [Compose 方案](deploy/platform/README.zh-CN.md)并设置 `RWD_DOMAIN=<域名>`（自动申请证书），或者把容器放在你自己的 TLS 反向代理后面，并加上 `-e RWD_TRUST_PROXY=1`。

## 功能

- **以设备为中心。** 一台设备（一次 App 安装或一个浏览器）可以有多个页面；一个 API Key、一个 MCP 服务就能访问所有设备。agent 会跟随页面跳转和新打开的 WebView，并能看到跨页面的时间线。
- **agent 工具齐全。** 带元素 ref 的无障碍快照（Playwright 的 aria snapshot），查找、点击、填写、输入、按键、选择、悬停、滚动、拖拽、导航、执行脚本，console、带请求体的网络记录、存储、截图（原生截图桥或 DOM 渲染），批量操作、等待和事件。
- **授权与控制。** 设备上审批，分 `observe` / `interact` / `advanced` 三个级别；可选自动同意；agent 操作时锁定屏幕；接管、交还 AI、结束；敏感操作二次确认（`data-rwd-confirm`）。
- **隐私。** 密码框、`data-rwd-mask` 以及可配置的选择器和正则，在快照、截图、console 和网络数据里都会打码。审计日志记录谁做了什么，不含页面内容。
- **运维。** 成员与角色；API Key 支持级别、过期时间和 IP 白名单；设备令牌；扫码邀请；配额；基于 SSE 的实时控制台；Prometheus 指标。
- **中英双语。** 控制台、手机端界面和面向 agent 的文案都支持中英文：控制台跟随浏览器语言（可手动切换），手机端跟随系统语言或 `run({ lang })`，agent 端由 `RWD_LANG` 决定。
- **兼容 eruda。** 可选在 eruda 里加一个 Remote Debugger 面板，也能按需为开发者加载 eruda。

## 目录结构

| 路径 | 内容 |
|---|---|
| [`gateway/`](gateway) | Go 网关：页面 WebSocket、REST 与控制台登录、MCP 服务、审计、指标 |
| [`sdk/`](sdk) | 页面 SDK（`sdk.js`）及其页内界面 |
| [`packages/chobitsu/`](packages/chobitsu) | 内置的 [chobitsu](https://github.com/liriliri/chobitsu)，以及我们的页面端引擎 `src/engine/` |
| [`console/`](console) | Web 控制台（React、Vite） |
| [`website/`](website) | 官网 [debugger.site](https://debugger.site/zh/)，含交互式演示 |
| [`examples/`](examples) | 多页面演示商城，以及一个像 iOS App 一样承载 WKWebView 的 macOS 应用 |
| [`deploy/platform/`](deploy/platform) | Docker Compose 部署 |
| [`docs/`](docs) | [架构](docs/architecture.zh-CN.md)、[协议](docs/protocol.zh-CN.md)、[原生接入](docs/native-integration.zh-CN.md)、[发版流程](docs/releasing.zh-CN.md) |

## 版本发布

页面 SDK 和网关分开发版，各有自己的版本号、tag（`sdk-vX.Y.Z`、`gateway-vX.Y.Z`）和更新日志：[SDK](sdk/CHANGELOG.zh-CN.md)、[网关](gateway/CHANGELOG.zh-CN.md)。网关的每个版本都附带 Linux 和 macOS 的 `rwd` 二进制以及镜像 `ghcr.io/zanel1u/remote-webview-debugger`。见 [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases)；维护者请看[发版流程](docs/releasing.zh-CN.md)。

## 开发

```bash
make -j16 check                                      # 网关测试、SDK 类型检查和 Playwright 测试、控制台构建
cd console && PORT=8080 npm run mock & npm run dev   # 控制台 + 内存里的模拟网关
cd website && npm run dev                            # 官网
```

## 致谢

页面端引擎基于 [chobitsu](https://github.com/liriliri/chobitsu)（MIT）采集 console 和网络数据，无障碍快照代码来自 [Playwright](https://github.com/microsoft/playwright)（Apache-2.0）。详见 [NOTICE](NOTICE)。

## 许可证

[MIT](LICENSE)
