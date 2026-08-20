package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
)

// --- device invites ---

type DeviceInvite struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"projectId"`
	Note      string  `json:"note"`
	URL       string  `json:"-"`
	Link      string  `json:"link"`
	ExpiresAt int64   `json:"expiresAt"`
	UsedAt    *int64  `json:"usedAt"`
	DeviceID  *string `json:"deviceId"`
	CreatedBy string  `json:"createdBy"`
	CreatedAt int64   `json:"createdAt"`
}

const inviteCols = `id, project_id, note, url, expires_at, used_at, device_id, created_by, created_at`

func scanInvite(row interface{ Scan(...any) error }) (*DeviceInvite, error) {
	var v DeviceInvite
	var used sql.NullInt64
	var dev sql.NullString
	if err := row.Scan(&v.ID, &v.ProjectID, &v.Note, &v.URL, &v.ExpiresAt, &used, &dev, &v.CreatedBy, &v.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if used.Valid {
		v.UsedAt = &used.Int64
	}
	if dev.Valid {
		v.DeviceID = &dev.String
	}
	return &v, nil
}

// CreateDeviceInvite returns the invite and its token (stored hashed).
func (s *Store) CreateDeviceInvite(ctx context.Context, pepper, projectID, note, url, createdBy string, expiresAt int64) (*DeviceInvite, string, error) {
	token := ids.Secret(16)
	v := &DeviceInvite{ID: ids.ID(), ProjectID: projectID, Note: note, URL: url, ExpiresAt: expiresAt, CreatedBy: createdBy, CreatedAt: now()}
	_, err := s.exec(ctx, `INSERT INTO device_invites (id, project_id, token_hash, note, url, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		v.ID, projectID, ids.HashKey(pepper, token), note, url, expiresAt, createdBy, v.CreatedAt)
	return v, token, err
}

func (s *Store) DeviceInvites(ctx context.Context, projectID string) ([]*DeviceInvite, error) {
	rows, err := s.query(ctx, `SELECT `+inviteCols+` FROM device_invites WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*DeviceInvite{}
	for rows.Next() {
		v, err := scanInvite(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Store) DeviceInvite(ctx context.Context, id string) (*DeviceInvite, error) {
	return scanInvite(s.row(ctx, `SELECT `+inviteCols+` FROM device_invites WHERE id = ?`, id))
}

func (s *Store) DeleteDeviceInvite(ctx context.Context, id string) error {
	res, err := s.exec(ctx, `DELETE FROM device_invites WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// UseDeviceInvite consumes a valid, unused invite of the project.
func (s *Store) UseDeviceInvite(ctx context.Context, pepper, projectID, token, deviceID string) (*DeviceInvite, error) {
	v, err := scanInvite(s.row(ctx, `SELECT `+inviteCols+` FROM device_invites WHERE token_hash = ? AND project_id = ?`, ids.HashKey(pepper, token), projectID))
	if err != nil {
		return nil, err
	}
	if v.UsedAt != nil || now() > v.ExpiresAt {
		return nil, ErrNotFound
	}
	res, err := s.exec(ctx, `UPDATE device_invites SET used_at = ?, device_id = ? WHERE id = ? AND used_at IS NULL`, now(), deviceID, v.ID)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	t := now()
	v.UsedAt, v.DeviceID = &t, &deviceID
	return v, nil
}

// --- audit ---

type AuditEvent struct {
	ID        int64          `json:"id"`
	At        int64          `json:"at"`
	ProjectID *string        `json:"projectId"`
	ActorType string         `json:"actorType"`
	ActorID   string         `json:"actorId"`
	ActorName string         `json:"actorName"`
	Action    string         `json:"action"`
	Target    string         `json:"target"`
	Result    string         `json:"result"`
	Detail    map[string]any `json:"detail"`
}

func (s *Store) InsertAudit(ctx context.Context, e AuditEvent) error {
	if e.At == 0 {
		e.At = now()
	}
	if e.Result == "" {
		e.Result = "ok"
	}
	if e.Detail == nil {
		e.Detail = map[string]any{}
	}
	_, err := s.exec(ctx, `INSERT INTO audit_events (at, project_id, actor_type, actor_id, actor_name, action, target, result, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.At, e.ProjectID, e.ActorType, e.ActorID, e.ActorName, e.Action, e.Target, e.Result, mustJSON(e.Detail))
	return err
}

type AuditQuery struct {
	ProjectID string
	Target    string // device code etc.
	Actor     string // actor id or name
	Action    string // prefix match, e.g. "attach."
	From, To  int64
	Before    int64
	Limit     int
}

func (s *Store) Audit(ctx context.Context, q AuditQuery) ([]AuditEvent, error) {
	where := []string{"1=1"}
	args := []any{}
	if q.ProjectID != "" {
		where, args = append(where, "project_id = ?"), append(args, q.ProjectID)
	}
	if q.Target != "" {
		where, args = append(where, "target = ?"), append(args, q.Target)
	}
	if q.Actor != "" {
		where, args = append(where, "(actor_id = ? OR actor_name = ?)"), append(args, q.Actor, q.Actor)
	}
	if q.Action != "" {
		where, args = append(where, "action LIKE ?"), append(args, q.Action+"%")
	}
	if q.From > 0 {
		where, args = append(where, "at >= ?"), append(args, q.From)
	}
	if q.To > 0 {
		where, args = append(where, "at <= ?"), append(args, q.To)
	}
	if q.Before > 0 {
		where, args = append(where, "id < ?"), append(args, q.Before)
	}
	if q.Limit <= 0 || q.Limit > 200 {
		q.Limit = 50
	}
	args = append(args, q.Limit)
	rows, err := s.query(ctx, `SELECT id, at, project_id, actor_type, actor_id, actor_name, action, target, result, detail FROM audit_events WHERE `+
		strings.Join(where, " AND ")+` ORDER BY id DESC LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditEvent{}
	for rows.Next() {
		var e AuditEvent
		var pid sql.NullString
		var detail string
		if err := rows.Scan(&e.ID, &e.At, &pid, &e.ActorType, &e.ActorID, &e.ActorName, &e.Action, &e.Target, &e.Result, &detail); err != nil {
			return nil, err
		}
		if pid.Valid {
			e.ProjectID = &pid.String
		}
		_ = json.Unmarshal([]byte(detail), &e.Detail)
		if e.Detail == nil {
			e.Detail = map[string]any{}
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) PurgeAudit(ctx context.Context, before int64) (int64, error) {
	res, err := s.exec(ctx, `DELETE FROM audit_events WHERE at < ?`, before)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
