// The dictionaries, by locale code (src/i18n/locales.ts).

import type { Dict } from './en.ts'
import { en } from './en.ts'
import { zh } from './zh.ts'
import { zhTW } from './zh-tw.ts'
import { ja } from './ja.ts'
import { ko } from './ko.ts'
import { es } from './es.ts'
import { fr } from './fr.ts'
import { de } from './de.ts'
import { ptBR } from './pt-br.ts'
import { ru } from './ru.ts'
import { ar } from './ar.ts'

export const DICTS: Record<string, Dict> = {
  en,
  'zh-CN': zh,
  'zh-TW': zhTW,
  ja,
  ko,
  es,
  fr,
  de,
  'pt-BR': ptBR,
  ru,
  ar,
}

export function dict(code: string): Dict {
  return DICTS[code] || en
}

export type { Dict }
