import { test, expect, openDemo, rpc, snapshot, refOf } from './fixtures'

// A top bar scaled with CSS `zoom` (as apps do to enlarge a toolbar on
// phones): WebKit reports getBoundingClientRect divided by the zoom, so taps
// aimed by the rect used to land on the neighbour to the left.
test('click hits the right button under a CSS zoom', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  await page.evaluate(() => {
    const bar = document.createElement('div')
    bar.style.cssText = 'position:fixed;top:0;left:0;zoom:1.1;width:calc(100% / 1.1);display:flex;z-index:2147483000;background:#fff'
    // Narrow buttons at the right edge, where the drift is largest.
    for (const name of ['章节', '全部', '刷题', '更多']) {
      const b = document.createElement('button')
      b.textContent = name
      b.style.cssText = name === '章节' ? 'flex:1;height:40px' : 'width:36px;height:40px;padding:0'
      b.addEventListener('click', () => ((window as any).__taps ||= []).push(name))
      bar.appendChild(b)
    }
    document.body.appendChild(bar)
  })
  const snap = await snapshot(gw, s.pageId!)
  for (const name of ['更多', '全部']) {
    await rpc(gw, s.pageId!, 'rwd.click', { ref: refOf(snap, 'button', name) })
  }
  expect(await page.evaluate(() => (window as any).__taps)).toEqual(['更多', '全部'])
})

test('click with holdMs is a long press', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  await page.evaluate(() => {
    const b = document.createElement('button')
    b.textContent = '长按看全标题'
    b.style.cssText = 'position:fixed;top:120px;left:20px;z-index:2147483000'
    const w = window as any
    w.__events = []
    let timer: ReturnType<typeof setTimeout> | undefined
    const start = () => (timer = setTimeout(() => w.__events.push('long'), 450))
    const end = () => clearTimeout(timer)
    b.addEventListener('touchstart', start)
    b.addEventListener('touchend', end)
    b.addEventListener('click', () => w.__events.push('click'))
    document.body.appendChild(b)
  })
  const ref = refOf(await snapshot(gw, s.pageId!), 'button', '长按看全标题')
  // A tap is too short for the page's 450 ms timer.
  await rpc(gw, s.pageId!, 'rwd.click', { ref })
  expect(await page.evaluate(() => (window as any).__events)).toEqual(['click'])
  // Held for 700 ms: the timer fires, and a held touch is not a click.
  await page.evaluate(() => ((window as any).__events = []))
  const t0 = Date.now()
  await rpc(gw, s.pageId!, 'rwd.click', { ref, holdMs: 700 })
  expect(Date.now() - t0).toBeGreaterThanOrEqual(650)
  expect(await page.evaluate(() => (window as any).__events)).toEqual(['long'])
})
