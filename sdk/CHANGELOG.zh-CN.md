[English](CHANGELOG.md) | 简体中文

# 更新日志

页面 SDK，npm 包名 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)。tag 形如 `sdk-vX.Y.Z`。

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
