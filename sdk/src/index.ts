// Must stay the first import: captures fetch / WebSocket before any hook.
import './native'
import {
  agentText,
  callMethod,
  currentSession,
  flushLog,
  logRecord,
  startLog,
  stopLog,
  INTERACTIVE_METHODS,
  levelAllows,
  requiredLevel,
  RwdError,
  scrub,
  setAgentLang,
  setConfirmSelectors,
  setMaskRules,
  setNetworkExclude,
  setUserLang,
  startObserving,
  toLevel,
  toRpcError,
  type EventKind,
  type Level,
} from '@chobitsu/engine/rwd'
import {
  clearInvite,
  ensureUniquePage,
  noteTap,
  read,
  readResume,
  renewPageId,
  resolveIdentity,
  takeInvite,
  TOKEN_KEY,
  write,
  writeResume,
  type Identity,
} from './ids'
import { Approvals } from './approval'
import { Transport, type LinkState } from './transport'
import { currentPage, watchPage } from './pageWatch'
import { Ui, type ControlState } from './ui'
import { ErudaBridge, resolveEruda, type ErudaOptions, type ErudaRemote } from './eruda'
import { createLock } from './lock'
import { resolveLang, type Lang } from './i18n'
import { rememberLaunch, resolveLaunch } from './launch'

// remote-webview-debugger page SDK.
//
//   <script src="https://rwd.example.com/v1/sdk.js"></script>
//   <script>RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_…")</script>
//
// Loading the file starts collecting console / errors / network into bounded
// buffers, so an agent that joins later sees what happened before. run()
// brings the device online (device code, pill UI) and serves the agent's RPCs.

declare const __RWD_VERSION__: string
export const version: string = __RWD_VERSION__

export interface RunOptions {
  userId?: string | null
  deviceId?: string
  helpButton?: boolean
  app?: { name: string; version: string } | null
  /**
   * Secret chosen by a native host (iOS/Android) when it injects the SDK.
   * Enables nativeControl() so the app can offer its own takeover / handback /
   * end buttons. Page scripts never see it.
   */
  nativeKey?: string
  /**
   * deviceToken the gateway issued to this deviceId (status().deviceToken),
   * kept by the native host: localStorage is per origin.
   */
  deviceToken?: string
  /**
   * The native host shows the attach / confirm questions itself: no page
   * dialog; it reads status().pending and answers with nativeDecide().
   */
  nativeApproval?: boolean
  /**
   * Work with eruda: `true` (or `{ dock: true }`) shows Remote Debugger as a
   * tab inside eruda instead of the floating window; `load: true` loads the
   * latest eruda when the page has none. Off by default; the project policy
   * can turn it on remotely, these options win field by field.
   */
  eruda?: boolean | ErudaOptions
  /**
   * Lock the page while an agent is attached (default true). The user can
   * still change it in the floating window.
   */
  lockScreen?: boolean
  /** Our UI's look: 'auto' (default) follows the page background, 'system' the OS, or fixed 'light' / 'dark'. */
  theme?: 'auto' | 'system' | 'light' | 'dark'
  /**
   * Language of the UI the phone user sees (pill, bottom bar, dialogs…):
   * 'en' or 'zh'. Default: 'zh' when navigator.language starts with "zh",
   * else 'en'. What the agent reads follows the gateway (welcome.agentLang).
   */
  lang?: Lang
  /**
   * Requests left out of what the agent sees in the network list and the
   * timeline (still recorded): URL substrings, `*` wildcards or /regex/,
   * e.g. ['.ttf', 'WebTracks', '*beacon*']. Added to the project's rules.
   */
  networkExclude?: string[]
  /**
   * Keep the session log (default true): what happened since the app was
   * launched, in IndexedDB on the device, for an attached agent to read. The
   * project policy can turn it off for every page.
   */
  record?: boolean
  /**
   * The host app's id for this launch (same for every webview until the app
   * process ends). Without it the SDK infers the launch; a host can also
   * define window.RWDLaunchId.
   */
  launchId?: string
}

export type Status = 'idle' | LinkState

/** welcome.config: the project policy the page applies (docs/protocol.md §3.4, §11). */
export interface RemoteConfig {
  helpButton: boolean
  maskSelectors: string[]
  maskPatterns: { name: string; regex: string }[]
  confirmSelectors: string[]
  networkExclude: string[]
  /** Keep the session log (project policy). */
  sessionLog: boolean
  eruda: ErudaRemote | null
}

