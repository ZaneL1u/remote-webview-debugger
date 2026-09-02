import { editKey, insertText } from './editing'
import { deepActiveElement } from './dom'
import { rwdError } from './errors'
import { agentText } from './i18n'

// Keyboard input with Playwright key names ("Enter", "ArrowDown", "a",
// "Control+A", "Shift+Tab", "ControlOrMeta+A"). Printable keys go through
// keydown → keypress → beforeinput/input (value updated) → keyup; editing keys
// (Backspace, arrows, Home/End, Select All) get their default action from
// ./editing.ts. Characters outside the US layout (e.g. Chinese) are inserted as
// text without key events, as Playwright does.

interface KeyDef {
  key: string
  code: string
  keyCode: number
  text: string
  location?: number
}

// name: [keyCode, code, key (defaults to name), text]
const SPECIAL: { [name: string]: [number, string, string?, string?] } = {
  Backspace: [8, 'Backspace'],
  Tab: [9, 'Tab', 'Tab', '\t'],
  Enter: [13, 'Enter', 'Enter', '\r'],
  Shift: [16, 'ShiftLeft'],
  Control: [17, 'ControlLeft'],
  Alt: [18, 'AltLeft'],
  Meta: [91, 'MetaLeft'],
  CapsLock: [20, 'CapsLock'],
  Escape: [27, 'Escape'],
  Space: [32, 'Space', ' ', ' '],
  PageUp: [33, 'PageUp'],
  PageDown: [34, 'PageDown'],
  End: [35, 'End'],
  Home: [36, 'Home'],
  ArrowLeft: [37, 'ArrowLeft'],
  ArrowUp: [38, 'ArrowUp'],
  ArrowRight: [39, 'ArrowRight'],
  ArrowDown: [40, 'ArrowDown'],
  Insert: [45, 'Insert'],
  Delete: [46, 'Delete'],
}
for (let i = 1; i <= 12; i++) SPECIAL['F' + i] = [111 + i, 'F' + i]

// Punctuation on the US layout: char -> [keyCode, code, shifted?]
const PUNCT: { [ch: string]: [number, string, boolean] } = {}
const PUNCT_ROWS: [string, string, number, string][] = [
  ['`', '~', 192, 'Backquote'],
  ['-', '_', 189, 'Minus'],
  ['=', '+', 187, 'Equal'],
  ['[', '{', 219, 'BracketLeft'],
  [']', '}', 221, 'BracketRight'],
  ['\\', '|', 220, 'Backslash'],
  [';', ':', 186, 'Semicolon'],
  ["'", '"', 222, 'Quote'],
  [',', '<', 188, 'Comma'],
  ['.', '>', 190, 'Period'],
  ['/', '?', 191, 'Slash'],
]
for (const [plain, shifted, keyCode, code] of PUNCT_ROWS) {
  PUNCT[plain] = [keyCode, code, false]
  PUNCT[shifted] = [keyCode, code, true]
}
const SHIFTED_DIGITS = ')!@#$%^&*('

const MOD_BITS: { [name: string]: number } = { Alt: 1, Control: 2, Meta: 4, Shift: 8 }

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

/** Key definition for a Playwright key name or a single character. */
function keyDef(name: string, shift: boolean): KeyDef | null {
  const special = SPECIAL[name]
  if (special) {
    const [keyCode, code, key, text] = special
    return { key: key || name, code, keyCode, text: text || '' }
  }
  if (/^Key[A-Z]$/.test(name)) name = shift ? name[3] : name[3].toLowerCase()
  if (/^Digit[0-9]$/.test(name)) name = name[5]
  if (name.length !== 1) return null

  if (/[a-zA-Z]/.test(name)) {
    const upper = name.toUpperCase()
    const ch = shift ? upper : name
    return { key: ch, code: 'Key' + upper, keyCode: upper.charCodeAt(0), text: ch }
  }
  if (/[0-9]/.test(name)) {
    const ch = shift ? SHIFTED_DIGITS[+name] : name
    return { key: ch, code: 'Digit' + name, keyCode: name.charCodeAt(0), text: ch }
  }
  const digit = SHIFTED_DIGITS.indexOf(name)
  if (digit >= 0) {
    return { key: name, code: 'Digit' + digit, keyCode: 48 + digit, text: name }
  }
  const punct = PUNCT[name]
  if (punct) return { key: name, code: punct[1], keyCode: punct[0], text: name }
  if (name === ' ') return keyDef('Space', shift)
  return null
}

function target(): HTMLElement {
  const el = deepActiveElement()
  return el instanceof HTMLElement ? el : document.body
}

