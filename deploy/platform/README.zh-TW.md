<!-- i18n-source: 0090b628f2344af41c62d2d405db66f0e1084f33 -->
[English](README.md) | [简体中文](README.zh-CN.md) | 繁體中文 | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Docker Compose 部署

在一台 Docker 主機上執行閘道，前面放一個輕巧的 [Caddy](https://caddyserver.com)。對外提供服務有兩種方式：

- **放在既有的 TLS 代理後面**（預設）：Caddy 監聽 `127.0.0.1:18788`，由你的 nginx、Caddy、Traefik 或負載平衡器在前面終止 HTTPS。
- **用 `RWD_DOMAIN` 直接提供 HTTPS**：Caddy 自己負責 80 和 443 連接埠，並向 Let's Encrypt 取得憑證。

`deploy.sh` 會在本機建置好所有東西，透過 ssh 傳到伺服器，再（重新）啟動整套服務。閘道本身的設定見 [gateway/README.zh-TW.md](../../gateway/README.zh-TW.md)。

## 檔案

| 檔案 | 用途 |
|---|---|
| `Dockerfile` | 閘道映像檔：Alpine 加上預先建置好的 `rwd` 二進位檔（內嵌主控台和 SDK）。以 uid 10001 執行，設定 `RWD_ADDR=:8080` 和 `RWD_DATA=/data/rwd.db`，並以 `/v1/healthz` 做健康檢查。發布到 GHCR 的也是這個映像檔，可以單獨執行 |
| `compose.yml` | 兩個服務。`gateway`：由 Dockerfile 建置，`./data` 掛載到 `/data`，設定來自 `.env`，設定 `RWD_TRUST_PROXY=1`（只有 Caddy 連得到它），不對外公開連接埠。`web`：`caddy:2-alpine`，公開在 `${BIND:-127.0.0.1}:${PORT:-18788}`，在 `/demo/` 底下提供 `./demo`，其餘請求全部轉給閘道 |
| `Caddyfile` | 在 `:80` 上提供純 HTTP。只信任來自 `RWD_TRUSTED_PROXIES`（預設為私有位址範圍）的 `X-Forwarded-*` |
| `compose.tls.yml` | 直接提供 HTTPS 的疊加設定：加上 `443/tcp` 和 `443/udp`（HTTP/3）連接埠，改用 `Caddyfile.tls`，憑證存放在 `caddy-data` volume 裡 |
| `Caddyfile.tls` | 以自動簽發的憑證為 `RWD_DOMAIN` 提供 HTTPS，並把 HTTP 重新導向到 HTTPS |
| `deploy.sh` | 建置、複製、首次產生 `.env`、備份資料庫、重新啟動 |

`deploy.sh` 在伺服器上產生的目錄：

```
~/rwd-platform/
├── .env                      設定（權限 600；首次部署時建立，之後不再變動）
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       對應伺服器架構的閘道二進位檔
├── data/                     rwd.db（SQLite）和 rwd.db.bak-<時間> 備份
└── demo/platform-demo/       示範商店，網址 https://rwd.example.com/demo/platform-demo/
```

## 環境需求

- **建置機器：** Go、Node.js（含 npm）、`make`、`ssh`、`scp`、`tar`。
- **伺服器：** 裝有 Compose 外掛的 Docker（`docker compose`），以及 `openssl`。ssh 使用者必須能執行 Docker（例如已加入 `docker` 群組），不需要 sudo。伺服器會拉取 `alpine:3.22` 和 `caddy:2-alpine` 映像檔。

## 設定（`.env`）

| 變數 | 預設值 | 說明 |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | 首次部署時產生 | owner 密碼，**必填**。每次啟動都會套用，所以修改它就等於重設 `RWD_ADMIN_EMAIL` 所指 owner 的密碼 |
| `RWD_ADMIN_EMAIL` | `admin` | owner 帳號（登入名稱）。只在第一次啟動時建立；之後修改它不會多出一個 owner，見 [gateway/README](../../gateway/README.zh-TW.md) |
| `RWD_PUBLIC_URL` | 從請求推斷 | 對外的閘道網址，例如 `https://rwd.example.com/v1`。建議設定 |
| `RWD_METRICS_TOKEN` | 由 `deploy.sh` 產生 | 存取 `/v1/metrics` 用的 Bearer 權杖 |
| `RWD_DATABASE_URL` | `./data` 裡的 SQLite | 設為 `postgres://…` 即改用 Postgres |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 稽核記錄保留天數 |
| `RWD_LANG` | `en` | 給 agent 看的文字所用的語言：`en` 或 `zh` |
| `RWD_MCP_RATE_LIMIT` | — | 每個用戶端 IP 每分鐘的 MCP 請求數（未設定則不限制）；公開示範的用法見 [deploy/demo](../demo/README.md) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Caddy 前面那層代理的位址範圍（以空格分隔的 CIDR，或 Caddy 的 `private_ranges`），見下文 |
| `BIND` | `127.0.0.1` | Caddy 公開在哪個位址 |
| `PORT` | `18788` | Caddy 公開在哪個連接埠 |
| `RWD_DOMAIN` | — | 直接提供 HTTPS 時的對外主機名稱（僅搭配 `compose.tls.yml`） |
| `COMPOSE_FILE` | — | 設為 `compose.yml:compose.tls.yml` 即啟用直接 HTTPS |

在伺服器上修改 `.env` 後，到部署目錄執行 `docker compose up -d` 套用。

## 用 `deploy.sh` 部署

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` 可以是 `ssh` 接受的任何寫法（`~/.ssh/config` 裡的別名、`user@host`）；`<amd64|arm64>` 是伺服器的 CPU 架構；`remote-dir` 預設是 ssh 使用者家目錄下的 `rwd-platform`。腳本會：

1. 在本機執行 `make platform GOOS=linux GOARCH=<arch>`（SDK、主控台、閘道二進位檔）；
2. 把 Dockerfile、compose 檔案和 Caddyfile、示範頁面以及二進位檔複製到伺服器；
3. **僅在首次部署時**寫入 `.env`（權限 600），內含隨機產生的 owner 密碼、`BIND`、`PORT` 和下面列出的選用設定，並把 owner 的登入資訊印出一次。之後的部署絕不覆寫 `.env`，只會在缺少時補上新版本新增的設定（例如 `RWD_METRICS_TOKEN`）；
4. 如果 `data/rwd.db` 已存在，先停止閘道，把資料庫複製為 `data/rwd.db.bak-<YYYYmmddHHMMSS>`（下次啟動時會執行結構遷移），再把 `data/` 的擁有者改為 uid 10001。這些都透過一次性容器完成，不需要 sudo；
5. 執行 `docker compose up -d --build` 並顯示服務狀態。

首次部署的設定可以透過環境變數傳入，只在 `.env` 尚不存在時才會讀取：`BIND`、`PORT`、`RWD_ADMIN_EMAIL`、`RWD_PUBLIC_URL`、`RWD_TRUSTED_PROXIES` 和 `RWD_DOMAIN`。

### 放在既有的 TLS 代理後面

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy 公開在 `127.0.0.1:18788`。讓你的代理轉送到這裡，並確認代理：

- 會轉送 WebSocket 升級請求（頁面連線到 `/v1/page`）；
- 不緩衝回應，並允許長時間連線：主控台的即時更新（`/v1/api/stream`）和 MCP 都使用串流 HTTP；閘道每 25 秒送一次心跳，閒置逾時設在 60 秒以上就夠了；
- 帶上 `X-Forwarded-For`、`X-Forwarded-Proto: https` 和原始的 `Host`。

以 nginx 為例：

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

**`RWD_TRUSTED_PROXIES`。** 只有當代理從受信任的位址連過來時，Caddy 才會把它的 `X-Forwarded-*` 標頭繼續傳給閘道。預設值 `private_ranges` 涵蓋同一台主機或內部網路裡的代理。如果代理從公開位址連過來（另一台伺服器、CDN 或雲端負載平衡器），請把它設為該代理的位址範圍。否則閘道會把代理當成用戶端：所有請求看起來都來自代理的 IP（API 金鑰的 IP 白名單和以 IP 計算的速率限制都會失效），而且看起來都走純 HTTP（主控台 cookie 不會加上 `Secure`）。

要把 Caddy 公開在其他位址或連接埠，請設定 `BIND` 和 `PORT`。

### 用 `RWD_DOMAIN` 直接提供 HTTPS

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

首次部署前，先把網域的 DNS 指向伺服器，並開放 80 和 443 連接埠（TCP，HTTP/3 還需要 UDP 443）。設定了 `RWD_DOMAIN` 時，首次部署會把 `RWD_DOMAIN`、`COMPOSE_FILE=compose.yml:compose.tls.yml`、`BIND=0.0.0.0`、`PORT=80` 和 `RWD_PUBLIC_URL=https://rwd.example.com/v1` 寫進 `.env`。Caddy 會自行取得並更新憑證（透過 Caddy 的自動 HTTPS 向 Let's Encrypt 取得），憑證存放在 `caddy-data` volume 裡，並把 HTTP 重新導向到 HTTPS。80 連接埠要保持開放，供 ACME 驗證和重新導向使用。

要把既有的部署改成直接提供 HTTPS，把上面這五行加進 `.env`，再執行 `docker compose up -d`。

## 手動部署

不使用 `deploy.sh` 時：

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# 把 deploy/platform/* 複製到伺服器，二進位檔複製為 ./rwd
# 在伺服器的這個目錄裡：
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### 使用正式版映像檔

閘道每次發布新版時，也會發布映像檔 `ghcr.io/zanel1u/remote-webview-debugger`（linux/amd64 和 linux/arm64，內嵌主控台和 SDK），tag 有 `<版本號>`（例如 `0.2.0`）、`<主版本>.<次版本>` 和 `latest`。想直接使用它而不自行建置：把 `compose.yml` 裡閘道的 `build:` 和 `image:` 兩行換成 `image: ghcr.io/zanel1u/remote-webview-debugger:<版本號>`，不必複製二進位檔，然後執行 `docker compose up -d`。升級時改 tag，再執行 `docker compose pull && docker compose up -d`（記得先像 `deploy.sh` 那樣備份 `data/`）。

只想快速試用、不想用 Compose 的話，映像檔也可以單獨執行，見[快速入門](../../README.zh-TW.md#1-執行閘道)。單獨執行時它不信任 `X-Forwarded-*`；如果你在前面放了自己的代理，請加上 `-e RWD_TRUST_PROXY=1`。

## 升級

用相同的主機、架構和目錄再執行一次 `deploy.sh`。它會重新建置、複製新的二進位檔、備份 SQLite 資料庫並重新啟動服務，`.env` 保持不變。服務會短暫中斷。頁面會自動重新連線：中斷很短時幾秒內就會恢復；中斷較久時，頁面可能先退回輪詢，幾分鐘內，或一有 agent 連上它，就會回到 WebSocket。當下已接入的 agent 需要重新接入。

## 備份

- **自動副本。** 每次部署在重新啟動前，都會把 `data/rwd.db` 複製為 `data/rwd.db.bak-<時間>`。這些副本會越積越多，請定期刪除舊的。
- **定期備份。** SQLite 以 WAL 模式執行，閘道執行期間，最近寫入的資料可能還在 `rwd.db-wal` 裡。要取得一致的副本，請暫時停止閘道：

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **還原。** 停止閘道，用備份取代 `data/rwd.db`（並刪除 `rwd.db-wal` / `rwd.db-shm`），確認擁有者是 uid 10001，再啟動閘道。
- `.env` 也要備份。資料庫備份裡含有 API 金鑰的 pepper 和主控台工作階段密鑰，請妥善保管。

## Postgres

在 `.env` 裡設定 `RWD_DATABASE_URL`，例如 `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`，再執行 `docker compose up -d`。閘道容器必須連得到資料庫（代管資料庫，或是你在 compose 覆寫檔裡自行加入的 `postgres` 服務）。啟動時會自動建立資料表；既有 SQLite 檔案裡的資料不會搬移過去。`deploy.sh` 只備份 SQLite，Postgres 請用 `pg_dump` 或雲端服務商的快照來備份。

## 日常維運

```bash
docker compose ps                                     # 狀態
docker compose logs -f gateway                        # 閘道記錄（自動產生的 owner 密碼、錯誤等）
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **忘記 owner 密碼：** 修改 `.env` 裡的 `RWD_ADMIN_PASSWORD`，執行 `docker compose up -d`，啟動時就會套用。
- 一個資料庫只能執行**一個**閘道執行個體：即時狀態（已連線的頁面、控制狀態）存在閘道的處理程序裡。
- `/demo/` 底下的示範頁面是選用的；不想公開的話，清空 `demo/` 的內容即可（下次部署會再複製過來）。
