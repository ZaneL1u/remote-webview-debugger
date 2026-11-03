// End-to-end check of the built site with Playwright.
//
//   npm run build && npm run preview      # in one terminal
//   npm run verify                        # in another (BASE=http://localhost:4391 by default)
//
// 1. Runs the demo to the end in English and Chinese (one run approves on the
//    phone and takes over / hands back, one lets the guiding hand approve for
//    the visitor, one ends it), and fails on any console error or uncaught
//    error from the website itself. (The demo shop's own errors are the bug
//    under investigation and expected.) The happy path must verify the live
//    patch.
// 2. Checks the "try it live" section against a fixture of the public demo
//    gateway: "Get my key" fills the visitor's key into the snippets, the key
//    is remembered after a reload, a gateway that can't be reached or refuses
//    more keys says so, and the shop's device code lands in the prompt.
// 3. Every language renders: <html lang/dir>, hreflang links for all 11,
//    the FAQ JSON-LD, and no horizontal scrolling at 1440 and 390.
// 4. Screenshots desktop (1440) and mobile (390), en and zh, both color
//    schemes, plus the top of every other language, into ./shots.
//
// ONLY=demo, ONLY=live, ONLY=langs or ONLY=shots runs one part. SPEED=1 runs
// the demo at normal speed.

import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:4391'
const ONLY = process.env.ONLY || ''
const SPEED = process.env.SPEED || '2'
fs.mkdirSync('shots', { recursive: true })

const LANGS = [
  ['en', '/', 'en', 'ltr'],
  ['zh-CN', '/zh/', 'zh-CN', 'ltr'],
  ['zh-TW', '/zh-tw/', 'zh-TW', 'ltr'],
  ['ja', '/ja/', 'ja', 'ltr'],
  ['ko', '/ko/', 'ko', 'ltr'],
  ['es', '/es/', 'es', 'ltr'],
  ['fr', '/fr/', 'fr', 'ltr'],
  ['de', '/de/', 'de', 'ltr'],
  ['pt-BR', '/pt-br/', 'pt-BR', 'ltr'],
  ['ru', '/ru/', 'ru', 'ltr'],
  ['ar', '/ar/', 'ar', 'rtl'],
]

const failures = []
const fail = msg => {
  failures.push(msg)
  console.log('  FAIL', msg)
}

// The live section talks to the public demo gateway and embeds its shop;
// every context gets fixtures instead, so nothing here depends on the real
// one. live: 'up', 'down' (unreachable) or 'limited' (no more keys).
const DEMO = 'https://demo.debugger.site'
const LIVE_CONFIG = `${DEMO}/demo/rwd-demo.json`
const LIVE_KEYS = `${DEMO}/v1/demo/keys`
const LIVE_KEY = 'rwd_sk_live_verify0000000000000000000000'
const SHOP_CODE = 'VRFY-0001'

