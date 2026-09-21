import { test, expect, status } from './fixtures'

test('after 3 failed WebSocket attempts the page polls /v1/presence', async ({ page, gw }) => {
  await page.goto('/test/presence.html')
  await expect.poll(async () => (await status(page)).status, { timeout: 15_000 }).toBe('polling')
  const s = await status(page)
  await gw.waitFor(() => gw.presence.find((b: any) => b.deviceId === s.deviceId), 5000, 'presence')
  const body = gw.presence.find((b: any) => b.deviceId === s.deviceId)
  expect(body).toMatchObject({ key: 'invalid-key', pageId: s.pageId, userId: null, help: false })
  expect(body.page.title).toBe('presence fallback')
  expect(body.device.platform).toMatch(/ios|android/)
  // run() resolved with the code the presence answer carried.
  const res = await page.evaluate(() => (window as any).runResult)
  expect(res.deviceCode).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
  expect(res.status).toBe('polling')
  await expect(page.locator('#__rwd .pill')).toContainText(res.deviceCode)
})
