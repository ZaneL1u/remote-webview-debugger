<!-- i18n-source: 89277de492b6bba568ab78bae628c2752fd39c71 -->
[English](README.md) | 简体中文 | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Docker Compose 部署

在一台 Docker 主机上运行网关，前面放一个小巧的 [Caddy](https://caddyserver.com)。对外提供服务有两种方式：

- **放在已有的 TLS 代理后面**（默认）：Caddy 监听 `127.0.0.1:18788`，由你的 nginx、Caddy、Traefik 或负载均衡在前面终止 HTTPS。
- **用 `RWD_DOMAIN` 直接提供 HTTPS**：Caddy 自己监听 80 和 443 端口，并从 Let's Encrypt 申请证书。

`deploy.sh` 在本地构建好所有东西，通过 ssh 传到服务器，再（重新）启动整套服务。网关本身的配置见 [gateway/README.zh-CN.md](../../gateway/README.zh-CN.md)。

## 文件

| 文件 | 作用 |
|---|---|
| `Dockerfile` | 网关镜像：Alpine 加上预先构建好的 `rwd` 二进制（内嵌控制台和 SDK）。以 uid 10001 运行，设置 `RWD_ADDR=:8080` 和 `RWD_DATA=/data/rwd.db`，带 `/v1/healthz` 健康检查。发布到 GHCR 的也是这个镜像，可以单独运行 |
| `compose.yml` | 两个服务。`gateway`：由 Dockerfile 构建，`./data` 挂载到 `/data`，配置来自 `.env`，设置 `RWD_TRUST_PROXY=1`（只有 Caddy 能访问到它），不对外发布端口。`web`：`caddy:2-alpine`，发布在 `${BIND:-127.0.0.1}:${PORT:-18788}`，在 `/demo/` 下提供 `./demo`，其余请求全部转给网关 |
| `Caddyfile` | 在 `:80` 上提供明文 HTTP。只信任来自 `RWD_TRUSTED_PROXIES`（默认私有地址段）的 `X-Forwarded-*` |
| `compose.tls.yml` | 直接提供 HTTPS 的叠加配置：增加 `443/tcp` 和 `443/udp`（HTTP/3）端口，换用 `Caddyfile.tls`，证书保存在 `caddy-data` 卷里 |
| `Caddyfile.tls` | 用自动签发的证书为 `RWD_DOMAIN` 提供 HTTPS，并把 HTTP 重定向到 HTTPS |
| `deploy.sh` | 构建、复制、首次生成 `.env`、备份数据库、重启 |

`deploy.sh` 在服务器上生成的目录：

```
~/rwd-platform/
├── .env                      配置（权限 600；首次部署时创建，之后不再改动）
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       对应服务器架构的网关二进制
├── data/                     rwd.db（SQLite）和 rwd.db.bak-<时间> 备份
└── demo/platform-demo/       演示商城，地址 https://rwd.example.com/demo/platform-demo/
```

## 环境要求

- **构建机：** Go、Node.js（含 npm）、`make`、`ssh`、`scp`、`tar`。
- **服务器：** 带 Compose 插件的 Docker（`docker compose`），以及 `openssl`。ssh 用户要能运行 Docker（比如加入 `docker` 组），不需要 sudo。服务器会拉取 `alpine:3.22` 和 `caddy:2-alpine` 镜像。

## 配置（`.env`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | 首次部署时生成 | owner 密码，**必填**。每次启动都会生效，所以改了它就等于重设 `RWD_ADMIN_EMAIL` 所指 owner 的密码 |
| `RWD_ADMIN_EMAIL` | `admin` | owner 账号（登录名）。只在首次启动时创建；之后改它不会多出一个 owner，见 [gateway/README](../../gateway/README.zh-CN.md) |
| `RWD_PUBLIC_URL` | 从请求推断 | 对外的网关地址，如 `https://rwd.example.com/v1`。建议设置 |
| `RWD_METRICS_TOKEN` | 由 `deploy.sh` 生成 | 访问 `/v1/metrics` 用的 Bearer 令牌 |
| `RWD_DATABASE_URL` | `./data` 里的 SQLite | 设为 `postgres://…` 改用 Postgres |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 审计日志保留天数 |
| `RWD_LANG` | `en` | 面向 AI 的文字的语言：`en` 或 `zh` |
| `RWD_MCP_RATE_LIMIT` | — | 每个客户端 IP 每分钟的 MCP 请求数（不设则不限）；公开演示的用法见 [deploy/demo](../demo/README.zh-CN.md) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Caddy 前面那层代理的地址段（空格分隔的 CIDR，或 Caddy 的 `private_ranges`），见下文 |
| `BIND` | `127.0.0.1` | Caddy 发布在哪个地址上 |
| `PORT` | `18788` | Caddy 发布在哪个端口上 |
| `RWD_DOMAIN` | — | 直接提供 HTTPS 时的对外域名（仅配合 `compose.tls.yml`） |
| `COMPOSE_FILE` | — | 设为 `compose.yml:compose.tls.yml` 即开启直接 HTTPS |

在服务器上修改 `.env` 后，到部署目录执行 `docker compose up -d` 使其生效。

## 用 `deploy.sh` 部署

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` 可以是 `ssh` 能识别的任何写法（`~/.ssh/config` 里的别名、`user@host`）；`<amd64|arm64>` 是服务器的 CPU 架构；`remote-dir` 默认是 ssh 用户主目录下的 `rwd-platform`。脚本会：

1. 在本地执行 `make platform GOOS=linux GOARCH=<arch>`（SDK、控制台、网关二进制）；
2. 把 Dockerfile、compose 文件、Caddyfile、演示页面和二进制复制到服务器；
3. **仅在首次部署时**写入 `.env`（权限 600），包含随机生成的 owner 密码、`BIND`、`PORT` 和下面列出的可选配置，并把 owner 的登录信息打印一次。之后的部署不会覆盖 `.env`，只会在缺少时追加新版本新增的配置（如 `RWD_METRICS_TOKEN`）；
4. 如果 `data/rwd.db` 已存在，先停掉网关，把数据库复制为 `data/rwd.db.bak-<YYYYmmddHHMMSS>`（下次启动时会执行表结构迁移），再把 `data/` 的属主改为 uid 10001。这些都借助一次性容器完成，不需要 sudo；
5. 执行 `docker compose up -d --build` 并显示服务状态。

首次部署的配置可以通过环境变量传入，只在 `.env` 还不存在时读取：`BIND`、`PORT`、`RWD_ADMIN_EMAIL`、`RWD_PUBLIC_URL`、`RWD_TRUSTED_PROXIES` 和 `RWD_DOMAIN`。

### 放在已有的 TLS 代理后面

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy 发布在 `127.0.0.1:18788`。让你的代理转发到这里，并确保代理：

- 转发 WebSocket 升级请求（页面连接 `/v1/page`）；
- 不缓冲响应，并允许长连接：控制台的实时推送（`/v1/api/stream`）和 MCP 都使用流式 HTTP；网关每 25 秒发一次心跳，空闲超时设在 60 秒以上即可；
- 带上 `X-Forwarded-For`、`X-Forwarded-Proto: https` 和原始的 `Host`。

以 nginx 为例：

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    server_name rwd.example.com;
    # listen 443 ssl; ssl_certificate …; ssl_certificate_key …;

    location / {
        proxy_pass http://127.0.0.1:18788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

**`RWD_TRUSTED_PROXIES`。** 只有代理从受信任的地址连过来时，Caddy 才会把它的 `X-Forwarded-*` 请求头继续传给网关。默认值 `private_ranges` 覆盖同一台主机或内网里的代理。如果代理从公网地址连过来（另一台服务器、CDN 或云负载均衡），请把它设为代理的地址段。否则网关会把代理当成客户端：所有请求都像是来自代理的 IP（API Key 的 IP 白名单和按 IP 限流都会失效），并且像是走明文 HTTP（控制台 cookie 不会带 `Secure`）。

要把 Caddy 发布到其他地址或端口，设置 `BIND` 和 `PORT`。

### 用 `RWD_DOMAIN` 直接提供 HTTPS

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

首次部署前，先把域名解析到服务器，并开放 80 和 443 端口（TCP，HTTP/3 还需要 UDP 443）。设置了 `RWD_DOMAIN` 时，首次部署会把 `RWD_DOMAIN`、`COMPOSE_FILE=compose.yml:compose.tls.yml`、`BIND=0.0.0.0`、`PORT=80` 和 `RWD_PUBLIC_URL=https://rwd.example.com/v1` 写进 `.env`。Caddy 会自动申请和续期证书（通过 Caddy 的自动 HTTPS 从 Let's Encrypt 获取），证书存在 `caddy-data` 卷里，并把 HTTP 重定向到 HTTPS。80 端口要保持开放，用于 ACME 验证和重定向。

要把已有的部署改为直接提供 HTTPS，把上面这五行加进 `.env`，再执行 `docker compose up -d`。

## 手动部署

不用 `deploy.sh` 时：

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# 把 deploy/platform/* 复制到服务器，二进制复制为 ./rwd
# 在服务器的这个目录里：
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### 使用发版镜像

网关每次发版还会发布镜像 `ghcr.io/zanel1u/remote-webview-debugger`（linux/amd64 和 linux/arm64，内嵌控制台和 SDK），tag 有 `<版本号>`（如 `0.2.0`）、`<主版本>.<次版本>` 和 `latest`。想直接用它而不是自己构建：把 `compose.yml` 里的 `build: .` 和 `image: rwd-gateway:local` 换成 `image: ghcr.io/zanel1u/remote-webview-debugger:<版本号>`，不用复制二进制，然后 `docker compose up -d`。升级时改 tag，再 `docker compose pull && docker compose up -d`（先像 `deploy.sh` 那样备份 `data/`）。

只想快速试用、不用 Compose 的话，镜像也可以单独运行，见[快速开始](../../README.zh-CN.md#1-运行网关)。单独运行时它不信任 `X-Forwarded-*`；如果你在前面加了自己的反向代理，再加上 `-e RWD_TRUST_PROXY=1`。

## 升级

用相同的主机、架构和目录再执行一次 `deploy.sh`。它会重新构建、复制新的二进制、备份 SQLite 数据库并重启服务，`.env` 保持不变。会有短暂中断。页面会自行重连：中断很短时几秒内就恢复；中断较长时，页面可能先退回轮询，几分钟内或者一有 agent 接入它就会回到 WebSocket。当时已接入的 agent 需要重新接入。

## 备份

- **自动副本。** 每次部署在重启前都会把 `data/rwd.db` 复制为 `data/rwd.db.bak-<时间>`。这些副本会越积越多，请定期删除旧的。
- **定期备份。** SQLite 以 WAL 模式运行，网关运行期间最近的写入可能还在 `rwd.db-wal` 里。要得到一致的副本，短暂停一下网关：

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **恢复。** 停掉网关，用备份替换 `data/rwd.db`（并删除 `rwd.db-wal` / `rwd.db-shm`），确认属主是 uid 10001，再启动网关。
- `.env` 也要备份。数据库备份里有 API Key 的 pepper 和控制台会话密钥，请妥善保管。

## Postgres

在 `.env` 里设置 `RWD_DATABASE_URL`，例如 `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`，再执行 `docker compose up -d`。网关容器要能访问到数据库（托管数据库，或者你在 compose 覆盖文件里自己加的 `postgres` 服务）。启动时自动建表；已有 SQLite 文件里的数据不会被迁移过去。`deploy.sh` 只备份 SQLite，Postgres 请用 `pg_dump` 或云厂商的快照备份。

## 日常运维

```bash
docker compose ps                                     # 状态
docker compose logs -f gateway                        # 网关日志（自动生成的 owner 密码、错误等）
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **忘了 owner 密码：** 修改 `.env` 里的 `RWD_ADMIN_PASSWORD`，执行 `docker compose up -d`，启动时就会生效。
- 一个数据库只运行**一个**网关实例：实时状态（已连接的页面、控制状态）在网关进程里。
- `/demo/` 下的演示页面是可选的；不想公开的话，清空 `demo/` 目录（下次部署会再复制过来）。
