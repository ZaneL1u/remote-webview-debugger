// dist/locales/<id>.js: each on-demand language pack for the <script> build,
// a small IIFE that registers itself with window.RemoteWebviewDebugger (or
// queues in window.__RWD_LOCALES__ when it loads before sdk.js). Plus
// dist/locales/<id>.d.ts for `import ja from 'remote-webview-debugger/locales/ja'`
// (the .mjs files come from `vite build --mode esm`).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'rolldown'

const here = p => fileURLToPath(new URL(p, import.meta.url))
const pkg = JSON.parse(readFileSync(here('../package.json'), 'utf8'))
const LOCALES = ['zh-TW', 'fr', 'es', 'ru', 'ar', 'ja', 'ko', 'de', 'pt']
// A pack is data: anything bigger pulled in SDK code by a non-type import.
const MAX_BYTES = 40_000

mkdirSync(here('../dist/locales'), { recursive: true })
for (const id of LOCALES) {
  const source = here(`../src/locales/${id}.ts`)
  const entry = '\0rwd-locale-entry'
  await build({
    input: entry,
    plugins: [
      {
        name: 'rwd-locale-entry',
        resolveId: s => (s === entry ? entry : null),
        load: s =>
          s === entry
            ? `import pack from ${JSON.stringify(source)}
var w = typeof window !== 'undefined' ? window : {}
var R = w.RemoteWebviewDebugger
if (R && R.registerLocale) R.registerLocale(pack)
else (w.__RWD_LOCALES__ = w.__RWD_LOCALES__ || []).push(pack)`
            : null,
      },
    ],
    output: {
      file: here(`../dist/locales/${id}.js`),
      format: 'iife',
      minify: true,
      banner: `/*! remote-webview-debugger sdk v${pkg.version} | locale ${id} */`,
    },
    logLevel: 'warn',
  })
  const size = readFileSync(here(`../dist/locales/${id}.js`)).length
  if (size > MAX_BYTES) throw new Error(`dist/locales/${id}.js is ${size} bytes: does src/locales/${id}.ts import more than types?`)
  writeFileSync(
    here(`../dist/locales/${id}.d.ts`),
    `import type { Locale } from '../index.js'\n\ndeclare const pack: Locale\nexport default pack\n`
  )
}
