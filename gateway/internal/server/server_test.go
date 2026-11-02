package server

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/hub"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/coder/websocket"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type fixture struct {
	t       *testing.T
	s       *Server
	st      *store.Store
	srv     *httptest.Server
	project *store.Project
	appKey  string
	apiKey  string
	keyID   string

	mu          sync.Mutex
	deviceToken map[string]string // deviceId -> token, like localStorage
}

// openStore uses Postgres when RWD_TEST_DATABASE_URL is set (each test gets
// a fresh schema), SQLite otherwise.
func openStore(t *testing.T) *store.Store {
	if dsn := os.Getenv("RWD_TEST_DATABASE_URL"); dsn != "" {
		schema := "t_" + strings.ToLower(ids.Secret(6))
		admin, err := sql.Open("pgx", dsn)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := admin.Exec("CREATE SCHEMA " + schema); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { admin.Exec("DROP SCHEMA " + schema + " CASCADE"); admin.Close() })
		st, err := store.Open(dsn + "&search_path=" + schema)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { st.Close() })
		return st
	}
	st, err := store.Open(filepath.Join(t.TempDir(), "rwd.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

// setup runs the gateway in Chinese, which most assertions below use;
// setupLang picks the agent language (i18n_test.go).
func setup(t *testing.T, policy string) *fixture {
	t.Helper()
	return setupLang(t, policy, i18n.ZH)
}

func setupLang(t *testing.T, policy string, lang i18n.Lang) *fixture {
	t.Helper()
	ctx := context.Background()
	st := openStore(t)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	s, err := New(ctx, Config{AdminEmail: "owner@test", AdminPassword: "password1", Lang: lang, Version: "test"}, st, log)
	if err != nil {
		t.Fatal(err)
	}
	p, err := st.CreateProject(ctx, "demo", nil)
	if err != nil {
		t.Fatal(err)
	}
	if policy != "" {
		raw := json.RawMessage(policy)
		if p, err = st.UpdateProject(ctx, p.ID, store.ProjectPatch{Policy: &raw}); err != nil {
			t.Fatal(err)
		}
	}
	k, plain, err := st.CreateAPIKey(ctx, s.pepper, store.NewKey{Name: "bot", MaxLevel: store.LevelAdvanced})
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(s.Handler())
	t.Cleanup(srv.Close)
	return &fixture{t: t, s: s, st: st, srv: srv, project: p, appKey: p.AppKey, apiKey: plain, keyID: k.ID, deviceToken: map[string]string{}}
}

// fakePage speaks the page side of the protocol and answers RPCs.
type fakePage struct {
	ws       *websocket.Conn
	welcome  map[string]any
	controls chan map[string]any
	tasks    chan map[string]any
	requests chan map[string]any
	closed   chan websocket.StatusCode
	decide   func(req map[string]any) any // attach_request -> level (string) or nil
}

type pageOpts struct {
	device, pageID, url, title, opener, resume, invite, ua string
	noToken                                                bool
	decide                                                 func(map[string]any) any
}

func approveAs(level string) func(map[string]any) any {
	return func(map[string]any) any { return level }
}

func (f *fixture) page(o pageOpts) *fakePage {
	f.t.Helper()
	if o.device == "" {
		o.device = "dev-1"
	}
	if o.url == "" {
		o.url = "https://shop.test/" + o.pageID
	}
	if o.ua == "" {
		o.ua = "test"
	}
	ctx := context.Background()
	ws, _, err := websocket.Dial(ctx, strings.Replace(f.srv.URL, "http", "ws", 1)+"/v1/page?key="+f.appKey, nil)
	if err != nil {
		f.t.Fatal(err)
	}
	f.t.Cleanup(func() { ws.CloseNow() })
	f.mu.Lock()
	token := f.deviceToken[o.device]
	f.mu.Unlock()
	if o.noToken {
		token = ""
	}
	hello, _ := json.Marshal(map[string]any{"t": "hello", "v": 1, "deviceId": o.device, "pageId": o.pageID, "openerId": o.opener,
		"userId": "u1", "page": map[string]string{"url": o.url, "title": o.title, "visibility": "visible"},
		"device": map[string]any{"platform": "ios", "ua": o.ua}, "deviceToken": token, "resume": o.resume, "invite": o.invite})
	ws.Write(ctx, websocket.MessageText, hello)
	p := &fakePage{ws: ws, controls: make(chan map[string]any, 16), tasks: make(chan map[string]any, 8), requests: make(chan map[string]any, 4),
		closed: make(chan websocket.StatusCode, 1), decide: o.decide}
	ready := make(chan struct{})
	go func() {
		for {
			_, data, err := ws.Read(ctx)
			if err != nil {
				p.closed <- websocket.CloseStatus(err)
				return
			}
			var m map[string]any
			json.Unmarshal(data, &m)
			switch {
			case m["t"] == "welcome":
				p.welcome = m
				if tok, ok := m["deviceToken"].(string); ok {
					f.mu.Lock()
					f.deviceToken[o.device] = tok
					f.mu.Unlock()
				}
				close(ready)
			case m["t"] == "control":
				p.controls <- m
			case m["t"] == "task":
				p.tasks <- m
			case m["t"] == "attach_request":
				select {
				case p.requests <- m:
				default:
				}
				if p.decide != nil {
					b, _ := json.Marshal(map[string]any{"t": "attach_decision", "requestId": m["requestId"], "level": p.decide(m)})
					ws.Write(ctx, websocket.MessageText, b)
				}
			case m["method"] != nil:
				method := m["method"].(string)
				result := map[string]any{}
				if method == "rwd.snapshot" {
					result = map[string]any{"url": o.url, "title": o.title, "snapshot": `- button "提交" [ref=e1]`}
				}
				if method == "rwd.log" {
					result = fakeSessionLog(m["params"].(map[string]any), o.pageID)
				}
				b, _ := json.Marshal(map[string]any{"id": m["id"], "result": result})
				ws.Write(ctx, websocket.MessageText, b)
			}
		}
	}()
	select {
	case <-ready:
	case code := <-p.closed:
		p.closed <- code
		return p
	case <-time.After(2 * time.Second):
		f.t.Fatal("no welcome")
	}
	return p
}

func (p *fakePage) send(t *testing.T, v any) {
	b, _ := json.Marshal(v)
	if err := p.ws.Write(context.Background(), websocket.MessageText, b); err != nil {
		t.Fatal(err)
	}
}

func (p *fakePage) closeCode(t *testing.T) websocket.StatusCode {
	t.Helper()
	select {
	case c := <-p.closed:
		return c
	case <-time.After(2 * time.Second):
		t.Fatal("connection not closed")
	}
	return 0
}

type bearerRT struct{ token string }

func (b bearerRT) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", "Bearer "+b.token)
	return http.DefaultTransport.RoundTrip(r)
}

func (f *fixture) mcpWith(key string) (*mcp.ClientSession, error) {
	c := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	sess, err := c.Connect(context.Background(), &mcp.StreamableClientTransport{
		Endpoint: f.srv.URL + "/v1/mcp", HTTPClient: &http.Client{Transport: bearerRT{key}},
	}, nil)
	if err == nil {
		f.t.Cleanup(func() { sess.Close() })
	}
	return sess, err
}

func (f *fixture) mcp() *mcp.ClientSession {
	f.t.Helper()
	sess, err := f.mcpWith(f.apiKey)
	if err != nil {
		f.t.Fatal(err)
	}
	return sess
}

func callText(t *testing.T, s *mcp.ClientSession, name string, args map[string]any) (string, bool) {
	t.Helper()
	res, err := s.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	var b strings.Builder
	for _, c := range res.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			b.WriteString(tc.Text)
		}
	}
	return b.String(), res.IsError
}

