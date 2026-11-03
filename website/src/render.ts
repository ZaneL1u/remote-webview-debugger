// Renders the pre-built HTML for each language. Used by vite.config.ts at
// dev and build time (transformIndexHtml), so every language gets real,
// crawlable markup; src/main.ts only adds behaviour on top.

import qrcode from 'qrcode-generator'
import { en, type Dict } from './i18n/en.ts'
import { zh } from './i18n/zh.ts'
import { escapeHtml, highlight, type CodeLang } from './highlight.ts'
import { icon, logo } from './icons.ts'
import * as S from './snippets.ts'

export const SITE = 'https://debugger.site'
export const REPO = 'https://github.com/ZaneL1u/remote-webview-debugger'
const BLOB = `${REPO}/blob/main`

export const DICTS: Record<'en' | 'zh', Dict> = { en, zh }

function code(src: string, lang: CodeLang, label?: string, extraClass = '') {
  const t = label ? `<div class="code-head"><span class="code-label">${escapeHtml(label)}</span>${copyButton()}</div>` : ''
  return `<div class="code ${extraClass}">${t}<pre tabindex="0"><code data-lang="${lang}">${highlight(src, lang)}</code></pre>${label ? '' : copyButton(true)}</div>`
}

function copyButton(floating = false) {
  return `<button class="copy${floating ? ' copy-float' : ''}" type="button" data-copy>${icon('copy')}<span class="copy-text" data-copy-label></span></button>`
}

/** Accessible tabs; main.ts wires the keyboard and clicks. */
function tabs(id: string, label: string, items: { key: string; title: string; body: string }[]) {
  const btns = items
    .map(
      (it, i) =>
        `<button role="tab" type="button" id="${id}-tab-${it.key}" aria-controls="${id}-panel-${it.key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${it.title}</button>`,
    )
    .join('')
  const panels = items
    .map(
      (it, i) =>
        `<div role="tabpanel" id="${id}-panel-${it.key}" aria-labelledby="${id}-tab-${it.key}"${i === 0 ? '' : ' hidden'}>${it.body}</div>`,
    )
    .join('')
  return `<div class="tabs" data-tabs><div class="tablist" role="tablist" aria-label="${escapeHtml(label)}">${btns}</div>${panels}</div>`
}

function sectionHead(num: string, kicker: string, title: string, lead?: string, id?: string) {
  return `<header class="section-head reveal">
  <p class="kicker"><span class="sec-num">${num}</span>${kicker}</p>
  <h2${id ? ` id="${id}"` : ''}>${title}</h2>
  ${lead ? `<p class="lead">${lead}</p>` : ''}
</header>`
}

/** The atmosphere behind every page: dust, aurora, horizon grid, scanlines. */
function backdrop() {
  return `<div class="fx" aria-hidden="true">
  <div class="fx-aurora"></div>
  <canvas class="fx-stars" data-stars></canvas>
  <div class="fx-grid"></div>
  <div class="fx-scan"></div>
</div>`
}

function head(t: Dict, lang: 'en' | 'zh') {
  const url = SITE + t.path
  const redirect =
    lang === 'en'
      ? `try{var l=localStorage.getItem('rwd.lang'),n=(navigator.languages&&navigator.languages[0])||navigator.language||'';if(!l&&/^zh\\b/i.test(n)&&!/[?&]lang=en\\b/.test(location.search)){location.replace('/zh/'+location.hash);}}catch(e){}`
      : ''
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Remote WebView Debugger',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'iOS, Android, Web',
    description: t.meta.description,
    url,
    license: 'https://opensource.org/licenses/MIT',
    codeRepository: REPO,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
  return `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(t.meta.title)}</title>
<meta name="description" content="${escapeHtml(t.meta.description)}" />
<link rel="canonical" href="${url}" />
<link rel="alternate" hreflang="en" href="${SITE}/" />
<link rel="alternate" hreflang="zh-CN" href="${SITE}/zh/" />
<link rel="alternate" hreflang="x-default" href="${SITE}/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Remote WebView Debugger" />
<meta property="og:title" content="${escapeHtml(t.meta.ogTitle)}" />
<meta property="og:description" content="${escapeHtml(t.meta.ogDescription)}" />
<meta property="og:url" content="${url}" />
<meta property="og:locale" content="${t.meta.ogLocale}" />
<meta property="og:locale:alternate" content="${lang === 'en' ? 'zh_CN' : 'en_US'}" />
<meta property="og:image" content="${SITE}/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(t.meta.ogTitle)}" />
<meta name="twitter:description" content="${escapeHtml(t.meta.ogDescription)}" />
<meta name="twitter:image" content="${SITE}/og.png" />
<meta name="theme-color" content="#04060d" />
<meta name="color-scheme" content="dark light" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<script>(function(){var d=document.documentElement;d.className+=' js';try{var t=localStorage.getItem('rwd.theme');if(t==='light'||t==='dark')d.setAttribute('data-theme',t);}catch(e){}${redirect}})();</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="module" src="/src/main.ts"></script>`
}

