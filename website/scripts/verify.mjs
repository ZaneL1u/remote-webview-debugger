// End-to-end check of the built site with Playwright.
//
//   npm run build && npm run preview      # in one terminal
//   npm run verify                        # in another (BASE=http://localhost:4391 by default)
//
// 1. Runs the demo to the end in both languages (one run approves on the
//    phone and takes over / hands back, the other lets the demo auto-approve),
//    and fails on any console error or uncaught error from the website itself.
//    (The demo shop's own errors are the bug under investigation and expected.)
// 2. Screenshots desktop (1440) and mobile (390), both languages, both color
//    schemes, into ./shots, and checks that nothing scrolls horizontally.
//
// ONLY=demo or ONLY=shots runs one half. SPEED=1 runs the demo at normal speed.

import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:4391'
const ONLY = process.env.ONLY || ''
const SPEED = process.env.SPEED || '2'
fs.mkdirSync('shots', { recursive: true })

const failures = []
const fail = msg => {
  failures.push(msg)
  console.log('  FAIL', msg)
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

async function runDemo(browser, lang, mode) {
  const label = `demo-${lang}-${mode}`
  console.log(`\n${label}`)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: lang === 'zh' ? 'zh-CN' : 'en-US' })
  // An explicit language choice, so the zh browser locale doesn't redirect.
  await ctx.addInitScript(l => localStorage.setItem('rwd.lang', l), lang)
  const page = await ctx.newPage()
  const errors = watch(page, label)
  await page.goto(`${BASE}${lang === 'zh' ? '/zh/' : '/'}`)
  await page.locator('#demo').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => window.__rwdDemo, null, { timeout: 15000 })
  await page.evaluate(() => document.querySelector('[data-demo]').scrollIntoView({ block: 'end' }))
  if (SPEED === '2') await page.click('[data-speed="2"]')
  // The demo autostarts in view; make sure.
  await page.waitForFunction(() => window.__rwdDemo.runs > 0, null, { timeout: 10000 }).catch(async () => {
    await page.click('[data-start]')
  })
  const t0 = Date.now()

  if (mode === 'interactive') {
    // Approve on the phone, like a visitor would (a real, trusted click).
    await page.waitForFunction(() => window.__rwdDemo.phase === 'waitApproval', null, { timeout: 60000 })
    await page.waitForTimeout(900) // the dialog's buttons arm after a short delay
    await tapInPhone(page, '.dlg button.allow')
    console.log('  approved on the phone')
    // Take over once the agent is operating, then hand back.
    await page.waitForFunction(() => window.__rwdDemo.calls >= 8, null, { timeout: 90000 })
    await tapInPhone(page, '.bar [data-action="takeover"]')
    console.log('  took over')
    await page.waitForFunction(() => window.__rwdDemo.phase === 'waitControl', null, { timeout: 30000 })
    await page.waitForTimeout(1500)
    await tapInPhone(page, '.bar [data-action="handback"]')
    console.log('  handed back')
  }

  if (mode === 'deny') {
    await page.waitForFunction(() => window.__rwdDemo.phase === 'waitApproval', null, { timeout: 60000 })
    await page.waitForTimeout(900)
    await tapInPhone(page, '.dlg button.deny')
    console.log('  denied on the phone')
  }
  if (mode === 'end') {
    await page.waitForFunction(() => window.__rwdDemo.calls >= 7, null, { timeout: 90000 })
    await tapInPhone(page, '.bar [data-action="end"]')
    console.log('  ended on the phone')
  }
  const expectStop = mode === 'deny' ? 'denied' : mode === 'end' ? 'ended' : null
  try {
    await page.waitForFunction(() => window.__rwdDemo.done || window.__rwdDemo.stopped || window.__rwdDemo.errors.length, null, { timeout: 240000 })
  } catch {
    fail(`${label}: did not finish (phase ${await page.evaluate(() => window.__rwdDemo.phase)})`)
  }
  const state = await page.evaluate(() => window.__rwdDemo)
  console.log(`  finished in ${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(state))
  if (expectStop) {
    if (state.stopped !== expectStop) fail(`${label}: expected the agent to stop (${expectStop}): ${JSON.stringify(state)}`)
  } else {
    if (!state.done) fail(`${label}: demo did not reach the final step: ${JSON.stringify(state)}`)
    const summary = await page.locator('.summary').count()
    if (!summary) fail(`${label}: no summary`)
    const toolErrors = await page.locator('.tool[data-state="error"]').count()
    if (toolErrors) fail(`${label}: ${toolErrors} tool call(s) ended in an error`)
  }
  await page.screenshot({ path: `shots/${label}-end.png` })
  for (const e of errors) fail(e)

  // Restart must come back cleanly.
  await page.click('[data-restart]')
  await page.waitForFunction(() => window.__rwdDemo.runs >= 2 && window.__rwdDemo.calls >= 2, null, { timeout: 60000 })
  await page.click('[data-play]') // pause
  await page.waitForTimeout(300)
  const phase = await page.evaluate(() => document.querySelector('[data-demo]').dataset.state)
  if (phase !== 'paused') fail(`${label}: pause did not take (state ${phase})`)
  await page.click('[data-restart]')
  await page.waitForTimeout(1500)
  for (const e of errors.slice()) if (!failures.includes(e)) fail(e)
  await ctx.close()
}

async function shots(browser) {
  for (const lang of ['en', 'zh']) {
    for (const scheme of ['light', 'dark']) {
      for (const [name, viewport, mobile] of [
        ['desktop', { width: 1440, height: 900 }, false],
        ['mobile', { width: 390, height: 844 }, true],
      ]) {
        const label = `${lang}-${scheme}-${name}`
        const ctx = await browser.newContext({ viewport, colorScheme: scheme, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'no-preference' })
        // The site is dark unless the reader asks for the light theme, so the
        // light screenshots need that choice stored.
        await ctx.addInitScript(
          ([l, s]) => {
            localStorage.setItem('rwd.lang', l)
            localStorage.setItem('rwd.theme', s)
          },
          [lang, scheme],
        )
        const page = await ctx.newPage()
        const errors = watch(page, label)
        await page.goto(`${BASE}${lang === 'zh' ? '/zh/' : '/'}`)
        await page.waitForLoadState('networkidle')
        await scrollThrough(page)
        await page.waitForTimeout(900)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        if (overflow > 0) fail(`${label}: horizontal overflow of ${overflow}px`)
        await page.screenshot({ path: `shots/${label}-top.png` })
        await page.screenshot({ path: `shots/${label}-full.png`, fullPage: true })
        // The demo mid-run.
        await page.locator('#demo').scrollIntoViewIfNeeded()
        await page.waitForTimeout(9000)
        await page.screenshot({ path: `shots/${label}-demo.png` })
        for (const e of errors) fail(e)
        console.log(`  ${label}: ok`)
        await ctx.close()
      }
    }
  }
  // 360px: no horizontal scroll.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`)
  await scrollThrough(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 0) fail(`360px: horizontal overflow of ${overflow}px`)
  await page.screenshot({ path: 'shots/en-360-full.png', fullPage: true })
  await ctx.close()
}

const browser = await chromium.launch()
try {
  if (ONLY !== 'shots') {
    await runDemo(browser, 'en', 'interactive')
    await runDemo(browser, 'zh', 'auto')
    await runDemo(browser, 'en', 'deny')
    await runDemo(browser, 'zh', 'end')
  }
  if (ONLY !== 'demo') {
    console.log('\nscreenshots')
    await shots(browser)
  }
} finally {
  await browser.close()
}
if (failures.length) {
  console.log(`\n${failures.length} problem(s)`)
  process.exit(1)
}
console.log('\nall good')