export interface RunResult {
  deviceCode: string | null
  status: Status
}

const CODE_KEY = 'rwd:code'
const HELP_KEY = 'rwd:help'
const CONTROL_KEY = 'rwd:ctl'
const CONFIG_KEY = 'rwd:cfg'
const AGENT_LANG_KEY = 'rwd:alang'
const CONTROL_TTL = 2 * 60 * 1000
const RUN_WAIT_MS = 8000

interface Session {
  gatewayUrl: string
  appKey: string
  opts: RunOptions
  identity: Identity
  /** Language of the user's UI. */
  lang: Lang
  transport: Transport
  ui: Ui
  deviceCode: string | null
  label: string | null
  control: ControlState
  /** When the agent attached (local clock), for the connected-for timer; null: none. */
  attachedAt: number | null
  /** Level of the attached agent as the gateway granted it; null: not sent. */
  level: Level | null
  help: boolean
  deviceToken: string | null
  /** The token the last hello carried (a 4401 retry needs a different one). */
  sentToken: string | null
  invite: string | null
  config: RemoteConfig | null
  approvals: Approvals
  eruda: ErudaBridge
  waiters: ((r: RunResult) => void)[]
}

let session: Session | null = null
let pending: Promise<RunResult> | null = null

/* ---------------------------- always-on pieces ---------------------------- */

// Events wait here until a session is online (they are part of the timeline).
const recentEvents: { [key: string]: number } = {}
let eventBudget = { start: 0, count: 0 }

function emit(kind: EventKind, summary: string) {
  if (!summary) return
  const now = Date.now()
  // Same event within 2 s: once. At most 30 events per 10 s.
  const key = kind + '|' + summary
  if (recentEvents[key] && now - recentEvents[key] < 2000) return
  recentEvents[key] = now
  if (now - eventBudget.start > 10_000) eventBudget = { start: now, count: 0 }
  if (++eventBudget.count > 30) return
  for (const k in recentEvents) if (now - recentEvents[k] > 10_000) delete recentEvents[k]
  if (session) session.transport.send({ t: 'event', kind, summary: scrub(summary), at: now }, true)
}

// The agent's language as the last welcome set it, so events from before this
// page's welcome (load errors, failed requests) are already in it.
setAgentLang(read('localStorage', AGENT_LANG_KEY))
startObserving(emit)

let lockApi: ReturnType<typeof createLock> | null = null
let uiRef: Ui | null = null
function lock() {
  if (!lockApi) lockApi = createLock(e => !!uiRef && uiRef.isOwnControl(e))
  return lockApi
}
// Install the lock listeners now, before the page adds its own.
lock()

let pageWatcher: ReturnType<typeof watchPage> | null = null
function watch() {
  if (pageWatcher) return
  pageWatcher = watchPage({
    onChange: page => {
      if (session) session.transport.send({ t: 'page', ...page })
    },
    onTap: summary => {
      if (session) noteTap(session.identity.pageId)
      emit('user_tap', summary)
    },
  })
}

/* --------------------------------- helpers -------------------------------- */

function platform(): 'ios' | 'android' | 'web' {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'web'
}

function deviceInfo(opts: RunOptions) {
  return {
    ua: navigator.userAgent,
    platform: platform(),
    screen: {
      w: window.screen ? screen.width : window.innerWidth,
      h: window.screen ? screen.height : window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    },
    app: opts.app && opts.app.name ? { name: String(opts.app.name), version: String(opts.app.version || '') } : null,
  }
}

function endpoints(gatewayUrl: string, appKey: string) {
  const base = new URL(gatewayUrl.replace(/\/+$/, '') + '/', location.href)
  if (base.protocol !== 'https:' && base.protocol !== 'http:') throw new Error('gatewayUrl must be http(s)')
  const ws = new URL('page', base)
  ws.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  ws.searchParams.set('key', appKey)
  return { wsUrl: ws.href, presenceUrl: new URL('presence', base).href }
}

function linkStatus(): Status {
  return session ? session.transport.state : 'idle'
}

function result(): RunResult {
  return { deviceCode: session ? session.deviceCode : null, status: linkStatus() }
}

function resolveWaiters() {
  if (!session) return
  const waiters = session.waiters
  session.waiters = []
  for (const w of waiters) w(result())
}

