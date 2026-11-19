import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { agentShell, CLIENTS, makeEntry, upsertCodexToml, upsertJson, type Ctx } from '../src/clients.ts'
import { loadConfig } from '../src/config.ts'
import { langFromEnv, langOf } from '../src/i18n.ts'
import { nameFromUrl, parseSelection, runInit, yesNo, type InitOptions, type Io } from '../src/init.ts'
import { startMockGateway, type MockGateway } from './mock-gateway.ts'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rwd-mcp-'))

function fakeCtx(home: string, env: Record<string, string> = {}): Ctx & { ran: string[][] } {
  const ran: string[][] = []
  return {
    home,
    env: { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), ...env },
    platform: 'linux',
    ran,
    has: (cmd) => cmd === 'claude',
    run: (cmd, args) => {
      ran.push([cmd, ...args])
      if (args[1] === 'get') throw new Error('not found')
      return ''
    },
  }
}

function quietIo(answers: string[] = []): Io & { out: string[] } {
  const out: string[] = []
  return { interactive: answers.length > 0, out, log: (s) => out.push(s), ask: async (_q, o) => answers.shift() || o?.def || '', close: () => {} }
}

const opts = (o: Partial<InitOptions>): InitOptions => ({ gateways: [], yes: true, verify: true, serverName: 'remote-webview-debugger', skill: false, ...o })
const entryJson = { command: 'npx', args: ['-y', 'remote-webview-debugger-mcp@latest'] }

test('upsertJson adds, leaves alone, updates, and refuses JSON with comments', () => {
  const dir = tmp()
  const f = path.join(dir, 'mcp.json')
  fs.writeFileSync(f, JSON.stringify({ mcpServers: { other: { command: 'x' } }, theme: 'dark' }))
  assert.equal(upsertJson(f, 'mcpServers', 'rwd', entryJson, '').status, 'added')
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { mcpServers: { other: { command: 'x' }, rwd: entryJson }, theme: 'dark' })
  assert.ok(fs.existsSync(`${f}.bak`))
  assert.equal(upsertJson(f, 'mcpServers', 'rwd', entryJson, '').status, 'unchanged')
  assert.equal(upsertJson(f, 'mcpServers', 'rwd', { ...entryJson, env: { A: '1' } }, '').status, 'updated')
  const c = path.join(dir, 'c.json')
  fs.writeFileSync(c, '{ // mine\n "servers": {} }')
  const r = upsertJson(c, 'servers', 'rwd', entryJson, 'SNIP')
  assert.equal(r.status, 'manual')
  assert.equal(fs.readFileSync(c, 'utf8'), '{ // mine\n "servers": {} }')
  assert.equal(upsertJson(path.join(dir, 'new', 'x.json'), 'mcpServers', 'rwd', entryJson, '').status, 'added')
})

