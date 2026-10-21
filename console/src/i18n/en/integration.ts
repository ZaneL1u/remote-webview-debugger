// Project integration tab, device invites, the connection test result and the comments inside the
// copy-paste snippets (lib/snippets.ts).
export const integration = {
  key: {
    title: 'Integration details',
    description: 'The App key appears in your page source and is public by design: it can only bring devices online, not control them.',
    gatewayUrl: 'Gateway URL',
    appKey: 'App key',
    rotate: 'Rotate key',
    rotateTitle: 'Rotate the App key?',
    rotateNew: 'A new App key is generated and the old one stops working immediately.',
    rotateImpact: 'Pages that still use the old key can’t come online until they’re updated. Only do this if the key is being abused.',
    rotateConfirm: 'Rotate',
    rotated: 'App key rotated. Update the integration code in your pages soon.',
    sdkLatest: 'SDK URL (latest)',
    sdkPinned: (version: string) => `SDK URL (pinned to ${version})`,
  },

  snippet: {
    title: 'Integration code',
    description:
      'Pre-filled with this project’s gateway URL and App key, ready to copy. For native approvals, the screenshot bridge, device tokens and more, see the <link>integration guide</link>.',
    tabH5: 'H5 page',
    tabIos: 'iOS (Swift)',
    tabAndroid: 'Android (Kotlin)',
    sdkVersion: 'SDK version',
    latest: 'Latest',
    pinned: (version: string) => `Pinned ${version} (SRI)`,
    pinnedHint:
      'Loads a fixed version that the browser checks against its integrity hash. Good for pages with strict security or a CSP. Update the version and integrity by hand after a gateway upgrade.',
    latestHint: 'Always loads the gateway’s latest SDK, so gateway upgrades apply without touching the page.',
    /** `<tag>head</tag>` renders as `<head>`. */
    h5Hint: 'Add this as early as possible in the page’s <tag>head</tag>:',
    iosHint: 'No change to the H5 code: the app injects it at documentStart with <c>WKUserScript</c>:',
    androidHint: 'No change to the H5 code: the app injects it with <c>WebViewCompat.addDocumentStartJavaScript</c>:',
  },

  origins: {
    title: 'Allowed origins',
    description: 'When set, only pages from these origins can come online with the App key. Leave empty for no restriction.',
    edit: 'Edit',
    saved: 'Allowed origins saved',
    invalid: (bad: string[]) =>
      `Invalid: ${bad.join(', ')} (expected https://host[:port]; use *. as a subdomain wildcard)`,
    unrestricted: 'Unrestricted: pages from any origin can come online.',
  },

  verify: {
    title: 'Verify integration',
    description: 'Checks live whether a device comes online and an agent can actually operate the page.',
    seen: 'A device came online',
    waiting: 'Waiting for the first device',
    firstSeen: (date: string, online: number) => `First online ${date} · ${online} online now`,
    waitingHint:
      'Add the integration code to your page, then open it in the app or a browser. This updates automatically once a device comes online.',
    projectDisabled: 'This project is disabled, so devices can’t come online.',
    deviceOnline: 'Device online',
    deviceOffline: 'Device offline',
    platform: 'Platform',
    appVersion: 'App version',
    noApp: '— (H5 page)',
    currentPage: 'Page',
    untitled: '(untitled)',
    sdkVersion: 'SDK version',
    lastSeen: 'Last seen',
    viewDevice: 'View device details',
    test: 'Test connection',
    testHint:
      'The gateway sends the device a snapshot request and shows the round-trip time and the snapshot, proving an agent can operate this device.',
    testing: 'Testing…',
  },

  troubleshoot: {
    title: 'Device not coming online?',
    description: 'Work through the most common causes in this order. For more, see the <link>troubleshooting guide</link>.',
    badKey: {
      title: 'Invalid key or disabled project',
      body: 'The page’s WebSocket handshake returns 401. Check that the key in your integration code matches the one above (rotating invalidates the old key immediately) and that the project isn’t disabled.',
    },
    origin: {
      title: 'Origin not allowed',
      body: 'The handshake returns 403. Add the page’s origin (scheme + host + port) to Allowed origins, or clear the list to remove the restriction.',
    },
    csp: {
      title: 'The page’s CSP blocks the connection',
      body: 'The browser console shows <c>Refused to connect</c>. Add the gateway host to the CSP <c>script-src</c>, and the gateway’s <c>https://</c> and <c>wss://</c> URLs to <c>connect-src</c>.',
    },
    sdkOld: {
      title: 'SDK version too old',
      body: 'A pinned SDK version may not match the gateway’s protocol. Switch to the latest URL /v1/sdk.js, or upgrade to a version the gateway supports.',
    },
    timeout: {
      title: 'Device online but the test times out',
      body: 'WebView JS is paused while the app is in the background. Ask the user to bring the app to the foreground and stay on a page with the SDK, then try again.',
    },
  },

  invites: {
    title: 'Invite users to connect',
    description:
      'Send a user a link or QR code carrying an invite token. When they open it, their device comes online marked as “asking for help”, so support doesn’t need to ask for the device code.',
    create: 'Create invite',
    emptyTitle: 'No invites yet',
    emptyDescription: 'When a user can’t quite describe their problem, send them an invite. They scan it and their device connects.',
    howTitle: 'How it works',
    howSteps: [
      'Create an invite with a ticket number or a description of the user in the note, so you can spot the device in the list.',
      'Send the user the QR code or link. It opens the invite URL configured in Settings, or one you set for that invite.',
      'Once they open it, the device appears at the top of the Devices list with an Invited badge. Hand the device code to your agent.',
      'Each invite works once and stops working after it’s used or expires.',
    ],
    noDefaultUrl: 'No default invite URL is configured, so every invite needs a link. You can set one in <link>Settings</link>.',
    status: {
      used: 'Used',
      expired: 'Expired',
      active: 'Active',
    },
    deleted: 'Invite deleted',
    noNote: '(no note)',
    createdBy: (name: string) => `Created by ${name} · `,
    usedAgo: (when: string) => `Used ${when}`,
    viewDevice: 'View device',
    expiredAt: (date: string) => `Expired ${date}`,
    /** `when` is untilTime(): "in 2 h". */
    expiresIn: (when: string) => `Expires ${when}`,
    qrCode: 'QR code',
    linkCopied: 'Invite link copied',
    deleteLabel: 'Delete invite',
    deleteTitle: 'Delete this invite?',
    deleteActive: 'The link stops working immediately; anyone who opens it won’t be marked as asking for help.',
    deleteInactive: 'Only this record is deleted. Devices that already connected aren’t affected.',

    createTitle: 'Create invite',
    createDescription: 'Generates a single-use link. When the user opens it, their device is marked as asking for help.',
    noteRequired: 'Enter a note',
    badUrl: 'The link must start with http:// or https://',
    urlRequired: 'The project has no default invite URL. Enter a link.',
    note: 'Note',
    notePlaceholder: 'e.g. Ticket #4821 payment failed',
    noteHint: 'Shown in the device timeline and audit log. Don’t include personal data.',
    url: 'Link',
    optional: '(optional)',
    urlHint: (hasDefault: boolean) =>
      `${hasDefault ? 'Leave empty to use the project’s default invite URL.' : 'The project has no default invite URL, so this is required.'} The page must have the SDK integrated.`,
    expiry: 'Expires after',
    expiryOptions: {
      m30: '30 min',
      h2: '2 hours',
      d1: '1 day',
      d7: '7 days',
    },
    submit: 'Create invite',

    qrTitle: 'Invite QR code',
    /** `when` is untilTime(): "in 2 h". */
    qrDescription: (note: string, when: string) => `“${note}” · expires ${when} · single use`,
    scanHint: 'Have the user scan it with their phone camera or the app’s scanner',
    orLink: 'Or send the user the link',
    done: 'Done',
  },

  test: {
    failed: 'Test failed',
    unknownFailure: 'Test failed for an unknown reason.',
    ok: 'Connected. An agent can operate this device.',
    roundTrip: (ms: number) => `${ms} ms round trip`,
    untitled: '(untitled)',
    snapshotPreview: 'Snapshot preview (first 4,000 characters)',
    emptySnapshot: '(empty snapshot)',
    errors: {
      offline: 'The device isn’t online. Ask the user to bring the app to the foreground and open a page with the SDK, then try again.',
      noPage: 'The device is online but has no page connected. Make sure the page has finished loading.',
      timeout:
        'The device didn’t respond within 15 seconds. The app may be in the background (WebView JS is paused), or the page is stuck.',
      takeover: 'The user has taken over, so the test can’t run right now.',
      notFound: 'The device doesn’t exist or no longer belongs to this project.',
      badRequest: 'Invalid request parameters.',
      internal: 'The page hit an internal error. Check whether the SDK version is outdated, or look for errors in the page console.',
      network: 'Can’t reach the gateway. Check your network.',
    },
  },

  /** Comments and sample values inside the generated code (lib/snippets.ts). Plain ASCII quotes: it's code. */
  snippets: {
    sampleAppName: 'Shop',
    usage: 'Usage:',
    dependency: (dep: string) => `Dependency: ${dep}`,
    h5Head: 'Load synchronously, as early as possible in <head>, so the SDK records console and network from the very start',
    h5Pinned: (version: string) =>
      `Pinned to version ${version} with Subresource Integrity (SRI). Update the version and integrity after a gateway upgrade`,
    userIdOptional: "optional: the signed-in user's ID, to find devices by user",
    helpButton: 'show the help button',
    iosInstall: 'Call before webView.load(...): downloads the SDK once and injects it into the main frame at documentStart.',
    deviceIdPerInstall: 'A deviceId (UUID v4) fixed per install, so the device code never changes.',
    androidWebViewSettings: 'The WebView needs settings.javaScriptEnabled = true and settings.domStorageEnabled = true',
    androidInstall: 'Call before webView.loadUrl(...): downloads the SDK once and injects it at document start.',

    full: {
      userId: 'optional: the signed-in user, so the console and agents can find devices by user',
      helpButton: 'optional: show the "ask for help" button (OR-ed with the project policy)',
      app: 'optional: host app info; standalone H5 pages can omit it',
      nativeOnly: 'Only for native injection by an app; see "Integrate a native app"',
      deviceCode: 'Remote Debugger device code',
      example: 'e.g.',
    },
    jsApi: {
      help: 'ask for help (pass false to cancel)',
      setUser: 'call after sign-in / switching users; reconnects once',
      stop: 'disconnect and remove the UI, e.g. when the user turns off remote debugging',
    },
    mask: {
      masked: 'Shown as •••• in snapshots, screenshots and console output',
      samplePhone: '415-555-0132',
      confirm: 'Before an agent clicks it, the device asks the user to confirm',
      placeOrder: 'Place order',
    },
    native: {
      screenshotBridge: 'native screenshot bridge',
      swiftTrimmed: 'A trimmed-down version of examples/mock-app/Sources/RWDMockApp/RWDNative.swift.',
      swiftInstall: 'Call RWD.shared.install(into: configuration) before creating each WKWebView.',
      swiftOnState: 'drives the native status bar and the take over / hand back / end buttons',
      swiftOnPending: 'connection approvals and action confirmations (native dialogs)',
      swiftNativeKey: [
        "A secret only the app knows: page scripts (including an agent's evaluate_script) can't read it,",
        "so they can't pose as the user to hand back control or approve a connection.",
      ],
      swiftDeviceId: 'One deviceId per install, shared by every WebView and every domain → the device code never changes.',
      swiftDeviceToken:
        'Issued by the gateway the first time it sees this device. localStorage is per domain, so the app keeps it and injects it.',
      swiftEnable: 'Call once the user agrees to remote debugging: downloads the SDK once; WebViews created afterwards get it injected.',
      swiftOwnHelp: 'the app has its own "ask for help" entry',
      swiftNativeApproval: 'approvals / confirmations use native dialogs',
      swiftDocumentStart: 'documentStart: recording of console and network starts before any page script runs',
      buttons: 'Native buttons',
      swiftDecide:
        'Connection approval: pass a level (observe / interact / advanced), or nil to deny. Action confirmation: pass "allow" or nil.',
      swiftTokenCarried: 'pages opened from now on (other domains too) carry it',
      swiftScreenshot: 'When an agent calls take_screenshot, the SDK gets the real pixels through this bridge.',
      kotlinReference: 'Reference implementation (not compiled in a real app project); its API mirrors the iOS version one to one.',
      kotlinNativeKey: 'A secret only the app knows; never exposed to the page through any JS interface.',
      kotlinOnState: 'drives the native status bar and buttons',
      kotlinOnPending: 'native approval / confirmation dialogs',
      kotlinDeviceId: 'One deviceId per install, shared by every WebView and every domain.',
      kotlinEnable: 'Call once after the user agrees to remote debugging.',
      kotlinInstall: 'Call for each WebView before loadUrl. Needs javaScriptEnabled and domStorageEnabled.',
      kotlinButtons: 'Native buttons: takeover | handback | end; approvals take a level or null, confirmations "allow" or null',
      kotlinTokenCarried: 'WebViews created from now on carry it',
      kotlinScreenshot:
        'When an agent calls take_screenshot, the SDK calls window.RWDAndroid.screenshot(), which returns a JPEG data URL.',
    },
  },
}
