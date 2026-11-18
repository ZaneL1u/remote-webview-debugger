// `init`: add gateways (address + API key, checked against the gateway),
// write them to our config file, register the MCP server with the agents on
// this machine, and install the skill. Every question has a flag, so it also
// runs unattended (`init --gateway prod=https://… --api-key-env RWD_KEY --clients cursor -y`).
import { spawnSync } from 'node:child_process'
import readline from 'node:readline'
import { Writable } from 'node:stream'
import { configPath, defaultConfigPath, mcpEndpoint, readConfigFile, validName, writeConfigFile, type ConfigFile, type FileGateway } from './config.ts'
import { CLIENTS, DEFAULT_SERVER_NAME, findClient, makeEntry, type Client, type Ctx, type Outcome } from './clients.ts'
import { Gateway } from './gateway.ts'

export const SKILL_SOURCE = 'zanel1u/remote-webview-debugger'
export const SKILL_NAME = 'remote-webview-debugger'

export interface InitOptions {
  config?: string
  gateways: { name?: string; url: string }[]
  apiKey?: string
  apiKeyEnv?: string
  /** Agent ids, 'all', 'detected' or 'none'. */
  clients?: string[]
  skill?: boolean
  yes: boolean
  verify: boolean
  serverName: string
}

export interface Io {
  ask(q: string, opts?: { secret?: boolean; def?: string }): Promise<string>
  log(s: string): void
  close(): void
  interactive: boolean
}

export function terminalIo(): Io {
  const interactive = !!process.stdin.isTTY
  let muted = false
  const out = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stderr.write(chunk)
      cb()
    },
  })
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: interactive })
  return {
    interactive,
    log: (s) => process.stderr.write(s + '\n'),
    ask: (q, opts = {}) =>
      new Promise((resolve) => {
        const prompt = opts.def ? `${q} [${opts.def}] ` : `${q} `
        process.stderr.write(prompt)
        muted = !!opts.secret
        rl.question('', (a) => {
          if (muted) process.stderr.write('\n')
          muted = false
          resolve(a.trim() || opts.def || '')
        })
      }),
    close: () => rl.close(),
  }
}

const yesNo = (a: string, def: boolean) => (a ? /^y(es)?$/i.test(a) || a === '是' : def)

export function nameFromUrl(url: string, taken: Set<string>): string {
  const host = new URL(url).hostname
  const parts = host.split('.')
  // rwd.example.com → example; localhost → localhost
  let base = (parts.length > 2 ? parts[parts.length - 2] : parts[0]) || 'gateway'
  base = base.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+/, '').slice(0, 24) || 'gateway'
  let name = base
  for (let i = 2; taken.has(name); i++) name = `${base}-${i}`
  return name
}

async function check(name: string, url: string, apiKey: string, version: string, fetchImpl?: typeof fetch): Promise<string> {
  const g = new Gateway({ name, url: mcpEndpoint(url), apiKey }, version, fetchImpl)
  try {
    await g.connect()
    return `${g.info?.name ?? 'gateway'} ${g.info?.version ?? ''}, ${g.tools.length} tools`.trim()
  } finally {
    await g.close()
  }
}

