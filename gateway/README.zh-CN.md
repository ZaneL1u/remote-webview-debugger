<!-- i18n-source: 5be41169df20a8a5ebe6e7f150da98c174b93f5e -->
[English](README.md) | 简体中文 | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# rwd 网关

Remote WebView Debugger 的 Go 服务端：页面连接、设备在线状态、控制状态、托管 MCP、控制台 REST API，以及内嵌的控制台和页面 SDK。一个二进制就是整个服务端。

- 协议：[docs/protocol.zh-CN.md](../docs/protocol.zh-CN.md)
- 架构、授权模型与安全提示：[docs/architecture.zh-CN.md](../docs/architecture.zh-CN.md)
- Docker Compose 部署：[deploy/platform/README.zh-CN.md](../deploy/platform/README.zh-CN.md)

## 构建与运行

构建需要 Go（版本见 `go.mod`）和 Node.js（含 npm），因为控制台和 SDK 要先构建出来再嵌进二进制。在仓库根目录执行：

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # 交叉编译（amd64 或 arm64）

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

打开 http://localhost:8080，用上面的邮箱和密码登录。页面和 agent 使用的网关地址是 `http://localhost:8080/v1`（生产环境如 `https://rwd.example.com/v1`）。

在 `gateway/` 目录下直接 `go build ./cmd/rwd` 也能编译，但这样得到的二进制里控制台和 SDK 只是占位文件。`rwd version` 和 `/v1/healthz` 报告的版本号由 `make` 从最近的 `gateway-vX.Y.Z` tag 得出（正好在 tag 上是 `0.2.0`，之后是 `0.2.0-3-gabc1234`，没有 tag 时是 `0.0.0-dev`），也可以用 `RWD_VERSION=…` 指定。每个 `gateway-v*` 的 [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases) 都附带 Linux 和 macOS（amd64、arm64）的二进制；变更见[更新日志](CHANGELOG.zh-CN.md)。

## 命令

```
rwd serve [参数]                        运行网关
rwd mcp --gateway https://host/v1       给本地 agent 用的 stdio MCP 桥（API Key 取自 RWD_API_KEY）
rwd version                             打印版本号
```

## 配置（`rwd serve`）

每个参数都有对应的环境变量；命令行参数优先。

