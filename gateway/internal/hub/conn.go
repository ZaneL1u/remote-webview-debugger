package hub

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/coder/websocket"
)

const (
	helloTimeout   = 5 * time.Second
	heartbeatEvery = 25 * time.Second
	pingTimeout    = 10 * time.Second
	sendQueue      = 64
	readLimit      = 16 << 20 // screenshots come back base64 encoded

	followAfterGone = 1500 * time.Millisecond
)

// Conn is one page's WebSocket. Reads happen in Serve; writes go through a
// bounded queue drained by a single writer goroutine, so a slow page never
// blocks the hub.
type Conn struct {
	ws     *websocket.Conn
	send   chan []byte
	ctx    context.Context
	cancel context.CancelFunc

	mu      sync.Mutex
	nextID  int64
	pending map[int64]chan rpcResult
	closed  bool
}

type rpcResult struct {
	result json.RawMessage
	err    error
}

func (c *Conn) push(b []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	select {
	case c.send <- b:
	default:
		// The page is not keeping up; drop it rather than stall everyone.
		c.closeLocked(websocket.StatusTryAgainLater, "slow consumer")
	}
}

func (c *Conn) closeLocked(code websocket.StatusCode, reason string) {
	if c.closed {
		return
	}
	c.closed = true
	for id, ch := range c.pending {
		ch <- rpcResult{err: ErrPageGone}
		delete(c.pending, id)
	}
	c.cancel()
	go c.ws.Close(code, reason)
}

func (c *Conn) writer() {
	for {
		select {
		case <-c.ctx.Done():
			return
		case b := <-c.send:
			ctx, cancel := context.WithTimeout(c.ctx, 10*time.Second)
			err := c.ws.Write(ctx, websocket.MessageText, b)
			cancel()
			if err != nil {
				c.mu.Lock()
				c.closeLocked(websocket.StatusGoingAway, "write failed")
				c.mu.Unlock()
				return
			}
		}
	}
}

func (c *Conn) heartbeat() {
	t := time.NewTicker(heartbeatEvery)
	defer t.Stop()
	hb, _ := json.Marshal(map[string]string{"t": "hb"})
	for {
		select {
		case <-c.ctx.Done():
			return
		case <-t.C:
			c.push(hb)
			ctx, cancel := context.WithTimeout(c.ctx, pingTimeout)
			err := c.ws.Ping(ctx)
			cancel()
			if err != nil && c.ctx.Err() == nil {
				c.mu.Lock()
				c.closeLocked(websocket.StatusGoingAway, "ping timeout")
				c.mu.Unlock()
				return
			}
		}
	}
}

// call sends one RPC and waits for its answer.
func (c *Conn) call(ctx context.Context, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil, ErrPageGone
	}
	c.nextID++
	id := c.nextID
	ch := make(chan rpcResult, 1)
	c.pending[id] = ch
	c.mu.Unlock()

	if params == nil {
		params = map[string]any{}
	}
	b, err := json.Marshal(map[string]any{"id": id, "method": method, "params": params})
	if err != nil {
		return nil, err
	}
	c.push(b)

	t := time.NewTimer(timeout)
	defer t.Stop()
	select {
	case r := <-ch:
		return r.result, r.err
	case <-t.C:
	case <-ctx.Done():
	}
	c.mu.Lock()
	delete(c.pending, id)
	c.mu.Unlock()
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return nil, ErrRPCTimeout
}

// --- messages ---

type pageInfo struct {
	URL        string `json:"url"`
	Title      string `json:"title"`
	Visibility string `json:"visibility"`
}

type deviceInfo struct {
	UA       string         `json:"ua"`
	Platform string         `json:"platform"`
	App      *store.AppInfo `json:"app"`
}

type Hello struct {
	T        string     `json:"t"`
	V        int        `json:"v"`
	SDK      string     `json:"sdk"`
	DeviceID string     `json:"deviceId"`
	PageID   string     `json:"pageId"`
	OpenerID string     `json:"openerId"`
	UserID   string     `json:"userId"`
	Page     pageInfo   `json:"page"`
	Device   deviceInfo `json:"device"`
	Help     bool       `json:"help"`

	DeviceToken string `json:"deviceToken"`
	Resume      string `json:"resume"`
	Invite      string `json:"invite"`

	// tokenAware: the hello has a deviceToken field (null when the page has
	// none). Older SDKs omit it and would drop an issued token.
	tokenAware bool
}

