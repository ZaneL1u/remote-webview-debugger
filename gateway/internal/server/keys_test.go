package server

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/cookiejar"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/hub"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// addMember invites a member through the owner's console, accepts the
// invite and returns the member's signed-in console and account id.
func (f *fixture) addMember(owner *console, email, role string) (*console, string) {
	f.t.Helper()
	code, m := owner.do("POST", "/members", map[string]string{"email": email, "name": strings.Split(email, "@")[0], "role": role})
	if code != 200 {
		f.t.Fatalf("invite %s: %d %v", email, code, m)
	}
	link := m["inviteUrl"].(string)
	jar, _ := cookiejar.New(nil)
	c := &console{t: f.t, base: f.srv.URL + "/v1/api", client: &http.Client{Jar: jar}}
	if code, body := c.do("POST", "/invites/"+link[strings.LastIndex(link, "/")+1:]+"/accept", map[string]string{"password": "memberpass"}); code != 200 {
		f.t.Fatalf("accept %s: %d %v", email, code, body)
	}
	return c, m["id"].(string)
}

// createKey creates a key through the console and returns it (with "key").
func createKey(t *testing.T, c *console, name, level string, wantCode int) map[string]any {
	t.Helper()
	code, k := c.do("POST", "/keys", map[string]any{"name": name, "maxLevel": level})
	if code != wantCode {
		t.Fatalf("create %s (%s): %d %v, want %d", name, level, code, k, wantCode)
	}
	return k
}

func keyList(t *testing.T, c *console, query string) map[string]map[string]any {
	t.Helper()
	code, body := c.do("GET", "/keys"+query, nil)
	if code != 200 {
		t.Fatalf("list keys%s: %d %v", query, code, body)
	}
	out := map[string]map[string]any{}
	for _, k := range body["keys"].([]any) {
		k := k.(map[string]any)
		out[k["name"].(string)] = k
	}
	return out
}

// Every member creates keys of their own, members up to interact; members see
// and revoke only their own keys, owners and admins everyone's.
func TestKeysBelongToMembers(t *testing.T) {
	f := setup(t, "")
	owner := f.login("owner@test", "password1")
	admin, adminID := f.addMember(owner, "admin@test.com", "admin")
	member, memberID := f.addMember(owner, "dev@test.com", "member")

	mk := createKey(t, member, "dev-bot", "interact", 200)
	if mk["ownerId"] != memberID || mk["ownerEmail"] != "dev@test.com" || mk["ownerName"] != "dev" || !strings.HasPrefix(mk["key"].(string), "rwd_sk_") {
		t.Fatalf("member's key: %v", mk)
	}
	createKey(t, member, "dev-bot2", "", 200) // default interact
	if code, body := member.do("POST", "/keys", map[string]any{"name": "too-much", "maxLevel": "advanced"}); code != 403 || !strings.Contains(mustJSONTest(body), "interact") {
		t.Fatalf("member advanced key: %d %v", code, body)
	}
	ak := createKey(t, admin, "admin-bot", "advanced", 200)
	if ak["ownerId"] != adminID {
		t.Fatalf("admin's key: %v", ak)
	}

	// Listing.
	if got := keyList(t, member, ""); len(got) != 2 || got["dev-bot"] == nil || got["dev-bot2"] == nil {
		t.Fatalf("member sees: %v", got)
	}
	if got := keyList(t, member, "?mine=1"); len(got) != 2 {
		t.Fatalf("member mine: %v", got)
	}
	all := keyList(t, owner, "")
	if len(all) != 4 || all["bot"] == nil || all["bot"]["ownerId"] != nil || all["dev-bot"]["ownerEmail"] != "dev@test.com" {
		t.Fatalf("owner sees: %v", all)
	}
	if got := keyList(t, admin, ""); len(got) != 4 {
		t.Fatalf("admin sees: %v", got)
	}
	if got := keyList(t, admin, "?mine=1"); len(got) != 1 || got["admin-bot"] == nil {
		t.Fatalf("admin mine: %v", got)
	}
	if got := keyList(t, owner, "?mine=1"); len(got) != 0 {
		t.Fatalf("owner mine: %v", got)
	}
	if code, body := member.do("GET", "/projects/"+f.project.ID+"/keys", nil); code != 200 || len(body["keys"].([]any)) != 2 {
		t.Fatalf("old list route: %d %v", code, body)
	}

	// Revoking.
	for _, id := range []string{ak["id"].(string), f.keyID} { // an admin's key, a gateway key
		if code, _ := member.do("DELETE", "/keys/"+id, nil); code != 404 {
			t.Fatalf("member revoked someone else's key %s: %d, want 404", id, code)
		}
	}
	if code, _ := member.do("DELETE", "/keys/"+mk["id"].(string), nil); code != 200 {
		t.Fatalf("member revoke own: %d", code)
	}
	if code, _ := admin.do("DELETE", "/keys/"+all["dev-bot2"]["id"].(string), nil); code != 200 {
		t.Fatalf("admin revoke member's key: %d", code)
	}
	if code, _ := admin.do("DELETE", "/keys/"+f.keyID, nil); code != 200 {
		t.Fatalf("admin revoke gateway key: %d", code)
	}
	if code, _ := owner.do("DELETE", "/keys/"+ak["id"].(string), nil); code != 200 {
		t.Fatalf("owner revoke admin's key: %d", code)
	}
	if got := keyList(t, member, ""); got["dev-bot"]["revokedAt"] == nil || got["dev-bot2"]["revokedAt"] == nil {
		t.Fatalf("revoked keys: %v", got)
	}

	// The audit log names the key's owner.
	f.s.flushAudit()
	events, _ := f.st.Audit(context.Background(), store.AuditQuery{Action: "key.", Limit: 50})
	owners := map[string]string{}
	for _, e := range events {
		owner, _ := e.Detail["owner"].(string)
		owners[e.Action+" "+e.Detail["name"].(string)] = owner
	}
	for k, want := range map[string]string{"key.create dev-bot": "dev@test.com", "key.create admin-bot": "admin@test.com",
		"key.revoke dev-bot2": "dev@test.com", "key.revoke admin-bot": "admin@test.com", "key.revoke bot": ""} {
		if got, ok := owners[k]; !ok || got != want {
			t.Errorf("audit %s owner = %q (present %v), want %q", k, got, ok, want)
		}
	}
}