function header(t: Dict, lang: 'en' | 'zh') {
  const home = t.path
  const navItems: [string, string][] = [
    ['#demo', t.nav.demo],
    ['#live', t.nav.live],
    ['#how', t.nav.how],
    ['#features', t.nav.features],
    ['#privacy', t.nav.privacy],
    ['#self-host', t.nav.selfHost],
    ['#faq', t.nav.faq],
  ]
  const nav = navItems.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')
  const langSwitch = `<div class="lang" role="group" aria-label="${t.nav.langLabel}">
    <a href="/" hreflang="en" lang="en" data-lang="en"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
    <a href="/zh/" hreflang="zh-CN" lang="zh-CN" data-lang="zh"${lang === 'zh' ? ' aria-current="true"' : ''}>中文</a>
  </div>`
  return `<a class="skip" href="#main">${t.nav.skip}</a>
<header class="site-header" data-header>
  <div class="wrap header-inner">
    <a class="brand" href="${home}" aria-label="Remote WebView Debugger">${logo('lg-h')}<span class="brand-name"><span class="brand-remote">Remote </span>WebView Debugger</span></a>
    <nav class="nav" aria-label="Primary"><ul>${nav}</ul></nav>
    <div class="header-tools">
      ${langSwitch}
      <button class="icon-btn theme-btn" type="button" data-theme-toggle aria-label="${t.nav.themeToggle}" title="${t.nav.themeToggle}">${icon('sun', 'ic sun')}${icon('moon', 'ic moon')}</button>
      <a class="icon-btn gh" href="${REPO}" aria-label="GitHub" title="GitHub">${icon('github')}</a>
      <button class="icon-btn menu-btn" type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="${t.nav.menu}">${icon('menu', 'ic open')}${icon('close', 'ic shut')}</button>
    </div>
  </div>
  <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile" hidden><ul>${nav}<li><a href="${REPO}">GitHub</a></li></ul></nav>
</header>`
}

function flow(t: Dict) {
  const f = t.hero.flow
  const node = (cls: string, ic: string, title: string, sub: string, extra = '') =>
    `<div class="flow-node flow-${cls}"><span class="flow-ic">${icon(ic)}</span><div><b>${title}</b><small>${sub}</small></div>${extra}</div>`
  const link = (label: string) => `<div class="flow-link"><span class="flow-wire"><i></i><i></i></span><span class="flow-label">${label}</span></div>`
  return `<div class="flow reveal" role="img" aria-label="${escapeHtml(f.label)}">
    ${node('agent', 'bot', f.agent, f.agentSub)}
    ${link(f.mcp)}
    ${node('gw', 'server', f.gw, f.gwSub)}
    ${link(f.ws)}
    ${node('phone', 'phone', f.phone, f.phoneSub, `<span class="flow-state"><span></span>${f.state}</span><code class="flow-code">K7Q2-9M4X</code>`)}
  </div>`
}

/** A thin HUD readout under the hero. Decorative: the figures are the demo's. */
function ticker(t: Dict) {
  const run = `<span class="ticker-run">${t.hero.ticker.map(s => `<b>${s}</b>`).join('')}</span>`
  return `<div class="wrap"><div class="ticker reveal" aria-hidden="true"><div class="ticker-track">${run}${run}</div></div></div>`
}

