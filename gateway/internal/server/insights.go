package server

import (
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// GET /v1/api/insights (owner / admin): the admin overview. How hard the
// gateway works right now (process CPU and memory, host load, live
// connections) and how much debugging it has carried (docs/protocol.md
// section 12.5). ?tz= is the browser's Date.getTimezoneOffset() in minutes,
// so "today" and the daily series follow the viewer's clock.
func (s *Server) insights(w http.ResponseWriter, r *http.Request) {
	tz, _ := strconv.Atoi(r.URL.Query().Get("tz"))
	if tz < -14*60 || tz > 14*60 {
		tz = 0
	}
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days < 1 || days > 90 {
		days = 14
	}
	now := time.Now()
	debug, err := s.store.DebugStats(r.Context(), now.UnixMilli(), -int64(tz)*60_000, days)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	m := s.hub.Metrics()
	online := 0
	for _, n := range m.OnlineDevices {
		online += n
	}
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	rt := map[string]any{
		"goroutines": runtime.NumGoroutine(),
		"heapBytes":  ms.HeapAlloc,
		"sysBytes":   ms.Sys,
		"gcCount":    ms.NumGC,
		"cpus":       runtime.NumCPU(),
		"uptimeSec":  int64(time.Since(s.started).Seconds()),
		"os":         runtime.GOOS + "/" + runtime.GOARCH,
	}
	if pct, ok := cpuPercent(); ok {
		rt["cpuPercent"] = pct
	}
	if l := loadAvg(); l != nil {
		rt["load"] = l
	}
	if total, avail, ok := hostMemory(); ok {
		rt["memTotalBytes"], rt["memAvailableBytes"] = total, avail
	}
	writeJSON(w, map[string]any{
		"serverTime": now.UnixMilli(),
		"runtime":    rt,
		"live": map[string]any{
			"wsConnections": m.WSConnections, "connectedPages": m.ConnectedPages, "onlineDevices": online,
			"attachedAgents": m.AttachedAgents, "helpDevices": m.HelpDevices, "pendingApprovals": m.PendingApprovals,
		},
		"debug": debug,
	})
}

// cpuPercent is the gateway process's CPU use since the previous call (100 =
// one core busy), from getrusage; the first call measures since start.
var cpuSample struct {
	sync.Mutex
	at  time.Time
	cpu time.Duration
}

func cpuPercent() (float64, bool) {
	used, ok := processCPU()
	if !ok {
		return 0, false
	}
	cpuSample.Lock()
	defer cpuSample.Unlock()
	now := time.Now()
	prevAt, prevCPU := cpuSample.at, cpuSample.cpu
	if prevAt.IsZero() {
		prevAt, prevCPU = processStart, 0
	}
	cpuSample.at, cpuSample.cpu = now, used
	wall := now.Sub(prevAt)
	if wall <= 0 {
		return 0, true
	}
	return float64(used-prevCPU) / float64(wall) * 100, true
}

var processStart = time.Now()

// loadAvg reads the host's 1, 5 and 15 minute load averages (Linux only).
func loadAvg() []float64 {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return nil
	}
	f := strings.Fields(string(b))
	if len(f) < 3 {
		return nil
	}
	out := make([]float64, 0, 3)
	for _, s := range f[:3] {
		v, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return nil
		}
		out = append(out, v)
	}
	return out
}

// hostMemory reads MemTotal and MemAvailable (Linux only).
func hostMemory() (total, avail uint64, ok bool) {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, false
	}
	for _, line := range strings.Split(string(b), "\n") {
		f := strings.Fields(line)
		if len(f) < 2 {
			continue
		}
		kb, err := strconv.ParseUint(f[1], 10, 64)
		if err != nil {
			continue
		}
		switch f[0] {
		case "MemTotal:":
			total = kb * 1024
		case "MemAvailable:":
			avail = kb * 1024
		}
	}
	return total, avail, total > 0
}
