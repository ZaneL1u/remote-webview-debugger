package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/hub"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type agentKey struct{}

func (s *Server) mcpHandler() http.Handler {
	server := mcp.NewServer(&mcp.Implementation{Name: "remote-webview-debugger", Version: s.cfg.Version},
		&mcp.ServerOptions{Instructions: s.cfg.Lang.T(i18n.MCPInstructions)})
	s.addTools(server)
	streamable := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, nil)
	h := auth.RequireBearerToken(s.verifyKey, &auth.RequireBearerTokenOptions{AllowMissingExpiration: true})(streamable)
	if s.mcpLimit == nil {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.mcpLimit.allow(s.clientIP(r)) {
			w.Header().Set("Retry-After", "60")
			s.fail(w, r, http.StatusTooManyRequests, "rate_limited", i18n.APITooManyRequests)
			return
		}
		h.ServeHTTP(w, r)
	})
}

var (
	touchMu sync.Mutex
	touched = map[string]time.Time{}
)

// verifyKey checks the API key on every request, so revocation, and
// disabling or removing the key's owner, take effect immediately.
func (s *Server) verifyKey(ctx context.Context, token string, r *http.Request) (*auth.TokenInfo, error) {
	k, err := s.store.APIKeyByHash(ctx, ids.HashKey(s.pepper, token))
	if err != nil {
		return nil, auth.ErrInvalidToken
	}
	if k.Expired() || !k.OwnerActive() || !ipAllowed(s.clientIP(r), k.IPAllowlist) {
		return nil, auth.ErrInvalidToken
	}
	level := k.MaxLevel
	if k.OwnerID != nil {
		// An owner whose role was lowered keeps their keys, within the new role.
		level = store.MinLevel(level, store.RoleMaxLevel(k.OwnerRole))
	}
	touchMu.Lock()
	if time.Since(touched[k.ID]) > time.Minute {
		touched[k.ID] = time.Now()
		go s.store.TouchAPIKey(context.Background(), k.ID)
	}
	touchMu.Unlock()
	return &auth.TokenInfo{UserID: k.ID, Extra: map[string]any{"name": k.Name,
		"hint": "…" + k.Prefix[len(k.Prefix)-4:], "level": string(level), "owner": k.OwnerEmail}}, nil
}

// --- tool plumbing ---

type out struct {
	lang  i18n.Lang
	lines []string
	image *mcp.ImageContent
}

func (o *out) add(format string, a ...any) { o.lines = append(o.lines, fmt.Sprintf(format, a...)) }

// t adds a line from the message catalog.
func (o *out) t(k i18n.Key, a ...any) { o.lines = append(o.lines, o.lang.T(k, a...)) }

type handler[In any] func(ctx context.Context, a *hub.Agent, in In, o *out) error

// addTool registers a tool. Its description is the message "tool.<name>";
// parameter descriptions are message keys in the jsonschema struct tags.
func addTool[In any](s *Server, srv *mcp.Server, name string, readOnly bool, h handler[In]) {
	l := s.cfg.Lang
	tool := &mcp.Tool{Name: name, Description: mustT(l, "tool."+name), InputSchema: inputSchema[In](l),
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: readOnly}}
	mcp.AddTool(srv, tool, func(ctx context.Context, req *mcp.CallToolRequest, in In) (*mcp.CallToolResult, any, error) {
		ti := req.Extra.TokenInfo
		if ti == nil {
			return errResult(l.T(i18n.MCPUnauthorized)), nil, nil
		}
		owner, _ := ti.Extra["owner"].(string)
		a := s.hub.Agent(ti.UserID, fmt.Sprint(ti.Extra["name"]), fmt.Sprint(ti.Extra["hint"]), owner,
			store.Level(fmt.Sprint(ti.Extra["level"])))
		o := &out{lang: l}
		err := h(ctx, a, in, o)
		if err != nil {
			o.lines = append([]string{l.T(i18n.MCPError, explain(l, err))}, o.lines...)
		}
		if delta := s.hub.Delta(a); len(delta) > 0 {
			o.lines = append(o.lines, "", l.T(i18n.MCPSessionChanges))
			for _, l := range delta {
				o.lines = append(o.lines, "- "+l)
			}
		}
		res := &mcp.CallToolResult{IsError: err != nil}
		if o.image != nil {
			res.Content = append(res.Content, o.image)
		}
		if len(o.lines) > 0 || len(res.Content) == 0 {
			res.Content = append(res.Content, &mcp.TextContent{Text: strings.Join(o.lines, "\n")})
		}
		return res, nil, nil
	})
}

func mustT(l i18n.Lang, k string) string {
	if !l.Has(i18n.Key(k)) {
		panic("i18n: no " + string(l) + " message for " + k)
	}
	return l.T(i18n.Key(k))
}

// inputSchema infers the input schema of In and translates its descriptions.
func inputSchema[In any](l i18n.Lang) *jsonschema.Schema {
	schema, err := jsonschema.For[In](nil)
	if err != nil {
		panic(err)
	}
	var localize func(*jsonschema.Schema)
	localize = func(s *jsonschema.Schema) {
		if s == nil {
			return
		}
		if s.Description != "" {
			s.Description = mustT(l, s.Description)
		}
		for _, p := range s.Properties {
			localize(p)
		}
		localize(s.Items)
	}
	localize(schema)
	return schema
}

