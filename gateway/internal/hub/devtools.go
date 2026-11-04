package hub

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/coder/websocket"
)

// DevTools for people (docs/protocol.md §17). A console member opens Chrome
// DevTools (the frontend is served by the gateway) on one page of a device;
// the gateway relays its CDP messages to the page's SDK, which multiplexes
// them onto chobitsu. Opening one asks the user on the device first when the
// project wants approval; the approval lasts for the project's attach time,
// so a page reload or navigation reconnects without asking again.

const (
	devtoolsTicketTTL = time.Minute
	devtoolsOutQueue  = 2048    // page -> frontend messages waiting for a slow frontend
	devtoolsReadLimit = 8 << 20 // one CDP command from the frontend (DOM.setOuterHTML, …)
)

// Inspector is the console member behind a DevTools window.
type Inspector struct {
	ID   string
	Name string
}

type devtoolsTicket struct {
	session  string
	deviceID string
	pageID   string
	member   Inspector
	expires  time.Time
}

// DevtoolsSession is one open DevTools window on one page connection.
type DevtoolsSession struct {
	ID     string
	Member Inspector
	Since  time.Time

	device *Device
	page   *Page
	conn   *Conn // the page connection the session lives on
	out    chan []byte

	once   sync.Once
	done   chan struct{}
	code   websocket.StatusCode
	reason string
}

// DevtoolsView is an open DevTools window as the console sees it.
type DevtoolsView struct {
	ID     string `json:"id"`
	Member string `json:"member"`
	Page   string `json:"page"` // label
	Since  int64  `json:"since"`
}

// DevtoolsError is a refusal with an error code for the console; Message is
// rendered in the console's language.
type DevtoolsError struct {
	Code    string
	Message i18n.Key
}

func (e *DevtoolsError) Error() string { return i18n.Default.T(e.Message) }

func devtoolsErr(code string, msg i18n.Key) error { return &DevtoolsError{Code: code, Message: msg} }

func devtoolsOf(d *Device) []DevtoolsView {
	out := []DevtoolsView{}
	for _, s := range d.devtools {
		out = append(out, DevtoolsView{ID: s.ID, Member: s.Member.Name, Page: s.page.Label, Since: s.Since.UnixMilli()})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Since < out[j].Since })
	return out
}

// DevtoolsGrant is what OpenDevtools hands the console.
type DevtoolsGrant struct {
	Ticket  string   `json:"ticket"`  // one-time credential of the WebSocket, valid for a minute
	Session string   `json:"session"` // the session id the window will have (Device.devtools[].id)
	Page    PageView `json:"page"`
}

