package server

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// fakeIdP plays the provider: its authorize endpoint approves at once and
// sends the browser back with a code; the token endpoint checks the client,
// the redirect URI and PKCE; userinfo answers with the user set in `next`.
type fakeIdP struct {
	t        *testing.T
	srv      *httptest.Server
	provider string // feishu (JSON, wrapped user) or oidc (form, flat claims)
	basic    bool   // oidc: advertise client_secret_basic

	mu    sync.Mutex
	next  map[string]any            // claims of the next sign-in
	codes map[string]map[string]any // code -> {challenge, redirect, claims}
	deny  bool
}

func newFakeIdP(t *testing.T, provider string) *fakeIdP {
	idp := &fakeIdP{t: t, provider: provider, codes: map[string]map[string]any{}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		methods := []string{"client_secret_post"}
		if idp.basic {
			methods = []string{"client_secret_basic", "client_secret_post"}
		}
		writeJSON(w, map[string]any{"issuer": idp.srv.URL, "authorization_endpoint": idp.srv.URL + "/authorize",
			"token_endpoint": idp.srv.URL + "/token", "userinfo_endpoint": idp.srv.URL + "/userinfo",
			"token_endpoint_auth_methods_supported": methods})
	})
	mux.HandleFunc("GET /authorize", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		back, _ := url.Parse(q.Get("redirect_uri"))
		bq := url.Values{"state": {q.Get("state")}}
		idp.mu.Lock()
		if idp.deny {
			bq.Set("error", "access_denied")
		} else {
			code := "code-" + q.Get("state")[:8]
			idp.codes[code] = map[string]any{"challenge": q.Get("code_challenge"), "redirect": q.Get("redirect_uri"),
				"claims": idp.next, "client": q.Get("client_id"), "scope": q.Get("scope")}
			bq.Set("code", code)
		}
		idp.mu.Unlock()
		back.RawQuery = bq.Encode()
		http.Redirect(w, r, back.String(), http.StatusFound)
	})
	mux.HandleFunc("POST /token", func(w http.ResponseWriter, r *http.Request) {
		var p map[string]string
		if idp.provider == ProviderOIDC {
			r.ParseForm()
			p = map[string]string{}
			for k := range r.PostForm {
				p[k] = r.PostForm.Get(k)
			}
			if id, secret, ok := r.BasicAuth(); ok {
				p["client_id"], p["client_secret"] = id, secret
			} else if idp.basic {
				t.Errorf("token request without basic auth")
			}
		} else {
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				t.Errorf("feishu token request content type %q", r.Header.Get("Content-Type"))
			}
			json.NewDecoder(r.Body).Decode(&p)
		}
		idp.mu.Lock()
		c := idp.codes[p["code"]]
		delete(idp.codes, p["code"])
		idp.mu.Unlock()
		sum := sha256.Sum256([]byte(p["code_verifier"]))
		switch {
		case c == nil:
			writeJSON(w, map[string]any{"code": 20003, "error": "invalid_grant"})
		case p["client_id"] != "app-id" || p["client_secret"] != "app-secret":
			writeJSON(w, map[string]any{"code": 20002, "error": "invalid_client"})
		case p["redirect_uri"] != c["redirect"]:
			writeJSON(w, map[string]any{"code": 20071, "error": "invalid_grant"})
		case base64.RawURLEncoding.EncodeToString(sum[:]) != c["challenge"]:
			writeJSON(w, map[string]any{"code": 20003, "error": "invalid_grant", "error_description": "pkce"})
		default:
			tok := "tok-" + p["code"]
			idp.mu.Lock()
			idp.codes[tok] = c
			idp.mu.Unlock()
			res := map[string]any{"access_token": tok, "token_type": "Bearer", "expires_in": 7200}
			if idp.provider != ProviderOIDC {
				res["code"] = 0
			}
			writeJSON(w, res)
		}
	})
	user := func(w http.ResponseWriter, r *http.Request) {
		idp.mu.Lock()
		c := idp.codes[strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")]
		idp.mu.Unlock()
		if c == nil {
			w.WriteHeader(http.StatusUnauthorized)
			writeJSON(w, map[string]any{"code": 99991677, "msg": "token invalid"})
			return
		}
		if idp.provider == ProviderOIDC {
			writeJSON(w, c["claims"])
			return
		}
		writeJSON(w, map[string]any{"code": 0, "msg": "success", "data": c["claims"]})
	}
	mux.HandleFunc("GET /userinfo", user)
	mux.HandleFunc("GET /open-apis/authen/v1/user_info", user)
	idp.srv = httptest.NewServer(mux)
	t.Cleanup(idp.srv.Close)
	return idp
}

