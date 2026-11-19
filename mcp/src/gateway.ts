// One upstream gateway: an MCP client over Streamable HTTP with the API key as
// a Bearer token. It connects on first use and connects again after the
// session is lost (gateway restart, network change); a call that could not
// have reached the gateway is retried once on the new session.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import type { GatewayConfig } from './config.ts'

export const CLIENT_NAME = 'remote-webview-debugger-mcp'

/** Longest a tool may run: the gateway's wait tools go up to 600 s. */
export const CALL_TIMEOUT_MS = 660_000
const CONNECT_TIMEOUT_MS = 15_000

export interface GatewayInfo {
  name: string
  version?: string | undefined
  instructions?: string | undefined
}

export type GatewayErrorKind = 'no_endpoint' | 'auth' | 'session_lost' | 'rate' | 'unreachable' | 'other'

export class GatewayError extends Error {
  /** The request never reached the gateway's tool: safe to send again. */
  readonly retryable: boolean
  /** What went wrong, so `init` can say it in the person's language. */
  readonly kind: GatewayErrorKind
  /** The HTTP status or system error code behind it, if any. */
  readonly code: string | undefined
  constructor(message: string, retryable: boolean, kind: GatewayErrorKind = 'other', code?: string) {
    super(message)
    this.retryable = retryable
    this.kind = kind
    this.code = code
  }
}

/**
 * fetch for gateway calls. Node 26 (undici 8) speaks HTTP/2 to TLS gateways and
 * runs one request at a time on that connection: the transport's standalone
 * GET stream, or a long wait_for_device, then holds up every other call until
 * it times out. So: no standalone GET stream (this proxy uses no server-sent
 * notifications; a 405 tells the SDK to skip it), and HTTP/1.1 where Node
 * would pick HTTP/2.
 */
export async function gatewayFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  if ((init?.method ?? 'GET').toUpperCase() === 'GET') return new Response(null, { status: 405 })
  const dispatcher = await http1Dispatcher()
  return fetch(url, dispatcher ? ({ ...init, dispatcher } as RequestInit) : init)
}

let http1: Promise<unknown> | null = null
function http1Dispatcher(): Promise<unknown> {
  http1 ??= (async () => {
    // Node creates its global dispatcher on the first fetch. Node 22 and 24
    // keep HTTP/1.1 by default and have no ".2" slot: nothing to change there.
    await fetch('data:,').catch(() => {})
    const current = (globalThis as Record<symbol, unknown>)[Symbol.for('undici.globalDispatcher.2')]
    const Agent = (current as { constructor?: new (o: object) => unknown } | undefined)?.constructor
    if (!Agent || Agent.name !== 'Agent') return null
    try {
      return new Agent({ allowH2: false })
    } catch {
      return null
    }
  })()
  return http1
}

export class Gateway {
  readonly cfg: GatewayConfig
  readonly version: string
  private client: Client | null = null
  private connecting: Promise<Client> | null = null
  info: GatewayInfo | null = null
  tools: Tool[] = []
  lastError: string | null = null
  private fetchImpl: typeof fetch | undefined

  constructor(cfg: GatewayConfig, version: string, fetchImpl?: typeof fetch) {
    this.cfg = cfg
    this.version = version
    this.fetchImpl = fetchImpl
  }

  get name(): string {
    return this.cfg.name
  }

  get host(): string {
    return new URL(this.cfg.url).host
  }

  get connected(): boolean {
    return this.client !== null
  }

  connect(): Promise<Client> {
    if (this.client) return Promise.resolve(this.client)
    this.connecting ??= this.open().finally(() => {
      this.connecting = null
    })
    return this.connecting
  }

