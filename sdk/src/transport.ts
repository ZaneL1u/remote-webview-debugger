import { nativeFetch, nativeWebSocket } from './native'

// The page's link to the gateway (docs/protocol.md §3, §9).
//
// - WebSocket to /v1/page?key=…, `hello` right after open (the gateway closes
//   connections that stay silent for 5 s).
// - No message for 60 s (the gateway sends `hb` every 25 s) → reconnect.
// - Reconnect with exponential backoff 1 s → 30 s plus jitter.
// - 3 failed attempts in a row (closed before `welcome`) → POST /v1/presence
//   every 60 s; back to the WebSocket when it answers `connect: true` (and, as
//   a safety net, every 5th poll).
// - Close codes (§3.6): 4401 bad deviceToken → retry at once if the token
//   changed meanwhile (a sibling tab just got it), else `rejected` and retry
//   every ~10 min; 4409 resume mismatch → new pageId, reconnect; 4429 over
//   the online-device quota → `quota`, retry every ~5 min.

export type LinkState = 'connecting' | 'online' | 'polling' | 'stopped' | 'rejected' | 'quota'

export interface TransportOptions {
  wsUrl: string
  presenceUrl: string
  hello(): object
  presence(): object
  onMessage(msg: any): void
  onState(state: LinkState): void
  onPresence(res: { deviceCode?: string; connect?: boolean }): void
  /** Close 4401. True: the token changed since the hello, retry right away. */
  onRejected(): boolean
  /** Close 4409: take a new pageId before the next hello. */
  onConflict(): void
}

const IDLE_MS = 60_000
const POLL_MS = 60_000
const MAX_FAILURES = 3
const QUEUE_LIMIT = 100
const REJECTED_RETRY_MS = 10 * 60_000
const QUOTA_RETRY_MS = 5 * 60_000

export class Transport {
  private ws: WebSocket | null = null
  private failures = 0
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private polls = 0
  private online = false
  private stopped = true
  private queue: object[] = []
  state: LinkState = 'stopped'

  constructor(private opts: TransportOptions) {}

  start() {
    if (!this.stopped) return
    this.stopped = false
    this.connect()
  }

  stop() {
    this.stopped = true
    this.clearTimers()
    this.stopPolling()
    this.drop()
    this.queue = []
    this.setState('stopped')
  }

  /** Close now and reconnect right away (e.g. to send a fresh hello). */
  restart(delayMs = 0) {
    if (this.stopped) return
    this.clearTimers()
    this.stopPolling()
    this.drop()
    this.timer = setTimeout(() => this.connect(), delayMs)
  }

  /** Close for bfcache (pagehide); `resume()` reconnects. */
  suspend() {
    this.clearTimers()
    this.stopPolling()
    this.drop()
  }

  resume() {
    if (!this.stopped && !this.ws) this.connect()
  }

  isOnline() {
    return this.online
  }

