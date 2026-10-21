// Words shared across pages, formatters (lib/format.ts), roles, permission levels and status badges.
export const common = {
  cancel: 'Cancel',
  save: 'Save',
  create: 'Create',
  delete: 'Delete',
  close: 'Close',
  copy: 'Copy',
  copied: 'Copied to clipboard',
  copyFailed: 'Couldn’t copy. Select the text and copy it manually.',
  retry: 'Retry',
  loadFailed: 'Couldn’t load',
  unknown: 'Unknown',
  disabled: 'Disabled',
  online: 'Online',
  offline: 'Offline',

  time: {
    justNow: 'just now',
    secondsAgo: (n: number) => `${n}s ago`,
    minutesAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n} h ago`,
    daysAgo: (n: number) => (n === 1 ? '1 day ago' : `${n} days ago`),
    expired: 'Expired',
    inMinutes: (n: number) => `in ${n} min`,
    inHours: (n: number) => `in ${n} h`,
    inDays: (n: number) => (n === 1 ? 'in 1 day' : `in ${n} days`),
    seconds: (n: number) => `${n}s`,
    minutes: (n: number) => `${n} min`,
    hoursMinutes: (h: number, m: number) => `${h} h ${m} min`,
    hours: (n: number) => `${n} h`,
    daysHours: (d: number, h: number) => `${d}d ${h}h`,
    days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  },

  unknownDevice: 'Unknown device',

  control: {
    none: 'Idle',
    observe: 'AI viewing',
    agent: 'AI in control',
    user: 'User took over',
  },

  roles: {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  },
  roleDescriptions: {
    owner: 'Full access, including inviting members, changing roles and removing members.',
    admin: 'Manages projects, API keys, access policies, devices and invites; can see the audit log and member list.',
    member: 'Sees projects and devices; can invite users to connect, test connections, end sessions and view the audit log.',
  },

  levels: {
    observe: {
      label: 'Observe',
      description: 'Snapshots, screenshots, console, the network request list, waiting for text. Cannot change the page.',
    },
    interact: {
      label: 'Interact',
      description: 'Everything in Observe, plus click, type, select, scroll, drag, navigate, go back and reload.',
    },
    advanced: {
      label: 'Advanced',
      description: 'Everything in Interact, plus running arbitrary JS in the page, reading request headers and bodies, and localStorage / cookies.',
    },
  },
  /** Badge tooltip: label, identifier and description. */
  levelTitle: (label: string, level: string, description: string) => `${label} (${level}): ${description}`,

  maskPresets: {
    phone: 'Phone number (CN)',
    idCard: 'ID card number (CN)',
    bankCard: 'Bank card number',
    email: 'Email',
  },
  regex: {
    empty: 'Enter a regex',
    matchesEmpty: 'Matches the empty string, which would mask all text',
    syntax: (detail: string) => `Invalid regex: ${detail}`,
    lookaround: 'Lookaround ((?=, (?!, (?<=, (?<!) isn’t supported; the gateway uses RE2 syntax',
    backreference: 'Backreferences (\\1 etc.) aren’t supported; the gateway uses RE2 syntax',
  },

  badges: {
    help: 'Asking for help',
    agentWithName: (label: string, agent: string) => `${label} (${agent})`,
    waitingConfirmAction: 'Waiting for user to confirm action',
    waitingConfirm: 'Waiting for user approval',
    waitingTitle: (agent: string) => `${agent} is waiting for the user to approve on the device`,
    invited: 'Invited',
    invitedTitle: 'Connected through an invite link',
  },

  api: {
    network: 'Can’t reach the gateway. Check your network.',
    unauthorized: 'Your session has expired. Please sign in again.',
    forbidden: 'You don’t have permission to do that.',
    notFound: 'Not found',
    server: 'Gateway error. Please try again later.',
    failed: (status: number) => `Request failed (HTTP ${status})`,
    unknown: 'Unknown error',
    adminName: 'Administrator',
  },
}
