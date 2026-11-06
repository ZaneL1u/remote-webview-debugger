package server

import (
	"cmp"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// Single sign-on providers.
const (
	// ProviderOIDC is any OpenID Connect provider (Keycloak, Okta, Google,
	// Microsoft Entra ID, Authing, …): discovery from the issuer, form-encoded
	// token request, user from the userinfo endpoint.
	ProviderOIDC = "oidc"
	// ProviderFeishu / ProviderLark are the web-app sign-in of the Feishu and
	// Lark Open Platforms. It is OAuth 2.0 but not OpenID Connect: no
	// discovery, a JSON token request, the user wrapped in {"code":0,"data":…}.
	ProviderFeishu = "feishu"
	ProviderLark   = "lark"
)

// OIDCConfig turns on single sign-on with one provider (RWD_OIDC_*), next to
// email and password sign-in.
type OIDCConfig struct {
	Provider string // ProviderOIDC, ProviderFeishu or ProviderLark
	// Name labels the console's button ("Sign in with <Name>"); empty: the
	// provider's name in the console language.
	Name string
	// Issuer is the OpenID Connect issuer, read for discovery (oidc only).
	Issuer string
	// AuthURL, TokenURL and UserInfoURL override the provider's endpoints.
	AuthURL, TokenURL, UserInfoURL string
	ClientID, ClientSecret         string
	// Scopes, space separated. Default: "openid profile email" for oidc, none
	// for Feishu and Lark (add contact:user.email:readonly to get emails).
	Scopes string
	// DefaultRole of accounts created at a first sign-in: member or admin.
	DefaultRole string
	// InviteOnly: no accounts are created; a first sign-in must match the
	// email of an existing (or invited) member.
	InviteOnly bool
	// AllowedDomains, if set, are the only email domains that may sign in.
	AllowedDomains []string
	// TrustEmail (oidc only) trusts the email of providers that don't send
	// email_verified, such as Microsoft Entra ID. Without it only emails
	// with email_verified true are used.
	TrustEmail bool
	// Tenant (feishu and lark only), if set, is the only organization
	// (tenant_key) whose people may sign in: a store app, or a custom app
	// shared with connected organizations, lets others in too.
	Tenant string
	// SyncInterval, for Feishu and Lark, is how often members who have left
	// the organization are disabled (sso_sync.go); 0: never.
	SyncInterval time.Duration
	// KeyCheck, for Feishu and Lark, asks the provider on every use of an
	// API key whose owner is linked to the app whether the owner is still
	// employed (key_check.go).
	KeyCheck bool

	mu        sync.Mutex
	discovery *oidcDiscovery
	retryAt   time.Time // after a failed discovery
	lastErr   error
}

type oidcDiscovery struct {
	Issuer                string   `json:"issuer"`
	AuthorizationEndpoint string   `json:"authorization_endpoint"`
	TokenEndpoint         string   `json:"token_endpoint"`
	UserinfoEndpoint      string   `json:"userinfo_endpoint"`
	TokenAuthMethods      []string `json:"token_endpoint_auth_methods_supported"`
}

// validate fills defaults and reports configuration mistakes at startup.
func (o *OIDCConfig) validate() error {
	o.Provider = strings.ToLower(strings.TrimSpace(o.Provider))
	switch o.Provider {
	case ProviderFeishu, ProviderLark:
		host := map[string]string{ProviderFeishu: "feishu.cn", ProviderLark: "larksuite.com"}[o.Provider]
		if o.AuthURL == "" {
			o.AuthURL = "https://accounts." + host + "/open-apis/authen/v1/authorize"
		}
		if o.TokenURL == "" {
			o.TokenURL = "https://open." + host + "/open-apis/authen/v2/oauth/token"
		}
		if o.UserInfoURL == "" {
			o.UserInfoURL = "https://open." + host + "/open-apis/authen/v1/user_info"
		}
	case ProviderOIDC:
		if o.Issuer == "" && (o.AuthURL == "" || o.TokenURL == "" || o.UserInfoURL == "") {
			return errors.New("RWD_OIDC_ISSUER is required (or all of RWD_OIDC_AUTH_URL, RWD_OIDC_TOKEN_URL and RWD_OIDC_USERINFO_URL)")
		}
		if o.Scopes == "" {
			o.Scopes = "openid profile email"
		}
	default:
		return fmt.Errorf("unknown RWD_OIDC_PROVIDER %q (want oidc, feishu or lark)", o.Provider)
	}
	o.Tenant = strings.TrimSpace(o.Tenant)
	if o.Tenant != "" && o.Provider == ProviderOIDC {
		return errors.New("RWD_OIDC_TENANT is for feishu and lark only")
	}
	if o.ClientID == "" || o.ClientSecret == "" {
		return errors.New("RWD_OIDC_CLIENT_ID and RWD_OIDC_CLIENT_SECRET are required")
	}
	switch o.DefaultRole {
	case "":
		o.DefaultRole = store.RoleMember
	case store.RoleMember, store.RoleAdmin:
	default:
		return fmt.Errorf("RWD_OIDC_DEFAULT_ROLE must be member or admin, not %q", o.DefaultRole)
	}
	for i, d := range o.AllowedDomains {
		o.AllowedDomains[i] = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(d), "@"))
	}
	o.AllowedDomains = slices.DeleteFunc(o.AllowedDomains, func(d string) bool { return d == "" })
	return nil
}

