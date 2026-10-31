// What the scripted agent (and the customer) say, per language.

export const SCRIPT_TEXT = {
  en: {
    prompt: 'A customer on device K7Q2-9M4X says checkout is broken: the total shows “--” and the order won’t go through. Can you find out why?',
    c1: 'opens “Wireless ANC Headphones Pro”',
    c2: 'picks the **Gift box** package',
    c3: 'taps **Buy now**',
    c4: 'sees the total “--”, taps **Ask for help**',
    hintPrelude: 'This is the real page SDK running in a demo shop. Watch the customer run into the bug…',
    hintApprove: 'Tap “Allow” on the phone to let the agent in.',
    hintRunning: 'The page is locked while the agent works. Tap “Take over” on the phone to grab control.',
    hintHandback: 'You have control. Tap “Hand back” to let the agent continue, or “End” to stop it.',
    hintDone: 'Done. Restart to watch again, or play with the shop yourself.',
    autoApproved: 'No answer on the phone — auto-approving so the demo can go on.',
    approved: (level: string) => `The customer approved access (**${level}**).`,
    s1: 'Let me find that device and ask the customer for access.',
    s2: 'It’s online and asking for help. I’ll request access — the customer has to approve it on the phone.',
    s3: 'I’m in. Let me put a plan on their screen so they can follow along, then look at the page.',
    s4: 'The total really reads “--”. The phone number, payment PIN and card number come through masked, as they should. Checking the console.',
    s5: 'There it is: `TypeError: order.price.toFixed is not a function`, thrown while computing the total. The coupon box looks suspicious too — let me try the code from the banner.',
    s6: '`GET api/coupon` answers 404 — a separate problem, I’ll note it. Back to the total: what is `order.price`?',
    s7: (price: string) => `\`price\` is the string \`${price}\` — formatted text, not a number, so \`toFixed()\` throws. Checkout only reads this value; it’s written on the product page. How did the customer get here?`,
    s7b: 'The stored order has no text price — the data changed while you had control. The console error is still the best lead; let me check the path the customer took.',
    s8: 'List → product → checkout, with the error right after arriving. I’ll reproduce on the product page: first with Standard, then with Gift box.',
    s9: (total: string) => `With Standard the total is ${total} — checkout works. Now the gift box:`,
    s10: 'Gift box breaks it every time. Let me read the line on the product page that writes the price.',
    s11: 'Found it. Wrapping up and leaving the customer’s phone.',
    takeover: 'You’ve taken over — I’ll pause and wait until you hand control back.',
    resumed: 'Thanks, I have control again. Picking up where I left off.',
    ended: 'The customer ended the session, so I stopped. Nothing else was changed on their phone.',
    denied: 'The customer declined access, so I can’t look at the page. I’ll stop here.',
    timeout: 'The customer didn’t answer the request, so I can’t connect. I’ll stop here.',
    forbidden: 'That needs a higher access level than the customer granted — skipping this check.',
    moving: (where: string) => `The phone is on another page now; going back to ${where}.`,
    whereCheckout: 'checkout',
    whereDetail: 'the product page',
    task: {
      title: 'Checkout total shows --',
      steps: ['Look at the checkout page', 'Read console and network', 'Inspect the order data', 'Reproduce on product page', 'Pin down the root cause'],
    },
    find: { coupon: 'Coupon', apply: 'Apply', pkg: 'Package', buy: 'Buy now', total: 'Total', standard: 'standard', gift: 'gift' },
    fallbackPrice: '"$208.00"',
    standardTotal: '$199.00',
  },
  zh: {
    prompt: '设备码 K7Q2-9M4X 的用户反馈：结算页合计显示「--」，订单也提交不了。帮我查一下原因。',
    c1: '打开「无线降噪耳机 Pro」',
    c2: '选了**礼盒装**',
    c3: '点了**立即购买**',
    c4: '看到合计是「--」，点了**求助**',
    hintPrelude: '这是运行在演示商城里的真实页面 SDK。先看看用户是怎么遇到问题的……',
    hintApprove: '在手机上点「允许」，让 agent 接入。',
    hintRunning: 'agent 操作时页面被锁定。在手机上点「接管」可以随时拿回控制。',
    hintHandback: '你已接管。点「交还 AI」让 agent 继续，或点「结束」停止。',
    hintDone: '演示结束。可以重新开始，也可以自己在商城里点点看。',
    autoApproved: '手机上没有响应，演示中自动允许接入。',
    approved: (level: string) => `用户已允许接入（**${level}**）。`,
    s1: '我先找到这台设备，请用户授权接入。',
    s2: '设备在线，正在求助。我来申请接入，需要用户在手机上确认。',
    s3: '已接入。先在用户屏幕上显示排查计划，让用户知道我在做什么，然后看页面。',
    s4: '合计确实显示「--」。手机号、支付密码和会员卡号都是遮盖的，符合预期。看看 console。',
    s5: '找到了：计算合计时抛出 `TypeError: order.price.toFixed is not a function`。优惠码看着也可疑，我用横幅上的码试一下。',
    s6: '`GET api/coupon` 返回 404，这是另一个问题，先记下。回到合计：`order.price` 到底是什么？',
    s7: (price: string) => `\`price\` 是字符串 \`${price}\`——格式化后的文字而不是数字，所以 \`toFixed()\` 直接报错。结算页只是读这个值，写入是在详情页。看看用户是怎么走到这里的。`,
    s7b: '订单数据里的价格不是文字——你接管期间数据变了。console 的报错仍是最好的线索，看看用户走过的路径。',
    s8: '列表页 → 详情页 → 结算页，一进结算页就报错。我回到详情页复现：先选标准装，再选礼盒装。',
    s9: (total: string) => `选标准装时合计是 ${total}，结算正常。再试礼盒装：`,
    s10: '礼盒装必现。看看详情页里写入价格的那行代码。',
    s11: '找到了。收尾，离开用户的手机。',
    takeover: '你接管了控制，我先暂停，等你交还。',
    resumed: '收到，控制已交还，我从刚才的地方继续。',
    ended: '用户结束了调试，我已停止，没有再改动用户手机上的任何东西。',
    denied: '用户拒绝了接入，我看不到页面，先到这里。',
    timeout: '用户没有响应接入请求，我连不上设备，先到这里。',
    forbidden: '这一步需要的权限高于用户授予的级别，跳过。',
    moving: (where: string) => `手机现在在别的页面，我先回到${where}。`,
    whereCheckout: '结算页',
    whereDetail: '详情页',
    task: {
      title: '结算页合计显示 --',
      steps: ['查看结算页', '查 console 和网络', '检查订单数据', '在详情页复现', '定位根因'],
    },
    find: { coupon: '优惠码', apply: '使用', pkg: '规格', buy: '立即购买', total: '合计', standard: 'standard', gift: 'gift' },
    fallbackPrice: '"¥938.00"',
    standardTotal: '¥899.00',
  },
}

