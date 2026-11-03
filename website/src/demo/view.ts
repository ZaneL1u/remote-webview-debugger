// The demo's agent panel, drawn the way the real terminals draw it: Claude
// Code (⏺ bullets, `rwd - tool (MCP)(args)`, results under ⎿, a spinner with
// the elapsed time and tokens) or Codex (• bullets, `Called rwd.tool({…})`,
// results under └, "Working (12s • esc to interrupt)"). Both renderings are in
// the DOM and [data-skin] on .demo picks one, so switching is instant. The
// status bar and the phone hint live here too.

import type { ToolResult } from './tools'

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

/** Lines of a result shown before "… +N lines" (both CLIs fold long output). */
const PEEK_LINES = 4

/** Claude Code's spinner glyphs and some of its words while it works. */
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']
const VERBS = ['Pondering', 'Investigating', 'Inspecting', 'Reasoning', 'Tracing', 'Cogitating', 'Percolating', 'Untangling', 'Sleuthing', 'Mulling']

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

/** Claude Code prints MCP arguments as `key: value`, values as JSON. */
function claudeArgs(args: object): string {
  const parts = Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  return parts.length ? `(${parts.join(', ')})` : ''
}

function duration(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

function tokens(n: number) {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`
}

export class View {
  private log: HTMLElement
  private anchor: HTMLElement
  private live: HTMLElement
  private statusEl: HTMLElement
  private statusDot: HTMLElement
  private progressEl: HTMLElement
  private hintEl: HTMLElement
  private stickToBottom = true
  /** The agent is on a task (from the prompt to the summary). */
  private active = false
  private ticking = 0
  private spinIndex = 0
  private elapsed = 0
  private lastTick = 0
  private tokenCount = 0
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private root: HTMLElement, private t: ViewText) {
    this.log = root.querySelector('[data-transcript]')!
    this.live = root.querySelector('[data-term-live]')!
    this.anchor = this.live
    this.statusEl = root.querySelector('[data-status]')!
    this.statusDot = root.querySelector('[data-status-dot]')!
    this.progressEl = root.querySelector('[data-progress]')!
    this.hintEl = root.querySelector('[data-hint]')!
    // Follow new output unless the reader scrolled up (our own smooth
    // scrolling must not count as that).
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
      const tool = (e.target as Element).closest('.tool')
      if (tool && ((e.target as Element).closest('.tool-head') || (e.target as Element).closest('.tool-more'))) this.toggle(tool as HTMLElement)
    })
  }

  clear() {
    this.log.querySelectorAll('.msg, .tool, .note, .worked').forEach(n => n.remove())
    this.stickToBottom = true
    this.active = false
    this.elapsed = 0
    this.tokenCount = 0
    this.setLive(false)
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
    if (state === 'done' || state === 'stopped' || state === 'idle') {
      this.active = false
      this.setLive(false)
    } else if (this.active) this.setLive(state !== 'paused', state === 'paused')
  }

  progress(fraction: number) {
    this.progressEl.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`
  }

  hint(text: string | null) {
    this.hintEl.textContent = text || ''
    this.hintEl.classList.toggle('on', !!text)
  }

  /* ----------------------------- the spinner ----------------------------- */

  /** Show and run the working line; `frozen` keeps it on screen without counting (paused). */
  private setLive(on: boolean, frozen = false) {
    this.live.hidden = !on && !frozen
    clearInterval(this.ticking)
    this.ticking = 0
    this.live.classList.toggle('frozen', frozen)
    if (!on) return
    this.lastTick = performance.now()
    this.paintLive()
    this.ticking = window.setInterval(() => {
      const now = performance.now()
      this.elapsed += now - this.lastTick
      this.lastTick = now
      this.spinIndex = (this.spinIndex + 1) % SPIN.length
      this.paintLive()
    }, 120)
  }

  private paintLive() {
    const s = `${Math.floor(this.elapsed / 1000)}s`
    this.live.querySelectorAll('[data-elapsed]').forEach(el => (el.textContent = s))
    const tk = this.live.querySelector('[data-tokens]')
    if (tk) tk.textContent = tokens(this.tokenCount)
    const spin = this.live.querySelector('[data-spin]')
    if (spin && !this.reduced) spin.textContent = SPIN[this.spinIndex]
  }

  private newVerb() {
    const v = this.live.querySelector('[data-verb]')
    if (v) v.textContent = `${VERBS[Math.floor(Math.random() * VERBS.length)]}…`
  }

  private addTokens(text: string) {
    this.tokenCount += Math.ceil(text.length / 3.6)
  }

  /* ------------------------------ the output ------------------------------ */

  private append(node: HTMLElement) {
    this.log.insertBefore(node, this.anchor)
    this.scroll()
  }

  scroll() {
    if (!this.stickToBottom) return
    const el = this.log
    el.scrollTo({ top: el.scrollHeight, behavior: this.reduced ? 'auto' : 'smooth' })
  }

  /** The prompt: the agent starts working. */
  user(text: string) {
    const n = document.createElement('div')
    n.className = 'msg msg-user'
    n.innerHTML = `<p>${inline(text)}</p>`
    this.append(n)
    this.active = true
    this.newVerb()
    this.setLive(true)
  }

  note(text: string, kind: 'info' | 'customer' | 'warn' = 'info') {
    const n = document.createElement('div')
    n.className = `note note-${kind}`
    n.innerHTML = kind === 'customer' ? `<span class="who">${esc(this.t.customer)}</span><span>${inline(text)}</span>` : `<span>${inline(text)}</span>`
    this.append(n)
  }

  /** An agent message, streamed in. `wait` paces it (pausable, cancellable). */
  async say(text: string, wait: (ms: number) => Promise<void>) {
    this.newVerb()
    const n = document.createElement('div')
    n.className = 'msg msg-agent'
    const p = document.createElement('p')
    n.appendChild(p)
    this.append(n)
    this.addTokens(text)
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

  /** A tool call; returns a handle to finish it with the result. */
  tool(name: string, args: object) {
    const n = document.createElement('div')
    n.className = 'tool'
    n.dataset.state = 'running'
    const json = Object.keys(args).length ? JSON.stringify(args) : '{}'
    n.innerHTML =
      `<button class="tool-head" type="button" aria-expanded="false">` +
      `<span class="tool-ic" aria-hidden="true"></span>` +
      `<span class="tool-call cc"><b>rwd - ${esc(name)}</b> (MCP)<span class="tool-args">${esc(claudeArgs(args))}</span></span>` +
      `<span class="tool-call cx"><span class="tool-verb"></span> <b>rwd.${esc(name)}</b><span class="tool-args">(${esc(json)})</span></span>` +
      `</button><div class="tool-body" hidden></div>`
    this.append(n)
    this.addTokens(json)
    return {
      done: (r: ToolResult) => {
        n.dataset.state = r.isError ? 'error' : 'ok'
        n.dataset.ms = String(r.ms)
        const body = n.querySelector('.tool-body') as HTMLElement
        const lines = r.text.split('\n')
        const more = lines.length - PEEK_LINES
        body.innerHTML =
          `<pre>${formatResult(r.text)}</pre>` +
          (more > 0
            ? `<button class="tool-more" type="button"><span class="cc">… +${more} lines <span class="dim">(ctrl+o to expand)</span></span><span class="cx">… +${more} lines</span></button>`
            : '')
        body.hidden = false
        body.classList.toggle('peek', more > 0)
        const head = n.querySelector('.tool-head') as HTMLButtonElement
        head.setAttribute('aria-expanded', more > 0 ? 'false' : 'true')
        this.newVerb()
        this.scroll()
      },
    }
  }

  private toggle(tool: HTMLElement) {
    const head = tool.querySelector('.tool-head') as HTMLButtonElement
    const body = tool.querySelector('.tool-body') as HTMLElement
    if (body.hidden || !body.querySelector('.tool-more')) return
    const open = head.getAttribute('aria-expanded') !== 'true'
    head.setAttribute('aria-expanded', String(open))
    body.classList.toggle('open', open)
    body.classList.toggle('peek', !open)
  }

  /** The final answer: how long the agent worked, then the summary as its last message. */
  summary(html: string) {
    const took = duration(this.elapsed)
    const worked = document.createElement('div')
    worked.className = 'worked'
    worked.innerHTML = `<span class="cc">✻ Worked for ${took}</span><span class="cx"><i></i><span>Worked for ${took}</span><i></i></span>`
    this.log.insertBefore(worked, this.anchor)
    const n = document.createElement('div')
    n.className = 'msg msg-agent summary'
    n.innerHTML = html
    this.log.insertBefore(n, this.anchor)
    this.active = false
    this.setLive(false)
    if (this.stickToBottom) this.log.scrollTo({ top: worked.offsetTop - 16, behavior: this.reduced ? 'auto' : 'smooth' })
  }
}
