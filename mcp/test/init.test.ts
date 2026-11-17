import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { CLIENTS, makeEntry, upsertCodexToml, upsertJson, type Ctx } from '../src/clients.ts'
import { loadConfig } from '../src/config.ts'
import { nameFromUrl, runInit, type InitOptions, type Io } from '../src/init.ts'
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
    assert.match(io.out.join('\n'), /✓ lab: remote-webview-debugger 0\.3\.1, 6 tools/)
  })
})
