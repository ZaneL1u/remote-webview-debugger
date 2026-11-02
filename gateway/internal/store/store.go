// Package store persists projects, members, API keys, known devices, device
// invites, audit events and settings, in SQLite or Postgres. Live state
// (connected pages, control state, timelines) lives in the hub, in memory.
package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("already exists")
)

type Store struct {
	db *sql.DB
	pg bool
}

// Open connects to Postgres when dsn starts with postgres:// (or
// postgresql://), otherwise treats it as a SQLite file path.
func Open(dsn string) (*Store, error) {
	s := &Store{}
	var err error
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		s.pg = true
		s.db, err = sql.Open("pgx", dsn)
		if err != nil {
			return nil, err
		}
		s.db.SetMaxOpenConns(10)
	} else {
		s.db, err = sql.Open("sqlite", fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)", dsn))
		if err != nil {
			return nil, err
		}
		// One writer keeps SQLite simple; the gateway's write rate is low.
		s.db.SetMaxOpenConns(1)
	}
	if err := s.migrate(context.Background()); err != nil {
		s.db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Dialect() string {
	if s.pg {
		return "postgres"
	}
	return "sqlite"
}

// q rewrites ? placeholders to $n for Postgres.
func (s *Store) q(query string) string {
	if !s.pg {
		return query
	}
	var b strings.Builder
	n := 0
	for _, r := range query {
		if r == '?' {
			n++
			b.WriteString("$" + strconv.Itoa(n))
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func (s *Store) exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return s.db.ExecContext(ctx, s.q(query), args...)
}

func (s *Store) query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return s.db.QueryContext(ctx, s.q(query), args...)
}

func (s *Store) row(ctx context.Context, query string, args ...any) *sql.Row {
	return s.db.QueryRowContext(ctx, s.q(query), args...)
}

func now() int64 { return time.Now().UnixMilli() }

func isUnique(err error) bool {
	if err == nil {
		return false
	}
	m := err.Error()
	return strings.Contains(m, "UNIQUE") || strings.Contains(m, "duplicate key")
}

// --- schema ---

// Tables are created with every column; ensureColumns adds what an older
// database (phase 1 SQLite) lacks.
func (s *Store) migrate(ctx context.Context) error {
	autoID := "INTEGER PRIMARY KEY AUTOINCREMENT"
	if s.pg {
		autoID = "BIGSERIAL PRIMARY KEY"
	}
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, app_key TEXT NOT NULL UNIQUE,
			allowed_origins TEXT NOT NULL DEFAULT '[]', disabled INTEGER NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL, policy TEXT NOT NULL DEFAULT '', invite_url TEXT NOT NULL DEFAULT '')`,
		`CREATE TABLE IF NOT EXISTS api_keys (` + apiKeysTable + `)`,
		`CREATE TABLE IF NOT EXISTS devices (` + devicesTable + `)`,
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
			password_hash TEXT NOT NULL DEFAULT '', role TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0,
			invite_hash TEXT NOT NULL DEFAULT '', invite_expires BIGINT, created_at BIGINT NOT NULL, last_login_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS device_invites (
			id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL UNIQUE, note TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
			expires_at BIGINT NOT NULL, used_at BIGINT, device_id TEXT, created_by TEXT NOT NULL DEFAULT '',
			created_at BIGINT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS audit_events (
			id ` + autoID + `, at BIGINT NOT NULL, project_id TEXT, actor_type TEXT NOT NULL,
			actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '',
			result TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}')`,
		`CREATE INDEX IF NOT EXISTS audit_project_id ON audit_events (project_id, id)`,
		`CREATE INDEX IF NOT EXISTS audit_at ON audit_events (at)`,
	}
	for _, st := range stmts {
		if _, err := s.db.ExecContext(ctx, st); err != nil {
			return fmt.Errorf("%w: %s", err, st[:min(60, len(st))])
		}
	}
	cols := []struct{ table, col, ddl string }{
		{"projects", "policy", "TEXT NOT NULL DEFAULT ''"},
		{"projects", "invite_url", "TEXT NOT NULL DEFAULT ''"},
		{"api_keys", "max_level", "TEXT NOT NULL DEFAULT 'advanced'"}, // phase 1 keys could evaluate
		{"api_keys", "expires_at", "BIGINT"},
		{"api_keys", "ip_allowlist", "TEXT NOT NULL DEFAULT '[]'"},
		{"devices", "token_hash", "TEXT NOT NULL DEFAULT ''"},
	}
	for _, c := range cols {
		ok, err := s.hasColumn(ctx, c.table, c.col)
		if err != nil {
			return err
		}
		if !ok {
			if _, err := s.db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", c.table, c.col, c.ddl)); err != nil {
				return err
			}
		}
	}
	return s.migrateGlobal(ctx)
}

