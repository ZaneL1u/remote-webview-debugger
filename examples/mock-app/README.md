# Mock app (RWDMockApp)

Try remote debugging of in-app WebViews without Xcode or a real phone. It is a phone-sized macOS app that mimics a WebView-based iOS app using exactly the same WebKit APIs as iOS (`WKWebView`, `WKUserScript`, `WKScriptMessageHandlerWithReply`, `takeSnapshot`):

| Mock app behavior | Integration feature it exercises |
|---|---|
| Native navigation bar and back button | Native lock: the back button is disabled while the AI is in control |
| `target=_blank` / `window.open` push a new WebView, going back pops it | Several pages per device (p1, p2…): opener links, foreground / background, automatic switch when one closes |
| "Turn on remote debugging…" in the ⋯ menu, after a native consent dialog | The SDK is injected only after the user agrees |
| Status bar plus native "Take over / Hand back / End" buttons | SDK state reported to native; `nativeControl` takes a native secret the agent can't use |
| "Request assistance" in the top right | `RemoteWebviewDebugger.help()`; the console and the agent show the device as assisting |
| About this device | Device code; the deviceId lives in the app, so it stays the same across domains and WebViews |
| Screenshots | Native screenshot bridge: the agent gets real pixels |
| Native dialog when an AI asks to attach, with "View only / View and interact / Advanced" | Attach approval: `nativeApproval: true` + `status().pending` + `nativeDecide` |
| Native confirmation before clicking "Place order" | Sensitive-action confirmation (`data-rwd-confirm` / `confirmSelectors`) |
| Device token saved on first connect and injected into every later WebView | deviceToken: only this device can use its device code (localStorage is per origin, so the app keeps it) |
| "Request assistance" hidden when the project turns it off | Remote config `status().config.helpButton` |

`Sources/RWDMockApp/RWDNative.swift` is the code a real iOS app would use (it builds for both iOS and macOS); `main.swift` is only the mock app shell. It passes `lang: "en"` to the SDK so the in-page UI matches the app (set `Config.lang` to `"zh"` for Chinese).

## Build and run

Only the Xcode Command Line Tools (`swift`) are needed:

```bash
examples/mock-app/build-app.sh
open examples/mock-app/build/RWDMockApp.app
```

On first launch it asks for the gateway and app key:

1. Open the console of your deployed gateway (e.g. `https://rwd.example.com/`) and sign in with the owner account (`RWD_ADMIN_EMAIL` / `RWD_ADMIN_PASSWORD`, see `deploy/platform`).
2. Create a project, copy its "App key" (`rwd_pk_…`) into the app, and set the gateway URL to your `https://…/v1`.
3. In the app, tap ⋯ → "Turn on remote debugging…" and agree. The status bar shows the device code, and the device appears online under "Verify integration" in the console.

You can also pass everything on the command line (it is remembered): `RWDMockApp --gateway https://…/v1 --key rwd_pk_… --user my-user --consent`. `--start-url URL` opens a different first page.

## Let Claude Code debug it

Create a key under "API keys" in the console, run the `claude mcp add --transport http …` command it shows, then ask Claude, for example:

- "Use rwd to list online devices, connect to mock-ios-user's device, and find out why the checkout total shows --"
- "On the product page, choose the gift box and place an order; reproduce the problem and find the root cause"
- "Open the promo page, claim a coupon, then go back to the product list"

New projects require approval by default: when Claude connects, the app shows a native dialog and Claude sees the page only after you allow it. When you tap "Take over" in the app, Claude's actions are refused and it waits; after "Hand back" it continues.

## Debug hooks (for automated tests)

- `kill -USR1 $(pgrep -x RWDMockApp)`: writes the window (native shell + real WebView pixels) to the `--snapshot` file (default `/tmp/rwd-mock-app.png`).
- `kill -USR2 $(pgrep -x RWDMockApp)`: presses the native "Take over / Hand back" button.
- `--auto-decide interact|observe|advanced|deny`: attach approvals and sensitive-action confirmations don't show a dialog; after 0.3 s `nativeDecide` is called with the given value (the same path a tap takes). **Testing only**: a real app must let the user choose.

## Known differences

- On macOS, when the window is fully covered by other windows, WebKit reports the page as in the background; bring it to the front.
- There is no trusted touch injection here: the agent's clicks are synthetic events inside the page (the same is true on iOS).
