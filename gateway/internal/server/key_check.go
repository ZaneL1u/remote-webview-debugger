package server

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/modelcontextprotocol/go-sdk/auth"
)

// OpenID Connect has no way to ask a provider whether someone is still
// there. What it has is the refresh token: with offline_access among the
// scopes (OIDCConfig.Refresh) the gateway keeps each member's refresh token,
// sealed, and renews it; a provider refuses the refresh token of a person it
// removed or disabled (and, depending on the provider, one whose grant was
// revoked or ran out). Feishu and Lark work the same way.
//
// Every use of an API key whose owner is linked to the provider (KeyCheck)
// needs the provider to have confirmed the owner within refreshTTL; else the
// token is renewed there and then, concurrent uses sharing one renewal:
//
//   - refused: the identity is marked and its token dropped, the owner's
//     agents are detached and the key is refused, asking the owner to sign
//     in again. A new sign-in, which the provider allows only to people it
//     still vouches for, stores a new token and the keys work again. The
//     member is not disabled, since a refusal may also be a grant that ran
//     out.
//   - no answer (network, the provider's or the app's error): allowed
//     within refreshGrace of the last confirmation, else refused.
//
// Members who signed in before the gateway asked for offline_access have no
// token: their keys are refused until they sign in again. sso_sync.go renews
// the tokens of all members in the background, so unused ones stay alive.
const (
	refreshTTL   = 10 * time.Minute
	refreshGrace = 24 * time.Hour
)

type refresher struct {
	mu         sync.Mutex
	ttl, grace time.Duration
	flights    map[string]*renewal // subject -> renewal in progress
}

type renewal struct {
	done    chan struct{}
	refused bool
	err     error
}

func newRefresher() *refresher {
	return &refresher{ttl: refreshTTL, grace: refreshGrace, flights: map[string]*renewal{}}
}

