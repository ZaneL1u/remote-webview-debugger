// Shared helpers of the demo shop (derived from examples/platform-demo).
var Shop = (function () {
  var zh = document.documentElement.lang.indexOf('zh') === 0
  function loadProducts() {
    return fetch('api/products.json').then(function (res) {
      if (!res.ok) throw new Error((zh ? '商品数据加载失败：' : 'Could not load products: ') + res.status)
      return res.json()
    })
  }
  function money(n) {
    return (zh ? '¥' : '$') + Number(n).toFixed(2)
  }
  function query(name) {
    return new URLSearchParams(location.search).get(name)
  }
  function toast(text) {
    var el = document.getElementById('toast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'toast'
      el.setAttribute('role', 'status')
      document.body.appendChild(el)
    }
    el.textContent = text
    el.className = 'show'
    clearTimeout(toast.timer)
    toast.timer = setTimeout(function () {
      el.className = ''
    }, 2200)
  }
  return { loadProducts: loadProducts, money: money, query: query, toast: toast }
})()