export function summaryHtml(lang: 'en' | 'zh', price: string, diffHtml: string, skipped: boolean) {
  if (lang === 'zh') {
    return `<h4>根因</h4>
<p>详情页选「礼盒装」时，<code>detail.html</code> 把<strong>格式化后的价格文字</strong>（<code>${price}</code>）写进了订单，而不是数字。结算页 <code>checkout.html</code> 随后调用 <code>order.price.toFixed(2)</code>，抛出 <code>TypeError: order.price.toFixed is not a function</code>：合计显示「--」，点「提交订单」也会在发请求之前就报错。标准装正常，因为它存的是数字。</p>
<h4>证据</h4>
<ul>
<li>结算页 console：每次带礼盒装进入都出现这个 TypeError。</li>
<li><code>sessionStorage["demo:order"].price</code> 是字符串 <code>${price}</code>。</li>
<li>在设备上复现：标准装合计 ¥899.00，礼盒装显示「--」。</li>
<li>详情页源码里写入价格的那一行（<code>evaluate_script</code>）。</li>
</ul>
<h4>修复</h4>
<div class="code code-diff"><pre><code>${diffHtml}</code></pre></div>
<p>只在显示时格式化（单价标签已经这样做了）；结算页也可以加一层保护：<code>Number(order.price)</code>。</p>
<h4>顺带发现</h4>
<p><code>GET api/coupon?code=VIP40</code> 返回 404，优惠码目前无法使用，是优惠码接口的另一个问题。</p>
${skipped ? '<p class="muted">部分检查因为授予的权限级别不够被跳过了。</p>' : ''}
<p class="muted">整个过程没有在用户手机上提交任何订单，排查结束后已断开。</p>`
  }
  return `<h4>Root cause</h4>
<p>When “Gift box” is selected, <code>detail.html</code> stores the <strong>formatted price text</strong> (<code>${price}</code>) in the order instead of a number. <code>checkout.html</code> then calls <code>order.price.toFixed(2)</code>, which throws <code>TypeError: order.price.toFixed is not a function</code> — so the total renders “--”, and “Place order” throws before any request is sent. Standard works because it stores a number.</p>
<h4>Evidence</h4>
<ul>
<li>Checkout console: the TypeError, every time the page loads with a gift box.</li>
<li><code>sessionStorage["demo:order"].price</code> is the string <code>${price}</code>.</li>
<li>Reproduced on the device: Standard totals $199.00, Gift box shows “--”.</li>
<li>The line on the product page that writes the price (<code>evaluate_script</code>).</li>
</ul>
<h4>Fix</h4>
<div class="code code-diff"><pre><code>${diffHtml}</code></pre></div>
<p>Format only for display (the unit-price label already does), and make checkout defensive with <code>Number(order.price)</code>.</p>
<h4>Also noticed</h4>
<p><code>GET api/coupon?code=VIP40</code> returns 404, so coupons can’t be applied — a separate bug in the coupon API.</p>
${skipped ? '<p class="muted">Some checks were skipped because of the access level that was granted.</p>' : ''}
<p class="muted">Nothing was submitted on the customer’s phone, and I disconnected when done.</p>`
}

export function fixDiff(lang: 'en' | 'zh') {
  const extra = lang === 'zh' ? 39 : 9
  return `   if (spec === 'gift') {
-    unitPrice = Shop.money(product.price + ${extra})
+    unitPrice = product.price + ${extra}
   } else {`
}
