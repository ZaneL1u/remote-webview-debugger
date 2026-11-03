<!-- i18n-source: 048ece68ecafa5fd74a1bc0378b1a0eb32f2cf96 -->
[English](README.md) | [简体中文](README.zh-CN.md) | 繁體中文 | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# rwd 閘道

Remote WebView Debugger 的 Go 伺服器端：頁面連線、裝置上線狀態、控制狀態、託管的 MCP 端點、主控台的 REST API，以及內嵌的主控台和頁面 SDK。一個二進位檔就是整個伺服器。

- 協定：[docs/protocol.zh-TW.md](../docs/protocol.zh-TW.md)
- 架構、授權模型與安全性說明：[docs/architecture.zh-TW.md](../docs/architecture.zh-TW.md)
- Docker Compose 部署：[deploy/platform/README.zh-TW.md](../deploy/platform/README.zh-TW.md)

## 建置與執行

建置需要 Go（版本見 `go.mod`）和 Node.js（含 npm），因為主控台和 SDK 要先建置好，再嵌入二進位檔。在儲存庫根目錄執行：

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # 交叉編譯（amd64 或 arm64）

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

開啟 http://localhost:8080，用上面的電子郵件和密碼登入。頁面和 agent 使用的閘道網址是 `http://localhost:8080/v1`（正式環境則像 `https://rwd.example.com/v1`）。

在 `gateway/` 目錄下直接 `go build ./cmd/rwd` 也能編譯，但這樣產生的二進位檔裡，主控台和 SDK 都只是預留位置的檔案。`rwd version` 和 `/v1/healthz` 回報的版本號由 `make` 根據最近的 `gateway-vX.Y.Z` tag 決定（剛好在 tag 上是 `0.2.0`，之後是 `0.2.0-3-gabc1234`，沒有 tag 時是 `0.0.0-dev`），也可以用 `RWD_VERSION=…` 指定。每個 `gateway-v*` 的 [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases) 都附有 Linux 和 macOS（amd64、arm64）的二進位檔；異動內容見[變更記錄](CHANGELOG.zh-CN.md)。

## 指令

```
rwd serve [參數]                        執行閘道
rwd mcp --gateway https://host/v1       給本機 agent 用的 stdio MCP 橋接（API 金鑰取自 RWD_API_KEY）
rwd version                             顯示版本號
```

## 設定（`rwd serve`）

每個參數都有對應的環境變數；命令列參數優先。

| 參數 / 環境變數 | 預設值 | 說明 |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | 監聽位址（純 HTTP；TLS 交給前面的代理處理，見 [deploy/platform](../deploy/platform/README.zh-TW.md)） |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | 資料庫。以 `postgres://` 或 `postgresql://` 開頭時使用 Postgres，否則視為 SQLite 檔案路徑。`RWD_DATABASE_URL` 優先於 `RWD_DATA`。啟動時會自動建立資料表並執行遷移 |
| `--public-url` / `RWD_PUBLIC_URL` | 從每個請求推斷 | 對外的閘道網址，以 `/v1` 結尾，例如 `https://rwd.example.com/v1`。接入程式碼片段、邀請連結和 `/v1/api/config` 都會用到它。閘道推斷不出自己的對外網址時，請設定這一項 |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | 關閉 | 從 `X-Forwarded-For` 取得用戶端 IP，從 `X-Forwarded-Proto` / `X-Forwarded-Host` 取得推斷出的對外網址的通訊協定和主機名稱（以及主控台 cookie 是否加上 `Secure`）。只能在反向代理後面開啟，否則用戶端可以偽造這些標頭，繞過 IP 白名單和速率限制。不開啟時，不管代理怎麼說，所有請求一律當成純 HTTP：主控台 cookie 不加 `Secure`，推斷出的網址也以 `http://` 開頭（這種情況請設定 `--public-url`） |
| `--lang` / `RWD_LANG` | `en` | AI 讀到的所有內容的語言：MCP 說明、工具與參數描述、工具結果、`[Session changes]` 和錯誤訊息。這個值也會透過 `welcome.agentLang` 傳給頁面 SDK，讓頁面端產生的錯誤訊息和事件摘要使用同一種語言。可設為 `en`、`zh`（簡體中文）、`zh-TW`（繁體中文）、`fr`、`es`、`ru`、`ar`、`ja`、`ko`、`de` 或 `pt`；也接受帶地區的標記，並對應到最接近的語言（`zh-CN` → `zh`，`zh-HK` → `zh-TW`，`pt-BR` → `pt`）。主控台依每個請求的 `?lang=` 或 `Accept-Language` 選擇語言，兩者都沒有時才使用這個值 |
| `--demo-dir` / `RWD_DEMO_DIR` | — | 在 `/demo/` 底下提供這個目錄（選用，用於示範頁面） |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0`（不限制） | 每個用戶端 IP 每分鐘允許的 MCP 請求數，超過的會收到 `429` 並帶有 `Retry-After: 60`。適用於 API 金鑰公開的閘道，例如示範用的閘道（[deploy/demo](../deploy/demo/README.md)）。放在代理後面時，需要 `--trust-proxy` 才看得到用戶端 IP |
| `RWD_ADMIN_EMAIL` | `admin` | owner 帳號的電子郵件（登入名稱）。只有在資料庫裡還沒有 owner 時（第一次啟動）才會建立 owner；之後再改這個值**不會**多出第二個 owner，只決定 `RWD_ADMIN_PASSWORD` 套用到哪個 owner |
| `RWD_ADMIN_PASSWORD` | — | owner 密碼。建立 owner 時使用；之後**每次啟動**都會重設 `RWD_ADMIN_EMAIL` 所指 owner 的密碼，因此也可以用來救回帳號。如果這個電子郵件不屬於 owner（是其他成員，或根本不存在），就會忽略並在記錄中說明，同時列出現有的 owner。未設定且資料庫是空的時，會隨機產生一組密碼，並在記錄中印出一次 |
| `RWD_METRICS_TOKEN` | — | 設定後，存取 `/v1/metrics` 需要 `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 稽核記錄保留天數 |