func expectControl(t *testing.T, p *fakePage, want string) map[string]any {
	t.Helper()
	select {
	case got := <-p.controls:
		if got["state"] != want {
			t.Fatalf("control = %v, want %s", got["state"], want)
		}
		return got
	case <-time.After(3 * time.Second):
		t.Fatalf("no control %s", want)
	}
	return nil
}

// --- console client ---

type console struct {
	t      *testing.T
	base   string
	client *http.Client
}

func (f *fixture) login(email, password string) *console {
	f.t.Helper()
	jar, _ := cookiejar.New(nil)
	c := &console{t: f.t, base: f.srv.URL + "/v1/api", client: &http.Client{Jar: jar}}
	if code, body := c.do("POST", "/auth/login", map[string]string{"email": email, "password": password}); code != 200 {
		f.t.Fatalf("login %s: %d %s", email, code, body)
	}
	return c
}

func (c *console) do(method, path string, body any) (int, map[string]any) {
	c.t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = strings.NewReader(string(b))
	}
	req, _ := http.NewRequest(method, c.base+path, rd)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-RWD-CSRF", "1")
	res, err := c.client.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	var out map[string]any
	json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

// --- tests ---

func TestAgentFlow(t *testing.T) {
	f := setup(t, "")
	p1 := f.page(pageOpts{pageID: "page1", title: "列表", decide: approveAs("interact")})
	code := p1.welcome["deviceCode"].(string)
	s := f.mcp()

	if out, _ := callText(t, s, "list_devices", nil); !strings.Contains(out, code) {
		t.Fatalf("list_devices missing device: %s", out)
	}
	// Device codes are matched loosely; the project asks the user first.
	out, isErr := callText(t, s, "connect_device", map[string]any{"device": strings.ToLower(strings.ReplaceAll(code, "-", ""))})
	if isErr || !strings.Contains(out, "interact") {
		t.Fatalf("connect: %s", out)
	}
	if ctl := expectControl(t, p1, hub.ControlObserve); ctl["level"] != "interact" {
		t.Fatalf("control level = %v", ctl["level"])
	}

	out, _ = callText(t, s, "take_snapshot", nil)
	if !strings.Contains(out, "[ref=e1]") || !strings.Contains(out, "不可信") {
		t.Fatalf("snapshot: %s", out)
	}
	if out, isErr := callText(t, s, "click", map[string]any{"ref": "e1"}); isErr {
		t.Fatalf("click: %s", out)
	}
	expectControl(t, p1, hub.ControlAgent)

	// Granted interact, so advanced tools are refused even though the key allows them.
	if out, isErr := callText(t, s, "evaluate_script", map[string]any{"function": "() => 1"}); !isErr || !strings.Contains(out, "advanced") {
		t.Fatalf("evaluate at interact: %s", out)
	}

	// A page opened from p1 (same device, carries the device token) is followed.
	f.page(pageOpts{pageID: "page2", title: "结算", opener: "page1"})
	time.Sleep(100 * time.Millisecond)
	out, _ = callText(t, s, "list_pages", nil)
	if !strings.Contains(out, "p2「结算」") || !strings.Contains(out, "由 p1 打开") || !strings.Contains(out, "已自动切换到 p2") {
		t.Fatalf("list_pages: %s", out)
	}

	p1.send(t, map[string]string{"t": "control", "action": "takeover"})
	expectControl(t, p1, hub.ControlUser)
	if out, isErr := callText(t, s, "click", map[string]any{"ref": "e1"}); !isErr || !strings.Contains(out, "接管") {
		t.Fatalf("click during takeover: %s", out)
	}
	go func() {
		time.Sleep(200 * time.Millisecond)
		p1.send(t, map[string]string{"t": "control", "action": "handback"})
	}()
	if out, isErr := callText(t, s, "wait_for_control", map[string]any{"timeoutSec": 5}); isErr {
		t.Fatalf("wait_for_control: %s", out)
	}

	out, isErr = callText(t, s, "batch_actions", map[string]any{"actions": []map[string]any{
		{"tool": "click", "args": map[string]any{"ref": "e1"}}, {"tool": "fill", "args": map[string]any{"ref": "e1", "value": "x"}},
	}})
	if isErr || strings.Count(out, "完成") != 2 {
		t.Fatalf("batch: %s", out)
	}

	p1.send(t, map[string]string{"t": "control", "action": "end"})
	time.Sleep(100 * time.Millisecond)
	out, isErr = callText(t, s, "take_snapshot", nil)
	if !isErr || !strings.Contains(out, "用户结束了调试") {
		t.Fatalf("after end: %s", out)
	}

	// Everything above is in the audit log, without page content.
	f.s.flushAudit()
	events, _ := f.st.Audit(context.Background(), store.AuditQuery{ProjectID: f.project.ID, Limit: 200})
	seen := map[string]bool{}
	for _, e := range events {
		seen[e.Action] = true
		if strings.Contains(mustJSONTest(e.Detail), "提交") {
			t.Fatalf("audit leaked page content: %+v", e)
		}
	}
	for _, a := range []string{"attach.request", "attach.approve", "attach.start", "rpc", "policy.denied", "control.takeover", "control.end", "attach.end"} {
		if !seen[a] {
			t.Errorf("audit missing %s (have %v)", a, seen)
		}
	}
}

