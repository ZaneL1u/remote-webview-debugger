import { test, expect, openDemo, openFixture, status, dialogButton } from './fixtures'

test('two-line pill; tapping the device code copies it, the rest opens the card', async ({ page, gw, browserName }) => {
  if (browserName === 'chromium') await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const s = await openDemo(page, gw)
  const pill = page.locator('#__rwd .pill')
  await expect(pill.locator('.brand')).toHaveText('Remote Debugger')
  const copy = pill.locator('.copy')
  await expect(copy).toHaveText(s.deviceCode!)
  // Two lines: the code sits under the name.
  const nameBox = (await pill.locator('.brand').boundingBox())!
  const codeBox = (await copy.boundingBox())!
  expect(codeBox.y).toBeGreaterThan(nameBox.y + nameBox.height - 2)

  await copy.tap()
  await expect(copy).toHaveText('已复制')
  await expect(page.locator('#__rwd .win')).not.toHaveClass(/\bopen\b/)
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(s.deviceCode)
  await expect(copy).toHaveText(s.deviceCode!)

  await pill.locator('.brand').tap()
  await expect(page.locator('#__rwd .win')).toHaveClass(/\bopen\b/)
})

test('auto-approve: turning it on asks first; then attach requests are allowed at once with a note', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  await page.locator('#__rwd .pill .brand').tap()
  const auto = page.locator('#__rwd .win [data-action=auto]')
  await expect(auto).toHaveAttribute('aria-checked', 'false')
  await auto.tap()
  // A real decision: explained, with the level to use (查看并操作 preselected).
  const dlg = page.locator('#__rwd .scrim:not(.out) .dlg')
  await expect(dlg).toContainText('开启自动允许接入？')
  await expect(dialogButton(page, '[data-choice=interact]')).toHaveClass('choice on')
  await dialogButton(page, '.allow').tap()
  await expect(auto).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#__rwd .toast')).toContainText('已开启自动允许接入')

  // The agent asks for advanced; the user allowed up to interact.
  const req = gw.requestAttach(s.deviceId!, { levels: ['observe', 'interact', 'advanced'] })
  expect(await req.decision).toBe('interact')
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toHaveCount(0)
  await expect(page.locator('#__rwd .toast').last()).toContainText('已自动允许「客服机器人」接入')

  // Off again (after the session): back to asking.
  gw.setControl(s.deviceId!, 'none')
  await page.locator('#__rwd .pill .brand').tap()
  await auto.tap()
  await expect(auto).toHaveAttribute('aria-checked', 'false')
  gw.requestAttach(s.deviceId!, { levels: ['observe'] })
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toContainText('AI 请求接入')
})

test('lock off: while the agent operates the user can still tap the page', async ({ page, gw }) => {
  const s = await openDemo(page, gw, 'detail.html?id=1&key=rwd_pk_test0000000000000000000', '')
  await page.locator('#__rwd .pill .brand').tap()
  const lock = page.locator('#__rwd .win [data-action=lock]')
  await expect(lock).toHaveAttribute('aria-checked', 'true')
  await lock.tap()
  await expect(lock).toHaveAttribute('aria-checked', 'false')

  gw.setControl(s.deviceId!, 'agent')
  await expect(page.locator('#__rwd .glow')).toBeVisible()
  await expect(page.locator('#__rwd .overlay')).toBeHidden()
  await page.locator('#plus').tap()
  await expect(page.locator('#qty')).toHaveValue('2')
  expect((await status(page)).control).toBe('agent')
})

test('run({ lockScreen: false }) sets the default', async ({ page, gw }) => {
  const s = await openFixture(page, gw, { lockScreen: false })
  gw.setControl(s.deviceId!, 'agent')
  await expect(page.locator('#__rwd .glow')).toBeVisible()
  await expect(page.locator('#__rwd .overlay')).toBeHidden()
})

test('theme follows the page: light glass on a light page, dark on a dark one; option overrides', async ({ page, gw }) => {
  await openDemo(page, gw)
  const host = page.locator('#__rwd')
  await expect(host).toHaveAttribute('data-theme', 'light')
  const bg = () => page.locator('#__rwd .pill').evaluate(el => getComputedStyle(el).backgroundColor)
  await expect.poll(bg).toMatch(/rgba\(255, 255, 255/)
  await page.evaluate(() => {
    document.body.style.background = '#111'
    ;(window as any).RemoteWebviewDebugger.help(false)
  })
  await expect(host).toHaveAttribute('data-theme', 'dark')
  await expect.poll(bg).toMatch(/rgba\(12, 14, 20/)
})

test('run({ theme: "dark" }) keeps dark glass on a light page; switches are compact', async ({ page, gw }) => {
  await openFixture(page, gw, { theme: 'dark' })
  await expect(page.locator('#__rwd')).toHaveAttribute('data-theme', 'dark')
  await page.locator('#__rwd .pill .brand').tap()
  const sw = (await page.locator('#__rwd .win .sw').first().boundingBox())!
  expect(sw.width).toBeLessThanOrEqual(32)
  expect(sw.height).toBeLessThanOrEqual(20)
})
