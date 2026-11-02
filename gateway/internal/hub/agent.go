package hub

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// Session is what a tool call works with: the agent, its device and the page
// it targets, resolved under the hub lock.
type Session struct {
	Agent  *Agent
	Device *Device
	PageID string
	Label  string
}

// Agent returns (and creates) the agent of an API key.
func (h *Hub) Agent(keyID, name, keyHint string, maxLevel store.Level) *Agent {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.agent(keyID, name, keyHint, maxLevel)
}

// policyFor merges the policies of the projects whose pages are open on the
// device, keeping the strictest of each setting: a page from a project that
// asks the user first makes the whole device ask first.
func (h *Hub) policyFor(ctx context.Context, projectIDs []string) (store.Policy, error) {
	var out store.Policy
	for i, id := range projectIDs {
		p, err := h.store.Project(ctx, id)
		if errors.Is(err, store.ErrNotFound) {
			continue // deleted since; its pages are about to go
		}
		if err != nil {
			return out, err
		}
		pol := p.Policy
		if i == 0 || out.Approval == "" {
			out = pol
			continue
		}
		if pol.Approval == "prompt" {
			out.Approval = "prompt"
		}
		out.MaxLevel = store.MinLevel(out.MaxLevel, pol.MaxLevel)
		out.AgentIdleMinutes = min(out.AgentIdleMinutes, pol.AgentIdleMinutes)
		out.AttachMaxMinutes = min(out.AttachMaxMinutes, pol.AttachMaxMinutes)
		if pol.MaxAgents > 0 && (out.MaxAgents == 0 || pol.MaxAgents < out.MaxAgents) {
			out.MaxAgents = pol.MaxAgents
		}
	}
	if out.Approval == "" {
		out = store.DefaultPolicy() // no known project: the safe default
	}
	return out, nil
}

const (
	approvalTimeout = 30 * time.Second
	denyLimit       = 3
	denyLockout     = 10 * time.Minute
	enumLimit       = 5 // failed device lookups per minute per API key
)

// lookupFailed throttles guessing device codes with one API key.
func (h *Hub) lookupFailed(keyID string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	e := h.enum[keyID]
	if e == nil || time.Now().After(e.until) {
		e = &denial{until: time.Now().Add(time.Minute)}
		h.enum[keyID] = e
	}
	e.count++
	if e.count > enumLimit {
		return errorf(i18n.ErrTooManyLookups)
	}
	return nil
}

func (h *Hub) lookupBlocked(keyID string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	e := h.enum[keyID]
	return e != nil && time.Now().Before(e.until) && e.count > enumLimit
}

