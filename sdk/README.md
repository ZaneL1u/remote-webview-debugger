English | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD page SDK (`sdk/`)

One JS file that an App WebView or H5 page loads, so an AI agent can inspect and operate the page through the RWD gateway (`gateway/`) and MCP. Protocol: [`docs/protocol.md`](../docs/protocol.md); architecture: [`docs/architecture.md`](../docs/architecture.md).

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // optional
    deviceId: "…",               // optional; passed in by a native host that injects the SDK
    helpButton: true,            // optional; show the "Request assistance" button
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // optional; a language tag, default from the browser's languages
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## Getting the SDK

Published to npm as [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger); versions and changes: [CHANGELOG](CHANGELOG.md).

| Use | Where |
|---|---|
| `<script>` from a CDN | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js` or `https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js` (minified IIFE, global `RemoteWebviewDebugger`; pin the version, and add `integrity` if you like) |
| A bundler | `npm install remote-webview-debugger`, then `import { run, status } from 'remote-webview-debugger'` (ES module with types). Import it before your own code so capture starts early. Don't also load the `<script>` version on the same page |
| Your gateway | `https://<gateway>/v1/sdk.js`, the copy the gateway embeds (also at a content-addressed URL for SRI, offered by the console) |
| A native app | Bundle `dist/sdk.js` from the package, or download it from one of the above; see [native integration](../docs/native-integration.md) |

## API

