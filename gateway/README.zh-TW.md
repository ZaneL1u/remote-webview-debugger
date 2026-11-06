<!-- i18n-source: 36b1f9d52cae376ca3aa02c47b0584fd21b7ab30 -->
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
| `--demo-keys` / `RWD_DEMO_KEYS=1` | 關閉 | 執行公開示範：`POST /v1/demo/keys`（不必登入，允許跨來源請求）為每位訪客核發一把自己的 API 金鑰（`interact` 等級，24 小時有效，每個 IP 每小時 5 把），訪客之間不會共用同一個 agent；`list_devices` 必須帶 `deviceCode`，誰也列不出別人的裝置。請見 [deploy/demo](../deploy/demo/README.md) |
| `RWD_ADMIN_EMAIL` | `admin` | owner 帳號的電子郵件（登入名稱）。只有在資料庫裡還沒有 owner 時（第一次啟動）才會建立 owner；之後再改這個值**不會**多出第二個 owner，只決定 `RWD_ADMIN_PASSWORD` 套用到哪個 owner |
| `RWD_ADMIN_PASSWORD` | — | owner 密碼。建立 owner 時使用；之後**每次啟動**都會重設 `RWD_ADMIN_EMAIL` 所指 owner 的密碼，因此也可以用來救回帳號。如果這個電子郵件不屬於 owner（是其他成員，或根本不存在），就會忽略並在記錄中說明，同時列出現有的 owner。未設定且資料庫是空的時，會隨機產生一組密碼，並在記錄中印出一次 |
| `RWD_METRICS_TOKEN` | — | 設定後，存取 `/v1/metrics` 需要 `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 稽核記錄保留天數 |
| `RWD_OIDC_*` | — | 單一登入，見[下文](#單一登入) |

其他值得注意的事項：

- 閘道所需的機密資料（API 金鑰的 pepper 和主控台工作階段密鑰）會在第一次啟動時產生，並存放在資料庫裡。請備份資料庫，並妥善保管備份。
- 閘道把即時狀態（已連線的頁面、控制狀態、時間軸）放在記憶體裡，因此一個資料庫只能執行一個執行個體。
- 健康檢查：`GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`。

## 單一登入

成員也可以用飛書、Lark 或任何 OpenID Connect 提供者（Keycloak、Okta、Microsoft Entra ID、Google、Authing 等）登入，電子郵件加密碼的方式照常可用。設定好提供者和它的用戶端憑證後，登入頁會出現「使用 … 登入」按鈕。

| 環境變數 | 預設值 | 說明 |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`、`lark` 或 `oidc`，設定後即啟用單一登入。只設定 `RWD_OIDC_ISSUER` 時視為 `oidc` |
| `RWD_OIDC_CLIENT_ID`、`RWD_OIDC_CLIENT_SECRET` | — | 應用程式的憑證（飛書和 Lark 即 App ID 和 App Secret）。必填 |
| `RWD_OIDC_ISSUER` | — | OpenID Connect issuer，例如 `https://sso.example.com/realms/acme`；各端點從它的 `/.well-known/openid-configuration` 讀取（僅限 `oidc`） |
| `RWD_OIDC_AUTH_URL`、`RWD_OIDC_TOKEN_URL`、`RWD_OIDC_USERINFO_URL` | 提供者的預設端點 | 覆寫端點；OpenID Connect 提供者不支援自動探索時，三個都要設定 |
| `RWD_OIDC_SCOPES` | `openid profile email`（`oidc`），飛書和 Lark 為空 | 以空格分隔的 scope。飛書和 Lark 請加上 `contact:user.email:readonly`（要取得企業信箱再加上 `contact:user.employee:readonly`），帳號才會有電子郵件 |
| `RWD_OIDC_NAME` | 提供者名稱 | 登入按鈕上顯示的名稱，例如 `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | 首次登入時建立的帳號的角色：`member` 或 `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | 關閉 | 不建立新帳號：只有現有成員或受邀成員（電子郵件相同）能登入 |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | 允許登入的電子郵件網域，以逗號分隔，例如 `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | 關閉 | 僅限 `oidc`：提供者不傳送 `email_verified` 時（Microsoft Entra ID）也信任它提供的電子郵件。只適用於單一租用戶、電子郵件由你的組織掌控的提供者 |
| `RWD_OIDC_TENANT` | — | 僅限飛書和 Lark：你的組織的 `tenant_key`；其他組織的人會被拒絕（`sso_error=tenant`）。每次單一登入的 `auth.login` 稽核記錄都會顯示它的 `tenant` |
| `RWD_OIDC_SYNC_MINUTES` | `60`（飛書、Lark） | 多久檢查一次並停用已離開組織的成員；`0` 表示關閉。見下文 |

請在提供者那邊登記下面這個重新導向 URL，必須完全相符：`https://<host>/v1/api/auth/oidc/callback`，也就是 `RWD_PUBLIC_URL` 的 origin（未設定時取請求的 origin）再加上 `/v1/api/auth/oidc/callback`。放在代理後面時請設定 `RWD_PUBLIC_URL`，讓這個 URL 保持固定。

