// Project list and detail page, gateway-wide API keys, the access policy editor and project settings.
export const projects = {
  title: 'Projects',
  name: 'Project name',
  newProject: 'New project',
  optional: '(optional)',
  /** `<n>` wraps the online count. */
  onlineCount: (online: number, total: number) => `<n>${online}</n> online / ${total} ${total === 1 ? 'device' : 'devices'}`,

  list: {
    description: 'Each project is one app or site, with its own App key, access policy and invites. All devices are listed on the Devices page.',
    emptyTitle: 'No projects yet',
    emptyManage: 'Create a project to get an App key and ready-made integration code. Your first device can be online in minutes.',
    emptyMember: 'Projects appear here once an admin creates them.',
  },

  create: {
    description: 'Creating a project generates an App key (rwd_pk_…) and integration code.',
    nameRequired: 'Enter a project name',
    invalidOrigins: (bad: string[]) => `Invalid origin: ${bad.join(', ')}`,
    namePlaceholder: 'e.g. Shop app',
    originsLabel: 'Allowed origins',
    originsHint: 'One per line. Leave empty to allow any origin; once set, only pages from these origins can come online.',
    created: (name: string) => `Project “${name}” created`,
  },

  detail: {
    notFoundTitle: 'Project not found',
    notFoundDescription: 'It may have been deleted.',
    backToList: 'Back to projects',
    tabs: {
      integration: 'Integration',
      devices: 'Devices',
      invites: 'Invites',
      audit: 'Audit log',
      settings: 'Settings',
    },
  },

  keys: {
    title: 'API keys',
    pageDescription: 'For connecting agents over MCP. Keys belong to the whole gateway, not to a project: one key and one MCP server reach every device.',
    description: 'Agents use a key to connect over MCP. A key sees every device on the gateway, across all projects. Keep keys secret and revoke one right away if it leaks.',
    readOnly: ' Your role can only view keys; creating and revoking them requires an admin.',
    createKey: 'Create key',
    emptyTitle: 'No API keys yet',
    emptyDescription: 'Create a key and copy the MCP setup command for your agent.',

    columns: {
      name: 'Name',
      key: 'Key',
      level: 'Level',
      expiry: 'Expiry',
      ipAllowlist: 'IP allowlist',
      lastUsed: 'Last used',
      status: 'Status',
      actions: 'Actions',
    },
    createdOn: (date: string) => `Created ${date}`,
    neverUsed: 'Never used',
    usedAgo: (ago: string) => `last used ${ago}`,

    neverExpires: 'Never expires',
    expiresAtTitle: (date: string) => `Expires ${date}`,
    expiredOn: (date: string) => `Expired ${date}`,
    expiresIn: (until: string) => `Expires ${until}`,
    anyIp: 'Any IP',

    revoked: 'Revoked',
    revokedTitle: (date: string) => `Revoked ${date}`,
    expired: 'Expired',
    expiredTitle: (date: string) => `Expired ${date}`,
    active: 'Active',

    revoke: 'Revoke',
    revokedToast: (name: string) => `Revoked “${name}”`,
    revokeTitle: (name: string) => `Revoke “${name}”?`,
    /** `<c>` wraps the key prefix. */
    revokeDescription: (prefix: string) => `MCP sessions using <c>${prefix}…</c> stop working immediately. This can’t be undone.`,

    mcpTabs: {
      hosted: 'Hosted',
      local: 'Local stdio',
      json: 'JSON config',
    },
    hostedHint: 'Claude Code connects straight to the gateway’s hosted MCP (Streamable HTTP), nothing to install:',
    /** `<c>` wraps the command name. */
    localHint: 'Requires the <c>rwd</c> command on your machine; it forwards stdio to the hosted /mcp:',
    jsonHint: 'For other clients that read an mcpServers config file:',

    createdTitle: 'API key created',
    createdName: (name: string) => name,
    /** `<b>` wraps the lead sentence. */
    showOnce: '<b>This is the only time the full key is shown.</b> You can’t view it again after closing, so copy it now and store it safely. If it’s lost, revoke it and create a new one.',
    maxPrefix: 'Max ',
    keyLabel: 'API key',
    commandLabel: 'MCP setup command (key included)',
    savedClose: 'I’ve saved it, close',

    createTitle: 'Create API key',
    createDescription: 'Name the key so you can recognize and revoke it later, e.g. after the agent or teammate using it.',
    nameRequired: 'Enter a name',
    invalidCidrs: (bad: string[]) => `Invalid IP allowlist entry: ${bad.join(', ')} (use CIDR notation, e.g. 203.0.113.0/24)`,
    namePlaceholder: 'e.g. Support bot',
    maxLevel: 'Max permission level',
    /** `<b>` wraps the first clause. */
    advancedWarning: '<b>Advanced can run arbitrary JS in the user’s page and read cookies and request bodies</b>, which amounts to holding the user’s signed-in session on that page. Only give it to agents you trust, and pair it with an IP allowlist and a short expiry.',
    levelHint: 'The effective level is also capped by the max level of the project the page belongs to; the stricter one applies.',
    neverWarning: 'A key that never expires stays valid if it leaks, until someone revokes it. Prefer an expiry and create a new key before it runs out.',
    expiresAround: (date: string) => `Expires around ${date}. After that, MCP returns 401.`,
    ipHint: 'One CIDR per line; a single IP counts as /32 (/128 for IPv6). Leave empty for no restriction; once set, MCP calls from other IPs get 401.',

    guideTitle: 'Use it in your agent',
    /** `<c>` wraps the key placeholder, `<link>` the link to the docs. */
    guideDescription: (placeholder: string) =>
      `Replace <c>${placeholder}</c> in the commands below with your API key. One MCP server reaches every device: a phone opening pages from different projects keeps the same device code. See the <link>integration guide</link> for the full tool list, permission levels and approval flow.`,
    commonTools: 'Common tools',
    tools: {
      list: 'Filter devices by status, userId or device code',
      connect: 'Connect to a device by device code; wait for it to come online if it’s offline',
      pages: 'List and switch pages on the device (p1, p2…)',
      snapshot: 'Get a page snapshot (with refs) or a screenshot',
      act: 'Act on the page; the first action switches the page to “AI in control”',
      logs: 'View console output, errors and network requests',
      timeline: 'Cross-page timeline that retraces the user’s steps',
      control: 'After the user takes over, wait for them to hand back control',
    },
    tryTitle: 'Try saying this to your agent',
    tryExample: '“List online devices, connect to GSJH-EV2J and find out why the checkout total shows --”',
  },

  policy: {
    title: 'Access policy',
    description: 'Controls whether agents can connect, what they can do and what they can see. Changes apply to new connections right away; existing sessions keep their level.',
    readOnly: 'Your role can only view the access policy; changing it requires an admin or owner.',
    saved: 'Access policy saved. It applies to new connections right away.',
    invalid: 'Some settings are invalid. Check the fields marked in red.',
    invalidSelectors: (bad: string[]) => `Not a valid CSS selector: ${bad.join(', ')}`,
    nameRequired: 'Enter a name',
    duplicateName: 'Duplicate name',
    intRange: (min: number, max: number) => `Enter a whole number from ${min} to ${max}`,
    invalidUrl: 'Must start with http:// or https://',

    approval: {
      title: 'Connection approval',
      description: 'Whether the user must approve on the device when an agent connects with a device code. The prompt only responds to the user’s real taps; an agent can’t tap it for them.',
      prompt: 'Ask the user (recommended)',
      promptDescription: 'The foreground page shows a prompt, and the agent connects only after the user picks a level to allow. No answer within 30 seconds counts as a denial. After 3 denials in a row for the same key, prompts pause for 10 minutes.',
      none: 'No approval',
      noneDescription: 'Any agent that knows the device code can connect directly. Only for internal test environments.',
    },

    maxLevel: {
      title: 'Max permission level',
      description: 'The highest level this project allows. A connection gets the lowest of four: what the agent requests, what its API key allows, what’s set here and what the user approves.',
      advancedWarning: 'Advanced lets agents run arbitrary JS and read cookies and request bodies, as good as the user’s signed-in session on the page. Only enable it when you really need it.',
    },

    masking: {
      title: 'Privacy masking',
      description: 'Password fields and elements with the data-rwd-mask attribute always show as •••• in snapshots, screenshots, console and network logs. Add more masking rules here.',
      selectorsLabel: 'Masked elements (CSS selectors)',
      selectorsHint: 'One per line, e.g. .user-phone, #id-card.',
      patternsTitle: 'Mask text by regex',
      patternsDescription: 'Matching text is replaced with •••• in snapshots, console and network URLs. Good for phone or ID numbers that appear in plain text. Uses RE2 syntax (no lookaround or backreferences).',
      patternsList: 'Mask patterns',
      ruleName: (n: number) => `Rule ${n} name`,
      ruleRegex: (n: number) => `Rule ${n} regex`,
      removeRule: (n: number) => `Delete rule ${n}`,
      namePlaceholder: 'Name',
      regexPlaceholder: 'Regex, e.g. 1[3-9]\\d{9}',
      addRule: 'Add rule',
      presets: 'Presets:',
      tryLabel: 'Try it: enter sample text to preview the masking',
      sample: 'Jane Doe 13812345678 jane@example.com ID 11010119900307123X',
    },

    confirm: {
      title: 'Confirm sensitive actions',
      description: 'Before an agent clicks these elements (or presses Enter in their form), the page asks the user to confirm; no confirmation within 30 seconds counts as a denial. Elements with the data-rwd-confirm attribute always need confirmation.',
      label: 'Elements that need confirmation (CSS selectors)',
      hint: 'One per line, e.g. pay, delete and place-order buttons.',
    },

    network: {
      title: 'Network exclude rules',
      description: 'Matching requests stay out of the network list and timeline agents see (the page still records them; an agent can pass includeExcluded to see them). Good for fonts that always 404 and analytics beacons. Rules passed to run({ networkExclude }) on the page are added to these.',
      label: 'Excluded requests',
      hint: 'One per line: a URL fragment (case-insensitive), * wildcards, or /regex/.',
    },

    sessionLog: {
      title: 'Session log',
      description: 'From each launch of the app, pages record navigations, the user’s taps and input, agent actions, console and network requests (failed ones with bodies) in IndexedDB on the phone. An attached agent can read everything that happened before it arrived. The last 3 launches are kept, up to 10 MB each; the masking rules apply.',
      label: 'Keep a session log',
      hint: 'When off, pages stop recording and delete the logs already on the phone. A single page can also opt out with run({ record: false }).',
    },

    help: {
      title: 'Assistance button',
      description: 'A floating “Request assistance” button at the bottom right of the page. When the user taps it, the device is marked as assisting and moves to the top of the device list.',
      all: 'All users',
      allDescription: 'Every page with the SDK shows the assistance button.',
      listed: 'Specific users',
      listedDescription: 'Shown only to the userIds listed below. Good for staged rollouts and beta tests.',
      off: 'Off',
      offDescription: 'No floating button. The app can call help() from its own assistance entry.',
      usersLabel: 'Allowed userIds',
      usersHint: 'One per line, matching the userId passed to run() / setUser().',
      usersEmpty: 'With an empty list, nobody sees the assistance button.',
    },

    eruda: {
      title: 'eruda integration',
      description: 'How the eruda debug panel in the page works with Remote Debugger. run({ eruda }) in the page code overrides these settings.',
      dock: 'Dock into eruda',
      dockDescription: 'Adds a “Remote Debugger” tab to eruda instead of the floating widget. When AI connects, the bottom control bar still appears so the user can take over or end at any time.',
      load: 'Auto-load the latest eruda',
      loadDescription: 'If the page has no eruda, loads the latest version from jsDelivr and initializes it so developers can see the console, network and sources. Best enabled only for test-environment projects.',
    },

    limits: {
      title: 'Time limits and quotas',
      minutes: 'min',
      devices: '',
      agents: '',
      idle: 'AI idle timeout',
      idleHint: 'After this long with no AI action, the page goes back to “AI viewing” and the overlay is lifted. Default 2.',
      attach: 'Max session length',
      attachHint: 'The agent is disconnected automatically after this, in case nobody ends the session. Default 60.',
      onlineDevices: 'Max online devices',
      onlineDevicesHint: 'Beyond this, new devices are refused (close code 4429). 0 means no limit.',
      agentsLabel: 'Max concurrent agents',
      agentsHint: 'Agents connected to devices across the whole project at once. 0 means no limit.',
    },

    invite: {
      title: 'Invite page',
      description: 'Invite links open this page by default (with the rwd_invite parameter added automatically). The page needs the SDK integrated.',
      label: 'H5 URL that invite links open',
      hint: 'Leave empty to enter it each time you create an invite.',
    },

    unsaved: 'Unsaved changes',
    allSaved: 'All changes saved',
    revert: 'Revert',
    save: 'Save policy',
  },

  settings: {
    renamed: 'Project name saved',
    disabledToast: 'Project disabled',
    enabledToast: 'Project enabled',
    deleted: (name: string) => `Project “${name}” deleted`,
    general: 'General',
    /** `<c>` wraps the project ID. */
    meta: (date: string, id: string) => `Created ${date} · Project ID <c>${id}</c>`,
    disableTitle: 'Disable project',
    disableDescription: 'While disabled, pages using this project’s App key can’t come online. You can re-enable it at any time.',
    running: 'Active',
    deleteTitle: 'Delete project',
    deleteDescription: 'The App key stops working right away and the project’s invites are deleted. This can’t be undone.',
    deleteConfirmTitle: (name: string) => `Delete project “${name}”?`,
    deleteConfirmDescription: 'The App key and invites will be deleted, and pages using this App key can no longer come online. This can’t be undone.',
  },
}
