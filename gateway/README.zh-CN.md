[English](README.md) | 简体中文

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

在 `gateway/` 目录下直接 `go build ./cmd/rwd` 也能编译，但这样得到的二进制里控制台和 SDK 只是占位文件。`make` 会用 `RWD_VERSION`（默认 `0.1.0`）设置 `rwd version` 和 `/v1/healthz` 报告的版本号。

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
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | 关闭 | 从 `X-Forwarded-For` 取客户端 IP、从 `X-Forwarded-Host` 取对外域名（`X-Forwarded-Proto` 无论是否开启都会采用）。只在反向代理后面开启，否则客户端可以伪造这些请求头，绕过 IP 白名单和限流 |
| `--lang` / `RWD_LANG` | `en` | AI 读到的所有内容的语言：MCP 说明、工具与参数描述、工具结果、`[会话变化]` 和错误信息。它还会通过 `welcome.agentLang` 告诉页面 SDK，让页面里生成的错误信息和事件摘要使用同一种语言。取 `en` 或 `zh`（也接受 `zh-CN`、`zh_CN` 等写法）。控制台按每个请求的 `?lang=` 或 `Accept-Language` 选择语言，都没有时才用它 |
| `--demo-dir` / `RWD_DEMO_DIR` | — | 在 `/demo/` 下提供这个目录（可选，用于演示页面） |
| `RWD_ADMIN_EMAIL` | `admin` | 启动时创建的 owner 账号的邮箱（登录名） |
| `RWD_ADMIN_PASSWORD` | — | owner 密码。设置后**每次启动**都会生效：owner 账号不存在就创建，存在就重设密码，所以也能用来找回账号。没有设置且数据库为空时，会随机生成一个密码，并在日志里打印一次 |
| `RWD_METRICS_TOKEN` | — | 设置后，访问 `/v1/metrics` 需要 `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 审计日志保留天数 |

其他需要知道的：

- 网关需要的密钥（API Key 的 pepper 和控制台会话密钥）在首次启动时生成并保存在数据库里。请备份数据库，并妥善保管备份。
- 网关把实时状态（已连接的页面、控制状态、时间线）放在内存里，所以一个数据库只运行一个实例。
- 健康检查：`GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`。

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
internal/i18n/      面向 agent 和控制台的中英文文案
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
