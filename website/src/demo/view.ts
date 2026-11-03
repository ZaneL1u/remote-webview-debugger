// The demo's agent panel: a transcript of the conversation and the MCP tool
// calls with their (real) results, plus the status bar and the phone hint.

import type { ToolResult } from './tools'
import { play } from '../scripts/lottie.ts'

export type DemoState = 'idle' | 'prelude' | 'running' | 'paused' | 'waitApproval' | 'waitControl' | 'done' | 'stopped'

export interface ViewText {
  expand: string
  collapse: string
  running: string
  error: string
  you: string
  agent: string
  customer: string
  states: Record<DemoState, string>
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Inline markdown-ish: `code` and **bold** only. */
export function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

const PEEK_LINES = 6

/** Light formatting of a tool result: refs, errors, untrusted wrappers, session changes. */
function formatResult(text: string): string {
  let inChanges = false
  return text
    .split('\n')
    .map(line => {
      const e = esc(line)
      if (/^\[(Session changes|会话变化)\]$/.test(line)) {
        inChanges = true
        return `<span class="r-head">${e}</span>`
      }
      if (inChanges) return `<span class="r-change">${e}</span>`
      if (/^(Error: |错误：)/.test(line)) return `<span class="r-err">${e}</span>`
      if (/^(The following comes from the user's page|以下内容来自用户页面)/.test(line)) return `<span class="r-note">${e}</span>`
      if (/^&lt;\/?[a-z_]+&gt;$/.test(e)) return `<span class="r-tag">${e}</span>`
      return e
        .replace(/\[ref=(e\d+)\]/g, '[ref=<span class="r-ref">$1</span>]')
        .replace(/••••/g, '<span class="r-mask">••••</span>')
        .replace(/(\[error\]|→ (?:4|5)\d\d\b)/g, '<span class="r-bad">$1</span>')
    })
    .join('\n')
}

export class View {
  private log: HTMLElement
  private statusEl: HTMLElement
  private statusDot: HTMLElement
  private progressEl: HTMLElement
  private hintEl: HTMLElement
  private stickToBottom = true
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private root: HTMLElement, private t: ViewText) {
    this.log = root.querySelector('[data-transcript]')!
    this.statusEl = root.querySelector('[data-status]')!
    this.statusDot = root.querySelector('[data-status-dot]')!
    this.progressEl = root.querySelector('[data-progress]')!
    this.hintEl = root.querySelector('[data-hint]')!
    let lastInput = 0
    const input = () => (lastInput = performance.now())
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) this.log.addEventListener(ev, input, { passive: true })
    this.log.addEventListener('scroll', () => {
      const el = this.log
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
      if (atBottom) this.stickToBottom = true
      else if (performance.now() - lastInput < 1200) this.stickToBottom = false
    })
    this.log.addEventListener('click', e => {
      const head = (e.target as Element).closest('.tool-head') as HTMLButtonElement | null
      if (head) this.toggle(head)
    })
  }

  clear() {
    this.log.querySelectorAll('.msg, .tool, .note, .summary').forEach(n => n.remove())
    this.stickToBottom = true
    this.hint(null)
    this.progress(0)
  }

  hideStart() {
    this.root.querySelector('[data-start-card]')?.setAttribute('hidden', '')
  }

  showStart() {
    this.root.querySelector('[data-start-card]')?.removeAttribute('hidden')
  }

  status(state: DemoState) {
    this.statusEl.textContent = this.t.states[state]
    this.statusDot.dataset.state = state
    this.root.dataset.state = state
  }

  progress(fraction: number) {
    this.progressEl.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`
  }

  hint(text: string | null) {
    this.hintEl.textContent = text || ''
    this.hintEl.classList.toggle('on', !!text)
  }

  private append(node: HTMLElement) {
    this.log.appendChild(node)
    this.scroll()
  }

  scroll() {
    if (!this.stickToBottom) return
    const el = this.log
    el.scrollTo({ top: el.scrollHeight, behavior: this.reduced ? 'auto' : 'smooth' })
  }

  user(text: string) {
    const n = document.createElement('div')
    n.className = 'msg msg-user'
    n.innerHTML = `<span class="who">${esc(this.t.you)}</span><p>${inline(text)}</p>`
    this.append(n)
  }

  note(text: string, kind: 'info' | 'customer' | 'warn' = 'info') {
    const n = document.createElement('div')
    n.className = `note note-${kind}`
    n.innerHTML = kind === 'customer' ? `<span class="who">${esc(this.t.customer)}</span><span>${inline(text)}</span>` : `<span>${inline(text)}</span>`
    this.append(n)
  }

  /** An agent message, typed out. `wait` paces the typing (pausable, cancellable). */
  async say(text: string, wait: (ms: number) => Promise<void>) {
    const n = document.createElement('div')
    n.className = 'msg msg-agent'
    const p = document.createElement('p')
    n.appendChild(p)
    this.append(n)
    if (this.reduced) {
      p.innerHTML = inline(text)
      this.scroll()
      return
    }
    const step = 3
    for (let i = step; i < text.length + step; i += step) {
      p.textContent = text.slice(0, i)
      this.scroll()
      await wait(14)
    }
    p.innerHTML = inline(text)
    this.scroll()
  }

  /** A tool call block; returns a handle to finish it with the result. */
  tool(name: string, args: object) {
    const n = document.createElement('div')
    n.className = 'tool'
    n.dataset.state = 'running'
    const argText = Object.keys(args).length ? JSON.stringify(args) : ''
    n.innerHTML =
      `<button class="tool-head" type="button" aria-expanded="false">` +
      `<span class="tool-ic" aria-hidden="true"></span>` +
      `<span class="tool-name">${esc(name)}</span>` +
      `<span class="tool-args">${esc(argText)}</span>` +
      `<span class="tool-ms">${esc(this.t.running)}</span>` +
      `<span class="tool-chev" aria-hidden="true"></span>` +
      `</button><div class="tool-body" hidden></div>`
    this.append(n)
    // A Lottie orbit while it runs (the CSS spinner until it has loaded).
    const ic = n.querySelector<HTMLElement>('.tool-ic')!
    let orbit: Promise<import('lottie-web').AnimationItem | null> | null = null
    if (!this.reduced && this.root.dataset.skin !== 'claude' && this.root.dataset.skin !== 'codex') {
      orbit = play(ic, 'orbit').then(a => {
        if (a && n.dataset.state === 'running') ic.classList.add('has-lottie')
        else a?.destroy()
        return a
      })
    }
    return {
      done: (r: ToolResult) => {
        n.dataset.state = r.isError ? 'error' : 'ok'
        void orbit?.then(a => {
          a?.destroy()
          ic.classList.remove('has-lottie')
          ic.innerHTML = ''
        })
        const ms = n.querySelector('.tool-ms')!
        ms.textContent = r.isError ? `${this.t.error} · ${r.ms} ms` : `${r.ms} ms`
        const body = n.querySelector('.tool-body') as HTMLElement
        const lines = r.text.split('\n')
        body.innerHTML = `<pre>${formatResult(r.text)}</pre>` + (lines.length > PEEK_LINES ? `<button class="tool-more" type="button">${esc(this.t.expand)}</button>` : '')
        body.hidden = false
        body.classList.toggle('peek', lines.length > PEEK_LINES)
        const head = n.querySelector('.tool-head') as HTMLButtonElement
        head.setAttribute('aria-expanded', lines.length > PEEK_LINES ? 'false' : 'true')
        const more = body.querySelector('.tool-more')
        more?.addEventListener('click', () => this.toggle(head))
        this.scroll()
      },
    }
  }

  private toggle(head: HTMLButtonElement) {
    const tool = head.closest('.tool') as HTMLElement
    const body = tool.querySelector('.tool-body') as HTMLElement
    if (body.hidden) return
    const open = head.getAttribute('aria-expanded') !== 'true'
    head.setAttribute('aria-expanded', String(open))
    body.classList.toggle('open', open)
    body.classList.toggle('peek', !open && !!body.querySelector('.tool-more'))
    const more = body.querySelector('.tool-more')
    if (more) more.textContent = open ? this.t.collapse : this.t.expand
  }

  summary(html: string) {
    const n = document.createElement('div')
    n.className = 'summary'
    n.innerHTML = `<span class="summary-check" aria-hidden="true"></span>` + html
    this.log.appendChild(n)
    if (!this.reduced) void play(n.querySelector('.summary-check')!, 'check', { loop: false })
    if (this.stickToBottom) this.log.scrollTo({ top: n.offsetTop - 16, behavior: this.reduced ? 'auto' : 'smooth' })
  }
}
