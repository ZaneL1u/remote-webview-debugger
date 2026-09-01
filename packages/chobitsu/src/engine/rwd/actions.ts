import { captureScreenshot } from '../screenshot'
import { querySnapshot, resolveRef, takeSnapshot } from './snapshot'
import { readStorage } from './storage'
import { clickConfirmation, enterConfirmation } from './policy'
import { press, typeText } from './keyboard'
import { click, drag, hover, targetAt, waitForActionable, wheel, type Point } from './pointer'
import { deepActiveElement, tagOf, sleep } from './dom'
import { queryConsole, queryNetwork, networkDetail, networkHidden } from './observe'
import { listSessions, overview, queryLog, recordDetail } from './coldlog'
import { rwdError } from './errors'
import { agentText } from './i18n'

// The rwd.* RPC methods (docs/protocol.md §5). Each acts on this page.

export interface ActionHooks {
  /** Briefly show the user which element the agent acts on. */
  highlight?(el: Element): void
  /**
   * Ask the user before a sensitive action (docs/protocol.md §8), e.g.
   * "click \"Place order\"". Resolves when allowed; rejects (forbidden) otherwise.
   */
  confirm?(action: string): Promise<void>
  /**
   * Show the user where the agent is about to act (the on-page agent cursor).
   * Awaited before the input is dispatched, so the cursor gets there first.
   */
  pointer?(p: Point, kind: PointerKind, el: Element): Promise<void> | void
}

export type PointerKind = 'click' | 'hover' | 'focus' | 'select' | 'scroll' | 'drag' | 'drop'

type Method = (params: any, hooks: ActionHooks) => any

/** Methods that operate the page (the gateway switches to `agent` first). */
export const INTERACTIVE_METHODS = [
  'rwd.click',
  'rwd.fill',
  'rwd.type',
  'rwd.press',
  'rwd.select',
  'rwd.hover',
  'rwd.scroll',
  'rwd.drag',
  'rwd.navigate',
  'rwd.back',
  'rwd.reload',
]

function show(hooks: ActionHooks, el: Element) {
  try {
    if (hooks.highlight) hooks.highlight(el)
  } catch (e) {
    // Cosmetic only.
  }
}

/**
 * Scroll by (dx, dy) with an ease-out over ~260 ms, so the user can follow
 * it; resolves when done. Each frame jumps instantly, so a page-wide
 * `scroll-behavior: smooth` does not fight the animation.
 */
function glide(scroller: Element | null, dx: number, dy: number): Promise<void> {
  const target = scroller || document.scrollingElement || document.documentElement
  const x0 = target.scrollLeft
  const y0 = target.scrollTop
  const set = (x: number, y: number) => {
    if (scroller) scroller.scrollTo({ left: x, top: y, behavior: 'instant' as ScrollBehavior })
    else window.scrollTo({ left: x, top: y, behavior: 'instant' as ScrollBehavior })
  }
  const ms = Math.min(360, Math.max(160, Math.sqrt(dx * dx + dy * dy) * 0.4))
  const start = Date.now()
  return new Promise(resolve => {
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / ms)
      const k = 1 - Math.pow(1 - t, 3)
      set(x0 + dx * k, y0 + dy * k)
      if (t < 1) setTimeout(step, 16)
      else resolve()
    }
    step()
  })
}

async function aim(hooks: ActionHooks, p: Point, kind: PointerKind, el: Element) {
  if (!hooks.pointer) return
  try {
    await hooks.pointer(p, kind, el)
  } catch (e) {
    // Cosmetic only.
  }
}

async function confirm(hooks: ActionHooks, action: string | null) {
  if (!action || !hooks.confirm) return
  // Tapping the dialog moves focus; Enter must still go to the same field.
  const focused = deepActiveElement()
  await hooks.confirm(action)
  if (focused instanceof HTMLElement && focused.isConnected && deepActiveElement() !== focused) {
    focused.focus({ preventScroll: true })
  }
}

function str(value: unknown, name: string): string {
  if (typeof value !== 'string') throw rwdError('bad_request', agentText().notString(name))
  return value
}

type TextField = HTMLInputElement | HTMLTextAreaElement

const NON_TEXT_INPUTS = /^(checkbox|radio|file|button|submit|reset|image|hidden|range|color)$/

