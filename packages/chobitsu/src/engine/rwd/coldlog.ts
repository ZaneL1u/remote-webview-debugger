import { rwdError } from './errors'
import { agentText } from './i18n'

// The session log: everything that happened on this origin since the app was
// launched, kept in IndexedDB so an agent that attaches later can read the
// whole way to a bug (pages, the user's and the agent's actions, console,
// network with the bodies of failed requests). It is recorded whether or not
// a gateway is reachable and never leaves the device unless an attached agent
// reads it.
//
// A session is one launch of the app (see the SDK's launch id). The last
// KEEP_SESSIONS sessions are kept, each within SESSION_CAP bytes: past that,
// plain console logs and successful requests go first.

export type LogKind = 'page' | 'action' | 'agent' | 'control' | 'console' | 'net'

export interface LogRecord {
  seq?: number
  session: string
  at: number
  kind: LogKind
  /** The SDK page id of the page that wrote it. */
  page: string
  /** 1: errors, failed requests, actions; kept longest. */
  imp: 0 | 1
  size: number
  data: { [key: string]: any }
}

export interface SessionMeta {
  id: string
  /** 'app': launch id from the host app; 'cookie': inferred by the SDK. */
  source: string
  startedAt: number
  lastAt: number
  bytes: number
  /** Records dropped to stay within SESSION_CAP. */
  trimmed: number
  counts: { [kind: string]: number }
}

const DB_NAME = 'rwd-log'
const KEEP_SESSIONS = 3
export const SESSION_CAP = 10 * 1024 * 1024
const SMALL_QUOTA = 64 * 1024 * 1024 // below this, only the current session is kept
const PENDING_LIMIT = 2000 // records waiting for start() or a flush
const FLUSH_MS = 1000
const HEARTBEAT_MS = 10_000
/** A cookie session silent this long belongs to an earlier launch. */
export const LAUNCH_GAP = 60 * 60 * 1000

let state: 'waiting' | 'on' | 'off' = 'waiting'
let session = ''
let pageId = ''
let pending: LogRecord[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined
let heartbeat: ReturnType<typeof setInterval> | undefined
let dbPromise: Promise<IDBDatabase | null> | null = null
// The open database once known, so a flush on page hide starts its
// transaction synchronously, before the page goes away.
let openedDb: IDBDatabase | null = null

/* --------------------------------- writing -------------------------------- */

/**
 * Note something for the session log. Before start() records wait in memory
 * (load errors, the first requests); after stop() they are dropped.
 */
export function logRecord(kind: LogKind, data: LogRecord['data'], important = false) {
  if (state === 'off') return
  let size = 64
  try {
    size += JSON.stringify(data).length
  } catch (e) {
    return
  }
  pending.push({ session, at: Date.now(), kind, page: pageId, imp: important ? 1 : 0, size, data })
  if (pending.length > PENDING_LIMIT) {
    const index = pending.findIndex(r => !r.imp)
    pending.splice(index < 0 ? 0 : index, 1)
  }
  if (state === 'on') scheduleFlush()
}

/**
 * Start writing for this page. `candidate` is the launch id the SDK found; a
 * 'cookie' id that has been silent for LAUNCH_GAP is replaced (a webview that
 * keeps session cookies across launches). Resolves with the session id used.
 */
export async function startLog(candidate: { id: string; source: string }, page: string): Promise<string> {
  if (state !== 'waiting') return session
  pageId = page
  const db = await openDb()
  let id = candidate.id
  if (db) {
    const prev = await get<SessionMeta>(db, 'sessions', id)
    if (prev && candidate.source === 'cookie' && Date.now() - prev.lastAt > LAUNCH_GAP) id = newId()
    const meta: SessionMeta = (id === candidate.id && prev) || {
      id,
      source: candidate.source,
      startedAt: Date.now(),
      lastAt: Date.now(),
      bytes: 0,
      trimmed: 0,
      counts: {},
    }
    await put(db, 'sessions', meta)
    void prune(db, id)
  }
  if (state !== 'waiting') return session // stop() while opening
  session = id
  state = db ? 'on' : 'off'
  for (const r of pending) {
    r.session = id
    r.page = r.page || page
  }
  if (state === 'on') {
    void flush() // the page's first records (open, load errors) right away
    heartbeat = setInterval(() => {
      if (document.visibilityState !== 'hidden') void beat()
    }, HEARTBEAT_MS)
  } else {
    pending = []
  }
  return id
}

/** Stop recording; `clear` also deletes everything stored on this origin. */
export async function stopLog(clear: boolean) {
  state = 'off'
  pending = []
  if (heartbeat) clearInterval(heartbeat)
  if (!clear) return
  const db = await openDb()
  if (!db) return
  await tx(db, ['sessions', 'records'], 'readwrite', t => {
    t.objectStore('sessions').clear()
    t.objectStore('records').clear()
  })
}

/** Write what is pending now (page hide). */
export function flushLog() {
  if (state === 'on') void flush()
}

export function currentSession() {
  return state === 'on' ? session : ''
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => void flush(), pending.length >= 200 ? 0 : FLUSH_MS)
}

