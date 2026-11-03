import { createElement, Fragment, type ReactNode, useSyncExternalStore } from 'react'

import { en, type Messages } from './en'

// UI language. An explicit choice lives in localStorage (per browser); otherwise the browser's
// languages decide: the first one we have, matching zh-HK / zh-Hant to Traditional Chinese and fr-CA
// to French, else English. index.html applies the same rule to <html lang dir> before the first paint.
//
// The catalogs are plain typed objects (en/ is the source of truth, every other folder must have the
// same shape). English is bundled; the others are separate chunks loaded on demand, and a language is
// shown once its catalog is in (main.tsx waits for the first one). Components read the current catalog
// with useT(); code outside React (formatters, the API client, toasts fired from mutation callbacks)
// reads it with getT().

export type Lang = 'en' | 'zh' | 'zh-TW' | 'ar' | 'de' | 'es' | 'fr' | 'ja' | 'ko' | 'pt' | 'ru'
export type { Messages }

/** Endonyms for the language switcher; never translated. */
export const languages: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
]

const loaders: Record<Exclude<Lang, 'en'>, () => Promise<Messages>> = {
  zh: () => import('./zh').then((m) => m.zh),
  'zh-TW': () => import('./zh-TW').then((m) => m.zhTW),
  ar: () => import('./ar').then((m) => m.ar),
  de: () => import('./de').then((m) => m.de),
  es: () => import('./es').then((m) => m.es),
  fr: () => import('./fr').then((m) => m.fr),
  ja: () => import('./ja').then((m) => m.ja),
  ko: () => import('./ko').then((m) => m.ko),
  pt: () => import('./pt').then((m) => m.pt),
  ru: () => import('./ru').then((m) => m.ru),
}

const KEY = 'rwd.lang'
const catalogs: Partial<Record<Lang, Messages>> = { en }
const listeners = new Set<() => void>()

function isLang(v: unknown): v is Lang {
  return languages.some((l) => l.value === v)
}

/** The supported language for a BCP 47 tag, or null: zh-HK → zh-TW, zh-SG → zh, pt-PT → pt. */
export function matchLang(tag: string): Lang | null {
  const parts = tag.trim().toLowerCase().replace(/_/g, '-').split('-')
  if (parts[0] === 'zh') {
    const hant = parts.includes('hant') || (!parts.includes('hans') && parts.some((p) => p === 'tw' || p === 'hk' || p === 'mo'))
    return hant ? 'zh-TW' : 'zh'
  }
  return isLang(parts[0]) ? parts[0] : null
}

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(KEY)
    return isLang(v) ? v : null
  } catch {
    return null
  }
}

function detect(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language || '']
  for (const tag of prefs) {
    const l = matchLang(tag)
    if (l) return l
  }
  return 'en'
}

function load(l: Lang): Promise<Messages> {
  const ready = catalogs[l]
  if (ready) return Promise.resolve(ready)
  return loaders[l as Exclude<Lang, 'en'>]().then((m) => (catalogs[l] = m))
}

let lang: Lang = 'en'
let wanted: Lang = stored() ?? detect()

function show(next: Lang) {
  if (next !== wanted) return // a later choice won the race
  const changed = next !== lang
  lang = next
  applyDocument()
  if (changed) listeners.forEach((l) => l())
}

/** Resolves once the first language is ready to render (English if its catalog fails to load). */
export const ready: Promise<void> = load(wanted).then(
  () => show(wanted),
  () => {
    wanted = 'en'
    show('en')
  },
)
applyDocument()

function applyDocument() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = htmlLang(lang)
  document.documentElement.dir = dirOf(lang)
}

export function getLang(): Lang {
  return lang
}

/** Switch language: remembered right away, shown as soon as its catalog has loaded. */
export function setLang(next: Lang) {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // private mode: the choice still applies to this tab
  }
  wanted = next
  load(next).then(
    () => show(next),
    () => undefined,
  )
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
  return catalogs[useLang()] ?? en
}

/** The current catalog, for code outside React (read it at call time, do not cache it). */
export function getT(): Messages {
  return catalogs[lang] ?? en
}

/** BCP 47 tag for <html lang>, Intl formatters and the `Accept-Language` header sent to the gateway. */
export function htmlLang(l: Lang = lang) {
  return l === 'zh' ? 'zh-CN' : l
}

/** Locale for Intl / toLocaleString (Arabic keeps Western digits, like the code and logs around them). */
export function locale(l: Lang = lang) {
  return l === 'en' ? 'en-US' : l === 'zh' ? 'zh-CN' : l === 'pt' ? 'pt-BR' : l === 'ar' ? 'ar-u-nu-latn' : l
}

export function dirOf(l: Lang = lang): 'ltr' | 'rtl' {
  return l === 'ar' ? 'rtl' : 'ltr'
}

/** Languages whose labels are short (CJK): the header nav fits at a smaller width. */
export function isCompact(l: Lang = lang) {
  return l === 'zh' || l === 'zh-TW' || l === 'ja' || l === 'ko'
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