function storedControl(): { state: ControlState; since: number | null } | null {
  try {
    const saved = JSON.parse(read('localStorage', CONTROL_KEY) || 'null')
    if (saved && attached(saved.s) && Date.now() - saved.at < CONTROL_TTL) {
      return { state: saved.s, since: typeof saved.since === 'number' ? saved.since : null }
    }
  } catch (e) {
    // Ignore.
  }
  return null
}

/** An agent is attached and the user has not taken over: the page locks. */
function attached(state: unknown): state is ControlState {
  return state === 'observe' || state === 'agent'
}

function applyLock(s: Session) {
  lock().set(attached(s.control) && s.ui.lockScreen())
}

function setLevel(s: Session, level: unknown) {
  s.level = level == null ? null : toLevel(level)
}

function agentName(control: any): string | undefined {
  return control && control.agent && typeof control.agent.name === 'string' ? control.agent.name : undefined
}

function applyControl(s: Session, state: ControlState, agent?: string, attachedMs?: unknown) {
  // The user took over or the agent left: nobody to ask on its behalf.
  if (state === 'user' || state === 'none') s.approvals.cancelConfirm()
  if (state === 'none') s.level = null
  if (state !== s.control) logRecord('control', { state, agent: agent || null }, true)
  // When the agent attached: from the gateway's attachedMs (no clock in
  // common needed), else from when this page first saw it.
  if (state === 'none') s.attachedAt = null
  else if (typeof attachedMs === 'number' && attachedMs >= 0) s.attachedAt = Date.now() - attachedMs
  else if (s.attachedAt == null) s.attachedAt = Date.now()
  s.control = state
  s.ui.setControl(state, agent, s.attachedAt)
  // Locked from the moment the agent attaches, not only while it acts.
  applyLock(s)
  write('localStorage', CONTROL_KEY, JSON.stringify({ s: state, at: Date.now(), since: s.attachedAt }))
}

/** Level the page enforces: as granted; an agent without one (a phase 1 gateway) interacts. */
function grantedLevel(s: Session): Level | null {
  if (s.level) return s.level
  return s.control === 'none' ? null : 'interact'
}

function list(v: any): string[] {
  return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []
}

function readConfig(raw: any): RemoteConfig {
  return {
    helpButton: !!raw.helpButton,
    maskSelectors: list(raw.maskSelectors),
    maskPatterns: Array.isArray(raw.maskPatterns)
      ? raw.maskPatterns
          .filter((p: any) => p && typeof p.regex === 'string')
          .map((p: any) => ({ name: String(p.name || ''), regex: p.regex }))
      : [],
    confirmSelectors: list(raw.confirmSelectors),
    networkExclude: list(raw.networkExclude),
    sessionLog: raw.sessionLog !== false,
    eruda: raw.eruda && typeof raw.eruda === 'object' ? { dock: !!raw.eruda.dock, load: !!raw.eruda.load } : null,
  }
}

function applyConfig(s: Session, config: RemoteConfig | null) {
  s.config = config
  setMaskRules(config ? config.maskSelectors : [], config ? config.maskPatterns : [])
  setConfirmSelectors(config ? config.confirmSelectors : [])
  setNetworkExclude(list(s.opts.networkExclude).concat(config ? config.networkExclude : []))
  // The project turned the session log off: also delete what this origin kept.
  if (config && !config.sessionLog) void stopLog(true)
  s.ui.setHelpButton(!!s.opts.helpButton || (!!config && config.helpButton))
  if (s.ui.host.isConnected) s.eruda.apply(resolveEruda(s.opts.eruda, config && config.eruda))
}

function currentToken(s: Session): string | null {
  return s.opts.deviceToken || read('localStorage', TOKEN_KEY) || null
}

function linkView(state: LinkState) {
  if (state === 'online') return 'online'
  return state === 'polling' || state === 'rejected' || state === 'quota' ? 'offline' : 'connecting'
}

/* ---------------------------------- RPCs ---------------------------------- */

async function onRpc(s: Session, msg: { id: number; method: string; params?: any }) {
  let reply: object
  try {
    const needed = requiredLevel(msg.method)
    const granted = grantedLevel(s)
    if (needed && granted && !levelAllows(granted, needed)) {
      throw new RwdError('forbidden', agentText().needLevel(needed))
    }
    if (s.control === 'user' && INTERACTIVE_METHODS.indexOf(msg.method) >= 0) {
      throw new RwdError('takeover', agentText().takenOver)
    }
    if (msg.method === 'rwd.click') noteTap(s.identity.pageId)
    const res = await callMethod(msg.method, msg.params, {
      highlight: el => s.ui.highlight(el),
      pointer: (p, kind) => s.ui.pointer(p.x, p.y, kind),
      confirm: action => s.approvals.confirm(action),
    })
    reply = { id: msg.id, result: res === undefined ? {} : res }
  } catch (e) {
    reply = { id: msg.id, error: toRpcError(e) }
  }
  logAgentAction(msg.method, msg.params, reply)
  if (session === s) s.transport.send(reply)
}