func errResult(msg string) *mcp.CallToolResult {
	return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: msg}}}
}

// errorf makes an error for the agent from the message catalog.
func (s *Server) errorf(k i18n.Key, a ...any) error { return errors.New(s.cfg.Lang.T(k, a...)) }

func explain(l i18n.Lang, err error) string {
	var re *hub.RPCError
	if errors.As(err, &re) {
		switch re.Code {
		case "not_found":
			if re.Message != "" {
				return l.T(i18n.ExplainNotFoundRef, re.Message)
			}
			return l.T(i18n.ExplainNotFound)
		case "not_interactable":
			return l.T(i18n.ExplainNotUsable, detail(l, re))
		case "timeout":
			return l.T(i18n.ExplainTimeout)
		case "takeover":
			return re.Text(l)
		}
		return re.Code + ": " + re.Text(l)
	}
	return hub.ErrorText(l, err)
}

func detail(l i18n.Lang, re *hub.RPCError) string {
	if re.Message == "" {
		return ""
	}
	return l.T(i18n.ExplainDetail, re.Message)
}

const rpcTimeout = 20 * time.Second

// mayConfirm reports whether the page may show the user a confirmation before
// answering: clicks, key presses, and typing that submits the form.
func mayConfirm(method string, params any) bool {
	switch method {
	case "rwd.click", "rwd.press":
		return true
	case "rwd.type":
		m, _ := params.(map[string]any)
		submit, _ := m["submit"].(bool)
		return submit
	}
	return false
}

func (s *Server) call(ctx context.Context, a *hub.Agent, page, method string, params any, interactive bool) (json.RawMessage, *hub.Session, error) {
	sess, err := s.hub.Current(a, page)
	if err != nil {
		return nil, nil, err
	}
	if err := s.hub.CheckLevel(sess, method); err != nil {
		return nil, sess, err
	}
	if interactive {
		if err := s.hub.BeginInteraction(sess); err != nil {
			return nil, sess, err
		}
	}
	timeout := rpcTimeout
	if mayConfirm(method, params) {
		timeout = 45 * time.Second // the user may be asked to confirm (protocol §8)
	}
	start := time.Now()
	raw, err := s.hub.Call(ctx, sess.Device, sess.PageID, method, params, timeout)
	detail := map[string]any{"method": method, "page": sess.Label, "latencyMs": time.Since(start).Milliseconds()}
	result := "ok"
	if err != nil {
		result, detail["error"] = "error", hub.ErrorText(s.cfg.Lang, err)
	}
	if a.Owner != "" {
		detail["owner"] = a.Owner
	}
	pid := sess.Device.Info.ProjectID
	s.recordEvent(store.AuditEvent{ProjectID: &pid, ActorType: "apikey", ActorID: a.KeyID, ActorName: a.Name,
		Action: "rpc", Target: sess.Device.Info.Code, Result: result, Detail: detail})
	return raw, sess, err
}

// untrusted frames page-originated content for the model.
func untrusted(l i18n.Lang, tag, body string) string {
	return l.T(i18n.MCPUntrusted, tag, body, tag)
}

func fmtTime(ms int64) string { return time.UnixMilli(ms).Format("15:04:05") }

func controlName(l i18n.Lang, c string) string {
	return l.T(map[string]i18n.Key{hub.ControlNone: i18n.ControlNone, hub.ControlObserve: i18n.ControlObserve,
		hub.ControlAgent: i18n.ControlAgent, hub.ControlUser: i18n.ControlUser}[c])
}

func describeDevice(l i18n.Lang, d hub.DeviceView) string {
	parts := []string{d.Code}
	switch {
	case d.Help:
		parts = append(parts, l.T(i18n.DeviceHelp))
	case d.Online:
		parts = append(parts, l.T(i18n.DeviceOnline))
	default:
		parts = append(parts, l.T(i18n.DeviceOffline))
	}
	if d.System.Label != "" {
		parts = append(parts, d.System.Label)
	} else if d.Platform != "" {
		parts = append(parts, d.Platform)
	}
	if d.App != nil && d.App.Name != "" {
		parts = append(parts, d.App.Name+" "+d.App.Version)
	}
	if d.UserID != nil {
		parts = append(parts, l.T(i18n.DeviceUser, d.UserID))
	}
	parts = append(parts, l.T(i18n.DevicePages, d.Pages))
	if d.Control != hub.ControlNone {
		parts = append(parts, controlName(l, d.Control))
	}
	parts = append(parts, l.T(i18n.DeviceLastSeen, fmtTime(d.LastSeenAt)))
	return strings.Join(parts, " · ")
}

func describePage(l i18n.Lang, p hub.PageView, current string) string {
	s := l.T(i18n.PageTitled, p.Label, p.Title) + " " + p.URL
	var tags []string
	if p.ID == current {
		tags = append(tags, l.T(i18n.PageSelected))
	}
	if p.Focused {
		tags = append(tags, l.T(i18n.PageForeground))
	} else if p.Visibility == "hidden" {
		tags = append(tags, l.T(i18n.PageBackground))
	}
	if !p.Connected {
		tags = append(tags, l.T(i18n.PageReconnecting))
	}
	if p.OpenerLabel != nil {
		tags = append(tags, l.T(i18n.PageOpenedBy, p.OpenerLabel))
	}
	if len(tags) > 0 {
		s += " [" + strings.Join(tags, l.T(i18n.ListSep)) + "]"
	}
	return s
}

