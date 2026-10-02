// A deliberately small syntax highlighter for the console's code snippets (HTML, JS, Swift, Kotlin,
// shell, JSON). Regex based, no dependency; good enough for short, well-formed examples.

export type CodeLang = 'html' | 'js' | 'swift' | 'kotlin' | 'bash' | 'json' | 'text'

export type Token = { text: string; cls?: string }

const KEYWORDS: Record<string, string> = {
  js: 'const let var function return if else for while new try catch finally throw typeof await async import export from default class extends null undefined true false this of in',
  swift:
    'import final class struct enum func let var if else guard return static private fileprivate weak self nil true false init in for while switch case default where as is try catch throws do extension protocol override some any',
  kotlin:
    'import package object class fun val var if else return private const null true false when is in for while try catch finally thread it override companion data interface',
  json: 'true false null',
  bash: 'export',
}

const STRING = String.raw`"""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`'
const NUMBER = String.raw`\b\d+(?:\.\d+)?\b`
const FN = String.raw`\b[A-Za-z_$][\w$]*(?=\()`

function words(lang: string) {
  const list = KEYWORDS[lang]
  return list ? String.raw`\b(?:${list.split(' ').join('|')})\b` : null
}

function rules(lang: CodeLang): [string, string | null][] {
  switch (lang) {
    case 'html':
      return [
        ['comment', String.raw`<!--[\s\S]*?-->|//[^\n]*`],
        ['string', STRING],
        ['tag', String.raw`</?[A-Za-z][\w-]*|/?>`],
        ['attr', String.raw`\b[\w-]+(?==)`],
        ['keyword', words('js')],
        ['number', NUMBER],
        ['fn', FN],
      ]
    case 'js':
    case 'swift':
    case 'kotlin':
      return [
        ['comment', String.raw`//[^\n]*|/\*[\s\S]*?\*/`],
        ['string', STRING],
        ['keyword', words(lang)],
        ['number', NUMBER],
        ['fn', FN],
      ]
    case 'json':
      return [
        ['attr', String.raw`"(?:\\.|[^"\\\n])*"(?=\s*:)`],
        ['string', STRING],
        ['keyword', words('json')],
        ['number', NUMBER],
      ]
    case 'bash':
      return [
        ['comment', String.raw`(?<=^|\s)#[^\n]*`],
        ['string', STRING],
        ['fn', String.raw`(?<=^|\n|\|\s|&&\s)\s*[a-z][\w.-]*`],
        ['attr', String.raw`(?<=\s)--?[A-Za-z][\w-]*`],
        ['keyword', words('bash')],
      ]
    default:
      return []
  }
}

const cache = new Map<CodeLang, RegExp | null>()

function compile(lang: CodeLang) {
  if (!cache.has(lang)) {
    const parts = rules(lang).filter((r): r is [string, string] => !!r[1])
    cache.set(lang, parts.length ? new RegExp(parts.map(([name, re]) => `(?<${name}>${re})`).join('|'), 'g') : null)
  }
  return cache.get(lang) ?? null
}

export function tokenize(code: string, lang: CodeLang = 'text'): Token[] {
  const re = compile(lang)
  if (!re) return [{ text: code }]
  const out: Token[] = []
  let last = 0
  re.lastIndex = 0
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (m[0] === '') {
      re.lastIndex++
      continue
    }
    if (m.index > last) out.push({ text: code.slice(last, m.index) })
    const name = Object.entries(m.groups ?? {}).find(([, v]) => v !== undefined)?.[0]
    out.push({ text: m[0], cls: name ? `tok-${name}` : undefined })
    last = m.index + m[0].length
  }
  if (last < code.length) out.push({ text: code.slice(last) })
  return out
}
