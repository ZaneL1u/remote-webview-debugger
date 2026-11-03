<!-- i18n-source: b73d0ad06824fa3a84be92cf17790d5fcb1194a5 -->
[English](README.md) | [简体中文](README.zh-CN.md) | 繁體中文 | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD 頁面 SDK（`sdk/`）

由 App WebView 或 H5 頁面載入的單一 JS 檔案，讓 AI agent 透過 RWD 閘道（`gateway/`）和 MCP 檢視並操作頁面。協定請見 [`docs/protocol.zh-TW.md`](../docs/protocol.zh-TW.md)；架構請見 [`docs/architecture.zh-TW.md`](../docs/architecture.zh-TW.md)。

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // 選用
    deviceId: "…",               // 選用；由注入 SDK 的原生宿主傳入
    helpButton: true,            // 選用；顯示「求助」按鈕
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // 選用；語言標記，預設依瀏覽器的語言
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## 取得 SDK

以 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) 發布在 npm 上；版本與變更請見[變更記錄](CHANGELOG.zh-CN.md)。

| 用法 | 來源 |
|---|---|
| 從 CDN 以 `<script>` 載入 | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js` 或 `https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`（壓縮過的 IIFE，全域物件 `RemoteWebviewDebugger`；請固定版本號，需要的話再加上 `integrity`） |
| 打包工具 | `npm install remote-webview-debugger`，然後 `import { run, status } from 'remote-webview-debugger'`（附型別定義的 ES module）。請在你自己的程式碼之前 import，讓記錄盡早開始。同一個頁面不要再載入 `<script>` 版本 |
| 你的閘道 | `https://<閘道>/v1/sdk.js`，即閘道內嵌的那一份（主控台另外提供依內容定址、可搭配 SRI 的網址） |
| 原生 App | 把套件中的 `dist/sdk.js` 打包進 App，或從上述任一來源下載；請見[原生整合](../docs/native-integration.zh-TW.md) |

## API