// CloseError rejects a page connection with a protocol close code
// (docs/protocol.md §3.6).
type CloseError struct {
	Code   websocket.StatusCode
	Reason string
}

func (e *CloseError) Error() string { return e.Reason }

type inbound struct {
	T string `json:"t"`

	// page
	URL        string `json:"url"`
	Title      string `json:"title"`
	Visibility string `json:"visibility"`
	// event
	Kind    string `json:"kind"`
	Summary string `json:"summary"`
	// help
	On bool `json:"on"`
	// control
	Action string `json:"action"`
	// attach_decision
	RequestID string  `json:"requestId"`
	Level     *string `json:"level"`
	// rpc reply
	ID     int64           `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  *RPCError       `json:"error"`
}

func validID(s string, max int) bool {
	if s == "" || len(s) > max {
		return false
	}
	for _, r := range s {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// ServePage runs one page connection until it closes. The project has already
// been authenticated by its app key.
func (h *Hub) ServePage(ctx context.Context, ws *websocket.Conn, projectID string) {
	ws.SetReadLimit(readLimit)
	cctx, cancel := context.WithCancel(ctx)
	c := &Conn{ws: ws, send: make(chan []byte, sendQueue), ctx: cctx, cancel: cancel, pending: map[int64]chan rpcResult{}}
	defer func() {
		c.mu.Lock()
		c.closeLocked(websocket.StatusNormalClosure, "")
		c.mu.Unlock()
	}()

	hctx, hcancel := context.WithTimeout(cctx, helloTimeout)
	_, data, err := ws.Read(hctx)
	hcancel()
	if err != nil {
		return
	}
	var hello Hello
	var fields map[string]json.RawMessage
	if json.Unmarshal(data, &fields) == nil {
		_, hello.tokenAware = fields["deviceToken"]
	}
	if json.Unmarshal(data, &hello) != nil || hello.T != "hello" || !validID(hello.DeviceID, 64) || !validID(hello.PageID, 64) {
		ws.Close(websocket.StatusPolicyViolation, "bad hello")
		return
	}

	go c.writer()
	go c.heartbeat()
	h.stats.mu.Lock()
	h.stats.conns++
	h.stats.mu.Unlock()
	defer func() {
		h.stats.mu.Lock()
		h.stats.conns--
		h.stats.mu.Unlock()
	}()

	page, err := h.attach(cctx, projectID, &hello, c)
	if err != nil {
		var ce *CloseError
		if errors.As(err, &ce) {
			c.mu.Lock()
			c.closeLocked(ce.Code, ce.Reason)
			c.mu.Unlock()
			return
		}
		h.log.Warn("attach failed", "err", err)
		ws.Close(websocket.StatusInternalError, "attach failed")
		return
	}
	defer h.detachPage(hello.DeviceID, page, c)

	for {
		_, data, err := ws.Read(cctx)
		if err != nil {
			return
		}
		var m inbound
		if json.Unmarshal(data, &m) != nil {
			continue
		}
		if m.T == "" && m.ID != 0 {
			c.mu.Lock()
			ch := c.pending[m.ID]
			delete(c.pending, m.ID)
			c.mu.Unlock()
			if ch != nil {
				if m.Error != nil {
					ch <- rpcResult{err: m.Error}
				} else {
					ch <- rpcResult{result: m.Result}
				}
			}
			continue
		}
		h.onMessage(hello.DeviceID, page, &m)
	}
}

func (h *Hub) attach(ctx context.Context, projectID string, hello *Hello, c *Conn) (*Page, error) {
	project, err := h.store.Project(ctx, projectID)
	if err != nil {
		return nil, err
	}
	rec, err := h.store.UpsertDevice(ctx, store.Device{
		ProjectID: projectID, DeviceID: hello.DeviceID, UserID: clip(hello.UserID, 128),
		Platform: clip(hello.Device.Platform, 16), UA: clip(hello.Device.UA, 512), App: hello.Device.App,
	})
	if err != nil {
		return nil, err
	}

	// Device token: once issued, every page of the device must present it, so
	// knowing a deviceId (or just the public app key) is not enough to join.
	issued := ""
	if rec.TokenHash != "" {
		if hello.DeviceToken == "" || ids.HashKey(h.pepper, hello.DeviceToken) != rec.TokenHash {
			return nil, &CloseError{Code: 4401, Reason: "device token missing or invalid"}
		}
	} else if hello.tokenAware {
		// Only an SDK that keeps the token gets one: issuing it to a phase 1
		// page would lock the device's later pages out.
		issued = ids.Secret(32)
		rec.TokenHash = ids.HashKey(h.pepper, issued)
		if err := h.store.SetDeviceToken(ctx, hello.DeviceID, rec.TokenHash); err != nil {
			return nil, err
		}
	}

	var invite *store.DeviceInvite
	if hello.Invite != "" {
		if v, err := h.store.UseDeviceInvite(ctx, h.pepper, projectID, clip(hello.Invite, 128), hello.DeviceID); err == nil {
			invite = v
		}
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	d := h.device(*rec)
	if !d.online() && project.Policy.MaxOnlineDevices > 0 && h.onlineLocked(projectID) >= project.Policy.MaxOnlineDevices {
		return nil, &CloseError{Code: 4429, Reason: "online device quota reached"}
	}

	now := time.Now()
	p := d.pages[hello.PageID]
	if p != nil && p.resumeHash != "" && (hello.Resume == "" || ids.HashKey(h.pepper, hello.Resume) != p.resumeHash) {
		return nil, &CloseError{Code: 4409, Reason: "resume token mismatch"}
	}
	d.SDK = clip(hello.SDK, 32)
	if invite != nil {
		d.Invited = true
		d.Help = true
		note := invite.Note
		if note == "" {
			note = invite.ID
		}
		d.addEvent("", "help", i18n.M(i18n.EventInvited, note))
		h.record(projectID, "device", rec.DeviceID, rec.Code, "invite.use", rec.Code, "ok", map[string]any{"invite": invite.ID, "note": invite.Note})
	} else if hello.Help && !d.Help && d.agent == nil {
		d.Help = true
		d.addEvent("", "help", i18n.M(i18n.EventHelp))
	}

	if !d.online() {
		d.onlineSince = now
	}
	if p != nil {
		if p.grace != nil {
			p.grace.Stop()
			p.grace = nil
		}
		if p.conn != nil && p.conn != c {
			// A newer connection for the same page wins.
			old := p.conn
			old.mu.Lock()
			old.closeLocked(websocket.StatusNormalClosure, "replaced")
			old.mu.Unlock()
		}
		prevURL := p.URL
		p.ProjectID = projectID
		p.conn, p.URL, p.Title, p.Visibility, p.LastActive = c, clip(hello.Page.URL, 2048), clip(hello.Page.Title, 256), hello.Page.Visibility, now
		if prevURL != p.URL {
			d.addEvent(p.Label, "navigated", i18n.M(i18n.EventNavigated, pageName(p), shortURL(p.URL)))
		} else {
			d.addEvent(p.Label, "reloaded", i18n.M(i18n.EventReloaded, pageName(p)))
		}
	} else {
		d.nextLabel++
		p = &Page{ID: hello.PageID, ProjectID: projectID, Label: fmt.Sprintf("p%d", d.nextLabel), URL: clip(hello.Page.URL, 2048),
			Title: clip(hello.Page.Title, 256), Visibility: hello.Page.Visibility, OpenerID: hello.OpenerID,
			ConnectedAt: now, LastActive: now, conn: c}
		d.pages[p.ID] = p
		summary := i18n.M(i18n.EventOpened, pageName(p))
		if op := d.pages[p.OpenerID]; op != nil {
			summary = i18n.M(i18n.EventOpenedBy, pageName(p), op.Label)
		}
		d.addEvent(p.Label, "opened", summary)
		h.dropStale(d, p)
	}
	h.follow(d, p)

	resume := ids.Secret(16)
	p.resumeHash = ids.HashKey(h.pepper, resume)

	var agent, level any
	if d.agent != nil {
		agent = map[string]string{"name": d.agent.Name}
		level = d.Level
	}
	welcome := map[string]any{
		"t": "welcome", "deviceCode": rec.Code, "label": p.Label, "help": d.Help,
		"control": map[string]any{"state": d.Control, "agent": agent, "level": level, "attachedMs": attachedMs(d)},
		"level":   level, "resume": resume, "config": pageConfig(project.Policy, rec.UserID),
		"agentLang": h.lang, // the SDK words the errors it returns to agents in this language
	}
	if d.agent != nil && d.Task != nil {
		welcome["task"] = d.Task
	}
	if issued != "" {
		welcome["deviceToken"] = issued
	}
	b, _ := json.Marshal(welcome)
	c.push(b)
	if d.Pending != nil && p == d.focused() {
		// A page that (re)connects while the user is being asked shows the request.
		c.push(attachRequestMsg(d.Pending))
	}
	return p, nil
}

// pageConfig is the remote configuration sent to pages (protocol §3.4, §11).
func pageConfig(p store.Policy, userID string) map[string]any {
	help := p.HelpButton == "all"
	if p.HelpButton == "listed" && userID != "" {
		for _, u := range p.HelpUsers {
			if u == userID {
				help = true
				break
			}
		}
	}
	return map[string]any{"helpButton": help, "maskSelectors": p.MaskSelectors, "maskPatterns": p.MaskPatterns,
		"confirmSelectors": p.ConfirmSelectors, "networkExclude": p.NetworkExclude,
		"sessionLog": p.SessionLog == nil || *p.SessionLog, "eruda": p.Eruda}
}

func attachRequestMsg(pd *Pending) []byte {
	b, _ := json.Marshal(map[string]any{"t": "attach_request", "requestId": pd.RequestID,
		"agent": map[string]string{"name": pd.Agent, "keyHint": pd.KeyHint}, "levels": pd.Levels,
		"expiresInSec": max(1, int(time.Until(time.UnixMilli(pd.ExpiresAt)).Seconds()))})
	return b
}

func (h *Hub) onlineLocked(projectID string) int {
	n := 0
	for _, d := range h.devices {
		if d.online() && d.hasProject(projectID) {
			n++
		}
	}
	return n
}

func (h *Hub) detachPage(deviceID string, p *Page, c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := h.devices[deviceKey(deviceID)]
	if d == nil || p.conn != c {
		return
	}
	p.conn = nil
	d.Info.LastSeen = time.Now().UnixMilli()
	d.notify()
	if a := d.agent; a != nil && a.Follow && a.pageID == p.ID {
		// Navigations reconnect within a second; anything longer means the
		// page went away (closed WebView, killed tab). Move the agent along.
		time.AfterFunc(followAfterGone, func() {
			h.mu.Lock()
			defer h.mu.Unlock()
			if p.conn != nil || d.agent != a || a.pageID != p.ID {
				return
			}
			if f := d.focused(); f != nil {
				a.pageID = f.ID
				a.notes = append(a.notes, h.lang.T(i18n.NotePageGoneSwitched, p.Label, pageName(f)))
			}
		})
	}
	grace := pageGrace
	if d.liveTwin(p) != nil {
		grace = followAfterGone // another page shows it: only a reload is worth waiting for
	}
	p.grace = time.AfterFunc(grace, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if p.conn != nil || d.pages[p.ID] != p {
			return
		}
		delete(d.pages, p.ID)
		if a, twin := d.agent, d.liveTwin(p); a != nil && a.pageID == p.ID && twin != nil {
			a.pageID = twin.ID
			a.notes = append(a.notes, h.lang.T(i18n.NotePageGoneSwitched, p.Label, pageName(twin)))
		}
		d.addEvent(p.Label, "closed", i18n.M(i18n.EventClosed, pageName(p)))
		if !d.online() && d.agent != nil {
			d.addEvent("", "offline", i18n.M(i18n.EventOffline))
		}
	})
}

// dropStale removes disconnected pages showing the same document as the page
// that just connected: the WebView was recreated under a new page id and the
// old entry would sit in the page list as "reconnecting" until pageGrace.
func (h *Hub) dropStale(d *Device, p *Page) {
	for id, o := range d.pages {
		if o == p || o.conn != nil || !sameDocument(o.URL, p.URL) {
			continue
		}
		if o.grace != nil {
			o.grace.Stop()
			o.grace = nil
		}
		delete(d.pages, id)
		if a := d.agent; a != nil && a.pageID == id {
			a.pageID = p.ID
			a.notes = append(a.notes, h.lang.T(i18n.NotePageGoneSwitched, o.Label, pageName(p)))
		}
		d.addEvent(o.Label, "closed", i18n.M(i18n.EventClosed, pageName(o)))
	}
}

// liveTwin returns another connected page showing the same document as p.
func (d *Device) liveTwin(p *Page) *Page {
	for _, o := range d.pages {
		if o != p && o.conn != nil && sameDocument(o.URL, p.URL) {
			return o
		}
	}
	return nil
}

func sameDocument(a, b string) bool {
	a, _, _ = strings.Cut(a, "#")
	b, _, _ = strings.Cut(b, "#")
	return a != "" && a == b
}

func (h *Hub) onMessage(deviceID string, p *Page, m *inbound) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d := h.devices[deviceKey(deviceID)]
	if d == nil {
		return
	}
	switch m.T {
	case "page":
		url, title := clip(m.URL, 2048), clip(m.Title, 256)
		if url != "" && url != p.URL {
			p.URL = url
			if title != "" {
				p.Title = title
			}
			d.addEvent(p.Label, "navigated", i18n.M(i18n.EventNavigated, pageName(p), shortURL(url)))
		} else if title != "" && title != p.Title {
			p.Title = title
			d.notify()
		}
		if m.Visibility != "" && m.Visibility != p.Visibility {
			p.Visibility = m.Visibility
			if m.Visibility == "visible" {
				p.LastActive = time.Now()
				d.addEvent(p.Label, "focus", i18n.M(i18n.EventFocus, pageName(p)))
				h.follow(d, p)
			} else {
				d.notify()
			}
		}
	case "event":
		switch m.Kind {
		case "error", "net_fail", "user_tap", "console_error":
			d.addEvent(p.Label, m.Kind, i18n.Raw(clip(strings.TrimSpace(m.Summary), 300)))
		}
	case "attach_decision":
		if pd := d.Pending; pd != nil && pd.RequestID == m.RequestID {
			var lv *store.Level
			if m.Level != nil {
				l := store.Level(*m.Level)
				if l.Valid() {
					lv = &l
				}
			}
			select {
			case pd.decision <- lv:
			default:
			}
		}
	case "help":
		if m.On != d.Help {
			d.Help = m.On
			if m.On {
				d.addEvent(p.Label, "help", i18n.M(i18n.EventHelp))
			} else {
				d.addEvent(p.Label, "help", i18n.M(i18n.EventHelpCancelled))
			}
		}
	case "control":
		if m.Action == "takeover" || m.Action == "handback" || m.Action == "end" {
			h.record(p.ProjectID, "device", deviceID, d.Info.Code, "control."+m.Action, d.Info.Code, "ok", map[string]any{"page": p.Label})
		}
		switch m.Action {
		case "takeover":
			if d.Control == ControlAgent || d.Control == ControlObserve {
				h.setControl(d, ControlUser, i18n.Msg{})
			}
		case "handback":
			if d.Control == ControlUser {
				if d.agent != nil {
					h.setControl(d, ControlAgent, i18n.M(i18n.EventHandback))
				} else {
					h.setControl(d, ControlNone, i18n.Msg{})
				}
			}
		case "end":
			if a := d.agent; a != nil {
				h.detach(a, i18n.M(i18n.EventUserEnded))
			} else {
				h.setControl(d, ControlNone, i18n.M(i18n.EventUserEnded))
			}
			// Ending also withdraws the help request, on every page of the device.
			if d.Help {
				d.Help = false
				d.addEvent(p.Label, "help", i18n.M(i18n.EventHelpCancelled))
				d.broadcast(map[string]any{"t": "help", "on": false})
			}
		}
	}
}

// follow moves an agent's selected page when the user switches pages or the
// agent's action opened a new page.
func (h *Hub) follow(d *Device, p *Page) {
	a := d.agent
	if a == nil || !a.Follow || a.pageID == p.ID {
		return
	}
	cur := d.pages[a.pageID]
	if cur == nil || !cur.Connected() || p.OpenerID == a.pageID || p.Visibility == "visible" {
		a.pageID = p.ID
		a.notes = append(a.notes, h.lang.T(i18n.NoteAutoSwitched, pageName(p)))
	}
}

// Call sends an RPC to a page of the device.
func (h *Hub) Call(ctx context.Context, d *Device, pageID, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	h.mu.Lock()
	p := d.pages[pageID]
	var c *Conn
	if p != nil {
		c = p.conn
	}
	h.mu.Unlock()
	if p == nil {
		return nil, ErrNoPage
	}
	if c == nil {
		return nil, ErrPageGone
	}
	start := time.Now()
	res, err := c.call(ctx, method, params, timeout)
	h.stats.observe(method, time.Since(start), err)
	var rpcErr *RPCError
	if errors.As(err, &rpcErr) || err == nil {
		return res, err
	}
	return nil, err
}
