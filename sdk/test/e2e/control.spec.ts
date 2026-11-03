import { test, expect, openDemo, rpc, snapshot, refOf, status, waitOnline } from './fixtures'

test('agent state: overlay swallows real taps, rwd.click still works', async ({ page, gw }) => {
  const s = await openDemo(page, gw, 'detail.html?id=1&key=rwd_pk_test0000000000000000000', '')
  await expect(page.locator('#name')).toHaveText('无线降噪耳机 Pro')
  const pageId = s.pageId!

  // Locked as soon as the agent attaches, before it acts.
  gw.setControl(s.deviceId!, 'observe')
  await expect(page.locator('#__rwd .bar')).toContainText('AI 查看中')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()

  gw.setControl(s.deviceId!, 'agent')
  await expect(page.locator('#__rwd .bar')).toContainText('AI 操作中')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
  await expect(page.locator('#__rwd .glow')).toBeVisible()
  expect(await status(page)).toMatchObject({ control: 'agent' })

  // Real (trusted) input: tap, mouse click, keyboard. None gets through.
  await page.locator('#plus').tap({ force: true })
  await page.locator('#plus').click({ force: true })
  const box = (await page.locator('#plus').boundingBox())!
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await page.evaluate(() => (document.getElementById('qty') as HTMLInputElement).focus())
  await page.keyboard.type('9')
  await expect(page.locator('#qty')).toHaveValue('1')

  // The agent's synthesized input passes, and the target is highlighted.
  const snap = await snapshot(gw, pageId)
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', '增加数量') })
  await expect(page.locator('#qty')).toHaveValue('2')
  await expect(page.locator('#__rwd .hl')).toHaveCount(1)
  await rpc(gw, pageId, 'rwd.fill', { ref: refOf(snap, 'spinbutton', '数量'), value: '5' })
  await expect(page.locator('#qty')).toHaveValue('5')

  // The lock is remembered across navigation: the next page locks on load.
  await rpc(gw, pageId, 'rwd.navigate', { url: 'index.html' })
  await page.waitForURL('**/index.html')
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
  await waitOnline(page, gw)
  await expect(page.locator('#__rwd .overlay')).toBeVisible()
})

test('takeover, handback and end send control messages', async ({ page, gw }) => {
  const s = await openDemo(page, gw, 'detail.html?id=2&key=rwd_pk_test0000000000000000000', '')
  const pageId = s.pageId!
  await expect(page.locator('#name')).toHaveText('智能手环 6')
  gw.setControl(s.deviceId!, 'agent')
  const pill = page.locator('#__rwd .pill')
  const bar = page.locator('#__rwd .bar')
  await expect(bar).toContainText('AI 操作中')

  // The agent cannot press our buttons (they are skipped by hit testing and
  // only react to trusted events).
  await page.evaluate(() => {
    const btn = document.getElementById('__rwd')!.shadowRoot!.querySelector('[data-action=takeover]') as HTMLElement
    btn.click()
  })
  expect(gw.messages('control', pageId)).toEqual([])

  await page.locator('#__rwd [data-action=takeover]').tap()
  await gw.waitFor(() => gw.messages('control', pageId).length === 1, 5000, 'takeover')
  expect(gw.messages('control', pageId)[0]).toEqual({ t: 'control', action: 'takeover' })
  await expect(bar).toContainText('你在操作')
  await expect(page.locator('#__rwd .overlay')).toBeHidden()
  await expect(page.locator('#__rwd .glow')).toBeVisible()

  // The user can use the page again; the agent's interactive calls are refused.
  await page.locator('#plus').tap()
  await expect(page.locator('#qty')).toHaveValue('2')
  const refused = await gw.rpc(pageId, 'rwd.click', { ref: 'e1' })
  expect(refused.error.code).toBe('takeover')
  // Even if a gateway forwarded one, the page refuses it while the user is in control.
  const p = gw.findPage(pageId)
  const direct = await new Promise<any>(resolve => {
    p.pending.set(9999, resolve)
    p.ws.send(JSON.stringify({ id: 9999, method: 'rwd.press', params: { key: 'Enter' } }))
  })
  expect(direct.error.code).toBe('takeover')

  await page.locator('#__rwd [data-action=handback]').tap()
  await gw.waitFor(() => gw.messages('control', pageId).length === 2, 5000, 'handback')
  expect(gw.messages('control', pageId)[1]).toEqual({ t: 'control', action: 'handback' })
  await expect(bar).toContainText('AI 操作中')

  await page.locator('#__rwd [data-action=end]').tap()
  await gw.waitFor(() => gw.messages('control', pageId).length === 3, 5000, 'end')
  expect(gw.messages('control', pageId)[2]).toEqual({ t: 'control', action: 'end' })
  await expect(pill).toContainText(`Remote Debugger${s.deviceCode}`)
  await expect(page.locator('#__rwd .overlay')).toBeHidden()
})

test('help button sends help and shows 求助中', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  const pageId = s.pageId!
  const help = page.locator('#__rwd [data-action=help]')
  await expect(help).toHaveText('求助')
  // The pill expands into a card that holds the help button.
  await page.locator('#__rwd .pill .brand').tap()
  await expect(page.locator('#__rwd .win')).toHaveClass(/\bopen\b/)
  await help.tap()
  await gw.waitFor(() => gw.messages('help', pageId).length, 5000, 'help')
  expect(gw.messages('help', pageId)[0]).toEqual({ t: 'help', on: true })
  await expect(help).toHaveText('取消求助')
  expect((await status(page)).help).toBe(true)

  // The gateway clears it when an agent joins.
  gw.sendHelp(s.deviceId!, false)
  await expect(help).toHaveText('求助')

  // The page API does the same.
  await page.evaluate(() => (window as any).RemoteWebviewDebugger.help(true))
  await gw.waitFor(() => gw.messages('help', pageId).length === 2, 5000, 'help via API')
  await expect(help).toHaveText('取消求助')
  // A new connection reports the help state in hello.
  await page.reload()
  await waitOnline(page, gw)
  expect(gw.findPage(pageId).hello.help).toBe(true)
})

test('pill can be dragged and snaps to the nearest edge', async ({ page, gw, browserName }) => {
  // Playwright has no trusted touch-move input, and WebKit's iPhone emulation
  // does not turn page.mouse into pointer events.
  test.skip(browserName === 'webkit', 'needs a trusted pointer drag')
  await openDemo(page, gw)
  const pill = page.locator('#__rwd .pill')
  const box = (await pill.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x + box.width).toBeGreaterThan(vp.width - 20)
  // Drag to the left half with real pointer events.
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(40, 200, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await pill.boundingBox())!.x).toBe(8)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rwd:pill')!))
  expect(stored.side).toBe('left')
})
