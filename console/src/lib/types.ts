// Mirrors docs/protocol.md sections 11-14. Timestamps are milliseconds since epoch.
// Newer fields are optional on the wire (an older gateway omits them), so they are optional here too.

export type ControlState = 'none' | 'observe' | 'agent' | 'user'

export type Level = 'observe' | 'interact' | 'advanced'

export type Role = 'owner' | 'admin' | 'member'

export type Me = {
  id: string
  email: string
  name: string
  role: Role
  /** False for single sign-on accounts, which have no password to change. */
  hasPassword?: boolean
  sso?: string[]
}

export type MaskPattern = { name: string; regex: string }

export type HelpButtonMode = 'off' | 'all' | 'listed'

export type Policy = {
  approval: 'none' | 'prompt'
  maxLevel: Level
  maskSelectors: string[]
  maskPatterns: MaskPattern[]
  confirmSelectors: string[]
  /** Requests hidden from agents: URL substrings, * wildcards or /regex/; run({ networkExclude }) adds more. */
  networkExclude: string[]
  /** Pages keep the session log (since the app launched) in IndexedDB; run({ record: false }) turns it off for one page. */
  sessionLog: boolean
  helpButton: HelpButtonMode
  helpUsers: string[]
  agentIdleMinutes: number
  attachMaxMinutes: number
  maxOnlineDevices: number
  maxAgents: number
  /** How pages combine with eruda; run({ eruda }) overrides it per field. */
  eruda: { dock: boolean; load: boolean }
  /** Whether admins may open Chrome DevTools on the project's pages (section 17). */
  devtools: 'on' | 'off'
}

export type Project = {
  id: string
  name: string
  appKey: string
  allowedOrigins: string[]
  disabled: boolean
  createdAt: number
  onlineDevices: number
  totalDevices: number
  policy?: Partial<Policy>
  /** H5 page that device invite links open; may be empty. */
  inviteUrl?: string
}

export type ProjectPatch = Partial<Pick<Project, 'name' | 'allowedOrigins' | 'disabled' | 'inviteUrl'>> & {
  policy?: Partial<Policy>
}

/**
 * A key reaches every device. It belongs to the member who created it (`ownerId`); keys without an owner are
 * gateway keys (from before keys had owners), which only owners and admins see and revoke.
 */
export type ApiKey = {
  id: string
  name: string
  prefix: string
  createdAt: number
  lastUsedAt: number | null
  revokedAt: number | null
  maxLevel?: Level
  expiresAt?: number | null
  ipAllowlist?: string[]
  /** null: a gateway key. */
  ownerId?: string | null
  /** Empty for gateway keys and for members who were deleted (whose keys are revoked). */
  ownerName?: string
  ownerEmail?: string
  /** The owner is disabled: the key stops working until they are enabled again. */
  ownerDisabled?: boolean
}

export type CreatedApiKey = ApiKey & { key: string }

export type CreateKeyInput = { name: string; maxLevel: Level; expiresInDays: number; ipAllowlist: string[] }

export type Device = {
  id: string
  code: string
  /** Project of the device's latest page. */
  projectId: string
  /** Projects of the device's connected pages (one phone can open pages of several integrations). */
  projects?: string[]
  userId: string | null
  platform: string
  ua: string
  app: { name: string; version: string } | null
  online: boolean
  help: boolean
  control: ControlState
  agent: string | null
  pages: number
  /** SDK version reported by the device's pages. */
  sdk: string
  /** The user's foreground page, if any page is connected. */
  currentPage: { label: string; url: string; title: string } | null
  firstSeenAt: number
  lastSeenAt: number
  /** Effective level of the current attach. */
  level?: Level | null
  /** An agent is waiting for the user to approve on the device. */
  pending?: PendingApproval | null
  /** The device came online through a device invite link. */
  invited?: boolean
  /** While online: when this connection began (section 12.5). */
  onlineSince?: number
  /** Parsed from the user agent by the gateway (section 12.5). */
  system?: DeviceSystem
  /** Only on GET /devices (the cross-project list). */
  projectName?: string
  /** Open DevTools windows (section 17). */
  devtools?: DevtoolsWindow[]
}

export type DevtoolsWindow = { id: string; member: string; page: string; since: number }

/** POST /devices/:id/devtools (section 17). */
export type DevtoolsGrant = { ticket: string; session: string; page: Page; frontendUrl: string }

export type DeviceSystem = {
  /** iOS | iPadOS | Android | HarmonyOS | macOS | Windows | Linux | "" */
  os: string
  osVersion: string
  model: string
  /** WebView | Safari 18.0 | Chrome 131 | WeChat 8.0.50 | … */
  browser: string
  /** e.g. "iOS 18.0 · iPhone · WebView" */
  label: string
}

export type DeviceListStatus = 'online' | 'all'

export type DeviceListParams = {
  status: DeviceListStatus
  q: string
  project: string
  page: number
  pageSize: number
}

