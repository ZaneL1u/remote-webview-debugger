// Package hub holds the live state of the gateway: which devices are online,
// their pages, who controls them, their timelines, and the agents attached to
// them. It also carries RPCs from agents to pages.
package hub

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// Control states, see docs/protocol.md §4.
const (
	ControlNone    = "none"
	ControlObserve = "observe"
	ControlAgent   = "agent"
	ControlUser    = "user"
)

const (
	timelineCap   = 300
	pageGrace     = 2 * time.Minute  // a reloading page keeps its label
	reattachGrace = 10 * time.Minute // same key, same device: no second approval
	agentIdle     = 2 * time.Minute  // agent -> observe after no interaction
	deviceForget  = 30 * time.Minute // drop offline devices from memory
	pollOnlineFor = 90 * time.Second // a polling device counts as online
)

var (
	ErrNoDevice   = &Error{i18n.M(i18n.ErrNoDevice)}
	ErrDeviceGone = &Error{i18n.M(i18n.ErrDeviceGone)}
	ErrNoPage     = &Error{i18n.M(i18n.ErrNoPage)}
	ErrPageGone   = &Error{i18n.M(i18n.ErrPageGone)}
	ErrTakeover   = rpcError("takeover", i18n.ErrTakeover)
	ErrRPCTimeout = rpcError("timeout", i18n.ErrRPCTimeout)
)

// Error is a gateway error whose message is translated where it is shown
// (ErrorText); Error() is English, for logs.
type Error struct{ Msg i18n.Msg }

func (e *Error) Error() string { return e.Msg.In(i18n.EN) }

func errorf(k i18n.Key, a ...any) error { return &Error{i18n.M(k, a...)} }

type RPCError struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	msg     i18n.Msg // set on errors made by the gateway
}

func rpcError(code string, k i18n.Key, a ...any) *RPCError {
	m := i18n.M(k, a...)
	return &RPCError{Code: code, Message: m.In(i18n.EN), msg: m}
}

func (e *RPCError) Error() string { return e.Code + ": " + e.Message }

// Text is the message in l: translated for the gateway's own errors, as sent
// for the page's (the page SDK localizes them from welcome.agentLang).
func (e *RPCError) Text(l i18n.Lang) string {
	if e.msg.IsZero() {
		return e.Message
	}
	return e.msg.In(l)
}

// ErrorText renders err for a reader of language l.
func ErrorText(l i18n.Lang, err error) string {
	var he *Error
	if errors.As(err, &he) {
		return he.Msg.In(l)
	}
	var re *RPCError
	if errors.As(err, &re) {
		return re.Code + ": " + re.Text(l)
	}
	return err.Error()
}

type Event struct {
	Seq     int64  `json:"-"`
	At      int64  `json:"at"`
	Page    string `json:"page"`
	Kind    string `json:"kind"`
	Summary string `json:"summary"` // in the agent language
	msg     i18n.Msg
}

// In returns the event with its summary in l.
func (e Event) In(l i18n.Lang) Event {
	if !e.msg.IsZero() {
		e.Summary = e.msg.In(l)
	}
	return e
}

type Page struct {
	ID          string
	ProjectID   string // the integration (app key) the page connected with
	resumeHash  string
	Label       string
	URL         string
	Title       string
	Visibility  string
	OpenerID    string
	ConnectedAt time.Time
	LastActive  time.Time

	conn  *Conn
	grace *time.Timer
}

func (p *Page) Connected() bool { return p.conn != nil }

// Device is one phone (one SDK device id). Its pages may come from several
// projects; Info.ProjectID is the project of the latest one.
type Device struct {
	Key  string // deviceID
	Info store.Device
	hub  *Hub

	Help         bool
	SDK          string
	Invited      bool
	Control      string
	Level        store.Level // granted to the attached agent
	Pending      *Pending    // attach request waiting for the user
	Task         *Task       // what the attached agent says it is doing
	agent        *Agent
	idle         time.Duration
	lastInteract time.Time
	polledAt     time.Time
	pollConnect  bool
	onlineSince  time.Time // when the device last came online

	pages     map[string]*Page
	nextLabel int
	timeline  []Event
	seq       int64
	changed   chan struct{}
}

// Agent is an API key's view of the gateway: which device it is attached to
// and which page it is looking at. One agent per API key; a key reaches every
// device.
type Agent struct {
	KeyID    string
	Name     string
	KeyHint  string
	MaxLevel store.Level
	Follow   bool
	Level    store.Level

	attachTimer *time.Timer

	device *Device
	pageID string
	cursor int64
	notes  []string
}

