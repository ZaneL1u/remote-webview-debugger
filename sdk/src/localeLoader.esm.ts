import type { LocalePack } from './i18n'

// The ES module build loads built-in packs with dynamic imports: a bundler
// splits each language into its own chunk, fetched only when a page needs it.
// (The <script> build uses localeLoader.ts.)

const loaders: { [id: string]: () => Promise<{ default: LocalePack }> } = {
  'zh-TW': () => import('./locales/zh-TW'),
  fr: () => import('./locales/fr'),
  es: () => import('./locales/es'),
  ru: () => import('./locales/ru'),
  ar: () => import('./locales/ar'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  de: () => import('./locales/de'),
  pt: () => import('./locales/pt'),
}

export function loadLocale(id: string): Promise<LocalePack | null> {
  const load = loaders[id]
  return load ? load().then(m => m.default) : Promise.resolve(null)
}
