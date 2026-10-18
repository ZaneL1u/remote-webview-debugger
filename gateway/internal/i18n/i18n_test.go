package i18n

import (
	"go/ast"
	"go/parser"
	"go/token"
	"regexp"
	"slices"
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

var verbRe = regexp.MustCompile(`%[-+# 0]*[0-9]*(?:\.[0-9]+)?[a-zA-Z%]`)

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
		for _, l := range []Lang{EN, ZH} {
			if !l.Has(k) {
				t.Errorf("%s: missing %q", l, k)
			}
		}
	}
	for k, s := range en {
		z, ok := zh[k]
		if !ok {
			t.Errorf("zh: missing %q", k)
			continue
		}
		if s == "" || z == "" {
			t.Errorf("empty message %q", k)
		}
		if ev, zv := verbRe.FindAllString(s, -1), verbRe.FindAllString(z, -1); !slices.Equal(ev, zv) {
			t.Errorf("%q: verbs differ: en %v, zh %v", k, ev, zv)
		}
	}
	for k := range zh {
		if _, ok := en[k]; !ok {
			t.Errorf("en: missing %q", k)
		}
	}
}

func TestParse(t *testing.T) {
	cases := map[string]Lang{"en": EN, "EN-us": EN, "zh": ZH, "zh-CN": ZH, "zh_CN": ZH, "zh-Hans-CN": ZH, " zh ": ZH}
	for in, want := range cases {
		if got, ok := Parse(in); !ok || got != want {
			t.Errorf("Parse(%q) = %q, %v", in, got, ok)
		}
	}
	for _, in := range []string{"", "fr", "english", "*"} {
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
		{"fr-FR,fr;q=0.9,zh;q=0.5,en;q=0.4", ZH, true},
		{"de, en;q=0.1", EN, true},
		{"en;q=0.5, zh;q=0.7", ZH, true},
		{"fr, *", "", false},
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
	if got := Lang("fr").T(ResPages); got != en[ResPages] {
		t.Errorf("fallback: %q", got)
	}
	if got := EN.T("no.such.key"); got != "no.such.key" {
		t.Errorf("unknown key: %q", got)
	}
}