func mustJSONTest(v any) string { b, _ := json.Marshal(v); return string(b) }

// B6.3: without the user approving on the device, no key gets page data.
func TestApprovalDeniedAndLockout(t *testing.T) {
	f := setup(t, "")
	p := f.page(pageOpts{pageID: "page1", decide: func(map[string]any) any { return nil }})
	code := p.welcome["deviceCode"].(string)
	s := f.mcp()
	for i := 0; i < 3; i++ {
		if out, isErr := callText(t, s, "connect_device", map[string]any{"device": code}); !isErr || !strings.Contains(out, "拒绝") {
			t.Fatalf("connect %d: %s", i, out)
		}
	}
	if out, isErr := callText(t, s, "connect_device", map[string]any{"device": code}); !isErr || !strings.Contains(out, "多次拒绝") {
		t.Fatalf("lockout: %s", out)
	}
	if out, isErr := callText(t, s, "take_snapshot", nil); !isErr {
		t.Fatalf("snapshot without approval: %s", out)
	}
}

// B6.3: approving only "observe" keeps interaction out (gateway side; the page
// enforces the same table).
func TestObserveOnly(t *testing.T) {
	f := setup(t, "")
	p := f.page(pageOpts{pageID: "page1", decide: approveAs("observe")})
	s := f.mcp()
	callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"]})
	if out, isErr := callText(t, s, "take_snapshot", nil); isErr {
		t.Fatalf("snapshot: %s", out)
	}
	if out, isErr := callText(t, s, "click", map[string]any{"ref": "e1"}); !isErr || !strings.Contains(out, "interact") {
		t.Fatalf("click at observe: %s", out)
	}
}

func TestApprovalNone(t *testing.T) {
	f := setup(t, `{"approval":"none","maxLevel":"advanced"}`)
	p := f.page(pageOpts{pageID: "page1"}) // no decide: must not be asked
	s := f.mcp()
	out, isErr := callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"], "level": "advanced"})
	if isErr || !strings.Contains(out, "advanced") {
		t.Fatalf("connect: %s", out)
	}
	if out, isErr := callText(t, s, "evaluate_script", map[string]any{"function": "() => 1"}); isErr {
		t.Fatalf("evaluate at advanced: %s", out)
	}
}

// B6.3: an app key alone cannot join someone else's device.
func TestDeviceTokenAndResume(t *testing.T) {
	f := setup(t, "")
	p := f.page(pageOpts{pageID: "page1"})
	resume := p.welcome["resume"].(string)
	if p.welcome["deviceToken"] == nil {
		t.Fatal("first page should be issued a device token")
	}
	intruder := f.page(pageOpts{pageID: "evil", noToken: true})
	if code := intruder.closeCode(t); code != 4401 {
		t.Fatalf("no token: close %d, want 4401", code)
	}
	// Claiming an existing pageId needs its resume token.
	p.ws.Close(websocket.StatusNormalClosure, "")
	time.Sleep(50 * time.Millisecond)
	hijack := f.page(pageOpts{pageID: "page1", resume: "wrong"})
	if code := hijack.closeCode(t); code != 4409 {
		t.Fatalf("wrong resume: close %d, want 4409", code)
	}
	back := f.page(pageOpts{pageID: "page1", resume: resume})
	if back.welcome == nil || back.welcome["label"] != "p1" {
		t.Fatalf("resume with token: %+v", back.welcome)
	}
}

