// The terminal side of `init`: colours, a spinner, a checkbox list, yes/no on
// one key, and a key prompt that shows • for each character. No dependencies,
// so the package stays one file. Everything goes to stderr (stdout is the MCP
// channel when the same binary runs as a server). Without a TTY the callers
// fall back to plain line questions.
import readline from 'node:readline'

export class Cancelled extends Error {
  constructor() {
    super('cancelled')
  }
}

export interface Style {
  bold(s: string): string
  dim(s: string): string
  green(s: string): string
  red(s: string): string
  yellow(s: string): string
  cyan(s: string): string
  brand(s: string): string
}

export function makeStyle(on: boolean, truecolor = false): Style {
  const w = (open: string, close: string) => (s: string) => (on ? `\x1b[${open}m${s}\x1b[${close}m` : s)
  return {
    bold: w('1', '22'),
    dim: w('2', '22'),
    green: w('32', '39'),
    red: w('31', '39'),
    yellow: w('33', '39'),
    cyan: w('36', '39'),
    // The SDK's purple (#5D5CF5) where the terminal has 24-bit colour.
    brand: truecolor ? w('38;2;125;124;255', '39') : w('35', '39'),
  }
}

export const plainStyle = makeStyle(false)

export function colorWanted(stream: NodeJS.WriteStream, env: Record<string, string | undefined>): boolean {
  if (env.NO_COLOR) return false
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true
  return !!stream.isTTY && env.TERM !== 'dumb'
}

// --- text width (CJK and emoji take two columns)

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g

export function width(s: string): number {
  let n = 0
  for (const ch of s.replace(ANSI, '')) {
    const c = ch.codePointAt(0)!
    if (c < 32 || (c >= 0x300 && c <= 0x36f) || c === 0x200d || (c >= 0xfe00 && c <= 0xfe0f)) continue
    n += isWide(c) ? 2 : 1
  }
  return n
}

function isWide(c: number): boolean {
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0x303e) ||
    (c >= 0x3041 && c <= 0x33ff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0xa000 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd)
  )
}

export function pad(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - width(s)))
}

/** A rounded box around some lines. */
export function box(lines: string[], st: Style): string {
  const w = Math.max(...lines.map(width))
  const top = st.dim(`╭${'─'.repeat(w + 2)}╮`)
  const bottom = st.dim(`╰${'─'.repeat(w + 2)}╯`)
  return [top, ...lines.map((l) => `${st.dim('│')} ${pad(l, w)} ${st.dim('│')}`), bottom].join('\n')
}

// --- the terminal

export interface ChoiceItem {
  label: string
  note?: string
}

export class Terminal {
  readonly st: Style
  private out: NodeJS.WriteStream
  private input: NodeJS.ReadStream
  /** Lines the current live widget has drawn (to redraw it in place). */
  private drawn = 0

  constructor(st: Style, out: NodeJS.WriteStream = process.stderr, input: NodeJS.ReadStream = process.stdin) {
    this.st = st
    this.out = out
    this.input = input
  }

  /** Raw key input works here (a TTY that can switch to raw mode). */
  get canRaw(): boolean {
    return !!this.input.isTTY && typeof this.input.setRawMode === 'function'
  }

  write(s: string): void {
    this.out.write(s)
  }

  private cols(): number {
    return this.out.columns || 80
  }

  private draw(lines: string[]): void {
    this.clear()
    const cols = this.cols()
    // Lines wider than the terminal wrap and break the redraw: count what they take.
    this.drawn = lines.reduce((n, l) => n + Math.max(1, Math.ceil(width(l) / cols)), 0)
    this.out.write(lines.join('\n') + '\n')
  }

  private clear(): void {
    if (this.drawn) this.out.write(`\x1b[${this.drawn}A\x1b[0J`)
    this.drawn = 0
  }

