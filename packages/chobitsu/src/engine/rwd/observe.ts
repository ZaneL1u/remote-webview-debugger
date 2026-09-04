import * as Runtime from '../../domains/Runtime'
import * as Network from '../../domains/Network'
import connector from '../../lib/connector'
import * as objManager from '../../lib/objManager'
import { BUFFER_LIMIT } from '../eventBuffer'
import { BODY_ENTRY_LIMIT } from '../bodyCache'
import { scrub, scrubPatterns } from '../privacy'
import { rwdError } from './errors'
import { agentText } from './i18n'
import { logRecord } from './coldlog'

// Console, errors and network for the agent. chobitsu's Runtime and Network
// domains do the hooking (console.*, uncaught errors, XHR, fetch, WebSocket,
// sendBeacon, EventSource) from the moment the SDK loads; we enable them right
// away, turn their CDP events into compact text entries and let go of the
// objects they pinned, so the page keeps no extra references. Entries live in
// bounded ring buffers: when full, plain logs (successful requests) go first,
// errors and warnings (failed requests) are kept as long as possible.

export type EventKind = 'nav' | 'error' | 'net_fail' | 'user_tap' | 'console_error'
export type EmitEvent = (kind: EventKind, summary: string) => void

export interface ConsoleEntry {
  id: number
  type: string
  text: string
  at: number
  source?: string
}

export interface NetworkEntry {
  id: number
  method: string
  url: string
  status: number
  type: string
  durationMs: number | null
  size: number
  error?: string
  at: number
}

interface NetworkRecord extends NetworkEntry {
  requestId: string
  start: number
  reqHeaders: { [name: string]: string }
  resHeaders: { [name: string]: string }
  postData?: string
  /** Written to the session log (once, when it ends). */
  logged?: boolean
}

const TEXT_LIMIT = 4000
const DEFAULT_LIMIT = 100

class Ring<T> {
  items: T[] = []
  dropped = 0
  constructor(private important: (item: T) => boolean, private limit = BUFFER_LIMIT) {}
  /** Adds an item; returns the one dropped to make room, if any. */
  push(item: T): T | undefined {
    this.items.push(item)
    if (this.items.length <= this.limit) return undefined
    let index = this.items.findIndex(it => !this.important(it))
    if (index < 0) index = 0
    this.dropped++
    return this.items.splice(index, 1)[0]
  }
}

const consoleRing = new Ring<ConsoleEntry>(
  it => it.type === 'error' || it.type === 'warn'
)
const networkRing = new Ring<NetworkRecord>(it => isFailed(it))
const byRequestId: { [id: string]: NetworkRecord } = {}
let consoleSeq = 0
let networkSeq = 0
let emit: EmitEvent = () => {}
let started = false

/** Start collecting; safe to call more than once. */
export function startObserving(onEvent: EmitEvent) {
  emit = onEvent
  if (started) return
  started = true
  connector.on('message', (raw: string) => {
    let msg: { method: string; params: any }
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      return
    }
    try {
      if (msg.method.indexOf('Network.') === 0) onNetwork(msg.method, msg.params)
      else onRuntime(msg.method, msg.params)
    } catch (e) {
      // Never let our bookkeeping break the page's console or requests.
    } finally {
      release(msg.params, 0)
    }
  })
  Runtime.enable()
  Network.enable()
}

/* --------------------------------- console -------------------------------- */

const CONSOLE_TYPES: { [cdp: string]: string } = {
  log: 'log',
  info: 'info',
  debug: 'debug',
  error: 'error',
  warning: 'warn',
  dir: 'log',
  table: 'log',
  trace: 'log',
  startGroup: 'log',
  startGroupCollapsed: 'log',
}

