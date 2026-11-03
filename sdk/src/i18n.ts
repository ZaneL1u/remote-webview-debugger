import { setAgentText, setUserText, type AgentText, type UserText } from '@chobitsu/engine/rwd'
import { loadLocale } from 'rwd:locale-loader'
import en, { type UiMessages } from './locales/en'
import zh from './locales/zh'

// Language packs for everything the page says, like a component library's
// locales. A pack holds three catalogs:
//
//   ui      the phone user's UI (pill, floating window, bottom bar, dialogs,
//           toasts, eruda tab), in run({ lang }) or the browser's language
//   action  what the agent is about to do, completing "AI wants to …" in the
//           confirmation dialog; same language as ui
//   agent   RPC errors and timeline events that go back to the AI agent, in
//           the language the gateway asks for (welcome.agentLang)
//
// English and Simplified Chinese are bundled. The other built-in packs load
// on demand: dist/locales/<id>.js next to sdk.js (or from the gateway), or a
// dynamic import in the ES module build. Pages can register their own packs
// and override single messages. A language falls back tag by tag, then to
// English: zh-HK → zh-TW → zh → en, pt-BR → pt → en.

export type { UiMessages }
export type AgentMessages = AgentText
export type ActionMessages = UserText

export interface Messages {
  ui: UiMessages
  action: ActionMessages
  agent: AgentMessages
}

/** Optional at every level; functions stay whole. */
export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/** A complete language pack, like the built-in ones. */
export interface Locale extends Messages {
  /** BCP 47 tag: 'en', 'zh-TW', 'pt'… */
  id: string
  /** The language's own name: 'Deutsch', '日本語'. */
  name: string
  dir?: 'ltr' | 'rtl'
}

/** A pack for registerLocale(): anything left out comes from its fallback languages. */
export interface LocalePack extends DeepPartial<Messages> {
  id: string
  name?: string
  dir?: 'ltr' | 'rtl'
}

/** Messages to override, per language tag: { en: { ui: { help: 'Contact support' } } }. */
export type MessageOverrides = { [lang: string]: DeepPartial<Messages> }

/** The built-in languages; all but en and zh load on demand. */
export const BUILTIN_LOCALES = ['en', 'zh', 'zh-TW', 'fr', 'es', 'ru', 'ar', 'ja', 'ko', 'de', 'pt']

const RTL = ['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']

const packs: { [id: string]: LocalePack } = { en, zh }
const overrides: { [id: string]: DeepPartial<Messages>[] } = {}
const loading: { [id: string]: Promise<void> } = {}
const resolved: { [id: string]: Messages } = {}
const listeners: (() => void)[] = []

/**
 * Canonical case for a language tag: zh_tw → zh-TW, ZH-hant-hk → zh-Hant-HK.
 * '' for anything that is not a tag.
 */
export function canonical(tag: unknown): string {
  if (typeof tag !== 'string') return ''
  const parts = tag.trim().replace(/_/g, '-').split('-')
  if (!/^[a-z]{2,8}$/i.test(parts[0])) return ''
  return parts
    .map((p, i) => {
      if (i === 0) return p.toLowerCase()
      if (/^[a-z]{4}$/i.test(p)) return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
      if (/^([a-z]{2}|\d{3})$/i.test(p)) return p.toUpperCase()
      return p.toLowerCase()
    })
    .join('-')
}

/**
 * The tags to try for a language, most specific first (English is the
 * implicit last resort): pt-BR → pt-BR, pt; zh-HK → zh-HK, zh-TW, zh;
 * zh-Hans-CN → zh-Hans-CN, zh-Hans, zh.
 */
export function fallbacks(tag: unknown): string[] {
  const t = canonical(tag)
  if (!t) return []
  const parts = t.split('-')
  const out: string[] = []
  for (let i = parts.length; i > 0; i--) out.push(parts.slice(0, i).join('-'))
  if (parts[0] === 'zh') {
    // Traditional Chinese is one pack (zh-TW) for Taiwan, Hong Kong and Macau.
    const hant = parts.indexOf('Hant') > 0 || (parts.indexOf('Hans') < 0 && /-(TW|HK|MO)\b/.test(t))
    if (hant && out.indexOf('zh-TW') < 0) out.splice(out.length - 1, 0, 'zh-TW')
  }
  return out
}

function known(id: string) {
  return !!packs[id] || BUILTIN_LOCALES.indexOf(id) >= 0
}

/**
 * The first preference we have a pack for (registered or built in), else 'en':
 * ['it', 'de-AT'] → 'de'; ['zh-HK'] → 'zh-TW'.
 */
export function pickLocale(prefs: unknown[]): string {
  for (const pref of prefs) {
    for (const id of fallbacks(pref)) if (known(id)) return id
  }
  return 'en'
}

