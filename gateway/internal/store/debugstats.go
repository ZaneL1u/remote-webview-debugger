package store

import (
	"context"
	"fmt"
)

// Debug sessions: one row per agent session started on a device (audit
// attach.start) and per DevTools window opened on a page (audit
// devtools.open). Audit events are purged after the retention period; these
// rows are kept, so the admin overview can count all-time totals.

const debugKindAgent, debugKindDevtools = "agent", "devtools"

func debugKind(action, result string) string {
	if result != "ok" {
		return ""
	}
	switch action {
	case "attach.start":
		return debugKindAgent
	case "devtools.open":
		return debugKindDevtools
	}
	return ""
}

func (s *Store) migrateDebugStats(ctx context.Context, autoID string) error {
	for _, st := range []string{
		`CREATE TABLE IF NOT EXISTS debug_sessions (
			id ` + autoID + `, at BIGINT NOT NULL, kind TEXT NOT NULL, device TEXT NOT NULL,
			project_id TEXT, actor TEXT NOT NULL DEFAULT '')`,
		`CREATE INDEX IF NOT EXISTS debug_sessions_at ON debug_sessions (at)`,
		`CREATE INDEX IF NOT EXISTS debug_sessions_device ON debug_sessions (device)`,
	} {
		if _, err := s.db.ExecContext(ctx, st); err != nil {
			return fmt.Errorf("%w: %s", err, st[:min(60, len(st))])
		}
	}
	// Once: the sessions the audit log still has from before this table.
	const flag = "schema.debug_sessions"
	var v string
	if err := s.row(ctx, `SELECT v FROM settings WHERE k = ?`, flag).Scan(&v); err == nil {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `INSERT INTO debug_sessions (at, kind, device, project_id, actor)
		SELECT at, CASE WHEN action = 'attach.start' THEN 'agent' ELSE 'devtools' END, target, project_id, actor_name
		FROM audit_events WHERE action IN ('attach.start', 'devtools.open') AND result = 'ok' ORDER BY id`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, s.q(`INSERT INTO settings (k, v) VALUES (?, ?)`), flag, "1"); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) recordDebugSession(ctx context.Context, e AuditEvent) error {
	kind := debugKind(e.Action, e.Result)
	if kind == "" {
		return nil
	}
	_, err := s.exec(ctx, `INSERT INTO debug_sessions (at, kind, device, project_id, actor) VALUES (?, ?, ?, ?, ?)`,
		e.At, kind, e.Target, e.ProjectID, e.ActorName)
	return err
}

// DebugDay counts the sessions of one local day (Day: days since the epoch in
// the caller's time zone).
type DebugDay struct {
	Day      int64 `json:"day"`
	Agent    int64 `json:"agent"`
	Devtools int64 `json:"devtools"`
}

type DebugStats struct {
	Total         int64      `json:"total"`
	TotalAgent    int64      `json:"totalAgent"`
	TotalDevtools int64      `json:"totalDevtools"`
	Today         int64      `json:"today"`
	TodayAgent    int64      `json:"todayAgent"`
	TodayDevtools int64      `json:"todayDevtools"`
	Devices       int64      `json:"devices"`      // distinct devices ever debugged
	DevicesToday  int64      `json:"devicesToday"` // distinct devices debugged today
	Days          []DebugDay `json:"days"`         // the last `days` local days, oldest first, zeros included
}

const dayMs = int64(86_400_000)

// DebugStats counts debug sessions. offsetMs is the caller's UTC offset (UTC+8
// is 8h); "today" and the daily series follow that time zone.
func (s *Store) DebugStats(ctx context.Context, nowMs, offsetMs int64, days int) (*DebugStats, error) {
	today := (nowMs + offsetMs) / dayMs
	todayStart := today*dayMs - offsetMs
	first := today - int64(days) + 1
	st := &DebugStats{}
	count := func(dst *int64, q string, args ...any) error {
		return s.row(ctx, q, args...).Scan(dst)
	}
	for _, c := range []struct {
		dst  *int64
		q    string
		args []any
	}{
		{&st.TotalAgent, `SELECT COUNT(*) FROM debug_sessions WHERE kind = ?`, []any{debugKindAgent}},
		{&st.TotalDevtools, `SELECT COUNT(*) FROM debug_sessions WHERE kind = ?`, []any{debugKindDevtools}},
		{&st.TodayAgent, `SELECT COUNT(*) FROM debug_sessions WHERE kind = ? AND at >= ?`, []any{debugKindAgent, todayStart}},
		{&st.TodayDevtools, `SELECT COUNT(*) FROM debug_sessions WHERE kind = ? AND at >= ?`, []any{debugKindDevtools, todayStart}},
		{&st.Devices, `SELECT COUNT(DISTINCT device) FROM debug_sessions`, nil},
		{&st.DevicesToday, `SELECT COUNT(DISTINCT device) FROM debug_sessions WHERE at >= ?`, []any{todayStart}},
	} {
		if err := count(c.dst, c.q, c.args...); err != nil {
			return nil, err
		}
	}
	st.Total = st.TotalAgent + st.TotalDevtools
	st.Today = st.TodayAgent + st.TodayDevtools

	byDay := map[int64]*DebugDay{}
	for d := first; d <= today; d++ {
		byDay[d] = &DebugDay{Day: d}
	}
	rows, err := s.query(ctx, `SELECT (at + ?) / ? AS d, kind, COUNT(*) FROM debug_sessions WHERE at >= ? GROUP BY d, kind`,
		offsetMs, dayMs, first*dayMs-offsetMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var d, n int64
		var kind string
		if err := rows.Scan(&d, &kind, &n); err != nil {
			return nil, err
		}
		if day := byDay[d]; day != nil {
			if kind == debugKindAgent {
				day.Agent += n
			} else {
				day.Devtools += n
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for d := first; d <= today; d++ {
		st.Days = append(st.Days, *byDay[d])
	}
	return st, nil
}
