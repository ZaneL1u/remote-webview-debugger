import { test, expect, openDemo, status, waitOnline } from './fixtures'

test('pageId survives reload; a new tab gets a new pageId with openerId', async ({ page, gw, context }) => {
  const s = await openDemo(page, gw)
  const pageId = s.pageId!
  await page.reload()
  const again = await waitOnline(page, gw)
  expect(again.pageId).toBe(pageId)
  expect(again.deviceId).toBe(s.deviceId)
  expect(gw.findPage(pageId).connects).toBe(2)

  // The banner opens promo.html in a new tab (target=_blank, noopener).
  const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('a.banner').tap()])
  await popup.waitForURL('**/promo.html')
  const p2 = await waitOnline(popup, gw)
  expect(p2.pageId).not.toBe(pageId)
  expect(p2.deviceId).toBe(s.deviceId)
  expect(gw.findPage(p2.pageId!).hello.openerId).toBe(pageId)
  expect(gw.findPage(p2.pageId!).label).toBe('p2')

  // The tap is on the timeline, described by role and name.
  await gw.waitFor(() => gw.messages('event', pageId).find((e: any) => e.kind === 'user_tap'), 5000, 'user_tap')
  const tap = gw.messages('event', pageId).find((e: any) => e.kind === 'user_tap')
  expect(tap.summary).toMatch(/^点击了链接「双 11 会员日/)

  // window.open() shares sessionStorage with the opener: still a new pageId.
  const [opened] = await Promise.all([
    context.waitForEvent('page'),
    page.evaluate(() => window.open('promo.html?via=open', '_blank')),
  ])
  await opened.waitForURL('**/promo.html?via=open')
  const p3 = await waitOnline(opened, gw)
  expect(p3.pageId).not.toBe(pageId)
  expect(gw.findPage(p3.pageId!).hello.openerId).toBe(pageId)
})

test('page messages on title / url / visibility changes', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  const pageId = s.pageId!
  await page.evaluate(() => {
    document.title = '新标题'
  })
  await gw.waitFor(() => gw.findPage(pageId).title === '新标题', 5000, 'title change')
  await page.evaluate(() => history.pushState({}, '', '#/tab2'))
  await gw.waitFor(() => gw.findPage(pageId).url.endsWith('#/tab2'), 5000, 'pushState')
  const pageMsgs = gw.messages('page', pageId)
  expect(pageMsgs.at(-1)).toMatchObject({ t: 'page', title: '新标题', visibility: 'visible' })
  expect(pageMsgs.at(-1).url).toMatch(/#\/tab2$/)
  // The gateway derives navigations from `page` messages: no `nav` event.
  expect(gw.messages('event', pageId).map((e: any) => e.kind)).not.toContain('nav')
})

test('setUser reconnects with the new userId; stop() removes the UI', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  await page.evaluate(() => (window as any).RemoteWebviewDebugger.setUser('u-7'))
  await gw.waitFor(() => gw.findPage(s.pageId!).userId === 'u-7' && gw.findPage(s.pageId!).connected, 10_000, 'new hello')
  await page.evaluate(() => (window as any).RemoteWebviewDebugger.stop())
  await expect(page.locator('#__rwd')).toHaveCount(0)
  expect((await status(page)).status).toBe('idle')
  await gw.waitFor(() => !gw.findPage(s.pageId!).connected, 5000, 'disconnect')
})

test('a duplicated tab (same sessionStorage pageId) gets its own pageId', async ({ page, gw, context }) => {
  const s = await openDemo(page, gw)
  const dup = await context.newPage()
  // What the browser's "Duplicate tab" does: the copy starts with our sessionStorage.
  await dup.addInitScript((pageId: string) => {
    if (!sessionStorage.getItem('rwd:page')) sessionStorage.setItem('rwd:page', pageId)
  }, s.pageId!)
  await dup.goto('/demo/platform/promo.html')
  const d = await waitOnline(dup, gw)
  expect(d.pageId).not.toBe(s.pageId)
  expect(gw.findPage(d.pageId!).hello.openerId).toBe(s.pageId)
  expect(gw.findPage(s.pageId!).connected).toBe(true)
})
