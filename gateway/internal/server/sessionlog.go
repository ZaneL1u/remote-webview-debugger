package server

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/hub"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
)

// The session log: what happened on the device since the app was launched,
// kept by the page SDK in IndexedDB (rwd.log, rwd.logDetail). Unlike the
// timeline it covers the time before any agent attached, every record of it.

type SessionOverviewIn struct {
	Session string `json:"session,omitempty" jsonschema:"param.log.session"`
}

type SessionLogIn struct {
	Session         string   `json:"session,omitempty" jsonschema:"param.log.session"`
	Kinds           []string `json:"kinds,omitempty" jsonschema:"param.log.kinds"`
	Problems        bool     `json:"problems,omitempty" jsonschema:"param.log.problems"`
	Page            string   `json:"page,omitempty" jsonschema:"param.log.page"`
	Text            string   `json:"text,omitempty" jsonschema:"param.log.text"`
	After           int64    `json:"after,omitempty" jsonschema:"param.log.after"`
	Limit           int      `json:"limit,omitempty" jsonschema:"param.log.limit"`
	Seq             int64    `json:"seq,omitempty" jsonschema:"param.log.seq"`
	Exclude         []string `json:"exclude,omitempty" jsonschema:"param.network.exclude"`
	IncludeExcluded bool     `json:"includeExcluded,omitempty" jsonschema:"param.network.include_excluded"`
}

type logMeta struct {
	ID        string         `json:"id"`
	Source    string         `json:"source"`
	StartedAt int64          `json:"startedAt"`
	LastAt    int64          `json:"lastAt"`
	Bytes     int64          `json:"bytes"`
	Trimmed   int            `json:"trimmed"`
	Counts    map[string]int `json:"counts"`
	Current   bool           `json:"current"`
}

type logRecord struct {
	Seq  int64          `json:"seq"`
	At   int64          `json:"at"`
	Kind string         `json:"kind"`
	Page string         `json:"page"`
	Data map[string]any `json:"data"`
}

var pageLabel = regexp.MustCompile(`^p\d+$`)

func (s *Server) addSessionLogTools(srv *mcp.Server) {
	addTool(s, srv, "get_session_overview", true,
		func(ctx context.Context, a *hub.Agent, in SessionOverviewIn, o *out) error {
			raw, _, err := s.call(ctx, a, "", "rwd.log", map[string]any{"op": "overview", "session": in.Session}, false)
			if err != nil {
				return err
			}
			var ov struct {
				Session logMeta `json:"session"`
				First   int64   `json:"first"`
				Last    int64   `json:"last"`
				Pages   []struct {
					At   int64          `json:"at"`
					Page string         `json:"page"`
					Data map[string]any `json:"data"`
				} `json:"pages"`
				Problems []logRecord `json:"problems"`
			}
			if err := json.Unmarshal(raw, &ov); err != nil {
				return err
			}
			m := ov.Session
			source := o.lang.T(i18n.ResLogSourceCookie)
			if m.Source == "app" {
				source = o.lang.T(i18n.ResLogSourceApp)
			}
			current := ""
			if m.Current {
				current = o.lang.T(i18n.ResLogCurrent)
			}
			o.t(i18n.ResLogHeader, m.ID, source, current)
			first, last := ov.First, ov.Last
			if first == 0 {
				first, last = m.StartedAt, m.LastAt
			}
			o.t(i18n.ResLogSpan, fmtTime(first), fmtTime(last), fmtBytes(m.Bytes), m.Trimmed)
			c := m.Counts
			o.t(i18n.ResLogCounts, c["console"]+c["error"], c["error"], c["net"]+c["netFail"], c["netFail"], c["action"], c["agent"], c["page"])

			if len(ov.Pages) > 0 {
				var b strings.Builder
				for _, p := range ov.Pages {
					fmt.Fprintf(&b, "%s %s %s\n", fmtTime(p.At), s.logPage(a, p.Page), recordLine(logRecord{Kind: "page", Data: p.Data}))
				}
				o.t(i18n.ResLogPages)
				o.add("%s", untrusted(o.lang, "session_pages", strings.TrimRight(b.String(), "\n")))
			}
			if len(ov.Problems) == 0 {
				o.t(i18n.ResLogNoProblems)
			} else {
				o.t(i18n.ResLogProblems)
				o.add("%s", untrusted(o.lang, "session_problems", s.recordLines(a, ov.Problems)))
			}

			if raw, _, err := s.call(ctx, a, "", "rwd.log", map[string]any{"op": "sessions"}, false); err == nil {
				var list struct {
					Sessions []logMeta `json:"sessions"`
				}
				_ = json.Unmarshal(raw, &list)
				var others []string
				for _, x := range list.Sessions {
					if x.ID != m.ID {
						others = append(others, o.lang.T(i18n.ResLogOther, x.ID, time.UnixMilli(x.StartedAt).Format("01-02 15:04:05"), fmtTime(x.LastAt), fmtBytes(x.Bytes)))
					}
				}
				if len(others) > 0 {
					o.t(i18n.ResLogOthers)
					o.add("%s", strings.Join(others, "\n"))
				}
			}
			o.t(i18n.ResLogNext)
			return nil
		})

	addTool(s, srv, "get_session_log", true,
		func(ctx context.Context, a *hub.Agent, in SessionLogIn, o *out) error {
			if in.Seq > 0 {
				raw, _, err := s.call(ctx, a, "", "rwd.logDetail", map[string]any{"seq": in.Seq}, false)
				if err != nil {
					return err
				}
				var pretty map[string]any
				_ = json.Unmarshal(raw, &pretty)
				b, _ := json.MarshalIndent(pretty, "", "  ")
				o.add("%s", untrusted(o.lang, "session_log_record", string(b)))
				return nil
			}
			page := in.Page
			if pageLabel.MatchString(page) {
				sess, err := s.hub.Current(a, page)
				if err != nil {
					return err
				}
				page = sess.PageID
			}
			params := map[string]any{"op": "records", "session": in.Session, "kinds": in.Kinds, "problems": in.Problems,
				"page": page, "text": in.Text, "after": in.After, "limit": in.Limit,
				"exclude": in.Exclude, "includeExcluded": in.IncludeExcluded}
			raw, _, err := s.call(ctx, a, "", "rwd.log", params, false)
			if err != nil {
				return err
			}
			var res struct {
				Session string      `json:"session"`
				Records []logRecord `json:"records"`
				Next    *int64      `json:"next"`
				Hidden  int         `json:"hidden"`
			}
			if err := json.Unmarshal(raw, &res); err != nil {
				return err
			}
			if len(res.Records) == 0 {
				o.t(i18n.ResLogEmpty, res.Session)
			} else {
				o.t(i18n.ResLogOf, res.Session)
				o.add("%s", untrusted(o.lang, "session_log", s.recordLines(a, res.Records)))
			}
			if res.Hidden > 0 {
				o.t(i18n.ResNetHidden, res.Hidden)
			}
			if res.Next != nil {
				o.t(i18n.ResLogMore, *res.Next)
			}
			return nil
		})
}

