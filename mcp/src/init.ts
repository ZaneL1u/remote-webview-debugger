// `init`: add gateways (address + API key, checked against the gateway),
// write them to our config file, register the MCP server with the agents on
// this machine, and install the skill. Every question has a flag, so it also
// runs unattended (`init --gateway prod=https://… --api-key-env RWD_KEY --clients cursor -y`).
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import readline from 'node:readline'
import { Writable } from 'node:stream'
import { configPath, defaultConfigPath, mcpEndpoint, readConfigFile, validName, writeConfigFile, type ConfigFile, type FileGateway } from './config.ts'
import { CLIENTS, DEFAULT_SERVER_NAME, findClient, makeEntry, type Client, type Ctx, type Outcome } from './clients.ts'
import { Gateway, GatewayError } from './gateway.ts'
import { langFromEnv, MESSAGES, type Lang, type Messages } from './i18n.ts'
import { box, Cancelled, colorWanted, makeStyle, pad, plainStyle, Terminal, width, type ChoiceItem, type Style } from './tui.ts'

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
  /** The language to talk in; default: from the environment, else English. */
  lang?: Lang
}

export interface Io {
  ask(q: string, opts?: { secret?: boolean; def?: string; hint?: string }): Promise<string>
  log(s: string): void
  close(): void
  interactive: boolean
  /** Colours; plain when absent. */
  style?: Style
  /** Yes/no on one key. Without it, `ask` and a typed answer. */
  confirm?(q: string, def: boolean, labels: { yes: string; no: string }): Promise<boolean>
  /** A checkbox list. Without it, `ask` and typed numbers. */
  choose?(q: string, help: string, items: ChoiceItem[], selected: Set<number>, summary: (picked: number[]) => string): Promise<number[]>
  /** Runs `fn` behind a spinner. */
  spin?<T>(label: string, fn: () => Promise<T>): Promise<T>
}

export function terminalIo(env: Record<string, string | undefined> = process.env): Io {
  const interactive = !!process.stdin.isTTY
  const style = colorWanted(process.stderr, env) ? makeStyle(true, /truecolor|24bit/i.test(env.COLORTERM ?? '')) : plainStyle
  const log = (s: string) => process.stderr.write(s + '\n')
  const term = new Terminal(style)
  if (interactive && term.canRaw) {
    return {
      interactive,
      style,
      log,
      ask: (q, o = {}) => term.text(q, o),
      confirm: (q, def, labels) => term.confirm(q, def, labels),
      choose: (q, help, items, selected, summary) => term.multiSelect(q, help, items, selected, summary),
      spin: (label, fn) => term.spin(label, fn),
      close: () => {},
    }
  }
  // Piped input, or a terminal without raw mode: plain line questions.
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
    style,
    log,
    ask: (q, opts = {}) =>
      new Promise((resolve) => {
        const prompt = `${q}${opts.hint ? ` (${opts.hint})` : ''}${opts.def ? ` [${opts.def}]` : ''} `
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

// A typed yes in any of our languages (y, yes, 是, はい, sí, oui, ja, sim, да, نعم …).
const YES = /^(y|yes|是|是的|好|对|對|はい|예|네|s|si|sí|sim|oui|j|ja|д|да|ن|نعم)$/i
const NO = /^(n|no|否|不|不要|いいえ|아니요|non|nein|não|nao|нет|н|لا)$/i
export const yesNo = (a: string, def: boolean) => (YES.test(a.trim()) ? true : NO.test(a.trim()) ? false : def)

export function nameFromUrl(url: string, taken: Set<string>): string {
  const host = new URL(url).hostname
  // An IP address has no name in it.
  if (/^[\d.]+$|:/.test(host)) return nameFromUrl('http://gateway', taken)
  const parts = host.split('.')
  // rwd.example.com → example; localhost → localhost
  let base = (parts.length > 2 ? parts[parts.length - 2] : parts[0]) || 'gateway'
  base = base.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+/, '').slice(0, 24) || 'gateway'
  let name = base
  for (let i = 2; taken.has(name); i++) name = `${base}-${i}`
  return name
}

/**
 * What someone typed at "which agents?": numbers with any separators
 * (1,2,9 · 1 2 9 · 1.2.9 · 1、2), ranges (1-3), ids or names (cursor,
 * claude-code), "all" or "none". Returns the picks and what wasn't understood.
 */
export function parseSelection(input: string, clients: Client[]): { picked: Client[]; unknown: string[] } {
  const picked = new Set<Client>()
  const unknown: string[] = []
  const tokens = input.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean)
  for (const t of tokens) {
    if (t === 'none') continue
    if (t === 'all') {
      clients.forEach((c) => picked.add(c))
      continue
    }
    const range = /^(\d+)-(\d+)$/.exec(t)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y) as [number, number]
      if (a >= 1 && b <= clients.length) {
        for (let i = a; i <= b; i++) picked.add(clients[i - 1]!)
        continue
      }
    }
    const byNumber = /^\d+$/.test(t) ? clients[Number(t) - 1] : undefined
    const c = byNumber ?? clients.find((c) => c.id === t || c.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') === t)
    if (c) picked.add(c)
    else unknown.push(t)
  }
  return { picked: clients.filter((c) => picked.has(c)), unknown }
}