// Pending is an attach request shown to the user.
type Pending struct {
	Kind      string   `json:"kind"`
	RequestID string   `json:"-"`
	Agent     string   `json:"agent"`
	KeyHint   string   `json:"keyHint,omitempty"`
	Levels    []string `json:"levels"`
	ExpiresAt int64    `json:"expiresAt"`
	decision  chan *store.Level
}

type denial struct {
	count int
	until time.Time
}

// grant remembers an approval after the agent let go of the device, so the
// same API key can come back without asking the user again.
type grant struct {
	level store.Level
	until time.Time
}

type Hub struct {
	mu      sync.Mutex
	store   *store.Store
	log     *slog.Logger
	pepper  string
	lang    i18n.Lang // agent-facing language (RWD_LANG)
	devices map[string]*Device
	agents  map[string]*Agent
	denials map[string]*denial // apiKeyID|deviceKey
	grants  map[string]*grant  // apiKeyID|deviceKey
	enum    map[string]*denial // failed device lookups per API key

	// Audit receives audit events (written asynchronously by the caller).
	Audit func(store.AuditEvent)
	subs  map[string]map[chan Update]struct{}
	stats stats
}

func New(st *store.Store, log *slog.Logger, pepper string, lang i18n.Lang) *Hub {
	h := &Hub{store: st, log: log, pepper: pepper, lang: lang, devices: map[string]*Device{}, agents: map[string]*Agent{},
		denials: map[string]*denial{}, grants: map[string]*grant{}, enum: map[string]*denial{}, subs: map[string]map[chan Update]struct{}{},
		Audit: func(store.AuditEvent) {}}
	h.stats.rpc = map[string]*rpcStat{}
	go h.loop()
	return h
}

// record emits an audit event (h.mu may be held; Audit must not block).
func (h *Hub) record(projectID, actorType, actorID, actorName, action, target, result string, detail map[string]any) {
	pid := projectID
	h.Audit(store.AuditEvent{ProjectID: &pid, ActorType: actorType, ActorID: actorID, ActorName: actorName,
		Action: action, Target: target, Result: result, Detail: detail})
}

func deviceKey(deviceID string) string { return deviceID }

// loop handles the time-based transitions.
func (h *Hub) loop() {
	t := time.NewTicker(10 * time.Second)
	for range t.C {
		h.mu.Lock()
		now := time.Now()
		for k, d := range h.devices {
			idle := d.idle
			if idle <= 0 {
				idle = agentIdle
			}
			if d.Control == ControlAgent && now.Sub(d.lastInteract) > idle {
				h.setControl(d, ControlObserve, i18n.M(i18n.EventIdle, int(idle.Minutes())))
			}
			if !d.online() && d.agent == nil && now.Sub(time.UnixMilli(d.Info.LastSeen)) > deviceForget {
				delete(h.devices, k)
			}
		}
		for k, g := range h.grants {
			if now.After(g.until) {
				delete(h.grants, k)
			}
		}
		h.mu.Unlock()
	}
}

// --- device state helpers (call with h.mu held) ---

func (d *Device) online() bool {
	for _, p := range d.pages {
		if p.Connected() {
			return true
		}
	}
	return time.Since(d.polledAt) < pollOnlineFor
}

// projects lists the projects of the connected pages (the latest project
// when none is connected), without duplicates.
func (d *Device) projects() []string {
	out := []string{}
	for _, p := range d.pages {
		if p.Connected() && p.ProjectID != "" && !slices.Contains(out, p.ProjectID) {
			out = append(out, p.ProjectID)
		}
	}
	if len(out) == 0 && d.Info.ProjectID != "" {
		out = append(out, d.Info.ProjectID)
	}
	sort.Strings(out)
	return out
}

func (d *Device) hasProject(id string) bool { return slices.Contains(d.projects(), id) }

func (d *Device) connectedPages() int {
	n := 0
	for _, p := range d.pages {
		if p.Connected() {
			n++
		}
	}
	return n
}

func (d *Device) notify() {
	if d.changed != nil {
		close(d.changed)
	}
	d.changed = make(chan struct{})
	if d.hub != nil {
		d.hub.publish(d.Info.ProjectID, Update{Kind: "device", Device: ptr(d.hub.viewOf(d.Info, d))})
	}
}

func ptr[T any](v T) *T { return &v }

