package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/hub"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

func (s *Server) routes(mux *http.ServeMux) {
	member := func(h http.HandlerFunc) http.HandlerFunc { return s.require(store.RoleMember, h) }
	admin := func(h http.HandlerFunc) http.HandlerFunc { return s.require(store.RoleAdmin, h) }
	owner := func(h http.HandlerFunc) http.HandlerFunc { return s.require(store.RoleOwner, h) }

	mux.HandleFunc("POST /v1/api/auth/login", s.login)
	mux.HandleFunc("POST /v1/api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		clearSession(w, r)
		writeJSON(w, map[string]bool{"ok": true})
	})
	mux.HandleFunc("GET /v1/api/me", member(func(w http.ResponseWriter, r *http.Request) { writeJSON(w, currentUser(r)) }))
	mux.HandleFunc("POST /v1/api/me/password", member(s.changePassword))
	mux.HandleFunc("GET /v1/api/config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]string{"gatewayUrl": s.GatewayURL(r), "version": s.cfg.Version,
			"sdkVersion": s.sdkVersion, "sdkIntegrity": s.sdkIntegrity})
	})

	mux.HandleFunc("GET /v1/api/members", admin(s.listMembers))
	mux.HandleFunc("POST /v1/api/members", owner(s.inviteMember))
	mux.HandleFunc("PATCH /v1/api/members/{id}", owner(s.updateMember))
	mux.HandleFunc("DELETE /v1/api/members/{id}", owner(s.deleteMember))
	mux.HandleFunc("GET /v1/api/invites/{token}", s.getMemberInvite)
	mux.HandleFunc("POST /v1/api/invites/{token}/accept", s.acceptMemberInvite)

	mux.HandleFunc("GET /v1/api/projects", member(s.listProjects))
	mux.HandleFunc("POST /v1/api/projects", admin(s.createProject))
	mux.HandleFunc("GET /v1/api/projects/{id}", member(s.getProject))
	mux.HandleFunc("PATCH /v1/api/projects/{id}", admin(s.updateProject))
	mux.HandleFunc("DELETE /v1/api/projects/{id}", admin(s.deleteProject))
	mux.HandleFunc("POST /v1/api/projects/{id}/rotate-app-key", admin(s.rotateAppKey))
	mux.HandleFunc("GET /v1/api/projects/{id}/integration", member(s.integration))
	mux.HandleFunc("GET /v1/api/keys", member(s.listKeys))
	mux.HandleFunc("POST /v1/api/keys", admin(s.createKey))
	// Keys used to belong to a project; the old routes stay for older consoles.
	mux.HandleFunc("GET /v1/api/projects/{id}/keys", member(s.listKeys))
	mux.HandleFunc("POST /v1/api/projects/{id}/keys", admin(s.createKey))
	mux.HandleFunc("DELETE /v1/api/keys/{id}", admin(s.revokeKey))
	mux.HandleFunc("GET /v1/api/projects/{id}/devices", member(s.listDevices))
	mux.HandleFunc("GET /v1/api/devices", member(s.listAllDevices))
	mux.HandleFunc("GET /v1/api/status", member(s.gatewayStatus))
	mux.HandleFunc("GET /v1/api/projects/{id}/invites", member(s.listDeviceInvites))
	mux.HandleFunc("POST /v1/api/projects/{id}/invites", member(s.createDeviceInvite))
	mux.HandleFunc("DELETE /v1/api/device-invites/{id}", member(s.deleteDeviceInvite))
	mux.HandleFunc("GET /v1/api/devices/{id}", member(s.deviceDetail))
	mux.HandleFunc("POST /v1/api/devices/{id}/test", member(s.testDevice))
	mux.HandleFunc("POST /v1/api/devices/{id}/end", member(s.endDevice))
	mux.HandleFunc("GET /v1/api/audit", member(s.listAudit))
	mux.HandleFunc("GET /v1/api/stream", member(s.stream))
}

func decode(r *http.Request, v any) error {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}

