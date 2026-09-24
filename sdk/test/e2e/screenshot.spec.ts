import { test, expect, openDemo, rpc, snapshot, refOf } from './fixtures'

function jpegSize(b64: string) {
  const buf = Buffer.from(b64, 'base64')
  expect(buf[0]).toBe(0xff)
  expect(buf[1]).toBe(0xd8)
  return buf.length
}

test('screenshot: DOM fallback, full page, element', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  await expect(page.locator('.card')).toHaveCount(4)
  const vp = page.viewportSize()!
  const shot = await rpc(gw, s.pageId!, 'rwd.screenshot', {})
  expect(shot.source).toBe('dom')
  expect(shot.mimeType).toBe('image/jpeg')
  jpegSize(shot.data)
  expect(shot.width).toBe(vp.width * 2)
  expect(shot.height).toBe(vp.height * 2)

  const png = await rpc(gw, s.pageId!, 'rwd.screenshot', { format: 'png', ref: refOf(await snapshot(gw, s.pageId!), 'link', '智能手环 6') })
  expect(png.mimeType).toBe('image/png')
  expect(Buffer.from(png.data, 'base64').subarray(1, 4).toString()).toBe('PNG')
  expect(png.width).toBeLessThan(vp.width * 2)
})

test('screenshot: native bridge first, masked regions covered', async ({ page, gw }) => {
  await page.goto('/demo/platform/checkout.html?key=rwd_pk_test0000000000000000000')
  const s = await openDemo(page, gw, 'checkout.html', '')
  // A host app's capture of the visible webview: a blank red frame at device pixels.
  await page.evaluate(() => {
    ;(window as any).RWDNativeScreenshot = () => {
      const c = document.createElement('canvas')
      c.width = innerWidth * devicePixelRatio
      c.height = innerHeight * devicePixelRatio
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, c.width, c.height)
      return Promise.resolve(c.toDataURL('image/png'))
    }
  })
  const shot = await rpc(gw, s.pageId!, 'rwd.screenshot', { format: 'png' })
  expect(shot.source).toBe('native')
  const vp = page.viewportSize()!
  expect(shot.width).toBe(vp.width * 2) // devicePixelRatio 3 is capped at 2
  // The phone field (data-rwd-mask) is painted over in grey.
  const box = await page.locator('#phone').boundingBox()
  const pixel = await page.evaluate(
    async ({ data, x, y }) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + data
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      return Array.from(ctx.getImageData(x, y, 1, 1).data)
    },
    { data: shot.data, x: Math.round((box!.x + box!.width / 2) * 2), y: Math.round((box!.y + box!.height / 2) * 2) }
  )
  expect(pixel.slice(0, 3)).toEqual([199, 201, 204])

  // A failing bridge falls back to the DOM renderer.
  await page.evaluate(() => ((window as any).RWDNativeScreenshot = () => Promise.reject(new Error('no'))))
  const fallback = await rpc(gw, s.pageId!, 'rwd.screenshot', {})
  expect(fallback.source).toBe('dom')
})
