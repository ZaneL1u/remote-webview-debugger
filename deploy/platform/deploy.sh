#!/usr/bin/env bash
# Ship the gateway stack to a docker host over ssh and (re)start it.
#   deploy/platform/deploy.sh <ssh-host> <linux-arch: arm64|amd64> [remote-dir]
#
# Builds everything first (make platform). The ssh user must be able to run
# docker (docker group); no sudo is needed.
#
# The remote .env is created on the first deploy (random owner password,
# printed once) and never overwritten afterwards; missing newer settings
# (metrics token) are appended. First-deploy defaults can be overridden from
# the environment: BIND (default 127.0.0.1), PORT (18788), RWD_ADMIN_EMAIL
# (admin), RWD_PUBLIC_URL, RWD_TRUSTED_PROXIES. With RWD_DOMAIN the host
# serves HTTPS for that name itself (compose.tls.yml: ports 80 and 443,
# certificate from Let's Encrypt). The SQLite database is copied to
# data/rwd.db.bak-<time> before each restart (schema migrations).
set -euo pipefail
host=${1:?usage: deploy.sh <ssh-host> <arm64|amd64> [remote-dir]}
arch=${2:?usage: deploy.sh <ssh-host> <arm64|amd64> [remote-dir]}
dir=${3:-rwd-platform}
root=$(cd "$(dirname "$0")/../.." && pwd)
make=$(command -v gmake || command -v make)

"$make" -C "$root" platform GOOS=linux GOARCH="$arch"

export COPYFILE_DISABLE=1
ssh "$host" "mkdir -p '$dir/demo' '$dir/data' && find '$dir/demo' -mindepth 1 -delete" # keep the dir: it is bind-mounted
tar -C "$root/deploy/platform" -cf - Dockerfile compose.yml compose.tls.yml Caddyfile Caddyfile.tls | ssh "$host" "tar -C '$dir' -xf -"
tar -C "$root/examples" -cf - platform-demo | ssh "$host" "tar -C '$dir/demo' -xf -"
scp -q "$root/gateway/bin/rwd-linux-$arch" "$host:$dir/rwd"

# First-deploy values go under other names: docker compose would take a
# BIND / PORT in the shell environment over the ones in .env.
domain=${RWD_DOMAIN:-}
if [ -n "$domain" ]; then
  : "${BIND:=0.0.0.0}" "${PORT:=80}" "${RWD_PUBLIC_URL:=https://$domain/v1}"
fi
ssh "$host" "DIR='$dir' NEW_BIND='${BIND:-127.0.0.1}' NEW_PORT='${PORT:-18788}' NEW_ADMIN_EMAIL='${RWD_ADMIN_EMAIL:-}' NEW_PUBLIC_URL='${RWD_PUBLIC_URL:-}' NEW_TRUSTED='${RWD_TRUSTED_PROXIES:-}' NEW_DOMAIN='$domain' bash -s" <<'REMOTE'
set -euo pipefail
cd "$DIR"
chmod 755 rwd
if [ ! -f .env ]; then
  umask 077
  pw=$(openssl rand -base64 12 | tr -d '/+=')
  {
    printf 'RWD_ADMIN_PASSWORD=%s\nBIND=%s\nPORT=%s\n' "$pw" "$NEW_BIND" "$NEW_PORT"
    if [ -n "$NEW_ADMIN_EMAIL" ]; then printf 'RWD_ADMIN_EMAIL=%s\n' "$NEW_ADMIN_EMAIL"; fi
    if [ -n "$NEW_PUBLIC_URL" ]; then printf 'RWD_PUBLIC_URL=%s\n' "$NEW_PUBLIC_URL"; fi
    if [ -n "$NEW_TRUSTED" ]; then printf 'RWD_TRUSTED_PROXIES=%s\n' "$NEW_TRUSTED"; fi
    if [ -n "$NEW_DOMAIN" ]; then printf 'RWD_DOMAIN=%s\nCOMPOSE_FILE=compose.yml:compose.tls.yml\n' "$NEW_DOMAIN"; fi
  } > .env
  echo "console owner: ${NEW_ADMIN_EMAIL:-admin} / $pw (shown once; also in $DIR/.env)"
fi
grep -q '^RWD_METRICS_TOKEN=' .env || printf 'RWD_METRICS_TOKEN=%s\n' "$(openssl rand -hex 16)" >> .env
# The gateway runs as uid 10001: fix ownership and back up the database
# through a throwaway container instead of sudo.
if [ -f data/rwd.db ]; then
  docker compose stop gateway >/dev/null 2>&1 || true
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
fi
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
docker compose ps
REMOTE