// Refresh tokens are sealed with a key derived from the session secret:
// rotating it drops them all, and members sign in again.
func (s *Server) tokenAEAD() (cipher.AEAD, error) {
	k := sha256.Sum256([]byte("refresh-token|" + s.sessionSecret))
	b, err := aes.NewCipher(k[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(b)
}

func (s *Server) sealToken(tok string) (string, error) {
	a, err := s.tokenAEAD()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, a.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(a.Seal(nonce, nonce, []byte(tok), nil)), nil
}

func (s *Server) openToken(sealed string) (string, error) {
	a, err := s.tokenAEAD()
	if err != nil {
		return "", err
	}
	b, err := base64.RawURLEncoding.DecodeString(sealed)
	if err != nil || len(b) < a.NonceSize() {
		return "", errors.New("sealed refresh token: malformed")
	}
	out, err := a.Open(nil, b[:a.NonceSize()], b[a.NonceSize():], nil)
	return string(out), err
}

// keepRefreshToken stores the refresh token of a sign-in, which also clears
// an earlier refusal.
func (s *Server) keepRefreshToken(ctx context.Context, subject, email, token string) {
	sealed := ""
	if token == "" {
		s.log.Warn("single sign-on: the provider issued no refresh token although the scopes include offline_access; this member's API keys are refused (Feishu and Lark: the app needs the offline_access permission)", "email", email)
	} else {
		var err error
		if sealed, err = s.sealToken(token); err != nil {
			s.log.Error("single sign-on: sealing a refresh token failed", "err", err)
		}
	}
	if err := s.store.SetIdentityToken(ctx, s.cfg.OIDC.identityProvider(), subject, sealed); err != nil {
		s.log.Warn("single sign-on: storing a refresh token failed", "email", email, "err", err)
	}
}

// renew renews the identity's refresh token; concurrent callers share one
// renewal. refused: the provider no longer vouches for them (or there is no
// token to renew); err: no answer.
func (s *Server) renew(ctx context.Context, subject string) (refused bool, err error) {
	r := s.refresh
	r.mu.Lock()
	f := r.flights[subject]
	if f == nil {
		f = &renewal{done: make(chan struct{})}
		r.flights[subject] = f
		go func() {
			// Not the caller's context: others wait for this renewal too.
			ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
			defer cancel()
			f.refused, f.err = s.renewNow(ctx, subject)
			r.mu.Lock()
			delete(r.flights, subject)
			r.mu.Unlock()
			close(f.done)
		}()
	}
	r.mu.Unlock()
	select {
	case <-f.done:
		return f.refused, f.err
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

func (s *Server) renewNow(ctx context.Context, subject string) (refused bool, err error) {
	o := s.cfg.OIDC
	provider := o.identityProvider()
	// Read again: a renewal that just finished may have rotated the token.
	id, err := s.store.Identity(ctx, provider, subject)
	if err != nil {
		return false, err
	}
	if id.RevokedAt != 0 || id.RefreshToken == "" {
		return true, nil
	}
	token, err := s.openToken(id.RefreshToken)
	if err != nil {
		s.log.Warn("single sign-on: a stored refresh token can't be read (the session secret changed?); the member must sign in again", "subject", subject, "err", err)
		return true, nil
	}
	d, err := o.endpoints(ctx)
	if err != nil {
		return false, err
	}
	res, err := o.tokenRequest(ctx, d, map[string]string{"grant_type": "refresh_token", "refresh_token": token})
	var te *tokenError
	if errors.As(err, &te) && te.refused(o.Provider) {
		s.ssoRefused(ctx, id, te)
		return true, nil
	}
	if err != nil {
		return false, err
	}
	// Providers that rotate refresh tokens send a new one; the others keep
	// the old one valid.
	sealed := id.RefreshToken
	if res.RefreshToken != "" && res.RefreshToken != token {
		if sealed, err = s.sealToken(res.RefreshToken); err != nil {
			return false, err
		}
	}
	if err := s.store.SetIdentityToken(ctx, provider, subject, sealed); err != nil {
		// A rotated token is lost: the next renewal is refused, and the
		// member signs in again.
		s.log.Error("single sign-on: storing a renewed refresh token failed", "subject", subject, "err", err)
	}
	return false, nil
}

// ssoRefused handles the provider refusing a member's refresh token: their
// keys need a new sign-in, their agents are detached, and it is audited.
func (s *Server) ssoRefused(ctx context.Context, id *store.Identity, te *tokenError) {
	o := s.cfg.OIDC
	revoked, err := s.store.RevokeIdentity(ctx, o.identityProvider(), id.Subject)
	if err != nil {
		s.log.Warn("single sign-on: recording a refused refresh token failed", "subject", id.Subject, "err", err)
	}
	if !revoked {
		return // done meanwhile
	}
	s.dropAllAgents(ctx, id.UserID, i18n.NoteKeyOwnerSignIn)
	email := id.Subject
	if u, err := s.store.User(ctx, id.UserID); err == nil {
		email = u.Email
	}
	s.log.Info("single sign-on: the provider no longer confirms a member; their API keys need a new sign-in", "email", email, "err", te)
	detail := map[string]any{"status": te.Status}
	if te.Err != "" {
		detail["error"] = te.Err
	}
	if te.Code != 0 {
		detail["code"] = te.Code
	}
	s.recordEvent(store.AuditEvent{ActorType: "system", ActorID: o.Provider, ActorName: o.Provider, Action: "member.sso_revoked",
		Target: email, Result: "ok", Detail: detail})
}

// keyRefused is a refusal of an API key with a message for the client; the
// bearer middleware answers 401 with it.
type keyRefused string

func (e keyRefused) Error() string        { return string(e) }
func (e keyRefused) Is(target error) bool { return target == auth.ErrInvalidToken }

// checkKeyOwner refuses a key whose owner the provider no longer confirms,
// or can't confirm. Gateway keys and owners without a linked identity pass.
func (s *Server) checkKeyOwner(ctx context.Context, k *store.APIKey, r *http.Request) error {
	o := s.cfg.OIDC
	if o == nil || !o.Refresh || !o.KeyCheck || k.OwnerID == nil {
		return nil
	}
	l := s.lang(r)
	ids, err := s.store.UserIdentities(ctx, *k.OwnerID, o.identityProvider())
	if err != nil {
		s.log.Warn("key check: reading the owner's identities failed", "key", k.ID, "err", err)
		return keyRefused(l.T(i18n.MCPKeyOwnerUnverified))
	}
	for _, id := range ids {
		if id.RevokedAt != 0 || id.RefreshToken == "" {
			return keyRefused(l.T(i18n.MCPKeyOwnerSignIn))
		}
		since := time.Since(time.UnixMilli(id.VerifiedAt))
		if since < s.refresh.ttl {
			continue
		}
		refused, err := s.renew(ctx, id.Subject)
		switch {
		case err != nil && ctx.Err() != nil:
			return err // the client went away
		case refused:
			return keyRefused(l.T(i18n.MCPKeyOwnerSignIn))
		case err != nil && since < s.refresh.grace:
			s.log.Warn("key check: renewing the owner's refresh token failed; allowed, confirmed recently", "owner", k.OwnerEmail, "err", err)
		case err != nil:
			s.log.Warn("key check: couldn't confirm the key's owner with the provider; key refused", "owner", k.OwnerEmail, "err", err)
			return keyRefused(l.T(i18n.MCPKeyOwnerUnverified))
		}
	}
	return nil
}