// identityProvider keys linked identities: the provider plus the issuer for
// OpenID Connect, since subjects are only unique per issuer, or plus the App
// ID for Feishu and Lark, whose open_id belongs to one app (with another app,
// members are linked again by email).
func (o *OIDCConfig) identityProvider() string {
	if o.Provider != ProviderOIDC {
		return o.Provider + ":" + o.ClientID
	}
	if o.Issuer != "" {
		return ProviderOIDC + ":" + strings.TrimRight(o.Issuer, "/")
	}
	return ProviderOIDC + ":" + o.AuthURL
}

var oidcHTTP = &http.Client{Timeout: 10 * time.Second}

// endpoints are the configured ones, else discovered (once, on first use, so
// the gateway starts while the provider is unreachable).
// A failed discovery is retried after 30 seconds, not on every request, and
// the lock is not held during the request.
func (o *OIDCConfig) endpoints(ctx context.Context) (*oidcDiscovery, error) {
	o.mu.Lock()
	if o.discovery != nil || time.Now().Before(o.retryAt) {
		d, err := o.discovery, o.lastErr
		o.mu.Unlock()
		return d, err
	}
	o.mu.Unlock()
	d, err := o.discover(ctx)
	o.mu.Lock()
	defer o.mu.Unlock()
	if err != nil {
		o.lastErr, o.retryAt = err, time.Now().Add(30*time.Second)
		return nil, err
	}
	o.discovery, o.lastErr = d, nil
	return d, nil
}

func (o *OIDCConfig) discover(ctx context.Context) (*oidcDiscovery, error) {
	d := &oidcDiscovery{AuthorizationEndpoint: o.AuthURL, TokenEndpoint: o.TokenURL, UserinfoEndpoint: o.UserInfoURL}
	if o.Provider == ProviderOIDC && o.Issuer != "" {
		var found oidcDiscovery
		u := strings.TrimRight(o.Issuer, "/") + "/.well-known/openid-configuration"
		if err := getJSON(ctx, u, "", &found); err != nil {
			return nil, fmt.Errorf("discovery: %w", err)
		}
		d.TokenAuthMethods = found.TokenAuthMethods
		if d.TokenAuthMethods == nil {
			d.TokenAuthMethods = []string{"client_secret_basic"} // the spec's default
		}
		d.AuthorizationEndpoint = cmp.Or(d.AuthorizationEndpoint, found.AuthorizationEndpoint)
		d.TokenEndpoint = cmp.Or(d.TokenEndpoint, found.TokenEndpoint)
		d.UserinfoEndpoint = cmp.Or(d.UserinfoEndpoint, found.UserinfoEndpoint)
		if d.AuthorizationEndpoint == "" || d.TokenEndpoint == "" || d.UserinfoEndpoint == "" {
			return nil, errors.New("discovery: the provider lists no authorization, token or userinfo endpoint")
		}
	}
	return d, nil
}

func getJSON(ctx context.Context, u, bearer string, v any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	return doJSON(req, v)
}

func doJSON(req *http.Request, v any) error {
	res, err := oidcHTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if res.StatusCode/100 != 2 {
		return fmt.Errorf("%s: HTTP %d: %.300s", req.URL.Redacted(), res.StatusCode, body)
	}
	if err := json.Unmarshal(body, v); err != nil {
		return fmt.Errorf("%s: %w", req.URL.Redacted(), err)
	}
	return nil
}