// --- auth & members ---

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimit.allow(s.clientIP(r)) {
		s.fail(w, r, http.StatusTooManyRequests, "rate_limited", i18n.APIRateLimited)
		return
	}
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if decode(r, &req) != nil {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIInvalidBody)
		return
	}
	if strings.TrimSpace(req.Email) == "" {
		req.Email = "admin" // phase 1 consoles only sent a password
	}
	u, err := s.store.UserByEmail(r.Context(), req.Email)
	if err != nil || u.Disabled || u.PasswordHash == "" || !checkPassword(u.PasswordHash, req.Password) {
		s.recordEvent(store.AuditEvent{ActorType: "member", ActorID: req.Email, ActorName: req.Email, Action: "auth.login_failed",
			Target: req.Email, Result: "denied", Detail: map[string]any{"ip": s.clientIP(r)}})
		s.fail(w, r, http.StatusUnauthorized, "bad_password", i18n.APIBadPassword)
		return
	}
	s.store.TouchLogin(r.Context(), u.ID)
	s.setSession(w, r, u.ID)
	s.recordEvent(store.AuditEvent{ActorType: "member", ActorID: u.ID, ActorName: u.Email, Action: "auth.login",
		Target: u.Email, Result: "ok", Detail: map[string]any{"ip": s.clientIP(r)}})
	writeJSON(w, map[string]bool{"ok": true})
}

func validPassword(pw string) bool { return len(pw) >= 8 && len(pw) <= 256 }

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	u := currentUser(r)
	if decode(r, &req) != nil || !validPassword(req.NewPassword) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APINewPasswordShort)
		return
	}
	if !checkPassword(u.PasswordHash, req.OldPassword) {
		s.fail(w, r, http.StatusBadRequest, "bad_password", i18n.APIOldPasswordWrong)
		return
	}
	if err := s.store.SetPassword(r.Context(), u.ID, hashPassword(req.NewPassword)); err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}

func (s *Server) listMembers(w http.ResponseWriter, r *http.Request) {
	users, err := s.store.Users(r.Context())
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"members": users})
}

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

func validRole(r string) bool {
	return r == store.RoleOwner || r == store.RoleAdmin || r == store.RoleMember
}

func (s *Server) inviteMember(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Name  string `json:"name"`
		Role  string `json:"role"`
	}
	if decode(r, &req) != nil || !emailRe.MatchString(strings.TrimSpace(req.Email)) || !validRole(req.Role) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIBadMember)
		return
	}
	token := ids.Secret(24)
	exp := time.Now().Add(7 * 24 * time.Hour).UnixMilli()
	u, err := s.store.CreateUser(r.Context(), req.Email, req.Name, req.Role, "", ids.HashKey(s.pepper, token), &exp)
	if errors.Is(err, store.ErrConflict) {
		s.fail(w, r, http.StatusConflict, "conflict", i18n.APIMemberExists)
		return
	}
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, "", "member.invite", u.Email, "ok", map[string]any{"role": u.Role})
	writeJSON(w, struct {
		*store.User
		InviteURL string `json:"inviteUrl"`
	}{u, s.origin(r) + "/invite/" + token})
}

// origin is the scheme://host of the console (the gateway URL without /v1).
func (s *Server) origin(r *http.Request) string {
	return strings.TrimSuffix(s.GatewayURL(r), "/v1")
}

func (s *Server) ownerCount(ctx context.Context) int {
	users, _ := s.store.Users(ctx)
	n := 0
	for _, u := range users {
		if u.Role == store.RoleOwner && !u.Disabled {
			n++
		}
	}
	return n
}

func (s *Server) updateMember(w http.ResponseWriter, r *http.Request) {
	var p store.UserPatch
	if decode(r, &p) != nil || (p.Role != nil && !validRole(*p.Role)) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIInvalidBody)
		return
	}
	target, err := s.store.User(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	demotes := target.Role == store.RoleOwner && ((p.Role != nil && *p.Role != store.RoleOwner) || (p.Disabled != nil && *p.Disabled))
	if demotes && s.ownerCount(r.Context()) <= 1 {
		s.fail(w, r, http.StatusConflict, "last_owner", i18n.APILastOwner)
		return
	}
	u, err := s.store.UpdateUser(r.Context(), target.ID, p)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, "", "member.update", u.Email, "ok", map[string]any{"role": u.Role, "disabled": u.Disabled})
	writeJSON(w, u)
}

func (s *Server) deleteMember(w http.ResponseWriter, r *http.Request) {
	target, err := s.store.User(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	if target.ID == currentUser(r).ID {
		s.fail(w, r, http.StatusConflict, "self", i18n.APIDeleteSelf)
		return
	}
	if target.Role == store.RoleOwner && s.ownerCount(r.Context()) <= 1 {
		s.fail(w, r, http.StatusConflict, "last_owner", i18n.APILastOwner)
		return
	}
	if err := s.store.DeleteUser(r.Context(), target.ID); err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, "", "member.delete", target.Email, "ok", nil)
	writeJSON(w, map[string]bool{"ok": true})
}

