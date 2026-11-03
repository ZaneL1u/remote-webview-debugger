# Remote WebView Debugger: gateway (Go) + page SDK + console + website.
# `make -j16` builds the gateway binary for this machine; GOOS / GOARCH
# cross-compile it (e.g. `make -j16 GOOS=linux GOARCH=arm64`).
# Releases: `make release-sdk` / `make release-gateway` (docs/releasing.md).

.DEFAULT_GOAL := platform

GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)
# The gateway's version comes from its latest gateway-vX.Y.Z tag:
# 0.2.0 on the tag, 0.2.0-3-gabc1234 after it, 0.0.0-dev without one.
# (sed, not $${v#…}: make 3.81 and 4.3+ disagree on escaping the #.)
RWD_VERSION ?= $(shell git describe --tags --match 'gateway-v*' --dirty 2>/dev/null | sed 's/^gateway-v//' | grep . || echo 0.0.0-dev)

.PHONY: platform sdk console gateway website check release-sdk release-gateway
platform: sdk console .WAIT gateway

sdk:
	cd sdk && npm ci && npm run build

console:
	cd console && npm ci && npm run build

# Embeds sdk/dist/sdk.js and console/dist into the binary.
gateway:
	gateway/scripts/embed.sh stage console/dist sdk/dist/sdk.js
	cd gateway && CGO_ENABLED=0 GOOS=$(GOOS) GOARCH=$(GOARCH) go build -trimpath \
		-ldflags "-s -w -X main.version=$(RWD_VERSION)" -o bin/rwd-$(GOOS)-$(GOARCH) ./cmd/rwd; \
		status=$$?; cd .. && gateway/scripts/embed.sh reset; exit $$status

# debugger.site; its interactive demo runs the SDK built above.
website: sdk
	cd website && npm ci && npm run build

# What CI runs.
check:
	cd gateway && test -z "$$(gofmt -l .)" && go vet ./... && go test -race -count=1 ./...
	cd sdk && npm run typecheck && npm run build && npm test
	cd console && npm run typecheck && npm run build

# Bump the version, prepend to both changelogs, commit and tag; nothing is
# pushed. ARGS: --dry-run, --edit, --major / --minor / --patch, --version X.Y.Z.
release-sdk release-gateway:
	cd scripts/release && npm ci --no-audit --no-fund >/dev/null
	node scripts/release/release.mjs $(@:release-%=%) $(ARGS)
