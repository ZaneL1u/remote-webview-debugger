package hub

import (
	"regexp"
	"strings"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/i18n"
)

// SystemInfo is what the console shows about a device, derived from its
// user agent: operating system, version, model and the browser / WebView.
type SystemInfo struct {
	OS        string `json:"os"`        // iOS | iPadOS | Android | HarmonyOS | macOS | Windows | Linux | ""
	OSVersion string `json:"osVersion"` // "18.0"
	Model     string `json:"model"`     // iPhone | iPad | SM-S918B | ""
	Browser   string `json:"browser"`   // WebView | Safari 18.0 | Chrome 131 | WeChat 8.0.50 | …
	Label     string `json:"label"`     // "iOS 18.0 · iPhone · WebView"
}

var (
	reIOS      = regexp.MustCompile(`(?:iPhone|CPU) OS (\d+(?:_\d+)*)`)
	reAndroid  = regexp.MustCompile(`Android (\d+(?:\.\d+)*)(?:; ([^;)]+))?`)
	reHarmony  = regexp.MustCompile(`(?:OpenHarmony|HarmonyOS)[ /]?(\d+(?:\.\d+)*)?`)
	reMac      = regexp.MustCompile(`Mac OS X (\d+(?:[_.]\d+)*)`)
	reWindows  = regexp.MustCompile(`Windows NT (\d+\.\d+)`)
	reVersion  = regexp.MustCompile(`Version/(\d+(?:\.\d+)?)`)
	reProducts = []struct {
		re   *regexp.Regexp
		name string
		key  i18n.Key // localized name of a super app
	}{
		{regexp.MustCompile(`MicroMessenger/(\d+(?:\.\d+)*)`), "", i18n.ProductWeChat},
		{regexp.MustCompile(`(?:Lark|Feishu)/(\d+(?:\.\d+)*)`), "", i18n.ProductLark},
		{regexp.MustCompile(`DingTalk/(\d+(?:\.\d+)*)`), "", i18n.ProductDingTalk},
		{regexp.MustCompile(`AlipayClient/(\d+(?:\.\d+)*)`), "", i18n.ProductAlipay},
		{regexp.MustCompile(`EdgA?/(\d+)`), "Edge", ""},
		{regexp.MustCompile(`(?:CriOS|Chrome)/(\d+)`), "Chrome", ""},
		{regexp.MustCompile(`(?:FxiOS|Firefox)/(\d+)`), "Firefox", ""},
	}
)

// ParseUA is a small, best-effort user agent parser for the device list.
// Super app names are in l.
func ParseUA(ua, platform string, l i18n.Lang) SystemInfo {
	var s SystemInfo
	switch {
	case strings.Contains(ua, "OpenHarmony") || strings.Contains(ua, "HarmonyOS"):
		s.OS = "HarmonyOS"
		if m := reHarmony.FindStringSubmatch(ua); m != nil {
			s.OSVersion = m[1]
		}
	case strings.Contains(ua, "iPhone") || strings.Contains(ua, "iPad") || strings.Contains(ua, "iPod"):
		s.OS, s.Model = "iOS", "iPhone"
		if strings.Contains(ua, "iPad") {
			s.OS, s.Model = "iPadOS", "iPad"
		}
		if m := reIOS.FindStringSubmatch(ua); m != nil {
			s.OSVersion = strings.ReplaceAll(m[1], "_", ".")
		}
	case strings.Contains(ua, "Android"):
		s.OS = "Android"
		if m := reAndroid.FindStringSubmatch(ua); m != nil {
			s.OSVersion = m[1]
			model := strings.TrimSpace(m[2])
			if i := strings.Index(model, " Build/"); i >= 0 {
				model = model[:i]
			}
			if model != "K" && model != "wv" { // "K": reduced UA
				s.Model = model
			}
		}
	case strings.Contains(ua, "Macintosh") || strings.Contains(ua, "Mac OS X"):
		s.OS = "macOS"
		if m := reMac.FindStringSubmatch(ua); m != nil && !strings.HasPrefix(m[1], "10_15_7") {
			s.OSVersion = strings.NewReplacer("_", ".").Replace(m[1])
		}
	case strings.Contains(ua, "Windows"):
		s.OS = "Windows"
		if m := reWindows.FindStringSubmatch(ua); m != nil && m[1] != "10.0" {
			s.OSVersion = m[1]
		}
	case strings.Contains(ua, "Linux"):
		s.OS = "Linux"
	}
	if s.OS == "" {
		switch strings.ToLower(platform) {
		case "ios":
			s.OS = "iOS"
		case "android":
			s.OS = "Android"
		}
	}

	for _, p := range reProducts {
		if strings.Contains(ua, "ArkWeb/") && p.name == "Chrome" {
			break
		}
		if m := p.re.FindStringSubmatch(ua); m != nil {
			name := p.name
			if p.key != "" {
				name = l.T(p.key)
			}
			s.Browser = name + " " + m[1]
			break
		}
	}
	mobileApple := s.OS == "iOS" || s.OS == "iPadOS"
	switch {
	case s.Browser != "" && !strings.HasPrefix(s.Browser, "Chrome") && !strings.HasPrefix(s.Browser, "Edge") && !strings.HasPrefix(s.Browser, "Firefox"):
		// in-app browser of a super app
	case strings.Contains(ua, "ArkWeb/"):
		s.Browser = "ArkWeb" // HarmonyOS WebView; its UA also claims Chrome
	case s.OS == "Android" && strings.Contains(ua, "; wv)"):
		s.Browser = "WebView"
	case s.Browser != "":
	case strings.Contains(ua, "Safari/") && strings.Contains(ua, "Version/"):
		s.Browser = "Safari"
		if m := reVersion.FindStringSubmatch(ua); m != nil {
			s.Browser += " " + m[1]
		}
	case mobileApple || strings.Contains(ua, "AppleWebKit"):
		s.Browser = "WebView" // WKWebView: no Safari/ token
	}

	parts := []string{}
	if s.OS != "" {
		parts = append(parts, strings.TrimSpace(s.OS+" "+s.OSVersion))
	}
	if s.Model != "" {
		parts = append(parts, s.Model)
	}
	if s.Browser != "" {
		parts = append(parts, s.Browser)
	}
	s.Label = strings.Join(parts, " · ")
	return s
}