function setNativeValue(el: TextField, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  if (desc && desc.set) desc.set.call(el, value)
  else el.value = value
}

/** Labels point at their control, like Playwright's retargeting. */
function retarget(el: Element): Element {
  if (el instanceof HTMLLabelElement && el.control) return el.control
  return el
}

function editable(el: Element): TextField | HTMLElement {
  el = retarget(el)
  if (el instanceof HTMLInputElement && !NON_TEXT_INPUTS.test(el.type)) {
    if (el.readOnly) throw rwdError('not_interactable', agentText().readOnly(tagOf(el)))
    return el
  }
  if (el instanceof HTMLTextAreaElement) {
    if (el.readOnly) throw rwdError('not_interactable', agentText().readOnly(tagOf(el)))
    return el
  }
  if (el instanceof HTMLElement && el.isContentEditable) return el
  if (el instanceof HTMLSelectElement) {
    throw rwdError('bad_request', agentText().isSelect(tagOf(el)))
  }
  throw rwdError('not_interactable', agentText().notFillable(tagOf(el)))
}

function caretToEnd(el: Element) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      const len = el.value.length
      el.setSelectionRange(len, len)
    } catch (e) {
      // Input types without selection (email, number).
    }
  }
}

function scrollableAncestor(el: Element | null): Element | null {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el)
    const scrollY = /(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight
    const scrollX = /(auto|scroll|overlay)/.test(style.overflowX) && el.scrollWidth > el.clientWidth
    if (scrollY || scrollX) return el
  }
  return null
}

function visibleText() {
  return (document.body && document.body.innerText) || ''
}

function later(fn: () => void) {
  // Let the RPC reply leave before the page unloads.
  setTimeout(fn, 50)
}

/** JSON-safe copy of an evaluate result. */
function toJson(value: any): any {
  const seen: any[] = []
  const walk = (v: any, depth: number): any => {
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return null
    if (typeof v === 'bigint') return String(v)
    if (typeof v === 'number') return isFinite(v) ? v : String(v)
    if (v === null || typeof v !== 'object') return v
    if (typeof Element !== 'undefined' && v instanceof Element) return tagOf(v)
    if (v instanceof Date) return v.toISOString()
    if (v instanceof Error) return `${v.name}: ${v.message}`
    if (seen.indexOf(v) >= 0 || depth > 20) return '[Circular]'
    seen.push(v)
    let out: any
    if (Array.isArray(v) || (typeof NodeList !== 'undefined' && v instanceof NodeList)) {
      out = Array.prototype.map.call(v, (it: any) => walk(it, depth + 1))
    } else if (typeof v.toJSON === 'function') {
      out = walk(v.toJSON(), depth + 1)
    } else {
      out = {}
      for (const key of Object.keys(v)) {
        const item = v[key]
        if (item !== undefined && typeof item !== 'function' && typeof item !== 'symbol') {
          out[key] = walk(item, depth + 1)
        }
      }
    }
    seen.pop()
    return out
  }
  return walk(value, 0)
}

