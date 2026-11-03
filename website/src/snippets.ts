// Code shown on the page. Formats follow console/src/lib/snippets.ts (what
// the product's own console hands out), shortened for the website.

type L = 'en' | 'zh'

const GW = 'https://rwd.example.com/v1'

export function h5Snippet(lang: L) {
  const c =
    lang === 'zh'
      ? ['<!-- 放在 <head> 里，越早越好 -->', '// 可选：按用户查找设备', '// 显示「求助」按钮']
      : ['<!-- In <head>, before your own scripts -->', '// optional: find devices by user', '// show the “Ask for help” button']
  return `${c[0]}
<script src="${GW}/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("${GW}", "rwd_pk_…", {
    userId: currentUser?.id ?? null, ${c[1]}
    helpButton: true,                ${c[2]}
  })
</script>`
}

export function claudeCodeSnippet() {
  return `claude mcp add --transport http rwd ${GW}/mcp \\
  --header "Authorization: Bearer rwd_sk_live_…"`
}

export function cursorSnippet() {
  return JSON.stringify(
    { mcpServers: { rwd: { url: `${GW}/mcp`, headers: { Authorization: 'Bearer rwd_sk_live_…' } } } },
    null,
    2,
  )
}

// The public demo gateway (deploy/demo); main.ts fills in today's key.
export const DEMO = 'https://demo.debugger.site'

export function liveClaudeSnippet() {
  return `claude mcp add --transport http rwd-demo ${DEMO}/v1/mcp \\
  --header "Authorization: Bearer rwd_sk_live_…"`
}

export function liveCursorSnippet() {
  return JSON.stringify(
    { mcpServers: { 'rwd-demo': { url: `${DEMO}/v1/mcp`, headers: { Authorization: 'Bearer rwd_sk_live_…' } } } },
    null,
    2,
  )
}

export function stdioSnippet(lang: L) {
  const c = lang === 'zh' ? '# 只支持 stdio 的客户端：本地桥接到同一个托管地址' : '# stdio-only clients: a local bridge to the same hosted endpoint'
  return `${c}
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… \\
  -- rwd mcp --gateway ${GW}`
}

export function iosSnippet(lang: L) {
  const c =
    lang === 'zh'
      ? ['/// 在 webView.load(…) 之前调用：下载一次 SDK，在 documentStart 注入。', '// 存在 UserDefaults 里的 UUID']
      : ['/// Call before webView.load(…): fetch the SDK once, inject it at document start.', '// a UUID kept in UserDefaults']
  return `import WebKit

${c[0]}
func installRemoteDebugger(into controller: WKUserContentController,
                           userId: String?, done: @escaping () -> Void) {
    let gateway = "${GW}"
    URLSession.shared.dataTask(with: URL(string: gateway + "/sdk.js")!) { data, _, _ in
        DispatchQueue.main.async {
            defer { done() }
            guard let data, let sdk = String(data: data, encoding: .utf8) else { return }
            let options: [String: Any] = [
                "deviceId": stableDeviceId, ${c[1]}
                "userId": userId ?? NSNull(),
                "helpButton": true,
            ]
            let json = String(data: try! JSONSerialization.data(withJSONObject: options), encoding: .utf8)!
            let boot = sdk + "\\n;RemoteWebviewDebugger.run(\\"\\(gateway)\\", \\"rwd_pk_…\\", \\(json));"
            controller.addUserScript(WKUserScript(source: boot,
                                                  injectionTime: .atDocumentStart,
                                                  forMainFrameOnly: true))
        }
    }.resume()
}`
}

export function androidSnippet(lang: L) {
  const c =
    lang === 'zh'
      ? ['// 依赖：androidx.webkit:webkit:1.12.0；需开启 javaScriptEnabled 和 domStorageEnabled', '// 存在 SharedPreferences 里的 UUID', '// 在 webView.loadUrl(…) 之前调用']
      : ['// needs androidx.webkit:webkit:1.12.0, javaScriptEnabled and domStorageEnabled', '// a UUID kept in SharedPreferences', '// call before webView.loadUrl(…)']
  return `${c[0]}
${c[2]}
fun installRemoteDebugger(webView: WebView, userId: String?, onReady: () -> Unit) = thread {
    val gateway = "${GW}"
    val sdk = runCatching { URL("$gateway/sdk.js").readText() }.getOrNull()
    webView.post {
        if (sdk != null && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            val options = JSONObject()
                .put("deviceId", stableDeviceId) ${c[1]}
                .put("userId", userId ?: JSONObject.NULL)
                .put("helpButton", true)
            val boot = "$sdk\\n;RemoteWebviewDebugger.run(\${JSONObject.quote(gateway)}, \\"rwd_pk_…\\", $options);"
            WebViewCompat.addDocumentStartJavaScript(webView, boot, setOf("https://m.example.com"))
        }
        onReady()
    }
}`
}

export function selfHostSnippet(t: { deployComment: string; runComment: string; resultComment: string }) {
  return `git clone https://github.com/ZaneL1u/remote-webview-debugger
cd remote-webview-debugger

${t.deployComment}
RWD_DOMAIN=rwd.example.com \\
  deploy/platform/deploy.sh you@your-server amd64
${t.resultComment}

${t.runComment}
make -j16
RWD_ADMIN_PASSWORD=change-me \\
  gateway/bin/rwd-darwin-arm64 serve --addr :8080`
}

export function maskedSnapshot(lang: L) {
  return lang === 'zh'
    ? `- textbox "收货人" [ref=e9]: 王小明
- textbox "手机号" [ref=e11]: ••••
- combobox "配送方式" [ref=e15]: 快递（免运费）
- textbox "支付密码" [ref=e21]: ••••
- paragraph: 会员卡号：••••
- button "提交订单" [ref=e23]  # data-rwd-confirm`
    : `- textbox "Recipient" [ref=e9]: Alex Chen
- textbox "Phone" [ref=e11]: ••••
- combobox "Delivery" [ref=e15]: Standard (free)
- textbox "Payment PIN" [ref=e21]: ••••
- paragraph: Member card ••••
- button "Place order" [ref=e23]  # data-rwd-confirm`
}

export const TOOLS = [
  'list_devices',
  'connect_device',
  'wait_for_device',
  'list_pages',
  'select_page',
  'wait_for_page',
  'take_snapshot',
  'find_elements',
  'take_screenshot',
  'click',
  'fill',
  'type_text',
  'press_key',
  'select_option',
  'hover',
  'scroll',
  'drag',
  'batch_actions',
  'navigate_page',
  'go_back',
  'reload_page',
  'wait_for',
  'list_console_messages',
  'list_network_requests',
  'get_network_request',
  'get_storage',
  'evaluate_script',
  'set_task',
  'get_session_timeline',
  'wait_for_event',
  'wait_for_control',
  'disconnect_device',
]
