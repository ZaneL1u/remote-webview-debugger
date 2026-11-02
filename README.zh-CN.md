<div align="center">

# Remote WebView Debugger

**让 AI agent 通过 MCP，远程调试真实用户手机上的 App WebView 和 H5 页面。**

[debugger.site](https://debugger.site/zh/) · [在线演示](https://debugger.site/zh/#demo) · [文档](docs/architecture.zh-CN.md) · [English](README.md) | 简体中文

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
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

### 1. 运行网关

```bash
make -j16                          # 构建 gateway/bin/rwd-<os>-<arch>（需要 Go 和 Node）
RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

打开 http://localhost:8080 登录。部署到服务器请用 [`deploy/platform`](deploy/platform/README.zh-CN.md) 里的 Docker Compose 方案：可以放在你已有的 TLS 反向代理后面，也可以设置 `RWD_DOMAIN=<域名>` 让它自己提供 HTTPS。全部配置项见 [`gateway/README.zh-CN.md`](gateway/README.zh-CN.md)。如果希望 MCP 工具说明和返回结果使用中文，设置 `RWD_LANG=zh`。

### 2. 让页面上线

在控制台新建项目拿到接入 Key，然后在页面里加上 SDK：

```html
<script src="https://rwd.example.com/v1/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

App 里的 WebView 需要在原生代码中于 document start 时注入同样的脚本（iOS 用 `WKUserScript`，Android 用 `addDocumentStartJavaScript`），详见[原生接入](docs/native-integration.zh-CN.md)和控制台内置的接入指南。

### 3. 接入你的 agent

在控制台创建一个 API Key（一个 Key 可以访问所有设备），然后：

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

接着直接问它：*「连接设备 K7Q2-9M4X，查一下为什么结算页的合计显示 `--`。」*

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
| [`docs/`](docs) | [架构](docs/architecture.zh-CN.md)、[协议](docs/protocol.zh-CN.md)、[原生接入](docs/native-integration.zh-CN.md) |

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
