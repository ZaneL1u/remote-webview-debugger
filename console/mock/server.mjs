#!/usr/bin/env node
// In-memory mock of the RWD console REST API (docs/protocol.md sections 11-13).
// Also serves ../dist with SPA fallback, so the built console can be exercised without the Go gateway.
//
//   node mock/server.mjs                 # http://localhost:4180
//   PORT=8080 node mock/server.mjs       # stand in for the gateway behind `npm run dev`
//
// Accounts (email / password):
//   admin@example.com / admin        owner
//   ops@example.com   / ops12345     admin
//   support@example.com / support123 member
//
// Fake devices change state every 2 seconds and are pushed over SSE (GET /v1/api/stream). A project with
// no devices gets its first device ~6 seconds after its integration endpoint is first polled, to exercise
// the 接入验证 flow. A device invite is "used" by a fake device 20 seconds after it is created.
//
// MOCK_SSO=feishu (or lark, oidc) turns on single sign-on: the login page shows the button, and
// GET /v1/api/auth/oidc/start signs in sso@example.com (created as a member on first use) without a provider.
//
// Mock-only control endpoints (not part of the protocol): POST /__mock/sse?down=1 drops every stream and
// answers new ones with 503, to exercise the polling fallback; ?down=0 restores it. POST /__mock/status?down=1
// makes GET /v1/api/status answer 503 (the header's "disconnected" state).
//
// The device fleet is deliberately varied (iOS / iPadOS / Android / HarmonyOS, WebViews and in-app browsers
// such as WeChat, Alipay and Feishu, plus desktop browsers) with ~45 devices online, so the cross-project
// device list (section 12.5) has something to search and page through.

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PASSWORD = process.env.RWD_ADMIN_PASSWORD ?? 'admin'
const VERSION = '0.2.0-mock'
const SDK_VERSION = '0.2.0'
const SDK_BODY =
  '/* RWD SDK mock */ window.RemoteWebviewDebugger={run:function(){return Promise.resolve({deviceCode:"MOCK-0000",status:"online"})}};'
const SDK_INTEGRITY = `sha384-${createHash('sha384').update(SDK_BODY).digest('base64')}`
const LEVELS = ['observe', 'interact', 'advanced']
const ROLES = ['owner', 'admin', 'member']
const MIN_PASSWORD = 8

// ---------- helpers ----------

let seed = 20261101
function rand() {
  // mulberry32: deterministic so screenshots are reproducible
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const base62 = (n) => Array.from(randomBytes(n), (b) => B62[b % 62]).join('')
const CODE = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const deviceCode = () => {
  const c = () => Array.from({ length: 4 }, () => CODE[Math.floor(rand() * CODE.length)]).join('')
  return `${c()}-${c()}`
}
const now = () => Date.now()

// ---------- state ----------

const sessions = new Map() // token -> user id
const users = new Map()
const projects = new Map()
const keys = new Map()
const devices = new Map()
const deviceInvites = new Map()
const integrationFirstPoll = new Map()
const auditLog = [] // oldest first
let auditSeq = 0
const streams = new Set() // { res, projectId (null: every project) }
let sseDown = false
let statusDown = false
const MOCK_SSO = process.env.MOCK_SSO || ''
const startedAt = now() - (3 * 86_400_000 + 4 * 3_600_000 + 17 * 60_000)

const DEFAULT_POLICY = {
  approval: 'prompt',
  maxLevel: 'interact',
  maskSelectors: [],
  maskPatterns: [],
  confirmSelectors: [],
  networkExclude: [],
  sessionLog: true,
  helpButton: 'all',
  helpUsers: [],
  agentIdleMinutes: 2,
  attachMaxMinutes: 60,
  maxOnlineDevices: 0,
  maxAgents: 0,
}

function createUser({ email, name, role, password = null, pending = false, disabled = false, createdAt = now(), lastLoginAt = null }) {
  const u = {
    id: `usr_${base62(10)}`,
    email,
    name,
    role,
    disabled,
    pending,
    createdAt,
    lastLoginAt,
    _password: password,
    _inviteToken: null,
    _inviteExpiresAt: 0,
    _sso: [],
  }
  users.set(u.id, u)
  return u
}

const memberOut = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  disabled: u.disabled,
  pending: u.pending,
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt,
  hasPassword: !!u._password,
  sso: u._sso,
})

function issueMemberInvite(u, host) {
  u._inviteToken = base62(32)
  u._inviteExpiresAt = now() + 7 * 86_400_000
  return `http://${host}/invite/${u._inviteToken}`
}

function audit(entry) {
  const e = {
    id: ++auditSeq,
    at: now(),
    projectId: null,
    actorType: 'system',
    actorId: 'system',
    actorName: '系统',
    target: '',
    result: 'ok',
    detail: {},
    ...entry,
  }
  auditLog.push(e)
  return e
}

const memberActor = (u) => ({ actorType: 'member', actorId: u.id, actorName: u.name || u.email })

const UAS = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP4A.250105.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.51 Mobile Safari/537.36',
  web: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
}

