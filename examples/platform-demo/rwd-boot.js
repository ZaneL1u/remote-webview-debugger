// Demo bootstrap: bring every page online with the RWD SDK.
// The demo is served by the gateway itself (/demo/platform/), so the gateway
// is this origin. The AppKey comes from ?key=…, remembered for later pages.
// The SDK's UI uses the demo's language (i18n.js).
(function () {
  var KEY_STORE = 'rwd-demo:key';
  var PLACEHOLDER = 'rwd_pk_demo000000000000000000';
  var fromQuery = new URLSearchParams(location.search).get('key');
  var key = fromQuery || PLACEHOLDER;
  try {
    if (fromQuery) localStorage.setItem(KEY_STORE, fromQuery);
    else key = localStorage.getItem(KEY_STORE) || PLACEHOLDER;
  } catch (e) {}
  if (!window.RemoteWebviewDebugger) {
    console.warn(I18n.t('sdkMissing'));
    return;
  }
  // The SDK's UI language: ?ui=<tag> (the website embeds the shop in the
  // visitor's language, which may not be one the shop itself has), else the
  // shop's language.
  var ui = new URLSearchParams(location.search).get('ui');
  try {
    if (ui) sessionStorage.setItem('rwd-demo:ui', ui);
    else ui = sessionStorage.getItem('rwd-demo:ui');
  } catch (e) {}
  RemoteWebviewDebugger.run(location.origin + '/v1', key, {
    helpButton: true,
    userId: 'demo-user-42',
    app: { name: I18n.t('appName'), version: '1.0.0' },
    lang: ui || I18n.lang,
  }).then(function (r) {
    // Framed by the website's "try it live" section: tell it the device code,
    // so the visitor's prompt is filled in. Only to the website's own origins.
    if (window.parent === window) return;
    var parents = ['https://debugger.site', 'http://localhost:4321', 'http://localhost:4391', 'http://localhost:5391'];
    for (var i = 0; i < parents.length; i++) {
      try {
        window.parent.postMessage({ rwdDemo: 'device', deviceCode: r.deviceCode }, parents[i]);
      } catch (e) {}
    }
  });
})();