| API | Description |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | Bring the page online (device code, pill). Returns `Promise<{deviceCode, status}>`; calling it again is harmless. Options below. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`; `status` is `idle / connecting / online / polling / stopped / rejected / quota`, `lang` the UI language (`null` before `run()`), `logSession` the session log this page writes to (`null` when not recording) |
| `stop()` | Disconnect and remove the UI (console / network collection continues, bounded) |
| `setUser(userId)` | Change the user; reconnects once with a new `hello` |
| `help(on)` | Request assistance / cancel the request |
| `nativeControl(nativeKey, action)` | Take over / hand back / end from the native host's own UI |
| `nativeDecide(nativeKey, requestId, value)` | With `nativeApproval`, answer `status().pending`: a level or `null` for an attach request, `'allow'` or `null` for a sensitive-action confirmation |
| `setLang(lang?)` | Switch the UI language at runtime (an app's own language setting); no argument goes back to the browser's languages. See [Languages](#languages) |
| `registerLocale(pack)` | Add a language pack, or replace one with the same `id` (also takes an array). See [Languages](#languages) |
| `builtinLocales` | The ids of the built-in packs |

`run()` options:

| Option | Description |
|---|---|
| `userId` | The signed-in user, sent with the `hello` |
| `deviceId` | A stable device id from a native host (otherwise one is kept in localStorage) |
| `helpButton` | Show the "Request assistance" button (OR-ed with the project policy) |
| `app` | `{ name, version }` of the host app |
| `lang` | Language of everything the phone user sees (pill, floating window, bottom bar, dialogs, toasts, the eruda tab, and the "AI wants to …" description of a sensitive action): a language tag such as `'ja'` or `'pt-BR'`. Default: the browser's languages. See [Languages](#languages) |
| `locales` | Extra language packs, registered before the language is picked (like `registerLocale`) |
| `messages` | Messages to override, per language: `{ en: { ui: { help: 'Contact support' } }, zh: { ui: { help: '联系客服' } } }` |
| `networkExclude` | Requests the agent should not have to wade through — fonts that always 404, analytics beacons: `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. Each rule matches the URL as a case-insensitive substring, as a `*` wildcard pattern, or as a regex when written `/…/`. Added to the project policy's rules. Matching requests stay out of the network list and out of `net_fail` timeline events; the page still records them, so an agent can ask for them with `includeExcluded` |
| `lockScreen` | `false`: don't lock the page while an agent is attached (the user can still change it in the floating window). Default `true` |
| `theme` | `'auto'` (default, follows the page background), `'system'`, `'light'` or `'dark'` |
| `style` | Colors, fonts, radii, z-index and positions of the UI: `{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`. See [Styling](#styling) |
| `eruda` | `true` or `{ dock, load, src, name }`: show Remote Debugger as a tab inside eruda; `load` loads the latest eruda when the page has none. Off by default; the project policy can turn it on remotely, local options win field by field |
| `record` | `false`: this page writes no session log (and nothing already stored is deleted). Default `true`; the project policy can turn the log off for every page |
| `launchId` | Which launch of the app this page belongs to, so every WebView of one app process files its session log under one session. A native host passes its own id here (or defines `window.RWDLaunchId` as a string or a function returning one); otherwise the SDK infers the launch from a session cookie plus a heartbeat |
| `nativeKey`, `deviceToken`, `nativeApproval` | For native hosts: the secret for `nativeControl` / `nativeDecide`, the device token the host keeps, and asking the attach / confirm questions natively |

## Languages

Built in: English (`en`), Simplified Chinese (`zh`), Traditional Chinese (`zh-TW`, also used for `zh-HK`, `zh-MO` and `zh-Hant`), French (`fr`), Spanish (`es`), Russian (`ru`), Arabic (`ar`, laid out right to left), Japanese (`ja`), Korean (`ko`), German (`de`) and Portuguese (`pt`, Brazilian; also used for `pt-PT`).

**Picking the language.** The phone user's language is `run({ lang })` if given, then each of `navigator.languages` in order. For each tag the SDK tries the tag and then shorter forms of it (`pt-BR` → `pt`, `zh-HK` → `zh-TW` → `zh`), takes the first language it has a pack for, and falls back to English. Messages missing from a pack fall back the same way, so a partial pack is fine. `setLang('ja')` switches at runtime; `status().lang` is the pack in use.

**Loading.** English and Simplified Chinese are inside `sdk.js`. The other packs load on demand, the first time a page needs them (the UI shows the fallback language for that moment):

- `<script>` build: from `locales/<id>.js` next to `sdk.js` (the CDN path, e.g. `…/remote-webview-debugger@0.1.0/dist/locales/ja.js`, or your gateway's `/v1/locales/ja.js`), and from the gateway passed to `run()` if that fails. To avoid the extra request, load the pack yourself, before or after `sdk.js`: `<script src="…/dist/locales/ja.js"></script>`.
- ES module build: a dynamic import, so your bundler puts each language in its own chunk. To bundle one up front instead: `import ja from 'remote-webview-debugger/locales/ja'`, then `run(url, key, { locales: [ja] })`.

**Your own packs and wording.** A pack is `{ id, name, dir?, ui?, action?, agent? }`; anything left out comes from its fallback languages:

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Richiedi assistenza' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { en: { ui: { help: 'Contact support' } } }, // change single messages of any language
})
```

`ui` is the UI text, `action` completes "AI wants to …" in the confirmation dialog, and `agent` is what goes back to the agent. The TypeScript types (`LocalePack`, `Messages`, `UiMessages`, `ActionMessages`, `AgentMessages`) list every key; `src/locales/en.ts` is the reference.

**Two audiences.** The phone user gets the language above. The agent reads RPC error messages and timeline summaries (taps, in-page navigation, failed requests) in the gateway's language, `welcome.agentLang` (`RWD_LANG`), loading that pack the same way. English until a welcome says otherwise; the last value is kept in localStorage `rwd:alang`, so events from before the next page's welcome use it too.

So a Chinese-speaking user can work with an English-speaking agent: the dialog asks `AI 想要点击「提交订单」，允许吗？` and, if refused, the agent reads `The user denied this action`.

## Styling

The UI lives in a shadow root on `#__rwd` (outside `<body>`), so page CSS doesn't reach it except through these hooks:

