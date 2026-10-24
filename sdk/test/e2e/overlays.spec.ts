import { test, expect, openFixture, rpc, snapshot, refOf } from './fixtures'

// A popup the agent has to get past: an empty full-screen backdrop (no node in
// the aria snapshot) that closes the popup when tapped, and a bottom sheet.
async function openPopup(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const mask = document.createElement('div')
    mask.className = 'popup-mask'
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10'
    const sheet = document.createElement('div')
    sheet.className = 'popup-sheet'
    sheet.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:30vh;background:#fff;z-index:11'
    sheet.textContent = '统计说明：课程至少看 30 秒才算'
    mask.addEventListener('click', () => {
      mask.remove()
      sheet.remove()
    })
    document.body.append(mask, sheet)
  })
}

test('snapshot lists backdrops and popups with refs; a blocked click names its blocker', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  expect(await snapshot(gw, id)).not.toContain('[浮层]')

  await openPopup(page)
  const snap = await snapshot(gw, id)
  expect(snap).toContain('[浮层]')
  const mask = snap.match(/- 遮罩 <div\.popup-mask>，覆盖视口 100% \[ref=([eo]\d+)\]/)
  expect(mask).not.toBeNull()
  expect(snap).toMatch(/- 弹层 <div\.popup-sheet>「统计说明：课程至少看 30 秒才算」，覆盖视口 30% \[ref=/)

  // The page's button is under the backdrop: the error names it and its ref.
  const blocked = await gw.rpc(id, 'rwd.click', { ref: refOf(snap, 'button', '普通按钮') })
  expect(blocked.error.code).toBe('not_interactable')
  expect(blocked.error.message).toContain(`点击位置被 <div.popup-mask> 遮挡（遮挡元素 ref=${mask![1]}`)

  // Clicking the backdrop closes the popup; its center is free, but the click
  // would also find another spot if the sheet covered it.
  expect(await rpc(gw, id, 'rwd.click', { ref: mask![1] })).toEqual({})
  await expect(page.locator('.popup-mask')).toHaveCount(0)
  expect(await snapshot(gw, id)).not.toContain('[浮层]')
})

test('a click lands on an exposed spot when the center is covered', async ({ page, gw }) => {
  const s = await openFixture(page, gw)
  const id = s.pageId!
  await page.evaluate(() => {
    const btn = document.getElementById('plain')!
    btn.style.cssText = 'position:relative;width:200px;height:60px'
    const badge = document.createElement('span')
    badge.style.cssText = 'position:absolute;left:70px;top:20px;width:60px;height:20px;background:red'
    btn.parentElement!.style.position = 'relative'
    btn.after(badge)
    const r = btn.getBoundingClientRect()
    badge.style.left = btn.offsetLeft + r.width / 2 - 30 + 'px'
    badge.style.top = btn.offsetTop + r.height / 2 - 10 + 'px'
    ;(window as any).__plain = 0
    btn.addEventListener('click', () => (window as any).__plain++)
  })
  const snap = await snapshot(gw, id)
  expect(await rpc(gw, id, 'rwd.click', { ref: refOf(snap, 'button', '普通按钮') })).toEqual({})
  expect(await page.evaluate(() => (window as any).__plain)).toBe(1)
})

test('network exclude rules: project policy plus run() option, per-call rules, includeExcluded', async ({ page, gw }) => {
  gw.setConfig({ networkExclude: ['*.ttf'] })
  const s = await openFixture(page, gw, { networkExclude: ['WebTracks'] })
  const id = s.pageId!
  expect(s.config.networkExclude).toEqual(['*.ttf'])
  await page.evaluate(() =>
    Promise.all(
      ['/fonts/AlibabaPuHuiTi-Bold.ttf', '/api/WebTracks/collect', '/api/lookup?q=1'].map(u => fetch(u).catch(() => null))
    )
  )
  await expect.poll(async () => (await rpc(gw, id, 'rwd.network', { limit: 200 })).requests.some((r: any) => r.url.includes('/api/lookup'))).toBe(true)

  const list = await rpc(gw, id, 'rwd.network', { limit: 200 })
  const urls = list.requests.map((r: any) => r.url).join('\n')
  expect(urls).not.toContain('.ttf')
  expect(urls).not.toContain('WebTracks')
  expect(list.hidden).toBe(2)

  const more = await rpc(gw, id, 'rwd.network', { limit: 200, exclude: ['/lookup/'] })
  expect(more.requests.some((r: any) => r.url.includes('/api/lookup'))).toBe(false)

  const all = await rpc(gw, id, 'rwd.network', { limit: 200, includeExcluded: true })
  expect(all.requests.filter((r: any) => /\.ttf|WebTracks/.test(r.url))).toHaveLength(2)
  expect(all.hidden).toBe(0)

  // Excluded failures stay out of the timeline too.
  await page.evaluate(() => fetch('/api/lookup-missing').catch(() => null))
  await gw.waitFor(() => gw.messages('event', id).find((e: any) => e.kind === 'net_fail' && e.summary.includes('lookup-missing')), 5000, 'net_fail event')
  expect(gw.messages('event', id).some((e: any) => e.kind === 'net_fail' && /\.ttf|WebTracks/.test(e.summary))).toBe(false)
})
