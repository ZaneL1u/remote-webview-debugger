#!/usr/bin/env node
// Drives the built console against the mock API with Playwright, screenshots every page at
// desktop and mobile widths (plus a few in dark mode, in English, Japanese and Arabic) and fails on
// unexpected console errors. The main pass runs in Chinese (a zh-CN browser); the English pass uses an
// en-US browser and also checks the language switcher and the language sent to the gateway; the last
// pass picks Japanese and Arabic from the browser and checks the right-to-left layout.
//
//   npm run build && npm run test:e2e
//
// Screenshots land in mock/screenshots/.

import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import { startServer } from './server.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'screenshots')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const server = await startServer({ port: 0 })
const base = `http://localhost:${server.address().port}`
const browser = await chromium.launch()

const problems = []
const shots = []

const viewports = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]

// Deliberate failures: 401 on /me before login and on a wrong password, 503 on the SSE stream while the
// mock has it switched off, 503 on /status while the mock reports the gateway down, 400 on a wrong current
// password, 404 on a bogus member invite.
const expectedFailures = [
  [401, /\/v1\/api\/me$/],
  [401, /\/v1\/api\/auth\/login$/],
  // The gateway-status poll in flight whenever a session ends.
  [401, /\/v1\/api\/status$/],
  [503, /\/v1\/api\/stream(\?|$)/],
  [503, /\/v1\/api\/status$/],
  [400, /\/v1\/api\/me\/password$/],
  [404, /\/v1\/api\/invites\/[^/]+$/],
]
// From logging out until the next login, any API call still in flight (such as the device and project
// lists of the page just left) may come back 401.
const loggedOut = new WeakSet()
function isExpected(page, msg) {
  const url = msg.location()?.url ?? ''
  if (loggedOut.has(page) && msg.text().includes('status of 401') && /\/v1\/api\//.test(url)) return true
  return expectedFailures.some(([status, re]) => msg.text().includes(`status of ${status}`) && re.test(url))
}

async function mockSse(down) {
  await fetch(`${base}/__mock/sse?down=${down ? 1 : 0}`, { method: 'POST' })
}

async function mockStatus(down) {
  await fetch(`${base}/__mock/status?down=${down ? 1 : 0}`, { method: 'POST' })
}

const visible = (locator) => locator.filter({ visible: true }).first()

async function newPage(vp, colorScheme = 'light', locale = 'zh-CN') {
  const ctx = await browser.newContext({ ...vp, colorScheme, locale, timezoneId: 'Asia/Shanghai' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  const page = await ctx.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isExpected(page, msg)) problems.push(`[${vp.name}/${colorScheme}] console: ${msg.text()} @ ${msg.location()?.url}`)
  })
  page.on('pageerror', (err) => problems.push(`[${vp.name}/${colorScheme}] pageerror: ${err.message}`))
  return { ctx, page }
}

async function shot(page, name, { fullPage = true } = {}) {
  // let toasts / transitions settle
  await page.waitForTimeout(350)
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage })
  shots.push(file)
}

async function login(page, email = 'admin@example.com', password = 'admin') {
  loggedOut.delete(page)
  await page.goto(`${base}/`)
  await page.waitForURL(/\/login/)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL(`${base}/`)
  await page.getByRole('heading', { name: '设备', exact: true }).waitFor()
}

async function logout(page) {
  await page.getByRole('button', { name: '账号菜单' }).click()
  loggedOut.add(page)
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await page.waitForURL(/\/login/)
}

