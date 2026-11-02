English | [简体中文](README.zh-CN.md)

# rwd gateway

The Go server of Remote WebView Debugger: page connections, device presence, control state, the hosted MCP endpoint, the console's REST API, plus the embedded console and page SDK. One binary is the whole server.

- Protocol: [docs/protocol.md](../docs/protocol.md)
- Architecture, consent model and security notes: [docs/architecture.md](../docs/architecture.md)
- Docker Compose deployment: [deploy/platform/README.md](../deploy/platform/README.md)

## Build and run

Building needs Go (the version in `go.mod`) and Node.js with npm, because the console and the SDK are built and embedded into the binary. From the repository root:

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # cross-compile (amd64 or arm64)

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

Open http://localhost:8080 and sign in with that email and password. Pages and agents use the gateway URL `http://localhost:8080/v1` (in production: `https://rwd.example.com/v1`).

`go build ./cmd/rwd` inside `gateway/` also works, but that binary only carries placeholders instead of the console and the SDK. `make` sets the version reported by `rwd version` and `/v1/healthz` from `RWD_VERSION` (default `0.1.0`).

## Commands

```
rwd serve [flags]                       run the gateway
rwd mcp --gateway https://host/v1       stdio MCP bridge for local agents (API key from RWD_API_KEY)
rwd version                             print the version
```

## Configuration (`rwd serve`)

Every flag has an environment variable; a flag given on the command line wins.

| Flag / environment variable | Default | Description |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | Listen address (plain HTTP; put TLS in front, see [deploy/platform](../deploy/platform/README.md)) |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | Database. A `postgres://` or `postgresql://` URL selects Postgres; anything else is a SQLite file path. `RWD_DATABASE_URL` takes precedence over `RWD_DATA`. The schema is created and migrated at startup |
| `--public-url` / `RWD_PUBLIC_URL` | derived from each request | Public gateway URL ending in `/v1`, e.g. `https://rwd.example.com/v1`. Used in integration snippets, invite links and `/v1/api/config`. Set it when the gateway can't infer its public address |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | off | Take the client IP from `X-Forwarded-For`, and the scheme and host of the inferred public URL (and whether the console cookie is `Secure`) from `X-Forwarded-Proto` / `X-Forwarded-Host`. Turn it on only behind a reverse proxy, otherwise clients can forge these headers and sidestep IP allowlists and rate limits. Without it, every request counts as plain HTTP whatever the proxy says, so the console cookie is set without `Secure` and inferred URLs start with `http://` (set `--public-url` in that case) |
| `--lang` / `RWD_LANG` | `en` | Language of everything the AI reads: MCP instructions, tool and parameter descriptions, tool results, `[Session changes]` and errors. It also reaches the page SDK as `welcome.agentLang`, so errors and event summaries written in the page match. `en` or `zh` (`zh-CN`, `zh_CN` and the like are accepted). The console picks its language per request (`?lang=` or `Accept-Language`) and falls back to this |
| `--demo-dir` / `RWD_DEMO_DIR` | — | Serve this directory at `/demo/` (optional, for demo pages) |
| `RWD_ADMIN_EMAIL` | `admin` | Email (login name) of the owner account. An owner is created only while the database has none (on the first start); changing this later does **not** create a second owner, it only says which owner `RWD_ADMIN_PASSWORD` applies to |
| `RWD_ADMIN_PASSWORD` | — | Owner password. Used when the owner is created, and at **every** later start to reset the password of the owner named by `RWD_ADMIN_EMAIL`, which doubles as account recovery. If that email is not an owner's (another member, or nobody), it is ignored and the log says so, naming the owners. When unset on an empty database, a random password is generated and printed once in the log |
| `RWD_METRICS_TOKEN` | — | When set, `/v1/metrics` requires `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Days to keep the audit log |

Other things worth knowing:

- Secrets the gateway needs (the API key pepper and the console session secret) are generated on first start and stored in the database. Back the database up and keep the backups private.
- The gateway keeps live state (connected pages, control state, timelines) in memory, so run one instance per database.
- Health check: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## Connecting an agent

Create an API key in the console (**API keys**), then add the hosted MCP endpoint to your client, for example Claude Code:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

For clients that only speak stdio, the same binary relays stdio to the hosted endpoint:

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| `rwd mcp` setting | Description |
|---|---|
| `--gateway` / `RWD_GATEWAY` | Gateway URL ending in `/v1` |
| `RWD_API_KEY` | API key (environment only, so it doesn't show up in process lists) |

One key reaches every device on the gateway. The tools are listed in [protocol.md §14](../docs/protocol.md#14-mcp).

## Source layout

```
cmd/rwd/            entry point: serve, mcp (stdio bridge), version
internal/store/     SQLite / Postgres: projects and policies, members, API keys (HMAC; level, expiry,
                    IP allowlist), devices and device tokens, device invites, audit log, settings
internal/hub/       live state: devices, pages, control state machine, attach approval, level checks,
                    timelines, RPC routing, SSE subscriptions, metrics
internal/server/    HTTP: page WebSocket, presence polling, REST with sign-in and roles, MCP tools,
                    SSE, /v1/metrics, static files
internal/i18n/      English and Chinese text for agents and the console
internal/ids/       app keys, API keys, device codes, secrets
internal/web/       the embedded console and SDK (staged by `make gateway`, placeholders otherwise)
scripts/embed.sh    stages console/dist and sdk.js into internal/web for go:embed
```

## Tests

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` drives the whole flow with simulated pages and an MCP client: connecting by device code; approval on the device (allow, deny, repeated denials and lockout, view only); re-attaching within the grace period without a second approval; level checks; snapshots; locking on the first interaction; following across pages and dropping a page a recreated WebView replaced; takeover and hand-back; batched actions; ending by the user; audit records; device tokens (4401), resume tokens (4409) and quotas (4429); one-time invites; key expiry and IP allowlists; immediate revocation; member invites and roles; SSE and metrics; and authentication failures.

The same tests run against Postgres (each test in its own temporary schema):

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

`make -j16 check` at the repository root runs the gateway, SDK and console checks that CI runs.