func (idp *fakeIdP) config() *OIDCConfig {
	if idp.provider == ProviderOIDC {
		return &OIDCConfig{Provider: ProviderOIDC, Issuer: idp.srv.URL, ClientID: "app-id", ClientSecret: "app-secret"}
	}
	return &OIDCConfig{Provider: idp.provider, ClientID: "app-id", ClientSecret: "app-secret",
		AuthURL: idp.srv.URL + "/authorize", TokenURL: idp.srv.URL + "/token",
		UserInfoURL: idp.srv.URL + "/open-apis/authen/v1/user_info", Scopes: "contact:user.email:readonly"}
}

// ssoLogin runs the browser side: start, provider, callback. It returns the
// console client and the page the gateway finally sent the browser to.
func (f *fixture) ssoLogin(idp *fakeIdP, claims map[string]any, redirect string) (*console, *url.URL) {
	f.t.Helper()
	idp.mu.Lock()
	idp.next = claims
	idp.mu.Unlock()
	jar, _ := cookiejar.New(nil)
	var last *url.URL
	client := &http.Client{Jar: jar, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		last = req.URL
		if strings.HasPrefix(req.URL.String(), f.srv.URL) && !strings.HasPrefix(req.URL.Path, "/v1/") {
			return http.ErrUseLastResponse // back on the console
		}
		return nil
	}}
	res, err := client.Get(f.srv.URL + "/v1/api/auth/oidc/start?redirect=" + url.QueryEscape(redirect))
	if err != nil {
		f.t.Fatal(err)
	}
	res.Body.Close()
	return &console{t: f.t, base: f.srv.URL + "/v1/api", client: client}, last
}

func setupSSO(t *testing.T, idp *fakeIdP, edit func(*OIDCConfig)) *fixture {
	cfg := idp.config()
	if edit != nil {
		edit(cfg)
	}
	return setupConfig(t, "", Config{OIDC: cfg})
}

