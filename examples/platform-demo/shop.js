// Shared helpers of the demo shop. Loaded at the end of <body>: fills in the
// static markup's text first (i18n.js).
I18n.apply();

var Shop = (function () {
  function loadProducts() {
    var file = I18n.lang === 'zh' ? 'api/products.json' : 'api/products.en.json';
    return fetch(file).then(function (res) {
      if (!res.ok) throw new Error(I18n.t('loadFailed') + res.status);
      return res.json();
    });
  }
  function money(n) {
    return I18n.t('currency') + Number(n).toFixed(2);
  }
  function query(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function toast(text) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.className = 'show';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.className = ''; }, 2200);
  }
  return { loadProducts: loadProducts, money: money, query: query, toast: toast };
})();