| API | 說明 |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | 讓頁面上線（裝置碼、膠囊）。回傳 `Promise<{deviceCode, status}>`；重複呼叫不會有副作用。選項見下表。 |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`；`status` 為 `idle / connecting / online / polling / stopped / rejected / quota`，`lang` 是介面語言（`run()` 之前為 `null`），`logSession` 是這個頁面正在寫入的工作階段記錄（未記錄時為 `null`） |
| `stop()` | 斷線並移除介面（console / 網路的收集會繼續，有容量上限） |
| `setUser(userId)` | 變更使用者；會以新的 `hello` 重新連線一次 |
| `help(on)` | 求助 / 取消求助 |
| `nativeControl(nativeKey, action)` | 從原生宿主自己的介面接管 / 交還 / 結束 |
| `nativeDecide(nativeKey, requestId, value)` | 搭配 `nativeApproval` 時回答 `status().pending`：連線請求傳入等級或 `null`，敏感操作確認傳入 `'allow'` 或 `null` |
| `setLang(lang?)` | 在執行期間切換介面語言（例如 App 自己的語言設定）；不帶參數則回到瀏覽器的語言。見[語言](#語言) |
| `registerLocale(pack)` | 新增語言包，或取代 `id` 相同的語言包（也可以傳入陣列）。見[語言](#語言) |
| `builtinLocales` | 內建語言包的 id 清單 |

`run()` 選項：

| 選項 | 說明 |
|---|---|
| `userId` | 目前登入的使用者，隨 `hello` 送出 |
| `deviceId` | 原生宿主提供的固定裝置 id（未提供時會存在 localStorage） |
| `helpButton` | 顯示「求助」按鈕（與專案策略取 OR） |
| `app` | 宿主 App 的 `{ name, version }` |
| `lang` | 手機使用者看到的所有內容的語言（膠囊、浮動視窗、底部控制列、對話框、提示訊息、eruda 分頁，以及敏感操作中「AI 想要…」的描述）：語言標記，例如 `'ja'` 或 `'pt-BR'`。預設：瀏覽器的語言。見[語言](#語言) |
| `locales` | 額外的語言包，在決定語言之前註冊（與 `registerLocale` 相同） |
| `messages` | 依語言覆寫的文字：`{ en: { ui: { help: 'Contact support' } }, 'zh-TW': { ui: { help: '聯絡客服' } } }` |
| `networkExclude` | 不想讓 agent 費力翻找的請求——老是 404 的字型、分析用的 beacon：`['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`。每條規則可以是不分大小寫的 URL 子字串、含 `*` 的萬用字元模式，或寫成 `/…/` 的規則運算式。會與專案策略中的規則合併。符合的請求不會出現在網路清單裡，也不會產生 `net_fail` 時間軸事件；頁面仍會記錄它們，所以 agent 可以用 `includeExcluded` 要求查看 |
| `lockScreen` | `false`：agent 連線期間不鎖定頁面（使用者仍可在浮動視窗中變更）。預設為 `true` |
| `theme` | `'auto'`（預設，跟隨頁面背景）、`'system'`、`'light'` 或 `'dark'` |
| `style` | 介面的顏色、字型、圓角、z-index 和位置：`{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`。見[樣式](#樣式) |
| `eruda` | `true` 或 `{ dock, load, src, name }`：把 Remote Debugger 顯示為 eruda 中的一個分頁；頁面沒有 eruda 時，`load` 會載入最新版的 eruda。預設關閉；專案策略可以遠端開啟，本機選項逐欄位優先 |
| `record` | `false`：這個頁面不寫入工作階段記錄（已儲存的內容不會刪除）。預設為 `true`；專案策略可以對所有頁面關閉記錄 |
| `launchId` | 這個頁面屬於 App 的哪一次啟動，讓同一個 App 程序中的所有 WebView 把工作階段記錄歸到同一個工作階段。原生宿主在這裡傳入自己的 id（或把 `window.RWDLaunchId` 定義為字串，或回傳字串的函式）；否則 SDK 會以工作階段 cookie 加上心跳來推斷這次啟動 |
| `nativeKey`、`deviceToken`、`nativeApproval` | 給原生宿主用：`nativeControl` / `nativeDecide` 的密鑰、由宿主保存的裝置權杖，以及改用原生介面詢問連線核准 / 操作確認 |

## 語言

內建語言：英文（`en`）、簡體中文（`zh`）、繁體中文（`zh-TW`，`zh-HK`、`zh-MO` 和 `zh-Hant` 也使用它）、法文（`fr`）、西班牙文（`es`）、俄文（`ru`）、阿拉伯文（`ar`，由右至左排版）、日文（`ja`）、韓文（`ko`）、德文（`de`）和葡萄牙文（`pt`，巴西葡萄牙文；`pt-PT` 也使用它）。

**如何決定語言。** 手機使用者的語言先看 `run({ lang })`，再依序看 `navigator.languages` 中的每一個。每個語言標記會先試它本身，再試更短的形式（`pt-BR` → `pt`，`zh-HK` → `zh-TW` → `zh`），採用第一個有語言包的語言，都沒有時使用英文。語言包中缺少的文字也以同樣的順序遞補，所以只寫一部分的語言包也沒問題。`setLang('ja')` 可在執行期間切換；`status().lang` 是目前使用的語言包。

**如何載入。** 英文和簡體中文包含在 `sdk.js` 裡。其他語言包會在頁面第一次需要時才載入（在那一刻，介面先顯示遞補語言）：

- `<script>` 版本：從 `sdk.js` 同一目錄下的 `locales/<id>.js` 載入（CDN 路徑如 `…/remote-webview-debugger@0.1.0/dist/locales/ja.js`，或你的閘道的 `/v1/locales/ja.js`），失敗時再從傳給 `run()` 的閘道載入。想省下這次請求，可以自己在 `sdk.js` 之前或之後載入語言包：`<script src="…/dist/locales/ja.js"></script>`。
- ES module 版本：使用動態 import，所以打包工具會把每種語言拆成獨立的 chunk。若要一開始就打包進去：`import ja from 'remote-webview-debugger/locales/ja'`，然後 `run(url, key, { locales: [ja] })`。

**自訂語言包和文字。** 語言包的格式是 `{ id, name, dir?, ui?, action?, agent? }`；沒寫的部分取自它的遞補語言：

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Chiedi aiuto' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { 'zh-TW': { ui: { help: '聯絡客服' } } }, // 覆寫任何語言中的個別文字
})
```

`ui` 是介面文字，`action` 用來補完確認對話框中的「AI 想要…」，`agent` 是回傳給 agent 的文字。TypeScript 型別（`LocalePack`、`Messages`、`UiMessages`、`ActionMessages`、`AgentMessages`）列出了所有鍵；以 `src/locales/en.ts` 為準。

**兩種讀者。** 手機使用者使用上面決定的語言。agent 讀到的 RPC 錯誤訊息和時間軸摘要（點擊、頁面內跳轉、失敗的請求）使用閘道的語言 `welcome.agentLang`（`RWD_LANG`），語言包也以同樣方式載入。在 welcome 指定之前一律使用英文；最近一次的值會存在 localStorage `rwd:alang`，因此下一個頁面在收到 welcome 之前產生的事件也會沿用它。

因此說中文的使用者可以和說英文的 agent 搭配：對話框問的是 `AI 想要点击「提交订单」，允许吗？`，使用者拒絕時，agent 讀到的是 `The user denied this action`。

## 樣式

介面位於 `#__rwd`（在 `<body>` 之外）的 Shadow DOM 中，頁面的 CSS 只能透過下列入口影響它：

