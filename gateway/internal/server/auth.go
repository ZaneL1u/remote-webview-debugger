package server

import (
	"context"
	"crypto/hmac"
	"crypto/pbkdf2"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

const (
	sessionCookie = "rwd_session"
	sessionTTL    = 12 * time.Hour
	pbkdfIter     = 210_000
)

// hashPassword returns "pbkdf2$<iter>$<salt>$<hash>".
func hashPassword(pw string) string {
	salt := ids.Secret(16)
	key, _ := pbkdf2.Key(sha256.New, pw, []byte(salt), pbkdfIter, 32)
	return fmt.Sprintf("pbkdf2$%d$%s$%s", pbkdfIter, salt, hex.EncodeToString(key))
}

func checkPassword(stored, pw string) bool {
	parts := strings.Split(stored, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2" {
		return false
	}
	iter, err := strconv.Atoi(parts[1])
	if err != nil {
		return false
	}
	want, err := hex.DecodeString(parts[3])
	if err != nil {
		return false
	}
	got, _ := pbkdf2.Key(sha256.New, pw, []byte(parts[2]), iter, len(want))
	return subtle.ConstantTimeCompare(got, want) == 1
}

// Session tokens are stateless: "<userId>.<expiry>.<hmac>". The user is
// re-read on every request, so disabling or deleting them takes effect at
// once; rotating the session secret logs everyone out.
func (s *Server) signSession(uid string, exp time.Time) string {
	payload := uid + "." + strconv.FormatInt(exp.Unix(), 10)
	m := hmac.New(sha256.New, []byte(s.sessionSecret))
	m.Write([]byte("user|" + payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (s *Server) sessionUser(ctx context.Context, tok string) *store.User {
	parts := strings.Split(tok, ".")
	if len(parts) != 3 {
		return nil
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return nil
	}
	want := s.signSession(parts[0], time.Unix(exp, 0))
	if !hmac.Equal([]byte(tok), []byte(want)) {
		return nil
	}
	u, err := s.store.User(ctx, parts[0])
	if err != nil || u.Disabled {
		return nil
	}
	return u
}

func (s *Server) setSession(w http.ResponseWriter, r *http.Request, uid string) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: s.signSession(uid, time.Now().Add(sessionTTL)), Path: "/",
		HttpOnly: true, Secure: isHTTPS(r), SameSite: http.SameSiteLaxMode, MaxAge: int(sessionTTL.Seconds()),
	})
}

func clearSession(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", HttpOnly: true, Secure: isHTTPS(r),
		SameSite: http.SameSiteLaxMode, MaxAge: -1})
}

type userKey struct{}

func currentUser(r *http.Request) *store.User {
	u, _ := r.Context().Value(userKey{}).(*store.User)
	return u
}

// require guards the console API: a valid session of an enabled member with
// at least `role`, plus the X-RWD-CSRF header on writes (browsers cannot add
// it cross-site without a CORS preflight we never allow).
func (s *Server) require(role string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		var u *store.User
		if err == nil {
			u = s.sessionUser(r.Context(), c.Value)
		}
		if u == nil {
			s.fail(w, r, http.StatusUnauthorized, "unauthorized", i18n.APILoginRequired)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Header.Get("X-RWD-CSRF") != "1" {
			s.fail(w, r, http.StatusForbidden, "csrf", i18n.APICSRF)
			return
		}
		if store.RoleRank(u.Role) < store.RoleRank(role) {
			s.fail(w, r, http.StatusForbidden, "forbidden", i18n.APIForbidden)
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), userKey{}, u)))
	}
}

// bootstrapOwner makes sure an owner exists. RWD_ADMIN_PASSWORD (re)sets the
// owner's password, which doubles as account recovery; a phase 1 admin
// password is migrated to the owner account.
func (s *Server) bootstrapOwner(ctx context.Context, email, password string) error {
	if email == "" {
		email = "admin"
	}
	owner, err := s.store.UserByEmail(ctx, email)
	if err != nil && err != store.ErrNotFound {
		return err
	}
	hash := ""
	if password != "" {
		hash = hashPassword(password)
	}
	if owner != nil {
		if hash != "" {
			return s.store.SetPassword(ctx, owner.ID, hash)
		}
		return nil
	}
	n, err := s.store.UserCount(ctx)
	if err != nil {
		return err
	}
	if n > 0 && hash == "" {
		return nil // other accounts exist; nothing to bootstrap
	}
	if hash == "" {
		if legacy, err := s.store.Setting(ctx, "admin_password", nil); err == nil {
			hash = legacy
		} else {
			generated := ids.Secret(9)
			hash = hashPassword(generated)
			s.log.Warn("generated an owner password; set RWD_ADMIN_PASSWORD to choose your own", "email", email, "password", generated)
		}
	}
	_, err = s.store.CreateUser(ctx, email, s.cfg.Lang.T(i18n.OwnerDefaultName), store.RoleOwner, hash, "", nil)
	return err
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

// clientIP trusts X-Forwarded-For only when configured to (behind a proxy).
func (s *Server) clientIP(r *http.Request) string {
	if s.cfg.TrustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			first, _, _ := strings.Cut(xff, ",")
			return strings.TrimSpace(first)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func ipAllowed(ip string, allow []string) bool {
	if len(allow) == 0 {
		return true
	}
	addr := net.ParseIP(ip)
	if addr == nil {
		return false
	}
	for _, c := range allow {
		if !strings.Contains(c, "/") {
			if net.ParseIP(c).Equal(addr) {
				return true
			}
			continue
		}
		if _, n, err := net.ParseCIDR(c); err == nil && n.Contains(addr) {
			return true
		}
	}
	return false
}

// limiter is a small fixed-window rate limiter keyed by string.
type limiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string]*window
}

type window struct {
	start time.Time
	n     int
}

func newLimiter(limit int, w time.Duration) *limiter {
	l := &limiter{limit: limit, window: w, hits: map[string]*window{}}
	go func() {
		for range time.Tick(w) {
			l.mu.Lock()
			for k, v := range l.hits {
				if time.Since(v.start) > l.window {
					delete(l.hits, k)
				}
			}
			l.mu.Unlock()
		}
	}()
	return l
}

func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	w := l.hits[key]
	if w == nil || time.Since(w.start) > l.window {
		l.hits[key] = &window{start: time.Now(), n: 1}
		return true
	}
	w.n++
	return w.n <= l.limit
}