test('Codex: our table is replaced in place, the rest of config.toml is kept', () => {
  const e = makeEntry(fakeCtx('/h'), 'remote-webview-debugger', { RWD_CONFIG: '/c/mcp.json' })
  const before = 'model = "o3"\n\n[mcp_servers.remote-webview-debugger]\ncommand = "old"\n\n[mcp_servers.remote-webview-debugger.env]\nX = "1"\n\n[mcp_servers.other]\ncommand = "y"\n'
  const after = upsertCodexToml(before, e)
  assert.equal(
    after,
    'model = "o3"\n\n[mcp_servers.remote-webview-debugger]\ncommand = "npx"\nargs = ["-y", "remote-webview-debugger-mcp@latest"]\nstartup_timeout_sec = 30\ntool_timeout_sec = 660\nenv = { RWD_CONFIG = "/c/mcp.json" }\n\n[mcp_servers.other]\ncommand = "y"\n',
  )
  assert.equal(upsertCodexToml(after, e), after)
  assert.match(upsertCodexToml('', e), /^\[mcp_servers\.remote-webview-debugger\]\n/)
  assert.match(upsertCodexToml('a = 1', e), /^a = 1\n\n\[mcp_servers/)
})

test('Windows runs npx through cmd', () => {
  const e = makeEntry({ ...fakeCtx('/h'), platform: 'win32' }, 'rwd')
  assert.equal(e.command, 'cmd')
  assert.deepEqual(e.args, ['/c', 'npx', '-y', 'remote-webview-debugger-mcp@latest'])
})

test('gateway names from addresses', () => {
  assert.equal(nameFromUrl('https://rwd.example.com/v1/mcp', new Set()), 'example')
  assert.equal(nameFromUrl('https://rwd.example.com/v1/mcp', new Set(['example'])), 'example-2')
  assert.equal(nameFromUrl('http://localhost:8080/v1/mcp', new Set()), 'localhost')
  assert.equal(nameFromUrl('http://127.0.0.1:8080/v1/mcp', new Set()), 'gateway')
  assert.equal(nameFromUrl('http://[::1]:8080/v1/mcp', new Set(['gateway'])), 'gateway-2')
})

describe('init', () => {
  let gw: MockGateway
  before(async () => {
    gw = await startMockGateway({ key: 'rwd_sk_test', devices: ['AAAA-1111'], label: 'x' })
  })
  after(() => gw.close())

  test('unattended: checks the key, saves the gateway, sets up the chosen agents', async () => {
    const home = tmp()
    const ctx = fakeCtx(home)
    fs.mkdirSync(path.join(home, '.cursor'))
    const io = quietIo()
    const code = await runInit(opts({ gateways: [{ name: 'prod', url: gw.url }], apiKey: 'rwd_sk_test', clients: ['cursor', 'codex', 'claude-code', 'gemini'] }), io, ctx, '0.0.0')
    assert.equal(code, 0, io.out.join('\n'))

    const file = path.join(home, '.config', 'remote-webview-debugger', 'mcp.json')
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { gateways: { prod: { url: gw.url, apiKey: 'rwd_sk_test' } } })
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.deepEqual(loadConfig({ env: ctx.env }).gateways, [{ name: 'prod', url: `${gw.url}/v1/mcp`, apiKey: 'rwd_sk_test' }])

    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8')), { mcpServers: { 'remote-webview-debugger': entryJson } })
    assert.match(fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8'), /tool_timeout_sec = 660/)
    assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.gemini', 'settings.json'), 'utf8')).mcpServers['remote-webview-debugger'].timeout, 660000)
    assert.deepEqual(ctx.ran.at(-1), ['claude', 'mcp', 'add', '-s', 'user', 'remote-webview-debugger', '--', 'npx', '-y', 'remote-webview-debugger-mcp@latest'])
    assert.ok(io.out.every((l) => !l.includes('rwd_sk_test')), 'the key is never printed')
  })

  test('a second gateway is added next to the first; a custom config path reaches the agents', async () => {
    const home = tmp()
    const ctx = fakeCtx(home, { LAB_KEY: 'rwd_sk_test' })
    const file = path.join(home, 'elsewhere.json')
    fs.writeFileSync(file, JSON.stringify({ gateways: { prod: { url: 'https://prod.example.com', apiKey: 'k' } } }))
    const code = await runInit(opts({ config: file, gateways: [{ name: 'lab', url: `${gw.url}/v1` }], apiKeyEnv: 'LAB_KEY', clients: ['cursor'] }), quietIo(), ctx, '0.0.0')
    assert.equal(code, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).gateways, { prod: { url: 'https://prod.example.com', apiKey: 'k' }, lab: { url: gw.url, apiKeyEnv: 'LAB_KEY' } })
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8')).mcpServers['remote-webview-debugger'].env, { RWD_CONFIG: file })
  })

  test('--api-key-env with --no-verify saves the variable name even when it is not set yet', async () => {
    const home = tmp()
    const file = path.join(home, 'mcp.json')
    const code = await runInit(opts({ config: file, gateways: [{ name: 'lab', url: 'https://lab.example.com' }], apiKeyEnv: 'LAB_KEY', verify: false, clients: [] }), quietIo(), fakeCtx(home), '0.0.0')
    assert.equal(code, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).gateways, { lab: { url: 'https://lab.example.com', apiKeyEnv: 'LAB_KEY' } })
    // Checking the gateway still needs the key.
    const io = quietIo()
    assert.equal(await runInit(opts({ config: file, gateways: [{ name: 'lab2', url: 'https://lab.example.com' }], apiKeyEnv: 'LAB_KEY', clients: [] }), io, fakeCtx(home), '0.0.0'), 1)
    assert.match(io.out.join('\n'), /LAB_KEY is not set/)
  })

  test('a wrong key is refused and nothing is written', async () => {
    const home = tmp()
    const io = quietIo()
    const code = await runInit(opts({ gateways: [{ url: gw.url }], apiKey: 'wrong', clients: ['cursor'] }), io, fakeCtx(home), '0.0.0')
    assert.equal(code, 1)
    assert.match(io.out.join('\n'), /rejected the API key/)
    assert.equal(fs.existsSync(path.join(home, '.config', 'remote-webview-debugger', 'mcp.json')), false)
    assert.equal(fs.existsSync(path.join(home, '.cursor', 'mcp.json')), false)
  })

  test('interactive: address, name, key, agents by number', async () => {
    const home = tmp()
    fs.mkdirSync(path.join(home, '.codeium', 'windsurf'), { recursive: true })
    const windsurf = CLIENTS.findIndex((c) => c.id === 'windsurf') + 1
    const io = quietIo([gw.url, 'lab', 'rwd_sk_test', 'n', String(windsurf), 'n'])
    const code = await runInit({ gateways: [], yes: false, verify: true, serverName: 'rwd' }, io, fakeCtx(home), '0.0.0')
    assert.equal(code, 0, io.out.join('\n'))
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, '.codeium', 'windsurf', 'mcp_config.json'), 'utf8')), { mcpServers: { rwd: entryJson } })
    assert.match(io.out.join('\n'), /✔ lab {2}remote-webview-debugger 0\.3\.1 · 6 tools/)
  })

  test('typed agent numbers with any separator; what is not understood is asked again', async () => {
    const home = tmp()
    // 1.2.3.9 (dots) used to pick nothing without a word; "x" is asked about, then 1 3.
    const io = quietIo([gw.url, 'lab', 'rwd_sk_test', 'n', 'x', '2.3', 'n'])
    const code = await runInit({ gateways: [], yes: false, verify: true, serverName: 'rwd' }, io, fakeCtx(home), '0.0.0')
    assert.equal(code, 0, io.out.join('\n'))
    assert.match(io.out.join('\n'), /Not recognized: x/)
    assert.ok(fs.existsSync(path.join(home, '.cursor', 'mcp.json')))
    assert.ok(fs.existsSync(path.join(home, '.codex', 'config.toml')))
  })

  test('the checkbox list starts with the agents found; Chinese when the locale is Chinese', async () => {
    const home = tmp()
    fs.mkdirSync(path.join(home, '.cursor'))
    const seen: { items: string[]; selected: number[] }[] = []
    const io: Io & { out: string[] } = {
      ...quietIo([gw.url, 'lab', 'rwd_sk_test']),
      confirm: async () => false,
      choose: async (_q, _h, items, selected) => {
        seen.push({ items: items.map((i) => `${i.label}${i.note ? ` (${i.note})` : ''}`), selected: [...selected] })
        selected.add(CLIENTS.findIndex((c) => c.id === 'gemini'))
        return [...selected]
      },
    }
    const code = await runInit({ gateways: [], yes: false, verify: true, serverName: 'rwd' }, io, fakeCtx(home, { LANG: 'zh_CN.UTF-8' }), '0.0.0')
    assert.equal(code, 0, io.out.join('\n'))
    assert.deepEqual(seen[0]!.selected.map((i) => CLIENTS[i]!.id).sort(), ['claude-code', 'cursor'])
    assert.ok(seen[0]!.items.includes('Cursor (已安装)'))
    const out = io.out.join('\n')
    assert.match(out, /✔ lab {2}remote-webview-debugger 0\.3\.1 · 6 个工具/)
    assert.match(out, /已添加/)
    assert.match(out, /列出在线设备/)
    assert.ok(fs.existsSync(path.join(home, '.gemini', 'settings.json')))
  })

  test('the key: where to get it first; empty, not a key, or refused is asked again', async () => {
    const home = tmp()
    const asked: string[] = []
    const answers = ['', 'hello', 'rwd_sk_wrong', 'rwd_sk_test', 'n', 'none', 'n']
    const io: Io & { out: string[] } = {
      ...quietIo(['x']),
      ask: async (q) => (asked.push(q), answers.shift() ?? ''),
    }
    const code = await runInit({ gateways: [{ name: 'lab', url: gw.url }], yes: false, verify: true, serverName: 'rwd' }, io, fakeCtx(home), '0.0.0')
    const out = io.out.join('\n')
    assert.equal(code, 0, out)
    assert.ok(out.includes(`${gw.url}/keys`), 'says where to make a key')
    assert.match(out, /Nothing was pasted yet/)
    assert.match(out, /doesn't look like an API key/)
    assert.match(out, /rejected the API key\. .*Please paste another key\./)
    assert.equal(asked.filter((q) => q === 'Paste your API key').length, 4)
    assert.equal(out.match(/you need your own API key/g)?.length, 1, 'the steps are shown once')
  })

  test('run by an agent: no questions, only that agent; a missing key goes back to the person', async () => {
    const home = tmp()
    fs.mkdirSync(path.join(home, '.codex'))
    const file = path.join(home, '.config', 'remote-webview-debugger', 'mcp.json')
    // Nothing configured yet: the key must not go through the agent.
    let io = quietIo(['must not be asked'])
    assert.equal(await runInit({ gateways: [{ name: 'lab', url: gw.url }], yes: false, verify: true, serverName: 'rwd', agent: 'cursor' }, io, fakeCtx(home), '0.0.0'), 1)
    assert.match(io.out.join('\n'), /should not go through the AI agent[\s\S]*npx -y remote-webview-debugger-mcp@latest init --gateway lab=/)
    // With a gateway saved: Cursor only (not the Codex found), nothing asked.
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ gateways: { lab: { url: gw.url, apiKey: 'rwd_sk_test' } } }))
    io = quietIo(['must not be asked'])
    const code = await runInit({ gateways: [], yes: false, verify: true, serverName: 'rwd', agent: 'cursor' }, io, fakeCtx(home), '0.0.0')
    assert.equal(code, 0, io.out.join('\n'))
    assert.match(io.out.join('\n'), /Running inside Cursor/)
    assert.ok(fs.existsSync(path.join(home, '.cursor', 'mcp.json')))
    assert.equal(fs.existsSync(path.join(home, '.codex', 'config.toml')), false)
  })

  test('-y asks nothing, not even "add a gateway?"', async () => {
    const home = tmp()
    const file = path.join(home, '.config', 'remote-webview-debugger', 'mcp.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ gateways: { lab: { url: gw.url, apiKey: 'rwd_sk_test' } } }))
    const asked: string[] = []
    const io: Io & { out: string[] } = { ...quietIo(['x']), ask: async (q) => (asked.push(q), '') }
    assert.equal(await runInit({ gateways: [], yes: true, verify: true, serverName: 'rwd', clients: ['cursor'] }, io, fakeCtx(home), '0.0.0'), 0)
    assert.deepEqual(asked, [])
  })

  test('a wrong key in Japanese', async () => {
    const io = quietIo()
    const code = await runInit(opts({ gateways: [{ url: gw.url }], apiKey: 'wrong', clients: [], lang: 'ja' }), io, fakeCtx(tmp()), '0.0.0')
    assert.equal(code, 1)
    assert.match(io.out.join('\n'), /API キーを拒否しました/)
  })
})

