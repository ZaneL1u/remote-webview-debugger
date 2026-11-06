package server

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/hub"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// setupKeyCheck runs a gateway with Feishu sign-in and the key check on (or
// off), devices attached without approval.
func setupKeyCheck(t *testing.T, on bool) (*fixture, *fakeIdP) {
	t.Helper()
	idp := newFakeIdP(t, ProviderFeishu)
	cfg := idp.config()
	cfg.KeyCheck = on
	return setupConfig(t, `{"approval":"none"}`, Config{OIDC: cfg, Lang: i18n.EN}), idp
}

// ssoKey signs openID in through Feishu and returns a key of theirs.
func (f *fixture) ssoKey(idp *fakeIdP, openID string) string {
	f.t.Helper()
	c, _ := f.ssoLogin(idp, map[string]any{"open_id": openID, "enterprise_email": openID + "@corp.example"}, "")
	return createKey(f.t, c, "agent", "interact", 200)["key"].(string)
}

func (idp *fakeIdP) set(openID, state string) {
	idp.mu.Lock()
	defer idp.mu.Unlock()
	if idp.contact == nil {
		idp.contact = map[string]string{}
	}
	idp.contact[openID] = state
}

func (idp *fakeIdP) lookupCount() int {
	idp.mu.Lock()
	defer idp.mu.Unlock()
	return idp.lookups
}

func (f *fixture) keyCheckTimes(ttl, grace time.Duration) {
	d := f.s.dir
	d.mu.Lock()
	d.ttl, d.grace = ttl, grace
	d.mu.Unlock()
}

func (f *fixture) memberDisabled(email string) bool {
	f.t.Helper()
	u, err := f.st.UserByEmail(context.Background(), email)
	if err != nil {
		f.t.Fatal(err)
	}
	return u.Disabled
}

func listDevices(s *mcp.ClientSession) error {
	_, err := s.CallTool(context.Background(), &mcp.CallToolParams{Name: "list_devices"})
	return err
}

func leftEvents(f *fixture, email string) int {
	f.s.flushAudit()
	events, _ := f.st.Audit(context.Background(), store.AuditQuery{Limit: 200})
	n := 0
	for _, e := range events {
		if e.Action == "member.update" && e.ActorType == "system" && e.Target == email && strings.Contains(mustJSONTest(e.Detail), "left_organization") {
			n++
		}
	}
	return n
}

func TestKeyCheckOwnerLeaves(t *testing.T) {
	f, idp := setupKeyCheck(t, true)
	key := f.ssoKey(idp, "ou_dev")
	idp.set("ou_dev", "active")
	s, err := f.mcpWith(key)
	if err != nil {
		t.Fatalf("active owner's key refused: %v", err)
	}
	p := f.page(pageOpts{pageID: "page1"})
	callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"]})
	expectControl(t, p, hub.ControlObserve)

	// A burst of calls, some concurrent, asks Feishu once.
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			if err := listDevices(s); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if n := idp.lookupCount(); n != 1 {
		t.Fatalf("lookups: %d, want 1 (cached)", n)
	}

	// Resigned: "active" is trusted for the cache window, then refused.
	idp.set("ou_dev", "resigned")
	if err := listDevices(s); err != nil {
		t.Fatalf("within the cache window: %v", err)
	}
	f.keyCheckTimes(0, keyCheckGrace)
	err = listDevices(s)
	if err == nil {
		t.Fatal("key of an owner who left still works")
	}
	expectControl(t, p, hub.ControlNone)
	if !f.memberDisabled("ou_dev@corp.example") {
		t.Fatal("owner who left not disabled")
	}
	if n := leftEvents(f, "ou_dev@corp.example"); n != 1 {
		t.Fatalf("audit: %d left_organization events", n)
	}
	if _, err := f.mcpWith(key); err == nil {
		t.Fatal("new session with the key of an owner who left")
	}
}