function hero(t: Dict) {
  return `<section class="hero" aria-labelledby="hero-title">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="wrap hero-grid">
  <div class="hero-inner">
    <p class="eyebrow reveal"><span class="eyebrow-dot" aria-hidden="true"></span>${t.hero.eyebrow}</p>
    <h1 id="hero-title" class="reveal">${t.hero.titleHtml}</h1>
    <p class="hero-sub reveal">${t.hero.sub}</p>
    <div class="cta reveal">
      <a class="btn btn-primary" href="#demo">${icon('play')}<span>${t.hero.ctaDemo}</span></a>
      <a class="btn btn-ghost" href="${REPO}">${icon('github')}<span>${t.hero.ctaGithub}</span></a>
      <a class="btn btn-link" href="#self-host"><span>${t.hero.ctaSelfHost}</span>${icon('arrow')}</a>
    </div>
    <ul class="hero-points reveal">${t.hero.points.map(p => `<li>${icon('check')}${p}</li>`).join('')}</ul>
  </div>
  ${flow(t)}
  </div>
  ${ticker(t)}
</section>`
}

function demo(t: Dict, lang: 'en' | 'zh') {
  const d = t.demo
  return `<section id="demo" class="demo-section" aria-labelledby="demo-title">
  <div class="wrap">
    ${sectionHead('01', d.kicker, d.title, d.lead, 'demo-title')}
    <div class="demo reveal" data-demo data-lang="${lang}">
      <div class="demo-bar">
        <div class="demo-status" aria-live="polite"><span class="status-dot" data-status-dot></span><span data-status>${d.stateIdle}</span></div>
        <div class="demo-progress" aria-hidden="true"><span data-progress></span></div>
        <div class="demo-controls">
          <button class="ctl ctl-play" type="button" data-play aria-label="${d.play}" title="${d.play}">${icon('play', 'ic i-play')}${icon('pause', 'ic i-pause')}</button>
          <button class="ctl" type="button" data-restart aria-label="${d.restart}" title="${d.restart}">${icon('restart')}</button>
          <div class="speed" role="group" aria-label="${d.speed}">
            <button type="button" data-speed="1" aria-pressed="true">1×</button>
            <button type="button" data-speed="2" aria-pressed="false">2×</button>
          </div>
        </div>
      </div>
      <div class="demo-grid">
        <div class="agent">
          <div class="agent-head">
            <span class="agent-avatar" aria-hidden="true">${icon('bot')}</span>
            <div><p class="agent-title">${d.agentTitle}</p><p class="agent-sub"><span class="mcp-dot" aria-hidden="true"></span>${d.agentSub}</p></div>
          </div>
          <div class="transcript" data-transcript role="log" aria-label="${d.agentTitle}" tabindex="0">
            <div class="start-card" data-start-card>
              <p>${d.startHint}</p>
              <button class="btn btn-primary" type="button" data-start>${icon('play')}<span>${d.start}</span></button>
            </div>
          </div>
        </div>
        <div class="phone-col">
          <p class="phone-label">${icon('phone')}<span>${d.phoneLabel}</span><code data-phone-code>K7Q2-9M4X</code></p>
          <div class="phone-stage" data-phone-stage>
            <div class="phone" data-phone>
              <div class="phone-screen">
                <div class="phone-status" aria-hidden="true"><span>9:41</span><span class="phone-island"></span><span class="phone-icons"><i class="sig"></i><i class="bat"></i></span></div>
                <iframe data-phone-frame title="${d.phoneLabel}"></iframe>
              </div>
            </div>
          </div>
          <p class="phone-hint" data-hint aria-live="polite"></p>
        </div>
      </div>
      <p class="demo-foot">${d.footnote}</p>
    </div>
  </div>
</section>`
}

/** A QR code as inline SVG, drawn at build time: dark modules on white. */
function qr(text: string, label: string) {
  const q = qrcode(0, 'M')
  q.addData(text)
  q.make()
  const n = q.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
  return `<svg class="qr" viewBox="-3 -3 ${n + 6} ${n + 6}" shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(label)}"><rect x="-3" y="-3" width="${n + 6}" height="${n + 6}" fill="#fff"/><path d="${d}" fill="#04060d"/></svg>`
}

