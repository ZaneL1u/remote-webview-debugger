#!/usr/bin/env bash
# Stage the built console and SDK (sdk.js and the locales/ next to it) into
# internal/web for go:embed, or reset the directory to its committed
# placeholders after building.
#   embed.sh stage <console-dist> <sdk.js>
#   embed.sh reset
set -euo pipefail
web="$(cd "$(dirname "$0")/../internal/web" && pwd)"
case "${1:-}" in
stage)
  find "$web/console" "$web/sdk" -mindepth 1 -delete
  cp -R "$2"/. "$web/console/"
  cp "$3" "$web/sdk/sdk.js"
  if [ -d "$(dirname "$3")/locales" ]; then
    mkdir "$web/sdk/locales"
    cp "$(dirname "$3")"/locales/*.js "$web/sdk/locales/"
  fi
  ;;
reset)
  find "$web/console" "$web/sdk" -mindepth 1 -delete
  printf '%s\n' '<!doctype html><html lang="en"><meta charset="utf-8"><title>remote-webview-debugger</title><p>The console is not built into this gateway: run <code>make gateway</code>.</p></html>' > "$web/console/index.html"
  printf '%s\n' "console.warn('[rwd] SDK not built into this gateway; run \`make gateway\`.');" > "$web/sdk/sdk.js"
  ;;
*) echo "usage: embed.sh stage <console-dist> <sdk.js> | reset" >&2; exit 2 ;;
esac