// Devices and API keys belong to the gateway, not to a project: a phone is
// one device whichever integrated page it opens, and a key reaches every
// device. devices.project_id is the project of the device's latest page.
const (
	apiKeysTable = `id TEXT PRIMARY KEY, project_id TEXT NOT NULL DEFAULT '',
			name TEXT NOT NULL, prefix TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL,
			last_used_at BIGINT, revoked_at BIGINT,
			max_level TEXT NOT NULL DEFAULT 'interact', expires_at BIGINT, ip_allowlist TEXT NOT NULL DEFAULT '[]'`
	devicesTable = `device_id TEXT PRIMARY KEY, project_id TEXT NOT NULL DEFAULT '',
			code TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL DEFAULT '', platform TEXT NOT NULL DEFAULT '',
			ua TEXT NOT NULL DEFAULT '', app TEXT NOT NULL DEFAULT '', first_seen BIGINT NOT NULL,
			last_seen BIGINT NOT NULL, token_hash TEXT NOT NULL DEFAULT ''`
)

// migrateGlobal rebuilds the per-project devices and api_keys tables of
// older databases (keyed by project, cascading on project deletion). A device
// seen in several projects keeps its latest row (code included) and its
// earliest first sighting; its device token is reset, since each project row
// had issued its own and the page may hold either.
func (s *Store) migrateGlobal(ctx context.Context) error {
	const flag = "schema.global_devices"
	if _, err := s.Setting(ctx, flag, nil); err == nil {
		return nil
	} else if !errors.Is(err, ErrNotFound) {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmts := []string{
		`CREATE TABLE devices_v2 (` + devicesTable + `)`,
		`INSERT INTO devices_v2 (` + deviceCols + `)
			SELECT d.project_id, d.device_id, d.code, d.user_id, d.platform, d.ua, d.app,
				(SELECT MIN(x.first_seen) FROM devices x WHERE x.device_id = d.device_id), d.last_seen,
				CASE WHEN (SELECT COUNT(*) FROM devices x WHERE x.device_id = d.device_id) > 1 THEN '' ELSE d.token_hash END
			FROM devices d WHERE NOT EXISTS (SELECT 1 FROM devices n WHERE n.device_id = d.device_id
				AND (n.last_seen > d.last_seen OR (n.last_seen = d.last_seen AND n.code > d.code)))`,
		`DROP TABLE devices`,
		`ALTER TABLE devices_v2 RENAME TO devices`,
		`CREATE TABLE api_keys_v2 (` + apiKeysTable + `)`,
		`INSERT INTO api_keys_v2 (id, project_id, ` + keyCols[len("id, "):] + `, hash)
			SELECT id, project_id, ` + keyCols[len("id, "):] + `, hash FROM api_keys`,
		`DROP TABLE api_keys`,
		`ALTER TABLE api_keys_v2 RENAME TO api_keys`,
	}
	for _, st := range stmts {
		if _, err := tx.ExecContext(ctx, st); err != nil {
			return fmt.Errorf("%w: %s", err, st[:min(60, len(st))])
		}
	}
	if _, err := tx.ExecContext(ctx, s.q(`INSERT INTO settings (k, v) VALUES (?, ?)`), flag, "1"); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) hasColumn(ctx context.Context, table, col string) (bool, error) {
	if s.pg {
		var n int
		err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, table, col).Scan(&n)
		return n > 0, err
	}
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var cid, notnull, pk int
		var name, typ string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			return false, err
		}
		if name == col {
			return true, nil
		}
	}
	return false, rows.Err()
}

