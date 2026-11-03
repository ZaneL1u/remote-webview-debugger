import { test, expect, openFixture, refOf, snapshot, status, dialogButton } from './fixtures'
import type { Page } from '@playwright/test'
import zh from '../../src/locales/zh'
import zhTW from '../../src/locales/zh-TW'
import fr from '../../src/locales/fr'
import es from '../../src/locales/es'
import ru from '../../src/locales/ru'
import ar from '../../src/locales/ar'
import ja from '../../src/locales/ja'
import ko from '../../src/locales/ko'
import de from '../../src/locales/de'
import pt from '../../src/locales/pt'

// Language packs (src/i18n.ts): picked from run({ lang }) or the browser's
// languages with tag-by-tag fallback, loaded on demand from /v1/locales/,
// extended with registerLocale / run({ messages }); styles through --rwd-*
// properties, run({ style }) and ::part(); Arabic mirrors the layout.

const PACKS = [zhTW, fr, es, ru, ar, ja, ko, de, pt]

/** The browser prefers these languages, in order (Playwright's locale sets only one). */
async function preferLanguages(page: Page, langs: string[]) {
  await page.addInitScript((list: string[]) => {
    Object.defineProperty(navigator, 'languages', { get: () => list, configurable: true })
    Object.defineProperty(navigator, 'language', { get: () => list[0], configurable: true })
  }, langs)
}

/** The element is inside the viewport and its content does not overflow it. */
async function expectFits(page: Page, selector: string) {
  const r = await page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect()
    return { left: box.left, right: box.right, scroll: el.scrollWidth, client: el.clientWidth, vw: window.innerWidth }
  })
  expect(r.left).toBeGreaterThanOrEqual(0)
  expect(r.right).toBeLessThanOrEqual(r.vw)
  expect(r.scroll).toBeLessThanOrEqual(r.client + 1)
}

/** Shape of a pack: nested keys, and the arity of every message function. */
function shape(v: unknown): unknown {
  if (typeof v === 'function') return `fn/${v.length}`
  if (v && typeof v === 'object') {
    const out: { [k: string]: unknown } = {}
    for (const k of Object.keys(v).sort()) out[k] = shape((v as { [k: string]: unknown })[k])
    return out
  }
  return typeof v
}

test('every built-in pack has every message of the complete zh pack, with the same arguments', () => {
  const want = { ui: shape(zh.ui), action: shape(zh.action), agent: shape(zh.agent) }
  for (const p of PACKS) {
    expect({ ui: shape(p.ui), action: shape(p.action), agent: shape(p.agent) }, p.id).toEqual(want)
    expect(p.name, p.id).toBeTruthy()
    expect(p.dir || 'ltr', p.id).toBe(p.id === 'ar' ? 'rtl' : 'ltr')
  }
})

test.describe('Japanese browser', () => {
  test.use({ locale: 'ja-JP' })

  test('loads the ja pack on demand; UI and dialogs in Japanese', async ({ page, gw }) => {
    const loaded: string[] = []
    page.on('request', r => {
      if (r.url().includes('/locales/')) loaded.push(new URL(r.url()).pathname)
    })
    const s = await openFixture(page, gw, { helpButton: true })
    expect((await status(page)).lang).toBe('ja')
    await expect(page.locator('#__rwd')).toHaveAttribute('lang', 'ja')
    await expect(page.locator('#__rwd')).toHaveAttribute('dir', 'ltr')
    expect(loaded).toEqual(['/v1/locales/ja.js'])

    const win = page.locator('#__rwd .win')
    await page.locator('#__rwd .pill .brand').tap()
    await expect(win.locator('.link')).toHaveText(ja.ui.link.online)
    await expect(win.locator('.k')).toHaveText(ja.ui.deviceCode)
    await expect(win.locator('.row .btn')).toHaveText([ja.ui.help, ja.ui.collapse])
    await expectFits(page, '#__rwd .win')
    await win.locator('[data-action=toggle]').tap()

    const bar = page.locator('#__rwd .bar')
    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    await expect(bar.locator('.btn')).toHaveText([ja.ui.takeover, ja.ui.end])
    await expectFits(page, '#__rwd .bar')
    gw.setControl(s.deviceId!, 'none')

    const req = gw.requestAttach(s.deviceId!, { agent: 'Support bot', levels: ['observe', 'interact'] })
    await expect(page.locator('#__rwd .scrim:not(.out) .dlg h3')).toHaveText(ja.ui.attachTitle)
    await expect(dialogButton(page, '.acts button')).toHaveText([ja.ui.deny, ja.ui.allow])
    await dialogButton(page, '.deny').tap()
    expect(await req.decision).toBe(null)
  })
})