| 参数 / 环境变量 | 默认值 | 说明 |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | 监听地址（明文 HTTP；TLS 放在前面的代理上，见 [deploy/platform](../deploy/platform/README.zh-CN.md)） |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | 数据库。`postgres://` 或 `postgresql://` 开头时使用 Postgres，否则是 SQLite 文件路径。`RWD_DATABASE_URL` 优先于 `RWD_DATA`。启动时自动建表和迁移 |
| `--public-url` / `RWD_PUBLIC_URL` | 从每个请求推断 | 对外的网关地址，以 `/v1` 结尾，如 `https://rwd.example.com/v1`。接入代码、邀请链接和 `/v1/api/config` 都用它。网关推断不出自己的对外地址时请设置 |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | 关闭 | 从 `X-Forwarded-For` 取客户端 IP，从 `X-Forwarded-Proto` / `X-Forwarded-Host` 取推断出的对外地址的协议和域名（以及控制台 cookie 是否带 `Secure`）。只在反向代理后面开启，否则客户端可以伪造这些请求头，绕过 IP 白名单和限流。不开启时，不管代理怎么说，所有请求都按明文 HTTP 处理：控制台 cookie 不带 `Secure`，推断出的地址也以 `http://` 开头（这种情况请设置 `--public-url`） |
| `--lang` / `RWD_LANG` | `en` | AI 读到的所有内容的语言：MCP 说明、工具与参数描述、工具结果、`[会话变化]` 和错误信息。它还会通过 `welcome.agentLang` 告诉页面 SDK，让页面里生成的错误信息和事件摘要使用同一种语言。取 `en`、`zh`（简体中文）、`zh-TW`（繁体中文）、`fr`、`es`、`ru`、`ar`、`ja`、`ko`、`de`、`pt` 之一；也接受带地区的写法，映射到最接近的语言（`zh-CN` → `zh`，`zh-HK` → `zh-TW`，`pt-BR` → `pt`）。控制台按每个请求的 `?lang=` 或 `Accept-Language` 选择语言，都没有时才用它 |
| `--demo-dir` / `RWD_DEMO_DIR` | — | 在 `/demo/` 下提供这个目录（可选，用于演示页面） |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0`（不限） | 每个客户端 IP 每分钟允许的 MCP 请求数，超出的返回 `429` 并带 `Retry-After: 60`。用于 API Key 公开的网关，比如演示网关（[deploy/demo](../deploy/demo/README.zh-CN.md)）。放在代理后面时需要 `--trust-proxy` 才能拿到客户端 IP |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | 关闭 | 运行公开演示：`POST /v1/demo/keys`（无需登录，允许跨域）给每位访客签发一把自己的 API Key（`interact` 级别，24 小时有效，每个 IP 每小时 5 把），访客之间不会共用一个 agent；`list_devices` 必须带 `deviceCode`，谁也列不出别人的设备。见 [deploy/demo](../deploy/demo/README.zh-CN.md) |
| `RWD_ADMIN_EMAIL` | `admin` | owner 账号的邮箱（登录名）。只有数据库里还没有 owner 时（首次启动）才会创建 owner；之后再改这个值**不会**多出一个 owner，只决定 `RWD_ADMIN_PASSWORD` 作用于哪个 owner |
| `RWD_ADMIN_PASSWORD` | — | owner 密码。创建 owner 时使用；之后**每次启动**都会重设 `RWD_ADMIN_EMAIL` 所指 owner 的密码，所以也能用来找回账号。如果这个邮箱不是 owner 的（是别的成员，或者不存在），则忽略并在日志里说明，同时列出现有 owner。没有设置且数据库为空时，会随机生成一个密码，并在日志里打印一次 |
| `RWD_METRICS_TOKEN` | — | 设置后，访问 `/v1/metrics` 需要 `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 审计日志保留天数 |
| `RWD_OIDC_*` | — | 单点登录，见[下文](#单点登录) |

其他需要知道的：

- 网关需要的密钥（API Key 的 pepper 和控制台会话密钥）在首次启动时生成并保存在数据库里。请备份数据库，并妥善保管备份。
- 网关把实时状态（已连接的页面、控制状态、时间线）放在内存里，所以一个数据库只运行一个实例。
- 健康检查：`GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`。

## 单点登录

成员也可以用飞书、Lark 或任意 OpenID Connect 提供方（Keycloak、Okta、Microsoft Entra ID、Google、Authing 等）登录，邮箱加密码照常可用。设置好提供方和它的客户端凭证后，登录页会出现「使用 … 登录」按钮。

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`、`lark` 或 `oidc`，设置后开启单点登录。只设置 `RWD_OIDC_ISSUER` 时视为 `oidc` |
| `RWD_OIDC_CLIENT_ID`、`RWD_OIDC_CLIENT_SECRET` | — | 应用的凭证（飞书和 Lark 即 App ID 和 App Secret）。必填 |
| `RWD_OIDC_ISSUER` | — | OpenID Connect issuer，如 `https://sso.example.com/realms/acme`；各端点从它的 `/.well-known/openid-configuration` 读取（仅 `oidc`） |
| `RWD_OIDC_AUTH_URL`、`RWD_OIDC_TOKEN_URL`、`RWD_OIDC_USERINFO_URL` | 提供方的默认端点 | 覆盖端点；OpenID Connect 提供方不支持自动发现时，三个都要设置 |
| `RWD_OIDC_SCOPES` | `openid profile email`（`oidc`），飞书和 Lark 为空 | 空格分隔的 scope。飞书和 Lark 请加上 `contact:user.email:readonly`（要拿企业邮箱再加 `contact:user.employee:readonly`），账号才有邮箱 |
| `RWD_OIDC_NAME` | 提供方名称 | 登录按钮上显示的名字，如 `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | 首次登录时新建账号的角色：`member` 或 `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | 关闭 | 不新建账号：只有已有成员或受邀成员（邮箱相同）能登录 |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | 允许登录的邮箱域名，逗号分隔，如 `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | 关闭 | 仅 `oidc`：提供方不发送 `email_verified` 时（Microsoft Entra ID）也信任它给的邮箱。只适用于单租户、邮箱由你的组织掌控的提供方 |
| `RWD_OIDC_SYNC_MINUTES` | `60`（飞书、Lark） | 多久检查一次并停用已离开组织的成员；`0` 表示关闭。见下文 |

在提供方那里登记下面这个重定向 URL，必须完全一致：`https://<host>/v1/api/auth/oidc/callback`，也就是 `RWD_PUBLIC_URL` 的 origin（未设置时取请求的 origin）加上 `/v1/api/auth/oidc/callback`。放在代理后面时请设置 `RWD_PUBLIC_URL`，让这个 URL 保持不变。

一个身份第一次登录时，会关联到同邮箱的成员（受邀成员保留邀请时的角色，邀请随即用掉）；没有的话就以 `RWD_OIDC_DEFAULT_ROLE` 新建账号，除非设置了 `RWD_OIDC_INVITE_ONLY=1`。之后的登录按提供方的 subject（飞书和 Lark 为 `open_id`）找到账号，所以邮箱改了也不影响。已经关联了该提供方另一个身份的账号不会再被关联（邮箱被转给别人时会得到 `sso_error=conflict`），被停用成员的邀请也保持不动。OpenID Connect 提供方的邮箱只有在 `email_verified: true`（或设置了 `RWD_OIDC_TRUST_EMAIL=1`）时才算数；没有邮箱的账号，登录名是 `<provider>:<subject>`。owner 在「成员」页面像管理其他人一样管理这些成员：修改角色、停用或删除；被停用的成员两种方式都登录不了。单点登录创建的账号没有密码。网关用刚拿到的 access token 从提供方的 userinfo 端点读取用户信息（带 PKCE 的授权码流程），不使用 ID token。发起登录和回调每个客户端 IP 每分钟最多 60 次（放在代理后面时请开启 `--trust-proxy`，否则所有人共用代理的 IP）。

**谁能进来。** 首次登录关联到哪个已有成员，由提供方给的邮箱决定，owner 也不例外，所以能在提供方那里设置邮箱的人，就能接管这些账号。飞书或 Lark 请用企业自建应用：只有本组织的人能登录，用的也是本组织的邮箱。如果 OpenID Connect 提供方谁都能登录（Google、多租户的 Entra ID），请设置 `RWD_OIDC_ALLOWED_DOMAINS` 或 `RWD_OIDC_INVITE_ONLY=1`，否则任何人都能拿到账号（启动时日志会给出警告）；这类提供方也绝不要设置 `RWD_OIDC_TRUST_EMAIL=1`。

**更换应用或关闭单点登录。** 飞书和 Lark 的 `open_id` 只属于一个应用：换成另一个 App ID 后，成员会按邮箱重新关联，没有邮箱的账号（`feishu:…`）只能删除后重新邀请。单点登录创建的账号也没有密码，所以关闭单点登录时，owner 要删除这些账号再重新邀请。

**飞书或 Lark。** 在[飞书开放平台](https://open.feishu.cn/app)（Lark 为 [open.larksuite.com](https://open.larksuite.com/app)）创建一个企业自建应用，只有本组织的人能用，然后：

1. 把「凭证与基础信息」里的 App ID 和 App Secret 填到 `RWD_OIDC_CLIENT_ID` 和 `RWD_OIDC_CLIENT_SECRET`。
2. 在「安全设置 → 重定向 URL」里添加上面的重定向 URL。
3. 在「权限管理」里开通 `contact:user.email:readonly`（要拿企业邮箱再开通 `contact:user.employee:readonly`），并在 `RWD_OIDC_SCOPES` 里写上同样的 scope。要发现谁已离职，应用还需要开通 `contact:contact.base:readonly` 和 `contact:user.employee:readonly`，并在「数据权限 → 通讯录权限范围」里包含所有会登录的人。
4. 把应用的「可用范围」设为需要登录的人，然后「创建版本并发布」，配置才会生效。

**离职的人。** 使用飞书或 Lark 时，网关每隔 `RWD_OIDC_SYNC_MINUTES` 向开放平台查询每个关联到该应用的成员，停用被标记为已离职或已离开组织的人：他们会被登出，API Key 失效，agent 被断开，审计日志记下一条由 `system` 发起、带 `"reason":"left_organization"` 的 `member.update`。之后 owner 可以删除他们，这样他们的 Key 就被彻底吊销。只有明确的「已离职」才算数：不在通讯录权限范围内的成员或失败的请求都不会改变任何东西（日志会写明哪里失败），最后一个 owner 也永远不会被停用。没有通讯录权限时什么都不检查，离职的人手里的 API Key 会一直可用，直到 owner 停用他们；不过他们已经无法登录，控制台会话最多 12 小时内就会结束。

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

## 接入 agent

在控制台（「API Key」页）创建一个 API Key，再把托管 MCP 地址加到客户端里，以 Claude Code 为例：

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

只支持 stdio 的客户端，可以用同一个二进制把 stdio 转发到托管地址：

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| `rwd mcp` 配置 | 说明 |
|---|---|
| `--gateway` / `RWD_GATEWAY` | 网关地址，以 `/v1` 结尾 |
| `RWD_API_KEY` | API Key（只能用环境变量，避免出现在进程列表里） |

一个 Key 就能访问网关上的所有设备。工具列表见 [protocol.zh-CN.md §14](../docs/protocol.zh-CN.md#14-mcp)。

## 目录结构

```
cmd/rwd/            入口：serve、mcp（stdio 桥）、version
internal/store/     SQLite / Postgres：项目与策略、成员、API Key（HMAC；级别、有效期、IP 白名单）、
                    设备与设备令牌、设备邀请、审计日志、设置
internal/hub/       实时状态：设备、页面、控制状态机、接入审批、级别检查、时间线、RPC 转发、
                    SSE 订阅、指标
internal/server/    HTTP：页面 WebSocket、轮询兜底、REST（含登录与角色）、MCP 工具、SSE、
                    /v1/metrics、静态资源
internal/i18n/      面向 agent 和控制台的文案，共 11 种语言
internal/ids/       接入 Key、API Key、设备码、密钥的生成
internal/web/       内嵌的控制台和 SDK（由 `make gateway` 放入，否则是占位文件）
scripts/embed.sh    把 console/dist 和 sdk.js 放进 internal/web，供 go:embed 使用
```

## 测试

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` 用模拟页面和 MCP 客户端跑完整流程：用设备码接入；在设备上审批（允许、拒绝、连续拒绝后锁定、仅查看）；宽限期内再接入不用重新审批；级别检查；快照；第一次交互时锁定；跨页面跟随，以及清掉被重建 WebView 顶替的过期页面；用户接管与交还；批量操作；用户结束；审计记录；设备令牌（4401）、恢复令牌（4409）和配额（4429）；一次性邀请；Key 过期与 IP 白名单；吊销立即生效；成员邀请与角色权限；SSE 与指标；以及各类鉴权失败。

同一套测试也可以跑在 Postgres 上（每个测试使用一个临时 schema）：

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

在仓库根目录执行 `make -j16 check`，会运行 CI 里的网关、SDK 和控制台检查。
