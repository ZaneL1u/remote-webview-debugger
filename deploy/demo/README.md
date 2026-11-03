English | [简体中文](README.zh-CN.md)

# Public demo gateway

How [debugger.site](https://debugger.site/#live) lets anyone try the real thing: a gateway that hands every visitor an API key of their own, so visitors open the demo shop on their phone, add the gateway to their own agent and watch it work. It is the [platform stack](../platform/README.md) with demo settings, in its own directory with its own database, and it starts over every day.

## What visitors get

1. The demo shop (`examples/platform-demo`) at `https://<demo-host>/`, which goes through the entrance `/demo/` to the shop with today's AppKey (`?key=`, remembered for the shop's other pages). Its SDK pill shows the page's device code.
2. An API key of their own: the website gets one from `POST https://<demo-host>/v1/demo/keys` (the gateway runs with `RWD_DEMO_KEYS=1`) and fills it into a `claude mcp add` command and an MCP client config.
3. Their agent connects to their device code; they approve on the page and watch it reproduce the shop's checkout bug.

## Limits

Anyone can get a key, so the demo is fenced in:

| What | Setting |
|---|---|
| Isolation | Its own deploy directory, database and keys; nothing is shared with any other gateway |
| Public surface | Only `/v1/sdk.js`, `/v1/sdk/*`, `/v1/locales/*`, `/v1/page`, `/v1/presence`, `/v1/mcp`, `/v1/demo/keys`, `/v1/healthz` and `/demo/*` (`Caddyfile.site`). The console and its API stay on `127.0.0.1` |
| Pages | The project's AppKey only works from the demo's own origin (`allowedOrigins`), so it can't be used as a free relay for other sites; at most 300 devices online |
| API keys | One per visitor, so visitors never share an agent: approvals, the 10-minute reattach window and device code lockouts are per key. Level `interact` (no `evaluate_script`, request bodies or storage), valid 24 hours, at most 5 per IP per hour and 500 per hour in all |
| Devices | `list_devices` needs a `deviceCode`: agents only find the device whose code their visitor gave them |
| Agents | Every attach needs the visitor's approval on the page; at most 100 agents at once; an agent keeps a page for at most 15 minutes, 5 when idle |
| Rate | 120 MCP requests per client IP per minute (`RWD_MCP_RATE_LIMIT`); page connections and device code lookups have the gateway's own limits |
| Data | Wiped every day (`reset.sh` from cron at 04:00 server time), audit log kept for 1 day |

An agent that knows another visitor's device code can still ask to attach; that visitor sees who is asking and can refuse, and the shop holds no real data.

## Files

| File | Purpose |
|---|---|
| `deploy.sh` | Runs `../platform/deploy.sh` into its own directory (default `rwd-demo`, port `18789`), adds the demo settings to `.env`, installs `reset.sh` and its cron line, and runs it once |
| `reset.sh` | On the server: stops the gateway, deletes the database, starts it, signs in as the owner, creates the demo project (origin, policy), and writes `demo/rwd-demo.json` and the entrance `demo/index.html`. Needs `curl` and `jq` |
| `Caddyfile.site` | The site block for the host's own Caddy (HTTPS): the public routes above, `/` to the entrance, and CORS on `rwd-demo.json` (the gateway sets CORS on `/v1/demo/keys` itself) |

`demo/rwd-demo.json` (served at `/demo/rwd-demo.json`):

```json
{
  "gateway": "https://demo.example.com/v1",
  "mcp": "https://demo.example.com/v1/mcp",
  "keys": "https://demo.example.com/v1/demo/keys",
  "shop": "https://demo.example.com/demo/",
  "appKey": "rwd_pk_…",
  "resetAt": 1789830000000
}
```

The entrance `demo/index.html` sends visitors to `platform-demo/?key=<appKey>`, passing on its own query (`?lang=zh`). The AppKey goes in the address rather than being fetched by the shop, so the SDK starts with the page and records the checkout error that happens while it loads.

## Deploy

Requirements as for the [platform stack](../platform/README.md#requirements), plus `curl` and `jq` on the server, and a host that already serves HTTPS with Caddy (or any proxy that can do the same as `Caddyfile.site`).

1. Point a DNS record for the demo host (say `demo.example.com`) at the server.
2. Ship it:

   ```bash
   deploy/demo/deploy.sh my-server arm64 demo.example.com
   ```

   The first run prints the owner password once (also in `rwd-demo/.env`). Set `PORT` to publish somewhere other than `127.0.0.1:18789`.
3. Copy `Caddyfile.site` into the host's Caddy configuration, replace `demo.example.com` with the demo host, and reload Caddy.
4. Check: `https://demo.example.com/` opens the shop with a device code, and `curl -X POST https://demo.example.com/v1/demo/keys` returns a key.

Running `deploy.sh` again updates the gateway and starts the demo over (new AppKey; visitors' keys are gone). The cron line is replaced, not added twice.

## Operations

```bash
cd ~/rwd-demo
./reset.sh                     # start over now (new AppKey; visitors' keys are gone)
tail reset.log                 # the daily resets
docker compose logs -f gateway
```

- To change the limits, edit `RWD_MCP_RATE_LIMIT` in `.env` (then `docker compose up -d`) or the policy in `reset.sh` (then run it).
- To use the console, tunnel to it: `ssh -L 18789:127.0.0.1:18789 my-server`, then open `http://localhost:18789` and sign in with the owner from `.env`.
- Every reset deletes visitors' keys. The website remembers a visitor's key until the next reset (`resetAt` in `rwd-demo.json`) and then asks for a new one; agents still configured with an old key get `401`.