func (d *Device) wait() <-chan struct{} {
	if d.changed == nil {
		d.changed = make(chan struct{})
	}
	return d.changed
}

func (d *Device) addEvent(page, kind string, summary i18n.Msg) {
	d.seq++
	lang := i18n.Default
	if d.hub != nil {
		lang = d.hub.lang
	}
	e := Event{Seq: d.seq, At: time.Now().UnixMilli(), Page: page, Kind: kind, Summary: summary.In(lang), msg: summary}
	d.timeline = append(d.timeline, e)
	if len(d.timeline) > timelineCap {
		d.timeline = d.timeline[len(d.timeline)-timelineCap:]
	}
	if d.hub != nil {
		d.hub.publish(d.Info.ProjectID, Update{Kind: "timeline", DeviceID: d.Info.DeviceID, Event: &e})
	}
	d.notify()
}

// focused is the page the user is most likely looking at.
func (d *Device) focused() *Page {
	var best *Page
	for _, p := range d.pages {
		if !p.Connected() {
			continue
		}
		if best == nil ||
			(p.Visibility == "visible") != (best.Visibility == "visible") && p.Visibility == "visible" ||
			(p.Visibility == "visible") == (best.Visibility == "visible") && p.LastActive.After(best.LastActive) {
			best = p
		}
	}
	return best
}

func (d *Device) pageByLabel(label string) *Page {
	for _, p := range d.pages {
		if p.Label == label || p.ID == label {
			return p
		}
	}
	return nil
}

func (d *Device) label(pageID string) string {
	if p := d.pages[pageID]; p != nil {
		return p.Label
	}
	return ""
}

func (d *Device) broadcast(msg any) {
	b, _ := json.Marshal(msg)
	for _, p := range d.pages {
		if p.conn != nil {
			p.conn.push(b)
		}
	}
}

func controlMsg(d *Device) map[string]any {
	var agent, level any
	if d.agent != nil {
		agent = map[string]string{"name": d.agent.Name}
		level = d.Level
	}
	return map[string]any{"t": "control", "state": d.Control, "agent": agent, "level": level}
}

func (h *Hub) setControl(d *Device, state string, reason i18n.Msg) {
	if d.Control == state {
		return
	}
	d.Control = state
	if state == ControlAgent {
		d.lastInteract = time.Now()
	}
	d.broadcast(controlMsg(d))
	summary := i18n.M(map[string]i18n.Key{
		ControlNone:    i18n.EventControlNone,
		ControlObserve: i18n.EventControlObserve,
		ControlAgent:   i18n.EventControlAgent,
		ControlUser:    i18n.EventControlUser,
	}[state])
	if !reason.IsZero() {
		summary = reason
	}
	d.addEvent("", "control", summary)
}

func shortURL(u string) string {
	if i := strings.Index(u, "://"); i >= 0 {
		u = u[i+3:]
	}
	if len(u) > 80 {
		u = u[:77] + "…"
	}
	return u
}

func pageName(p *Page) i18n.Msg {
	if p.Title != "" {
		return i18n.M(i18n.PageTitled, p.Label, p.Title)
	}
	return i18n.M(i18n.PageUntitled, p.Label, shortURL(p.URL))
}

// --- views for the API and MCP layers ---

type PageView struct {
	ID          string `json:"id"`
	ProjectID   string `json:"projectId"`
	Label       string `json:"label"`
	URL         string `json:"url"`
	Title       string `json:"title"`
	Visibility  string `json:"visibility"`
	Focused     bool   `json:"focused"`  // the page the user is most likely looking at
	Selected    bool   `json:"selected"` // the page the agent is working on
	OpenerLabel any    `json:"openerLabel"`
	ConnectedAt int64  `json:"connectedAt"`
	Connected   bool   `json:"-"`
}

// Task is the attached agent's announced job and plan, shown at the top of
// the page (docs/protocol.md §14.3).
type Task struct {
	Title   string   `json:"title"`
	Steps   []string `json:"steps"`
	Current int      `json:"current"` // index of the active step; len(Steps) when all are done
	Agent   string   `json:"agent"`
}

func taskMsg(t *Task) map[string]any { return map[string]any{"t": "task", "task": t} }

