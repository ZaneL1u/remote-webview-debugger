English | [简体中文](CHANGELOG.zh-CN.md)

# Changelog

The page SDK, published to npm as [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger). Tags: `sdk-vX.Y.Z`.

## v0.2.1 (2026-11-04)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/sdk-v0.2.0...sdk-v0.2.1)

### 🩹 Fixes

- the task card's current-step ripple is no longer clipped by the step list ([1b7a889](https://github.com/ZaneL1u/remote-webview-debugger/commit/1b7a889))
- a device whose first welcome was lost starts over instead of being refused forever ([d58e91f](https://github.com/ZaneL1u/remote-webview-debugger/commit/d58e91f))

### 📖 Documentation

- SDK 0.2.0 in every language ([fe1334c](https://github.com/ZaneL1u/remote-webview-debugger/commit/fe1334c))

## v0.2.0 (2026-11-03)

[compare changes](https://github.com/ZaneL1u/remote-webview-debugger/compare/sdk-v0.1.0...sdk-v0.2.0)

### 🚀 Enhancements

- language packs in 11 languages, your own packs and styles ([9febf83](https://github.com/ZaneL1u/remote-webview-debugger/commit/9febf83))
- "Request assistance" and "Assisting" instead of "Get help", in every language ([73637cb](https://github.com/ZaneL1u/remote-webview-debugger/commit/73637cb))

### 🔥 Performance

- mangle the whole bundle and minify the UI's stylesheets ([555779e](https://github.com/ZaneL1u/remote-webview-debugger/commit/555779e))

### 📖 Documentation

- README and docs in Traditional Chinese, Japanese, Spanish, French, Russian and Arabic ([9ba0aae](https://github.com/ZaneL1u/remote-webview-debugger/commit/9ba0aae))
- languages and styling, in every doc language ([d17b1f5](https://github.com/ZaneL1u/remote-webview-debugger/commit/d17b1f5))
- Korean, German and Brazilian Portuguese, the same 11 languages as the UI ([0161fed](https://github.com/ZaneL1u/remote-webview-debugger/commit/0161fed))
- "Request assistance" and "Assisting" instead of "Get help" ([09f9f1c](https://github.com/ZaneL1u/remote-webview-debugger/commit/09f9f1c))

## v0.1.0 (2026-11-03)

First release.

### 🚀 Enhancements

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

### 🩹 Fixes

- no nav events; the gateway derives navigations from page messages ([d8ed57e](https://github.com/ZaneL1u/remote-webview-debugger/commit/d8ed57e))

### 📦 Build

- publish to npm as remote-webview-debugger ([1e361da](https://github.com/ZaneL1u/remote-webview-debugger/commit/1e361da))

### 📖 Documentation

- gateway, SDK and deployment READMEs in both languages ([a6fc85f](https://github.com/ZaneL1u/remote-webview-debugger/commit/a6fc85f))
- load the SDK from jsDelivr / unpkg or npm; release binaries and image ([f2308af](https://github.com/ZaneL1u/remote-webview-debugger/commit/f2308af))
