// A deliberately tiny syntax highlighter, run at build time (render.ts).
// Good enough for the handful of snippets on the page; no runtime cost.

export type CodeLang = 'html' | 'js' | 'sh' | 'json' | 'swift' | 'kotlin' | 'yaml' | 'diff'

const KEYWORDS: Record<string, string[]> = {
  js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'new', 'null', 'true', 'false', 'typeof', 'await', 'async'],
  html: ['const', 'let', 'var', 'function', 'return', 'null', 'true', 'false', 'new'],
  swift: ['import', 'func', 'let', 'var', 'guard', 'else', 'return', 'defer', 'static', 'enum', 'struct', 'class', 'in', 'as', 'try', 'true', 'false', 'nil', 'if', 'self'],
  kotlin: ['fun', 'val', 'var', 'if', 'else', 'return', 'object', 'class', 'null', 'true', 'false', 'import', 'private', 'const'],
  sh: ['git', 'cd', 'make', 'docker', 'claude', 'npm', 'export'],
  json: ['true', 'false', 'null'],
  yaml: [],
  diff: [],
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function span(cls: string, text: string) {
  return `<span class="t-${cls}">${escapeHtml(text)}</span>`
}

export function highlight(code: string, lang: CodeLang): string {
  if (lang === 'diff') {
    return code
      .split('\n')
      .map(line => {
        if (line.startsWith('+')) return span('add', line)
        if (line.startsWith('-')) return span('del', line)
        return escapeHtml(line)
      })
      .join('\n')
  }
  const kw = new Set(KEYWORDS[lang] || [])
  const hashComments = lang === 'sh' || lang === 'yaml'
  const parts: string[] = [
    '<!--[\\s\\S]*?-->', // html comment
    hashComments ? '(?:^|(?<=\\s))#[^\\n]*' : '//[^\\n]*', // line comment
    '"(?:[^"\\\\\\n]|\\\\.)*"', // double-quoted string
    "'(?:[^'\\\\\\n]|\\\\.)*'", // single-quoted string
    '`(?:[^`\\\\]|\\\\.)*`', // template string
    '</?[A-Za-z][\\w-]*', // tag open
    '/?>', // tag close
    '\\b\\d+(?:\\.\\d+)?\\b', // number
    '(?<=\\s)--?[A-Za-z][\\w-]*', // cli flag
    '[A-Za-z_$][\\w$]*', // identifier
  ]
  const re = new RegExp(parts.join('|'), 'gm')
  let out = ''
  let last = 0
  let inTag = false
  for (const m of code.matchAll(re)) {
    const t = m[0]
    const i = m.index ?? 0
    out += escapeHtml(code.slice(last, i))
    last = i + t.length
    const next = code.slice(last, last + 1)
    if (t.startsWith('<!--') || t.startsWith('//') || (hashComments && t.startsWith('#'))) out += span('c', t)
    else if (t[0] === '"' || t[0] === "'" || t[0] === '`') {
      // JSON keys read better in a separate colour.
      out += span(lang === 'json' && code.slice(last).match(/^\s*:/) ? 'p' : 's', t)
    } else if (/^<\/?[A-Za-z]/.test(t) && lang === 'html') {
      inTag = true
      out += span('t', t)
    } else if (t === '>' || t === '/>') {
      out += inTag ? span('t', t) : escapeHtml(t)
      inTag = false
    } else if (/^\d/.test(t)) out += span('n', t)
    else if (t.startsWith('-') && (lang === 'sh')) out += span('f', t)
    else if (t.startsWith('-')) out += escapeHtml(t)
    else if (kw.has(t)) out += span('k', t)
    else if (inTag && lang === 'html' && next === '=') out += span('a', t)
    else if (next === '(' && lang !== 'sh' && lang !== 'json') out += span('fn', t)
    else out += escapeHtml(t)
  }
  out += escapeHtml(code.slice(last))
  return out.replace(/••••/g, '<span class="t-mask">••••</span>')
}
