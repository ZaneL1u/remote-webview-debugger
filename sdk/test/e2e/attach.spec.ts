import { test, expect, openDemo, rpc, status, waitOnline, type Gateway } from './fixtures'
import type { Page } from '@playwright/test'

// The page locks the moment an agent attaches (control `observe`), not only
// once it acts, and the bottom bar counts how long it has been connected.

/** Seconds on the bar's "已连接 · mm:ss" timer. */
async function connectedSeconds(page: Page) {
  const text = (await page.locator('#__rwd .bar .since').textContent()) || ''
  const m = text.match(/^已连接 · (?:(\d+):)?(\d{2}):(\d{2})$/)
  if (!m) throw new Error(`no timer in "${text}"`)
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

async function openDetail(page: Page, gw: Gateway) {
  const s = await openDemo(page, gw, 'detail.html?id=1&key=rwd_pk_test0000000000000000000', '')
  await expect(page.locator('#name')).toHaveText('无线降噪耳机 Pro')
  return s
}

test('attaching locks at once; the timer counts up; detaching unlocks', async ({ page, gw }) => {
  const s = await openDetail(page, gw)
  const bar = page.locator('#__rwd .bar')
  const since = page.locator('#__rwd .bar .since')

  // Approved (or resumed) attach: the gateway sends `observe`, no action yet.
  gw.setControl(s.deviceId!, 'observe')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
  await expect(page.locator('#__rwd .glow')).toBeVisible()
  await expect(bar).toContainText('AI 查看中')
  await expect(since).toHaveText(/^已连接 · 00:0\d$/)
  expect(await status(page)).toMatchObject({ control: 'observe' })

  // The user's real input is swallowed before the agent did anything.
  await page.locator('#plus').tap({ force: true })
  await page.locator('#plus').click({ force: true })
  await expect(page.locator('#qty')).toHaveValue('1')

  // Every second, without anything else happening.
  const first = await connectedSeconds(page)
  await expect.poll(() => connectedSeconds(page), { timeout: 5000 }).toBeGreaterThanOrEqual(first + 2)

  // Take over works from `observe` too, and the timer keeps going.
  await page.locator('#__rwd [data-action=takeover]').tap()
  await gw.waitFor(() => gw.messages('control', s.pageId!).length === 1, 5000, 'takeover')
  await expect(bar).toContainText('你在操作')
  await expect(page.locator('#__rwd .overlay')).toBeHidden()
  await expect(since).toHaveText(/^已连接 · /)
  await page.locator('#plus').tap()
  await expect(page.locator('#qty')).toHaveValue('2')

  await page.locator('#__rwd [data-action=handback]').tap()
  await expect(bar).toContainText('AI 操作中')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()

  // The agent goes away: no lock, no glow, no bar.
  gw.setControl(s.deviceId!, 'none')
  await expect(page.locator('#__rwd .overlay')).toBeHidden()
  await expect(page.locator('#__rwd .glow')).toBeHidden()
  await expect(bar).toBeHidden()
  await page.locator('#plus').tap()
  await expect(page.locator('#qty')).toHaveValue('3')
})

test('the timer follows the gateway, survives navigation and shows a lost link', async ({ page, gw }) => {
  const s = await openDetail(page, gw)
  const since = page.locator('#__rwd .bar .since')

  // Attached 83 s ago as far as the gateway knows (another page, a reload…).
  gw.setControl(s.deviceId!, 'observe', '测试 Agent', 'interact', 83_000)
  await expect(since).toHaveText(/^已连接 · 01:2[3-5]$/)

  // The next page locks before its welcome and keeps counting from there.
  await rpc(gw, s.pageId!, 'rwd.navigate', { url: 'index.html' })
  await page.waitForURL('**/index.html')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
  const next = await waitOnline(page, gw)
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
  expect(await connectedSeconds(page)).toBeGreaterThanOrEqual(83)

  // The socket drops: still locked, the bar says it is reconnecting, then counts again.
  gw.closePage(next.pageId!, 1011)
  await expect(since).toHaveText('连接中…')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
  await expect(since).toHaveText(/^已连接 · 01:\d\d$/, { timeout: 15_000 })

  // End from the bar: the gateway detaches and the page is free again.
  await page.locator('#__rwd [data-action=end]').tap()
  await expect(page.locator('#__rwd .overlay')).toBeHidden()
  await expect(page.locator('#__rwd .bar')).toBeHidden()
})
