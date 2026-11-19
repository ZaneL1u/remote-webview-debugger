#!/usr/bin/env node
// remote-webview-debugger-mcp            stdio MCP server (what agents run)
// remote-webview-debugger-mcp@latest init       add gateways, set up agents, install the skill
// remote-webview-debugger-mcp@latest doctor     check the gateways and the agents' configs
import fs from 'node:fs'
import { parseArgs } from 'node:util'
import { agentShell, CLIENTS, DEFAULT_SERVER_NAME, defaultCtx } from './clients.ts'
import { loadConfig } from './config.ts'
import { Gateway } from './gateway.ts'
import { detectLang, langOf, LANGS, MESSAGES, type Lang } from './i18n.ts'
import { runInit, terminalIo } from './init.ts'
import { serve } from './server.ts'
import { colorWanted, makeStyle, plainStyle } from './tui.ts'

declare const __VERSION__: string | undefined

function version(): string {
  if (typeof __VERSION__ === 'string') return __VERSION__
  return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
}

const HELP = `Remote WebView Debugger MCP server

Usage:
  npx -y remote-webview-debugger-mcp [--config <file>]     run the stdio MCP server (agents start this)
  npx -y remote-webview-debugger-mcp@latest init [options]        add gateways and set up your agents
  npx -y remote-webview-debugger-mcp@latest doctor [--config <file>]

init options:
  --gateway [name=]<url>   a gateway to add (repeatable); asked for when omitted
  --api-key <key>          its API key (one gateway); else RWD_API_KEY_<NAME>, RWD_API_KEY or a prompt
  --api-key-env <VAR>      store "read the key from VAR" instead of the key itself
  --clients <ids>          comma-separated: ${CLIENTS.map((c) => c.id).join(', ')}, all, detected, none
  --skill / --no-skill     install the agent skill with npx skills add (default: ask)
  --name <name>            the server's name in the agents' configs (default ${DEFAULT_SERVER_NAME})
  --no-verify              don't check the gateway and key before saving
  -y, --yes                no questions: detected agents, no skill unless --skill
  --lang <lang>            ${LANGS.join(', ')} (default: RWD_LANG, the terminal's locale, the system language)

Gateways (config file, default ~/.config/remote-webview-debugger/mcp.json, or RWD_CONFIG):
  { "gateways": { "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_…" } } }
Environment instead of / on top of the file:
  RWD_URL + RWD_API_KEY [+ RWD_NAME]            one gateway
  RWD_GATEWAYS="prod=https://…,staging=https://…" with RWD_API_KEY_PROD, RWD_API_KEY_STAGING
`

async function doctor(config: string | undefined, v: string, lang: Lang): Promise<number> {
  const t = MESSAGES[lang]
  const s = colorWanted(process.stderr, process.env) ? makeStyle(true) : plainStyle
  const cfg = loadConfig(config ? { config } : {})
  const log = (line: string) => process.stderr.write(line + '\n')
  log(`${s.brand('◆')} ${s.bold('Remote WebView Debugger')} ${s.dim(`MCP ${v}`)}`)
  log(`  ${s.dim(t.configFile)}  ${cfg.file}${fs.existsSync(cfg.file) ? '' : s.yellow(` (${t.missing})`)}`)
  for (const p of cfg.problems) log(`  ${s.red('✖')} ${p}`)
  if (cfg.gateways.length === 0) log(`  ${s.red('✖')} ${t.noGatewayDoctor}`)
  let bad = cfg.problems.length > 0 || cfg.gateways.length === 0
  for (const g of cfg.gateways) {
    const gw = new Gateway(g, v)
    try {
      await gw.connect()
      log(`  ${s.green('✔')} ${s.bold(g.name)}  ${gw.host} ${s.dim('·')} ${gw.info?.name} ${gw.info?.version ?? ''} ${s.dim('·')} ${t.tools(gw.tools.length)}`)
    } catch (e) {
      bad = true
      log(`  ${s.red('✖')} ${s.bold(g.name)}  ${(e as Error).message}`)
    } finally {
      await gw.close()
    }
  }
  const ctx = defaultCtx()
  const found = CLIENTS.filter((c) => c.detect(ctx)).map((c) => c.label)
  log(`  ${s.dim(t.agentsFound)}  ${found.join(', ') || t.noneChosen}`)
  return bad ? 1 : 0
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const cmd = argv[0] && !argv[0].startsWith('-') ? argv.shift() : undefined
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      config: { type: 'string' },
      gateway: { type: 'string', multiple: true },
      'api-key': { type: 'string' },
      'api-key-env': { type: 'string' },
      clients: { type: 'string' },
      skill: { type: 'boolean' },
      'no-skill': { type: 'boolean' },
      name: { type: 'string' },
      'no-verify': { type: 'boolean' },
      lang: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })
  const v = version()
  if (values.version) {
    process.stdout.write(v + '\n')
    return 0
  }
  if (values.help || cmd === 'help') {
    process.stdout.write(HELP)
    return 0
  }
  if (cmd === undefined) {
    await serve({ ...(values.config ? { config: values.config } : {}), version: v })
    return -1 // keep running
  }
  const lang = langOf(values.lang) ?? detectLang(process.env)
  if (cmd === 'doctor') return doctor(values.config, v, lang)
  if (cmd === 'init') {
    const io = terminalIo()
    try {
      return await runInit(
        {
          ...(values.config ? { config: values.config } : {}),
          gateways: (values.gateway ?? []).map((g) => {
            const m = /^([a-z0-9][a-z0-9_-]*)=(.+)$/i.exec(g)
            return m ? { name: m[1]!.toLowerCase(), url: m[2]! } : { url: g }
          }),
          ...(values['api-key'] ? { apiKey: values['api-key'] } : {}),
          ...(values['api-key-env'] ? { apiKeyEnv: values['api-key-env'] } : {}),
          ...(values.clients ? { clients: values.clients.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
          ...(values.skill ? { skill: true } : values['no-skill'] ? { skill: false } : {}),
          yes: !!values.yes,
          verify: !values['no-verify'],
          serverName: values.name ?? DEFAULT_SERVER_NAME,
          lang,
          ...(agentShell(process.env) && !values.yes ? { agent: agentShell(process.env)! } : {}),
        },
        io,
        defaultCtx(),
        v,
      )
    } finally {
      io.close()
    }
  }
  process.stderr.write(`unknown command "${cmd}"\n\n${HELP}`)
  return 2
}

main().then(
  (code) => {
    if (code >= 0) process.exit(code)
  },
  (e) => {
    process.stderr.write(`remote-webview-debugger-mcp: ${(e as Error).message}\n`)
    process.exit(1)
  },
)
