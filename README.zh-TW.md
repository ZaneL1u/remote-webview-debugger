<!-- i18n-source: 9d368db4a362be21a3c387a4cc6eee7935f0427d -->
<div align="center">

# Remote WebView Debugger

**讓 AI agent 透過 MCP，遠端除錯真實使用者手機上的 App WebView 和 H5 頁面。**

[debugger.site](https://debugger.site) · [線上展示](https://debugger.site/#demo) · [文件](docs/architecture.zh-TW.md)

[English](README.md) | [简体中文](README.zh-CN.md) | 繁體中文 | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

只在某位使用者手機上出現、又藏在超級 App 或自家 App 的 WebView 裡的 bug 最難查：接不了傳輸線，開不了遠端除錯連接埠，在自己電腦上也重現不出來。Remote WebView Debugger 換個思路，把那個頁面直接交到你的 AI agent 手上。

- **一行指令碼**（或原生注入）就能讓頁面上線。使用者會看到一個帶有裝置碼的小膠囊，遇到問題可以點「求助」。
- **agent 透過 MCP 連線**：Claude Code、Cursor 或任何 MCP 用戶端，在使用者於手機上同意之後即可連線。它能讀取無障礙快照、console、網路請求和螢幕截圖，也能像真人一樣點擊、輸入、捲動，涵蓋這台裝置上的所有頁面和 WebView。
- **主控權始終在使用者手上。** AI 在做什麼一目了然（agent 游標、列出預定步驟的任務卡片、邊緣光暈），使用者隨時可以接管或結束。密碼、手機號碼、信用卡號在離開手機之前就已遮蔽。
- **自行架設。** 單一 Go 執行檔，內嵌主控台和 SDK；資料庫可選 SQLite 或 Postgres。

```
Claude Code / Cursor ──MCP (HTTPS)──▶ 閘道 ──WebSocket──▶ 頁面裡的 SDK ──▶ DOM · console · 網路
                                        ▲
                                     Web 主控台
```

## 快速開始

三個步驟：執行閘道，在頁面裡加上 SDK，把你的 agent 接到閘道。

### 1. 執行閘道

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

開啟 `http://<你的主機>:8080`，以 **`admin`** 和上面的密碼登入。如果沒有設定 `RWD_ADMIN_PASSWORD`，系統會產生一組隨機密碼，並在 `docker logs rwd` 裡印出一次。映像檔以 Alpine 為基礎（linux/amd64 和 linux/arm64），內嵌主控台和 SDK，所有資料都存放在 `rwd-data` volume 裡；升級時 `docker pull` 新的 tag，再重新建立容器即可。

常用設定，以 `-e` 傳入（[全部設定項目](gateway/README.zh-TW.md)）：

| 變數 | 用途 |
|---|---|
| `RWD_ADMIN_EMAIL` | 擁有者的登入名稱（預設為 `admin`） |
| `RWD_PUBLIC_URL` | 手機和 agent 存取閘道所用的位址，例如 `https://rwd.example.com/v1`；當它和你瀏覽器裡的位址不同時才需要設定 |
| `RWD_LANG=zh` | MCP 工具說明和回傳結果使用中文 |
| `RWD_DATABASE_URL` | 設為 `postgres://…` 時改用 Postgres，預設為 SQLite |
| `RWD_TRUST_PROXY=1` | 只在你自己的反向代理後面開啟：從 `X-Forwarded-*` 取得用戶端 IP 和協定 |

<details>
<summary>其他執行方式：執行檔、支援 HTTPS 的 Docker Compose、從原始碼建置</summary>

- **執行檔。** [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) 上每個閘道版本都有 Linux 和 macOS 的 `rwd_<版本>_<os>_<arch>.tar.gz`，解壓縮後執行 `./rwd serve --addr :8080`。
- **Docker Compose。** [`deploy/platform`](deploy/platform/README.zh-TW.md) 在前面加了一個 Caddy：可以放在你既有的 TLS 反向代理後面，也可以設定 `RWD_DOMAIN=<網域>`，自動申請 Let's Encrypt 憑證，直接提供 HTTPS。
- **從原始碼建置。** `make -j16`（需要 Go 和 Node），然後執行 `gateway/bin/rwd-<os>-<arch> serve --addr :8080`。

</details>

### 2. 讓頁面上線

在主控台建立專案以取得接入金鑰，接著在頁面裡加上 SDK，並填入你的閘道位址：

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

SDK 以 npm 套件 [`remote-webview-debugger`](sdk/README.zh-TW.md) 發布：可以像上面這樣從 jsDelivr 載入，也可以用 unpkg（`https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`），或是 `npm install remote-webview-debugger` 後 `import { run } from 'remote-webview-debugger'`。閘道本身也會在 `/v1/sdk.js` 提供它內嵌的那一份。

App 裡的 WebView 則要在原生程式碼中於 document start 時注入同一段指令碼（iOS 用 `WKUserScript`，Android 用 `addDocumentStartJavaScript`），詳見[原生整合](docs/native-integration.zh-TW.md)和主控台內建的整合指南。

### 3. 連接你的 agent

在主控台建立一把 API 金鑰（一把金鑰就能存取所有裝置），然後：

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

接著直接問它：*「連線到裝置 K7Q2-9M4X，查一下為什麼結帳頁的總金額顯示 `--`。」*

### 用 HTTP 還是 HTTPS？

閘道本身只用明文 HTTP 也能正常運作：SDK 會依閘道位址自動選擇 `ws://` 或 `wss://`，主控台和 MCP 兩種都能用。真正的關鍵在於**你要除錯的頁面**：瀏覽器和 WebView 不允許 `https://` 頁面載入 `http://` 指令碼或建立 `ws://` 連線（混合內容），即使 `sdk.js` 本身是從 HTTPS 的 CDN 載入的也一樣。

| 要除錯的頁面 | 閘道只用 HTTP |
|---|---|
| `http://`：本機開發伺服器、內網測試環境 | ✅ 可以 |
| 瀏覽器或 iOS `WKWebView` 裡的 `https://` 頁面 | ❌ 會被當作混合內容封鎖，閘道需要 HTTPS |
| Android WebView 裡的 `https://` 頁面 | ⚠️ 只有 App 呼叫了 `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)` 才行，且只建議用在測試版本 |

走明文 HTTP 時，API 金鑰和主控台密碼都不會加密傳輸，只適合在可信任的網路中使用。需要 HTTPS 時，可以用 [Compose 方案](deploy/platform/README.zh-TW.md)並設定 `RWD_DOMAIN=<網域>`（自動申請憑證），或把容器放在你自己的 TLS 反向代理後面，並加上 `-e RWD_TRUST_PROXY=1`。

## 功能

- **以裝置為中心。** 一台裝置（一次 App 安裝或一個瀏覽器）可以有多個頁面；一把 API 金鑰、一個 MCP 伺服器就能存取所有裝置。agent 會跟著頁面跳轉和新開啟的 WebView 走，並能看到跨頁面的時間軸。
- **完整的 agent 工具。** 帶元素 ref 的無障礙快照（Playwright 的 aria snapshot），尋找、點擊、填寫、輸入、按鍵、選取、懸停、捲動、拖曳、導覽、執行指令碼，console、含請求內容的網路記錄、儲存空間、螢幕截圖（原生截圖橋接或 DOM 繪製），批次操作、等待和事件。
- **授權與控制。** 在裝置上核准，分為 `observe` / `interact` / `advanced` 三個等級；可選自動允許；agent 操作時鎖定螢幕；接管、交還、結束；敏感操作需再次確認（`data-rwd-confirm`）。
- **隱私。** 密碼欄位、`data-rwd-mask` 以及可設定的選擇器和規則運算式，在快照、螢幕截圖、console 和網路資料中都會遮蔽。稽核記錄會記下誰做了什麼，但不含頁面內容。
- **維運。** 成員與角色；API 金鑰可設定等級、到期時間和 IP 允許清單；裝置權杖；掃描 QR Code 邀請；配額；基於 SSE 的即時主控台；Prometheus 指標。
- **11 種語言，樣式可自訂。** 主控台、手機端介面和給 agent 看的文字支援英文、簡體中文、繁體中文、法文、西班牙文、俄文、阿拉伯文（由右至左）、日文、韓文、德文和葡萄牙文：主控台跟隨瀏覽器語言（可手動切換），手機端跟隨系統語言或 `run({ lang })`，agent 端則由 `RWD_LANG` 決定。頁面 SDK 可以載入你自己的語言包、改寫文字，並透過 CSS 變數調整樣式（[SDK 的語言與樣式](sdk/README.zh-TW.md#語言)）。
- **與 eruda 相容。** 可選擇在 eruda 裡加入 Remote Debugger 分頁，也能視需要為開發者載入 eruda。

## 目錄結構

| 路徑 | 內容 |
|---|---|
| [`gateway/`](gateway) | Go 閘道：頁面 WebSocket、REST 與主控台登入驗證、MCP 伺服器、稽核、指標 |
| [`sdk/`](sdk) | 頁面 SDK（`sdk.js`）及其頁內介面 |
| [`packages/chobitsu/`](packages/chobitsu) | 內建的 [chobitsu](https://github.com/liriliri/chobitsu)，以及我們的頁面端引擎 `src/engine/` |
| [`console/`](console) | Web 主控台（React、Vite） |
| [`website/`](website) | 官方網站 [debugger.site](https://debugger.site)，含互動式展示 |
| [`examples/`](examples) | 多頁面展示商店，以及一個像 iOS App 一樣承載 WKWebView 的 macOS 應用程式 |
| [`deploy/platform/`](deploy/platform) | Docker Compose 部署 |
| [`docs/`](docs) | [架構](docs/architecture.zh-TW.md)、[協定](docs/protocol.zh-TW.md)、[原生整合](docs/native-integration.zh-TW.md)、[發布流程](docs/releasing.zh-TW.md) |

## 版本發布

頁面 SDK 和閘道分開發布，各有自己的版本號、tag（`sdk-vX.Y.Z`、`gateway-vX.Y.Z`）和變更記錄：[SDK](sdk/CHANGELOG.zh-CN.md)、[閘道](gateway/CHANGELOG.zh-CN.md)。閘道的每個版本都附有 Linux 和 macOS 的 `rwd` 執行檔，以及映像檔 `ghcr.io/zanel1u/remote-webview-debugger`。請見 [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases)；維護者請參考[發布流程](docs/releasing.zh-TW.md)。

## 開發

```bash
make -j16 check                                      # 閘道測試、SDK 型別檢查與 Playwright 測試、主控台建置
cd console && PORT=8080 npm run mock & npm run dev   # 主控台 + 記憶體中的模擬閘道
cd website && npm run dev                            # 官方網站
```

## 致謝

頁面端引擎以 [chobitsu](https://github.com/liriliri/chobitsu)（MIT）擷取 console 和網路資料，無障礙快照程式碼則來自 [Playwright](https://github.com/microsoft/playwright)（Apache-2.0）。詳見 [NOTICE](NOTICE)。

## 授權條款

[MIT](LICENSE)