一個身分第一次登入時，會連結到電子郵件相同的成員（受邀成員保留邀請時的角色，邀請也隨之用掉）；沒有的話就以 `RWD_OIDC_DEFAULT_ROLE` 建立新帳號，除非設定了 `RWD_OIDC_INVITE_ONLY=1`。之後的登入會依提供者的 subject（飛書和 Lark 為 `open_id`）找到帳號，所以電子郵件改了也沒關係。已經連結到該提供者另一個身分的帳號不會再被連結（信箱被轉給別人時會得到 `sso_error=conflict`），被停用成員的邀請也會保持不動。OpenID Connect 提供者的電子郵件只有在 `email_verified: true`（或設定了 `RWD_OIDC_TRUST_EMAIL=1`）時才算數；沒有電子郵件的帳號，登入名稱為 `<provider>:<subject>`。owner 在「成員」頁面像管理其他人一樣管理這些成員：變更角色、停用或刪除；被停用的成員用哪種方式都無法登入。單一登入建立的帳號沒有密碼。閘道會用剛取得的 access token 從提供者的 userinfo 端點讀取使用者資料（搭配 PKCE 的授權碼流程），不使用 ID token。發起登入和回呼每個用戶端 IP 每分鐘最多 60 次（放在代理後面時請開啟 `--trust-proxy`，否則所有人會共用代理的 IP）。

**誰能登入。** 首次登入會成為哪個現有成員，由提供者給的電子郵件決定，owner 也不例外，所以能在提供者那邊設定電子郵件的人，就能接管這些帳號。飛書或 Lark 請使用企業自建應用：只有你的組織成員能登入，用的也是組織的電子郵件。商店應用程式，或共享給關聯組織的應用程式，其他組織的人也能登入：這時請設定 `RWD_OIDC_TENANT`。如果 OpenID Connect 提供者任何人都能登入（Google、多租用戶的 Entra ID），請設定 `RWD_OIDC_ALLOWED_DOMAINS` 或 `RWD_OIDC_INVITE_ONLY=1`，否則任何人都能取得帳號（啟動時記錄檔會發出警告）；這類提供者也絕對不要設定 `RWD_OIDC_TRUST_EMAIL=1`。

**更換應用程式或關閉單一登入。** 飛書和 Lark 的 `open_id` 只屬於一個應用程式：改用另一個 App ID 後，成員會依電子郵件重新連結，沒有電子郵件的帳號（`feishu:…`）只能刪除後重新邀請。單一登入建立的帳號沒有密碼：owner 可以在「成員」頁面按「新連結」，產生一個設定密碼的邀請連結（也能取代遺失的邀請），例如在關閉單一登入之前。

**飛書或 Lark。** 在[飛書開放平台](https://open.feishu.cn/app)（Lark 為 [open.larksuite.com](https://open.larksuite.com/app)）建立一個企業自建應用（只有你的組織成員能使用），然後：

1. 把「憑證與基礎資訊」裡的 App ID 和 App Secret 填到 `RWD_OIDC_CLIENT_ID` 和 `RWD_OIDC_CLIENT_SECRET`。
2. 在「安全設定 → 重新導向 URL」中加入上面的重新導向 URL。
3. 在「權限管理」中開通 `contact:user.email:readonly`（要取得企業信箱再開通 `contact:user.employee:readonly`），並在 `RWD_OIDC_SCOPES` 裡列出同樣的 scope。要得知誰已離職，應用還需要開通 `contact:contact.base:readonly` 和 `contact:user.employee:readonly`，並在「資料權限 → 通訊錄權限範圍」中涵蓋所有會登入的人。
4. 把應用的「可用範圍」設為需要登入的人，然後「建立版本並發佈」，設定才會生效。

**離職的人。** 使用飛書或 Lark 時，閘道每隔 `RWD_OIDC_SYNC_MINUTES` 向開放平台查詢每個連結到該應用的成員，停用被標記為已離職或已離開組織的人：他們會被登出，API 金鑰會失效，agent 會被中斷接入，稽核記錄會記下一筆由 `system` 發起、帶有 `"reason":"left_organization"` 的 `member.update`。之後 owner 可以刪除他們，這樣他們的金鑰就會被永久撤銷。只有明確的「已離職」才算數：不在通訊錄權限範圍內的成員或失敗的請求都不會改變任何事（記錄檔會寫明哪裡失敗），最後一個 owner 也絕不會被停用。沒有通訊錄權限時什麼都不會檢查，離職的人手上的 API 金鑰會一直有效，直到 owner 停用他們；不過他們已經無法登入，主控台工作階段最多 12 小時內就會結束。

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

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
