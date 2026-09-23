import { test, expect, openFixture, rpc, snapshot, refOf, status } from './fixtures'
import type { Page } from '@playwright/test'

async function level(page: Page, value: string | null) {
  await expect.poll(async () => (await status(page)).level).toBe(value)
}

test('levels: observe, interact, advanced are enforced in the page', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  const snap = await snapshot(gw, id)
  const plain = refOf(snap, 'button', '普通按钮')

  // observe: reading only.
  gw.setControl(s.deviceId!, 'observe', '客服机器人', 'observe')
  await level(page, 'observe')
  await rpc(gw, id, 'rwd.snapshot')
  await rpc(gw, id, 'rwd.console', {})
  await rpc(gw, id, 'rwd.query', { text: '普通按钮' })
  const click = await gw.rpc(id, 'rwd.click', { ref: plain })
  expect(click.error).toEqual({ code: 'forbidden', message: '需要 interact 权限' })
  const ev = await gw.rpc(id, 'rwd.evaluate', { function: '() => 1' })
  expect(ev.error).toEqual({ code: 'forbidden', message: '需要 advanced 权限' })
  await expect(page.locator('#count')).toHaveText('0')

  // interact: operating, but no scripts or storage.
  gw.setControl(s.deviceId!, 'agent', '客服机器人', 'interact')
  await level(page, 'interact')
  await rpc(gw, id, 'rwd.click', { ref: plain })
  await expect(page.locator('#count')).toHaveText('1')
  for (const method of ['rwd.evaluate', 'rwd.networkDetail', 'rwd.storage']) {
    const r = await gw.rpc(id, method, { function: '() => 1', id: 1, area: 'local' })
    expect(r.error).toEqual({ code: 'forbidden', message: '需要 advanced 权限' })
  }

  // advanced: everything.
  gw.setControl(s.deviceId!, 'agent', '客服机器人', 'advanced')
  await level(page, 'advanced')
  expect((await rpc(gw, id, 'rwd.evaluate', { function: '() => 1 + 1' })).value).toBe(2)
  await rpc(gw, id, 'rwd.storage', { area: 'local' })

  // An agent without a level (phase 1 gateway, approval: none) interacts.
  gw.setControl(s.deviceId!, 'agent', '客服机器人', null)
  await level(page, 'interact')
  await rpc(gw, id, 'rwd.click', { ref: plain })
  await expect(page.locator('#count')).toHaveText('2')
  expect((await gw.rpc(id, 'rwd.evaluate', { function: '() => 1' })).error.code).toBe('forbidden')

  // The welcome carries the level too (a page that reconnects).
  gw.setControl(s.deviceId!, 'observe', '客服机器人', 'observe')
  await level(page, 'observe')
  await page.reload()
  await expect.poll(async () => (await status(page)).status).toBe('online')
  await level(page, 'observe')
  await snapshot(gw, id)
  expect((await gw.rpc(id, 'rwd.click', { ref: plain })).error.code).toBe('forbidden')

  // The agent leaves: no level any more.
  gw.setControl(s.deviceId!, 'none')
  await level(page, null)
})

test('rwd.query finds elements by text, role and name; refs work', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  const byText = await rpc(gw, id, 'rwd.query', { text: '普通按钮' })
  expect(byText.total).toBe(1)
  expect(byText.matches[0]).toMatchObject({ role: 'button', name: '普通按钮', text: '普通按钮' })
  await rpc(gw, id, 'rwd.click', { ref: byText.matches[0].ref })
  await expect(page.locator('#count')).toHaveText('1')

  const buttons = await rpc(gw, id, 'rwd.query', { role: 'button' })
  expect(buttons.matches.map((m: any) => m.name)).toEqual(['普通按钮', '删除账户', '搜索'])
  const named = await rpc(gw, id, 'rwd.query', { role: 'textbox', name: '会员' })
  expect(named.matches).toHaveLength(1)
  expect(named.matches[0].name).toBe('会员名')
  // Same element, same ref as a snapshot taken afterwards.
  expect(refOf(await snapshot(gw, id), 'textbox', '会员名')).toBe(named.matches[0].ref)
  const limited = await rpc(gw, id, 'rwd.query', { role: 'button', limit: 1 })
  expect(limited).toMatchObject({ total: 3 })
  expect(limited.matches).toHaveLength(1)
  expect((await rpc(gw, id, 'rwd.query', { text: '没有这段文字' })).total).toBe(0)
  expect((await gw.rpc(id, 'rwd.query', {})).error.code).toBe('bad_request')
})

test('rwd.storage: local, session and cookies, values masked', async ({ page, gw }) => {
  gw.setConfig({ maskPatterns: [{ name: '手机号', regex: '1[3-9]\\d{9}' }] })
  const s = await openFixture(page, gw)
  const id = s.pageId!
  await page.evaluate(() => {
    localStorage.setItem('demo:plain', 'hello')
    localStorage.setItem('demo:phone', '{"tel":"13800001111"}')
    sessionStorage.setItem('demo:s', 'v1')
    document.cookie = 'ck=1; path=/'
  })
  gw.setControl(s.deviceId!, 'observe', '客服机器人', 'advanced')
  await expect.poll(async () => (await status(page)).level).toBe('advanced')

  const local = (await rpc(gw, id, 'rwd.storage', { area: 'local' })).entries
  const get = (entries: any[], key: string) => entries.find(e => e.key === key)
  expect(get(local, 'demo:plain').value).toBe('hello')
  expect(get(local, 'demo:phone').value).toBe('{"tel":"••••"}')
  // The SDK's own credential never leaves the page.
  expect(get(local, 'rwd:dtoken').value).toBe('••••')
  expect(get(local, 'rwd:device').value).toBe(s.deviceId)

  const session = (await rpc(gw, id, 'rwd.storage', { area: 'session' })).entries
  expect(get(session, 'demo:s').value).toBe('v1')
  expect(get(session, 'rwd:resume').value).toBe('••••')
  expect(get(session, 'rwd:page').value).toBe(id)

  const cookies = (await rpc(gw, id, 'rwd.storage', { area: 'cookie' })).entries
  expect(get(cookies, 'ck').value).toBe('1')
  expect((await gw.rpc(id, 'rwd.storage', { area: 'indexeddb' })).error.code).toBe('bad_request')
})
