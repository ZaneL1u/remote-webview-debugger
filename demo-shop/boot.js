// Demo bootstrap: bring the page online with the real RWD SDK. The gateway
// is a mock that lives in the website (the parent frame); rwd-shim.js tunnels
// the SDK's WebSocket to it. Outside the website's demo frame this does nothing.
(function () {
  var lang = /\/zh\//.test(location.pathname) ? 'zh' : 'en'
  // The SDK's UI language: the website passes the visitor's language as
  // ?ui=<tag> on the first page; later pages of the shop remember it.
  var ui = new URLSearchParams(location.search).get('ui')
  try {
    if (ui) sessionStorage.setItem('rwd-demo:ui', ui)
    else ui = sessionStorage.getItem('rwd-demo:ui')
  } catch (e) {}

  // Keep the shop's navigations out of the website's session history (an
  // iframe's navigations would otherwise pile up behind the browser's Back
  // button): every move replaces the current entry, and a small per-tab
  // stack stands in for history.back().
  var KEY = 'rwd-demo:stack'
  function stack() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || '[]')
    } catch (e) {
      return []
    }
  }
  function save(s) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s.slice(-20)))
    } catch (e) {}
  }
  function go(url) {
    var s = stack()
    s.push(location.href)
    save(s)
    location.replace(url)
  }
  try {
    history.back = function () {
      var s = stack()
      var prev = s.pop()
      save(s)
      if (prev) location.replace(prev)
    }
  } catch (e) {}
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null
    if (!a || a.target || e.defaultPrevented) return
    var u
    try {
      u = new URL(a.href, location.href)
    } catch (err) {
      return
    }
    if (u.protocol !== location.protocol || u.origin !== location.origin) return
    e.preventDefault()
    go(u.href)
  })
  window.ShopNav = { go: go }

  if (window.parent === window || !window.RemoteWebviewDebugger) return
  RemoteWebviewDebugger.run(location.origin + '/mock-gateway/v1', 'rwd_pk_demo7Hc2Qm9XvB4nL8sKd3Rt', {
    lang: ui || lang,
    helpButton: true,
    userId: 'demo-user-42',
    app: { name: lang === 'zh' ? '演示商城' : 'Demo Shop', version: '1.0.0' },
  })
})()