/** What the agent did, for the session log (reads are left out). */
function logAgentAction(method: string, params: any, reply: any) {
  if (INTERACTIVE_METHODS.indexOf(method) < 0 && method !== 'rwd.evaluate') return
  const p = params && typeof params === 'object' ? params : {}
  const data: { [key: string]: unknown } = { method }
  for (const key of ['ref', 'fromRef', 'toRef', 'key', 'url', 'values']) if (p[key] !== undefined) data[key] = p[key]
  if (typeof p.value === 'string' || typeof p.text === 'string') data.text = scrub(String(p.value ?? p.text)).slice(0, 200)
  if (reply.error) data.error = `${reply.error.code}: ${reply.error.message}`
  logRecord('agent', data, true)
}

function onMessage(s: Session, msg: any) {
  if (typeof msg.id === 'number' && typeof msg.method === 'string') {
    onRpc(s, msg)
    return
  }
  switch (msg.t) {
    case 'welcome':
      // First: sibling tabs of a new device pick the token up from here.
      if (typeof msg.deviceToken === 'string' && msg.deviceToken) {
        s.deviceToken = msg.deviceToken
        write('localStorage', TOKEN_KEY, msg.deviceToken)
      }
      writeResume(s.identity.pageId, typeof msg.resume === 'string' ? msg.resume : null)
      // Language of what we send the agent; a gateway without it gets English.
      if (typeof msg.agentLang === 'string') {
        setAgentLang(msg.agentLang)
        write('localStorage', AGENT_LANG_KEY, msg.agentLang)
      }
      if (s.invite) {
        s.invite = null
        clearInvite()
      }
      if (msg.config && typeof msg.config === 'object') {
        const config = readConfig(msg.config)
        applyConfig(s, config)
        write('localStorage', CONFIG_KEY, JSON.stringify(config))
      }
      if (msg.deviceCode) {
        s.deviceCode = String(msg.deviceCode)
        write('localStorage', CODE_KEY, s.deviceCode)
      }
      s.label = msg.label || null
      s.ui.setLink('online', s.deviceCode || undefined)
      setLevel(s, msg.level != null ? msg.level : msg.control && msg.control.level)
      applyControl(s, (msg.control && msg.control.state) || 'none', agentName(msg.control), msg.control && msg.control.attachedMs)
      s.ui.setTask(msg.task || null)
      storeHelp(s, !!msg.help)
      resolveWaiters()
      break
    case 'task':
      s.ui.setTask(msg.task || null)
      break
    case 'control':
      setLevel(s, msg.level)
      applyControl(s, msg.state || 'none', agentName(msg), msg.attachedMs)
      break
    case 'attach_request':
      s.approvals.onAttachRequest(msg)
      break
    case 'attach_cancel':
      s.approvals.onAttachCancel(String(msg.requestId))
      break
    case 'help':
      storeHelp(s, !!msg.on)
      break
  }
}

/* ------------------------------- public API ------------------------------- */

/**
 * Bring this page online for remote debugging. Resolves with the device code
 * once the gateway has answered (or after a few seconds with what is known).
 * Calling it again is harmless.
 */
