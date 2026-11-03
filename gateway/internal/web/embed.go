// Package web embeds the built console SPA and page SDK. `make gateway`
// copies console/dist into console/, and sdk/dist/sdk.js with the language
// packs in sdk/dist/locales into sdk/ before building; the placeholders keep
// `go build` working without them.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:console
var consoleFS embed.FS

//go:embed sdk
var sdkFS embed.FS

func Console() fs.FS {
	sub, _ := fs.Sub(consoleFS, "console")
	return sub
}

func SDK() fs.FS {
	sub, _ := fs.Sub(sdkFS, "sdk")
	return sub
}