test.describe('fallback', () => {
  test('zh-HK falls back to Traditional Chinese (zh-TW)', async ({ page, gw }) => {
    await preferLanguages(page, ['zh-HK'])
    const s = await openFixture(page, gw)
    expect((await status(page)).lang).toBe('zh-TW')
    await expect(page.locator('#__rwd')).toHaveAttribute('lang', 'zh-TW')
    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    await expect(page.locator('#__rwd .bar .btn')).toHaveText([zhTW.ui.takeover, zhTW.ui.end])
  })

  test('pt-PT uses the pt pack; an unsupported first choice gives way to the next language', async ({ page, gw }) => {
    await preferLanguages(page, ['it-IT', 'pt-PT', 'en'])
    await openFixture(page, gw)
    expect((await status(page)).lang).toBe('pt')
  })

  test('no supported language: English', async ({ page, gw }) => {
    await preferLanguages(page, ['it-IT', 'nl'])
    const s = await openFixture(page, gw)
    expect((await status(page)).lang).toBe('en')
    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    await expect(page.locator('#__rwd .bar .btn')).toHaveText(['Take over', 'End'])
  })

  test('run({ lang }) wins over the browser; setLang() switches at runtime and back to the browser', async ({ page, gw }) => {
    const s = await openFixture(page, gw, { lang: 'de-AT' })
    expect((await status(page)).lang).toBe('de')
    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    const buttons = page.locator('#__rwd .bar .btn')
    await expect(buttons).toHaveText([de.ui.takeover, de.ui.end])
    await page.evaluate(() => (window as any).RemoteWebviewDebugger.setLang('ko'))
    await expect(buttons).toHaveText([ko.ui.takeover, ko.ui.end])
    expect((await status(page)).lang).toBe('ko')
    // Back to the browser's language (zh-CN in these tests).
    await page.evaluate(() => (window as any).RemoteWebviewDebugger.setLang(null))
    await expect(buttons).toHaveText([zh.ui.takeover, zh.ui.end])
  })
})

test.describe('custom packs and overrides', () => {
  test.use({ locale: 'it-IT' })

  test('a pack queued before sdk.js, registerLocale at runtime and run({ messages })', async ({ page, gw }) => {
    // Like <script src="…/my-it.js"> before sdk.js: partial, the rest is English.
    await page.addInitScript(() => {
      ;(window as any).__RWD_LOCALES__ = [{ id: 'it', name: 'Italiano', ui: { takeover: 'Prendi', end: 'Fine', barAgent: 'AI al lavoro' } }]
    })
    const s = await openFixture(page, gw, {
      helpButton: true,
      messages: { it: { ui: { help: 'Contatta il supporto' } }, en: { ui: { collapse: 'Close' } } },
    })
    expect((await status(page)).lang).toBe('it')
    await page.locator('#__rwd .pill .brand').tap()
    // Override in it, English fallback (also overridden) for what the pack leaves out.
    await expect(page.locator('#__rwd .win .row .btn')).toHaveText(['Contatta il supporto', 'Close'])
    await page.locator('#__rwd .win [data-action=toggle]').tap()

    const bar = page.locator('#__rwd .bar')
    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    await expect(bar.locator('.label')).toHaveText('AI al lavoro')
    await expect(bar.locator('.btn')).toHaveText(['Prendi', 'Fine'])

    // A pack registered later replaces the one in use, and the UI follows.
    await page.evaluate(() =>
      (window as any).RemoteWebviewDebugger.registerLocale({ id: 'it', name: 'Italiano', ui: { takeover: 'Riprendi', end: 'Termina' } })
    )
    await expect(bar.locator('.btn')).toHaveText(['Riprendi', 'Termina'])
    expect(await page.evaluate(() => (window as any).RemoteWebviewDebugger.builtinLocales)).toEqual([
      'en', 'zh', 'zh-TW', 'fr', 'es', 'ru', 'ar', 'ja', 'ko', 'de', 'pt',
    ])
  })
})

