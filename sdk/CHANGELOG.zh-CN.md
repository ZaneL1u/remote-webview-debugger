[English](CHANGELOG.md) | 简体中文

# 更新日志

页面 SDK，npm 包名 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)。tag 形如 `sdk-vX.Y.Z`。

## v0.2.1 (2026-11-04)

[对比变更](https://github.com/ZaneL1u/remote-webview-debugger/compare/sdk-v0.2.0...sdk-v0.2.1)

### 🩹 修复

- 任务卡当前步骤的扩散动画不再被步骤列表裁掉 ([1b7a889](https://github.com/ZaneL1u/remote-webview-debugger/commit/1b7a889))
- 首次握手的 welcome 丢失时，设备会作为新设备重新注册，不再被网关永久拒绝 ([d58e91f](https://github.com/ZaneL1u/remote-webview-debugger/commit/d58e91f))

### 📖 文档

- 各语言文档里的 SDK 版本号更新为 0.2.0 ([fe1334c](https://github.com/ZaneL1u/remote-webview-debugger/commit/fe1334c))

## v0.2.0 (2026-11-03)

[对比变更](https://github.com/ZaneL1u/remote-webview-debugger/compare/sdk-v0.1.0...sdk-v0.2.0)

### 🚀 新功能

- 手机端界面支持 11 种语言：自动选择并逐级回退、按需加载、可注册自定义语言包和覆盖文案、阿拉伯语从右到左排版；样式可用 CSS 变量、run({ style }) 和 ::part 覆盖 ([9febf83](https://github.com/ZaneL1u/remote-webview-debugger/commit/9febf83))
- 「求助」改为「请求协助」，设备状态显示为「协助中」，11 种语言的手机界面、控制台和面向 agent 的文案一起调整 ([73637cb](https://github.com/ZaneL1u/remote-webview-debugger/commit/73637cb))

### 🔥 性能

- sdk.js 体积减小约 10%（gzip 后 85.3 KB → 76.9 KB）：修复了一处阻止整体混淆的直接 eval，并压缩了界面样式 ([555779e](https://github.com/ZaneL1u/remote-webview-debugger/commit/555779e))

### 📖 文档

- README and docs in Traditional Chinese, Japanese, Spanish, French, Russian and Arabic ([9ba0aae](https://github.com/ZaneL1u/remote-webview-debugger/commit/9ba0aae))
- 文档：说明 11 种语言、语言包加载与自定义、样式覆盖（CSS 变量、run({ style })、::part），并同步到各语言译本 ([d17b1f5](https://github.com/ZaneL1u/remote-webview-debugger/commit/d17b1f5))
- 文档新增韩语、德语、巴西葡萄牙语译本，与界面的 11 种语言一致；所有文档的语言切换行列出全部语言 ([0161fed](https://github.com/ZaneL1u/remote-webview-debugger/commit/0161fed))
- 文档中「求助」改为「请求协助」，设备状态改为「协助中」，11 种语言同步 ([09f9f1c](https://github.com/ZaneL1u/remote-webview-debugger/commit/09f9f1c))

## v0.1.0 (2026-11-03)

首个版本。

### 🚀 新功能

- **engine:** bounded event buffer and response-body cache ([6d7ecc2](https://github.com/ZaneL1u/remote-webview-debugger/commit/6d7ecc2))
- **engine:** aria snapshots from Playwright's injected scripts (Apache-2.0) ([8ff085d](https://github.com/ZaneL1u/remote-webview-debugger/commit/8ff085d))
- **engine:** rwd RPC core: snapshot with element refs, DOM helpers, errors ([96d5478](https://github.com/ZaneL1u/remote-webview-debugger/commit/96d5478))
- **engine:** actions: click, fill, select, hover, scroll, drag, navigate, evaluate ([6f3aba2](https://github.com/ZaneL1u/remote-webview-debugger/commit/6f3aba2))
- **engine:** keyboard: Playwright key names, editing keys, IME-style text insertion ([b059c53](https://github.com/ZaneL1u/remote-webview-debugger/commit/b059c53))
- **engine:** console and network observation with a cross-page timeline ([9192481](https://github.com/ZaneL1u/remote-webview-debugger/commit/9192481))
- **engine:** mask passwords, data-rwd-mask and configured patterns everywhere ([4cd262a](https://github.com/ZaneL1u/remote-webview-debugger/commit/4cd262a))
- **engine:** rwd.storage: localStorage, sessionStorage and cookies ([a61f0c9](https://github.com/ZaneL1u/remote-webview-debugger/commit/a61f0c9))
- **engine:** screenshots: native bridge first, DOM rendering as fallback ([39ca812](https://github.com/ZaneL1u/remote-webview-debugger/commit/39ca812))
- **engine:** access levels and sensitive-action confirmation in the page ([f73c2dd](https://github.com/ZaneL1u/remote-webview-debugger/commit/f73c2dd))
- page SDK: run(), transport and identities ([2dbd4a8](https://github.com/ZaneL1u/remote-webview-debugger/commit/2dbd4a8))
- in-page UI: device-code pill, floating card, bottom bar, agent cursor ([7a03025](https://github.com/ZaneL1u/remote-webview-debugger/commit/7a03025))
- attach approval with levels and confirm dialogs ([8cdd24d](https://github.com/ZaneL1u/remote-webview-debugger/commit/8cdd24d))
- follow navigation, title and visibility changes ([20de798](https://github.com/ZaneL1u/remote-webview-debugger/commit/20de798))
- JavaScript API for native hosts ([3f4b92c](https://github.com/ZaneL1u/remote-webview-debugger/commit/3f4b92c))
- optional eruda tab ([aa932ed](https://github.com/ZaneL1u/remote-webview-debugger/commit/aa932ed))
- **engine:** agent-facing messages follow welcome.agentLang ([7772845](https://github.com/ZaneL1u/remote-webview-debugger/commit/7772845))
- run({ lang }) for the phone user's UI ([f742810](https://github.com/ZaneL1u/remote-webview-debugger/commit/f742810))
- **engine:** list overlays in snapshots; name the element that blocks a click ([4ee90b0](https://github.com/ZaneL1u/remote-webview-debugger/commit/4ee90b0))
- session log: what happened on the device since the app was launched ([0199a39](https://github.com/ZaneL1u/remote-webview-debugger/commit/0199a39))
- lock the page as soon as an agent attaches; show how long it has been connected ([3b4a34b](https://github.com/ZaneL1u/remote-webview-debugger/commit/3b4a34b))

### 🩹 修复

- no nav events; the gateway derives navigations from page messages ([d8ed57e](https://github.com/ZaneL1u/remote-webview-debugger/commit/d8ed57e))

### 📦 构建

- publish to npm as remote-webview-debugger ([1e361da](https://github.com/ZaneL1u/remote-webview-debugger/commit/1e361da))

### 📖 文档

- gateway, SDK and deployment READMEs in both languages ([a6fc85f](https://github.com/ZaneL1u/remote-webview-debugger/commit/a6fc85f))
- load the SDK from jsDelivr / unpkg or npm; release binaries and image ([f2308af](https://github.com/ZaneL1u/remote-webview-debugger/commit/f2308af))
