import chobitsu from '../index'
import * as objManager from '../lib/objManager'
import * as Overlay from '../domains/Overlay'
import * as Page from '../domains/Page'
import { MAIN_FRAME_ID } from '../lib/constants'
import { history, retainObjects } from './rwd/observe'
import { agentText } from './rwd/i18n'

// Chrome DevTools for people (docs/protocol.md §17): the console embeds the
// DevTools frontend and the gateway relays its CDP messages to this page,
// one session per open DevTools window. chobitsu is a single CDP endpoint, so
// this bridge multiplexes it:
//
//   - command ids are rewritten to be unique across sessions and the answer
//     goes back to the session that asked, with its own id;
//   - events go to every open session (the gateway fans them out);
//   - Runtime / Network stay enabled for the agent's collection from load, so
//     their enable is answered here (with what happened before: console text
//     and the recent requests) and no session can disable them; other
//     domains' disable is a no-op while another session may still use them.

export type Send = (session: string | null, message: string) => void

interface Pending {
  session: string
  id: number | string
}

// The page's one execution context, as domains/Runtime.ts announces it.
const mainContext = { id: 1, name: 'top', origin: location.origin }

const sessions: { [id: string]: true } = {}
const pending: { [id: number]: Pending } = {}
let nextId = 1
let send: Send = () => {}
let installed = false

function install() {
  if (installed) return
  installed = true
  chobitsu.setOnMessage((message: string) => {
    if (!count()) return
    // Answers look like {"id":…}; everything else is an event.
    if (message.slice(0, 6) === '{"id":') {
      let parsed: any
      try {
        parsed = JSON.parse(message)
      } catch (e) {
        return
      }
      const p = pending[parsed.id]
      if (!p) return
      delete pending[parsed.id]
      parsed.id = p.id
      if (sessions[p.session]) send(p.session, JSON.stringify(parsed))
      return
    }
    send(null, message)
  })
}

function count() {
  let n = 0
  for (const _ in sessions) n++
  return n
}

export function sessionCount() {
  return count()
}

/** Sets where messages for the gateway go: a session's answers, or (null) events for all. */
export function setSender(fn: Send) {
  send = fn
}

export function openSession(id: string) {
  install()
  sessions[id] = true
  retainObjects(true)
}

export function closeSession(id: string) {
  if (!sessions[id]) return
  delete sessions[id]
  for (const key in pending) if (pending[key].session === id) delete pending[key]
  if (count()) return
  // The last DevTools window is gone: hide what it left on the page and let
  // go of the objects it was handed.
  retainObjects(false)
  try {
    Overlay.disable()
  } catch (e) {
    // ignore
  }
  try {
    Page.stopScreencast()
  } catch (e) {
    // ignore
  }
  objManager.clear()
}

export function closeAll() {
  for (const id in sessions) closeSession(id)
}

function reply(session: string, id: number | string, result: any) {
  send(session, JSON.stringify({ id, result }))
}

function event(session: string, method: string, params: any) {
  send(session, JSON.stringify({ method, params }))
}

/** A CDP command from a session's DevTools frontend. */
export function handle(session: string, raw: string) {
  if (!sessions[session]) return
  let msg: { id: number | string; method: string; params?: any }
  try {
    msg = JSON.parse(raw)
  } catch (e) {
    return
  }
  if (!msg || typeof msg.method !== 'string') return
  const method = msg.method
  if (method === 'Runtime.enable') {
    reply(session, msg.id, {})
    event(session, 'Runtime.executionContextCreated', { context: mainContext })
    replayConsole(session)
    return
  }
  if (method === 'Network.enable') {
    reply(session, msg.id, {})
    replayNetwork(session)
    return
  }
  if (/\.disable$/.test(method)) {
    // Runtime / Network feed the agent; the rest may serve another session.
    // closeSession cleans up after the last one.
    reply(session, msg.id, {})
    return
  }
  const id = nextId++
  pending[id] = { session, id: msg.id }
  chobitsu.sendRawMessage(JSON.stringify({ id, method, params: msg.params || {} }))
}

/* --------------------------------- history -------------------------------- */

const CONSOLE_TYPE: { [rwd: string]: string } = {
  log: 'log',
  info: 'info',
  debug: 'debug',
  warn: 'warning',
  error: 'error',
}

function replayConsole(session: string) {
  const h = history()
  if (!h.console.length) return
  event(session, 'Runtime.consoleAPICalled', {
    type: 'info',
    args: [
      {
        type: 'string',
        value: agentText().devtoolsHistory(h.console.length, h.dropped),
      },
    ],
    executionContextId: mainContext.id,
    timestamp: h.console[0].at,
  })
  for (const it of h.console) {
    event(session, 'Runtime.consoleAPICalled', {
      type: CONSOLE_TYPE[it.type] || 'log',
      args: [{ type: 'string', value: it.text }],
      executionContextId: mainContext.id,
      timestamp: it.at,
    })
  }
}

function contentType(headers: { [name: string]: string }) {
  for (const name in headers) {
    if (name.toLowerCase() === 'content-type') return headers[name].split(';')[0].trim()
  }
  return ''
}

function replayNetwork(session: string) {
  for (const r of history().network) {
    const start = r.start / 1000
    const request: any = { url: r.url, method: r.method, headers: r.reqHeaders }
    if (r.postData !== undefined) request.postData = r.postData
    event(session, 'Network.requestWillBeSent', {
      requestId: r.requestId,
      documentURL: location.href,
      frameId: MAIN_FRAME_ID,
      type: r.type,
      request,
      timestamp: start,
      wallTime: start,
      initiator: { type: 'other' },
    })
    const end = r.durationMs === null ? start : (r.start + r.durationMs) / 1000
    if (r.status) {
      event(session, 'Network.responseReceived', {
        requestId: r.requestId,
        type: r.type,
        timestamp: end,
        response: { url: r.url, status: r.status, statusText: '', headers: r.resHeaders, mimeType: contentType(r.resHeaders) },
      })
    }
    if (r.error) {
      event(session, 'Network.loadingFailed', { requestId: r.requestId, type: r.type, timestamp: end, errorText: r.error })
    } else if (r.durationMs !== null) {
      event(session, 'Network.loadingFinished', { requestId: r.requestId, timestamp: end, encodedDataLength: r.size })
    }
  }
}