// --- settings ---

// Setting returns a stored setting, creating it with gen() if absent.
func (s *Store) Setting(ctx context.Context, key string, gen func() string) (string, error) {
	var v string
	err := s.row(ctx, `SELECT v FROM settings WHERE k = ?`, key).Scan(&v)
	if err == nil {
		return v, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	if gen == nil {
		return "", ErrNotFound
	}
	v = gen()
	if _, err := s.exec(ctx, `INSERT INTO settings (k, v) VALUES (?, ?)`, key, v); err != nil {
		return "", err
	}
	return v, nil
}

func (s *Store) SetSetting(ctx context.Context, key, value string) error {
	_, err := s.exec(ctx, `INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, key, value)
	return err
}

// --- policy ---

type Level string

const (
	LevelObserve  Level = "observe"
	LevelInteract Level = "interact"
	LevelAdvanced Level = "advanced"
)

func (l Level) Rank() int {
	switch l {
	case LevelObserve:
		return 1
	case LevelInteract:
		return 2
	case LevelAdvanced:
		return 3
	}
	return 0
}

func (l Level) Valid() bool { return l.Rank() > 0 }

func MinLevel(levels ...Level) Level {
	best := LevelAdvanced
	for _, l := range levels {
		if l.Valid() && l.Rank() < best.Rank() {
			best = l
		}
	}
	return best
}

type MaskPattern struct {
	Name  string `json:"name"`
	Regex string `json:"regex"`
}

type Policy struct {
	Approval         string        `json:"approval"`
	MaxLevel         Level         `json:"maxLevel"`
	MaskSelectors    []string      `json:"maskSelectors"`
	MaskPatterns     []MaskPattern `json:"maskPatterns"`
	ConfirmSelectors []string      `json:"confirmSelectors"`
	NetworkExclude   []string      `json:"networkExclude"` // URL substrings, * wildcards or /regex/, hidden from agents
	SessionLog       *bool         `json:"sessionLog"`     // pages keep the session log (default on)
	HelpButton       string        `json:"helpButton"`
	HelpUsers        []string      `json:"helpUsers"`
	AgentIdleMinutes int           `json:"agentIdleMinutes"`
	AttachMaxMinutes int           `json:"attachMaxMinutes"`
	MaxOnlineDevices int           `json:"maxOnlineDevices"`
	MaxAgents        int           `json:"maxAgents"`
	Eruda            ErudaPolicy   `json:"eruda"`
}

// ErudaPolicy: how pages combine with eruda (run() options override it).
type ErudaPolicy struct {
	Dock bool `json:"dock"` // a Remote Debugger tab in eruda instead of the floating window
	Load bool `json:"load"` // load the latest eruda when the page has none
}

// DefaultPolicy is what new projects get: approval on, interact at most.
func DefaultPolicy() Policy {
	return Policy{Approval: "prompt", MaxLevel: LevelInteract, HelpButton: "off", AgentIdleMinutes: 2, AttachMaxMinutes: 60}
}

// Normalize fills defaults and clamps values.
func (p *Policy) Normalize() {
	if p.Approval != "none" {
		p.Approval = "prompt"
	}
	if !p.MaxLevel.Valid() {
		p.MaxLevel = LevelInteract
	}
	if p.HelpButton != "all" && p.HelpButton != "listed" {
		p.HelpButton = "off"
	}
	if p.AgentIdleMinutes <= 0 {
		p.AgentIdleMinutes = 2
	}
	if p.AttachMaxMinutes <= 0 {
		p.AttachMaxMinutes = 60
	}
	p.AgentIdleMinutes = min(p.AgentIdleMinutes, 120)
	p.AttachMaxMinutes = min(p.AttachMaxMinutes, 24*60)
	p.MaxOnlineDevices = max(p.MaxOnlineDevices, 0)
	p.MaxAgents = max(p.MaxAgents, 0)
	clean := func(in []string) []string {
		out := []string{}
		for _, v := range in {
			if v = strings.TrimSpace(v); v != "" && len(out) < 50 {
				out = append(out, v)
			}
		}
		return out
	}
	p.MaskSelectors = clean(p.MaskSelectors)
	p.ConfirmSelectors = clean(p.ConfirmSelectors)
	p.NetworkExclude = clean(p.NetworkExclude)
	if p.SessionLog == nil {
		on := true
		p.SessionLog = &on
	}
	p.HelpUsers = clean(p.HelpUsers)
	pats := []MaskPattern{}
	for _, m := range p.MaskPatterns {
		if strings.TrimSpace(m.Regex) != "" && len(pats) < 20 {
			pats = append(pats, MaskPattern{Name: strings.TrimSpace(m.Name), Regex: m.Regex})
		}
	}
	p.MaskPatterns = pats
}

// --- projects ---

type Project struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	AppKey         string   `json:"appKey"`
	AllowedOrigins []string `json:"allowedOrigins"`
	Disabled       bool     `json:"disabled"`
	CreatedAt      int64    `json:"createdAt"`
	Policy         Policy   `json:"policy"`
	InviteURL      string   `json:"inviteUrl"`
}

const projectCols = `id, name, app_key, allowed_origins, disabled, created_at, policy, invite_url`

func scanProject(row interface{ Scan(...any) error }) (*Project, error) {
	var p Project
	var origins, policy string
	var disabled int
	if err := row.Scan(&p.ID, &p.Name, &p.AppKey, &origins, &disabled, &p.CreatedAt, &policy, &p.InviteURL); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	p.Disabled = disabled != 0
	_ = json.Unmarshal([]byte(origins), &p.AllowedOrigins)
	if p.AllowedOrigins == nil {
		p.AllowedOrigins = []string{}
	}
	if policy == "" {
		// Projects created before policies existed: no approval, no levels.
		p.Policy = DefaultPolicy()
		p.Policy.Approval = "none"
		p.Policy.MaxLevel = LevelAdvanced
	} else {
		_ = json.Unmarshal([]byte(policy), &p.Policy)
	}
	p.Policy.Normalize()
	return &p, nil
}

func (s *Store) Projects(ctx context.Context) ([]*Project, error) {
	rows, err := s.query(ctx, `SELECT `+projectCols+` FROM projects ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Project{}
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) Project(ctx context.Context, id string) (*Project, error) {
	return scanProject(s.row(ctx, `SELECT `+projectCols+` FROM projects WHERE id = ?`, id))
}

func (s *Store) ProjectByAppKey(ctx context.Context, key string) (*Project, error) {
	return scanProject(s.row(ctx, `SELECT `+projectCols+` FROM projects WHERE app_key = ?`, key))
}

func cleanOrigins(in []string) []string {
	out := []string{}
	for _, o := range in {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o != "" {
			out = append(out, o)
		}
	}
	return out
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func (s *Store) CreateProject(ctx context.Context, name string, origins []string) (*Project, error) {
	p := &Project{ID: ids.ID(), Name: name, AppKey: ids.AppKey(), AllowedOrigins: cleanOrigins(origins), CreatedAt: now(), Policy: DefaultPolicy()}
	_, err := s.exec(ctx, `INSERT INTO projects (`+projectCols+`) VALUES (?, ?, ?, ?, 0, ?, ?, '')`,
		p.ID, p.Name, p.AppKey, mustJSON(p.AllowedOrigins), p.CreatedAt, mustJSON(p.Policy))
	if err != nil {
		return nil, err
	}
	return p, nil
}

type ProjectPatch struct {
	Name           *string          `json:"name"`
	AllowedOrigins *[]string        `json:"allowedOrigins"`
	Disabled       *bool            `json:"disabled"`
	Policy         *json.RawMessage `json:"policy"`
	InviteURL      *string          `json:"inviteUrl"`
}

func (s *Store) UpdateProject(ctx context.Context, id string, patch ProjectPatch) (*Project, error) {
	p, err := s.Project(ctx, id)
	if err != nil {
		return nil, err
	}
	if patch.Name != nil {
		p.Name = strings.TrimSpace(*patch.Name)
	}
	if patch.AllowedOrigins != nil {
		p.AllowedOrigins = cleanOrigins(*patch.AllowedOrigins)
	}
	if patch.Disabled != nil {
		p.Disabled = *patch.Disabled
	}
	if patch.Policy != nil {
		// Partial policy: unmarshal over the current one.
		if err := json.Unmarshal(*patch.Policy, &p.Policy); err != nil {
			return nil, fmt.Errorf("invalid policy: %w", err)
		}
		p.Policy.Normalize()
	}
	if patch.InviteURL != nil {
		p.InviteURL = strings.TrimSpace(*patch.InviteURL)
	}
	disabled := 0
	if p.Disabled {
		disabled = 1
	}
	_, err = s.exec(ctx, `UPDATE projects SET name = ?, allowed_origins = ?, disabled = ?, policy = ?, invite_url = ? WHERE id = ?`,
		p.Name, mustJSON(p.AllowedOrigins), disabled, mustJSON(p.Policy), p.InviteURL, id)
	return p, err
}

func (s *Store) RotateAppKey(ctx context.Context, id string) (*Project, error) {
	if _, err := s.exec(ctx, `UPDATE projects SET app_key = ? WHERE id = ?`, ids.AppKey(), id); err != nil {
		return nil, err
	}
	return s.Project(ctx, id)
}

func (s *Store) DeleteProject(ctx context.Context, id string) error {
	res, err := s.exec(ctx, `DELETE FROM projects WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// --- API keys ---

type APIKey struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Prefix      string   `json:"prefix"`
	CreatedAt   int64    `json:"createdAt"`
	LastUsedAt  *int64   `json:"lastUsedAt"`
	RevokedAt   *int64   `json:"revokedAt"`
	MaxLevel    Level    `json:"maxLevel"`
	ExpiresAt   *int64   `json:"expiresAt"`
	IPAllowlist []string `json:"ipAllowlist"`
}

func (k *APIKey) Expired() bool { return k.ExpiresAt != nil && now() > *k.ExpiresAt }

const keyCols = `id, name, prefix, created_at, last_used_at, revoked_at, max_level, expires_at, ip_allowlist`

func scanKey(row interface{ Scan(...any) error }) (*APIKey, error) {
	var k APIKey
	var used, revoked, expires sql.NullInt64
	var level, ips string
	if err := row.Scan(&k.ID, &k.Name, &k.Prefix, &k.CreatedAt, &used, &revoked, &level, &expires, &ips); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if used.Valid {
		k.LastUsedAt = &used.Int64
	}
	if revoked.Valid {
		k.RevokedAt = &revoked.Int64
	}
	if expires.Valid {
		k.ExpiresAt = &expires.Int64
	}
	k.MaxLevel = Level(level)
	if !k.MaxLevel.Valid() {
		k.MaxLevel = LevelInteract
	}
	_ = json.Unmarshal([]byte(ips), &k.IPAllowlist)
	if k.IPAllowlist == nil {
		k.IPAllowlist = []string{}
	}
	return &k, nil
}

func (s *Store) APIKeys(ctx context.Context) ([]*APIKey, error) {
	rows, err := s.query(ctx, `SELECT `+keyCols+` FROM api_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*APIKey{}
	for rows.Next() {
		k, err := scanKey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

type NewKey struct {
	Name        string
	MaxLevel    Level
	ExpiresAt   *int64
	IPAllowlist []string
}

// CreateAPIKey stores a new key and returns it with its plaintext, which is
// never stored and cannot be recovered later.
func (s *Store) CreateAPIKey(ctx context.Context, pepper string, nk NewKey) (*APIKey, string, error) {
	plain := ids.APIKey()
	if !nk.MaxLevel.Valid() {
		nk.MaxLevel = LevelInteract
	}
	if nk.IPAllowlist == nil {
		nk.IPAllowlist = []string{}
	}
	k := &APIKey{ID: ids.ID(), Name: nk.Name, Prefix: plain[:16], CreatedAt: now(),
		MaxLevel: nk.MaxLevel, ExpiresAt: nk.ExpiresAt, IPAllowlist: nk.IPAllowlist}
	_, err := s.exec(ctx, `INSERT INTO api_keys (id, name, prefix, hash, created_at, max_level, expires_at, ip_allowlist) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		k.ID, k.Name, k.Prefix, ids.HashKey(pepper, plain), k.CreatedAt, string(k.MaxLevel), k.ExpiresAt, mustJSON(k.IPAllowlist))
	if err != nil {
		return nil, "", err
	}
	return k, plain, nil
}

// APIKeyByHash returns the key unless it is revoked.
func (s *Store) APIKeyByHash(ctx context.Context, hash string) (*APIKey, error) {
	return scanKey(s.row(ctx, `SELECT `+keyCols+` FROM api_keys WHERE hash = ? AND revoked_at IS NULL`, hash))
}

func (s *Store) APIKey(ctx context.Context, id string) (*APIKey, error) {
	return scanKey(s.row(ctx, `SELECT `+keyCols+` FROM api_keys WHERE id = ?`, id))
}

func (s *Store) TouchAPIKey(ctx context.Context, id string) {
	_, _ = s.exec(ctx, `UPDATE api_keys SET last_used_at = ? WHERE id = ?`, now(), id)
}

func (s *Store) RevokeAPIKey(ctx context.Context, id string) error {
	res, err := s.exec(ctx, `UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`, now(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// --- devices ---

type AppInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Device struct {
	ProjectID string   `json:"projectId"` // project of the latest page
	DeviceID  string   `json:"id"`
	Code      string   `json:"code"`
	UserID    string   `json:"userId"`
	Platform  string   `json:"platform"`
	UA        string   `json:"ua"`
	App       *AppInfo `json:"app"`
	FirstSeen int64    `json:"firstSeenAt"`
	LastSeen  int64    `json:"lastSeenAt"`
	TokenHash string   `json:"-"`
}

const deviceCols = `project_id, device_id, code, user_id, platform, ua, app, first_seen, last_seen, token_hash`

func scanDevice(row interface{ Scan(...any) error }) (*Device, error) {
	var d Device
	var app string
	if err := row.Scan(&d.ProjectID, &d.DeviceID, &d.Code, &d.UserID, &d.Platform, &d.UA, &app, &d.FirstSeen, &d.LastSeen, &d.TokenHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if app != "" {
		d.App = &AppInfo{}
		_ = json.Unmarshal([]byte(app), d.App)
	}
	return &d, nil
}

// UpsertDevice records a sighting of a device (from a page of d.ProjectID)
// and returns it with its permanent device code (assigned on first sight).
func (s *Store) UpsertDevice(ctx context.Context, d Device) (*Device, error) {
	app := ""
	if d.App != nil {
		app = mustJSON(d.App)
	}
	t := now()
	existing, err := s.Device(ctx, d.DeviceID)
	if err == nil {
		_, err = s.exec(ctx, `UPDATE devices SET project_id = ?, user_id = ?, platform = ?, ua = ?, app = ?, last_seen = ? WHERE device_id = ?`,
			d.ProjectID, d.UserID, d.Platform, d.UA, app, t, d.DeviceID)
		if err != nil {
			return nil, err
		}
		existing.ProjectID, existing.UserID, existing.Platform, existing.UA, existing.App, existing.LastSeen = d.ProjectID, d.UserID, d.Platform, d.UA, d.App, t
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	for range 5 {
		d.Code = ids.DeviceCode()
		d.FirstSeen, d.LastSeen = t, t
		_, err = s.exec(ctx, `INSERT INTO devices (`+deviceCols+`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
			d.ProjectID, d.DeviceID, d.Code, d.UserID, d.Platform, d.UA, app, d.FirstSeen, d.LastSeen)
		if err == nil {
			return &d, nil
		}
		if !isUnique(err) {
			return nil, err
		}
	}
	return nil, err
}

func (s *Store) SetDeviceToken(ctx context.Context, deviceID, hash string) error {
	_, err := s.exec(ctx, `UPDATE devices SET token_hash = ? WHERE device_id = ?`, hash, deviceID)
	return err
}

func (s *Store) Device(ctx context.Context, deviceID string) (*Device, error) {
	return scanDevice(s.row(ctx, `SELECT `+deviceCols+` FROM devices WHERE device_id = ?`, deviceID))
}

func (s *Store) DeviceByCode(ctx context.Context, code string) (*Device, error) {
	return scanDevice(s.row(ctx, `SELECT `+deviceCols+` FROM devices WHERE code = ?`, code))
}

// Devices lists the most recently seen devices; projectID ("" for all)
// keeps those whose latest page came from that project.
func (s *Store) Devices(ctx context.Context, projectID string, limit int) ([]*Device, error) {
	rows, err := s.query(ctx, `SELECT `+deviceCols+` FROM devices WHERE ? = '' OR project_id = ? ORDER BY last_seen DESC LIMIT ?`, projectID, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Device{}
	for rows.Next() {
		d, err := scanDevice(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) DeviceStats(ctx context.Context, projectID string) (total int, firstSeen *int64, err error) {
	var first sql.NullInt64
	err = s.row(ctx, `SELECT COUNT(*), MIN(first_seen) FROM devices WHERE project_id = ?`, projectID).Scan(&total, &first)
	if first.Valid {
		firstSeen = &first.Int64
	}
	return
}

// DeviceQuery pages through the devices of the console device list. A search
// term is matched by the hub (hub.DeviceList), which also knows the system
// labels and project names; it lists the candidates with AllDevices.
type DeviceQuery struct {
	ProjectID string // "" for every project; otherwise the project of the latest page
	Offset    int
	Limit     int
}

// SearchDevices returns one page of devices, newest first, and the total.
func (s *Store) SearchDevices(ctx context.Context, q DeviceQuery) ([]*Device, int, error) {
	where, args := []string{"1 = 1"}, []any{}
	if q.ProjectID != "" {
		where, args = append(where, "project_id = ?"), append(args, q.ProjectID)
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := s.row(ctx, `SELECT COUNT(*) FROM devices WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if q.Limit <= 0 || q.Limit > 200 {
		q.Limit = 20
	}
	rows, err := s.query(ctx, `SELECT `+deviceCols+` FROM devices WHERE `+cond+` ORDER BY first_seen DESC, device_id LIMIT ? OFFSET ?`,
		append(args, q.Limit, max(0, q.Offset))...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []*Device{}
	for rows.Next() {
		d, err := scanDevice(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, d)
	}
	return out, total, rows.Err()
}

// AllDevices lists every known device, newest first (the order of
// SearchDevices); projectID ("" for all) keeps those whose latest page came
// from that project.
func (s *Store) AllDevices(ctx context.Context, projectID string) ([]*Device, error) {
	rows, err := s.query(ctx, `SELECT `+deviceCols+` FROM devices WHERE ? = '' OR project_id = ? ORDER BY first_seen DESC, device_id`, projectID, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Device{}
	for rows.Next() {
		d, err := scanDevice(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// CountDevices counts every known device.
func (s *Store) CountDevices(ctx context.Context) (int, error) {
	var n int
	err := s.row(ctx, `SELECT COUNT(*) FROM devices`).Scan(&n)
	return n, err
}
