package hub

import (
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/store"
)

// methodLevel is the minimum level each page RPC needs (docs/protocol.md §6).
// The page enforces the same table.
var methodLevel = map[string]store.Level{
	"rwd.ping": store.LevelObserve, "rwd.snapshot": store.LevelObserve, "rwd.screenshot": store.LevelObserve,
	"rwd.console": store.LevelObserve, "rwd.network": store.LevelObserve, "rwd.waitFor": store.LevelObserve,
	"rwd.query": store.LevelObserve, "rwd.log": store.LevelObserve,
	"rwd.click": store.LevelInteract, "rwd.fill": store.LevelInteract, "rwd.type": store.LevelInteract,
	"rwd.press": store.LevelInteract, "rwd.select": store.LevelInteract, "rwd.hover": store.LevelInteract,
	"rwd.scroll": store.LevelInteract, "rwd.drag": store.LevelInteract, "rwd.navigate": store.LevelInteract,
	"rwd.back": store.LevelInteract, "rwd.reload": store.LevelInteract,
	"rwd.evaluate": store.LevelAdvanced, "rwd.networkDetail": store.LevelAdvanced, "rwd.storage": store.LevelAdvanced,
	"rwd.logDetail": store.LevelAdvanced,
}

// MethodLevel returns the level a method needs (unknown methods: advanced).
func MethodLevel(method string) store.Level {
	if l, ok := methodLevel[method]; ok {
		return l
	}
	return store.LevelAdvanced
}

// CheckLevel refuses methods above the level granted to this attachment.
func (h *Hub) CheckLevel(s *Session, method string) error {
	h.mu.Lock()
	granted := s.Device.Level
	d := s.Device
	h.mu.Unlock()
	need := MethodLevel(method)
	if granted.Rank() >= need.Rank() {
		return nil
	}
	h.recordAgent(s.Agent, d.Info.ProjectID, "policy.denied", d.Info.Code, "denied",
		map[string]any{"method": method, "need": need, "granted": granted})
	return rpcError("forbidden", i18n.ErrNeedLevel, need, granted)
}
