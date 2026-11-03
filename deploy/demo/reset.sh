#!/usr/bin/env bash
# Start the public demo over: wipe the gateway's database, then create the
# demo project and a public API key again. Publishes demo/rwd-demo.json (the
# keys, read by the website) and demo/index.html (the entrance: it opens the
# shop with today's AppKey, which the shop remembers for its other pages).
#
# Runs on the server, in the deploy directory (deploy.sh installs it there
# and runs it from cron every day). Needs curl and jq.
set -euo pipefail
cd "$(dirname "$0")"
set -a
. ./.env
set +a
: "${RWD_PUBLIC_URL:?set RWD_PUBLIC_URL in .env}"
base="http://${BIND:-127.0.0.1}:${PORT:-18788}"
public=${RWD_PUBLIC_URL%/}
origin=${public%/v1}
jar=$(mktemp)
trap 'rm -f "$jar"' EXIT

# The database belongs to uid 10001: remove it through a throwaway container.
docker compose stop gateway >/dev/null
docker run --rm -v "$PWD/data:/data" alpine:3.22 sh -c 'rm -f /data/rwd.db /data/rwd.db-wal /data/rwd.db-shm /data/rwd.db.bak-*'
docker compose start gateway >/dev/null
for _ in $(seq 60); do
  curl -fsS "$base/v1/healthz" >/dev/null 2>&1 && break
  sleep 1
done

api() { # api METHOD PATH [JSON]
  curl -fsS -b "$jar" -c "$jar" -X "$1" -H 'Content-Type: application/json' -H 'X-RWD-CSRF: 1' \
    ${3:+--data "$3"} "$base/v1/api$2"
}
api POST /auth/login "$(jq -n --arg e "${RWD_ADMIN_EMAIL:-admin}" --arg p "$RWD_ADMIN_PASSWORD" '{email: $e, password: $p}')" >/dev/null
project=$(api POST /projects "$(jq -n --arg o "$origin" '{name: "Demo shop", allowedOrigins: [$o]}')")
id=$(jq -r .id <<<"$project")
app_key=$(jq -r .appKey <<<"$project")
# Agents ask the visitor first, can't run scripts or read storage, and let go
# of the page after 15 minutes (5 idle).
api PATCH "/projects/$id" '{"policy": {"approval": "prompt", "maxLevel": "interact", "attachMaxMinutes": 15,
  "agentIdleMinutes": 5, "maxOnlineDevices": 300, "maxAgents": 50}}' >/dev/null
key=$(api POST /keys '{"name": "Public demo key", "maxLevel": "interact", "expiresInDays": 2}')

umask 022
jq -n --arg gw "$public" --arg app "$app_key" --arg api "$(jq -r .key <<<"$key")" \
  --argjson exp "$(jq .expiresAt <<<"$key")" --argjson now "$(date +%s000)" \
  '{gateway: $gw, mcp: ($gw + "/mcp"), shop: ($gw | sub("/v1$"; "/demo/")),
    appKey: $app, apiKey: $api, keyExpiresAt: $exp, resetAt: $now}' >demo/rwd-demo.json.tmp
mv demo/rwd-demo.json.tmp demo/rwd-demo.json
cat >demo/index.html.tmp <<HTML
<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Demo shop</title>
<script>location.replace('platform-demo/?key=$app_key' + location.search.replace(/^\?/, '&'))</script>
<p><a href="platform-demo/?key=$app_key">Demo shop</a></p>
HTML
mv demo/index.html.tmp demo/index.html
echo "demo reset at $(date -u +%FT%TZ): app key ${app_key:0:12}…"
