package hub

import (
	"sort"
	"sync"
	"time"
)

var durationBuckets = []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30}

type rpcStat struct {
	ok, errors uint64
	buckets    []uint64 // cumulative counts per durationBuckets, plus +Inf
	sum        float64
}

type stats struct {
	mu    sync.Mutex
	rpc   map[string]*rpcStat
	conns int64
}

func (s *stats) observe(method string, d time.Duration, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r := s.rpc[method]
	if r == nil {
		r = &rpcStat{buckets: make([]uint64, len(durationBuckets)+1)}
		s.rpc[method] = r
	}
	if err != nil {
		r.errors++
	} else {
		r.ok++
	}
	sec := d.Seconds()
	r.sum += sec
	for i, b := range durationBuckets {
		if sec <= b {
			r.buckets[i]++
		}
	}
	r.buckets[len(durationBuckets)]++
}

// Metrics is a point-in-time view for the /metrics endpoint.
type Metrics struct {
	OnlineDevices    map[string]int // by project
	ConnectedPages   int
	AttachedAgents   int
	HelpDevices      int
	PendingApprovals int
	WSConnections    int64
	RPC              []RPCMetric
	Buckets          []float64
}

type RPCMetric struct {
	Method      string
	OK, Errors  uint64
	Buckets     []uint64
	SumSeconds  float64
	CountSecond uint64
}

func (h *Hub) Metrics() Metrics {
	m := Metrics{OnlineDevices: map[string]int{}, Buckets: durationBuckets}
	h.mu.Lock()
	for _, d := range h.devices {
		if d.online() {
			m.OnlineDevices[d.Info.ProjectID]++
		}
		m.ConnectedPages += d.connectedPages()
		if d.agent != nil {
			m.AttachedAgents++
		}
		if d.Help && d.online() {
			m.HelpDevices++
		}
		if d.Pending != nil {
			m.PendingApprovals++
		}
	}
	h.mu.Unlock()
	h.stats.mu.Lock()
	m.WSConnections = h.stats.conns
	for method, r := range h.stats.rpc {
		m.RPC = append(m.RPC, RPCMetric{Method: method, OK: r.ok, Errors: r.errors, Buckets: append([]uint64{}, r.buckets...),
			SumSeconds: r.sum, CountSecond: r.ok + r.errors})
	}
	h.stats.mu.Unlock()
	sort.Slice(m.RPC, func(i, j int) bool { return m.RPC[i].Method < m.RPC[j].Method })
	return m
}
