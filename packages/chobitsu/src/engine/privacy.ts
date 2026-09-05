import { HIDE_SELECTOR } from './hitTest'

// Masking of sensitive values in everything the agent can read: snapshot text,
// screenshots, console text and request bodies. Password fields and anything
// inside an element marked `data-rwd-mask` are replaced with MASK. A project
// can add CSS selectors and text patterns (docs/protocol.md §11, welcome.config).

export const MASK = '••••'
export const MASK_SELECTOR = 'input[type=password], [data-rwd-mask]'

let maskSelector = MASK_SELECTOR
let patterns: RegExp[] = []

/** The selectors that parse, so a bad one cannot break every query. */
export function validSelectors(list: unknown): string[] {
  const out: string[] = []
  if (!Array.isArray(list)) return out
  const probe = document.createDocumentFragment()
  for (const sel of list) {
    if (typeof sel !== 'string' || !sel.trim()) continue
    try {
      probe.querySelector(sel)
      out.push(sel)
    } catch (e) {
      // Not a valid selector.
    }
  }
  return out
}

/**
 * Extra masking from the project policy: CSS selectors (on top of password
 * fields and [data-rwd-mask]) and text patterns, `{name, regex}` with regex in
 * JavaScript / RE2 syntax (a leading `(?i)` means case-insensitive).
 */
export function setMaskRules(selectors: unknown, regexes: unknown) {
  maskSelector = [MASK_SELECTOR].concat(validSelectors(selectors)).join(', ')
  patterns = []
  if (Array.isArray(regexes)) {
    for (const p of regexes) {
      let source = p && typeof p === 'object' ? p.regex : p
      if (typeof source !== 'string' || !source) continue
      let flags = 'g'
      if (source.indexOf('(?i)') === 0) {
        source = source.slice(4)
        flags += 'i'
      }
      try {
        patterns.push(new RegExp(source, flags))
      } catch (e) {
        // Not a valid pattern.
      }
    }
  }
  secretsCache = undefined
}

/** Replace text matching the project's mask patterns with MASK. */
export function scrubPatterns(text: string) {
  for (let i = 0; i < patterns.length; i++) {
    patterns[i].lastIndex = 0
    text = text.replace(patterns[i], m => (m ? MASK : m))
  }
  return text
}

/** Like Element.closest(), but continues past shadow roots to their hosts. */
export function closestComposed(el: Element | null, selector: string) {
  while (el) {
    const found = el.closest(selector)
    if (found) return found
    const root = el.getRootNode() as ShadowRoot
    el = root && root.host ? root.host : null
  }
  return null
}

/** Our own UI or another debug tool (eruda, PageSpy, vConsole). */
export function isDebugUi(el: Element) {
  return !!closestComposed(el, HIDE_SELECTOR)
}

/** Whether the element's value / text must not be shown. */
export function isMasked(el: Element) {
  return !!closestComposed(el, maskSelector)
}

/** Masked elements in the document, excluding debug tools' UI. */
export function maskedElements(): Element[] {
  return Array.prototype.filter.call(
    document.querySelectorAll(maskSelector),
    (el: Element) => !isDebugUi(el)
  ) as Element[]
}

/** The text an element shows: the value of form fields, text otherwise. */
export function shownText(el: Element) {
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return el.value
  }
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}

let secretsCache: { at: number; values: string[] } | undefined
// A field just changed (the user's typing or the agent's fill): its value may
// be a new secret, so the cache must not outlive it.
if (typeof document !== 'undefined') {
  const invalidate = () => {
    secretsCache = undefined
  }
  document.addEventListener('input', invalidate, true)
  document.addEventListener('change', invalidate, true)
}

/**
 * Current values of masked elements, longest first, for scrubbing free text
 * (console messages, request bodies). Cached briefly: consoles can be chatty.
 */
export function currentSecrets(): string[] {
  const now = Date.now()
  if (secretsCache && now - secretsCache.at < 1000) return secretsCache.values
  const values: string[] = []
  const elements = maskedElements()
  for (let i = 0; i < elements.length; i++) {
    const text = shownText(elements[i])
    // Very short values would garble unrelated text.
    if (text.length >= 3 && values.indexOf(text) < 0) values.push(text)
  }
  values.sort((a, b) => b.length - a.length)
  secretsCache = { at: now, values }
  return values
}

/** Replace every occurrence of the given secrets, and the mask patterns, in text with MASK. */
export function scrub(text: string, secrets: string[] = currentSecrets()) {
  for (let i = 0; i < secrets.length; i++) {
    if (text.indexOf(secrets[i]) >= 0) text = text.split(secrets[i]).join(MASK)
  }
  return scrubPatterns(text)
}
