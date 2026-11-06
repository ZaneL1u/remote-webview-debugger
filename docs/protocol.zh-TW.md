<!-- i18n-source: b2dcf2a104545f4674491fa5ba7e76271a1ed374 -->
[English](protocol.md) | [简体中文](protocol.zh-CN.md) | 繁體中文 | [日本語](protocol.ja.md) | [한국어](protocol.ko.md) | [Español](protocol.es.md) | [Français](protocol.fr.md) | [Deutsch](protocol.de.md) | [Português (Brasil)](protocol.pt-BR.md) | [Русский](protocol.ru.md) | [العربية](protocol.ar.md)

# RWD 協定（v1）

本文是閘道（[`gateway/`](../gateway)）、頁面 SDK（[`sdk/`](../sdk)，引擎在 [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine)）、主控台（[`console/`](../console)）與 MCP 用戶端之間的契約。協定要改，先改本文。

整體設計（元件、授權模型、儲存、安全性）見 [architecture.zh-TW.md](architecture.zh-TW.md)；App 整合見 [native-integration.zh-TW.md](native-integration.zh-TW.md)。

慣例：

- **閘道網址**一律寫成 `https://<主機>/v1`，例如 `https://rwd.example.com/v1`。所有端點都在它底下，SDK 也只靠它推導出其餘網址。
- 一律使用 JSON。時間欄位都是 Unix **毫秒**時間戳記。
- `Level` 的值為 `"observe" | "interact" | "advanced"`（見 [§6](#6-權限等級)）。
- 接收端會忽略本文沒有列出的欄位。新增欄位一律是選填，所以舊版 SDK 連上新版閘道也能正常運作。

## 目錄

1. [端點一覽](#1-端點一覽)
2. [識別碼](#2-識別碼)
3. [頁面連線 WebSocket](#3-頁面連線-websocket)
4. [控制狀態](#4-控制狀態)
5. [頁面 RPC](#5-頁面-rpc)
6. [權限等級](#6-權限等級)
7. [接入核准](#7-接入核准)
8. [敏感操作確認](#8-敏感操作確認)
9. [輪詢備援](#9-輪詢備援)
10. [宿主 JavaScript 介面](#10-宿主-javascript-介面)
11. [專案原則](#11-專案原則)
12. [主控台 REST API](#12-主控台-rest-api)
13. [即時推送 SSE](#13-即時推送-sse)
14. [MCP](#14-mcp)
15. [語言](#15-語言)
16. [維運](#16-維運)
17. [給人用的除錯工具](#17-給人用的除錯工具)

## 1. 端點一覽

| 路徑 | 說明 |
|---|---|
| `GET /v1/sdk.js` | 頁面 SDK（IIFE，全域物件 `RemoteWebviewDebugger`）。`Cache-Control: max-age=300`、`Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | 同一個檔案，位於依內容定址、永不變動的網址（快取一年，可搭配 SRI）。`<version>` 不符時回傳 404，見 [§16](#16-維運) |
| `GET /v1/locales/<id>.js`、`GET /v1/sdk/<version>/locales/<id>.js` | SDK 按需載入的語言包，`sdk.js` 會從自己所在的目錄載入（[§15](#15-語言)）。`Cache-Control: max-age=300` |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Prometheus 指標（[§16](#16-維運)） |
| `WS /v1/page?key=<appKey>` | 頁面連線（[§3](#3-頁面連線-websocket)） |
| `POST /v1/presence` | WebSocket 連不上時的輪詢備援（[§9](#9-輪詢備援)） |
| `WS /v1/devtools?ticket=<ticket>` | 除錯工具視窗的 CDP 連線，只接受主控台自己的來源（[§17](#17-給人用的除錯工具)） |
| `/v1/api/…` | 主控台 REST API（[§12](#12-主控台-rest-api)） |
| `/v1/mcp` | 託管的 MCP 伺服器，Streamable HTTP，`Authorization: Bearer rwd_sk_live_…`（[§14](#14-mcp)） |
| `/demo/` | `--demo-dir` 指定目錄下的靜態檔案，有設定才會提供 |
| `/devtools/…` | 主控台內嵌的 Chrome DevTools 前端（[§17.4](#174-前端)） |
| 其他路徑 | 主控台單頁應用程式 |

`/v1/` 底下的未知路徑回傳 `404 {"error":{"code":"not_found",…}}`。所有回應都帶有 `X-Content-Type-Options: nosniff` 和 `Referrer-Policy: no-referrer`；SDK 以外的回應還會帶 `X-Frame-Options: DENY`，`/devtools/` 底下則帶 `SAMEORIGIN`。

## 2. 識別碼

| 名稱 | 格式 | 來源 |
|---|---|---|
| 接入金鑰（App Key） | `rwd_pk_` + 24 個 base62 字元 | 建立專案時產生。屬於公開資訊：會出現在頁面原始碼裡，只能讓頁面上線 |
| API 金鑰 | `rwd_sk_live_` + 32 個 base62 字元 | 在主控台建立，只顯示一次。伺服器端只儲存加了 pepper 的 HMAC-SHA256。主控台顯示前 16 個字元（`prefix`，例如 `rwd_sk_live_ab12`）；裝置上看到的是 `"…"` 加上 prefix 的最後 4 個字元（`keyHint`） |
| `deviceId` | UUID v4（接受任何 `[A-Za-z0-9_-]{1,64}`） | 由 SDK 產生並存在 localStorage `rwd:device`；原生宿主則以 `run({ deviceId })` 傳入 |
| 裝置碼 | `XXXX-XXXX`，字元集 `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | 閘道第一次看到某個 `deviceId` 時指派，永不改變。agent 用裝置碼接入時不分大小寫，`-` 和空格可有可無 |
| `pageId` | 12 個 base62 字元（接受任何 `[A-Za-z0-9_-]{1,64}`） | 由 SDK 產生並存在 sessionStorage `rwd:page`：同一個分頁重新載入、導覽都不變，每個新分頁各有一個 |
| 頁面標籤 | `p1`、`p2`… | 由閘道依裝置指派；頁面在 2 分鐘寬限期內重新連線時保留 |
| 工作階段（啟動）id | 宿主 App 自己的啟動 id（4–128 個 `[A-Za-z0-9_.:-]` 字元），否則是 SDK 產生的 16 個十六進位字元 | 代表 App 的一次啟動，頁面的工作階段記錄依它歸檔（[§5.4](#54-工作階段記錄)）。除了 `rwd.log` 的回傳結果，不會傳給閘道 |
| `ref` | `e12`、`o3` 等 | `eN`：頁面最近一次快照裡的元素，在下次對該頁面拍快照前有效。`oN`：快照裡沒有對應節點的元素——覆蓋層，或擋住點擊位置的那個元素（[§5.3](#53-頁面內的行為)）；只要該元素還在頁面上就一直有效 |
| 裝置權杖 | 64 個十六進位字元 | 每個 `deviceId` 只核發一次（[§3.5](#35-裝置權杖恢復權杖與邀請)），閘道只儲存雜湊值 |
| 恢復權杖 | 32 個十六進位字元 | 每次 `welcome` 都會輪替（[§3.5](#35-裝置權杖恢復權杖與邀請)），只儲存雜湊值 |

## 3. 頁面連線 WebSocket

### 3.1 生命週期

1. 頁面開啟 `wss://<主機>/v1/page?key=<appKey>`。升級為 WebSocket 之前，閘道依序檢查：
   - 速率限制：每個用戶端 IP 每分鐘最多 120 次連線（與輪詢共用額度）→ 否則 `429 rate_limited`；
   - 接入金鑰存在，且所屬專案沒有停用 → 否則 `401 bad_key`；
   - 專案設定了 `allowedOrigins` 時，`Origin` 標頭必須符合其中一項 → 否則 `403 origin_not_allowed`。
2. 只使用文字訊框，每個訊框一個 JSON 物件。上行訊息最大 16 MiB（截圖以 base64 傳回）。
3. 頁面必須在 **5 秒**內送出 `hello`。格式錯誤的 `hello`（JSON 無法解析、`t` 不對、`deviceId` / `pageId` 不合法）以 `1008` 關閉。
4. 閘道回覆 `welcome`（[§3.4](#34-welcome)），或以協定關閉碼關閉連線（[§3.6](#36-關閉碼)）。
5. 閘道每 **25 秒**送一次 `{"t":"hb"}`，同時送出 WebSocket ping，10 秒內沒收到 pong 就中斷連線。SDK **60 秒**沒收到任何訊息就重新連線。
6. SDK 重新連線採指數退避，從 1 秒到 30 秒，每次的延遲在目前級距的後半段隨機取值。**連續 3 次在收到 `welcome` 之前就中斷**，SDK 便改用輪詢（[§9](#9-輪詢備援)）。
7. 同一個 `pageId` 的新連線會取代舊連線（舊連線以 `1000 replaced` 關閉）。
8. 頁面中斷連線後，標籤與位置會保留 **2 分鐘寬限期**（頁面導覽通常一秒內就會重新連上）。超過寬限期，時間軸會記一筆 `closed`。有兩種情況會提早結束等待，避免重建的 WebView 一直以「重新連線中」掛在頁面清單裡：
   - 有頁面帶著**新的 `pageId`** 連上時，已中斷且網址相同（忽略 `#` 之後的部分）的頁面會立即被清除；
   - 已中斷的頁面，如果另一個**在線**頁面也顯示同一個網址，只等 **1.5 秒**就會被清除。

   無論哪種情況，如果被清除的正好是 agent 目前選取的頁面，選取會切換到在線的那個頁面，並在結果裡說明（[§14.3](#143-工具)）。
9. SDK 在 `pagehide` 時主動關閉連線（讓頁面能進入往返快取），在 `pageshow` 時重新連線。

每條連線都有一個 64 則訊息的傳送佇列。頁面跟不上時，閘道會以 `1013 slow consumer` 關閉它，而不是被它拖慢。

### 3.2 頁面 → 閘道

```jsonc
{"t":"hello","v":1,"sdk":"<SDK 版本>",
 "deviceId":"…","pageId":"…","openerId":"<pageId>"|null,
 "userId":"<字串>"|null,
 "page":{"url":"…","title":"…","visibility":"visible"|"hidden"},
 "device":{"ua":"…","platform":"ios"|"android"|"web",
           "screen":{"w":393,"h":852,"dpr":3},
           "app":{"name":"…","version":"…"}|null},
 "help":false,
 "deviceToken":"<權杖>"|null,    // 目前版本的 SDK 一律帶上這個欄位，見 §3.5
 "resume":"<權杖>"|null,         // 這個 pageId 上次收到的恢復權杖
 "invite":"<權杖>"|null}         // 來自 ?rwd_invite=…

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // 有變化時送出
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // 使用者請求協助 / 取消請求
{"t":"control","action":"takeover"|"handback"|"end"}                // 使用者的按鈕，§4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"t":"cdp","s":"<session>"|absent,"m":"<CDP JSON>"}                 // 除錯工具的回覆／事件，§17.2
{"id":17,"result":{…}}                                              // RPC 成功，§5
{"id":17,"error":{"code":"not_found","message":"…"}}                // RPC 失敗，§5
```

- `hello`：閘道會保存 `userId`（最長 128 字元）、`ua`（512）、`platform`（16）、`app`、`url`（2048）和 `title`（256）。`screen` 僅供參考。
- `event.summary` 是寫給 agent 看的一句話，已經去除被遮蔽的值，例如 `TypeError: Cannot read properties of undefined (reading 'orderId')`、`POST /api/order → 405`、`Tapped button "Place order"`。閘道會把每一種都記入時間軸（最長 300 位元組），不認得的 `kind` 一律忽略。頁面導覽（包括頁內導覽）不算事件：閘道從 `page` 訊息推導出導覽（時間軸上的 `navigated`，[§12.9](#129-時間軸事件)），SDK 則把它記進工作階段記錄（[§5.4](#54-工作階段記錄)）。
- SDK 會去除重複（2 秒內同類型、同摘要只送一次），每 10 秒最多送 30 則。離線期間產生的事件和控制操作會先排入佇列（最多 100 則），等下一個 `welcome` 之後再送出。
- `help` 和 `control` 只在使用者親手點按（或原生宿主呼叫，[§10](#10-宿主-javascript-介面)）時才會送出。

### 3.3 閘道 → 頁面

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"客服機器人"}|null,"level":"interact"|null,
 "attachedMs":83000|null}                                     // §4，送給裝置的所有頁面
{"t":"help","on":false}                                       // 協助請求已清除：agent 已接入、主控台成員結束了工作階段，或使用者在裝置上按了結束
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"客服機器人"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7，送給前景頁面
{"t":"attach_cancel","requestId":"…"}                         // §7，送給所有頁面
{"t":"devtools","s":"<session>","on":true,"by":"Ann"}         // §17.2，一個除錯工具視窗開啟／關閉（"on":false）
{"t":"cdp","s":"<session>","m":"<CDP JSON>"}                  // §17.2，來自該視窗的指令
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // 保留：SDK 在 afterMs 毫秒後重新連線
{"id":17,"method":"rwd.snapshot","params":{}}                 // RPC 請求，§5
```

SDK 能處理 `reconnect`，但閘道目前不會送出它。

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null,"attachedMs":null},
 "level":null,                       // 與 control.level 相同
 "resume":"<新的恢復權杖>",
 "deviceToken":"<權杖>",             // 只有這次新核發時才會出現
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},   // 也可能是 null，見下文
 "agentLang":"en",                   // 閘道的語言："en"、"zh"、"zh-TW"、"fr"…，§15
 "task":{…}}                         // 只有已接入的 agent 設定了任務時才會出現
```

`config` 是遠端設定，取自頁面所用接入金鑰對應專案的原則（[§11](#11-專案原則)）。`config.helpButton` 已經依這個頁面的 `userId` 算好（`all`，或 `listed` 且該使用者在名單內）。`config.networkExclude` 會和頁面自己在 `run({ networkExclude })` 傳入的規則合併（[§10](#10-宿主-javascript-介面)）。`config.sessionLog` 是專案對工作階段記錄的總開關，為 `false` 時頁面停止記錄，並刪除這個來源已經存下的記錄（[§5.4](#54-工作階段記錄)）。`config.eruda` 是專案的 eruda 原則（[§11](#11-專案原則)）；它也可能是 `null` 或不存在（這個欄位出現之前的閘道，或之前存下的 `config`），SDK 會把這兩種情況都當成 `{"dock":false,"load":false}`，而頁面自己的 `run({ eruda })` 仍然逐項優先（[§10](#10-宿主-javascript-介面)）。SDK 會把最近一次的 `config` 存在 localStorage `rwd:cfg`，下一個頁面在收到自己的 `welcome` 之前先沿用它。

如果有待處理的接入請求，而重新連上的正好是裝置的前景頁面，閘道會在 `welcome` 之後立即重送 `attach_request`。

### 3.5 裝置權杖、恢復權杖與邀請

**裝置權杖。** 閘道第一次從支援權杖的 SDK 看到某個 `deviceId` 時，會在 `welcome.deviceToken` 核發裝置權杖（32 位元組亂數，十六進位；伺服器端只儲存雜湊值）。此後這台裝置的每個頁面都必須在 `hello.deviceToken` 出示它，缺少或不符時以 **4401** 關閉。因此只知道 `deviceId` 和公開的接入金鑰，混不進別人的裝置。

- SDK 會把權杖存在 localStorage `rwd:dtoken`，並透過 `status().deviceToken` 公開。localStorage 依來源隔離，所以會載入多個網域的原生宿主要自行保存權杖，再以 `run({ deviceToken })` 傳回（見 [native-integration.zh-TW.md](native-integration.zh-TW.md)）。
- `hello` 只要有 `deviceToken` 欄位（即使值是 `null`），就表示 SDK 支援權杖。沒有這個欄位的 `hello` 來自無法保存權杖的舊版 SDK，閘道不會核發權杖給它（核發了反而會把這台裝置之後的頁面鎖在外面）；但裝置一旦有了權杖，每個頁面都必須出示。

**恢復權杖。** 每個 `welcome` 都會帶一個綁定 `pageId` 的新 `resume`。已知的 `pageId` 重新連線時，`hello.resume` 必須等於上一次核發的值，否則以 **4409** 關閉，SDK 改用新的 `pageId` 從頭開始。因此只知道 `pageId`，無法冒充頁面。

**邀請。** 頁面網址帶有 `?rwd_invite=<權杖>` 時，SDK 會立即把這個參數從網址列移除（`history.replaceState`），把權杖暫存在 sessionStorage，並在收到 `welcome` 之前一直隨 `hello.invite` 送出。邀請屬於同一個專案、尚未使用且未過期時，閘道就會接受：裝置被標記為「透過邀請接入」並進入「協助中」狀態，時間軸記錄它來自哪個邀請，該邀請隨即失效。無效的邀請會被默默忽略。見 [§12.6](#126-裝置邀請)。

### 3.6 關閉碼

| 關閉碼 | 意義 | SDK 的處理 |
|---|---|---|
| `1008` | `hello` 格式錯誤 | 依退避策略重新連線 |
| `1013` | 頁面消化太慢，傳送佇列滿了 | 依退避策略重新連線 |
| `4401` | 裝置權杖缺少或不符 | 如果本機權杖在此期間變了（同裝置的另一個分頁剛拿到），立即重試。如果根本沒有權杖，且 `deviceId` 是 SDK 自己產生的（不是宿主傳入的），表示攜帶權杖的 welcome 遺失了（第一個頁面在交握途中離開）：約 1.5 秒後，除非另一個分頁已經存好權杖，就換一個新的 `deviceId` 從頭開始（每個頁面最多兩次）。否則狀態變為 `rejected`，約 10 分鐘後再試 |
| `4409` | 恢復權杖不符 | 改用新的 `pageId` 重新連線 |
| `4429` | 專案的在線裝置數已達上限（`maxOnlineDevices`） | 狀態變為 `quota`，約 5 分鐘後再試 |

## 4. 控制狀態

每台裝置有一個控制狀態，由閘道決定，並透過 `control` 訊息廣播給這台裝置的所有頁面。

| 狀態 | 意義 | 頁面介面 |
|---|---|---|
| `none` | 沒有 agent 接入 | 膠囊收合，只顯示裝置碼（啟用時另有「請求協助」按鈕） |
| `observe` | agent 已接入，只在檢視 | 「AI 檢視中」，攔截使用者輸入（除非使用者關閉了鎖定），螢幕邊緣有光暈，按鈕「接管」「結束」 |
| `agent` | agent 正在操作頁面 | 「AI 操作中」，同樣的鎖定、光暈和按鈕，另有 agent 的游標 |
| `user` | 使用者已接管 | 不鎖定，邊緣光暈靜止，按鈕「交還 AI」「結束」 |

狀態轉換：

| 觸發條件 | 變化 |
|---|---|
| agent 接入（[§7](#7-接入核准)） | `none` → `observe` |
| agent 呼叫互動類工具（click、fill、type、press、select、hover、scroll、drag、navigate、back、reload） | `observe` → `agent`。處於 `user` 時，閘道直接回傳錯誤 `takeover`，不會送到頁面 |
| 超過 `policy.agentIdleMinutes`（預設 2，每 10 秒檢查一次）沒有互動 | `agent` → `observe` |
| 頁面送出 `control: takeover` | `observe` / `agent` → `user` |
| 頁面送出 `control: handback` | `user` → `agent`（沒有 agent 接入時回到 `none`） |
| 頁面送出 `control: end` | 中斷 agent 接入、清除協助請求 → `none` |
| agent 中斷連線或被取代、它的金鑰被撤銷、達到 `policy.attachMaxMinutes`（預設 60），或主控台成員結束工作階段 | → `none` |

頁面從 agent 接入（`observe`）的那一刻起就會鎖定，而不是等它開始操作；閒置後 `agent` → `observe` 也維持鎖定，直到使用者接管或狀態回到 `none`。

`attachedMs` 是閘道送出這則訊息時，目前的 agent 已經接入的毫秒數（沒有 agent 時為 `null`）。用時長而不是時間戳記，頁面就不需要和閘道對時；底部控制列在 `observe`、`agent`、`user` 狀態下會把它顯示成每秒跳動的「已連線 · 01:23」計時器，頁面自己的連線中斷時則顯示「連線中…」。閘道沒有提供這個欄位時，SDK 從頁面第一次看到 agent 時開始計時。

使用者接管期間，SDK 自己也會以 `takeover` 拒絕互動類 RPC，作為第二道檢查。SDK 會把狀態（以及 agent 接入的時間）在 localStorage `rwd:ctl` 保留 2 分鐘，所以頁面導覽後，新頁面一載入就立即鎖定、計時器接著走，不必等 `welcome`。「接管」「交還 AI」「結束」只回應使用者真實的點按，agent 按不到；原生宿主呼叫時必須出示 `nativeKey`（[§10](#10-宿主-javascript-介面)）。

## 5. 頁面 RPC

### 5.1 訊息格式

閘道向某個頁面送出 `{"id":<n>,"method":"rwd.…","params":{…}}`，頁面回覆 `{"id":<n>,"result":{…}}` 或 `{"id":<n>,"error":{"code":"…","message":"…"}}`。`id` 在一條連線內唯一。連線中斷時，進行中的呼叫會立即失敗。

閘道端逾時：MCP 呼叫 20 秒；`rwd.click`、`rwd.press` 以及帶 `submit: true` 的 `rwd.type` 為 45 秒（可能需要使用者確認，[§8](#8-敏感操作確認)）；主控台的「測試連線」為 15 秒。

錯誤碼：

| 錯誤碼 | 意義 |
|---|---|
| `not_found` | `ref` 已失效或元素已不存在、選項不存在、請求 id 不存在 |
| `not_interactable` | 不可見、已停用、被遮擋、唯讀，或 5 秒內一直不穩定 |
| `timeout` | 等待逾時（頁面內或閘道端） |
| `takeover` | 使用者已接管 |
| `forbidden` | 超出授予的等級（[§6](#6-權限等級)），或使用者拒絕了確認 |
| `bad_request` | 參數缺少或不合法、方法不存在 |
| `internal` | 其他錯誤（message 裡是 JavaScript 錯誤） |

SDK 產生的錯誤訊息使用 agent 的語言（`welcome.agentLang`，[§15](#15-語言)）。

### 5.2 方法

每個方法都作用於收到它的那個頁面。

| 方法 | 等級 | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<毫秒>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}`：Playwright AI 格式的無障礙快照（YAML，元素標上 `[ref=eN]`）；有東西浮在頁面內容上方時，末尾會附上一段覆蓋層清單（[§5.3](#53-頁面內的行為)） |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}`（至少一個條件；`limit` 1–100） | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`，見 [§5.4](#54-工作階段記錄) | 依 `op` 而定 |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}`：Playwright 按鍵名稱，支援 `Control+A` 這類組合鍵 | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}`（頁面隨後會重新連線） |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | 一筆工作階段記錄的完整內容：`{"seq","session","at","kind","page","imp","size","data"}`，含標頭與本文（[§5.4](#54-工作階段記錄)） |

說明：

- `rwd.query`：`role` 精確比對（不分大小寫），`name` 和 `text` 以不分大小寫的子字串比對；`text` 涵蓋元素本身及其後代的文字，只回傳最內層的符合項目。
- `rwd.fill` 適用於文字輸入框、textarea 和 `contenteditable` 元素（`<label>` 會轉向它所關聯的控制項）。它透過原生 value setter 寫入值，再派送 `input` 和 `change`，因此 React、Vue 的受控元件都能察覺變化。`<select>` 要用 `rwd.select`。
- `rwd.type`：有給 `ref` 就先聚焦它（游標移到最後），否則輸入到目前聚焦的元素；`submit: true` 時輸入完會按 Enter。
- `rwd.select` 會把每個值依序與選項的 value、label、文字比對。傳入多個值時，下拉選單必須是 `multiple`。
- `rwd.scroll`：不帶 `ref` 時捲動整個頁面；帶 `ref` 時在元素上派送 wheel 事件，並捲動它所在的可捲動容器。捲動有約 0.3 秒的動畫，方便使用者跟上。
- `rwd.navigate` 只接受 `http(s)` 網址（絕對或相對網址皆可）。導覽、返回上一頁、重新載入都會在回覆送出 50 毫秒後才執行。
- `rwd.waitFor`：先等待 `timeMs`（最多 60 秒），再每 100 毫秒檢查一次可見文字（`document.body.innerText`），直到 `text` 出現且 `textGone` 消失；超過 `timeoutMs` 則回傳 `timeout`。
- `rwd.screenshot`：宿主 App 有註冊原生截圖，且截圖區域在可視區域內時，使用原生截圖（`source: "native"`）；否則重新繪製 DOM（`source: "dom"`，canvas、影片和跨來源圖片可能是空白）。`ref` 只擷取該元素；`fullPage` 擷取整份文件。見 [§10](#10-宿主-javascript-介面)。
- `rwd.console` / `rwd.network`：帶 `sinceId` 時，依時間順序回傳它之後最早的 `limit` 筆；不帶時回傳最新的 `limit` 筆。進行中的請求 `status` 為 0、`durationMs` 為 `null`；`type` 的值為 `xhr`、`fetch`、`websocket`、`beacon`、`eventsource`。
- `rwd.network` 會略過符合排除規則的請求——專案原則的 `networkExclude` 加上 `run({ networkExclude })`（[§11](#11-專案原則)），再加上只對本次呼叫生效的 `exclude`——`hidden` 是被隱藏的筆數。`includeExcluded: true` 時全部回傳，`hidden` 為 0。被排除的請求頁面仍然會記錄，`rwd.networkDetail` 也照樣能依 id 取得。
- `rwd.networkDetail` 會把 `Cookie`、`Set-Cookie`、`Authorization`、`Proxy-Authorization` 標頭替換為 `••••`；本文經過遮蔽，最多 64 KB。
- `rwd.storage` 最多回傳 500 筆，每個值最多 4000 字元。cookie 只包括指令碼讀得到的（非 HttpOnly）。SDK 自己的 `rwd:dtoken`、`rwd:resume` 一律被遮蔽。
- `rwd.evaluate` 在頁面的全域範圍內對函式原始碼求值，並以 `this = window` 呼叫，可以回傳 Promise。結果會轉成可安全序列化的 JSON：`undefined` 和函式變成 `null`，DOM 元素變成簡短的標籤描述，日期變成 ISO 字串，循環參照變成 `"[Circular]"`。

### 5.3 頁面內的行為

- **可操作性檢查。** 指標類操作最多等待 5 秒，直到元素已掛載、可見、連續兩個動畫影格位置不變、未停用、已捲動到可視區域內，而且在目標點做命中測試時命中元素本身或其後代。先試元素可見區域的中心點（就像手指一樣）；中心被擋住時，再依序試它可見矩形內 3×3 格點上的其他點，所以按鈕上蓋了個徽章也點得到。所有點都被擋住時，呼叫以 `not_interactable` 失敗，錯誤訊息會指出遮擋元素和它的 `ref`（*點擊位置被 `<div.popup-mask>` 遮住（遮擋元素 ref=o1，可以直接點擊它…）*），agent 可以改點它。命中測試會略過 SDK 自己的介面和其他除錯工具（`.__chobitsu-hide__`、`#eruda`、`#__pageSpy`、`#__vconsole`）。
- **覆蓋層。** 頁面上有覆蓋層（彈出視窗的遮罩、對話框、底部彈出面板）時，快照末尾會附上一段 `[Overlays]` 清單。做法是對可視區域上的幾個點做命中測試，留下位於 `fixed`（或佔滿可視區域的 `absolute`）方塊內、覆蓋可視區域至少 15%、而且本身沒有包含快照裡一半元素的那一層（包含一半的話就是 App 自己的根節點，而不是蓋在上面的覆蓋層）。每一行列出元素標籤、它的一小段文字（已遮蔽敏感內容）、覆蓋可視區域的比例和一個 `ref`；沒有文字也沒有圖片、影片等媒體的，列為「遮罩」。空的遮罩在無障礙快照裡沒有節點，所以拿到的是 `oN` 形式的 ref——agent 正是靠它點按遮罩來關閉彈出視窗。
- **合成輸入。** 一次點擊會派送 `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click`，在觸控裝置上同時派送 touch 事件。這些事件的 `isTrusted` 為 false，會檢查這個屬性的頁面不會有反應。
- **視覺回饋。** 目標元素會短暫醒目提示，派送輸入前，頁面上的 AI 游標會先移到目標位置。
- **遮蔽。** `input[type=password]`、帶有 `data-rwd-mask` 的元素，以及符合專案 `maskSelectors` 的元素，它們的值在快照和截圖中會替換為 `••••`（原生截圖會蓋上灰色方塊）。這些值，以及符合 `maskPatterns` 的文字，在 console 文字、網路網址與本文、儲存值和事件摘要中也會被替換。
- **快照範圍。** 快照以 `<body>` 為根。SDK 自己的介面位於 `<html>` 底下、`<body>` 之外的 Shadow DOM 中；eruda、PageSpy、vConsole 的節點會從快照中剔除。
- **緩衝區。** 從 SDK 載入起就開始記錄 console、未攔截的錯誤和網路請求（XHR、fetch、WebSocket、sendBeacon、EventSource），各用一個最多 500 筆的環形緩衝區。滿了之後先丟棄一般記錄和成功的請求，`dropped` 會回報丟棄的數量。回應本文的快取總共不超過 5 MB，單筆不超過 64 KB。

### 5.4 工作階段記錄

[§5.3](#53-頁面內的行為) 的緩衝區只存在單一頁面的記憶體中。**工作階段記錄**是它的長期版本：從 App 啟動以來，這個來源（origin）上發生的一切，由該來源的每個頁面寫入 **IndexedDB**（資料庫 `rwd-log`），不論閘道連不連得上都照樣記錄。因此 agent 事後才接入，也能把一個 bug 的來龍去脈完整讀出來，橫跨重新載入與多個頁面。除非已接入的 agent 主動讀取，這些資料不會離開裝置。

**一個工作階段就是 App 的一次啟動。** 工作階段 id 依下列順序決定：

1. `run({ launchId })`——宿主 App 自己的啟動 id，每次冷啟動產生一個，同一個行程裡的所有 WebView 共用；
2. `window.RWDLaunchId`，由宿主或整合程式碼定義：一個字串，或一個回傳字串（或字串 Promise，最多等 300 毫秒）的函式；
3. 由 SDK 推斷：一個工作階段 cookie `rwd_launch`（不設到期時間，所以會隨 App 行程結束而消失），再加上每 10 秒一次的心跳。一個 cookie 工作階段超過 **1 小時**沒有動靜，就視為上一次啟動，另起一個新 id——藉此涵蓋那些跨啟動保留工作階段 cookie 的 WebView。

工作階段的 `source` 欄位說明它來自哪一種方式：1、2 為 `app`，3 為 `cookie`。

**記錄哪些內容。** 每筆記錄都有 `seq`（主鍵，遞增）、`at`、`kind`、`page`（寫入它的頁面的 `pageId`）和 `data`：

| `kind` | `data` |
|---|---|
| `page` | `event: "open"`（url、title、referrer）、`"nav"`（from、url、title，包括頁內導覽）、`"visibility"`（前景 / 背景）、`"hide"`（頁面離開） |
| `action` | 使用者自己的（可信）操作：`"tap"`（元素描述）、`"input"`（欄位描述和值）、`"submit"`、`"scroll"`（捲動停下的位置）。密碼欄位、帶有 `data-rwd-mask` 的元素和符合 `maskSelectors` 的欄位，值一律存成 `••••`，絕不存明文；其他值依 `maskPatterns` 遮蔽，並截斷到 200 字元 |
| `agent` | agent 的互動類呼叫和 `rwd.evaluate`：方法名稱、`ref`、按鍵、url、values、文字，失敗時還有錯誤。讀取類呼叫（快照、各種清單）不記錄 |
| `control` | 控制狀態變化及 agent 名稱（[§4](#4-控制狀態)） |
| `console` | 所有層級，帶有 `type`、`text`、`source` |
| `net` | 每個已結束的請求：方法、url、狀態碼、類型、耗時、大小、錯誤。**失敗的**請求還帶有 `reqHeaders` / `resHeaders`（去識別化方式同 `rwd.networkDetail`）和 `reqBody` / `resBody`，各自截斷到 64 KB |

console 的 error 和 warn、失敗的請求、使用者的點按 / 輸入 / 送出、agent 操作和控制狀態變化會被標為重要，保留最久。`problems` 和 `overview` 所說的「問題」，指的是 console 錯誤和失敗的請求。

**容量限制。** 保留最近 **3** 次啟動，每次不超過 **10 MB**。超出後先丟棄最舊的非重要記錄（一般 console 記錄、成功的請求），再丟棄最舊的所有記錄，直到降到上限的 80%；丟棄的筆數記在 `trimmed`。如果 `navigator.storage.estimate()` 回報的配額低於 64 MB，就只保留目前這次啟動。沒有 IndexedDB（某些無痕模式）時什麼都不記錄，`rwd.log` 回傳 `internal`。

**讀取。** `rwd.log` 以 `op` 區分：

```jsonc
// op: "sessions" → 仍保存著的每次啟動，新的在前
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview"，參數 {"session"?} → 一次啟動的概覽
{"session":{…meta…,"current":true},"first":<毫秒>,"last":<毫秒>,
 "pages":[{"at","page","data"}],      // page 的 open / nav 記錄，最近 60 筆
 "problems":[…記錄…]}                // console 錯誤和失敗的請求，最近 20 筆

// op: "records"，參數 {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                     "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                     "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // 下一頁時當作 `after` 傳回來
 "hidden":0}                          // 被網路排除規則隱藏的請求筆數（§11）
```

- `session` 預設為目前這次啟動（傳 `"current"` 等同於不傳）；id 不存在時回傳 `not_found`。目前沒有在記錄時，使用保存著的最新一次。
- `problems: true` 只回傳 console 錯誤和失敗的請求。`text` 對記錄的 `data` 做不分大小寫的子字串比對。`limit` 範圍 1–500，預設 100。
- 回傳的記錄**不含**標頭和本文；有本文時 `data.hasBody` 為 `true`。要看完整內容請用 `rwd.logDetail`，它和 `rwd.networkDetail` 一樣需要 `advanced`（[§6](#6-權限等級)）。
- 網路排除規則在這裡同樣生效：符合規則的 `net` 記錄不會出現在 `records` 中，而是計入 `hidden`，除非有傳 `includeExcluded`。

**關閉記錄。** `run({ record: false })` 讓單一頁面不寫入。`policy.sessionLog: false`（[§11](#11-專案原則)）透過 `welcome.config.sessionLog` 送達頁面，頁面會停止記錄，**並刪除這個來源已經存下的記錄**。`status().logSession` 是目前頁面正在寫入的工作階段 id，沒有在記錄時為 `null`。

## 6. 權限等級

| 等級 | 允許的方法 |
|---|---|
| `observe` | `rwd.ping`、`rwd.snapshot`、`rwd.query`、`rwd.screenshot`、`rwd.console`、`rwd.network`、`rwd.waitFor`、`rwd.log` |
| `interact` | `observe` + `rwd.click`、`rwd.fill`、`rwd.type`、`rwd.press`、`rwd.select`、`rwd.hover`、`rwd.scroll`、`rwd.drag`、`rwd.navigate`、`rwd.back`、`rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`、`rwd.networkDetail`、`rwd.storage`、`rwd.logDetail` |

一次接入的實際等級為：

```
min(agent 申請的等級（預設 interact），
    API 金鑰的 maxLevel，
    金鑰建立者的角色允許的最高等級（§12.4），
    合併後專案原則的 maxLevel，
    使用者在裝置上選擇的等級)
```

兩端都會把關：閘道拒絕超出等級的呼叫（錯誤 `forbidden`，稽核記錄 `policy.denied`）；SDK 在執行前會再依 `welcome.level` / `control.level` 檢查一次。閘道把未知的方法視為 `advanced`。agent 已接入而閘道沒有送出等級時，SDK 以 `interact` 處理。

## 7. 接入核准

agent 呼叫 `connect_device` 時，閘道會先合併裝置上已開啟頁面所屬各專案的原則（[§11](#11-專案原則)）。合併後的 `approval` 為 `prompt` 時，必須由使用者在裝置上核准：

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"客服機器人","keyHint":"…a91f"},
   "levels":["observe","interact"],   // 可選的等級，已依金鑰和原則裁剪；最後一個是 agent 申請的等級
   "expiresInSec":30,
   "purpose":"devtools"}              // 只有主控台成員要求除錯工具時才會出現（§17.1）
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // 或以 "level": null 表示拒絕
← {"t":"attach_cancel","requestId":"…"}                         // 逾時，或 agent 放棄了
```

- 請求只送給裝置的**前景頁面**；`attach_cancel` 送給所有頁面。
- **30 秒**內沒有回覆即視為逾時。MCP 呼叫會一直等到有結果。
- 同一把 API 金鑰在同一台裝置上 10 分鐘內被拒絕 **3 次**後，**10 分鐘**內對這台裝置的請求會直接被拒，不再詢問使用者。
- 一台裝置同時只能有一個待處理的請求。
- SDK 的確認對話框位於 Shadow DOM 中，只回應可信的點按，而且出現 0.4 秒後才生效，agent 無法替使用者按「允許」。同一來源的多個分頁透過 BroadcastChannel 共享決定。
- 使用者可以在 SDK 浮動視窗中開啟**自動允許** AI 接入並設定最高等級；之後 SDK 會直接以不超過這個等級的最高可選等級回覆，並顯示提示。自動允許只適用於 agent：除錯工具的請求一律會詢問使用者。
- `run({ nativeApproval: true })` 時 SDK 不跳出對話框，而是讓 `status().pending` 變成 `{kind:"attach", requestId, agent:{name, keyHint}, levels, purpose, expiresAt}`（`purpose` 為 `"agent"` 或 `"devtools"`），由原生宿主呼叫 `nativeDecide(nativeKey, requestId, level | null)` 回覆。
- 核准後，閘道讓 agent 接入（取代裝置上的其他 agent），清除協助請求（`{"t":"help","on":false}`），並廣播 `{"t":"control","state":"observe","agent":{…},"level":"interact","attachedMs":0}`；頁面隨即鎖定（[§4](#4-控制狀態)）。

`approval: none` 時，agent 直接以計算出的等級接入。

**短時間內再接入不必重新核准。** agent 自己放開裝置時——呼叫 `disconnect_device`、改為接入另一台裝置，或 `policy.attachMaxMinutes` 時間到——閘道會留下一份授權：**10 分鐘**內同一把 API 金鑰再次接入這台裝置，手機上不會再跳出對話框，等級**不超過使用者上次授予的等級**（上次給的是 `observe`，這次申請 `advanced` 也只會拿到 `observe`）。其餘限制一律不放寬：金鑰、專案原則和 agent 自己申請的等級照樣設下上限，裝置也必須有已連線的頁面。這種接入除了一般的 `attach.start`，還會多記一筆 `attach.resume` 稽核記錄（[§12.7](#127-稽核記錄)）；頁面收到的是一般的 `control` 訊息，而不是 `attach_request`。

這份授權不會因為使用而耗盡：再次放開裝置時，10 分鐘重新起算。工作階段以其他方式結束時，授權立即失效：使用者在裝置上按「結束」、主控台成員結束工作階段（`POST /devices/:id/end`）、API 金鑰被撤銷、另一個 agent 接入這台裝置取代了它，或使用者拒絕了一次請求。授權只存在記憶體中，閘道行程結束後也就跟著消失。

## 8. 敏感操作確認

agent 進行下列操作之前，SDK 會先請使用者確認：

- 點擊（`rwd.click`）符合 `[data-rwd-confirm]` 或原則中 `confirmSelectors` 的元素，或位於這類元素內部的元素；
- 在這類元素上，或在包含這類元素的表單中按 Enter（`rwd.press`，或 `submit: true` 的 `rwd.type`）。在 textarea 和富文字編輯器中按 Enter 不算。

確認對話框的文案類似 *AI 想要點擊「送出訂單」，允許嗎？*，只回應可信的點按，**30 秒**後失效。拒絕或逾時時，RPC 會以 `{"code":"forbidden","message":"The user denied this action"}` 失敗（訊息語言見 [§15](#15-語言)）。同一時間只能有一個確認對話框；使用者接管、agent 離開或連線中斷時，確認對話框會自動取消。

`nativeApproval: true` 時，`status().pending` 會變成 `{kind:"confirm", requestId, action:'click "Place order"', expiresAt}`，由宿主呼叫 `nativeDecide(nativeKey, requestId, "allow" | null)` 回覆。在 `status().pending` 中，確認請求優先於接入請求。

## 9. 輪詢備援

WebSocket 連續失敗 3 次後，SDK 改為每 60 秒呼叫一次 `POST /v1/presence`。請求以 `Content-Type: text/plain` 傳送 JSON 本文，這樣跨來源時不會觸發 CORS 預檢；閘道回應 `Access-Control-Allow-Origin: *`。

```jsonc
// 請求
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// 回應
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- 閘道使用 `key`、`deviceId`、`userId`、`device.{ua, platform, app}`、`deviceToken` 和 `help`；`pageId` 和 `page` 僅供參考。接入金鑰和來源的檢查與 WebSocket 相同，速率限制也共用。
- 已經核發過裝置權杖（[§3.5](#35-裝置權杖恢復權杖與邀請)）的裝置，輪詢時也必須帶上它；否則回傳 `401 bad_token`，裝置的任何資訊都不會更新。沒有權杖的裝置（舊版 SDK）可以繼續不帶權杖輪詢。
- `help: true` 會把裝置標記為「協助中」，作用與 `hello.help` 相同；已有 agent 接入時不生效。
- 每次輪詢後，裝置在 90 秒內都算在線。
- `connect: true` 表示頁面應該立即建立 WebSocket 連線。agent 對這台裝置呼叫 `connect_device` 或 `wait_for_device` 時，閘道會設定它。
- 作為保險，SDK 每到第 5 次輪詢也會主動重試一次 WebSocket。

## 10. 宿主 JavaScript 介面

SDK 公開全域物件 `window.RemoteWebviewDebugger`。頁面直接呼叫 `run()`；原生宿主注入 SDK 後，帶著更多選項呼叫 `run()`（見 [native-integration.zh-TW.md](native-integration.zh-TW.md)）。

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null：目前登入的使用者，agent 和主控台都看得到
  helpButton,            // 顯示「請求協助」按鈕（與原則的 helpButton 取 OR）
  app,                   // 宿主 App 的 { name, version }
  lang,                  // 語言標記：手機使用者看到的介面語言，預設取自 navigator.languages（§15）
  locales,               // 額外的語言包；messages：依語言覆寫文字（§15）
  theme,                 // 'auto'（預設）| 'system' | 'light' | 'dark'
  style,                 // 顏色、字型、圓角、z-index、位置，即 --rwd-* CSS 屬性（見 sdk/README.zh-TW.md）
  lockScreen,            // agent 接入期間鎖定頁面（預設 true，使用者可以在浮動視窗中更改）
  eruda,                 // true | { dock, load, src, name }：以 eruda 分頁的形式出現
  networkExclude,        // 不讓 agent 看到的請求（§11）
  record,                // 是否保留工作階段記錄（預設 true，專案原則可以關閉，§5.4）
  // 原生宿主
  deviceId,              // 每次安裝一個 id，所有 WebView、所有網域共用
  deviceToken,           // status().deviceToken 中的權杖，由宿主保存
  launchId,              // App 的這一次啟動，同一行程的所有 WebView 共用（§5.4）
  nativeKey,             // 只有宿主知道的密鑰，用來啟用 nativeControl / nativeDecide
  nativeApproval,        // 由宿主自行顯示接入核准和操作確認
}) // → Promise<{ deviceCode, status }>
```

| 函式 | 說明 |
|---|---|
| `run(gatewayUrl, appKey, options?)` | 讓頁面上線。閘道回覆後 resolve，最晚 8 秒後依已知資訊 resolve。重複呼叫會回傳同一個 Promise |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`。`status` 的值為 `idle`、`connecting`、`online`、`polling`、`rejected`、`quota`、`stopped`；`logSession` 是本頁面正在寫入的工作階段記錄 id，沒有在記錄時為 `null`（[§5.4](#54-工作階段記錄)） |
| `help(on = true)` | 請求協助，或取消請求 |
| `setUser(userId)` | 切換目前登入的使用者（SDK 會以新的 `hello` 重新連線） |
| `stop()` | 中斷連線並移除介面；console 和網路記錄會在有上限的緩衝區中繼續進行 |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | 原生宿主自己的「接管」「交還 AI」「結束」按鈕。密鑰不符時回傳 `false` |
| `nativeDecide(nativeKey, requestId, value)` | 回覆 `status().pending`：`attach` 傳入等級或 `null`，`confirm` 傳入 `'allow'` 或 `null`。密鑰、請求或值不正確時回傳 `false` |

**啟動 id。** 除了 `run({ launchId })`，宿主也可以在 SDK 執行前定義 `window.RWDLaunchId`：一個字串，或一個回傳字串或字串 Promise 的函式（最多等 300 毫秒）。它必須是 4–128 個 `[A-Za-z0-9_.:-]` 字元，否則會被忽略，由 SDK 自行推斷這次啟動（[§5.4](#54-工作階段記錄)）。

`nativeKey` 只寫在注入的指令碼中，並以常數時間比對。頁面指令碼（包括 agent 的 `evaluate_script`）讀不到它，因此無法替使用者交還控制權，也無法自行核准接入。

**原生截圖橋接。** 宿主只要註冊下列任何一個，`rwd.screenshot` 就會用它取得真實像素（影片、canvas、跨來源圖片、蓋在頁面上的原生檢視都包含在內）。它們都回傳可見 WebView 的 PNG 或 JPEG data URL，或不帶前綴的 base64：

| 橋接 | 平台 |
|---|---|
| `window.RWDNativeScreenshot()` | 任何宿主；回傳 `string` 或 `Promise<string>` |
| `webkit.messageHandlers.rwdScreenshot` | iOS / macOS `WKWebView`，註冊為 `WKScriptMessageHandlerWithReply`；收到的訊息是 `{type:"screenshot"}` |
| `window.RWDAndroid.screenshot()` | Android，`@JavascriptInterface` 方法 |

參考實作：[`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift)。

## 11. 專案原則

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt：每次接入都要使用者在裝置上核准（預設 prompt）
  maxLevel: Level                  // 本專案允許的最高等級（預設 interact）
  maskSelectors: string[]          // 額外要遮蔽的 CSS 選擇器（密碼欄位和 [data-rwd-mask] 之外）
  maskPatterns: { name: string; regex: string }[]  // 依正規表示式遮蔽文字，例如手機號碼、身分證號（JavaScript 正規表示式）
  confirmSelectors: string[]       // 點擊這些元素前需要使用者確認（[data-rwd-confirm] 之外）
  networkExclude: string[]         // 不出現在 agent 看到的網路清單中的請求（§5.2）
  sessionLog: boolean              // 頁面是否保留工作階段記錄（預設 true，§5.4）
  helpButton: 'off' | 'all' | 'listed'   // 誰看得到「請求協助」按鈕（預設 off）
  helpUsers: string[]              // helpButton = listed 時的 userId 名單
  agentIdleMinutes: number         // AI 操作中閒置多久後回到僅檢視（預設 2，最大 120）
  attachMaxMinutes: number         // 一次接入的最長時間（預設 60，最大 1440）
  maxOnlineDevices: number         // 0 表示不限；超出時新裝置以 4429 關閉
  maxAgents: number                // 本專案的裝置上同時接入的 agent 數；0 表示不限
  eruda: { dock: boolean; load: boolean }  // run({ eruda }) 的遠端預設值，本機選項逐項優先。
                                           // 在 welcome.config 中可能是 null 或不存在（等同兩者皆為 false），§3.4
  devtools: 'on' | 'off'          // admin 可以從主控台開啟本專案頁面上的除錯工具（預設為開啟），§17
}
```

- 儲存時會正規化：`approval` 不是 `none` 的一律視為 `prompt`，無效的 `maxLevel` 視為 `interact`，數值會被限制在允許範圍內。`maskPatterns` 必須能編譯，否則回傳 `400 bad_policy`。`maskSelectors`、`confirmSelectors`、`networkExclude`、`helpUsers` 會去除空白項目，各自最多 50 筆，`maskPatterns` 最多 20 筆。
- **`networkExclude`** 用來擋掉 agent 不必去翻找的雜訊：一直 404 的字型、數據分析上報等。每條規則依下列方式與請求網址比對：不分大小寫的子字串；含 `*` 的萬用字元模式（`*/404/*`）；寫成 `/…/` 時為正規表示式（可帶旗標，預設為 `i`）。無法編譯的規則什麼都不比對。符合的請求不會出現在網路清單中，也不會產生 `net_fail` 時間軸事件，但頁面仍然會記錄，agent 需要時可以用 `includeExcluded` 查看（[§5.2](#52-方法)、[§14.3](#143-工具)）。它只是為了清爽，不是隱私手段——不該離開頁面的資料要用 `maskSelectors` / `maskPatterns`。
- **`sessionLog`** 只要沒有明確設為 `false` 就是開啟，包括這個欄位出現之前儲存的舊專案。關閉後，專案下所有頁面都會停止記錄，並刪除這些裝置上該來源已存下的記錄；單一頁面也可以用 `run({ record: false })` 自行退出（[§5.4](#54-工作階段記錄)）。
- 遮蔽、確認、網路排除、工作階段記錄、協助入口和 eruda 相關欄位，透過 `welcome.config` 送達頁面（[§3.4](#34-welcome)）；頁面自己在 `run({ networkExclude })` 傳入的規則會與專案的規則合併。
- **一台裝置上有多個專案的頁面。** 裝置以 `deviceId` 區分，不分專案：同一支手機以不同接入金鑰載入的頁面，都是同一台裝置的頁面。agent 接入時，閘道會合併已連線頁面所屬各專案的原則，每一項取最嚴格的值：任一專案要求核准就需要核准；`maxLevel`、`agentIdleMinutes`、`attachMaxMinutes` 取最小值；`maxAgents` 取最小的非零值。

## 12. 主控台 REST API

### 12.1 慣例

- 基礎路徑為 `/v1/api`。以 `POST /auth/login` 登入，工作階段保存在 HttpOnly cookie `rwd_session` 中（12 小時，`SameSite=Lax`，透過 HTTPS 時帶 `Secure`）。每次請求都會重新讀取帳號，所以停用或刪除成員會立即生效。
- 需要登入的端點，除了 `GET` / `HEAD` 以外的請求都必須帶上 `X-RWD-CSRF: 1`，否則回傳 `403 csrf`。
- 錯誤一律為 `{"error":{"code":"…","message":"…"}}`，搭配 4xx/5xx 狀態碼。message 的語言依請求而定（[§15](#15-語言)）。
- 常見錯誤碼：`401 unauthorized`（未登入）、`403 forbidden`（角色權限不足）、`403 csrf`、`404 not_found`、`400 bad_request`、`429 rate_limited`、`500 internal`。

角色：`owner`（所有權限，包括成員管理）；`admin`（專案、所有人的 API 金鑰、原則、裝置、邀請、稽核、運行狀況）；`member`（檢視專案和裝置、測試連線、結束工作階段、建立裝置邀請、建立和撤銷自己的 API 金鑰、檢視稽核記錄）。下表中的 *member* 指任何已登入的帳號。

### 12.2 帳號與成員

| 方法 | 路徑 | 角色 | 請求 | 回應 |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}` 並寫入 cookie。密碼錯誤時 `401 bad_password`；每個 IP 每分鐘超過 10 次時 `429 rate_limited`。`email` 空白時視為 `admin` |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`。新密碼須為 8–256 個字元；舊密碼不正確時 `400 bad_password` |
| GET | `/auth/oidc/start?redirect=/path` | — | — | `302` 重新導向到單一登入的提供者，同時寫入簽章 cookie `rwd_oidc`（存放 state 和 PKCE verifier，10 分鐘有效）。未啟用單一登入時 `404` |
| GET | `/auth/oidc/callback` | — | 提供者傳回的 `code` 和 `state` | 完成登入並 `302` 重新導向到 `redirect`（須為主控台路徑，否則導向 `/`）。失敗時 `302` 到 `/login?sso_error=<code>`：`provider`、`denied`、`state`、`not_allowed`、`no_account`、`conflict`（使用該電子郵件的成員已連結到該提供者的另一個身分）、`disabled`、`rate_limited` |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity","sso"}`。`sso` 為 `null`；啟用單一登入時為 `{"provider","name","defaultRole","inviteOnly"}` |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<主機>/invite/<token>"}`（7 天內有效，只能使用一次）。電子郵件已存在時 `409 conflict` |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`。會導致沒有可用 owner 時 `409 last_owner` |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`。`409 self`、`409 last_owner` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}` 並登入。與登入共用速率限制 |

第一個 owner 會在閘道啟動時依 `RWD_ADMIN_EMAIL`（預設 `admin`）和 `RWD_ADMIN_PASSWORD` 建立（見 [gateway/README.zh-TW.md](../gateway/README.zh-TW.md)）。主控台頁面 `/invite/:token` 用來接受成員邀請。

除了密碼，也可以用飛書、Lark 或 OpenID Connect 提供者單一登入（`RWD_OIDC_*`，見 [gateway/README.zh-TW.md](../gateway/README.zh-TW.md#單一登入)）。登入頁上的按鈕會開啟 `/auth/oidc/start`；提供者把瀏覽器送回 `/auth/oidc/callback`，由它寫入同一個 `rwd_session` cookie。身分會先依提供者的 subject 查找；找不到就連結到電子郵件相同的成員（同時接受該成員尚未接受的邀請）；仍然沒有的話，就以預設角色建立新帳號，除非閘道設為僅限受邀成員。這些帳號就是一般成員：owner 可以照上面的方式變更角色、停用或刪除。

### 12.3 專案

| 方法 | 路徑 | 角色 | 請求 | 回應 |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project`（套用預設原則） |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`。`policy` 會合併到現有原則上 |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | 換上新接入金鑰的 `Project` |
| GET | `/projects/:id/integration` | member | — | `Integration` |

`allowedOrigins` 的每一項都是完整的來源，例如 `https://m.example.com`，可以有一個開頭的萬用字元標籤：`https://*.example.com` 符合任何子網域，但不符合 `https://example.com` 本身。留空表示不限制。`inviteUrl` 必須是 `http(s)` 網址。

### 12.4 API 金鑰

API 金鑰屬於建立它的成員，而不屬於某個專案：一把金鑰可以存取所有裝置。沒有建立者的金鑰（在金鑰歸屬到成員之前建立的，以及示範金鑰）是*閘道金鑰*：只有 owner 和 admin 能檢視與撤銷。

| 方法 | 路徑 | 角色 | 請求 | 回應 |
|---|---|---|---|---|
| GET | `/keys?mine=1` | member | — | `{"keys":[ApiKey]}`：owner 和 admin 會拿到所有金鑰，member 只拿到自己的。`mine=1` 對任何角色都只回傳呼叫者自己的金鑰 |
| POST | `/keys` | member | `{"name","maxLevel"?:"interact","expiresInDays"?:0,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}`：完整的金鑰只會在這裡回傳這一次。金鑰屬於呼叫者；`maxLevel` 超出呼叫者角色允許的等級時回傳 `403 forbidden` |
| DELETE | `/keys/:id` | member | — | `{"ok":true}`。member 只能撤銷自己的金鑰（別人的會收到 `404 not_found`）；owner 和 admin 可以撤銷任何金鑰。撤銷立即生效：該金鑰的 agent 會被中斷接入，它的下一個 MCP 請求會收到 401 |

`expiresInDays: 0` 表示永不過期。`ipAllowlist` 填入 IP 或 CIDR；設定後，其他位址送來的 MCP 請求會收到 401。`GET` / `POST /projects/:id/keys` 是 `/keys` 的舊路徑，效果相同。

各角色可用的等級：owner 和 admin 建立的金鑰最高為 `advanced`，member 最高為 `interact`。`advanced`（頁面 JavaScript、儲存空間、完整的請求本文）和開啟 DevTools（§17）一樣敏感，而 DevTools 只開放給 admin。每次使用金鑰時也會套用這個上限，所以建立者被降級後，他的金鑰最多只能以新角色的等級運作（§6）。

金鑰只在建立者還能登入時有效。停用成員會讓他的金鑰失效（MCP 請求收到 401，`ApiKey.ownerDisabled` 為 `true`），並中斷他的 agent；重新啟用後金鑰恢復可用。刪除成員會撤銷他的金鑰。降低成員的角色會中斷他名下超出新角色等級的金鑰的 agent。

### 12.5 裝置與閘道狀態

| 方法 | 路徑 | 角色 | 回應 |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}`（`pageSize` 最大 100）。`online`（預設）：在線裝置，依本次上線時間由新到舊。`all`：所有出現過的裝置，依首次出現時間由新到舊。兩種模式下 `q` 都會比對裝置 ID、裝置碼（`-` 可省略）、userId、UA、系統描述（中英文皆可）和專案名稱 |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}`：最近一個頁面來自該專案的裝置（預設 `all`，最多 500 台）。請求協助的排在最前，其次是在線的，再依最近在線時間排序。`waiting` 指請求協助（介面上顯示為「協助中」） |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | 一律回傳 `200`：`{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<前 4000 個字元>","error"?:{"code","message"}}`。錯誤碼：`device_offline`、`no_page`（頁面正在重新連線）、`timeout`、`takeover`、`internal`，以及 [§5.1](#51-訊息格式) 的 RPC 錯誤碼 |
| POST | `/devices/:id/end` | member | `{"ok":true}`：中斷 agent 接入、清除協助請求，控制狀態回到 `none`，並關閉所有除錯工具視窗（[§17](#17-給人用的除錯工具)） |
| POST | `/devices/:id/devtools` | admin | `{"page"?:"p1"}` → `{"ticket","session","page":Page,"frontendUrl"}`；最長可能等待使用者 30 秒（[§17.1](#171-開啟視窗)） |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |
| GET | `/insights?tz=<minutes>&days=14` | admin | `Insights`（[§12.8](#128-型別)）：閘道目前的負載與累計承載的偵錯量，供主控台的 **運行狀況** 頁面使用。member 會得到 `403 forbidden` |

`tz` 是瀏覽器的 `Date.getTimezoneOffset()`（UTC+8 為 `-480`），「今天」與每日序列都依檢視者的時區計算；`days` 為 1–90（預設 14）。一次偵錯是指在裝置上開始的一次 agent 工作階段（稽核 `attach.start`）或在頁面上開啟的一個 DevTools 視窗（`devtools.open`），只計成功的；裝置以裝置碼計數。偵錯記錄存在獨立的資料表中，稽核保留期（[§12.7](#127-稽核記錄)）不會清除，所以總數涵蓋全部歷史；升級後第一次啟動時，閘道會用仍保留的稽核事件回填一次。

### 12.6 裝置邀請

使用者只要開啟邀請連結，裝置就會上線並直接請求協助，不必再口頭念出裝置碼。

| 方法 | 路徑 | 角色 | 請求 | 回應 |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}`（伺服器端不保存權杖，所以這裡的 `link` 是不帶權杖的目標網址） |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | `DeviceInvite`，`link` 為完整連結（`<url>?rwd_invite=<token>`） |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url` 預設取專案的 `inviteUrl`，兩者至少要有一個。`expiresInMinutes` 最長 7 天。連結開啟的頁面必須以同一個專案的接入金鑰載入 SDK（[§3.5](#35-裝置權杖恢復權杖與邀請)）。

### 12.7 稽核記錄

`GET /audit?project=&device=<裝置碼>&actor=&action=&from=&to=&limit=50&before=<id>`（member）→ `{"events":[AuditEvent],"nextBefore":<id>|null}`，新的在前。`limit` 最大 200；`action` 以前綴比對（`attach.` 符合所有接入相關事件）；`actor` 比對操作者的 id 或名稱。

| action | 時機 |
|---|---|
| `auth.login`、`auth.login_failed` | 主控台登入 |
| `member.invite`、`member.accept`、`member.sso_join`、`member.update`、`member.delete` | 成員管理（`member.sso_join`：首次單一登入時建立的帳號；之後的 `auth.login` 會帶 `"method":"sso"`） |
| `project.create`、`project.update`、`project.delete`、`project.rotate_app_key` | 專案 |
| `key.create`、`key.revoke` | API 金鑰；`detail.owner` 是金鑰建立者的電子郵件（閘道金鑰沒有） |
| `invite.create`、`invite.delete`、`invite.use` | 裝置邀請 |
| `attach.request`、`attach.approve`、`attach.deny`、`attach.timeout`、`attach.resume`、`attach.start`、`attach.end` | agent 接入。`attach.resume` 表示這把金鑰在寬限期內直接回來，沒有再次詢問使用者（[§7](#7-接入核准)）；`detail: {level}` |
| `rpc` | agent 送給頁面的每個 RPC；`detail: {method, page, latencyMs, error?, owner?}` |
| `control.takeover`、`control.handback`、`control.end` | 使用者按下的按鈕 |
| `device.end` | 主控台成員結束了工作階段 |
| `policy.denied` | 超出等級的呼叫被拒絕 |
| `devtools.request`、`devtools.approve`、`devtools.deny`、`devtools.timeout`、`devtools.open`、`devtools.close` | 除錯工具視窗（[§17](#17-給人用的除錯工具)）；`close` 帶有 `detail: {page, durationSec, reason}` |

agent 的事件（`attach.*`、`rpc`、`policy.denied`）會在 `detail.owner` 記錄金鑰建立者的電子郵件，閘道金鑰除外。稽核事件絕不包含頁面內容和參數值。預設保留 180 天（`RWD_AUDIT_RETENTION_DAYS`）。

### 12.8 型別

```ts
type Project = {
  id: string; name: string; appKey: string; allowedOrigins: string[]; disabled: boolean
  createdAt: number; policy: Policy; inviteUrl: string
  onlineDevices: number; totalDevices: number
}

type ApiKey = {
  id: string; name: string; prefix: string /* rwd_sk_live_ab12 */
  maxLevel: Level; expiresAt: number | null; ipAllowlist: string[]
  createdAt: number; lastUsedAt: number | null; revokedAt: number | null
  ownerId: string | null       // 建立它的成員；閘道金鑰為 null
  ownerName: string; ownerEmail: string  // 閘道金鑰和已刪除的成員為 ""
  ownerDisabled?: true         // 建立者已停用，金鑰無法使用
}

type Integration = {
  appKey: string; gatewayUrl: string; sdkUrl: string
  firstSeenAt: number | null; onlineDevices: number; lastDevice: Device | null
}

type Device = {
  id: string /* deviceId */; code: string
  projectId: string            // 最近一個頁面所屬的專案
  projects: string[]           // 已連線頁面所屬的專案
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* 本次上線時間，只在在線時才有 */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; purpose?: 'devtools'; expiresAt: number } | null
  devtools: { id: string; member: string; page: string /* 標籤 */; since: number }[]  // 開啟中的除錯工具視窗（§17）
  task?: Task                  // 只有已接入的 agent 設定了任務時才有
  pages: number                // 已連線的頁面數
  sdk: string                  // 頁面回報的 SDK 版本
  currentPage: { label: string; url: string; title: string } | null  // 使用者最可能正在看的頁面
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // 只在 GET /devices 中才有
}

type SystemInfo = {            // 由 UA 解析而來
  os: string; osVersion: string; model: string; browser: string
  label: string                // 例如 "iOS 18.0 · iPhone · WebView"、"Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // 使用者最可能正在看的頁面
  selected: boolean            // agent 目前操作的頁面
  openerLabel: string | null; connectedAt: number
  connected: boolean           // 正在重新連線時為 false
  connectedSince: number       // 目前這次連線開始的時間（重新載入會更新）
}

type TimelineEvent = { at: number; page: string /* 頁面標籤；裝置層級的事件為 "" */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // 取代頁面數
  timeline: TimelineEvent[]    // 最近 100 筆，舊的在前
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* 尚未接受邀請 */
  createdAt: number; lastLoginAt: number | null
  hasPassword: boolean         // 單一登入建立的帳號為 false
  sso: string[]                // 已連結的提供者："feishu"、"lark"、"oidc"
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* 裝置碼、金鑰前綴、成員電子郵件等 */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}

type Insights = {              // GET /insights (§12.5)
  serverTime: number
  runtime: {                   // 閘道程序
    goroutines: number; heapBytes: number; sysBytes: number; gcCount: number
    cpus: number; uptimeSec: number; os: string /* linux/amd64 */
    cpuPercent?: number        // 距上次請求的程序 CPU，100 = 一個核心；不支援的平台沒有此欄位
    load?: number[]            // 主機 1、5、15 分鐘負載（Linux）
    memTotalBytes?: number; memAvailableBytes?: number  // 主機記憶體（Linux）
  }
  live: {
    wsConnections: number; connectedPages: number; onlineDevices: number
    attachedAgents: number; helpDevices: number; pendingApprovals: number
  }
  debug: {                     // 偵錯次數
    total: number; totalAgent: number; totalDevtools: number
    today: number; todayAgent: number; todayDevtools: number
    devices: number; devicesToday: number  // 被偵錯過的不同裝置數：全部 / 今天
    days: { day: number /* 本地時區自紀元起的天數 */; agent: number; devtools: number }[]  // 由舊到新，包含為 0 的日子
  }
}
```

### 12.9 時間軸事件

每台裝置在記憶體中保留最近 300 筆時間軸事件；主控台顯示最近 100 筆，MCP 預設取最近 50 筆。

| `kind` | 意義 |
|---|---|
| `opened` / `closed` | 頁面首次連線 / 超過寬限期後消失（[§3.1](#31-生命週期)） |
| `navigated` / `reloaded` | 頁面導覽到新網址 / 在原網址重新連線 |
| `focus` | 頁面回到前景 |
| `error` / `console_error` / `net_fail` / `user_tap` | 頁面回報的事件（[§3.2](#32-頁面--閘道)） |
| `help` | 使用者請求協助或取消請求，或透過邀請接入 |
| `agent` | 接入請求、拒絕、逾時、接入成功、任務變化 |
| `control` | 控制狀態變化，摘要中會說明原因（使用者接管、AI 閒置、使用者結束等） |
| `offline` | 有 agent 接入時，裝置的最後一個頁面中斷了 |
| `devtools` | 除錯工具的請求、核准與拒絕、視窗開啟與關閉、授權被收回（[§17](#17-給人用的除錯工具)） |

## 13. 即時推送 SSE

`GET /v1/api/stream[?project=<id>][&lang=<tag>]`（member，以 cookie 驗證）會以 `text/event-stream` 串流推送：

```
retry: 3000

event: device     data: Device                               裝置有變化（上線、協助請求、控制狀態、核准、任務等）
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   每 25 秒一次
```

不帶 `project` 時，推送所有專案的事件。`EventSource` 無法設定標頭，所以語言透過 `?lang=` 傳遞。處理太慢的訂閱者會漏掉事件，而不會拖慢閘道；主控台重新連線後會重新抓取資料，串流無法使用時退回輪詢。

## 14. MCP

### 14.1 工作階段

- 端點為 `/v1/mcp`（Streamable HTTP）。每個請求都必須帶上 `Authorization: Bearer <API 金鑰>`。每次請求都會檢查金鑰，所以金鑰被撤銷、已過期，或請求位址不在其 `ipAllowlist` 內時，會立即收到 401。
- 閘道依 API 金鑰保存一份 agent 狀態：接入的裝置和選取的頁面。使用同一把金鑰的多個 MCP 工作階段共用這份狀態。一個 agent 同時最多接入一台裝置；接入另一台會先離開前一台。一把金鑰可以存取閘道上的所有裝置。
- 同一把金鑰每分鐘查詢裝置失敗超過 5 次，這一分鐘內的後續查詢都會被拒絕，以防裝置碼被猜中。

### 14.2 回傳結果

每個工具結果的末尾，都會附上這台裝置自 agent 上一次呼叫以來的變化（最多 20 行），agent 不必輪詢就能得知新頁面、導覽、錯誤和使用者接管：

```
[Session changes]
- p3 "Checkout" opened (opened by p2)
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- The user took over
```

來自頁面的內容（快照、console、網路、儲存空間、指令碼執行結果、時間軸）會以標記包起來並註明為不可信資料，避免 agent 執行其中的指示。

### 14.3 工具

| 工具 | 等級 | 參數 | 說明 |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all`（預設 `online`）、`userId?`、`deviceCode?`（不分大小寫，有無連字號皆可） | 最多 50 台裝置，請求協助的排在最前 |
| `connect_device` | — | `device`（裝置碼或 deviceId）、`level?: Level`（預設 `interact`）、`follow?: true` | 接入裝置，需要時先請使用者核准（[§7](#7-接入核准)）；自己放開裝置後 10 分鐘內，同一把金鑰再次接入不必重新核准，等級不超過當時授予的等級。接入後選取前景頁面。裝置沒有已連線的頁面時失敗（並促使輪詢中的裝置重新連線） |
| `disconnect_device` | — | — | 離開裝置 |
| `wait_for_device` | — | `device`、`timeoutSec?: 60`（最大 300） | 等待裝置有頁面連上；輪詢中的裝置會被通知重新連線 |
| `list_pages` | — | — | 裝置的頁面：標籤、標題、網址、是否選取、前景 / 背景、是否在重新連線、開啟者 |
| `select_page` | — | `page`（標籤） | 切換選取的頁面 |
| `take_snapshot` | observe | `page?` | 帶有 ref 的無障礙快照，並附上浮在頁面上的覆蓋層及其 ref（[§5.3](#53-頁面內的行為)） |
| `find_elements` | observe | `text?`、`role?`、`name?`、`limit?`、`page?` | 不必拍完整快照，就能找出元素及其 ref（`rwd.query`） |
| `take_screenshot` | observe | `page?`、`fullPage?`、`format?: jpeg\|png` | 回傳圖片 |
| `wait_for` | observe | `text?`、`textGone?`、`timeSec?`（最大 30） | 在選取的頁面上等待 |
| `list_console_messages` | observe | `scope?: page\|session`、`types?`、`limit?: 50` | `session` 會合併所有已連線的頁面，並在每一行標出所屬頁面 |
| `list_network_requests` | observe | `scope?`、`failedOnly?`、`limit?: 50`、`exclude?`、`includeExcluded?` | 同上；請求 id 列為 `<標籤>:<id>`。`exclude` 會在專案和頁面既有的規則之外，為這一次呼叫再加上規則（[§11](#11-專案原則)）；有請求被規則隱藏時，結果末尾會寫 *N requests hidden by the exclude rules*，傳 `includeExcluded: true` 即可看到 |
| `click` / `hover` | interact | `ref` | 點擊被覆蓋層擋住時以 `not_interactable` 失敗，並指出遮擋元素的 `ref`，可以改點它（[§5.3](#53-頁面內的行為)） |
| `fill` | interact | `ref`、`value` | |
| `type_text` | interact | `text`、`ref?`、`submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`、`values` | |
| `scroll` | interact | `ref?`、`dx?`、`dy?`（預設 `dy: 600`） | |
| `drag` | interact | `fromRef`、`toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]`（1–30 個）、`stopOnError?: true` | 依序執行 `click`、`fill`、`type_text`、`press_key`、`select_option`、`hover`、`scroll` 和 `wait_for`，一次回傳全部結果 |
| `get_network_request` | advanced | `id`（清單中的 `<標籤>:<id>`，或選取頁面的純 id） | 標頭和本文 |
| `get_storage` | advanced | `area: local\|session\|cookie`、`page?` | |
| `evaluate_script` | advanced | `function`、`args?`、`page?` | 在頁面中執行 JavaScript；結果超過 20,000 個字元會被截斷 |
| `get_session_timeline` | — | `limit?: 50` | 裝置跨頁面的時間軸 |
| `get_session_overview` | observe | `session?` | 本次啟動的工作階段記錄概覽（[§5.4](#54-工作階段記錄)）：何時開始、存了多少、各類記錄筆數、造訪過的頁面、最近 20 筆錯誤和失敗請求，以及除了這次之外仍保留的其他啟動 |
| `get_session_log` | observe | `session?`、`kinds?`、`problems?`、`page?`、`text?`、`after?`、`limit?`、`seq?`、`exclude?`、`includeExcluded?` | 逐筆讀取工作階段記錄，每行格式為 `#<seq> <時間> <頁面> <內容>`。`page` 可以傳 `p2` 這類標籤，或記錄中顯示的頁面 id；`after` 從上一次結果末尾的 `seq` 繼續往後翻頁。改傳 `seq` 則顯示那一筆的完整內容（含標頭和本文；它會呼叫 `rwd.logDetail`，因此需要 `advanced`） |
| `wait_for_page` | — | `urlContains?`、`titleContains?`、`timeoutSec?: 30`（最大 300） | 等待自上次呼叫以來新開啟或導覽的頁面 |
| `wait_for_event` | — | `kind?`（[§12.9](#129-時間軸事件)）、`page?`、`timeoutSec?: 30`（最大 300） | 等待下一個符合的時間軸事件 |
| `wait_for_control` | — | `timeoutSec?: 120`（最大 600） | 使用者接管後，等待使用者交還（或結束） |
| `set_task` | — | `title`（≤ 24 個字元）、`steps?`（≤ 12 步，每步 ≤ 28 個字元）、`current?` | 在裝置所有頁面的頂端顯示 agent 的任務和計畫步驟。`current` 是進行中的步驟；`current = steps.length` 表示已完成。頁面以 `task` 訊息收到（[§3.3](#33-閘道--頁面)）；agent 離開時清除 |

`page?` 只讓單次呼叫作用在另一個頁面（依標籤），不會改變選取的頁面。超出接入等級的工具會以 "Requires advanced access; this session was granted interact" 失敗，並記一筆 `policy.denied` 稽核記錄。

**跟隨模式。** `follow: true`（預設）時，agent 的操作開啟了新頁面、使用者把另一個頁面切到前景，或選取的頁面消失超過 1.5 秒，選取都會自動切換，並在結果中說明。選取的頁面被當成過期頁面清除時（[§3.1](#31-生命週期)），不論 `follow` 的值為何，都會改選顯示同一個網址的頁面——因為舊的項目已經不在了。

### 14.4 本機 stdio 橋接

給只支援 stdio 的 MCP 用戶端使用：

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

它把 stdio 轉送到託管的 `/v1/mcp`。`--gateway` 也可以透過環境變數 `RWD_GATEWAY` 指定。

## 15. 語言

支援的語言：英文（`en`）、簡體中文（`zh`）、繁體中文（`zh-TW`）、法文（`fr`）、西班牙文（`es`）、俄文（`ru`）、阿拉伯文（`ar`，由右至左）、日文（`ja`）、韓文（`ko`）、德文（`de`）和葡萄牙文（`pt`）。接受任何 BCP 47 語言標記，並對應到最接近的語言：`en-US` → `en`；`zh-CN`、`zh_CN`、`zh-Hans` → `zh`；`zh-HK`、`zh-MO`、`zh-Hant` → `zh-TW`；`fr-CA` → `fr`；`pt-BR`、`pt-PT` → `pt`。`Accept-Language` 會選出權重最高的受支援語言。

| 對象 | 內容 | 由誰決定 |
|---|---|---|
| agent | MCP 伺服器說明、工具與參數描述、工具結果、`[Session changes]`、錯誤訊息 | 閘道的 `RWD_LANG` / `--lang`（預設 `en`） |
| agent（來自頁面） | SDK 產生的 RPC 錯誤訊息和事件摘要 | `welcome.agentLang`，也就是閘道的語言。SDK 會把最近一次的值存在 localStorage `rwd:alang`，供下一個 `welcome` 到達前產生的事件使用；還沒收到時使用英文 |
| 主控台 | REST 和 SSE 回應中的錯誤訊息、時間軸摘要和系統描述 | 請求的 `?lang=`，其次是 `Accept-Language`，最後是閘道的語言 |
| 手機使用者 | SDK 的膠囊、控制列、對話框和提示 | `run({ lang })`，否則取 `navigator.languages` 中第一個 SDK 有語言包的語言（內建或由頁面註冊），都沒有時使用英文。`en` 和 `zh` 以外的語言包會按需載入，來源是 `sdk.js` 旁的 `locales/<id>.js`，或閘道的 `/v1/locales/<id>.js` |

所以說中文的使用者可以和說英文的 agent 搭配：對話框顯示 *AI 想要点击「提交订单」，允许吗？*（SDK 的中文介面為簡體中文），使用者拒絕後，agent 讀到的是 *The user denied this action*。

## 16. 維運

- **指標。** `GET /v1/metrics` 回傳 Prometheus 文字格式。設定了 `RWD_METRICS_TOKEN` 時需要 `Authorization: Bearer <token>`。指標序列：`rwd_online_devices{project}`、`rwd_connected_pages`、`rwd_attached_agents`、`rwd_ws_connections`、`rwd_rpc_total{method,result}`、`rwd_rpc_duration_seconds{method}`（直方圖）、`rwd_http_requests_total{code}`。
- **SDK 版本。** 用於快取的 SDK 版本號，是閘道內嵌的 `sdk.js` 其 SHA-256 的前 12 個十六進位字元，所以檔案一變，`/v1/sdk/<version>/sdk.js` 的網址就跟著變。`GET /v1/api/config` 以 `sdkVersion` 回傳它，同時回傳 `sdkIntegrity`（`sha384-…`，供 `integrity` 屬性使用）。主控台提供固定版本的程式碼片段。
- **資料庫。** 設定 `RWD_DATABASE_URL=postgres://…`（或 `postgresql://`）時使用 Postgres；否則 `RWD_DATA`（預設 `rwd.db`）是 SQLite 檔案。啟動時會自動建立並遷移資料表結構。
- **速率限制。** 主控台登入和接受邀請：每個用戶端 IP 每分鐘 10 次。單一登入的發起和回呼：每個用戶端 IP 每分鐘 60 次。頁面連線和輪詢：每個用戶端 IP 每分鐘 120 次。只有開啟 `--trust-proxy` 時，才會從 `X-Forwarded-For` 取得用戶端 IP；`X-Forwarded-Proto` 和 `X-Forwarded-Host` 也受同一個開關控制，它們決定工作階段 cookie 是否帶 `Secure`，以及未設定 `--public-url` 時推斷出的 `gatewayUrl` 的協定和主機。
- **稽核保留期限。** `RWD_AUDIT_RETENTION_DAYS`（預設 180 天），每 6 小時清除一次過期的事件。

閘道的所有設定項目見 [gateway/README.zh-TW.md](../gateway/README.zh-TW.md)。

## 17. 給人用的除錯工具

owner 和 admin 可以在主控台裡，對裝置上任何一個在線頁面開啟 **Chrome DevTools**：Elements（樣式、box model、在裝置上醒目提示）、Console（即時，可檢視物件、執行指令碼）、Network（含回應本文）和 Application 儲存空間。這是貨真價實的除錯工具前端，由 [chii](https://github.com/liriliri/chii) 預先建置；後端就是頁面 SDK 裡現成的完整 chobitsu，由閘道轉送 CDP 訊息。

```
Console /devices/:id/devtools
  └─ iframe /devtools/chii_app.html?ws(s)=<host>/v1/devtools?ticket=…   ← DevTools frontend
        │ CDP (WebSocket)
        ▼
Gateway /v1/devtools ──{"t":"cdp","s","m"}──▶ page WebSocket ──▶ SDK: one session per window ──▶ chobitsu
```

### 17.1 開啟視窗

1. 主控台呼叫 `POST /v1/api/devices/:id/devtools`，帶上 `{"page":"p1"}`（省略時：使用者正在看的頁面）。僅限 owner 和 admin。
2. 閘道會合併裝置上已開啟頁面所屬各專案的原則；只要有一個是 `devtools: "off"`，請求就會被拒絕。合併後的 `approval` 為 `prompt` 時，閘道會送給前景頁面一個 `attach_request`，帶上 `"purpose":"devtools"`、`levels: ["advanced"]`，並以該主控台成員的名字作為 `agent.name`，然後等待回覆（30 秒；HTTP 請求也會一起等）。SDK 的自動允許不適用於這種請求。使用 `nativeApproval` 時，`status().pending.purpose` 會是 `"devtools"`（[§7](#7-接入核准)）。
3. 核准對這位成員在這台裝置上的效期是 `policy.attachMaxMinutes`，所以重新載入或導覽後重新連線不必再問一次。使用者在裝置上按**結束**，或主控台成員結束工作階段（`POST /devices/:id/end`），都會關閉所有視窗並收回核准。
4. 回應是 `{"ticket","session","page":Page,"frontendUrl"}`。`ticket` 只能用一次，一分鐘內有效；`session` 是這個視窗在 `Device.devtools` 裡的 id。
5. 前端會連上 `WS /v1/devtools?ticket=…`。只有主控台自己的來源才能連線（設定了 `--public-url` 時就是它的主機）。

錯誤碼：`device_offline`、`no_page`（頁面已經消失或正在重新連線）、`busy`（裝置正在等使用者回覆另一個請求）、`timeout`、`denied`（403）和 `forbidden`（403，被原則關閉）。

### 17.2 頁面訊息

```jsonc
← {"t":"devtools","s":"<session>","on":true,"by":"Ann"}   // 一個視窗開啟了
← {"t":"devtools","s":"<session>","on":false}              // 視窗關閉了
← {"t":"cdp","s":"<session>","m":"<CDP command, JSON text>"}
→ {"t":"cdp","s":"<session>","m":"<CDP answer, JSON text>"} // 回給發問的那個視窗
→ {"t":"cdp","m":"<CDP event, JSON text>"}                  // 送給這個頁面上的所有視窗
```

- 一個視窗只屬於一個頁面連線。頁面斷線時（重新載入、導覽、關閉），閘道會以代碼 **4100** 關閉它的視窗；頁面回來後，主控台會用新的 ticket 重新開啟它們（核准仍然有效，不會再問使用者一次）。結束工作階段會以 **4403** 關閉它們；跟不上的前端（網路差時的畫面直播）會以 **1013** 關閉。
- 送往頁面的 CDP 訊息有自己的佇列：前端一次送出一大串指令，只會拖慢那個前端本身，不會讓頁面被當成跟不上的用戶端而斷線，agent 的 RPC 也不會受影響。
- 在 SDK 裡，所有視窗共用同一個 chobitsu，指令 id 會依視窗重新編號。`Runtime.enable` 和 `Network.enable` 由 SDK 自己回覆：它從頁面載入起就會為 agent 收集這兩種資料，所以視窗開啟前發生的事也看得到——console 訊息（文字已遮蔽；物件無法展開）和最近的請求（回應本文還留在快取中的話也看得到）。任何視窗呼叫 `*.disable` 都不會生效；最後一個視窗關閉時，SDK 才會取消醒目提示、停止畫面直播，並釋放它為這些視窗保留的物件。
- 只要有視窗開著，頁面底部的控制列就會顯示有開發者在除錯，列出成員名字，並提供**結束**按鈕。

### 17.3 狀態與稽核

- `Device.devtools` 列出目前開著的視窗；`Page.connected` 和 `Page.connectedSince` 讓主控台知道什麼時候該重新開啟視窗；`Device.pending.purpose` 標記一個除錯工具請求（[§12.8](#128-型別)）。
- 時間軸種類 `devtools`：請求、核准與拒絕、視窗開啟與關閉、授權被收回（[§12.9](#129-時間軸事件)）。
- 稽核動作 `devtools.request`、`devtools.approve`、`devtools.deny`、`devtools.timeout`、`devtools.open`、`devtools.close`（[§12.7](#127-稽核記錄)）。
- 隱私：除錯工具看到的是頁面本來的樣子，**遮蔽規則不會套用**。正因如此，它才只開放給 owner 和 admin、可以按專案關閉、會在裝置上詢問使用者，而且全程都會稽核。

### 17.4 前端

前端是 npm 套件 `chii` 釘死版本裡的 `public/front_end`，會先核對它的 sha512，並在建置主控台時複製到 `console/dist/devtools/`（[`console/scripts/devtools-frontend.mjs`](../console/scripts/devtools-frontend.mjs)）。閘道以 gzip 內嵌它（約 3.4 MB），回應時帶 `Content-Encoding: gzip`；`/devtools/` 底下的回應則帶有 `X-Frame-Options: SAMEORIGIN`。
