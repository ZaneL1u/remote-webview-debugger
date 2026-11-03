#!/usr/bin/env bash
# Ship a public demo gateway: the platform stack (deploy/platform/deploy.sh)
# in its own directory with its own database, plus the demo settings, a
# fresh project and key (reset.sh) and a daily reset from cron.
#   deploy/demo/deploy.sh <ssh-host> <arm64|amd64> <public-host> [remote-dir]
#
# The stack publishes on 127.0.0.1:${PORT:-18789}; serve <public-host> with
# HTTPS in front of it (Caddyfile.site). Every deploy starts the demo over.
set -euo pipefail
usage='usage: deploy.sh <ssh-host> <arm64|amd64> <public-host> [remote-dir]'
host=${1:?$usage}
arch=${2:?$usage}
domain=${3:?$usage}
dir=${4:-rwd-demo}
here=$(cd "$(dirname "$0")" && pwd)

PORT=${PORT:-18789} RWD_PUBLIC_URL="https://$domain/v1" "$here/../platform/deploy.sh" "$host" "$arch" "$dir"
scp -q "$here/reset.sh" "$host:$dir/reset.sh"
ssh "$host" "DIR='$dir' bash -s" <<'REMOTE'
set -euo pipefail
cd "$DIR"
chmod 755 reset.sh
# Demo settings, added once (edit .env to change them).
grep -q '^RWD_MCP_RATE_LIMIT=' .env || printf 'RWD_MCP_RATE_LIMIT=120\n' >> .env
grep -q '^RWD_AUDIT_RETENTION_DAYS=' .env || printf 'RWD_AUDIT_RETENTION_DAYS=1\n' >> .env
docker compose up -d >/dev/null
./reset.sh
line="0 4 * * * $PWD/reset.sh >> $PWD/reset.log 2>&1 # rwd-demo-reset $PWD"
{ crontab -l 2>/dev/null | grep -vF "# rwd-demo-reset $PWD" || true; echo "$line"; } | crontab -
echo "daily reset: $line"
REMOTE