- **CSS 自訂屬性**：寫在 `:root` 或 `#__rwd` 上，例如 `:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`。
- **`run({ style })`**：把同樣的屬性設定在 `#__rwd` 上；這裡的顏色可以使用任何 CSS 顏色寫法。
- **`::part()`**：其他樣式用 `#__rwd::part(bar) { … }`。可用的 part：`pill`、`window`、`bar`、`task`、`dialog`、`toast`、`button`、`cursor`、`glow`、`overlay`。內部的 class 名稱不是穩定的 API。
- **`theme`**：淺色或深色玻璃（預設跟隨頁面背景）。

| 屬性 | `style` 欄位 | 預設值 | 作用對象 |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | 按鈕、開關、agent 的指標、醒目標示和邊緣光暈 |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | 「結束」按鈕 |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | 求助；使用者接管的狀態 |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | 線上指示點；「已複製」 |
| `--rwd-font` | `font` | 系統介面字型（中文、日文、韓文依語言選擇字型） | 所有文字 |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | 裝置碼和標籤 |
| `--rwd-radius` | `radius` | `18px` | 浮動視窗；對話框比它大 2px，任務卡片和膠囊小 2px，對話框按鈕小 6px |
| `--rwd-button-radius` | `buttonRadius` | `999px` | 按鈕、底部控制列和提示訊息 |
| `--rwd-z-index` | `zIndex` | `2147483647` | 整個介面 |
| `--rwd-bar-bottom` | `barBottom` | `14px` | 底部控制列與底部安全區域的距離 |
| `--rwd-task-top` | `taskTop` | `10px` | 任務卡片與頂部安全區域的距離 |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | 提示訊息與底部安全區域的距離 |
| — | `pill: { side, top }` | 右側邊緣（由右至左的語言為左側），`0.62` | 閒置膠囊在使用者拖動之前的起始位置；`top` 從 0（頂部）到 1（底部） |

顏色寫成 `r, g, b` 三元組，半透明的色調才會跟著改變（與 Bootstrap 的 `--bs-*-rgb` 慣例相同）。

## 頁面內的行為（協定 §6–§8、§11）

- 等級：RPC 會依 `welcome.level` / `control.level` 檢查（`forbidden`，「需要 … 等級」）。沒有等級的 agent（較舊的閘道）以 `interact` 處理；沒有 agent 連線時，不額外施加限制。
- 裝置權杖存在 localStorage `rwd:dtoken`，恢復權杖存在 sessionStorage `rwd:resume`（綁定 pageId）。關閉碼 4401：若權杖在此期間已改變（同一台裝置的另一個分頁剛取得它），立即重試一次，否則進入 `rejected`，約 10 分鐘後再試；4409：換新的 pageId 重新連線；4429：`quota`，約 5 分鐘後再試。
- 網址列中的 `rwd_invite` 會在 `run()` 時移除（`history.replaceState`），並隨 hello 一起送出，直到收到 welcome。
- `welcome.config`：`helpButton`（與 `run()` 選項取 OR）、`maskSelectors`、`maskPatterns`（快照、console、網路 URL、儲存空間的值、時間軸摘要）、`confirmSelectors`、`networkExclude`（與 `run()` 選項中的規則合併）、`sessionLog`。最近一次的設定會存在 localStorage `rwd:cfg`，在收到 welcome 之前先沿用——所以關閉了工作階段記錄的專案，下一個頁面從第一刻起就不會記錄，不必等 welcome。
- 快照最後會附上一段 `[Overlays]`，列出浮在頁面上的東西——彈出視窗的遮罩、強制回應視窗、底部滑出面板——包含它的標籤、一小段文字、覆蓋了多少可視區域，以及一個 ref。遮罩是 aria snapshot 中沒有對應節點的空元素，所以它拿到的是 `oN` 而不是 `eN` 形式的 ref；agent 正是靠它點擊遮罩來關閉彈出視窗。
- 點擊會先瞄準元素可見區域的中心，再嘗試其內部 3×3 網格上的其他點，所以按鈕上蓋了一個徽章也不會擋住點擊。所有點都被遮住時，RPC 會以 `not_interactable` 失敗，並指出遮擋的元素及其 ref。
- 連線核准和敏感操作的對話框（`[data-rwd-confirm]`、`confirmSelectors`，包括在表單中按 Enter 送出）位於 Shadow DOM 中，只接受受信任的點擊，並在出現 0.4 秒後才可操作。同源的多個分頁之間透過 BroadcastChannel 共享已處理的連線請求。

載入檔案時就會開始收集 console、未攔截的錯誤和網路（XHR、fetch、WebSocket、sendBeacon、EventSource），每類最多 500 筆；滿了之後先丟棄一般記錄和成功的請求。回應內容最多快取 5 MB，每筆 64 KB。所以請在 `<head>` 中盡早以同步方式載入。