test('agent-facing text follows agentLang into any pack, loaded on demand', async ({ page, gw }) => {
  gw.setAgentLang('fr')
  const s = await openFixture(page, gw)
  // The page UI stays in the browser's language.
  expect((await status(page)).lang).toBe('zh')
  await expect
    .poll(async () => (await gw.rpc(s.pageId!, 'rwd.click', { ref: 'e99999' })).error.message)
    .toBe(fr.agent.refNotInSnapshot('e99999'))
  // The confirmation dialog is the user's (zh); the denial goes back in French.
  gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
  const click = gw.rpc(s.pageId!, 'rwd.click', { ref: refOf(await snapshot(gw, s.pageId!), 'button', '搜索') })
  await expect(page.locator('#__rwd .scrim:not(.out) .dlg')).toContainText(zh.ui.confirmText(zh.action.click(zh.action.quote('搜索'))))
  await dialogButton(page, '.deny').tap()
  expect((await click).error.message).toBe(fr.agent.userDenied)
})

test.describe('styles', () => {
  test.use({ locale: 'en-US' })

  test('run({ style }) sets the --rwd-* properties: colors, radius, z-index, pill side', async ({ page, gw }) => {
    await openFixture(page, gw, {
      helpButton: true,
      style: { accent: '#e11d48', radius: 4, buttonRadius: '6px', zIndex: 1000, font: 'Georgia, serif', pill: { side: 'left', top: 0.2 } },
    })
    const host = page.locator('#__rwd')
    expect(await host.evaluate(el => getComputedStyle(el).zIndex)).toBe('1000')
    const pill = page.locator('#__rwd .pill')
    await expect.poll(async () => (await pill.boundingBox())!.x).toBe(8)
    await pill.locator('.brand').tap()
    const win = page.locator('#__rwd .win')
    await expect(win).toHaveClass(/\bopen\b/)
    const css = await page.evaluate(() => {
      const root = document.getElementById('__rwd')!.shadowRoot!
      const get = (sel: string) => getComputedStyle(root.querySelector(sel)!)
      return {
        accent: get('.win .btn.accent').backgroundColor,
        button: get('.win .btn.accent').borderTopLeftRadius,
        win: get('.win').borderTopLeftRadius,
        font: get('.win').fontFamily,
      }
    })
    expect(css).toEqual({ accent: 'rgb(225, 29, 72)', button: '6px', win: '4px', font: 'Georgia, serif' })
  })

  test('page CSS: --rwd-* on :root and #__rwd::part()', async ({ page, gw }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent =
          ':root { --rwd-accent-rgb: 22, 163, 74; --rwd-bar-bottom: 40px; } #__rwd::part(bar) { outline: 3px solid rgb(1, 2, 3); }'
        document.head.appendChild(style)
      })
    })
    const s = await openFixture(page, gw)
    gw.setControl(s.deviceId!, 'user', 'Support bot', 'interact')
    const bar = page.locator('#__rwd .bar')
    await expect(bar.locator('.btn.accent')).toHaveCSS('background-color', 'rgb(22, 163, 74)')
    await expect(bar).toHaveCSS('outline-color', 'rgb(1, 2, 3)')
    await expect(bar).toHaveCSS('bottom', '40px')
  })
})

