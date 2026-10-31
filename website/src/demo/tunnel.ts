// Parent side of the WebSocket tunnel (see public/demo-shop/rwd-shim.js):
// sockets the SDK opens inside the demo iframe arrive here as postMessage
// frames and are handed to the mock gateway as connections.

import type { Conn, MockGateway } from './gateway'

interface Entry {
  conn: Conn
  source: Window
}

export class Tunnel {
  private entries = new Map<string, Entry>()
  private gateway: MockGateway | null = null

  constructor(private frame: HTMLIFrameElement) {
    window.addEventListener('message', this.onMessage)
  }

  /** Route new sockets to this gateway (null: refuse them). Existing ones are dropped. */
  use(gateway: MockGateway | null) {
    this.gateway = gateway
    for (const [cid, e] of this.entries) {
      this.post(e.source, { op: 'close', cid, code: 1001, reason: 'gateway restarted' })
      e.conn.onClose?.()
    }
    this.entries.clear()
  }

  destroy() {
    this.use(null)
    window.removeEventListener('message', this.onMessage)
  }

  private post(target: Window, msg: object) {
    try {
      target.postMessage({ __rwd: 'ws', ...msg }, location.origin)
    } catch {
      // The frame went away.
    }
  }

  private onMessage = (event: MessageEvent) => {
    if (event.origin !== location.origin) return
    if (!this.frame.contentWindow || event.source !== this.frame.contentWindow) return
    const msg = event.data
    if (!msg || msg.__rwd !== 'ws' || typeof msg.cid !== 'string') return
    const source = event.source as Window
    const cid: string = msg.cid
    if (msg.op === 'open') {
      const gw = this.gateway
      if (!gw || gw.disposed) {
        this.post(source, { op: 'close', cid, code: 1006, reason: 'no gateway' })
        return
      }
      let url: URL | null = null
      try {
        url = new URL(String(msg.url))
      } catch {
        // Refused below.
      }
      if (!url || !url.pathname.endsWith('/v1/page')) {
        this.post(source, { op: 'close', cid, code: 1006, reason: 'unknown endpoint' })
        return
      }
      let closed = false
      const conn: Conn = {
        id: cid,
        onMessage: null,
        onClose: null,
        send: (m: object) => {
          if (!closed) this.post(source, { op: 'message', cid, data: JSON.stringify(m) })
        },
        close: (code: number, reason: string) => {
          if (closed) return
          closed = true
          this.entries.delete(cid)
          this.post(source, { op: 'close', cid, code, reason })
          // Like a server-side close: the gateway sees its own close too.
          queueMicrotask(() => conn.onClose?.())
        },
      }
      this.entries.set(cid, { conn, source })
      this.post(source, { op: 'open', cid })
      gw.accept(conn, url.href)
      return
    }
    const entry = this.entries.get(cid)
    if (!entry) return
    if (msg.op === 'send') {
      let data: any
      try {
        data = JSON.parse(String(msg.data))
      } catch {
        return
      }
      entry.conn.onMessage?.(data)
    } else if (msg.op === 'close') {
      this.entries.delete(cid)
      entry.conn.onClose?.()
    }
  }
}
