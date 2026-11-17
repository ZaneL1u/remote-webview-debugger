// A stand-in for the gateway's /v1/mcp: Streamable HTTP, Bearer API key, and
// a few of the real tools over an in-memory list of devices. restart() drops
// every session, like a gateway restart.
import { randomUUID } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export interface MockGateway {
  url: string
  calls: { tool: string; args: Record<string, unknown> }[]
  /** The device the key is attached to (gateway-side state, per key). */
  attached: string | null
  restart(): Promise<void>
  close(): Promise<void>
}

const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: 'object' as const, properties, required })

const TOOLS = [
  { name: 'list_devices', description: 'List devices', inputSchema: obj({ status: { type: 'string' }, deviceCode: { type: 'string' } }), annotations: { readOnlyHint: true } },
  { name: 'connect_device', description: 'Attach to a device', inputSchema: obj({ device: { type: 'string' }, level: { type: 'string' } }, ['device']) },
  { name: 'wait_for_device', description: 'Wait for a device', inputSchema: obj({ device: { type: 'string' } }, ['device']) },
  { name: 'disconnect_device', description: 'Detach', inputSchema: obj() },
  { name: 'take_snapshot', description: 'Snapshot', inputSchema: obj({ page: { type: 'string' } }), annotations: { readOnlyHint: true } },
  { name: 'take_screenshot', description: 'Screenshot', inputSchema: obj(), annotations: { readOnlyHint: true } },
]

const ok = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] })
const fail = (t: string): CallToolResult => ({ content: [{ type: 'text', text: `Error: ${t}` }], isError: true })

export async function startMockGateway(opts: { key: string; devices: string[]; label: string; version?: string }): Promise<MockGateway> {
  const sessions = new Map<string, StreamableHTTPServerTransport>()
  const state: MockGateway = {
    url: '',
    calls: [],
    attached: null,
    restart: async () => {
      const all = [...sessions.values()]
      sessions.clear()
      await Promise.all(all.map((t) => t.close().catch(() => {})))
    },
    close: async () => {
      await state.restart()
      await new Promise<void>((r) => server.close(() => r()))
    },
  }

  const handle = (tool: string, args: Record<string, unknown>): CallToolResult => {
    state.calls.push({ tool, args })
    switch (tool) {
      case 'list_devices': {
        const code = typeof args.deviceCode === 'string' ? args.deviceCode.toUpperCase() : ''
        const list = opts.devices.filter((d) => !code || d === code)
        return ok(list.length ? list.map((d) => `- ${d} · iPhone · ${opts.label} · online`).join('\n') : 'No matching devices.')
      }
      case 'connect_device':
      case 'wait_for_device': {
        const d = String(args.device ?? '').toUpperCase()
        if (!opts.devices.includes(d)) return fail(`device ${d} not found`)
        if (tool === 'connect_device') state.attached = d
        return ok(tool === 'connect_device' ? `Attached to ${d} on ${opts.label}\n[Session changes]\n- p1 opened` : `${d} is online`)
      }
      case 'disconnect_device':
        if (!state.attached) return ok('Not attached.')
        state.attached = null
        return ok('Detached.')
      case 'take_snapshot':
        return state.attached ? ok(`snapshot of ${state.attached} on ${opts.label}`) : fail('not attached')
      case 'take_screenshot':
        return state.attached ? { content: [{ type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' }] } : fail('not attached')
      default:
        return fail(`unknown tool ${tool}`)
    }
  }

  const newServer = () => {
    const s = new Server({ name: 'remote-webview-debugger', version: opts.version ?? '0.3.1' }, { capabilities: { tools: {} }, instructions: `mock gateway ${opts.label}` })
    s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))
    s.setRequestHandler(CallToolRequestSchema, async (req) => handle(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>))
    return s
  }

  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith('/v1/mcp')) {
      res.writeHead(404).end()
      return
    }
    if (req.headers.authorization !== `Bearer ${opts.key}`) {
      res.writeHead(401, { 'WWW-Authenticate': 'Bearer error="invalid_token"' }).end('unauthorized')
      return
    }
    const sid = req.headers['mcp-session-id']
    let transport = typeof sid === 'string' ? sessions.get(sid) : undefined
    if (typeof sid === 'string' && !transport) {
      res.writeHead(404).end('session not found')
      return
    }
    if (!transport) {
      const t = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, t)
        },
      })
      transport = t
      await newServer().connect(t)
    }
    await transport.handleRequest(req, res)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return state
}
