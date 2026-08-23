package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// --- audit ---

// recordEvent queues an audit event; it never blocks (events are dropped,
// with a log line, if the writer falls far behind).
func (s *Server) recordEvent(e store.AuditEvent) {
	if e.At == 0 {
		e.At = time.Now().UnixMilli()
	}
	select {
	case s.audit <- e:
	default:
		s.log.Warn("audit queue full; dropping event", "action", e.Action)
	}
}

func (s *Server) auditMember(r *http.Request, projectID, action, target, result string, detail map[string]any) {
	u := currentUser(r)
	e := store.AuditEvent{ActorType: "member", Action: action, Target: target, Result: result, Detail: detail}
	if u != nil {
		e.ActorID, e.ActorName = u.ID, u.Email
	}
	if projectID != "" {
		e.ProjectID = &projectID
	}
	s.recordEvent(e)
}

func (s *Server) auditWriter() {
	retention := s.cfg.AuditRetentionDays
	if retention <= 0 {
		retention = 180
	}
	purge := time.NewTicker(6 * time.Hour)
	defer purge.Stop()
	for {
		select {
		case e := <-s.audit:
			if err := s.store.InsertAudit(context.Background(), e); err != nil {
				s.log.Warn("audit write failed", "err", err)
			}
		case <-purge.C:
			before := time.Now().AddDate(0, 0, -retention).UnixMilli()
			if n, err := s.store.PurgeAudit(context.Background(), before); err == nil && n > 0 {
				s.log.Info("purged audit events", "count", n)
			}
		}
	}
}

// flushAudit waits until queued events are written (tests).
func (s *Server) flushAudit() {
	for i := 0; i < 200 && len(s.audit) > 0; i++ {
		time.Sleep(5 * time.Millisecond)
	}
	time.Sleep(20 * time.Millisecond)
}

func (s *Server) listAudit(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	num := func(k string) int64 { n, _ := strconv.ParseInt(q.Get(k), 10, 64); return n }
	limit := int(num("limit"))
	events, err := s.store.Audit(r.Context(), store.AuditQuery{ProjectID: q.Get("project"), Target: q.Get("device"),
		Actor: q.Get("actor"), Action: q.Get("action"), From: num("from"), To: num("to"), Before: num("before"), Limit: limit})
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	var next any
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if len(events) == limit {
		next = events[len(events)-1].ID
	}
	writeJSON(w, map[string]any{"events": events, "nextBefore": next})
}

// --- live updates (SSE) ---

func (s *Server) stream(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("project") // "" streams every project
	if projectID != "" {
		if _, err := s.store.Project(r.Context(), projectID); err != nil {
			s.storeErr(w, r, err)
			return
		}
	}
	fl, ok := w.(http.Flusher)
	if !ok {
		s.fail(w, r, http.StatusInternalServerError, "internal", i18n.APIStreamingUnsupported)
		return
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Accel-Buffering", "no")
	lang := s.lang(r)
	updates, cancel := s.hub.Subscribe(projectID)
	defer cancel()
	fmt.Fprint(w, "retry: 3000\n\n")
	fl.Flush()
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ping.C:
			fmt.Fprint(w, "event: ping\ndata: {}\n\n")
		case u := <-updates:
			var data []byte
			switch u.Kind {
			case "device":
				data, _ = json.Marshal(u.Device.In(lang))
			case "timeline":
				data, _ = json.Marshal(map[string]any{"deviceId": u.DeviceID, "event": u.Event.In(lang)})
			default:
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", u.Kind, data)
		}
		fl.Flush()
	}
}

// --- metrics ---

type httpCounter struct {
	mu    sync.Mutex
	codes map[int]uint64
}

type statusWriter struct {
	http.ResponseWriter
	code int
}

func (w *statusWriter) WriteHeader(code int) {
	w.code = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Unwrap lets http.ResponseController and websocket.Accept reach the
// underlying writer (hijacking).
func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (s *Server) countCodes(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w, code: 200}
		next.ServeHTTP(sw, r)
		s.httpCodes.mu.Lock()
		if s.httpCodes.codes == nil {
			s.httpCodes.codes = map[int]uint64{}
		}
		s.httpCodes.codes[sw.code]++
		s.httpCodes.mu.Unlock()
	})
}

func (s *Server) metrics(w http.ResponseWriter, r *http.Request) {
	if s.cfg.MetricsToken != "" && r.Header.Get("Authorization") != "Bearer "+s.cfg.MetricsToken {
		s.fail(w, r, http.StatusUnauthorized, "unauthorized", i18n.APIMetricsToken)
		return
	}
	m := s.hub.Metrics()
	var b strings.Builder
	b.WriteString("# TYPE rwd_online_devices gauge\n")
	projects := make([]string, 0, len(m.OnlineDevices))
	for p := range m.OnlineDevices {
		projects = append(projects, p)
	}
	sort.Strings(projects)
	for _, p := range projects {
		fmt.Fprintf(&b, "rwd_online_devices{project=%q} %d\n", p, m.OnlineDevices[p])
	}
	fmt.Fprintf(&b, "# TYPE rwd_connected_pages gauge\nrwd_connected_pages %d\n", m.ConnectedPages)
	fmt.Fprintf(&b, "# TYPE rwd_attached_agents gauge\nrwd_attached_agents %d\n", m.AttachedAgents)
	fmt.Fprintf(&b, "# TYPE rwd_ws_connections gauge\nrwd_ws_connections %d\n", m.WSConnections)
	b.WriteString("# TYPE rwd_rpc_total counter\n")
	for _, r := range m.RPC {
		fmt.Fprintf(&b, "rwd_rpc_total{method=%q,result=\"ok\"} %d\n", r.Method, r.OK)
		fmt.Fprintf(&b, "rwd_rpc_total{method=%q,result=\"error\"} %d\n", r.Method, r.Errors)
	}
	b.WriteString("# TYPE rwd_rpc_duration_seconds histogram\n")
	for _, r := range m.RPC {
		for i, le := range m.Buckets {
			fmt.Fprintf(&b, "rwd_rpc_duration_seconds_bucket{method=%q,le=\"%g\"} %d\n", r.Method, le, r.Buckets[i])
		}
		fmt.Fprintf(&b, "rwd_rpc_duration_seconds_bucket{method=%q,le=\"+Inf\"} %d\n", r.Method, r.Buckets[len(m.Buckets)])
		fmt.Fprintf(&b, "rwd_rpc_duration_seconds_sum{method=%q} %g\n", r.Method, r.SumSeconds)
		fmt.Fprintf(&b, "rwd_rpc_duration_seconds_count{method=%q} %d\n", r.Method, r.CountSecond)
	}
	b.WriteString("# TYPE rwd_http_requests_total counter\n")
	s.httpCodes.mu.Lock()
	codes := make([]int, 0, len(s.httpCodes.codes))
	for c := range s.httpCodes.codes {
		codes = append(codes, c)
	}
	sort.Ints(codes)
	for _, c := range codes {
		fmt.Fprintf(&b, "rwd_http_requests_total{code=\"%d\"} %d\n", c, s.httpCodes.codes[c])
	}
	s.httpCodes.mu.Unlock()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	w.Write([]byte(b.String()))
}
