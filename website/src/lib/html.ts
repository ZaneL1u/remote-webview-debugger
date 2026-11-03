// Small HTML helpers shared by the components: code blocks with a copy
// button, accessible tabs and QR codes. They return trusted HTML strings
// (the copy is ours), rendered with set:html.

import qrcode from 'qrcode-generator'
import { escapeHtml, highlight, type CodeLang } from './highlight.ts'
import { icon } from './icons.ts'

export function copyButton(floating = false) {
  return `<button class="copy${floating ? ' copy-float' : ''}" type="button" data-copy>${icon('copy')}<span class="copy-text" data-copy-label></span></button>`
}

export function code(src: string, lang: CodeLang, label?: string, extraClass = '') {
  const head = label ? `<div class="code-head"><span class="code-label">${escapeHtml(label)}</span>${copyButton()}</div>` : ''
  return `<div class="code ${extraClass}">${head}<pre tabindex="0"><code data-lang="${lang}">${highlight(src, lang)}</code></pre>${label ? '' : copyButton(true)}</div>`
}

/** Accessible tabs; main.ts wires the keyboard and clicks. */
export function tabs(id: string, label: string, items: { key: string; title: string; body: string }[]) {
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

/** A QR code as inline SVG, drawn at build time: dark modules on white. */
export function qr(text: string, label: string) {
  const q = qrcode(0, 'M')
  q.addData(text)
  q.make()
  const n = q.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
  return `<svg class="qr" viewBox="-3 -3 ${n + 6} ${n + 6}" shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(label)}"><rect x="-3" y="-3" width="${n + 6}" height="${n + 6}" fill="#fff"/><path d="${d}" fill="#04060d"/></svg>`
}

export { escapeHtml, icon }
