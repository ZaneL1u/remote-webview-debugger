# Remote WebView Debugger: gateway (Go) + page SDK + console + website.
# `make -j16` builds the gateway binary for this machine; GOOS / GOARCH
# cross-compile it (e.g. `make -j16 GOOS=linux GOARCH=arm64`).

.DEFAULT_GOAL := platform

GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)
RWD_VERSION ?= 0.1.0

.PHONY: platform sdk console gateway website check
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