// --- inputs ---

type ListDevicesIn struct {
	Status     string `json:"status,omitempty" jsonschema:"param.list_devices.status"`
	UserID     string `json:"userId,omitempty" jsonschema:"param.list_devices.user_id"`
	DeviceCode string `json:"deviceCode,omitempty" jsonschema:"param.list_devices.device_code"`
}

type DeviceIn struct {
	Device string `json:"device" jsonschema:"param.device"`
	Level  string `json:"level,omitempty" jsonschema:"param.level"`
	Follow *bool  `json:"follow,omitempty" jsonschema:"param.follow"`
}

type WaitEventIn struct {
	Kind       string `json:"kind,omitempty" jsonschema:"param.wait_event.kind"`
	Page       string `json:"page,omitempty" jsonschema:"param.wait_event.page"`
	TimeoutSec int    `json:"timeoutSec,omitempty" jsonschema:"param.timeout_30_300"`
}

type BatchIn struct {
	Actions []struct {
		Tool string         `json:"tool" jsonschema:"param.batch.tool"`
		Args map[string]any `json:"args,omitempty" jsonschema:"param.batch.args"`
	} `json:"actions" jsonschema:"param.batch.actions"`
	StopOnError *bool `json:"stopOnError,omitempty" jsonschema:"param.batch.stop_on_error"`
}

type FindIn struct {
	Text  string `json:"text,omitempty" jsonschema:"param.find.text"`
	Role  string `json:"role,omitempty" jsonschema:"param.find.role"`
	Name  string `json:"name,omitempty" jsonschema:"param.find.name"`
	Limit int    `json:"limit,omitempty" jsonschema:"param.find.limit"`
	Page  string `json:"page,omitempty" jsonschema:"param.find.page"`
}

type TaskIn struct {
	Title   string   `json:"title" jsonschema:"param.task.title"`
	Steps   []string `json:"steps,omitempty" jsonschema:"param.task.steps"`
	Current int      `json:"current,omitempty" jsonschema:"param.task.current"`
}

type StorageIn struct {
	Area string `json:"area" jsonschema:"param.storage.area"`
	Page string `json:"page,omitempty" jsonschema:"param.page_opt"`
}

type WaitDeviceIn struct {
	Device     string `json:"device" jsonschema:"param.device_ref"`
	TimeoutSec int    `json:"timeoutSec,omitempty" jsonschema:"param.timeout_60_300"`
}

type NoIn struct{}

type PageIn struct {
	Page string `json:"page" jsonschema:"param.page"`
}

type OptPageIn struct {
	Page string `json:"page,omitempty" jsonschema:"param.page_selected"`
}

type ScreenshotIn struct {
	Page     string `json:"page,omitempty" jsonschema:"param.page_opt"`
	FullPage bool   `json:"fullPage,omitempty" jsonschema:"param.screenshot.full_page"`
	Format   string `json:"format,omitempty" jsonschema:"param.screenshot.format"`
}

type RefIn struct {
	Ref string `json:"ref" jsonschema:"param.ref"`
}

type FillIn struct {
	Ref   string `json:"ref" jsonschema:"param.fill.ref"`
	Value string `json:"value" jsonschema:"param.fill.value"`
}

type TypeIn struct {
	Text   string `json:"text" jsonschema:"param.type.text"`
	Ref    string `json:"ref,omitempty" jsonschema:"param.type.ref"`
	Submit bool   `json:"submit,omitempty" jsonschema:"param.type.submit"`
}

type PressIn struct {
	Key string `json:"key" jsonschema:"param.press.key"`
}

type SelectIn struct {
	Ref    string   `json:"ref" jsonschema:"param.select.ref"`
	Values []string `json:"values" jsonschema:"param.select.values"`
}

type ScrollIn struct {
	Ref string `json:"ref,omitempty" jsonschema:"param.scroll.ref"`
	Dx  int    `json:"dx,omitempty" jsonschema:"param.scroll.dx"`
	Dy  int    `json:"dy,omitempty" jsonschema:"param.scroll.dy"`
}

type DragIn struct {
	FromRef string `json:"fromRef" jsonschema:"param.drag.from_ref"`
	ToRef   string `json:"toRef" jsonschema:"param.drag.to_ref"`
}

type NavigateIn struct {
	URL string `json:"url" jsonschema:"param.url"`
}

type WaitForIn struct {
	Text     string `json:"text,omitempty" jsonschema:"param.wait_for.text"`
	TextGone string `json:"textGone,omitempty" jsonschema:"param.wait_for.text_gone"`
	TimeSec  int    `json:"timeSec,omitempty" jsonschema:"param.wait_for.time_sec"`
}

