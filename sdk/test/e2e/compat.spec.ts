import { test, expect, rpc, snapshot, refOf, waitOnline, openFixture } from './fixtures'

test('coexists with eruda 3.4.3 and PageSpy 2.4.0 loaded first', async ({ page, gw, errors }) => {
  await page.goto('/test/compat.html')
  await expect.poll(() => page.evaluate(() => !!(window as any).eruda && !!(window as any).$pageSpy)).toBe(true)
  const s = await waitOnline(page, gw)
  const pageId = s.pageId!
  await expect(page.locator('#eruda')).toHaveCount(1)
  await expect(page.locator('#__pageSpy')).toHaveCount(1)

  // The snapshot shows the page only.
  const snap = await snapshot(gw, pageId)
  expect(snap).toContain('heading "共存测试"')
  expect(snap).not.toMatch(/eruda|PageSpy|pageSpy|远程调试|Remote Debugger/i)

  // The agent's clicks go through the tools' floating buttons.
  for (const [name, text] of [['按钮 A', '点了 A'], ['按钮 B', '点了 B']]) {
    await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', name) })
    await expect(page.locator('#out')).toHaveText(text)
  }

  // Console and fetch are hooked by all three tools; each sees it once.
  await page.evaluate(async () => {
    console.log('hello from page')
    await fetch('/v1/healthz')
  })
  const logs = await rpc(gw, pageId, 'rwd.console', {})
  expect(logs.messages.filter((m: any) => m.text === 'hello from page')).toHaveLength(1)
  const net = await rpc(gw, pageId, 'rwd.network', {})
  expect(net.requests.filter((r: any) => r.url.endsWith('/v1/healthz'))).toHaveLength(1)
  // Our own WebSocket and presence traffic never shows up.
  expect(net.requests.some((r: any) => r.url.includes('/v1/page'))).toBe(false)

  // Not docked into eruda unless asked to: the floating window stays.
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => !!(window as any).eruda.get('Remote Debugger'))).toBe(false)
  await expect(page.locator('#__rwd .pill')).toBeVisible()

  const shot = await rpc(gw, pageId, 'rwd.screenshot', {})
  expect(shot.source).toBe('dom')
  expect(errors).toEqual([])
})

test('eruda: { load: true } loads the latest eruda and docks a Remote Debugger tab', async ({ page, gw, errors }) => {
  const s = await openFixture(page, gw, { eruda: { load: true } })
  await expect.poll(() => page.evaluate(() => !!(window as any).eruda && (window as any).eruda._isInit), { timeout: 20000 }).toBe(true)
  await expect.poll(() => page.evaluate(() => !!(window as any).eruda.get('Remote Debugger')), { timeout: 5000 }).toBe(true)
  await expect(page.locator('#__rwd .pill')).toBeHidden()
  await page.evaluate(() => {
    ;(window as any).eruda.show()
    ;(window as any).eruda.show('Remote Debugger')
  })
  const tab = page.locator('#eruda .panel')
  await expect(tab).toContainText('Remote Debugger')
  await expect(tab).toContainText(s.deviceCode!)
  // An attached agent still gets the bottom bar (the user must be able to end it).
  gw.setControl(s.deviceId!, 'observe')
  await expect(page.locator('#__rwd .bar')).toContainText('AI 查看中')
  await expect(tab).toContainText('AI 正在查看这个页面')
  gw.setControl(s.deviceId!, 'none')
  await expect(page.locator('#__rwd .bar')).toBeHidden()
  expect(errors).toEqual([])
})

test('the project policy can dock into eruda remotely; run({ eruda: false }) wins', async ({ page, gw }) => {
  gw.setConfig({ helpButton: false, maskSelectors: [], maskPatterns: [], confirmSelectors: [], eruda: { dock: true, load: false } })
  await page.goto('/test/compat.html')
  await waitOnline(page, gw)
  await expect.poll(() => page.evaluate(() => !!(window as any).eruda.get('Remote Debugger')), { timeout: 5000 }).toBe(true)
  await expect(page.locator('#__rwd .pill')).toBeHidden()
})

// eruda < 3.4 files tools under their lowercased name and finds the container
// with `.eruda-<name>.eruda-tool`, which the space in "Remote Debugger" breaks.
test('docks into eruda 3.0.1 with the default name: the panel renders, get / remove use the lowercased key', async ({ page, gw, errors }) => {
  await page.addInitScript(() => {
    ;(window as any).__rwdOpts = { eruda: true }
  })
  await page.goto('/test/eruda301.html')
  const s = await waitOnline(page, gw)
  await expect.poll(() => page.evaluate(() => (window as any).eruda.version)).toBe('3.0.1')
  await expect.poll(() => page.evaluate(() => !!(window as any).eruda.get('remote debugger')), { timeout: 5000 }).toBe(true)
  await expect(page.locator('#__rwd .pill')).toBeHidden()
  await page.evaluate(() => {
    ;(window as any).eruda.show()
    ;(window as any).eruda.show('remote debugger')
  })
  const tab = page.locator('#eruda .eruda-tool').filter({ hasText: s.deviceCode! })
  await expect(tab).toHaveCount(1)
  await expect(tab).toBeVisible()
  await page.evaluate(() => (window as any).eruda.show('console'))
  await expect(tab).toBeHidden()
  // One tab only, even after the page reconnects and applies the config again.
  gw.closePage(s.pageId!, 1012, 'restart')
  await waitOnline(page, gw)
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => Object.keys((window as any).eruda._devTools._tools).filter((k) => k === 'remote debugger').length)).toBe(1)
  expect(errors).toEqual([])
})

test('eruda 3.0.1: the policy turning dock off removes the lowercased tab and brings the floating window back', async ({ page, gw }) => {
  gw.setConfig({ helpButton: false, maskSelectors: [], maskPatterns: [], confirmSelectors: [], eruda: { dock: true, load: false } })
  await page.goto('/test/eruda301.html')
  const s = await waitOnline(page, gw)
  await expect.poll(() => page.evaluate(() => !!(window as any).eruda.get('remote debugger')), { timeout: 5000 }).toBe(true)
  await expect(page.locator('#__rwd .pill')).toBeHidden()
  gw.setConfig({ helpButton: false, maskSelectors: [], maskPatterns: [], confirmSelectors: [], eruda: { dock: false, load: false } })
  gw.closePage(s.pageId!, 1012, 'restart')
  await expect.poll(() => page.evaluate(() => !!(window as any).eruda.get('remote debugger')), { timeout: 15000 }).toBe(false)
  await expect(page.locator('#__rwd .pill')).toBeVisible()
})