func TestSSOFeishuCreatesAndLinks(t *testing.T) {
	idp := newFakeIdP(t, ProviderFeishu)
	f := setupSSO(t, idp, nil)

	code, cfg := f.login("owner@test", "password1").do("GET", "/config", nil)
	if sso, _ := cfg["sso"].(map[string]any); code != 200 || sso["provider"] != "feishu" || sso["defaultRole"] != "member" {
		t.Fatalf("config: %d %v", code, cfg)
	}

	// A first sign-in creates a member, with the enterprise email.
	alice := map[string]any{"open_id": "ou_alice", "union_id": "on_a", "name": "Alice", "email": "alice@gmail.com",
		"enterprise_email": "Alice@Corp.example"}
	c, to := f.ssoLogin(idp, alice, "/devices?x=1")
	if to.Path != "/devices" || to.RawQuery != "x=1" {
		t.Fatalf("landed on %v", to)
	}
	code, me := c.do("GET", "/me", nil)
	if code != 200 || me["email"] != "alice@corp.example" || me["name"] != "Alice" || me["role"] != "member" ||
		me["hasPassword"] != false || me["pending"] != false || mustJSONTest(me["sso"]) != `["feishu"]` {
		t.Fatalf("me: %d %v", code, me)
	}
	// Writes still need the CSRF header and the role.
	if code, _ := c.do("POST", "/projects", map[string]string{"name": "x"}); code != 403 {
		t.Fatalf("member created a project: %d", code)
	}

	// The next sign-in finds the same account by open_id, whatever the email.
	alice["enterprise_email"] = ""
	c2, _ := f.ssoLogin(idp, alice, "")
	if _, me2 := c2.do("GET", "/me", nil); me2["id"] != me["id"] {
		t.Fatalf("second sign-in got another account: %v", me2)
	}

	// An invited member who signs in with the provider joins with the
	// invited role, and the invite is used up.
	owner := f.login("owner@test", "password1")
	code, inv := owner.do("POST", "/members", map[string]string{"email": "bob@corp.example", "name": "Bob", "role": "admin"})
	if code != 200 {
		t.Fatalf("invite: %d %v", code, inv)
	}
	c3, _ := f.ssoLogin(idp, map[string]any{"open_id": "ou_bob", "name": "Robert", "enterprise_email": "bob@corp.example"}, "")
	_, bob := c3.do("GET", "/me", nil)
	if bob["id"] != inv["id"] || bob["role"] != "admin" || bob["pending"] != false || bob["name"] != "Bob" {
		t.Fatalf("invited member: %v", bob)
	}
	token := strings.TrimPrefix(inv["inviteUrl"].(string), f.srv.URL+"/invite/")
	if code, _ := c3.do("GET", "/invites/"+token, nil); code != 404 {
		t.Fatalf("invite still valid after sso: %d", code)
	}

	// The owner manages SSO members like the others: disabling one stops
	// the session and the next sign-in.
	_, list := owner.do("GET", "/members", nil)
	if !strings.Contains(mustJSONTest(list), `"sso":["feishu"]`) {
		t.Fatalf("members without sso: %v", list)
	}
	if code, _ := owner.do("PATCH", "/members/"+me["id"].(string), map[string]any{"disabled": true}); code != 200 {
		t.Fatalf("disable: %d", code)
	}
	if code, _ := c.do("GET", "/me", nil); code != 401 {
		t.Fatalf("disabled session: %d", code)
	}
	if _, to := f.ssoLogin(idp, alice, ""); to.Path != "/login" || to.Query().Get("sso_error") != "disabled" {
		t.Fatalf("disabled sign-in landed on %v", to)
	}
	// An SSO account has no password to sign in with.
	if code, _ := c.do("POST", "/auth/login", map[string]string{"email": "alice@corp.example", "password": ""}); code != 401 {
		t.Fatalf("password login of an sso account: %d", code)
	}

	f.s.flushAudit()
	events, _ := f.st.Audit(context.Background(), store.AuditQuery{Limit: 200})
	seen := map[string]bool{}
	for _, e := range events {
		seen[e.Action+"/"+e.Result] = true
	}
	for _, a := range []string{"member.sso_join/ok", "auth.login/ok", "auth.login_failed/denied"} {
		if !seen[a] {
			t.Errorf("audit missing %s (have %v)", a, seen)
		}
	}
}

func TestSSOFailures(t *testing.T) {
	idp := newFakeIdP(t, ProviderFeishu)
	f := setupSSO(t, idp, func(o *OIDCConfig) {
		o.InviteOnly = true
		o.AllowedDomains = []string{"@Corp.example"}
	})
	cases := []struct {
		claims map[string]any
		want   string
	}{
		{map[string]any{"open_id": "ou_x", "enterprise_email": "x@other.example"}, "not_allowed"},
		{map[string]any{"open_id": "ou_y"}, "not_allowed"}, // no email at all
		{map[string]any{"open_id": "ou_z", "email": "z@corp.example"}, "no_account"},
	}
	for _, tc := range cases {
		if _, to := f.ssoLogin(idp, tc.claims, ""); to.Path != "/login" || to.Query().Get("sso_error") != tc.want {
			t.Errorf("%v landed on %v, want %s", tc.claims, to, tc.want)
		}
	}
	idp.deny = true
	if _, to := f.ssoLogin(idp, nil, ""); to.Query().Get("sso_error") != "denied" {
		t.Errorf("denied landed on %v", to)
	}
	idp.deny = false

	// A callback without the state cookie, or with another state, is refused.
	res, err := http.Get(f.srv.URL + "/v1/api/auth/oidc/callback?code=x&state=y")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.Request.URL.Path != "/login" || res.Request.URL.Query().Get("sso_error") != "state" {
		t.Errorf("forged callback landed on %v", res.Request.URL)
	}
	// Offsite redirects are dropped.
	f.st.CreateUser(context.Background(), "ok@corp.example", "", store.RoleMember, "", "", nil)
	if _, to := f.ssoLogin(idp, map[string]any{"open_id": "ou_ok", "email": "ok@corp.example"}, "//evil.example/x"); to.Path != "/" || to.Host != strings.TrimPrefix(f.srv.URL, "http://") {
		t.Errorf("offsite redirect landed on %v", to)
	}
}