// Connect attaches the agent to a device at the requested level, asking the
// user on the device first when a project of its open pages requires it. It
// replaces any other agent on the device.
func (h *Hub) Connect(ctx context.Context, a *Agent, ref string, follow bool, want store.Level) (DeviceView, []PageView, error) {
	if h.lookupBlocked(a.KeyID) {
		return DeviceView{}, nil, errorf(i18n.ErrTooManyLookups)
	}
	info, err := h.resolveDevice(ctx, ref)
	if err != nil {
		if lerr := h.lookupFailed(a.KeyID); lerr != nil {
			return DeviceView{}, nil, lerr
		}
		return DeviceView{}, nil, errorf(i18n.ErrDeviceNotFoundHint, ref)
	}
	h.mu.Lock()
	projectIDs := []string{info.ProjectID}
	if d := h.devices[deviceKey(info.DeviceID)]; d != nil {
		projectIDs = d.projects()
	}
	h.mu.Unlock()
	pol, err := h.policyFor(ctx, projectIDs)
	if err != nil {
		return DeviceView{}, nil, err
	}
	if !want.Valid() {
		want = store.LevelInteract
	}
	level := store.MinLevel(want, a.MaxLevel, pol.MaxLevel)

	h.mu.Lock()
	d := h.devices[deviceKey(info.DeviceID)]
	if d == nil || d.connectedPages() == 0 {
		if d != nil {
			d.pollConnect = true
		}
		v := h.viewOf(*info, d)
		h.mu.Unlock()
		return v, nil, errorf(i18n.ErrDeviceOffline, info.Code)
	}
	if d.agent == a {
		// Already attached: only follow mode can change without asking again.
		a.Follow = follow
		v, pages := h.viewOf(d.Info, d), pagesOf(d)
		h.mu.Unlock()
		return v, pages, nil
	}
	if pol.MaxAgents > 0 {
		n := 0
		for _, other := range h.devices {
			if other.agent != nil && other != d && slices.ContainsFunc(projectIDs, other.hasProject) {
				n++
			}
		}
		if n >= pol.MaxAgents {
			h.mu.Unlock()
			return DeviceView{}, nil, errorf(i18n.ErrAgentLimit, pol.MaxAgents)
		}
	}

	dk := a.KeyID + "|" + d.Key
	if g := h.grants[dk]; g != nil && pol.Approval == "prompt" && time.Now().Before(g.until) {
		// The user approved this key a few minutes ago: come back at no more
		// than the level they granted then. Coming back does not use the
		// grant up: it starts a fresh window, which release() renews again
		// when the agent lets go.
		level = store.MinLevel(level, g.level)
		g.until = time.Now().Add(reattachGrace)
		h.record(d.Info.ProjectID, "apikey", a.KeyID, a.Name, "attach.resume", d.Info.Code, "ok", map[string]any{"level": level})
	} else if pol.Approval == "prompt" {
		if dn := h.denials[dk]; dn != nil && dn.count >= denyLimit && time.Now().Before(dn.until) {
			h.mu.Unlock()
			return DeviceView{}, nil, errorf(i18n.ErrDeniedLockout, int(time.Until(dn.until).Minutes())+1)
		}
		if d.Pending != nil {
			h.mu.Unlock()
			return DeviceView{}, nil, errorf(i18n.ErrPendingOther)
		}
		focus := d.focused()
		if focus == nil {
			h.mu.Unlock()
			return DeviceView{}, nil, ErrDeviceGone
		}
		levels := []string{}
		for _, l := range []store.Level{store.LevelObserve, store.LevelInteract, store.LevelAdvanced} {
			if l.Rank() <= level.Rank() {
				levels = append(levels, string(l))
			}
		}
		pd := &Pending{Kind: "attach", RequestID: ids.ID(), Agent: a.Name, KeyHint: a.KeyHint, Levels: levels,
			ExpiresAt: time.Now().Add(approvalTimeout).UnixMilli(), decision: make(chan *store.Level, 1)}
		d.Pending = pd
		focus.conn.push(attachRequestMsg(pd))
		d.addEvent("", "agent", i18n.M(i18n.EventAttachRequest, a.Name, level))
		h.record(d.Info.ProjectID, "apikey", a.KeyID, a.Name, "attach.request", d.Info.Code, "ok", map[string]any{"level": level})
		h.mu.Unlock()

		var decided *store.Level
		result := "timeout"
		t := time.NewTimer(approvalTimeout)
		select {
		case decided = <-pd.decision:
			result = "decided"
		case <-t.C:
		case <-ctx.Done():
			result = "cancelled"
		}
		t.Stop()

		h.mu.Lock()
		if d.Pending == pd {
			d.Pending = nil
		}
		if result != "decided" {
			d.broadcast(map[string]any{"t": "attach_cancel", "requestId": pd.RequestID})
		}
		d.notify()
		switch {
		case result == "timeout" || result == "cancelled":
			d.addEvent("", "agent", i18n.M(i18n.EventAttachNoResponse))
			h.record(d.Info.ProjectID, "apikey", a.KeyID, a.Name, "attach.timeout", d.Info.Code, "denied", nil)
			h.mu.Unlock()
			return DeviceView{}, nil, errorf(i18n.ErrApprovalTimeout)
		case decided == nil:
			delete(h.grants, dk)
			dn := h.denials[dk]
			if dn == nil || time.Now().After(dn.until) {
				dn = &denial{until: time.Now().Add(denyLockout)} // counting window
				h.denials[dk] = dn
			}
			dn.count++
			if dn.count >= denyLimit {
				dn.until = time.Now().Add(denyLockout)
			}
			d.addEvent("", "agent", i18n.M(i18n.EventAttachDenied, a.Name))
			h.record(d.Info.ProjectID, "apikey", a.KeyID, a.Name, "attach.deny", d.Info.Code, "denied", nil)
			h.mu.Unlock()
			return DeviceView{}, nil, errorf(i18n.ErrDenied)
		}
		delete(h.denials, dk)
		level = store.MinLevel(level, *decided)
		h.record(d.Info.ProjectID, "apikey", a.KeyID, a.Name, "attach.approve", d.Info.Code, "ok", map[string]any{"level": level})
		if d.connectedPages() == 0 {
			h.mu.Unlock()
			return DeviceView{}, nil, ErrDeviceGone
		}
	}
	defer h.mu.Unlock()

	if a.device != nil && a.device != d {
		h.release(a, i18n.M(i18n.NoteSwitchedDevice))
	}
	if other := d.agent; other != nil && other != a {
		// Like the user ending the session: the replaced agent loses its
		// attach timer and any reattach grant, and has to ask again.
		h.detach(other, i18n.M(i18n.NoteReplaced))
	}
	if d.Task != nil && d.agent != a {
		d.Task = nil
		d.broadcast(taskMsg(nil))
	}
	a.Follow = follow
	a.device = d
	a.Level = level
	a.notes = nil
	if f := d.focused(); f != nil {
		a.pageID = f.ID
	}
	d.agent = a
	d.Level = level
	d.idle = time.Duration(pol.AgentIdleMinutes) * time.Minute
	if d.Help {
		d.Help = false
		d.broadcast(map[string]any{"t": "help", "on": false})
	}
	if a.attachTimer != nil {
		a.attachTimer.Stop()
	}
	maxDur := time.Duration(pol.AttachMaxMinutes) * time.Minute
	a.attachTimer = time.AfterFunc(maxDur, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if a.device == d {
			h.release(a, i18n.M(i18n.NoteAttachExpired, pol.AttachMaxMinutes))
		}
	})
	d.addEvent("", "agent", i18n.M(i18n.EventAttached, a.Name, level))
	h.record(d.Info.ProjectID, "apikey", a.KeyID, a.Name, "attach.start", d.Info.Code, "ok", map[string]any{"level": level})
	if d.Control == ControlNone {
		d.Control = "" // force a broadcast in setControl
		h.setControl(d, ControlObserve, i18n.Msg{})
	} else {
		d.broadcast(controlMsg(d))
	}
	a.cursor = d.seq // the agent learns the current state from this result
	return h.viewOf(d.Info, d), pagesOf(d), nil
}

