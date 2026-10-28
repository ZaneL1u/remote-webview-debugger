[English](protocol.md) | 简体中文

# RWD 协议（v1）

本文是网关（[`gateway/`](../gateway)）、页面 SDK（[`sdk/`](../sdk)，引擎在 [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine)）、控制台（[`console/`](../console)）和 MCP 客户端之间的契约。协议要改，先改本文。

整体设计（组件、授权模型、存储、安全）见 [architecture.zh-CN.md](architecture.zh-CN.md)；App 接入见 [native-integration.zh-CN.md](native-integration.zh-CN.md)。

约定：

- **网关地址**统一写成 `https://<域名>/v1`，例如 `https://rwd.example.com/v1`。所有接口都在它下面，SDK 也只靠它推出其余地址。
- 一律使用 JSON。时间字段都是 Unix 毫秒时间戳。
- `Level` 取 `"observe" | "interact" | "advanced"`（见 §6）。
- 接收方忽略本文没有列出的字段。新增字段一律可选，所以旧版 SDK 连新版网关也能正常工作。

## 目录

1. [地址一览](#1-地址一览)
2. [标识](#2-标识)
3. [页面连接 WebSocket](#3-页面连接-websocket)
4. [控制状态](#4-控制状态)
5. [页面 RPC](#5-页面-rpc)
6. [权限级别](#6-权限级别)
7. [接入审批](#7-接入审批)
8. [敏感操作确认](#8-敏感操作确认)
9. [轮询兜底](#9-轮询兜底)
10. [宿主 JavaScript 接口](#10-宿主-javascript-接口)
11. [项目策略](#11-项目策略)
12. [控制台 REST API](#12-控制台-rest-api)
13. [实时推送 SSE](#13-实时推送-sse)
14. [MCP](#14-mcp)
15. [语言](#15-语言)
16. [运维](#16-运维)

## 1. 地址一览

| 路径 | 说明 |
|---|---|
| `GET /v1/sdk.js` | 页面 SDK（IIFE，全局对象 `RemoteWebviewDebugger`）。`Cache-Control: max-age=300`，`Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | 同一个文件，按内容寻址的固定地址（缓存一年，可配合 SRI）。`<version>` 不对时返回 404，见 §16 |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Prometheus 指标（§16） |
| `WS /v1/page?key=<appKey>` | 页面连接（§3） |
| `POST /v1/presence` | WebSocket 连不上时的轮询兜底（§9） |
| `/v1/api/…` | 控制台 REST API（§12） |
| `/v1/mcp` | 托管 MCP，Streamable HTTP，`Authorization: Bearer rwd_sk_live_…`（§14） |
| `/demo/` | `--demo-dir` 指定目录下的静态文件，配置了才有 |
| 其他路径 | 控制台单页应用 |

`/v1/` 下的未知路径返回 `404 {"error":{"code":"not_found",…}}`。所有响应都带 `X-Content-Type-Options: nosniff` 和 `Referrer-Policy: no-referrer`；除 SDK 外还带 `X-Frame-Options: DENY`。

## 2. 标识

| 名称 | 格式 | 来源 |
|---|---|---|
| 接入 Key（App Key） | `rwd_pk_` + 24 位 base62 | 创建项目时生成。公开：会出现在页面源码里，只能让页面上线 |
| API Key | `rwd_sk_live_` + 32 位 base62 | 在控制台创建，只展示一次。服务端只存加了 pepper 的 HMAC-SHA256。控制台显示前 16 位（`prefix`，如 `rwd_sk_live_ab12`）；设备上看到的是 `"…"` 加 prefix 的末 4 位（`keyHint`） |
| `deviceId` | UUID v4（接受任意 `[A-Za-z0-9_-]{1,64}`） | SDK 生成并存在 localStorage `rwd:device`；原生宿主用 `run({ deviceId })` 传入 |
| 设备码 | `XXXX-XXXX`，字符集 `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | 网关第一次见到某个 `deviceId` 时分配，永不改变。agent 用设备码接入时不区分大小写，`-` 和空格可有可无 |
| `pageId` | 12 位 base62（接受任意 `[A-Za-z0-9_-]{1,64}`） | SDK 生成并存在 sessionStorage `rwd:page`：同一标签页刷新、跳转都不变，每个新标签页各有一个 |
| 页面标签 | `p1`、`p2`… | 网关按设备分配；页面在 2 分钟宽限期内重连时保留 |
| 会话（启动）id | 宿主 App 自己的启动 id（4–128 个 `[A-Za-z0-9_.:-]` 字符），否则是 SDK 生成的 16 位十六进制 | 代表 App 的一次启动，页面的会话日志按它归档（§5.4）。除了 `rwd.log` 的返回结果，不会发给网关 |
| `ref` | `e12`、`o3` 等 | `eN`：页面最近一次快照里的元素，下次对该页面拍快照前有效。`oN`：快照里没有对应节点的元素——浮层，或挡住点击位置的那个元素（§5.3）；只要它还在页面上就一直有效 |
| 设备令牌 | 64 位十六进制 | 每个 `deviceId` 只签发一次（§3.5），网关只存哈希 |
| 恢复令牌 | 32 位十六进制 | 每次 `welcome` 轮换（§3.5），只存哈希 |

## 3. 页面连接 WebSocket

### 3.1 生命周期

1. 页面打开 `wss://<域名>/v1/page?key=<appKey>`。升级为 WebSocket 之前，网关依次检查：
   - 限流：每个客户端 IP 每分钟最多 120 次连接（与轮询共用）→ 否则 `429 rate_limited`；
   - 接入 Key 存在、所属项目没有停用 → 否则 `401 bad_key`；
   - 项目配置了 `allowedOrigins` 时，`Origin` 必须匹配其中一项 → 否则 `403 origin_not_allowed`。
2. 只用文本帧，每帧一个 JSON 对象。上行消息最大 16 MiB（截图以 base64 传回）。
3. 页面必须在 **5 秒**内发出 `hello`。格式不对的 `hello`（JSON 无法解析、`t` 不对、`deviceId` / `pageId` 不合法）以 `1008` 关闭。
4. 网关回 `welcome`（§3.4），或者用协议关闭码关闭连接（§3.6）。
5. 网关每 **25 秒**发一次 `{"t":"hb"}`，同时发 WebSocket ping，10 秒内收不到 pong 就断开。SDK **60 秒**收不到任何消息就重连。
6. SDK 重连按指数退避，从 1 秒到 30 秒，每次的延迟在当前档位的后半段随机取值。**连续 3 次在收到 `welcome` 之前就断开**，SDK 改为轮询（§9）。
7. 同一个 `pageId` 的新连接会顶掉旧连接（旧连接以 `1000 replaced` 关闭）。
8. 页面断开后，标签和位置保留 **2 分钟宽限期**（页面跳转一般一秒内就会重连）。超过宽限期，时间线记一条 `closed`。有两种情况会提前结束等待，这样被重建的 WebView 不会一直挂在页面列表里显示「重连中」：
   - 有页面带着**新的 `pageId`** 连上来时，已断开、且 URL 相同（忽略 `#` 后面的部分）的页面立即被清掉；
   - 已断开的页面，如果有另一个**在线**页面显示同一个 URL，只等 **1.5 秒**就被清掉。

   两种情况下，如果被清掉的正是 agent 当前选中的页面，当前页面会切到在线的那个，并在结果里说明（§14.3）。
9. SDK 在 `pagehide` 时主动断开（这样页面能进入往返缓存），在 `pageshow` 时重连。

每个连接有一个 64 条的发送队列。页面跟不上时，网关以 `1013 slow consumer` 关闭它，而不是被它拖慢。

### 3.2 页面 → 网关

```jsonc
{"t":"hello","v":1,"sdk":"<SDK 版本>",
 "deviceId":"…","pageId":"…","openerId":"<pageId>"|null,
 "userId":"<字符串>"|null,
 "page":{"url":"…","title":"…","visibility":"visible"|"hidden"},
 "device":{"ua":"…","platform":"ios"|"android"|"web",
           "screen":{"w":393,"h":852,"dpr":3},
           "app":{"name":"…","version":"…"}|null},
 "help":false,
 "deviceToken":"<令牌>"|null,    // 当前版本的 SDK 总是带上这个字段，见 §3.5
 "resume":"<令牌>"|null,         // 这个 pageId 上次拿到的恢复令牌
 "invite":"<令牌>"|null}         // 来自 ?rwd_invite=…

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // 有变化时发
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap"|"nav","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // 用户点求助 / 取消求助
{"t":"control","action":"takeover"|"handback"|"end"}                // 用户的按钮，§4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"id":17,"result":{…}}                                              // RPC 成功，§5
{"id":17,"error":{"code":"not_found","message":"…"}}                // RPC 失败，§5
```

- `hello`：网关保存 `userId`（最长 128 字符）、`ua`（512）、`platform`（16）、`app`、`url`（2048）和 `title`（256）。`screen` 仅供参考。
- `event.summary` 是写给 agent 的一句话，已经去掉了被遮盖的值，例如 `TypeError: Cannot read properties of undefined (reading 'orderId')`、`POST /api/order → 405`、`点击了按钮「提交订单」`。网关把 `error`、`console_error`、`net_fail`、`user_tap` 记入时间线（最长 300 字节）。`nav` 是 SDK 在页面内跳转时发的，网关目前忽略它，跳转以 `page` 消息为准。
- SDK 会去重（2 秒内同类同摘要只发一次），每 10 秒最多发 30 条。离线期间产生的事件和控制操作先排队（最多 100 条），等下一个 `welcome` 后再发。
- `help` 和 `control` 只在用户亲手点击（或原生宿主调用，§10）时发出。

### 3.3 网关 → 页面

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"客服机器人"}|null,"level":"interact"|null}   // §4，发给设备的所有页面
{"t":"help","on":false}                                       // 求助被清除：agent 已接入，或控制台成员结束了调试
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"客服机器人"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7，发给前台页面
{"t":"attach_cancel","requestId":"…"}                         // §7，发给所有页面
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // 保留：SDK 在 afterMs 毫秒后重连
{"id":17,"method":"rwd.snapshot","params":{}}                 // RPC 请求，§5
```

SDK 能处理 `reconnect`，但网关目前不会发送它。

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null},
 "level":null,                       // 与 control.level 相同
 "resume":"<新的恢复令牌>",
 "deviceToken":"<令牌>",             // 只有这次新签发时才有
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},
 "agentLang":"en",                   // "en" | "zh"，§15
 "task":{…}}                         // 只有已接入的 agent 设置了任务时才有
```

`config` 是远程配置，取自页面所用接入 Key 对应项目的策略（§11）。`config.helpButton` 已经按这个页面的 `userId` 算好（`all`，或 `listed` 且该用户在名单里）。`config.networkExclude` 会和页面自己在 `run({ networkExclude })` 里传的规则合并（§10）。`config.sessionLog` 是项目对会话日志的总开关，为 `false` 时页面停止记录，并删除这个来源下已经存下的日志（§5.4）。SDK 把最近一次的 `config` 存在 localStorage `rwd:cfg`，下一个页面收到自己的 `welcome` 之前先沿用它。

如果有待处理的接入请求，而重连上来的正好是设备的前台页面，网关会在 `welcome` 之后立即重发 `attach_request`。

### 3.5 设备令牌、恢复令牌与邀请

**设备令牌。** 网关第一次从支持令牌的 SDK 见到某个 `deviceId` 时，在 `welcome.deviceToken` 里签发设备令牌（32 字节随机数，十六进制；服务端只存哈希）。此后这台设备的每个页面都必须在 `hello.deviceToken` 里出示它，缺失或不匹配时以 **4401** 关闭。所以只知道 `deviceId` 和公开的接入 Key，混不进别人的设备。

- SDK 把令牌存在 localStorage `rwd:dtoken`，并通过 `status().deviceToken` 暴露出来。localStorage 按来源隔离，所以会打开多个域名的原生宿主要自己保存令牌，再用 `run({ deviceToken })` 传回（见 [native-integration.zh-CN.md](native-integration.zh-CN.md)）。
- `hello` 里有 `deviceToken` 字段（哪怕值是 `null`）就表示 SDK 支持令牌。没有这个字段的 `hello` 来自存不住令牌的旧 SDK，网关不给它签发（签发了反而会把这台设备之后的页面锁在外面）；但设备一旦有了令牌，每个页面都必须出示。

**恢复令牌。** 每个 `welcome` 都会签发一个绑定 `pageId` 的新 `resume`。已知的 `pageId` 重连时，`hello.resume` 必须等于上一次签发的值，否则以 **4409** 关闭，SDK 换一个新的 `pageId` 重新开始。所以只知道 `pageId`，冒充不了页面。

**邀请。** 页面地址带 `?rwd_invite=<令牌>` 时，SDK 立即把这个参数从地址栏去掉（`history.replaceState`），令牌暂存在 sessionStorage，并在收到 `welcome` 之前一直随 `hello.invite` 发送。邀请属于同一个项目、未使用且未过期时，网关接受它：设备被标记为「通过邀请接入」并进入求助状态，时间线记录来自哪个邀请，邀请随即作废。无效的邀请会被静默忽略。见 §12.6。

### 3.6 关闭码

| 关闭码 | 含义 | SDK 的处理 |
|---|---|---|
| `1008` | `hello` 格式不对 | 按退避重连 |
| `1013` | 页面消费太慢，发送队列满了 | 按退避重连 |
| `4401` | 设备令牌缺失或不匹配 | 如果本地令牌在此期间变了（同设备的另一个标签页刚拿到），立即重试；否则状态变为 `rejected`，约 10 分钟后再试 |
| `4409` | 恢复令牌不匹配 | 换新的 `pageId` 重连 |
| `4429` | 项目在线设备数达到上限（`maxOnlineDevices`） | 状态变为 `quota`，约 5 分钟后再试 |

## 4. 控制状态

每台设备有一个控制状态，由网关决定，并通过 `control` 消息广播给这台设备的所有页面。

| 状态 | 含义 | 页面界面 |
|---|---|---|
| `none` | 没有 agent 接入 | 胶囊收起，只显示设备码（开启时另有求助按钮） |
| `observe` | agent 已接入，只在查看 | 「AI 正在查看这个页面」 |
| `agent` | agent 正在操作 | 拦截用户输入（除非用户关掉了锁定），屏幕边缘有光圈，按钮「接管」「结束」 |
| `user` | 用户已接管 | 不锁定，边缘光圈静止，按钮「交还 AI」「结束」 |

状态迁移：

| 触发 | 变化 |
|---|---|
| agent 接入（§7） | `none` → `observe` |
| agent 调用交互类工具（click、fill、type、press、select、hover、scroll、drag、navigate、back、reload） | `observe` → `agent`。处于 `user` 时，网关直接返回错误 `takeover`，不发给页面 |
| 超过 `policy.agentIdleMinutes`（默认 2，每 10 秒检查一次）没有交互 | `agent` → `observe` |
| 页面发来 `control: takeover` | `observe` / `agent` → `user` |
| 页面发来 `control: handback` | `user` → `agent`（没有 agent 时回到 `none`） |
| 页面发来 `control: end` | 断开 agent、清除求助 → `none` |
| agent 断开或被替换、它的 Key 被吊销、达到 `policy.attachMaxMinutes`（默认 60），或控制台成员结束调试 | → `none` |

用户接管期间，SDK 自己也会以 `takeover` 拒绝交互类 RPC，作为第二道检查。SDK 把状态在 localStorage `rwd:ctl` 里保留 2 分钟，页面跳转后新页面一加载就立即上锁，不用等 `welcome`。「接管」「交还 AI」「结束」只响应用户的真实点击，agent 点不到；原生宿主调用时必须出示 `nativeKey`（§10）。

## 5. 页面 RPC

### 5.1 消息格式

网关向某个页面发送 `{"id":<n>,"method":"rwd.…","params":{…}}`，页面回复 `{"id":<n>,"result":{…}}` 或 `{"id":<n>,"error":{"code":"…","message":"…"}}`。`id` 在一个连接内唯一。连接断开时，进行中的调用立即失败。

网关侧超时：MCP 调用 20 秒；`rwd.click` 和 `rwd.press` 45 秒（可能需要用户确认，§8）；控制台「测试连接」15 秒。

错误码：

| 错误码 | 含义 |
|---|---|
| `not_found` | `ref` 已失效或元素不存在、选项不存在、请求 id 不存在 |
| `not_interactable` | 不可见、被禁用、被遮挡、只读，或 5 秒内一直不稳定 |
| `timeout` | 等待超时（页面内或网关侧） |
| `takeover` | 用户已接管 |
| `forbidden` | 超出授予的级别（§6），或用户拒绝了确认 |
| `bad_request` | 参数缺失或不合法，方法不存在 |
| `internal` | 其他错误（message 里是 JavaScript 错误） |

SDK 写的错误信息使用 agent 的语言（`welcome.agentLang`，§15）。

### 5.2 方法

每个方法都作用于收到它的那个页面。

| 方法 | 级别 | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<毫秒>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}`：Playwright AI 模式的无障碍快照（YAML，元素带 `[ref=eN]`）；页面上有东西浮在内容之上时，末尾附一段浮层清单（§5.3） |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}`（至少一个条件；`limit` 1–100） | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`，见 §5.4 | 取决于 `op` |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}`：Playwright 键名，支持 `Control+A` 这样的组合 | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}`（页面随后会重连） |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | 一条会话日志的完整记录：`{"seq","session","at","kind","page","imp","size","data"}`，含请求头和正文（§5.4） |

说明：

- `rwd.query`：`role` 精确匹配（不区分大小写），`name` 和 `text` 按不区分大小写的子串匹配；`text` 包括元素自身和后代的文字，只返回最内层的匹配。
- `rwd.fill` 适用于文本输入框、textarea 和 `contenteditable` 元素（`<label>` 会转到它关联的控件）。它用原生 value setter 写值，再派发 `input` 和 `change`，React、Vue 的受控组件都能感知到。`<select>` 要用 `rwd.select`。
- `rwd.type`：给了 `ref` 就先聚焦它（光标移到末尾），否则输入到当前聚焦的元素；`submit: true` 时输入完按回车。
- `rwd.select` 把每个值依次与选项的 value、label、文字比较。传多个值时，下拉框必须是 `multiple`。
- `rwd.scroll`：不带 `ref` 时滚动整个页面；带 `ref` 时在元素上派发 wheel 事件，并滚动它所在的可滚动容器。滚动有约 0.3 秒的动画，方便用户跟上。
- `rwd.navigate` 只接受 `http(s)` 地址（可以是相对地址）。跳转、后退、刷新都在回复发出 50 毫秒后才执行。
- `rwd.waitFor`：先等 `timeMs`（最多 60 秒），再每 100 毫秒检查一次可见文字（`document.body.innerText`），直到 `text` 出现且 `textGone` 消失；超过 `timeoutMs` 返回 `timeout`。
- `rwd.screenshot`：宿主 App 注册了原生截图、并且截图区域在视口内时用原生截图（`source: "native"`）；否则重绘 DOM（`source: "dom"`，canvas、视频和跨域图片可能是空白）。`ref` 只截该元素；`fullPage` 截整个文档。见 §10。
- `rwd.console` / `rwd.network`：带 `sinceId` 时从它之后按时间顺序返回最早的 `limit` 条，不带时返回最新的 `limit` 条。进行中的请求 `status` 为 0、`durationMs` 为 `null`；`type` 取值 `xhr`、`fetch`、`websocket`、`beacon`、`eventsource`。
- `rwd.network` 会去掉命中排除规则的请求——项目策略的 `networkExclude` 加上 `run({ networkExclude })`（§11），再加上只对本次调用生效的 `exclude`——`hidden` 是被隐藏的条数。`includeExcluded: true` 时全部返回，`hidden` 为 0。被排除的请求页面仍然记录，`rwd.networkDetail` 按 id 照样能取到。
- `rwd.networkDetail` 把 `Cookie`、`Set-Cookie`、`Authorization`、`Proxy-Authorization` 请求头替换为 `••••`；正文经过遮盖，最多 64 KB。
- `rwd.storage` 最多返回 500 条，每个值最多 4000 字符。cookie 只包括脚本能读到的（非 HttpOnly）。SDK 自己的 `rwd:dtoken`、`rwd:resume` 始终被遮盖。
- `rwd.evaluate` 在页面的全局作用域里求值函数源码，并以 `this = window` 调用，可以返回 Promise。结果会转成可序列化的 JSON：`undefined` 和函数变成 `null`，DOM 元素变成简短的标签描述，日期变成 ISO 字符串，循环引用变成 `"[Circular]"`。

### 5.3 页面内的行为

- **可操作性检查。** 指针类操作最多等 5 秒，直到元素已挂载、可见、连续两帧位置不变、未禁用、已滚动到视口内，并且在目标点做命中测试时命中元素自身或其后代。先试元素可见区域的中心点（跟手指一样）；中心被挡住时，再依次试它可见矩形内 3×3 网格上的其他点，所以按钮上盖了个角标也点得到。所有点都被挡住时，调用以 `not_interactable` 失败，错误信息里带上遮挡元素和它的 `ref`（*点击位置被 `<div.popup-mask>` 遮挡（遮挡元素 ref=o1，可以直接 click 它…）*），agent 可以改点它。命中测试会跳过 SDK 自己的界面和其他调试工具（`.__chobitsu-hide__`、`#eruda`、`#__pageSpy`、`#__vconsole`）。
- **浮层。** 页面上有浮层（弹窗的遮罩、模态框、底部弹出层）时，快照末尾会附一段 `[浮层]` 清单。做法是对视口上的若干个点做命中测试，取其中处于 `fixed`（或占满视口的 `absolute`）盒子里、覆盖视口至少 15%、并且自身没有装下快照里一半元素的那一层（装下一半就是 App 自己的根节点，不是盖在上面的浮层）。每行给出元素标签、它的一小段文字（已遮盖敏感内容）、覆盖视口的比例和一个 `ref`；没有文字也没有图片、输入框等内容的，列为「遮罩」。空的遮罩在无障碍快照里没有节点，所以拿到的是 `oN` 形式的 ref——agent 正是靠它点遮罩关掉弹窗。
- **合成输入。** 一次点击派发 `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click`，触屏设备上同时派发 touch 事件。这些事件的 `isTrusted` 为 false，校验这个属性的页面不会响应。
- **可见反馈。** 目标元素会短暂高亮，派发输入前页面上的 AI 光标会先移到目标位置。
- **遮盖。** `input[type=password]`、带 `data-rwd-mask` 的元素和项目 `maskSelectors` 匹配的元素，它们的值在快照和截图里替换为 `••••`（原生截图里盖上灰块）。这些值以及匹配 `maskPatterns` 的文字，在 console 文本、网络 URL 和正文、存储值、事件摘要里也会被替换。
- **快照范围。** 快照以 `<body>` 为根。SDK 自己的界面在 `<html>` 下、`<body>` 之外的 Shadow DOM 里；eruda、PageSpy、vConsole 的节点会从快照里剔除。
- **缓冲。** 从 SDK 加载起就开始记录 console、未捕获的错误和网络请求（XHR、fetch、WebSocket、sendBeacon、EventSource），各用一个最多 500 条的环形缓冲。满了以后先丢普通日志和成功的请求，`dropped` 返回丢弃的数量。响应体缓存总共不超过 5 MB，单条不超过 64 KB。

### 5.4 会话日志

§5.3 的缓冲只存在单个页面的内存里。**会话日志**是它的长期版本：从 App 启动起，这个来源（origin）上发生的一切，由该来源的每个页面写入 **IndexedDB**（数据库 `rwd-log`），网关连不上也照样记录。所以 agent 事后接入，也能把一个 bug 的来路完整读出来，跨刷新、跨页面。除了已接入的 agent 主动读取，这些数据不会离开设备。

**一个会话就是 App 的一次启动。** 会话 id 按下面的顺序确定：

1. `run({ launchId })`——宿主 App 自己的启动 id，每次冷启动生成一个，同一进程里所有 WebView 共用；
2. `window.RWDLaunchId`，由宿主或接入代码定义：一个字符串，或者一个返回字符串（或字符串 Promise，最多等 300 毫秒）的函数；
3. 由 SDK 推断：一个会话 cookie `rwd_launch`（不设过期时间，所以随 App 进程消失），外加每 10 秒一次的心跳。一个 cookie 会话超过 **1 小时**没有动静，就按上一次启动处理、另起一个新 id——这样能兜住那些跨启动保留会话 cookie 的 WebView。

会话的 `source` 字段说明它来自哪种方式：1、2 为 `app`，3 为 `cookie`。

**记录哪些内容。** 每条记录有 `seq`（主键，递增）、`at`、`kind`、`page`（写入它的页面的 `pageId`）和 `data`：

| `kind` | `data` |
|---|---|
| `page` | `event: "open"`（url、title、referrer）、`"nav"`（from、url、title，含页面内跳转）、`"visibility"`（前台 / 后台）、`"hide"`（页面离开） |
| `action` | 用户自己的（可信）操作：`"tap"`（元素描述）、`"input"`（字段描述和值）、`"submit"`、`"scroll"`（滚动停下的位置）。密码框、带 `data-rwd-mask` 的元素和命中 `maskSelectors` 的字段，值一律存成 `••••`，绝不存明文；其他值按 `maskPatterns` 遮盖，并截断到 200 字符 |
| `agent` | agent 的交互类调用和 `rwd.evaluate`：方法名、`ref`、按键、url、values、文本，失败时还有错误。读取类调用（快照、各种列表）不记 |
| `control` | 控制状态变化及 agent 名称（§4） |
| `console` | 所有级别，带 `type`、`text`、`source` |
| `net` | 每个结束的请求：方法、url、状态码、类型、耗时、大小、错误。**失败的**请求还带 `reqHeaders` / `resHeaders`（脱敏方式同 `rwd.networkDetail`）和 `reqBody` / `resBody`，各截断到 64 KB |

console 的 error 和 warn、失败的请求、用户的点击 / 输入 / 提交、agent 操作和控制状态变化会被标为重要，保留最久。`problems` 和 `overview` 里所说的「问题」指 console 错误和失败的请求。

**容量限制。** 保留最近 **3** 次启动，每次不超过 **10 MB**。超出后先丢最早的非重要记录（普通 console 日志、成功的请求），再丢最早的全部记录，直到降到上限的 80%；丢掉的条数记在 `trimmed` 里。如果 `navigator.storage.estimate()` 报告的配额低于 64 MB，就只保留当前这次启动。没有 IndexedDB（某些隐私模式）时什么都不记，`rwd.log` 返回 `internal`。

**读取。** `rwd.log` 用 `op` 区分：

```jsonc
// op: "sessions" → 还存着的每次启动，新的在前
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview"，参数 {"session"?} → 一次启动的概览
{"session":{…meta…,"current":true},"first":<毫秒>,"last":<毫秒>,
 "pages":[{"at","page","data"}],      // page 的 open / nav 记录，最近 60 条
 "problems":[…记录…]}                // console 错误和失败的请求，最近 20 条

// op: "records"，参数 {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                     "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                     "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // 作为下一页的 `after` 传回来
 "hidden":0}                          // 被网络排除规则隐藏的请求条数（§11）
```

- `session` 默认是当前这次启动（传 `"current"` 等同于不传）；id 不存在时返回 `not_found`。当前没有在记录时，用存着的最新一次。
- `problems: true` 只返回 console 错误和失败的请求。`text` 按记录 `data` 的不区分大小写子串匹配。`limit` 取 1–500，默认 100。
- 返回的记录**不含**请求头和正文；有正文时 `data.hasBody` 为 `true`。要看完整内容用 `rwd.logDetail`，它和 `rwd.networkDetail` 一样需要 `advanced`（§6）。
- 网络排除规则在这里同样生效：命中规则的 `net` 记录不出现在 `records` 里，而是计入 `hidden`，除非传了 `includeExcluded`。

**关掉它。** `run({ record: false })` 让单个页面不写。`policy.sessionLog: false`（§11）通过 `welcome.config.sessionLog` 下发，页面会停止记录，**并删除这个来源下已经存下的日志**。`status().logSession` 是当前页面正在写入的会话 id，不在记录时为 `null`。

## 6. 权限级别

| 级别 | 允许的方法 |
|---|---|
| `observe` | `rwd.ping`、`rwd.snapshot`、`rwd.query`、`rwd.screenshot`、`rwd.console`、`rwd.network`、`rwd.waitFor`、`rwd.log` |
| `interact` | `observe` + `rwd.click`、`rwd.fill`、`rwd.type`、`rwd.press`、`rwd.select`、`rwd.hover`、`rwd.scroll`、`rwd.drag`、`rwd.navigate`、`rwd.back`、`rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`、`rwd.networkDetail`、`rwd.storage`、`rwd.logDetail` |

一次接入的生效级别为：

```
min(agent 申请的级别（默认 interact），
    API Key 的 maxLevel，
    合并后项目策略的 maxLevel，
    用户在设备上选择的级别)
```

两端都会检查：网关拒绝超出级别的调用（错误 `forbidden`，审计记 `policy.denied`）；SDK 在执行前再按 `welcome.level` / `control.level` 检查一次。网关把未知方法视为 `advanced`。agent 已接入而网关没有下发级别时，SDK 按 `interact` 处理。

## 7. 接入审批

agent 调用 `connect_device` 时，网关先合并设备上已打开页面所属各项目的策略（§11）。合并后 `approval` 为 `prompt` 时，必须由用户在设备上批准：

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"客服机器人","keyHint":"…a91f"},
   "levels":["observe","interact"],   // 可选的级别，已按 Key 和策略裁剪；最后一个是 agent 申请的
   "expiresInSec":30}
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // 或 "level": null 表示拒绝
← {"t":"attach_cancel","requestId":"…"}                         // 超时，或 agent 放弃了
```

- 请求只发给设备的**前台页面**；`attach_cancel` 发给所有页面。
- **30 秒**内没有答复按超时处理。MCP 调用会一直等到有结果。
- 同一个 API Key 在同一台设备上 10 分钟内被拒 **3 次**后，**10 分钟**内对这台设备的请求直接被拒，不再询问用户。
- 一台设备同时只能有一个待处理的请求。
- SDK 的确认框在 Shadow DOM 里，只响应可信点击，并且出现 0.4 秒后才生效，agent 没法替用户点「允许」。同源的多个标签页通过 BroadcastChannel 共享决定。
- 用户可以在 SDK 悬浮窗里开启「自动允许 AI 接入」并设定最高级别；之后 SDK 直接以不超过这个级别的最高可选级别答复，并弹出提示。
- `run({ nativeApproval: true })` 时 SDK 不弹窗，而是让 `status().pending` 变成 `{kind:"attach", requestId, agent:{name, keyHint}, levels, expiresAt}`，由原生宿主调用 `nativeDecide(nativeKey, requestId, level | null)` 答复。
- 批准后，网关让 agent 接入（顶替设备上的其他 agent），清除求助（`{"t":"help","on":false}`），并广播 `{"t":"control","state":"observe","agent":{…},"level":"interact"}`。

`approval: none` 时，agent 直接按计算出的级别接入。

**短时间内再接入不用重新审批。** agent 自己放开设备时——调用 `disconnect_device`、转去接入另一台设备，或者 `policy.attachMaxMinutes` 到时——网关会留下一张凭据：**10 分钟**内同一把 API Key 再接入这台设备，手机上不再弹窗，级别**不超过用户上次授予的级别**（上次给的是 `observe`，这次申请 `advanced` 也只能拿到 `observe`）。其余限制一样不放松：Key、项目策略和 agent 自己申请的级别照样封顶，设备也必须有已连接的页面。这种接入除了常规的 `attach.start`，还会多记一条 `attach.resume` 审计（§12.7）；页面收到的是普通的 `control` 消息，而不是 `attach_request`。

调试以其他方式结束时，这张凭据立即作废：用户在设备上点「结束」、控制台成员结束调试（`POST /devices/:id/end`）、API Key 被吊销，或者用户拒绝了一次请求。它只存在内存里，网关重启后也就没了。

## 8. 敏感操作确认

agent 做以下操作前，SDK 先请用户确认：

- 点击（`rwd.click`）匹配 `[data-rwd-confirm]` 或策略 `confirmSelectors` 的元素，或者这类元素内部的元素；
- 在这类元素上、或在包含这类元素的表单里按回车（`rwd.press`，或 `submit: true` 的 `rwd.type`）。在 textarea 和富文本编辑器里按回车不算。

确认框的文案类似：AI 想要点击「提交订单」，允许吗？它只响应可信点击，**30 秒**后失效。拒绝或超时时，RPC 返回 `{"code":"forbidden","message":"…"}`（消息为「用户拒绝了该操作」，语言见 §15）。同一时间只能有一个确认框；用户接管、agent 离开或连接断开时，确认框自动取消。

`nativeApproval: true` 时，`status().pending` 变成 `{kind:"confirm", requestId, action:'点击「提交订单」', expiresAt}`，宿主调用 `nativeDecide(nativeKey, requestId, "allow" | null)` 答复。`status().pending` 里确认请求优先于接入请求。

## 9. 轮询兜底

WebSocket 连续失败 3 次后，SDK 改为每 60 秒调用一次 `POST /v1/presence`。请求头是 `Content-Type: text/plain`、正文是 JSON，这样跨域时不触发预检；网关返回 `Access-Control-Allow-Origin: *`。

```jsonc
// 请求
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// 响应
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- 网关使用 `key`、`deviceId`、`userId` 和 `device.{ua, platform, app}`，其余字段仅供参考。接入 Key 和来源的校验与 WebSocket 相同，限流也共用。
- 每次轮询后，设备在 90 秒内都算在线。
- `connect: true` 表示页面应立即连 WebSocket。agent 对这台设备调用 `connect_device` 或 `wait_for_device` 时，网关会设置它。
- 作为保险，SDK 每第 5 次轮询也会主动重试一次 WebSocket。

## 10. 宿主 JavaScript 接口

SDK 暴露全局对象 `window.RemoteWebviewDebugger`。H5 页面直接调用 `run()`；原生宿主注入 SDK 后带上更多选项调用 `run()`（见 [native-integration.zh-CN.md](native-integration.zh-CN.md)）。

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null：当前登录用户，agent 和控制台都能看到
  helpButton,            // 显示「求助」按钮（与策略的 helpButton 取或）
  app,                   // 宿主 App 的 { name, version }
  lang,                  // 'en' | 'zh'：手机用户看到的界面语言，默认取 navigator.language
  theme,                 // 'auto'（默认）| 'system' | 'light' | 'dark'
  lockScreen,            // agent 操作时锁定页面（默认 true，用户可以在悬浮窗里改）
  eruda,                 // true | { dock, load, src, name }：以 eruda 标签页的形式出现
  networkExclude,        // 不让 agent 看到的请求（§11）
  record,                // 是否记录会话日志（默认 true，项目策略可以关掉，§5.4）
  // 原生宿主
  deviceId,              // 每次安装一个 id，所有 WebView、所有域名共用
  deviceToken,           // status().deviceToken 里的令牌，由宿主保存
  launchId,              // App 的这一次启动，同一进程的所有 WebView 共用（§5.4）
  nativeKey,             // 只有宿主知道的密钥，启用 nativeControl / nativeDecide
  nativeApproval,        // 由宿主自己展示接入审批和操作确认
}) // → Promise<{ deviceCode, status }>
```

| 函数 | 说明 |
|---|---|
| `run(gatewayUrl, appKey, options?)` | 让页面上线。网关答复后 resolve，最迟 8 秒后按已知信息 resolve。重复调用返回同一个 Promise |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`。`status` 取 `idle`、`connecting`、`online`、`polling`、`rejected`、`quota`、`stopped`；`logSession` 是本页面正在写入的会话日志 id，不在记录时为 `null`（§5.4） |
| `help(on = true)` | 求助，或取消求助 |
| `setUser(userId)` | 切换当前登录用户（SDK 用新的 `hello` 重连） |
| `stop()` | 断开并移除界面；console 和网络记录继续在有上限的缓冲里进行 |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | 原生的「接管」「交还 AI」「结束」按钮。密钥不对时返回 `false` |
| `nativeDecide(nativeKey, requestId, value)` | 答复 `status().pending`：`attach` 传级别或 `null`，`confirm` 传 `'allow'` 或 `null`。密钥、请求或取值不对时返回 `false` |

**启动 id。** 除了 `run({ launchId })`，宿主也可以在 SDK 运行前定义 `window.RWDLaunchId`：一个字符串，或者一个返回字符串、字符串 Promise 的函数（最多等 300 毫秒）。它必须是 4–128 个 `[A-Za-z0-9_.:-]` 字符，否则被忽略，由 SDK 自己推断这次启动（§5.4）。

`nativeKey` 只写在注入脚本里，比较时用常量时间。页面脚本（包括 agent 的 `evaluate_script`）读不到它，因此没法替用户交还控制权，也没法自己批准接入。

**原生截图桥。** 宿主注册了下面任意一个，`rwd.screenshot` 就用它拿真实像素（视频、canvas、跨域图片、盖在页面上的原生视图都在内）。它们都返回可见 WebView 的 PNG 或 JPEG data URL，或者不带前缀的 base64：

| 截图桥 | 平台 |
|---|---|
| `window.RWDNativeScreenshot()` | 任意宿主；返回 `string` 或 `Promise<string>` |
| `webkit.messageHandlers.rwdScreenshot` | iOS / macOS `WKWebView`，注册为 `WKScriptMessageHandlerWithReply`；收到的消息是 `{type:"screenshot"}` |
| `window.RWDAndroid.screenshot()` | Android，`@JavascriptInterface` 方法 |

参考实现：[`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift)。

## 11. 项目策略

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt：每次接入都要用户在设备上批准（默认 prompt）
  maxLevel: Level                  // 本项目允许的最高级别（默认 interact）
  maskSelectors: string[]          // 额外遮盖的 CSS 选择器（在密码框和 [data-rwd-mask] 之外）
  maskPatterns: { name: string; regex: string }[]  // 按正则遮盖文字，如手机号、证件号（JavaScript 正则）
  confirmSelectors: string[]       // 点击这些元素前需要用户确认（在 [data-rwd-confirm] 之外）
  networkExclude: string[]         // 不出现在 agent 看到的网络列表里的请求（§5.2）
  sessionLog: boolean              // 页面是否记录会话日志（默认 true，§5.4）
  helpButton: 'off' | 'all' | 'listed'   // 谁能看到「求助」按钮（默认 off）
  helpUsers: string[]              // helpButton = listed 时的 userId 名单
  agentIdleMinutes: number         // AI 操作中无动作多久回到仅查看（默认 2，最大 120）
  attachMaxMinutes: number         // 一次接入的最长时长（默认 60，最大 1440）
  maxOnlineDevices: number         // 0 表示不限；超出时新设备以 4429 关闭
  maxAgents: number                // 本项目设备上同时接入的 agent 数；0 表示不限
  eruda: { dock: boolean; load: boolean }  // run({ eruda }) 的远程默认值，本地选项逐项优先
}
```

- 保存时会规范化：`approval` 不是 `none` 的一律当作 `prompt`，无效的 `maxLevel` 当作 `interact`，数值会被限制在范围内。`maskPatterns` 必须能编译，否则返回 `400 bad_policy`。`maskSelectors`、`confirmSelectors`、`networkExclude`、`helpUsers` 会去掉空白项，各最多 50 条，`maskPatterns` 最多 20 条。
- **`networkExclude`** 用来挡掉 agent 不必去翻的噪音：一直 404 的字体、埋点上报等。每条规则按下面的方式与请求 URL 比较：不区分大小写的子串；带 `*` 的通配符（`*/404/*`）；写成 `/…/` 的正则（可带 flag，默认 `i`）。编译不过的规则什么都不匹配。命中的请求不出现在网络列表里，也不产生 `net_fail` 时间线事件，但页面仍然记录，agent 需要时可以用 `includeExcluded` 看到（§5.2、§14.3）。它只是图个清爽，不是隐私手段——不该离开页面的数据要用 `maskSelectors` / `maskPatterns`。
- **`sessionLog`** 不显式设为 `false` 就是开启，包括这个字段出现之前保存的老项目。关掉后，项目下所有页面停止记录，并删除这些设备上该来源已经存下的日志；单个页面也可以用 `run({ record: false })` 自行退出（§5.4）。
- 遮盖、确认、网络排除、会话日志、求助和 eruda 相关字段通过 `welcome.config` 下发给页面（§3.4）；页面自己在 `run({ networkExclude })` 里传的规则与项目的规则合并。
- **一台设备上有多个项目的页面。** 设备按 `deviceId` 区分，不分项目：同一台手机用不同接入 Key 打开的页面，都是同一台设备的页面。agent 接入时，网关合并已连接页面所属各项目的策略，每项取最严格的值：任一项目要求审批就需要审批；`maxLevel`、`agentIdleMinutes`、`attachMaxMinutes` 取最小值；`maxAgents` 取最小的非零值。

## 12. 控制台 REST API

### 12.1 约定

- 基础路径 `/v1/api`。用 `POST /auth/login` 登录，会话保存在 HttpOnly cookie `rwd_session` 中（12 小时，`SameSite=Lax`，HTTPS 下带 `Secure`）。每次请求都会重新读取账号，所以停用或删除成员立即生效。
- 需要登录的接口，除 `GET` / `HEAD` 外的请求都必须带 `X-RWD-CSRF: 1`，否则返回 `403 csrf`。
- 错误统一为 `{"error":{"code":"…","message":"…"}}`，配合 4xx/5xx 状态码。message 的语言跟随请求（§15）。
- 常见错误码：`401 unauthorized`（未登录）、`403 forbidden`（角色权限不足）、`403 csrf`、`404 not_found`、`400 bad_request`、`429 rate_limited`、`500 internal`。

角色：`owner`（全部权限，包括成员管理）；`admin`（项目、Key、策略、设备、邀请、审计）；`member`（查看项目和设备、测试连接、结束调试、创建设备邀请、查看审计）。下表中的 *member* 指任意已登录账号。

### 12.2 账号与成员

| 方法 | 路径 | 角色 | 请求 | 响应 |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}` 并写入 cookie。密码错误 `401 bad_password`；每 IP 每分钟超过 10 次 `429 rate_limited`。`email` 为空时视为 `admin` |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`。新密码 8–256 个字符；旧密码不对时 `400 bad_password` |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity"}` |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<域名>/invite/<token>"}`（7 天内有效，只能用一次）。邮箱已存在时 `409 conflict` |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`。会导致没有可用 owner 时 `409 last_owner` |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`。`409 self`、`409 last_owner` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}` 并登录。与登录共用限流 |

第一个 owner 在网关启动时由 `RWD_ADMIN_EMAIL`（默认 `admin`）和 `RWD_ADMIN_PASSWORD` 创建（见 [gateway/README.zh-CN.md](../gateway/README.zh-CN.md)）。控制台页面 `/invite/:token` 用于接受成员邀请。

### 12.3 项目

| 方法 | 路径 | 角色 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project`（使用默认策略） |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`。`policy` 合并到现有策略上 |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | 换了新接入 Key 的 `Project` |
| GET | `/projects/:id/integration` | member | — | `Integration` |

`allowedOrigins` 每项是完整的来源，例如 `https://m.example.com`，支持一个前导通配符：`https://*.example.com` 匹配任意子域名，但不匹配 `https://example.com` 本身。为空表示不限制。`inviteUrl` 必须是 `http(s)` 地址。

### 12.4 API Key

API Key 属于整个网关，不属于某个项目：一个 Key 能访问所有设备。

| 方法 | 路径 | 角色 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/keys` | member | — | `{"keys":[ApiKey]}` |
| POST | `/keys` | admin | `{"name","maxLevel"?:"interact","expiresInDays"?:90,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}`：完整的 Key 只在这里返回一次 |
| DELETE | `/keys/:id` | admin | — | `{"ok":true}`。吊销立即生效：该 Key 的 agent 被断开，它的下一个 MCP 请求返回 401 |

`expiresInDays: 0` 表示永不过期。`ipAllowlist` 填 IP 或 CIDR；设置后，其他地址发来的 MCP 请求返回 401。`GET` / `POST /projects/:id/keys` 是 `/keys` 的旧路径，效果相同。

### 12.5 设备与网关状态

| 方法 | 路径 | 角色 | 响应 |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}`（`pageSize` 最大 100）。`online`（默认）：在线设备，按本次上线时间倒序；`q` 匹配设备 ID、设备码（`-` 可省略）、userId、UA、系统描述和项目名。`all`：所有出现过的设备，按首次出现时间倒序；`q` 匹配设备 ID、设备码、userId 和 UA |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}`：最近一个页面来自该项目的设备（默认 `all`，最多 500 台）。求助中的在前，其次在线，再按最近在线时间。`waiting` 指求助中 |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | 始终返回 `200`：`{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<前 4000 个字符>","error"?:{"code","message"}}`。错误码：`device_offline`、`no_page`（页面正在重连）、`timeout`、`takeover`、`internal`，以及 §5.1 的 RPC 错误码 |
| POST | `/devices/:id/end` | member | `{"ok":true}`：断开 agent，清除求助，控制状态回到 `none` |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |

### 12.6 设备邀请

用户打开邀请链接，设备就会上线并直接处于求助状态，不用再口头报设备码。

| 方法 | 路径 | 角色 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}`（服务端不保存令牌，所以这里的 `link` 是不带令牌的目标地址） |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | `DeviceInvite`，`link` 为完整链接（`<url>?rwd_invite=<令牌>`） |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url` 默认取项目的 `inviteUrl`，两者至少要有一个。`expiresInMinutes` 最长 7 天。链接打开的页面必须用同一个项目的接入 Key 加载 SDK（§3.5）。

### 12.7 审计日志

`GET /audit?project=&device=<设备码>&actor=&action=&from=&to=&limit=50&before=<id>`（member）→ `{"events":[AuditEvent],"nextBefore":<id>|null}`，新的在前。`limit` 最大 200；`action` 按前缀匹配（`attach.` 匹配所有接入相关事件）；`actor` 匹配操作者的 id 或名称。

| action | 场景 |
|---|---|
| `auth.login`、`auth.login_failed` | 控制台登录 |
| `member.invite`、`member.accept`、`member.update`、`member.delete` | 成员管理 |
| `project.create`、`project.update`、`project.delete`、`project.rotate_app_key` | 项目 |
| `key.create`、`key.revoke` | API Key |
| `invite.create`、`invite.delete`、`invite.use` | 设备邀请 |
| `attach.request`、`attach.approve`、`attach.deny`、`attach.timeout`、`attach.resume`、`attach.start`、`attach.end` | agent 接入。`attach.resume` 表示这把 Key 在宽限期内直接回来了，没有再次询问用户（§7）；`detail: {level}` |
| `rpc` | agent 发给页面的每个 RPC；`detail: {method, page, latencyMs, error?}` |
| `control.takeover`、`control.handback`、`control.end` | 用户点了按钮 |
| `device.end` | 控制台成员结束了调试 |
| `policy.denied` | 超出级别的调用被拒绝 |

审计记录从不包含页面内容和参数值。默认保留 180 天（`RWD_AUDIT_RETENTION_DAYS`）。

### 12.8 类型

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
}

type Integration = {
  appKey: string; gatewayUrl: string; sdkUrl: string
  firstSeenAt: number | null; onlineDevices: number; lastDevice: Device | null
}

type Device = {
  id: string /* deviceId */; code: string
  projectId: string            // 最近一个页面所属的项目
  projects: string[]           // 已连接页面所属的项目
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* 本次上线时间，只在在线时有 */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; expiresAt: number } | null
  task?: Task                  // 只有已接入的 agent 设置了任务时才有
  pages: number                // 已连接的页面数
  sdk: string                  // 页面上报的 SDK 版本
  currentPage: { label: string; url: string; title: string } | null  // 用户最可能正在看的页面
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // 只在 GET /devices 中有
}

type SystemInfo = {            // 由 UA 解析
  os: string; osVersion: string; model: string; browser: string
  label: string                // 如 "iOS 18.0 · iPhone · WebView"、"Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // 用户最可能正在看的页面
  selected: boolean            // agent 当前操作的页面
  openerLabel: string | null; connectedAt: number
}

type TimelineEvent = { at: number; page: string /* 页面标签；设备级事件为 "" */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // 取代页面数
  timeline: TimelineEvent[]    // 最近 100 条，旧的在前
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* 尚未接受邀请 */
  createdAt: number; lastLoginAt: number | null
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* 设备码、Key 前缀、成员邮箱等 */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}
```

### 12.9 时间线事件

每台设备在内存里保留最近 300 条时间线事件；控制台显示最近 100 条，MCP 默认取最近 50 条。

| `kind` | 含义 |
|---|---|
| `opened` / `closed` | 页面首次连接 / 超过宽限期后消失（§3.1） |
| `navigated` / `reloaded` | 页面跳转到新地址 / 在原地址重新连接 |
| `focus` | 页面回到前台 |
| `error` / `console_error` / `net_fail` / `user_tap` | 页面上报的事件（§3.2） |
| `help` | 用户求助或取消求助，或者通过邀请接入 |
| `agent` | 接入请求、拒绝、超时、接入成功、任务变化 |
| `control` | 控制状态变化，摘要里说明原因（用户接管、AI 空闲、用户结束等） |
| `offline` | 有 agent 接入时，设备的最后一个页面断开了 |

## 13. 实时推送 SSE

`GET /v1/api/stream[?project=<id>][&lang=en|zh]`（member，cookie 鉴权），返回 `text/event-stream`：

```
retry: 3000

event: device     data: Device                               设备状态变化（上线、求助、控制状态、审批、任务等）
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   每 25 秒一次
```

不带 `project` 时推送所有项目的事件。`EventSource` 不能设置请求头，所以语言通过 `?lang=` 传。消费太慢的订阅者会丢事件，而不会拖慢网关；控制台重连后会重新拉取数据，推送不可用时退回轮询。

## 14. MCP

### 14.1 会话

- 地址 `/v1/mcp`（Streamable HTTP）。每个请求都必须带 `Authorization: Bearer <API Key>`。每次请求都会校验 Key，所以 Key 被吊销、过期，或请求来源不在 `ipAllowlist` 内时，立即返回 401。
- 网关按 API Key 保存 agent 状态：接入的设备和当前页面。使用同一个 Key 的多个 MCP 会话共享这份状态。一个 agent 同时只接入一台设备，接入另一台会先离开前一台。一个 Key 能访问网关上的所有设备。
- 同一个 Key 每分钟查找设备失败超过 5 次，这一分钟内的后续查找都会被拒绝，防止猜设备码。

### 14.2 返回结果

每个工具结果的末尾都附带这台设备自 agent 上一次调用以来的变化（最多 20 行），agent 不用轮询就能知道新页面、跳转、错误和用户接管：

```
[会话变化]
- p3「结算页」打开（由 p2 打开）
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- 用户接管了控制
```

来自页面的内容（快照、console、网络、存储、脚本执行结果、时间线）会用标签包起来，并注明是不可信数据，避免 agent 执行其中的指令。

### 14.3 工具

| 工具 | 级别 | 参数 | 说明 |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all`（默认 `online`）、`userId?`、`deviceCode?` | 最多 50 台，求助中的排在最前 |
| `connect_device` | — | `device`（设备码或 deviceId）、`level?: Level`（默认 `interact`）、`follow?: true` | 接入设备，需要时先请用户审批（§7）；自己放开设备后 10 分钟内，同一把 Key 再接入不用重新审批，级别不超过上次授予的。接入后选中前台页面。设备没有已连接的页面时失败（并让轮询中的设备尽快重连） |
| `disconnect_device` | — | — | 离开设备 |
| `wait_for_device` | — | `device`、`timeoutSec?: 60`（最大 300） | 等待设备有页面连上；轮询中的设备会被通知立即重连 |
| `list_pages` | — | — | 设备的页面：标签、标题、地址、是否选中、前台/后台、是否在重连、打开者 |
| `select_page` | — | `page`（标签） | 切换当前页面 |
| `take_snapshot` | observe | `page?` | 带 ref 的无障碍快照，并附上盖在页面上的浮层及其 ref（§5.3） |
| `find_elements` | observe | `text?`、`role?`、`name?`、`limit?`、`page?` | 按文字、角色、名称找元素并返回 ref，不用拍整份快照（`rwd.query`） |
| `take_screenshot` | observe | `page?`、`fullPage?`、`format?: jpeg\|png` | 返回图片 |
| `wait_for` | observe | `text?`、`textGone?`、`timeSec?`（最大 30） | 在当前页面上等待 |
| `list_console_messages` | observe | `scope?: page\|session`、`types?`、`limit?: 50` | `session` 合并所有已连接页面，每行标出页面 |
| `list_network_requests` | observe | `scope?`、`failedOnly?`、`limit?: 50`、`exclude?`、`includeExcluded?` | 同上；请求 id 写成 `<标签>:<id>`。`exclude` 在项目和页面已有的规则之外，为这一次调用再加规则（§11）；有请求被规则隐藏时，结果末尾会写「有 N 条请求按排除规则隐藏了」，传 `includeExcluded: true` 可以看到 |
| `click` / `hover` | interact | `ref` | 点击被浮层挡住时以 `not_interactable` 失败，并给出遮挡元素的 `ref`，可以改点它（§5.3） |
| `fill` | interact | `ref`、`value` | |
| `type_text` | interact | `text`、`ref?`、`submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`、`values` | |
| `scroll` | interact | `ref?`、`dx?`、`dy?`（默认 `dy: 600`） | |
| `drag` | interact | `fromRef`、`toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]`（1–30 个）、`stopOnError?: true` | 按顺序执行 `click`、`fill`、`type_text`、`press_key`、`select_option`、`hover`、`scroll`、`wait_for`，一次返回全部结果 |
| `get_network_request` | advanced | `id`（列表里的 `<标签>:<id>`，或当前页面的纯 id） | 请求头和正文 |
| `get_storage` | advanced | `area: local\|session\|cookie`、`page?` | |
| `evaluate_script` | advanced | `function`、`args?`、`page?` | 在页面里执行 JavaScript；结果超过 20000 个字符会被截断 |
| `get_session_timeline` | — | `limit?: 50` | 设备跨页面的时间线 |
| `get_session_overview` | observe | `session?` | 本次启动的会话日志概览（§5.4）：什么时候开始、存了多少、各类记录条数、访问过的页面、最近 20 条错误和失败请求，以及除这次之外还留着的启动 |
| `get_session_log` | observe | `session?`、`kinds?`、`problems?`、`page?`、`text?`、`after?`、`limit?`、`seq?`、`exclude?`、`includeExcluded?` | 逐条读会话日志，每行形如 `#<seq> <时间> <页面> <内容>`。`page` 可以传 `p2` 这样的标签，或日志里显示的页面 id；`after` 从上一次结果末尾的 `seq` 继续翻页。传 `seq` 则改为显示那一条的完整内容（含请求头和正文；它走 `rwd.logDetail`，需要 `advanced`） |
| `wait_for_page` | — | `urlContains?`、`titleContains?`、`timeoutSec?: 30`（最大 300） | 等待自上次调用以来新打开或跳转的页面 |
| `wait_for_event` | — | `kind?`（取值见 §12.9）、`page?`、`timeoutSec?: 30`（最大 300） | 等待下一条匹配的时间线事件 |
| `wait_for_control` | — | `timeoutSec?: 120`（最大 600） | 用户接管后，等待用户交还（或结束） |
| `set_task` | — | `title`（≤ 24 个字符）、`steps?`（≤ 12 步，每步 ≤ 28 个字符）、`current?` | 在设备所有页面顶部显示 agent 的任务和计划步骤。`current` 是进行中的步骤序号，等于步骤数表示完成。页面以 `task` 消息收到（§3.3）；agent 离开时清除 |

`page?` 只让这一次调用作用在另一个页面（按标签），不改变当前选中的页面。超出接入级别的工具会返回「需要 advanced 权限，当前接入级别为 interact」，并记一条 `policy.denied` 审计。

**跟随模式。** `follow: true`（默认）时，agent 的操作打开了新页面、用户把另一个页面切到前台，或者当前页面消失超过 1.5 秒，网关都会自动切换当前页面，并在结果里说明。当前页面作为过期页面被清掉时（§3.1），不论 `follow` 取什么，都会切到显示同一个 URL 的那个页面——旧的条目已经不在了。

### 14.4 本地 stdio 桥

给只支持 stdio 的 MCP 客户端用：

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

它只是把 stdio 转发到托管的 `/v1/mcp`。`--gateway` 也可以用环境变量 `RWD_GATEWAY` 指定。

## 15. 语言

支持英文（`en`）和简体中文（`zh`），也接受 `en-US`、`zh-CN`、`zh_CN`、`zh-Hans` 等写法。

| 面向 | 内容 | 由谁决定 |
|---|---|---|
| agent | MCP 说明、工具与参数描述、工具结果、`[Session changes]` / `[会话变化]`、错误信息 | 网关的 `RWD_LANG` / `--lang`（默认 `en`） |
| agent（页面侧） | SDK 写的 RPC 错误信息和事件摘要 | `welcome.agentLang`，即网关的语言。SDK 把最近一次的值存在 localStorage `rwd:alang`，下一个 `welcome` 到达前产生的事件也用它；没收到过时用英文 |
| 控制台 | REST 和 SSE 响应里的错误信息、时间线摘要、系统描述 | 请求的 `?lang=`，其次 `Accept-Language`，最后是网关的语言 |
| 手机用户 | SDK 的胶囊、状态条、对话框和提示 | `run({ lang })`，否则取 `navigator.language`（`zh` 开头 → `zh`，其他 → `en`） |

所以说中文的用户可以和说英文的 agent 配合：确认框显示 *AI 想要点击「提交订单」，允许吗？*，用户拒绝后 agent 读到的是 *The user denied this action*。

## 16. 运维

- **指标。** `GET /v1/metrics` 返回 Prometheus 文本格式。设置了 `RWD_METRICS_TOKEN` 时需要 `Authorization: Bearer <token>`。指标：`rwd_online_devices{project}`、`rwd_connected_pages`、`rwd_attached_agents`、`rwd_ws_connections`、`rwd_rpc_total{method,result}`、`rwd_rpc_duration_seconds{method}`（直方图）、`rwd_http_requests_total{code}`。
- **SDK 版本。** 用于缓存的 SDK 版本号是网关内嵌 `sdk.js` 的 SHA-256 前 12 位十六进制，文件一变，`/v1/sdk/<version>/sdk.js` 的地址就跟着变。`GET /v1/api/config` 以 `sdkVersion` 返回它，同时返回 `sdkIntegrity`（`sha384-…`，用于 `integrity` 属性）。控制台提供固定版本的接入代码。
- **数据库。** 设置 `RWD_DATABASE_URL=postgres://…`（或 `postgresql://`）时使用 Postgres，否则 `RWD_DATA`（默认 `rwd.db`）是 SQLite 文件路径。启动时自动建表和迁移。
- **限流。** 控制台登录和接受邀请：每个客户端 IP 每分钟 10 次。页面连接和轮询：每个客户端 IP 每分钟 120 次。只有开启 `--trust-proxy` 时才从 `X-Forwarded-For` 取客户端 IP。
- **审计保留。** `RWD_AUDIT_RETENTION_DAYS`（默认 180 天），每 6 小时清理一次过期记录。

网关的全部配置项见 [gateway/README.zh-CN.md](../gateway/README.zh-CN.md)。
