package hub

import (
	"testing"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
)

func TestParseUA(t *testing.T) {
	cases := []struct{ ua, platform, want string }{
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RWDMockApp/1.0", "ios", "iOS 18.0 · iPhone · WebView"},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1", "", "iOS 17.4.1 · iPhone · Safari 17.4"},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800323c) NetType/WIFI Language/zh_CN", "", "iOS 18.1 · iPhone · 微信 8.0.50"},
		{"Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.39 Mobile Safari/537.36", "", "Android 14 · SM-S918B · WebView"},
		{"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", "", "Android 10 · Chrome 131"},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "", "macOS · Chrome 131"},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0", "", "Windows · Edge 131"},
		{"", "android", "Android"},
		{"Mozilla/5.0 (Phone; OpenHarmony 4.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile", "", "HarmonyOS 4.1 · ArkWeb"},
	}
	for _, c := range cases {
		if got := ParseUA(c.ua, c.platform, i18n.ZH).Label; got != c.want {
			t.Errorf("ParseUA(%q) = %q, want %q", c.ua, got, c.want)
		}
	}
	wechat := cases[2].ua
	if got := ParseUA(wechat, "", i18n.EN).Label; got != "iOS 18.1 · iPhone · WeChat 8.0.50" {
		t.Errorf("ParseUA(en) = %q", got)
	}
}