// [platform, user agent] — what real phones send from App WebViews and in-app browsers.
const UA_POOL = [
  ['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'],
  ['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'],
  ['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800323c) NetType/WIFI Language/zh_CN'],
  ['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'],
  ['ios', 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'],
  ['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Lark/7.30.0 LarkLocale/zh_CN'],
  ['android', 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP4A.250105.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.51 Mobile Safari/537.36'],
  ['android', 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36'],
  ['android', 'Mozilla/5.0 (Linux; Android 13; 2211133C Build/TKQ1.220905.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.120 Mobile Safari/537.36 XWEB/1220133 MMWEBSDK/20240404 MicroMessenger/8.0.49.2600(0x28003133) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64'],
  ['android', 'Mozilla/5.0 (Linux; Android 14; V2309A Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 AlipayClient/10.6.30.8000 Language/zh-Hans'],
  ['android', 'Mozilla/5.0 (Linux; Android 12; PGT-AN10 Build/HUAWEIPGT-AN10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36 DingTalk/7.6.15'],
  ['android', 'Mozilla/5.0 (Linux; Android 15; PKG110 Build/UKQ1.231108.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.39 Mobile Safari/537.36'],
  ['android', 'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile'],
  ['android', 'Mozilla/5.0 (Phone; OpenHarmony 4.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile MicroMessenger/8.0.1.30'],
  ['web', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'],
  ['web', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'],
]

/** Port of gateway/internal/hub/system.go ParseUA (best effort). */
function parseUA(ua, platform) {
  const s = { os: '', osVersion: '', model: '', browser: '', label: '' }
  let m
  if (/OpenHarmony|HarmonyOS/.test(ua)) {
    s.os = 'HarmonyOS'
    if ((m = ua.match(/(?:OpenHarmony|HarmonyOS)[ /]?(\d+(?:\.\d+)*)?/))) s.osVersion = m[1] ?? ''
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    ;[s.os, s.model] = ua.includes('iPad') ? ['iPadOS', 'iPad'] : ['iOS', 'iPhone']
    if ((m = ua.match(/(?:iPhone|CPU) OS (\d+(?:_\d+)*)/))) s.osVersion = m[1].replaceAll('_', '.')
  } else if (ua.includes('Android')) {
    s.os = 'Android'
    if ((m = ua.match(/Android (\d+(?:\.\d+)*)(?:; ([^;)]+))?/))) {
      s.osVersion = m[1]
      let model = (m[2] ?? '').trim()
      const i = model.indexOf(' Build/')
      if (i >= 0) model = model.slice(0, i)
      if (model !== 'K' && model !== 'wv') s.model = model
    }
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    s.os = 'macOS'
  } else if (ua.includes('Windows')) {
    s.os = 'Windows'
  } else if (ua.includes('Linux')) {
    s.os = 'Linux'
  }
  if (!s.os) s.os = platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : ''
  const products = [
    [/MicroMessenger\/(\d+(?:\.\d+)*)/, '微信'],
    [/(?:Lark|Feishu)\/(\d+(?:\.\d+)*)/, '飞书'],
    [/DingTalk\/(\d+(?:\.\d+)*)/, '钉钉'],
    [/AlipayClient\/(\d+(?:\.\d+)*)/, '支付宝'],
    [/EdgA?\/(\d+)/, 'Edge'],
    [/(?:CriOS|Chrome)\/(\d+)/, 'Chrome'],
    [/(?:FxiOS|Firefox)\/(\d+)/, 'Firefox'],
  ]
  for (const [re, name] of products) {
    if ((m = ua.match(re))) {
      s.browser = `${name} ${m[1]}`
      break
    }
  }
  const superApp = s.browser && !/^(Chrome|Edge|Firefox)/.test(s.browser)
  if (!superApp) {
    if (s.os === 'Android' && ua.includes('; wv)')) s.browser = 'WebView'
    else if (s.browser) {
      // keep
    } else if (ua.includes('Safari/') && (m = ua.match(/Version\/(\d+(?:\.\d+)?)/))) s.browser = `Safari ${m[1]}`
    else if (s.os === 'iOS' || s.os === 'iPadOS' || ua.includes('AppleWebKit')) s.browser = 'WebView'
  }
  s.label = [s.os && `${s.os} ${s.osVersion}`.trim(), s.model, s.browser].filter(Boolean).join(' · ')
  return s
}

const SITE = 'https://m.shop.example.com'
const PAGES = [
  { path: '/', title: '首页' },
  { path: '/list?cat=audio', title: '商品列表' },
  { path: '/item/8812', title: '无线耳机 Pro' },
  { path: '/cart', title: '购物车' },
  { path: '/checkout', title: '确认订单' },
  { path: '/pay/result', title: '支付结果' },
]

function createProject({ name, allowedOrigins = [], createdAt = now(), policy = {}, inviteUrl = '' }) {
  const p = {
    id: `prj_${base62(10)}`,
    name,
    appKey: `rwd_pk_${base62(24)}`,
    allowedOrigins,
    disabled: false,
    createdAt,
    policy: { ...DEFAULT_POLICY, ...policy },
    inviteUrl,
  }
  projects.set(p.id, p)
  return p
}

function createKey(projectId, name, extra = {}) {
  const secret = `rwd_sk_live_${base62(32)}`
  const k = {
    id: `key_${base62(10)}`,
    projectId,
    name,
    prefix: secret.slice(0, 16),
    createdAt: now(),
    lastUsedAt: null,
    revokedAt: null,
    maxLevel: 'interact',
    expiresAt: now() + 90 * 86_400_000,
    ipAllowlist: [],
    ...extra,
  }
  keys.set(k.id, k)
  return { ...k, key: secret }
}

async function keysRoute(req, res, user, method) {
  if (method === 'GET') return send(res, 200, { keys: [...keys.values()].sort((a, b) => b.createdAt - a.createdAt) })
  if (method !== 'POST') return fail(res, 405, 'method_not_allowed', 'method not allowed')
  if (!isManager(user)) return forbidden(res)
  const body = await readBody(req)
  if (!body?.name?.trim()) return fail(res, 400, 'bad_request', '名称不能为空')
  const maxLevel = body.maxLevel ?? 'interact'
  if (!LEVELS.includes(maxLevel)) return fail(res, 400, 'bad_request', 'maxLevel 取值错误')
  const days = body.expiresInDays ?? 90
  if (!Number.isInteger(days) || days < 0) return fail(res, 400, 'bad_request', 'expiresInDays 应为非负整数')
  const ipAllowlist = body.ipAllowlist ?? []
  if (!Array.isArray(ipAllowlist) || !ipAllowlist.every(validCidr)) return fail(res, 400, 'bad_request', 'IP 白名单格式不正确')
  const created = createKey(null, body.name.trim(), { maxLevel, expiresAt: days ? now() + days * 86_400_000 : null, ipAllowlist })
  audit({ projectId: null, ...memberActor(user), action: 'key.create', target: created.prefix, detail: { name: created.name, maxLevel, expiresInDays: days, ipAllowlist } })
  return send(res, 200, created)
}

function makePage(dev, index, { opener = null, visibility = 'visible', focused = false } = {}) {
  const tpl = PAGES[index % PAGES.length]
  dev._labelSeq += 1
  return {
    id: base62(12),
    label: `p${dev._labelSeq}`,
    url: SITE + tpl.path,
    title: tpl.title,
    visibility,
    focused,
    openerLabel: opener,
    connectedAt: now() - Math.floor(rand() * 600_000),
  }
}

function createDevice(projectId, opts = {}) {
  const platform = opts.platform ?? pick(['ios', 'android', 'ios', 'android', 'web'])
  const ua = opts.ua ?? UAS[platform]
  const t = now()
  const dev = {
    id: randomUUID(),
    code: deviceCode(),
    projectId,
    userId: opts.userId === undefined ? (rand() < 0.75 ? `u_${10000 + Math.floor(rand() * 89999)}` : null) : opts.userId,
    platform,
    ua,
    system: parseUA(ua, platform),
    app: opts.app !== undefined ? opts.app : platform === 'web' ? null : { name: '商城', version: pick(['5.12.0', '5.12.1', '5.11.3']) },
    online: opts.online ?? true,
    help: opts.help ?? false,
    control: opts.control ?? 'none',
    agent: opts.control && opts.control !== 'none' ? '客服机器人' : null,
    level: opts.control && opts.control !== 'none' ? (opts.level ?? 'interact') : null,
    pending: null,
    invited: opts.invited ?? false,
    firstSeenAt: t - (opts.age ?? Math.floor(rand() * 86_400_000 * 5)),
    lastSeenAt: opts.online === false ? t - (opts.offlineFor ?? Math.floor(rand() * 7_200_000)) : t,
    onlineSince: null,
    pages: [],
    timeline: [],
    _labelSeq: 0,
    _cursor: Math.floor(rand() * 3),
    _sig: '',
    _stickyPending: false,
    _resolveAt: 0,
  }
  if (dev.online) {
    dev.onlineSince = t - (opts.onlineFor ?? Math.floor(rand() * 3 * 3_600_000))
    if (dev.onlineSince < dev.firstSeenAt) dev.firstSeenAt = dev.onlineSince
    const n = opts.pages ?? 1 + Math.floor(rand() * 3)
    for (let i = 0; i < n; i++) {
      const last = dev.pages.at(-1)
      if (last) last.visibility = 'hidden'
      dev.pages.push(makePage(dev, dev._cursor + i, { opener: last?.label ?? null }))
    }
    if (dev.control !== 'none') dev.pages.at(-1).focused = true
  }
  // backfill a timeline
  let at = t - 15 * 60_000
  const count = opts.events ?? 14
  for (let i = 0; i < count; i++) {
    at += Math.floor(rand() * 60_000)
    dev.timeline.push(randomEvent(dev, at))
  }
  if (dev.help) dev.timeline.push({ at: t - 30_000, page: dev.pages.at(-1)?.label ?? null, kind: 'help', summary: '用户请求协助' })
  if (dev.control !== 'none') {
    dev.timeline.push({ at: t - 20_000, page: null, kind: 'agent_connect', summary: '客服机器人 接入了设备' })
  }
  if (dev.control === 'user') dev.timeline.push({ at: t - 5_000, page: null, kind: 'control', summary: '用户接管了控制' })
  dev.timeline.sort((a, b) => a.at - b.at)
  devices.set(dev.id, dev)
  return dev
}

function randomEvent(dev, at = now()) {
  const page = dev.pages.length ? pick(dev.pages).label : 'p1'
  const r = rand()
  if (r < 0.3) {
    const tpl = pick(PAGES)
    return { at, page, kind: 'nav', summary: `跳转到 ${tpl.path}「${tpl.title}」` }
  }
  if (r < 0.6) {
    return { at, page, kind: 'user_tap', summary: `点击了按钮「${pick(['加入购物车', '去结算', '提交订单', '选择优惠券', '返回'])}」` }
  }
  if (r < 0.75) {
    return { at, page, kind: 'net_fail', summary: pick(['POST /api/order → 405', 'GET /api/coupon/list → 502', 'GET /api/user/address → 网络错误']) }
  }
  if (r < 0.88) {
    return {
      at,
      page,
      kind: 'error',
      summary: pick([
        "TypeError: Cannot read properties of undefined (reading 'orderId')",
        'ReferenceError: wx is not defined',
        'Unhandled promise rejection: Error: timeout of 10000ms exceeded',
      ]),
    }
  }
  return { at, page, kind: 'console_error', summary: pick(['[pay] sign failed: invalid nonce', 'Warning: Each child in a list should have a unique "key" prop.']) }
}

function pushEvent(dev, ev) {
  dev.timeline.push(ev)
  if (dev.timeline.length > 100) dev.timeline.splice(0, dev.timeline.length - 100)
  broadcast(dev.projectId, 'timeline', { deviceId: dev.id, event: ev })
}

function attachRequest(dev, { sticky = false } = {}) {
  dev.pending = {
    kind: 'attach',
    agent: { name: '客服机器人', keyHint: '…a91f' },
    levels: ['observe', 'interact'],
    expiresAt: now() + 30_000,
  }
  dev._stickyPending = sticky
  dev._resolveAt = now() + 6000 + Math.floor(rand() * 6000)
  pushEvent(dev, { at: now(), page: focusedLabel(dev), kind: 'attach_request', summary: '客服机器人 申请以「可操作」级别接入，等待用户确认' })
  audit({
    projectId: dev.projectId,
    actorType: 'apikey',
    actorId: 'rwd_sk_live_a91f',
    actorName: '客服机器人',
    action: 'attach.request',
    target: dev.code,
    detail: { deviceId: dev.id, level: 'interact' },
  })
}

function resolveAttach(dev) {
  const approve = rand() < 0.7
  dev.pending = null
  if (approve) {
    dev.control = 'observe'
    dev.agent = '客服机器人'
    dev.level = 'interact'
    pushEvent(dev, { at: now(), page: focusedLabel(dev), kind: 'approval', summary: '用户批准了接入，级别「可操作」' })
    pushEvent(dev, { at: now(), page: null, kind: 'agent', summary: '客服机器人 接入了设备' })
  } else {
    pushEvent(dev, { at: now(), page: focusedLabel(dev), kind: 'denied', summary: '用户拒绝了接入' })
  }
  const base = { projectId: dev.projectId, target: dev.code, detail: { deviceId: dev.id, level: 'interact' } }
  audit({ ...base, actorType: 'device', actorId: dev.id, actorName: dev.code, action: approve ? 'attach.approve' : 'attach.deny', result: approve ? 'ok' : 'denied' })
  if (approve) audit({ ...base, actorType: 'apikey', actorId: 'rwd_sk_live_a91f', actorName: '客服机器人', action: 'attach.start' })
}

// seed data
{
  const DAY = 86_400_000
  const owner = createUser({ email: 'admin@example.com', name: 'Zane', role: 'owner', password: PASSWORD, createdAt: now() - 40 * DAY, lastLoginAt: now() - 3 * 3_600_000 })
  const ops = createUser({ email: 'ops@example.com', name: '运维小王', role: 'admin', password: 'ops12345', createdAt: now() - 30 * DAY, lastLoginAt: now() - 2 * DAY })
  const support = createUser({ email: 'support@example.com', name: '客服小李', role: 'member', password: 'support123', createdAt: now() - 20 * DAY, lastLoginAt: now() - 40 * 60_000 })
  createUser({ email: 'old@example.com', name: '离职同事', role: 'member', password: 'whatever1', disabled: true, createdAt: now() - 35 * DAY, lastLoginAt: now() - 25 * DAY })
  const pendingUser = createUser({ email: 'newbie@example.com', name: '新同事', role: 'member', pending: true, createdAt: now() - 1 * DAY })
  pendingUser._inviteToken = base62(32)
  pendingUser._inviteExpiresAt = now() + 6 * DAY

  const demo = createProject({
    name: '商城 App',
    allowedOrigins: ['https://m.shop.example.com', 'https://*.shop.example.com'],
    createdAt: now() - 12 * DAY,
    policy: {
      maskSelectors: ['.user-phone', '[name="idCard"]'],
      maskPatterns: [{ name: '手机号', regex: '1[3-9]\\d{9}' }],
      confirmSelectors: ['#submit-order', '.btn-pay'],
    },
    inviteUrl: 'https://m.shop.example.com/help',
  })
  const helpDev = createDevice(demo.id, { platform: 'ios', help: true, pages: 3, userId: 'u_20391', events: 18 })
  createDevice(demo.id, { platform: 'android', control: 'agent', pages: 2, userId: 'u_77812' })
  createDevice(demo.id, { platform: 'ios', control: 'user', pages: 1, userId: 'u_13002' })
  createDevice(demo.id, { platform: 'android', control: 'observe', level: 'observe', pages: 2 })
  const pendingDev = createDevice(demo.id, { platform: 'android', pages: 1, userId: 'u_55120' })
  attachRequest(pendingDev, { sticky: true })
  const invitedDev = createDevice(demo.id, { platform: 'ios', help: true, pages: 1, userId: 'u_30017', invited: true, events: 4 })
  invitedDev.timeline.push({ at: now() - 90_000, page: 'p1', kind: 'invite', summary: '通过邀请「工单 #4790 优惠券无法使用」接入' })
  createDevice(demo.id, { platform: 'web', pages: 1, userId: null })
  createDevice(demo.id, { platform: 'android', online: false, offlineFor: 25 * 60_000 })
  createDevice(demo.id, { platform: 'ios', online: false, offlineFor: 3 * 3_600_000 })
  createDevice(demo.id, { platform: 'android', online: false, offlineFor: 2 * DAY })
  const botKey = createKey(demo.id, '客服机器人', { createdAt: now() - 10 * DAY, lastUsedAt: now() - 4 * 60_000, expiresAt: now() + 80 * DAY })
  createKey(demo.id, 'Zane 本地调试', {
    createdAt: now() - 6 * DAY,
    lastUsedAt: now() - 2 * DAY,
    maxLevel: 'advanced',
    expiresAt: now() + 1 * DAY,
    ipAllowlist: ['203.0.113.7/32', '10.0.0.0/8'],
  })
  createKey(demo.id, '压测脚本', { createdAt: now() - 40 * DAY, lastUsedAt: now() - 12 * DAY, maxLevel: 'observe', expiresAt: now() - 3 * DAY })
  createKey(demo.id, '旧 CI Key', { createdAt: now() - 30 * DAY, lastUsedAt: now() - 20 * DAY, revokedAt: now() - 9 * DAY, expiresAt: null })

  const inv = (extra) => {
    const token = base62(24)
    const d = {
      id: `inv_${base62(10)}`,
      note: '',
      link: `https://m.shop.example.com/help?rwd_invite=${token}`,
      expiresAt: now() + 30 * 60_000,
      usedAt: null,
      deviceId: null,
      createdBy: '客服小李',
      projectId: demo.id,
      _createdAt: now(),
      ...extra,
    }
    deviceInvites.set(d.id, d)
    return d
  }
  inv({ note: '工单 #4821 支付后页面空白', expiresAt: now() + 100 * 60_000, createdBy: 'Zane', _createdAt: now() - 8 * 60_000 })
  inv({ note: '工单 #4790 优惠券无法使用', usedAt: now() - 90_000, deviceId: invitedDev.id, expiresAt: now() + 10 * 60_000, _createdAt: now() - 20 * 60_000 })
  inv({ note: '工单 #4702 地址保存失败', expiresAt: now() - 2 * DAY, _createdAt: now() - 2 * DAY - 30 * 60_000 })

  const ops2 = createProject({ name: '运营活动 H5', allowedOrigins: [], createdAt: now() - 3 * DAY, policy: { approval: 'none', helpButton: 'off' } })
  createDevice(ops2.id, { platform: 'web', online: false, offlineFor: 26 * 3_600_000, pages: 0 })

  // A larger, varied fleet across projects for the device-first home page (section 12.5): ~45 online.
  const vip = createProject({
    name: '会员中心',
    allowedOrigins: ['https://vip.example.com'],
    createdAt: now() - 7 * DAY,
    policy: { maxLevel: 'advanced' },
  })
  const H5_ONLY = /MicroMessenger|AlipayClient|Lark\/|DingTalk|Version\/[\d.]+ Mobile\/\w+ Safari|Macintosh|Windows NT/
  const spawn = (projectId, n, appName, versions) => {
    for (let i = 0; i < n; i++) {
      const [platform, ua] = pick(UA_POOL)
      const r = rand()
      createDevice(projectId, {
        platform,
        ua,
        app: H5_ONLY.test(ua) || !appName ? null : { name: appName, version: pick(versions) },
        control: r < 0.07 ? 'observe' : r < 0.1 ? 'agent' : 'none',
        level: r < 0.04 ? 'observe' : 'interact',
        help: r > 0.965,
        pages: 1 + Math.floor(rand() * 2),
        events: 6,
        // skewed towards recent connections
        onlineFor: Math.floor(rand() * rand() * 6 * 3_600_000) + 20_000,
        userId: rand() < 0.8 ? `u_${10000 + Math.floor(rand() * 89999)}` : null,
      })
    }
  }
  spawn(demo.id, 22, '商城', ['5.12.0', '5.12.1', '5.11.3'])
  spawn(vip.id, 10, '会员中心', ['3.4.0', '3.3.2'])
  spawn(ops2.id, 6, null, [])
  for (let i = 0; i < 14; i++) {
    const [platform, ua] = pick(UA_POOL)
    createDevice(pick([demo.id, vip.id, ops2.id]), { platform, ua, app: H5_ONLY.test(ua) ? null : undefined, online: false, offlineFor: Math.floor(rand() * 6 * DAY), events: 4 })
  }
  // The device the docs' example prompts talk about.
  const star = [...devices.values()].find((d) => d.projectId === demo.id && d.online && d.control === 'none' && !d.help && d.system.os === 'HarmonyOS')
    ?? [...devices.values()].find((d) => d.projectId === demo.id && d.online && d.control === 'none' && !d.help && !d.pending)
  if (star) {
    star.code = 'GSJH-EV2J'
    star.userId = 'u_66120'
  }

  // ~30 days of fake audit history, oldest first.
  const devs = [...devices.values()].filter((d) => d.projectId === demo.id)
  const people = [owner, ops, support]
  const methods = ['rwd.snapshot', 'rwd.snapshot', 'rwd.click', 'rwd.fill', 'rwd.console', 'rwd.network', 'rwd.screenshot', 'rwd.scroll', 'rwd.navigate', 'rwd.waitFor']
  const history = []
  let t = now() - 30 * DAY
  while (t < now() - 5 * 60_000) {
    t += Math.floor(rand() * 2 * 3_600_000)
    const dev = pick(devs)
    const r = rand()
    const deviceTarget = { projectId: demo.id, target: dev.code }
    const bot = { actorType: 'apikey', actorId: botKey.prefix, actorName: '客服机器人' }
    if (r < 0.45) {
      const method = pick(methods)
      const failed = rand() < 0.08
      history.push({ at: t, ...deviceTarget, ...bot, action: 'rpc', result: failed ? 'error' : 'ok', detail: { deviceId: dev.id, method, page: `p${1 + Math.floor(rand() * 3)}`, latencyMs: 40 + Math.floor(rand() * 400), ...(failed ? { error: pick(['timeout', 'not_found', 'not_interactable']) } : {}) } })
    } else if (r < 0.55) {
      history.push({ at: t, ...deviceTarget, ...bot, action: 'attach.request', detail: { deviceId: dev.id, level: 'interact' } })
      const ok = rand() < 0.75
      history.push({ at: t + 8000, ...deviceTarget, actorType: 'device', actorId: dev.id, actorName: dev.code, action: ok ? 'attach.approve' : rand() < 0.5 ? 'attach.deny' : 'attach.timeout', result: ok ? 'ok' : 'denied', detail: { deviceId: dev.id, level: 'interact' } })
      if (ok) {
        history.push({ at: t + 8500, ...deviceTarget, ...bot, action: 'attach.start', detail: { deviceId: dev.id, level: 'interact' } })
        history.push({ at: t + 600_000, ...deviceTarget, ...bot, action: 'attach.end', detail: { deviceId: dev.id, durationSec: 590 } })
      }
    } else if (r < 0.6) {
      history.push({ at: t, ...deviceTarget, ...bot, action: 'policy.denied', result: 'denied', detail: { deviceId: dev.id, method: 'rwd.evaluate', required: 'advanced', level: 'interact' } })
    } else if (r < 0.66) {
      history.push({ at: t, ...deviceTarget, actorType: 'device', actorId: dev.id, actorName: dev.code, action: pick(['control.takeover', 'control.handback', 'control.end']), detail: { deviceId: dev.id } })
    } else if (r < 0.78) {
      const u = pick(people)
      const failed = rand() < 0.15
      history.push({ at: t, ...(failed ? { actorType: 'system', actorId: u.email, actorName: u.email } : memberActor(u)), action: failed ? 'auth.login_failed' : 'auth.login', target: u.email, result: failed ? 'denied' : 'ok', detail: { ip: pick(['203.0.113.7', '198.51.100.23', '192.0.2.44']) } })
    } else if (r < 0.84) {
      const u = pick([owner, ops])
      history.push({ at: t, projectId: demo.id, ...memberActor(u), action: 'project.update', target: demo.name, detail: { fields: [pick(['policy.maskPatterns', 'policy.approval', 'allowedOrigins', 'inviteUrl'])] } })
    } else if (r < 0.9) {
      history.push({ at: t, ...deviceTarget, ...memberActor(support), action: 'device.end', detail: { deviceId: dev.id } })
    } else if (r < 0.95) {
      history.push({ at: t, projectId: demo.id, ...memberActor(support), action: 'invite.create', target: '工单', detail: { note: `工单 #${4000 + Math.floor(rand() * 800)}` } })
      history.push({ at: t + 120_000, ...deviceTarget, actorType: 'device', actorId: dev.id, actorName: dev.code, action: 'invite.use', detail: { deviceId: dev.id } })
    } else {
      history.push({ at: t, projectId: demo.id, ...memberActor(owner), action: pick(['key.create', 'key.revoke']), target: botKey.prefix, detail: { name: '客服机器人' } })
    }
  }
  history.push({ at: now() - 20 * DAY, ...memberActor(owner), action: 'member.invite', target: support.email, detail: { role: 'member' } })
  history.push({ at: now() - 20 * DAY + 3_600_000, ...memberActor(support), action: 'member.accept', target: support.email })
  history.push({ at: now() - 1 * DAY, ...memberActor(owner), action: 'member.invite', target: pendingUser.email, detail: { role: 'member' } })
  history.sort((a, b) => a.at - b.at)
  for (const h of history) if (h.at < now() - 60_000) audit(h)
  // The live attach request above happened "now"; keep the log in time order.
  auditLog.sort((a, b) => a.at - b.at || a.id - b.id)
  auditLog.forEach((e, i) => (e.id = i + 1))
  auditSeq = auditLog.length
}

// ---------- simulation ----------

setInterval(() => {
  const t = now()
  for (const dev of devices.values()) {
    const project = projects.get(dev.projectId)
    if (!project || project.disabled) {
      if (dev.online) setOffline(dev)
      continue
    }
    if (!dev.online) {
      if (rand() < 0.01 && dev.timeline.length) setOnline(dev)
      continue
    }
    dev.lastSeenAt = t
    if (dev.pending) {
      // The seeded request stays pending forever (renewed) so it can be screenshotted.
      if (dev._stickyPending) {
        if (dev.pending.expiresAt - t < 5000) dev.pending.expiresAt = t + 30_000
      } else if (t >= dev._resolveAt) resolveAttach(dev)
    }
    const r = rand()
    if (r < 0.25) {
      pushEvent(dev, randomEvent(dev, t))
    } else if (r < 0.3 && dev.pages.length < 4) {
      const opener = dev.pages.find((p) => p.visibility === 'visible') ?? dev.pages.at(-1)
      dev.pages.forEach((p) => (p.visibility = 'hidden'))
      const page = makePage(dev, ++dev._cursor, { opener: opener?.label ?? null })
      page.connectedAt = t
      if (dev.control !== 'none') {
        dev.pages.forEach((p) => (p.focused = false))
        page.focused = true
      }
      dev.pages.push(page)
      pushEvent(dev, {
        at: t,
        page: page.label,
        kind: 'page_open',
        summary: `${page.label}「${page.title}」打开${opener ? `（由 ${opener.label} 打开）` : ''}，现在在前台`,
      })
    } else if (r < 0.33 && dev.pages.length > 1) {
      const closed = dev.pages.pop()
      dev.pages.at(-1).visibility = 'visible'
      if (closed.focused) dev.pages.at(-1).focused = true
      pushEvent(dev, { at: t, page: closed.label, kind: 'page_close', summary: `${closed.label}「${closed.title}」关闭` })
    } else if (r < 0.34 && dev.control === 'agent') {
      dev.control = 'observe'
      pushEvent(dev, { at: t, page: null, kind: 'control', summary: 'agent 2 分钟没有操作，回到仅查看' })
    } else if (r < 0.35 && dev.control === 'observe') {
      dev.control = 'agent'
      pushEvent(dev, { at: t, page: focusedLabel(dev), kind: 'agent_action', summary: '客服机器人 点击了「提交订单」' })
    } else if (r < 0.355 && !dev.help && dev.control === 'none') {
      dev.help = true
      pushEvent(dev, { at: t, page: focusedLabel(dev), kind: 'help', summary: '用户请求协助' })
    } else if (r < 0.36 && dev.control === 'none' && !dev.help && !dev.pending) {
      setOffline(dev)
    } else if (r < 0.365 && dev.control === 'none' && !dev.help && !dev.pending) {
      attachRequest(dev)
    }
  }
  for (const [projectId, firstPoll] of integrationFirstPoll) {
    const p = projects.get(projectId)
    if (!p || p.disabled || t - firstPoll < 6000) continue
    integrationFirstPoll.delete(projectId)
    if ([...devices.values()].some((d) => d.projectId === projectId)) continue
    const dev = createDevice(projectId, { platform: 'ios', pages: 1, events: 2, age: 0, onlineFor: 0, userId: 'u_demo' })
    dev.firstSeenAt = now()
  }
  for (const inv of deviceInvites.values()) {
    if (!inv.usedAt && inv._autoUseAt && t >= inv._autoUseAt && inv.expiresAt > t) useInvite(inv)
  }
  for (const dev of devices.values()) syncDevice(dev)
}, 2000)

function useInvite(inv) {
  const dev = createDevice(inv.projectId, { platform: 'ios', help: true, pages: 1, events: 1, age: 0, onlineFor: 0, userId: 'u_48210', invited: true })
  dev.firstSeenAt = now()
  inv.usedAt = now()
  inv.deviceId = dev.id
  pushEvent(dev, { at: now(), page: 'p1', kind: 'invite', summary: `通过邀请「${inv.note}」接入` })
  audit({ projectId: inv.projectId, actorType: 'device', actorId: dev.id, actorName: dev.code, action: 'invite.use', target: dev.code, detail: { deviceId: dev.id, inviteId: inv.id, note: inv.note } })
}

/** Pushes a `device` event when anything but lastSeenAt changed. */
function syncDevice(dev) {
  const out = deviceOut(dev)
  const sig = JSON.stringify({ ...out, lastSeenAt: 0 })
  if (sig === dev._sig) return
  dev._sig = sig
  broadcast(dev.projectId, 'device', out)
}

// ---------- SSE ----------

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function broadcast(projectId, event, data) {
  for (const c of streams) if (c.projectId === null || c.projectId === projectId) sse(c.res, event, data)
}

setInterval(() => {
  for (const c of streams) sse(c.res, 'ping', {})
}, 25_000)

function focusedLabel(dev) {
  return (dev.pages.find((p) => p.focused) ?? dev.pages.find((p) => p.visibility === 'visible'))?.label ?? null
}

function setOffline(dev) {
  dev.online = false
  dev.onlineSince = null
  dev.pages = []
  dev.help = false
  dev.pending = null
  dev.level = null
  if (dev.control !== 'none') pushEvent(dev, { at: now(), page: null, kind: 'agent_disconnect', summary: '设备离线，agent 已断开' })
  dev.control = 'none'
  dev.agent = null
  pushEvent(dev, { at: now(), page: null, kind: 'disconnect', summary: '设备离线' })
}

function setOnline(dev) {
  dev.online = true
  dev.lastSeenAt = now()
  dev.onlineSince = now()
  const page = makePage(dev, ++dev._cursor)
  page.connectedAt = now()
  dev.pages = [page]
  pushEvent(dev, { at: now(), page: page.label, kind: 'page_open', summary: `${page.label}「${page.title}」打开，现在在前台` })
}

// ---------- serializers ----------

function projectOut(p) {
  const list = [...devices.values()].filter((d) => d.projectId === p.id)
  return { ...p, onlineDevices: list.filter((d) => d.online).length, totalDevices: list.length }
}

const publicFields = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')))

function deviceOut(d) {
  const { pages, timeline, onlineSince, ...rest } = publicFields(d)
  const cur = pages.find((p) => p.focused) ?? pages.find((p) => p.visibility === 'visible') ?? null
  return {
    ...rest,
    ...(d.online && onlineSince ? { onlineSince } : {}),
    pages: pages.length,
    sdk: '0.2.0',
    currentPage: cur && { label: cur.label, url: cur.url, title: cur.title },
  }
}

function deviceDetailOut(d) {
  const { onlineSince, ...rest } = publicFields(d)
  return {
    ...rest,
    ...(d.online && onlineSince ? { onlineSince } : {}),
    sdk: '0.2.0',
    pages: d.pages.map((p) => ({ ...p, selected: p.focused && d.control !== 'none' })),
    timeline: d.timeline.slice(-100),
  }
}

/** GET /devices (section 12.5). */
function listAllDevices(url) {
  const q = url.searchParams
  const status = q.get('status') === 'all' ? 'all' : 'online'
  const project = q.get('project') ?? ''
  const needle = (q.get('q') ?? '').trim().toLowerCase()
  const page = Math.max(1, Number.parseInt(q.get('page') ?? '1', 10) || 1)
  let pageSize = Number.parseInt(q.get('pageSize') ?? '20', 10) || 20
  if (pageSize <= 0 || pageSize > 100) pageSize = 20
  let list = [...devices.values()]
  if (status === 'online') list = list.filter((d) => d.online)
  if (project) list = list.filter((d) => d.projectId === project)
  if (needle) {
    const bare = needle.replaceAll('-', '')
    list = list.filter((d) => {
      const name = projects.get(d.projectId)?.name ?? ''
      return (
        d.id.toLowerCase().includes(needle) ||
        (bare && d.code.replaceAll('-', '').toLowerCase().includes(bare)) ||
        (d.userId ?? '').toLowerCase().includes(needle) ||
        d.ua.toLowerCase().includes(needle) ||
        d.system.label.toLowerCase().includes(needle) ||
        name.toLowerCase().includes(needle)
      )
    })
  }
  list.sort(status === 'online' ? (a, b) => b.onlineSince - a.onlineSince || a.code.localeCompare(b.code) : (a, b) => b.firstSeenAt - a.firstSeenAt)
  const total = list.length
  const items = list.slice((page - 1) * pageSize, page * pageSize).map((d) => ({ ...deviceOut(d), projectName: projects.get(d.projectId)?.name ?? '' }))
  return { devices: items, total, page, pageSize }
}

/** GET /status (section 12.5). */
function gatewayStatus(host) {
  const list = [...devices.values()]
  const online = list.filter((d) => d.online)
  const pages = online.reduce((n, d) => n + d.pages.length, 0)
  return {
    ok: true,
    version: VERSION,
    db: 'sqlite',
    gatewayUrl: `http://${host}/v1`,
    sdkVersion: SDK_VERSION,
    startedAt,
    uptimeSec: Math.floor((now() - startedAt) / 1000),
    serverTime: now(),
    onlineDevices: online.length,
    totalDevices: list.length,
    connectedPages: pages,
    attachedAgents: online.filter((d) => d.control !== 'none').length,
    wsConnections: pages + streams.size,
    projects: projects.size,
  }
}

const sortDevices = (a, b) =>
  Number(b.help) - Number(a.help) || Number(b.online) - Number(a.online) || b.lastSeenAt - a.lastSeenAt

function snapshotFor(page) {
  return `- generic [ref=e1]:
  - banner [ref=e2]:
    - button "返回" [ref=e3]
    - heading "${page.title}" [level=1] [ref=e4]
  - main [ref=e5]:
    - region "收货地址" [ref=e6]:
      - text: 张** 138****0000
      - text: 上海市浦东新区 ********
      - button "修改" [ref=e7]
    - list "商品" [ref=e8]:
      - listitem [ref=e9]:
        - img "无线耳机 Pro" [ref=e10]
        - text: 无线耳机 Pro × 1
        - text: ¥899.00
      - listitem [ref=e11]:
        - img "耳机保护套" [ref=e12]
        - text: 耳机保护套 × 2
        - text: ¥58.00
    - group "优惠券" [ref=e13]:
      - combobox "选择优惠券" [ref=e14]:
        - option "满 500 减 50" [selected]
        - option "不使用优惠券"
    - textbox "订单备注" [ref=e15]:
    - textbox "支付密码" [ref=e16]: ••••
  - contentinfo [ref=e17]:
    - text: 合计 ¥907.00
    - button "提交订单" [ref=e18]
`.slice(0, 4000)
}

// ---------- http ----------

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(data)
}
const fail = (res, status, code, message) => send(res, status, { error: { code, message } })

function readBody(req) {
  return new Promise((resolve) => {
    let s = ''
    req.on('data', (c) => (s += c))
    req.on('end', () => {
      try {
        resolve(s ? JSON.parse(s) : {})
      } catch {
        resolve(null)
      }
    })
  })
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
  )
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const forbidden = (res) => fail(res, 403, 'forbidden', '没有权限执行该操作')
const isManager = (u) => u.role === 'owner' || u.role === 'admin'

function validCidr(s) {
  return /^(\d{1,3}(\.\d{1,3}){3})(\/\d{1,2})?$/.test(s) || /^[0-9a-f:]+(\/\d{1,3})?$/i.test(s)
}

/** Validates and merges a policy patch; returns an error message or null. */
function applyPolicy(p, patch) {
  if (typeof patch !== 'object' || patch === null) return 'policy 格式错误'
  const next = { ...p.policy }
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULT_POLICY)) return `未知的策略字段 ${k}`
    if (k === 'approval' && !['none', 'prompt'].includes(v)) return 'approval 取值错误'
    if (k === 'maxLevel' && !LEVELS.includes(v)) return 'maxLevel 取值错误'
    if (k === 'helpButton' && !['off', 'all', 'listed'].includes(v)) return 'helpButton 取值错误'
    if (['maskSelectors', 'confirmSelectors', 'networkExclude', 'helpUsers'].includes(k) && !(Array.isArray(v) && v.every((x) => typeof x === 'string'))) return `${k} 应为字符串数组`
    if (k === 'maskPatterns') {
      if (!Array.isArray(v)) return 'maskPatterns 应为数组'
      for (const m of v) {
        if (!m?.name || typeof m.regex !== 'string') return 'maskPatterns 每项需要 name 和 regex'
        try {
          new RegExp(m.regex)
        } catch {
          return `正则「${m.name}」无效`
        }
      }
    }
    if (['agentIdleMinutes', 'attachMaxMinutes', 'maxOnlineDevices', 'maxAgents'].includes(k) && !(Number.isInteger(v) && v >= 0)) return `${k} 应为非负整数`
    next[k] = v
  }
  p.policy = next
  return null
}