async function run(vp) {
  const n = vp.name
  const { ctx, page } = await newPage(vp)

  // 1. login (wrong password first)
  await page.goto(`${base}/projects/whatever`)
  await page.waitForURL(/\/login\?redirect=/)
  await page.getByLabel('密码').waitFor()
  await shot(page, `${n}-01-login`)
  await page.getByLabel('邮箱').fill('admin@example.com')
  await page.getByLabel('密码').fill('wrong')
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByText('邮箱或密码不正确').waitFor()
  await shot(page, `${n}-02-login-error`)
  await page.goto(`${base}/`)
  await login(page)

  // 2. device-first home, gateway status, integration guide
  await devicesHome(page, n)
  await gatewayStatus(page, n)
  await docs(page, n)

  // project list
  await page.goto(`${base}/projects`)
  await page.getByText('商城 App').waitFor()
  await shot(page, `${n}-03-projects`)

  // 3. create project dialog
  await page.getByRole('button', { name: '新建项目' }).first().click()
  await page.getByLabel('项目名称').fill(`测试项目 ${n}`)
  await page.getByLabel(/允许的域名/).fill('https://m.test.example.com')
  await shot(page, `${n}-04-create-project`, { fullPage: false })
  await page.getByRole('button', { name: '创建' }).click()
  await page.waitForURL(/\/projects\/prj_[^/?]+\?tab=integration/)
  const newProjectUrl = page.url().split('?')[0]

  // 4. empty device list for the brand-new project, before any integration polling
  await page.goto(`${newProjectUrl}?tab=devices`)
  await page.getByText('还没有设备上线过').or(page.getByText('暂无在线设备')).filter({ visible: true }).first().waitFor()
  await shot(page, `${n}-05-devices-empty`)

  // 5. integration: waiting -> online -> test
  await page.goto(`${newProjectUrl}?tab=integration`)
  await page.getByText('等待第一台设备上线').waitFor()
  await shot(page, `${n}-06-integration-waiting`)
  await page.getByText('设备在线', { exact: true }).waitFor({ timeout: 15_000 })
  await page.getByText('当前页面').filter({ visible: true }).first().waitFor()
  await page.waitForTimeout(500)
  await shot(page, `${n}-07-integration-online`)
  await page.getByRole('button', { name: '测试连接' }).click()
  await page.getByText('连接正常').waitFor()
  await shot(page, `${n}-08-integration-tested`)

  // iOS / Android snippet tabs
  await page.getByRole('tab', { name: 'iOS（Swift）' }).click()
  await page.getByText('WKUserScript(source').waitFor()
  await shot(page, `${n}-09-integration-ios`)
  await page.getByRole('tab', { name: 'Android（Kotlin）' }).click()
  await page.getByText('addDocumentStartJavaScript(webView').waitFor()

  // pinned SDK version with SRI (section 16)
  await page.getByRole('tab', { name: 'H5 页面' }).click()
  await page.getByRole('button', { name: /固定版本/ }).click()
  await page.getByText(/integrity="sha384-/).waitFor()
  await shot(page, `${n}-09b-integration-pinned`)

  // copy to clipboard toast
  await page.getByRole('button', { name: '复制' }).first().click()
  await page.getByText('已复制到剪贴板').filter({ visible: true }).first().waitFor()

  // rotate app key confirm
  await page.getByRole('button', { name: '轮换 Key' }).click()
  await page.getByText('轮换接入 Key？').waitFor()
  await shot(page, `${n}-10-rotate-confirm`, { fullPage: false })
  await page.getByRole('button', { name: '确认轮换' }).click()
  await page.getByText('接入 Key 已轮换').filter({ visible: true }).first().waitFor()

  // edit allowed origins
  await page.getByRole('button', { name: '编辑' }).click()
  await page.getByLabel('允许的域名').fill('https://m.test.example.com\nnot a url')
  await page.getByRole('button', { name: '保存' }).click()
  await page.getByText(/格式不正确/).waitFor()
  await page.getByLabel('允许的域名').fill('https://m.test.example.com\nhttps://*.test.example.com')
  await page.getByRole('button', { name: '保存' }).click()
  await page.getByText('允许的域名已保存').filter({ visible: true }).first().waitFor()

  // 6. demo project devices
  await page.goto(`${base}/projects`)
  await page.getByText('商城 App').click()
  await page.getByRole('tab', { name: '设备' }).waitFor()
  await page.getByText('协助中').filter({ visible: true }).first().waitFor()
  await visible(page.getByText('等待用户确认')).waitFor()
  await visible(page.getByText('邀请接入')).waitFor()
  await visible(page.locator('[data-stream="live"]')).waitFor({ timeout: 15_000 })
  await shot(page, `${n}-11-devices`)
  await page.getByRole('radio', { name: '全部' }).or(page.getByRole('button', { name: '全部' })).first().click()
  await page.waitForTimeout(600)
  await shot(page, `${n}-12-devices-all`)

  // SSE down -> polling fallback indicator -> back to live
  await mockSse(true)
  await visible(page.locator('[data-stream="down"]')).waitFor({ timeout: 15_000 })
  await shot(page, `${n}-12b-devices-polling`, { fullPage: false })
  await mockSse(false)
  await visible(page.locator('[data-stream="live"]')).waitFor({ timeout: 40_000 })

  // device waiting for the user's approval
  await (n === 'desktop' ? page.locator('tr', { hasText: '等待用户确认' }) : page.locator('li a', { hasText: '等待用户确认' })).first().click()
  await page.waitForURL(/\/devices\//)
  await page.getByText(/申请接入，等待用户在设备上确认/).waitFor()
  await shot(page, `${n}-12c-device-pending`)
  await page.goBack()

  // 12d. device invites
  await page.getByRole('tab', { name: '邀请' }).click()
  await visible(page.getByText('工单 #4821 支付后页面空白')).waitFor()
  await shot(page, `${n}-12d-invites`)
  await page.getByRole('button', { name: '创建邀请' }).first().click()
  await page.getByLabel('备注').fill(`工单 #5001 ${n} 无法下单`)
  await page.getByRole('button', { name: '2 小时' }).click()
  await shot(page, `${n}-12e-invite-create`, { fullPage: false })
  await page.getByRole('button', { name: '生成邀请' }).click()
  await page.getByText('邀请二维码').waitFor()
  await page.getByTestId('qr-code').waitFor()
  await shot(page, `${n}-12f-invite-qr`, { fullPage: false })
  await page.getByRole('button', { name: '完成' }).click()
  await page.getByText('邀请二维码').waitFor({ state: 'detached' })
  await visible(page.getByText(`工单 #5001 ${n} 无法下单`)).waitFor()
  // delete the expired invite (desktop) / the new one (mobile)
  const toDelete = n === 'desktop' ? '工单 #4702 地址保存失败' : `工单 #5001 ${n} 无法下单`
  await page.locator('li', { hasText: toDelete }).getByRole('button', { name: '删除邀请' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click()
  await visible(page.getByText('邀请已删除')).waitFor()

  // 7. API keys (gateway-wide, their own page)
  const projectUrl = page.url()
  await page.goto(`${base}/keys`)
  await page.getByText('客服机器人').filter({ visible: true }).first().waitFor()
  await shot(page, `${n}-13-keys`)
  await visible(page.getByText('已过期')).waitFor()
  await page.getByRole('button', { name: '创建 Key' }).first().click()
  await page.getByLabel('名称').fill('排障 agent')
  await page.getByRole('dialog').getByText('高级', { exact: true }).click()
  await page.getByText(/高级级别可以在用户页面里执行任意 JS/).waitFor()
  await page.getByRole('button', { name: '永不过期' }).click()
  await page.getByText(/永不过期的 Key 一旦泄露/).waitFor()
  await page.getByLabel(/IP 白名单/).fill('203.0.113.0/24\n10.0.0.300')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await page.getByText(/IP 白名单格式不正确：10.0.0.300/).waitFor()
  await shot(page, `${n}-14a-key-create-form`, { fullPage: false })
  await page.getByLabel(/IP 白名单/).fill('203.0.113.0/24\n198.51.100.7')
  await page.getByRole('button', { name: '30 天' }).click()
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await page.getByText('这是唯一一次显示完整 Key').waitFor()
  await page.getByRole('dialog').getByText('203.0.113.0/24').waitFor()
  await shot(page, `${n}-14-key-created`, { fullPage: false })
  // pressing Escape must not close the dialog while the plaintext key is shown
  await page.keyboard.press('Escape')
  await page.getByText('这是唯一一次显示完整 Key').waitFor()
  await page.getByRole('button', { name: '我已保存，关闭' }).click()
  await page.getByText('这是唯一一次显示完整 Key').waitFor({ state: 'detached' })
  // revoke
  const revoke = page.getByRole('button', { name: '吊销' }).first()
  await revoke.click()
  await page.getByText(/MCP 会话会立即失效/).waitFor()
  await shot(page, `${n}-15-revoke-confirm`, { fullPage: false })
  await page.getByRole('alertdialog').getByRole('button', { name: '吊销' }).click()
  await page.getByText(/已吊销「/).filter({ visible: true }).first().waitFor()
  await page.goto(projectUrl)

  // 8. settings
  await page.getByRole('tab', { name: '设置' }).click()
  await page.getByText('删除项目').filter({ visible: true }).first().waitFor()
  await page.getByText('接入策略', { exact: true }).waitFor()
  await shot(page, `${n}-16-settings`)
  // invalid selector is flagged immediately
  const maskSelectors = page.getByLabel('遮盖元素（CSS 选择器）')
  await maskSelectors.fill('.user-phone\n##bad')
  await page.getByText(/不是合法的 CSS 选择器：##bad/).waitFor()
  await maskSelectors.fill('.user-phone\n[name="idCard"]')
  // add a preset, then a rule with an unsupported regex
  const idPreset = page.getByRole('button', { name: '身份证号' })
  if (await idPreset.isEnabled()) await idPreset.click()
  await page.getByRole('button', { name: '添加规则' }).click()
  await page.getByLabel(/条规则名称/).last().fill(`订单号 ${n}`)
  await page.getByLabel(/条规则正则/).last().fill('(?<=NO\\.)\\d+')
  await page.getByText(/^不支持环视/).waitFor()
  await page.getByText('有未保存的更改').waitFor()
  await page.getByRole('button', { name: '保存策略' }).click()
  await visible(page.getByText('有设置不正确')).waitFor()
  await page.getByRole('heading', { name: '隐私遮盖' }).scrollIntoViewIfNeeded()
  await shot(page, `${n}-16b-policy-invalid`, { fullPage: false })
  await page.getByLabel(/条规则正则/).last().fill(`${n === 'desktop' ? 'D' : 'M'}\\d{8}`)
  await page.getByText(/^不支持环视/).waitFor({ state: 'detached' })
  await page.getByRole('heading', { name: '协助入口' }).scrollIntoViewIfNeeded()
  await page.getByText('指定用户', { exact: true }).click()
  await page.getByLabel('允许的 userId').fill('u_20391\nu_77812')
  await page.getByRole('button', { name: '保存策略' }).click()
  await visible(page.getByText('接入策略已保存')).waitFor()
  await page.getByText('所有更改已保存').waitFor()
  await shot(page, `${n}-16c-policy-saved`)

  // 9. device detail (the device being assisted)
  await page.getByRole('tab', { name: '设备' }).click()
  await page.getByText('协助中').filter({ visible: true }).first().waitFor()
  if (n === 'desktop') {
    await page.locator('tr', { hasText: '协助中' }).first().click()
  } else {
    await page.locator('li a', { hasText: '协助中' }).first().click()
  }
  await page.waitForURL(/\/devices\//)
  await page.getByText('时间线').waitFor()
  await shot(page, `${n}-17-device-detail`)
  await page.getByRole('button', { name: '测试连接' }).click()
  await page.getByText('连接正常').waitFor()
  await shot(page, `${n}-18-device-test`, { fullPage: false })
  await page.keyboard.press('Escape')

  // device under agent control -> end debugging
  await page.goBack()
  await page.getByText('AI 操作中').or(page.getByText('AI 查看中')).filter({ visible: true }).first().waitFor()
  if (n === 'desktop') {
    await page.locator('tr', { hasText: /AI 操作中|AI 查看中/ }).first().click()
  } else {
    await page.locator('li a', { hasText: /AI 操作中|AI 查看中/ }).first().click()
  }
  await page.waitForURL(/\/devices\//)
  await page.getByText('接入方').waitFor()
  await shot(page, `${n}-19-device-agent`)
  await page.getByRole('button', { name: '结束调试' }).click()
  await page.getByText('会立即断开当前接入的 agent').waitFor()
  await page.getByRole('alertdialog').getByRole('button', { name: '结束调试' }).click()
  await page.getByText('已结束调试').filter({ visible: true }).first().waitFor()

  // 9b. project audit log: filter, expand, load more
  await page.goBack()
  await page.getByRole('tab', { name: '审计' }).click()
  const auditList = page.getByRole('list', { name: '审计记录' })
  await auditList.waitFor()
  await shot(page, `${n}-19b-audit`)
  await page.getByLabel('操作类型').selectOption('rpc')
  await page.getByText('清除筛选').first().waitFor()
  await visible(auditList.getByText('页面操作')).waitFor()
  await auditList.getByRole('button').first().click()
  await page.getByText('记录 ID').waitFor()
  await shot(page, `${n}-19c-audit-filtered`)
  const before = await auditList.locator(':scope > li').count()
  await page.getByRole('button', { name: '加载更多' }).click()
  await page.waitForFunction(
    ([sel, count]) => document.querySelectorAll(sel).length > count,
    ['ul[aria-label="审计记录"] > li', before],
  )

  // 9c. organization-wide audit
  await page.goto(`${base}/audit`)
  await page.getByRole('heading', { name: '审计日志' }).waitFor()
  await page.getByRole('list', { name: '审计记录' }).waitFor()
  await page.getByLabel('项目', { exact: true }).selectOption({ label: '商城 App' })
  await page.waitForTimeout(500)
  await shot(page, `${n}-19d-audit-org`)

  // 9d. members: invite (link + QR), change role, disable, enable, delete
  await page.goto(`${base}/members`)
  await page.getByRole('heading', { name: '成员', exact: true }).waitFor()
  await visible(page.getByText('support@example.com')).waitFor()
  await shot(page, `${n}-19e-members`)
  const inviteUrl = await inviteMember(page, `new-${n}@example.com`, `测试成员 ${n}`, '成员', `${n}-19f-member-invited`)
  await inviteMember(page, `tmp-${n}@example.com`, `临时成员 ${n}`, '成员')
  const tmpRow = n === 'desktop' ? page.locator('tr', { hasText: `tmp-${n}@example.com` }) : page.locator('li', { hasText: `tmp-${n}@example.com` })
  await tmpRow.getByRole('button', { name: /修改「.*」的角色/ }).click()
  await page.getByRole('menuitemradio', { name: /^管理员/ }).waitFor()
  await shot(page, `${n}-19g-member-role-menu`, { fullPage: false })
  await page.getByRole('menuitemradio', { name: /^管理员/ }).click()
  await visible(page.getByText(`已把「临时成员 ${n}」设为管理员`)).waitFor()
  await tmpRow.getByRole('button', { name: '停用' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '停用' }).click()
  await visible(page.getByText(`已停用「临时成员 ${n}」`)).waitFor()
  await tmpRow.getByRole('button', { name: '启用' }).click()
  await visible(page.getByText(`已启用「临时成员 ${n}」`)).waitFor()
  await tmpRow.getByRole('button', { name: /删除「/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click()
  await visible(page.getByText(`已删除「临时成员 ${n}」`)).waitFor()

  // 9e. the invited member accepts in a fresh browser and lands as a read-only member
  await acceptInvite(vp, inviteUrl, n)

  // 10. unknown route
  await page.goto(`${base}/nope`)
  await page.getByText('页面不存在').waitFor()
  await shot(page, `${n}-20-not-found`, { fullPage: false })

  // 11. logout -> back to login, protected page redirects
  await page.goto(`${base}/`)
  await logout(page)

  await ctx.close()
}

async function inviteMember(page, email, name, roleLabel, shotName) {
  await page.getByRole('button', { name: '邀请成员' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('邮箱').fill(email)
  await dialog.getByLabel('名字').fill(name)
  await dialog.getByText(roleLabel, { exact: true }).click()
  await dialog.getByRole('button', { name: '生成邀请链接' }).click()
  await page.getByText('邀请链接已生成').waitFor()
  await page.getByTestId('qr-code').waitFor()
  const url = (await dialog.locator('pre code').innerText()).trim()
  if (shotName) await shot(page, shotName, { fullPage: false })
  await page.getByRole('button', { name: '我已复制，关闭' }).click()
  await page.getByText('邀请链接已生成').waitFor({ state: 'detached' })
  return url
}

async function acceptInvite(vp, inviteUrl, n) {
  const { ctx, page } = await newPage(vp)

  // a bogus token first
  await page.goto(`${base}/invite/not-a-token`)
  await page.getByText('邀请链接无效或已过期').waitFor()
  await shot(page, `${n}-21-invite-invalid`, { fullPage: false })

  await page.goto(inviteUrl)
  await page.getByText('设置你的账号').waitFor()
  await shot(page, `${n}-22-invite-accept`)
  await page.getByLabel('密码', { exact: true }).fill('member-pass-1')
  await page.getByLabel('确认密码').fill('member-pass-2')
  await page.getByRole('button', { name: '接受邀请并登录' }).click()
  await page.getByText('两次输入的密码不一致').waitFor()
  await page.getByLabel('确认密码').fill('member-pass-1')
  await page.getByRole('button', { name: '接受邀请并登录' }).click()
  await page.waitForURL(`${base}/`)
  await page.getByRole('heading', { name: '设备', exact: true }).waitFor()
  await rowsVisible(page)
  await page.goto(`${base}/projects`)
  await page.getByRole('heading', { name: '项目', exact: true }).waitFor()
  await page.getByText('商城 App').waitFor()
  if (await page.getByRole('button', { name: '新建项目' }).count()) throw new Error('member should not see 新建项目')
  await shot(page, `${n}-23-member-projects`)

  // read-only policy, no destructive cards, keys without create/revoke
  await page.getByText('商城 App').click()
  await page.getByRole('tab', { name: '设置' }).click()
  await page.getByText('你的角色只能查看接入策略').waitFor()
  if (await page.getByText('删除项目').count()) throw new Error('member should not see 删除项目')
  await shot(page, `${n}-24-member-settings`)
  await page.goto(`${base}/keys`)
  await page.getByText(/你的角色只能查看 Key/).waitFor()
  if (await page.getByRole('button', { name: '创建 Key' }).count()) throw new Error('member should not see 创建 Key')

  // members page is not for members
  await page.goto(`${base}/members`)
  await page.getByText('没有权限').waitFor()
  await shot(page, `${n}-25-member-forbidden`, { fullPage: false })

  // change own password (wrong current password first)
  await page.getByRole('button', { name: '账号菜单' }).click()
  await page.getByRole('menuitem', { name: '修改密码' }).click()
  await page.getByLabel('当前密码').fill('nope-nope')
  await page.getByLabel('新密码', { exact: true }).fill('member-pass-new')
  await page.getByLabel('确认新密码').fill('member-pass-new')
  await page.getByRole('dialog').getByRole('button', { name: '修改密码' }).click()
  await page.getByText('当前密码不正确').waitFor()
  await shot(page, `${n}-26-change-password`, { fullPage: false })
  await page.getByLabel('当前密码').fill('member-pass-1')
  await page.getByRole('dialog').getByRole('button', { name: '修改密码' }).click()
  await visible(page.getByText('密码已修改')).waitFor()
  await logout(page)
  await login(page, `new-${n}@example.com`, 'member-pass-new')

  await ctx.close()
}

const rowSel = '[data-device-row], [data-device-card]'

async function rowsVisible(page) {
  await visible(page.locator(rowSel)).waitFor()
}

async function visibleRows(page) {
  return page.locator(rowSel).filter({ visible: true })
}

async function totalShown(page) {
  const text = await page.getByTestId('device-total').innerText()
  return Number(text.match(/(\d+)/)?.[1] ?? NaN)
}

async function waitTotal(page, predicate, timeout = 10_000) {
  const start = Date.now()
  for (;;) {
    const t = await totalShown(page).catch(() => NaN)
    if (predicate(t)) return t
    if (Date.now() - start > timeout) throw new Error(`device total ${t} did not match`)
    await page.waitForTimeout(150)
  }
}

/** The device-first home page (docs/protocol.md section 12.5). */
async function devicesHome(page, n) {
  await rowsVisible(page)
  const online = await waitTotal(page, (t) => t > 20)
  if (online < 30) throw new Error(`expected ~45 online devices, got ${online}`)
  await page.waitForTimeout(400)
  await shot(page, `${n}-03a-devices-home`, { fullPage: n === 'desktop' })
  await shot(page, `${n}-03a-devices-home-full`)

  // paging: page 2, then page size 50
  await page.getByRole('button', { name: '下一页' }).click()
  await page.waitForURL(/[?&]page=2/)
  await page.getByTestId('pagination-summary').filter({ hasText: '第 21–' }).waitFor()
  if ((await (await visibleRows(page)).count()) < 1) throw new Error('page 2 is empty')
  await shot(page, `${n}-03b-devices-page2`, { fullPage: false })
  await page.getByLabel('每页数量').selectOption('50')
  await page.waitForURL((u) => u.searchParams.get('pageSize') === '50' && !u.searchParams.has('page'))
  await page.getByTestId('pagination-summary').filter({ hasText: /^第 1–\d+ 台/ }).waitFor()
  await page.getByLabel('每页数量').selectOption('20')
  await page.waitForURL((u) => !u.searchParams.has('pageSize'))

  // search by (part of) a device id, then copy the id and the code
  const firstId = await visible(page.getByTestId('device-id')).getAttribute('title')
  const search = page.getByRole('searchbox', { name: '搜索设备' })
  await search.fill(firstId.slice(0, 13))
  await page.waitForURL((u) => u.searchParams.get('q') === firstId.slice(0, 13))
  await waitTotal(page, (t) => t === 1)
  const row = visible(page.locator(rowSel))
  if ((await row.locator('[data-testid="device-id"]').getAttribute('title')) !== firstId) throw new Error('search by id found another device')
  await shot(page, `${n}-03c-devices-search-id`, { fullPage: false })
  await row.getByRole('button', { name: '复制设备 ID' }).click()
  await visible(page.getByText('设备 ID 已复制')).waitFor()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  if (copied !== firstId) throw new Error(`copied ${copied}, expected ${firstId}`)
  await row.getByRole('button', { name: '复制设备码' }).click()
  await visible(page.getByText(/设备码 .+ 已复制/)).waitFor()
  const code = await page.evaluate(() => navigator.clipboard.readText())
  if (!/^[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(code)) throw new Error(`copied code ${code}`)

  // the code matches without its dash
  await search.fill('gsjhev2j')
  await visible(page.locator('[data-device-row="GSJH-EV2J"], [data-device-card="GSJH-EV2J"]')).waitFor()
  await waitTotal(page, (t) => t === 1)

  // nothing matches -> empty state -> clear
  await search.fill('zz-no-such-device')
  await page.getByText('没有匹配「zz-no-such-device」的设备').waitFor()
  await shot(page, `${n}-03d-devices-no-match`, { fullPage: false })
  await page.getByRole('button', { name: '清除筛选' }).last().click()
  await page.waitForURL((u) => !u.searchParams.has('q'))
  await waitTotal(page, (t) => t > 20)

  // online -> all devices
  await page.getByRole('button', { name: '全部设备' }).click()
  await page.waitForURL(/[?&]status=all/)
  const all = await waitTotal(page, (t) => t > online)
  await visible(page.getByText(/^离线 · /)).waitFor()
  await shot(page, `${n}-03e-devices-all`, { fullPage: false })
  if (all <= online) throw new Error('all devices should include offline ones')
  await page.getByRole('button', { name: '在线', exact: true }).click()
  await page.waitForURL((u) => !u.searchParams.has('status'))

  // filter by project
  await page.getByLabel('按项目筛选').selectOption({ label: '会员中心' })
  await page.waitForURL(/[?&]project=/)
  await waitTotal(page, (t) => t > 0 && t < online)
  await page.getByLabel('按项目筛选').selectOption({ label: '全部项目' })
  await page.waitForURL((u) => !u.searchParams.has('project'))

  // a row opens the device; 返回 keeps the list's filters
  await page.goto(`${base}/?page=2`)
  await rowsVisible(page)
  await visible(page.locator(rowSel)).click({ position: { x: 280, y: 30 } })
  await page.waitForURL(/\/devices\/[0-9a-f-]+$/)
  await page.getByText('时间线').waitFor()
  await page.getByText('设备 ID', { exact: true }).waitFor()
  await page.getByRole('link', { name: '全部设备' }).click()
  await page.waitForURL(/\/\?page=2$/)
  await rowsVisible(page)
  await page.goto(`${base}/`)
  await rowsVisible(page)
}

/** Header connection indicator: connected, SSE down (degraded, polling) and gateway unreachable. */
async function gatewayStatus(page, n) {
  const pill = page.locator('header [data-gateway]')
  await page.locator('header [data-gateway="connected"]').waitFor({ timeout: 20_000 })
  await pill.click()
  const details = page.getByTestId('gateway-status-details')
  await details.getByText('网关已连接').waitFor()
  await details.getByText('SSE 实时').waitFor()
  await details.getByText('0.2.0-mock').waitFor()
  await shot(page, `${n}-03f-status-popover`, { fullPage: false })
  await page.keyboard.press('Escape')

  await mockSse(true)
  await page.locator('header [data-gateway="degraded"]').waitFor({ timeout: 15_000 })
  await visible(page.locator('[data-stream="down"]')).waitFor()
  await pill.click()
  await details.getByText('轮询中').waitFor()
  await details.getByText(/实时推送已断开/).waitFor()
  await shot(page, `${n}-03g-status-degraded`, { fullPage: false })
  await page.keyboard.press('Escape')
  await mockSse(false)
  await page.locator('header [data-gateway="connected"]').waitFor({ timeout: 40_000 })

  await mockStatus(true)
  await pill.click()
  await details.getByRole('button', { name: '检查' }).click()
  await page.locator('header [data-gateway="disconnected"]').waitFor({ timeout: 20_000 })
  await details.getByText('网关已断开').waitFor()
  await shot(page, `${n}-03h-status-disconnected`, { fullPage: false })
  await mockStatus(false)
  await details.getByRole('button', { name: '检查' }).click()
  await page.locator('header [data-gateway="connected"]').waitFor({ timeout: 20_000 })
  await page.keyboard.press('Escape')
}

/** 接入说明: reachable from the header, personalised with the gateway URL and a project's App Key. */
async function docs(page, n) {
  await page.locator('header').getByRole('link', { name: '接入说明' }).click()
  await page.waitForURL(/\/docs$/)
  await page.getByRole('heading', { name: /从一行脚本/ }).waitFor()
  const gateway = `${base}/v1`
  await page.getByText(`<script src="${gateway}/sdk.js"></script>`).first().waitFor()
  await page.getByRole('combobox', { name: '选择项目' }).waitFor()
  const appKey = await page.locator('span[title^="rwd_pk_"]').first().getAttribute('title')
  if (!appKey?.startsWith('rwd_pk_')) throw new Error('docs should show a project App Key')
  await page.getByText(appKey).nth(1).waitFor()
  await shot(page, `${n}-03i-docs`, { fullPage: false })
  // pick another project: the snippets follow
  await page.getByRole('combobox', { name: '选择项目' }).selectOption({ label: '会员中心' })
  await page.waitForFunction((k) => !document.body.innerText.includes(k), appKey)
  await page.getByText(`claude mcp add --transport http rwd ${gateway}/mcp`).first().waitFor()
  for (const tool of ['wait_for_event', 'find_elements', 'batch_actions', 'get_storage']) await page.getByText(tool, { exact: true }).first().waitFor()
  if (n === 'desktop') {
    await page.getByRole('navigation', { name: '目录' }).first().getByRole('link', { name: 'MCP 工具一览' }).click()
    await page.waitForURL(/#tools$/)
  } else {
    await page.goto(`${base}/docs#tools`)
  }
  await page.waitForTimeout(400)
  await shot(page, `${n}-03j-docs-tools`, { fullPage: false })
  await page.goto(`${base}/docs#native`)
  await page.getByRole('tab', { name: 'Android（Kotlin，参考）' }).click()
  await page.getByText(/addDocumentStartJavaScript\(webView, boot/).waitFor()
  await page.getByRole('tab', { name: 'iOS（Swift）' }).click()
  await page.getByText(/rwdScreenshot/).first().waitFor()
  await shot(page, `${n}-03k-docs-native`, { fullPage: false })
  await shot(page, `${n}-03l-docs-full`)
  await page.goto(`${base}/`)
  await rowsVisible(page)
}

async function runDark(vp) {
  const { ctx, page } = await newPage(vp, 'dark')
  await login(page)
  await rowsVisible(page)
  await shot(page, `${vp.name}-dark-devices-home`)
  await page.locator('header [data-gateway]').click()
  await page.getByTestId('gateway-status-details').waitFor()
  await shot(page, `${vp.name}-dark-status-popover`, { fullPage: false })
  await page.keyboard.press('Escape')
  await page.goto(`${base}/docs#mcp`)
  await page.getByText('batch_actions').first().waitFor()
  await shot(page, `${vp.name}-dark-docs-mcp`, { fullPage: false })
  await page.goto(`${base}/projects`)
  await page.getByText('商城 App').waitFor()
  await shot(page, `${vp.name}-dark-projects`)
  await page.getByText('商城 App').click()
  await page.getByText('协助中').filter({ visible: true }).first().waitFor()
  await shot(page, `${vp.name}-dark-devices`)
  await page.getByRole('tab', { name: '接入' }).click()
  await page.getByText('设备在线').or(page.getByText('设备已离线')).filter({ visible: true }).first().waitFor()
  await shot(page, `${vp.name}-dark-integration`)
  await page.getByRole('tab', { name: '设备' }).click()
  await page.getByText('协助中').filter({ visible: true }).first().waitFor()
  await (vp.name === 'desktop' ? page.locator('tr', { hasText: '协助中' }) : page.locator('li a', { hasText: '协助中' })).first().click()
  await page.getByText('时间线').waitFor()
  await shot(page, `${vp.name}-dark-device-detail`)
  await page.goBack()
  await page.getByRole('tab', { name: '设置' }).click()
  await page.getByText('接入策略', { exact: true }).waitFor()
  await shot(page, `${vp.name}-dark-settings`)
  await page.getByRole('tab', { name: '邀请' }).click()
  await visible(page.getByText('工单 #4821 支付后页面空白')).waitFor()
  await page.locator('li', { hasText: '工单 #4821 支付后页面空白' }).getByRole('button', { name: '二维码' }).click()
  await page.getByTestId('qr-code').waitFor()
  await shot(page, `${vp.name}-dark-invite-qr`, { fullPage: false })
  await page.getByRole('button', { name: '完成' }).click()
  await page.goto(`${base}/keys`)
  await visible(page.getByText('已过期')).waitFor()
  await shot(page, `${vp.name}-dark-keys`)
  await page.goBack()
  await page.getByRole('tab', { name: '审计' }).click()
  await page.getByRole('list', { name: '审计记录' }).getByRole('button').first().click()
  await page.getByText('记录 ID').waitFor()
  await shot(page, `${vp.name}-dark-audit`)
  await page.goto(`${base}/members`)
  await visible(page.getByText('support@example.com')).waitFor()
  await shot(page, `${vp.name}-dark-members`)
  await ctx.close()
}

/** English UI: an en-US browser gets English, the switcher flips to Chinese and back, API calls follow. */
async function runEnglish(vp) {
  const n = `${vp.name}-en`
  const { ctx, page } = await newPage(vp, 'light', 'en-US')
  const apiLangs = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('/v1/api/stream')) apiLangs.push(`stream:${new URL(url).searchParams.get('lang')}`)
    else if (url.includes('/v1/api/')) apiLangs.push(req.headers()['accept-language'])
  })
  const expectLang = async (lang) => {
    const html = await page.evaluate(() => document.documentElement.lang)
    if (html !== lang) throw new Error(`<html lang> is ${html}, expected ${lang}`)
    const header = apiLangs.findLast((l) => !l?.startsWith('stream:'))
    if (header !== lang) throw new Error(`Accept-Language ${header}, expected ${lang}`)
  }

  await page.goto(`${base}/`)
  await page.waitForURL(/\/login/)
  await page.getByRole('button', { name: 'Sign in' }).waitFor()
  await shot(page, `${n}-01-login`)
  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText('Incorrect email or password').waitFor()
  await page.getByLabel('Password').fill('admin')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${base}/`)
  await page.getByRole('heading', { name: 'Devices', exact: true }).waitFor()
  await rowsVisible(page)
  await waitTotal(page, (t) => t > 20)
  await expectLang('en')
  if (!apiLangs.includes('stream:en')) throw new Error(`stream opened without lang=en: ${apiLangs.filter((l) => l?.startsWith('stream:'))}`)
  await page.waitForTimeout(400)
  await shot(page, `${n}-02-devices-home`, { fullPage: vp.name === 'desktop' })

  await page.locator('header [data-gateway]').click()
  await page.getByTestId('gateway-status-details').getByText('Latency').waitFor()
  await shot(page, `${n}-03-status-popover`, { fullPage: false })
  await page.keyboard.press('Escape')

  await page.goto(`${base}/docs`)
  await page.getByText('From one script tag').waitFor()
  await shot(page, `${n}-04-docs`, { fullPage: false })

  await page.goto(`${base}/projects`)
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
  await shot(page, `${n}-05-projects`)
  await page.getByText('商城 App').click()
  await page.getByRole('tab', { name: 'Devices' }).waitFor()
  await page.getByText('Assisting').filter({ visible: true }).first().waitFor()
  await shot(page, `${n}-06-project-devices`)
  await page.getByRole('tab', { name: 'Integration' }).click()
  await page.getByRole('tab', { name: 'iOS (Swift)' }).waitFor()
  await shot(page, `${n}-07-integration`)
  await page.getByRole('tab', { name: 'Devices' }).click()
  await (vp.name === 'desktop' ? page.locator('tr', { hasText: 'Assisting' }) : page.locator('li a', { hasText: 'Assisting' }))
    .first()
    .click()
  await page.waitForURL(/\/devices\//)
  await page.getByRole('button', { name: 'Test connection' }).waitFor()
  await shot(page, `${n}-08-device-detail`)
  await page.goBack()
  await page.getByRole('tab', { name: 'Settings' }).click()
  await page.getByText('Access policy', { exact: true }).waitFor()
  await shot(page, `${n}-09-settings`)
  await page.getByRole('tab', { name: 'Invites' }).click()
  await page.getByRole('button', { name: 'Create invite' }).first().waitFor()
  await shot(page, `${n}-10-invites`)
  await page.getByRole('tab', { name: 'Audit log' }).click()
  await page.getByRole('list', { name: 'Audit records' }).waitFor()
  await shot(page, `${n}-11-project-audit`)

  await page.goto(`${base}/keys`)
  await page.getByRole('heading', { name: 'API keys' }).first().waitFor()
  await visible(page.getByText('Expired')).waitFor()
  await shot(page, `${n}-12-keys`)
  await page.getByRole('button', { name: 'Create key' }).first().click()
  await page.getByRole('dialog').waitFor()
  await shot(page, `${n}-13-key-create`, { fullPage: false })
  await page.keyboard.press('Escape')

  await page.goto(`${base}/members`)
  await visible(page.getByText('support@example.com')).waitFor()
  await page.getByRole('heading', { name: 'Members', exact: true }).waitFor()
  await shot(page, `${n}-14-members`)
  await page.goto(`${base}/audit`)
  await page.getByRole('heading', { name: 'Audit log', exact: true }).waitFor()
  await shot(page, `${n}-15-audit`)

  // Switch to Chinese: labels, <html lang> and the API language follow without a reload; the choice sticks.
  await page.goto(`${base}/`)
  await rowsVisible(page)
  await page.getByTestId('language-switcher').filter({ visible: true }).first().click()
  await page.getByRole('menuitemradio', { name: '简体中文' }).click()
  await page.getByRole('heading', { name: '设备', exact: true }).waitFor()
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN')
  await page.waitForTimeout(600) // the language switch refetches every query
  await expectLang('zh-CN')
  if (!apiLangs.includes('stream:zh-CN')) throw new Error('stream did not reconnect with lang=zh-CN')
  await page.reload()
  await page.getByRole('heading', { name: '设备', exact: true }).waitFor()
  await page.getByTestId('language-switcher').filter({ visible: true }).first().click()
  await page.getByRole('menuitemradio', { name: 'English' }).click()
  await page.getByRole('heading', { name: 'Devices', exact: true }).waitFor()

  // Sign out: the auth layout has its own switcher.
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL(/\/login/)
  await page.getByTestId('language-switcher').click()
  await page.getByRole('menuitemradio', { name: '简体中文' }).click()
  await page.getByRole('button', { name: '登录' }).waitFor()
  await shot(page, `${n}-16-login-switched`, { fullPage: false })
  await ctx.close()
}

/** A browser in another language: picked automatically (with its catalog chunk), Arabic right to left, no sideways scroll. */
async function runLocale(vp, locale, lang) {
  const { ctx, page } = await newPage(vp, 'light', locale)
  await page.goto(`${base}/`)
  await page.waitForURL(/\/login/)
  await page.waitForFunction((l) => document.documentElement.lang === l, lang)
  const dir = await page.evaluate(() => document.documentElement.dir)
  if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) throw new Error(`${lang}: <html dir> is ${dir}`)
  await shot(page, `${vp.name}-${lang}-login`, { fullPage: false })
  await page.locator('#email').fill('admin@example.com')
  await page.locator('input[type=password]').fill('admin')
  await page.locator('button[type=submit]').click()
  await page.waitForURL(`${base}/`)
  await rowsVisible(page)
  const overflow = async (where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (o > 1) throw new Error(`${lang} ${where}: page scrolls sideways by ${o}px`)
  }
  await overflow('devices')
  await shot(page, `${vp.name}-${lang}-devices-home`)
  await page.goto(`${base}/docs#mcp`)
  await page.getByText('batch_actions').first().waitFor()
  await overflow('docs')
  await shot(page, `${vp.name}-${lang}-docs-mcp`, { fullPage: false })
  await page.goto(`${base}/members`)
  await visible(page.getByText('support@example.com')).waitFor()
  await overflow('members')
  await shot(page, `${vp.name}-${lang}-members`)
  await ctx.close()
}

let failed = false
try {
  for (const vp of viewports) {
    await run(vp)
    await runDark(vp)
    await runEnglish(vp)
    await runLocale(vp, 'ja-JP', 'ja')
    await runLocale(vp, 'ar-EG', 'ar')
  }
} catch (err) {
  failed = true
  console.error('E2E step failed:', err)
} finally {
  await browser.close()
  server.close()
  // the simulation interval keeps the process alive otherwise
}

console.log(`\n${shots.length} screenshots in ${outDir}`)
if (problems.length) {
  console.error(`\n${problems.length} unexpected console error(s):`)
  for (const p of problems) console.error('  ' + p)
}
process.exit(failed || problems.length ? 1 : 0)
