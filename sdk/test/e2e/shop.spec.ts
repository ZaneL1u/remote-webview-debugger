import { test, expect, openDemo, rpc, snapshot, refOf, waitOnline, type Gateway } from './fixtures'
import type { Page } from '@playwright/test'

async function nextPageLoad(page: Page, gw: Gateway, pageId: string, urlPart: string) {
  await page.waitForURL(`**/${urlPart}*`)
  await waitOnline(page, gw)
  return gw.findPage(pageId)!
}

test('shop flow across pages: click, select, the cross-page bug in console', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  const pageId = s.pageId!
  await expect(page.locator('.card')).toHaveCount(4)

  // 列表页 → 详情页
  let snap = await snapshot(gw, pageId)
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'link', '便携保温咖啡杯') })
  const detail = await nextPageLoad(page, gw, pageId, 'detail.html')
  expect(detail.pageId).toBe(pageId) // same tab: same pageId across navigation
  await expect(page.locator('#name')).toHaveText('便携保温咖啡杯')

  snap = await snapshot(gw, pageId)
  const selected = await rpc(gw, pageId, 'rwd.select', { ref: refOf(snap, 'combobox', '规格'), values: ['礼盒装（+¥39）'] })
  expect(selected).toEqual({ selected: ['gift'] })
  await expect(page.locator('#unit')).toHaveText('¥168.00')
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', '增加数量') })
  await expect(page.locator('#qty')).toHaveValue('2')

  // 详情页 → 结算页: the page throws while computing the total.
  await rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', '立即购买') })
  await nextPageLoad(page, gw, pageId, 'checkout.html')
  await expect(page.locator('#total')).toHaveText('--')

  const errors = await rpc(gw, pageId, 'rwd.console', { types: ['error'] })
  const uncaught = errors.messages.find((m: any) => m.source === 'exception')
  expect(uncaught.text).toContain('TypeError')
  expect(uncaught.text).toMatch(/toFixed is not a function|toFixed/)
  // ...and the timeline got an error event.
  await gw.waitFor(() => gw.messages('event', pageId).find((e: any) => e.kind === 'error' && /TypeError/.test(e.summary)), 5000, 'error event')
  const nav = gw.messages('event', pageId)
  expect(nav.some((e: any) => e.kind === 'error' && e.summary.startsWith('TypeError'))).toBe(true)
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('demo:order')!))
  expect(stored.price).toBe('¥168.00')
})

test('checkout form: fill, type, press, select, masking and the order request', async ({ page, gw }) => {
  await page.goto('/demo/platform/index.html?key=rwd_pk_test0000000000000000000')
  await page.evaluate(() =>
    sessionStorage.setItem('demo:order', JSON.stringify({ id: 1, name: '无线降噪耳机 Pro', spec: '标准装', qty: 1, price: 899 }))
  )
  const s = await openDemo(page, gw, 'checkout.html', '')
  const pageId = s.pageId!
  await expect(page.locator('#total')).toHaveText('¥899.00')

  let snap = await snapshot(gw, pageId)
  await rpc(gw, pageId, 'rwd.fill', { ref: refOf(snap, 'textbox', '收货人'), value: '张三' })
  await expect(page.locator('#receiver')).toHaveValue('张三')
  await rpc(gw, pageId, 'rwd.type', { ref: refOf(snap, 'textbox', '手机号'), text: '13800001111' })
  await expect(page.locator('#phone')).toHaveValue('13800001111')
  await rpc(gw, pageId, 'rwd.type', { ref: refOf(snap, 'textbox', '订单备注'), text: 'Hi 你好' })
  await rpc(gw, pageId, 'rwd.press', { key: 'Enter' })
  await rpc(gw, pageId, 'rwd.type', { text: 'ok' })
  await expect(page.locator('#note')).toHaveValue('Hi 你好\nok')
  await rpc(gw, pageId, 'rwd.press', { key: 'Backspace' })
  await expect(page.locator('#note')).toHaveValue('Hi 你好\no')
  // Caret movement: up keeps the column, End goes to the end of the line.
  await rpc(gw, pageId, 'rwd.press', { key: 'ArrowUp' })
  await rpc(gw, pageId, 'rwd.type', { text: 'X' })
  await expect(page.locator('#note')).toHaveValue('HXi 你好\no')
  await rpc(gw, pageId, 'rwd.press', { key: 'End' })
  await rpc(gw, pageId, 'rwd.type', { text: '!' })
  await expect(page.locator('#note')).toHaveValue('HXi 你好!\no')
  await rpc(gw, pageId, 'rwd.press', { key: 'Shift+Home' })
  await rpc(gw, pageId, 'rwd.press', { key: 'Backspace' })
  await expect(page.locator('#note')).toHaveValue('\no')
  await rpc(gw, pageId, 'rwd.press', { key: 'ArrowDown' })
  await rpc(gw, pageId, 'rwd.press', { key: 'ArrowLeft' })
  await rpc(gw, pageId, 'rwd.press', { key: 'Delete' })
  await expect(page.locator('#note')).toHaveValue('o')
  await rpc(gw, pageId, 'rwd.press', { key: 'ControlOrMeta+A' })
  await rpc(gw, pageId, 'rwd.press', { key: 'Delete' })
  await expect(page.locator('#note')).toHaveValue('')
  await rpc(gw, pageId, 'rwd.fill', { ref: refOf(snap, 'textbox', '支付密码'), value: '123456' })
  const sel = await rpc(gw, pageId, 'rwd.select', { ref: refOf(snap, 'combobox', '配送方式'), values: ['same-day'] })
  expect(sel.selected).toEqual(['same-day'])
  await expect(page.locator('#total')).toHaveText('¥911.00')

  // Key events are what a page sees from a real keyboard.
  const keys = await page.evaluate(() => {
    const seen: string[] = []
    const el = document.getElementById('address')!
    for (const t of ['keydown', 'keypress', 'beforeinput', 'input', 'keyup']) el.addEventListener(t, (e: any) => seen.push(t + ':' + (e.key || e.data || '')))
    ;(window as any).__seen = seen
    return true
  })
  expect(keys).toBe(true)
  await rpc(gw, pageId, 'rwd.type', { ref: refOf(snap, 'textbox', '收货地址'), text: 'A' })
  expect(await page.evaluate(() => (window as any).__seen)).toEqual(['keydown:A', 'keypress:A', 'beforeinput:A', 'input:A', 'keyup:A'])

  // Masking: phone, card number and password never show.
  snap = await snapshot(gw, pageId)
  expect(snap).not.toContain('13800001111')
  expect(snap).not.toContain('123456')
  expect(snap).not.toContain('6222 0200 1234 5678')
  expect(snap).toContain('••••')
  expect(snap).toContain('张三')
  await page.evaluate(() => console.log('debug phone', (document.getElementById('phone') as HTMLInputElement).value))
  const logs = await rpc(gw, pageId, 'rwd.console', { types: ['log'] })
  expect(logs.messages.at(-1).text).toBe('debug phone ••••')

  // Submit (data-rwd-confirm: the user allows it first): POST api/order → 404, Authorization redacted.
  const clicked = rpc(gw, pageId, 'rwd.click', { ref: refOf(snap, 'button', '提交订单') })
  await page.locator('#__rwd .scrim:not(.out) .dlg .allow').tap()
  await clicked
  await gw.waitFor(() => gw.messages('event', pageId).find((e: any) => e.kind === 'net_fail' && e.summary.includes('/api/order')), 5000, 'net_fail event')
  const failed = await rpc(gw, pageId, 'rwd.network', { failedOnly: true })
  const order = failed.requests.find((r: any) => r.url.endsWith('/demo/platform/api/order'))
  expect(order).toMatchObject({ method: 'POST', status: 404, type: 'fetch' })
  expect(order.durationMs).toBeGreaterThanOrEqual(0)
  const detail = await rpc(gw, pageId, 'rwd.networkDetail', { id: order.id })
  const auth = Object.entries(detail.request.headers).find(([k]) => k.toLowerCase() === 'authorization')
  expect(auth![1]).toBe('••••')
  expect(detail.request.body).toContain('张三')
  expect(detail.response.body).toBe('not found')
  const ev = gw.messages('event', pageId).find((e: any) => e.kind === 'net_fail' && e.summary.includes('/api/order'))
  expect(ev.summary).toBe('POST /demo/platform/api/order → 404')
})

