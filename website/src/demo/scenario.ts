// The scripted agent. Every step is a real MCP-tool call against the mock
// gateway, which sends real RPCs to the real SDK in the phone frame; refs and
// values come from the page's actual answers. The visitor can approve or
// deny, take over, hand back or end on the phone, and the agent reacts the
// way the product expects an agent to (wait_for_control, stop when ended).

import { highlight } from '../lib/highlight.ts'
import type { Lang, Level, MockGateway } from './gateway'
import type { Guide } from './guide.ts'
import { Cancelled, type Player } from './player'
import { scriptText, type ScriptText } from './text/index.ts'
import type { ToolResult, Tools } from './tools'
import type { View } from './view'

/** How long the demo waits for a tap on "Allow" before the hand taps it. */
const AUTO_ALLOW_S = 9

export class Ended extends Error {
  constructor(public why: 'ended' | 'denied' | 'timeout') {
    super(why)
  }
}

export interface ScenarioCtx {
  /** The page language (locale code). */
  lang: string
  /** The shop's language (and the mock gateway's). */
  shop: Lang
  gw: MockGateway
  tools: Tools
  view: View
  guide: Guide
  player: Player
  token: number
  frame: HTMLIFrameElement
  /** Called after each tool call with (done, total). */
  onProgress: (done: number, total: number) => void
  /** Whether the live patch proved the fix (null when it was skipped). */
  onVerified: (ok: boolean | null) => void
}

/** Tool calls in the happy path (for the progress bar). */
const TOTAL_CALLS = 29

/** `- role "name…" … [ref=eN]` → eN, first line whose name contains `name`. */
export function findRef(snapshot: string, role: string, name: string): string | null {
  const re = new RegExp(`^\\s*- ${role} "([^"]*)"[^\\n]*?\\[ref=(e\\d+)\\]`, 'gm')
  for (const m of snapshot.matchAll(re)) if (m[1].toLowerCase().includes(name.toLowerCase())) return m[2]
  return null
}

