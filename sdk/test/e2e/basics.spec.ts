import { test, expect, openDemo, rpc, snapshot, refOf, status, waitOnline, KEY } from './fixtures'

test('comes online: hello, welcome and the device code pill', async ({ page, gw, errors }) => {
  const s = await openDemo(page, gw)
  const p = gw.findPage(s.pageId!)!
  const hello = p.hello
  expect(hello.v).toBe(1)
  expect(hello.deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(hello.pageId).toMatch(/^[0-9A-Za-z]{12}$/)
  expect(hello.openerId).toBeNull()
  expect(hello.userId).toBe('demo-user-42')
  expect(hello.page.title).toBe('演示商城 - 商品列表')
  expect(hello.device.app).toEqual({ name: '演示商城', version: '1.0.0' })
  expect(['ios', 'android']).toContain(hello.device.platform)
  expect(s.deviceCode).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
  await expect(page.locator('#__rwd .pill')).toContainText(`Remote Debugger${s.deviceCode}`)
  await expect(page.locator('#__rwd')).toHaveClass('__chobitsu-hide__')
  await expect(page.locator('#__rwd')).toHaveAttribute('aria-hidden', 'true')
  // run() again is harmless and resolves with the same code.
  const again = await page.evaluate((key) => (window as any).RemoteWebviewDebugger.run(location.origin + '/v1', key), KEY)
  expect(again.deviceCode).toBe(s.deviceCode)
  expect(await page.locator('#__rwd').count()).toBe(1)
  expect(errors).toEqual([])
})

test('snapshot: Playwright AI YAML with refs, without our UI', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  await expect(page.locator('.card')).toHaveCount(4)
  const res = await rpc(gw, s.pageId!, 'rwd.snapshot')
  expect(res.url).toBe(page.url())
  expect(res.title).toBe('演示商城 - 商品列表')
  expect(res.snapshot).toMatch(/- link \[ref=e\d+\]( \[cursor=pointer\])?:\n\s+- \/url: detail\.html\?id=1/)
  expect(res.snapshot).toContain('paragraph [ref=')
  expect(refOf(res.snapshot, 'link', '无线降噪耳机 Pro')).toMatch(/^e\d+$/)
  expect(res.snapshot).toContain('heading "演示商城" [level=1]')
  expect(res.snapshot).not.toContain('Remote Debugger')
  expect(res.snapshot).not.toContain(s.deviceCode)
  // Stale refs are rejected.
  const stale = await gw.rpc(s.pageId!, 'rwd.click', { ref: 'e99999' })
  expect(stale.error.code).toBe('not_found')
  const ping = await rpc(gw, s.pageId!, 'rwd.ping')
  expect(typeof ping.at).toBe('number')
})

test('snapshot scopes: only the screen (with a count of what is left out), one part by ref; refs cover the whole page', async ({ page, gw }) => {
  await page.setViewportSize({ width: 390, height: 260 })
  const s = await openDemo(page, gw)
  await expect(page.locator('.card')).toHaveCount(4)
  const full = await rpc(gw, s.pageId!, 'rwd.snapshot')
  expect(full.omitted).toBe(0)
  const lastCard = refOf(full.snapshot, 'link', '机械键盘 K8')

  const screen = await rpc(gw, s.pageId!, 'rwd.snapshot', { scope: 'viewport' })
  expect(screen.snapshot).toContain('heading "演示商城" [level=1]')
  expect(screen.snapshot).not.toContain('机械键盘 K8')
  expect(screen.omitted).toBeGreaterThan(0)
  expect(screen.snapshot.length).toBeLessThan(full.snapshot.length)
  // An off-screen element's ref still works (it is scrolled into view).
  expect((await gw.rpc(s.pageId!, 'rwd.hover', { ref: lastCard })).error).toBeUndefined()

  const fresh = await rpc(gw, s.pageId!, 'rwd.snapshot')
  const card = refOf(fresh.snapshot, 'link', '无线降噪耳机 Pro')
  const part = await rpc(gw, s.pageId!, 'rwd.snapshot', { ref: card })
  expect(part.snapshot).toContain('无线降噪耳机 Pro')
  expect(part.snapshot).not.toContain('演示商城')
  const gone = await gw.rpc(s.pageId!, 'rwd.snapshot', { ref: 'e99999' })
  expect(gone.error.code).toBe('not_found')
})