export type DeviceListPage = { devices: Device[]; total: number; page: number; pageSize: number }

/** GET /status (section 12.5), plus what the console measured itself. */
export type GatewayStatus = {
  ok: boolean
  version: string
  db: string
  gatewayUrl: string
  sdkVersion?: string
  startedAt: number
  uptimeSec: number
  serverTime: number
  onlineDevices: number
  totalDevices: number
  connectedPages: number
  attachedAgents: number
  /** Online devices whose user requested assistance (assisting), and attach requests waiting on a user (newer gateways). */
  helpDevices?: number
  pendingApprovals?: number
  wsConnections: number
  projects: number
}

export type MeasuredStatus = GatewayStatus & {
  /** Round trip of the status request, measured in the browser. */
  rttMs: number
  checkedAt: number
}

export type PendingApproval = {
  kind: string
  agent: string | { name: string; keyHint?: string }
  levels: Level[]
  /** 'devtools': a member asked for DevTools (section 17). */
  purpose?: 'devtools'
  expiresAt: number
}

export type Integration = {
  appKey: string
  gatewayUrl: string
  sdkUrl: string
  firstSeenAt: number | null
  onlineDevices: number
  lastDevice: Device | null
}

export type Page = {
  id: string
  projectId?: string
  label: string
  url: string
  title: string
  visibility: 'visible' | 'hidden'
  /** The page the user is most likely looking at (connected, foreground, most recent). */
  focused: boolean
  /** The page the agent is currently working on. */
  selected: boolean
  openerLabel: string | null
  connectedAt: number
  /** Connected now (false while it reloads or navigates). */
  connected?: boolean
  /** When the current connection began; a reload or navigation renews it. */
  connectedSince: number
}

export type TimelineEvent = { at: number; page: string | null; kind: string; summary: string }

export type DeviceDetail = Omit<Device, 'pages'> & { pages: Page[]; timeline: TimelineEvent[] }

export type DeviceStatusFilter = 'online' | 'waiting' | 'all'

export type TestResult = {
  ok: boolean
  latencyMs?: number
  page?: { label: string; url: string; title: string }
  snapshot?: string
  // The contract only says `error?`; accept either a plain string or the standard error object.
  error?: string | { code?: string; message?: string }
}

export type GatewayConfig = {
  gatewayUrl: string
  version: string
  sdkVersion?: string
  sdkIntegrity?: string
  /** Single sign-on, when the gateway has RWD_OIDC_* set. */
  sso?: SSOConfig | null
}

export type SSOProvider = 'feishu' | 'lark' | 'oidc'

export type SSOConfig = {
  provider: SSOProvider
  /** RWD_OIDC_NAME; empty: the provider's name in the console language. */
  name: string
  /** Role of accounts created at a first sign-in. */
  defaultRole: Role
  /** No accounts are created: only invited members can sign in. */
  inviteOnly: boolean
}

export type Member = {
  id: string
  email: string
  name: string
  role: Role
  disabled: boolean
  /** Has not accepted the invite yet. */
  pending: boolean
  createdAt: number
  lastLoginAt: number | null
  /** Can sign in with a password (single sign-on accounts have none). */
  hasPassword?: boolean
  /** Single sign-on providers linked to the account. */
  sso?: string[]
}

export type CreatedMember = Member & { inviteUrl: string }

export type DeviceInvite = {
  id: string
  note: string
  link: string
  expiresAt: number
  usedAt: number | null
  deviceId: string | null
  createdBy: string
}

export type AuditResult = 'ok' | 'denied' | 'error'

export type AuditEvent = {
  id: number
  at: number
  projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'
  actorId: string
  actorName: string
  action: string
  target: string
  result: AuditResult
  detail: Record<string, unknown>
}

export type AuditFilters = {
  project?: string
  device?: string
  actor?: string
  action?: string
  from?: number
  to?: number
}

export type AuditPage = { events: AuditEvent[]; nextBefore: number | null }

/** GET /insights (section 12.5): the admin overview. */
export type Insights = {
  serverTime: number
  runtime: {
    goroutines: number
    heapBytes: number
    sysBytes: number
    gcCount: number
    cpus: number
    uptimeSec: number
    os: string
    /** Gateway process CPU since the previous request; 100 = one core. */
    cpuPercent?: number
    /** Host load averages over 1, 5 and 15 minutes (Linux). */
    load?: [number, number, number]
    memTotalBytes?: number
    memAvailableBytes?: number
  }
  live: {
    wsConnections: number
    connectedPages: number
    onlineDevices: number
    attachedAgents: number
    helpDevices: number
    pendingApprovals: number
  }
  debug: {
    total: number
    totalAgent: number
    totalDevtools: number
    today: number
    todayAgent: number
    todayDevtools: number
    devices: number
    devicesToday: number
    /** Oldest first; `day` counts local days since the epoch. */
    days: { day: number; agent: number; devtools: number }[]
  }
}
