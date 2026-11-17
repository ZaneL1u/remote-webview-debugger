import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { serve } from '../src/server.ts'
import { startMockGateway, type MockGateway } from './mock-gateway.ts'

const textOf = (r: unknown) =>
  (r as CallToolResult).content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { text: string }).text)
    .join('\n')

async function connect(env: Record<string, string>) {
  const [a, b] = InMemoryTransport.createLinkedPair()
  const { proxy } = await serve({ version: '0.0.0-test', transport: b, env, warmupMs: 2000 })
  const client = new Client({ name: 'test', version: '0' })
  await client.connect(a)
  return { client, proxy, close: async () => (await client.close(), await proxy.close()) }
}

async function closedPort(): Promise<number> {
  const s = net.createServer()
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r()))
  const port = (s.address() as net.AddressInfo).port
  await new Promise((r) => s.close(r))
  return port
}

function writeConfig(gateways: Record<string, { url: string; apiKey: string }>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwd-mcp-'))
  const file = path.join(dir, 'mcp.json')
  fs.writeFileSync(file, JSON.stringify({ gateways }))
  return file
}

describe('two gateways', () => {
  let prod: MockGateway
  let lab: MockGateway
  let file: string
  before(async () => {
    prod = await startMockGateway({ key: 'k-prod', devices: ['AAAA-1111', 'SAME-0000'], label: 'prod' })
    lab = await startMockGateway({ key: 'k-lab', devices: ['BBBB-2222', 'SAME-0000'], label: 'lab' })
    file = writeConfig({ prod: { url: prod.url, apiKey: 'k-prod' }, lab: { url: lab.url + '/v1', apiKey: 'k-lab' } })
  })
  after(async () => {
    await prod.close()
    await lab.close()
  })

  test('tools: one set, a gateway parameter on the device tools, list_gateways', async () => {
    const c = await connect({ RWD_CONFIG: file })
    const { tools } = await c.client.listTools()
    const names = tools.map((t) => t.name)
    assert.deepEqual(names.filter((n) => n === 'take_snapshot'), ['take_snapshot'])
    assert.ok(names.includes('list_gateways'))
    for (const n of ['list_devices', 'connect_device', 'wait_for_device']) {
      const t = tools.find((t) => t.name === n)!
      assert.deepEqual((t.inputSchema.properties as Record<string, { enum: string[] }>).gateway!.enum, ['prod', 'lab'], n)
    }
    assert.equal((tools.find((t) => t.name === 'take_snapshot')!.inputSchema.properties as object as Record<string, unknown>).gateway, undefined)
    assert.match(c.client.getInstructions() ?? '', /mock gateway prod[\s\S]*2 gateways \(prod, lab\)/)
    await c.close()
  })

  test('list_devices asks every gateway and labels each part', async () => {
    const c = await connect({ RWD_CONFIG: file })
    const r = await c.client.callTool({ name: 'list_devices', arguments: {} })
    const t = textOf(r)
    assert.match(t, /## prod \(127\.0\.0\.1:\d+\)\n- AAAA-1111/)
    assert.match(t, /## lab \(127\.0\.0\.1:\d+\)\n- BBBB-2222/)
    const only = textOf(await c.client.callTool({ name: 'list_devices', arguments: { gateway: 'lab' } }))
    assert.doesNotMatch(only, /AAAA/)
    assert.equal(lab.calls.at(-1)!.args.gateway, undefined, 'the gateway parameter is not forwarded')
    await c.close()
  })

  test('connect_device finds the gateway, later tools follow it, switching detaches', async () => {
    const c = await connect({ RWD_CONFIG: file })
    const r1 = await c.client.callTool({ name: 'connect_device', arguments: { device: 'BBBB-2222' } })
    assert.match(textOf(r1), /^\[gateway: lab .*\]\nAttached to BBBB-2222 on lab/)
    assert.equal(textOf(await c.client.callTool({ name: 'take_snapshot', arguments: {} })), 'snapshot of BBBB-2222 on lab')
    const shot = (await c.client.callTool({ name: 'take_screenshot', arguments: {} })) as CallToolResult
    assert.equal(shot.content[0]!.type, 'image')

    const r2 = await c.client.callTool({ name: 'connect_device', arguments: { device: 'prod:aaaa-1111' } })
    assert.match(textOf(r2), /\[gateway: prod .*\] \(detached from the device on lab\)/)
    assert.equal(prod.calls.at(-1)!.args.device, 'aaaa-1111')
    assert.equal(lab.attached, null)
    assert.equal(textOf(await c.client.callTool({ name: 'take_snapshot', arguments: {} })), 'snapshot of AAAA-1111 on prod')
    await c.client.callTool({ name: 'disconnect_device', arguments: {} })
    const r3 = await c.client.callTool({ name: 'take_snapshot', arguments: {} })
    assert.equal(r3.isError, true)
    assert.match(textOf(r3), /no device is attached, and 2 gateways/)
    await c.close()
  })

  test('a device code on two gateways, or on none, needs `gateway`', async () => {
    const c = await connect({ RWD_CONFIG: file })
    const both = await c.client.callTool({ name: 'connect_device', arguments: { device: 'SAME-0000' } })
    assert.equal(both.isError, true)
    assert.match(textOf(both), /several gateways \(prod, lab\)/)
    const none = await c.client.callTool({ name: 'wait_for_device', arguments: { device: 'ZZZZ-9999' } })
    assert.match(textOf(none), /not found on any gateway/)
    const chosen = await c.client.callTool({ name: 'connect_device', arguments: { device: 'SAME-0000', gateway: 'lab' } })
    assert.match(textOf(chosen), /on lab/)
    const unknown = await c.client.callTool({ name: 'list_devices', arguments: { gateway: 'nope' } })
    assert.match(textOf(unknown), /no gateway named "nope"/)
    await c.close()
  })

  test('a gateway restart is invisible: new session, call sent again', async () => {
    const c = await connect({ RWD_CONFIG: file })
    await c.client.callTool({ name: 'connect_device', arguments: { device: 'lab:BBBB-2222' } })
    await lab.restart()
    const r = await c.client.callTool({ name: 'take_snapshot', arguments: {} })
    assert.equal(r.isError, undefined)
    assert.equal(textOf(r), 'snapshot of BBBB-2222 on lab')
    await c.close()
  })
})

describe('problems and a single gateway', () => {
  let gw: MockGateway
  before(async () => {
    gw = await startMockGateway({ key: 'k', devices: ['AAAA-1111'], label: 'solo' })
  })
  after(() => gw.close())

  test('one gateway passes through unchanged', async () => {
    const c = await connect({ RWD_URL: gw.url, RWD_API_KEY: 'k', RWD_CONFIG: '/nonexistent/mcp.json' })
    const { tools } = await c.client.listTools()
    assert.equal((tools.find((t) => t.name === 'connect_device')!.inputSchema.properties as Record<string, unknown>).gateway, undefined)
    assert.equal(textOf(await c.client.callTool({ name: 'connect_device', arguments: { device: 'AAAA-1111' } })), 'Attached to AAAA-1111 on solo\n[Session changes]\n- p1 opened')
    assert.equal(textOf(await c.client.callTool({ name: 'take_snapshot', arguments: {} })), 'snapshot of AAAA-1111 on solo')
    assert.equal(c.client.getInstructions(), 'mock gateway solo')
    await c.close()
  })

  test('a wrong key and an unreachable gateway are reported, the good one still works', async () => {
    const file = writeConfig({ good: { url: gw.url, apiKey: 'k' }, badkey: { url: gw.url, apiKey: 'wrong' }, down: { url: `http://127.0.0.1:${await closedPort()}`, apiKey: 'x' } })
    const c = await connect({ RWD_CONFIG: file })
    const list = textOf(await c.client.callTool({ name: 'list_gateways', arguments: {} }))
    assert.match(list, /- good: .* reachable, remote-webview-debugger 0\.3\.1/)
    assert.match(list, /- badkey: .*rejected the API key \(HTTP 401\)/)
    assert.match(list, /- down: .*unreachable/)
    const devices = await c.client.callTool({ name: 'list_devices', arguments: {} })
    assert.equal(devices.isError, undefined)
    assert.match(textOf(devices), /## good[\s\S]*AAAA-1111[\s\S]*## badkey[\s\S]*Error: .*401/)
    assert.match(textOf(await c.client.callTool({ name: 'connect_device', arguments: { device: 'AAAA-1111' } })), /\[gateway: good/)
    await c.close()
  })

  test('nothing configured: the agent is told to run init', async () => {
    const c = await connect({ RWD_CONFIG: '/nonexistent/mcp.json' })
    const { tools } = await c.client.listTools()
    assert.deepEqual(tools.map((t) => t.name), ['list_gateways'])
    const r = await c.client.callTool({ name: 'list_devices', arguments: {} })
    assert.equal(r.isError, true)
    assert.match(textOf(r), /remote-webview-debugger-mcp init/)
    assert.match(c.client.getInstructions() ?? '', /No gateway is configured yet/)
    await c.close()
  })

  test('the built package runs over stdio', async (t) => {
    const cli = new URL('../dist/cli.mjs', import.meta.url).pathname
    if (!fs.existsSync(cli)) return t.skip('dist/cli.mjs not built')
    const client = new Client({ name: 'test', version: '0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli], env: { RWD_URL: gw.url, RWD_API_KEY: 'k', RWD_CONFIG: '/nonexistent/mcp.json', PATH: process.env.PATH ?? '' }, stderr: 'ignore' }))
    assert.equal(client.getServerVersion()?.name, 'remote-webview-debugger-mcp')
    const r = await client.callTool({ name: 'list_devices', arguments: {} })
    assert.match(textOf(r), /AAAA-1111/)
    await client.close()
    const v = spawn(process.execPath, [cli, '--version'])
    const out = await new Promise<string>((res) => {
      let s = ''
      v.stdout.on('data', (d) => (s += d))
      v.on('close', () => res(s.trim()))
    })
    assert.equal(out, JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version)
  })
})
