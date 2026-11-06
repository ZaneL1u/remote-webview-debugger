// Package server wires the gateway's HTTP surface: page WebSocket, presence
// polling, the console REST API, the hosted MCP endpoint and static files.
package server

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"mime"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/hub"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/web"
	"github.com/coder/websocket"
)

type Config struct {
	// PublicURL is the gateway address as clients see it, e.g.
	// https://rwd.example.com/v1. Empty: derived from each request.
	PublicURL string
	// TrustProxy takes client IPs and scheme from X-Forwarded-* headers.
	TrustProxy bool
	// AdminEmail / AdminPassword bootstrap (or recover) the owner account.
	AdminEmail    string
	AdminPassword string
	// MetricsToken, if set, is required as a bearer token on /v1/metrics.
	MetricsToken string
	// AuditRetentionDays bounds the audit log (default 180).
	AuditRetentionDays int
	// DemoDir, if set, is served at /demo/ (demo sites for trying the SDK).
	DemoDir string
	// MCPRateLimit, if positive, caps MCP requests per client IP per minute
	// (for a gateway whose API key is public, like a demo).
	MCPRateLimit int
	// DemoKeys runs a public demo: anyone can get a short-lived interact key
	// of their own (POST /v1/demo/keys), and list_devices needs a device code.
	DemoKeys bool
	// OIDC, if set, adds single sign-on next to password sign-in.
	OIDC *OIDCConfig
	// Lang is the language of agent-facing text (MCP, page SDK errors) and
	// the console's fallback (RWD_LANG; default English).
	Lang    i18n.Lang
	Version string
}

type Server struct {
	cfg           Config
	store         *store.Store
	hub           *hub.Hub
	log           *slog.Logger
	pepper        string
	sessionSecret string
	started       time.Time

	loginLimit *limiter
	ssoLimit   *limiter // single sign-on starts and callbacks
	pageLimit  *limiter
	mcpLimit   *limiter // nil: unlimited
	demoLimit  *limiter // demo keys per client IP
	demoTotal  *limiter // demo keys in all
	mcp        http.Handler
	audit      chan store.AuditEvent
	httpCodes  httpCounter
	dir        *directory // Feishu / Lark contact lookups (key_check.go); nil otherwise
	leaveMu    sync.Mutex // members who have left are disabled one at a time

	sdk          []byte
	sdkVersion   string
	sdkIntegrity string
}

func New(ctx context.Context, cfg Config, st *store.Store, log *slog.Logger) (*Server, error) {
	if cfg.Lang == "" {
		cfg.Lang = i18n.Default
	}
	if cfg.OIDC != nil {
		if err := cfg.OIDC.validate(); err != nil {
			return nil, err
		}
		if o := cfg.OIDC; o.Provider == ProviderOIDC && !o.InviteOnly && len(o.AllowedDomains) == 0 {
			log.Warn("single sign-on: anyone who can sign in at the provider gets an account; set RWD_OIDC_ALLOWED_DOMAINS or RWD_OIDC_INVITE_ONLY=1 unless only your people can", "issuer", o.Issuer, "role", o.DefaultRole)
		}
	}
	s := &Server{cfg: cfg, store: st, log: log, audit: make(chan store.AuditEvent, 1024), started: time.Now(),
		loginLimit: newLimiter(10, time.Minute), ssoLimit: newLimiter(60, time.Minute), pageLimit: newLimiter(120, time.Minute)}
	var err error
	if s.pepper, err = st.Setting(ctx, "key_pepper", func() string { return ids.Secret(32) }); err != nil {
		return nil, err
	}
	if s.sessionSecret, err = st.Setting(ctx, "session_secret", func() string { return ids.Secret(32) }); err != nil {
		return nil, err
	}
	if err := s.bootstrapOwner(ctx, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		return nil, err
	}
	s.dir = newDirectory(cfg.OIDC)
	s.hub = hub.New(st, log, s.pepper, cfg.Lang)
	s.hub.Audit = s.recordEvent
	go s.auditWriter()
	s.loadSDK()
	if cfg.MCPRateLimit > 0 {
		s.mcpLimit = newLimiter(cfg.MCPRateLimit, time.Minute)
	}
	if cfg.DemoKeys {
		s.demoLimit, s.demoTotal = newLimiter(5, time.Hour), newLimiter(500, time.Hour)
	}
	s.mcp = s.mcpHandler()
	go s.resignationLoop(ctx)
	return s, nil
}