/** The real thing: the public demo gateway. main.ts fills in today's key. */
function live(t: Dict, lang: 'en' | 'zh') {
  const l = t.live
  const shop = `${S.DEMO}/?lang=${lang}`
  const keyed = (html: string) => html.replace(/rwd_sk_live_…/g, '<span data-live-key>rwd_sk_live_…</span>')
  const mcp = tabs('live', l.tabsLabel, [
    { key: 'claude', title: 'Claude Code', body: keyed(code(S.liveClaudeSnippet(), 'sh', 'terminal')) },
    { key: 'cursor', title: 'Cursor', body: keyed(code(S.liveCursorSnippet(), 'json', '.cursor/mcp.json')) },
  ])
  const prompt = `<div class="code code-prompt"><div class="code-head"><span class="code-label">${l.promptLabel}</span>${copyButton()}</div><pre tabindex="0"><code>${escapeHtml(l.prompt)}</code></pre></div>`
  const visuals = [
    `<div class="live-open">
      <figure class="live-qr">${qr(shop, l.scan)}<figcaption>${l.scan}</figcaption></figure>
      <a class="btn btn-primary" href="${shop}" target="_blank" rel="noopener">${icon('phone')}<span>${l.open}</span>${icon('arrow')}</a>
    </div>`,
    `${mcp}<p class="live-status" data-live-status data-ready="${escapeHtml(l.keyReady)}" data-failed="${escapeHtml(l.keyFailed)}" aria-live="polite"><span class="status-dot" aria-hidden="true"></span><span data-live-text>${l.keyLoading}</span></p>`,
    `${prompt}<p class="live-note">${l.promptNote}</p>`,
  ]
  const steps = l.steps
    .map(
      (s, i) => `<li class="step live-step reveal">
      <div class="live-text"><span class="step-num" aria-hidden="true">0${i + 1}</span><h3>${s.title}</h3><p>${s.body}</p></div>
      <div class="live-visual">${visuals[i]}</div>
    </li>`,
    )
    .join('')
  return `<section id="live" class="section section-alt" aria-labelledby="live-title">
  <div class="wrap">
    ${sectionHead('02', l.kicker, l.title, l.lead, 'live-title')}
    <div class="live" data-live="${S.DEMO}/demo/rwd-demo.json" data-live-state="loading">
      <ol class="live-steps">${steps}</ol>
      <div class="live-limits reveal"><h3>${icon('shield')}${l.limitsTitle}</h3><ul>${l.limits.map(x => `<li>${x}</li>`).join('')}</ul></div>
    </div>
  </div>
</section>`
}

function how(t: Dict, lang: 'en' | 'zh') {
  const h = t.how
  const visuals = [
    `<div class="step-chip" aria-hidden="true"><span class="t-t">&lt;script</span> <span class="t-a">src</span>=<span class="t-s">"…/v1/sdk.js"</span><span class="t-t">&gt;</span><small>${h.chip1}</small></div>`,
    `<div class="pill-demo" aria-hidden="true">
      <span class="pill"><span class="pill-dot"></span><b>${h.pill.code}</b><span class="pill-state">${h.pill.online}</span></span>
      <span class="pill pill-help">${icon('hand')}${h.pill.help}</span>
    </div>`,
    `<div class="step-chip" aria-hidden="true"><span class="t-fn">connect_device</span>(<span class="t-s">"K7Q2-9M4X"</span>)<small><span class="ok-dot"></span>${h.chip3}</small></div>`,
  ]
  const steps = h.steps
    .map(
      (s, i) => `<li class="step reveal">
      <span class="step-num" aria-hidden="true">0${i + 1}</span>
      <h3>${s.title}</h3>
      <p>${s.body}</p>
      ${visuals[i]}
    </li>`,
    )
    .join('')
  const mcp = tabs('mcp', h.tabsLabel, [
    { key: 'claude', title: 'Claude Code', body: code(S.claudeCodeSnippet(), 'sh', 'terminal') },
    { key: 'cursor', title: 'Cursor', body: code(S.cursorSnippet(), 'json', '.cursor/mcp.json') },
    { key: 'stdio', title: 'stdio', body: code(S.stdioSnippet(lang), 'sh', 'terminal') },
  ])
  return `<section id="how" class="section" aria-labelledby="how-title">
  <div class="wrap">
    ${sectionHead('03', h.kicker, h.title, undefined, 'how-title')}
    <ol class="steps">${steps}</ol>
    <div class="how-code">
      <div class="reveal">${code(S.h5Snippet(lang), 'html', 'index.html')}</div>
      <div class="reveal">
        ${mcp}
        <div class="prompt-line">${icon('bot')}<span>${h.prompt}</span></div>
      </div>
    </div>
  </div>
</section>`
}