func (s *Server) recordLines(a *hub.Agent, records []logRecord) string {
	var b strings.Builder
	for _, r := range records {
		fmt.Fprintf(&b, "#%d %s %s %s\n", r.Seq, fmtTime(r.At), s.logPage(a, r.Page), recordLine(r))
	}
	return strings.TrimRight(b.String(), "\n")
}

func fmtBytes(n int64) string {
	switch {
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.0f KB", float64(n)/(1<<10))
	}
	return fmt.Sprintf("%d B", n)
}

// logPage shows a record's page as its label when the page is still known,
// else as the start of its SDK page id.
func (s *Server) logPage(a *hub.Agent, pageID string) string {
	if l := s.hub.LabelOf(a, pageID); l != "" {
		return l
	}
	if len(pageID) > 6 {
		return pageID[:6]
	}
	if pageID == "" {
		return "--"
	}
	return pageID
}

func str(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	b, _ := json.Marshal(v)
	return string(b)
}

// recordLine is one record as a line: page events, the user's and the
// agent's actions, console, requests.
func recordLine(r logRecord) string {
	d := r.Data
	switch r.Kind {
	case "page":
		switch str(d["event"]) {
		case "open":
			return fmt.Sprintf("page open %s %q", str(d["url"]), str(d["title"]))
		case "nav":
			return fmt.Sprintf("page nav %s → %s", str(d["from"]), str(d["url"]))
		case "visibility":
			return "page " + str(d["state"])
		default:
			return "page " + str(d["event"])
		}
	case "action":
		switch str(d["event"]) {
		case "input":
			return fmt.Sprintf("user input %s = %q", str(d["target"]), str(d["value"]))
		case "scroll":
			return fmt.Sprintf("user scroll %s y=%s", str(d["target"]), str(d["y"]))
		default:
			return fmt.Sprintf("user %s %s", str(d["event"]), str(d["target"]))
		}
	case "agent":
		parts := []string{"agent", strings.TrimPrefix(str(d["method"]), "rwd.")}
		for _, k := range []string{"ref", "fromRef", "toRef", "key", "url", "values"} {
			if v, ok := d[k]; ok {
				parts = append(parts, k+"="+str(v))
			}
		}
		if t := str(d["text"]); t != "" {
			parts = append(parts, fmt.Sprintf("%q", t))
		}
		if e := str(d["error"]); e != "" {
			parts = append(parts, "✗ "+e)
		}
		return strings.Join(parts, " ")
	case "control":
		line := "control → " + str(d["state"])
		if ag := str(d["agent"]); ag != "" {
			line += " (" + ag + ")"
		}
		return line
	case "console":
		text, _, _ := strings.Cut(str(d["text"]), "\n")
		return "console." + str(d["type"]) + " " + clipRunes(text, 300)
	case "net":
		status := str(d["status"])
		if e := str(d["error"]); e != "" {
			status = "✗ " + e
		}
		line := fmt.Sprintf("%s %s → %s %s %sms", str(d["method"]), str(d["url"]), status, str(d["type"]), str(d["durationMs"]))
		if d["hasBody"] == true {
			line += " [body]"
		}
		return line
	}
	return r.Kind + " " + str(d)
}
