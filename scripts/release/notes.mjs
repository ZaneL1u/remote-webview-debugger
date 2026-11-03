// GitHub Release body for a tag: how to get this version, then the English
// and the Chinese changelog sections. No dependencies (runs in CI before npm ci).
//
//   node scripts/release/notes.mjs sdk-v0.2.0 > notes.md
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const tag = process.argv[2] || ''
const m = tag.match(/^(sdk|gateway)-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/)
if (!m) {
  console.error('usage: notes.mjs <sdk-vX.Y.Z|gateway-vX.Y.Z>')
  process.exit(1)
}
const [, id, version] = m
const changelog = { sdk: 'sdk/CHANGELOG', gateway: 'gateway/CHANGELOG' }[id]

function section(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const start = text.search(new RegExp(`^## v${version.replace(/\./g, '\\.')}( |$)`, 'm'))
  if (start < 0) throw new Error(`${file} has no section for v${version}`)
  const body = text.slice(text.indexOf('\n', start) + 1)
  const end = body.search(/^## /m)
  return (end < 0 ? body : body.slice(0, end)).trim()
}

const image = `ghcr.io/${(process.env.GITHUB_REPOSITORY || 'ZaneL1u/remote-webview-debugger').toLowerCase()}`
const install =
  id === 'sdk'
    ? [
        '```html',
        `<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@${version}/dist/sdk.js"></script>`,
        '<!-- or https://unpkg.com/remote-webview-debugger@' + version + '/dist/sdk.js -->',
        '```',
        '',
        '```sh',
        `npm install remote-webview-debugger@${version}`,
        '```',
      ]
    : ['```sh', `docker pull ${image}:${version}`, '```', '', 'Binaries / 二进制：`rwd_' + version + '_<linux|darwin>_<amd64|arm64>.tar.gz` (SHA-256 in `checksums.txt`).']

console.log(
  [...install, '', '## English', '', section(`${changelog}.md`), '', '## 简体中文', '', section(`${changelog}.zh-CN.md`), ''].join('\n'),
)
