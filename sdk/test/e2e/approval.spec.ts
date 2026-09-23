import { test, expect, openFixture, status, waitOnline, dialogButton, untrustedClick } from './fixtures'

test('attach dialog: agent, key hint, levels; untrusted clicks do nothing', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const req = gw.requestAttach(s.deviceId!, { levels: ['observe', 'interact', 'advanced'] })
  const dlg = page.locator('#__rwd .scrim:not(.out) .dlg')
  await expect(dlg).toContainText('AI 请求接入')
  await expect(dlg).toContainText('「客服机器人」请求查看此页面')
  await expect(dlg).toContainText('API Key …a91f')
  await expect(dlg).toContainText(/\d+ 秒后自动拒绝/)
  await expect(dialogButton(page, '[data-choice]')).toHaveText(['仅查看', '查看并操作', '高级（另可执行脚本、读取存储）'])
  // The level the agent asked for (the last one) is preselected.
  await expect(dialogButton(page, '[data-choice=advanced]')).toHaveClass('choice on')

  // A page script (or the agent's evaluate) cannot answer.
  await untrustedClick(page, '[data-choice=observe]')
  await untrustedClick(page, '.allow')
  await page.waitForTimeout(300)
  expect(gw.messages('attach_decision', s.pageId!)).toEqual([])
  await expect(dlg).toBeVisible()
  await expect(dialogButton(page, '[data-choice=advanced]')).toHaveClass('choice on')

  // The user picks a level and allows.
  await dialogButton(page, '[data-choice=interact]').tap()
  await dialogButton(page, '.allow').tap()
  expect(await req.decision).toBe('interact')
  expect(gw.messages('attach_decision', s.pageId!)).toEqual([{ t: 'attach_decision', requestId: req.requestId, level: 'interact' }])
  await expect(dlg).toHaveCount(0)
  await expect.poll(async () => (await status(page)).level).toBe('interact')
  expect((await status(page)).control).toBe('observe')
  await expect(page.locator('#__rwd .bar')).toContainText('AI 查看中')
})

test('attach dialog: refuse, cancelled by the gateway, local expiry', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const dlg = page.locator('#__rwd .scrim:not(.out) .dlg')

  const r1 = gw.requestAttach(s.deviceId!)
  await dialogButton(page, '.deny').tap()
  expect(await r1.decision).toBeNull()
  await expect(dlg).toHaveCount(0)
  expect((await status(page)).control).toBe('none')

  const r2 = gw.requestAttach(s.deviceId!)
  await expect(dlg).toBeVisible()
  gw.cancelAttach(r2.requestId)
  await expect(dlg).toHaveCount(0)

  // Nobody answers: the dialog goes away by itself; no decision is sent.
  const r3 = gw.requestAttach(s.deviceId!, { expiresInSec: 1 })
  await expect(dlg).toBeVisible()
  await expect(dlg).toHaveCount(0, { timeout: 3000 })
  expect(await r3.decision).toBe('timeout')
  expect(gw.messages('attach_decision', s.pageId!)).toHaveLength(1)
})

test('a decision on one tab dismisses the same request on the others', async ({ page, gw, context }) => {
  const s = await openFixture(page, gw)
  const other = await context.newPage()
  await other.goto('/test/host.html')
  const s2 = await waitOnline(other, gw)
  expect(s2.deviceId).toBe(s.deviceId)

  const req = gw.requestAttach(s.deviceId!, { toAll: true })
  expect(req.pages.sort()).toEqual([s.pageId, s2.pageId].sort())
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toBeVisible()
  await expect(other.locator('#__rwd .scrim:not(.out) .dlg')).toBeVisible()
  await dialogButton(other, '.allow').tap()
  expect(await req.decision).toBe('interact')
  await expect(other.locator('#__rwd .scrim:not(.out) .dlg')).toHaveCount(0)
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toHaveCount(0)
  expect(gw.messages('attach_decision', s.pageId!).length + gw.messages('attach_decision', s2.pageId!).length).toBe(1)
})

test('nativeApproval: status().pending + nativeDecide with the right key only', async ({ page, gw }) => {
  const s = await openFixture(page, gw, { nativeKey: 'nk-0123456789', nativeApproval: true })
  const req = gw.requestAttach(s.deviceId!, { levels: ['observe', 'interact'] })
  await expect.poll(async () => (await status(page)).pending).toMatchObject({ kind: 'attach', requestId: req.requestId })
  const pending = (await status(page)).pending
  expect(pending).toMatchObject({ agent: { name: '客服机器人', keyHint: '…a91f' }, levels: ['observe', 'interact'] })
  expect(pending.expiresAt).toBeGreaterThan(Date.now())
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toHaveCount(0)

  const decide = (key: string, id: string, value: string | null) =>
    page.evaluate(([k, i, v]) => (window as any).RemoteWebviewDebugger.nativeDecide(k, i, v), [key, id, value] as const)
  expect(await decide('nk-0123456788', req.requestId, 'interact')).toBe(false)
  expect(await decide('nk', req.requestId, 'interact')).toBe(false)
  expect(await decide('nk-0123456789', 'other-request', 'interact')).toBe(false)
  expect(await decide('nk-0123456789', req.requestId, 'advanced')).toBe(false) // not offered
  await page.waitForTimeout(200)
  expect(gw.messages('attach_decision', s.pageId!)).toEqual([])

  expect(await decide('nk-0123456789', req.requestId, 'observe')).toBe(true)
  expect(await req.decision).toBe('observe')
  expect((await status(page)).pending).toBeNull()
  await expect.poll(async () => (await status(page)).level).toBe('observe')

  // Refusing works the same way.
  const r2 = gw.requestAttach(s.deviceId!)
  await expect.poll(async () => (await status(page)).pending?.requestId).toBe(r2.requestId)
  expect(await decide('nk-0123456789', r2.requestId, null)).toBe(true)
  expect(await r2.decision).toBeNull()
})