async function check(name: string, url: string, apiKey: string, version: string, fetchImpl?: typeof fetch): Promise<string> {
  const g = new Gateway({ name, url: mcpEndpoint(url), apiKey }, version, fetchImpl)
  try {
    await g.connect()
    return `${g.info?.name ?? 'gateway'} ${g.info?.version ?? ''}`.trim() + `\u0000${g.tools.length}`
  } finally {
    await g.close()
  }
}

/** A failure in the person's language where we know what it is. */
function explain(e: unknown, t: Messages, name: string, url: string): string {
  if (e instanceof GatewayError) {
    const g = `${name} (${new URL(url).host})`
    if (e.kind === 'auth') return t.errAuth(g)
    if (e.kind === 'no_endpoint') return t.errNoEndpoint(g, mcpEndpoint(url))
    if (e.kind === 'unreachable') return t.errUnreachable(g, e.code ?? '?')
    if (e.kind === 'rate') return t.errRate(g)
  }
  return (e as Error).message
}

export async function runInit(o: InitOptions, io: Io, ctx: Ctx, version: string, fetchImpl?: typeof fetch): Promise<number> {
  const t = MESSAGES[o.lang ?? langFromEnv(ctx.env) ?? 'en']
  const s = io.style ?? plainStyle
  const tilde = (p: string) => (ctx.home && (p === ctx.home || p.startsWith(ctx.home + path.sep)) ? '~' + p.slice(ctx.home.length) : p)
  const ok = (msg: string) => io.log(`  ${s.green('✔')} ${msg}`)
  const warn = (msg: string) => io.log(`  ${s.yellow('!')} ${msg}`)
  const fail = (msg: string) => io.log(`  ${s.red('✖')} ${msg}`)
  const step = (n: number, title: string) => io.log(`\n${s.brand(s.bold(`${'①②③'[n - 1]} ${title}`))}`)
  const confirm = async (q: string, def: boolean) =>
    io.confirm ? io.confirm(q, def, { yes: t.yes, no: t.no }) : yesNo(await io.ask(`${q} ${def ? '(Y/n)' : '(y/N)'}`), def)

  const file = configPath(o.config, ctx.env)
  let cfg: ConfigFile
  try {
    cfg = readConfigFile(file)
  } catch (e) {
    fail((e as Error).message)
    return 1
  }
  io.log(`${s.brand('◆')} ${s.bold('Remote WebView Debugger')} ${s.dim(`MCP ${version}`)}`)
  io.log(`  ${s.dim(t.configFile)}  ${tilde(file)}`)
  const existing = Object.entries(cfg.gateways)
  if (existing.length) {
    io.log(`  ${s.dim(t.gateways)}`)
    const w = Math.max(...existing.map(([n]) => width(n)))
    for (const [n, g] of existing) io.log(`    ${s.cyan(pad(n, w))}  ${g.url}`)
  }

  try {
    // --- gateways
    step(1, t.stepGateways)
    const add = async (name: string | undefined, url: string, key: { apiKey?: string; apiKeyEnv?: string }) => {
      const endpoint = mcpEndpoint(url)
      const base = endpoint.replace(/\/v1\/mcp$/, '')
      const n = (name || nameFromUrl(endpoint, new Set(Object.keys(cfg.gateways)))).toLowerCase()
      if (!validName(n)) throw new Error(t.errBadName(n))
      const apiKey = key.apiKeyEnv ? ctx.env[key.apiKeyEnv] : key.apiKey
      // With --api-key-env and --no-verify only the variable's name is saved, so it may be set later (in the agent's env).
      if (!apiKey && !(key.apiKeyEnv && !o.verify)) throw new Error(key.apiKeyEnv ? t.errEnvNotSet(key.apiKeyEnv) : t.errNeedKey(n))
      if (o.verify && apiKey) {
        const label = t.checking(n, base)
        let info: string
        try {
          info = await (io.spin ? io.spin(label, () => check(n, endpoint, apiKey, version, fetchImpl)) : check(n, endpoint, apiKey, version, fetchImpl))
        } catch (e) {
          throw new Error(explain(e, t, n, base))
        }
        const [server, tools] = info.split('\u0000')
        ok(`${s.bold(n)}  ${server} ${s.dim('·')} ${t.tools(Number(tools))}`)
      }
      const entry: FileGateway = key.apiKeyEnv ? { url: base, apiKeyEnv: key.apiKeyEnv } : { url: base, apiKey: apiKey as string }
      cfg.gateways[n] = entry
      return n
    }

    if (o.gateways.length) {
      if (o.gateways.length > 1 && o.apiKey) throw new Error(t.errOneKey)
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
                  ? { apiKey: await io.ask(t.apiKeyFor(g.url), { secret: true, hint: t.apiKeyHint }) }
                  : {}
        await add(g.name, g.url, key)
      }
    } else if (io.interactive) {
      let more = existing.length === 0 || (await confirm(t.addGateway, false))
      while (more) {
        const url = await io.ask(t.gatewayAddress, { hint: t.gatewayAddressHint })
        if (!url) break
        try {
          const suggested = nameFromUrl(mcpEndpoint(url), new Set(Object.keys(cfg.gateways)))
          const name = await io.ask(t.gatewayName, { def: suggested })
          const apiKey = await io.ask(t.apiKey, { secret: true, hint: t.apiKeyHint })
          await add(name, url, { apiKey })
        } catch (e) {
          if (e instanceof Cancelled) throw e
          fail((e as Error).message)
          if (!(await confirm(t.tryAgain, true))) break
          continue
        }
        more = await confirm(t.addAnother, false)
      }
    }

    if (Object.keys(cfg.gateways).length === 0) {
      fail(t.noGateway)
      return 1
    }
    writeConfigFile(file, cfg)
    ok(t.saved(Object.keys(cfg.gateways).length, tilde(file)))

    // --- agents
    step(2, t.stepAgents)
    const detected = CLIENTS.filter((c) => c.detect(ctx))
    let chosen: Client[]
    if (o.clients) chosen = pickClients(o.clients, detected, t)
    else if (o.yes || !io.interactive) chosen = detected
    else if (io.choose) {
      const picked = await io.choose(
        t.pickAgents,
        t.pickKeys,
        CLIENTS.map((c) => (detected.includes(c) ? { label: c.label, note: t.found } : { label: c.label })),
        new Set(detected.map((c) => CLIENTS.indexOf(c))),
        (p) => (p.length ? p.map((i) => CLIENTS[i]!.label).join(', ') : t.noneChosen),
      )
      chosen = picked.map((i) => CLIENTS[i]!)
    } else {
      io.log(`  ${s.bold(t.pickAgents)}`)
      const numW = String(CLIENTS.length).length
      const labelW = Math.max(...CLIENTS.map((c) => width(c.label)))
      CLIENTS.forEach((c, i) => io.log(`    ${s.dim(String(i + 1).padStart(numW))}  ${pad(c.label, labelW)}  ${detected.includes(c) ? s.green(t.found) : ''}`.trimEnd()))
      const def = detected.length ? detected.map((c) => CLIENTS.indexOf(c) + 1).join(',') : 'none'
      for (;;) {
        const r = parseSelection(await io.ask(t.pickNumbers, { def }), CLIENTS)
        if (r.unknown.length === 0) {
          chosen = r.picked
          break
        }
        warn(t.notRecognized(r.unknown.join(', ')))
      }
    }
    // An unusual config path has to reach the server.
    const env: Record<string, string> = file === defaultConfigPath(ctx.env, ctx.platform) ? {} : { RWD_CONFIG: file }
    const entry = makeEntry(ctx, o.serverName, env)
    const labelW = Math.max(0, ...chosen.map((c) => width(c.label)))
    for (const c of chosen) {
      let r: Outcome
      try {
        r = c.configure(ctx, entry)
      } catch (e) {
        r = { status: 'manual', where: c.label, reason: (e as Error).message, snippet: c.snippet(ctx, entry) }
      }
      if (r.status === 'manual') {
        warn(`${pad(c.label, labelW)}  ${s.yellow(t.manual)} ${s.dim(`(${r.reason}; ${tilde(r.where)})`)}`)
        io.log(s.dim(indent(r.snippet, 6)))
      } else {
        const word = r.status === 'added' ? t.added : r.status === 'updated' ? t.updated : t.unchanged
        ok(`${pad(c.label, labelW)}  ${pad(word, Math.max(...[t.added, t.updated, t.unchanged].map(width)))}  ${s.dim(tilde(r.where))}`)
      }
    }
    if (chosen.length === 0) {
      const vars = Object.entries(entry.env).map(([k, v]) => ` (${k}=${v})`).join('')
      warn(`${t.noAgent} ${s.cyan(`${entry.command} ${entry.args.join(' ')}`)}${vars}`)
    }

    // --- skill
    const agents = chosen.map((c) => c.skillsAgent).filter((a): a is string => !!a)
    const ask = o.skill === undefined && !o.yes && io.interactive
    if (ask || o.skill) step(3, t.stepSkill)
    const skill = o.skill ?? (ask ? await confirm(t.installSkill(SKILL_NAME), true) : false)
    if (skill) {
      const args = ['-y', 'skills', 'add', SKILL_SOURCE, '--skill', SKILL_NAME, '-g', ...agents.flatMap((a) => ['-a', a]), ...(o.yes || agents.length ? ['-y'] : [])]
      io.log(s.dim(`  $ npx ${args.join(' ')}`))
      const r = spawnSync('npx', args, { stdio: 'inherit', shell: ctx.platform === 'win32' })
      if (r.status !== 0) warn(`${t.skillFailed} ${s.cyan(`npx ${args.join(' ')}`)}`)
    }
  } catch (e) {
    if (e instanceof Cancelled) {
      io.log(`\n${s.dim(t.cancelled)}`)
      return 130
    }
    fail((e as Error).message)
    return 1
  }

  io.log('\n' + indent(box([s.green(s.bold(t.done)), s.cyan(`“${t.donePrompt}”`)], s), 2))
  return 0
}

function pickClients(ids: string[], detected: Client[], t: Messages): Client[] {
  const out = new Set<Client>()
  for (const id of ids) {
    if (id === 'none') continue
    if (id === 'all') CLIENTS.forEach((c) => out.add(c))
    else if (id === 'detected') detected.forEach((c) => out.add(c))
    else {
      const c = findClient(id)
      if (!c) throw new Error(t.errUnknownAgent(id, CLIENTS.map((c) => c.id).join(', ')))
      out.add(c)
    }
  }
  return [...out]
}

function indent(s: string, n = 4): string {
  return s.replace(/^/gm, ' '.repeat(n))
}

export { DEFAULT_SERVER_NAME }
