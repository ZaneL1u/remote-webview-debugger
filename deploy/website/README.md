English | [简体中文](README.zh-CN.md)

# Website deployment

[debugger.site](https://debugger.site) is static files (`website/dist`). CI builds them on every push to `main` and publishes the result to the `gh-pages` branch of this repository (`.github/workflows/ci.yml`, job "Website"). The web host **pulls** that branch; nothing pushes to it, so the repository holds no deploy keys, no host names and no inbound access of any kind.

```
push to main ──CI──▶ gh-pages branch ◀──every 5 min── pull.sh on the host ──▶ /srv/debugger.site ──▶ Caddy
```

## Files

| File | Purpose |
|---|---|
| `pull.sh` | Compares the branch head (`git ls-remote`) with the deployed commit; when they differ, downloads the branch as a tarball, unpacks it next to the web root and swaps it in with one rename. Settings: `REPO`, `BRANCH`, `TARGET` |
| `pull.service`, `pull.timer` | systemd units that run it every 5 minutes |

## Set up a host

1. Copy the script and the units:

   ```bash
   sudo install -m 755 deploy/website/pull.sh /usr/local/bin/debugger-site-pull
   sudo install -m 644 deploy/website/pull.service /etc/systemd/system/debugger-site-pull.service
   sudo install -m 644 deploy/website/pull.timer /etc/systemd/system/debugger-site-pull.timer
   sudo systemctl daemon-reload
   sudo systemctl enable --now debugger-site-pull.timer
   sudo systemctl start debugger-site-pull.service   # the first pull, right away
   ```

   To serve from another directory or follow a fork, set `TARGET` / `REPO` in the service's `[Service]` section (`Environment=`).

2. Serve the web root as static files. With Caddy:

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

   No SPA fallback: unknown paths must 404 (the demo shop expects `api/coupon` and `api/recommend.json` to be missing). `file_server` already redirects `/zh` to `/zh/` and so on for every language.

## Operations

```bash
systemctl list-timers debugger-site-pull.timer   # next run
journalctl -u debugger-site-pull.service -n 20   # what the last runs did
sudo systemctl start debugger-site-pull.service  # pull now
cat /srv/debugger.site.commit                    # the deployed commit of gh-pages
```

A change lands on the site within about five minutes of CI finishing. To roll back, revert the commit on `main`; the next CI run publishes the previous site.