test('scroll, hover, waitFor, evaluate, navigate and back', async ({ page, gw }) => {
  // The checkout form is long enough to scroll.
  let s = await openDemo(page, gw, 'checkout.html')
  await rpc(gw, s.pageId!, 'rwd.scroll', { dy: 200 })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  s = await openDemo(page, gw)
  const pageId = s.pageId!
  await expect(page.locator('.card')).toHaveCount(4)
  const snap = await snapshot(gw, pageId)
  await page.evaluate(() => {
    ;(window as any).__hovered = ''
    document.querySelector('.card')!.addEventListener('mouseover', () => ((window as any).__hovered = 'yes'))
  })
  await rpc(gw, pageId, 'rwd.hover', { ref: refOf(snap, 'link', '无线降噪耳机 Pro') })
  expect(await page.evaluate(() => (window as any).__hovered)).toBe('yes')

  await rpc(gw, pageId, 'rwd.waitFor', { text: '暂无推荐' })
  const timeout = await gw.rpc(pageId, 'rwd.waitFor', { text: '不存在的文字', timeoutMs: 300 })
  expect(timeout.error.code).toBe('timeout')

  const ev = await rpc(gw, pageId, 'rwd.evaluate', { function: '(a, b) => ({ sum: a + b, title: document.title, el: document.body })', args: [2, 3] })
  expect(ev.value).toEqual({ sum: 5, title: '演示商城 - 商品列表', el: '<body>' })
  const asyncEv = await rpc(gw, pageId, 'rwd.evaluate', { function: 'async () => { await new Promise(r => setTimeout(r, 10)); return [1, undefined] }' })
  expect(asyncEv.value).toEqual([1, null])
  const bad = await gw.rpc(pageId, 'rwd.evaluate', { function: '1 +' })
  expect(bad.error.code).toBe('bad_request')
  const unknown = await gw.rpc(pageId, 'rwd.nope', {})
  expect(unknown.error.code).toBe('bad_request')

  await rpc(gw, pageId, 'rwd.navigate', { url: 'detail.html?id=2' })
  await page.waitForURL('**/detail.html?id=2')
  await waitOnline(page, gw)
  await expect(page.locator('#name')).toHaveText('智能手环 6')
  await rpc(gw, pageId, 'rwd.back')
  await page.waitForURL('**/index.html*')
  await waitOnline(page, gw)
  const js = await gw.rpc(pageId, 'rwd.navigate', { url: 'javascript:alert(1)' })
  expect(js.error.code).toBe('bad_request')
})