type DeviceView struct {
	ID          string         `json:"id"`
	Code        string         `json:"code"`
	ProjectID   string         `json:"projectId"` // project of the latest page
	Projects    []string       `json:"projects"`  // projects of the connected pages
	UserID      any            `json:"userId"`
	Platform    string         `json:"platform"`
	UA          string         `json:"ua"`
	App         *store.AppInfo `json:"app"`
	Online      bool           `json:"online"`
	Help        bool           `json:"help"`
	Control     string         `json:"control"`
	Agent       any            `json:"agent"`
	Level       any            `json:"level"`
	PendingReq  *Pending       `json:"pending"`
	Task        *Task          `json:"task,omitempty"`
	Invited     bool           `json:"invited"`
	Pages       int            `json:"pages"`
	SDK         string         `json:"sdk"`
	CurrentPage any            `json:"currentPage"`
	FirstSeenAt int64          `json:"firstSeenAt"`
	LastSeenAt  int64          `json:"lastSeenAt"`
	OnlineSince int64          `json:"onlineSince,omitempty"`
	System      SystemInfo     `json:"system"`
	ProjectName string         `json:"projectName,omitempty"`
}

func (h *Hub) viewOf(info store.Device, d *Device) DeviceView {
	v := DeviceView{
		ID: info.DeviceID, Code: info.Code, ProjectID: info.ProjectID, Platform: info.Platform, UA: info.UA,
		App: info.App, Control: ControlNone, FirstSeenAt: info.FirstSeen, LastSeenAt: info.LastSeen,
		System: ParseUA(info.UA, info.Platform, h.lang), Projects: []string{info.ProjectID},
	}
	if info.UserID != "" {
		v.UserID = info.UserID
	}
	if d != nil {
		v.Projects = d.projects()
		v.Online = d.online()
		if v.Online && !d.onlineSince.IsZero() {
			v.OnlineSince = d.onlineSince.UnixMilli()
		}
		v.Help = d.Help
		v.Control = d.Control
		v.Pages = d.connectedPages()
		v.SDK = d.SDK
		if f := d.focused(); f != nil {
			v.CurrentPage = map[string]string{"label": f.Label, "url": f.URL, "title": f.Title}
		}
		if d.agent != nil {
			v.Agent = d.agent.Name
			v.Level = d.Level
		}
		v.PendingReq = d.Pending
		v.Task = d.Task
		v.Invited = d.Invited
	}
	return v
}

func pagesOf(d *Device) []PageView {
	focus := d.focused()
	out := []PageView{}
	for _, p := range d.pages {
		pv := PageView{ID: p.ID, ProjectID: p.ProjectID, Label: p.Label, URL: p.URL, Title: p.Title, Visibility: p.Visibility,
			Focused: p == focus, Selected: d.agent != nil && d.agent.pageID == p.ID,
			ConnectedAt: p.ConnectedAt.UnixMilli(), Connected: p.Connected()}
		if op := d.pages[p.OpenerID]; op != nil {
			pv.OpenerLabel = op.Label
		}
		out = append(out, pv)
	}
	sort.Slice(out, func(i, j int) bool { return labelNum(out[i].Label) < labelNum(out[j].Label) })
	return out
}

func labelNum(l string) int {
	var n int
	fmt.Sscanf(strings.TrimPrefix(l, "p"), "%d", &n)
	return n
}

// Devices lists devices ("" projectID for all, otherwise those whose latest
// page came from it): waiting first, then online, then recent.
func (h *Hub) Devices(ctx context.Context, projectID, status string) ([]DeviceView, error) {
	stored, err := h.store.Devices(ctx, projectID, 500)
	if err != nil {
		return nil, err
	}
	h.mu.Lock()
	out := []DeviceView{}
	for _, info := range stored {
		d := h.devices[deviceKey(info.DeviceID)]
		if d != nil {
			info = &d.Info
		}
		v := h.viewOf(*info, d)
		switch status {
		case "online":
			if !v.Online {
				continue
			}
		case "waiting":
			if !v.Help {
				continue
			}
		}
		out = append(out, v)
	}
	h.mu.Unlock()
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Help != b.Help {
			return a.Help
		}
		if a.Online != b.Online {
			return a.Online
		}
		return a.LastSeenAt > b.LastSeenAt
	})
	return out, nil
}

type DeviceDetail struct {
	DeviceView
	PageList []PageView `json:"pages"`
	Timeline []Event    `json:"timeline"`
}

// In returns the view with its text in l (the console's language).
func (v DeviceView) In(l i18n.Lang) DeviceView {
	v.System = ParseUA(v.UA, v.Platform, l)
	return v
}