// Hub exposes the live state (used by tests and the command).
func (s *Server) Hub() *hub.Hub { return s.hub }

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /v1/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{"ok": true, "version": s.cfg.Version, "db": s.store.Dialect()})
	})
	mux.HandleFunc("GET /v1/metrics", s.metrics)
	mux.HandleFunc("GET /v1/sdk.js", s.serveSDK)
	mux.HandleFunc("GET /v1/sdk/{version}/sdk.js", s.serveSDK)
	mux.HandleFunc("GET /v1/locales/{file}", s.serveLocale)
	mux.HandleFunc("GET /v1/sdk/{version}/locales/{file}", s.serveLocale)
	mux.HandleFunc("GET /v1/page", s.servePage)
	mux.HandleFunc("GET /v1/devtools", s.serveDevtools)
	mux.HandleFunc("POST /v1/presence", s.presence)
	mux.HandleFunc("OPTIONS /v1/presence", s.presence)
	mux.Handle("/v1/mcp", s.mcp)
	s.routes(mux)
	if s.cfg.DemoKeys {
		mux.HandleFunc("POST /v1/demo/keys", s.demoKey)
		mux.HandleFunc("OPTIONS /v1/demo/keys", s.demoKey)
	}
	if s.cfg.DemoDir != "" {
		mux.Handle("/demo/", http.StripPrefix("/demo/", http.FileServer(http.Dir(s.cfg.DemoDir))))
	}
	mux.Handle("/v1/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.fail(w, r, http.StatusNotFound, "not_found", i18n.APIUnknownEndpoint)
	}))
	mux.Handle("/", s.spa(web.Console()))

	return s.countCodes(securityHeaders(mux))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		switch {
		case strings.HasPrefix(r.URL.Path, "/v1/sdk"):
		case strings.HasPrefix(r.URL.Path, "/devtools/"):
			// The DevTools frontend runs in an iframe of the console.
			h.Set("X-Frame-Options", "SAMEORIGIN")
		default:
			h.Set("X-Frame-Options", "DENY")
		}
		next.ServeHTTP(w, r)
	})
}

// GatewayURL is the public address of the gateway (ending in /v1).
func (s *Server) GatewayURL(r *http.Request) string {
	if s.cfg.PublicURL != "" {
		return strings.TrimRight(s.cfg.PublicURL, "/")
	}
	scheme := "http"
	if s.isHTTPS(r) {
		scheme = "https"
	}
	host := r.Host
	if s.cfg.TrustProxy {
		if fh := r.Header.Get("X-Forwarded-Host"); fh != "" {
			host = fh
		}
	}
	return scheme + "://" + host + "/v1"
}

// --- SDK ---

func (s *Server) loadSDK() {
	b, err := fs.ReadFile(web.SDK(), "sdk.js")
	if err != nil {
		return
	}
	s.sdk = b
	sum := sha256.Sum256(b)
	s.sdkVersion = hex.EncodeToString(sum[:])[:12]
	h384 := sha512.Sum384(b)
	s.sdkIntegrity = "sha384-" + base64.StdEncoding.EncodeToString(h384[:])
}

// serveSDK serves /v1/sdk.js (short cache) and the content-addressed
// /v1/sdk/<version>/sdk.js (immutable, usable with SRI).
func (s *Server) serveSDK(w http.ResponseWriter, r *http.Request) {
	if s.sdk == nil {
		http.NotFound(w, r)
		return
	}
	h := w.Header()
	if v := r.PathValue("version"); v != "" {
		if v != s.sdkVersion {
			http.NotFound(w, r)
			return
		}
		h.Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		h.Set("Cache-Control", "public, max-age=300")
	}
	h.Set("Content-Type", "text/javascript; charset=utf-8")
	// Lets pages load it with crossorigin="anonymous" so errors passing
	// through its hooks are not muted.
	h.Set("Access-Control-Allow-Origin", "*")
	w.Write(s.sdk)
}

var localeFile = regexp.MustCompile(`^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8})*\.js$`)

