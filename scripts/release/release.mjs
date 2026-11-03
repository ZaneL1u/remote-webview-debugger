// Cut a release of one component: bump its version, prepend the new section
// to its English and Chinese changelogs, commit and tag. Nothing is pushed.
//
//   node scripts/release/release.mjs <sdk|gateway> [--major|--minor|--patch|--version X.Y.Z] [--dry-run] [--edit]
//   (or: make release-sdk ARGS="--dry-run")
//
// The SDK and the gateway are versioned apart: tags sdk-vX.Y.Z and
// gateway-vX.Y.Z, and each changelog lists only the conventional commits that
// touched that component's paths since its previous tag. The version bump
// follows those commits (breaking: major, feat: minor, other listed types:
// patch; below 1.0 a breaking change bumps the minor). The first release of a
// component keeps the version it has (0.1.0).
//
// The Chinese changelog has Chinese headings; an entry uses the commit's
// `Changelog-Zh:` trailer when there is one, else the English subject.
// --edit opens both changelogs in $EDITOR before the commit, to touch them up.
// Pushing the tag (git push origin main <tag>) starts .github/workflows/release.yml.
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { determineSemverChange, formatReference, getGitDiff, loadChangelogConfig, parseCommits } from 'changelogen'

const root = path.resolve(import.meta.dirname, '../..')

const COMPONENTS = {
  sdk: {
    name: 'page SDK',
    nameZh: '页面 SDK',
    paths: ['sdk', 'packages/chobitsu'],
    changelog: 'sdk/CHANGELOG',
    intro: 'The page SDK, published to npm as [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger). Tags: `sdk-vX.Y.Z`.',
    introZh: '页面 SDK，npm 包名 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)。tag 形如 `sdk-vX.Y.Z`。',
    // Docs whose CDN / npm examples pin the SDK version, with their translations (X.<lang>.md).
    docs: ['README.md', 'sdk/README.md', 'docs/native-integration.md'],
  },
  gateway: {
    name: 'gateway',
    nameZh: '网关',
    // The binary embeds the console; deploy/ is how it ships.
    paths: ['gateway', 'console', 'deploy'],
    changelog: 'gateway/CHANGELOG',
    intro: 'The gateway (`rwd` binary and Docker image, with the console and the page SDK embedded). Tags: `gateway-vX.Y.Z`.',
    introZh: '网关（`rwd` 二进制和 Docker 镜像，内嵌控制台和页面 SDK）。tag 形如 `gateway-vX.Y.Z`。',
    docs: [],
  },
}

// Commit types that make it into a changelog, and how far each bumps.
const TYPES = {
  feat: { title: '🚀 Enhancements', zh: '🚀 新功能', semver: 'minor' },
  perf: { title: '🔥 Performance', zh: '🔥 性能', semver: 'patch' },
  fix: { title: '🩹 Fixes', zh: '🩹 修复', semver: 'patch' },
  refactor: { title: '💅 Refactors', zh: '💅 重构', semver: 'patch' },
  deploy: { title: '🚢 Deployment', zh: '🚢 部署', semver: 'patch' },
  build: { title: '📦 Build', zh: '📦 构建', semver: 'patch' },
  docs: { title: '📖 Documentation', zh: '📖 文档', semver: 'patch' },
}
const FIRST_VERSION = '0.1.0'

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const die = (msg) => {
  console.error(`release: ${msg}`)
  process.exit(1)
}

// --- arguments
const args = process.argv.slice(2)
const id = args.shift()
const comp = COMPONENTS[id]
if (!comp) die(`usage: release.mjs <${Object.keys(COMPONENTS).join('|')}> [--major|--minor|--patch|--version X.Y.Z] [--dry-run] [--edit]`)
const opts = { dryRun: false, edit: false, bump: null, version: null }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--dry-run') opts.dryRun = true
  else if (a === '--edit') opts.edit = true
  else if (a === '--major' || a === '--minor' || a === '--patch') opts.bump = a.slice(2)
  else if (a === '--version') opts.version = args[++i]
  else if (a.startsWith('--version=')) opts.version = a.slice('--version='.length)
  else die(`unknown option ${a}`)
}
if (opts.version && !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(opts.version)) die(`not a version: ${opts.version}`)