- **CSS custom properties** on `:root` or `#__rwd`, e.g. `:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`.
- **`run({ style })`**, which sets the same properties on `#__rwd`. Colors take any CSS color there.
- **`::part()`** for anything else: `#__rwd::part(bar) { … }`. Parts: `pill`, `window`, `bar`, `task`, `dialog`, `toast`, `button`, `cursor`, `glow`, `overlay`. Class names inside are not a stable API.
- **`theme`**: light or dark glass (default: follows the page background).

| Property | `style` field | Default | What |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | Buttons, switches, the agent's pointer, highlights and the edge glow |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | The End button |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | Request assistance and Assisting; the user-in-control state |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | Online dot; "copied" |
| `--rwd-font` | `font` | system UI font (per language for Chinese, Japanese, Korean) | All text |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | Device code and tags |
| `--rwd-radius` | `radius` | `18px` | Floating window; the dialog is 2px rounder, the task card and pill 2px less, dialog buttons 6px less |
| `--rwd-button-radius` | `buttonRadius` | `999px` | Buttons, the bottom bar and toasts |
| `--rwd-z-index` | `zIndex` | `2147483647` | The whole UI |
| `--rwd-bar-bottom` | `barBottom` | `14px` | Bottom bar, above the bottom safe area |
| `--rwd-task-top` | `taskTop` | `10px` | Task card, below the top safe area |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | Toasts, above the bottom safe area |
| — | `pill: { side, top }` | right edge (left in right-to-left languages), `0.62` | Where the idle pill starts until the user drags it; `top` from 0 (top) to 1 (bottom) |