type ConsoleIn struct {
	Scope string   `json:"scope,omitempty" jsonschema:"param.console.scope"`
	Types []string `json:"types,omitempty" jsonschema:"param.console.types"`
	Limit int      `json:"limit,omitempty" jsonschema:"param.limit_50"`
}

type NetworkIn struct {
	Scope      string `json:"scope,omitempty" jsonschema:"param.network.scope"`
	FailedOnly bool   `json:"failedOnly,omitempty" jsonschema:"param.network.failed_only"`
	Limit      int    `json:"limit,omitempty" jsonschema:"param.limit_50"`
	// Exclude adds rules for this call; IncludeExcluded shows what the rules hide.
	Exclude         []string `json:"exclude,omitempty" jsonschema:"param.network.exclude"`
	IncludeExcluded bool     `json:"includeExcluded,omitempty" jsonschema:"param.network.include_excluded"`
}

type NetworkDetailIn struct {
	ID string `json:"id" jsonschema:"param.network.id"`
}

type TimelineIn struct {
	Limit int `json:"limit,omitempty" jsonschema:"param.limit_50"`
}

type WaitPageIn struct {
	URLContains   string `json:"urlContains,omitempty" jsonschema:"param.wait_page.url_contains"`
	TitleContains string `json:"titleContains,omitempty" jsonschema:"param.wait_page.title_contains"`
	TimeoutSec    int    `json:"timeoutSec,omitempty" jsonschema:"param.timeout_30"`
}

type WaitControlIn struct {
	TimeoutSec int `json:"timeoutSec,omitempty" jsonschema:"param.timeout_120_600"`
}

type EvalIn struct {
	Function string `json:"function" jsonschema:"param.eval.function"`
	Args     []any  `json:"args,omitempty" jsonschema:"param.eval.args"`
	Page     string `json:"page,omitempty" jsonschema:"param.page_opt"`
}

func clampSec(v, def, max int) time.Duration {
	if v <= 0 {
		v = def
	}
	if v > max {
		v = max
	}
	return time.Duration(v) * time.Second
}

// --- tools ---