function features(t: Dict) {
  const f = t.features
  const cards = f.items
    .map(
      it => `<li class="feature reveal">
      <span class="feature-ic">${icon(it.icon)}</span>
      <h3>${it.title}</h3>
      <p>${it.body}</p>
    </li>`,
    )
    .join('')
  const tools = S.TOOLS.map(n => `<li><code>${n}</code></li>`).join('')
  return `<section id="features" class="section" aria-labelledby="features-title">
  <div class="wrap">
    ${sectionHead('04', f.kicker, f.title, undefined, 'features-title')}
    <ul class="features">${cards}</ul>
    <div class="tools reveal"><span class="radar" aria-hidden="true"></span><h3>${f.toolsTitle} <span class="count">${S.TOOLS.length}</span></h3><ul>${tools}</ul></div>
  </div>
</section>`
}

function privacy(t: Dict, lang: 'en' | 'zh') {
  const p = t.privacy
  const icons = ['shield', 'hand', 'mask', 'check', 'key', 'scroll']
  const items = p.items
    .map(
      (it, i) => `<li class="priv reveal">
      <span class="priv-ic">${icon(icons[i])}</span>
      <div><h3>${it.title}</h3><p>${it.body}</p></div>
    </li>`,
    )
    .join('')
  const levels = p.levels
    .map((l, i) => `<li><span class="lvl lvl-${i}">${l.name}</span><span>${l.tools}</span></li>`)
    .join('')
  return `<section id="privacy" class="section section-alt" aria-labelledby="privacy-title">
  <div class="wrap">
    ${sectionHead('05', p.kicker, p.title, p.lead, 'privacy-title')}
    <div class="privacy-grid">
      <ul class="privs">${items}</ul>
      <aside class="privacy-side">
        <div class="levels reveal"><ul>${levels}</ul></div>
        <div class="reveal">${code(S.maskedSnapshot(lang), 'yaml', 'take_snapshot', 'code-mask')}</div>
      </aside>
    </div>
  </div>
</section>`
}

function native(t: Dict, lang: 'en' | 'zh') {
  const n = t.native
  const tb = tabs('native', n.kicker, [
    { key: 'ios', title: n.tabs.ios, body: code(S.iosSnippet(lang), 'swift', 'RemoteDebugger.swift') },
    { key: 'android', title: n.tabs.android, body: code(S.androidSnippet(lang), 'kotlin', 'RemoteDebugger.kt') },
    { key: 'h5', title: n.tabs.h5, body: code(S.h5Snippet(lang), 'html', 'index.html') },
  ])
  return `<section id="native" class="section" aria-labelledby="native-title">
  <div class="wrap split">
    <div>${sectionHead('06', n.kicker, n.title, n.lead, 'native-title')}
      <ul class="extras">${n.extras.map(e => `<li class="reveal">${icon('check')}<div><h3>${e.title}</h3><p>${e.body}</p></div></li>`).join('')}</ul>
    </div>
    <div class="reveal">${tb}</div>
  </div>
</section>`
}

function selfHost(t: Dict) {
  const s = t.selfHost
  const pts = s.points.map((p, i) => `<li>${icon(['server', 'db', 'chart'][i])}<div><h3>${p.title}</h3><p>${p.body}</p></div></li>`).join('')
  return `<section id="self-host" class="section section-alt" aria-labelledby="self-host-title">
  <div class="wrap split">
    <div>
      ${sectionHead('07', s.kicker, s.title, s.lead, 'self-host-title')}
      <ul class="host-points reveal">${pts}</ul>
      <p class="reveal"><a class="btn btn-link" href="${REPO}/tree/main/deploy/platform">${s.docsLink}${icon('arrow')}</a></p>
    </div>
    <div class="reveal">${code(S.selfHostSnippet(s), 'sh', s.stepsTitle, 'code-term')}<p class="requires">${s.requires}</p></div>
  </div>
</section>`
}

