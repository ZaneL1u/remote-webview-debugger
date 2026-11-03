package server

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

var cjk = regexp.MustCompile(`\p{Han}`)

const wechatUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800323c) NetType/WIFI Language/zh_CN"

// schemaTexts collects the descriptions of a tool's input schema.
func schemaTexts(t *testing.T, raw any) []string {
	b, _ := json.Marshal(raw)
	var s jsonschema.Schema
	if err := json.Unmarshal(b, &s); err != nil {
		t.Fatal(err)
	}
	var out []string
	var walk func(*jsonschema.Schema)
	walk = func(s *jsonschema.Schema) {
		if s == nil {
			return
		}
		if s.Description != "" {
			out = append(out, s.Description)
		}
		for _, p := range s.Properties {
			walk(p)
		}
		walk(s.Items)
	}
	walk(&s)
	return out
}

func listTools(t *testing.T, s *mcp.ClientSession) map[string]*mcp.Tool {
	t.Helper()
	res, err := s.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	tools := map[string]*mcp.Tool{}
	for _, tool := range res.Tools {
		tools[tool.Name] = tool
	}
	return tools
}

// Without RWD_LANG everything an agent reads is English.
func TestAgentEnglishByDefault(t *testing.T) {
	f := setupLang(t, `{"approval":"none"}`, "")
	s := f.mcp()

	instr := s.InitializeResult().Instructions
	if !strings.Contains(instr, "Workflow: list_devices") || cjk.MatchString(instr) {
		t.Fatalf("instructions: %s", instr)
	}
	tools := listTools(t, s)
	if len(tools) < 30 {
		t.Fatalf("only %d tools", len(tools))
	}
	for name, tool := range tools {
		texts := append([]string{tool.Description}, schemaTexts(t, tool.InputSchema)...)
		for _, txt := range texts {
			if txt == "" || cjk.MatchString(txt) || strings.HasPrefix(txt, "param.") || strings.HasPrefix(txt, "tool.") {
				t.Errorf("%s: untranslated text %q", name, txt)
			}
		}
	}
	if d := schemaTexts(t, tools["connect_device"].InputSchema); !strings.Contains(strings.Join(d, "\n"), "Device code (e.g. K7Q2-9M4X) or deviceId") {
		t.Errorf("connect_device params: %v", d)
	}
	if d := schemaTexts(t, tools["batch_actions"].InputSchema); !strings.Contains(strings.Join(d, "\n"), "One of click, fill") {
		t.Errorf("batch_actions nested params: %v", d)
	}

	if out, isErr := callText(t, s, "take_snapshot", nil); !isErr || out != "Error: Not attached to a device; call connect_device first" {
		t.Fatalf("snapshot without device: %q", out)
	}

	p1 := f.page(pageOpts{pageID: "page1", title: "Cart"})
	if p1.welcome["agentLang"] != "en" {
		t.Fatalf("welcome.agentLang = %v", p1.welcome["agentLang"])
	}
	out, isErr := callText(t, s, "connect_device", map[string]any{"device": p1.welcome["deviceCode"]})
	if isErr || !strings.Contains(out, "Attached to device") || !strings.Contains(out, `p1 "Cart" https://shop.test/page1 [selected, foreground]`) {
		t.Fatalf("connect: %s", out)
	}
	f.page(pageOpts{pageID: "page2", title: "Checkout", opener: "page1"})
	time.Sleep(100 * time.Millisecond)
	out, _ = callText(t, s, "list_pages", nil)
	for _, want := range []string{"opened by p1", "[Session changes]", `p2 "Checkout" opened (opened by p1)`, `Switched to p2 "Checkout" automatically`} {
		if !strings.Contains(out, want) {
			t.Errorf("list_pages missing %q:\n%s", want, out)
		}
	}
	out, _ = callText(t, s, "take_snapshot", nil)
	if !strings.Contains(out, "untrusted data") || cjk.MatchString(strings.ReplaceAll(out, "提交", "")) {
		t.Fatalf("snapshot: %s", out)
	}
	if out, isErr := callText(t, s, "find_elements", nil); !isErr || out != "Error: provide at least one of text, role or name" {
		t.Fatalf("find_elements: %q", out)
	}
}

func TestAgentChinese(t *testing.T) {
	f := setupLang(t, "", i18n.ZH)
	s := f.mcp()
	if instr := s.InitializeResult().Instructions; !strings.Contains(instr, "协助中的排在最前") {
		t.Fatalf("instructions: %s", instr)
	}
	tools := listTools(t, s)
	if tools["click"].Description != "点击元素。" {
		t.Errorf("click: %q", tools["click"].Description)
	}
	if d := schemaTexts(t, tools["click"].InputSchema); len(d) != 1 || d[0] != "快照中的元素引用，如 e12" {
		t.Errorf("click params: %v", d)
	}
	if out, isErr := callText(t, s, "list_pages", nil); !isErr || out != "错误：当前没有接入设备，请先调用 connect_device" {
		t.Fatalf("list_pages: %q", out)
	}
	if p := f.page(pageOpts{pageID: "page1"}); p.welcome["agentLang"] != "zh" {
		t.Fatalf("welcome.agentLang = %v", p.welcome["agentLang"])
	}
}