export function run(gatewayUrl: string, appKey: string, opts: RunOptions = {}): Promise<RunResult> {
  if (pending) return pending
  if (typeof gatewayUrl !== 'string' || !gatewayUrl) return Promise.reject(new Error('RemoteWebviewDebugger.run: gatewayUrl is required'))
  if (typeof appKey !== 'string' || !appKey) return Promise.reject(new Error('RemoteWebviewDebugger.run: appKey is required'))
  let urls: { wsUrl: string; presenceUrl: string }
  try {
    urls = endpoints(gatewayUrl, appKey)
  } catch (e) {
    return Promise.reject(e)
  }

  // Before watch(): taking the invite out of the URL is not a navigation.
  const invite = takeInvite()
  watch()
  const identity = resolveIdentity(opts.deviceId)
  const lang = resolveLang(opts.lang)
  // Sensitive-action descriptions ("AI wants to …") come from the engine.
  setUserLang(lang)
  const ui = new Ui({
    lang,
    helpButton: !!opts.helpButton,
    lockScreen: opts.lockScreen !== false,
    theme: opts.theme,
    onSettings: () => {
      if (session) applyLock(session)
    },
    onHelp: on => setHelp(on),
    onControl: action => {
      if (session) session.transport.send({ t: 'control', action }, true)
    },
  })
  uiRef = ui

  const s: Session = {
    gatewayUrl,
    appKey,
    opts: { ...opts },
    identity,
    lang,
    ui,
    deviceCode: read('localStorage', CODE_KEY),
    label: null,
    control: 'none',
    attachedAt: null,
    level: null,
    // Help is per device and survives navigation; the gateway has the last word.
    help: read('localStorage', HELP_KEY) === '1',
    deviceToken: null,
    sentToken: null,
    invite,
    config: null,
    waiters: [],
    transport: null as unknown as Transport,
    approvals: null as unknown as Approvals,
    eruda: new ErudaBridge(ui),
  }
  s.deviceToken = currentToken(s)
  s.approvals = new Approvals({
    ui,
    native: !!opts.nativeApproval,
    send: msg => s.transport.send(msg, true),
  })
  setNetworkExclude(list(opts.networkExclude))
  // The last project config until the welcome brings the current one.
  try {
    const saved = JSON.parse(read('localStorage', CONFIG_KEY) || 'null')
    if (saved && typeof saved === 'object') applyConfig(s, readConfig(saved))
  } catch (e) {
    // Ignore malformed data.
  }
  // Session log: on unless the page or the project (last known config) said no.
  if (opts.record === false) void stopLog(false)
  else if (!s.config || s.config.sessionLog) {
    logRecord('page', { event: 'open', url: scrub(location.href), title: scrub(document.title), referrer: scrub(document.referrer) })
    resolveLaunch(opts.launchId)
      .then(launch => startLog(launch, identity.pageId).then(used => rememberLaunch(launch, used)))
      .catch(() => undefined)
  }
  s.transport = new Transport({
    wsUrl: urls.wsUrl,
    presenceUrl: urls.presenceUrl,
    hello: () => {
      s.sentToken = s.deviceToken = currentToken(s)
      return {
        t: 'hello',
        v: 1,
        sdk: version,
        deviceId: s.identity.deviceId,
        pageId: s.identity.pageId,
        openerId: s.identity.openerId,
        userId: s.opts.userId == null ? null : String(s.opts.userId),
        page: currentPage(),
        device: deviceInfo(s.opts),
        help: s.help,
        deviceToken: s.sentToken,
        resume: readResume(s.identity.pageId),
        invite: s.invite,
      }
    },
    presence: () => ({
      key: s.appKey,
      deviceId: s.identity.deviceId,
      pageId: s.identity.pageId,
      page: currentPage(),
      device: deviceInfo(s.opts),
      userId: s.opts.userId == null ? null : String(s.opts.userId),
      help: s.help,
      deviceToken: currentToken(s),
    }),
    onMessage: msg => onMessage(s, msg),
    onState: state => {
      s.ui.setLink(linkView(state), s.deviceCode || undefined)
      // An RPC reply cannot reach the agent any more.
      if (state !== 'online') s.approvals.cancelConfirm()
      if (state === 'polling' || state === 'stopped' || state === 'rejected' || state === 'quota') {
        // No live gateway: no agent can be acting.
        if (s.control !== 'none') applyControl(s, 'none')
      }
      if (state === 'stopped' || state === 'rejected' || state === 'quota') resolveWaiters()
    },
    onRejected: () => {
      const token = currentToken(s)
      return !!token && token !== s.sentToken
    },
    onConflict: () => renewPageId(s.identity),
    onPresence: res => {
      if (res.deviceCode) {
        s.deviceCode = String(res.deviceCode)
        write('localStorage', CODE_KEY, s.deviceCode)
        s.ui.setLink('offline', s.deviceCode)
      }
      resolveWaiters()
    },
  })
  session = s

  ui.setLink('connecting', s.deviceCode || undefined)
  ui.setHelp(s.help)
  ui.mount()
  s.eruda.apply(resolveEruda(s.opts.eruda, s.config && s.config.eruda))
  // An agent was attached a moment ago (we navigated): lock right away and
  // let the welcome confirm or release it.
  const stored = storedControl()
  if (stored) {
    s.attachedAt = stored.since
    applyControl(s, stored.state)
    setTimeout(() => {
      if (session === s && attached(s.control) && !s.transport.isOnline()) applyControl(s, 'none')
    }, RUN_WAIT_MS)
  }

  pending = new Promise<RunResult>(resolve => {
    s.waiters.push(resolve)
    setTimeout(() => resolveWaiters(), RUN_WAIT_MS)
  })
  ensureUniquePage(identity).then(() => {
    if (session === s) s.transport.start()
  })
  return pending
}