function onRuntime(method: string, params: any) {
  if (method === 'Runtime.consoleAPICalled') {
    const type = CONSOLE_TYPES[params.type]
    if (!type) return
    let text = formatArgs(params.args || [])
    if (params.type === 'startGroup' || params.type === 'startGroupCollapsed') {
      text = '▸ ' + text
    }
    addConsole(type, text, 'console', params.timestamp)
    if (type === 'error') emit('console_error', firstLine(text, 200))
  } else if (method === 'Runtime.exceptionThrown') {
    const details = params.exceptionDetails || {}
    const text = formatError(live(details.exception || {}))
    addConsole('error', 'Uncaught ' + text, 'exception', Date.now())
    emit('error', firstLine(text, 300))
  }
}

function addConsole(type: string, text: string, source: string, at?: number) {
  text = scrub(text)
  if (text.length > TEXT_LIMIT) text = text.slice(0, TEXT_LIMIT) + '…'
  logRecord('console', { type, text, source }, type === 'error' || type === 'warn')
  consoleRing.push({
    id: ++consoleSeq,
    type,
    text,
    at: Math.round(typeof at === 'number' ? at : Date.now()),
    source,
  })
}

export function queryConsole(params: any = {}) {
  const types: string[] | undefined = Array.isArray(params.types) ? params.types : undefined
  // Patterns again: the project's rules may arrive after the text was captured.
  const messages = select(consoleRing.items, params, it => !types || types.indexOf(it.type) >= 0).map(it => {
    const copy = { ...it }
    copy.text = scrubPatterns(it.text)
    return copy
  })
  return { messages, dropped: consoleRing.dropped }
}

/* --------------------------------- network -------------------------------- */

const NETWORK_TYPES: { [cdp: string]: string } = {
  XHR: 'xhr',
  Fetch: 'fetch',
  Ping: 'beacon',
  EventSource: 'eventsource',
}

function isFailed(it: NetworkEntry) {
  return !!it.error || it.status >= 400
}

function onNetwork(method: string, p: any) {
  if (method === 'Network.requestWillBeSent' || method === 'Network.webSocketCreated') {
    const ws = method === 'Network.webSocketCreated'
    const request = p.request || {}
    const start = typeof p.timestamp === 'number' ? p.timestamp * 1000 : Date.now()
    const record: NetworkRecord = {
      id: ++networkSeq,
      method: ws ? 'GET' : String(request.method || 'GET').toUpperCase(),
      url: String(ws ? p.url : request.url),
      status: 0,
      type: ws ? 'websocket' : NETWORK_TYPES[p.type] || String(p.type || 'other').toLowerCase(),
      durationMs: null,
      size: 0,
      at: Math.round(start),
      requestId: p.requestId,
      start,
      reqHeaders: plainHeaders(request.headers),
      resHeaders: {},
    }
    if (typeof request.postData === 'string') record.postData = request.postData
    byRequestId[p.requestId] = record
    const dropped = networkRing.push(record)
    if (dropped) delete byRequestId[dropped.requestId]
    return
  }

  const record = byRequestId[p.requestId]
  if (!record) return
  const end = typeof p.timestamp === 'number' ? p.timestamp * 1000 : Date.now()
  switch (method) {
    case 'Network.responseReceivedExtraInfo':
      record.resHeaders = plainHeaders(p.headers)
      break
    case 'Network.responseReceived':
      record.status = (p.response && p.response.status) || 0
      if (p.response && p.response.headers) record.resHeaders = plainHeaders(p.response.headers)
      record.durationMs = Math.max(0, Math.round(end - record.start))
      if (record.status >= 400 && !isExcluded(record.url)) emit('net_fail', `${record.method} ${shortUrl(record.url)} → ${record.status}`)
      break
    case 'Network.loadingFinished':
      record.size = p.encodedDataLength || 0
      record.durationMs = Math.max(0, Math.round(end - record.start))
      logNetwork(record)
      break
    case 'Network.loadingFailed': {
      const error = p.errorText || agentText().requestFailed
      record.error = error
      record.durationMs = Math.max(0, Math.round(end - record.start))
      if (!isExcluded(record.url)) emit('net_fail', agentText().netFailed(`${record.method} ${shortUrl(record.url)}`, error))
      logNetwork(record)
      break
    }
    case 'Network.webSocketHandshakeResponseReceived':
      record.status = 101
      break
    case 'Network.webSocketClosed':
      record.durationMs = Math.max(0, Math.round(end - record.start))
      logNetwork(record)
      break
    case 'Network.webSocketFrameError':
      if (!record.error) {
        record.error = p.errorMessage || 'WebSocket error'
        if (!isExcluded(record.url)) emit('net_fail', agentText().wsFailed(shortUrl(record.url)))
      }
      break
  }
}