// rawMCP posts an initialize request with the key and returns the status
// and body (the MCP client doesn't surface the 401's text).
func (f *fixture) rawMCP(key string) (int, string) {
	f.t.Helper()
	req, _ := http.NewRequest("POST", f.srv.URL+"/v1/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}`))
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		f.t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res.StatusCode, string(b)
}

func TestKeyCheckRefusalMessage(t *testing.T) {
	f, idp := setupKeyCheck(t, true)
	f.keyCheckTimes(0, keyCheckGrace)
	for id, want := range map[string]i18n.Key{"exited": i18n.MCPKeyOwnerLeft, "out_of_range": i18n.MCPKeyOwnerUnverified} {
		key := f.ssoKey(idp, "ou_"+id)
		idp.set("ou_"+id, id)
		if code, body := f.rawMCP(key); code != http.StatusUnauthorized || !strings.Contains(body, i18n.EN.T(want)) {
			t.Fatalf("%s: %d %q", id, code, body)
		}
	}
}

func TestKeyCheckLookupFails(t *testing.T) {
	f, idp := setupKeyCheck(t, true)
	f.keyCheckTimes(0, keyCheckGrace)

	// Active at the last lookup, within the grace period: allowed.
	key := f.ssoKey(idp, "ou_ok")
	s, err := f.mcpWith(key)
	if err != nil {
		t.Fatal(err)
	}
	idp.set("ou_ok", "out_of_range")
	if err := listDevices(s); err != nil {
		t.Fatalf("lookup failed after a recent success: %v", err)
	}
	// Past the grace period: refused, never disabled.
	f.keyCheckTimes(0, 0)
	if err := listDevices(s); err == nil {
		t.Fatal("allowed without a recent successful lookup")
	}
	if f.memberDisabled("ou_ok@corp.example") {
		t.Fatal("disabled on a failed lookup")
	}

	// Never confirmed: refused, never disabled.
	f.keyCheckTimes(0, keyCheckGrace)
	key = f.ssoKey(idp, "ou_far")
	idp.set("ou_far", "out_of_range")
	if _, err := f.mcpWith(key); err == nil {
		t.Fatal("allowed without any successful lookup")
	}
	if f.memberDisabled("ou_far@corp.example") || leftEvents(f, "ou_far@corp.example") != 0 {
		t.Fatal("disabled on a failed lookup")
	}
	idp.mu.Lock()
	tokens := idp.tokens
	idp.mu.Unlock()
	if tokens != 1 {
		t.Fatalf("tenant_access_token fetched %d times, want 1 (cached)", tokens)
	}
}

func TestKeyCheckLastOwnerLeaves(t *testing.T) {
	f, idp := setupKeyCheck(t, true)
	f.keyCheckTimes(0, keyCheckGrace)
	ctx := context.Background()
	owner := f.login("owner@test", "password1")
	u, _ := f.st.UserByEmail(ctx, "owner@test")
	if err := f.st.LinkIdentity(ctx, u.ID, f.s.cfg.OIDC.identityProvider(), "ou_boss"); err != nil {
		t.Fatal(err)
	}
	key := createKey(t, owner, "boss", "interact", 200)["key"].(string)
	if _, err := f.mcpWith(key); err != nil {
		t.Fatal(err)
	}
	idp.set("ou_boss", "resigned")
	if _, err := f.mcpWith(key); err == nil {
		t.Fatal("last owner's key works after they left")
	}
	if f.memberDisabled("owner@test") {
		t.Fatal("the last owner was disabled")
	}
}

func TestKeyCheckUnaffectedKeys(t *testing.T) {
	f, idp := setupKeyCheck(t, true)
	owner := f.login("owner@test", "password1")
	member, _ := f.addMember(owner, "pw@example.com", "member")
	pwKey := createKey(t, member, "pw", "interact", 200)["key"].(string)
	for name, key := range map[string]string{"gateway key": f.apiKey, "password account": pwKey} {
		s, err := f.mcpWith(key)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if err := listDevices(s); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
	if n := idp.lookupCount(); n != 0 {
		t.Fatalf("lookups: %d", n)
	}
}

func TestKeyCheckOff(t *testing.T) {
	f, idp := setupKeyCheck(t, false)
	key := f.ssoKey(idp, "ou_gone")
	idp.set("ou_gone", "resigned")
	s, err := f.mcpWith(key)
	if err != nil {
		t.Fatalf("check off: %v", err)
	}
	if err := listDevices(s); err != nil {
		t.Fatal(err)
	}
	if n := idp.lookupCount(); n != 0 || f.memberDisabled("ou_gone@corp.example") {
		t.Fatalf("check off: %d lookups", n)
	}
}