  /** Reads keys until `onKey` returns true. Ctrl-C rejects with Cancelled. */
  private keys(onKey: (str: string | undefined, key: readline.Key) => boolean | void): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = this.input
      readline.emitKeypressEvents(input)
      const wasRaw = input.isRaw
      input.setRawMode(true)
      input.resume()
      this.out.write('\x1b[?25l')
      const done = (err?: Error) => {
        input.off('keypress', handler)
        input.setRawMode(wasRaw)
        input.pause()
        this.out.write('\x1b[?25h')
        if (err) reject(err)
        else resolve()
      }
      const handler = (str: string | undefined, key: readline.Key) => {
        if (key?.ctrl && (key.name === 'c' || key.name === 'd')) return done(new Cancelled())
        try {
          if (onKey(str, key ?? {})) done()
        } catch (e) {
          done(e as Error)
        }
      }
      input.on('keypress', handler)
    })
  }

  /** The finished question, on one line: "✔ question  answer". */
  private settle(message: string, answer: string): void {
    this.clear()
    this.out.write(`  ${answer ? this.st.green('✔') : this.st.dim('·')} ${this.st.bold(message)} ${answer ? this.st.cyan(answer) : this.st.dim('—')}\n`)
  }

  async confirm(message: string, def: boolean, labels: { yes: string; no: string }): Promise<boolean> {
    let value = def
    const render = () => {
      const opt = (on: boolean, label: string) => (on ? this.st.cyan(this.st.bold(`● ${label}`)) : this.st.dim(`○ ${label}`))
      this.draw([`  ${this.st.cyan('?')} ${this.st.bold(message)}  ${opt(value, labels.yes)}  ${opt(!value, labels.no)}  ${this.st.dim(def ? '(Y/n)' : '(y/N)')}`])
    }
    render()
    await this.keys((str, key) => {
      if (key.name === 'return' || key.name === 'enter') return true
      if (str === 'y' || str === 'Y') return (value = true), true
      if (str === 'n' || str === 'N') return (value = false), true
      if (['left', 'right', 'up', 'down', 'tab', 'space'].includes(key.name ?? '')) value = !value
      render()
    })
    this.settle(message, value ? labels.yes : labels.no)
    return value
  }

  async multiSelect(message: string, help: string, items: ChoiceItem[], selected: Set<number>, summary: (picked: number[]) => string): Promise<number[]> {
    let cursor = Math.max(0, items.findIndex((_, i) => selected.has(i)))
    const labelW = Math.max(...items.map((i) => width(i.label)))
    const numW = String(items.length).length
    const render = () => {
      const lines = [`  ${this.st.cyan('?')} ${this.st.bold(message)}`, `    ${this.st.dim(help)}`]
      items.forEach((it, i) => {
        const on = selected.has(i)
        const here = i === cursor
        const pointer = here ? this.st.cyan('❯') : ' '
        const mark = on ? this.st.green('◉') : this.st.dim('◯')
        const num = this.st.dim(String(i + 1).padStart(numW))
        const label = here ? this.st.cyan(pad(it.label, labelW)) : pad(it.label, labelW)
        lines.push(`  ${pointer} ${num} ${mark} ${label}  ${it.note ? this.st.dim(it.note) : ''}`.trimEnd())
      })
      this.draw(lines)
    }
    render()
    await this.keys((str, key) => {
      const k = key.name
      if (k === 'return' || k === 'enter') return true
      if (k === 'up' || k === 'k' || (k === 'tab' && key.shift)) cursor = (cursor - 1 + items.length) % items.length
      else if (k === 'down' || k === 'j' || k === 'tab') cursor = (cursor + 1) % items.length
      else if (k === 'space' || k === 'x') toggle(selected, cursor)
      else if (str === 'a' || str === 'A') {
        if (selected.size === items.length) selected.clear()
        else items.forEach((_, i) => selected.add(i))
      } else if (str && /^[1-9]$/.test(str) && Number(str) <= items.length) {
        cursor = Number(str) - 1
        toggle(selected, cursor)
      }
      render()
    })
    const picked = [...selected].sort((a, b) => a - b)
    this.settle(message, summary(picked))
    return picked
  }

  /** One line of text; `secret` shows • per character. Empty input gives `def`. */
  async text(message: string, o: { def?: string; hint?: string; secret?: boolean } = {}): Promise<string> {
    const head = `  ${this.st.cyan('?')} ${this.st.bold(message)}${o.hint ? ' ' + this.st.dim(o.hint) : ''}`
    if (!o.secret) {
      const rl = readline.createInterface({ input: this.input, output: this.out, terminal: true })
      let cancelled = false
      rl.on('SIGINT', () => {
        cancelled = true
        rl.close()
      })
      const answer = await new Promise<string>((resolve) => {
        rl.question(`${head}${o.def ? ' ' + this.st.dim(`(${o.def})`) : ''}\n  ${this.st.cyan('›')} `, resolve)
        rl.on('close', () => resolve(''))
      })
      rl.close()
      if (cancelled) throw new Cancelled()
      const value = answer.trim() || o.def || ''
      this.drawn = 2
      this.settle(message, value)
      return value
    }
    let value = ''
    const render = () => this.draw([head, `  ${this.st.cyan('›')} ${'•'.repeat(Math.min(value.length, 48))}${value.length > 48 ? '…' : ''}`])
    render()
    this.out.write('\x1b[?25h')
    await this.keys((str, key) => {
      if (key.name === 'return' || key.name === 'enter') return true
      if (key.name === 'backspace') value = value.slice(0, -1)
      else if (key.ctrl && key.name === 'u') value = ''
      else if (str && !key.ctrl && !key.meta && str >= ' ') value += str
      render()
    })
    value = value.trim()
    this.settle(message, value ? '•'.repeat(Math.min(value.length, 12)) : '')
    return value
  }

  /** Runs `fn` behind a spinner; the line is replaced by whatever the caller logs next. */
  async spin<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.out.isTTY) return fn()
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let i = 0
    this.out.write('\x1b[?25l')
    const tick = () => this.out.write(`\r\x1b[2K  ${this.st.cyan(frames[i++ % frames.length]!)} ${label} …`)
    tick()
    const timer = setInterval(tick, 80)
    try {
      return await fn()
    } finally {
      clearInterval(timer)
      this.out.write('\r\x1b[2K\x1b[?25h')
    }
  }
}

function toggle(set: Set<number>, i: number): void {
  if (set.has(i)) set.delete(i)
  else set.add(i)
}