// oidcState is what the browser carries from the start to the callback, in
// a signed, short-lived cookie scoped to the callback path.
type oidcState struct {
	State    string `json:"s"`
	Verifier string `json:"v"` // PKCE
	Redirect string `json:"r"`
	Exp      int64  `json:"e"`
}

const (
	oidcCookie   = "rwd_oidc"
	oidcPath     = "/v1/api/auth/oidc"
	oidcStateTTL = 10 * time.Minute
)

func (s *Server) oidcMAC(payload string) string {
	m := hmac.New(sha256.New, []byte(s.sessionSecret))
	m.Write([]byte("oidc|" + payload))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (s *Server) signOIDCState(st oidcState) string {
	b, _ := json.Marshal(st)
	payload := base64.RawURLEncoding.EncodeToString(b)
	return payload + "." + s.oidcMAC(payload)
}

func (s *Server) readOIDCState(r *http.Request) (*oidcState, bool) {
	c, err := r.Cookie(oidcCookie)
	if err != nil {
		return nil, false
	}
	payload, mac, _ := strings.Cut(c.Value, ".")
	if !hmac.Equal([]byte(mac), []byte(s.oidcMAC(payload))) {
		return nil, false
	}
	b, err := base64.RawURLEncoding.DecodeString(payload)
	var st oidcState
	if err != nil || json.Unmarshal(b, &st) != nil || time.Now().Unix() > st.Exp {
		return nil, false
	}
	return &st, true
}

// safeRedirect keeps the post-login destination on the console: a path, not
// "//host" or a URL. Browsers drop tabs and newlines from URLs and read \ as
// /, so "/\t/host" or "/\\host" would leave the site: control characters and
// backslashes are refused, and the path is parsed and written out again.
func safeRedirect(p string) string {
	if strings.ContainsFunc(p, func(c rune) bool { return c < 0x20 || c == 0x7f || c == '\\' }) {
		return "/"
	}
	u, err := url.Parse(p)
	if err != nil || u.Scheme != "" || u.Host != "" || u.User != nil || !strings.HasPrefix(u.Path, "/") || strings.HasPrefix(u.Path, "//") {
		return "/"
	}
	out := u.EscapedPath()
	if strings.HasPrefix(out, "//") || strings.HasPrefix(out, "/\\") {
		return "/"
	}
	if u.RawQuery != "" {
		out += "?" + u.RawQuery
	}
	if u.Fragment != "" {
		out += "#" + u.EscapedFragment()
	}
	return out
}

func (s *Server) oidcCallbackURL(r *http.Request) string {
	return s.origin(r) + oidcPath + "/callback"
}

// oidcStart sends the browser to the provider (GET /v1/api/auth/oidc/start).
func (s *Server) oidcStart(w http.ResponseWriter, r *http.Request) {
	o := s.cfg.OIDC
	if o == nil {
		s.fail(w, r, http.StatusNotFound, "not_found", i18n.APINotFound)
		return
	}
	if !s.ssoLimit.allow(s.clientIP(r)) {
		s.ssoFailed(w, r, "rate_limited", "", nil)
		return
	}
	d, err := o.endpoints(r.Context())
	if err != nil {
		s.log.Error("single sign-on: provider unavailable", "err", err)
		s.ssoFailed(w, r, "provider", "", err)
		return
	}
	st := oidcState{State: ids.Secret(24), Verifier: ids.Secret(48), Redirect: safeRedirect(r.URL.Query().Get("redirect")),
		Exp: time.Now().Add(oidcStateTTL).Unix()}
	http.SetCookie(w, &http.Cookie{Name: oidcCookie, Value: s.signOIDCState(st), Path: oidcPath, HttpOnly: true,
		Secure: s.isHTTPS(r), SameSite: http.SameSiteLaxMode, MaxAge: int(oidcStateTTL.Seconds())})
	challenge := sha256.Sum256([]byte(st.Verifier))
	q := url.Values{
		"client_id":             {o.ClientID},
		"response_type":         {"code"},
		"redirect_uri":          {s.oidcCallbackURL(r)},
		"state":                 {st.State},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(challenge[:])},
		"code_challenge_method": {"S256"},
	}
	if o.Scopes != "" {
		q.Set("scope", o.Scopes)
	}
	sep := "?"
	if strings.Contains(d.AuthorizationEndpoint, "?") {
		sep = "&"
	}
	w.Header().Set("Cache-Control", "no-store")
	// %20, not +, between scopes: Feishu's own examples use it (a literal + is %2B).
	http.Redirect(w, r, d.AuthorizationEndpoint+sep+strings.ReplaceAll(q.Encode(), "+", "%20"), http.StatusFound)
}

