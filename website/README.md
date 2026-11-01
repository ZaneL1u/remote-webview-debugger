# debugger.site

The project website: English at `/`, Chinese at `/zh/`, both pre-rendered static HTML, with an interactive demo that runs the **real page SDK** (`sdk/dist/sdk.js`) against a mock gateway in the browser.

```sh
(cd ../sdk && npm ci && npm run build)   # the demo needs sdk/dist/sdk.js (or: make website from the repo root)
npm ci
npm run dev        # http://localhost:5391
npm run build      # → dist/
npm run preview    # serves dist/ on http://localhost:4391
npm run verify     # Playwright against the preview: demo end to end + screenshots in ./shots
```

## How it is put together

- Vite + vanilla TypeScript, no framework. `index.html`, `zh/index.html` and `404.html` are stubs; `src/render.ts` renders the full markup for each language from `src/i18n/{en,zh}.ts` at dev and build time (a `transformIndexHtml` plugin in `vite.config.ts`). `src/main.ts` only adds behaviour: theme toggle (`rwd.theme`), language choice (`rwd.lang`; a first visit to `/` with a Chinese browser goes to `/zh/` unless a choice was made), tabs, copy buttons, reveal-on-scroll, and lazy-loading the demo.
- Fonts are self-hosted from `@fontsource` (Geist, Geist Mono, Instrument Serif); CJK text uses system fonts. No trackers, no cookies.
- The build copies `../sdk/dist/sdk.js` (and its map) to `dist/demo-shop/sdk.js` and fails with a clear message if it is missing.

## The demo

```
iframe /demo-shop/<lang>/…  (a copy of examples/platform-demo, bilingual)
  rwd-shim.js   window.WebSocket → postMessage tunnel to the parent
  sdk.js        the real SDK, unmodified: RemoteWebviewDebugger.run('<origin>/mock-gateway/v1', 'rwd_pk_demo…', { lang })
  boot.js       starts the SDK; keeps shop navigations out of the site's history
parent page
  src/demo/tunnel.ts    postMessage ⇄ connection objects
  src/demo/gateway.ts   mock gateway: hello/welcome, heartbeats, control state machine, RPCs, events,
                        timeline, attach approval, levels, task card (mirrors sdk/test/mock-gateway.mjs + the hub)
  src/demo/tools.ts     the MCP tools on top of it, results formatted like gateway/internal/server/mcp.go
  src/demo/scenario.ts  the scripted agent (every step is a real RPC; refs come from the real snapshot)
  src/demo/view.ts      transcript UI;  player.ts: pause / speed / restart
```

The SDK looks for the browser's native `WebSocket` (a `[native code]` constructor on the prototype chain). The shim exposes a bound function, which stringifies as native code, so the SDK picks it up exactly as it would pick the browser's. Nothing in the demo leaves the browser; the shop's own requests go to static files on this site (some 404 on purpose — they are part of the bug story).

## Deploying

Serve `dist/` as static files. With Caddy:

```caddy
debugger.site {
	root * /srv/debugger.site
	encode zstd gzip
	header /assets/* Cache-Control "public, max-age=31536000, immutable"
	file_server
	handle_errors {
		@404 expression {err.status_code} == 404
		handle @404 {
			rewrite * /404.html
			file_server
		}
	}
}
```

No SPA fallback: unknown paths must 404 (the demo shop expects `api/coupon` and `api/recommend.json` to be missing). `file_server` already redirects `/zh` to `/zh/`.
