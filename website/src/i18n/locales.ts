// The site's languages: one static page each. `code` is the BCP 47 tag used
// in <html lang>, hreflang and the SDK; `path` is the URL prefix (English is
// the root). Order = the language menu.

export interface Locale {
  code: string
  /** URL prefix without slashes ('' for English). */
  path: string
  /** The language's own name, shown in the menu. */
  name: string
  dir: 'ltr' | 'rtl'
  ogLocale: string
  /** Language the demo shop (and the mock gateway's tool results) use. */
  shop: 'en' | 'zh'
  /** How the matching browser language tags start (lower-case). */
  match: string[]
}

export const LOCALES: Locale[] = [
  { code: 'en', path: '', name: 'English', dir: 'ltr', ogLocale: 'en_US', shop: 'en', match: ['en'] },
  { code: 'zh-CN', path: 'zh', name: '简体中文', dir: 'ltr', ogLocale: 'zh_CN', shop: 'zh', match: ['zh-cn', 'zh-sg', 'zh-hans', 'zh'] },
  { code: 'zh-TW', path: 'zh-tw', name: '繁體中文', dir: 'ltr', ogLocale: 'zh_TW', shop: 'zh', match: ['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'] },
  { code: 'ja', path: 'ja', name: '日本語', dir: 'ltr', ogLocale: 'ja_JP', shop: 'en', match: ['ja'] },
  { code: 'ko', path: 'ko', name: '한국어', dir: 'ltr', ogLocale: 'ko_KR', shop: 'en', match: ['ko'] },
  { code: 'es', path: 'es', name: 'Español', dir: 'ltr', ogLocale: 'es_ES', shop: 'en', match: ['es'] },
  { code: 'fr', path: 'fr', name: 'Français', dir: 'ltr', ogLocale: 'fr_FR', shop: 'en', match: ['fr'] },
  { code: 'de', path: 'de', name: 'Deutsch', dir: 'ltr', ogLocale: 'de_DE', shop: 'en', match: ['de'] },
  { code: 'pt-BR', path: 'pt-br', name: 'Português (Brasil)', dir: 'ltr', ogLocale: 'pt_BR', shop: 'en', match: ['pt'] },
  { code: 'ru', path: 'ru', name: 'Русский', dir: 'ltr', ogLocale: 'ru_RU', shop: 'en', match: ['ru'] },
  { code: 'ar', path: 'ar', name: 'العربية', dir: 'rtl', ogLocale: 'ar_AR', shop: 'en', match: ['ar'] },
]

export const DEFAULT = LOCALES[0]

export function localeByPath(path: string): Locale | undefined {
  return LOCALES.find(l => l.path === path)
}

/** The page URL of a locale, site-relative ('/', '/zh/', '/pt-br/'). */
export function href(l: Locale): string {
  return l.path ? `/${l.path}/` : '/'
}
