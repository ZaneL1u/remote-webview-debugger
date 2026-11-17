import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { loadConfig } from './config.ts'
import { CLIENT_NAME } from './gateway.ts'
import { Proxy } from './proxy.ts'

export interface ServeOptions {
  config?: string
  version: string
  /** For tests: another transport than stdio, another fetch. */
  transport?: Transport
  fetch?: typeof fetch
  env?: Record<string, string | undefined>
  warmupMs?: number
}

export async function serve(opts: ServeOptions): Promise<{ server: Server; proxy: Proxy }> {
  const cfg = loadConfig({ ...(opts.config ? { config: opts.config } : {}), ...(opts.env ? { env: opts.env } : {}) })
  for (const p of cfg.problems) console.error(`${CLIENT_NAME}: ${p}`)
  const proxy = new Proxy(cfg, opts.version, opts.fetch)
  // The gateway's instructions go into the initialize result, so try to have
  // them before answering it; a gateway that is slow or down doesn't hold us up.
  await proxy.warmup(opts.warmupMs ?? 4000)

  const server = new Server({ name: CLIENT_NAME, version: opts.version }, { capabilities: { tools: { listChanged: true } }, instructions: proxy.instructions() })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: await proxy.listTools() }))
  server.setRequestHandler(CallToolRequestSchema, async (req, extra) => proxy.callTool(req.params.name, req.params.arguments, extra.signal))
  proxy.onToolsChanged = () => {
    server.sendToolListChanged().catch(() => {})
  }

  const transport = opts.transport ?? new StdioServerTransport()
  const shutdown = async () => {
    await proxy.close()
    process.exit(0)
  }
  if (!opts.transport) {
    process.stdin.on('end', shutdown)
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  }
  await server.connect(transport)
  return { server, proxy }
}