async function newContext(browser, opts, live = 'up') {
  const ctx = await browser.newContext(opts)
  const cors = { 'Access-Control-Allow-Origin': '*' }
  await ctx.route(LIVE_CONFIG, route =>
    live === 'down' ? route.abort('connectionrefused') : route.fulfill({ json: { resetAt: Date.now() - 3600000 }, headers: cors }),
  )
  await ctx.route(LIVE_KEYS, route =>
    live === 'down'
      ? route.abort('connectionrefused')
      : live === 'limited'
        ? route.fulfill({ status: 429, json: { error: { code: 'rate_limited' } }, headers: cors })
        : route.fulfill({ json: { key: LIVE_KEY, expiresAt: Date.now() + 86400000 }, headers: cors }),
  )
  // A stand-in for the real shop: reports a device code like rwd-boot.js does.
  await ctx.route(`${DEMO}/?**`, route =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>shop</title><p>demo shop</p><script>parent.postMessage({ rwdDemo: 'device', deviceCode: '${SHOP_CODE}' }, '*')</script>`,
    }),
  )
  return ctx
}

function watch(page, label) {
  const errors = []
  page.on('console', m => {
    if (m.type() !== 'error') return
    const url = m.location()?.url || ''
    if (url.includes('/demo-shop/')) return
    errors.push(`[${label}] console.error: ${m.text()} (${url})`)
  })
  page.on('pageerror', e => {
    if ((e.stack || '').includes('/demo-shop/')) return
    errors.push(`[${label}] uncaught: ${e.message}`)
  })
  return errors
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.7)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' })
      await new Promise(r => setTimeout(r, 60))
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
}

/**
 * A real (trusted) tap on an element inside the phone. The phone frame is
 * scaled with a CSS transform, which Playwright's own hit-testing for
 * iframes doesn't account for, so compute the point ourselves.
 */
async function tapInPhone(page, selector, timeout = 30000) {
  const end = Date.now() + timeout
  for (;;) {
    const frameEl = await page.$('[data-phone-frame]')
    const frame = await frameEl.contentFrame()
    const inner = frame
      ? await frame
          .evaluate(sel => {
            const find = root => {
              const hit = root.querySelector(sel)
              if (hit) return hit
              for (const el of root.querySelectorAll('*')) if (el.shadowRoot) {
                const h = find(el.shadowRoot)
                if (h) return h
              }
              return null
            }
            const el = find(document)
            if (!el || el.disabled) return null
            const r = el.getBoundingClientRect()
            if (!r.width || !r.height) return null
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: innerWidth }
          }, selector)
          .catch(() => null)
      : null
    if (inner) {
      const box = await frameEl.boundingBox()
      const s = box.width / inner.w
      const x = box.x + inner.x * s
      const y = box.y + inner.y * s
      const vh = page.viewportSize().height
      if (y < 0 || y > vh) {
        await page.mouse.wheel(0, y - vh / 2)
        await page.waitForTimeout(300)
        continue
      }
      await page.mouse.click(x, y)
      return
    }
    if (Date.now() > end) throw new Error(`tapInPhone: ${selector} not found`)
    await page.waitForTimeout(200)
  }
}

const pathOf = lang => LANGS.find(l => l[0] === lang)[1]

async function runDemo(browser, lang, mode) {
  const label = `demo-${lang}-${mode}`
  console.log(`\n${label}`)
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 1000 }, locale: lang === 'zh-CN' ? 'zh-CN' : 'en-US' })
  // An explicit language choice, so the browser locale doesn't redirect.
  await ctx.addInitScript(l => localStorage.setItem('rwd.lang', l), lang)
  const page = await ctx.newPage()
  const errors = watch(page, label)
  await page.goto(`${BASE}${pathOf(lang)}`)
  await page.waitForSelector('[data-demo]')
  await page.evaluate(() => document.querySelector('[data-demo]').scrollIntoView())
  await page.waitForFunction(() => window.__rwdDemo && window.__rwdDemo.runs > 0, undefined, { timeout: 20000 })
  await page.click(`[data-speed="${SPEED}"]`)
  const phase = () => page.evaluate(() => window.__rwdDemo.phase)
  await page.waitForFunction(() => window.__rwdDemo.phase === 'waitApproval', undefined, { timeout: 60000 })
  if (mode === 'auto') {
    // The guiding hand points at Allow and taps it after the countdown.
    await page.waitForFunction(() => document.querySelector('[data-guide]').classList.contains('on'), undefined, { timeout: 15000 })
    await page.waitForFunction(() => window.__rwdDemo.phase === 'running', undefined, { timeout: 30000 })
    const note = await page.$eval('[data-transcript]', el => el.textContent)
    if (!/tapped|替你点|점|タップ/.test(note) && !note.includes('Allow')) fail(`${label}: no auto-approve note`)
  } else {
    await tapInPhone(page, '.scrim .allow')
    await page.waitForFunction(() => window.__rwdDemo.phase === 'running', undefined, { timeout: 30000 })
    if (mode === 'interactive') {
      await page.waitForFunction(() => window.__rwdDemo.calls >= 8, undefined, { timeout: 120000 })
      await tapInPhone(page, '.bar [data-action="takeover"]')
      await page.waitForFunction(() => window.__rwdDemo.phase === 'waitControl', undefined, { timeout: 30000 })
      await page.waitForTimeout(1500)
      await tapInPhone(page, '.bar [data-action="handback"]')
      await page.waitForFunction(() => window.__rwdDemo.phase === 'running', undefined, { timeout: 30000 })
    }
    if (mode === 'end') {
      await page.waitForFunction(() => window.__rwdDemo.calls >= 6, undefined, { timeout: 120000 })
      await tapInPhone(page, '.bar [data-action="end"]')
    }
  }
  await page.waitForFunction(() => window.__rwdDemo.done || window.__rwdDemo.stopped || window.__rwdDemo.errors.length, undefined, { timeout: 300000 })
  const d = await page.evaluate(() => window.__rwdDemo)
  if (d.errors.length) fail(`${label}: demo errors ${JSON.stringify(d.errors)}`)
  if (mode === 'end') {
    if (d.stopped !== 'ended') fail(`${label}: expected stopped=ended, got ${d.stopped} (phase ${await phase()})`)
  } else {
    if (!d.done) fail(`${label}: not done (phase ${await phase()}, stopped ${d.stopped})`)
    if (d.verified !== true) fail(`${label}: live patch not verified (${d.verified})`)
    if (!(await page.$('.summary'))) fail(`${label}: no summary`)
  }
  await page.waitForTimeout(800)
  await page.screenshot({ path: `shots/${label}-end.png` })
  for (const e of errors) fail(e)
  await ctx.close()
}

async function checkLive(browser) {
  console.log('\nlive')
  for (const lang of ['en', 'zh-CN']) {
    const label = `live-${lang}`
    const ctx = await newContext(browser, { viewport: { width: 1440, height: 1000 } })
    await ctx.addInitScript(l => localStorage.setItem('rwd.lang', l), lang)
    const page = await ctx.newPage()
    const errors = watch(page, label)
    await page.goto(`${BASE}${pathOf(lang)}#live`)
    await page.waitForSelector('[data-live]')
    await page.waitForFunction(() => document.querySelector('[data-live]').dataset.liveState === 'idle')
    await page.click('[data-live-get]')
    await page.waitForFunction(() => document.querySelector('[data-live]').dataset.liveState === 'ready', undefined, { timeout: 10000 })
    const keys = await page.$$eval('[data-live-key]', els => els.map(e => e.textContent))
    if (!keys.length || keys.some(k => k !== LIVE_KEY)) fail(`${label}: key not filled: ${keys}`)
    // The shop reported its device code: it is in the prompt.
    await page.waitForFunction(code => document.querySelector('[data-live-device]')?.textContent === code, SHOP_CODE, { timeout: 15000 }).catch(() => fail(`${label}: device code not filled`))
    // Remembered after a reload.
    await page.reload()
    await page.waitForFunction(() => document.querySelector('[data-live]').dataset.liveState === 'ready', undefined, { timeout: 10000 }).catch(() => fail(`${label}: key not remembered`))
    await page.waitForTimeout(600)
    await page.screenshot({ path: `shots/${label}.png` })
    for (const e of errors) fail(e)
    await ctx.close()
  }
  for (const live of ['down', 'limited']) {
    const label = `live-${live}`
    const ctx = await newContext(browser, { viewport: { width: 1440, height: 1000 } }, live)
    await ctx.addInitScript(() => localStorage.setItem('rwd.lang', 'en'))
    const page = await ctx.newPage()
    await page.goto(`${BASE}/#live`)
    await page.waitForSelector('[data-live]')
    if (live === 'down') {
      await page.waitForFunction(() => document.querySelector('[data-live]').dataset.liveState === 'failed', undefined, { timeout: 10000 }).catch(() => fail(`${label}: unreachable gateway not shown`))
    } else {
      await page.click('[data-live-get]')
      await page.waitForFunction(() => document.querySelector('[data-live]').dataset.liveState === 'limited', undefined, { timeout: 10000 }).catch(() => fail(`${label}: rate limit not shown`))
    }
    await ctx.close()
  }
}