// --- where we are
const prefix = `${id}-v`
let lastTag = ''
try {
  lastTag = git('describe', '--tags', '--abbrev=0', '--match', `${prefix}*`)
} catch {}
const current = lastTag ? lastTag.slice(prefix.length) : null
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD'

// Conventional commits since the last tag that touched this component.
const touched = git('log', '--format=%H', range, '--', ...comp.paths).split('\n').filter(Boolean)
// (`from` only so that changelogen doesn't look for a tag of its own.)
const config = await loadChangelogConfig(root, { from: lastTag || git('rev-list', '--max-parents=0', 'HEAD'), to: 'HEAD' })
// Links point at GitHub even from a clone whose origin is elsewhere.
if (!config.repo?.repo) config.repo = { provider: 'github', domain: 'github.com', repo: 'ZaneL1u/remote-webview-debugger' }
config.types = Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, { title: t.title, semver: t.semver }]))
const commits = parseCommits(await getGitDiff(lastTag || undefined, 'HEAD', root), config)
  .filter((c) => touched.some((h) => h.startsWith(c.shortHash)))
  .filter((c) => !(c.type === 'chore' && c.scope === 'release'))
  .map((c) => ({ ...c, scope: c.scope === id ? '' : c.scope }))
const listed = commits.filter((c) => c.type in TYPES)
if (current && listed.length === 0 && !opts.version && !opts.bump) die(`nothing to release: no listed commits under ${comp.paths.join(', ')} since ${lastTag}`)

// --- next version
function bump(v, type) {
  const [major, minor, patch] = v.split('-')[0].split('.').map(Number)
  if (type === 'major' && major === 0) type = 'minor'
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}
const version =
  opts.version ||
  (current ? bump(current, opts.bump || determineSemverChange(listed, config) || 'patch') : opts.bump ? bump(FIRST_VERSION, opts.bump) : FIRST_VERSION)
const tag = `${prefix}${version}`
if (git('tag', '--list', tag)) die(`tag ${tag} already exists`)

// --- changelog sections
const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD
const repoUrl = `https://${config.repo.domain}/${config.repo.repo}`

function entry(c, zh) {
  const text = (zh && c.body.match(/^Changelog-Zh:[ \t]*(.+)$/im)?.[1].trim()) || c.description
  const refs = c.references.filter((r) => r.type !== 'hash')
  const links = (refs.length ? refs : c.references.slice(0, 1)).map((r) => formatReference(r, config.repo))
  return `- ${c.scope ? `**${c.scope}:** ` : ''}${c.isBreaking ? '⚠️ ' : ''}${text}${links.length ? ` (${links.join(', ')})` : ''}`
}

function section(lang) {
  const zh = lang === 'zh'
  const out = [`## v${version} (${today})`, '']
  if (lastTag) out.push(`[${zh ? '对比变更' : 'compare changes'}](${repoUrl}/compare/${lastTag}...${tag})`, '')
  if (!current) out.push(zh ? '首个版本。' : 'First release.', '')
  if (id === 'gateway') out.push(embeddedSdk(zh), '')
  const breaking = []
  for (const [type, t] of Object.entries(TYPES)) {
    const group = listed.filter((c) => c.type === type).reverse() // oldest first
    if (group.length === 0) continue
    out.push(`### ${zh ? t.zh : t.title}`, '')
    for (const c of group) {
      const line = entry(c, zh)
      out.push(line)
      if (c.isBreaking) breaking.push(line)
    }
    out.push('')
  }
  if (breaking.length) out.push(`#### ⚠️ ${zh ? '不兼容变更' : 'Breaking changes'}`, '', ...breaking, '')
  return out.join('\n')
}