function publicEntry(r: NetworkRecord): NetworkEntry {
  const entry: NetworkEntry = {
    id: r.id,
    method: r.method,
    url: scrubPatterns(r.url),
    status: r.status,
    type: r.type,
    durationMs: r.durationMs,
    size: r.size,
    at: r.at,
  }
  if (r.error) entry.error = r.error
  return entry
}

export function queryNetwork(params: any = {}) {
  const failedOnly = !!params.failedOnly
  const extra = toMatchers(params.exclude)
  const all = !!params.includeExcluded
  let hidden = 0
  const requests = select(networkRing.items, params, it => {
    if (failedOnly && !isFailed(it)) return false
    if (!all && (isExcluded(it.url) || matchesAny(extra, it.url))) {
      hidden++
      return false
    }
    return true
  }).map(publicEntry)
  return { requests, dropped: networkRing.dropped, hidden }
}

/* ------------------------------ exclude rules ----------------------------- */

// Requests the agent does not want to wade through (fonts that always 404,
// analytics beacons): left out of list_network_requests and of the timeline's
// net_fail events, still recorded. Rules come from the project policy and
// run({ networkExclude }); each is a case-insensitive substring of the URL, a
// `*` wildcard pattern, or /regex/.

type Matcher = (url: string) => boolean

let excludeRules: Matcher[] = []

export function setNetworkExclude(rules: unknown) {
  excludeRules = toMatchers(rules)
}

function isExcluded(url: string) {
  return matchesAny(excludeRules, url)
}

function matchesAny(rules: Matcher[], url: string) {
  for (let i = 0; i < rules.length; i++) if (rules[i](url)) return true
  return false
}

function toMatchers(rules: unknown): Matcher[] {
  if (typeof rules === 'string') rules = [rules]
  if (!Array.isArray(rules)) return []
  const out: Matcher[] = []
  for (const raw of rules) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const rule = raw.trim()
    let re: RegExp | null = null
    try {
      if (rule.length > 2 && rule[0] === '/' && rule.lastIndexOf('/') > 0) {
        const end = rule.lastIndexOf('/')
        re = new RegExp(rule.slice(1, end), rule.slice(end + 1) || 'i')
      } else if (rule.indexOf('*') >= 0) {
        re = new RegExp(rule.split('*').map(escapeRegExp).join('.*'), 'i')
      }
    } catch {
      continue // an invalid regex excludes nothing
    }
    if (re) {
      const r = re
      out.push(url => r.test(url))
    } else {
      const needle = rule.toLowerCase()
      out.push(url => url.toLowerCase().indexOf(needle) >= 0)
    }
  }
  return out
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const REDACTED_HEADERS = /^(cookie|set-cookie|authorization|proxy-authorization)$/i

function redact(headers: { [name: string]: string }) {
  const out: { [name: string]: string } = {}
  for (const name in headers) {
    out[name] = REDACTED_HEADERS.test(name) ? '••••' : headers[name]
  }
  return out
}

function clip(body: string) {
  body = scrub(body)
  return body.length > BODY_ENTRY_LIMIT ? body.slice(0, BODY_ENTRY_LIMIT) + '…' : body
}

/** A finished request for the session log; failed ones with headers and bodies. */
function logNetwork(record: NetworkRecord) {
  if (record.logged) return
  record.logged = true
  const failed = isFailed(record)
  const data: { [key: string]: any } = {
    id: record.id,
    method: record.method,
    url: scrubPatterns(record.url),
    status: record.status,
    type: record.type,
    durationMs: record.durationMs,
    size: record.size,
  }
  if (record.error) data.error = record.error
  if (failed) {
    data.reqHeaders = redact(record.reqHeaders)
    data.resHeaders = redact(record.resHeaders)
    if (record.postData) data.reqBody = clip(record.postData)
    try {
      const body = Network.getResponseBody({ requestId: record.requestId }).body
      if (typeof body === 'string' && body) data.resBody = clip(body)
    } catch (e) {
      // No body cached.
    }
  }
  logRecord('net', data, failed)
}