// serveLocale serves the SDK's on-demand language packs: sdk.js loads
// locales/<id>.js from next to itself (docs/protocol.md §3.5).
func (s *Server) serveLocale(w http.ResponseWriter, r *http.Request) {
	file := r.PathValue("file")
	v := r.PathValue("version")
	if !localeFile.MatchString(file) || (v != "" && v != s.sdkVersion) {
		http.NotFound(w, r)
		return
	}
	b, err := fs.ReadFile(web.SDK(), "locales/"+file)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	h := w.Header()
	// Short cache even under /sdk/<version>/: the version is sdk.js's hash, and
	// a pack's text can change without it.
	h.Set("Cache-Control", "public, max-age=300")
	h.Set("Content-Type", "text/javascript; charset=utf-8")
	h.Set("Access-Control-Allow-Origin", "*")
	w.Write(b)
}

// --- page connections ---

func (s *Server) projectForPage(ctx context.Context, w http.ResponseWriter, r *http.Request, key string) *store.Project {
	if !s.pageLimit.allow(s.clientIP(r)) {
		s.fail(w, r, http.StatusTooManyRequests, "rate_limited", i18n.APITooManyConnections)
		return nil
	}
	p, err := s.store.ProjectByAppKey(ctx, key)
	if err != nil || p.Disabled {
		s.fail(w, r, http.StatusUnauthorized, "bad_key", i18n.APIBadAppKey)
		return nil
	}
	if len(p.AllowedOrigins) > 0 {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")
		ok := false
		for _, o := range p.AllowedOrigins {
			if originMatches(o, origin) {
				ok = true
				break
			}
		}
		if !ok {
			s.fail(w, r, http.StatusForbidden, "origin_not_allowed", i18n.APIOriginNotAllowed)
			return nil
		}
	}
	return p
}

func (s *Server) servePage(w http.ResponseWriter, r *http.Request) {
	p := s.projectForPage(r.Context(), w, r, r.URL.Query().Get("key"))
	if p == nil {
		return
	}
	// Pages live on other origins; the origin policy is the project's
	// allowedOrigins, checked above.
	ws, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	// The connection outlives the handler's request context only as long as
	// ServePage runs, which is the whole connection.
	s.hub.ServePage(context.WithoutCancel(r.Context()), ws, p.ID)
}

// serveDevtools is the WebSocket of a DevTools frontend embedded in the
// console. The one-time ticket from POST /api/devices/:id/devtools is the
// credential; only the console's own origin may connect.
func (s *Server) serveDevtools(w http.ResponseWriter, r *http.Request) {
	ticket := r.URL.Query().Get("ticket")
	if ticket == "" {
		s.fail(w, r, http.StatusUnauthorized, "unauthorized", i18n.APIDevtoolsTicket)
		return
	}
	opts := &websocket.AcceptOptions{}
	if u, err := url.Parse(s.cfg.PublicURL); err == nil && u.Host != "" {
		opts.OriginPatterns = []string{u.Host}
	}
	ws, err := websocket.Accept(w, r, opts)
	if err != nil {
		return
	}
	s.hub.ServeDevtools(context.WithoutCancel(r.Context()), ws, ticket)
}

type presenceReq struct {
	Key         string `json:"key"`
	DeviceID    string `json:"deviceId"`
	UserID      string `json:"userId"`
	DeviceToken string `json:"deviceToken"`
	Help        bool   `json:"help"`
	Device      struct {
		UA       string         `json:"ua"`
		Platform string         `json:"platform"`
		App      *store.AppInfo `json:"app"`
	} `json:"device"`
}

func (s *Server) presence(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "POST")
	h.Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	var req presenceReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&req); err != nil || req.DeviceID == "" || len(req.DeviceID) > 64 {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIInvalidBody)
		return
	}
	p := s.projectForPage(r.Context(), w, r, req.Key)
	if p == nil {
		return
	}
	code, connect, err := s.hub.Presence(r.Context(), store.Device{ProjectID: p.ID, DeviceID: req.DeviceID,
		UserID: req.UserID, Platform: req.Device.Platform, UA: req.Device.UA, App: req.Device.App}, req.DeviceToken, req.Help)
	if errors.Is(err, hub.ErrBadDeviceToken) {
		s.fail(w, r, http.StatusUnauthorized, "bad_token", i18n.APIBadDeviceToken)
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, map[string]any{"deviceCode": code, "connect": connect})
}

