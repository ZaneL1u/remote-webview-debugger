#!/usr/bin/env node
// Keeps the translated docs in step with the English ones (docs/translating.md).
//
//   node scripts/docs/i18n.mjs check [--strict]   what `make check` runs
//   node scripts/docs/i18n.mjs stamp <file>…      mark translations as synced with their English source
//
// Every English doc listed below has one file per language next to it (X.md → X.zh-CN.md, X.fr.md…).
// `check` fails when a translation is missing, its language switcher line is wrong, its headings, code
// blocks or tables no longer line up with the English file, or a relative link or #anchor is broken.
// It warns (fails with --strict) when the English file changed since a translation was stamped: each
// translation's first line records the git blob id of the English file it was translated from.
// No dependencies; Node 18+.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Switcher order. English is the source; every other language is a translation of it. */
export const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
]
const ALL = LANGS.map(l => l.code)

/** English docs and the languages each one has. Changelogs are generated (en + zh-CN) and not listed. */
export const DOCS = [
  { path: 'README.md', langs: ALL },
  { path: 'docs/architecture.md', langs: ALL },
  { path: 'docs/protocol.md', langs: ALL },
  { path: 'docs/native-integration.md', langs: ALL },
  { path: 'docs/releasing.md', langs: ALL },
  { path: 'docs/translating.md', langs: ['en', 'zh-CN'] },
  { path: 'sdk/README.md', langs: ALL },
  { path: 'gateway/README.md', langs: ALL },
  { path: 'deploy/platform/README.md', langs: ALL },
]

const RTL = new Set(['ar'])
const STAMP = /^<!-- i18n-source: ([0-9a-f]{40}) -->\n/

export function langFile(path, code) {
  return code === 'en' ? path : path.replace(/\.md$/, `.${code}.md`)
}

/** `English | [简体中文](X.zh-CN.md) | …` with the current language as plain text. */
export function switcher(doc, code) {
  const base = posix.basename(doc.path)
  return LANGS.filter(l => doc.langs.includes(l.code))
    .map(l => (l.code === code ? l.name : `[${l.name}](${langFile(base, l.code)})`))
    .join(' | ')
}

/** git hash-object, so `git diff <old> <new>` shows what changed in the English file. */
function blobId(text) {
  const buf = Buffer.from(text)
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
}

// --- Markdown, just enough of it -------------------------------------------------------------------

/** Lines outside fenced code blocks, plus the fences themselves. */
function scan(text) {
  const lines = text.split('\n')
  const prose = []
  const fences = []
  let fence = null
  lines.forEach((line, i) => {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !m[2].trim()) fence = null
      return
    }
    if (m) {
      fence = m[1]
      fences.push(m[2].trim())
      return
    }
    prose.push({ line, n: i + 1 })
  })
  return { prose, fences }
}

function stripInline(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
}

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to dashes, -1 / -2 for repeats. */
function anchors(prose) {
  const seen = new Map()
  const out = new Set()
  for (const { line } of prose) {
    const h = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/)
    const ids = [...line.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)].map(m => m[1])
    ids.forEach(id => out.add(id))
    if (!h) continue
    const base = stripInline(h[1])
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
      .replace(/ /g, '-')
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.add(n ? `${base}-${n}` : base)
  }
  return out
}

