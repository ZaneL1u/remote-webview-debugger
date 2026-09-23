import { test, expect, openFixture, rpc, snapshot, refOf, status, dialogButton, untrustedClick } from './fixtures'

test('sensitive click: the user allows or refuses, trusted taps only, also under the agent lock', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  gw.setControl(s.deviceId!, 'agent', '客服机器人', 'interact')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
  const snap = await snapshot(gw, id)
  const search = refOf(snap, 'button', '搜索')
  const dlg = page.locator('#__rwd .scrim:not(.out) .dlg')

  // Refused.
  let click = gw.rpc(id, 'rwd.click', { ref: search })
  await expect(dlg).toContainText('需要你的确认')
  await expect(dlg).toContainText('AI 想要点击「搜索」，允许吗？')
  await untrustedClick(page, '.allow')
  await page.waitForTimeout(300)
  await expect(dlg).toBeVisible()
  await dialogButton(page, '.deny').tap()
  expect((await click).error).toEqual({ code: 'forbidden', message: '用户拒绝了该操作' })
  await expect(page.locator('#submitted')).toHaveText('0')

  // Allowed.
  click = gw.rpc(id, 'rwd.click', { ref: search })
  await dialogButton(page, '.allow').tap()
  expect((await click).result).toEqual({})
  await expect(page.locator('#submitted')).toHaveText('1')
  await expect(dlg).toHaveCount(0)
  // The lock is still on for the page itself.
  await page.locator('#plain').tap({ force: true })
  await expect(page.locator('#count')).toHaveText('0')

  // Other elements need no confirmation.
  await rpc(gw, id, 'rwd.click', { ref: refOf(snap, 'button', '普通按钮') })
  await expect(page.locator('#count')).toHaveText('1')
})

test('Enter in a form with a confirm element asks first (press and type submit)', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  const snap = await snapshot(gw, id)
  await rpc(gw, id, 'rwd.fill', { ref: refOf(snap, 'textbox', '关键词'), value: '耳机' })
  const dlg = page.locator('#__rwd .scrim:not(.out) .dlg')

  const press = gw.rpc(id, 'rwd.press', { key: 'Enter' })
  await expect(dlg).toContainText('AI 想要按 Enter 提交「搜索」，允许吗？')
  await dialogButton(page, '.allow').tap()
  expect((await press).result).toEqual({})
  await expect(page.locator('#submitted')).toHaveText('1')

  const type = gw.rpc(id, 'rwd.type', { ref: refOf(snap, 'textbox', '关键词'), text: 'x', submit: true })
  await expect(dlg).toBeVisible()
  await dialogButton(page, '.deny').tap()
  expect((await type).error).toEqual({ code: 'forbidden', message: '用户拒绝了该操作' })
  await expect(page.locator('#submitted')).toHaveText('1')
  await expect(page.locator('#q')).toHaveValue('耳机')

  // Enter elsewhere (no form) needs nothing.
  await rpc(gw, id, 'rwd.fill', { ref: refOf(snap, 'textbox', '会员名'), value: '王五' })
  await rpc(gw, id, 'rwd.press', { key: 'Enter' })
  await expect(dlg).toHaveCount(0)
})

test('no answer within 30 s is a refusal', async ({ page, gw }) => {
  await page.clock.install()
  const s = await openFixture(page, gw)
  const id = s.pageId!
  const snap = await snapshot(gw, id)
  const click = gw.rpc(id, 'rwd.click', { ref: refOf(snap, 'button', '搜索') })
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toContainText('30 秒后自动拒绝')
  await page.clock.fastForward(31_000)
  expect((await click).error).toEqual({ code: 'forbidden', message: '用户拒绝了该操作' })
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toHaveCount(0)
  await expect(page.locator('#submitted')).toHaveText('0')
})

test('nativeApproval: confirmations go to the native host', async ({ page, gw }) => {
  const key = 'nk-confirm-42'
  const s = await openFixture(page, gw, { nativeKey: key, nativeApproval: true })
  const id = s.pageId!
  const snap = await snapshot(gw, id)
  const search = refOf(snap, 'button', '搜索')
  const decide = (k: string, rid: string, value: string | null) =>
    page.evaluate(([a, b, c]) => (window as any).RemoteWebviewDebugger.nativeDecide(a, b, c), [k, rid, value] as const)

  let click = gw.rpc(id, 'rwd.click', { ref: search })
  await expect.poll(async () => (await status(page)).pending?.kind).toBe('confirm')
  let pending = (await status(page)).pending
  expect(pending).toMatchObject({ kind: 'confirm', action: '点击「搜索」' })
  expect(pending.expiresAt).toBeGreaterThan(Date.now())
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toHaveCount(0)
  expect(await decide('wrong-key-000', pending.requestId, 'allow')).toBe(false)
  expect(await decide(key, pending.requestId, 'yes')).toBe(false)
  expect(await decide(key, pending.requestId, 'allow')).toBe(true)
  expect((await click).result).toEqual({})
  await expect(page.locator('#submitted')).toHaveText('1')
  expect((await status(page)).pending).toBeNull()

  click = gw.rpc(id, 'rwd.click', { ref: search })
  await expect.poll(async () => (await status(page)).pending?.kind).toBe('confirm')
  pending = (await status(page)).pending
  expect(await decide(key, pending.requestId, null)).toBe(true)
  expect((await click).error).toEqual({ code: 'forbidden', message: '用户拒绝了该操作' })
  await expect(page.locator('#submitted')).toHaveText('1')
})
