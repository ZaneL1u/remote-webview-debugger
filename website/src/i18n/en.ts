// English copy: the source every other language mirrors (checked by the Dict
// type). Strings may contain a little trusted inline HTML (<code>, <em>,
// <strong>, <a>).

export const en = {
  meta: {
    title: 'Remote WebView Debugger — let AI agents debug WebViews on real phones',
    description:
      'Open-source, self-hosted: add one script and Claude Code, Codex, Cursor or any MCP client can inspect and operate H5 pages and in-app WebViews on your users’ phones — with the user’s approval, masking and a take-over button. No USB cable, no debugging port.',
    ogTitle: 'Remote WebView Debugger',
    ogDescription: 'Let your AI agent debug the WebView on your user’s phone. One script, a device code, an MCP endpoint. Open source.',
  },
  nav: {
    skip: 'Skip to content',
    demo: 'Demo',
    live: 'Try it live',
    how: 'How it works',
    features: 'Features',
    highlights: 'Highlights',
    privacy: 'Privacy',
    selfHost: 'Self-host',
    faq: 'FAQ',
    github: 'GitHub',
    menu: 'Menu',
    themeToggle: 'Toggle color theme',
    langLabel: 'Language',
  },
  hero: {
    eyebrow: 'Open source · MIT · MCP',
    titleHtml: 'Let your AI agent debug the WebView <em>on your user’s phone</em>.',
    sub:
      'Add one script to your H5 page or app WebView. Your user reads out a short device code, and Claude Code, Codex, Cursor or any MCP client can see the page, read console and network, and click through the bug — while the user watches and can take over at any time.',
    ctaDemo: 'Watch the demo',
    ctaLive: 'Try it with your agent',
    ctaGithub: 'Star on GitHub',
    ctaSelfHost: 'Self-host in 5 minutes',
    points: ['No USB cable', 'No remote-debugging port', 'No app rebuild beyond one script', 'Works after the bug happened'],
    ticker: [
      'link established',
      'device K7Q2-9M4X online',
      'snapshot 42 ms',
      '34 tools armed',
      'masking on',
      'level interact',
      'session log · 3 launches',
      'live patch verified',
      'audit recording',
      'gateway self-hosted',
      '11 languages',
    ],
    flow: {
      label: 'An AI agent talks MCP to your self-hosted gateway, which reaches the page SDK on the user’s phone over a WebSocket.',
      agent: 'AI agent',
      agentSub: 'Claude Code · Codex · Cursor · any MCP client',
      gw: 'rwd gateway',
      gwSub: 'self-hosted · approval · audit',
      phone: 'User’s phone',
      phoneSub: 'H5 page / app WebView + SDK',
      mcp: 'MCP · HTTPS',
      ws: 'WebSocket',
      state: 'AI operating',
    },
  },
  demo: {
    kicker: 'Live demo',
    title: 'A real bug, fixed on a “real” phone',
    lead:
      'The phone in this demo runs the actual page SDK inside a demo shop. Its gateway is mocked in your browser, so nothing leaves this tab — but every snapshot, click, console line and live patch below is real.',
    agentTitle: 'AI agent',
    agentSub: 'connected to the rwd MCP server',
    skinLabel: 'Agent style',
    skinClaude: 'Claude Code',
    skinCodex: 'Codex',
    phoneLabel: 'Customer’s phone',
    play: 'Play',
    pause: 'Pause',
    restart: 'Restart',
    speed: 'Speed',
    start: 'Run the demo',
    startHint: 'Watch an agent connect to the phone, reproduce a checkout bug, find the root cause and verify the fix live.',
    expand: 'Show full result',
    collapse: 'Collapse',
    running: 'running',
    done: 'Done',
    error: 'error',
    you: 'Support engineer',
    agent: 'Agent',
    customer: 'Customer',
    /** The hand that points at “Allow” when nobody taps it. */
    guideTap: 'Tap “Allow”',
    guideAuto: (s: number) => `auto in ${s}s`,
    footnote:
      'Runs entirely in your browser: the real SDK (<code>sdk.js</code>) in an iframe, a WebSocket shim that tunnels to an in-page mock gateway, and a scripted agent issuing real RPCs. Agent messages follow the page language; tool results are in the gateway’s language (English or Chinese).',
    stateIdle: 'Ready',
    statePrelude: 'The customer runs into the bug',
    stateRunning: 'Agent working',
    statePaused: 'Paused',
    stateWaitApproval: 'Waiting for the customer to approve',
    stateWaitControl: 'Waiting for the customer to hand back',
    stateDone: 'Finished',
    stateStopped: 'Stopped',
  },
  live: {
    kicker: 'Hands-on',
    title: 'Now try it with your own agent',
    lead:
      'The demo above runs in your browser. This one is real: a public demo gateway at <code>demo.debugger.site</code>, kept apart from everything else and wiped every day. The shop on the right is the real thing, loaded from there — get a key, point your agent at it and watch it work on this page.',
    steps: [
      {
        title: 'Get a key of your own',
        body: 'One click, no sign-up. The key only works on the demo gateway and lasts until the demo starts over.',
      },
      {
        title: 'Add the demo gateway to your agent',
        body: 'Run the command once in a terminal, or add it to your MCP client’s settings. The key is already filled in.',
      },
      {
        title: 'Ask your agent',
        body: 'The device code of the shop on the right is filled into the prompt. When the agent asks to connect, tap <em>Allow</em> in the shop and watch it work; <em>Take over</em> or <em>End</em> it at any time.',
      },
    ],
    phoneTitle: 'The demo shop, live',
    phoneHint: 'This is <code>demo.debugger.site</code> itself, running the real SDK. Scan the code to open it on your phone instead.',
    open: 'Open in a new tab',
    scan: 'Scan to open it on your phone',
    tabsLabel: 'Demo MCP configuration',
    getKey: 'Get my key',
    keyIdle: 'Get a key and it is filled into the command below.',
    keyLoading: 'Getting your key…',
    keyReady: 'Your own key is filled in. It stops working when the demo starts over (daily at 04:00 UTC+8); come back here for a new one.',
    keyFailed: 'The demo gateway can’t be reached right now; please try again later.',
    keyLimited: 'Too many keys from your network; please try again in an hour.',
    deviceWaiting: 'Waiting for the shop to come online…',
    deviceReady: (code: string) => `This page’s device code is ${code} — filled into the prompt.`,
    deviceUnavailable: 'The shop didn’t report a device code; read it from the pill in the shop.',
    prompt:
      'Use the rwd-demo MCP server and connect to device XXXX-XXXX. In the shop, choose the gift box for a product, go to checkout and find out why the total shows “--”.',
    promptLabel: 'Prompt',
    promptNote: 'Replace <code>XXXX-XXXX</code> with the code shown in the shop.',
    limitsTitle: 'Limits of the demo',
    limits: [
      'A key per visitor: your agent reaches only the page whose code you give it, after you allow it',
      'Level <strong>interact</strong> only: no scripts, request bodies or storage',
      'An agent keeps a page for at most 15 minutes (5 when idle)',
      '120 MCP requests per minute per IP',
      'Wiped daily at 04:00 (UTC+8) — don’t enter real personal data',
    ],
  },
  how: {
    kicker: 'How it works',
    title: 'Three steps from “it’s broken on my phone” to a root cause',
    steps: [
      {
        title: 'Add the page SDK',
        body:
          'One script in <code>&lt;head&gt;</code>, as early as possible, so console and network are recorded from the first line. In an app, inject the same script at document start.',
      },
      {
        title: 'The user shares a device code',
        body:
          'Every phone gets a permanent code like <code>K7Q2-9M4X</code> in a small pill. Users can tap <em>Request assistance</em>, and the device jumps to the top of the agent’s list.',
      },
      {
        title: 'Your agent connects over MCP',
        body:
          'Add the gateway’s hosted MCP endpoint with an API key. Then just describe the problem — the agent finds the device, asks for approval and starts working.',
      },
    ],
    pill: { code: 'K7Q2-9M4X', online: 'Online', help: 'Request assistance' },
    chip1: 'sdk.js from the CDN · console + network from line one',
    chip3: 'approved on the phone · level interact',
    prompt: 'Device K7Q2-9M4X can’t check out — the total shows “--”. Find out why.',
    tabsLabel: 'MCP client configuration',
    sdkNote: 'Pin a version in production, or use your gateway’s own copy at <code>/v1/sdk.js</code> (with SRI from the console).',
  },
  features: {
    kicker: 'What the agent gets',
    title: 'The DevTools workflow, through MCP, on someone else’s phone',
    items: [
      { icon: 'tree', title: 'Accessibility snapshots', body: 'Playwright-style YAML with element refs. The agent reads the page as structure, not pixels — and acts on refs.' },
      { icon: 'cursor', title: 'Real interactions', body: 'click, fill, type, press, select, hover, scroll, drag — with actionability checks and events React and Vue accept.' },
      { icon: 'terminal', title: 'Console and network', body: 'Recorded from page load in bounded buffers, so errors from before the agent joined are still there. Bodies on request.' },
      { icon: 'layers', title: 'Multi-page sessions', body: 'List → detail → checkout, or a second WebView: all pages of a device form one session, with a cross-page timeline.' },
      { icon: 'bell', title: 'Session changes, pushed', body: 'Every tool result ends with what changed — new page, navigation, an error, the user taking over. No polling.' },
      { icon: 'list', title: 'Task card on the phone', body: 'The agent shows its plan and progress on the device, so the user always knows what it is doing and why.' },
      { icon: 'camera', title: 'Screenshots', body: 'Native pixels when the app provides a bridge, DOM rendering otherwise. Masking applies to both.' },
      { icon: 'scroll', title: 'Session log on the device', body: 'Pages, taps, console and every request since the app launched, kept on the phone in IndexedDB — readable after the fact.' },
      { icon: 'wrench', title: 'Live patches', body: 'At the advanced level the agent can patch the running page with <code>evaluate_script</code> and verify a fix on the spot.' },
      { icon: 'wifi', title: 'Bad networks', body: 'A light heartbeat with back-off; after three failures a once-a-minute presence poll, and the gateway wakes the page up when needed.' },
      { icon: 'globe', title: '11 languages', body: 'Phone UI, console and agent-facing text in 11 languages, including right-to-left Arabic. Bring your own packs and wording.' },
      { icon: 'plug', title: 'Any MCP client', body: 'Streamable HTTP at <code>/v1/mcp</code> for Claude Code, Codex, Cursor and friends; a tiny stdio bridge for everything else.' },
    ],
    toolsTitle: 'All tools',
  },
  highlights: {
    kicker: 'Highlights',
    title: 'Built for the bugs that only happen out there',
    lead: 'Three things you will not get from a cable, a remote-debugging port or a screen recording.',
    items: [
      {
        title: 'The bug already happened? The log is still on the phone.',
        body:
          'From the moment the app launches, the SDK writes a session log to the device’s IndexedDB: pages visited, the user’s taps and input, console output and every request — failed ones with headers and bodies. Nothing is streamed anywhere; it stays on the phone, under the same masking rules, until an agent that the user approved asks for it with <code>get_session_overview</code> and <code>get_session_log</code>. The last three launches are kept, up to 10 MB each.',
        tag: 'Session log · cold storage on the device',
        visual: {
          title: 'rwd-log · launch 3 of 3',
          rows: ['09:41:02  open   index.html', '09:41:09  tap    “Gift box”', '09:41:11  tap    Buy now', '09:41:12  error  TypeError: order.price.toFixed…', '09:41:13  net    GET api/coupon → 404', '09:52:30  agent  attached (interact)', '09:52:31  read   get_session_log'],
        },
      },
      {
        title: 'Verify the fix on the customer’s phone, before you ship.',
        body:
          'With the user’s <strong>advanced</strong> approval, <code>evaluate_script</code> runs in the page — so the agent can correct bad state, override a function or re-render a view and watch the result on the real device: a live patch that proves the diagnosis. It lives only in that page’s memory; nothing is persisted, and sensitive clicks still need the user’s yes.',
        tag: 'Live patch · evaluate_script',
        visual: {
          title: 'checkout.html · live',
          before: 'Total  --',
          after: 'Total  $208.00',
          code: 'order.price = Number(order.price)',
        },
      },
      {
        title: 'Made for agents, not for a human with DevTools.',
        body:
          'Every tool result ends with what changed on the device since the last call, so the agent never polls. Page content is handed over as untrusted data. A task card on the phone shows the agent’s plan, and the gateway speaks the agent’s language — tool descriptions and results in 11 languages.',
        tag: 'Agent-native · MCP',
        visual: {
          title: 'tool result · tail',
          rows: ['[Session changes]', '- p2 “Checkout” opened (foreground)', '- p1 console error: TypeError …', '- the user took over control'],
        },
      },
    ],
  },
  privacy: {
    kicker: 'Privacy & control',
    title: 'The user’s phone stays the user’s phone',
    lead: 'Remote debugging only works if people trust it. Every session is visible, approved and interruptible.',
    items: [
      { title: 'Approval first', body: 'An agent asks to attach; the user sees who is asking and picks a level on the phone. Only real taps count — a script can’t approve itself.' },
      { title: 'Take over or end, any time', body: 'While the agent works, the page is locked behind a glowing edge. One tap on <em>Take over</em> pauses the agent; <em>End</em> disconnects it.' },
      { title: 'Masked by default', body: 'Passwords, and anything marked <code>data-rwd-mask</code>, show as <code>••••</code> in snapshots, screenshots, console, network data and the session log. Add selectors and regex patterns per project.' },
      { title: 'Sensitive clicks need a yes', body: 'Mark buttons with <code>data-rwd-confirm</code> (“Submit order”, “Delete account”) and the user confirms each agent click on them.' },
      { title: 'Permission levels', body: '<strong>observe</strong> reads, <strong>interact</strong> operates, <strong>advanced</strong> adds scripts, request bodies and storage. Capped per key and per project.' },
      { title: 'Audit log', body: 'Every attach, approval, RPC and takeover is recorded with who, what and when — never page content or parameter values.' },
    ],
    levels: [
      { name: 'observe', tools: 'snapshots, screenshots, console, network list, session log, find, wait' },
      { name: 'interact', tools: '+ click, fill, type, press, select, hover, scroll, drag, navigate' },
      { name: 'advanced', tools: '+ evaluate_script (live patches), request/response bodies, storage' },
    ],
  },
  native: {
    kicker: 'Native apps',
    title: 'In your app, it’s one user script',
    lead:
      'Download the SDK once and inject it at document start — WKUserScript on iOS, addDocumentStartJavaScript on Android. Your web pages don’t change at all.',
    extras: [
      { title: 'One device code everywhere', body: 'Pass a stable <code>deviceId</code> (and keep the <code>deviceToken</code>) so the code survives across WebViews and domains.' },
      { title: 'Native controls', body: 'Show your own take over / hand back / end buttons with <code>nativeControl()</code>; page scripts can’t call it.' },
      { title: 'Native approval dialogs', body: '<code>nativeApproval: true</code> hands attach requests and confirmations to your app’s own UI.' },
      { title: 'Real-pixel screenshots', body: 'A small bridge (WKWebView snapshot, Android bitmap) gives the agent true pixels instead of a DOM rendering.' },
    ],
    tabs: { ios: 'iOS (Swift)', android: 'Android (Kotlin)', h5: 'H5 page' },
  },
  selfHost: {
    kicker: 'Self-hosted',
    title: 'One Go binary. Your servers. Your data.',
    lead: 'The gateway embeds the web console and the page SDK. SQLite out of the box, Postgres when you need it, Docker Compose and Caddy for HTTPS.',
    points: [
      { title: 'Console', body: 'Devices, API keys, members and roles, QR invites, policies and an audit log — plus an integration guide filled with your own keys.' },
      { title: 'Storage', body: 'SQLite file by default; set <code>RWD_DATABASE_URL=postgres://…</code> to use Postgres.' },
      { title: 'Ops', body: 'Prometheus metrics at <code>/v1/metrics</code>, versioned SDK URLs with SRI, health check at <code>/v1/healthz</code>.' },
    ],
    stepsTitle: 'Quick start',
    dockerComment: '# one container: console + gateway + SDK',
    deployComment: '# or build it, ship it and get HTTPS with Caddy',
    resultComment: '# → console  https://rwd.example.com\n# → gateway  https://rwd.example.com/v1  (MCP at /v1/mcp)',
    requires: 'Docker is all the server needs; building from source needs Go and Node.',
    docsLink: 'Deployment guide',
  },
  faq: {
    kicker: 'FAQ',
    title: 'Questions people ask',
    items: [
      {
        q: 'Does the user have to install anything?',
        a: 'No. For H5 pages the SDK is part of your page. In an app you inject it from native code. The user only sees a small pill with their device code and, when an agent attaches, an approval dialog.',
      },
      {
        q: 'What can the agent see and do?',
        a: 'Only what the user approved: the WebView pages of that device, at the granted level. It never controls anything outside the WebView. Masked fields stay masked, and page content is passed to the model as untrusted data.',
      },
      {
        q: 'The bug happened before the agent connected. Is it lost?',
        a: 'No. The SDK keeps a session log on the device from the app’s launch — pages, taps, console and requests — so an agent that attaches later reads the whole way to the bug with <code>get_session_log</code>. It never leaves the phone otherwise.',
      },
      {
        q: 'Can the agent fix the bug on the phone?',
        a: 'It can verify a fix: at the <strong>advanced</strong> level, <code>evaluate_script</code> patches the running page in memory — correct state, override a function, re-render — and the agent sees whether the problem goes away. The real fix still ships through your normal release; nothing is persisted on the device.',
      },
      {
        q: 'Which agents work with it?',
        a: 'Any MCP client. Claude Code, Codex and Cursor use the hosted Streamable HTTP endpoint directly; clients that only speak stdio use <code>rwd mcp</code>, a small bridge to the same endpoint.',
      },
      {
        q: 'Which platforms are supported?',
        a: 'Any modern mobile WebView or browser: WKWebView on iOS, Android System WebView, in-app browsers, and plain mobile Safari or Chrome. Desktop browsers work too.',
      },
      {
        q: 'What about bad networks or blocked WebSockets?',
        a: 'The page keeps a light heartbeat WebSocket with exponential back-off. If it can’t connect three times in a row it falls back to a once-a-minute presence poll, and the gateway wakes it up when an agent wants to connect.',
      },
      {
        q: 'Does it slow my page down?',
        a: 'It’s one script. Console and network records live in bounded ring buffers (500 entries each, response bodies capped at 5 MB), the session log is written in the background, and an idle connection only exchanges heartbeats.',
      },
      {
        q: 'Does it work alongside eruda, vConsole or PageSpy?',
        a: 'Yes — their nodes are skipped by snapshots and hit-testing, our own traffic stays out of their network logs, and it can even live as a tab inside eruda.',
      },
      {
        q: 'Is the demo above real?',
        a: 'The SDK is real and unmodified; only the gateway is simulated in your browser. A WebSocket shim tunnels the SDK’s connection to it with <code>postMessage</code>, and a scripted agent sends the same RPCs a real gateway would. For the real thing end to end, <a href="#live">try it with your own agent</a>.',
      },
    ],
  },
  footer: {
    tagline: 'Let AI agents debug H5 pages and app WebViews on real phones.',
    project: 'Project',
    docs: 'Docs',
    languages: 'Languages',
    links: {
      github: 'GitHub',
      issues: 'Issues',
      license: 'MIT License',
      protocol: 'Protocol',
      gateway: 'Gateway',
      sdk: 'Page SDK',
      architecture: 'Architecture',
      native: 'Native integration',
    },
    note: 'Released under the MIT License. No cookies, no tracking.',
  },
  notFound: {
    title: 'Page not found',
    body: 'This page doesn’t exist — maybe the device went offline.',
    home: 'Back to the homepage',
  },
  copy: { copy: 'Copy', copied: 'Copied' },
}

export type Dict = typeof en