async function checkLangs(browser) {
  console.log('\nlanguages')
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 1000 } })
  await ctx.addInitScript(() => localStorage.setItem('rwd.lang', 'x'))
  const page = await ctx.newPage()
  for (const [code, path, htmlLang, dir] of LANGS) {
    const label = `lang-${code}`
    const errors = watch(page, label)
    const res = await page.goto(`${BASE}${path}`)
    if (!res.ok()) fail(`${label}: HTTP ${res.status()}`)
    const info = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir || 'ltr',
      hreflangs: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l => l.getAttribute('hreflang')),
      canonical: document.querySelector('link[rel=canonical]')?.href,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)['@type']),
      title: document.title,
      sections: [...document.querySelectorAll('main section[id]')].map(s => s.id),
    }))
    if (info.lang !== htmlLang) fail(`${label}: <html lang> is ${info.lang}`)
    if (info.dir !== dir) fail(`${label}: dir is ${info.dir}`)
    if (info.hreflangs.length !== LANGS.length + 1) fail(`${label}: ${info.hreflangs.length} hreflang links`)
    if (!info.ld.includes('FAQPage') || !info.ld.includes('SoftwareApplication')) fail(`${label}: JSON-LD ${info.ld}`)
    if (!info.title) fail(`${label}: no title`)
    if (info.sections.length !== 9) fail(`${label}: ${info.sections.length} sections (${info.sections})`)
    await scrollThrough(page)
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    if (sw[0] > sw[1]) fail(`${label}: horizontal scroll ${sw[0]} > ${sw[1]}`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(600)
    if (code !== 'en' && code !== 'zh-CN') await page.screenshot({ path: `shots/${label}-top.png` })
    for (const e of errors) fail(e)
  }
  // Mobile, English and Arabic.
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [code, path] of LANGS.filter(l => l[0] === 'en' || l[0] === 'ar')) {
    await page.goto(`${BASE}${path}`)
    await scrollThrough(page)
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    if (sw[0] > sw[1]) fail(`lang-${code}-mobile: horizontal scroll ${sw[0]} > ${sw[1]}`)
  }
  // 404 and the browser-language redirect.
  const nf = await page.goto(`${BASE}/no-such-page/`)
  if (nf.status() !== 404 && !(await page.title()).startsWith('404')) fail(`404 page: status ${nf.status()}`)
  await ctx.close()
  const ja = await browser.newContext({ locale: 'ja-JP' })
  const jp = await ja.newPage()
  await jp.goto(`${BASE}/`)
  await jp.waitForURL(/\/ja\/$/, { timeout: 5000 }).catch(() => fail('redirect: a Japanese browser was not sent to /ja/'))
  await ja.close()
}