function inviteOut(inv) {
  return publicFields(Object.fromEntries(Object.entries(inv).filter(([k]) => k !== 'projectId')))
}

async function handleStream(req, res, url, user) {
  // Without `project`: every project's events (section 12.5).
  const projectId = url.searchParams.get('project') || null
  if (projectId && !projects.get(projectId)) return fail(res, 404, 'not_found', '项目不存在')
  if (sseDown) return fail(res, 503, 'unavailable', '实时推送暂不可用（mock）')
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
  res.write('retry: 3000\n\n')
  const client = { res, projectId, userId: user.id }
  streams.add(client)
  req.on('close', () => streams.delete(client))
}

async function handleApi(req, res, url) {
  const path = url.pathname.slice('/v1/api'.length) || '/'
  const method = req.method
  if (method !== 'GET' && req.headers['x-rwd-csrf'] !== '1') return fail(res, 403, 'csrf', '缺少 X-RWD-CSRF 请求头')
  const host = req.headers.host
  let m

  if (method === 'GET' && path === '/config') {
    const sso = MOCK_SSO ? { provider: MOCK_SSO, name: '', defaultRole: 'member', inviteOnly: false } : null
    return send(res, 200, { gatewayUrl: `http://${host}/v1`, version: VERSION, sdkVersion: SDK_VERSION, sdkIntegrity: SDK_INTEGRITY, sso })
  }

  if (method === 'GET' && path === '/auth/oidc/start' && MOCK_SSO) {
    let u = [...users.values()].find((x) => x.email === 'sso@example.com')
    if (!u) {
      u = createUser({ email: 'sso@example.com', name: 'SSO 同事', role: 'member' })
      u._sso = [MOCK_SSO]
      audit({ ...memberActor(u), action: 'member.sso_join', target: u.email, detail: { role: u.role, provider: MOCK_SSO } })
    }
    if (u.disabled) return send(res, 302, null, { Location: '/login?sso_error=disabled' })
    u.lastLoginAt = now()
    audit({ ...memberActor(u), action: 'auth.login', target: u.email, detail: { method: 'sso', provider: MOCK_SSO } })
    const t = base62(32)
    sessions.set(t, u.id)
    const to = url.searchParams.get('redirect') || '/'
    return send(res, 302, null, { Location: to.startsWith('/') && !to.startsWith('//') ? to : '/', 'Set-Cookie': `rwd_session=${t}; Path=/; HttpOnly; SameSite=Lax` })
  }

  if (method === 'POST' && path === '/auth/login') {
    const body = (await readBody(req)) ?? {}
    await sleep(250)
    const email = String(body.email ?? '').trim().toLowerCase()
    const u = [...users.values()].find((x) => x.email === email)
    if (!u || u.pending || !u._password || body.password !== u._password) {
      audit({ actorType: 'system', actorId: email || '?', actorName: email || '?', action: 'auth.login_failed', target: email, result: 'denied' })
      return fail(res, 401, 'bad_password', '邮箱或密码错误')
    }
    if (u.disabled) {
      audit({ ...memberActor(u), action: 'auth.login_failed', target: email, result: 'denied', detail: { reason: '账号已停用' } })
      return fail(res, 403, 'account_disabled', '账号已停用，请联系项目所有者')
    }
    u.lastLoginAt = now()
    audit({ ...memberActor(u), action: 'auth.login', target: u.email })
    const token = base62(32)
    sessions.set(token, u.id)
    return send(res, 200, { ok: true }, { 'Set-Cookie': `rwd_session=${token}; Path=/; HttpOnly; SameSite=Lax` })
  }

  const token = cookies(req).rwd_session
  if (method === 'POST' && path === '/auth/logout') {
    if (token) sessions.delete(token)
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'rwd_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' })
  }

  // Public: member invite links (section 12.2).
  if ((m = path.match(/^\/invites\/([^/]+)(\/accept)?$/))) {
    const u = [...users.values()].find((x) => x._inviteToken && x._inviteToken === m[1])
    if (!u) return fail(res, 404, 'not_found', '邀请不存在或已被使用')
    if (u._inviteExpiresAt < now()) return fail(res, 410, 'expired', '邀请已过期')
    if (!m[2] && method === 'GET') return send(res, 200, { email: u.email, name: u.name })
    if (m[2] && method === 'POST') {
      const body = (await readBody(req)) ?? {}
      if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD) return fail(res, 400, 'weak_password', `密码至少 ${MIN_PASSWORD} 位`)
      if (typeof body.name === 'string' && body.name.trim()) u.name = body.name.trim()
      u._password = body.password
      u._inviteToken = null
      u.pending = false
      u.lastLoginAt = now()
      audit({ ...memberActor(u), action: 'member.accept', target: u.email })
      const t = base62(32)
      sessions.set(t, u.id)
      return send(res, 200, { ok: true }, { 'Set-Cookie': `rwd_session=${t}; Path=/; HttpOnly; SameSite=Lax` })
    }
  }

  const user = token ? users.get(sessions.get(token)) : undefined
  if (!user || user.disabled) return fail(res, 401, 'unauthorized', '未登录')

  if (method === 'GET' && path === '/stream') return handleStream(req, res, url, user)

  await sleep(60 + Math.floor(Math.random() * 120))

  if (method === 'GET' && path === '/me') return send(res, 200, memberOut(user))
  if (method === 'GET' && path === '/status') {
    if (statusDown) return fail(res, 503, 'unavailable', '网关不可用（mock）')
    return send(res, 200, gatewayStatus(host))
  }
  if (method === 'GET' && path === '/devices') return send(res, 200, listAllDevices(url))
  if (method === 'POST' && path === '/me/password') {
    const body = (await readBody(req)) ?? {}
    if (body.oldPassword !== user._password) return fail(res, 400, 'bad_password', '当前密码不正确')
    if (typeof body.newPassword !== 'string' || body.newPassword.length < MIN_PASSWORD) return fail(res, 400, 'weak_password', `新密码至少 ${MIN_PASSWORD} 位`)
    user._password = body.newPassword
    return send(res, 200, { ok: true })
  }

  // ---- members ----
  if (path === '/members') {
    if (method === 'GET') {
      if (!isManager(user)) return forbidden(res)
      return send(res, 200, { members: [...users.values()].map(memberOut) })
    }
    if (method === 'POST') {
      if (user.role !== 'owner') return forbidden(res)
      const body = (await readBody(req)) ?? {}
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+$/.test(email)) return fail(res, 400, 'bad_request', '邮箱格式不正确')
      if (!ROLES.includes(body.role)) return fail(res, 400, 'bad_request', '角色不正确')
      if ([...users.values()].some((x) => x.email === email)) return fail(res, 409, 'conflict', '该邮箱已经是成员')
      const u = createUser({ email, name: String(body.name ?? '').trim(), role: body.role, pending: true })
      const inviteUrl = issueMemberInvite(u, host)
      audit({ ...memberActor(user), action: 'member.invite', target: email, detail: { role: u.role } })
      return send(res, 200, { ...memberOut(u), inviteUrl })
    }
  }
  if ((m = path.match(/^\/members\/([^/]+)$/))) {
    if (user.role !== 'owner') return forbidden(res)
    const u = users.get(m[1])
    if (!u) return fail(res, 404, 'not_found', '成员不存在')
    if (u.id === user.id) return fail(res, 400, 'bad_request', '不能修改自己的账号')
    const owners = [...users.values()].filter((x) => x.role === 'owner' && !x.disabled)
    if (method === 'PATCH') {
      const body = (await readBody(req)) ?? {}
      if (body.role !== undefined && !ROLES.includes(body.role)) return fail(res, 400, 'bad_request', '角色不正确')
      if (u.role === 'owner' && owners.length <= 1 && ((body.role && body.role !== 'owner') || body.disabled)) {
        return fail(res, 400, 'last_owner', '至少需要保留一个所有者')
      }
      const before = { role: u.role, disabled: u.disabled }
      if (body.role) u.role = body.role
      if (typeof body.disabled === 'boolean') u.disabled = body.disabled
      if (typeof body.name === 'string') u.name = body.name
      if (u.disabled) for (const [t, id] of sessions) if (id === u.id) sessions.delete(t)
      audit({ ...memberActor(user), action: 'member.update', target: u.email, detail: { before, after: { role: u.role, disabled: u.disabled } } })
      return send(res, 200, memberOut(u))
    }
    if (method === 'DELETE') {
      if (u.role === 'owner' && owners.length <= 1) return fail(res, 400, 'last_owner', '至少需要保留一个所有者')
      users.delete(u.id)
      for (const [t, id] of sessions) if (id === u.id) sessions.delete(t)
      audit({ ...memberActor(user), action: 'member.delete', target: u.email })
      return send(res, 200, { ok: true })
    }
  }

  // ---- audit ----
  if (method === 'GET' && path === '/audit') {
    const q = url.searchParams
    const project = q.get('project')
    const device = q.get('device')?.toLowerCase()
    const actor = q.get('actor')?.toLowerCase()
    const action = q.get('action')
    const from = Number(q.get('from') || 0)
    const to = Number(q.get('to') || 0)
    const before = Number(q.get('before') || 0)
    const limit = Math.min(200, Math.max(1, Number(q.get('limit') || 50)))
    const out = []
    let more = false
    for (let i = auditLog.length - 1; i >= 0; i--) {
      const e = auditLog[i]
      if (before && e.id >= before) continue
      if (project && e.projectId !== project) continue
      if (action && e.action !== action) continue
      if (from && e.at < from) continue
      if (to && e.at > to) continue
      if (device && !(e.target.toLowerCase() === device || String(e.detail?.deviceId ?? '').toLowerCase() === device)) continue
      if (actor && !(e.actorId.toLowerCase().includes(actor) || e.actorName.toLowerCase().includes(actor))) continue
      if (out.length === limit) {
        more = true
        break
      }
      out.push(e)
    }
    return send(res, 200, { events: out, nextBefore: more ? out.at(-1).id : null })
  }

  // ---- projects ----
  if (path === '/projects') {
    if (method === 'GET') return send(res, 200, { projects: [...projects.values()].map(projectOut) })
    if (method === 'POST') {
      if (!isManager(user)) return forbidden(res)
      const body = await readBody(req)
      if (!body?.name?.trim()) return fail(res, 400, 'bad_request', '项目名称不能为空')
      const p = createProject({ name: body.name.trim(), allowedOrigins: body.allowedOrigins ?? [] })
      audit({ projectId: p.id, ...memberActor(user), action: 'project.create', target: p.name })
      return send(res, 200, projectOut(p))
    }
  }

  if ((m = path.match(/^\/projects\/([^/]+)(\/.*)?$/))) {
    const p = projects.get(m[1])
    if (!p) return fail(res, 404, 'not_found', '项目不存在')
    const sub = m[2] ?? ''
    const manager = isManager(user)
    if (sub === '' && method === 'GET') return send(res, 200, projectOut(p))
    if (sub === '' && method === 'PATCH') {
      if (!manager) return forbidden(res)
      const body = (await readBody(req)) ?? {}
      if (body.policy !== undefined) {
        const error = applyPolicy(p, body.policy)
        if (error) return fail(res, 400, 'bad_request', error)
      }
      if (typeof body.name === 'string') p.name = body.name
      if (Array.isArray(body.allowedOrigins)) p.allowedOrigins = body.allowedOrigins
      if (typeof body.disabled === 'boolean') p.disabled = body.disabled
      if (typeof body.inviteUrl === 'string') p.inviteUrl = body.inviteUrl
      const fields = Object.keys(body).flatMap((k) => (k === 'policy' ? Object.keys(body.policy).map((f) => `policy.${f}`) : [k]))
      audit({ projectId: p.id, ...memberActor(user), action: 'project.update', target: p.name, detail: { fields } })
      return send(res, 200, projectOut(p))
    }
    if (sub === '' && method === 'DELETE') {
      if (!manager) return forbidden(res)
      projects.delete(p.id)
      for (const [id, d] of devices) if (d.projectId === p.id) devices.delete(id)
      audit({ projectId: p.id, ...memberActor(user), action: 'project.delete', target: p.name })
      return send(res, 200, { ok: true })
    }
    if (sub === '/rotate-app-key' && method === 'POST') {
      if (!manager) return forbidden(res)
      p.appKey = `rwd_pk_${base62(24)}`
      audit({ projectId: p.id, ...memberActor(user), action: 'project.rotate_app_key', target: p.name })
      return send(res, 200, projectOut(p))
    }
    if (sub === '/integration' && method === 'GET') {
      const list = [...devices.values()].filter((d) => d.projectId === p.id)
      // The simulation brings the first device online ~6 seconds later (and pushes it over SSE).
      if (!list.length && !integrationFirstPoll.has(p.id)) integrationFirstPoll.set(p.id, now())
      const sorted = [...list].sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      const gatewayUrl = `http://${host}/v1`
      return send(res, 200, {
        appKey: p.appKey,
        gatewayUrl,
        sdkUrl: `${gatewayUrl}/sdk.js`,
        firstSeenAt: list.length ? Math.min(...list.map((d) => d.firstSeenAt)) : null,
        onlineDevices: list.filter((d) => d.online).length,
        lastDevice: sorted[0] ? deviceOut(sorted[0]) : null,
      })
    }
    if (sub === '/keys') return keysRoute(req, res, user, method)
    if (sub === '/devices' && method === 'GET') {
      const status = url.searchParams.get('status') ?? 'online'
      let list = [...devices.values()].filter((d) => d.projectId === p.id)
      if (status === 'online') list = list.filter((d) => d.online)
      else if (status === 'waiting') list = list.filter((d) => d.help)
      return send(res, 200, { devices: list.sort(sortDevices).map(deviceOut) })
    }
    if (sub === '/invites' && method === 'GET') {
      return send(res, 200, { invites: [...deviceInvites.values()].filter((i) => i.projectId === p.id).map(inviteOut) })
    }
    if (sub === '/invites' && method === 'POST') {
      if (!manager) return forbidden(res)
      const body = (await readBody(req)) ?? {}
      if (!String(body.note ?? '').trim()) return fail(res, 400, 'bad_request', '备注不能为空')
      const base = String(body.url || p.inviteUrl || '')
      if (!/^https?:\/\//.test(base)) return fail(res, 400, 'bad_request', '没有可用的邀请地址')
      const minutes = body.expiresInMinutes ?? 30
      const t = base62(24)
      const inv = {
        id: `inv_${base62(10)}`,
        note: String(body.note).trim(),
        link: `${base}${base.includes('?') ? '&' : '?'}rwd_invite=${t}`,
        expiresAt: now() + minutes * 60_000,
        usedAt: null,
        deviceId: null,
        createdBy: user.name || user.email,
        projectId: p.id,
        _autoUseAt: now() + 20_000,
      }
      deviceInvites.set(inv.id, inv)
      audit({ projectId: p.id, ...memberActor(user), action: 'invite.create', target: inv.id, detail: { note: inv.note, expiresInMinutes: minutes } })
      return send(res, 200, inviteOut(inv))
    }
  }

  if ((m = path.match(/^\/device-invites\/([^/]+)$/)) && method === 'DELETE') {
    if (!isManager(user)) return forbidden(res)
    const inv = deviceInvites.get(m[1])
    if (!inv) return fail(res, 404, 'not_found', '邀请不存在')
    deviceInvites.delete(inv.id)
    audit({ projectId: inv.projectId, ...memberActor(user), action: 'invite.delete', target: inv.id, detail: { note: inv.note } })
    return send(res, 200, { ok: true })
  }

  // API keys belong to the gateway, not to a project (the project routes are aliases).
  if (path === '/keys') return keysRoute(req, res, user, method)

  if ((m = path.match(/^\/keys\/([^/]+)$/)) && method === 'DELETE') {
    if (!isManager(user)) return forbidden(res)
    const k = keys.get(m[1])
    if (!k) return fail(res, 404, 'not_found', 'Key 不存在')
    k.revokedAt ??= now()
    audit({ projectId: null, ...memberActor(user), action: 'key.revoke', target: k.prefix, detail: { name: k.name } })
    return send(res, 200, { ok: true })
  }

  if ((m = path.match(/^\/devices\/([^/]+)(\/.*)?$/))) {
    const d = devices.get(m[1])
    if (!d) return fail(res, 404, 'not_found', '设备不存在')
    const sub = m[2] ?? ''
    if (sub === '' && method === 'GET') return send(res, 200, deviceDetailOut(d))
    if (sub === '/test' && method === 'POST') {
      if (!d.online) return fail(res, 409, 'device_offline', '设备不在线')
      const latency = 80 + Math.floor(Math.random() * 260)
      await sleep(latency)
      const page = d.pages.find((p) => p.focused) ?? d.pages.find((p) => p.visibility === 'visible') ?? d.pages[0]
      if (!page) return send(res, 200, { ok: false, error: { code: 'no_page', message: '没有可用页面' } })
      if (d.control === 'user') return send(res, 200, { ok: false, error: { code: 'takeover', message: '用户已接管' } })
      pushEvent(d, { at: now(), page: page.label, kind: 'test', summary: '控制台测试连接：快照成功' })
      return send(res, 200, {
        ok: true,
        latencyMs: latency,
        page: { label: page.label, url: page.url, title: page.title },
        snapshot: snapshotFor(page),
      })
    }
    if (sub === '/end' && method === 'POST') {
      if (d.control !== 'none') pushEvent(d, { at: now(), page: null, kind: 'agent_disconnect', summary: `${user.name || user.email} 在控制台结束了调试，agent 已断开` })
      d.control = 'none'
      d.agent = null
      d.level = null
      d.pending = null
      d.help = false
      d.pages.forEach((p) => (p.focused = false))
      audit({ projectId: d.projectId, ...memberActor(user), action: 'device.end', target: d.code, detail: { deviceId: d.id } })
      syncDevice(d)
      return send(res, 200, { ok: true })
    }
  }

  return fail(res, 404, 'not_found', `未知接口 ${method} ${path}`)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function serveStatic(req, res, url, distDir) {
  const index = join(distDir, 'index.html')
  if (!existsSync(index)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('dist/ not found — run `npm run build` first.')
  }
  let file = normalize(join(distDir, decodeURIComponent(url.pathname)))
  if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) file = index
  const immutable = file.includes(`${join(distDir, 'assets')}`)
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).pipe(res)
}