/** The browser's languages, most preferred first. */
export function browserLangs(): string[] {
  try {
    const list = navigator.languages && navigator.languages.length ? navigator.languages.slice() : []
    if (navigator.language && list.indexOf(navigator.language) < 0) list.unshift(navigator.language)
    return list
  } catch (e) {
    return []
  }
}

function isObject(v: unknown): v is { [k: string]: unknown } {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function merge<T>(base: T, over: unknown): T {
  if (!isObject(over) || !isObject(base)) return base
  const out: { [k: string]: unknown } = {}
  for (const k in base) out[k] = (base as { [k: string]: unknown })[k]
  for (const k in over) {
    const v = over[k]
    if (v === undefined) continue
    out[k] = isObject(v) && isObject(out[k]) ? merge(out[k], v) : v
  }
  return out as T
}

function changed() {
  for (const k in resolved) delete resolved[k]
  for (const l of listeners.slice()) l()
}

/** The full messages of a language: English, then each fallback, then the pack, with overrides on top. */
export function messagesOf(id: string): Messages {
  const cached = resolved[id]
  if (cached) return cached
  let m: Messages = { ui: en.ui, action: en.action, agent: en.agent }
  const chain = fallbacks(id).reverse()
  if (chain[0] !== 'en') chain.unshift('en')
  for (const tag of chain) {
    const pack = packs[tag]
    if (pack) m = merge(m, { ui: pack.ui, action: pack.action, agent: pack.agent })
    for (const o of overrides[tag] || []) m = merge(m, o)
  }
  resolved[id] = m
  return m
}

/** Text direction of a language: the pack's, else rtl for Arabic, Hebrew, Persian… */
export function dirOf(id: string): 'ltr' | 'rtl' {
  for (const tag of fallbacks(id)) {
    const pack = packs[tag]
    if (pack && pack.dir) return pack.dir
  }
  return RTL.indexOf(id.split('-')[0]) >= 0 ? 'rtl' : 'ltr'
}

/** Add language packs (or replace one with the same id). Pages that already chose that language switch to it. */
export function registerLocale(pack: LocalePack | LocalePack[]) {
  const list = Array.isArray(pack) ? pack : [pack]
  let any = false
  for (const p of list) {
    const id = p && canonical(p.id)
    if (!id) continue
    packs[id] = id === p.id ? p : { ...p, id }
    any = true
  }
  if (any) changed()
}

/** Override single messages per language; later calls win. */
export function overrideMessages(messages: MessageOverrides | null | undefined) {
  if (!isObject(messages)) return
  for (const tag in messages) {
    const id = canonical(tag)
    if (!id || !isObject(messages[tag])) continue
    ;(overrides[id] = overrides[id] || []).push(messages[tag])
  }
  changed()
}

/** Calls listener after any pack registers or an override changes; returns the unsubscribe function. */
export function onLocalesChange(listener: () => void) {
  listeners.push(listener)
  return () => {
    const i = listeners.indexOf(listener)
    if (i >= 0) listeners.splice(i, 1)
  }
}

/**
 * Load a built-in pack that is not bundled (and the packs it falls back to).
 * Resolves either way: a language that can't load falls back.
 */
export function ensureLocale(id: string, gatewayUrl?: string): Promise<void> {
  const jobs: Promise<void>[] = []
  for (const tag of fallbacks(id)) {
    if (packs[tag] || BUILTIN_LOCALES.indexOf(tag) < 0) continue
    if (!loading[tag]) {
      loading[tag] = loadLocale(tag, gatewayUrl)
        .then(pack => {
          if (pack && !packs[tag]) registerLocale(pack)
        })
        .catch(() => undefined)
        .then(() => {
          // Failed: a later call (another gateway URL) may try again.
          if (!packs[tag]) delete loading[tag]
        })
    }
    jobs.push(loading[tag])
  }
  return Promise.all(jobs).then(() => undefined)
}

/** BCP 47 tag for lang attributes: zh → zh-CN, the id otherwise. */
export function htmlLang(id: string) {
  return id === 'zh' ? 'zh-CN' : id
}

/* ------------------------------ engine languages ----------------------------- */

let agentLang = 'en'

/** Language of what goes back to the agent (welcome.agentLang); English until set, and while it loads. */
export function setAgentLang(tag: unknown, gatewayUrl?: string) {
  agentLang = pickLocale([tag])
  setAgentText(messagesOf(agentLang).agent)
  void ensureLocale(agentLang, gatewayUrl)
}

/** The page UI's language, for the engine's action descriptions. */
export function setActionLang(id: string) {
  setUserText(messagesOf(id).action)
}

onLocalesChange(() => setAgentText(messagesOf(agentLang).agent))

// Packs loaded before this script (dist/locales/*.js queue themselves).
try {
  const queued = (window as unknown as { __RWD_LOCALES__?: LocalePack[] }).__RWD_LOCALES__
  if (Array.isArray(queued)) registerLocale(queued)
} catch (e) {
  // No window.
}