export async function runInit(o: InitOptions, io: Io, ctx: Ctx, version: string, fetchImpl?: typeof fetch): Promise<number> {
  const file = configPath(o.config, ctx.env)
  let cfg: ConfigFile
  try {
    cfg = readConfigFile(file)
  } catch (e) {
    io.log(`✗ ${(e as Error).message}`)
    return 1
  }
  io.log(`Remote WebView Debugger MCP ${version}`)
  io.log(`Config file: ${file}`)
  const existing = Object.entries(cfg.gateways)
  if (existing.length) {
    io.log('Gateways:')
    for (const [n, g] of existing) io.log(`  - ${n}: ${g.url}`)
  }

  // --- gateways
  const add = async (name: string | undefined, url: string, key: { apiKey?: string; apiKeyEnv?: string }) => {
    const endpoint = mcpEndpoint(url)
    const base = endpoint.replace(/\/v1\/mcp$/, '')
    const n = (name || nameFromUrl(endpoint, new Set(Object.keys(cfg.gateways)))).toLowerCase()
    if (!validName(n)) throw new Error(`gateway name "${n}": use lower-case letters, digits, - or _`)
    const apiKey = key.apiKeyEnv ? ctx.env[key.apiKeyEnv] : key.apiKey
    if (!apiKey) throw new Error(key.apiKeyEnv ? `${key.apiKeyEnv} is not set` : `gateway "${n}" needs an API key`)
    if (o.verify) {
      io.log(`Checking ${n} (${base}) …`)
      io.log(`✓ ${n}: ${await check(n, endpoint, apiKey, version, fetchImpl)}`)
    }
    const entry: FileGateway = key.apiKeyEnv ? { url: base, apiKeyEnv: key.apiKeyEnv } : { url: base, apiKey }
    cfg.gateways[n] = entry
    return n
  }

  try {
    if (o.gateways.length) {
      if (o.gateways.length > 1 && o.apiKey) throw new Error('--api-key applies to one gateway; for several, use --api-key-env per gateway name (RWD_API_KEY_<NAME>)')
      for (const g of o.gateways) {
        const envName = g.name ? `RWD_API_KEY_${g.name.toUpperCase().replace(/-/g, '_')}` : undefined
        const key = o.apiKeyEnv
          ? { apiKeyEnv: o.apiKeyEnv }
          : o.apiKey
            ? { apiKey: o.apiKey }
            : envName && ctx.env[envName]
              ? { apiKeyEnv: envName }
              : ctx.env.RWD_API_KEY
                ? { apiKey: ctx.env.RWD_API_KEY }
                : io.interactive
                  ? { apiKey: await io.ask(`API key for ${g.url}:`, { secret: true }) }
                  : {}
        await add(g.name, g.url, key)
      }
    } else if (io.interactive) {
      let more = existing.length === 0 || yesNo(await io.ask('Add a gateway? (y/N)'), false)
      while (more) {
        const url = await io.ask('Gateway address (e.g. https://rwd.example.com):')
        if (!url) break
        try {
          const suggested = nameFromUrl(mcpEndpoint(url), new Set(Object.keys(cfg.gateways)))
          const name = await io.ask('Name for this gateway:', { def: suggested })
          const apiKey = await io.ask('API key (console → API Key, rwd_sk_…):', { secret: true })
          await add(name, url, { apiKey })
        } catch (e) {
          io.log(`✗ ${(e as Error).message}`)
          if (!yesNo(await io.ask('Try again? (Y/n)'), true)) break
          continue
        }
        more = yesNo(await io.ask('Add another gateway? (y/N)'), false)
      }
    }
  } catch (e) {
    io.log(`✗ ${(e as Error).message}`)
    return 1
  }

  if (Object.keys(cfg.gateways).length === 0) {
    io.log('No gateway configured; nothing to do. Run init again with a gateway address and an API key.')
    return 1
  }
  writeConfigFile(file, cfg)
  io.log(`✓ Saved ${Object.keys(cfg.gateways).length} gateway(s) to ${file} (readable by you only)`)

  // --- agents
  const detected = CLIENTS.filter((c) => c.detect(ctx))
  let chosen: Client[]
  if (o.clients) chosen = pickClients(o.clients, detected)
  else if (o.yes || !io.interactive) chosen = detected
  else {
    io.log('\nAgents on this machine:')
    CLIENTS.forEach((c, i) => io.log(`  ${i + 1}. ${c.label}${detected.includes(c) ? '  (found)' : ''}`))
    const a = await io.ask('Add the MCP server to which? Numbers separated by commas, "all", or "none":', { def: detected.length ? detected.map((c) => CLIENTS.indexOf(c) + 1).join(',') : 'none' })
    chosen = a === 'none' ? [] : a === 'all' ? CLIENTS : a.split(/[,\s]+/).map((s) => CLIENTS[Number(s) - 1] ?? findClient(s)).filter((c): c is Client => !!c)
  }
  // An unusual config path has to reach the server.
  const env: Record<string, string> = file === defaultConfigPath(ctx.env, ctx.platform) ? {} : { RWD_CONFIG: file }
  const entry = makeEntry(ctx, o.serverName, env)
  for (const c of chosen) {
    let r: Outcome
    try {
      r = c.configure(ctx, entry)
    } catch (e) {
      r = { status: 'manual', where: c.label, reason: (e as Error).message, snippet: c.snippet(ctx, entry) }
    }
    if (r.status === 'manual') io.log(`! ${c.label}: ${r.reason} (${r.where}). Add this yourself:\n${indent(r.snippet)}`)
    else io.log(`✓ ${c.label}: ${r.status} — ${r.where}`)
  }
  if (chosen.length === 0) {
    const vars = Object.entries(entry.env).map(([k, v]) => ` (with ${k}=${v})`).join('')
    io.log(`\nNo agent changed. The MCP server to add: ${entry.command} ${entry.args.join(' ')}${vars}`)
  }

  // --- skill
  const agents = chosen.map((c) => c.skillsAgent).filter((a): a is string => !!a)
  const skill = o.skill ?? (o.yes || !io.interactive ? false : yesNo(await io.ask(`\nInstall the ${SKILL_NAME} skill too (npx skills add ${SKILL_SOURCE})? (Y/n)`), true))
  if (skill) {
    const args = ['-y', 'skills', 'add', SKILL_SOURCE, '--skill', SKILL_NAME, '-g', ...agents.flatMap((a) => ['-a', a]), ...(o.yes || agents.length ? ['-y'] : [])]
    io.log(`$ npx ${args.join(' ')}`)
    const r = spawnSync('npx', args, { stdio: 'inherit', shell: ctx.platform === 'win32' })
    if (r.status !== 0) io.log(`! The skill was not installed; run: npx ${args.join(' ')}`)
  }

  io.log(`\nDone. Restart your agent (or reload its MCP servers), then ask it: "list online devices".`)
  return 0
}

function pickClients(ids: string[], detected: Client[]): Client[] {
  const out = new Set<Client>()
  for (const id of ids) {
    if (id === 'none') continue
    if (id === 'all') CLIENTS.forEach((c) => out.add(c))
    else if (id === 'detected') detected.forEach((c) => out.add(c))
    else {
      const c = findClient(id)
      if (!c) throw new Error(`unknown agent "${id}"; one of: ${CLIENTS.map((c) => c.id).join(', ')}`)
      out.add(c)
    }
  }
  return [...out]
}

function indent(s: string): string {
  return s.replace(/^/gm, '    ')
}

export { DEFAULT_SERVER_NAME }
