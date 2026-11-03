package i18n

import (
	"go/ast"
	"go/parser"
	"go/token"
	"maps"
	"regexp"
	"strconv"
	"testing"
)

// declaredKeys lists the Key constants of keys.go.
func declaredKeys(t *testing.T) []Key {
	f, err := parser.ParseFile(token.NewFileSet(), "keys.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	var keys []Key
	for _, d := range f.Decls {
		gd, ok := d.(*ast.GenDecl)
		if !ok || gd.Tok != token.CONST {
			continue
		}
		for _, spec := range gd.Specs {
			for _, v := range spec.(*ast.ValueSpec).Values {
				lit, ok := v.(*ast.BasicLit)
				if !ok {
					t.Fatalf("non-literal key %v", v)
				}
				s, _ := strconv.Unquote(lit.Value)
				keys = append(keys, Key(s))
			}
		}
	}
	return keys
}

var verbRe = regexp.MustCompile(`%(\[[0-9]+\])?([-+# 0]*[0-9]*(?:\.[0-9]+)?[a-zA-Z%])`)

// argVerbs maps each argument (1-based) to the verb that prints it, following
// explicit indexes (%[2]s), so a translation may reorder its arguments.
func argVerbs(s string) map[int]string {
	out := map[int]string{}
	next := 1
	for _, m := range verbRe.FindAllStringSubmatch(s, -1) {
		if m[2] == "%" {
			continue
		}
		if m[1] != "" {
			next, _ = strconv.Atoi(m[1][1 : len(m[1])-1])
		}
		out[next] = m[2]
		next++
	}
	return out
}

func TestCatalogsComplete(t *testing.T) {
	keys := declaredKeys(t)
	if len(keys) < 100 {
		t.Fatalf("parsed only %d keys", len(keys))
	}
	seen := map[Key]bool{}
	for _, k := range keys {
		if seen[k] {
			t.Errorf("duplicate key %q", k)
		}
		seen[k] = true
		for _, l := range Langs {
			if !l.Has(k) {
				t.Errorf("%s: missing %q", l, k)
			}
		}
	}
	if len(catalogs) != len(Langs) {
		t.Errorf("%d catalogs for %d languages", len(catalogs), len(Langs))
	}
	for _, l := range Langs[1:] {
		c := catalogs[l]
		for k, s := range en {
			m, ok := c[k]
			if !ok {
				t.Errorf("%s: missing %q", l, k)
				continue
			}
			if s == "" || m == "" {
				t.Errorf("%s: empty message %q", l, k)
			}
			if ev, mv := argVerbs(s), argVerbs(m); !maps.Equal(ev, mv) {
				t.Errorf("%s: %q: verbs differ: en %v, %s %v", l, k, ev, l, mv)
			}
		}
		for k := range c {
			if _, ok := en[k]; !ok {
				t.Errorf("%s: %q is not in en", l, k)
			}
		}
	}
}

func TestArgVerbs(t *testing.T) {
	if got := argVerbs("%s has %d of %[1]s, 100%%"); !maps.Equal(got, map[int]string{1: "s", 2: "d"}) {
		t.Errorf("argVerbs: %v", got)
	}
	if got := argVerbs("%[2]d → %[1]s"); !maps.Equal(got, map[int]string{1: "s", 2: "d"}) {
		t.Errorf("argVerbs reordered: %v", got)
	}
}

func TestParse(t *testing.T) {
	cases := map[string]Lang{
		"en": EN, "EN-us": EN, "zh": ZH, "zh-CN": ZH, "zh_CN": ZH, "zh-Hans-CN": ZH, " zh ": ZH, "zh-SG": ZH,
		"zh-TW": ZHTW, "zh_tw": ZHTW, "zh-HK": ZHTW, "zh-MO": ZHTW, "zh-Hant": ZHTW, "zh-Hant-CN": ZHTW, "zh-Hans-HK": ZH,
		"fr": FR, "fr-CA": FR, "es-419": ES, "ru-RU": RU, "ar-EG": AR, "ja-JP": JA, "ko": KO, "de-AT": DE, "pt-BR": PT, "pt-PT": PT,
	}
	for in, want := range cases {
		if got, ok := Parse(in); !ok || got != want {
			t.Errorf("Parse(%q) = %q, %v", in, got, ok)
		}
	}
	for _, in := range []string{"", "it", "english", "*"} {
		if got, ok := Parse(in); ok {
			t.Errorf("Parse(%q) = %q, want unsupported", in, got)
		}
	}
}

func TestFromAcceptLanguage(t *testing.T) {
	cases := []struct {
		header string
		want   Lang
		ok     bool
	}{
		{"zh-CN", ZH, true},
		{"en", EN, true},
		{"zh-CN,zh;q=0.9,en;q=0.8", ZH, true},
		{"en-US,en;q=0.9,zh-CN;q=0.8", EN, true},
		{"fr-FR,fr;q=0.9,zh;q=0.5,en;q=0.4", FR, true},
		{"it-IT,it;q=0.9,zh;q=0.5,en;q=0.4", ZH, true},
		{"zh-HK,zh;q=0.9", ZHTW, true},
		{"it, de;q=0.5, en;q=0.1", DE, true},
		{"nl, en;q=0.1", EN, true},
		{"en;q=0.5, zh;q=0.7", ZH, true},
		{"it, *", "", false},
		{"", "", false},
	}
	for _, c := range cases {
		if got, ok := FromAcceptLanguage(c.header); got != c.want || ok != c.ok {
			t.Errorf("FromAcceptLanguage(%q) = %q, %v; want %q, %v", c.header, got, ok, c.want, c.ok)
		}
	}
}

func TestRender(t *testing.T) {
	page := M(PageTitled, "p1", "Cart")
	m := M(EventNavigated, page, "shop.test/cart")
	if got := m.In(EN); got != `p1 "Cart" navigated to shop.test/cart` {
		t.Errorf("en: %q", got)
	}
	if got := m.In(ZH); got != "p1「Cart」 跳转到 shop.test/cart" {
		t.Errorf("zh: %q", got)
	}
	if got := Raw("TypeError: x").In(ZH); got != "TypeError: x" {
		t.Errorf("raw: %q", got)
	}
	if got := Lang("it").T(ResPages); got != en[ResPages] {
		t.Errorf("fallback: %q", got)
	}
	if got := EN.T("no.such.key"); got != "no.such.key" {
		t.Errorf("unknown key: %q", got)
	}
}
