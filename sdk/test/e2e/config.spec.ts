import { test, expect, openFixture, rpc, snapshot, refOf, status, dialogButton } from './fixtures'

const CONFIG = {
  helpButton: true,
  maskSelectors: ['#member', 'bad[selector'],
  maskPatterns: [{ name: '手机号', regex: '1[3-9]\\d{9}' }, { name: '坏的', regex: '(' }],
  confirmSelectors: ['.danger'],
}

test('welcome.config: help button, mask selectors and patterns, confirm selectors', async ({ page, gw }) => {
  gw.setConfig(CONFIG)
  const s = await openFixture(page, gw)
  const id = s.pageId!
  // run({helpButton: false}) but the project turns it on; native hosts read status().config.
  await expect(page.locator('#__rwd [data-action=help]')).toHaveText('求助')
  expect(s.config).toEqual({ ...CONFIG, networkExclude: [], sessionLog: true, eruda: null })

  // Snapshot: the masked field's value and the phone number never show.
  const snap = await snapshot(gw, id)
  expect(snap).not.toContain('李四')
  expect(snap).not.toContain('13800001111')
  expect(snap).toContain('联系电话 ••••')
  expect(snap).toContain('textbox "会员名"')
  expect((await rpc(gw, id, 'rwd.query', { text: '13800001111' })).total).toBe(0)

  // Console text and request URLs.
  await page.evaluate(() => {
    console.log('call 13800001111 now')
    return fetch('/api/lookup?phone=13800001111').catch(() => null)
  })
  const logs = await rpc(gw, id, 'rwd.console', { types: ['log'] })
  expect(logs.messages.at(-1).text).toBe('call •••• now')
  const net = await rpc(gw, id, 'rwd.network', {})
  const req = net.requests.find((r: any) => r.url.includes('/api/lookup'))
  expect(req.url).toMatch(/\/api\/lookup\?phone=••••$/)

  // Confirm selectors: clicking .danger asks the user first.
  const click = gw.rpc(id, 'rwd.click', { ref: refOf(snap, 'button', '删除账户') })
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toContainText('AI 想要点击「删除账户」，允许吗？')
  await dialogButton(page, '.allow').tap()
  expect((await click).result).toEqual({})
  await expect(page.locator('#count')).toHaveText('1')
})

test('without config the help button follows run() and nothing extra is masked', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  await expect(page.locator('#__rwd .pill')).toContainText('Remote Debugger')
  await expect(page.locator('#__rwd [data-action=help]')).toHaveCount(0)
  expect((await status(page)).config).toEqual({ helpButton: false, maskSelectors: [], maskPatterns: [], confirmSelectors: [], networkExclude: [], sessionLog: true, eruda: null })
  const snap = await snapshot(gw, s.pageId!)
  expect(snap).toContain('13800001111')
  await rpc(gw, s.pageId!, 'rwd.click', { ref: refOf(snap, 'button', '删除账户') })
  await expect(page.locator('#count')).toHaveText('1')
})
