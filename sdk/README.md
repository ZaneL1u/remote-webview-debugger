English | [简体中文](README.zh-CN.md)

# RWD page SDK (`sdk/`)

One JS file that an App WebView or H5 page loads, so an AI agent can inspect and operate the page through the RWD gateway (`gateway/`) and MCP. Protocol: [`docs/protocol.md`](../docs/protocol.md); architecture: [`docs/architecture.md`](../docs/architecture.md).

```html
<script src="https://rwd.example.com/v1/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // optional
    deviceId: "…",               // optional; passed in by a native host that injects the SDK
    helpButton: true,            // optional; show the "Get help" button
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // optional; 'en' | 'zh', default from navigator.language
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

| API | Description |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | Bring the page online (device code, pill). Returns `Promise<{deviceCode, status}>`; calling it again is harmless. Options below. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`; `status` is `idle / connecting / online / polling / stopped / rejected / quota`, `lang` the UI language (`null` before `run()`), `logSession` the session log this page writes to (`null` when not recording) |
| `stop()` | Disconnect and remove the UI (console / network collection continues, bounded) |
| `setUser(userId)` | Change the user; reconnects once with a new `hello` |
| `help(on)` | Ask for help / cancel |
| `nativeControl(nativeKey, action)` | Take over / hand back / end from the native host's own UI |
| `nativeDecide(nativeKey, requestId, value)` | With `nativeApproval`, answer `status().pending`: a level or `null` for an attach request, `'allow'` or `null` for a sensitive-action confirmation |

`run()` options:

| Option | Description |
|---|---|
| `userId` | The signed-in user, sent with the `hello` |
| `deviceId` | A stable device id from a native host (otherwise one is kept in localStorage) |
| `helpButton` | Show the "Get help" button (OR-ed with the project policy) |
| `app` | `{ name, version }` of the host app |
| `lang` | Language of everything the phone user sees (pill, floating window, bottom bar, dialogs, toasts, the eruda tab, and the "AI wants to …" description of a sensitive action): `'en'` or `'zh'`. Default: `'zh'` when `navigator.language` starts with `zh`, else `'en'`. |
| `networkExclude` | Requests the agent should not have to wade through — fonts that always 404, analytics beacons: `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. Each rule matches the URL as a case-insensitive substring, as a `*` wildcard pattern, or as a regex when written `/…/`. Added to the project policy's rules. Matching requests stay out of the network list and out of `net_fail` timeline events; the page still records them, so an agent can ask for them with `includeExcluded` |
| `lockScreen` | `false`: don't lock the page while an agent is attached (the user can still change it in the floating window). Default `true` |
| `theme` | `'auto'` (default, follows the page background), `'system'`, `'light'` or `'dark'` |
| `eruda` | `true` or `{ dock, load, src, name }`: show Remote Debugger as a tab inside eruda; `load` loads the latest eruda when the page has none. Off by default; the project policy can turn it on remotely, local options win field by field |
| `record` | `false`: this page writes no session log (and nothing already stored is deleted). Default `true`; the project policy can turn the log off for every page |
| `launchId` | Which launch of the app this page belongs to, so every WebView of one app process files its session log under one session. A native host passes its own id here (or defines `window.RWDLaunchId` as a string or a function returning one); otherwise the SDK infers the launch from a session cookie plus a heartbeat |
| `nativeKey`, `deviceToken`, `nativeApproval` | For native hosts: the secret for `nativeControl` / `nativeDecide`, the device token the host keeps, and asking the attach / confirm questions natively |

## Languages

Two audiences, two settings:

- **Phone user**: `run({ lang })`, else the browser's language (see above). Catalog: `src/i18n.ts`.
- **Agent**: RPC error messages and timeline summaries (taps, in-page navigation, failed requests) follow the gateway's `welcome.agentLang` (`'en'` / `'zh'`). English until a welcome says otherwise; the last value is kept in localStorage `rwd:alang`, so events from before the next page's welcome use it too. Catalog: `packages/chobitsu/src/engine/rwd/i18n.ts`.

So a Chinese-speaking user can work with an English-speaking agent: the dialog asks `AI 想要点击「提交订单」，允许吗？` and, if refused, the agent reads `The user denied this action`.

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
- `src/ui.ts`, `src/lock.ts`: the pill, help button, lock overlay, glow, action highlight and dialogs in a Shadow DOM; blocks the user's trusted input while an agent is attached, and shows how long it has been connected.
- `src/approval.ts`: attach approval and sensitive-action confirmation (page dialog, or the native host via `nativeDecide`).
- `src/i18n.ts`: the user's UI text (en / zh).
- The agent engine lives next to chobitsu in `packages/chobitsu/src/engine/rwd/`: snapshot, `rwd.query`, actionability checks, synthesized input, keyboard, console / network buffers, screenshots, `rwd.storage`, the session log in IndexedDB (`coldlog.ts`), overlay detection (`overlays.ts`), levels and confirmation rules (`policy.ts`), agent-facing text (`i18n.ts`). The Playwright sources used for snapshots are in `packages/chobitsu/src/engine/vendor/playwright/`. The build bundles them from source into `dist/sdk.js`.

## Build and test

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE, global RemoteWebviewDebugger, ES2017)
npm run typecheck
npm test             # Playwright: WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # local mock gateway: http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

The tests use `test/mock-gateway.mjs`, which implements the page side of the protocol (welcome, control state, RPCs, presence; tokens, close codes, levels, remote config, `agentLang`, attach approval) and serves `/v1/sdk.js` and the demo shop. It does not check levels itself, so the tests exercise the page's own enforcement. The specs in `test/e2e/` run with a `zh-CN` browser and `agentLang: 'zh'` unless a test says otherwise; `i18n.spec.ts` covers English. The coexistence test loads eruda 3.4.3 and PageSpy 2.4.0 from jsdelivr, so it needs internet access.