func apiError(t *testing.T, c *http.Client, method, url string, header map[string]string, body string) string {
	t.Helper()
	req, _ := http.NewRequest(method, url, strings.NewReader(body))
	for k, v := range header {
		req.Header.Set(k, v)
	}
	res, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var out struct {
		Error struct{ Code, Message string }
	}
	json.NewDecoder(res.Body).Decode(&out)
	return out.Error.Message
}

// Console text follows the request (lang parameter, then Accept-Language),
// falling back to RWD_LANG.
func TestConsoleLanguage(t *testing.T) {
	f := setupLang(t, "", i18n.EN)
	login := f.srv.URL + "/v1/api/auth/login"
	bad := `{"email":"owner@test","password":"wrong-password"}`
	cases := []struct {
		url, accept, want string
	}{
		{login, "", "Incorrect email or password"},
		{login, "zh-CN", "邮箱或密码错误"},
		{login, "zh-CN,zh;q=0.9,en;q=0.8", "邮箱或密码错误"},
		{login, "it-IT, en;q=0.5, zh;q=0.6", "邮箱或密码错误"},
		{login, "en", "Incorrect email or password"},
		{login, "it", "Incorrect email or password"},
		{login, "fr-FR, en;q=0.5", i18n.FR.T(i18n.APIBadPassword)},
		{login + "?lang=zh-HK", "en", i18n.ZHTW.T(i18n.APIBadPassword)},
		{login + "?lang=en", "zh-CN", "Incorrect email or password"},
	}
	for _, c := range cases {
		if got := apiError(t, http.DefaultClient, "POST", c.url, map[string]string{"Accept-Language": c.accept}, bad); got != c.want {
			t.Errorf("%s (Accept-Language %q): %q, want %q", c.url, c.accept, got, c.want)
		}
	}
	if got := apiError(t, http.DefaultClient, "GET", f.srv.URL+"/v1/api/devices", map[string]string{"Accept-Language": "zh-CN"}, ""); got != "请先登录" {
		t.Errorf("unauthorized: %q", got)
	}

	// A Chinese gateway answers in Chinese unless the console asks otherwise.
	fz := setupLang(t, "", i18n.ZH)
	zlogin := fz.srv.URL + "/v1/api/auth/login"
	if got := apiError(t, http.DefaultClient, "POST", zlogin, nil, bad); got != "邮箱或密码错误" {
		t.Errorf("zh fallback: %q", got)
	}
	if got := apiError(t, http.DefaultClient, "POST", zlogin, map[string]string{"Accept-Language": "en-US"}, bad); got != "Incorrect email or password" {
		t.Errorf("zh gateway, en console: %q", got)
	}

	// Device views and timelines are rendered per request, whatever RWD_LANG is.
	f.page(pageOpts{pageID: "page1", title: "Cart", ua: wechatUA})
	c := f.login("owner@test", "password1")
	get := func(path, accept string) map[string]any {
		req, _ := http.NewRequest("GET", c.base+path, nil)
		req.Header.Set("Accept-Language", accept)
		res, err := c.client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var out map[string]any
		json.NewDecoder(res.Body).Decode(&out)
		return out
	}
	for accept, want := range map[string][2]string{
		"zh-CN": {"iOS 18.1 · iPhone · 微信 8.0.50", "p1「Cart」 打开"},
		"en":    {"iOS 18.1 · iPhone · WeChat 8.0.50", `p1 "Cart" opened`},
	} {
		list := get("/devices", accept)["devices"].([]any)[0].(map[string]any)
		if label := list["system"].(map[string]any)["label"]; label != want[0] {
			t.Errorf("%s: device label %q", accept, label)
		}
		d := get("/devices/dev-1", accept)
		if label := d["system"].(map[string]any)["label"]; label != want[0] {
			t.Errorf("%s: detail label %q", accept, label)
		}
		tl := d["timeline"].([]any)
		if len(tl) == 0 || tl[0].(map[string]any)["summary"] != want[1] {
			t.Errorf("%s: timeline %v", accept, tl)
		}
	}
	if got := apiError(t, c.client, "GET", c.base+"/devices/nope", map[string]string{"Accept-Language": "zh"}, ""); got != "资源不存在" {
		t.Errorf("not found: %q", got)
	}

	// EventSource cannot set headers: ?lang= picks the stream's language.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", c.base+"/stream?lang=zh-CN", nil)
	res, err := c.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	f.page(pageOpts{pageID: "page2", title: "Checkout"})
	sc := bufio.NewScanner(res.Body)
	event := ""
	for sc.Scan() {
		if line := sc.Text(); event == "timeline" && strings.HasPrefix(line, "data: ") {
			if !strings.Contains(line, "p2「Checkout」 打开") {
				t.Fatalf("stream timeline: %s", line)
			}
			return
		} else if v, ok := strings.CutPrefix(line, "event: "); ok {
			event = v
		}
	}
	b, _ := io.ReadAll(res.Body)
	t.Fatalf("no timeline event: %v %s", sc.Err(), b)
}
