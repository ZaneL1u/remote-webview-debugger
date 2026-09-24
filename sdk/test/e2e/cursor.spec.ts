import { test, expect, openDemo, rpc, snapshot, refOf } from './fixtures'

test('agent cursor: on screen while operating, glides quickly to each target and taps', async ({ page, gw }) => {
  const s = await openDemo(page, gw, 'detail.html?id=1&key=rwd_pk_test0000000000000000000', '')
  const pageId = s.pageId!
  const cursor = page.locator('#__rwd .cursor')

  gw.setControl(s.deviceId!, 'observe')
  await expect(page.locator('#__rwd .bar')).toContainText('AI 查看中')
  await expect(page.locator('#__rwd .glow')).toBeHidden()
  await expect(cursor).not.toHaveClass(/\bon\b/)

  gw.setControl(s.deviceId!, 'agent')
  await expect(page.locator('#__rwd .glow')).toBeVisible()
  await expect(cursor).toHaveClass(/\bon\b/)

  const snap = await snapshot(gw, pageId)
  const box = (await page.locator('#plus').boundingBox())!
  const started = Date.now()
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', '增加数量') })
  const took = Date.now() - started
  expect(took).toBeGreaterThanOrEqual(80)
  expect(took).toBeLessThan(1500)
  // The tap ripples right away (it is short-lived).
  await expect(page.locator('#__rwd .ripple')).not.toHaveCount(0)
  await expect(page.locator('#qty')).toHaveValue('2')
  // The click waited for the glide; the transition's last frame may still be painting.
  const at = () => cursor.evaluate(el => new DOMMatrix(getComputedStyle(el).transform))
  await expect.poll(async () => Math.abs((await at()).e - (box.x + box.width / 2))).toBeLessThan(3)
  await expect.poll(async () => Math.abs((await at()).f - (box.y + box.height / 2))).toBeLessThan(3)
  // No text on the pointer; it stays between actions.
  await expect(page.locator('#__rwd .cursor .tag')).toHaveCount(0)
  await page.waitForTimeout(1200)
  await expect(cursor).toHaveClass(/\bon\b/)

  gw.setControl(s.deviceId!, 'user')
  await expect(cursor).not.toHaveClass(/\bon\b/)
  await expect(page.locator('#__rwd .bar')).toContainText('你在操作')
  expect(await page.locator('#__rwd .glow').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
})

test('task card at the top while an agent is attached; bottom bar centered', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  const card = page.locator('#__rwd .task')
  gw.setControl(s.deviceId!, 'agent')
  await expect(card).toBeHidden()
  gw.setTask(s.deviceId!, {
    title: '周数据与反馈排查',
    steps: ['找到周切换的功能', '切换到上一周', '读取完整周进度信息', '查找吐槽与建议'],
    current: 1,
    agent: 'Claude',
  })
  await expect(card).toBeVisible()
  await expect(card.locator('.title')).toHaveText('周数据与反馈排查')
  await expect(card.locator('.count')).toHaveText('2/4')
  await expect(card.locator('li.done')).toHaveText('找到周切换的功能')
  await expect(card.locator('li.now')).toHaveText('切换到上一周')
  await expect(card.locator('li:not(.done):not(.now)')).toHaveCount(2)

  // The bottom bar sits centered at the bottom.
  const bar = (await page.locator('#__rwd .bar').boundingBox())!
  const vp = page.viewportSize()!
  expect(Math.abs(bar.x + bar.width / 2 - vp.width / 2)).toBeLessThan(2)
  expect(vp.height - (bar.y + bar.height)).toBeLessThan(60)

  // A tap folds the card to the title and current step.
  await card.tap()
  await expect(card).toHaveClass(/\bmin\b/)
  await expect(card.locator('ol')).toBeHidden()

  // The agent leaving clears it.
  gw.setControl(s.deviceId!, 'none')
  await expect(card).toBeHidden()
})

test('a click reaches the listener on a child of the ref element', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  // The ref names the wrapper; the listener sits on the inner link (as with
  // Vue components that pass @click to their root's child).
  await page.evaluate(() => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'padding:24px;text-align:center'
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', '反馈入口')
    const a = document.createElement('a')
    a.textContent = '吐槽及建议'
    a.addEventListener('click', () => (document.title = 'clicked'))
    wrap.appendChild(a)
    document.body.prepend(wrap)
  })
  const snap = await snapshot(gw, s.pageId!)
  await rpc(gw, s.pageId!, 'rwd.click', { ref: refOf(snap, 'group', '反馈入口') })
  await expect(page).toHaveTitle('clicked')
})

test('under the agent lock the user can scroll the step list and use 接管 / 结束; big buttons, red 结束', async ({ page, gw, browserName }) => {
  const s = await openDemo(page, gw)
  gw.setControl(s.deviceId!, 'agent')
  gw.setTask(s.deviceId!, {
    title: '完整回归一遍下单流程',
    steps: ['打开商品列表', '进入商品详情', '选择规格', '修改数量', '加入购物车', '去结算', '核对金额', '提交订单前停下'],
    current: 6,
  })
  const list = page.locator('#__rwd .task ol')
  await expect(list).toBeVisible()
  const dims = await list.evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop }))
  expect(dims.sh).toBeGreaterThan(dims.ch)
  // The current step was scrolled into view.
  expect(dims.top).toBeGreaterThan(0)
  await expect(page.locator('#__rwd .task li.now')).toBeInViewport()

  // Trusted scrolling on the list works (the lock lets our own controls through);
  // the page itself does not move.
  const pageY = await page.evaluate(() => window.scrollY)
  if (browserName === 'chromium') {
    const box = (await list.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, -400)
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(0)
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(pageY)

  // Big, tappable controls; 结束 is a red button.
  for (const action of ['takeover', 'end']) {
    const b = (await page.locator(`#__rwd .bar [data-action=${action}]`).boundingBox())!
    expect(b.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.locator('#__rwd .bar [data-action=end]').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(239, 68, 68)')
})