// ssoFailed records the failure and sends the browser to the login page,
// which explains `code` in its language: provider, denied, state,
// not_allowed, tenant, no_account, conflict, disabled, rate_limited.
func (s *Server) ssoFailed(w http.ResponseWriter, r *http.Request, code, who string, err error) {
	detail := map[string]any{"ip": s.clientIP(r), "method": "sso", "reason": code}
	if err != nil {
		// Partly the provider's (or a visitor's) text: keep it short.
		msg := []rune(err.Error())
		detail["error"] = string(msg[:min(len(msg), 200)])
	}
	if who == "" {
		who = "sso"
	}
	s.recordEvent(store.AuditEvent{ActorType: "member", ActorID: who, ActorName: who, Action: "auth.login_failed",
		Target: who, Result: "denied", Detail: detail})
	http.SetCookie(w, &http.Cookie{Name: oidcCookie, Value: "", Path: oidcPath, HttpOnly: true, Secure: s.isHTTPS(r),
		SameSite: http.SameSiteLaxMode, MaxAge: -1})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, "/login?sso_error="+code, http.StatusFound)
}

// ssoUser is who the provider says signed in.
type ssoUser struct {
	Subject, Email, Name string
	Tenant               string // Feishu / Lark tenant_key
}

// oidcCallback finishes the sign-in (GET /v1/api/auth/oidc/callback).
func (s *Server) oidcCallback(w http.ResponseWriter, r *http.Request) {
	o := s.cfg.OIDC
	if o == nil {
		s.fail(w, r, http.StatusNotFound, "not_found", i18n.APINotFound)
		return
	}
	if !s.ssoLimit.allow(s.clientIP(r)) {
		s.ssoFailed(w, r, "rate_limited", "", nil)
		return
	}
	q := r.URL.Query()
	st, ok := s.readOIDCState(r)
	if !ok || q.Get("state") == "" || !hmac.Equal([]byte(q.Get("state")), []byte(st.State)) {
		s.ssoFailed(w, r, "state", "", nil)
		return
	}
	if e := q.Get("error"); e != "" || q.Get("code") == "" {
		s.ssoFailed(w, r, "denied", "", fmt.Errorf("%s %s", e, q.Get("error_description")))
		return
	}
	d, err := o.endpoints(r.Context())
	if err != nil {
		s.ssoFailed(w, r, "provider", "", err)
		return
	}
	token, err := s.oidcExchange(r.Context(), d, q.Get("code"), st.Verifier, s.oidcCallbackURL(r))
	if err != nil {
		s.log.Warn("single sign-on: token request failed", "err", err)
		s.ssoFailed(w, r, "provider", "", err)
		return
	}
	who, err := o.userInfo(r.Context(), d, token)
	if err != nil {
		s.log.Warn("single sign-on: user info failed", "err", err)
		s.ssoFailed(w, r, "provider", "", err)
		return
	}
	label := cmp.Or(who.Email, o.Provider+":"+who.Subject)
	if o.Tenant != "" && who.Tenant != o.Tenant {
		s.ssoFailed(w, r, "tenant", label, fmt.Errorf("tenant_key %q is not RWD_OIDC_TENANT", who.Tenant))
		return
	}
	if len(o.AllowedDomains) > 0 {
		_, domain, _ := strings.Cut(who.Email, "@")
		if !slices.Contains(o.AllowedDomains, domain) {
			s.ssoFailed(w, r, "not_allowed", label, nil)
			return
		}
	}
	u, created, err := s.ssoAccount(r.Context(), who)
	switch {
	case errors.Is(err, errNoAccount):
		s.ssoFailed(w, r, "no_account", label, nil)
		return
	case errors.Is(err, errLinkedElsewhere):
		s.ssoFailed(w, r, "conflict", label, nil)
		return
	case err != nil:
		s.ssoFailed(w, r, "provider", label, err)
		return
	case u.Disabled:
		s.ssoFailed(w, r, "disabled", u.Email, nil)
		return
	}
	if created {
		s.recordEvent(store.AuditEvent{ActorType: "member", ActorID: u.ID, ActorName: u.Email, Action: "member.sso_join",
			Target: u.Email, Result: "ok", Detail: map[string]any{"role": u.Role, "provider": o.Provider}})
	}
	s.store.TouchLogin(r.Context(), u.ID)
	s.setSession(w, r, u.ID)
	detail := map[string]any{"ip": s.clientIP(r), "method": "sso", "provider": o.Provider}
	if who.Tenant != "" {
		detail["tenant"] = who.Tenant // the value for RWD_OIDC_TENANT
	}
	s.recordEvent(store.AuditEvent{ActorType: "member", ActorID: u.ID, ActorName: u.Email, Action: "auth.login",
		Target: u.Email, Result: "ok", Detail: detail})
	http.SetCookie(w, &http.Cookie{Name: oidcCookie, Value: "", Path: oidcPath, HttpOnly: true, Secure: s.isHTTPS(r),
		SameSite: http.SameSiteLaxMode, MaxAge: -1})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, st.Redirect, http.StatusFound)
}

