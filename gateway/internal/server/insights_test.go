package server

import (
	"context"
	"testing"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// The admin overview counts agent sessions and DevTools windows today, all
// time and per device, in the viewer's time zone; members cannot read it.
func TestInsights(t *testing.T) {
	f := setup(t, "")
	ctx := context.Background()
	pid := f.project.ID
	now := time.Now()
	add := func(at time.Time, action, device, result string) {
		if err := f.st.InsertAudit(ctx, store.AuditEvent{At: at.UnixMilli(), ProjectID: &pid, ActorType: "apikey",
			ActorID: "k", ActorName: "bot", Action: action, Target: device, Result: result}); err != nil {
			t.Fatal(err)
		}
	}
	add(now, "attach.start", "AAAA-1111", "ok")
	add(now, "attach.start", "AAAA-1111", "ok")
	add(now, "devtools.open", "BBBB-2222", "ok")
	add(now, "attach.start", "CCCC-3333", "denied") // not a session
	add(now, "attach.end", "AAAA-1111", "ok")       // not a start
	add(now.AddDate(0, 0, -3), "attach.start", "DDDD-4444", "ok")
	add(now.AddDate(0, 0, -40), "devtools.open", "AAAA-1111", "ok") // outside the 14-day series

	owner := f.login("owner@test", "password1")
	code, body := owner.do("GET", "/insights?tz=0", nil)
	if code != 200 {
		t.Fatalf("insights: %d %v", code, body)
	}
	d := body["debug"].(map[string]any)
	want := map[string]float64{"total": 5, "totalAgent": 3, "totalDevtools": 2, "today": 3, "todayAgent": 2,
		"todayDevtools": 1, "devices": 3, "devicesToday": 2}
	for k, v := range want {
		if d[k] != v {
			t.Errorf("debug.%s = %v, want %v", k, d[k], v)
		}
	}
	days := d["days"].([]any)
	if len(days) != 14 {
		t.Fatalf("days: %d", len(days))
	}
	last := days[13].(map[string]any)
	if last["agent"] != 2.0 || last["devtools"] != 1.0 {
		t.Errorf("today in series: %v", last)
	}
	if three := days[10].(map[string]any); three["agent"] != 1.0 {
		t.Errorf("three days ago: %v", three)
	}
	rt := body["runtime"].(map[string]any)
	if rt["goroutines"].(float64) < 1 || rt["heapBytes"].(float64) <= 0 {
		t.Errorf("runtime: %v", rt)
	}
	if _, ok := body["live"].(map[string]any)["wsConnections"]; !ok {
		t.Errorf("live: %v", body["live"])
	}

	member, _ := f.addMember(owner, "member@example.com", "member")
	if code, _ := member.do("GET", "/insights", nil); code != 403 {
		t.Errorf("member insights: %d, want 403", code)
	}
}
