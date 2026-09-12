// Device and page identity (docs/protocol.md §2).
//
//   deviceId  UUID v4, localStorage `rwd:device` (opts.deviceId wins)
//   pageId    12 base62, sessionStorage `rwd:page`: kept across reloads and
//             navigations in the same tab, new for every new tab
//   openerId  pageId of the tab that opened this one, best effort
//
// Device token (§3.5): deviceToken (localStorage `rwd:dtoken`, issued by the
// gateway for this deviceId), resume (sessionStorage `rwd:resume`, rotated by
// every welcome, bound to the pageId) and the one-time invite from the URL.

const DEVICE_KEY = 'rwd:device'
const PAGE_KEY = 'rwd:page'
const OPENER_KEY = 'rwd:opener'
const TAP_KEY = 'rwd:lastTap'
export const TOKEN_KEY = 'rwd:dtoken'
const RESUME_KEY = 'rwd:resume'
const INVITE_KEY = 'rwd:invite'
const INVITE_PARAM = 'rwd_invite'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function randomBytes(n: number): number[] {
  const out: number[] = []
  const c = (window as any).crypto
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(n)
    c.getRandomValues(buf)
    for (let i = 0; i < n; i++) out.push(buf[i])
  } else {
    for (let i = 0; i < n; i++) out.push(Math.floor(Math.random() * 256))
  }
  return out
}

export function base62(length: number) {
  let s = ''
  while (s.length < length) {
    for (const b of randomBytes(length)) {
      // Rejection sampling keeps the distribution uniform.
      if (b < 248 && s.length < length) s += BASE62[b % 62]
    }
  }
  return s
}

export function uuid(): string {
  const c = (window as any).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = b.map(x => (x + 0x100).toString(16).slice(1)).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type Kind = 'localStorage' | 'sessionStorage'

export function read(kind: Kind, key: string): string | null {
  try {
    return window[kind].getItem(key)
  } catch (e) {
    return null
  }
}

export function write(kind: Kind, key: string, value: string | null) {
  try {
    if (value === null) window[kind].removeItem(key)
    else window[kind].setItem(key, value)
  } catch (e) {
    // Storage disabled (private mode, sandboxed webview): identity is per load.
  }
}

export interface Identity {
  deviceId: string
  pageId: string
  openerId: string | null
}

export function deviceIdFor(override?: string): string {
  if (override) {
    // The token belongs to the deviceId it was issued for.
    if (read('localStorage', DEVICE_KEY) !== override) write('localStorage', TOKEN_KEY, null)
    write('localStorage', DEVICE_KEY, override)
    return override
  }
  let id = read('localStorage', DEVICE_KEY)
  if (!id) {
    id = uuid()
    write('localStorage', DEVICE_KEY, id)
  }
  return id
}

function openerPageId(): string | null {
  try {
    const opener = window.opener
    // Cross-origin openers throw on access; that is fine.
    if (opener && opener !== window) return opener.sessionStorage.getItem(PAGE_KEY)
  } catch (e) {
    // Not same-origin.
  }
  return null
}

export function resolveIdentity(deviceOverride?: string): Identity {
  const deviceId = deviceIdFor(deviceOverride)
  const fromOpener = openerPageId()
  let pageId = read('sessionStorage', PAGE_KEY)
  // A tab opened with window.open() starts with a copy of the opener's
  // sessionStorage, pageId included.
  if (pageId && fromOpener && pageId === fromOpener) pageId = null
  if (!pageId) {
    pageId = base62(12)
    let openerId = fromOpener
    if (!openerId) {
      // target=_blank links are noopener nowadays: fall back to "a tab of this
      // site was tapped a moment ago".
      try {
        const last = JSON.parse(read('localStorage', TAP_KEY) || 'null')
        if (last && typeof last.p === 'string' && Date.now() - last.t < 5000) openerId = last.p
      } catch (e) {
        // Ignore malformed data.
      }
    }
    write('sessionStorage', PAGE_KEY, pageId)
    write('sessionStorage', OPENER_KEY, openerId || '')
  }
  return { deviceId, pageId, openerId: read('sessionStorage', OPENER_KEY) || fromOpener || null }
}

/** Remember that this page was just tapped (for the opener heuristic). */
export function noteTap(pageId: string) {
  write('localStorage', TAP_KEY, JSON.stringify({ p: pageId, t: Date.now() }))
}

/**
 * A duplicated tab (browser "Duplicate", or a sessionStorage copy we could not
 * detect above) shares our pageId with a live tab. Ask the other tabs of this
 * origin; if one answers, take a new pageId and treat that tab as the opener.
 * The channel stays open to answer later tabs, except while the page sits in
 * the back/forward cache.
 */
export function ensureUniquePage(identity: Identity): Promise<void> {
  const BC = (window as any).BroadcastChannel
  if (typeof BC !== 'function') return Promise.resolve()
  const me = base62(8)
  let taken = false
  let channel: BroadcastChannel | null = null

  const open = () => {
    try {
      channel = new BC('rwd:pages') as BroadcastChannel
    } catch (e) {
      channel = null
      return
    }
    const ch = channel
    ch.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (!m || typeof m !== 'object') return
      if (m.t === 'probe' && m.page === identity.pageId && m.from !== me) {
        ch.postMessage({ t: 'taken', page: m.page, to: m.from })
      } else if (m.t === 'taken' && m.to === me) {
        taken = true
      }
    }
  }
  open()
  if (!channel) return Promise.resolve()
  window.addEventListener('pagehide', () => {
    if (channel) channel.close()
    channel = null
  })
  window.addEventListener('pageshow', e => {
    if (e.persisted && !channel) open()
  })

  ;(channel as BroadcastChannel).postMessage({ t: 'probe', page: identity.pageId, from: me })
  return new Promise(resolve =>
    setTimeout(() => {
      if (taken) {
        identity.openerId = identity.pageId
        identity.pageId = base62(12)
        write('sessionStorage', PAGE_KEY, identity.pageId)
        write('sessionStorage', OPENER_KEY, identity.openerId)
      }
      resolve()
    }, 60)
  )
}

/** The resume value of the last welcome, if it was issued to this pageId. */
export function readResume(pageId: string): string | null {
  try {
    const saved = JSON.parse(read('sessionStorage', RESUME_KEY) || 'null')
    if (saved && saved.p === pageId && typeof saved.r === 'string') return saved.r
  } catch (e) {
    // Ignore malformed data.
  }
  return null
}

export function writeResume(pageId: string, resume: string | null) {
  write('sessionStorage', RESUME_KEY, resume ? JSON.stringify({ p: pageId, r: resume }) : null)
}

/** The gateway refused our pageId + resume (close 4409): start over as a new page. */
export function renewPageId(identity: Identity) {
  identity.pageId = base62(12)
  write('sessionStorage', PAGE_KEY, identity.pageId)
  writeResume(identity.pageId, null)
}

/**
 * The invite token of `?rwd_invite=…`: taken out of the address bar right
 * away (history.replaceState, same document) and kept for this tab until a
 * welcome confirms the gateway got it.
 */
export function takeInvite(): string | null {
  try {
    const url = new URL(location.href)
    const token = url.searchParams.get(INVITE_PARAM)
    if (token !== null) {
      url.searchParams.delete(INVITE_PARAM)
      history.replaceState(history.state, '', url.href)
      if (token) write('sessionStorage', INVITE_KEY, token)
    }
  } catch (e) {
    // No URL / history support: no invite.
  }
  return read('sessionStorage', INVITE_KEY)
}

export function clearInvite() {
  write('sessionStorage', INVITE_KEY, null)
}
