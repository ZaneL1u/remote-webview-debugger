import { test as base, expect, type Page } from '@playwright/test'
// @ts-expect-error plain ESM helper without types
import { startGateway } from '../mock-gateway.mjs'

export type Gateway = Awaited<ReturnType<typeof startGateway>>

export const KEY = 'rwd_pk_test0000000000000000000'

export const test = base.extend<{ errors: string[]; resetGateway: void }, { gw: Gateway }>({
  gw: [
    async ({}, use) => {
      const gw = await startGateway({})
      await use(gw)
      await gw.close()
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ gw }, use) => {
    await use(gw.url)
  },
  // Gateway switches are per worker: every test starts from the defaults.
  resetGateway: [
    async ({ gw }, use) => {
      gw.setConfig({})
      gw.setQuotaFull(false)
      gw.setAgentLang('zh')
      await use()
    },
    { auto: true },
  ],
  // Uncaught page errors, for tests that assert there are none.
  errors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(String(e && e.message)))
    await use(errors)
  },
})

export { expect }

export interface Status {
  deviceCode: string | null
  status: string
  control: string
  help: boolean
  label: string | null
  deviceId: string | null
  pageId: string | null
  deviceToken: string | null
  level: string | null
  lang: 'en' | 'zh' | null
  config: any
  pending: any
}

export async function status(page: Page): Promise<Status> {
  return page.evaluate(() => (window as any).RemoteWebviewDebugger.status())
}

/** Open a demo page and wait until it is online at the gateway. */
export async function openDemo(page: Page, gw: Gateway, path = 'index.html', query = `?key=${KEY}`) {
  await page.goto(`/demo/platform/${path}${query}`)
  return waitOnline(page, gw)
}

export async function waitOnline(page: Page, gw: Gateway) {
  await expect.poll(async () => (await status(page)).status, { timeout: 15_000 }).toBe('online')
  const s = await status(page)
  await gw.waitFor(() => {
    const p = gw.findPage(s.pageId!)
    return p && p.connected && p.url === page.url()
  }, 10_000, 'page online at gateway')
  return s
}

/** Call an rwd.* method on a page; throws on RPC errors. */
export async function rpc(gw: Gateway, pageId: string, method: string, params: object = {}) {
  const reply = await gw.rpc(pageId, method, params)
  if (reply.error) throw new Error(`${method} failed: ${reply.error.code}: ${reply.error.message}`)
  return reply.result
}

/**
 * The ref of an element with this role: either its own name contains `text`,
 * or some line inside it does (Playwright drops names that repeat content).
 */
export function refOf(snapshot: string, role: string, text: string): string {
  const lines = snapshot.split('\n')
  const parse = (line: string) => line.match(/^(\s*)- (\w+)(?: "([^"]*)")?.*?\[ref=(e\d+)\]/)
  for (const line of lines) {
    const m = parse(line)
    if (m && m[2] === role && (m[3] || '').includes(text)) return m[4]
  }
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(text)) continue
    let indent = lines[i].search(/\S/)
    for (let j = i; j >= 0; j--) {
      const own = lines[j].search(/\S/)
      if (j !== i && own >= indent) continue
      indent = own
      const m = parse(lines[j])
      if (m && m[2] === role) return m[4]
    }
  }
  throw new Error(`no ${role} with "${text}" in snapshot:\n${snapshot}`)
}

export async function snapshot(gw: Gateway, pageId: string): Promise<string> {
  return (await rpc(gw, pageId, 'rwd.snapshot')).snapshot
}

/**
 * Open test/fixtures/host.html. `opts` are extra run() options, as a native
 * host would pass them (nativeKey, nativeApproval, deviceToken, deviceId…).
 */
export async function openFixture(page: Page, gw: Gateway, opts: object = {}) {
  await page.addInitScript((o: object) => {
    ;(window as any).__rwdOpts = o
  }, opts)
  await page.goto('/test/host.html')
  return waitOnline(page, gw)
}

/** A button of our dialog (`.allow`, `.deny`, `[data-choice=…]`). */
export function dialogButton(page: Page, selector: string) {
  return page.locator(`#__rwd .scrim:not(.out) .dlg ${selector}`)
}

/** Click a dialog button the way a page script (or the agent's evaluate) could: untrusted. */
export async function untrustedClick(page: Page, selector: string) {
  // Armed first, so a refusal is because the click is untrusted, not disabled.
  await expect(dialogButton(page, selector)).toBeEnabled()
  await page.evaluate((sel: string) => {
    const el = document.getElementById('__rwd')!.shadowRoot!.querySelector(`.scrim:not(.out) .dlg ${sel}`) as HTMLElement
    el.click()
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
  }, selector)
}