func (h *Hub) Disconnect(a *Agent) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if a.device == nil {
		return false
	}
	h.release(a, i18n.M(i18n.NoteDisconnected))
	return true
}

// release detaches an agent that let go of the device itself (disconnect,
// switching devices, attach time used up). Unlike the user or an admin ending
// the session, it may come back within reattachGrace without a new approval.
func (h *Hub) release(a *Agent, reason i18n.Msg) {
	d := a.device
	if d == nil || d.agent != a {
		h.detach(a, reason)
		return
	}
	level := d.Level
	h.detach(a, reason)
	if level != "" {
		h.grants[a.KeyID+"|"+d.Key] = &grant{level: level, until: time.Now().Add(reattachGrace)}
	}
}

// Current resolves the agent's device and page. page may name another page
// (label) for this call only.
func (h *Hub) Current(a *Agent, page string) (*Session, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := a.device
	if d == nil {
		return nil, ErrNoDevice
	}
	var p *Page
	if page != "" {
		p = d.pageByLabel(page)
		if p == nil {
			return nil, errorf(i18n.ErrNoSuchPage, page)
		}
	} else {
		p = d.pages[a.pageID]
		if p == nil || !p.Connected() {
			if f := d.focused(); f != nil {
				p = f
				a.pageID = f.ID
			}
		}
	}
	if p == nil {
		return nil, ErrDeviceGone
	}
	return &Session{Agent: a, Device: d, PageID: p.ID, Label: p.Label}, nil
}