func (s *Server) getMemberInvite(w http.ResponseWriter, r *http.Request) {
	u, err := s.store.UserByInvite(r.Context(), ids.HashKey(s.pepper, r.PathValue("token")))
	if err != nil {
		s.fail(w, r, http.StatusNotFound, "not_found", i18n.APIInviteInvalid)
		return
	}
	writeJSON(w, map[string]string{"email": u.Email, "name": u.Name})
}

func (s *Server) acceptMemberInvite(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimit.allow(s.clientIP(r)) {
		s.fail(w, r, http.StatusTooManyRequests, "rate_limited", i18n.APIRateLimited)
		return
	}
	var req struct {
		Password string  `json:"password"`
		Name     *string `json:"name"`
	}
	if decode(r, &req) != nil || !validPassword(req.Password) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIPasswordShort)
		return
	}
	u, err := s.store.UserByInvite(r.Context(), ids.HashKey(s.pepper, r.PathValue("token")))
	if err != nil {
		s.fail(w, r, http.StatusNotFound, "not_found", i18n.APIInviteInvalid)
		return
	}
	if req.Name != nil {
		if _, err := s.store.UpdateUser(r.Context(), u.ID, store.UserPatch{Name: req.Name}); err != nil {
			s.storeErr(w, r, err)
			return
		}
	}
	if err := s.store.SetPassword(r.Context(), u.ID, hashPassword(req.Password)); err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.store.TouchLogin(r.Context(), u.ID)
	s.setSession(w, r, u.ID)
	s.recordEvent(store.AuditEvent{ActorType: "member", ActorID: u.ID, ActorName: u.Email, Action: "member.accept", Target: u.Email, Result: "ok"})
	writeJSON(w, map[string]bool{"ok": true})
}

// --- projects ---

type projectView struct {
	*store.Project
	OnlineDevices int `json:"onlineDevices"`
	TotalDevices  int `json:"totalDevices"`
}

func (s *Server) projectView(ctx context.Context, p *store.Project) projectView {
	total, _, _ := s.store.DeviceStats(ctx, p.ID)
	return projectView{Project: p, OnlineDevices: s.hub.OnlineCount(p.ID), TotalDevices: total}
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	ps, err := s.store.Projects(r.Context())
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	out := []projectView{}
	for _, p := range ps {
		out = append(out, s.projectView(r.Context(), p))
	}
	writeJSON(w, map[string]any{"projects": out})
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name           string   `json:"name"`
		AllowedOrigins []string `json:"allowedOrigins"`
	}
	if decode(r, &req) != nil || strings.TrimSpace(req.Name) == "" {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIProjectName)
		return
	}
	p, err := s.store.CreateProject(r.Context(), strings.TrimSpace(req.Name), req.AllowedOrigins)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, p.ID, "project.create", p.Name, "ok", nil)
	writeJSON(w, s.projectView(r.Context(), p))
}

func (s *Server) getProject(w http.ResponseWriter, r *http.Request) {
	p, err := s.store.Project(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, s.projectView(r.Context(), p))
}

