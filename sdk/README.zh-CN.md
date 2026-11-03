[English](README.md) | 简体中文

# RWD 页面 SDK（`sdk/`）

App WebView / H5 页面加载的一个 JS 文件，让 AI agent 通过 RWD 网关（`gateway/`）和 MCP 查看、操作页面。协议见 [`docs/protocol.zh-CN.md`](../docs/protocol.zh-CN.md)，架构见 [`docs/architecture.zh-CN.md`](../docs/architecture.zh-CN.md)。

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // 可选
    deviceId: "…",               // 可选，原生注入时由原生传入
    helpButton: true,            // 可选，显示「求助」按钮
    app: { name: "商城", version: "3.2.0" },
    lang: "zh",                  // 可选，'en' | 'zh'，默认按 navigator.language
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## 获取 SDK

npm 包名 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)，版本与变更见[更新日志](CHANGELOG.zh-CN.md)。

| 用法 | 地址 |
|---|---|
| CDN `<script>` | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js` 或 `https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`（压缩后的 IIFE，全局对象 `RemoteWebviewDebugger`；请固定版本号，需要的话加上 `integrity`） |
| 打包工具 | `npm install remote-webview-debugger`，然后 `import { run, status } from 'remote-webview-debugger'`（ES module，带类型声明）。尽量在你自己的代码之前 import，好让记录尽早开始。同一个页面不要再加载 `<script>` 版本 |
| 你的网关 | `https://<网关>/v1/sdk.js`，网关内嵌的那一份（控制台还提供带 SRI 的按内容寻址地址） |
| 原生 App | 把包里的 `dist/sdk.js` 打包进 App，或从以上任一地址下载，见[原生接入](../docs/native-integration.zh-CN.md) |

## API