async function screenshots(browser) {
  console.log('\nscreenshots')
  for (const lang of ['en', 'zh-CN']) {
    for (const scheme of ['dark', 'light']) {
      for (const [name, viewport] of [
        ['desktop', { width: 1440, height: 900 }],
        ['mobile', { width: 390, height: 844 }],
      ]) {
        const label = `${lang}-${scheme}-${name}`
        const ctx = await newContext(browser, { viewport, colorScheme: scheme, deviceScaleFactor: 1 })
        await ctx.addInitScript(
          ([l, s]) => {
            localStorage.setItem('rwd.lang', l)
            localStorage.setItem('rwd.theme', s)
          },
          [lang, scheme],
        )
        const page = await ctx.newPage()
        await page.goto(`${BASE}${pathOf(lang)}`)
        await page.waitForTimeout(2200)
        await scrollThrough(page)
        await page.waitForTimeout(600)
        await page.screenshot({ path: `shots/${label}-top.png` })
        await page.screenshot({ path: `shots/${label}-full.png`, fullPage: true })
        await page.evaluate(() => document.querySelector('[data-demo]').scrollIntoView())
        await page.waitForTimeout(1200)
        await page.screenshot({ path: `shots/${label}-demo.png` })
        await ctx.close()
      }
    }
  }
}

const browser = await chromium.launch()
try {
  if (!ONLY || ONLY === 'demo') {
    await runDemo(browser, 'en', 'interactive')
    await runDemo(browser, 'zh-CN', 'auto')
    await runDemo(browser, 'en', 'end')
  }
  if (!ONLY || ONLY === 'live') await checkLive(browser)
  if (!ONLY || ONLY === 'langs') await checkLangs(browser)
  if (!ONLY || ONLY === 'shots') await screenshots(browser)
} finally {
  await browser.close()
}
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall good')
process.exit(failures.length ? 1 : 0)
