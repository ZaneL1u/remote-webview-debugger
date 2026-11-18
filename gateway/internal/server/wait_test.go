package server

import (
	"testing"
	"time"
)

// wait_for with timeSec over 20 s used to hit the 20 s page RPC timeout.
func TestWaitForTimeout(t *testing.T) {
	cases := []struct {
		method string
		params any
		want   time.Duration
	}{
		{"rwd.waitFor", map[string]any{"timeoutMs": 10000, "timeMs": 30000}, 40 * time.Second},
		{"rwd.waitFor", map[string]any{"timeoutMs": 10000}, 10 * time.Second},
		{"rwd.click", map[string]any{"timeMs": 30000}, 0},
		{"rwd.waitFor", nil, 0},
	}
	for _, c := range cases {
		if got := waitFor(c.method, c.params); got != c.want {
			t.Errorf("waitFor(%s, %v) = %v, want %v", c.method, c.params, got, c.want)
		}
	}
}
