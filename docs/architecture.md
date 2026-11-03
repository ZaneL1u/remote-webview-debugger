English | [简体中文](architecture.zh-CN.md) | [繁體中文](architecture.zh-TW.md) | [日本語](architecture.ja.md) | [한국어](architecture.ko.md) | [Español](architecture.es.md) | [Français](architecture.fr.md) | [Deutsch](architecture.de.md) | [Português (Brasil)](architecture.pt-BR.md) | [Русский](architecture.ru.md) | [العربية](architecture.ar.md)

# Architecture

Remote WebView Debugger lets an AI agent inspect and operate a web page that is open on someone else's phone: an H5 page in a mobile browser or super app, or a WebView inside your own app. The agent talks MCP to a self-hosted gateway; the gateway talks to a small SDK running inside the page. The phone user approves the connection, sees what the agent does and can take over at any time.

This document explains the moving parts and the rules they follow. The exact messages and endpoints are in [protocol.md](protocol.md); app integration is in [native-integration.md](native-integration.md); deployment is in [gateway/README.md](../gateway/README.md) and [deploy/platform/README.md](../deploy/platform/README.md).

## Components

```
  AI agent (Claude Code, Cursor, any MCP client)
        │  MCP: Streamable HTTP + Bearer API key
        │  (or stdio through the `rwd mcp` bridge)
        ▼
┌──────────────────────────── Gateway (one Go binary) ────────────────────────────┐
│  /v1/mcp      MCP tools ─────┐                                                  │
│  /v1/api      REST + SSE ────┼──▶ hub: devices, pages, control state, approvals,│
│  /v1/page     page WebSocket ┘        timelines, RPC routing   (in memory)      │
│  /v1/sdk.js   embedded page SDK      store: SQLite or Postgres (persistent)     │
│  /            embedded web console                                              │
└───────────▲──────────────────────────────────────────────▲──────────────────────┘
            │ HTTPS, cookie session                        │ WebSocket (wss://…/v1/page)
       Web console                                         │ POST /v1/presence as a fallback
       (support staff, admins)                             │
                                  ┌──────────── phone ─────┴────────────────────┐
                                  │  H5 page / App WebView                      │
                                  │    page SDK: link to the gateway, UI        │
                                  │      (pill, dialogs, lock) in a Shadow DOM  │
                                  │    engine: snapshots, actions, console and  │
                                  │      network capture, masking, levels       │
                                  │  native host (optional): injects the SDK,   │
                                  │    real screenshots, native dialogs/buttons │
                                  └─────────────────────────────────────────────┘
```

