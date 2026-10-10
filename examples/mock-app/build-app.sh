#!/usr/bin/env bash
# Build RWDMockApp.app (double-clickable). Needs only the Xcode Command Line
# Tools (swift); no Xcode, no iOS SDK.
set -euo pipefail
cd "$(dirname "$0")"
swift build -c release
app=build/RWDMockApp.app
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cp .build/release/RWDMockApp "$app/Contents/MacOS/RWDMockApp"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>RWDMockApp</string>
  <key>CFBundleIdentifier</key><string>dev.rwd.mockapp</string>
  <key>CFBundleName</key><string>Demo Shop (Mock App)</string>
  <key>CFBundleDisplayName</key><string>Demo Shop (Mock App)</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>3.2.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$app" >/dev/null 2>&1 || true
echo "built $app"