async function flush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = undefined
  if (state !== 'on' || !pending.length) return
  const batch = pending
  pending = []
  const db = openedDb || (await openDb())
  if (!db) return
  let meta: SessionMeta | undefined
  await tx(db, ['sessions', 'records'], 'readwrite', t => {
    const records = t.objectStore('records')
    let bytes = 0
    const counts: { [kind: string]: number } = {}
    for (const r of batch) {
      records.add(r)
      bytes += r.size
      const key = countKey(r)
      counts[key] = (counts[key] || 0) + 1
    }
    const sessions = t.objectStore('sessions')
    const req = sessions.get(session)
    req.onsuccess = () => {
      meta = req.result as SessionMeta | undefined
      if (!meta) return
      meta.lastAt = Date.now()
      meta.bytes += bytes
      for (const k in counts) meta.counts[k] = (meta.counts[k] || 0) + counts[k]
      sessions.put(meta)
    }
  })
  if (meta && meta.bytes > SESSION_CAP) await trim(db, meta.id)
}

function countKey(r: LogRecord) {
  if (r.kind === 'console') return r.data.type === 'error' ? 'error' : 'console'
  if (r.kind === 'net') return r.imp ? 'netFail' : 'net'
  return r.kind
}

async function beat() {
  const db = await openDb()
  if (!db || state !== 'on') return
  await tx(db, ['sessions'], 'readwrite', t => {
    const store = t.objectStore('sessions')
    const req = store.get(session)
    req.onsuccess = () => {
      const meta = req.result as SessionMeta | undefined
      if (!meta) return
      meta.lastAt = Date.now()
      store.put(meta)
    }
  })
}

/** Keep the current session and the most recent others; fewer on a small quota. */
async function prune(db: IDBDatabase, current: string) {
  let keep = KEEP_SESSIONS
  try {
    const estimate = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null
    if (estimate && estimate.quota && estimate.quota < SMALL_QUOTA) keep = 1
  } catch (e) {
    // Unknown quota: keep the default.
  }
  const all = (await getAll<SessionMeta>(db, 'sessions')).sort((a, b) => b.startedAt - a.startedAt)
  const others = all.filter(s => s.id !== current)
  for (const old of others.slice(keep - 1)) await deleteSession(db, old.id)
}

async function deleteSession(db: IDBDatabase, id: string) {
  await tx(db, ['sessions', 'records'], 'readwrite', t => {
    t.objectStore('sessions').delete(id)
    const index = t.objectStore('records').index('bySession')
    const req = index.openKeyCursor(sessionRange(id))
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      t.objectStore('records').delete(cursor.primaryKey)
      cursor.continue()
    }
  })
}

