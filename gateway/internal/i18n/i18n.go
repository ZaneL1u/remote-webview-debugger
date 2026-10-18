// Package i18n holds the gateway's human-language text in English and
// Chinese. Agent-facing text (MCP) uses the configured language (RWD_LANG);
// console-facing text follows each request's Accept-Language.
//
// Messages are looked up by Key. Keys used from Go code are constants in
// keys.go; tool and parameter descriptions are keyed by "tool.<name>" and by
// their jsonschema struct tags. Every key has an entry in both catalogs
// (checked by the tests).
package i18n

import (
	"fmt"
	"strconv"
	"strings"
)

type Lang string

const (
	EN Lang = "en"
	ZH Lang = "zh"
)

// Default is the language when nothing else is configured.
const Default = EN

type Key string

var catalogs = map[Lang]map[Key]string{EN: en, ZH: zh}

// Parse normalizes a language tag: en, en-US → EN; zh, zh-CN, zh_CN,
// zh-Hans → ZH. Other languages are not supported.
func Parse(tag string) (Lang, bool) {
	t := strings.ToLower(strings.TrimSpace(strings.ReplaceAll(tag, "_", "-")))
	base, _, _ := strings.Cut(t, "-")
	switch base {
	case "en":
		return EN, true
	case "zh":
		return ZH, true
	}
	return "", false
}

// FromAcceptLanguage picks the supported language with the highest weight in
// an Accept-Language header (the first one on ties).
func FromAcceptLanguage(header string) (Lang, bool) {
	var best Lang
	bestQ := 0.0
	for _, part := range strings.Split(header, ",") {
		tag, params, _ := strings.Cut(part, ";")
		l, ok := Parse(tag)
		if !ok {
			continue
		}
		q := 1.0
		for _, p := range strings.Split(params, ";") {
			if v, ok := strings.CutPrefix(strings.TrimSpace(p), "q="); ok {
				if f, err := strconv.ParseFloat(v, 64); err == nil {
					q = f
				}
			}
		}
		if q > bestQ {
			best, bestQ = l, q
		}
	}
	return best, best != ""
}

// Has reports whether k has a message in l.
func (l Lang) Has(k Key) bool {
	_, ok := catalogs[l][k]
	return ok
}

// T renders the message k with fmt verbs filled from a. Msg arguments are
// rendered in the same language. Unknown languages fall back to English,
// unknown keys to the key itself.
func (l Lang) T(k Key, a ...any) string {
	s, ok := catalogs[l][k]
	if !ok {
		if s, ok = en[k]; !ok {
			return string(k)
		}
	}
	if len(a) == 0 {
		return s
	}
	args := make([]any, len(a))
	for i, v := range a {
		if m, ok := v.(Msg); ok {
			v = m.In(l)
		}
		args[i] = v
	}
	return fmt.Sprintf(s, args...)
}

// Msg is a message rendered later, in the reader's language.
type Msg struct {
	key  Key
	args []any
	raw  string
}

// M makes a message from a key and its arguments.
func M(k Key, a ...any) Msg { return Msg{key: k, args: a} }

// Raw wraps text that is not translated (e.g. page-originated text).
func Raw(s string) Msg { return Msg{raw: s} }

func (m Msg) IsZero() bool { return m.key == "" && m.raw == "" }

// In renders the message in l.
func (m Msg) In(l Lang) string {
	if m.key == "" {
		return m.raw
	}
	return l.T(m.key, m.args...)
}