export async function runScenario(ctx: ScenarioCtx) {
  const { lang, shop, gw, tools, view, guide, player, token: tk } = ctx
  const t = scriptText(lang)
  let calls = 0
  let skipped = false

  const sleep = (ms: number) => player.sleep(tk, ms)
  const say = async (text: string) => {
    await player.gate(tk)
    await view.say(text, ms => player.sleep(tk, ms))
    await sleep(500)
  }
  const waitPage = async (match: string) => {
    const p = await gw.waitFor(() => {
      const f = gw.foreground()
      return f && f.url.includes(match) ? f : null
    }, 12_000, player.signal)
    player.check(tk)
    return p
  }

  /** Show a tool call, run it, show the result. No takeover handling. */
  const raw = async (name: string, args: object, run: () => Promise<ToolResult>): Promise<ToolResult> => {
    await player.gate(tk)
    const h = view.tool(name, args)
    const started = performance.now()
    const r = await run()
    player.check(tk)
    // Let the running state register, even for instant results.
    const shown = performance.now() - started
    if (shown < 380) await sleep(380 - shown)
    h.done(r)
    calls++
    ctx.onProgress(Math.min(calls, TOTAL_CALLS - 1), TOTAL_CALLS)
    return r
  }

  const waitForHandback = async () => {
    view.status('waitControl')
    view.hint(t.hintHandback)
    await say(t.takeover)
    for (;;) {
      const r = await raw('wait_for_control', { timeoutSec: 120 }, () => tools.wait_for_control({ timeoutSec: 120 }, player.signal))
      if (gw.endedByUser || (r.data && r.data.ended)) throw new Ended('ended')
      if (!r.isError) break
    }
    view.status('running')
    view.hint(t.hintRunning)
    await say(t.resumed)
  }

  /** A tool call as the agent makes it: waits out takeovers, stops when the user ends. */
  const call = async (name: string, args: object, run: () => Promise<ToolResult>, gap = 950): Promise<ToolResult> => {
    for (;;) {
      if (gw.endedByUser) throw new Ended('ended')
      if (gw.attached && gw.device && gw.device.control === 'user') await waitForHandback()
      const r = await raw(name, args, run)
      if (!r.isError) {
        await sleep(gap)
        return r
      }
      if (r.code === 'takeover') {
        await waitForHandback()
        continue
      }
      if (r.code === 'ended' || gw.endedByUser) throw new Ended('ended')
      if (r.code === 'forbidden') {
        skipped = true
        await say(t.forbidden)
        return r
      }
      await sleep(gap)
      return r
    }
  }

  const shopUrl = (path: string) => new URL(`/demo-shop/${shop}/${path}`, location.href).href

  /** Make sure the phone is on the page a step needs (the user may have wandered off). */
  const ensurePage = async (match: string, path: string, where: string) => {
    const p = gw.foreground() || (await waitPage(''))
    if (p && p.url.includes(match)) return
    await say(t.moving(where))
    await call('navigate_page', { url: shopUrl(path) }, () => tools.navigate_page({ url: shopUrl(path) }))
    await waitPage(match)
  }

  const task = (current: number) => call('set_task', current === 0 ? { title: t.task.title, steps: t.task.steps, current } : { title: t.task.title, current }, () => tools.set_task({ title: t.task.title, steps: t.task.steps, current }), 400)

  /* ------------------------------ the story ------------------------------ */

  view.status('running')
  view.user(t.prompt)
  await sleep(900)

  await say(t.s1)
  await call('list_devices', { status: 'waiting' }, () => tools.list_devices({ status: 'waiting' }))

  await say(t.s2)
  view.status('waitApproval')
  view.hint(t.hintApprove)
  let decided = false
  let autoUsed = false
  let requestId = ''
  // Nobody taps "Allow"? A hand points at it, counts down, then taps it.
  const auto = (async () => {
    try {
      // The request id arrives right after connect_device sends the request.
      for (let i = 0; i < 100 && !requestId; i++) await sleep(100)
      if (!requestId) return
      await sleep(1200)
      if (decided || !player.alive(tk)) return
      const shown = await guide.show(AUTO_ALLOW_S)
      for (let left = AUTO_ALLOW_S; left > 0; left--) {
        if (decided || !player.alive(tk)) return
        if (shown) guide.countdown(left)
        view.hint(shown ? t.hintApproveAuto(left) : t.hintApprove)
        await sleep(1000)
      }
      if (!decided && requestId && player.alive(tk)) {
        autoUsed = true
        if (shown) await guide.press()
        view.note(t.autoApproved, 'warn')
        tools.autoApprove(requestId, 'advanced')
      }
    } catch {
      // Cancelled with the run.
    }
  })()
  const conn = await raw('connect_device', { device: gw.code, level: 'advanced' }, () =>
    tools.connect_device({ device: gw.code, level: 'advanced' }, { onPending: id => (requestId = id), signal: player.signal }),
  )
  decided = true
  guide.hide()
  void auto
  if (conn.isError) {
    view.hint(null)
    if (conn.code === 'denied') throw new Ended('denied')
    throw new Ended('timeout')
  }
  const level: Level = conn.data.level
  if (!autoUsed) view.note(t.approved(level))
  view.status('running')
  view.hint(t.hintRunning)
  await sleep(600)

  await say(t.s3)
  await task(0)

  // 1. The checkout page as the customer sees it.
  await ensurePage('checkout', 'checkout.html', t.whereCheckout)
  let snap = await call('take_snapshot', {}, () => tools.take_snapshot(), 900)
  await say(t.s4)
  await task(1)
  await call('list_console_messages', { types: ['error', 'warn'] }, () => tools.list_console_messages({ types: ['error', 'warn'] }))

  // 2. The coupon box, while we're here.
  await say(t.s5)
  await ensurePage('checkout', 'checkout.html', t.whereCheckout)
  let text: string = (snap.data && snap.data.snapshot) || ''
  let coupon = findRef(text, 'textbox', t.find.coupon)
  let apply = findRef(text, 'button', t.find.apply)
  if (!coupon || !apply || gw.foreground()?.url !== snap.data?.url) {
    snap = await call('take_snapshot', {}, () => tools.take_snapshot(), 300)
    text = (snap.data && snap.data.snapshot) || ''
    coupon = findRef(text, 'textbox', t.find.coupon)
    apply = findRef(text, 'button', t.find.apply)
  }
  if (coupon && apply) {
    const actions = [
      { tool: 'type_text', args: { ref: coupon, text: 'VIP40' } },
      { tool: 'click', args: { ref: apply } },
    ]
    await call('batch_actions', { actions }, () => tools.batch_actions({ actions }), 900)
  }
  await call('list_network_requests', { failedOnly: true }, () => tools.list_network_requests({ failedOnly: true }))

  // 3. The order data behind the total.
  await say(t.s6)
  await task(2)
  const storage = await call('get_storage', { area: 'session' }, () => tools.get_storage({ area: 'session' }))
  let price = t.fallbackPrice
  let priceIsText = true
  try {
    const entry = (storage.data?.entries || []).find((e: any) => e.key === 'demo:order')
    if (entry) {
      const order = JSON.parse(entry.value)
      priceIsText = typeof order.price === 'string'
      if (priceIsText) price = JSON.stringify(order.price)
    }
  } catch {
    // Keep the fallback text.
  }
  await say(storage.isError || priceIsText ? t.s7(price) : t.s7b)
  await call('get_session_timeline', { limit: 20 }, () => tools.get_session_timeline({ limit: 20 }))

  // 4. Reproduce on the product page: Standard, then Gift box.
  await say(t.s8)
  await task(3)
  await call('go_back', {}, () => tools.go_back(), 300)
  await waitPage('detail')
  await ensurePage('detail', 'detail.html?id=1', t.whereDetail)

  const buyWith = async (value: string) => {
    let s = await call('take_snapshot', {}, () => tools.take_snapshot(), 500)
    let st: string = (s.data && s.data.snapshot) || ''
    let pkg = findRef(st, 'combobox', t.find.pkg)
    let buy = findRef(st, 'button', t.find.buy)
    if (!pkg || !buy) {
      await ensurePage('detail', 'detail.html?id=1', t.whereDetail)
      s = await call('take_snapshot', {}, () => tools.take_snapshot(), 500)
      st = (s.data && s.data.snapshot) || ''
      pkg = findRef(st, 'combobox', t.find.pkg)
      buy = findRef(st, 'button', t.find.buy)
    }
    if (!pkg || !buy) return
    const actions = [
      { tool: 'select_option', args: { ref: pkg, values: [value] } },
      { tool: 'click', args: { ref: buy } },
    ]
    await call('batch_actions', { actions }, () => tools.batch_actions({ actions }), 400)
    await waitPage('checkout')
    await sleep(700)
  }

  await buyWith(t.find.standard)
  const found = await call('find_elements', { text: t.find.total }, () => tools.find_elements({ text: t.find.total }))
  let total = t.standardTotal
  const m = String(found.data?.matches?.[0]?.text || '').match(/[$¥][\d.,]+/)
  if (m) total = m[0]
  await say(t.s9(total))
  await call('go_back', {}, () => tools.go_back(), 300)
  await waitPage('detail')
  await buyWith(t.find.gift)

  // 5. The line that writes the price.
  await say(t.s10)
  await call('go_back', {}, () => tools.go_back(), 300)
  await waitPage('detail')
  await ensurePage('detail', 'detail.html?id=1', t.whereDetail)
  const fn = "() => [...document.scripts].flatMap(s => s.textContent.split('\\n')).map(l => l.trim()).filter(l => l.startsWith('unitPrice ='))"
  await call('evaluate_script', { function: fn }, () => tools.evaluate_script({ function: fn }))

  // 6. A live patch in the page's memory: prove the fix on the device.
  await say(t.s11)
  await task(5)
  await ensurePage('checkout', 'checkout.html', t.whereCheckout)
  const patch =
    "() => { const k = 'demo:order'; const o = JSON.parse(sessionStorage.getItem(k) || 'null'); if (!o) return { patched: false }; const before = o.price; o.price = Number(String(o.price).replace(/[^\\d.]/g, '')); sessionStorage.setItem(k, JSON.stringify(o)); setTimeout(() => location.reload(), 60); return { patched: true, before, after: o.price } }"
  const patched = await call('evaluate_script', { function: patch }, () => tools.evaluate_script({ function: patch }), 400)
  let verified: boolean | null = null
  if (!patched.isError && patched.data?.value?.patched) {
    // The page reloads with the corrected order; wait for it to come back.
    await sleep(900)
    await waitPage('checkout')
    await sleep(500)
    const after = await call('find_elements', { text: t.find.total }, () => tools.find_elements({ text: t.find.total }))
    const m2 = String(after.data?.matches?.[0]?.text || '').match(/[$¥][\d.,]+/)
    verified = !!m2
    await say(verified ? t.s12(m2![0]) : t.s12b)
  } else if (!patched.isError) {
    await say(t.s12b)
  }
  ctx.onVerified(verified)
  await task(t.task.steps.length)
  await call('disconnect_device', {}, () => tools.disconnect_device(), 300)
  ctx.onProgress(TOTAL_CALLS, TOTAL_CALLS)
  view.summary(summaryHtml(t, price, highlight(fixDiff(t), 'diff'), skipped, verified))
}