  /**
   * Send now if online. Otherwise `queue: true` messages wait for the next
   * welcome (timeline events, control actions); the rest are dropped (an RPC
   * reply only makes sense on the connection that carried the request).
   */
  send(msg: object, queue = false): boolean {
    if (this.online && this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(JSON.stringify(msg))
        return true
      } catch (e) {
        // Fall through to queueing.
      }
    }
    if (queue) {
      this.queue.push(msg)
      if (this.queue.length > QUEUE_LIMIT) this.queue.shift()
    }
    return false
  }

  private setState(state: LinkState) {
    if (this.state === state) return
    this.state = state
    this.opts.onState(state)
  }

  private clearTimers() {
    clearTimeout(this.timer)
    clearTimeout(this.idleTimer)
  }

  private drop() {
    const ws = this.ws
    this.ws = null
    this.online = false
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
      try {
        ws.close(1000)
      } catch (e) {
        // Already closed.
      }
    }
  }

  private connect() {
    if (this.stopped) return
    this.clearTimers()
    this.drop()
    this.setState('connecting')

    let socket: WebSocket
    try {
      const WS = nativeWebSocket()
      socket = new WS(this.opts.wsUrl)
    } catch (e) {
      this.failed()
      return
    }
    this.ws = socket
    let welcomed = false

    const touch = () => {
      clearTimeout(this.idleTimer)
      this.idleTimer = setTimeout(() => {
        // A dead TCP connection may take minutes to report close.
        if (this.ws !== socket) return
        this.drop()
        this.scheduleReconnect()
      }, IDLE_MS)
    }

    socket.onopen = () => {
      touch()
      try {
        socket.send(JSON.stringify(this.opts.hello()))
      } catch (e) {
        // onclose follows.
      }
    }
    socket.onmessage = event => {
      touch()
      let msg: any
      try {
        msg = JSON.parse(String(event.data))
      } catch (e) {
        return
      }
      if (!msg || typeof msg !== 'object') return
      if (msg.t === 'welcome') {
        welcomed = true
        this.online = true
        this.failures = 0
        this.attempt = 0
        this.setState('online')
        this.opts.onMessage(msg)
        this.flush()
        return
      }
      if (msg.t === 'hb') return
      if (msg.t === 'reconnect') {
        this.restart(Math.max(0, Number(msg.afterMs) || 0))
        return
      }
      this.opts.onMessage(msg)
    }
    socket.onclose = event => {
      if (this.ws !== socket) return
      this.ws = null
      this.online = false
      clearTimeout(this.idleTimer)
      if (this.stopped) return
      const code = event && event.code
      if (code === 4401) {
        if (this.opts.onRejected()) this.timer = setTimeout(() => this.connect(), 0)
        else this.backOff('rejected', REJECTED_RETRY_MS)
        return
      }
      if (code === 4429) {
        this.backOff('quota', QUOTA_RETRY_MS)
        return
      }
      if (code === 4409) {
        this.opts.onConflict()
      } else if (!welcomed) {
        this.failures++
      }
      this.scheduleReconnect()
    }
    socket.onerror = () => {
      // onclose follows.
    }
  }

  private failed() {
    this.failures++
    this.scheduleReconnect()
  }

  private scheduleReconnect() {
    if (this.stopped) return
    if (this.failures >= MAX_FAILURES) {
      this.startPolling()
      return
    }
    this.setState('connecting')
    const base = Math.min(30_000, 1000 * Math.pow(2, this.attempt++))
    const delay = base / 2 + Math.random() * (base / 2)
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.connect(), delay)
  }

  /** The gateway refuses us for now: no fast reconnect loop, no polling. */
  private backOff(state: LinkState, ms: number) {
    this.setState(state)
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.connect(), ms * (0.75 + Math.random() * 0.5))
  }

  private flush() {
    const queued = this.queue
    this.queue = []
    for (const msg of queued) this.send(msg, true)
  }

  private startPolling() {
    this.setState('polling')
    if (this.pollTimer) return
    this.polls = 0
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), POLL_MS)
  }

  private stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = undefined
  }

  private retryWebSocket() {
    this.stopPolling()
    this.failures = 0
    this.attempt = 0
    this.connect()
  }

  private poll() {
    if (this.stopped) return
    this.polls++
    if (this.polls > 1 && this.polls % 5 === 1) {
      this.retryWebSocket()
      return
    }
    if (!nativeFetch) return
    nativeFetch(this.opts.presenceUrl, {
      method: 'POST',
      // A "simple" request: no CORS preflight from pages on other origins.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(this.opts.presence()),
      credentials: 'omit',
      cache: 'no-store',
    })
      .then(res => (res.ok ? res.json() : null))
      .then(res => {
        if (!res || this.stopped || !this.pollTimer) return
        this.opts.onPresence(res)
        if (res.connect) this.retryWebSocket()
      })
      .catch(() => {
        // Try again next minute.
      })
  }
}
