// An in-browser stand-in for the Go gateway, page side of docs/protocol.md
// (mirrors sdk/test/mock-gateway.mjs and the hub semantics in
// gateway/internal/hub): hello / welcome, heartbeats, the control state
// machine, RPCs, events and the cross-page timeline, attach approval,
// levels and the task card. The SDK in the demo iframe talks to it through
// rwd-shim.js + tunnel.ts. Nothing here touches the network.

export type Lang = 'en' | 'zh'
export type Control = 'none' | 'observe' | 'agent' | 'user'
export type Level = 'observe' | 'interact' | 'advanced'

export interface Conn {
  readonly id: string
  send(msg: object): void
  close(code: number, reason: string): void
  onMessage: ((msg: any) => void) | null
  onClose: (() => void) | null
}

export interface RpcReply {
  result?: any
  error?: { code: string; message: string }
}

export interface Page {
  pageId: string
  label: string
  url: string
  title: string
  visibility: string
  openerId: string | null
  conn: Conn | null
  connected: boolean
  connectedAt: number
  lastActive: number
  pending: Map<number, (reply: RpcReply) => void>
}

export interface TimelineEvent {
  seq: number
  at: number
  page: string | null
  kind: string
  summary: string
}

export interface Task {
  title: string
  steps: string[]
  current: number
}

export interface DeviceState {
  id: string
  code: string
  userId: string | null
  info: any
  help: boolean
  control: Control
  agent: string | null
  level: Level | null
  task: Task | null
  token: string | null
}

const INTERACTIVE = new Set([
  'rwd.click', 'rwd.fill', 'rwd.type', 'rwd.press', 'rwd.select', 'rwd.hover',
  'rwd.scroll', 'rwd.drag', 'rwd.navigate', 'rwd.back', 'rwd.reload',
])
const ADVANCED = new Set(['rwd.evaluate', 'rwd.networkDetail', 'rwd.storage'])
const RANK: Record<Level, number> = { observe: 0, interact: 1, advanced: 2 }

export function requiredLevel(method: string): Level {
  if (ADVANCED.has(method)) return 'advanced'
  if (INTERACTIVE.has(method)) return 'interact'
  return 'observe'
}
export function isInteractive(method: string) {
  return INTERACTIVE.has(method)
}
export function levelAllows(granted: Level, needed: Level) {
  return RANK[granted] >= RANK[needed]
}

function randomToken(n = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let s = ''
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  for (const b of buf) s += chars[b % chars.length]
  return s
}

export function shortURL(u: string) {
  const i = u.indexOf('://')
  if (i >= 0) u = u.slice(i + 3)
  return u.length > 80 ? u.slice(0, 77) + '…' : u
}

interface Waiter {
  check: () => boolean
}

interface Attach {
  requestId: string
  pageId: string
  resolve: (v: Level | null | 'timeout' | 'cancelled') => void
  timer: ReturnType<typeof setTimeout>
}

export class MockGateway {
  readonly code = 'K7Q2-9M4X'
  readonly agentName: string
  device: DeviceState | null = null
  pages = new Map<string, Page>()
  timeline: TimelineEvent[] = []
  /** The agent's view: timeline events it has already been told about. */
  cursor = 0
  /** Extra lines for the agent's next "session changes". */
  notes: string[] = []
  /** The agent is attached (approved and not ended). */
  attached = false
  /** Why the agent is no longer attached, if the user ended it. */
  endedByUser = false
  disposed = false

  private seq = 0
  private rpcSeq = 0
  private nextLabel = 1
  private labels = new Map<string, string>()
  private waiters = new Set<Waiter>()
  private listeners = new Set<() => void>()
  private attach: Attach | null = null
  private hb: ReturnType<typeof setInterval>
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private conns = new Set<Conn>()

  constructor(readonly lang: Lang) {
    this.agentName = lang === 'zh' ? '客服 AI' : 'Support Agent'
    this.hb = setInterval(() => {
      for (const p of this.pages.values()) if (p.connected && p.conn) p.conn.send({ t: 'hb' })
    }, 25_000)
  }

  /* ------------------------------ plumbing ------------------------------ */

  private tx(en: string, zh: string) {
    return this.lang === 'zh' ? zh : en
  }