function structure(text) {
  const { prose, fences } = scan(text)
  return {
    headings: prose.flatMap(p => (p.line.match(/^(#{1,6})\s/) ? [p.line.match(/^#+/)[0].length] : [])),
    fences,
    tables: prose.filter(p => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(p.line) && p.line.includes('|')).length,
  }
}

function links(prose) {
  const out = []
  for (const { line, n } of prose) {
    const plain = line.replace(/`[^`]*`/g, '')
    for (const m of plain.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push({ target: m[1], n })
    for (const m of plain.matchAll(/\bhref="([^"]+)"/g)) out.push({ target: m[1], n })
  }
  return out.filter(l => !/^[a-z][a-z0-9+.-]*:/i.test(l.target))
}

// --- check -------------------------------------------------------------------------------------------

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function check(strict) {
  const errors = []
  const stale = []
  const cache = new Map()
  const parsed = rel => {
    if (!cache.has(rel)) cache.set(rel, scan(read(rel)))
    return cache.get(rel)
  }

  for (const doc of DOCS) {
    if (!existsSync(join(ROOT, doc.path))) {
      errors.push(`${doc.path}: missing (listed in scripts/docs/i18n.mjs)`)
      continue
    }
    const source = read(doc.path)
    const want = structure(source)
    const id = blobId(source)
    for (const code of doc.langs) {
      const rel = langFile(doc.path, code)
      if (!existsSync(join(ROOT, rel))) {
        errors.push(`${rel}: missing (translation of ${doc.path})`)
        continue
      }
      const text = read(rel)
      if (!text.split('\n').some(l => l.includes(switcher(doc, code))))
        errors.push(`${rel}: language switcher should read\n    ${switcher(doc, code)}`)
      if (code === 'en') continue

      const got = structure(text)
      const h = (a, b) => a.join('') === b.join('')
      if (!h(got.headings, want.headings))
        errors.push(`${rel}: headings ${fmt(got.headings)} differ from ${doc.path} ${fmt(want.headings)}`)
      if (got.fences.join('\n') !== want.fences.join('\n'))
        errors.push(`${rel}: code blocks [${got.fences}] differ from ${doc.path} [${want.fences}]`)
      if (got.tables !== want.tables) errors.push(`${rel}: ${got.tables} tables, ${doc.path} has ${want.tables}`)
      if (RTL.has(code) && !text.includes('<div dir="rtl">'))
        errors.push(`${rel}: wrap the text in <div dir="rtl"> so GitHub lays it out right to left`)

      const stamp = text.match(STAMP)
      if (!stamp) errors.push(`${rel}: first line must be <!-- i18n-source: … --> (run: stamp ${rel})`)
      else if (stamp[1] !== id) stale.push(`${rel}: ${doc.path} changed since it was translated (git diff ${stamp[1].slice(0, 12)} ${id.slice(0, 12)})`)
    }
  }

  // Relative links and anchors, in every language.
  for (const doc of DOCS) {
    for (const code of doc.langs) {
      const rel = langFile(doc.path, code)
      if (!existsSync(join(ROOT, rel))) continue
      for (const { target, n } of links(parsed(rel).prose)) {
        const [file, hash] = target.split('#')
        const dest = file ? posix.normalize(posix.join(posix.dirname(rel), decodeURI(file))) : rel
        if (!existsSync(join(ROOT, dest))) {
          errors.push(`${rel}:${n}: broken link ${target}`)
          continue
        }
        if (hash === undefined || !dest.endsWith('.md') || statSync(join(ROOT, dest)).isDirectory()) continue
        if (!anchors(parsed(dest).prose).has(decodeURIComponent(hash)))
          errors.push(`${rel}:${n}: no heading for #${hash} in ${dest}`)
      }
    }
  }

  for (const e of errors) console.error(`error: ${e}`)
  for (const s of stale) console.error(`${strict ? 'error' : 'warning'}: ${s}`)
  if (stale.length) console.error('Update those translations, then: node scripts/docs/i18n.mjs stamp <file>… (docs/translating.md)')
  const failed = errors.length || (strict && stale.length)
  const total = DOCS.reduce((n, d) => n + d.langs.length, 0)
  console.log(`docs i18n: ${total} files, ${errors.length} errors, ${stale.length} out of date`)
  return failed ? 1 : 0
}

function fmt(levels) {
  return levels.map(l => `h${l}`).join(',') || '(none)'
}

// --- stamp -------------------------------------------------------------------------------------------

function stamp(files) {
  if (!files.length) {
    console.error('usage: node scripts/docs/i18n.mjs stamp <translation.md>…')
    return 2
  }
  for (const f of files) {
    const rel = relative(ROOT, resolve(f)).split('\\').join('/')
    const doc = DOCS.find(d => d.langs.some(c => c !== 'en' && langFile(d.path, c) === rel))
    if (!doc) {
      console.error(`${rel}: not a translation listed in scripts/docs/i18n.mjs`)
      return 2
    }
    const line = `<!-- i18n-source: ${blobId(read(doc.path))} -->\n`
    const text = read(rel)
    writeFileSync(join(ROOT, rel), STAMP.test(text) ? text.replace(STAMP, line) : line + text)
    console.log(`${rel}: synced with ${doc.path}`)
  }
  return 0
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'check') process.exit(check(args.includes('--strict')))
else if (cmd === 'stamp') process.exit(stamp(args))
else {
  console.error('usage: node scripts/docs/i18n.mjs check [--strict] | stamp <file>…')
  process.exit(2)
}