// In returns the detail with its text in l (the console's language).
func (d *DeviceDetail) In(l i18n.Lang) *DeviceDetail {
	out := *d
	out.DeviceView = d.DeviceView.In(l)
	out.Timeline = make([]Event, len(d.Timeline))
	for i, e := range d.Timeline {
		out.Timeline[i] = e.In(l)
	}
	return &out
}

func (h *Hub) Device(ctx context.Context, deviceID string) (*DeviceDetail, error) {
	info, err := h.store.Device(ctx, deviceID)
	if err != nil {
		return nil, err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	d := h.devices[deviceKey(deviceID)]
	if d != nil {
		info = &d.Info
	}
	out := &DeviceDetail{DeviceView: h.viewOf(*info, d), PageList: []PageView{}, Timeline: []Event{}}
	if d != nil {
		out.PageList = pagesOf(d)
		tl := d.timeline
		if len(tl) > 100 {
			tl = tl[len(tl)-100:]
		}
		out.Timeline = append(out.Timeline, tl...)
	}
	return out, nil
}

func (h *Hub) OnlineCount(projectID string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	n := 0
	for _, d := range h.devices {
		if d.online() && d.hasProject(projectID) {
			n++
		}
	}
	return n
}

// --- presence (polling fallback) ---

// Presence records a polling device and reports whether it should open its
// WebSocket now.
// ErrBadDeviceToken: the device has a token and the request did not present it.
var ErrBadDeviceToken = errors.New("device token missing or invalid")

// Presence is the polling fallback of a page that cannot hold a WebSocket. A
// device that has been issued a token must present it here too: otherwise the
// public app key and a deviceId would be enough to show a device online and
// overwrite what is stored about it.
func (h *Hub) Presence(ctx context.Context, info store.Device, token string, help bool) (code string, connect bool, err error) {
	if known, err := h.store.Device(ctx, info.DeviceID); err == nil && known.TokenHash != "" {
		if token == "" || ids.HashKey(h.pepper, token) != known.TokenHash {
			return "", false, ErrBadDeviceToken
		}
	} else if err != nil && !errors.Is(err, store.ErrNotFound) {
		return "", false, err
	}
	rec, err := h.store.UpsertDevice(ctx, info)
	if err != nil {
		return "", false, err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	d := h.device(*rec)
	if !d.online() {
		d.onlineSince = time.Now()
	}
	d.polledAt = time.Now()
	if help && !d.Help && d.agent == nil {
		d.Help = true
		d.addEvent("", "help", i18n.M(i18n.EventHelp))
	}
	connect = d.pollConnect
	d.pollConnect = false
	return rec.Code, connect, nil
}

// device returns the live device, creating it (h.mu held).
func (h *Hub) device(info store.Device) *Device {
	k := deviceKey(info.DeviceID)
	d := h.devices[k]
	if d == nil {
		d = &Device{Key: k, Info: info, hub: h, Control: ControlNone, pages: map[string]*Page{}}
		h.devices[k] = d
	} else {
		d.Info = info
	}
	return d
}

// --- agents ---

func (h *Hub) agent(keyID, name, keyHint string, maxLevel store.Level) *Agent {
	a := h.agents[keyID]
	if a == nil {
		a = &Agent{KeyID: keyID, Follow: true}
		h.agents[keyID] = a
	}
	a.Name, a.KeyHint, a.MaxLevel = name, keyHint, maxLevel
	return a
}

// DropAgent detaches everything owned by a revoked key.
func (h *Hub) DropAgent(keyID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if a := h.agents[keyID]; a != nil {
		h.detach(a, i18n.M(i18n.NoteKeyRevoked))
		delete(h.agents, keyID)
	}
}

func (h *Hub) detach(a *Agent, reason i18n.Msg) {
	d := a.device
	if d == nil {
		return
	}
	a.device, a.pageID = nil, ""
	a.notes = append(a.notes, reason.In(h.lang))
	delete(h.grants, a.KeyID+"|"+d.Key) // only release() hands one back
	if a.attachTimer != nil {
		a.attachTimer.Stop()
		a.attachTimer = nil
	}
	if d.agent == a {
		d.agent = nil
		d.Level = ""
		if d.Task != nil {
			d.Task = nil
			d.broadcast(taskMsg(nil))
		}
		h.setControl(d, ControlNone, reason)
		h.record(d.Info.ProjectID, "apikey", a.KeyID, a.Name, "attach.end", d.Info.Code, "ok", map[string]any{"reason": reason.In(h.lang)})
	}
}

// resolveDevice finds a device by device code or id.
func (h *Hub) resolveDevice(ctx context.Context, ref string) (*store.Device, error) {
	ref = strings.TrimSpace(ref)
	if info, err := h.store.Device(ctx, ref); err == nil {
		return info, nil
	}
	return h.store.DeviceByCode(ctx, normalizeCode(ref))
}

func normalizeCode(s string) string {
	s = strings.ToUpper(strings.NewReplacer("-", "", " ", "").Replace(s))
	if len(s) == 8 {
		return s[:4] + "-" + s[4:]
	}
	return s
}

// NormalizeCode turns what a person typed ("k7q29m4x", "K7Q2 9M4X") into the
// device code as shown: upper case, a hyphen after four characters.
func NormalizeCode(s string) string { return normalizeCode(s) }

// DeviceListQuery is the console's org-wide device list (docs/protocol.md §12.5).
type DeviceListQuery struct {
	Status    string // online (default) | all
	ProjectID string
	Q         string
	Page      int // 1-based
	PageSize  int
	Names     map[string]string // project id -> name, for display and search
}

// matchDevice is the console's device search (term lower-cased and trimmed,
// compact without dashes): device id, device code with or without its dash,
// userId, user agent, the system label in either language and the names of
// the device's projects.
func matchDevice(v DeviceView, term, compact string, names map[string]string) bool {
	user, _ := v.UserID.(string)
	fields := []string{v.ID, user, v.UA, ParseUA(v.UA, v.Platform, i18n.EN).Label, ParseUA(v.UA, v.Platform, i18n.ZH).Label}
	for _, pid := range v.Projects {
		fields = append(fields, names[pid])
	}
	hay := strings.ToLower(strings.Join(fields, "\n"))
	return strings.Contains(hay, term) || strings.Contains(strings.ToLower(strings.ReplaceAll(v.Code, "-", "")), compact)
}

// DeviceList returns one page of devices and the total. Online devices come
// from memory, newest connection first; "all" pages through the store,
// newest first-seen first.
func (h *Hub) DeviceList(ctx context.Context, q DeviceListQuery) ([]DeviceView, int, error) {
	if q.PageSize <= 0 || q.PageSize > 100 {
		q.PageSize = 20
	}
	if q.Page < 1 {
		q.Page = 1
	}
	term := strings.ToLower(strings.TrimSpace(q.Q))
	compact := strings.ReplaceAll(term, "-", "")
	if q.Status == "all" {
		var stored []*store.Device
		var total int
		var err error
		if term == "" {
			stored, total, err = h.store.SearchDevices(ctx, store.DeviceQuery{ProjectID: q.ProjectID,
				Offset: (q.Page - 1) * q.PageSize, Limit: q.PageSize})
		} else {
			// The same search as for online devices, system labels and
			// project names included: only the hub knows those, so it
			// filters and pages the stored devices itself.
			stored, err = h.store.AllDevices(ctx, q.ProjectID)
		}
		if err != nil {
			return nil, 0, err
		}
		h.mu.Lock()
		out := make([]DeviceView, 0, len(stored))
		for _, info := range stored {
			d := h.devices[deviceKey(info.DeviceID)]
			if d != nil {
				info = &d.Info
			}
			v := h.viewOf(*info, d)
			v.ProjectName = q.Names[v.ProjectID]
			if term != "" && !matchDevice(v, term, compact, q.Names) {
				continue
			}
			out = append(out, v)
		}
		h.mu.Unlock()
		if term != "" {
			total = len(out)
			start := min((q.Page-1)*q.PageSize, total)
			out = out[start:min(start+q.PageSize, total)]
		}
		return out, total, nil
	}

	h.mu.Lock()
	all := []DeviceView{}
	for _, d := range h.devices {
		if (q.ProjectID != "" && !d.hasProject(q.ProjectID)) || !d.online() {
			continue
		}
		v := h.viewOf(d.Info, d)
		v.ProjectName = q.Names[v.ProjectID]
		if term != "" && !matchDevice(v, term, compact, q.Names) {
			continue
		}
		all = append(all, v)
	}
	h.mu.Unlock()
	sort.Slice(all, func(i, j int) bool {
		a, b := all[i], all[j]
		if a.OnlineSince != b.OnlineSince {
			return a.OnlineSince > b.OnlineSince
		}
		return a.ID < b.ID
	})
	total := len(all)
	start := min((q.Page-1)*q.PageSize, total)
	return all[start:min(start+q.PageSize, total)], total, nil
}
