import { test, expect, openDemo, openFixture, rpc, snapshot, refOf, status, dialogButton, waitOnline, KEY } from './fixtures'
import type { Page } from '@playwright/test'

// Two languages, two audiences: the phone user's UI follows run({ lang }) or
// the browser; what goes back to the agent follows welcome.agentLang. The
// other specs run in zh-CN with agentLang 'zh' (playwright.config.ts, fixtures.ts).

/** The element is inside the viewport and its content does not overflow it (no clipped buttons). */
async function expectFits(page: Page, selector: string) {
  const r = await page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect()
    return { left: box.left, right: box.right, scroll: el.scrollWidth, client: el.clientWidth, vw: window.innerWidth }
  })
  expect(r.left).toBeGreaterThanOrEqual(0)
  expect(r.right).toBeLessThanOrEqual(r.vw)
  expect(r.scroll).toBeLessThanOrEqual(r.client + 1)
}

test.describe('browser in English', () => {
  test.use({ locale: 'en-US' })

  test('English UI by default: pill, card, bottom bar, attach dialog; everything fits', async ({ page, gw }) => {
    const s = await openFixture(page, gw, { helpButton: true })
    expect((await status(page)).lang).toBe('en')
    await expect(page.locator('#__rwd')).toHaveAttribute('lang', 'en')

    const pill = page.locator('#__rwd .pill')
    await expect(pill.locator('.copy')).toHaveText(s.deviceCode!)
    await pill.locator('.brand').tap()
    const win = page.locator('#__rwd .win')
    await expect(win).toHaveClass(/\bopen\b/)
    await expect(win.locator('.link')).toHaveText('Online')
    await expect(win.locator('.note')).toHaveText(
      'Share this device code with the developer. AI asks before joining, and you can take over or end anytime.'
    )
    await expect(win.locator('[data-action=auto] .t')).toContainText('Auto-allow AI')
    await expect(win.locator('[data-action=lock] .t')).toContainText('Lock screen while AI works')
    await expect(win.locator('.row .btn')).toHaveText(['Get help', 'Hide'])
    await expectFits(page, '#__rwd .win')

    // Asking for help: the pill says so, and still fits.
    await win.locator('[data-action=help]').tap()
    await expect(pill.locator('.copy')).toHaveText(`${s.deviceCode} · Help requested`)
    await expect(win.locator('[data-action=help]')).toHaveText('Cancel help')
    await win.locator('[data-action=toggle]').tap()
    await expectFits(page, '#__rwd .pill')

    const bar = page.locator('#__rwd .bar')
    gw.setControl(s.deviceId!, 'observe', 'Support bot', 'observe')
    await expect(bar.locator('.status')).toHaveText('AI is viewingSupport bot')
    await expect(bar.locator('.btn')).toHaveText(['End'])
    await expectFits(page, '#__rwd .bar')

    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    await expect(bar.locator('.status')).toHaveText('AI working')
    await expect(bar.locator('.btn')).toHaveText(['Take over', 'End'])
    await expectFits(page, '#__rwd .bar')

    await bar.locator('[data-action=takeover]').tap()
    await expect(bar.locator('.status')).toHaveText('Your turn')
    await expect(bar.locator('.btn')).toHaveText(['Hand back', 'End'])
    await expectFits(page, '#__rwd .bar')
    // One line each: the buttons keep their height.
    for (const b of await bar.locator('.btn').all()) expect((await b.boundingBox())!.height).toBeLessThan(56)

    gw.setControl(s.deviceId!, 'none')
    const req = gw.requestAttach(s.deviceId!, { agent: 'Support bot', levels: ['observe', 'interact', 'advanced'] })
    const dlg = page.locator('#__rwd .scrim:not(.out) .dlg')
    await expect(dlg.locator('h3')).toHaveText('AI wants to join')
    await expect(dlg).toContainText('"Support bot" wants to view this page. Allow?')
    await expect(dlg).toContainText(/Auto-deny in \d+s/)
    await expect(dialogButton(page, '[data-choice]')).toHaveText(['View only', 'View and interact', 'Advanced (also run scripts, read storage)'])
    await expect(dialogButton(page, '.acts button')).toHaveText(['Deny', 'Allow'])
    await dialogButton(page, '.allow').tap()
    expect(await req.decision).toBe('advanced')
  })

  test('run({ lang: "zh" }) wins over an English browser', async ({ page, gw }) => {
    const s = await openFixture(page, gw, { lang: 'zh' })
    expect((await status(page)).lang).toBe('zh')
    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    await expect(page.locator('#__rwd .bar .btn')).toHaveText(['接管', '结束'])
  })
})