| API | 说明 |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | 上线（设备码、胶囊），返回 `Promise<{deviceCode, status}>`；重复调用无副作用。选项见下表 |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`，`status` 为 `idle / connecting / online / polling / stopped / rejected / quota`，`lang` 是界面语言（`run()` 之前为 `null`），`logSession` 是本页面正在写入的会话日志 id（不在记录时为 `null`） |
| `stop()` | 断开并移除界面（console / 网络采集继续，有上限） |
| `setUser(userId)` | 更新用户；会用新的 `hello` 重连一次 |
| `help(on)` | 发起 / 取消求助 |
| `nativeControl(nativeKey, action)` | 原生的接管 / 交还 / 结束 |
| `nativeDecide(nativeKey, requestId, value)` | `nativeApproval` 时回答 `status().pending`：接入审批传级别或 `null`，敏感操作确认传 `'allow'` 或 `null` |

`run()` 的选项：

| 选项 | 说明 |
|---|---|
| `userId` | 当前登录用户，随 `hello` 发送 |
| `deviceId` | 原生宿主传入的固定设备 ID（不传则存在 localStorage） |
| `helpButton` | 显示「求助」按钮（与项目策略取或） |
| `app` | 宿主 App 的 `{ name, version }` |
| `lang` | 手机用户看到的界面语言（胶囊、悬浮窗、底部栏、对话框、提示、eruda 里的 tab，以及敏感操作确认里「AI 想要…」的描述）：`'en'` 或 `'zh'`。默认：`navigator.language` 以 `zh` 开头时为 `'zh'`，否则 `'en'` |
| `networkExclude` | 不想让 agent 去翻的请求——一直 404 的字体、埋点上报等：`['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`。每条规则按不区分大小写的 URL 子串、带 `*` 的通配符，或写成 `/…/` 的正则来匹配。与项目策略里的规则合并。命中的请求不出现在网络列表里，也不产生 `net_fail` 时间线事件；页面仍然记录，agent 需要时可以用 `includeExcluded` 看到 |
| `lockScreen` | `false`：AI 接入期间默认不锁屏（用户可在悬浮窗里改）。默认 `true` |
| `theme` | `'auto'`（默认，跟随页面背景）、`'system'`、`'light'` 或 `'dark'` |
| `eruda` | `true` 或 `{ dock, load, src, name }`：收进 eruda 的「Remote Debugger」tab，`load` 在页面没有 eruda 时加载最新版。默认关闭，项目策略可远程打开，本地选项逐项优先 |
| `record` | `false`：本页面不写会话日志（已经存下的也不删）。默认 `true`；项目策略可以对所有页面关掉 |
| `launchId` | 本页面属于 App 的哪一次启动，让同一个 App 进程里的所有 WebView 把会话日志归到同一次会话下。原生宿主在这里传自己的 id（也可以定义 `window.RWDLaunchId`，字符串或返回字符串的函数）；不传时由 SDK 用会话 cookie 加心跳推断 |
| `nativeKey`、`deviceToken`、`nativeApproval` | 原生宿主用：`nativeControl` / `nativeDecide` 的密钥、由宿主保管的设备令牌、由原生弹出接入审批和操作确认 |

## 多语言

两类读者，两个设置：

- **手机用户**：`run({ lang })`，否则按浏览器语言（见上）。文案在 `src/i18n.ts`。
- **agent**：RPC 错误信息、时间线摘要（点击、页面内跳转、失败的请求）等跟随网关的 `welcome.agentLang`（`'en'` / `'zh'`）。收到 welcome 之前默认英文；最近一次的值记在 localStorage `rwd:alang`，下一个页面在 welcome 之前产生的事件也用它。文案在 `packages/chobitsu/src/engine/rwd/i18n.ts`。

因此中文用户可以和英文 agent 配合：对话框问的是「AI 想要点击「提交订单」，允许吗？」，用户拒绝时 agent 收到 `The user denied this action`。

## 页面内的行为（协议 §6–§8、§11）

- 权限级别：按 `welcome.level` / `control.level` 拦截 RPC（`forbidden`「需要 … 权限」）；有 agent 但网关没给级别时按 `interact`，没有 agent 时不额外限制。
- 设备令牌存 localStorage `rwd:dtoken`，resume 存 sessionStorage `rwd:resume`（绑定 pageId）。关闭码 4401：令牌在此期间变了（同设备另一个标签页刚拿到）就立即重试一次，否则 `rejected`，约 10 分钟后再试；4409：换新 pageId 重连；4429：`quota`，约 5 分钟后再试。
- 地址栏 `rwd_invite` 在 `run()` 时移出（`history.replaceState`），随 hello 发送直到收到 welcome。
- `welcome.config`：`helpButton`（与 `run()` 的选项取或）、`maskSelectors`、`maskPatterns`（快照、console、网络 URL、存储值、时间线摘要）、`confirmSelectors`、`networkExclude`（与 `run()` 选项里的规则合并）、`sessionLog`；上一次的配置记在 localStorage `rwd:cfg`，welcome 之前先用——所以项目关掉了会话日志，下一个页面从第一刻起就不会记录，不用等 welcome。
- 快照末尾会附一段 `[浮层]` 清单，列出盖在页面上的东西——弹窗遮罩、模态框、底部弹出层——带上标签、一小段文字、覆盖视口的比例和 ref。遮罩往往是个空元素，无障碍快照里没有它的节点，所以给的是 `oN` 而不是 `eN` 形式的 ref；agent 正是靠它点遮罩关掉弹窗。
- 点击先瞄元素可见区域的中心点，被挡住就再试它内部 3×3 网格上的其他点，所以按钮上盖个角标不影响点击。所有点都被挡住时，RPC 以 `not_interactable` 失败，并给出遮挡元素和它的 ref。
- 接入审批和敏感操作确认（`[data-rwd-confirm]`、`confirmSelectors`，含表单内回车提交）的对话框在 Shadow DOM 里，只认可信点击，按钮出现 0.4 秒后才可点；同源多个标签页之间用 BroadcastChannel 同步已处理的审批。

加载即开始采集 console、未捕获错误和网络（XHR、fetch、WebSocket、sendBeacon、EventSource），各最多 500 条，满了先丢普通日志 / 成功请求；响应体缓存总计不超过 5MB、单条 64KB。所以要在 `<head>` 里尽早同步加载。

## 会话日志（协议 §5.4）

上面那些缓冲只在单个页面的内存里。与此同时，SDK 还会把**会话日志**写进设备本地的 IndexedDB（`rwd-log`），这样 agent 在 bug 发生之后才接入，也能把来路完整读出来：

- 一个会话就是 App 的一次启动，同一来源下所有页面共用：`run({ launchId })`，否则 `window.RWDLaunchId`，否则由会话 cookie `rwd_launch` 加心跳推断（cookie 会话超过 1 小时没动静就算新的一次启动）。当前用的 id 见 `status().logSession`。
- 记录内容：页面打开 / 页面内跳转 / 前后台切换 / 离开，用户的点击、输入、提交和滚动停下的位置，agent 的交互类调用和 `rwd.evaluate`，控制状态变化，所有级别的 console，以及每个结束的请求——失败的还带脱敏后的请求头和正文（各 64KB）。网关连不上也照样记。被遮盖的字段存成 `••••`，`maskPatterns` 在写入时就生效。
- 保留量：最近 3 次启动，每次 10MB；超出先丢普通日志和成功的请求。存储配额不足 64MB 时只保留当前这次；没有 IndexedDB 时完全不记。
- agent 用 `rwd.log`（`observe`）和 `rwd.logDetail`（`advanced`，取请求头和正文）读取。除此之外不会离开设备。
- 关掉：单个页面用 `run({ record: false })`，整个项目用 `policy.sessionLog: false`——后者还会删除这个来源下已经存下的内容。

## 结构

- `src/index.ts`：对外 API、会话、RPC 分发、控制状态。
- `src/transport.ts`：页面 WS（原生 WebSocket 构造器）、心跳超时、指数退避重连、连续 3 次失败后每 60 秒 `POST /v1/presence`。
- `src/ids.ts`：deviceId / pageId / openerId。
- `src/launch.ts`：判断本页面属于 App 的哪一次启动（`launchId`、`window.RWDLaunchId`、`rwd_launch` cookie）。
- `src/pageWatch.ts`：`page` 消息（url、标题、可见性）和时间线事件（页面内跳转、用户点击摘要）。
- `src/ui.ts`、`src/lock.ts`：Shadow DOM 里的胶囊、求助按钮、遮罩、光圈、操作高亮、确认对话框；agent 接入期间拦截用户的可信输入，并显示已连接时长。
- `src/approval.ts`：接入审批、敏感操作确认（页面对话框或原生宿主 `nativeDecide`）。
- `src/i18n.ts`：用户界面文案（中 / 英）。
- agent 引擎在 chobitsu 旁边：`packages/chobitsu/src/engine/rwd/`（快照、`rwd.query`、可操作性检查、合成输入、键盘、console / 网络缓冲、截图、`rwd.storage`、IndexedDB 里的会话日志 `coldlog.ts`、浮层识别 `overlays.ts`、级别与确认规则 `policy.ts`、给 agent 的文案 `i18n.ts`），快照用的 Playwright 源码在 `packages/chobitsu/src/engine/vendor/playwright/`。构建时从源码打包进 `dist/sdk.js`。

## 构建与测试

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js（IIFE，全局 RemoteWebviewDebugger，ES2017），dist/index.mjs + index.d.ts（ES module）
npm run typecheck
npm test             # Playwright：WebKit（iPhone 15）+ Chromium（Pixel 7）
npm run gateway      # 本地 mock 网关：http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

测试用 `test/mock-gateway.mjs`（实现协议的页面侧：welcome、控制状态、RPC、presence，令牌、关闭码、级别、远程配置、`agentLang`、接入审批，并提供 `/v1/sdk.js` 和演示站；它不检查级别，以便测到页面自己的拦截），用例在 `test/e2e/`：除非用例另行指定，浏览器语言为 `zh-CN`、`agentLang` 为 `'zh'`；英文由 `i18n.spec.ts` 覆盖。共存测试会从 jsdelivr 加载 eruda 3.4.3 和 PageSpy 2.4.0，需要能访问外网。