test('agent selections', () => {
  const ids = (s: string) => parseSelection(s, CLIENTS).picked.map((c) => c.id)
  assert.deepEqual(ids('1.2.3.9'), ['claude-code', 'cursor', 'codex', 'claude-desktop'])
  assert.deepEqual(ids('1，2、3 9'), ['claude-code', 'cursor', 'codex', 'claude-desktop'])
  assert.deepEqual(ids('1-3'), ['claude-code', 'cursor', 'codex'])
  assert.deepEqual(ids('cursor, claude-code'), ['claude-code', 'cursor'])
  assert.deepEqual(ids('all').length, CLIENTS.length)
  assert.deepEqual(ids('none'), [])
  assert.deepEqual(parseSelection('1, 42, foo', CLIENTS).unknown, ['42', 'foo'])
})

test('languages from the locale', () => {
  assert.equal(langOf('zh_CN.UTF-8'), 'zh')
  assert.equal(langOf('zh_TW.UTF-8'), 'zh-TW')
  assert.equal(langOf('zh-Hant-HK'), 'zh-TW')
  assert.equal(langOf('pt_BR.UTF-8'), 'pt')
  assert.equal(langOf('it_IT.UTF-8'), 'en')
  assert.equal(langOf('C'), undefined)
  assert.equal(langFromEnv({ LANG: 'C.UTF-8', LANGUAGE: 'ja:en' }), 'ja')
  assert.equal(langFromEnv({ RWD_LANG: 'ko', LANG: 'zh_CN.UTF-8' }), 'ko')
  assert.equal(langFromEnv({ LC_ALL: 'de_DE.UTF-8', LANG: 'fr_FR.UTF-8' }), 'de')
  assert.equal(langFromEnv({}), undefined)
})

test('yes and no in several languages', () => {
  for (const y of ['y', 'Yes', '是', 'はい', 'sí', 'oui', 'ja', 'да']) assert.equal(yesNo(y, false), true, y)
  for (const n of ['n', 'no', '否', 'いいえ', 'nein', 'нет']) assert.equal(yesNo(n, true), false, n)
  assert.equal(yesNo('', true), true)
})

test('which agent runs us', () => {
  assert.equal(agentShell({ CLAUDECODE: '1' }), 'claude-code')
  assert.equal(agentShell({ CURSOR_AGENT: '1' }), 'cursor')
  assert.equal(agentShell({ GEMINI_CLI: '1' }), 'gemini')
  assert.equal(agentShell({ CODEX_SANDBOX: 'seatbelt' }), 'codex')
  assert.equal(agentShell({ TERM_PROGRAM: 'vscode' }), undefined)
})
