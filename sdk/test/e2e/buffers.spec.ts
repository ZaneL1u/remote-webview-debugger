import { test, expect, openDemo, rpc } from './fixtures'

test('console buffer: bounded, errors and warnings kept, dropped count, paging', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  const pageId = s.pageId!
  // The demo logs an error (recommend 404) and a warning on load.
  await expect.poll(async () => (await rpc(gw, pageId, 'rwd.console', { types: ['error'] })).messages.length).toBeGreaterThan(0)

  await page.evaluate(() => {
    for (let i = 0; i < 600; i++) console.log('noise', i, { i })
    for (let i = 0; i < 5; i++) console.error(new Error('boom ' + i))
    console.warn('careful %s', 'now', { a: [1, 2] })
    console.info('obj', { nested: { deep: { deeper: { deepest: 1 } } } }, [1, 'two'])
  })
  const all = await rpc(gw, pageId, 'rwd.console', { limit: 500 })
  expect(all.messages.length).toBe(500)
  expect(all.dropped).toBeGreaterThanOrEqual(100)

  const errors = await rpc(gw, pageId, 'rwd.console', { types: ['error'], limit: 500 })
  const texts = errors.messages.map((m: any) => m.text)
  expect(texts.some((t: string) => t.startsWith('推荐商品加载失败'))).toBe(true) // from page load, survived 600 logs
  for (let i = 0; i < 5; i++) expect(texts.some((t: string) => t.startsWith('Error: boom ' + i))).toBe(true)

  const warns = await rpc(gw, pageId, 'rwd.console', { types: ['warn'] })
  expect(warns.messages.map((m: any) => m.text)).toEqual(
    expect.arrayContaining(['[埋点] 曝光上报失败，将在下次启动时重试', 'careful now {a: [1, 2]}'])
  )
  const latest = await rpc(gw, pageId, 'rwd.console', { limit: 1 })
  expect(latest.messages[0]).toMatchObject({ type: 'info', text: 'obj {nested: {deep: {deeper: {…}}}} [1, "two"]', source: 'console' })
  expect(typeof latest.messages[0].at).toBe('number')

  // sinceId pages forward from the oldest.
  const first = all.messages[0].id
  const page2 = await rpc(gw, pageId, 'rwd.console', { sinceId: first, limit: 3 })
  expect(page2.messages.map((m: any) => m.id)).toEqual(all.messages.slice(1, 4).map((m: any) => m.id))

  // Console errors reach the timeline (rate limited, de-duplicated).
  await gw.waitFor(() => gw.messages('event', pageId).find((e: any) => e.kind === 'console_error' && e.summary.startsWith('Error: boom')), 5000, 'console_error event')
})

test('network buffer: bounded, failed requests kept, detail with body', async ({ page, gw }) => {
  const s = await openDemo(page, gw)
  const pageId = s.pageId!
  await expect.poll(async () => (await rpc(gw, pageId, 'rwd.network', { failedOnly: true })).requests.length).toBeGreaterThan(0)

  const failed = await rpc(gw, pageId, 'rwd.network', { failedOnly: true })
  expect(failed.requests[0]).toMatchObject({ method: 'GET', status: 404, type: 'fetch' })
  expect(failed.requests[0].url).toContain('/demo/platform/api/recommend.json')

  await page.evaluate(async () => {
    await fetch('api/products.json', { headers: { Authorization: 'Bearer secret', 'X-Trace': 'abc' } })
    const xhr = new XMLHttpRequest()
    xhr.open('GET', 'api/products.json?xhr=1')
    xhr.setRequestHeader('Cookie', 'sid=1')
    await new Promise(r => {
      xhr.onloadend = r
      xhr.send()
    })
    navigator.sendBeacon('api/beacon', 'hello')
    // Hooks stay subclass-safe (tools like PageSpy extend the constructors).
    class Stream extends EventSource {}
    const es = new Stream('api/stream')
    ;(window as any).__esOk = es instanceof Stream && es instanceof EventSource
    es.close()
  })
  expect(await page.evaluate(() => (window as any).__esOk)).toBe(true)
  let list = await rpc(gw, pageId, 'rwd.network', { limit: 10 })
  const ok = list.requests.find((r: any) => r.url.endsWith('api/products.json') && r.type === 'fetch' && r.id > failed.requests[0].id)
  expect(ok).toMatchObject({ status: 200, method: 'GET' })
  expect(ok.size).toBeGreaterThan(100)
  const detail = await rpc(gw, pageId, 'rwd.networkDetail', { id: ok.id })
  expect(detail.request.headers).toMatchObject({ Authorization: '••••', 'X-Trace': 'abc' })
  expect(JSON.parse(detail.response.body)[0].name).toBe('无线降噪耳机 Pro')
  const xhr = list.requests.find((r: any) => r.url.endsWith('xhr=1'))
  expect(xhr).toMatchObject({ type: 'xhr', status: 200 })
  const xhrDetail = await rpc(gw, pageId, 'rwd.networkDetail', { id: xhr.id })
  expect(xhrDetail.request.headers.Cookie).toBe('••••')
  expect(list.requests.find((r: any) => r.url.endsWith('api/beacon'))).toMatchObject({ type: 'beacon', method: 'POST' })
  expect(list.requests.find((r: any) => r.url.endsWith('api/stream'))).toMatchObject({ type: 'eventsource', method: 'GET' })

  // 520 more successful requests: the oldest successes go, the 404 stays.
  await page.evaluate(async () => {
    for (let i = 0; i < 52; i++) await Promise.all(Array.from({ length: 10 }, (_, j) => fetch('api/products.json?n=' + i * 10 + j)))
  })
  list = await rpc(gw, pageId, 'rwd.network', { limit: 500 })
  expect(list.requests.length).toBe(500)
  expect(list.dropped).toBeGreaterThan(0)
  const stillFailed = await rpc(gw, pageId, 'rwd.network', { failedOnly: true })
  expect(stillFailed.requests.some((r: any) => r.url.includes('recommend.json'))).toBe(true)
  const gone = await gw.rpc(pageId, 'rwd.networkDetail', { id: ok.id })
  expect(gone.error.code).toBe('not_found')
})