// An older SDK (no deviceToken field in hello) must not be issued a token it
// cannot keep, or the device's next up-to-date page would be locked out.
func TestLegacySDKNotIssuedToken(t *testing.T) {
	f := setup(t, "")
	ctx := context.Background()
	ws, _, err := websocket.Dial(ctx, strings.Replace(f.srv.URL, "http", "ws", 1)+"/v1/page?key="+f.appKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.CloseNow()
	ws.Write(ctx, websocket.MessageText, []byte(`{"t":"hello","v":1,"deviceId":"old-dev","pageId":"old1","page":{"url":"https://shop.test/","title":"","visibility":"visible"},"device":{}}`))
	_, data, err := ws.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var welcome map[string]any
	json.Unmarshal(data, &welcome)
	if welcome["t"] != "welcome" || welcome["deviceToken"] != nil {
		t.Fatalf("legacy welcome: %s", data)
	}
	p := f.page(pageOpts{device: "old-dev", pageID: "new1"})
	if p.welcome == nil || p.welcome["deviceToken"] == nil {
		t.Fatalf("current page after legacy page should get the token: %+v", p.welcome)
	}
	if again := f.page(pageOpts{device: "old-dev", pageID: "x", noToken: true}); again.closeCode(t) != 4401 {
		t.Fatal("token not enforced once issued")
	}
}

func TestQuota(t *testing.T) {
	f := setup(t, `{"maxOnlineDevices":1}`)
	f.page(pageOpts{device: "dev-a", pageID: "a1"})
	f.page(pageOpts{device: "dev-a", pageID: "a2"}) // same device: fine
	over := f.page(pageOpts{device: "dev-b", pageID: "b1"})
	if code := over.closeCode(t); code != 4429 {
		t.Fatalf("quota: close %d, want 4429", code)
	}
}

func TestDeviceInvite(t *testing.T) {
	f := setup(t, "")
	c := f.login("owner@test", "password1")
	code, inv := c.do("POST", "/projects/"+f.project.ID+"/invites", map[string]any{"note": "订单 #123", "url": "https://shop.test/help"})
	if code != 200 {
		t.Fatalf("create invite: %d %v", code, inv)
	}
	link := inv["link"].(string)
	token := link[strings.Index(link, "rwd_invite=")+len("rwd_invite="):]
	p := f.page(pageOpts{pageID: "page1", invite: token})
	if p.welcome["help"] != true {
		t.Fatalf("invited device should be in help: %+v", p.welcome)
	}
	// One-time use.
	again := f.page(pageOpts{device: "dev-2", pageID: "x", invite: token})
	if again.welcome["help"] == true {
		t.Fatal("invite reused")
	}
}

func TestKeyExpiryAndIP(t *testing.T) {
	f := setup(t, "")
	ctx := context.Background()
	past := time.Now().Add(-time.Hour).UnixMilli()
	_, expired, _ := f.st.CreateAPIKey(ctx, f.s.pepper, store.NewKey{Name: "old", ExpiresAt: &past})
	if _, err := f.mcpWith(expired); err == nil {
		t.Fatal("expired key accepted")
	}
	_, ipKey, _ := f.st.CreateAPIKey(ctx, f.s.pepper, store.NewKey{Name: "ip", IPAllowlist: []string{"10.0.0.0/8"}})
	if _, err := f.mcpWith(ipKey); err == nil {
		t.Fatal("key used from outside its IP allowlist")
	}
	_, okKey, _ := f.st.CreateAPIKey(ctx, f.s.pepper, store.NewKey{Name: "ok", IPAllowlist: []string{"127.0.0.1"}})
	if _, err := f.mcpWith(okKey); err != nil {
		t.Fatalf("allowed key rejected: %v", err)
	}
}

// B6.3: revoking a key ends its access at once.
func TestRevoke(t *testing.T) {
	f := setup(t, `{"approval":"none"}`)
	p := f.page(pageOpts{pageID: "page1"})
	s := f.mcp()
	callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"]})
	expectControl(t, p, hub.ControlObserve)
	c := f.login("owner@test", "password1")
	if code, _ := c.do("DELETE", "/keys/"+f.keyID, nil); code != 200 {
		t.Fatalf("revoke: %d", code)
	}
	expectControl(t, p, hub.ControlNone)
	if _, err := s.CallTool(context.Background(), &mcp.CallToolParams{Name: "take_snapshot"}); err == nil {
		t.Fatal("revoked key still works")
	}
}

func TestMembersAndRoles(t *testing.T) {
	f := setup(t, "")
	owner := f.login("owner@test", "password1")
	code, m := owner.do("POST", "/members", map[string]string{"email": "dev@test.com", "name": "开发", "role": "member"})
	if code != 200 {
		t.Fatalf("invite: %d %v", code, m)
	}
	token := m["inviteUrl"].(string)[strings.LastIndex(m["inviteUrl"].(string), "/")+1:]
	jar, _ := cookiejar.New(nil)
	member := &console{t: t, base: f.srv.URL + "/v1/api", client: &http.Client{Jar: jar}}
	if code, body := member.do("POST", "/invites/"+token+"/accept", map[string]string{"password": "memberpass"}); code != 200 {
		t.Fatalf("accept: %d %v", code, body)
	}
	if code, me := member.do("GET", "/me", nil); code != 200 || me["role"] != "member" {
		t.Fatalf("me: %d %v", code, me)
	}
	// Members can read but not create keys or change policy.
	if code, _ := member.do("GET", "/projects/"+f.project.ID+"/devices", nil); code != 200 {
		t.Fatalf("member read: %d", code)
	}
	if code, _ := member.do("POST", "/projects/"+f.project.ID+"/keys", map[string]string{"name": "x"}); code != 403 {
		t.Fatalf("member create key: %d, want 403", code)
	}
	if code, _ := member.do("PATCH", "/projects/"+f.project.ID, map[string]any{"policy": map[string]any{"approval": "none"}}); code != 403 {
		t.Fatalf("member policy: %d, want 403", code)
	}
	// The last owner cannot be demoted.
	users, _ := f.st.Users(context.Background())
	for _, u := range users {
		if u.Role == store.RoleOwner {
			if code, _ := owner.do("PATCH", "/members/"+u.ID, map[string]string{"role": "admin"}); code != 409 {
				t.Fatalf("demote last owner: %d, want 409", code)
			}
		}
	}
	// Invalid regex in a mask rule is rejected.
	if code, _ := owner.do("PATCH", "/projects/"+f.project.ID, map[string]any{"policy": map[string]any{"maskPatterns": []map[string]string{{"name": "坏", "regex": "("}}}}); code != 400 {
		t.Fatalf("bad regex: %d, want 400", code)
	}
}

func TestAuth(t *testing.T) {
	f := setup(t, "")
	post := func(path, body string, hdr map[string]string) int {
		req, _ := http.NewRequest("POST", f.srv.URL+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}
	if got := post("/v1/api/auth/login", `{"email":"owner@test","password":"nope"}`, nil); got != 401 {
		t.Fatalf("bad password: %d", got)
	}
	if got := post("/v1/api/projects", `{"name":"x"}`, map[string]string{"X-RWD-CSRF": "1"}); got != 401 {
		t.Fatalf("no session: %d", got)
	}
	if got := post("/v1/mcp", `{}`, map[string]string{"Authorization": "Bearer rwd_sk_live_wrong"}); got != 401 {
		t.Fatalf("bad api key: %d", got)
	}
	res, err := http.Get(f.srv.URL + "/v1/page?key=nope")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 401 {
		t.Fatalf("bad app key: %d", res.StatusCode)
	}
	c := f.login("owner@test", "password1")
	if code, _ := c.do("POST", "/projects", nil); code == 403 {
		t.Fatal("csrf header sent but rejected")
	}
}

// X-Forwarded-Proto and X-Forwarded-Host count only with --trust-proxy, like
// X-Forwarded-For: they decide the cookie's Secure flag and the inferred URL.
func TestForwardedHeaders(t *testing.T) {
	for _, trust := range []bool{false, true} {
		f := setup(t, "")
		f.s.cfg.TrustProxy = trust
		get := func(path string) (*http.Response, map[string]any) {
			req, _ := http.NewRequest("GET", f.srv.URL+path, nil)
			req.Header.Set("X-Forwarded-Proto", "https")
			req.Header.Set("X-Forwarded-Host", "rwd.example.com")
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			var out map[string]any
			json.NewDecoder(res.Body).Decode(&out)
			return res, out
		}
		_, cfg := get("/v1/api/config")
		wantURL := f.srv.URL + "/v1"
		if trust {
			wantURL = "https://rwd.example.com/v1"
		}
		if cfg["gatewayUrl"] != wantURL {
			t.Fatalf("trust=%v: gatewayUrl %v, want %s", trust, cfg["gatewayUrl"], wantURL)
		}
		req, _ := http.NewRequest("POST", f.srv.URL+"/v1/api/auth/login", strings.NewReader(`{"email":"owner@test","password":"password1"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-Proto", "https")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		var secure *bool
		for _, c := range res.Cookies() {
			if c.Name == sessionCookie {
				secure = &c.Secure
			}
		}
		if res.StatusCode != 200 || secure == nil || *secure != trust {
			t.Fatalf("trust=%v: login %d, cookie secure %v", trust, res.StatusCode, secure)
		}
	}
}

func TestStreamAndMetrics(t *testing.T) {
	f := setup(t, "")
	c := f.login("owner@test", "password1")
	req, _ := http.NewRequest("GET", f.srv.URL+"/v1/api/stream?project="+f.project.ID, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	res, err := c.client.Do(req.WithContext(ctx))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	f.page(pageOpts{pageID: "page1", title: "列表"})
	sc := bufio.NewScanner(res.Body)
	got := ""
	for sc.Scan() {
		if line := sc.Text(); strings.HasPrefix(line, "event: device") {
			got = line
			break
		}
	}
	if got == "" {
		t.Fatalf("no device event: %v", errors.Join(sc.Err(), ctx.Err()))
	}
	mres, err := http.Get(f.srv.URL + "/v1/metrics")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(mres.Body)
	mres.Body.Close()
	if !strings.Contains(string(body), "rwd_online_devices{project=") || !strings.Contains(string(body), "rwd_ws_connections 1") {
		t.Fatalf("metrics: %s", body)
	}
}

func TestOriginMatches(t *testing.T) {
	cases := []struct {
		pattern, origin string
		want            bool
	}{
		{"https://m.example.com", "https://m.example.com", true},
		{"https://*.example.com", "https://m.example.com", true},
		{"https://*.example.com", "https://a.b.example.com", true},
		{"https://*.example.com", "https://example.com", false},
		{"https://*.example.com", "http://m.example.com", false},
		{"https://*.example.com", "https://evil-example.com", false},
	}
	for _, c := range cases {
		if got := originMatches(c.pattern, c.origin); got != c.want {
			t.Errorf("originMatches(%q, %q) = %v", c.pattern, c.origin, got)
		}
	}
}

func TestDeviceListAndStatus(t *testing.T) {
	f := setup(t, "")
	f.page(pageOpts{device: "dev-old", pageID: "a"})
	time.Sleep(5 * time.Millisecond)
	f.page(pageOpts{device: "dev-new", pageID: "b"})
	c := f.login("owner@test", "password1")

	code, body := c.do("GET", "/devices?pageSize=1", nil)
	if code != 200 || body["total"].(float64) != 2 || len(body["devices"].([]any)) != 1 {
		t.Fatalf("devices: %d %v", code, body)
	}
	first := body["devices"].([]any)[0].(map[string]any)
	if first["id"] != "dev-new" || first["projectName"] != "demo" || first["onlineSince"] == nil {
		t.Fatalf("newest connection first, with project name: %v", first)
	}
	if code, body = c.do("GET", "/devices?q=DEV-OLD", nil); code != 200 || body["total"].(float64) != 1 {
		t.Fatalf("search: %v", body)
	}
	if code, body = c.do("GET", "/devices?status=all&q=dev-&page=2&pageSize=1", nil); code != 200 || body["total"].(float64) != 2 || len(body["devices"].([]any)) != 1 {
		t.Fatalf("all, paged: %v", body)
	}
	// Both modes search the same fields: project name and system label too.
	for _, q := range []string{"q=demo", "q=iOS", "status=all&q=demo", "status=all&q=iOS", "status=all&q=DEV-OLD"} {
		want := 2.0
		if strings.HasSuffix(q, "DEV-OLD") {
			want = 1
		}
		if code, body = c.do("GET", "/devices?"+q, nil); code != 200 || body["total"].(float64) != want {
			t.Fatalf("%s: %d %v", q, code, body)
		}
	}
	if code, body = c.do("GET", "/devices?status=all&q=nothing-like-it", nil); code != 200 || body["total"].(float64) != 0 || len(body["devices"].([]any)) != 0 {
		t.Fatalf("all, no match: %v", body)
	}
	code, st := c.do("GET", "/status", nil)
	if code != 200 || st["onlineDevices"].(float64) != 2 || st["totalDevices"].(float64) != 2 || st["db"] == nil {
		t.Fatalf("status: %v", st)
	}
}

func TestSetTask(t *testing.T) {
	f := setup(t, `{"approval":"none"}`)
	p := f.page(pageOpts{pageID: "page1"})
	s := f.mcp()
	callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"]})
	out, isErr := callText(t, s, "set_task", map[string]any{"title": "周数据与反馈排查",
		"steps": []string{"找到周切换的功能", "切换到上一周", "读取完整周进度信息", "查找吐槽与建议"}, "current": 1})
	if isErr || !strings.Contains(out, "第 2/4 步「切换到上一周」") {
		t.Fatalf("set_task: %s", out)
	}
	select {
	case m := <-p.tasks:
		task := m["task"].(map[string]any)
		if task["title"] != "周数据与反馈排查" || task["current"].(float64) != 1 || len(task["steps"].([]any)) != 4 || task["agent"] != "bot" {
			t.Fatalf("task message: %v", m)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no task message")
	}
	// A page that connects later gets it in welcome.
	p2 := f.page(pageOpts{pageID: "page2"})
	if p2.welcome["task"] == nil {
		t.Fatalf("welcome without task: %v", p2.welcome)
	}
	callText(t, s, "disconnect_device", nil)
	select {
	case m := <-p.tasks:
		if m["task"] != nil {
			t.Fatalf("task not cleared: %v", m)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("task not cleared on disconnect")
	}
}

// One phone opening pages of two integrations is one device: one code, the
// same device token, and any API key reaches it. The stricter project decides
// whether the user is asked.
func TestDeviceAcrossProjects(t *testing.T) {
	f := setup(t, `{"approval":"none","maxLevel":"advanced"}`)
	other, err := f.st.CreateProject(context.Background(), "learning", nil) // default: ask, interact
	if err != nil {
		t.Fatal(err)
	}
	shop := f.page(pageOpts{pageID: "a"})
	f.appKey = other.AppKey
	learning := f.page(pageOpts{pageID: "b", decide: approveAs("interact")})
	if learning.welcome == nil || learning.welcome["deviceCode"] != shop.welcome["deviceCode"] {
		t.Fatalf("second project: %+v, want code %v", learning.welcome, shop.welcome["deviceCode"])
	}
	if learning.welcome["deviceToken"] != nil {
		t.Fatal("the device already holds a token; the second project must not issue another")
	}
	code := shop.welcome["deviceCode"].(string)

	s := f.mcp()
	out, _ := callText(t, s, "list_devices", nil)
	if strings.Count(out, code) != 1 {
		t.Fatalf("list_devices should show the device once:\n%s", out)
	}
	out, isErr := callText(t, s, "connect_device", map[string]any{"device": code, "level": "advanced"})
	if isErr || !strings.Contains(out, "interact") {
		t.Fatalf("connect: %s (want interact: the stricter project caps the level)", out)
	}
	select {
	case <-learning.requests:
	default:
		t.Fatal("the stricter project asks the user first")
	}
	if !strings.Contains(out, "https://shop.test/a") || !strings.Contains(out, "https://shop.test/b") {
		t.Fatalf("both projects' pages belong to the device:\n%s", out)
	}
}

// Databases from before devices and keys were global are rebuilt: a device
// seen in two projects becomes one (latest code, earliest first sighting, no
// device token), and keys outlive the project they were created in.
func TestMigrateGlobalDevices(t *testing.T) {
	if os.Getenv("RWD_TEST_DATABASE_URL") != "" {
		t.Skip("the old schema is built with SQLite")
	}
	path := filepath.Join(t.TempDir(), "old.db")
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	for _, st := range []string{
		`CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, app_key TEXT NOT NULL UNIQUE,
			allowed_origins TEXT NOT NULL DEFAULT '[]', disabled INTEGER NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL, policy TEXT NOT NULL DEFAULT '', invite_url TEXT NOT NULL DEFAULT '')`,
		`CREATE TABLE api_keys (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL, prefix TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL,
			last_used_at BIGINT, revoked_at BIGINT, max_level TEXT NOT NULL DEFAULT 'interact', expires_at BIGINT,
			ip_allowlist TEXT NOT NULL DEFAULT '[]')`,
		`CREATE TABLE devices (project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, device_id TEXT NOT NULL,
			code TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL DEFAULT '', platform TEXT NOT NULL DEFAULT '',
			ua TEXT NOT NULL DEFAULT '', app TEXT NOT NULL DEFAULT '', first_seen BIGINT NOT NULL,
			last_seen BIGINT NOT NULL, token_hash TEXT NOT NULL DEFAULT '', PRIMARY KEY (project_id, device_id))`,
		`INSERT INTO projects (id, name, app_key, created_at) VALUES ('p1', 'shop', 'k1', 1), ('p2', 'learning', 'k2', 2)`,
		`INSERT INTO api_keys (id, project_id, name, prefix, hash, created_at) VALUES ('key1', 'p1', 'bot', 'rwd_sk_live_abcd', 'h1', 1)`,
		`INSERT INTO devices (project_id, device_id, code, first_seen, last_seen, token_hash) VALUES
			('p1', 'phone', 'AAAA-AAAA', 10, 100, 't1'), ('p2', 'phone', 'BBBB-BBBB', 50, 200, 't2'),
			('p1', 'tablet', 'CCCC-CCCC', 5, 5, 't3')`,
	} {
		if _, err := db.Exec(st); err != nil {
			t.Fatalf("%v: %s", err, st[:40])
		}
	}
	db.Close()

	st, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ctx := context.Background()
	phone, err := st.Device(ctx, "phone")
	if err != nil {
		t.Fatal(err)
	}
	if phone.Code != "BBBB-BBBB" || phone.ProjectID != "p2" || phone.FirstSeen != 10 || phone.TokenHash != "" {
		t.Fatalf("merged phone: %+v", phone)
	}
	if tablet, err := st.Device(ctx, "tablet"); err != nil || tablet.TokenHash != "t3" {
		t.Fatalf("a device of one project keeps its token: %+v %v", tablet, err)
	}
	if n, _ := st.CountDevices(ctx); n != 2 {
		t.Fatalf("devices: %d, want 2", n)
	}
	if err := st.DeleteProject(ctx, "p1"); err != nil {
		t.Fatal(err)
	}
	if keys, _ := st.APIKeys(ctx); len(keys) != 1 {
		t.Fatalf("keys after deleting their old project: %d, want 1", len(keys))
	}
	if _, err := st.Device(ctx, "tablet"); err != nil {
		t.Fatalf("devices outlive projects: %v", err)
	}
	// Reopening does not rebuild again.
	st.Close()
	if st, err = store.Open(path); err != nil {
		t.Fatal(err)
	}
}

// An agent that let go of the device comes back within the grace period
// without asking the user again, at no more than the level granted before.
// Once the user ends the session, or another agent replaces it on the
// device, the next attach asks again.
func TestReattachWithinGrace(t *testing.T) {
	f := setup(t, "")
	var asked atomic.Int32
	p := f.page(pageOpts{pageID: "page1", decide: func(map[string]any) any { asked.Add(1); return "observe" }})
	code := p.welcome["deviceCode"].(string)
	s := f.mcp()
	if out, isErr := callText(t, s, "connect_device", map[string]any{"device": code}); isErr {
		t.Fatalf("connect: %s", out)
	}
	callText(t, s, "disconnect_device", nil)
	out, isErr := callText(t, s, "connect_device", map[string]any{"device": code, "level": "interact"})
	if isErr || !strings.Contains(out, "observe") || asked.Load() != 1 {
		t.Fatalf("reattach (asked %d): %s", asked.Load(), out)
	}
	p.send(t, map[string]string{"t": "control", "action": "end"})
	time.Sleep(100 * time.Millisecond)
	if out, isErr := callText(t, s, "connect_device", map[string]any{"device": code}); isErr || asked.Load() != 2 {
		t.Fatalf("after user end (asked %d): %s", asked.Load(), out)
	}
	callText(t, s, "disconnect_device", nil)
	if out, isErr := callText(t, s, "connect_device", map[string]any{"device": code}); isErr || asked.Load() != 2 {
		t.Fatalf("second reattach (asked %d): %s", asked.Load(), out)
	}

	// Another key replaces the agent: its grant goes with its attachment.
	_, plain2, err := f.st.CreateAPIKey(context.Background(), f.s.pepper, store.NewKey{Name: "bot2", MaxLevel: store.LevelAdvanced})
	if err != nil {
		t.Fatal(err)
	}
	s2, err := f.mcpWith(plain2)
	if err != nil {
		t.Fatal(err)
	}
	if out, isErr := callText(t, s2, "connect_device", map[string]any{"device": code}); isErr || asked.Load() != 3 {
		t.Fatalf("second agent (asked %d): %s", asked.Load(), out)
	}
	if out, isErr := callText(t, s, "connect_device", map[string]any{"device": code}); isErr || asked.Load() != 4 {
		t.Fatalf("after being replaced (asked %d): %s", asked.Load(), out)
	}
}

// A WebView recreated under a new page id replaces the old, disconnected
// entry right away instead of leaving it "reconnecting".
func TestStalePageDropped(t *testing.T) {
	f := setup(t, "")
	p1 := f.page(pageOpts{pageID: "page1", url: "https://shop.test/sync#a", decide: approveAs("interact")})
	s := f.mcp()
	callText(t, s, "connect_device", map[string]any{"device": p1.welcome["deviceCode"]})
	p1.ws.CloseNow()
	time.Sleep(100 * time.Millisecond)
	f.page(pageOpts{pageID: "page2", url: "https://shop.test/sync#b"})
	time.Sleep(100 * time.Millisecond)
	out, _ := callText(t, s, "list_pages", nil)
	if list, _, _ := strings.Cut(out, "[会话变化]"); strings.Contains(list, "p1") || !strings.Contains(list, "p2") {
		t.Fatalf("list_pages after recreate: %s", out)
	}

	// A twin that disconnects while another page shows the same document goes
	// after a short wait, not after the full page grace.
	p3 := f.page(pageOpts{pageID: "page3", url: "https://shop.test/sync"})
	time.Sleep(100 * time.Millisecond)
	p3.ws.CloseNow()
	time.Sleep(2 * time.Second)
	if out, _ := callText(t, s, "list_pages", nil); strings.Contains(strings.Split(out, "[会话变化]")[0], "p3") {
		t.Fatalf("list_pages after twin left: %s", out)
	}
}

func fakeSessionLog(params map[string]any, pageID string) map[string]any {
	meta := map[string]any{"id": "launch-1", "source": "app", "startedAt": 1_700_000_000_000, "lastAt": 1_700_000_060_000,
		"bytes": 2 << 20, "trimmed": 0, "counts": map[string]any{"console": 10, "error": 1, "net": 5, "netFail": 1, "action": 2, "page": 2}, "current": true}
	fail := map[string]any{"seq": 7, "at": 1_700_000_030_000, "kind": "net", "page": pageID,
		"data": map[string]any{"method": "GET", "url": "https://shop.test/api/cart", "status": 500, "type": "fetch", "durationMs": 12, "hasBody": true}}
	switch params["op"] {
	case "overview":
		return map[string]any{"session": meta, "first": 1_700_000_000_000, "last": 1_700_000_060_000,
			"pages":    []any{map[string]any{"at": 1_700_000_000_000, "page": pageID, "data": map[string]any{"event": "open", "url": "https://shop.test/", "title": "首页"}}},
			"problems": []any{fail}}
	case "sessions":
		old := map[string]any{"id": "launch-0", "source": "app", "startedAt": 1_699_999_000_000, "lastAt": 1_699_999_100_000, "bytes": 1024, "counts": map[string]any{}}
		return map[string]any{"sessions": []any{meta, old}}
	}
	tap := map[string]any{"seq": 3, "at": 1_700_000_010_000, "kind": "action", "page": pageID,
		"data": map[string]any{"event": "tap", "target": `Tapped button "去结算"`}}
	return map[string]any{"session": "launch-1", "records": []any{tap, fail}, "next": 7, "hidden": 2}
}

// The session log tools read the page's IndexedDB log through rwd.log and
// show it as lines; full records (bodies) need advanced.
func TestSessionLogTools(t *testing.T) {
	f := setup(t, "")
	p := f.page(pageOpts{pageID: "page1", decide: approveAs("interact")})
	s := f.mcp()
	callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"]})

	out, isErr := callText(t, s, "get_session_overview", nil)
	for _, want := range []string{"会话日志 launch-1（App 提供的启动 ID） · 当前这次启动", "页面路径", "p1 page open https://shop.test/ \"首页\"",
		"#7", "GET https://shop.test/api/cart → 500 fetch 12ms [body]", "launch-0", "2.0 MB"} {
		if isErr || !strings.Contains(out, want) {
			t.Fatalf("overview missing %q: %s", want, out)
		}
	}
	out, isErr = callText(t, s, "get_session_log", map[string]any{"page": "p1", "problems": true})
	for _, want := range []string{"#3", "p1 user tap Tapped button \"去结算\"", "after=7", "2 条请求按排除规则隐藏"} {
		if isErr || !strings.Contains(out, want) {
			t.Fatalf("log missing %q: %s", want, out)
		}
	}
	if out, isErr := callText(t, s, "get_session_log", map[string]any{"seq": 7}); !isErr || !strings.Contains(out, "advanced") {
		t.Fatalf("record detail at interact: %s", out)
	}
}

// The polling fallback must not let anyone with the public app key and a
// deviceId impersonate a device that has a token, and it carries the help
// request like hello does.
func TestPresenceNeedsDeviceToken(t *testing.T) {
	f := setup(t, "")
	p := f.page(pageOpts{device: "dev-poll", pageID: "poll-1"})
	code := p.welcome["deviceCode"].(string)
	f.mu.Lock()
	token := f.deviceToken["dev-poll"]
	f.mu.Unlock()
	if token == "" {
		t.Fatal("no device token issued")
	}

	post := func(body map[string]any) (int, map[string]any) {
		t.Helper()
		b, _ := json.Marshal(body)
		res, err := http.Post(f.srv.URL+"/v1/presence", "text/plain", bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var out map[string]any
		json.NewDecoder(res.Body).Decode(&out)
		return res.StatusCode, out
	}
	base := map[string]any{"key": f.appKey, "deviceId": "dev-poll", "userId": "someone-else"}

	if st, out := post(base); st != http.StatusUnauthorized || out["error"].(map[string]any)["code"] != "bad_token" {
		t.Fatalf("presence without token: %d %v", st, out)
	}
	wrong := map[string]any{"deviceToken": "nope"}
	for k, v := range base {
		wrong[k] = v
	}
	if st, _ := post(wrong); st != http.StatusUnauthorized {
		t.Fatalf("presence with a wrong token: %d", st)
	}
	if d, _ := f.st.Device(context.Background(), "dev-poll"); d.UserID == "someone-else" {
		t.Fatal("a rejected presence must not overwrite the device")
	}

	ok := map[string]any{"deviceToken": token, "help": true}
	for k, v := range base {
		ok[k] = v
	}
	st, out := post(ok)
	if st != http.StatusOK || out["deviceCode"] != code {
		t.Fatalf("presence with the token: %d %v", st, out)
	}
	s := f.mcp()
	if list, _ := callText(t, s, "list_devices", map[string]any{"status": "waiting"}); !strings.Contains(list, code) {
		t.Fatalf("help sent over presence should show the device as waiting:\n%s", list)
	}

	// A device that never got a token (older SDK) keeps polling without one.
	if st, _ := post(map[string]any{"key": f.appKey, "deviceId": "dev-legacy"}); st != http.StatusOK {
		t.Fatalf("presence of a tokenless device: %d", st)
	}
}