func (s *Server) addTools(srv *mcp.Server) {
	addTool(s, srv, "list_devices", true,
		func(ctx context.Context, a *hub.Agent, in ListDevicesIn, o *out) error {
			if s.cfg.DemoKeys && in.DeviceCode == "" {
				// Everyone has a key here: don't hand out other visitors' devices.
				return s.errorf(i18n.ErrDemoNeedsCode)
			}
			status := in.Status
			if status == "" {
				status = "online"
			}
			devices, err := s.hub.Devices(ctx, "", status)
			if err != nil {
				return err
			}
			n := 0
			for _, d := range devices {
				if in.UserID != "" && fmt.Sprint(d.UserID) != in.UserID {
					continue
				}
				if in.DeviceCode != "" && d.Code != hub.NormalizeCode(in.DeviceCode) {
					continue
				}
				o.add("- %s", describeDevice(o.lang, d))
				n++
				if n >= 50 {
					break
				}
			}
			if n == 0 {
				o.t(i18n.ResNoDevices)
			}
			return nil
		})

	addTool(s, srv, "connect_device", false,
		func(ctx context.Context, a *hub.Agent, in DeviceIn, o *out) error {
			follow := in.Follow == nil || *in.Follow
			level := store.Level(in.Level)
			if in.Level != "" && !level.Valid() {
				return s.errorf(i18n.ErrBadLevel)
			}
			d, pages, err := s.hub.Connect(ctx, a, in.Device, follow, level)
			if err != nil {
				return err
			}
			o.t(i18n.ResConnected, describeDevice(o.lang, d), d.Level)
			_, cur, _ := s.hub.Pages(a)
			o.t(i18n.ResPages)
			for _, p := range pages {
				o.add("- %s", describePage(o.lang, p, cur))
			}
			o.t(i18n.ResNextSnapshot)
			return nil
		})

	addTool(s, srv, "disconnect_device", false,
		func(ctx context.Context, a *hub.Agent, in NoIn, o *out) error {
			if s.hub.Disconnect(a) {
				o.t(i18n.ResDisconnected)
			} else {
				o.t(i18n.ResNotConnected)
			}
			return nil
		})

	addTool(s, srv, "set_task", false,
		func(ctx context.Context, a *hub.Agent, in TaskIn, o *out) error {
			title := clipRunes(strings.TrimSpace(in.Title), 24)
			if title == "" {
				return s.errorf(i18n.ErrTaskTitle)
			}
			steps := []string{}
			for _, st := range in.Steps {
				if st = clipRunes(strings.TrimSpace(st), 28); st != "" && len(steps) < 12 {
					steps = append(steps, st)
				}
			}
			current := max(0, min(in.Current, len(steps)))
			if err := s.hub.SetTask(a, &hub.Task{Title: title, Steps: steps, Current: current}); err != nil {
				return err
			}
			switch {
			case len(steps) == 0:
				o.t(i18n.ResTaskShown, title)
			case current >= len(steps):
				o.t(i18n.ResTaskDone, title, len(steps))
			default:
				o.t(i18n.ResTaskStep, title, current+1, len(steps), steps[current], current+1)
			}
			return nil
		})

	addTool(s, srv, "wait_for_device", true,
		func(ctx context.Context, a *hub.Agent, in WaitDeviceIn, o *out) error {
			ctx, cancel := context.WithTimeout(ctx, clampSec(in.TimeoutSec, 60, 300))
			defer cancel()
			d, err := s.hub.WaitDevice(ctx, in.Device)
			if err != nil {
				return err
			}
			o.t(i18n.ResDeviceOnline, describeDevice(o.lang, *d))
			return nil
		})

	addTool(s, srv, "list_pages", true,
		func(ctx context.Context, a *hub.Agent, in NoIn, o *out) error {
			pages, cur, err := s.hub.Pages(a)
			if err != nil {
				return err
			}
			for _, p := range pages {
				o.add("- %s", describePage(o.lang, p, cur))
			}
			return nil
		})

	addTool(s, srv, "select_page", true,
		func(ctx context.Context, a *hub.Agent, in PageIn, o *out) error {
			p, err := s.hub.SelectPage(a, in.Page)
			if err != nil {
				return err
			}
			o.t(i18n.ResCurrentPage, describePage(o.lang, *p, p.ID))
			return nil
		})

	addTool(s, srv, "take_snapshot", true,
		func(ctx context.Context, a *hub.Agent, in OptPageIn, o *out) error {
			raw, sess, err := s.call(ctx, a, in.Page, "rwd.snapshot", nil, false)
			if err != nil {
				return err
			}
			var r struct{ URL, Title, Snapshot string }
			_ = json.Unmarshal(raw, &r)
			o.t(i18n.ResSnapshotHeader, sess.Label, r.Title, r.URL)
			o.add("%s", untrusted(o.lang, "page_snapshot", r.Snapshot))
			return nil
		})

	addTool(s, srv, "take_screenshot", true,
		func(ctx context.Context, a *hub.Agent, in ScreenshotIn, o *out) error {
			format := in.Format
			if format != "png" {
				format = "jpeg"
			}
			raw, sess, err := s.call(ctx, a, in.Page, "rwd.screenshot", map[string]any{"format": format, "quality": 80, "fullPage": in.FullPage}, false)
			if err != nil {
				return err
			}
			var r struct {
				Data, MimeType, Source string
				Width, Height          int
			}
			_ = json.Unmarshal(raw, &r)
			data, err := base64.StdEncoding.DecodeString(r.Data)
			if err != nil {
				return s.errorf(i18n.ErrBadScreenshot)
			}
			o.image = &mcp.ImageContent{Data: data, MIMEType: r.MimeType}
			src := map[string]string{"native": o.lang.T(i18n.ResScreenshotNative), "dom": o.lang.T(i18n.ResScreenshotDOM)}[r.Source]
			o.t(i18n.ResScreenshot, sess.Label, r.Width, r.Height, src)
			return nil
		})

	addTool(s, srv, "click", false, func(ctx context.Context, a *hub.Agent, in RefIn, o *out) error {
		return s.action(ctx, a, o, "rwd.click", map[string]any{"ref": in.Ref}, i18n.M(i18n.ResClicked, in.Ref))
	})
	addTool(s, srv, "hover", false, func(ctx context.Context, a *hub.Agent, in RefIn, o *out) error {
		return s.action(ctx, a, o, "rwd.hover", map[string]any{"ref": in.Ref}, i18n.M(i18n.ResHovered, in.Ref))
	})
	addTool(s, srv, "fill", false, func(ctx context.Context, a *hub.Agent, in FillIn, o *out) error {
		return s.action(ctx, a, o, "rwd.fill", map[string]any{"ref": in.Ref, "value": in.Value}, i18n.M(i18n.ResFilled, in.Ref))
	})
	addTool(s, srv, "type_text", false, func(ctx context.Context, a *hub.Agent, in TypeIn, o *out) error {
		p := map[string]any{"text": in.Text, "submit": in.Submit}
		if in.Ref != "" {
			p["ref"] = in.Ref
		}
		return s.action(ctx, a, o, "rwd.type", p, i18n.M(i18n.ResTyped))
	})
	addTool(s, srv, "press_key", false, func(ctx context.Context, a *hub.Agent, in PressIn, o *out) error {
		return s.action(ctx, a, o, "rwd.press", map[string]any{"key": in.Key}, i18n.M(i18n.ResPressed, in.Key))
	})
	addTool(s, srv, "select_option", false, func(ctx context.Context, a *hub.Agent, in SelectIn, o *out) error {
		return s.action(ctx, a, o, "rwd.select", map[string]any{"ref": in.Ref, "values": in.Values}, i18n.M(i18n.ResSelected))
	})
	addTool(s, srv, "scroll", false, func(ctx context.Context, a *hub.Agent, in ScrollIn, o *out) error {
		dy := in.Dy
		if dy == 0 && in.Dx == 0 {
			dy = 600
		}
		p := map[string]any{"dx": in.Dx, "dy": dy}
		if in.Ref != "" {
			p["ref"] = in.Ref
		}
		return s.action(ctx, a, o, "rwd.scroll", p, i18n.M(i18n.ResScrolled))
	})
	addTool(s, srv, "drag", false, func(ctx context.Context, a *hub.Agent, in DragIn, o *out) error {
		return s.action(ctx, a, o, "rwd.drag", map[string]any{"fromRef": in.FromRef, "toRef": in.ToRef}, i18n.M(i18n.ResDragged))
	})
	addTool(s, srv, "navigate_page", false, func(ctx context.Context, a *hub.Agent, in NavigateIn, o *out) error {
		return s.action(ctx, a, o, "rwd.navigate", map[string]any{"url": in.URL}, i18n.M(i18n.ResNavigating, in.URL))
	})
	addTool(s, srv, "go_back", false, func(ctx context.Context, a *hub.Agent, in NoIn, o *out) error {
		return s.action(ctx, a, o, "rwd.back", nil, i18n.M(i18n.ResWentBack))
	})
	addTool(s, srv, "reload_page", false, func(ctx context.Context, a *hub.Agent, in NoIn, o *out) error {
		return s.action(ctx, a, o, "rwd.reload", nil, i18n.M(i18n.ResReloading))
	})

	addTool(s, srv, "wait_for", true,
		func(ctx context.Context, a *hub.Agent, in WaitForIn, o *out) error {
			p := map[string]any{"timeoutMs": 10000}
			if in.Text != "" {
				p["text"] = in.Text
			}
			if in.TextGone != "" {
				p["textGone"] = in.TextGone
			}
			if in.TimeSec > 0 {
				p["timeMs"] = min(in.TimeSec, 30) * 1000
			}
			if _, _, err := s.call(ctx, a, "", "rwd.waitFor", p, false); err != nil {
				return err
			}
			o.t(i18n.ResWaitDone)
			return nil
		})

	addTool(s, srv, "list_console_messages", true,
		func(ctx context.Context, a *hub.Agent, in ConsoleIn, o *out) error {
			limit := in.Limit
			if limit <= 0 {
				limit = 50
			}
			type msg struct {
				ID   any    `json:"id"`
				Type string `json:"type"`
				Text string `json:"text"`
				At   int64  `json:"at"`
				page string
			}
			var all []msg
			dropped := 0
			err := s.eachPage(ctx, a, in.Scope, "rwd.console", map[string]any{"limit": limit, "types": in.Types},
				func(label string, raw json.RawMessage) {
					var r struct {
						Messages []msg `json:"messages"`
						Dropped  int   `json:"dropped"`
					}
					_ = json.Unmarshal(raw, &r)
					for _, m := range r.Messages {
						m.page = label
						all = append(all, m)
					}
					dropped += r.Dropped
				})
			if err != nil {
				return err
			}
			sort.SliceStable(all, func(i, j int) bool { return all[i].At < all[j].At })
			if len(all) > limit {
				all = all[len(all)-limit:]
			}
			var b strings.Builder
			for _, m := range all {
				fmt.Fprintf(&b, "%s %s [%s] %s\n", fmtTime(m.At), m.page, m.Type, m.Text)
			}
			if len(all) == 0 {
				o.t(i18n.ResNoConsole)
				return nil
			}
			if dropped > 0 {
				o.t(i18n.ResConsoleDropped, dropped)
			}
			o.add("%s", untrusted(o.lang, "console", strings.TrimRight(b.String(), "\n")))
			return nil
		})

	addTool(s, srv, "list_network_requests", true,
		func(ctx context.Context, a *hub.Agent, in NetworkIn, o *out) error {
			limit := in.Limit
			if limit <= 0 {
				limit = 50
			}
			type req struct {
				ID         any    `json:"id"`
				Method     string `json:"method"`
				URL        string `json:"url"`
				Status     int    `json:"status"`
				Type       string `json:"type"`
				DurationMs int    `json:"durationMs"`
				Size       int    `json:"size"`
				Error      string `json:"error"`
				At         int64  `json:"at"`
				page       string
			}
			var all []req
			hidden := 0
			err := s.eachPage(ctx, a, in.Scope, "rwd.network", map[string]any{"limit": limit, "failedOnly": in.FailedOnly,
				"exclude": in.Exclude, "includeExcluded": in.IncludeExcluded},
				func(label string, raw json.RawMessage) {
					var r struct {
						Requests []req `json:"requests"`
						Hidden   int   `json:"hidden"`
					}
					_ = json.Unmarshal(raw, &r)
					hidden += r.Hidden
					for _, q := range r.Requests {
						q.page = label
						all = append(all, q)
					}
				})
			if err != nil {
				return err
			}
			sort.SliceStable(all, func(i, j int) bool { return all[i].At < all[j].At })
			if len(all) > limit {
				all = all[len(all)-limit:]
			}
			if len(all) == 0 {
				o.t(i18n.ResNoNetwork)
				if hidden > 0 {
					o.t(i18n.ResNetHidden, hidden)
				}
				return nil
			}
			var b strings.Builder
			for _, q := range all {
				status := fmt.Sprint(q.Status)
				if q.Error != "" {
					status = o.lang.T(i18n.ResNetFailed, q.Error)
				} else if q.Status == 0 {
					status = o.lang.T(i18n.ResNetPending)
				}
				fmt.Fprintf(&b, "id=%s:%v %s %s → %s %s %dms\n", q.page, q.ID, q.Method, q.URL, status, q.Type, q.DurationMs)
			}
			o.add("%s", untrusted(o.lang, "network", strings.TrimRight(b.String(), "\n")))
			if hidden > 0 {
				o.t(i18n.ResNetHidden, hidden)
			}
			return nil
		})

	addTool(s, srv, "get_network_request", true,
		func(ctx context.Context, a *hub.Agent, in NetworkDetailIn, o *out) error {
			label, id, ok := strings.Cut(in.ID, ":")
			if !ok {
				label, id = "", in.ID
			}
			raw, _, err := s.call(ctx, a, label, "rwd.networkDetail", map[string]any{"id": jsonID(id)}, false)
			if err != nil {
				return err
			}
			var pretty map[string]any
			_ = json.Unmarshal(raw, &pretty)
			b, _ := json.MarshalIndent(pretty, "", "  ")
			o.add("%s", untrusted(o.lang, "network_request", string(b)))
			return nil
		})

	addTool(s, srv, "get_session_timeline", true,
		func(ctx context.Context, a *hub.Agent, in TimelineIn, o *out) error {
			limit := in.Limit
			if limit <= 0 {
				limit = 50
			}
			events, err := s.hub.Timeline(a, limit)
			if err != nil {
				return err
			}
			if len(events) == 0 {
				o.t(i18n.ResNoEvents)
				return nil
			}
			var b strings.Builder
			for _, e := range events {
				page := e.Page
				if page == "" {
					page = "--"
				}
				fmt.Fprintf(&b, "%s %s %s %s\n", fmtTime(e.At), page, e.Kind, e.Summary)
			}
			o.add("%s", untrusted(o.lang, "timeline", strings.TrimRight(b.String(), "\n")))
			return nil
		})

	s.addSessionLogTools(srv)

	addTool(s, srv, "wait_for_page", true,
		func(ctx context.Context, a *hub.Agent, in WaitPageIn, o *out) error {
			ctx, cancel := context.WithTimeout(ctx, clampSec(in.TimeoutSec, 30, 300))
			defer cancel()
			p, err := s.hub.WaitPage(ctx, a, in.URLContains, in.TitleContains)
			if err != nil {
				return err
			}
			_, cur, _ := s.hub.Pages(a)
			o.t(i18n.ResPageAppeared, describePage(o.lang, *p, cur))
			return nil
		})

	addTool(s, srv, "wait_for_control", true,
		func(ctx context.Context, a *hub.Agent, in WaitControlIn, o *out) error {
			ctx, cancel := context.WithTimeout(ctx, clampSec(in.TimeoutSec, 120, 600))
			defer cancel()
			state, err := s.hub.WaitControl(ctx, a)
			if err != nil {
				return err
			}
			if state == hub.ControlNone {
				o.t(i18n.ResSessionEnded)
			} else {
				o.t(i18n.ResControlReturned)
			}
			return nil
		})

	addTool(s, srv, "wait_for_event", true,
		func(ctx context.Context, a *hub.Agent, in WaitEventIn, o *out) error {
			ctx, cancel := context.WithTimeout(ctx, clampSec(in.TimeoutSec, 30, 300))
			defer cancel()
			e, err := s.hub.WaitEvent(ctx, a, in.Kind, in.Page)
			if err != nil {
				return err
			}
			page := e.Page
			if page == "" {
				page = "--"
			}
			o.add("%s", untrusted(o.lang, "event", fmt.Sprintf("%s %s %s %s", fmtTime(e.At), page, e.Kind, e.Summary)))
			return nil
		})

	addTool(s, srv, "batch_actions", false,
		func(ctx context.Context, a *hub.Agent, in BatchIn, o *out) error {
			stop := in.StopOnError == nil || *in.StopOnError
			if len(in.Actions) == 0 || len(in.Actions) > 30 {
				return s.errorf(i18n.ErrBatchSize)
			}
			failed := 0
			for i, act := range in.Actions {
				method, params, interactive, err := batchStep(o.lang, act.Tool, act.Args)
				if err == nil {
					_, _, err = s.call(ctx, a, "", method, params, interactive)
				}
				if err != nil {
					failed++
					o.t(i18n.ResBatchStepFailed, i+1, act.Tool, explain(o.lang, err))
					if stop {
						o.t(i18n.ResBatchStopped, len(in.Actions)-i-1)
						break
					}
					continue
				}
				o.t(i18n.ResBatchStepDone, i+1, act.Tool)
			}
			if failed > 0 {
				return s.errorf(i18n.ErrBatchFailed, failed)
			}
			return nil
		})

	addTool(s, srv, "find_elements", true,
		func(ctx context.Context, a *hub.Agent, in FindIn, o *out) error {
			if in.Text == "" && in.Role == "" && in.Name == "" {
				return s.errorf(i18n.ErrFindEmpty)
			}
			params := map[string]any{"text": in.Text, "role": in.Role, "name": in.Name}
			if in.Limit > 0 {
				params["limit"] = in.Limit
			}
			raw, sess, err := s.call(ctx, a, in.Page, "rwd.query", params, false)
			if err != nil {
				return err
			}
			var r struct {
				Matches []struct{ Ref, Role, Name, Text string } `json:"matches"`
				Total   int                                      `json:"total"`
			}
			_ = json.Unmarshal(raw, &r)
			if len(r.Matches) == 0 {
				o.t(i18n.ResFindNone, sess.Label)
				return nil
			}
			var b strings.Builder
			for _, m := range r.Matches {
				fmt.Fprintf(&b, "- %s \"%s\" [ref=%s]", m.Role, m.Name, m.Ref)
				if m.Text != "" && m.Text != m.Name {
					b.WriteString(o.lang.T(i18n.ResFindText, m.Text))
				}
				b.WriteString("\n")
			}
			o.t(i18n.ResFindFound, sess.Label, r.Total, len(r.Matches))
			o.add("%s", untrusted(o.lang, "elements", strings.TrimRight(b.String(), "\n")))
			return nil
		})

	addTool(s, srv, "get_storage", true,
		func(ctx context.Context, a *hub.Agent, in StorageIn, o *out) error {
			if in.Area != "local" && in.Area != "session" && in.Area != "cookie" {
				return s.errorf(i18n.ErrBadArea)
			}
			raw, sess, err := s.call(ctx, a, in.Page, "rwd.storage", map[string]any{"area": in.Area}, false)
			if err != nil {
				return err
			}
			var pretty any
			_ = json.Unmarshal(raw, &pretty)
			b, _ := json.MarshalIndent(pretty, "", "  ")
			o.t(i18n.ResStorage, sess.Label, in.Area)
			o.add("%s", untrusted(o.lang, "storage", string(b)))
			return nil
		})

	addTool(s, srv, "evaluate_script", false,
		func(ctx context.Context, a *hub.Agent, in EvalIn, o *out) error {
			raw, sess, err := s.call(ctx, a, in.Page, "rwd.evaluate", map[string]any{"function": in.Function, "args": in.Args}, false)
			if err != nil {
				return err
			}
			var r struct {
				Value json.RawMessage `json:"value"`
			}
			_ = json.Unmarshal(raw, &r)
			v := string(r.Value)
			if len(v) > 20000 {
				v = v[:20000] + o.lang.T(i18n.ResTruncated)
			}
			o.t(i18n.ResEvalReturned, sess.Label)
			o.add("%s", untrusted(o.lang, "evaluate_result", v))
			return nil
		})
}