export function startServer({ port = Number(process.env.PORT ?? 4180), distDir = join(here, '..', 'dist') } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    try {
      if (url.pathname.startsWith('/v1/api/') || url.pathname === '/v1/api') return await handleApi(req, res, url)
      if (url.pathname === '/v1/healthz') return send(res, 200, { ok: true, version: VERSION })
      if (url.pathname === '/v1/sdk.js' || url.pathname === `/v1/sdk/${SDK_VERSION}/sdk.js`) {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
        return res.end(SDK_BODY)
      }
      if (url.pathname === '/__mock/status' && req.method === 'POST') {
        statusDown = url.searchParams.get('down') === '1'
        return send(res, 200, { statusDown })
      }
      if (url.pathname === '/__mock/sse' && req.method === 'POST') {
        sseDown = url.searchParams.get('down') === '1'
        if (sseDown) for (const c of streams) c.res.end()
        return send(res, 200, { sseDown })
      }
      if (url.pathname.startsWith('/v1/')) return fail(res, 404, 'not_found', 'mock 不支持该地址')
      return serveStatic(req, res, url, distDir)
    } catch (err) {
      console.error(err)
      fail(res, 500, 'internal', String(err))
    }
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const server = await startServer()
  const { port } = server.address()
  console.log(`RWD mock gateway on http://localhost:${port}`)
  console.log(`  owner  admin@example.com / ${PASSWORD}`)
  console.log('  admin  ops@example.com / ops12345')
  console.log('  member support@example.com / support123')
}