其他值得注意的事項：

- 閘道所需的機密資料（API 金鑰的 pepper 和主控台工作階段密鑰）會在第一次啟動時產生，並存放在資料庫裡。請備份資料庫，並妥善保管備份。
- 閘道把即時狀態（已連線的頁面、控制狀態、時間軸）放在記憶體裡，因此一個資料庫只能執行一個執行個體。
- 健康檢查：`GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`。

## 接入 agent

在主控台（「API 金鑰」頁面）建立一把 API 金鑰，再把託管的 MCP 端點加到用戶端，以 Claude Code 為例：

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

只支援 stdio 的用戶端，可以用同一個二進位檔把 stdio 轉送到託管端點：

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| `rwd mcp` 設定 | 說明 |
|---|---|
| `--gateway` / `RWD_GATEWAY` | 閘道網址，以 `/v1` 結尾 |
| `RWD_API_KEY` | API 金鑰（只能用環境變數設定，避免出現在處理程序清單裡） |

一把金鑰就能存取閘道上的所有裝置。工具清單見 [protocol.zh-TW.md §14](../docs/protocol.zh-TW.md#14-mcp)。

## 原始碼結構

```
cmd/rwd/            進入點：serve、mcp（stdio 橋接）、version
internal/store/     SQLite / Postgres：專案與政策、成員、API 金鑰（HMAC；層級、到期時間、IP 白名單）、
                    裝置與裝置權杖、裝置邀請、稽核記錄、設定
internal/hub/       即時狀態：裝置、頁面、控制狀態機、接入核准、層級檢查、時間軸、RPC 轉送、
                    SSE 訂閱、指標
internal/server/    HTTP：頁面 WebSocket、上線狀態輪詢、REST（含登入與角色）、MCP 工具、SSE、
                    /v1/metrics、靜態檔案
internal/i18n/      給 agent 和主控台的文案，共 11 種語言
internal/ids/       接入金鑰、API 金鑰、裝置碼、機密值的產生
internal/web/       內嵌的主控台和 SDK（由 `make gateway` 放入，否則是預留位置的檔案）
scripts/embed.sh    把 console/dist 和 sdk.js 放進 internal/web，供 go:embed 使用
```

## 測試

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` 用模擬頁面和 MCP 用戶端跑完整流程：用裝置碼接入；在裝置上核准（允許、拒絕、連續拒絕後鎖定、僅檢視）；寬限期內重新接入不必再次核准；層級檢查；快照；第一次互動時鎖定；跨頁面跟隨，以及移除被重建的 WebView 取代的頁面；接管與交還；批次操作；使用者結束；稽核記錄；裝置權杖（4401）、恢復權杖（4409）和配額（4429）；一次性邀請；金鑰到期與 IP 白名單；撤銷立即生效；成員邀請與角色；SSE 與指標；以及各種驗證失敗。

同一套測試也能在 Postgres 上執行（每個測試使用各自的暫時 schema）：

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

在儲存庫根目錄執行 `make -j16 check`，會跑 CI 中的閘道、SDK 和主控台檢查。