// batchStep maps a batch entry to the page RPC the single tool would send.
func batchStep(l i18n.Lang, tool string, args map[string]any) (method string, params map[string]any, interactive bool, err error) {
	if args == nil {
		args = map[string]any{}
	}
	pick := func(keys ...string) map[string]any {
		p := map[string]any{}
		for _, k := range keys {
			if v, ok := args[k]; ok {
				p[k] = v
			}
		}
		return p
	}
	switch tool {
	case "click":
		return "rwd.click", pick("ref"), true, nil
	case "hover":
		return "rwd.hover", pick("ref"), true, nil
	case "fill":
		return "rwd.fill", pick("ref", "value"), true, nil
	case "type_text":
		return "rwd.type", pick("text", "ref", "submit"), true, nil
	case "press_key":
		return "rwd.press", pick("key"), true, nil
	case "select_option":
		return "rwd.select", pick("ref", "values"), true, nil
	case "scroll":
		p := pick("ref", "dx", "dy")
		if p["dx"] == nil && p["dy"] == nil {
			p["dy"] = 600
		}
		return "rwd.scroll", p, true, nil
	case "wait_for":
		p := pick("text", "textGone")
		p["timeoutMs"] = 10000
		if v, ok := args["timeSec"].(float64); ok && v > 0 {
			p["timeMs"] = min(int(v), 30) * 1000
		}
		return "rwd.waitFor", p, false, nil
	}
	return "", nil, false, errors.New(l.T(i18n.ErrUnsupportedAction, tool))
}