/** Whether the exclude rules (plus `extra`) hide a request URL. */
export function networkHidden(url: string, extra?: unknown) {
  return isExcluded(url) || (!!extra && matchesAny(toMatchers(extra), url))
}

export function networkDetail(params: any = {}) {
  const id = Number(params.id)
  let record: NetworkRecord | undefined
  for (const it of networkRing.items) if (it.id === id) record = it
  if (!record) throw rwdError('not_found', agentText().noSuchRequest(String(params.id)))

  const request: { headers: { [name: string]: string }; body?: string } = {
    headers: redact(record.reqHeaders),
  }
  if (record.postData) request.body = clip(record.postData)
  const response: { headers: { [name: string]: string }; body?: string } = {
    headers: redact(record.resHeaders),
  }
  const body = Network.getResponseBody({ requestId: record.requestId }).body
  if (typeof body === 'string' && body) response.body = clip(body)
  return { request, response }
}

/* --------------------------------- helpers -------------------------------- */

function select<T extends { id: number }>(items: T[], params: any, match: (it: T) => boolean): T[] {
  const sinceId = typeof params.sinceId === 'number' ? params.sinceId : Number(params.sinceId)
  const hasSince = params.sinceId !== undefined && params.sinceId !== null && !isNaN(sinceId)
  let limit = Number(params.limit) || DEFAULT_LIMIT
  limit = Math.max(1, Math.min(BUFFER_LIMIT, limit))
  const list = items.filter(it => (!hasSince || it.id > sinceId) && match(it))
  // Paging forward from sinceId returns the oldest first; otherwise the latest.
  return hasSince ? list.slice(0, limit) : list.slice(-limit)
}

function plainHeaders(headers: any): { [name: string]: string } {
  const out: { [name: string]: string } = {}
  if (!headers || typeof headers !== 'object') return out
  if (Array.isArray(headers)) {
    for (const pair of headers) if (pair && pair.length >= 2) out[String(pair[0])] = String(pair[1])
    return out
  }
  for (const name in headers) {
    if (typeof headers[name] !== 'function') out[name] = String(headers[name])
  }
  return out
}

function shortUrl(url: string) {
  try {
    const u = new URL(url, location.href)
    return u.origin === location.origin ? u.pathname : u.host + u.pathname
  } catch (e) {
    return url.split('?')[0]
  }
}

function firstLine(text: string, max: number) {
  const line = text.split('\n')[0]
  return line.length > max ? line.slice(0, max) + '…' : line
}

/** Release every objectId the event pinned in objManager. */
function release(value: any, depth: number) {
  if (!value || typeof value !== 'object' || depth > 6) return
  if (typeof value.objectId === 'string') {
    try {
      objManager.releaseObj(value.objectId)
    } catch (e) {
      // Already released.
    }
  }
  for (const key in value) release(value[key], depth + 1)
}

/** The live value behind a RemoteObject (still pinned while we format it). */
function live(ro: any): any {
  if (!ro || typeof ro !== 'object') return ro
  if (typeof ro.objectId === 'string') {
    const obj = objManager.getObj(ro.objectId)
    if (obj !== undefined) return obj
  }
  if ('value' in ro) return ro.value
  if (ro.unserializableValue) return ro.unserializableValue
  if (ro.type === 'undefined') return undefined
  return ro.description
}