// A member's keys stop working while the member is disabled, and for good
// once the member is deleted; their agents are detached at once.
func TestKeyOwnerDisabledAndDeleted(t *testing.T) {
	f := setup(t, `{"approval":"none"}`)
	owner := f.login("owner@test", "password1")
	member, memberID := f.addMember(owner, "dev@test.com", "member")
	plain := createKey(t, member, "dev-bot", "interact", 200)["key"].(string)

	p := f.page(pageOpts{pageID: "page1"})
	s, err := f.mcpWith(plain)
	if err != nil {
		t.Fatal(err)
	}
	if out, isErr := callText(t, s, "connect_device", map[string]any{"device": p.welcome["deviceCode"]}); isErr {
		t.Fatalf("connect: %s", out)
	}
	expectControl(t, p, hub.ControlObserve)
	if out, isErr := callText(t, s, "take_snapshot", nil); isErr {
		t.Fatalf("snapshot: %s", out)
	}
	// The agent's audit events name the key's owner.
	f.s.flushAudit()
	events, _ := f.st.Audit(context.Background(), store.AuditQuery{ProjectID: f.project.ID, Limit: 50})
	for _, a := range []string{"attach.start", "rpc"} {
		found := false
		for _, e := range events {
			if e.Action == a && e.Detail["owner"] == "dev@test.com" {
				found = true
			}
		}
		if !found {
			t.Errorf("audit %s without the key's owner: %v", a, events)
		}
	}

	if code, _ := owner.do("PATCH", "/members/"+memberID, map[string]any{"disabled": true}); code != 200 {
		t.Fatalf("disable: %d", code)
	}
	expectControl(t, p, hub.ControlNone)
	if _, err := s.CallTool(context.Background(), &mcp.CallToolParams{Name: "take_snapshot"}); err == nil {
		t.Fatal("a disabled member's key still works")
	}
	if _, err := f.mcpWith(plain); err == nil {
		t.Fatal("a disabled member's key opened a session")
	}
	if all := keyList(t, owner, ""); all["dev-bot"]["ownerDisabled"] != true || all["dev-bot"]["revokedAt"] != nil {
		t.Fatalf("key of a disabled member: %v", all["dev-bot"])
	}

	if code, _ := owner.do("PATCH", "/members/"+memberID, map[string]any{"disabled": false}); code != 200 {
		t.Fatalf("enable: %d", code)
	}
	if _, err := f.mcpWith(plain); err != nil {
		t.Fatalf("key after the member is enabled again: %v", err)
	}

	if code, _ := owner.do("DELETE", "/members/"+memberID, nil); code != 200 {
		t.Fatalf("delete: %d", code)
	}
	if _, err := f.mcpWith(plain); err == nil {
		t.Fatal("a deleted member's key still works")
	}
	if all := keyList(t, owner, ""); all["dev-bot"]["revokedAt"] == nil || all["dev-bot"]["ownerId"] != memberID {
		t.Fatalf("key of a deleted member: %v", all["dev-bot"])
	}
}