var (
	errNoAccount       = errors.New("no account for this identity")
	errLinkedElsewhere = errors.New("the account with this email is linked to another identity of the provider")
)

// ssoAccount finds or creates the account of who: the account linked to the
// identity, else the member with the same email (linked now, which also
// accepts a pending invite; not when that account already has another
// identity of this provider, nor when it is disabled), else a new account
// with the default role unless the gateway is invite-only.
func (s *Server) ssoAccount(ctx context.Context, who *ssoUser) (*store.User, bool, error) {
	o := s.cfg.OIDC
	provider := o.identityProvider()
	u, err := s.store.UserByIdentity(ctx, provider, who.Subject)
	if err == nil {
		// Accounts created without an email get it once the provider shares it.
		if who.Email != "" && strings.HasPrefix(u.Email, o.Provider+":") {
			if s.store.SetEmail(ctx, u.ID, who.Email) == nil {
				u.Email = store.NormEmail(who.Email)
			}
		}
		return u, false, nil
	}
	if !errors.Is(err, store.ErrNotFound) {
		return nil, false, err
	}
	if who.Email != "" {
		u, err := s.store.UserByEmail(ctx, who.Email)
		if err == nil {
			if u.Disabled {
				return u, false, nil // refused by the caller, invite left alone
			}
			// A reassigned email must not hand over the account of the
			// person who had it.
			if linked, err := s.store.HasIdentity(ctx, u.ID, provider); err != nil || linked {
				return nil, false, cmp.Or(err, errLinkedElsewhere)
			}
			if err := s.store.LinkIdentity(ctx, u.ID, provider, who.Subject); err != nil {
				return nil, false, err
			}
			if u.Name == "" && who.Name != "" {
				name := who.Name
				if u, err = s.store.UpdateUser(ctx, u.ID, store.UserPatch{Name: &name}); err != nil {
					return nil, false, err
				}
			}
			u.Pending = false
			return u, false, nil
		}
		if !errors.Is(err, store.ErrNotFound) {
			return nil, false, err
		}
	}
	if o.InviteOnly {
		return nil, false, errNoAccount
	}
	// Without an email the sign-in name is "<provider>:<subject>", which no
	// password sign-in can match.
	email := cmp.Or(who.Email, o.Provider+":"+who.Subject)
	u, err = s.store.CreateUser(ctx, email, who.Name, o.DefaultRole, "", "", nil)
	if err == nil {
		if err = s.store.LinkIdentity(ctx, u.ID, provider, who.Subject); err != nil {
			_ = s.store.DeleteUser(ctx, u.ID)
		}
	}
	if errors.Is(err, store.ErrConflict) {
		// The same identity's first sign-in, finishing in another tab.
		u, err := s.store.UserByIdentity(ctx, provider, who.Subject)
		return u, false, err
	}
	if err != nil {
		return nil, false, err
	}
	return u, true, nil
}

