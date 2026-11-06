package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// Feishu and Lark tell whether someone has left the organization: every
// SyncInterval the gateway asks about each member linked to the app and
// disables those listed as resigned (or as having left the tenant), which
// also stops their API keys and ends their agent sessions. The app needs the
// contact permissions contact:contact.base:readonly and
// contact:user.employee:readonly, with a contact range covering those
// members. Anything other than an explicit "resigned" (out of range, an
// error) changes nothing.

func (s *Server) resignationLoop(ctx context.Context) {
	o := s.cfg.OIDC
	if o == nil || o.SyncInterval <= 0 || o.Provider == ProviderOIDC {
		return
	}
	t := time.NewTicker(o.SyncInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if n, err := s.syncResigned(ctx); err != nil {
				s.log.Warn("single sign-on: checking who has left failed; the app needs contact:contact.base:readonly and contact:user.employee:readonly, with a contact range covering the members", "err", err, "disabled", n)
			} else if n > 0 {
				s.log.Info("single sign-on: disabled members who have left", "count", n)
			}
		}
	}
}

// openAPI is the Open Platform's API origin (https://open.feishu.cn), taken
// from the user info endpoint.
func (o *OIDCConfig) openAPI() string {
	u, err := url.Parse(o.UserInfoURL)
	if err != nil {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

// syncResigned disables the members the provider lists as resigned and
// returns how many; err is the first lookup that failed.
func (s *Server) syncResigned(ctx context.Context) (int, error) {
	o := s.cfg.OIDC
	base := o.openAPI()
	body, _ := json.Marshal(map[string]string{"app_id": o.ClientID, "app_secret": o.ClientSecret})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/open-apis/auth/v3/tenant_access_token/internal", strings.NewReader(string(body)))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	var tok struct {
		Code  int    `json:"code"`
		Msg   string `json:"msg"`
		Token string `json:"tenant_access_token"`
	}
	if err := doJSON(req, &tok); err != nil {
		return 0, err
	}
	if tok.Code != 0 || tok.Token == "" {
		return 0, fmt.Errorf("tenant_access_token: code %d %s", tok.Code, tok.Msg)
	}
	links, err := s.store.Identities(ctx, o.identityProvider())
	if err != nil {
		return 0, err
	}
	var firstErr error
	n := 0
	for _, l := range links {
		u, err := s.store.User(ctx, l.UserID)
		if err != nil || u.Disabled {
			continue
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
		err = getJSON(ctx, base+"/open-apis/contact/v3/users/"+url.PathEscape(l.Subject)+"?user_id_type=open_id", tok.Token, &res)
		if err == nil && res.Code != 0 {
			err = fmt.Errorf("contact user %s: code %d %s", l.Subject, res.Code, res.Msg) // 41050: outside the contact range
		}
		if err != nil {
			firstErr = cmpErr(firstErr, err)
			continue
		}
		st := res.Data.User.Status
		if !st.IsResigned && !st.IsExited {
			continue
		}
		if u.Role == store.RoleOwner && s.ownerCount(ctx) <= 1 {
			s.log.Warn("single sign-on: the last owner has left the organization; not disabled", "email", u.Email)
			continue
		}
		disabled := true
		u, err = s.store.UpdateUser(ctx, u.ID, store.UserPatch{Disabled: &disabled})
		if err != nil {
			firstErr = cmpErr(firstErr, err)
			continue
		}
		s.dropMemberAgents(ctx, u) // their keys stop working (verifyKey)
		s.recordEvent(store.AuditEvent{ActorType: "system", ActorID: o.Provider, ActorName: o.Provider, Action: "member.update",
			Target: u.Email, Result: "ok", Detail: map[string]any{"role": u.Role, "disabled": true, "reason": "left_organization"}})
		n++
	}
	return n, firstErr
}

func cmpErr(first, err error) error {
	if first != nil {
		return first
	}
	return err
}
