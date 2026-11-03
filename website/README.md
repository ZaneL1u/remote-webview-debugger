# debugger.site

The project website in 11 languages — English at `/`, the others under `/zh/`, `/zh-tw/`, `/ja/`, `/ko/`, `/es/`, `/fr/`, `/de/`, `/pt-br/`, `/ru/` and `/ar/` (right to left) — pre-rendered as static HTML, with an interactive demo that runs the **real page SDK** (`sdk/dist/sdk.js`) against a mock gateway in the browser, and a "try it live" section that embeds the public demo shop.

```sh
(cd ../sdk && npm ci && npm run build)   # the demo needs sdk/dist/sdk.js (or: make website from the repo root)
npm ci
npm run dev        # http://localhost:5391
npm run build      # astro check + astro build → dist/
npm run preview    # serves dist/ on http://localhost:4391
npm run verify     # Playwright against the preview: demo end to end, live section, every language, screenshots in ./shots
npm run lottie     # regenerates public/lottie/*.json from scripts/lottie.mjs
```

## How it is put together

- [Astro](https://astro.build) (static output) + [Tailwind CSS v4](https://tailwindcss.com) + [GSAP](https://gsap.com) + [Lottie](https://airbnb.io/lottie/). No framework on the client: `src/scripts/main.ts` adds behaviour (theme, language menu, tabs, copy buttons, the demo and the live section), `src/scripts/motion.ts` the GSAP motion (hero entrance, scroll reveals, flow packets, counters, highlight screens), `src/scripts/lottie.ts` loads the light Lottie player on demand.
- **Languages.** `src/i18n/locales.ts` lists them (code, URL path, direction, which shop language); `src/i18n/<lang>.ts` holds the copy (English is the source, the `Dict` type keeps the others in step), `src/demo/text/<lang>.ts` what the demo's agent says. `src/pages/index.astro` renders English, `src/pages/[lang]/index.astro` the rest; `src/layouts/Base.astro` emits `<html lang dir>`, canonical and `hreflang` links for all 11, Open Graph locales, JSON-LD (`SoftwareApplication` + `FAQPage`) and the first-visit redirect from `/` to the browser's language (an explicit choice is stored in `rwd.lang`). `@astrojs/sitemap` writes `sitemap-index.xml` with hreflang alternates.
- **Styles.** `src/styles/global.css` imports Tailwind and the site's own tokens (`tokens.css`: dark by default, the "ice lab" light theme under `[data-theme=light]`, exposed to Tailwind with `@theme inline`) and components (`base.css`, `sections.css`, `demo.css`, `live.css`). Logical properties keep Arabic right-to-left.
- Fonts are self-hosted from `@fontsource` (Geist, Geist Mono, Orbitron for HUD labels); CJK and Arabic text uses system fonts. No trackers, no cookies.
- The build copies `../sdk/dist/sdk.js` (and its map) to `dist/demo-shop/sdk.js` and fails with a clear message if it is missing.

## The demo

```
iframe /demo-shop/<en|zh>/…?ui=<lang>   (a copy of examples/platform-demo, English and Chinese; ?ui= picks the SDK's UI language)
  rwd-shim.js   window.WebSocket → postMessage tunnel to the parent
  sdk.js        the real SDK, unmodified: RemoteWebviewDebugger.run('<origin>/mock-gateway/v1', 'rwd_pk_demo…', { lang })
  boot.js       starts the SDK; keeps shop navigations out of the site's history
parent page
  src/demo/tunnel.ts    postMessage ⇄ connection objects
  src/demo/gateway.ts   mock gateway: hello/welcome, heartbeats, control state machine, RPCs, events,
                        timeline, attach approval, levels, task card (mirrors sdk/test/mock-gateway.mjs + the hub)
  src/demo/tools.ts     the MCP tools on top of it, results formatted like gateway/internal/server/mcp.go (en / zh)
  src/demo/scenario.ts  the scripted agent (every step is a real RPC; refs come from the real snapshot);
                        ends with a live patch through evaluate_script that proves the fix on the phone
  src/demo/guide.ts     the guiding hand: points at "Allow" when nobody taps it, counts down, taps for the visitor
  src/demo/view.ts      transcript UI (two skins: Claude Code and Codex);  player.ts: pause / speed / restart
```

The agent's messages follow the page language; the mock gateway's tool results are in the gateway's language (English, or Chinese for the Chinese pages), like a real gateway's `RWD_LANG`. The shop itself exists in English and Chinese; other languages get the English shop with the SDK's UI in their language.

The SDK looks for the browser's native `WebSocket` (a `[native code]` constructor on the prototype chain). The shim exposes a bound function, which stringifies as native code, so the SDK picks it up exactly as it would pick the browser's. Nothing in the demo leaves the browser; the shop's own requests go to static files on this site (some 404 on purpose — they are part of the bug story).

## Try it live

The section embeds `https://demo.debugger.site/?lang=<en|zh>&ui=<lang>` in a phone frame (the real shop, the real SDK, the public demo gateway). The shop reports its device code to the page with `postMessage` (`examples/platform-demo/rwd-boot.js`, to the website's origins only), and the page fills it into the prompt. The visitor's API key comes from `POST /v1/demo/keys`, as before.

## Deploying

Serve `dist/` as static files. With Caddy:

```caddy
debugger.site {
	root * /srv/debugger.site
	encode zstd gzip
	header /_astro/* Cache-Control "public, max-age=31536000, immutable"
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

No SPA fallback: unknown paths must 404 (the demo shop expects `api/coupon` and `api/recommend.json` to be missing). `file_server` already redirects `/zh` to `/zh/` and so on for every language.
