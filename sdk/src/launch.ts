import { newId } from '@chobitsu/engine/rwd'

// Which launch of the app this page belongs to, i.e. the session its session
// log records go under. Best first:
//
// 1. The host app's own launch id, generated at every cold start and the same
//    for every webview of that process: run({ launchId }), or a global the
//    host (or the integration snippet) defines, window.RWDLaunchId, as a
//    string or a function returning one (or a Promise of one).
// 2. Inferred: a session cookie (no expiry) lives as long as the app process,
//    so a page that finds it belongs to the same launch. A webview that keeps
//    session cookies across launches is caught by the engine: a session that
//    has been silent for an hour is not resumed.

export interface Launch {
  id: string
  source: 'app' | 'cookie'
}

const COOKIE = 'rwd_launch'
const HOST_WAIT_MS = 300

export async function resolveLaunch(launchId: unknown): Promise<Launch> {
  const fromApp = validId(launchId) || validId(await hostLaunchId())
  if (fromApp) return { id: fromApp, source: 'app' }
  return { id: readCookie() || writeCookie(newId()), source: 'cookie' }
}

/** The engine started a new session instead of the cookie's: remember it. */
export function rememberLaunch(launch: Launch, used: string) {
  if (launch.source === 'cookie' && used !== launch.id) writeCookie(used)
}

async function hostLaunchId(): Promise<unknown> {
  const w = window as any
  const value = w.RWDLaunchId
  if (typeof value !== 'function') return value
  try {
    return await Promise.race([
      Promise.resolve(value()),
      new Promise(resolve => setTimeout(() => resolve(null), HOST_WAIT_MS)),
    ])
  } catch (e) {
    return null
  }
}

function validId(v: unknown): string {
  if (typeof v === 'number' && isFinite(v)) v = String(v)
  return typeof v === 'string' && /^[\w.:-]{4,128}$/.test(v) ? v : ''
}

function readCookie(): string {
  try {
    const m = document.cookie.match(/(?:^|;\s*)rwd_launch=([\w-]{4,64})/)
    return m ? m[1] : ''
  } catch (e) {
    return ''
  }
}

function writeCookie(id: string) {
  try {
    document.cookie = `${COOKIE}=${id}; path=/; SameSite=Lax`
  } catch (e) {
    // Cookies blocked: every page starts its own session.
  }
  return id
}
