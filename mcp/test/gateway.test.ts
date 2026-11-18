import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'

import { gatewayFetch } from '../src/gateway.ts'

test('gatewayFetch answers the standalone GET stream with 405 and passes the rest through', async () => {
  // Node 26 serializes HTTP/2 requests, so an open GET stream would block every call (see gatewayFetch).
  const get = await gatewayFetch('http://127.0.0.1:9/v1/mcp')
  assert.equal(get.status, 405)
  const server = createServer((req, res) => res.end(`${req.method} ok`))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as { port: number }
  try {
    const post = await gatewayFetch(`http://127.0.0.1:${port}/v1/mcp`, { method: 'POST', body: '{}' })
    assert.equal(await post.text(), 'POST ok')
  } finally {
    server.close()
  }
})