// Which SDK the gateway binary of this commit embeds.
function embeddedSdk(zh) {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'sdk/package.json'), 'utf8')).version
  let ahead = true
  try {
    ahead = git('rev-list', '--count', `sdk-v${v}..HEAD`, '--', ...COMPONENTS.sdk.paths) !== '0'
  } catch {}
  const note = ahead ? (zh ? '（含未发版的改动）' : ' (plus unreleased changes)') : ''
  return zh ? `> 内嵌页面 SDK：v${v}${note}` : `> Embedded page SDK: v${v}${note}`
}

const sections = { en: section('en'), zh: section('zh') }
console.log(`${tag}  (${current ? `from ${lastTag}` : 'first release'}, ${listed.length} listed of ${commits.length} commits)\n`)
console.log(sections.en)
console.log(sections.zh)
if (opts.dryRun) process.exit(0)

// --- write, commit, tag
if (git('status', '--porcelain')) die('the working tree is not clean; commit or stash first')
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== 'main') console.warn(`release: warning: releasing from ${branch}, not main`)

function prepend(file, header, body) {
  const p = path.join(root, file)
  const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : header
  const at = old.indexOf('\n## ')
  const next = at < 0 ? `${old.trimEnd()}\n\n${body}` : `${old.slice(0, at + 1)}${body}\n${old.slice(at + 1)}`
  fs.writeFileSync(p, next)
  return file
}
const base = path.basename(comp.changelog)
const changed = [
  prepend(`${comp.changelog}.md`, `English | [简体中文](${base}.zh-CN.md)\n\n# Changelog\n\n${comp.intro}\n`, sections.en),
  prepend(`${comp.changelog}.zh-CN.md`, `[English](${base}.md) | 简体中文\n\n# 更新日志\n\n${comp.introZh}\n`, sections.zh),
]

if (id === 'sdk') {
  execFileSync('npm', ['version', version, '--no-git-tag-version', '--allow-same-version'], { cwd: path.join(root, 'sdk'), stdio: 'ignore' })
  changed.push('sdk/package.json', 'sdk/package-lock.json')
  // A translation records the git blob id of the English file it was translated from
  // (scripts/docs/i18n.mjs); one that was in step before the bump is stamped again after it.
  const blobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
  const restamp = []
  for (const doc of comp.docs) {
    const dir = path.dirname(doc)
    const base = path.basename(doc, '.md')
    const translations = fs.readdirSync(path.join(root, dir))
      .filter((f) => f.startsWith(`${base}.`) && f.endsWith('.md') && f !== `${base}.md`)
      .map((f) => path.join(dir, f))
    const source = blobId(fs.readFileSync(path.join(root, doc)))
    for (const file of [doc, ...translations]) {
      const p = path.join(root, file)
      const s = fs.readFileSync(p, 'utf8')
      const t = s.replace(/(remote-webview-debugger@)\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?/g, `$1${version}`)
      if (t === s) continue
      fs.writeFileSync(p, t)
      changed.push(file)
      if (file !== doc && s.startsWith(`<!-- i18n-source: ${source} -->\n`)) restamp.push(file)
    }
  }
  if (restamp.length) execFileSync('node', ['scripts/docs/i18n.mjs', 'stamp', ...restamp], { cwd: root, stdio: 'ignore' })
}

if (opts.edit) {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vi'
  const r = spawnSync(`${editor} ${changed.slice(0, 2).map((f) => JSON.stringify(path.join(root, f))).join(' ')}`, { stdio: 'inherit', shell: true })
  if (r.status !== 0) die(`${editor} exited with ${r.status}; nothing committed (git checkout -- . to undo)`)
}

git('add', '--', ...changed)
git('commit', '-m', `chore(release): ${tag}`)
git('tag', '-a', tag, '-m', tag)
console.log(`\nCommitted and tagged ${tag}. To publish:\n\n  git push origin ${branch} ${tag}\n`)