function faq(t: Dict) {
  const f = t.faq
  const items = f.items
    .map(
      it => `<details class="qa reveal"><summary><span>${it.q}</span><span class="qa-ic" aria-hidden="true"></span></summary><div class="qa-a"><p>${it.a}</p></div></details>`,
    )
    .join('')
  return `<section id="faq" class="section" aria-labelledby="faq-title">
  <div class="wrap">
    ${sectionHead('08', f.kicker, f.title, undefined, 'faq-title')}
    <div class="faq">${items}</div>
  </div>
</section>`
}

function footer(t: Dict) {
  const f = t.footer
  return `<footer class="site-footer">
  <div class="wrap footer-inner">
    <div class="footer-brand">
      <a class="brand" href="${t.path}">${logo('lg-f')}<span class="brand-name"><span class="brand-remote">Remote </span>WebView Debugger</span></a>
      <p>${f.tagline}</p>
    </div>
    <div class="footer-cols">
      <div><h2>${f.project}</h2><ul>
        <li><a href="${REPO}">${f.links.github}</a></li>
        <li><a href="${REPO}/issues">${f.links.issues}</a></li>
        <li><a href="${BLOB}/LICENSE">${f.links.license}</a></li>
      </ul></div>
      <div><h2>${f.docs}</h2><ul>
        <li><a href="${BLOB}/docs/protocol.md">${f.links.protocol}</a></li>
        <li><a href="${BLOB}/gateway/README.md">${f.links.gateway}</a></li>
        <li><a href="${BLOB}/sdk/README.md">${f.links.sdk}</a></li>
        <li><a href="${BLOB}/docs/platform.md">${f.links.platform}</a></li>
      </ul></div>
    </div>
  </div>
  <div class="wrap footer-note"><p>${f.note}</p><p>© 2026 Remote WebView Debugger</p></div>
</footer>`
}

export function renderPage(lang: 'en' | 'zh'): string {
  const t = DICTS[lang]
  return `<!doctype html>
<html lang="${t.htmlLang}" data-page-lang="${lang}">
<head>
${head(t, lang)}
</head>
<body>
${backdrop()}
${header(t, lang)}
<main id="main">
${hero(t)}
${demo(t, lang)}
${live(t, lang)}
${how(t, lang)}
${features(t)}
${privacy(t, lang)}
${native(t, lang)}
${selfHost(t)}
${faq(t)}
</main>
${footer(t)}
<template data-i18n>${escapeHtml(JSON.stringify({ copy: t.copy.copy, copied: t.copy.copied }))}</template>
</body>
</html>`
}

export function renderNotFound(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>404 · Remote WebView Debugger</title>
<meta name="robots" content="noindex" />
<meta name="color-scheme" content="dark light" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<script>(function(){var d=document.documentElement;d.className+=' js';try{var t=localStorage.getItem('rwd.theme');if(t==='light'||t==='dark')d.setAttribute('data-theme',t);}catch(e){}})();</script>
<script type="module" src="/src/notfound.ts"></script>
</head>
<body class="nf">
${backdrop()}
<main class="nf-main" id="main">
  <a class="brand" href="/">${logo('lg-n')}<span class="brand-name"><span class="brand-remote">Remote </span>WebView Debugger</span></a>
  <p class="nf-code">404</p>
  <h1>${en.notFound.title} <span lang="zh-CN">· ${zh.notFound.title}</span></h1>
  <p>${en.notFound.body}<br /><span lang="zh-CN">${zh.notFound.body}</span></p>
  <p class="nf-links"><a class="btn btn-primary" href="/">${en.notFound.home}</a><a class="btn btn-ghost" href="/zh/" lang="zh-CN">${zh.notFound.home}</a></p>
</main>
</body>
</html>`
}