/** Drop the oldest unimportant records (then the oldest of all) down to 80% of the cap. */
async function trim(db: IDBDatabase, id: string) {
  await tx(db, ['sessions', 'records'], 'readwrite', t => {
    const sessions = t.objectStore('sessions')
    const records = t.objectStore('records')
    const metaReq = sessions.get(id)
    metaReq.onsuccess = () => {
      const meta = metaReq.result as SessionMeta | undefined
      if (!meta) return
      const target = SESSION_CAP * 0.8
      const pass = (range: IDBKeyRange, index: string, next?: () => void) => {
        const req = records.index(index).openCursor(range)
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor || meta.bytes <= target) {
            if (meta.bytes > target && next) next()
            else sessions.put(meta)
            return
          }
          meta.bytes -= (cursor.value as LogRecord).size
          meta.trimmed++
          cursor.delete()
          cursor.continue()
        }
      }
      pass(IDBKeyRange.only([id, 0]), 'byImportance', () => pass(sessionRange(id), 'bySession'))
    }
  })
}

/* --------------------------------- reading -------------------------------- */

export interface LogQuery {
  session?: string
  kinds?: string[]
  /** Only console errors and failed requests. */
  problems?: boolean
  /** SDK page id. */
  page?: string
  /** Case-insensitive substring of the record's text. */
  text?: string
  /** Records after this seq (paging forward). */
  after?: number
  from?: number
  to?: number
  limit?: number
  /** Drop a record (network exclude rules) unless includeExcluded. */
  hide?: (r: LogRecord) => boolean
}

export async function listSessions(): Promise<(SessionMeta & { current: boolean })[]> {
  const db = await needDb()
  const all = await getAll<SessionMeta>(db, 'sessions')
  return all.sort((a, b) => b.startedAt - a.startedAt).map(s => ({ ...s, current: s.id === session }))
}

/** Records of a session in order, without bodies and headers. */
export async function queryLog(q: LogQuery) {
  await flush()
  const db = await needDb()
  const id = await resolveSession(db, q.session)
  const limit = Math.max(1, Math.min(500, Number(q.limit) || 100))
  const text = typeof q.text === 'string' ? q.text.toLowerCase() : ''
  const after = Number(q.after) || 0
  const out: LogRecord[] = []
  let hidden = 0
  let more = false
  await cursor(db, sessionRange(id, after + 1), r => {
    if (q.kinds && q.kinds.length && q.kinds.indexOf(r.kind) < 0) return true
    if (q.problems && !isProblem(r)) return true
    if (q.page && r.page !== q.page) return true
    if (q.from && r.at < q.from) return true
    if (q.to && r.at > q.to) return false
    if (text && JSON.stringify(r.data).toLowerCase().indexOf(text) < 0) return true
    if (q.hide && q.hide(r)) {
      hidden++
      return true
    }
    if (out.length >= limit) {
      more = true
      return false
    }
    out.push(r)
    return true
  })
  return {
    session: id,
    records: out.map(publicRecord),
    next: more && out.length ? out[out.length - 1].seq : null,
    hidden,
  }
}

/** One session at a glance: when, which pages, what went wrong. */
export async function overview(sessionId?: string) {
  await flush()
  const db = await needDb()
  const id = await resolveSession(db, sessionId)
  const meta = await get<SessionMeta>(db, 'sessions', id)
  const pages: { at: number; page: string; data: LogRecord['data'] }[] = []
  const problems: ReturnType<typeof publicRecord>[] = []
  let first = 0
  let last = 0
  await cursor(db, sessionRange(id), r => {
    if (!first) first = r.at
    last = r.at
    if (r.kind === 'page' && r.data.event !== 'visibility') pages.push({ at: r.at, page: r.page, data: r.data })
    if (isProblem(r)) {
      problems.push(publicRecord(r))
      if (problems.length > 20) problems.shift()
    }
    return true
  })
  return { session: { ...meta, current: id === session }, first, last, pages: pages.slice(-60), problems }
}

