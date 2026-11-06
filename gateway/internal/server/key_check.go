package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/modelcontextprotocol/go-sdk/auth"
)

// With single sign-on through Feishu or Lark (and KeyCheck on), every use of
// an API key whose owner is linked to the app asks the provider whether the
// owner is still employed: resigned or exited refuses the key and disables
// the member like the periodic sync (sso_sync.go); active is trusted for
// keyCheckTTL; a failed lookup is tolerated only within keyCheckGrace of the
// last one that said active.
const (
	keyCheckTTL   = time.Minute
	keyCheckGrace = 24 * time.Hour
)

// directory looks people up in the Feishu / Lark contact directory with the
// app's tenant_access_token.
type directory struct {
	o *OIDCConfig

	mu         sync.Mutex
	ttl, grace time.Duration
	token      string
	tokenUntil time.Time
	active     map[string]time.Time // open_id -> last lookup that said active
	flights    map[string]*flight   // lookups in progress, shared by concurrent callers
}

type flight struct {
	done chan struct{}
	left bool
	err  error
}

func newDirectory(o *OIDCConfig) *directory {
	if o == nil || (o.Provider != ProviderFeishu && o.Provider != ProviderLark) {
		return nil
	}
	return &directory{o: o, ttl: keyCheckTTL, grace: keyCheckGrace, active: map[string]time.Time{}, flights: map[string]*flight{}}
}

// tenantToken returns the app's tenant_access_token, cached until shortly
// before it expires.
func (d *directory) tenantToken(ctx context.Context) (string, error) {
	d.mu.Lock()
	if d.token != "" && time.Now().Before(d.tokenUntil) {
		defer d.mu.Unlock()
		return d.token, nil
	}
	d.mu.Unlock()
	body, _ := json.Marshal(map[string]string{"app_id": d.o.ClientID, "app_secret": d.o.ClientSecret})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.o.openAPI()+"/open-apis/auth/v3/tenant_access_token/internal", strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	var tok struct {
		Code   int    `json:"code"`
		Msg    string `json:"msg"`
		Token  string `json:"tenant_access_token"`
		Expire int    `json:"expire"` // seconds
	}
	if err := doJSON(req, &tok); err != nil {
		return "", err
	}
	if tok.Code != 0 || tok.Token == "" {
		return "", fmt.Errorf("tenant_access_token: code %d %s", tok.Code, tok.Msg)
	}
	life := time.Duration(tok.Expire) * time.Second
	life -= min(5*time.Minute, life/2) // renew early
	d.mu.Lock()
	d.token, d.tokenUntil = tok.Token, time.Now().Add(life)
	d.mu.Unlock()
	return tok.Token, nil
}

// lookup asks the provider whether the person has left the organization
// (resigned, or exited the tenant). err: the lookup failed (network, or a
// code such as 41050, outside the app's contact range).
func (d *directory) lookup(ctx context.Context, openID string) (left bool, err error) {
	token, err := d.tenantToken(ctx)
	if err != nil {
		return false, err
	}
	var res struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			User struct {
				Status struct {
					IsResigned bool `json:"is_resigned"`
					IsExited   bool `json:"is_exited"`
				} `json:"status"`
			} `json:"user"`
		} `json:"data"`
	}
	err = getJSON(ctx, d.o.openAPI()+"/open-apis/contact/v3/users/"+url.PathEscape(openID)+"?user_id_type=open_id", token, &res)
	if err == nil && res.Code != 0 {
		err = fmt.Errorf("contact user %s: code %d %s", openID, res.Code, res.Msg) // 41050: outside the contact range
	}
	if err != nil {
		if s := err.Error(); strings.Contains(s, "99991663") || strings.Contains(s, "99991661") || strings.Contains(s, "99991668") {
			d.mu.Lock()
			d.token = "" // invalid or expired token: fetch a new one next time
			d.mu.Unlock()
		}
		return false, err
	}
	st := res.Data.User.Status
	left = st.IsResigned || st.IsExited
	d.mu.Lock()
	if left {
		delete(d.active, openID)
	} else {
		d.active[openID] = time.Now()
	}
	d.mu.Unlock()
	return left, nil
}

// status is lookup with an "active" answer trusted for ttl and concurrent
// lookups of one person shared. recent: a failed lookup is excused, because
// the last successful one (within grace) said active.
func (d *directory) status(ctx context.Context, openID string) (left, recent bool, err error) {
	d.mu.Lock()
	seen, ok := d.active[openID]
	if ok && time.Since(seen) < d.ttl {
		d.mu.Unlock()
		return false, true, nil
	}
	f := d.flights[openID]
	if f == nil {
		f = &flight{done: make(chan struct{})}
		d.flights[openID] = f
		go func() {
			// Not the caller's context: others wait for this lookup too.
			ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
			defer cancel()
			f.left, f.err = d.lookup(ctx, openID)
			d.mu.Lock()
			delete(d.flights, openID)
			d.mu.Unlock()
			close(f.done)
		}()
	}
	d.mu.Unlock()
	select {
	case <-f.done:
	case <-ctx.Done():
		return false, false, ctx.Err()
	}
	if f.err != nil {
		d.mu.Lock()
		seen, ok := d.active[openID]
		recent = ok && time.Since(seen) < d.grace
		d.mu.Unlock()
		return false, recent, f.err
	}
	return f.left, false, nil
}

// keyRefused is a refusal of an API key with a message for the client; the
// bearer middleware answers 401 with it.
type keyRefused string

func (e keyRefused) Error() string        { return string(e) }
func (e keyRefused) Is(target error) bool { return target == auth.ErrInvalidToken }

// checkKeyOwner refuses a key whose owner, linked to the Feishu / Lark app,
// has left the organization (and disables the owner), or whose employment
// can't be confirmed. Gateway keys and owners without a linked identity
// pass.
func (s *Server) checkKeyOwner(ctx context.Context, k *store.APIKey, r *http.Request) error {
	if s.dir == nil || !s.cfg.OIDC.KeyCheck || k.OwnerID == nil {
		return nil
	}
	l := s.lang(r)
	subjects, err := s.store.IdentitySubjects(ctx, *k.OwnerID, s.cfg.OIDC.identityProvider())
	if err != nil {
		s.log.Warn("key check: reading the owner's identities failed", "key", k.ID, "err", err)
		return keyRefused(l.T(i18n.MCPKeyOwnerUnverified))
	}
	for _, sub := range subjects {
		left, recent, err := s.dir.status(ctx, sub)
		switch {
		case err != nil && ctx.Err() != nil:
			return err // the client went away
		case err != nil && recent:
			s.log.Warn("key check: looking up the key's owner failed; allowed, active at the last lookup", "owner", k.OwnerEmail, "err", err)
		case err != nil:
			s.log.Warn("key check: couldn't confirm the key's owner is still employed; key refused. The app needs contact:contact.base:readonly and contact:user.employee:readonly, with a contact range covering the members", "owner", k.OwnerEmail, "err", err)
			return keyRefused(l.T(i18n.MCPKeyOwnerUnverified))
		case left:
			if u, err := s.store.User(ctx, *k.OwnerID); err == nil {
				if _, err := s.memberLeft(ctx, u); err != nil {
					s.log.Warn("key check: disabling a member who has left failed", "email", u.Email, "err", err)
				}
			}
			return keyRefused(l.T(i18n.MCPKeyOwnerLeft))
		}
	}
	return nil
}