function onPageHide(e: PageTransitionEvent) {
  if (!session) return
  // Close now: the gateway learns right away, and an open WebSocket would keep
  // the page out of the bfcache. Not stop(): that would also clear the stored
  // control state the next page needs to lock without a gap.
  void e
  logRecord('page', { event: 'hide' })
  flushLog()
  session.transport.suspend()
}

function onPageShow(e: PageTransitionEvent) {
  if (session && e.persisted) session.transport.resume()
}

window.addEventListener('pagehide', onPageHide)
window.addEventListener('pageshow', onPageShow)

/** Current state: device code, link status, control state. */
export function getStatus() {
  const s = session
  return {
    deviceCode: s ? s.deviceCode : read('localStorage', CODE_KEY),
    status: linkStatus(),
    control: s ? s.control : ('none' as ControlState),
    help: s ? s.help : false,
    label: s ? s.label : null,
    deviceId: s ? s.identity.deviceId : null,
    pageId: s ? s.identity.pageId : null,
    version,
    lang: s ? s.lang : null,
    deviceToken: s ? s.deviceToken : read('localStorage', TOKEN_KEY),
    level: s ? grantedLevel(s) : null,
    config: s ? s.config : null,
    pending: s ? s.approvals.pending() : null,
    /** Id of the session log this page writes to; null when not recording. */
    logSession: currentSession() || null,
  }
}
export { getStatus as status }

/** Disconnect and remove the UI. Console / network collection continues (bounded). */
export function stop() {
  const s = session
  if (!s) return
  session = null
  pending = null
  uiRef = null
  s.transport.stop()
  s.approvals.destroy()
  s.ui.unmount()
  lock().set(false)
  resolveWaitersOf(s)
}

function resolveWaitersOf(s: Session) {
  const waiters = s.waiters
  s.waiters = []
  for (const w of waiters) w({ deviceCode: s.deviceCode, status: 'stopped' })
}

/** Set or change the signed-in user. The gateway learns it through a new hello. */
export function setUser(userId: string | null) {
  const s = session
  const value = userId == null || userId === '' ? null : String(userId)
  if (!s) return
  if ((s.opts.userId == null ? null : String(s.opts.userId)) === value) return
  s.opts.userId = value
  if (s.transport.state !== 'stopped') s.transport.restart()
}

function storeHelp(s: Session, on: boolean) {
  s.help = on
  s.ui.setHelp(on)
  write('localStorage', HELP_KEY, on ? '1' : null)
}

function setHelp(on: boolean) {
  const s = session
  if (!s) return
  storeHelp(s, !!on)
  // Offline: the next hello / presence call carries it.
  s.transport.send({ t: 'help', on: s.help }, false)
}

/** Ask for help (the pill shows it; the console and agents see the device asking), or cancel. */
export function help(on = true) {
  setHelp(on)
}

/**
 * Take over, hand back or end from the native host's own UI. Requires the
 * nativeKey given to run(): page scripts, including an agent's
 * evaluate_script, cannot read it, so they cannot hand control to the agent.
 */
export function nativeControl(key: string, action: 'takeover' | 'handback' | 'end'): boolean {
  const s = session
  if (!s || !keyMatches(s, key) || (action !== 'takeover' && action !== 'handback' && action !== 'end')) return false
  s.transport.send({ t: 'control', action }, true)
  return true
}

/**
 * Answer status().pending from the native host's own dialog: a level (or null
 * to refuse) for `attach`, 'allow' (or null) for `confirm`. Requires the
 * nativeKey, like nativeControl(). False when the key, request or value is wrong.
 */
export function nativeDecide(key: string, requestId: string, value: string | null): boolean {
  const s = session
  if (!s || !keyMatches(s, key) || typeof requestId !== 'string') return false
  return s.approvals.decide(requestId, value == null ? null : String(value))
}

function keyMatches(s: Session, key: string) {
  const expected = s.opts.nativeKey
  if (!expected || typeof key !== 'string' || key.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
