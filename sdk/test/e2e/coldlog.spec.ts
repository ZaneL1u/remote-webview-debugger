import { test, expect, openFixture, rpc, status, waitOnline, type Gateway } from './fixtures'
import type { Page } from '@playwright/test'

const log = (gw: Gateway, id: string, params: object) => rpc(gw, id, 'rwd.log', params)

async function logSession(page: Page) {
  await expect.poll(async () => (await status(page)).logSession, { timeout: 10_000 }).toBeTruthy()
  return (await status(page)).logSession as string
}

test('session log: pages, the user’s actions, console and failed requests with bodies; masked values never stored', async ({ page, gw }) => {
  gw.setConfig({ maskSelectors: ['#member'] })
  const s = await openFixture(page, gw)
  const id = s.pageId!
  const session = await logSession(page)

  await page.locator('#q').fill('洋葱')
  await page.locator('#q').press('Tab')
  await page.locator('#member').fill('王五')
  await page.locator('#member').press('Tab')
  await page.locator('#plain').click()
  await page.evaluate(() => {
    console.error('boom 1')
    return fetch('/api/missing?x=1', { method: 'POST', body: '{"a":1}' }).catch(() => null)
  })

  await expect.poll(async () => (await log(gw, id, { op: 'records', kinds: ['net'] })).records.length).toBeGreaterThan(0)
  const res = await log(gw, id, { op: 'records', limit: 500 })
  expect(res.session).toBe(session)
  const lines = res.records.map((r: any) => `${r.kind} ${JSON.stringify(r.data)}`)
  const has = (re: RegExp) => expect(lines.some((l: string) => re.test(l)), `${re}\n${lines.join('\n')}`).toBe(true)
  has(/^page .*"event":"open"/)
  has(/^action .*"event":"input".*关键词.*"value":"洋葱"/)
  has(/^action .*"event":"input".*会员名.*"value":"••••"/)
  has(/^action .*"event":"tap".*普通按钮/)
  has(/^console .*"type":"error".*boom 1/)
  has(/^net .*"method":"POST".*\/api\/missing.*"status":404.*"hasBody":true/)
  expect(JSON.stringify(res)).not.toContain('王五')
  expect(JSON.stringify(res)).not.toContain('"reqBody"')

  // Errors only; then the full record with its bodies.
  const problems = await log(gw, id, { op: 'records', problems: true })
  expect(problems.records.map((r: any) => r.kind).sort()).toEqual(['console', 'net'])
  const net = problems.records.find((r: any) => r.kind === 'net')
  const detail = await rpc(gw, id, 'rwd.logDetail', { seq: net.seq })
  expect(detail.data.reqBody).toBe('{"a":1}')
  expect(detail.data.resBody).toContain('not found')

  const ov = await log(gw, id, { op: 'overview' })
  expect(ov.session).toMatchObject({ id: session, source: 'cookie', current: true })
  expect(ov.session.counts.error).toBeGreaterThanOrEqual(1)
  expect(ov.pages[0].data.event).toBe('open')
  expect(ov.problems.length).toBe(2)
})

test('one session per launch: reloads stay in it, a new launch starts another, the last 3 are kept', async ({ page, gw, context }) => {
  await openFixture(page, gw)
  const first = await logSession(page)
  await page.reload()
  await waitOnline(page, gw)
  expect(await logSession(page)).toBe(first)

  // The app process ended: its session cookie is gone.
  const seen = [first]
  for (let i = 0; i < 3; i++) {
    await context.clearCookies()
    await page.reload()
    await waitOnline(page, gw)
    const next = await logSession(page)
    expect(seen).not.toContain(next)
    seen.push(next)
  }
  const id = (await status(page)).pageId!
  await expect
    .poll(async () => (await log(gw, id, { op: 'sessions' })).sessions.map((x: any) => x.id))
    .toEqual(seen.slice(-3).reverse())
  const opens = await log(gw, id, { op: 'records', session: seen[1], kinds: ['page'] })
  expect(opens.records.filter((r: any) => r.data.event === 'open')).toHaveLength(1)
})

test('the app’s launch id wins over the inferred one', async ({ page, gw }) => {
  await page.addInitScript(() => {
    ;(window as any).RWDLaunchId = () => Promise.resolve('host-launch-42')
  })
  const s = await openFixture(page, gw)
  expect(await logSession(page)).toBe('host-launch-42')
  expect((await log(gw, s.pageId!, { op: 'overview' })).session.source).toBe('app')

  await page.reload()
  const again = await openFixture(page, gw, { launchId: 'run-launch-7' })
  expect(await logSession(page)).toBe('run-launch-7')
  expect((await log(gw, again.pageId!, { op: 'sessions' })).sessions.map((x: any) => x.id)).toEqual(['run-launch-7', 'host-launch-42'])
})

test('run({ record: false }) records nothing; the project switch deletes the log', async ({ page, gw }) => {
  const s = await openFixture(page, gw, { record: false })
  expect((await status(page)).logSession).toBeNull()
  const none = await gw.rpc(s.pageId!, 'rwd.log', { op: 'overview' })
  expect(none.error.code).toBe('not_found')

  // Recorded on the next page, then the project turns it off.
  await page.goto('about:blank')
  const on = await openFixture(page, gw)
  await logSession(page)
  await page.evaluate(() => console.log('kept for now'))
  await expect.poll(async () => (await log(gw, on.pageId!, { op: 'records' })).records.length).toBeGreaterThan(0)
  gw.setConfig({ sessionLog: false })
  await page.reload()
  const off = await waitOnline(page, gw)
  await expect.poll(async () => (await status(page)).logSession).toBeNull()
  await expect.poll(async () => (await log(gw, off.pageId!, { op: 'sessions' })).sessions).toEqual([])
})
