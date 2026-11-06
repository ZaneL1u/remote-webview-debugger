// Command rwd is the remote-webview-debugger gateway.
//
//	rwd serve                     run the gateway (page WS, REST, MCP, console)
//	rwd mcp --gateway URL         stdio MCP server for local agents; forwards to URL/mcp
//	rwd version
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/server"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Set at build time from the gateway-vX.Y.Z tag (see the Makefile).
var version = "dev"

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string) int {
	n, _ := strconv.Atoi(os.Getenv(key))
	return n
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "serve":
		err = serve(os.Args[2:])
	case "mcp":
		err = bridge(os.Args[2:])
	case "version":
		fmt.Println(version)
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "rwd:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `usage:
  rwd serve [--addr :8080] [--data rwd.db] [--public-url https://host/v1] [--trust-proxy] [--demo-dir DIR] [--mcp-rate-limit N] [--demo-keys] [--lang en|zh|zh-TW|fr|es|ru|ar|ja|ko|de|pt]
  rwd mcp --gateway https://host/v1        (API key from RWD_API_KEY)
  rwd version

environment: RWD_ADDR, RWD_DATA or RWD_DATABASE_URL, RWD_PUBLIC_URL, RWD_TRUST_PROXY=1,
             RWD_ADMIN_EMAIL, RWD_ADMIN_PASSWORD, RWD_METRICS_TOKEN, RWD_AUDIT_RETENTION_DAYS, RWD_DEMO_DIR,
             RWD_MCP_RATE_LIMIT, RWD_DEMO_KEYS=1, RWD_LANG,
             RWD_OIDC_PROVIDER (oidc, feishu or lark) and the other RWD_OIDC_* (see gateway/README.md)
`)
}

func serve(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", env("RWD_ADDR", ":8080"), "listen address")
	data := fs.String("data", env("RWD_DATABASE_URL", env("RWD_DATA", "rwd.db")), "SQLite file path, or a postgres:// URL (RWD_DATABASE_URL)")
	public := fs.String("public-url", env("RWD_PUBLIC_URL", ""), "public gateway URL ending in /v1 (default: derived from requests)")
	demo := fs.String("demo-dir", env("RWD_DEMO_DIR", ""), "serve this directory at /demo/ (optional)")
	mcpRate := fs.Int("mcp-rate-limit", envInt("RWD_MCP_RATE_LIMIT"), "MCP requests per client IP per minute, 0 for no limit (RWD_MCP_RATE_LIMIT)")
	demoKeys := fs.Bool("demo-keys", env("RWD_DEMO_KEYS", "") == "1", "public demo: hand out a key per visitor at /v1/demo/keys; list_devices needs a device code (RWD_DEMO_KEYS=1)")
	trust := fs.Bool("trust-proxy", env("RWD_TRUST_PROXY", "") == "1", "trust X-Forwarded-* headers (only behind a reverse proxy)")
	langFlag := fs.String("lang", env("RWD_LANG", string(i18n.Default)), "language of agent-facing text: en, zh, zh-TW, fr, es, ru, ar, ja, ko, de or pt (RWD_LANG); the console's fallback")
	fs.Parse(args)
	lang, ok := i18n.Parse(*langFlag)
	if !ok {
		return fmt.Errorf("unsupported language %q (want one of %v)", *langFlag, i18n.Langs)
	}

	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(*data)
	if err != nil {
		return err
	}
	defer st.Close()

	retention, _ := strconv.Atoi(os.Getenv("RWD_AUDIT_RETENTION_DAYS"))
	oidc := oidcConfig()
	srv, err := server.New(ctx, server.Config{PublicURL: *public, TrustProxy: *trust,
		AdminEmail: os.Getenv("RWD_ADMIN_EMAIL"), AdminPassword: os.Getenv("RWD_ADMIN_PASSWORD"),
		MetricsToken: os.Getenv("RWD_METRICS_TOKEN"), AuditRetentionDays: retention,
		DemoDir: *demo, MCPRateLimit: *mcpRate, DemoKeys: *demoKeys, Lang: lang, OIDC: oidc, Version: version}, st, log)
	if err != nil {
		return err
	}

	httpSrv := &http.Server{Addr: *addr, Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}
	errc := make(chan error, 1)
	go func() { errc <- httpSrv.ListenAndServe() }()
	log.Info("rwd gateway listening", "addr", *addr, "version", version, "lang", lang)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	log.Info("shutting down")
	sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(sctx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// oidcConfig reads RWD_OIDC_*; single sign-on is on once RWD_OIDC_PROVIDER
// (or RWD_OIDC_ISSUER, meaning oidc) is set.
func oidcConfig() *server.OIDCConfig {
	provider := os.Getenv("RWD_OIDC_PROVIDER")
	if provider == "" && os.Getenv("RWD_OIDC_ISSUER") != "" {
		provider = server.ProviderOIDC
	}
	if provider == "" {
		return nil
	}
	var domains []string
	if d := os.Getenv("RWD_OIDC_ALLOWED_DOMAINS"); d != "" {
		domains = strings.Split(d, ",")
	}
	return &server.OIDCConfig{Provider: provider, Name: os.Getenv("RWD_OIDC_NAME"), Issuer: os.Getenv("RWD_OIDC_ISSUER"),
		AuthURL: os.Getenv("RWD_OIDC_AUTH_URL"), TokenURL: os.Getenv("RWD_OIDC_TOKEN_URL"), UserInfoURL: os.Getenv("RWD_OIDC_USERINFO_URL"),
		ClientID: os.Getenv("RWD_OIDC_CLIENT_ID"), ClientSecret: os.Getenv("RWD_OIDC_CLIENT_SECRET"),
		Scopes: os.Getenv("RWD_OIDC_SCOPES"), DefaultRole: os.Getenv("RWD_OIDC_DEFAULT_ROLE"),
		InviteOnly: os.Getenv("RWD_OIDC_INVITE_ONLY") == "1", AllowedDomains: domains,
		TrustEmail: os.Getenv("RWD_OIDC_TRUST_EMAIL") == "1", SyncInterval: syncInterval(provider)}
}

// syncInterval is RWD_OIDC_SYNC_MINUTES (default 60 for Feishu and Lark; 0
// turns the check for members who have left off).
func syncInterval(provider string) time.Duration {
	v, set := os.LookupEnv("RWD_OIDC_SYNC_MINUTES")
	if !set {
		if p := strings.ToLower(provider); p == server.ProviderFeishu || p == server.ProviderLark {
			return time.Hour
		}
		return 0
	}
	n, _ := strconv.Atoi(v)
	return time.Duration(max(n, 0)) * time.Minute
}

type bearer struct {
	token string
	base  http.RoundTripper
}

func (b bearer) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", "Bearer "+b.token)
	return b.base.RoundTrip(r)
}

// bridge relays MCP messages between stdio and the hosted endpoint, so local
// agents that only speak stdio can use the gateway.
func bridge(args []string) error {
	fs := flag.NewFlagSet("mcp", flag.ExitOnError)
	gateway := fs.String("gateway", env("RWD_GATEWAY", ""), "gateway URL, e.g. https://host/v1")
	fs.Parse(args)
	key := os.Getenv("RWD_API_KEY")
	if *gateway == "" || key == "" {
		return errors.New("need --gateway and RWD_API_KEY")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	remote, err := (&mcp.StreamableClientTransport{
		Endpoint:   strings.TrimRight(*gateway, "/") + "/mcp",
		HTTPClient: &http.Client{Transport: bearer{token: key, base: http.DefaultTransport}},
	}).Connect(ctx)
	if err != nil {
		return err
	}
	defer remote.Close()
	local, err := (&mcp.StdioTransport{}).Connect(ctx)
	if err != nil {
		return err
	}
	defer local.Close()

	errc := make(chan error, 2)
	pipe := func(from, to mcp.Connection) {
		for {
			msg, err := from.Read(ctx)
			if err != nil {
				errc <- err
				return
			}
			if err := to.Write(ctx, msg); err != nil {
				errc <- err
				return
			}
		}
	}
	go pipe(local, remote)
	go pipe(remote, local)
	select {
	case <-ctx.Done():
		return nil
	case err := <-errc:
		if errors.Is(err, context.Canceled) || strings.Contains(err.Error(), "EOF") {
			return nil
		}
		return err
	}
}