test.describe('Arabic (right to left)', () => {
  test.use({ locale: 'ar-EG' })

  test('mirrored layout: window, bottom bar, dialog; device code stays left to right; everything fits', async ({ page, gw }) => {
    const s = await openFixture(page, gw, { helpButton: true })
    expect((await status(page)).lang).toBe('ar')
    const host = page.locator('#__rwd')
    await expect(host).toHaveAttribute('dir', 'rtl')
    await expect(host).toHaveAttribute('lang', 'ar')

    // The idle pill starts on the left edge.
    const pill = page.locator('#__rwd .pill')
    await expect.poll(async () => (await pill.boundingBox())!.x).toBe(8)
    await pill.locator('.brand').tap()
    const win = page.locator('#__rwd .win')
    await expect(win.locator('.row .btn')).toHaveText([ar.ui.help, ar.ui.collapse])
    // The link status sits on the left, the name on the right.
    const name = (await win.locator('.name').boundingBox())!
    const link = (await win.locator('.link').boundingBox())!
    expect(link.x).toBeLessThan(name.x)
    expect(await win.locator('.big').evaluate(el => getComputedStyle(el).direction)).toBe('ltr')
    await expect(win.locator('.big')).toHaveText(s.deviceCode!)
    await expectFits(page, '#__rwd .win')
    await win.locator('[data-action=toggle]').tap()

    const bar = page.locator('#__rwd .bar')
    gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
    await expect(bar.locator('.btn')).toHaveText([ar.ui.takeover, ar.ui.end])
    // First button on the right: the order reads right to left.
    const [takeover, end] = await bar.locator('.btn').all()
    expect((await takeover.boundingBox())!.x).toBeGreaterThan((await end.boundingBox())!.x)
    const label = (await bar.locator('.status').boundingBox())!
    expect(label.x).toBeGreaterThan((await takeover.boundingBox())!.x)
    await expectFits(page, '#__rwd .bar')
    gw.setControl(s.deviceId!, 'none')

    const req = gw.requestAttach(s.deviceId!, { agent: 'Support bot', levels: ['observe', 'interact'] })
    await expect(page.locator('#__rwd .scrim:not(.out) .dlg h3')).toHaveText(ar.ui.attachTitle)
    const deny = (await dialogButton(page, '.deny').boundingBox())!
    const allow = (await dialogButton(page, '.allow').boundingBox())!
    expect(deny.x).toBeGreaterThan(allow.x)
    expect(await dialogButton(page, '[data-choice]').first().evaluate(el => getComputedStyle(el).textAlign)).toBe('right')
    await dialogButton(page, '.allow').tap()
    expect(await req.decision).toBe('interact')
  })
})

test('bottom bar: a label too long to sit next to the buttons moves them to a second row; English stays on one', async ({ page, gw }) => {
  const s = await openFixture(page, gw, { lang: 'ru' })
  const bar = page.locator('#__rwd .bar')
  const whole = () => bar.locator('.label').evaluate(el => el.scrollWidth <= el.clientWidth + 1)
  gw.setControl(s.deviceId!, 'agent', 'Support bot', 'interact')
  await expect(bar.locator('.btn')).toHaveText([ru.ui.takeover, ru.ui.end])
  await expect(bar).toHaveClass(/\bstack\b/)
  expect(await whole()).toBe(true)
  await expectFits(page, '#__rwd .bar')

  await page.evaluate(() => (window as any).RemoteWebviewDebugger.setLang('en'))
  await expect(bar.locator('.btn')).toHaveText(['Take over', 'End'])
  await expect(bar).not.toHaveClass(/\bstack\b/)
  expect(await whole()).toBe(true)
})