function fireKey(type: string, def: KeyDef, mods: number, el: HTMLElement) {
  const ev = new KeyboardEvent(type, {
    key: def.key,
    code: def.code,
    location: def.location || 0,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    altKey: !!(mods & 1),
    ctrlKey: !!(mods & 2),
    metaKey: !!(mods & 4),
    shiftKey: !!(mods & 8),
  })
  const code = type === 'keypress' ? def.text.charCodeAt(0) : def.keyCode
  // Legacy fields many pages still read.
  for (const name of ['keyCode', 'which', 'charCode']) {
    const value = name === 'charCode' ? (type === 'keypress' ? code : 0) : code
    Object.defineProperty(ev, name, { configurable: true, get: () => value })
  }
  return el.dispatchEvent(ev)
}

function pressDef(def: KeyDef, mods: number) {
  const el = target()
  const printable = !!def.text && !(mods & (1 | 2 | 4))

  if (def.key === 'Enter' && !(mods & (1 | 2 | 4))) {
    if (fireKey('keydown', def, mods, el) && fireKey('keypress', def, mods, el)) {
      enterDefault(el)
    }
    fireKey('keyup', def, mods, target())
    return
  }
  if (printable && def.key !== 'Tab') {
    if (fireKey('keydown', def, mods, el) && fireKey('keypress', def, mods, el)) {
      insertText(def.text)
    }
    fireKey('keyup', def, mods, target())
    return
  }
  // Editing and navigation keys: keydown plus the default editing action.
  if (fireKey('keydown', def, mods, el)) {
    if (def.key === 'Tab' && !(mods & (1 | 2 | 4))) moveFocus(!!(mods & 8))
    else editKey(def.key, mods)
  }
  fireKey('keyup', def, mods, target())
}

function enterDefault(el: HTMLElement) {
  if (el instanceof HTMLTextAreaElement || el.isContentEditable) {
    insertText('\n')
    return
  }
  if (el instanceof HTMLInputElement && el.form) {
    // Implicit submission: the form's default button, else submit directly.
    const form = el.form
    const submitter = form.querySelector(
      'button:not([type]), button[type=submit], input[type=submit], input[type=image]'
    ) as HTMLElement | null
    if (submitter) {
      if (!(submitter as HTMLButtonElement).disabled) submitter.click()
    } else if (typeof (form as any).requestSubmit === 'function') {
      ;(form as any).requestSubmit()
    } else if (form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) {
      form.submit()
    }
  } else if (el instanceof HTMLAnchorElement || el instanceof HTMLButtonElement) {
    el.click()
  }
}

function moveFocus(backwards: boolean) {
  const all = Array.prototype.filter.call(
    document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex], [contenteditable]'
    ),
    (el: HTMLElement) =>
      el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0
  ) as HTMLElement[]
  if (!all.length) return
  const index = all.indexOf(target())
  const next = backwards
    ? all[(index <= 0 ? all.length : index) - 1]
    : all[(index + 1) % all.length]
  next.focus()
}

/** rwd.press: a Playwright key name, optionally with modifiers ("Control+A"). */
export function press(combo: string) {
  if (typeof combo !== 'string' || !combo) throw rwdError('bad_request', agentText().missingParam('key'))
  const parts = combo === '+' ? ['+'] : combo.split('+')
  if (parts[parts.length - 1] === '' && parts.length > 1) {
    parts.splice(parts.length - 2, 2, '+')
  }
  const main = parts.pop()!
  const modNames = parts.map(m => (m === 'ControlOrMeta' ? (isMac ? 'Meta' : 'Control') : m))
  let mods = 0
  for (const m of modNames) {
    if (!(m in MOD_BITS)) throw rwdError('bad_request', agentText().unknownModifier(m))
  }
  const shift = modNames.indexOf('Shift') >= 0
  const def = keyDef(main, shift)
  if (!def) throw rwdError('bad_request', agentText().unknownKey(main))

  for (const m of modNames) {
    mods |= MOD_BITS[m]
    fireKey('keydown', keyDef(m, false)!, mods, target())
  }
  pressDef(def, mods)
  for (let i = modNames.length - 1; i >= 0; i--) {
    mods &= ~MOD_BITS[modNames[i]]
    fireKey('keyup', keyDef(modNames[i], false)!, mods, target())
  }
}

/** rwd.type: type text into the focused element, key by key. */
export function typeText(text: string) {
  // Code points, not UTF-16 units.
  const chars = Array.from(text)
  for (const ch of chars) {
    if (ch === '\n' || ch === '\r') {
      pressDef(keyDef('Enter', false)!, 0)
      continue
    }
    const shifted = /[A-Z~!@#$%^&*()_+{}|:"<>?]/.test(ch)
    const def = ch.length === 1 && ch !== '\t' ? keyDef(ch, shifted) : null
    if (def) {
      pressDef(def, shifted ? 8 : 0)
    } else {
      insertText(ch)
    }
  }
}
