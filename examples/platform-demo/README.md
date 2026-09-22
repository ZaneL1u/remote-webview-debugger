# Platform demo (`platform-demo`)

A small mobile shop in three steps (list → detail → checkout) for demoing and testing the RWD page SDK. The gateway serves it under `/demo/platform/`; every page loads `/v1/sdk.js` as early as possible in `<head>` and calls `RemoteWebviewDebugger.run(location.origin + '/v1', key, { helpButton: true, lang })` (`rwd-boot.js`).

- AppKey: `?key=rwd_pk_…` in the address bar (remembered in localStorage, so later pages don't need it); otherwise a placeholder key.
- Language: English or Chinese. `?lang=en|zh` wins (also remembered in localStorage); otherwise the browser's language (`zh*` → Chinese, anything else → English). Product names, prices and the SDK's own UI follow it. Text lives in `i18n.js`, products in `api/products.en.json` / `api/products.json` (Chinese).
- The banner on the list page opens `promo.html` in a **new tab**, to show several pages of one device (openerId).
- Deliberate problems:
  - **Cross-page bug**: choosing the gift box on the detail page stores the formatted price text (`"$24.00"` / `"¥168.00"`) in sessionStorage; checkout throws `TypeError: order.price.toFixed is not a function` while computing the total, the total shows `--`, and placing the order fails too.
  - The list page requests a missing `api/recommend.json` (404) and logs a `console.error`, plus a `console.warn`.
  - "Apply" (coupon code) at checkout requests `api/coupon` (404); "Place order" POSTs `api/order` (404, with an `Authorization` header to check redaction).
- The phone number and member card number at checkout carry `data-rwd-mask`, and the payment PIN is `type=password`: snapshots, screenshots and console show them as `••••`.

Local preview: `cd sdk && npm run build && npm run gateway`, then open <http://localhost:8787/demo/platform/> (add `?lang=zh` for Chinese).