func (h *Hub) SelectPage(a *Agent, label string) (*PageView, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := a.device
	if d == nil {
		return nil, ErrNoDevice
	}
	p := d.pageByLabel(label)
	if p == nil {
		return nil, errorf(i18n.ErrNoSuchPage, label)
	}
	a.pageID = p.ID
	for _, pv := range pagesOf(d) {
		if pv.ID == p.ID {
			return &pv, nil
		}
	}
	return nil, ErrNoPage
}

func (h *Hub) Pages(a *Agent) ([]PageView, string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := a.device
	if d == nil {
		return nil, "", ErrNoDevice
	}
	return pagesOf(d), a.pageID, nil
}

// BeginInteraction moves the device into agent control before an action, or
// refuses if the user has taken over.
func (h *Hub) BeginInteraction(s *Session) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := s.Device
	if d.agent != s.Agent {
		return ErrNoDevice
	}
	switch d.Control {
	case ControlUser:
		return ErrTakeover
	case ControlAgent:
		d.lastInteract = time.Now()
	default:
		h.setControl(d, ControlAgent, i18n.Msg{})
	}
	return nil
}

// Delta returns what happened on the device since the agent last looked.
func (h *Hub) Delta(a *Agent) []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	lines := append([]string{}, a.notes...)
	a.notes = nil
	d := a.device
	if d == nil {
		return lines
	}
	for _, e := range d.timeline {
		if e.Seq <= a.cursor {
			continue
		}
		switch e.Kind {
		case "agent":
			continue // the agent knows it connected
		case "user_tap":
			if d.Control != ControlUser {
				continue // only user activity while they hold control is news
			}
		}
		prefix := ""
		if e.Page != "" && !strings.HasPrefix(e.Summary, e.Page) {
			prefix = e.Page + " "
		}
		lines = append(lines, prefix+e.Summary)
	}
	a.cursor = d.seq
	const max = 20
	if len(lines) > max {
		lines = append([]string{h.lang.T(i18n.NoteDeltaOmitted, len(lines)-max)}, lines[len(lines)-max:]...)
	}
	return lines
}

func (h *Hub) Timeline(a *Agent, limit int) ([]Event, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := a.device
	if d == nil {
		return nil, ErrNoDevice
	}
	tl := d.timeline
	if limit > 0 && len(tl) > limit {
		tl = tl[len(tl)-limit:]
	}
	a.cursor = d.seq
	return append([]Event{}, tl...), nil
}

// WaitDevice waits until a device has a connected page. Polling devices are
// asked to reconnect right away.
func (h *Hub) WaitDevice(ctx context.Context, ref string) (*DeviceView, error) {
	info, err := h.resolveDevice(ctx, ref)
	if err != nil {
		return nil, errorf(i18n.ErrDeviceNotFound, ref)
	}
	for {
		h.mu.Lock()
		d := h.device(*info)
		if d.connectedPages() > 0 {
			v := h.viewOf(d.Info, d)
			h.mu.Unlock()
			return &v, nil
		}
		d.pollConnect = true
		ch := d.wait()
		h.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return nil, errorf(i18n.ErrWaitDevice, info.Code)
		}
	}
}

// WaitPage waits for a page matching the filters that was opened (or
// navigated) after the call started.
func (h *Hub) WaitPage(ctx context.Context, a *Agent, urlContains, titleContains string) (*PageView, error) {
	h.mu.Lock()
	d := a.device
	if d == nil {
		h.mu.Unlock()
		return nil, ErrNoDevice
	}
	// Count events since the agent's previous tool call: a navigation started
	// by the last action may already have finished before this call.
	start := a.cursor
	h.mu.Unlock()
	match := func(p *Page) bool {
		return p.Connected() && (urlContains == "" || strings.Contains(p.URL, urlContains)) &&
			(titleContains == "" || strings.Contains(p.Title, titleContains))
	}
	for {
		h.mu.Lock()
		for _, e := range d.timeline {
			if e.Seq <= start || (e.Kind != "opened" && e.Kind != "navigated" && e.Kind != "reloaded") {
				continue
			}
			if p := d.pageByLabel(e.Page); p != nil && match(p) {
				for _, pv := range pagesOf(d) {
					if pv.ID == p.ID {
						h.mu.Unlock()
						return &pv, nil
					}
				}
			}
		}
		ch := d.wait()
		h.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return nil, errorf(i18n.ErrWaitPage)
		}
	}
}