Colors are `r, g, b` triplets so that the translucent shades follow (the same convention as Bootstrap's `--bs-*-rgb`).

## Behavior in the page (protocol §6–§8, §11)

- Levels: RPCs are checked against `welcome.level` / `control.level` (`forbidden`, "Requires the … level"). An agent without a level (an older gateway) gets `interact`; with no agent attached nothing extra is enforced.
- The device token is kept in localStorage `rwd:dtoken`, the resume token in sessionStorage `rwd:resume` (bound to the pageId). Close code 4401: if the token changed meanwhile (another tab of the device just got it), retry once right away, else `rejected` and retry after about 10 minutes; 4409: reconnect with a new pageId; 4429: `quota`, retry after about 5 minutes.
- `rwd_invite` in the address bar is taken out at `run()` (`history.replaceState`) and sent with the hello until a welcome arrives.
- `welcome.config`: `helpButton` (OR-ed with the `run()` option), `maskSelectors`, `maskPatterns` (snapshot, console, network URLs, storage values, timeline summaries), `confirmSelectors`, `networkExclude` (added to the `run()` option's rules), `sessionLog`. The last config is kept in localStorage `rwd:cfg` and used until the welcome arrives — so a project that turned the session log off keeps it off from the first moment of the next page, before any welcome.
- Snapshots end with an `[Overlays]` section listing what floats over the page — a popup's backdrop, a modal, a bottom sheet — with its tag, a short piece of text, how much of the viewport it covers and a ref. A backdrop is an empty element the aria snapshot has no node for, so it gets an `oN` ref instead of `eN`; that is what lets an agent tap it to close the popup.
- A click aims at the element's visible centre first, then at the other spots of a 3×3 grid inside it, so a badge over a button doesn't block it. When every spot is covered, the RPC fails with `not_interactable` and names the obscuring element and its ref.
- The attach and sensitive-action dialogs (`[data-rwd-confirm]`, `confirmSelectors`, including Enter submitting a form) live in a Shadow DOM, accept trusted taps only, and arm 0.4 s after they appear. Tabs of the same origin share decided attach requests over BroadcastChannel.

Loading the file starts collecting console, uncaught errors and network (XHR, fetch, WebSocket, sendBeacon, EventSource), at most 500 entries each; when full, plain logs and successful requests go first. Response bodies are cached up to 5 MB in total, 64 KB each. So load it synchronously and early in `<head>`.

## Session log (protocol §5.4)

Those buffers are one page's memory. In parallel the SDK writes a **session log** to IndexedDB (`rwd-log`) on the device, so an agent that attaches after a bug can still read the whole way to it:

- One session is one launch of the app, shared by every page of the origin: `run({ launchId })`, else `window.RWDLaunchId`, else inferred from the session cookie `rwd_launch` plus a heartbeat (a cookie session silent for over an hour counts as a new launch). `status().logSession` is the id in use.
- Recorded: page open / in-page navigation / foreground-background / leave, the user's taps, input, submits and scroll rest positions, the agent's interactive calls and `rwd.evaluate`, control changes, console at every level, and every finished request — failed ones also with redacted headers and bodies (64 KB each). It runs whether or not the gateway is reachable. Masked fields are stored as `••••`, `maskPatterns` are applied as records are written.
- Kept: the last 3 launches, 10 MB each; over that, plain logs and successful requests are dropped first. Only the current launch when the storage quota is under 64 MB; nothing at all without IndexedDB.
- Read by the agent with `rwd.log` (`observe`) and `rwd.logDetail` (`advanced`, for headers and bodies). Nothing leaves the device otherwise.
- Off with `run({ record: false })` for one page, or `policy.sessionLog: false` for the project — which also deletes what this origin already stored.

## Layout

- `src/index.ts`: public API, session, RPC dispatch, control state.
- `src/transport.ts`: the page WebSocket (the native constructor), heartbeat timeout, exponential backoff, and after 3 failed attempts `POST /v1/presence` every 60 s.
- `src/ids.ts`: deviceId / pageId / openerId.
- `src/launch.ts`: which launch of the app this page belongs to (`launchId`, `window.RWDLaunchId`, the `rwd_launch` cookie).
- `src/pageWatch.ts`: `page` messages (url, title, visibility) and timeline events (in-page navigation, the user's taps).
- `src/ui.ts`, `src/lock.ts`: the pill, Request assistance button, lock overlay, glow, action highlight and dialogs in a Shadow DOM; blocks the user's trusted input while an agent is attached, and shows how long it has been connected.
- `src/approval.ts`: attach approval and sensitive-action confirmation (page dialog, or the native host via `nativeDecide`).
- `src/i18n.ts`, `src/locales/`, `src/localeLoader*.ts`: language packs (UI, action and agent text per language), picking and fallback, on-demand loading; `scripts/locales.mjs` builds `dist/locales/<id>.js`.
- The agent engine lives next to chobitsu in `packages/chobitsu/src/engine/rwd/`: snapshot, `rwd.query`, actionability checks, synthesized input, keyboard, console / network buffers, screenshots, `rwd.storage`, the session log in IndexedDB (`coldlog.ts`), overlay detection (`overlays.ts`), levels and confirmation rules (`policy.ts`), agent-facing text (`i18n.ts`). The Playwright sources used for snapshots are in `packages/chobitsu/src/engine/vendor/playwright/`. The build bundles them from source into `dist/sdk.js`.

## Build and test

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE, global RemoteWebviewDebugger, ES2017), dist/index.mjs + index.d.ts (ES module)
npm run typecheck
npm test             # Playwright: WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # local mock gateway: http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

The tests use `test/mock-gateway.mjs`, which implements the page side of the protocol (welcome, control state, RPCs, presence; tokens, close codes, levels, remote config, `agentLang`, attach approval) and serves `/v1/sdk.js`, the language packs under `/v1/locales/` and the demo shop. It does not check levels itself, so the tests exercise the page's own enforcement. The specs in `test/e2e/` run with a `zh-CN` browser and `agentLang: 'zh'` unless a test says otherwise; `i18n.spec.ts` covers English, `locales.spec.ts` the other language packs, fallback, custom packs, styling and the right-to-left layout. The coexistence test loads eruda 3.4.3 and PageSpy 2.4.0 from jsdelivr, so it needs internet access.