func validatePolicy(l i18n.Lang, raw json.RawMessage) error {
	var p struct {
		MaskPatterns []store.MaskPattern `json:"maskPatterns"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return err
	}
	for _, m := range p.MaskPatterns {
		// Patterns run in the page (JavaScript); Go's RE2 is a reasonable
		// sanity check for the common subset.
		if _, err := regexp.Compile(m.Regex); err != nil {
			return errors.New(l.T(i18n.APIBadMaskRegex, m.Name))
		}
	}
	return nil
}

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request) {
	var patch store.ProjectPatch
	if decode(r, &patch) != nil {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIInvalidBody)
		return
	}
	if patch.Policy != nil {
		if err := validatePolicy(s.lang(r), *patch.Policy); err != nil {
			writeErr(w, http.StatusBadRequest, "bad_policy", err.Error())
			return
		}
	}
	if patch.InviteURL != nil && *patch.InviteURL != "" {
		if u, err := url.Parse(*patch.InviteURL); err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
			s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIInviteURLScheme)
			return
		}
	}
	p, err := s.store.UpdateProject(r.Context(), r.PathValue("id"), patch)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, p.ID, "project.update", p.Name, "ok", map[string]any{"policy": patch.Policy != nil})
	writeJSON(w, s.projectView(r.Context(), p))
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.DeleteProject(r.Context(), id); err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, id, "project.delete", id, "ok", nil)
	writeJSON(w, map[string]bool{"ok": true})
}

func (s *Server) rotateAppKey(w http.ResponseWriter, r *http.Request) {
	p, err := s.store.RotateAppKey(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, p.ID, "project.rotate_app_key", p.Name, "ok", nil)
	writeJSON(w, s.projectView(r.Context(), p))
}

func (s *Server) integration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.Project(ctx, r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	_, first, err := s.store.DeviceStats(ctx, p.ID)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	devices, err := s.hub.Devices(ctx, p.ID, "all")
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	var last any
	if len(devices) > 0 {
		last = devices[0].In(s.lang(r))
	}
	gw := s.GatewayURL(r)
	writeJSON(w, map[string]any{
		"appKey": p.AppKey, "gatewayUrl": gw, "sdkUrl": gw + "/sdk.js",
		"firstSeenAt": first, "onlineDevices": s.hub.OnlineCount(p.ID), "lastDevice": last,
	})
}

// --- API keys ---

func (s *Server) listKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := s.store.APIKeys(r.Context())
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"keys": keys})
}

func (s *Server) createKey(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name          string      `json:"name"`
		MaxLevel      store.Level `json:"maxLevel"`
		ExpiresInDays *int        `json:"expiresInDays"`
		IPAllowlist   []string    `json:"ipAllowlist"`
	}
	if decode(r, &req) != nil || strings.TrimSpace(req.Name) == "" {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIKeyName)
		return
	}
	if req.MaxLevel == "" {
		req.MaxLevel = store.LevelInteract
	}
	if !req.MaxLevel.Valid() {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIBadMaxLevel)
		return
	}
	ips := []string{}
	for _, c := range req.IPAllowlist {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		_, _, cidrErr := net.ParseCIDR(c)
		if cidrErr != nil && net.ParseIP(c) == nil {
			s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIBadIP, c)
			return
		}
		ips = append(ips, c)
	}
	days := 90
	if req.ExpiresInDays != nil {
		days = *req.ExpiresInDays
	}
	var expires *int64
	if days > 0 {
		t := time.Now().AddDate(0, 0, days).UnixMilli()
		expires = &t
	}
	k, plain, err := s.store.CreateAPIKey(r.Context(), s.pepper, store.NewKey{Name: strings.TrimSpace(req.Name),
		MaxLevel: req.MaxLevel, ExpiresAt: expires, IPAllowlist: ips})
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, "", "key.create", k.Prefix, "ok", map[string]any{"name": k.Name, "maxLevel": k.MaxLevel, "expiresInDays": days})
	writeJSON(w, struct {
		*store.APIKey
		Key string `json:"key"`
	}{k, plain})
}

func (s *Server) revokeKey(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	k, err := s.store.APIKey(r.Context(), id)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	if err := s.store.RevokeAPIKey(r.Context(), id); err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.hub.DropAgent(id)
	s.auditMember(r, "", "key.revoke", k.Prefix, "ok", map[string]any{"name": k.Name})
	writeJSON(w, map[string]bool{"ok": true})
}

// --- devices ---

func (s *Server) listDevices(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "all"
	}
	devices, err := s.hub.Devices(r.Context(), r.PathValue("id"), status)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"devices": localizeDevices(s.lang(r), devices)})
}

// listAllDevices is the device-first view: every project's devices, online
// ones by default, newest connection first, searchable and paged.
func (s *Server) listAllDevices(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	num := func(k string) int { n, _ := strconv.Atoi(q.Get(k)); return n }
	names, err := s.projectNames(r.Context())
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	status := q.Get("status")
	if status != "all" {
		status = "online"
	}
	query := hub.DeviceListQuery{Status: status, ProjectID: q.Get("project"), Q: q.Get("q"), Page: num("page"),
		PageSize: num("pageSize"), Names: names}
	devices, total, err := s.hub.DeviceList(r.Context(), query)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	page, size := max(1, query.Page), query.PageSize
	if size <= 0 || size > 100 {
		size = 20
	}
	writeJSON(w, map[string]any{"devices": localizeDevices(s.lang(r), devices), "total": total, "page": page, "pageSize": size})
}

// localizeDevices puts device views into the console's language.
func localizeDevices(l i18n.Lang, devices []hub.DeviceView) []hub.DeviceView {
	for i := range devices {
		devices[i] = devices[i].In(l)
	}
	return devices
}

func (s *Server) projectNames(ctx context.Context) (map[string]string, error) {
	ps, err := s.store.Projects(ctx)
	if err != nil {
		return nil, err
	}
	names := make(map[string]string, len(ps))
	for _, p := range ps {
		names[p.ID] = p.Name
	}
	return names, nil
}

// gatewayStatus backs the console's connection indicator.
func (s *Server) gatewayStatus(w http.ResponseWriter, r *http.Request) {
	m := s.hub.Metrics()
	online := 0
	for _, n := range m.OnlineDevices {
		online += n
	}
	total, err := s.store.CountDevices(r.Context())
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	names, err := s.projectNames(r.Context())
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, map[string]any{
		"ok": true, "version": s.cfg.Version, "db": s.store.Dialect(), "gatewayUrl": s.GatewayURL(r),
		"sdkVersion": s.sdkVersion, "startedAt": s.started.UnixMilli(), "uptimeSec": int64(time.Since(s.started).Seconds()),
		"onlineDevices": online, "totalDevices": total, "connectedPages": m.ConnectedPages,
		"attachedAgents": m.AttachedAgents, "helpDevices": m.HelpDevices, "pendingApprovals": m.PendingApprovals, "wsConnections": m.WSConnections, "projects": len(names),
		"serverTime": time.Now().UnixMilli(),
	})
}

func (s *Server) deviceDetail(w http.ResponseWriter, r *http.Request) {
	d, err := s.hub.Device(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, d.In(s.lang(r)))
}

func (s *Server) testDevice(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Device(r.Context(), r.PathValue("id")); err != nil {
		s.storeErr(w, r, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	res, err := s.hub.TestDevice(ctx, r.PathValue("id"), s.lang(r))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	writeJSON(w, res)
}

func (s *Server) endDevice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	d, err := s.store.Device(r.Context(), id)
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.hub.EndDevice(id)
	s.auditMember(r, d.ProjectID, "device.end", d.Code, "ok", nil)
	writeJSON(w, map[string]bool{"ok": true})
}

// --- device invites ---

func (s *Server) inviteLink(base, token string) string {
	u, err := url.Parse(base)
	if err != nil {
		return base
	}
	q := u.Query()
	q.Set("rwd_invite", token)
	u.RawQuery = q.Encode()
	return u.String()
}

func (s *Server) listDeviceInvites(w http.ResponseWriter, r *http.Request) {
	invites, err := s.store.DeviceInvites(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	for _, v := range invites {
		// The token is not stored; show the target page without it.
		v.Link = v.URL
	}
	writeJSON(w, map[string]any{"invites": invites})
}

func (s *Server) createDeviceInvite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Note             string `json:"note"`
		URL              string `json:"url"`
		ExpiresInMinutes int    `json:"expiresInMinutes"`
	}
	if decode(r, &req) != nil {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIInvalidBody)
		return
	}
	p, err := s.store.Project(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	target := strings.TrimSpace(req.URL)
	if target == "" {
		target = p.InviteURL
	}
	if u, err := url.Parse(target); target == "" || err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		s.fail(w, r, http.StatusBadRequest, "bad_request", i18n.APIInviteURLMissing)
		return
	}
	mins := req.ExpiresInMinutes
	if mins <= 0 {
		mins = 30
	}
	mins = min(mins, 7*24*60)
	v, token, err := s.store.CreateDeviceInvite(r.Context(), s.pepper, p.ID, strings.TrimSpace(req.Note), target,
		currentUser(r).Email, time.Now().Add(time.Duration(mins)*time.Minute).UnixMilli())
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	v.Link = s.inviteLink(target, token)
	s.auditMember(r, p.ID, "invite.create", v.Note, "ok", map[string]any{"invite": v.ID})
	writeJSON(w, v)
}

func (s *Server) deleteDeviceInvite(w http.ResponseWriter, r *http.Request) {
	v, err := s.store.DeviceInvite(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, r, err)
		return
	}
	if err := s.store.DeleteDeviceInvite(r.Context(), v.ID); err != nil {
		s.storeErr(w, r, err)
		return
	}
	s.auditMember(r, v.ProjectID, "invite.delete", v.Note, "ok", map[string]any{"invite": v.ID})
	writeJSON(w, map[string]bool{"ok": true})
}
