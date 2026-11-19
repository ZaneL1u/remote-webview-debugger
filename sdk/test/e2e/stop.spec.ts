import { test, expect, openFixture, status } from './fixtures'

// run({ stopOnEnd }): the user's "End" ends remote assistance, not only the
// agent's session. The page goes offline and no agent can reach it until the
// page starts again (a host's "start remote assistance" switch).

const stopped = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__stopped || 0)

test('End with an agent attached: the agent is let go, then the page goes offline', async ({ page, gw }) => {
  const s = await openFixture(page, gw, { stopOnEnd: true })
  const pageId = s.pageId!
  gw.setControl(s.deviceId!, 'agent')
  await expect(page.locator('#__rwd .bar')).toContainText('AI 操作中')

  await page.locator('#__rwd .bar [data-action=end]').tap()
  await gw.waitFor(() => gw.messages('control', pageId).length === 1, 5000, 'end')
  expect(gw.messages('control', pageId)[0]).toEqual({ t: 'control', action: 'end' })
  await expect.poll(() => stopped(page)).toBe(1)
  await gw.waitFor(() => !gw.findPage(pageId).connected, 5000, 'page offline')
  expect((await status(page)).status).toBe('idle')
  await expect(page.locator('#__rwd')).toHaveCount(0)
  // Nothing locks the next page for an agent that is gone.
  expect(await page.evaluate(() => localStorage.getItem('rwd:ctl'))).toBeNull()
  // The agent can no longer reach the page.
  await expect(gw.rpc(pageId, 'rwd.snapshot', {})).rejects.toThrow(/not connected/)
  await page.locator('#plain').tap()
  await expect(page.locator('#count')).toHaveText('1')
})

test('End remote assistance from the floating window; run() starts it again', async ({ page, gw }) => {
  const s = await openFixture(page, gw, { stopOnEnd: true })
  await page.locator('#__rwd .pill .brand').tap()
  const quit = page.locator('#__rwd .win [data-action=stop]')
  await expect(quit).toHaveText('结束远程协助')
  // A page script (or an agent's evaluate) cannot press it.
  await page.evaluate(() => (document.getElementById('__rwd')!.shadowRoot!.querySelector('[data-action=stop]') as HTMLElement).click())
  expect(await stopped(page)).toBe(0)

  await quit.tap()
  await expect.poll(() => stopped(page)).toBe(1)
  await gw.waitFor(() => !gw.findPage(s.pageId!).connected, 5000, 'page offline')
  expect(gw.messages('control', s.pageId!)).toEqual([])
  await expect(page.locator('#__rwd')).toHaveCount(0)

  // Started again by the host: online with the same device.
  await page.evaluate(() => (window as any).RemoteWebviewDebugger.run(location.origin + '/v1', 'rwd_pk_test0000000000000000000', { stopOnEnd: true }))
  await expect.poll(async () => (await status(page)).status, { timeout: 15_000 }).toBe('online')
  expect((await status(page)).deviceId).toBe(s.deviceId)
  await expect(page.locator('#__rwd .pill')).toBeVisible()
})

test('without stopOnEnd, End only ends the agent session and there is no stop button', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  await page.locator('#__rwd .pill .brand').tap()
  await expect(page.locator('#__rwd .win')).toHaveClass(/\bopen\b/)
  await expect(page.locator('#__rwd [data-action=stop]')).toHaveCount(0)
  gw.setControl(s.deviceId!, 'agent')
  await page.locator('#__rwd .bar [data-action=end]').tap()
  await gw.waitFor(() => gw.messages('control', s.pageId!).length === 1, 5000, 'end')
  await expect(page.locator('#__rwd .pill')).toBeVisible()
  expect((await status(page)).status).toBe('online')
  expect(await stopped(page)).toBe(0)
})