// WaitControl waits until the user hands control back (or ends).
func (h *Hub) WaitControl(ctx context.Context, a *Agent) (string, error) {
	for {
		h.mu.Lock()
		d := a.device
		if d == nil {
			h.mu.Unlock()
			return ControlNone, ErrNoDevice
		}
		if d.Control != ControlUser {
			state := d.Control
			h.mu.Unlock()
			return state, nil
		}
		ch := d.wait()
		h.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return ControlUser, errorf(i18n.ErrWaitControl)
		}
	}
}

// --- console operations ---

// TestDevice runs a snapshot on the device's focused page.
func (h *Hub) TestDevice(ctx context.Context, deviceID string, l i18n.Lang) (map[string]any, error) {
	h.mu.Lock()
	d := h.devices[deviceKey(deviceID)]
	var p *Page
	if d != nil {
		p = d.focused()
	}
	if p == nil {
		h.mu.Unlock()
		return map[string]any{"ok": false, "error": map[string]string{"code": "device_offline", "message": l.T(i18n.ErrTestOffline)}}, nil
	}
	pageInfo := map[string]any{"label": p.Label, "url": p.URL, "title": p.Title}
	pageID := p.ID
	h.mu.Unlock()

	start := time.Now()
	raw, err := h.Call(ctx, d, pageID, "rwd.snapshot", nil, 15*time.Second)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		code := "internal"
		var re *RPCError
		switch {
		case errors.As(err, &re):
			code = re.Code
		case errors.Is(err, ErrPageGone):
			code = "no_page"
		}
		return map[string]any{"ok": false, "latencyMs": latency, "page": pageInfo,
			"error": map[string]string{"code": code, "message": ErrorText(l, err)}}, nil
	}
	var snap struct {
		Snapshot string `json:"snapshot"`
	}
	_ = json.Unmarshal(raw, &snap)
	s := snap.Snapshot
	if len(s) > 4000 {
		s = s[:4000]
	}
	return map[string]any{"ok": true, "latencyMs": latency, "page": pageInfo, "snapshot": s}, nil
}

// EndDevice detaches the agent and returns the device to idle.
func (h *Hub) EndDevice(deviceID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := h.devices[deviceKey(deviceID)]
	if d == nil {
		return
	}
	if a := d.agent; a != nil {
		h.detach(a, i18n.M(i18n.NoteAdminEnded))
	} else {
		h.setControl(d, ControlNone, i18n.M(i18n.EventAdminEnded))
	}
	if d.Help {
		d.Help = false
		d.broadcast(map[string]any{"t": "help", "on": false})
	}
}

// LabelOf returns the label of a page id on the agent's device.
func (h *Hub) LabelOf(a *Agent, pageID string) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	if a.device == nil {
		return ""
	}
	return a.device.label(pageID)
}

// WaitEvent waits for the next timeline event (after the call starts) that
// matches kind and page label; empty filters match anything.
func (h *Hub) WaitEvent(ctx context.Context, a *Agent, kind, page string) (*Event, error) {
	h.mu.Lock()
	d := a.device
	if d == nil {
		h.mu.Unlock()
		return nil, ErrNoDevice
	}
	start := d.seq
	h.mu.Unlock()
	for {
		h.mu.Lock()
		for _, e := range d.timeline {
			if e.Seq > start && (kind == "" || e.Kind == kind) && (page == "" || e.Page == page) {
				ev := e
				h.mu.Unlock()
				return &ev, nil
			}
		}
		ch := d.wait()
		h.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return nil, errorf(i18n.ErrWaitEvent)
		}
	}
}

// SetTask shows the agent's job and plan at the top of every page of its
// device (nil clears it).
func (h *Hub) SetTask(a *Agent, t *Task) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := a.device
	if d == nil {
		return ErrNoDevice
	}
	if t != nil {
		t.Agent = a.Name
		if d.Task == nil || d.Task.Title != t.Title {
			d.addEvent("", "agent", i18n.M(i18n.EventTaskStarted, t.Title, len(t.Steps)))
		}
	}
	d.Task = t
	d.broadcast(taskMsg(t))
	d.notify()
	return nil
}
