// Where the gateways come from: the config file that `init` writes, plus
// environment variables (which win for a gateway of the same name).
//
//   ~/.config/remote-webview-debugger/mcp.json  (RWD_CONFIG or --config elsewhere)
//   { "gateways": { "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_…" },
//                   "staging": { "url": "https://…", "apiKeyEnv": "RWD_KEY_STAGING" } } }
//
//   RWD_URL + RWD_API_KEY (+ RWD_NAME)          one gateway
//   RWD_GATEWAYS="prod=https://…,staging=https://…" + RWD_API_KEY_PROD, RWD_API_KEY_STAGING
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface GatewayConfig {
  name: string
  /** The gateway's MCP endpoint, …/v1/mcp. */
  url: string
  apiKey: string
}

export interface FileGateway {
  url: string
  apiKey?: string
  apiKeyEnv?: string
}

export interface ConfigFile {
  gateways: Record<string, FileGateway>
}

export interface LoadedConfig {
  file: string
  gateways: GatewayConfig[]
  /** Problems that leave a gateway out; reported by list_gateways and doctor. */
  problems: string[]
}

type Env = Record<string, string | undefined>

export function defaultConfigPath(env: Env = process.env, platform = process.platform): string {
  if (platform === 'win32' && env.APPDATA) return path.join(env.APPDATA, 'remote-webview-debugger', 'mcp.json')
  const base = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), '.config')
  return path.join(base, 'remote-webview-debugger', 'mcp.json')
}

export function configPath(explicit?: string, env: Env = process.env): string {
  return explicit || env.RWD_CONFIG || defaultConfigPath(env)
}

const NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/

export function validName(name: string): boolean {
  return NAME.test(name)
}

/**
 * The MCP endpoint for whatever the user pasted: the gateway's origin, its
 * /v1 base (what the SDK snippet uses) or the endpoint itself.
 */
export function mcpEndpoint(input: string): string {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    throw new Error(`not a URL: ${input}`)
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`not an http(s) URL: ${input}`)
  u.hash = ''
  u.search = ''
  let p = u.pathname.replace(/\/+$/, '')
  if (p.endsWith('/v1/mcp')) {
    // already the endpoint
  } else if (p.endsWith('/v1')) p += '/mcp'
  else p += '/v1/mcp'
  u.pathname = p
  return u.toString()
}

export function readConfigFile(file: string): ConfigFile {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { gateways: {} }
    throw e
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`)
  }
  const gateways = (data as ConfigFile | null)?.gateways
  if (!gateways || typeof gateways !== 'object' || Array.isArray(gateways)) throw new Error(`${file}: expected { "gateways": { "<name>": { "url": …, "apiKey": … } } }`)
  return { ...(data as object), gateways } as ConfigFile
}

export function writeConfigFile(file: string, cfg: ConfigFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  fs.renameSync(tmp, file)
  try {
    fs.chmodSync(file, 0o600)
  } catch {}
}

export function loadConfig(opts: { config?: string; env?: Env } = {}): LoadedConfig {
  const env = opts.env ?? process.env
  const file = configPath(opts.config, env)
  const problems: string[] = []
  const byName = new Map<string, GatewayConfig>()
  const add = (name: string, url: string, apiKey: string | undefined, where: string) => {
    if (!validName(name)) return problems.push(`${where}: gateway name "${name}" must be lower-case letters, digits, - or _`)
    let endpoint: string
    try {
      endpoint = mcpEndpoint(url)
    } catch (e) {
      return problems.push(`${where}: ${(e as Error).message}`)
    }
    if (!apiKey) return problems.push(`${where}: gateway "${name}" has no API key`)
    byName.set(name, { name, url: endpoint, apiKey })
  }

  let fileCfg: ConfigFile = { gateways: {} }
  try {
    fileCfg = readConfigFile(file)
  } catch (e) {
    problems.push((e as Error).message)
  }
  for (const [name, g] of Object.entries(fileCfg.gateways)) {
    if (!g || typeof g.url !== 'string') {
      problems.push(`${file}: gateway "${name}" has no url`)
      continue
    }
    const key = g.apiKeyEnv ? env[g.apiKeyEnv] : g.apiKey
    if (g.apiKeyEnv && !key) {
      problems.push(`${file}: gateway "${name}" reads its API key from ${g.apiKeyEnv}, which is not set`)
      continue
    }
    add(name, g.url, key, file)
  }

  if (env.RWD_GATEWAYS) {
    for (const item of env.RWD_GATEWAYS.split(/[,\s]+/).filter(Boolean)) {
      const at = item.indexOf('=')
      if (at <= 0) {
        problems.push(`RWD_GATEWAYS: expected name=url, got "${item}"`)
        continue
      }
      const name = item.slice(0, at).toLowerCase()
      const keyVar = `RWD_API_KEY_${name.toUpperCase().replace(/-/g, '_')}`
      add(name, item.slice(at + 1), env[keyVar], `RWD_GATEWAYS (key in ${keyVar})`)
    }
  }
  if (env.RWD_URL) add((env.RWD_NAME || 'default').toLowerCase(), env.RWD_URL, env.RWD_API_KEY, 'RWD_URL / RWD_API_KEY')

  return { file, gateways: [...byName.values()], problems }
}
