// A tiny stand-in for the Go gateway: the page side of docs/protocol.md
// (welcome, heartbeats, control state machine, RPCs, presence;
// deviceToken / resume / invite, close codes 4401 / 4409 / 4429, levels,
// welcome.config, welcome.agentLang, attach approval) plus static files. It does not check
// levels itself, so tests see the page's own enforcement. Used by the e2e tests in-process; run it directly for manual testing:
//
//   npm run build && npm run gateway        # http://localhost:8787/demo/platform/
//   curl localhost:8787/__test/pages
//   curl -XPOST localhost:8787/__test/rpc -d '{"label":"p1","method":"rwd.snapshot"}'
//   curl -XPOST localhost:8787/__test/control -d '{"state":"agent","level":"interact"}'
//   curl -XPOST localhost:8787/__test/attach -d '{"deviceId":"…","levels":["observe","interact"]}'
//   curl -XPOST localhost:8787/__test/config -d '{"confirmSelectors":["#apply"]}'

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import crypto from 'node:crypto'

const here = path.dirname(fileURLToPath(import.meta.url))
const SDK_DIST = path.resolve(here, '../dist')
const DEMO_DIR = path.resolve(here, '../../examples/platform-demo')
const FIXTURES = path.resolve(here, 'fixtures')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const INTERACTIVE = new Set([
  'rwd.click', 'rwd.fill', 'rwd.type', 'rwd.press', 'rwd.select', 'rwd.hover',
  'rwd.scroll', 'rwd.drag', 'rwd.navigate', 'rwd.back', 'rwd.reload',
])

function newCode() {
  let s = ''
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s.slice(0, 4) + '-' + s.slice(4)
}

function sendFile(res, file, extraHeaders = {}) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    })
    res.end(data)
  })
}

function serveDir(res, dir, rel) {
  const file = path.resolve(dir, '.' + path.posix.normalize('/' + decodeURIComponent(rel)))
  if (!file.startsWith(dir)) {
    res.writeHead(403)
    res.end()
    return
  }
  let target = file
  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html')
  } catch {
    // sendFile answers 404.
  }
  sendFile(res, target)
}

function readBody(req) {
  return new Promise(resolve => {
    let body = ''
    req.on('data', c => (body += c))
    req.on('end', () => resolve(body))
  })
}

const DEFAULT_CONFIG = { helpButton: false, maskSelectors: [], maskPatterns: [], confirmSelectors: [] }

