[English](README.md) | 简体中文

# 公开演示网关

[debugger.site](https://debugger.site/zh/#live) 让任何人都能体验真实效果的做法：一个给每位访客签发自己 API Key 的网关。访客在手机上打开演示商城，把这个网关加给自己的 agent，然后看它操作。它就是带演示配置的[平台部署](../platform/README.zh-CN.md)，有自己的目录和数据库，每天从头开始。

## 访客能做什么

1. 打开 `https://<演示域名>/` 上的演示商城（`examples/platform-demo`）：先经过入口 `/demo/`，再带着当天的 AppKey（`?key=`，商城会记住，供其他页面使用）进入商城。页面上的 SDK 胶囊显示这个页面的设备码。
2. 一把自己的 API Key：官网通过 `POST https://<演示域名>/v1/demo/keys` 申请（网关开启了 `RWD_DEMO_KEYS=1`），填进 `claude mcp add` 命令和 MCP 客户端配置里。
3. 访客的 agent 用设备码接入，访客在页面上点「允许」，看它复现商城的结算 bug。

官网把商城内嵌在一个手机框里（访客不用离开页面就能试）；商城通过 `postMessage` 把设备码告诉官网，只发给官网自己的源（`rwd-boot.js`）。

## 限制

任何人都能拿到 Key，所以演示网关被圈在一个小范围里：

| 项目 | 设置 |
|---|---|
| 隔离 | 独立的部署目录、数据库和 Key，不和任何其他网关共享 |
| 对外暴露 | 只有 `/v1/sdk.js`、`/v1/sdk/*`、`/v1/locales/*`、`/v1/page`、`/v1/presence`、`/v1/mcp`、`/v1/demo/keys`、`/v1/healthz` 和 `/demo/*`（`Caddyfile.site`）。控制台及其 API 只在 `127.0.0.1` 上 |
| 页面 | 项目的 AppKey 只能在演示自己的源上使用（`allowedOrigins`），不能被别的网站拿去当免费中转；在线设备最多 300 台 |
| API Key | 每位访客一把，访客之间不会共用一个 agent：审批、10 分钟免审批重连窗口和设备码输错封禁都按 Key 计。权限级别 `interact`（不能用 `evaluate_script`，不能读请求体和存储），24 小时有效，每个 IP 每小时最多 5 把，全部访客每小时最多 500 把 |
| 设备 | `list_devices` 必须带 `deviceCode`：agent 只能找到访客告诉它设备码的那台设备 |
| Agent | 每次接入都要访客在页面上同意；同时最多 100 个 agent；每个 agent 最多占用页面 15 分钟，空闲 5 分钟即释放 |
| 频率 | 每个客户端 IP 每分钟 120 次 MCP 请求（`RWD_MCP_RATE_LIMIT`）；页面连接和设备码查询沿用网关自身的限制 |
| 数据 | 每天清空（cron 在服务器时间 04:00 运行 `reset.sh`），审计日志保留 1 天 |

知道别人设备码的 agent 仍然可以请求接入，但对方能看到是谁在请求并拒绝，而且商城里没有任何真实数据。

## 文件

| 文件 | 作用 |
|---|---|
| `deploy.sh` | 用 `../platform/deploy.sh` 部署到独立目录（默认 `rwd-demo`，端口 `18789`），往 `.env` 里加上演示配置，安装 `reset.sh` 和对应的 cron 任务，并先运行一次 |
| `reset.sh` | 在服务器上运行：停掉网关、删除数据库、重新启动，以 owner 身份登录，创建演示项目（来源、策略），写出 `demo/rwd-demo.json` 和入口页 `demo/index.html`。需要 `curl` 和 `jq` |
| `Caddyfile.site` | 放进主机自己的 Caddy（负责 HTTPS）的站点配置：上面那些公开路由、`/` 跳到入口页，以及 `rwd-demo.json` 的 CORS（`/v1/demo/keys` 的 CORS 由网关自己设置） |

`demo/rwd-demo.json`（地址是 `/demo/rwd-demo.json`）：

```json
{
  "gateway": "https://demo.example.com/v1",
  "mcp": "https://demo.example.com/v1/mcp",
  "keys": "https://demo.example.com/v1/demo/keys",
  "shop": "https://demo.example.com/demo/",
  "appKey": "rwd_pk_…",
  "resetAt": 1789830000000
}
```

入口页 `demo/index.html` 把访客送到 `platform-demo/?key=<appKey>`，并带上自己的查询参数（如 `?lang=zh`，以及指定 SDK 界面语言的 `?ui=<tag>`，官网会把它设成访客的语言）。AppKey 放在地址里，而不是由商城去请求，这样 SDK 能随页面一起启动，记录下结算页加载时抛出的错误。

## 部署

环境要求同[平台部署](../platform/README.zh-CN.md#环境要求)，另外服务器上要有 `curl` 和 `jq`，并且已经用 Caddy（或者能做到 `Caddyfile.site` 同样效果的代理）提供 HTTPS。

1. 给演示域名（比如 `demo.example.com`）加一条指向服务器的 DNS 记录。
2. 部署：

   ```bash
   deploy/demo/deploy.sh my-server arm64 demo.example.com
   ```

   首次部署会打印一次 owner 密码（也保存在 `rwd-demo/.env` 里）。想发布在 `127.0.0.1:18789` 以外的端口，设置 `PORT`。
3. 把 `Caddyfile.site` 复制进主机的 Caddy 配置，把 `demo.example.com` 换成演示域名，重新加载 Caddy。
4. 检查：`https://demo.example.com/` 能打开带设备码的商城，`curl -X POST https://demo.example.com/v1/demo/keys` 能拿到一把 Key。

再次运行 `deploy.sh` 会更新网关并让演示从头开始（换新 AppKey，访客的 Key 全部作废）。cron 任务会被替换，不会重复添加。

## 日常运维

```bash
cd ~/rwd-demo
./reset.sh                     # 立即从头开始（新的 AppKey，访客的 Key 全部作废）
tail reset.log                 # 每天的重置记录
docker compose logs -f gateway
```

- 调整限制：修改 `.env` 里的 `RWD_MCP_RATE_LIMIT`（然后 `docker compose up -d`），或者修改 `reset.sh` 里的策略（然后运行它）。
- 使用控制台需要走隧道：`ssh -L 18789:127.0.0.1:18789 my-server`，然后打开 `http://localhost:18789`，用 `.env` 里的 owner 登录。
- 每次重置都会删除访客的 Key。官网会记住访客的 Key，直到下一次重置（`rwd-demo.json` 里的 `resetAt`），之后再申请新的；还用着旧 Key 的 agent 会收到 `401`。