// OpenDevtools checks the policy, asks the user when needed (waiting for the
// answer) and returns a one-time ticket for the DevTools WebSocket. label ""
// picks the page the user is looking at.
func (h *Hub) OpenDevtools(ctx context.Context, deviceID, label string, m Inspector) (*DevtoolsGrant, error) {
	h.mu.Lock()
	d := h.devices[deviceKey(deviceID)]
	if d == nil || d.connectedPages() == 0 {
		h.mu.Unlock()
		return nil, devtoolsErr("device_offline", i18n.APIDevtoolsOffline)
	}
	projectIDs := d.projects()
	h.mu.Unlock()

	pol, err := h.policyFor(ctx, projectIDs)
	if err != nil {
		return nil, err
	}
	if pol.Devtools == "off" {
		return nil, devtoolsErr("forbidden", i18n.APIDevtoolsOff)
	}

	h.mu.Lock()
	p := d.focused()
	if label != "" {
		p = d.pageByLabel(label)
	}
	if p == nil || !p.Connected() {
		h.mu.Unlock()
		return nil, devtoolsErr("no_page", i18n.APIDevtoolsNoPage)
	}
	pageID := p.ID
	if pol.Approval == "prompt" && !time.Now().Before(d.grants[m.ID]) {
		if d.Pending != nil {
			h.mu.Unlock()
			return nil, devtoolsErr("busy", i18n.APIDevtoolsBusy)
		}
		focus := d.focused()
		if focus == nil {
			h.mu.Unlock()
			return nil, devtoolsErr("device_offline", i18n.APIDevtoolsOffline)
		}
		pd := &Pending{Kind: "attach", Purpose: "devtools", RequestID: ids.ID(), Agent: m.Name, Levels: []string{string(store.LevelAdvanced)},
			ExpiresAt: time.Now().Add(approvalTimeout).UnixMilli(), decision: make(chan *store.Level, 1)}
		d.Pending = pd
		focus.conn.push(attachRequestMsg(pd))
		d.addEvent("", "devtools", i18n.M(i18n.EventDevtoolsRequest, m.Name))
		h.record(d.Info.ProjectID, "member", m.ID, m.Name, "devtools.request", d.Info.Code, "ok", map[string]any{"page": p.Label})
		h.mu.Unlock()

		var decided *store.Level
		answered := false
		t := time.NewTimer(approvalTimeout)
		select {
		case decided = <-pd.decision:
			answered = true
		case <-t.C:
		case <-ctx.Done():
		}
		t.Stop()

		h.mu.Lock()
		if d.Pending == pd {
			d.Pending = nil
		}
		if !answered {
			d.broadcast(map[string]any{"t": "attach_cancel", "requestId": pd.RequestID})
		}
		d.notify()
		switch {
		case !answered:
			d.addEvent("", "devtools", i18n.M(i18n.EventDevtoolsNoReply))
			h.record(d.Info.ProjectID, "member", m.ID, m.Name, "devtools.timeout", d.Info.Code, "denied", nil)
			h.mu.Unlock()
			return nil, devtoolsErr("timeout", i18n.APIDevtoolsTimeout)
		case decided == nil:
			d.addEvent("", "devtools", i18n.M(i18n.EventDevtoolsDenied, m.Name))
			h.record(d.Info.ProjectID, "member", m.ID, m.Name, "devtools.deny", d.Info.Code, "denied", nil)
			h.mu.Unlock()
			return nil, devtoolsErr("denied", i18n.APIDevtoolsDenied)
		}
		d.grants[m.ID] = time.Now().Add(time.Duration(pol.AttachMaxMinutes) * time.Minute)
		d.addEvent("", "devtools", i18n.M(i18n.EventDevtoolsAllowed, m.Name))
		h.record(d.Info.ProjectID, "member", m.ID, m.Name, "devtools.approve", d.Info.Code, "ok", nil)
		p = d.pages[pageID]
		if p == nil || !p.Connected() {
			h.mu.Unlock()
			return nil, devtoolsErr("no_page", i18n.APIDevtoolsReconnecting)
		}
	}
	defer h.mu.Unlock()
	now := time.Now()
	for k, t := range h.tickets {
		if now.After(t.expires) {
			delete(h.tickets, k)
		}
	}
	g := &DevtoolsGrant{Ticket: ids.Secret(24), Session: ids.ID()}
	h.tickets[g.Ticket] = &devtoolsTicket{session: g.Session, deviceID: d.Key, pageID: pageID, member: m, expires: now.Add(devtoolsTicketTTL)}
	for _, pv := range pagesOf(d) {
		if pv.ID == pageID {
			g.Page = pv
		}
	}
	return g, nil
}