func jsonID(id string) any {
	var n json.Number
	if err := json.Unmarshal([]byte(id), &n); err == nil {
		return n
	}
	return id
}

// action runs an interactive RPC on the current page.
func (s *Server) action(ctx context.Context, a *hub.Agent, o *out, method string, params any, done i18n.Msg) error {
	if params == nil {
		params = map[string]any{}
	}
	_, sess, err := s.call(ctx, a, "", method, params, true)
	if err != nil {
		return err
	}
	o.t(i18n.ResActionDone, done, sess.Label)
	return nil
}

// eachPage runs a read RPC on the current page, or on every connected page of
// the device when scope is "session".
func (s *Server) eachPage(ctx context.Context, a *hub.Agent, scope, method string, params any, fn func(label string, raw json.RawMessage)) error {
	if scope != "session" {
		raw, sess, err := s.call(ctx, a, "", method, params, false)
		if err != nil {
			return err
		}
		fn(sess.Label, raw)
		return nil
	}
	pages, _, err := s.hub.Pages(a)
	if err != nil {
		return err
	}
	var firstErr error
	ok := 0
	for _, p := range pages {
		if !p.Connected {
			continue
		}
		raw, _, err := s.call(ctx, a, p.Label, method, params, false)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("%s: %w", p.Label, err)
			}
			continue
		}
		ok++
		fn(p.Label, raw)
	}
	if ok == 0 && firstErr != nil {
		return firstErr
	}
	return nil
}

func clipRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
