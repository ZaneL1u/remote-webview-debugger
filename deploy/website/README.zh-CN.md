[English](README.md) | 简体中文

# 官网部署

[debugger.site](https://debugger.site) 就是一堆静态文件（`website/dist`）。每次推送到 `main`，CI 都会构建一遍，并把结果发布到本仓库的 `gh-pages` 分支（`.github/workflows/ci.yml` 里的 "Website" job）。网站主机**主动拉取**这个分支；没有任何东西往主机上推，所以仓库里没有部署密钥、没有主机名，也不需要主机对外开放任何入口。

```
推送到 main ──CI──▶ gh-pages 分支 ◀──每 5 分钟── 主机上的 pull.sh ──▶ /srv/debugger.site ──▶ Caddy
```

## 文件

| 文件 | 作用 |
|---|---|
| `pull.sh` | 用 `git ls-remote` 比较分支最新提交和已部署的提交；不一样时把分支下载成 tarball，解压到网站根目录旁边，再用一次重命名换进去。设置项：`REPO`、`BRANCH`、`TARGET` |
| `pull.service`、`pull.timer` | 每 5 分钟运行一次的 systemd 单元 |

## 配置一台主机

1. 复制脚本和单元：

   ```bash
   sudo install -m 755 deploy/website/pull.sh /usr/local/bin/debugger-site-pull
   sudo install -m 644 deploy/website/pull.service /etc/systemd/system/debugger-site-pull.service
   sudo install -m 644 deploy/website/pull.timer /etc/systemd/system/debugger-site-pull.timer
   sudo systemctl daemon-reload
   sudo systemctl enable --now debugger-site-pull.timer
   sudo systemctl start debugger-site-pull.service   # 马上拉第一次
   ```

   要换目录或跟随自己的 fork，在 service 的 `[Service]` 段里用 `Environment=` 设置 `TARGET` / `REPO`。

2. 把网站根目录作为静态文件提供。用 Caddy 的话：

   ```caddy
   debugger.site {
   	root * /srv/debugger.site
   	encode zstd gzip
   	header /_astro/* Cache-Control "public, max-age=31536000, immutable"
   	file_server
   	handle_errors {
   		@404 expression {err.status_code} == 404
   		handle @404 {
   			rewrite * /404.html
   			file_server
   		}
   	}
   }
   ```

   不要做 SPA 回退：未知路径必须返回 404（演示商城就指望 `api/coupon` 和 `api/recommend.json` 不存在）。`file_server` 会自动把 `/zh` 跳到 `/zh/`，每种语言都一样。

## 运维

```bash
systemctl list-timers debugger-site-pull.timer   # 下次运行时间
journalctl -u debugger-site-pull.service -n 20   # 最近几次做了什么
sudo systemctl start debugger-site-pull.service  # 立刻拉一次
cat /srv/debugger.site.commit                    # 当前部署的 gh-pages 提交
```

CI 跑完后大约五分钟内改动就会上线。要回滚，在 `main` 上 revert 那个提交，下一次 CI 会把上一版网站重新发布出去。
