package hub

// Update is pushed to console subscribers (SSE) of a project.
type Update struct {
	Kind     string      `json:"-"` // device | timeline
	Device   *DeviceView `json:"device,omitempty"`
	DeviceID string      `json:"deviceId,omitempty"`
	Event    *Event      `json:"event,omitempty"`
}

// Subscribe returns a channel of updates for a project ("" for every
// project). Slow subscribers miss updates rather than block the hub; the
// console re-fetches on reconnect.
func (h *Hub) Subscribe(projectID string) (<-chan Update, func()) {
	ch := make(chan Update, 64)
	h.mu.Lock()
	if h.subs[projectID] == nil {
		h.subs[projectID] = map[chan Update]struct{}{}
	}
	h.subs[projectID][ch] = struct{}{}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		delete(h.subs[projectID], ch)
		h.mu.Unlock()
	}
}

// publish is called with h.mu held.
func (h *Hub) publish(projectID string, u Update) {
	for _, key := range []string{projectID, ""} {
		for ch := range h.subs[key] {
			select {
			case ch <- u:
			default:
			}
		}
	}
}