func TestSSOOpenIDConnect(t *testing.T) {
	idp := newFakeIdP(t, ProviderOIDC)
	idp.basic = true
	f := setupSSO(t, idp, func(o *OIDCConfig) { o.DefaultRole = store.RoleAdmin })
	f.st.CreateUser(context.Background(), "carol@corp.example", "Carol", store.RoleMember, hashPassword("password1"), "", nil)

	// An unverified email neither links to the member who owns it nor
	// becomes the sign-in name.
	c, _ := f.ssoLogin(idp, map[string]any{"sub": "u-1", "email": "carol@corp.example", "email_verified": false,
		"preferred_username": "mallory"}, "")
	_, me := c.do("GET", "/me", nil)
	if me["email"] != "oidc:u-1" || me["name"] != "mallory" || me["role"] != "admin" {
		t.Fatalf("unverified: %v", me)
	}
	// A verified one links, and an email-less account gets its email.
	c, _ = f.ssoLogin(idp, map[string]any{"sub": "u-2", "email": "carol@corp.example", "email_verified": true}, "")
	if _, me := c.do("GET", "/me", nil); me["name"] != "Carol" || me["role"] != "member" || me["hasPassword"] != true {
		t.Fatalf("verified: %v", me)
	}
	c, _ = f.ssoLogin(idp, map[string]any{"sub": "u-1", "email": "dave@corp.example", "email_verified": "true"}, "")
	if _, me := c.do("GET", "/me", nil); me["email"] != "dave@corp.example" {
		t.Fatalf("email upgrade: %v", me)
	}
}

func TestSSOConfigAndRedirects(t *testing.T) {
	for _, bad := range []*OIDCConfig{
		{Provider: "github", ClientID: "a", ClientSecret: "b"},
		{Provider: ProviderOIDC, ClientID: "a", ClientSecret: "b"},
		{Provider: ProviderFeishu, ClientID: "a"},
		{Provider: ProviderFeishu, ClientID: "a", ClientSecret: "b", DefaultRole: "owner"},
	} {
		if bad.validate() == nil {
			t.Errorf("%+v validated", bad)
		}
	}
	lark := &OIDCConfig{Provider: "Lark", ClientID: "a", ClientSecret: "b"}
	if err := lark.validate(); err != nil || !strings.HasPrefix(lark.AuthURL, "https://accounts.larksuite.com/") || lark.DefaultRole != "member" {
		t.Errorf("lark: %v %+v", err, lark)
	}
	for in, want := range map[string]string{"/a?b=1": "/a?b=1", "": "/", "//x.example": "/", "/\\x.example": "/",
		"https://x.example": "/", "devices": "/"} {
		if got := safeRedirect(in); got != want {
			t.Errorf("safeRedirect(%q) = %q", in, got)
		}
	}
	// Without single sign-on the endpoints don't exist and config says so.
	f := setup(t, "")
	res, _ := http.Get(f.srv.URL + "/v1/api/auth/oidc/start")
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Errorf("start without sso: %d", res.StatusCode)
	}
	if _, cfg := f.login("owner@test", "password1").do("GET", "/config", nil); cfg["sso"] != nil {
		t.Errorf("config sso = %v", cfg["sso"])
	}
}