test('run({ lang: "en" }) wins over a Chinese browser', async ({ page, gw }) => {
  const s = await openFixture(page, gw, { lang: 'en' })
  expect((await status(page)).lang).toBe('en')
  gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
  await expect(page.locator('#__rwd .bar .btn')).toHaveText(['Take over', 'End'])
})

test('agent-facing text follows welcome.agentLang, English without it; the user keeps their language', async ({ page, gw }) => {
  // A gateway that does not send agentLang: English.
  gw.setAgentLang(null)
  let s = await openFixture(page, gw)
  const id = s.pageId!
  let stale = await gw.rpc(id, 'rwd.click', { ref: 'e99999' })
  expect(stale.error).toEqual({ code: 'not_found', message: 'ref=e99999 is not in the latest snapshot; take a new snapshot' })
  expect((await gw.rpc(id, 'rwd.nope', {})).error.message).toBe('Unknown method: rwd.nope')
  // Timeline events too.
  await page.locator('#plain').tap()
  await gw.waitFor(() => gw.messages('event', id).find((e: any) => e.kind === 'user_tap' && e.summary === 'Tapped button "普通按钮"'), 5000, 'English tap event')

  // The UI is in Chinese (zh-CN browser) and so is the confirmation; the
  // agent still reads English.
  gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
  const click = gw.rpc(id, 'rwd.click', { ref: refOf(await snapshot(gw, id), 'button', '搜索') })
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toContainText('AI 想要点击「搜索」，允许吗？')
  await dialogButton(page, '.deny').tap()
  expect((await click).error).toEqual({ code: 'forbidden', message: 'The user denied this action' })
  gw.setControl(s.deviceId!, 'none')

  // agentLang 'zh' from the next welcome on.
  gw.setAgentLang('zh')
  await page.reload()
  s = await waitOnline(page, gw)
  stale = await gw.rpc(s.pageId!, 'rwd.click', { ref: 'e99999' })
  expect(stale.error.message).toBe('ref=e99999 不在最近一次快照里，请重新获取快照')

  // ...and back to 'en'.
  gw.setAgentLang('en')
  await page.reload()
  s = await waitOnline(page, gw)
  stale = await gw.rpc(s.pageId!, 'rwd.click', { ref: 'e99999' })
  expect(stale.error.message).toBe('ref=e99999 is not in the latest snapshot; take a new snapshot')
})

test('demo shop in English via ?lang=en, the cross-page bug included', async ({ page, gw }) => {
  const s = await openDemo(page, gw, 'index.html', `?key=${KEY}&lang=en`)
  const pageId = s.pageId!
  const hello = gw.findPage(pageId)!.hello
  expect(hello.page.title).toBe('Demo Shop - Products')
  expect(hello.device.app).toEqual({ name: 'Demo Shop', version: '1.0.0' })
  // The demo hands its language to the SDK.
  expect((await status(page)).lang).toBe('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.card')).toHaveCount(4)
  await expect(page.locator('#recommend')).toHaveText('No recommendations yet')

  let snap = await snapshot(gw, pageId)
  expect(snap).toContain('heading "Demo Shop" [level=1]')
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'link', 'Travel Coffee Mug') })
  await page.waitForURL('**/detail.html*')
  await waitOnline(page, gw)
  // Remembered without ?lang.
  await expect(page.locator('#name')).toHaveText('Travel Coffee Mug')
  await expect(page.locator('#price')).toHaveText('$19.00')

  snap = await snapshot(gw, pageId)
  const selected = await rpc(gw, pageId, 'rwd.select', { ref: refOf(snap, 'combobox', 'Option'), values: ['Gift box (+$5)'] })
  expect(selected).toEqual({ selected: ['gift'] })
  await expect(page.locator('#unit')).toHaveText('$24.00')
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', 'Increase quantity') })
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', 'Buy now') })
  await page.waitForURL('**/checkout.html*')
  await waitOnline(page, gw)
  await expect(page.locator('h1')).toHaveText('Checkout')
  await expect(page.locator('#item')).toHaveText('Travel Coffee Mug · Gift box (+$5) × 2')
  await expect(page.locator('#total')).toHaveText('--')
  const errors = await rpc(gw, pageId, 'rwd.console', { types: ['error'] })
  expect(errors.messages.find((m: any) => m.source === 'exception').text).toContain('TypeError')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('demo:order')!).price)).toBe('$24.00')

  snap = await snapshot(gw, pageId)
  expect(refOf(snap, 'textbox', 'Recipient')).toMatch(/^e\d+$/)
  expect(refOf(snap, 'button', 'Place order')).toMatch(/^e\d+$/)
})
