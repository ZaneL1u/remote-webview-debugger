// Demo shop i18n (English / Chinese). ?lang=en|zh wins and is remembered for
// later pages (and tabs) of the demo; otherwise the browser's language:
// zh* → Chinese, anything else → English. Loaded in <head>, before
// rwd-boot.js, which hands the same language to the SDK.
//
// Static markup carries data-i18n (text), data-i18n-placeholder and
// data-i18n-label (aria-label) keys; I18n.apply() fills them in.
var I18n = (function () {
  var STORE = 'rwd-demo:lang';

  function pick(value) {
    return value === 'en' || value === 'zh' ? value : null;
  }

  var lang = pick(new URLSearchParams(location.search).get('lang'));
  try {
    if (lang) localStorage.setItem(STORE, lang);
    else lang = pick(localStorage.getItem(STORE));
  } catch (e) {}
  if (!lang) lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';

  var TEXT = {
    en: {
      appName: 'Demo Shop',
      currency: '$',
      giftExtra: 5,
      sameDayFee: 8,
      phonePattern: /^\+?[\d\s()-]{7,20}$/,
      // index.html
      'list.title': 'Demo Shop - Products',
      'list.banner': '11.11 Members’ Day',
      'list.bannerText': '$10 off orders over $100. Tap to open the sale in a new tab ›',
      'list.products': 'Products',
      'list.recommended': 'Recommended for you',
      'list.loading': 'Loading…',
      'list.noRecommend': 'No recommendations yet',
      'list.recommendFailed': 'Failed to load recommendations:',
      'list.trackingFailed': '[analytics] Impression report failed; will retry on next launch',
      soldOut: 'Sold out',
      loadFailed: 'Failed to load products: ',
      back: 'Back',
      // detail.html
      'detail.title': 'Product details',
      'detail.heading': 'Product',
      'detail.titleOf': function (name) { return name + ' - Product details'; },
      'detail.notFound': 'No such product: ',
      'detail.option': 'Option',
      'detail.standard': 'Standard',
      'detail.gift': 'Gift box (+$5)',
      'detail.quantity': 'Quantity',
      'detail.less': 'Decrease quantity',
      'detail.more': 'Increase quantity',
      'detail.unitPrice': 'Unit price',
      'detail.buy': 'Buy now',
      // checkout.html
      'checkout.title': 'Checkout',
      'checkout.item': 'Item',
      'checkout.empty': '(Your cart is empty)',
      'checkout.shipping': 'Shipping',
      'checkout.receiver': 'Recipient',
      'checkout.receiverHint': 'Full name',
      'checkout.phone': 'Phone',
      'checkout.phoneHint': 'Mobile number',
      'checkout.address': 'Address',
      'checkout.addressHint': 'Street, city, ZIP code',
      'checkout.delivery': 'Delivery',
      'checkout.express': 'Standard (free)',
      'checkout.sameDay': 'Same-day (+$8)',
      'checkout.pickup': 'Pick up in store',
      'checkout.note': 'Order note',
      'checkout.optional': 'Optional',
      'checkout.coupon': 'Coupon code',
      'checkout.couponHint': 'Enter a code',
      'checkout.apply': 'Apply',
      'checkout.payPin': 'Payment PIN',
      'checkout.payPinHint': '6 digits',
      'checkout.memberCard': 'Member card: ',
      'checkout.total': 'Total',
      'checkout.submit': 'Place order',
      'checkout.corrupt': 'Order data is corrupted',
      'checkout.needCoupon': 'Enter a coupon code',
      'checkout.couponFailed': function (status) { return 'Coupon check failed (HTTP ' + status + ')'; },
      'checkout.couponUnavailable': 'Coupons are unavailable right now',
      'checkout.cartEmpty': 'Your cart is empty',
      'checkout.invalid': 'Enter a recipient and a valid phone number',
      'checkout.orderFailedLog': 'Order failed: HTTP ',
      'checkout.orderFailed': 'Couldn’t place the order. Try again later.',
      'checkout.ordered': 'Order placed',
      // promo.html
      'promo.title': '11.11 Members’ Day',
      'promo.deal': '$10 off orders over $100',
      'promo.dates': 'Nov 1 – Nov 11. One coupon per account.',
      'promo.claim': 'Claim coupon',
      'promo.claimed': 'Claimed: $10 off orders over $100 (code VIP10)',
      'promo.shop': 'Keep shopping ›',
      // rwd-boot.js
      sdkMissing: '[demo] RWD SDK not loaded (/v1/sdk.js)',
    },
    zh: {
      appName: '演示商城',
      currency: '¥',
      giftExtra: 39,
      sameDayFee: 12,
      phonePattern: /^1\d{10}$/,
      'list.title': '演示商城 - 商品列表',
      'list.banner': '双 11 会员日',
      'list.bannerText': '满 300 减 40，点我在新标签页查看活动 ›',
      'list.products': '商品列表',
      'list.recommended': '为你推荐',
      'list.loading': '加载中…',
      'list.noRecommend': '暂无推荐',
      'list.recommendFailed': '推荐商品加载失败：',
      'list.trackingFailed': '[埋点] 曝光上报失败，将在下次启动时重试',
      soldOut: '已售罄',
      loadFailed: '商品数据加载失败：',
      back: '返回',
      'detail.title': '商品详情',
      'detail.heading': '商品详情',
      'detail.titleOf': function (name) { return name + ' - 商品详情'; },
      'detail.notFound': '商品不存在：',
      'detail.option': '规格',
      'detail.standard': '标准装',
      'detail.gift': '礼盒装（+¥39）',
      'detail.quantity': '数量',
      'detail.less': '减少数量',
      'detail.more': '增加数量',
      'detail.unitPrice': '单价',
      'detail.buy': '立即购买',
      'checkout.title': '确认订单',
      'checkout.item': '商品',
      'checkout.empty': '（购物车是空的）',
      'checkout.shipping': '收货信息',
      'checkout.receiver': '收货人',
      'checkout.receiverHint': '请输入姓名',
      'checkout.phone': '手机号',
      'checkout.phoneHint': '11 位手机号',
      'checkout.address': '收货地址',
      'checkout.addressHint': '省市区 + 详细地址',
      'checkout.delivery': '配送方式',
      'checkout.express': '快递（免运费）',
      'checkout.sameDay': '同城急送（+¥12）',
      'checkout.pickup': '到店自提',
      'checkout.note': '订单备注',
      'checkout.optional': '选填',
      'checkout.coupon': '优惠码',
      'checkout.couponHint': '输入优惠码',
      'checkout.apply': '使用',
      'checkout.payPin': '支付密码',
      'checkout.payPinHint': '6 位数字',
      'checkout.memberCard': '会员卡号：',
      'checkout.total': '合计',
      'checkout.submit': '提交订单',
      'checkout.corrupt': '订单数据损坏',
      'checkout.needCoupon': '请输入优惠码',
      'checkout.couponFailed': function (status) { return '优惠码校验失败（HTTP ' + status + '）'; },
      'checkout.couponUnavailable': '优惠码暂不可用',
      'checkout.cartEmpty': '购物车是空的',
      'checkout.invalid': '请填写收货人和正确的手机号',
      'checkout.orderFailedLog': '下单失败：HTTP ',
      'checkout.orderFailed': '下单失败，请稍后再试',
      'checkout.ordered': '下单成功',
      'promo.title': '双 11 会员日',
      'promo.deal': '满 300 减 40',
      'promo.dates': '活动时间：11 月 1 日 - 11 月 11 日。每个账号限领一张。',
      'promo.claim': '领取优惠券',
      'promo.claimed': '已领取：满 300 减 40（优惠码 VIP40）',
      'promo.shop': '去逛逛 ›',
      sdkMissing: '[demo] RWD SDK 未加载（/v1/sdk.js）',
    },
  };

  /** The text for `key`; extra arguments go to keys that are functions. */
  function t(key) {
    var value = TEXT[lang][key];
    if (typeof value === 'function') return value.apply(null, Array.prototype.slice.call(arguments, 1));
    return value === undefined ? key : value;
  }

  function each(root, attr, fn) {
    var list = root.querySelectorAll('[' + attr + ']');
    for (var i = 0; i < list.length; i++) fn(list[i], t(list[i].getAttribute(attr)));
  }

  /** Fill in the data-i18n* keys of the static markup. */
  function apply(root) {
    root = root || document;
    each(root, 'data-i18n', function (el, text) { el.textContent = text; });
    each(root, 'data-i18n-placeholder', function (el, text) { el.setAttribute('placeholder', text); });
    each(root, 'data-i18n-label', function (el, text) { el.setAttribute('aria-label', text); });
  }

  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  // Right away: the title goes out with the SDK's first hello.
  var title = document.querySelector('title[data-i18n]');
  if (title) title.textContent = t(title.getAttribute('data-i18n'));

  return { lang: lang, t: t, apply: apply };
})();
