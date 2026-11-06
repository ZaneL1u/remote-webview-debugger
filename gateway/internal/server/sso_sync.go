package server

import (
	"context"
	"net/url"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// Feishu and Lark tell whether someone has left the organization: every
// SyncInterval the gateway asks about each member linked to the app and
// disables those listed as resigned (or as having left the tenant), which
// also stops their API keys and ends their agent sessions. The app needs the
// contact permissions contact:contact.base:readonly and
// contact:user.employee:readonly, with a contact range covering those
// members. Anything other than an explicit "resigned" (out of range, an
// error) changes nothing. The same lookup also runs whenever a key is used
// (key_check.go).

func (s *Server) resignationLoop(ctx context.Context) {
	o := s.cfg.OIDC
	if o == nil || o.SyncInterval <= 0 || s.dir == nil {
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
	if _, err := s.dir.tenantToken(ctx); err != nil {
		return 0, err
	}
	links, err := s.store.Identities(ctx, s.cfg.OIDC.identityProvider())
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
		left, err := s.dir.lookup(ctx, l.Subject)
		if err != nil {
			firstErr = cmpErr(firstErr, err)
			continue
		}
		if !left {
			continue
		}
		disabled, err := s.memberLeft(ctx, u)
		if err != nil {
			firstErr = cmpErr(firstErr, err)
			continue
		}
		if disabled {
			n++
		}
	}
	return n, firstErr
}

// memberLeft disables a member the provider lists as having left the
// organization (unless they are the last owner), audits it, and detaches
// the agents of their keys, which stop working (verifyKey). disabled
// reports whether this call disabled them.
func (s *Server) memberLeft(ctx context.Context, u *store.User) (disabled bool, err error) {
	s.leaveMu.Lock()
	defer s.leaveMu.Unlock()
	u, err = s.store.User(ctx, u.ID)
	if err != nil {
		return false, err
	}
	if u.Disabled {
		return false, nil // done meanwhile
	}
	if u.Role == store.RoleOwner && s.ownerCount(ctx) <= 1 {
		s.log.Warn("single sign-on: the last owner has left the organization; not disabled", "email", u.Email)
		s.dropAllAgents(ctx, u.ID, i18n.NoteKeyOwnerLeft)
		return false, nil
	}
	on := true
	u, err = s.store.UpdateUser(ctx, u.ID, store.UserPatch{Disabled: &on})
	if err != nil {
		return false, err
	}
	s.dropAllAgents(ctx, u.ID, i18n.NoteKeyOwnerLeft)
	o := s.cfg.OIDC
	s.recordEvent(store.AuditEvent{ActorType: "system", ActorID: o.Provider, ActorName: o.Provider, Action: "member.update",
		Target: u.Email, Result: "ok", Detail: map[string]any{"role": u.Role, "disabled": true, "reason": "left_organization"}})
	return true, nil
}

// dropAllAgents detaches the agents of all of a member's keys.
func (s *Server) dropAllAgents(ctx context.Context, userID string, note i18n.Key) {
	keys, err := s.store.APIKeys(ctx, userID)
	if err != nil {
		s.log.Warn("listing a member's keys failed", "member", userID, "err", err)
		return
	}
	ids := make([]string, len(keys))
	for i, k := range keys {
		ids[i] = k.ID
	}
	s.hub.DropAgents(ids, i18n.M(note))
}

func cmpErr(first, err error) error {
	if first != nil {
		return first
	}
	return err
}