| Component | Path | Role |
|---|---|---|
| Gateway | [`gateway/`](../gateway) | Go server. Accepts page connections, keeps live device state in memory, serves the hosted MCP endpoint, the console's REST API and live updates, records the audit log. Embeds the console and the SDK, so one binary is the whole server |
| Page SDK | [`sdk/`](../sdk) | `sdk.js`, loaded by the page or injected by the app. Owns the connection, identity, the in-page UI, consent dialogs and the screen lock |
| Engine | [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine) | The page-side half of every agent action: accessibility snapshots (Playwright's aria snapshot code) and the layers floating over them, actionability checks and synthetic input, console and network capture (built on [chobitsu](https://github.com/liriliri/chobitsu)), screenshots, masking, level checks |
| Console | [`console/`](../console) | React single-page app: projects and integration snippets, devices and their timelines, API keys, members, policies, invites, audit log |
| Native host | your app; reference in [`examples/mock-app`](../examples/mock-app) | Injects the SDK into every WebView at document start, keeps the device id and token, provides real screenshots and, optionally, native approval dialogs and buttons |

## A debugging session

1. **The page comes online.** The page loads `sdk.js` (or the app injects it). Console, error and network capture start immediately, in bounded buffers, so an agent that connects later still sees what happened before. `run()` opens a WebSocket to the gateway and sends `hello`; the gateway replies with the device's **device code** (e.g. `K7Q2-9M4X`) and the project's remote configuration. The pill on the page shows the code.
2. **Someone points the agent at the device.** The user reads out the device code, taps **Get help** (the device shows up first in every list), or opens an **invite link** from support, which brings the device online already asking for help.
3. **The agent connects.** It calls `connect_device` with the code. Unless the project says otherwise, the user sees *AI wants to join* on the phone, picks a level (view only, view and interact, advanced) or refuses. Nothing is readable before that. Once the agent is in, the screen locks against the user's input, the edges glow and the bottom bar counts how long it has been connected.
4. **The agent works.** It takes a snapshot to get element refs, then clicks, fills and scrolls by ref. The snapshot also lists the popups and backdrops that float over the page, each with a ref, and a click a layer blocks fails with the name and ref of what blocked it — so the agent can tap a backdrop to close its popup instead of guessing. Its first action switches the device from *observe* to *agent*, and an agent cursor shows where it acts. It can also read console, network, storage and screenshots, depending on its level.
5. **The user stays in charge.** **Take over** returns the page to the user and pauses the agent (its actions fail with `takeover` until the user taps **Hand back**). **End** detaches the agent. Clicks on elements marked as sensitive (place order, pay, delete) need the user's OK on the phone.
6. **The agent leaves** with `disconnect_device`, after two minutes without actions the device drops back to *observe*, and after the project's maximum attach time (60 minutes by default) the agent is detached.

One action, end to end:

```
agent ─ click(ref=e12) ─▶ MCP handler
   gateway: API key valid? → attached? → level ≥ interact? → user hasn't taken over?
            observe (screen locked) → agent → RPC {"method":"rwd.click","params":{"ref":"e12"}}
   ─── WebSocket ──▶ SDK: level ≥ interact? not taken over? sensitive element → ask the user
                     engine: wait until visible, stable, enabled, hit-testable (≤ 5 s)
                             move the agent cursor, highlight, dispatch pointer/mouse/touch events
   ◀── {"id":…, "result":{}} ───
   gateway: audit "rpc" (method, page, latency; no payload)
agent ◀─ "Clicked e12 (page p2)." + [Session changes] (new pages, navigations, errors, takeovers)
```

Each action is a single round trip: the actionability checks and event dispatch run inside the page, not over the network.

## Devices, pages and agents

**Device.** One `deviceId`: one browser profile, or one app install when a native host passes its own id. The gateway assigns each device a permanent device code. Devices are not tied to projects: a phone that opens pages from two projects (two app keys) is one device with pages from both. API keys aren't tied to projects either, so one MCP server reaches every device.

**Page.** One tab or WebView, identified by a `pageId` that survives reloads and navigations in that tab. The gateway labels pages `p1`, `p2`, … per device, records who opened whom, and tracks which page is in the foreground. A page that disconnects keeps its label for two minutes, long enough for a navigation to reconnect — but not when the same document shows up again elsewhere: a WebView recreated under a new `pageId` replaces the old entry at once, and a disconnected page whose URL another connected page also shows is dropped after 1.5 s. So a recreated WebView doesn't leave a ghost in the page list, and the agent is moved to the page that is really there.

**Timeline.** Each device has a timeline (in memory, last 300 events): pages opened, navigated, reloaded, focused and closed; errors, failed requests and the user's taps; help requests, approvals and control changes. Every MCP tool result ends with the timeline entries the agent hasn't seen yet, so it notices new pages, errors and takeovers without polling. In **follow mode** (the default) the agent's selected page moves to a page its action opened, or to the page the user switched to.

**Agent.** The gateway keeps one agent state per API key: the device it is attached to and its selected page. An agent is attached to one device at a time, and a device has at most one agent; a newly approved agent replaces the previous one.

**Control state.** Each device is in one of four states, decided by the gateway and broadcast to all of its pages:

```
                 agent attaches                first interactive action
       ┌──────┐ ───────────────▶ ┌─────────┐ ─────────────────────────▶ ┌───────┐
       │ none │                  │ observe │                            │ agent │
       └──────┘ ◀─────────────── └─────────┘ ◀───────────────────────── └───────┘
           ▲     agent leaves,        │        idle (default 2 min)        │
           │     End, time limit      │ Take over                Take over │
           │                          ▼                                    ▼
           │                        ┌──────┐ ◀─────────────────────────────┘
           └─────────── End ─────── │ user │ ────── Hand back ──────▶ agent
                                    └──────┘
```

In `observe` and `agent` the user's input is blocked (the user can turn the lock off in the floating window); in `user` the agent can still read but every interactive call fails with `takeover`, and the agent can call `wait_for_control` to wait for the hand-back.

## Consent and privacy

The guiding rule: **having an API key or knowing a device code is never enough to see a user's page.** Several independent checks stand between an agent and the page.

| Layer | What it does |
|---|---|
| API key | Every MCP request carries one. Keys have a maximum level, an expiry (90 days by default) and an optional IP allowlist; revoking one detaches its agent immediately. Failed device lookups are rate-limited so device codes can't be guessed |
| Device code | Only *identifies* a device. It grants nothing |
| Project policy | `approval: prompt` (the default for new projects) requires the user's approval; `maxLevel` caps what any agent may do. When a device has pages from several projects, the strictest policy applies |
| User approval | The phone shows the agent's name and key hint and the levels on offer; the user picks one or refuses. The dialog lives in a Shadow DOM and only reacts to real (trusted) taps, so an agent can't approve itself. Three refusals lock that key out of the device for 10 minutes. Users may opt into auto-allow on their own device. An agent that let go of the device itself (disconnect, switching device, attach time used up) may come back within 10 minutes without a new dialog, at no more than the level the user granted before; the user tapping **End**, a console member ending the session, a refusal or revoking the key clears that |
| Levels | `observe` (snapshot, screenshot, console, network list), `interact` (+ click, type, scroll, navigate…), `advanced` (+ run JavaScript, request bodies, storage). The effective level is the minimum of what the agent asked for, the key, the policy and the user's choice. **The SDK enforces it again inside the page**, independently of the gateway |
| Visible control | While an agent is attached the page shows it: a pill with the agent's state, a task card with its plan, an agent cursor and highlight on every action, a glowing edge while it operates. Take over, Hand back and End respond only to the user's taps; a native host must present a secret (`nativeKey`) that page scripts, including the agent's own scripts, can't read |
| Sensitive actions | Clicking an element marked `data-rwd-confirm` (or matching the policy's `confirmSelectors`), or submitting a form that contains one, waits for the user's OK on the phone |
| Masking | Password fields, `data-rwd-mask` elements and the policy's selectors and text patterns (phone, card, ID numbers…) are replaced with `••••` **inside the page**, before anything leaves the device: in snapshots, screenshots, console text, network URLs and bodies, storage values and timeline summaries. `Cookie`, `Set-Cookie` and `Authorization` headers are always redacted. The policy's `networkExclude` rules are a different thing: they only keep noise (fonts that always 404, analytics beacons) out of the lists an agent reads, and an agent can ask for the hidden requests, so they are no privacy control |
| Untrusted content | Page content handed to the agent is wrapped and labelled as untrusted data, so instructions planted in a page aren't mistaken for the user's. High-risk clicks rely on the user's confirmation, not on the agent's judgment |
| Session log | Recorded on the device, never streamed anywhere: reading it needs `observe` like any other read, and the headers and bodies of failed requests need `advanced`. The masking rules apply as they are recorded, so a masked field's value is stored as `••••`, not masked later. A project can turn the log off and have what is stored deleted |
| Audit | Logins, key and member changes, attach requests and decisions, every RPC (method, page, latency, result), the user's takeovers and endings, and refused calls. Never page content or parameter values |

What leaves the phone: the device metadata in `hello` (user agent, `userId` if the page provides one, app name and version, page URLs and titles) and short timeline summaries, from the moment `run()` is called; everything else only when an attached agent asks for it. The gateway does not store page content: snapshots, screenshots and logs pass through to the agent, and timelines live in memory. The session log is recorded on the device, under the same masking rules, and stays there until an attached agent reads it (see **Storage** below).

Known limits worth stating plainly:

- Input is synthetic: events have `isTrusted: false`, and pages that check it won't react.
- `interact` lets the agent navigate to any `http(s)` URL; it is not limited to the project's origins.
- `advanced` runs arbitrary JavaScript in the page. Masking can't apply to what such a script returns, so keep `maxLevel` at `interact` unless you need it.
- Network capture covers requests the page makes from JavaScript after the SDK loaded (fetch, XHR, WebSocket, sendBeacon, EventSource). Images, scripts, stylesheets and requests made by native code aren't seen. Content inside iframes isn't part of snapshots.
- When an app goes to the background the OS pauses its WebViews, and the device goes offline until it returns.
- Breakpoints, stepping, profiling and heap snapshots are out of scope; use Safari Web Inspector or `chrome://inspect` with a debuggable WebView for those.

## Storage

The gateway uses **SQLite** by default (pure Go, no CGO; a file set by `RWD_DATA`) or **Postgres** when `RWD_DATABASE_URL` is a `postgres://` URL. The schema is created and migrated at startup.

| Persistent (database) | In memory only (lost on restart) |
|---|---|
| Projects and their policies, app keys | Connected pages and their labels |
| Members (passwords as PBKDF2-SHA256), pending member invites | Control state, pending approvals, attached agents |
| API keys (HMAC-SHA256 hashes, levels, expiry, IP allowlists) | Device timelines |
| Known devices: id, code, userId, user agent, app, first and last seen, device-token hash | Rate-limit counters |
| Device invites (token hashes), audit log | |
| Settings: the key pepper and the session-signing secret, generated on first start | |

After a restart, pages reconnect on their own (the SDK retries with backoff) and keep their device codes; agents connect again. The live state lives in one process, so run **one gateway instance** per database.

**On the phone, not on the gateway.** One store is deliberately outside all of this: the **session log**, which the page SDK writes to IndexedDB on the device (database `rwd-log`). From the launch of the app it records the pages visited, the user's taps and input, the agent's actions, control changes, console output and every request — failed ones with their headers and bodies — whether or not the gateway is reachable. That is what lets an agent that attaches *after* a bug read the whole way to it, instead of starting from an empty buffer. It keeps the last three launches, up to 10 MB each, and nothing in it reaches the gateway or anyone else unless an attached agent asks for it with `get_session_overview` / `get_session_log` ([protocol.md §5.4](protocol.md#54-session-log)). A project can switch it off (`policy.sessionLog`), which also deletes what is already stored on its devices, and a single page can opt out with `run({ record: false })`.

## Security notes for operators

- **Serve it over HTTPS.** Pages connect over `wss://`, the console cookie is marked `Secure` on HTTPS, and API keys travel in headers. The Docker Compose setup in [deploy/platform](../deploy/platform/README.md) terminates TLS with Caddy or sits behind your own proxy.
- **Trust forwarded headers only behind a proxy.** `--trust-proxy` makes the gateway take client IPs and its public host from `X-Forwarded-For` / `X-Forwarded-Host`. Without a proxy in front, anyone could forge them and sidestep IP allowlists and rate limits.
- **Protect the database and its backups.** They contain the key pepper and the session secret; with them, API key hashes can be checked offline and console sessions forged.
- **The owner password.** `RWD_ADMIN_PASSWORD` resets the owner's password at every start, which doubles as account recovery. If it is unset on a fresh database, a random password is printed once in the log.
- **App keys are public.** They only let pages come online. Use `allowedOrigins` to keep other sites from using yours; note that `Origin` is a browser-enforced header and non-browser clients can send anything, which is why device tokens (not app keys) protect existing devices.
- **Treat API keys like passwords.** Give each agent or person its own key, with the lowest level that works, an expiry and, for servers, an IP allowlist. Revocation is immediate.
- **Pin the SDK.** For H5 pages, the console offers a snippet that loads a content-addressed SDK URL with Subresource Integrity. Native apps may bundle `sdk.js` instead of downloading it at runtime, so a compromised gateway can't push new code to them.
- **Protect metrics.** Set `RWD_METRICS_TOKEN` if `/v1/metrics` is reachable from outside.
- Console sign-in is rate-limited (10 attempts per minute per IP), write requests require a custom CSRF header, and the console can't be framed.