function token(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

export async function startGateway({ port = 0, hbMs = 25_000, log = false } = {}) {
  const devices = new Map() // deviceId -> { id, code, control, agent, level, help, labels, nextLabel, connectNext, token, invited }
  const pages = new Map() // pageId -> page record
  const received = [] // every message from pages: { pageId, label, msg, at }
  const presence = [] // presence request bodies
  const waiters = new Set()
  const attaches = new Map() // requestId -> { pages, resolve, timer }
  const invites = new Set()
  // agentLang 'zh' pins the agent-facing text the older tests assert; null leaves it out (a gateway without it).
  const opts = { config: { ...DEFAULT_CONFIG }, quotaFull: false, agentLang: 'zh' }
  let rpcSeq = 0

  function device(id) {
    let d = devices.get(id)
    if (!d) {
      d = { id, code: newCode(), control: 'none', agent: null, level: null, help: false, labels: new Map(), nextLabel: 1, connectNext: false, token: null, invited: false }
      devices.set(id, d)
    }
    return d
  }

  function notify() {
    for (const w of [...waiters]) {
      const value = w.pred()
      if (value) {
        waiters.delete(w)
        clearTimeout(w.timer)
        w.resolve(value)
      }
    }
  }

  /** Resolve when pred() returns something truthy (re-checked on every message). */
  function waitFor(pred, timeoutMs = 10_000, what = 'condition') {
    const value = pred()
    if (value) return Promise.resolve(value)
    return new Promise((resolve, reject) => {
      const w = { pred, resolve }
      w.timer = setTimeout(() => {
        waiters.delete(w)
        reject(new Error(`mock gateway: timed out waiting for ${what}`))
      }, timeoutMs)
      waiters.add(w)
    })
  }

  function sendTo(page, msg) {
    if (page.ws && page.ws.readyState === 1) page.ws.send(JSON.stringify(msg))
  }

  function broadcastControl(d) {
    for (const p of pages.values()) {
      if (p.deviceId === d.id && p.connected) {
        sendTo(p, { t: 'control', state: d.control, agent: d.agent ? { name: d.agent } : null, level: d.level })
      }
    }
  }

  function setTask(deviceId, task) {
    for (const p of pages.values()) {
      if (p.deviceId === deviceId && p.connected) sendTo(p, { t: 'task', task })
    }
  }

  /** level: undefined keeps the current one; null = not sent (phase 1 gateway). */
  function setControl(deviceId, state, agent = '测试 Agent', level) {
    const ids = deviceId ? [deviceId] : [...devices.keys()]
    for (const id of ids) {
      const d = device(id)
      d.control = state
      d.agent = state === 'none' ? null : agent
      d.level = state === 'none' ? null : level === undefined ? d.level : level
      broadcastControl(d)
    }
  }

  function findPage(sel) {
    if (typeof sel === 'string') sel = { pageId: sel }
    for (const p of pages.values()) {
      if (sel.pageId && p.pageId !== sel.pageId) continue
      if (sel.label && p.label !== sel.label) continue
      if (sel.urlContains && !p.url.includes(sel.urlContains)) continue
      if (!sel.pageId && !sel.label && !sel.urlContains && !p.connected) continue
      return p
    }
    return null
  }

  // Like the gateway: click / press may wait for the user to confirm (45 s).
  function rpc(sel, method, params = {}, timeoutMs = method === 'rwd.click' || method === 'rwd.press' ? 45_000 : 15_000) {
    const page = findPage(sel)
    if (!page || !page.connected) return Promise.reject(new Error(`mock gateway: page ${JSON.stringify(sel)} not connected`))
    const d = device(page.deviceId)
    if (INTERACTIVE.has(method)) {
      if (d.control === 'user') return Promise.resolve({ error: { code: 'takeover', message: '用户已接管' } })
      if (d.control === 'observe') setControl(d.id, 'agent', d.agent || '测试 Agent')
    }
    const id = ++rpcSeq
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        page.pending.delete(id)
        resolve({ error: { code: 'timeout', message: 'rpc timeout' } })
      }, timeoutMs)
      page.pending.set(id, reply => {
        clearTimeout(timer)
        resolve(reply)
      })
      sendTo(page, { id, method, params })
    })
  }

  /** The page the user most likely looks at: connected, visible, latest. */
  function foreground(deviceId) {
    let best = null
    for (const p of pages.values()) {
      if (p.deviceId !== deviceId || !p.connected) continue
      if (!best || (p.visibility === 'visible' && best.visibility !== 'visible') || (p.visibility === best.visibility && p.connectedAt >= best.connectedAt)) best = p
    }
    return best
  }

  /**
   * Ask the device to approve an agent (§7). Resolves with the chosen level,
   * null (refused) or 'timeout' (attach_cancel sent). toAll: send to every
   * connected page of the device instead of the foreground one.
   */
  function requestAttach(deviceId, { agent = '客服机器人', keyHint = '…a91f', levels = ['observe', 'interact'], expiresInSec = 30, toAll = false } = {}) {
    const requestId = token(9)
    const targets = toAll ? [...pages.values()].filter(p => p.deviceId === deviceId && p.connected) : [foreground(deviceId)].filter(Boolean)
    const decision = new Promise(resolve => {
      const entry = { pages: targets, deviceId, agent, resolve }
      entry.timer = setTimeout(() => {
        attaches.delete(requestId)
        for (const p of targets) sendTo(p, { t: 'attach_cancel', requestId })
        resolve('timeout')
      }, expiresInSec * 1000 + 500)
      attaches.set(requestId, entry)
    })
    for (const p of targets) sendTo(p, { t: 'attach_request', requestId, agent: { name: agent, keyHint }, levels, expiresInSec })
    return { requestId, decision, pages: targets.map(p => p.pageId) }
  }

  function cancelAttach(requestId) {
    const entry = attaches.get(requestId)
    if (!entry) return
    attaches.delete(requestId)
    clearTimeout(entry.timer)
    for (const p of entry.pages) sendTo(p, { t: 'attach_cancel', requestId })
    entry.resolve('cancelled')
  }

  function onPageMessage(ws, state, msg) {
    if (msg.t === 'hello') {
      clearTimeout(state.helloTimer)
      if (opts.quotaFull) return ws.close(4429, 'quota')
      const d = device(msg.deviceId)
      let newToken = null
      if (!d.token) {
        d.token = newToken = token()
      } else if (msg.deviceToken !== d.token) {
        return ws.close(4401, 'bad device token')
      }
      const old = pages.get(msg.pageId)
      if (old && old.resume && msg.resume !== old.resume) return ws.close(4409, 'resume mismatch')
      if (msg.invite && invites.has(msg.invite)) {
        invites.delete(msg.invite)
        d.invited = true
        d.help = true
      }
      if (!d.labels.has(msg.pageId)) d.labels.set(msg.pageId, 'p' + d.nextLabel++)
      if (old && old.ws && old.ws !== ws) old.ws.close(4000, 'replaced')
      const page = {
        pageId: msg.pageId,
        deviceId: msg.deviceId,
        label: d.labels.get(msg.pageId),
        openerId: msg.openerId,
        userId: msg.userId,
        url: msg.page.url,
        title: msg.page.title,
        visibility: msg.page.visibility,
        hello: msg,
        ws,
        connected: true,
        pending: new Map(),
        connects: (old ? old.connects : 0) + 1,
        connectedAt: Date.now(),
        resume: token(16),
      }
      pages.set(msg.pageId, page)
      state.page = page
      if (msg.help) d.help = true
      const welcome = {
        t: 'welcome',
        deviceCode: d.code,
        label: page.label,
        control: { state: d.control, agent: d.agent ? { name: d.agent } : null },
        help: d.help,
        resume: page.resume,
        level: d.level,
        config: opts.config,
      }
      if (opts.agentLang) welcome.agentLang = opts.agentLang
      if (newToken) welcome.deviceToken = newToken
      sendTo(page, welcome)
      return
    }
    const page = state.page
    if (!page) return
    if (typeof msg.id === 'number' && !msg.t) {
      const cb = page.pending.get(msg.id)
      if (cb) {
        page.pending.delete(msg.id)
        cb(msg)
      }
      return
    }
    const d = device(page.deviceId)
    switch (msg.t) {
      case 'page':
        Object.assign(page, { url: msg.url, title: msg.title, visibility: msg.visibility })
        break
      case 'help':
        d.help = !!msg.on
        break
      case 'control':
        if (msg.action === 'takeover') d.control = 'user'
        else if (msg.action === 'handback') d.control = 'agent'
        else if (msg.action === 'end') {
          d.control = 'none'
          d.agent = null
          d.level = null
        }
        broadcastControl(d)
        break
      case 'attach_decision': {
        const entry = attaches.get(msg.requestId)
        if (!entry) break
        attaches.delete(msg.requestId)
        clearTimeout(entry.timer)
        if (msg.level) setControl(entry.deviceId, 'observe', entry.agent, msg.level)
        entry.resolve(msg.level || null)
        break
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const p = url.pathname
    if (p === '/v1/sdk.js' || p === '/v1/sdk.js.map') return sendFile(res, path.join(SDK_DIST, path.basename(p)))
    if (p === '/v1/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, version: 'mock' }))
    }
    if (p === '/v1/presence' && req.method === 'POST') {
      let body = {}
      try {
        body = JSON.parse(await readBody(req))
      } catch {
        res.writeHead(400)
        return res.end()
      }
      presence.push(body)
      const d = device(body.deviceId)
      const connect = d.connectNext
      d.connectNext = false
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify({ deviceCode: d.code, connect }))
      notify()
      return
    }
    if (p.startsWith('/demo/platform/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('not found')
      }
      return serveDir(res, DEMO_DIR, p.slice('/demo/platform/'.length))
    }
    if (p === '/demo/platform') {
      res.writeHead(302, { Location: '/demo/platform/' + url.search })
      return res.end()
    }
    if (p.startsWith('/test/')) return serveDir(res, FIXTURES, p.slice('/test/'.length))

    // Manual testing helpers.
    if (p === '/__test/pages') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      return res.end(JSON.stringify(listPages(), null, 2))
    }
    if (p === '/__test/rpc' && req.method === 'POST') {
      const { method, params, ...sel } = JSON.parse((await readBody(req)) || '{}')
      const reply = await rpc(Object.keys(sel).length ? sel : {}, method, params || {})
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      return res.end(JSON.stringify(reply, null, 2))
    }
    if (p === '/__test/control' && req.method === 'POST') {
      const { deviceId, state, agent, level } = JSON.parse((await readBody(req)) || '{}')
      setControl(deviceId, state, agent, level)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end('{"ok":true}')
    }
    if (p === '/__test/attach' && req.method === 'POST') {
      const { deviceId, ...rest } = JSON.parse((await readBody(req)) || '{}')
      const result = await requestAttach(deviceId, rest).decision
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ result }))
    }
    if (p === '/__test/config' && req.method === 'POST') {
      opts.config = { ...DEFAULT_CONFIG, ...JSON.parse((await readBody(req)) || '{}') }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end('{"ok":true}')
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('not found')
  })

  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== '/v1/page') return socket.destroy()
    const key = url.searchParams.get('key') || ''
    if (!key.startsWith('rwd_pk_')) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      return socket.destroy()
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const state = { page: null, helloTimer: setTimeout(() => ws.close(4001, 'no hello'), 5000) }
      const hb = setInterval(() => ws.readyState === 1 && ws.send('{"t":"hb"}'), hbMs)
      ws.on('message', data => {
        let msg
        try {
          msg = JSON.parse(String(data))
        } catch {
          return
        }
        received.push({ pageId: state.page ? state.page.pageId : msg.pageId, label: state.page ? state.page.label : null, msg, at: Date.now() })
        if (log) console.log('[page]', state.page ? state.page.label : '-', JSON.stringify(msg).slice(0, 200))
        onPageMessage(ws, state, msg)
        notify()
      })
      ws.on('close', () => {
        clearInterval(hb)
        clearTimeout(state.helloTimer)
        if (state.page && state.page.ws === ws) {
          state.page.connected = false
          for (const cb of state.page.pending.values()) cb({ error: { code: 'internal', message: 'page disconnected' } })
          state.page.pending.clear()
        }
        notify()
      })
    })
  })

  function listPages() {
    return [...pages.values()].map(p => ({
      pageId: p.pageId,
      deviceId: p.deviceId,
      deviceCode: device(p.deviceId).code,
      label: p.label,
      openerId: p.openerId,
      userId: p.userId,
      url: p.url,
      title: p.title,
      visibility: p.visibility,
      connected: p.connected,
      connects: p.connects,
      level: device(p.deviceId).level,
    }))
  }

  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  const actualPort = server.address().port

  return {
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}`,
    devices,
    pages,
    received,
    presence,
    listPages,
    findPage,
    rpc,
    setControl,
    setTask,
    waitFor,
    requestAttach,
    cancelAttach,
    /** welcome.config for pages that connect from now on (merged into the defaults). */
    setConfig(config) {
      opts.config = { ...DEFAULT_CONFIG, ...config }
    },
    /** welcome.agentLang for pages that connect from now on ('en' / 'zh'; null: not sent). */
    setAgentLang(lang) {
      opts.agentLang = lang || null
    },
    /** Refuse every hello with 4429 while on. */
    setQuotaFull(on) {
      opts.quotaFull = !!on
    },
    /** A device invite token (§3.5) the next hello may carry. */
    addInvite(t) {
      invites.add(t)
    },
    /** Close a page's socket with a code (as the real gateway would). */
    closePage(pageId, code, reason = '') {
      const p = pages.get(pageId)
      if (p && p.ws) p.ws.close(code, reason)
    },
    /** Messages of a given type (optionally from one page). */
    messages(t, pageId) {
      return received.filter(r => r.msg.t === t && (!pageId || r.pageId === pageId)).map(r => r.msg)
    },
    /** Clear (or set) the help flag, as the gateway does when an agent joins. */
    sendHelp(deviceId, on) {
      const d = device(deviceId)
      d.help = !!on
      for (const p of pages.values()) if (p.deviceId === deviceId && p.connected) sendTo(p, { t: 'help', on: d.help })
    },
    /** Next time `connect` should be true for this device (presence). */
    connectNext(deviceId) {
      device(deviceId).connectNext = true
    },
    async close() {
      for (const p of pages.values()) if (p.ws) p.ws.terminate()
      wss.close()
      await new Promise(resolve => server.close(resolve))
    },
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const gw = await startGateway({ port: Number(process.env.PORT) || 8787, log: true })
  console.log(`mock gateway on ${gw.url}  demo: ${gw.url}/demo/platform/?key=rwd_pk_demo`)
}
