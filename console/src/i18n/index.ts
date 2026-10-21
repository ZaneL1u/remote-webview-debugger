import { createElement, Fragment, type ReactNode, useSyncExternalStore } from 'react'

import { en, type Messages } from './en'
import { zh } from './zh'

// UI language. An explicit choice lives in localStorage (per browser); otherwise the browser language
// decides (zh* → Chinese, anything else → English). index.html applies the same rule to <html lang>
// before the first paint.
//
// The catalogs are plain typed objects (en/ is the source of truth, zh/ must have the same shape).
// Components read them with useT(); code outside React (formatters, the API client, toasts fired from
// mutation callbacks) reads the current one with getT().

export type Lang = 'en' | 'zh'
export type { Messages }

/** Endonyms for the language switcher; never translated. */
export const languages: { value: Lang; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
]

const KEY = 'rwd.lang'
const catalogs: Record<Lang, Messages> = { en, zh }
const listeners = new Set<() => void>()

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'zh' ? v : null
  } catch {
    return null
  }
}

function detect(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return /^zh\b/i.test(nav) ? 'zh' : 'en'
}

let lang: Lang = stored() ?? detect()
applyDocument()

function applyDocument() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = htmlLang(lang)
}

export function getLang(): Lang {
  return lang
}

export function setLang(next: Lang) {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // private mode: the choice still applies to this tab
  }
  if (next === lang) return
  lang = next
  applyDocument()
  listeners.forEach((l) => l())
}

/** Runs `listener` after every language change; returns the unsubscribe function. */
export function onLangChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(onLangChange, getLang)
}

/** The current catalog, re-rendering the caller when the language changes. */
export function useT(): Messages {
  return catalogs[useLang()]
}

/** The current catalog, for code outside React (read it at call time, do not cache it). */
export function getT(): Messages {
  return catalogs[lang]
}

/** BCP 47 tag for <html lang>, Intl formatters and the `Accept-Language` header sent to the gateway. */
export function htmlLang(l: Lang = lang) {
  return l === 'zh' ? 'zh-CN' : 'en'
}

/** Locale for Intl / toLocaleString. */
export function locale(l: Lang = lang) {
  return l === 'zh' ? 'zh-CN' : 'en-US'
}

type Tags = Record<string, (chunk: ReactNode) => ReactNode>

/**
 * Renders a catalog string with inline markup: `<c>code</c>`, `<b>bold</b>` and whatever else `tags` maps,
 * so a sentence can keep its words in one piece for translators. Tags may nest; anything that is not one of
 * `tags` (say a literal `<head>`) stays plain text.
 */
export function rich(template: string, tags: Tags): ReactNode {
  const names = Object.keys(tags).join('|')
  if (!names) return template
  const re = new RegExp(`<(${names})>|</(${names})>`, 'g')
  const stack: { tag: string; children: ReactNode[] }[] = [{ tag: '', children: [] }]
  let last = 0
  let key = 0
  for (let m = re.exec(template); m; m = re.exec(template)) {
    const top = stack[stack.length - 1]
    if (m.index > last) top.children.push(template.slice(last, m.index))
    last = re.lastIndex
    if (m[1]) {
      stack.push({ tag: m[1], children: [] })
    } else if (stack.length > 1 && top.tag === m[2]) {
      stack.pop()
      const inner = createElement(Fragment, null, ...top.children)
      stack[stack.length - 1].children.push(createElement(Fragment, { key: key++ }, tags[top.tag](inner)))
    }
  }
  if (last < template.length) stack[stack.length - 1].children.push(template.slice(last))
  // Unclosed tags render as plain content.
  while (stack.length > 1) {
    const top = stack.pop()!
    stack[stack.length - 1].children.push(...top.children)
  }
  return createElement(Fragment, null, ...stack[0].children)
}
