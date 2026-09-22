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
  RemoteWebviewDebugger.run(location.origin + '/v1', key, {
    helpButton: true,
    userId: 'demo-user-42',
    app: { name: I18n.t('appName'), version: '1.0.0' },
    lang: I18n.lang,
  });
})();
