import { test, expect, openFixture, openDemo, status, waitOnline, KEY } from './fixtures'

test('deviceToken is issued once, stored and sent again; resume rotates', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  const first = gw.findPage(id)
  expect(first.hello.deviceToken).toBeNull()
  expect(first.hello.resume).toBeNull()
  expect(s.deviceToken).toMatch(/^[\w-]{43}$/)
  expect(s.deviceToken).toBe(gw.devices.get(s.deviceId).token)
  expect(await page.evaluate(() => localStorage.getItem('rwd:dtoken'))).toBe(s.deviceToken)

  const resume = first.resume
  await page.reload()
  const again = await waitOnline(page, gw)
  expect(again.pageId).toBe(id)
  const hello = gw.findPage(id).hello
  expect(hello.deviceToken).toBe(s.deviceToken)
  expect(hello.resume).toBe(resume)
  expect(gw.findPage(id).resume).not.toBe(resume)
})

test('a native host passes the deviceToken (other origin, no localStorage)', async ({ page, gw, browser }) => {
  const s = await openFixture(page, gw)
  // Another webview: empty storage, the app injects its deviceId and token.
  const other = await browser.newContext()
  const p2 = await other.newPage()
  const s2 = await openFixture(p2, gw, { deviceId: s.deviceId, deviceToken: s.deviceToken })
  expect(s2.deviceId).toBe(s.deviceId)
  expect(gw.findPage(s2.pageId!).hello.deviceToken).toBe(s.deviceToken)
  expect(s2.deviceToken).toBe(s.deviceToken)

  // Without the token (or with a wrong one) the gateway refuses the device.
  const p3 = await other.newPage()
  await p3.addInitScript((deviceId: string) => {
    ;(window as any).__rwdOpts = { deviceId, deviceToken: 'wrong' }
  }, s.deviceId!)
  await p3.goto('/test/host.html')
  await expect.poll(async () => (await status(p3)).status).toBe('rejected')
  expect((await p3.evaluate(() => (window as any).runResult)).status).toBe('rejected')
  await other.close()
})

test('4401: retried once when a sibling tab just stored the token, else rejected', async ({ page, gw, context }) => {
  const s = await openFixture(page, gw)

  // Two tabs of a new device racing: this one read storage before the first
  // tab stored the token (getItem hides it for the first two reads).
  const racer = await context.newPage()
  await racer.addInitScript(() => {
    const get = Storage.prototype.getItem
    let hidden = 0
    Storage.prototype.getItem = function (this: Storage, key: string) {
      if (key === 'rwd:dtoken' && hidden < 2) {
        hidden++
        return null
      }
      return get.call(this, key)
    }
  })
  await racer.goto('/test/host.html')
  const r = await waitOnline(racer, gw)
  const hellos = gw.messages('hello', r.pageId!)
  expect(hellos.map((h: any) => h.deviceToken)).toEqual([null, s.deviceToken])

  // A token that is simply wrong: rejected, and no reconnect loop.
  await page.evaluate(() => localStorage.setItem('rwd:dtoken', 'not-the-token'))
  await page.reload()
  await expect.poll(async () => (await status(page)).status).toBe('rejected')
  const count = gw.messages('hello', s.pageId!).length
  await page.waitForTimeout(2500)
  expect(gw.messages('hello', s.pageId!).length).toBe(count)
  expect(gw.messages('hello', s.pageId!).at(-1).deviceToken).toBe('not-the-token')
})

test('4409: a stale resume makes the page start over with a new pageId', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  await page.evaluate((pageId: string) => sessionStorage.setItem('rwd:resume', JSON.stringify({ p: pageId, r: 'stale' })), id)
  await page.reload()
  const again = await waitOnline(page, gw)
  expect(again.pageId).not.toBe(id)
  expect(gw.messages('hello', id).at(-1).resume).toBe('stale')
  expect(gw.findPage(again.pageId!).hello.resume).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('rwd:page'))).toBe(again.pageId)
})

test('4429: over quota → status quota, no reconnect loop', async ({ page, gw }) => {
  gw.setQuotaFull(true)
  await page.goto('/test/host.html')
  await expect.poll(async () => (await status(page)).status).toBe('quota')
  const s = await status(page)
  expect((await page.evaluate(() => (window as any).runResult)).status).toBe('quota')
  await page.waitForTimeout(2500)
  expect(gw.messages('hello', s.pageId!)).toHaveLength(1)
  await expect(page.locator('#__rwd .pill')).toBeVisible()
})

test('invite: rwd_invite goes into hello once and leaves the address bar', async ({ page, gw }) => {
  gw.addInvite('inv-123')
  await page.goto(`/demo/platform/index.html?key=${KEY}&rwd_invite=inv-123#top`)
  expect(page.url()).toMatch(new RegExp(`/demo/platform/index\\.html\\?key=${KEY}#top$`))
  const s = await waitOnline(page, gw)
  expect(gw.findPage(s.pageId!).hello.invite).toBe('inv-123')
  // The gateway put the device into 求助中.
  expect(gw.devices.get(s.deviceId).invited).toBe(true)
  await expect(page.locator('#__rwd [data-action=help]')).toHaveText('取消求助')
  // Removing the parameter is not an in-page navigation.
  expect(gw.messages('event', s.pageId!).filter((e: any) => e.kind === 'nav')).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('rwd:invite'))).toBeNull()

  await page.reload()
  await waitOnline(page, gw)
  expect(gw.findPage(s.pageId!).hello.invite).toBeNull()
  // Other pages of the demo are unaffected.
  await openDemo(page, gw, 'detail.html?id=1', '')
  expect(gw.findPage(s.pageId!).hello.invite).toBeNull()
})
