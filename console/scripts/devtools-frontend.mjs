// The Chrome DevTools frontend the console embeds (docs/protocol.md §17):
// the prebuilt `public/front_end` of the chii npm package, which is tuned for
// chobitsu, the CDP backend in our page SDK. Only that folder is used (not
// chii's server), so the tarball is fetched at a pinned version and checked
// against its registry integrity instead of installing chii's dependencies.
//
//   node scripts/devtools-frontend.mjs   prints the folder (downloads once)

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CHII_VERSION = '1.15.5'
const INTEGRITY = 'sha512-O8c5ddK9iz0jsPqzl1JgeNanh04+4e/sXOBhqRnsr4ip4zwk7iRrv4Ff5NAH2Ddh2h3UwCI5GLt5mAbA0mY57Q=='

const root = fileURLToPath(new URL('..', import.meta.url))
const cache = join(root, 'node_modules', '.cache', 'rwd-devtools', CHII_VERSION)
export const FRONTEND_DIR = join(cache, 'front_end')

export async function ensureDevtoolsFrontend() {
  if (existsSync(join(FRONTEND_DIR, 'chii_app.html'))) return FRONTEND_DIR
  const registry = (process.env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/+$/, '')
  const url = `${registry}/chii/-/chii-${CHII_VERSION}.tgz`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DevTools frontend: GET ${url} → ${res.status}`)
  const tgz = Buffer.from(await res.arrayBuffer())
  const digest = 'sha512-' + createHash('sha512').update(tgz).digest('base64')
  if (digest !== INTEGRITY) throw new Error(`DevTools frontend: integrity mismatch for ${url}`)

  // Next to the cache, so the final rename stays on one filesystem.
  mkdirSync(cache, { recursive: true })
  const work = mkdtempSync(join(cache, '..', `.tmp-${CHII_VERSION}-`))
  try {
    writeFileSync(join(work, 'chii.tgz'), tgz)
    execFileSync('tar', ['-xzf', join(work, 'chii.tgz'), '-C', work, 'package/public/front_end'])
    rmSync(FRONTEND_DIR, { recursive: true, force: true })
    renameSync(join(work, 'package', 'public', 'front_end'), FRONTEND_DIR)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  return FRONTEND_DIR
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(await ensureDevtoolsFrontend())
}
