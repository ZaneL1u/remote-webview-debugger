package server

import (
	"context"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
)

// Every SyncInterval the gateway renews the refresh tokens of the members
// linked to the provider (key_check.go explains why), those not confirmed
// in the last half interval. That keeps tokens alive that would run out
// unused (Feishu's last 7 days), and a refusal ends the member's agents and
// their keys' use before anyone tries one.

func (s *Server) refreshLoop(ctx context.Context) {
	o := s.cfg.OIDC
	if o == nil || !o.Refresh || o.SyncInterval <= 0 {
		return
	}
	t := time.NewTicker(o.SyncInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if n, err := s.renewAll(ctx, o.SyncInterval/2); err != nil {
				s.log.Warn("single sign-on: renewing refresh tokens failed", "err", err, "refused", n)
			} else if n > 0 {
				s.log.Info("single sign-on: the provider no longer confirms some members", "count", n)
			}
		}
	}
}

// renewAll renews the tokens of the enabled members not confirmed within
// minAge and returns how many the provider refused; err is the first renewal
// that got no answer.
func (s *Server) renewAll(ctx context.Context, minAge time.Duration) (int, error) {
	links, err := s.store.Identities(ctx, s.cfg.OIDC.identityProvider())
	if err != nil {
		return 0, err
	}
	var firstErr error
	n := 0
	for _, l := range links {
		if l.RevokedAt != 0 || l.RefreshToken == "" || time.Since(time.UnixMilli(l.VerifiedAt)) < minAge {
			continue
		}
		if u, err := s.store.User(ctx, l.UserID); err != nil || u.Disabled {
			continue
		}
		refused, err := s.renew(ctx, l.Subject)
		switch {
		case err != nil && firstErr == nil:
			firstErr = err
		case refused:
			n++
		}
	}
	return n, firstErr
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