function formatArgs(args: any[]): string {
  const values = args.map(live)
  const parts: string[] = []
  let i = 0
  if (typeof values[0] === 'string' && values[0].indexOf('%') >= 0) {
    i = 1
    parts.push(
      values[0].replace(/%([sdifoOc%])/g, (m: string, f: string) => {
        if (f === '%') return '%'
        if (i >= values.length) return m
        const v = values[i++]
        switch (f) {
          case 's':
            return typeof v === 'string' ? v : formatValue(v, 1)
          case 'd':
          case 'i':
            return String(parseInt(v, 10))
          case 'f':
            return String(parseFloat(v))
          case 'c':
            return ''
          default:
            return formatValue(v, 1)
        }
      })
    )
  }
  for (; i < values.length; i++) {
    parts.push(typeof values[i] === 'string' ? values[i] : formatValue(values[i], 0))
  }
  return parts.join(' ')
}

function formatError(err: any): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const head = `${err.name || 'Error'}: ${err.message}`
    let stack = typeof err.stack === 'string' ? err.stack : ''
    // V8 stacks start with the message; WebKit stacks are frames only.
    if (stack.indexOf(head) === 0) stack = stack.slice(head.length)
    const frames = stack
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => !!l)
      .slice(0, 10)
    return frames.length ? head + '\n    ' + frames.join('\n    ') : head
  }
  return '(in promise) ' + formatValue(err, 0)
}

function formatValue(v: any, depth: number, seen: any[] = []): string {
  const type = typeof v
  if (v === null) return 'null'
  if (type === 'undefined') return 'undefined'
  if (type === 'string') return depth ? JSON.stringify(v.length > 200 ? v.slice(0, 200) + '…' : v) : v
  if (type === 'number' || type === 'boolean' || type === 'symbol') return String(v)
  if (type === 'bigint') return String(v) + 'n'
  if (type === 'function') return `ƒ ${v.name || 'anonymous'}()`
  try {
    if (v instanceof Error) return depth ? `${v.name}: ${v.message}` : formatError(v)
    if (typeof Element !== 'undefined' && v instanceof Element) return describeElement(v)
    if (typeof Node !== 'undefined' && v instanceof Node) return `#${v.nodeName.toLowerCase()}`
    if (v instanceof Date) return isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString()
    if (v instanceof RegExp) return String(v)
    if (seen.indexOf(v) >= 0) return '[Circular]'
    if (depth > 2) return Array.isArray(v) ? `Array(${v.length})` : '{…}'
    seen.push(v)
    const items: string[] = []
    const MAX = 20
    if (Array.isArray(v)) {
      for (let i = 0; i < Math.min(v.length, MAX); i++) items.push(formatValue(v[i], depth + 1, seen))
      if (v.length > MAX) items.push(`…${v.length - MAX} more`)
      return `[${items.join(', ')}]`
    }
    if (typeof Map !== 'undefined' && v instanceof Map) {
      v.forEach((val: any, key: any) => {
        if (items.length < MAX) items.push(`${formatValue(key, depth + 1, seen)} => ${formatValue(val, depth + 1, seen)}`)
      })
      return `Map(${v.size}) {${items.join(', ')}}`
    }
    if (typeof Set !== 'undefined' && v instanceof Set) {
      v.forEach((val: any) => {
        if (items.length < MAX) items.push(formatValue(val, depth + 1, seen))
      })
      return `Set(${v.size}) {${items.join(', ')}}`
    }
    const keys = Object.keys(v)
    for (let i = 0; i < Math.min(keys.length, MAX); i++) {
      let val: string
      try {
        val = formatValue(v[keys[i]], depth + 1, seen)
      } catch (e) {
        val = '(…)'
      }
      items.push(`${keys[i]}: ${val}`)
    }
    if (keys.length > MAX) items.push('…')
    const ctor = v.constructor && v.constructor.name
    const prefix = ctor && ctor !== 'Object' ? ctor + ' ' : ''
    return `${prefix}{${items.join(', ')}}`
  } catch (e) {
    return Object.prototype.toString.call(v)
  }
}

function describeElement(el: Element) {
  let s = el.tagName.toLowerCase()
  if (el.id) s += '#' + el.id
  const cls = typeof el.className === 'string' ? el.className.trim() : ''
  if (cls) s += '.' + cls.split(/\s+/).join('.')
  return `<${s}>`
}
