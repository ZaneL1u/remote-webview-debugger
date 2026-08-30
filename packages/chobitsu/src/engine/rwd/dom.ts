import { setGlobalOptions } from '../vendor/playwright/injected/domUtils'
import {
  beginAriaCaches,
  endAriaCaches,
  getAriaRole,
  getElementAccessibleName,
} from '../vendor/playwright/injected/roleUtils'
import { isMasked, MASK } from '../privacy'

const ua = navigator.userAgent
export const isWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Android/.test(ua)

let configured = false

/**
 * Run DOM queries of the vendored Playwright code. It relies on
 * Element.checkVisibility() (Chrome 105, Safari 17.4); older webviews get a
 * stand-in for the duration of the call only, so the page never sees it.
 */
export function withDomCompat<T>(fn: () => T): T {
  if (!configured) {
    configured = true
    setGlobalOptions({ browserNameForWorkarounds: isWebKit ? 'webkit' : 'chromium' })
  }
  const proto = Element.prototype as any
  if (typeof proto.checkVisibility === 'function') return fn()
  proto.checkVisibility = checkVisibilityFallback
  try {
    return fn()
  } finally {
    delete proto.checkVisibility
  }
}

// An element whose box is not rendered (display: none on it or an ancestor,
// display: contents) has no client rects.
function checkVisibilityFallback(this: Element) {
  return this.getClientRects().length > 0
}

/** Role and accessible name, as the snapshot would show them. */
export function describeForAgent(el: Element): { role: string; name: string } {
  return withDomCompat(() => {
    beginAriaCaches()
    try {
      const role = getAriaRole(el) || 'generic'
      let name = getElementAccessibleName(el, false).text.replace(/\s+/g, ' ').trim()
      if (name && isMasked(el) && !isFormField(el)) name = MASK
      return { role, name }
    } finally {
      endAriaCaches()
    }
  })
}

export function isFormField(el: Element) {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  )
}

/** `<tag#id.class>` for messages. */
export function tagOf(el: Element) {
  let s = el.tagName.toLowerCase()
  if (el.id) s += '#' + el.id
  const cls = typeof el.className === 'string' ? el.className.trim() : ''
  if (cls) s += '.' + cls.split(/\s+/).slice(0, 2).join('.')
  return `<${s}>`
}

/** Whether `inner` is `outer` or inside it, also across shadow roots. */
export function containsComposed(outer: Element, inner: Element | null) {
  let node: Node | null = inner
  while (node) {
    if (node === outer) return true
    const parent: Node | null = node.parentNode
    if (parent) {
      node = parent
    } else {
      node = (node as ShadowRoot).host || null
    }
  }
  return false
}

/** The focused element, looking into shadow roots. */
export function deepActiveElement(): Element | null {
  let el: Element | null = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement
  }
  return el
}

export function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/** Next animation frame; falls back to a timer when rAF is paused (hidden tab). */
export function nextFrame() {
  return new Promise<void>(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    requestAnimationFrame(finish)
    setTimeout(finish, 100)
  })
}
