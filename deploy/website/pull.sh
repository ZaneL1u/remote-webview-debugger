#!/usr/bin/env bash
# Keeps a static web root in step with the website that CI publishes to the
# repository's gh-pages branch (.github/workflows/ci.yml, job "Website").
#
# The host pulls; nothing pushes to it: no deploy keys, no inbound access,
# and nothing about the host lives in the repository. Run it from a timer
# (pull.timer here runs it every 5 minutes) as a user that may replace
# TARGET; the first run creates TARGET.
#
#   REPO    the repository on GitHub          (default: this project)
#   BRANCH  the branch CI publishes to        (default: gh-pages)
#   TARGET  the web root to keep up to date   (default: /srv/debugger.site)
#
# The deployed commit is remembered in <TARGET>.commit (next to the web
# root, so it is never served). The new tree is unpacked beside the web root
# and swapped in with one rename, so visitors never see a half-written site.
set -euo pipefail

REPO=${REPO:-https://github.com/ZaneL1u/remote-webview-debugger}
BRANCH=${BRANCH:-gh-pages}
TARGET=${TARGET:-/srv/debugger.site}
STATE="$TARGET.commit"

sha=$(git ls-remote --quiet "$REPO.git" "refs/heads/$BRANCH" | cut -f1)
if [ -z "$sha" ]; then
  echo "pull: no branch $BRANCH at $REPO yet" >&2
  exit 1
fi
if [ "$(cat "$STATE" 2>/dev/null || true)" = "$sha" ]; then
  exit 0 # already there
fi

parent=$(dirname "$TARGET")
tmp=$(mktemp -d "$parent/.$(basename "$TARGET").new.XXXXXX")
old="$TARGET.old"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 3 "$REPO/archive/$sha.tar.gz" | tar -xz -C "$tmp" --strip-components=1
test -f "$tmp/index.html" # a site, not an empty branch
chmod -R a+rX "$tmp"

rm -rf "$old"
if [ -d "$TARGET" ]; then mv "$TARGET" "$old"; fi
mv "$tmp" "$TARGET"
trap - EXIT
rm -rf "$old"
echo "$sha" >"$STATE"
echo "pull: $TARGET is now $BRANCH@${sha:0:12}"
