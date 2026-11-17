import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { defaultConfigPath, loadConfig, mcpEndpoint } from '../src/config.ts'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rwd-mcp-'))

test('mcpEndpoint accepts the origin, the /v1 base or the endpoint', () => {
  assert.equal(mcpEndpoint('https://rwd.example.com'), 'https://rwd.example.com/v1/mcp')
  assert.equal(mcpEndpoint('https://rwd.example.com/'), 'https://rwd.example.com/v1/mcp')
  assert.equal(mcpEndpoint('https://rwd.example.com/v1'), 'https://rwd.example.com/v1/mcp')
  assert.equal(mcpEndpoint('https://rwd.example.com/v1/mcp/'), 'https://rwd.example.com/v1/mcp')
  assert.equal(mcpEndpoint('http://10.0.0.2:8080/rwd/v1?x=1'), 'http://10.0.0.2:8080/rwd/v1/mcp')
  assert.throws(() => mcpEndpoint('rwd.example.com'))
  assert.throws(() => mcpEndpoint('ftp://rwd.example.com'))
})

test('default config path follows XDG_CONFIG_HOME and APPDATA', () => {
  assert.equal(defaultConfigPath({ HOME: '/h' }, 'darwin'), '/h/.config/remote-webview-debugger/mcp.json')
  assert.equal(defaultConfigPath({ HOME: '/h', XDG_CONFIG_HOME: '/x' }, 'linux'), '/x/remote-webview-debugger/mcp.json')
  assert.equal(defaultConfigPath({ APPDATA: 'C:\\A' }, 'win32'), path.join('C:\\A', 'remote-webview-debugger', 'mcp.json'))
})

test('gateways from the file and the environment; the environment wins', () => {
  const dir = tmp()
  const file = path.join(dir, 'mcp.json')
  fs.writeFileSync(
    file,
    JSON.stringify({
      gateways: {
        prod: { url: 'https://prod.example.com', apiKey: 'k-file' },
        staging: { url: 'https://staging.example.com/v1', apiKeyEnv: 'STAGING_KEY' },
        broken: { url: 'https://b.example.com', apiKeyEnv: 'NOPE' },
      },
    }),
  )
  const cfg = loadConfig({
    env: {
      RWD_CONFIG: file,
      STAGING_KEY: 'k-staging',
      RWD_GATEWAYS: 'lab=http://10.0.0.2:8080,prod=https://prod2.example.com',
      RWD_API_KEY_LAB: 'k-lab',
      RWD_API_KEY_PROD: 'k-env',
      RWD_URL: 'https://solo.example.com',
      RWD_API_KEY: 'k-solo',
    },
  })
  const by = Object.fromEntries(cfg.gateways.map((g) => [g.name, g]))
  assert.deepEqual(Object.keys(by).sort(), ['default', 'lab', 'prod', 'staging'])
  assert.deepEqual(by.prod, { name: 'prod', url: 'https://prod2.example.com/v1/mcp', apiKey: 'k-env' })
  assert.equal(by.staging!.apiKey, 'k-staging')
  assert.equal(by.lab!.url, 'http://10.0.0.2:8080/v1/mcp')
  assert.equal(by.default!.apiKey, 'k-solo')
  assert.equal(cfg.problems.length, 1)
  assert.match(cfg.problems[0]!, /NOPE/)
})

test('a missing file is no gateways; a broken one is a problem', () => {
  const dir = tmp()
  assert.deepEqual(loadConfig({ env: { RWD_CONFIG: path.join(dir, 'none.json') } }).gateways, [])
  fs.writeFileSync(path.join(dir, 'bad.json'), '{ nope')
  const cfg = loadConfig({ env: { RWD_CONFIG: path.join(dir, 'bad.json') } })
  assert.equal(cfg.gateways.length, 0)
  assert.equal(cfg.problems.length, 1)
  assert.match(loadConfig({ env: { RWD_URL: 'https://x.example.com' } }).problems[0]!, /no API key/)
})