## 工作階段記錄（協定 §5.4）

上述緩衝區只存在單一頁面的記憶體中。與此同時，SDK 還會把**工作階段記錄**寫進裝置上的 IndexedDB（`rwd-log`），讓 agent 即使在 bug 發生之後才連線，也能讀到完整的來龍去脈：

- 一個工作階段就是 App 的一次啟動，由同一來源的所有頁面共用：`run({ launchId })`，否則 `window.RWDLaunchId`，否則由工作階段 cookie `rwd_launch` 加上心跳推斷（cookie 工作階段超過一小時沒有動靜，就視為新的一次啟動）。`status().logSession` 是目前使用的 id。
- 記錄內容：頁面開啟 / 頁面內跳轉 / 前景與背景切換 / 離開，使用者的點擊、輸入、送出和捲動停止的位置，agent 的互動類呼叫和 `rwd.evaluate`，控制狀態變化，所有等級的 console，以及每個完成的請求——失敗的請求還會附上遮蔽過的標頭和內容（各 64 KB）。不論閘道連不連得上都會記錄。被遮蔽的欄位存成 `••••`，`maskPatterns` 在寫入記錄時就會套用。
- 保留量：最近 3 次啟動，每次 10 MB；超過時先丟棄一般記錄和成功的請求。儲存空間配額不足 64 MB 時只保留目前這次啟動；沒有 IndexedDB 時完全不記錄。
- agent 以 `rwd.log`（`observe`）和 `rwd.logDetail`（`advanced`，用於標頭和內容）讀取。除此之外，記錄不會離開裝置。
- 關閉方式：單一頁面用 `run({ record: false })`，整個專案用 `policy.sessionLog: false`——後者還會刪除這個來源已經儲存的內容。

## 結構

- `src/index.ts`：公開 API、工作階段、RPC 分派、控制狀態。
- `src/transport.ts`：頁面 WebSocket（原生建構函式）、心跳逾時、指數退避，以及連續 3 次失敗後每 60 秒 `POST /v1/presence`。
- `src/ids.ts`：deviceId / pageId / openerId。
- `src/launch.ts`：判斷這個頁面屬於 App 的哪一次啟動（`launchId`、`window.RWDLaunchId`、`rwd_launch` cookie）。
- `src/pageWatch.ts`：`page` 訊息（url、標題、可見性）和時間軸事件（頁面內跳轉、使用者的點擊）。
- `src/ui.ts`、`src/lock.ts`：Shadow DOM 中的膠囊、求助按鈕、鎖定覆蓋層、光暈、操作醒目標示和對話框；agent 連線期間擋下使用者受信任的輸入，並顯示已連線的時間。
- `src/approval.ts`：連線核准和敏感操作確認（頁面對話框，或透過 `nativeDecide` 交給原生宿主）。
- `src/i18n.ts`、`src/locales/`、`src/localeLoader*.ts`：語言包（每種語言的介面、操作描述和 agent 文字）、語言的決定與遞補、按需載入；`scripts/locales.mjs` 產生 `dist/locales/<id>.js`。
- agent 引擎位於 chobitsu 旁的 `packages/chobitsu/src/engine/rwd/`：快照、`rwd.query`、可操作性檢查、合成輸入、鍵盤、console / 網路緩衝區、截圖、`rwd.storage`、IndexedDB 中的工作階段記錄（`coldlog.ts`）、覆蓋層偵測（`overlays.ts`）、等級與確認規則（`policy.ts`）、給 agent 的文字（`i18n.ts`）。快照所用的 Playwright 原始碼位於 `packages/chobitsu/src/engine/vendor/playwright/`。建置時會從原始碼把它們打包進 `dist/sdk.js`。

## 建置與測試

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js（IIFE，全域 RemoteWebviewDebugger，ES2017），dist/index.mjs + index.d.ts（ES module）
npm run typecheck
npm test             # Playwright：WebKit（iPhone 15）+ Chromium（Pixel 7）
npm run gateway      # 本機模擬閘道：http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

測試使用 `test/mock-gateway.mjs`，它實作了協定的頁面端（welcome、控制狀態、RPC、presence；權杖、關閉碼、等級、遠端設定、`agentLang`、連線核准），並提供 `/v1/sdk.js`、`/v1/locales/` 下的語言包和展示商店。它本身不檢查等級，好讓測試驗證頁面自己的強制檢查。`test/e2e/` 中的測試規格預設以 `zh-CN` 瀏覽器和 `agentLang: 'zh'` 執行，除非個別測試另有指定；英文由 `i18n.spec.ts` 涵蓋，其他語言包、遞補、自訂語言包、樣式和由右至左的版面由 `locales.spec.ts` 涵蓋。共存測試會從 jsdelivr 載入 eruda 3.4.3 和 PageSpy 2.4.0，因此需要能連上網際網路。
