// Renders public/og.png (1200x630) from the running preview server:
//   npm run build && npm run preview & node scripts/og.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.BASE || 'http://localhost:4391'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'dark' })
await page.goto(`${BASE}/`)
await page.evaluate(() => {
  const flow = document.querySelector('.flow').outerHTML
  const logo = document.querySelector('.brand').outerHTML
  document.body.innerHTML = `<div class="og">
    <div class="og-l">${logo}
      <h1>Let your AI agent debug the WebView <em>on your user’s phone</em>.</h1>
      <p>One script · a device code · an MCP endpoint · open source</p>
      <p class="og-url">debugger.site</p>
    </div>
    <div class="og-r">${flow}</div>
  </div>`
  const st = document.createElement('style')
  st.textContent = `
    body { margin:0; background:#04060d; }
    .og { position:relative; width:1200px; height:630px; display:grid; grid-template-columns: 1fr 360px; gap:48px; align-items:center; padding:0 64px; box-sizing:border-box; overflow:hidden;
      background: radial-gradient(46% 58% at 86% 12%, rgba(74,112,255,.38), transparent 70%), radial-gradient(38% 46% at 2% 96%, rgba(34,211,238,.14), transparent 72%), radial-gradient(34% 40% at 10% 6%, rgba(104,86,240,.2), transparent 72%), radial-gradient(circle at 1px 1px, rgba(150,180,255,.06) 1px, transparent 0) 0 0/22px 22px, #04060d; }
    .og h1 { margin:28px 0 0; font-size:60px; line-height:1.02; letter-spacing:-.045em; font-weight:650; color:#eaf0ff; }
    .og h1 em { font-style: normal; background: linear-gradient(100deg,#a9c2ff,#4d7cff 35%,#22d3ee 78%,#a78bfa); -webkit-background-clip:text; color:transparent; filter: drop-shadow(0 0 26px rgba(77,124,255,.5)); }
    .og p { margin-top:22px; font-size:20px; color:#a8b3cf; }
    .og .og-url { margin-top:30px; font: 500 17px/1 var(--font-hud); letter-spacing:.14em; color:#93b0ff; }
    .og .brand { font-size: 20px; color:#eaf0ff; } .og .logo-mark { width:36px; height:36px; color:#eaf0ff }
    .og .flow { opacity:1 !important; transform:none !important; display:grid !important; }
  `
  document.head.appendChild(st)
})
await page.waitForTimeout(600)
await page.screenshot({ path: 'public/og.png' })
await browser.close()
console.log('wrote public/og.png')