// oidcExchange trades the authorization code for an access token.
func (s *Server) oidcExchange(ctx context.Context, d *oidcDiscovery, code, verifier, redirectURI string) (string, error) {
	o := s.cfg.OIDC
	var req *http.Request
	var err error
	if o.Provider == ProviderOIDC {
		form := url.Values{"grant_type": {"authorization_code"}, "code": {code}, "redirect_uri": {redirectURI},
			"code_verifier": {verifier}}
		// client_secret_basic when the provider supports it (or says nothing,
		// the spec's default), else client_secret_post.
		basic := d.TokenAuthMethods != nil && slices.Contains(d.TokenAuthMethods, "client_secret_basic")
		if !basic {
			form.Set("client_id", o.ClientID)
			form.Set("client_secret", o.ClientSecret)
		}
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, d.TokenEndpoint, strings.NewReader(form.Encode()))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		if basic {
			req.SetBasicAuth(url.QueryEscape(o.ClientID), url.QueryEscape(o.ClientSecret))
		}
	} else {
		body, _ := json.Marshal(map[string]string{"grant_type": "authorization_code", "client_id": o.ClientID,
			"client_secret": o.ClientSecret, "code": code, "redirect_uri": redirectURI, "code_verifier": verifier})
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, d.TokenEndpoint, strings.NewReader(string(body)))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
	}
	req.Header.Set("Accept", "application/json")
	var res struct {
		Code        *int   `json:"code"` // Feishu / Lark: 0 on success
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := doJSON(req, &res); err != nil {
		return "", err
	}
	if (res.Code != nil && *res.Code != 0) || res.AccessToken == "" {
		return "", fmt.Errorf("token endpoint: %s %s", res.Error, res.Description)
	}
	return res.AccessToken, nil
}

// userInfo reads who signed in. The id_token is not used: the user comes from
// the userinfo endpoint, over TLS, with the access token just issued to us.
func (o *OIDCConfig) userInfo(ctx context.Context, d *oidcDiscovery, token string) (*ssoUser, error) {
	if o.Provider == ProviderOIDC {
		var c struct {
			Sub               string `json:"sub"`
			Email             string `json:"email"`
			EmailVerified     any    `json:"email_verified"` // bool, or "true"/"false" from some providers
			Name              string `json:"name"`
			PreferredUsername string `json:"preferred_username"`
		}
		if err := getJSON(ctx, d.UserinfoEndpoint, token, &c); err != nil {
			return nil, err
		}
		if c.Sub == "" {
			return nil, errors.New("userinfo: no sub")
		}
		who := &ssoUser{Subject: c.Sub, Email: store.NormEmail(c.Email), Name: cmp.Or(c.Name, c.PreferredUsername)}
		// The email links the identity to the member who has it (an owner
		// too), so only a verified one counts: email_verified true, or any
		// with RWD_OIDC_TRUST_EMAIL=1. Providers such as Entra ID don't send
		// it and let tenant admins set any email.
		if v := fmt.Sprint(c.EmailVerified); v != "true" && !(o.TrustEmail && v != "false") {
			who.Email = ""
		}
		if !emailRe.MatchString(who.Email) {
			who.Email = ""
		}
		return who, nil
	}
	var res struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			OpenID          string `json:"open_id"`
			Name            string `json:"name"`
			EnName          string `json:"en_name"`
			Email           string `json:"email"`
			EnterpriseEmail string `json:"enterprise_email"`
			TenantKey       string `json:"tenant_key"`
		} `json:"data"`
	}
	if err := getJSON(ctx, d.UserinfoEndpoint, token, &res); err != nil {
		return nil, err
	}
	if res.Code != 0 || res.Data.OpenID == "" {
		return nil, fmt.Errorf("user_info: code %d %s", res.Code, res.Msg)
	}
	// Trusted as the tenant's: a custom app (企业自建应用) only lets the
	// tenant's own people sign in, and their emails are the tenant's;
	// RWD_OIDC_TENANT keeps out everyone else's when the app reaches further.
	who := &ssoUser{Subject: res.Data.OpenID, Email: store.NormEmail(cmp.Or(res.Data.EnterpriseEmail, res.Data.Email)),
		Name: cmp.Or(res.Data.Name, res.Data.EnName), Tenant: res.Data.TenantKey}
	if !emailRe.MatchString(who.Email) {
		who.Email = ""
	}
	return who, nil
}

// ssoConfig is the public part of the settings, for the login page.
func (s *Server) ssoConfig() map[string]any {
	o := s.cfg.OIDC
	if o == nil {
		return nil
	}
	return map[string]any{"provider": o.Provider, "name": o.Name, "defaultRole": o.DefaultRole, "inviteOnly": o.InviteOnly}
}