  pageName(p: Page) {
    if (p.title) return this.lang === 'zh' ? `${p.label}「${p.title}」` : `${p.label} “${p.title}”`
    return `${p.label} (${shortURL(p.url)})`
  }

  /** UI subscribers (control state, task, pages). */
  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed() {
    for (const w of [...this.waiters]) {
      try {
        w.check()
      } catch {
        // A waiter must never break the gateway.
      }
    }
    for (const fn of [...this.listeners]) {
      try {
        fn()
      } catch {
        // Ignore UI errors.
      }
    }
  }

  /** Resolves with pred()'s value once truthy, or null after timeoutMs / when aborted. Never rejects. */
  waitFor<T>(pred: () => T | null | undefined | false, timeoutMs: number, signal?: AbortSignal): Promise<T | null> {
    const first = pred()
    if (first) return Promise.resolve(first)
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout>
      const finish = (v: T | null) => {
        clearTimeout(timer)
        this.waiters.delete(w)
        signal?.removeEventListener('abort', onAbort)
        resolve(v)
      }
      const w: Waiter = {
        check: () => {
          if (this.disposed) {
            finish(null)
            return true
          }
          const v = pred()
          if (v) finish(v)
          return !!v
        },
      }
      const onAbort = () => finish(null)
      timer = setTimeout(() => finish(null), timeoutMs)
      signal?.addEventListener('abort', onAbort)
      this.waiters.add(w)
    })
  }

  addEvent(page: string | null, kind: string, summary: string) {
    this.timeline.push({ seq: ++this.seq, at: Date.now(), page, kind, summary })
    if (this.timeline.length > 100) this.timeline.shift()
  }

  /* ------------------------------ page side ------------------------------ */

  /** A page opened a WebSocket to /v1/page (through the tunnel). */
  accept(conn: Conn, url: string) {
    if (this.disposed) return conn.close(1001, 'gone')
    let key = ''
    try {
      key = new URL(url).searchParams.get('key') || ''
    } catch {
      // Bad URL: refused below.
    }
    if (!key.startsWith('rwd_pk_')) return conn.close(4001, 'bad key')
    this.conns.add(conn)
    let page: Page | null = null
    const helloTimer = setTimeout(() => conn.close(4001, 'no hello'), 5000)
    conn.onMessage = msg => {
      if (this.disposed || !msg || typeof msg !== 'object') return
      if (msg.t === 'hello') {
        clearTimeout(helloTimer)
        page = this.onHello(conn, msg)
        return
      }
      if (page) this.onPageMessage(page, msg)
    }
    conn.onClose = () => {
      clearTimeout(helloTimer)
      this.conns.delete(conn)
      if (page && page.conn === conn) {
        page.conn = null
        page.connected = false
        for (const cb of page.pending.values()) cb({ error: { code: 'internal', message: 'page disconnected' } })
        page.pending.clear()
        this.changed()
      }
    }
  }

  private onHello(conn: Conn, msg: any): Page {
    if (!this.device) {
      this.device = {
        id: String(msg.deviceId),
        code: this.code,
        userId: msg.userId ?? null,
        info: msg.device || {},
        help: false,
        control: 'none',
        agent: null,
        level: null,
        task: null,
        token: null,
      }
    }
    const d = this.device
    d.info = msg.device || d.info
    d.userId = msg.userId ?? d.userId
    let newToken: string | null = null
    if (!d.token) d.token = newToken = randomToken(32)
    const pageInfo = msg.page || {}
    let p = this.pages.get(msg.pageId)
    const now = Date.now()
    if (p) {
      if (p.conn && p.conn !== conn) p.conn.close(4000, 'replaced')
      const prevURL = p.url
      p.conn = conn
      p.connected = true
      p.url = String(pageInfo.url || '')
      p.title = String(pageInfo.title || '')
      p.visibility = pageInfo.visibility || 'visible'
      p.lastActive = now
      if (prevURL !== p.url) this.addEvent(p.label, 'navigated', this.tx(`${this.pageName(p)} navigated to ${shortURL(p.url)}`, `${this.pageName(p)} 跳转到 ${shortURL(p.url)}`))
      else this.addEvent(p.label, 'reloaded', this.tx(`${this.pageName(p)} reloaded`, `${this.pageName(p)} 重新加载`))
    } else {
      if (!this.labels.has(msg.pageId)) this.labels.set(msg.pageId, 'p' + this.nextLabel++)
      p = {
        pageId: String(msg.pageId),
        label: this.labels.get(msg.pageId)!,
        url: String(pageInfo.url || ''),
        title: String(pageInfo.title || ''),
        visibility: pageInfo.visibility || 'visible',
        openerId: msg.openerId || null,
        conn,
        connected: true,
        connectedAt: now,
        lastActive: now,
        pending: new Map(),
      }
      this.pages.set(p.pageId, p)
      this.addEvent(p.label, 'opened', this.tx(`${this.pageName(p)} opened`, `${this.pageName(p)} 打开`))
    }
    if (msg.help && !d.help) {
      d.help = true
      this.addEvent(p.label, 'help', this.tx('The user requested assistance', '用户请求协助'))
    }
    const welcome: any = {
      t: 'welcome',
      deviceCode: d.code,
      label: p.label,
      control: { state: d.control, agent: d.agent ? { name: d.agent } : null, level: d.level },
      help: d.help,
      resume: randomToken(16),
      level: d.level,
      config: { helpButton: true, maskSelectors: [], maskPatterns: [], confirmSelectors: [] },
      task: d.task ? { ...d.task, agent: d.agent } : null,
      agentLang: this.lang,
    }
    if (newToken) welcome.deviceToken = newToken
    conn.send(welcome)
    this.changed()
    return p
  }

  private onPageMessage(p: Page, msg: any) {
    const d = this.device
    if (!d) return
    if (typeof msg.id === 'number' && !msg.t) {
      const cb = p.pending.get(msg.id)
      if (cb) {
        p.pending.delete(msg.id)
        cb({ result: msg.result, error: msg.error })
      }
      return
    }
    switch (msg.t) {
      case 'page': {
        const url = String(msg.url || '')
        if (url && url !== p.url) {
          p.url = url
          if (msg.title) p.title = String(msg.title)
          this.addEvent(p.label, 'navigated', this.tx(`${this.pageName(p)} navigated to ${shortURL(url)}`, `${this.pageName(p)} 跳转到 ${shortURL(url)}`))
        } else if (msg.title && msg.title !== p.title) {
          p.title = String(msg.title)
        }
        if (msg.visibility && msg.visibility !== p.visibility) {
          p.visibility = msg.visibility
          if (msg.visibility === 'visible') {
            p.lastActive = Date.now()
            this.addEvent(p.label, 'focus', this.tx(`${this.pageName(p)} is in the foreground again`, `${this.pageName(p)} 回到前台`))
          }
        }
        break
      }
      case 'event':
        if (['error', 'net_fail', 'user_tap', 'console_error'].includes(msg.kind)) {
          this.addEvent(p.label, msg.kind, String(msg.summary || '').trim().slice(0, 300))
        }
        break
      case 'help':
        if (!!msg.on !== d.help) {
          d.help = !!msg.on
          this.addEvent(p.label, 'help', d.help ? this.tx('The user requested assistance', '用户请求协助') : this.tx('The user cancelled the assistance request', '用户取消了协助请求'))
        }
        break
      case 'control':
        this.onControlAction(String(msg.action))
        break
      case 'attach_decision': {
        const a = this.attach
        if (!a || a.requestId !== msg.requestId) break
        this.attach = null
        clearTimeout(a.timer)
        const level = msg.level === 'observe' || msg.level === 'interact' || msg.level === 'advanced' ? (msg.level as Level) : null
        a.resolve(level)
        break
      }
    }
    this.changed()
  }

  private onControlAction(action: string) {
    const d = this.device
    if (!d || !d.agent) return
    if (action === 'takeover' && d.control !== 'user') {
      this.setControl('user', this.tx('The user took over control', '用户接管了控制'))
    } else if (action === 'handback' && d.control === 'user') {
      this.setControl('agent', this.tx('The user handed control back to the AI', '用户把控制交还给 AI'))
      this.touchIdle()
    } else if (action === 'end') {
      this.endedByUser = true
      this.detachAgent(this.tx('The user ended the session', '用户结束了调试'))
    }
  }

  /* ------------------------------ control ------------------------------ */

  private broadcast(msg: object) {
    for (const p of this.pages.values()) if (p.connected && p.conn) p.conn.send(msg)
  }

  setControl(state: Control, summary?: string) {
    const d = this.device
    if (!d || d.control === state) return
    d.control = state
    if (state === 'none') {
      d.agent = null
      d.level = null
    }
    this.broadcast({ t: 'control', state, agent: d.agent ? { name: d.agent } : null, level: d.level })
    const text =
      summary ||
      {
        none: this.tx('Debugging ended, the page is idle again', '调试结束，页面恢复空闲'),
        observe: this.tx('The AI is viewing', 'AI 正在查看'),
        agent: this.tx('The AI started operating, user input is locked', 'AI 开始操作，用户输入已锁定'),
        user: this.tx('The user took over control', '用户接管了控制'),
      }[state]
    this.addEvent(null, 'control', text)
    this.changed()
  }

  private touchIdle() {
    clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      if (this.device && this.device.control === 'agent') this.setControl('observe', this.tx('The AI was idle for 2 minutes and is only viewing now', 'AI 2 分钟没有操作，回到仅查看'))
    }, 120_000)
  }

  /** The page the user most likely looks at: connected, visible, latest. */
  foreground(): Page | null {
    let best: Page | null = null
    for (const p of this.pages.values()) {
      if (!p.connected) continue
      if (!best || (p.visibility === 'visible' && best.visibility !== 'visible') || (p.visibility === best.visibility && p.lastActive >= best.lastActive)) best = p
    }
    return best
  }

  /** Any page of the device, connected or reconnecting (the demo has one tab). */
  anyPage(): Page | null {
    let best: Page | null = null
    for (const p of this.pages.values()) if (!best || p.lastActive >= best.lastActive) best = p
    return best
  }

  online() {
    return !!this.foreground()
  }

  /* ------------------------------ agent side ------------------------------ */

  /**
   * Ask the user to approve the agent (§9.2). Resolves with the granted
   * level, null (refused), 'timeout' or 'cancelled'. Never rejects.
   */
  requestAttach(levels: Level[], expiresInSec = 30): { requestId: string; decision: Promise<Level | null | 'timeout' | 'cancelled'> } {
    const page = this.foreground()
    const requestId = randomToken(12)
    if (!page || !page.conn) return { requestId, decision: Promise.resolve('timeout') }
    const d = this.device!
    // The gateway clears the help flag once an agent is on its way.
    if (d.help) {
      d.help = false
      this.broadcast({ t: 'help', on: false })
    }
    const want = levels[levels.length - 1]
    this.addEvent(null, 'agent', this.tx(`AI “${this.agentName}” asked to attach (${want}), waiting for the user`, `AI「${this.agentName}」请求接入（${want}），等待用户确认`))
    const decision = new Promise<Level | null | 'timeout' | 'cancelled'>(resolve => {
      const timer = setTimeout(() => {
        if (this.attach && this.attach.requestId === requestId) {
          this.attach = null
          page.conn?.send({ t: 'attach_cancel', requestId })
          resolve('timeout')
        }
      }, expiresInSec * 1000 + 500)
      this.attach = { requestId, pageId: page.pageId, resolve, timer }
    })
    page.conn.send({ t: 'attach_request', requestId, agent: { name: this.agentName, keyHint: '…a91f' }, levels, expiresInSec })
    this.changed()
    return { requestId, decision }
  }

  /** Withdraw the pending request (the page drops its dialog), resolving it with `as`. */
  cancelAttach(requestId: string, as: Level | 'cancelled' = 'cancelled') {
    const a = this.attach
    if (!a || a.requestId !== requestId) return
    this.attach = null
    clearTimeout(a.timer)
    this.broadcast({ t: 'attach_cancel', requestId })
    a.resolve(as)
  }

  /** Approved: the agent is in, viewing. */
  startAgent(level: Level, auto = false) {
    const d = this.device
    if (!d) return
    d.agent = this.agentName
    d.level = level
    this.attached = true
    this.endedByUser = false
    this.cursor = this.seq
    this.addEvent(null, 'agent', auto
      ? this.tx(`AI “${this.agentName}” attached (${level}), auto-approved for this demo`, `AI「${this.agentName}」已接入（${level}），演示中自动允许`)
      : this.tx(`AI “${this.agentName}” attached (${level})`, `AI「${this.agentName}」已接入（${level}）`))
    this.cursor = this.seq
    d.control = 'none'
    this.setControl('observe')
    this.cursor = this.seq
  }

  noteRefused(why: 'denied' | 'timeout') {
    this.addEvent(null, 'agent', why === 'denied'
      ? this.tx(`The user refused AI “${this.agentName}”`, `用户拒绝了 AI「${this.agentName}」的接入请求`)
      : this.tx('The user did not answer the attach request', '用户没有响应接入请求'))
  }

  /** Before an interactive RPC: observe → agent; user → refused. */
  beginInteraction(): RpcReply['error'] | null {
    const d = this.device
    if (!d) return { code: 'internal', message: 'no device' }
    if (d.control === 'user') return { code: 'takeover', message: this.tx('The user has taken over control. Call wait_for_control to wait until they hand it back.', '用户已接管控制，可调用 wait_for_control 等待用户交还。') }
    if (d.control === 'observe') this.setControl('agent')
    this.touchIdle()
    return null
  }

  setTask(task: Task | null) {
    const d = this.device
    if (!d) return
    const isNew = task && (!d.task || d.task.title !== task.title)
    d.task = task
    this.broadcast({ t: 'task', task: task ? { ...task, agent: d.agent } : null })
    if (isNew && task) this.addEvent(null, 'agent', this.tx(`The AI started task “${task.title}” (${task.steps.length} steps)`, `AI 开始任务「${task.title}」（${task.steps.length} 步）`))
    this.changed()
  }

  detachAgent(summary?: string) {
    const d = this.device
    if (!d) return
    clearTimeout(this.idleTimer)
    this.attached = false
    if (d.task) {
      d.task = null
      this.broadcast({ t: 'task', task: null })
    }
    if (d.control !== 'none') this.setControl('none', summary)
    else this.changed()
  }

  /** Send an RPC to a page. Resolves with {result} or {error}; never rejects. */
  rpc(page: Page, method: string, params: object = {}, timeoutMs = 15_000): Promise<RpcReply> {
    if (!page.connected || !page.conn) return Promise.resolve({ error: { code: 'internal', message: 'page not connected' } })
    const id = ++this.rpcSeq
    const conn = page.conn
    page.lastActive = Date.now()
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        page.pending.delete(id)
        resolve({ error: { code: 'timeout', message: 'rpc timeout' } })
      }, timeoutMs)
      page.pending.set(id, reply => {
        clearTimeout(timer)
        resolve(reply)
      })
      conn.send({ id, method, params })
    })
  }

  /** Timeline events since the agent last looked, as the gateway reports them. */
  delta(): string[] {
    const d = this.device
    const lines = this.notes.splice(0)
    for (const e of this.timeline) {
      if (e.seq <= this.cursor) continue
      if (e.kind === 'agent') continue
      if (e.kind === 'user_tap' && (!d || d.control !== 'user')) continue
      const prefix = e.page && !e.summary.startsWith(e.page) ? e.page + ' ' : ''
      lines.push(prefix + e.summary)
    }
    this.cursor = this.seq
    if (lines.length > 20) {
      const n = lines.length - 20
      return [this.tx(`(${n} earlier changes omitted, see get_session_timeline)`, `（省略 ${n} 条较早的变化，可用 get_session_timeline 查看）`), ...lines.slice(-20)]
    }
    return lines
  }

  /** Mark the timeline as read (get_session_timeline). */
  readAll() {
    this.cursor = this.seq
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    clearInterval(this.hb)
    clearTimeout(this.idleTimer)
    if (this.attach) {
      clearTimeout(this.attach.timer)
      this.attach.resolve('cancelled')
      this.attach = null
    }
    for (const p of this.pages.values()) {
      for (const cb of p.pending.values()) cb({ error: { code: 'internal', message: 'gateway stopped' } })
      p.pending.clear()
    }
    for (const c of [...this.conns]) {
      try {
        c.close(1001, 'demo restarted')
      } catch {
        // Already gone.
      }
    }
    this.conns.clear()
    this.changed()
    this.waiters.clear()
    this.listeners.clear()
  }
}
