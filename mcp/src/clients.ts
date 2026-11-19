// The agents `init` can set up, and how each one stores its MCP servers.
// Each writes the same stdio command (npx -y remote-webview-debugger-mcp@latest);
// gateways and keys stay in our own config file, not in theirs.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const PACKAGE = 'remote-webview-debugger-mcp'
export const DEFAULT_SERVER_NAME = 'remote-webview-debugger'
/** Seconds an agent should let one tool call run (the gateway's waits go up to 600 s). */
export const TOOL_TIMEOUT_SEC = 660

export interface Ctx {
  home: string
  env: Record<string, string | undefined>
  platform: NodeJS.Platform
  /** Runs a program; throws when it fails. */
  run: (cmd: string, args: string[]) => string
  /** Whether a program is on PATH. */
  has: (cmd: string) => boolean
}

export function defaultCtx(): Ctx {
  const platform = process.platform
  return {
    home: os.homedir(),
    env: process.env,
    platform,
    run: (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: platform === 'win32' }),
    has: (cmd) => {
      try {
        execFileSync(platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    },
  }
}

export interface Entry {
  /** The server's name in the agent's config. */
  name: string
  command: string
  args: string[]
  env: Record<string, string>
}

export function makeEntry(ctx: Ctx, name: string, env: Record<string, string> = {}): Entry {
  const npx = ['-y', `${PACKAGE}@latest`]
  // Most agents on Windows can't start npx (a .cmd) without a shell.
  if (ctx.platform === 'win32') return { name, command: 'cmd', args: ['/c', 'npx', ...npx], env }
  return { name, command: 'npx', args: npx, env }
}

export type Outcome = { status: 'added' | 'updated' | 'unchanged'; where: string } | { status: 'manual'; where: string; reason: string; snippet: string }

export interface Client {
  id: string
  label: string
  /** The name `npx skills add -a` uses for it, if it has skills. */
  skillsAgent?: string
  detect(ctx: Ctx): boolean
  configure(ctx: Ctx, e: Entry): Outcome
  /** What to paste by hand. */
  snippet(ctx: Ctx, e: Entry): string
}

// --- paths

function appData(ctx: Ctx): string {
  return ctx.env.APPDATA || path.join(ctx.home, 'AppData', 'Roaming')
}

function vscodeUser(ctx: Ctx): string {
  if (ctx.platform === 'darwin') return path.join(ctx.home, 'Library', 'Application Support', 'Code', 'User')
  if (ctx.platform === 'win32') return path.join(appData(ctx), 'Code', 'User')
  return path.join(ctx.env.XDG_CONFIG_HOME || path.join(ctx.home, '.config'), 'Code', 'User')
}

function claudeDesktopDir(ctx: Ctx): string {
  if (ctx.platform === 'darwin') return path.join(ctx.home, 'Library', 'Application Support', 'Claude')
  if (ctx.platform === 'win32') return path.join(appData(ctx), 'Claude')
  return path.join(ctx.env.XDG_CONFIG_HOME || path.join(ctx.home, '.config'), 'Claude')
}

const exists = (p: string) => fs.existsSync(p)

// --- JSON config files

function envPart(e: Entry): Record<string, unknown> {
  return Object.keys(e.env).length ? { env: e.env } : {}
}

/**
 * Sets obj[key][name] = value in a JSON file, keeping everything else. A file
 * that isn't plain JSON (comments, trailing commas) is left alone: the user
 * gets the snippet instead.
 */
export function upsertJson(file: string, key: string, name: string, value: unknown, snippet: string): Outcome {
  let data: Record<string, unknown> = {}
  let existed = false
  if (exists(file)) {
    existed = true
    const raw = fs.readFileSync(file, 'utf8')
    if (raw.trim()) {
      try {
        data = JSON.parse(raw)
      } catch {
        return { status: 'manual', where: file, reason: 'the file is not plain JSON (comments?), so it was not changed', snippet }
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { status: 'manual', where: file, reason: 'unexpected content', snippet }
    }
  }
  const section = (data[key] && typeof data[key] === 'object' ? data[key] : {}) as Record<string, unknown>
  const before = section[name]
  if (before !== undefined && JSON.stringify(before) === JSON.stringify(value)) return { status: 'unchanged', where: file }
  section[name] = value
  data[key] = section
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (existed) fs.copyFileSync(file, `${file}.bak`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
  return { status: before === undefined ? 'added' : 'updated', where: file }
}

function jsonClient(o: {
  id: string
  label: string
  skillsAgent?: string
  dir: (ctx: Ctx) => string
  file: (ctx: Ctx) => string
  key?: string
  value: (e: Entry) => Record<string, unknown>
}): Client {
  const key = o.key ?? 'mcpServers'
  const snippet = (_ctx: Ctx, e: Entry) => JSON.stringify({ [key]: { [e.name]: o.value(e) } }, null, 2)
  return {
    id: o.id,
    label: o.label,
    ...(o.skillsAgent ? { skillsAgent: o.skillsAgent } : {}),
    detect: (ctx) => exists(o.dir(ctx)),
    configure: (ctx, e) => upsertJson(o.file(ctx), key, e.name, o.value(e), snippet(ctx, e)),
    snippet,
  }
}

const stdio = (e: Entry) => ({ command: e.command, args: e.args, ...envPart(e) })

// --- Codex (TOML)

function tomlString(s: string): string {
  return JSON.stringify(s) // a JSON string is a valid TOML basic string
}

export function codexSection(e: Entry): string {
  const lines = [
    `[mcp_servers.${tomlKey(e.name)}]`,
    `command = ${tomlString(e.command)}`,
    `args = [${e.args.map(tomlString).join(', ')}]`,
    `startup_timeout_sec = 30`,
    `tool_timeout_sec = ${TOOL_TIMEOUT_SEC}`,
  ]
  if (Object.keys(e.env).length) lines.push(`env = { ${Object.entries(e.env).map(([k, v]) => `${tomlKey(k)} = ${tomlString(v)}`).join(', ')} }`)
  return lines.join('\n') + '\n'
}

function tomlKey(k: string): string {
  return /^[A-Za-z0-9_-]+$/.test(k) ? k : tomlString(k)
}

/** Replaces the [mcp_servers.<name>] table (and its sub-tables) or appends it. */
export function upsertCodexToml(text: string, e: Entry): string {
  const names = new Set([`mcp_servers.${e.name}`, `mcp_servers.${tomlString(e.name)}`, `mcp_servers.'${e.name}'`])
  const lines = text.split('\n')
  const out: string[] = []
  let skipping = false
  let at = -1
  for (const line of lines) {
    const h = /^\s*\[\s*([^\]]+?)\s*\]\s*(#.*)?$/.exec(line)
    if (h && !line.trim().startsWith('[[')) {
      const header = h[1]!.replace(/\s*\.\s*/g, '.')
      const ours = [...names].some((n) => header === n || header.startsWith(`${n}.`))
      if (ours) {
        if (at < 0) at = out.length
        skipping = true
        continue
      }
      skipping = false
    }
    if (!skipping) out.push(line)
  }
  const section = codexSection(e).trimEnd().split('\n')
  if (at >= 0) {
    out.splice(at, 0, ...section, '')
    return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n')
  }
  const body = out.join('\n').replace(/\n*$/, '')
  return (body ? `${body}\n\n` : '') + section.join('\n') + '\n'
}

const codex: Client = {
  id: 'codex',
  label: 'Codex',
  skillsAgent: 'codex',
  detect: (ctx) => exists(codexHome(ctx)) || ctx.has('codex'),
  configure: (ctx, e) => {
    const file = path.join(codexHome(ctx), 'config.toml')
    const old = exists(file) ? fs.readFileSync(file, 'utf8') : ''
    const next = upsertCodexToml(old, e)
    if (next === old) return { status: 'unchanged', where: file }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (old) fs.copyFileSync(file, `${file}.bak`)
    fs.writeFileSync(file, next)
    return { status: old.includes(`[mcp_servers.${tomlKey(e.name)}]`) ? 'updated' : 'added', where: file }
  },
  snippet: (_ctx, e) => codexSection(e),
}

function codexHome(ctx: Ctx): string {
  return ctx.env.CODEX_HOME || path.join(ctx.home, '.codex')
}

// --- Claude Code (its own CLI)

const claudeCode: Client = {
  id: 'claude-code',
  label: 'Claude Code',
  skillsAgent: 'claude-code',
  detect: (ctx) => ctx.has('claude') || exists(path.join(ctx.home, '.claude.json')),
  configure: (ctx, e) => {
    const args = claudeArgs(e)
    const snippet = `claude ${args.join(' ')}`
    if (!ctx.has('claude')) return { status: 'manual', where: 'claude mcp (user scope)', reason: 'the claude command is not on PATH', snippet }
    let had = false
    try {
      ctx.run('claude', ['mcp', 'get', e.name])
      had = true
    } catch {}
    try {
      if (had) ctx.run('claude', ['mcp', 'remove', '-s', 'user', e.name])
      ctx.run('claude', args)
    } catch (err) {
      return { status: 'manual', where: 'claude mcp (user scope)', reason: `claude mcp add failed: ${(err as Error).message.split('\n')[0]}`, snippet }
    }
    return { status: had ? 'updated' : 'added', where: 'claude mcp (user scope)' }
  },
  snippet: (_ctx, e) => `claude ${claudeArgs(e).join(' ')}`,
}

function claudeArgs(e: Entry): string[] {
  return ['mcp', 'add', '-s', 'user', ...Object.entries(e.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), e.name, '--', e.command, ...e.args]
}

// --- the list, in the order init shows it

export const CLIENTS: Client[] = [
  claudeCode,
  jsonClient({
    id: 'cursor',
    label: 'Cursor',
    skillsAgent: 'cursor',
    dir: (ctx) => path.join(ctx.home, '.cursor'),
    file: (ctx) => path.join(ctx.home, '.cursor', 'mcp.json'),
    value: stdio,
  }),
  codex,
  jsonClient({
    id: 'gemini',
    label: 'Gemini CLI',
    skillsAgent: 'gemini-cli',
    dir: (ctx) => path.join(ctx.home, '.gemini'),
    file: (ctx) => path.join(ctx.home, '.gemini', 'settings.json'),
    value: (e) => ({ ...stdio(e), timeout: TOOL_TIMEOUT_SEC * 1000 }),
  }),
  jsonClient({
    id: 'windsurf',
    label: 'Windsurf',
    skillsAgent: 'windsurf',
    dir: (ctx) => path.join(ctx.home, '.codeium', 'windsurf'),
    file: (ctx) => path.join(ctx.home, '.codeium', 'windsurf', 'mcp_config.json'),
    value: stdio,
  }),
  jsonClient({
    id: 'cline',
    label: 'Cline (VS Code)',
    skillsAgent: 'cline',
    dir: (ctx) => path.join(vscodeUser(ctx), 'globalStorage', 'saoudrizwan.claude-dev'),
    file: (ctx) => path.join(vscodeUser(ctx), 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    value: (e) => ({ ...stdio(e), disabled: false, timeout: TOOL_TIMEOUT_SEC }),
  }),
  jsonClient({
    id: 'vscode',
    label: 'VS Code (GitHub Copilot)',
    skillsAgent: 'github-copilot',
    dir: (ctx) => vscodeUser(ctx),
    file: (ctx) => path.join(vscodeUser(ctx), 'mcp.json'),
    key: 'servers',
    value: (e) => ({ type: 'stdio', ...stdio(e) }),
  }),
  jsonClient({
    id: 'opencode',
    label: 'opencode',
    skillsAgent: 'opencode',
    dir: (ctx) => path.join(ctx.env.XDG_CONFIG_HOME || path.join(ctx.home, '.config'), 'opencode'),
    file: (ctx) => path.join(ctx.env.XDG_CONFIG_HOME || path.join(ctx.home, '.config'), 'opencode', 'opencode.json'),
    key: 'mcp',
    value: (e) => ({ type: 'local', command: [e.command, ...e.args], enabled: true, ...(Object.keys(e.env).length ? { environment: e.env } : {}) }),
  }),
  jsonClient({
    id: 'claude-desktop',
    label: 'Claude Desktop',
    dir: claudeDesktopDir,
    file: (ctx) => path.join(claudeDesktopDir(ctx), 'claude_desktop_config.json'),
    value: stdio,
  }),
]

/**
 * The agent whose shell runs us, from the variables agents set for the
 * commands they run: 'claude-code', 'cursor', … or 'unknown' for an agent we
 * can tell is one but not which; undefined for a person's terminal. An agent
 * can't answer `init`'s questions, so `init` asks none there.
 */
export function agentShell(env: Record<string, string | undefined>): string | undefined {
  if (env.CLAUDECODE) return 'claude-code'
  if (env.CURSOR_AGENT) return 'cursor'
  if (env.GEMINI_CLI) return 'gemini'
  if (env.CODEX_SANDBOX || env.CODEX_SANDBOX_NETWORK_DISABLED || env.CODEX_THREAD_ID) return 'codex'
  if (env.OPENCODE) return 'opencode'
  return undefined
}

export function findClient(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id)
}
