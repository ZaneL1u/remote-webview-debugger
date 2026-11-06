English | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

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

`go build ./cmd/rwd` inside `gateway/` also works, but that binary only carries placeholders instead of the console and the SDK. `make` sets the version reported by `rwd version` and `/v1/healthz` from the latest `gateway-vX.Y.Z` tag (`0.2.0` on the tag, `0.2.0-3-gabc1234` after it, `0.0.0-dev` without one); `RWD_VERSION=…` overrides it. Released binaries for Linux and macOS (amd64, arm64) are attached to each `gateway-v*` [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases); changes: [CHANGELOG](CHANGELOG.md).

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
| `--lang` / `RWD_LANG` | `en` | Language of everything the AI reads: MCP instructions, tool and parameter descriptions, tool results, `[Session changes]` and errors. It also reaches the page SDK as `welcome.agentLang`, so errors and event summaries written in the page match. One of `en`, `zh` (Simplified Chinese), `zh-TW` (Traditional Chinese), `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` or `pt`; regional tags are accepted and map to the closest one (`zh-CN` → `zh`, `zh-HK` → `zh-TW`, `pt-BR` → `pt`). The console picks its language per request (`?lang=` or `Accept-Language`) and falls back to this |
| `--demo-dir` / `RWD_DEMO_DIR` | — | Serve this directory at `/demo/` (optional, for demo pages) |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0` (no limit) | MCP requests allowed per client IP per minute; more get `429` with `Retry-After: 60`. Meant for a gateway whose API key is public, like a demo ([deploy/demo](../deploy/demo/README.md)). Behind a proxy it needs `--trust-proxy` to see client IPs |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | off | Run a public demo: `POST /v1/demo/keys` (no sign-in, CORS open) hands each visitor an API key of their own (level `interact`, valid 24 hours, 5 per IP per hour), so visitors never share an agent; and `list_devices` needs a `deviceCode`, so nobody can list other visitors' devices. See [deploy/demo](../deploy/demo/README.md) |
| `RWD_ADMIN_EMAIL` | `admin` | Email (login name) of the owner account. An owner is created only while the database has none (on the first start); changing this later does **not** create a second owner, it only says which owner `RWD_ADMIN_PASSWORD` applies to |
| `RWD_ADMIN_PASSWORD` | — | Owner password. Used when the owner is created, and at **every** later start to reset the password of the owner named by `RWD_ADMIN_EMAIL`, which doubles as account recovery. If that email is not an owner's (another member, or nobody), it is ignored and the log says so, naming the owners. When unset on an empty database, a random password is generated and printed once in the log |
| `RWD_METRICS_TOKEN` | — | When set, `/v1/metrics` requires `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Days to keep the audit log |
| `RWD_OIDC_*` | — | Single sign-on, see [below](#single-sign-on) |

Other things worth knowing:

- Secrets the gateway needs (the API key pepper and the console session secret) are generated on first start and stored in the database. Back the database up and keep the backups private.
- The gateway keeps live state (connected pages, control state, timelines) in memory, so run one instance per database.
- Health check: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## Single sign-on

Members can also sign in with Feishu, Lark or any OpenID Connect provider (Keycloak, Okta, Microsoft Entra ID, Google, Authing, …); email and password keep working. Set the provider and its client credentials, and the login page shows **Sign in with …**.

| Environment variable | Default | Description |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`, `lark` or `oidc`; turns single sign-on on. Setting only `RWD_OIDC_ISSUER` means `oidc` |
| `RWD_OIDC_CLIENT_ID`, `RWD_OIDC_CLIENT_SECRET` | — | The app's credentials (App ID and App Secret for Feishu and Lark). Required |
| `RWD_OIDC_ISSUER` | — | OpenID Connect issuer, e.g. `https://sso.example.com/realms/acme`; the endpoints are read from its `/.well-known/openid-configuration` (`oidc` only) |
| `RWD_OIDC_AUTH_URL`, `RWD_OIDC_TOKEN_URL`, `RWD_OIDC_USERINFO_URL` | the provider's | Override the endpoints; set all three for an OpenID Connect provider without discovery |
| `RWD_OIDC_SCOPES` | `openid profile email` (`oidc`), none (Feishu, Lark) | Space-separated scopes. For Feishu and Lark add `contact:user.email:readonly` (and `contact:user.employee:readonly` for the enterprise email) so that accounts get an email |
| `RWD_OIDC_NAME` | the provider's name | Label of the login button, e.g. `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | Role of accounts created at a first sign-in: `member` or `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | off | Create no accounts: only existing or invited members (same email) can sign in |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | Comma-separated email domains allowed to sign in, e.g. `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | off | `oidc` only: trust the email of a provider that sends no `email_verified` (Microsoft Entra ID). Only for a single-tenant provider whose emails your organization controls |
| `RWD_OIDC_SYNC_MINUTES` | `60` (Feishu, Lark) | How often to disable members who have left the organization; `0` turns it off. See below |

Register this redirect URL with the provider; it must match exactly: `https://<host>/v1/api/auth/oidc/callback`, that is the origin of `RWD_PUBLIC_URL` (of the request when it is unset) followed by `/v1/api/auth/oidc/callback`. Set `RWD_PUBLIC_URL` behind a proxy so the URL is stable.

The first sign-in of an identity joins the member with the same email (an invited member keeps the invited role, and the invite is used up), or creates an account with `RWD_OIDC_DEFAULT_ROLE` unless `RWD_OIDC_INVITE_ONLY=1`. Later sign-ins find the account by the provider's subject (`open_id` for Feishu and Lark), so a changed email doesn't matter. An account already linked to another identity of the provider is not linked again (a reassigned mailbox gets `sso_error=conflict`), and a disabled member's invite is left alone. An OpenID Connect provider's email counts only with `email_verified: true` (or `RWD_OIDC_TRUST_EMAIL=1`), and an account without an email gets the login name `<provider>:<subject>`. Owners manage these members on the **Members** page like everyone else: change their role, disable or remove them; a disabled member can't sign in either way. Accounts created by single sign-on have no password. The gateway reads the user from the provider's userinfo endpoint with the access token it just received (authorization code flow with PKCE); it does not use the ID token. Starts and callbacks are limited to 60 per minute per client IP (behind a proxy, turn on `--trust-proxy`, or everyone shares the proxy's IP).

**Who can get in.** The provider's email decides which existing member a first sign-in becomes, owners included, so whoever can set emails at the provider can take over those accounts. With Feishu or Lark use a custom app: only people in your organization can sign in, with your organization's emails. With an OpenID Connect provider anyone can sign in to (Google, a multi-tenant Entra ID), set `RWD_OIDC_ALLOWED_DOMAINS` or `RWD_OIDC_INVITE_ONLY=1`, or anyone gets an account (the log warns at startup); and never set `RWD_OIDC_TRUST_EMAIL=1` there.

**Changing the app or turning it off.** Feishu and Lark `open_id`s belong to one app: after switching to another App ID, members are linked again by email, and accounts without one (`feishu:…`) have to be removed and invited again. Accounts created by single sign-on have no password either, so when single sign-on is turned off an owner removes them and invites them again.

**Feishu or Lark.** On the [Feishu Open Platform](https://open.feishu.cn/app) (Lark: [open.larksuite.com](https://open.larksuite.com/app)), create a custom app (企业自建应用), which only people in your organization can use, then:

1. Copy the App ID and App Secret from **Credentials & Basic Info** into `RWD_OIDC_CLIENT_ID` and `RWD_OIDC_CLIENT_SECRET`.
2. Under **Security Settings → Redirect URLs**, add the redirect URL above.
3. Under **Permissions & Scopes**, add `contact:user.email:readonly` (and `contact:user.employee:readonly` for the enterprise email), and list the same scopes in `RWD_OIDC_SCOPES`. To notice who has left, the app also needs `contact:contact.base:readonly` and `contact:user.employee:readonly`, and under **Data permissions → Contacts range** everyone who signs in.
4. Set the app's availability to the people who should sign in, and create and publish a version so the settings take effect.

**People who leave.** With Feishu or Lark the gateway asks the Open Platform every `RWD_OIDC_SYNC_MINUTES` about each member linked to the app, and disables those listed as resigned or as having left the organization: they are signed out, their API keys stop working and their agents are detached, and the audit log records `member.update` by `system` with `"reason":"left_organization"`. An owner can then remove them, which revokes their keys for good. Only an explicit "resigned" counts: a member outside the contacts range, or a failed request, changes nothing (the log says what failed), and the last owner is never disabled. Without the contact permission nothing is checked, and someone who has left keeps working API keys until an owner disables them; their console session, though, ends within 12 hours since they can no longer sign in.

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

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
internal/i18n/      text for agents and the console, in 11 languages
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