  private async open(): Promise<Client> {
    const client = new Client({ name: CLIENT_NAME, version: this.version })
    const transport = new StreamableHTTPClientTransport(new URL(this.cfg.url), {
      requestInit: { headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'User-Agent': `${CLIENT_NAME}/${this.version}` } },
      fetch: this.fetchImpl ?? gatewayFetch,
    })
    client.onclose = () => {
      if (this.client === client) this.client = null
    }
    try {
      await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS })
      const { tools } = await client.listTools(undefined, { timeout: CONNECT_TIMEOUT_MS })
      const v = client.getServerVersion()
      this.info = { name: v?.name ?? 'unknown', version: v?.version, instructions: client.getInstructions() }
      this.tools = tools
      this.lastError = null
      this.client = client
      return client
    } catch (e) {
      await client.close().catch(() => {})
      const err =
        e instanceof StreamableHTTPError && e.code === 404
          ? new GatewayError(`gateway "${this.name}": no MCP endpoint at ${this.cfg.url} (HTTP 404); check the gateway address`, false, 'no_endpoint', '404')
          : this.describe(e)
      this.lastError = err.message
      throw err
    }
  }

  /** Forget the session; the next call connects again. */
  async reset(): Promise<void> {
    const c = this.client
    this.client = null
    if (c) await c.close().catch(() => {})
  }

  async close(): Promise<void> {
    const c = this.client
    this.client = null
    if (!c) return
    // Ends the gateway-side session; the device stays attached to the key for a while.
    const t = c.transport as StreamableHTTPClientTransport | undefined
    await t?.terminateSession?.().catch(() => {})
    await c.close().catch(() => {})
  }

  async callTool(name: string, args: Record<string, unknown> | undefined, signal?: AbortSignal): Promise<CallToolResult> {
    for (let attempt = 0; ; attempt++) {
      const client = await this.connect()
      try {
        const res = await client.callTool({ name, arguments: args ?? {} }, undefined, {
          timeout: CALL_TIMEOUT_MS,
          resetTimeoutOnProgress: true,
          ...(signal ? { signal } : {}),
        })
        return res as CallToolResult
      } catch (e) {
        if (signal?.aborted) throw e
        const err = this.describe(e)
        if (err.retryable || isSessionLost(e)) await this.reset()
        this.lastError = err.message
        if (err.retryable && attempt === 0) continue
        throw err
      }
    }
  }

  private describe(e: unknown): GatewayError {
    if (e instanceof GatewayError) return e
    const where = `gateway "${this.name}" (${this.host})`
    if (e instanceof StreamableHTTPError) {
      if (e.code === 401 || e.code === 403)
        return new GatewayError(`${where} rejected the API key (HTTP ${e.code}). Check the key in the gateway's console (API Key) and run \`npx -y remote-webview-debugger-mcp@latest init\` to update it.`, false, 'auth', String(e.code))
      // The gateway no longer knows our session (it restarted): the call was not run.
      if (e.code === 404) return new GatewayError(`${where} lost the MCP session (HTTP 404)`, true, 'session_lost', '404')
      if (e.code === 429) return new GatewayError(`${where} is rate limiting this machine (HTTP 429); try again in a minute`, false, 'rate', '429')
      return new GatewayError(`${where}: ${e.message}`, (e.code ?? 0) >= 502 && (e.code ?? 0) <= 504, 'other', e.code === undefined ? undefined : String(e.code))
    }
    const msg = e instanceof Error ? e.message : String(e)
    const cause = errorCode(e)
    // Nothing was sent: the connection was not made.
    if (cause && ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'].includes(cause))
      // ECONNRESET may come after the request went out, so only a refused connection is sent again.
      return new GatewayError(`${where} is unreachable (${cause})`, cause === 'ECONNREFUSED', 'unreachable', cause)
    return new GatewayError(`${where}: ${msg}`, false)
  }
}

function isSessionLost(e: unknown): boolean {
  return e instanceof StreamableHTTPError && e.code === 404
}

/** The system error code (ECONNREFUSED, …) somewhere in the cause chain of a failed fetch. */
function errorCode(e: unknown): string | undefined {
  for (let c = e as { code?: unknown; cause?: unknown; errors?: unknown[] } | undefined, i = 0; c && i < 6; i++) {
    if (typeof c.code === 'string' && /^[A-Z_]+$/.test(c.code)) return c.code
    const agg = Array.isArray(c.errors) ? (c.errors[0] as typeof c) : undefined
    c = (c.cause as typeof c) ?? agg
  }
  return undefined
}
