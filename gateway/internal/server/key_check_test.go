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

// setupKeyCheck runs a gateway with sign-in through provider asking for
// offline_access and the key check on (or off), devices attached without
// approval.
func setupKeyCheck(t *testing.T, provider string, on bool) (*fixture, *fakeIdP) {
	t.Helper()
	idp := newFakeIdP(t, provider)
	cfg := idp.config()
	if provider == ProviderOIDC {
		cfg.Scopes = "openid email offline_access"
	} else {
		cfg.Scopes += " offline_access"
	}
	cfg.KeyCheck = on
	return setupConfig(t, `{"approval":"none"}`, Config{OIDC: cfg, Lang: i18n.EN}), idp
}

// ssoKey signs sub in and returns a key of theirs.
func (f *fixture) ssoKey(idp *fakeIdP, sub string) string {
	f.t.Helper()
	claims := map[string]any{"open_id": sub, "enterprise_email": sub + "@corp.example"}
	if idp.provider == ProviderOIDC {
		claims = map[string]any{"sub": sub, "email": sub + "@corp.example", "email_verified": true}
	}
	c, _ := f.ssoLogin(idp, claims, "")
	return createKey(f.t, c, "agent", "interact", 200)["key"].(string)
}

func (f *fixture) keyCheckTimes(ttl, grace time.Duration) {
	r := f.s.refresh
	r.mu.Lock()
	r.ttl, r.grace = ttl, grace
	r.mu.Unlock()
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

func revokedEvents(f *fixture, email string) int {
	f.s.flushAudit()
	events, _ := f.st.Audit(context.Background(), store.AuditQuery{Limit: 200})
	n := 0
	for _, e := range events {
		if e.Action == "member.sso_revoked" && e.ActorType == "system" && e.Target == email {
			n++
		}
	}
	return n
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

func TestKeyCheckOwnerRefused(t *testing.T) {
	for _, provider := range []string{ProviderFeishu, ProviderOIDC} {
		t.Run(provider, func(t *testing.T) {
			f, idp := setupKeyCheck(t, provider, true)
			key := f.ssoKey(idp, "dev")
			s, err := f.mcpWith(key)
			if err != nil {
				t.Fatalf("key refused: %v", err)
			}
			p := f.page(pageOpts{pageID: "page1"})
			callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"]})
			expectControl(t, p, hub.ControlObserve)
			// Confirmed at sign-in: no renewal within the window.
			if err := listDevices(s); err != nil || idp.renewCount() != 0 {
				t.Fatalf("within the window: %v, %d renewals", err, idp.renewCount())
			}

			// Past the window a burst of calls, some concurrent, renews once
			// (Feishu rotates the token each time: a second renewal with the
			// old one would be refused).
			f.keyCheckTimes(0, refreshGrace)
			var wg sync.WaitGroup
			for range 8 {
				wg.Go(func() {
					if err := listDevices(s); err != nil {
						t.Error(err)
					}
				})
			}
			wg.Wait()
			if n := idp.renewCount(); n < 1 || n > 8 {
				t.Fatalf("renewals: %d", n)
			}
			if err := listDevices(s); err != nil {
				t.Fatalf("after renewals: %v", err)
			}

			// The provider refuses: the key stops, the agent goes, the member stays.
			idp.setState("dev", "refused")
			if err := listDevices(s); err == nil {
				t.Fatal("key works after the provider refused its owner")
			}
			expectControl(t, p, hub.ControlNone)
			if f.memberDisabled("dev@corp.example") {
				t.Fatal("member disabled")
			}
			if n := revokedEvents(f, "dev@corp.example"); n != 1 {
				t.Fatalf("audit: %d member.sso_revoked", n)
			}
			before := idp.renewCount()
			if code, body := f.rawMCP(key); code != http.StatusUnauthorized || !strings.Contains(body, i18n.EN.T(i18n.MCPKeyOwnerSignIn)) {
				t.Fatalf("refused key: %d %q", code, body)
			}
			if idp.renewCount() != before {
				t.Fatal("asked the provider again after a refusal")
			}

			// Signing in again (the provider allows it) brings the key back.
			idp.setState("dev", "")
			f.ssoKey(idp, "dev")
			if _, err := f.mcpWith(key); err != nil {
				t.Fatalf("after signing in again: %v", err)
			}
		})
	}
}

func TestKeyCheckNoAnswer(t *testing.T) {
	f, idp := setupKeyCheck(t, ProviderFeishu, true)
	f.keyCheckTimes(0, refreshGrace)
	key := f.ssoKey(idp, "ou_ok")
	s, err := f.mcpWith(key)
	if err != nil {
		t.Fatal(err)
	}
	// Confirmed recently, within the grace period: allowed.
	idp.setState("ou_ok", "down")
	if err := listDevices(s); err != nil {
		t.Fatalf("no answer after a recent confirmation: %v", err)
	}
	// Past it: refused, never revoked or disabled.
	f.keyCheckTimes(0, 0)
	if code, body := f.rawMCP(key); code != http.StatusUnauthorized || !strings.Contains(body, i18n.EN.T(i18n.MCPKeyOwnerUnverified)) {
		t.Fatalf("no answer past the grace period: %d %q", code, body)
	}
	if f.memberDisabled("ou_ok@corp.example") || revokedEvents(f, "ou_ok@corp.example") != 0 {
		t.Fatal("revoked on no answer")
	}
	// The provider answers again: the key works.
	idp.setState("ou_ok", "")
	if _, err := f.mcpWith(key); err != nil {
		t.Fatalf("provider back: %v", err)
	}
}

func TestKeyCheckWithoutToken(t *testing.T) {
	f, idp := setupKeyCheck(t, ProviderFeishu, true)
	ctx := context.Background()
	key := f.ssoKey(idp, "ou_old")
	// As if signed in before the gateway asked for offline_access.
	if err := f.st.SetIdentityToken(ctx, f.s.cfg.OIDC.identityProvider(), "ou_old", ""); err != nil {
		t.Fatal(err)
	}
	if code, body := f.rawMCP(key); code != http.StatusUnauthorized || !strings.Contains(body, i18n.EN.T(i18n.MCPKeyOwnerSignIn)) {
		t.Fatalf("owner without a refresh token: %d %q", code, body)
	}
	f.ssoKey(idp, "ou_old")
	if _, err := f.mcpWith(key); err != nil {
		t.Fatalf("after signing in again: %v", err)
	}
	// A token the gateway can't open (the session secret changed): sign in again.
	if err := f.st.SetIdentityToken(ctx, f.s.cfg.OIDC.identityProvider(), "ou_old", "garbage"); err != nil {
		t.Fatal(err)
	}
	f.keyCheckTimes(0, refreshGrace)
	if _, err := f.mcpWith(key); err == nil {
		t.Fatal("key works with an unreadable refresh token")
	}
}

func TestKeyCheckTokenSealed(t *testing.T) {
	f, idp := setupKeyCheck(t, ProviderFeishu, true)
	f.ssoKey(idp, "ou_x")
	id, err := f.st.Identity(context.Background(), f.s.cfg.OIDC.identityProvider(), "ou_x")
	if err != nil {
		t.Fatal(err)
	}
	if id.RefreshToken == "" || strings.Contains(id.RefreshToken, "rt-") {
		t.Fatalf("stored refresh token %q", id.RefreshToken)
	}
	if tok, err := f.s.openToken(id.RefreshToken); err != nil || !strings.HasPrefix(tok, "rt-") {
		t.Fatalf("open: %q %v", tok, err)
	}
}

func TestKeyCheckUnaffectedKeys(t *testing.T) {
	f, idp := setupKeyCheck(t, ProviderFeishu, true)
	f.keyCheckTimes(0, refreshGrace)
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
	if n := idp.renewCount(); n != 0 {
		t.Fatalf("renewals: %d", n)
	}
}

func TestKeyCheckOff(t *testing.T) {
	for name, edit := range map[string]func(*OIDCConfig){
		"RWD_OIDC_KEY_CHECK=0":   func(o *OIDCConfig) { o.KeyCheck = false },
		"without offline_access": func(o *OIDCConfig) { o.Scopes = "contact:user.email:readonly" },
	} {
		t.Run(name, func(t *testing.T) {
			idp := newFakeIdP(t, ProviderFeishu)
			cfg := idp.config()
			cfg.Scopes += " offline_access"
			cfg.KeyCheck = true
			edit(cfg)
			f := setupConfig(t, `{"approval":"none"}`, Config{OIDC: cfg, Lang: i18n.EN})
			f.keyCheckTimes(0, 0)
			key := f.ssoKey(idp, "ou_gone")
			idp.setState("ou_gone", "refused")
			s, err := f.mcpWith(key)
			if err != nil {
				t.Fatalf("check off: %v", err)
			}
			if err := listDevices(s); err != nil {
				t.Fatal(err)
			}
			if n := idp.renewCount(); n != 0 {
				t.Fatalf("check off: %d renewals", n)
			}
		})
	}
}