// An admin demoted to member keeps their keys, at no more than interact; an
// advanced key's agent is detached.
func TestKeyOwnerDemoted(t *testing.T) {
	f := setup(t, `{"approval":"none","maxLevel":"advanced"}`)
	owner := f.login("owner@test", "password1")
	admin, adminID := f.addMember(owner, "lead@test.com", "admin")
	plain := createKey(t, admin, "lead-bot", "advanced", 200)["key"].(string)

	p := f.page(pageOpts{pageID: "page1"})
	code := p.welcome["deviceCode"].(string)
	s, err := f.mcpWith(plain)
	if err != nil {
		t.Fatal(err)
	}
	if out, isErr := callText(t, s, "connect_device", map[string]any{"device": code, "level": "advanced"}); isErr || !strings.Contains(out, "advanced") {
		t.Fatalf("connect as admin: %s", out)
	}
	expectControl(t, p, hub.ControlObserve)

	if c, _ := owner.do("PATCH", "/members/"+adminID, map[string]any{"role": "member"}); c != 200 {
		t.Fatalf("demote: %d", c)
	}
	expectControl(t, p, hub.ControlNone)
	s2, err := f.mcpWith(plain)
	if err != nil {
		t.Fatalf("a demoted member's key: %v", err)
	}
	out, isErr := callText(t, s2, "connect_device", map[string]any{"device": code, "level": "advanced"})
	if isErr || !strings.Contains(out, "interact") || strings.Contains(out, "advanced") {
		t.Fatalf("connect after demotion: %s", out)
	}
}

// A database from before keys had owners gains owner_id; its keys become
// gateway keys and keep working.
func TestMigrateKeyOwners(t *testing.T) {
	if os.Getenv("RWD_TEST_DATABASE_URL") != "" {
		t.Skip("the old schema is built with SQLite")
	}
	path := filepath.Join(t.TempDir(), "old.db")
	st, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, _, err := st.CreateAPIKey(ctx, "pepper", store.NewKey{Name: "old"}); err != nil {
		t.Fatal(err)
	}
	st.Close()
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{`DROP INDEX api_keys_owner`, `ALTER TABLE api_keys DROP COLUMN owner_id`} {
		if _, err := db.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	db.Close()

	if st, err = store.Open(path); err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	u, err := st.CreateUser(ctx, "dev@test.com", "Dev", store.RoleMember, "x", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.CreateAPIKey(ctx, "pepper", store.NewKey{Name: "new", OwnerID: u.ID}); err != nil {
		t.Fatal(err)
	}
	all, err := st.APIKeys(ctx, "")
	if err != nil || len(all) != 2 {
		t.Fatalf("keys: %v %v", all, err)
	}
	for _, k := range all {
		if k.Name == "old" && (k.OwnerID != nil || !k.OwnerActive()) {
			t.Fatalf("old key: %+v", k)
		}
		if k.Name == "new" && (!k.OwnedBy(u.ID) || k.OwnerEmail != "dev@test.com" || !k.OwnerActive()) {
			t.Fatalf("new key: %+v", k)
		}
	}
	if mine, _ := st.APIKeys(ctx, u.ID); len(mine) != 1 {
		t.Fatalf("the member's keys: %v", mine)
	}
}