// demoKey hands a visitor of a public demo an API key of their own, so every
// visitor is a separate agent: approvals, reattach grants and device code
// lockouts are per key. Interact level, valid for a day.
func (s *Server) demoKey(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "POST")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	ip := s.clientIP(r)
	if !s.demoLimit.allow(ip) || !s.demoTotal.allow("") {
		h.Set("Retry-After", "3600")
		s.fail(w, r, http.StatusTooManyRequests, "rate_limited", i18n.APITooManyRequests)
		return
	}
	exp := time.Now().Add(24 * time.Hour).UnixMilli()
	k, plain, err := s.store.CreateAPIKey(r.Context(), s.pepper, store.NewKey{Name: "Demo visitor", MaxLevel: store.LevelInteract, ExpiresAt: &exp})
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.recordEvent(store.AuditEvent{ActorType: "visitor", ActorID: ip, ActorName: ip, Action: "key.create", Target: k.Prefix,
		Result: "ok", Detail: map[string]any{"demo": true}})
	writeJSON(w, map[string]any{"key": plain, "mcp": s.GatewayURL(r) + "/mcp", "expiresAt": exp})
}

// --- console SPA ---

func (s *Server) spa(root fs.FS) http.Handler {
	files := http.FileServerFS(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if f, err := root.Open(name); err == nil {
			f.Close()
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			files.ServeHTTP(w, r)
			return
		}
		if serveGzipped(w, r, root, name) {
			return
		}
		// A missing file (it has an extension) is a 404, not the app shell.
		if path.Ext(name) != "" {
			http.NotFound(w, r)
			return
		}
		// Client-side route: serve the app shell.
		b, err := fs.ReadFile(root, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(b)
	})
}

// serveGzipped serves name from its embedded name.gz (the DevTools frontend
// is stored compressed, see scripts/embed.sh).
func serveGzipped(w http.ResponseWriter, r *http.Request, root fs.FS, name string) bool {
	if !strings.HasPrefix(name, "devtools/") {
		return false
	}
	f, err := root.Open(name + ".gz")
	if err != nil {
		return false
	}
	defer f.Close()
	h := w.Header()
	ctype := mime.TypeByExtension(path.Ext(name))
	if ctype == "" {
		ctype = "application/octet-stream"
	}
	h.Set("Content-Type", ctype)
	h.Set("Cache-Control", "public, max-age=3600")
	h.Set("Vary", "Accept-Encoding")
	if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		h.Set("Content-Encoding", "gzip")
		if st, err := f.Stat(); err == nil {
			h.Set("Content-Length", strconv.FormatInt(st.Size(), 10))
		}
		if r.Method != http.MethodHead {
			io.Copy(w, f)
		}
		return true
	}
	zr, err := gzip.NewReader(f)
	if err != nil {
		http.Error(w, "bad file", http.StatusInternalServerError)
		return true
	}
	defer zr.Close()
	if r.Method != http.MethodHead {
		io.Copy(w, zr)
	}
	return true
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": code, "message": msg}})
}

// lang is the language of console-facing text: the lang query parameter
// (for EventSource, which cannot set headers), then Accept-Language, then
// the configured language.
func (s *Server) lang(r *http.Request) i18n.Lang {
	if l, ok := i18n.Parse(r.URL.Query().Get("lang")); ok {
		return l
	}
	if l, ok := i18n.FromAcceptLanguage(r.Header.Get("Accept-Language")); ok {
		return l
	}
	return s.cfg.Lang
}

// fail writes an error with a message in the request's language.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, status int, code string, k i18n.Key, a ...any) {
	writeErr(w, status, code, s.lang(r).T(k, a...))
}

func (s *Server) storeErr(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, store.ErrNotFound) {
		s.fail(w, r, http.StatusNotFound, "not_found", i18n.APINotFound)
		return
	}
	writeErr(w, http.StatusInternalServerError, "internal", err.Error())
}

// originMatches supports exact origins and one leading wildcard label, e.g.
// https://*.example.com (which does not match https://example.com itself).
func originMatches(pattern, origin string) bool {
	if pattern == origin {
		return true
	}
	scheme, rest, ok := strings.Cut(pattern, "://*.")
	if !ok {
		return false
	}
	prefix := scheme + "://"
	return strings.HasPrefix(origin, prefix) && strings.HasSuffix(origin, "."+rest) &&
		!strings.Contains(strings.TrimSuffix(strings.TrimPrefix(origin, prefix), "."+rest), "/")
}