// ServeDevtools runs one DevTools frontend connection until either side goes.
// The ticket is used up even when the page has gone in the meantime.
func (h *Hub) ServeDevtools(ctx context.Context, ws *websocket.Conn, ticket string) {
	ws.SetReadLimit(devtoolsReadLimit)
	h.mu.Lock()
	t := h.tickets[ticket]
	delete(h.tickets, ticket)
	var d *Device
	var p *Page
	if t != nil && time.Now().Before(t.expires) {
		d = h.devices[deviceKey(t.deviceID)]
		if d != nil {
			p = d.pages[t.pageID]
		}
	}
	if p == nil || p.conn == nil {
		h.mu.Unlock()
		ws.Close(4100, "page_gone")
		return
	}
	s := &DevtoolsSession{ID: t.session, Member: t.member, Since: time.Now(), device: d, page: p, conn: p.conn,
		out: make(chan []byte, devtoolsOutQueue), done: make(chan struct{})}
	d.devtools[s.ID] = s
	b, _ := json.Marshal(map[string]any{"t": "devtools", "s": s.ID, "on": true, "by": s.Member.Name})
	s.conn.push(b)
	d.addEvent(p.Label, "devtools", i18n.M(i18n.EventDevtoolsOpened, s.Member.Name, pageName(p)))
	h.record(p.ProjectID, "member", s.Member.ID, s.Member.Name, "devtools.open", d.Info.Code, "ok", map[string]any{"page": p.Label})
	h.mu.Unlock()

	cctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		// Frontend -> page.
		defer s.end(websocket.StatusNormalClosure, "")
		for {
			_, data, err := ws.Read(cctx)
			if err != nil {
				return
			}
			b, _ := json.Marshal(map[string]string{"t": "cdp", "s": s.ID, "m": string(data)})
			if s.conn.pushCDP(cctx, b) != nil {
				s.end(4100, "page_gone")
				return
			}
		}
	}()
	go func() {
		t := time.NewTicker(heartbeatEvery)
		defer t.Stop()
		for {
			select {
			case <-cctx.Done():
				return
			case <-s.done:
				return
			case <-t.C:
				pctx, pcancel := context.WithTimeout(cctx, pingTimeout)
				err := ws.Ping(pctx)
				pcancel()
				if err != nil {
					s.end(websocket.StatusGoingAway, "ping timeout")
					return
				}
			}
		}
	}()
	// Page -> frontend.
	for {
		select {
		case <-s.done:
		case msg := <-s.out:
			wctx, wcancel := context.WithTimeout(cctx, 10*time.Second)
			err := ws.Write(wctx, websocket.MessageText, msg)
			wcancel()
			if err == nil {
				continue
			}
			s.end(websocket.StatusGoingAway, "write failed")
		}
		break
	}
	h.closeSession(s)
	ws.Close(s.code, s.reason)
}

func (s *DevtoolsSession) end(code websocket.StatusCode, reason string) {
	s.once.Do(func() {
		s.code, s.reason = code, reason
		close(s.done)
	})
}

// closeSession forgets an ended session and tells the page (once).
func (h *Hub) closeSession(s *DevtoolsSession) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := s.device
	if d.devtools[s.ID] != s {
		return
	}
	delete(d.devtools, s.ID)
	b, _ := json.Marshal(map[string]any{"t": "devtools", "s": s.ID, "on": false})
	s.conn.push(b)
	d.addEvent(s.page.Label, "devtools", i18n.M(i18n.EventDevtoolsClosed, s.Member.Name, pageName(s.page)))
	h.record(s.page.ProjectID, "member", s.Member.ID, s.Member.Name, "devtools.close", d.Info.Code, "ok",
		map[string]any{"page": s.page.Label, "durationSec": int(time.Since(s.Since).Seconds()), "reason": s.reason})
}

// relayCDP passes a page's CDP message to its DevTools windows: one of them
// (an answer) or all on this connection (an event).
func (h *Hub) relayCDP(deviceID string, c *Conn, session, msg string) {
	h.mu.Lock()
	d := h.devices[deviceKey(deviceID)]
	var targets []*DevtoolsSession
	if d != nil {
		if session != "" {
			if s := d.devtools[session]; s != nil && s.conn == c {
				targets = append(targets, s)
			}
		} else {
			for _, s := range d.devtools {
				if s.conn == c {
					targets = append(targets, s)
				}
			}
		}
	}
	h.mu.Unlock()
	b := []byte(msg)
	for _, s := range targets {
		select {
		case s.out <- b:
		default:
			// The frontend cannot keep up (screencast on a slow link): drop
			// the window rather than buffer without bound.
			s.end(websocket.StatusTryAgainLater, "devtools too slow")
		}
	}
}

// closeDevtoolsOn ends the sessions living on a page connection that went
// away (reload, navigation): the console reconnects to the new one. h.mu held.
func (h *Hub) closeDevtoolsOn(d *Device, c *Conn, code websocket.StatusCode, reason string) {
	for _, s := range d.devtools {
		if s.conn == c {
			s.end(code, reason)
		}
	}
}

// endDevtools closes every DevTools window on the device and drops the
// approvals (the user or an admin ended debugging). h.mu held.
func (h *Hub) endDevtools(d *Device, reason i18n.Msg) {
	for _, s := range d.devtools {
		s.end(4403, "ended")
	}
	if len(d.grants) > 0 {
		d.grants = map[string]time.Time{}
		if !reason.IsZero() {
			d.addEvent("", "devtools", i18n.M(i18n.EventDevtoolsRevoked, reason))
		}
	}
}