function summaryHtml(t: ScriptText, price: string, diffHtml: string, skipped: boolean, verified: boolean | null) {
  const s = t.summary
  return `<h4>${s.rootCause}</h4>
<p>${s.rootCauseText(price)}</p>
<h4>${s.evidence}</h4>
<ul>${s.evidenceItems(price).map(x => `<li>${x}</li>`).join('')}</ul>
<h4>${s.verified}</h4>
<p>${verified ? s.verifiedText(t.patchedTotal) : s.notVerified}</p>
<h4>${s.fix}</h4>
<div class="code code-diff"><pre><code>${diffHtml}</code></pre></div>
<p>${s.fixText}</p>
<h4>${s.also}</h4>
<p>${s.alsoText}</p>
${skipped ? `<p class="muted">${s.skipped}</p>` : ''}
<p class="muted">${s.left}</p>`
}

function fixDiff(t: ScriptText) {
  return `   if (spec === 'gift') {
-    unitPrice = Shop.money(product.price + ${t.diffExtra})
+    unitPrice = product.price + ${t.diffExtra}
   } else {`
}

/** The customer's side before the agent shows up: browse, pick gift box, buy, request assistance. */
export async function runPrelude(ctx: ScenarioCtx) {
  const { lang, gw, view, player, token: tk, frame } = ctx
  const t = scriptText(lang)
  const sleep = (ms: number) => player.sleep(tk, ms)
  const win = () => frame.contentWindow as (Window & { ShopNav?: { go(u: string): void }; RemoteWebviewDebugger?: any }) | null
  const doc = () => frame.contentDocument
  const waitPage = async (match: string) => {
    await gw.waitFor(() => {
      const f = gw.foreground()
      return f && f.url.includes(match) ? f : null
    }, 12_000, player.signal)
    player.check(tk)
  }
  const waitDom = async (pred: () => boolean) => {
    for (let i = 0; i < 100 && !pred(); i++) await sleep(60)
  }

  view.status('prelude')
  view.hint(t.hintPrelude)
  await waitPage('index.html')
  await waitDom(() => !!doc()?.querySelector('a.card'))
  await sleep(1200)

  view.note(t.c1, 'customer')
  const card = doc()?.querySelector<HTMLAnchorElement>('a.card[href*="id=1"]')
  if (card) card.click()
  else win()?.ShopNav?.go('detail.html?id=1')
  await waitPage('detail')
  await waitDom(() => !!doc()?.getElementById('unit')?.textContent)
  await sleep(1000)

  view.note(t.c2, 'customer')
  const spec = doc()?.getElementById('spec') as HTMLSelectElement | null
  if (spec) {
    spec.value = 'gift'
    spec.dispatchEvent(new Event('change', { bubbles: true }))
  }
  await sleep(1100)

  view.note(t.c3, 'customer')
  doc()?.getElementById('buy')?.click()
  await waitPage('checkout')
  await sleep(1300)

  view.note(t.c4, 'customer')
  try {
    win()?.RemoteWebviewDebugger?.help(true)
  } catch {
    // The page is reloading; the agent finds the device anyway.
  }
  await sleep(1000)
}

export { Cancelled }