const methods: { [name: string]: Method } = {
  'rwd.ping': () => ({ at: Date.now() }),

  'rwd.snapshot': () => {
    const snapshot = takeSnapshot()
    return { url: location.href, title: document.title, snapshot }
  },

  'rwd.query': params => querySnapshot(params),

  'rwd.click': async (params, hooks) => {
    const el = resolveRef(params.ref)
    await confirm(hooks, clickConfirmation(el))
    const point = await waitForActionable(el, { hitTest: true })
    await aim(hooks, point, 'click', el)
    show(hooks, el)
    click(targetAt(el, point), point, { button: params.button || 'left', clickCount: params.clickCount || 1 })
    return {}
  },

  'rwd.hover': async (params, hooks) => {
    const el = resolveRef(params.ref)
    const point = await waitForActionable(el, { hitTest: true })
    await aim(hooks, point, 'hover', el)
    show(hooks, el)
    hover(targetAt(el, point), point)
    return {}
  },

  'rwd.fill': async (params, hooks) => {
    const el = editable(resolveRef(params.ref))
    const value = params.value === undefined || params.value === null ? '' : String(params.value)
    await aim(hooks, await waitForActionable(el, { hitTest: false }), 'focus', el)
    show(hooks, el)
    el.focus({ preventScroll: true })
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      try {
        el.select()
      } catch (e) {
        // Not selectable.
      }
      const proceed = el.dispatchEvent(
        new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: value })
      )
      if (proceed) {
        // The native setter bypasses React's value tracker, so React (and Vue's
        // v-model) see the input event as a real change.
        setNativeValue(el, value)
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
    } else {
      const selection = window.getSelection()
      if (selection) {
        const range = document.createRange()
        range.selectNodeContents(el)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      let inserted = false
      try {
        inserted = document.execCommand('insertText', false, value)
      } catch (e) {
        inserted = false
      }
      if (!inserted) {
        el.textContent = value
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
      }
    }
    return {}
  },

  'rwd.type': async (params, hooks) => {
    const text = str(params.text, 'text')
    if (params.ref !== undefined && params.ref !== null) {
      const el = editable(resolveRef(params.ref))
      await aim(hooks, await waitForActionable(el, { hitTest: false }), 'focus', el)
      show(hooks, el)
      if (document.activeElement !== el) el.focus({ preventScroll: true })
      caretToEnd(el)
    }
    if (params.submit) await confirm(hooks, enterConfirmation())
    typeText(text)
    if (params.submit) press('Enter')
    return {}
  },

  'rwd.press': async (params, hooks) => {
    const key = str(params.key, 'key')
    if (/(^|\+)Enter$/.test(key)) await confirm(hooks, enterConfirmation())
    press(key)
    return {}
  },

  'rwd.select': async (params, hooks) => {
    const el = retarget(resolveRef(params.ref))
    if (!(el instanceof HTMLSelectElement)) {
      throw rwdError('bad_request', agentText().notSelect(tagOf(el)))
    }
    const values: string[] = (Array.isArray(params.values) ? params.values : [params.values])
      .filter((v: any) => v !== undefined && v !== null)
      .map(String)
    if (!values.length) throw rwdError('bad_request', agentText().missingParam('values'))
    if (values.length > 1 && !el.multiple) throw rwdError('bad_request', agentText().singleSelect)
    await aim(hooks, await waitForActionable(el, { hitTest: false }), 'select', el)
    show(hooks, el)

    const options = Array.prototype.slice.call(el.options) as HTMLOptionElement[]
    const picked: HTMLOptionElement[] = []
    for (const value of values) {
      let option: HTMLOptionElement | undefined
      for (const o of options) {
        if (!option && (o.value === value || o.label === value || (o.textContent || '').trim() === value)) option = o
      }
      if (!option) {
        const choices = options.map(o => (o.textContent || o.value).trim())
        throw rwdError('not_found', agentText().noSuchOption(value, choices))
      }
      if (option.disabled) throw rwdError('not_interactable', agentText().optionDisabled(value))
      picked.push(option)
    }
    el.focus({ preventScroll: true })
    for (const o of options) o.selected = picked.indexOf(o) >= 0
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return {
      selected: options.filter(o => o.selected).map(o => o.value),
    }
  },

  'rwd.scroll': async (params, hooks) => {
    const dx = Number(params.dx) || 0
    const dy = Number(params.dy) || 0
    if (params.ref === undefined || params.ref === null) {
      await glide(null, dx, dy)
      return {}
    }
    const el = resolveRef(params.ref)
    const point = await waitForActionable(el, { hitTest: false })
    await aim(hooks, point, 'scroll', el)
    show(hooks, el)
    wheel(el, point, dx, dy)
    await glide(scrollableAncestor(el), dx, dy)
    return {}
  },

  'rwd.drag': async (params, hooks) => {
    const from = resolveRef(params.fromRef)
    const to = resolveRef(params.toRef)
    const p1 = await waitForActionable(from, { hitTest: true })
    await aim(hooks, p1, 'drag', from)
    show(hooks, from)
    const p2 = await waitForActionable(to, { hitTest: false })
    await Promise.all([drag(targetAt(from, p1), p1, to, p2), aim(hooks, p2, 'drop', to)])
    show(hooks, to)
    return {}
  },

  'rwd.navigate': params => {
    const raw = str(params.url, 'url')
    let url: URL
    try {
      url = new URL(raw, location.href)
    } catch (e) {
      throw rwdError('bad_request', agentText().badUrl(raw))
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw rwdError('bad_request', agentText().httpOnly)
    }
    later(() => location.assign(url.href))
    return {}
  },

  'rwd.back': () => {
    later(() => history.back())
    return {}
  },

  'rwd.reload': () => {
    later(() => location.reload())
    return {}
  },

  'rwd.waitFor': async params => {
    if (typeof params.timeMs === 'number' && params.timeMs > 0) {
      await sleep(Math.min(params.timeMs, 60000))
    }
    const text = typeof params.text === 'string' && params.text ? params.text : ''
    const gone = typeof params.textGone === 'string' && params.textGone ? params.textGone : ''
    if (!text && !gone) return {}
    const timeout = typeof params.timeoutMs === 'number' && params.timeoutMs > 0 ? params.timeoutMs : 10000
    const deadline = Date.now() + timeout
    for (;;) {
      const content = visibleText()
      if ((!text || content.indexOf(text) >= 0) && (!gone || content.indexOf(gone) < 0)) return {}
      if (Date.now() >= deadline) {
        throw rwdError('timeout', text ? agentText().textAppearTimeout(text) : agentText().textGoneTimeout(gone))
      }
      await sleep(100)
    }
  },

  'rwd.screenshot': async params => {
    const format = params.format === 'png' || params.format === 'webp' ? params.format : 'jpeg'
    const quality = typeof params.quality === 'number' ? Math.max(1, Math.min(100, params.quality)) : 80
    let clip
    if (params.ref !== undefined && params.ref !== null) {
      const el = resolveRef(params.ref)
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' as ScrollBehavior })
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) throw rwdError('not_interactable', agentText().notVisible(tagOf(el)))
      clip = { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height, scale: 1 }
    }
    const shot = await captureScreenshot({
      format,
      quality: format === 'png' ? undefined : quality,
      clip,
      captureBeyondViewport: !clip && !!params.fullPage,
    })
    return {
      data: shot.data,
      mimeType: 'image/' + format,
      source: shot.source,
      width: shot.width,
      height: shot.height,
    }
  },

  'rwd.console': params => queryConsole(params),
  'rwd.network': params => queryNetwork(params),
  'rwd.networkDetail': params => networkDetail(params),
  'rwd.storage': params => readStorage(params),

  // The session log (coldlog.ts). op: 'sessions' | 'overview' | 'records'.
  'rwd.log': async params => {
    const session = typeof params.session === 'string' ? params.session : undefined
    if (params.op === 'sessions') return { sessions: await listSessions() }
    if (params.op === 'overview') return await overview(session)
    const all = !!params.includeExcluded
    return await queryLog({
      session,
      kinds: Array.isArray(params.kinds) ? params.kinds.filter((k: unknown) => typeof k === 'string') : undefined,
      problems: !!params.problems,
      page: typeof params.page === 'string' ? params.page : undefined,
      text: typeof params.text === 'string' ? params.text : undefined,
      after: Number(params.after) || 0,
      from: Number(params.from) || 0,
      to: Number(params.to) || 0,
      limit: Number(params.limit) || 100,
      hide: all ? undefined : r => r.kind === 'net' && networkHidden(r.data.url, params.exclude),
    })
  },
  'rwd.logDetail': params => recordDetail(params.seq),

  'rwd.evaluate': async params => {
    const source = str(params.function, 'function')
    let fn: any
    try {
      // Indirect eval: the function runs in global scope, not ours.
      fn = (0, eval)(`(${source}\n)`)
    } catch (e: any) {
      throw rwdError('bad_request', agentText().badFunction(String(e && e.message)))
    }
    if (typeof fn !== 'function') throw rwdError('bad_request', agentText().notAFunction)
    const args = Array.isArray(params.args) ? params.args : []
    const value = await fn.apply(window, args)
    return { value: toJson(value) }
  },
}

export function hasMethod(method: string) {
  return Object.prototype.hasOwnProperty.call(methods, method)
}

export async function callMethod(method: string, params: any, hooks: ActionHooks = {}) {
  if (!hasMethod(method)) throw rwdError('bad_request', agentText().unknownMethod(method))
  return await methods[method](params && typeof params === 'object' ? params : {}, hooks)
}