/** A full record, bodies and headers included. */
export async function recordDetail(seq: unknown) {
  await flush()
  const db = await needDb()
  const r = await get<LogRecord>(db, 'records', Number(seq))
  if (!r) throw rwdError('not_found', agentText().noSuchRecord(String(seq)))
  return { ...r }
}

function isProblem(r: LogRecord) {
  return (r.kind === 'console' && r.data.type === 'error') || (r.kind === 'net' && r.imp === 1)
}

function publicRecord(r: LogRecord) {
  const data: { [key: string]: any } = {}
  for (const key in r.data) {
    if (key === 'reqHeaders' || key === 'resHeaders' || key === 'reqBody' || key === 'resBody') continue
    data[key] = r.data[key]
  }
  if (r.data.reqBody || r.data.resBody) data.hasBody = true
  return { seq: r.seq, at: r.at, kind: r.kind, page: r.page, data }
}

async function resolveSession(db: IDBDatabase, id?: string) {
  if (id && id !== 'current') {
    if (!(await get<SessionMeta>(db, 'sessions', id))) throw rwdError('not_found', agentText().noSuchSession(id))
    return id
  }
  if (session) return session
  const latest = (await getAll<SessionMeta>(db, 'sessions')).sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!latest) throw rwdError('not_found', agentText().noSessionLog)
  return latest.id
}

async function needDb() {
  const db = await openDb()
  if (!db) throw rwdError('internal', agentText().sessionLogUnavailable)
  return db
}

/* -------------------------------- IndexedDB ------------------------------- */

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise(resolve => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, 1)
    } catch (e) {
      resolve(null) // no IndexedDB (or blocked, e.g. some private modes)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('sessions', { keyPath: 'id' })
      const records = db.createObjectStore('records', { keyPath: 'seq', autoIncrement: true })
      records.createIndex('bySession', ['session', 'seq'])
      records.createIndex('byImportance', ['session', 'imp'])
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => db.close()
      openedDb = db
      resolve(db)
    }
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
  return dbPromise
}

function sessionRange(id: string, fromSeq = 0) {
  return IDBKeyRange.bound([id, fromSeq], [id, Number.MAX_SAFE_INTEGER])
}

function tx(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => void) {
  return new Promise<void>(resolve => {
    let t: IDBTransaction
    try {
      t = db.transaction(stores, mode)
    } catch (e) {
      resolve()
      return
    }
    t.oncomplete = () => resolve()
    t.onerror = () => resolve()
    t.onabort = () => resolve()
    fn(t)
  })
}

function get<T>(db: IDBDatabase, store: string, key: IDBValidKey) {
  return new Promise<T | undefined>(resolve => {
    void tx(db, [store], 'readonly', t => {
      const req = t.objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => resolve(undefined)
    })
  })
}

function getAll<T>(db: IDBDatabase, store: string) {
  return new Promise<T[]>(resolve => {
    void tx(db, [store], 'readonly', t => {
      const req = t.objectStore(store).getAll()
      req.onsuccess = () => resolve((req.result as T[]) || [])
      req.onerror = () => resolve([])
    })
  })
}

function put(db: IDBDatabase, store: string, value: unknown) {
  return tx(db, [store], 'readwrite', t => {
    t.objectStore(store).put(value)
  })
}

/** Walk a session's records in order; `visit` returns false to stop. */
function cursor(db: IDBDatabase, range: IDBKeyRange, visit: (r: LogRecord) => boolean) {
  return tx(db, ['records'], 'readonly', t => {
    const req = t.objectStore('records').index('bySession').openCursor(range)
    req.onsuccess = () => {
      const c = req.result
      if (!c) return
      if (visit(c.value as LogRecord)) c.continue()
    }
  })
}

export function newId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.prototype.map.call(bytes, (b: number) => (b < 16 ? '0' : '') + b.toString(16)).join('')
}
