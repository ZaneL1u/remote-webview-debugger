import { deepActiveElement } from './dom'

// What a browser does by default after an unprevented keydown: insert text,
// delete, move the caret, select all. Synthetic key events never trigger
// these, so the engine applies them itself on the focused field.

type TextField = HTMLInputElement | HTMLTextAreaElement

const ALT = 1
const CTRL = 2
const META = 4
const SHIFT = 8

/** Input types that keep a value but expose no selection API. */
const NO_SELECTION = /^(email|number|date|datetime-local|month|time|week)$/
const NOT_TEXT = /^(checkbox|radio|file|button|submit|reset|image|hidden|range|color)$/

function focused(): Element {
  return deepActiveElement() || document.body
}

function textField(el: Element): TextField | null {
  if (el instanceof HTMLTextAreaElement) return el
  if (el instanceof HTMLInputElement && !NOT_TEXT.test(el.type)) return el
  return null
}

function writable(el: TextField) {
  return !el.readOnly && !el.disabled
}

function setValue(el: TextField, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
}

/** [start, end] of the selection; fields without one act as "caret at the end". */
function range(el: TextField): [number, number] {
  if (el instanceof HTMLInputElement && NO_SELECTION.test(el.type)) {
    return [el.value.length, el.value.length]
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  if (start === null || end === null) return [el.value.length, el.value.length]
  return [start, end]
}

function select(el: TextField, start: number, end: number, backward = false) {
  if (el instanceof HTMLInputElement && NO_SELECTION.test(el.type)) return
  try {
    el.setSelectionRange(start, end, backward ? 'backward' : 'forward')
  } catch {
    // Some input types refuse a selection; the caret simply stays put.
  }
}

/** Replace [start, end) with text, firing beforeinput / input like typing does. */
function edit(el: TextField, start: number, end: number, text: string, inputType: string) {
  if (!writable(el)) return
  const before = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType,
    data: text || null,
  })
  if (!el.dispatchEvent(before)) return

  const value = el.value
  if (el.maxLength >= 0 && text) {
    const room = el.maxLength - (value.length - (end - start))
    text = room > 0 ? Array.from(text).slice(0, room).join('') : ''
    if (!text && start === end) return
  }
  setValue(el, value.slice(0, start) + text + value.slice(end))
  const caret = start + text.length
  select(el, caret, caret)
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType, data: text || null }))
}

/** Length of the code point that ends (backward) or starts (forward) at i. */
function charLength(value: string, i: number, backward: boolean) {
  const at = backward ? i - 1 : i
  const code = value.charCodeAt(at)
  if (backward && code >= 0xdc00 && code <= 0xdfff && i >= 2) return 2
  if (!backward && code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) return 2
  return 1
}

/** Offset of the previous / next word boundary, for Alt/Ctrl + arrow or delete. */
function wordBoundary(value: string, i: number, backward: boolean) {
  const word = /[\p{L}\p{N}_]/u
  if (backward) {
    while (i > 0 && !word.test(value[i - 1])) i--
    while (i > 0 && word.test(value[i - 1])) i--
  } else {
    while (i < value.length && !word.test(value[i])) i++
    while (i < value.length && word.test(value[i])) i++
  }
  return i
}

function lineStart(value: string, i: number) {
  return value.lastIndexOf('\n', i - 1) + 1
}

function lineEnd(value: string, i: number) {
  const next = value.indexOf('\n', i)
  return next < 0 ? value.length : next
}

/** Caret one line up or down in a textarea, keeping the column when it fits. */
function verticalMove(value: string, i: number, up: boolean) {
  const start = lineStart(value, i)
  const column = i - start
  if (up) {
    if (start === 0) return 0
    const prev = lineStart(value, start - 1)
    return Math.min(prev + column, start - 1)
  }
  const end = lineEnd(value, i)
  if (end === value.length) return value.length
  const nextStart = end + 1
  return Math.min(nextStart + column, lineEnd(value, nextStart))
}

/** Insert text at the caret of the focused field or contenteditable. */
export function insertText(text: string) {
  if (!text) return
  const el = focused()
  const field = textField(el)
  if (field) {
    const [start, end] = range(field)
    const value = field instanceof HTMLInputElement ? text.replace(/[\r\n]+/g, '') : text
    edit(field, start, end, value, text === '\n' ? 'insertLineBreak' : 'insertText')
    return
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    if (text === '\n') {
      if (!document.execCommand('insertLineBreak')) document.execCommand('insertText', false, '\n')
    } else {
      document.execCommand('insertText', false, text)
    }
  }
}

/**
 * Default action of an editing / navigation key on the focused element.
 * Returns false when the key has no editing meaning there.
 */
export function editKey(key: string, mods: number): boolean {
  const el = focused()
  const field = textField(el)
  const word = !!(mods & (ALT | CTRL))
  const line = !!(mods & META)
  const extend = !!(mods & SHIFT)

  if (key === 'a' || key === 'A') {
    if (!(mods & (CTRL | META))) return false
    if (field) select(field, 0, field.value.length)
    else document.execCommand('selectAll')
    return true
  }

  if (!field) {
    if (!(el instanceof HTMLElement) || !el.isContentEditable) return false
    return editContent(key, word, line, extend)
  }

  const value = field.value
  const [start, end] = range(field)
  const backwardAnchor = field.selectionDirection === 'backward'
  const caret = backwardAnchor ? start : end
  const anchor = backwardAnchor ? end : start
  const multiline = field instanceof HTMLTextAreaElement

  const moveTo = (to: number) => {
    if (extend) select(field, Math.min(anchor, to), Math.max(anchor, to), to < anchor)
    else select(field, to, to)
  }

  switch (key) {
    case 'Backspace':
    case 'Delete': {
      const backward = key === 'Backspace'
      if (start !== end) {
        edit(field, start, end, '', backward ? 'deleteContentBackward' : 'deleteContentForward')
        return true
      }
      let from = start
      let to = start
      if (backward) {
        if (line) from = lineStart(value, start)
        else if (word) from = wordBoundary(value, start, true)
        else if (start > 0) from = start - charLength(value, start, true)
      } else {
        if (line) to = lineEnd(value, start)
        else if (word) to = wordBoundary(value, start, false)
        else if (start < value.length) to = start + charLength(value, start, false)
      }
      if (from !== to) {
        const type = backward
          ? word ? 'deleteWordBackward' : line ? 'deleteSoftLineBackward' : 'deleteContentBackward'
          : word ? 'deleteWordForward' : line ? 'deleteSoftLineForward' : 'deleteContentForward'
        edit(field, from, to, '', type)
      }
      return true
    }
    case 'ArrowLeft':
    case 'ArrowRight': {
      const backward = key === 'ArrowLeft'
      if (!extend && start !== end) {
        select(field, backward ? start : end, backward ? start : end)
        return true
      }
      let to: number
      if (line) to = backward ? lineStart(value, caret) : lineEnd(value, caret)
      else if (word) to = wordBoundary(value, caret, backward)
      else if (backward) to = caret > 0 ? caret - charLength(value, caret, true) : 0
      else to = caret < value.length ? caret + charLength(value, caret, false) : value.length
      moveTo(to)
      return true
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      const up = key === 'ArrowUp'
      if (!multiline || line) moveTo(up ? 0 : value.length)
      else moveTo(verticalMove(value, caret, up))
      return true
    }
    case 'Home':
    case 'End': {
      const home = key === 'Home'
      if (!multiline || mods & CTRL) moveTo(home ? 0 : value.length)
      else moveTo(home ? lineStart(value, caret) : lineEnd(value, caret))
      return true
    }
    default:
      return false
  }
}

/** The same keys in a contenteditable, through the browser's own editing commands. */
function editContent(key: string, word: boolean, line: boolean, extend: boolean): boolean {
  const sel = document.getSelection()
  const granularity = line ? 'lineboundary' : word ? 'word' : 'character'
  switch (key) {
    case 'Backspace':
    case 'Delete': {
      const backward = key === 'Backspace'
      if (sel && sel.isCollapsed && granularity !== 'character' && (sel as any).modify) {
        ;(sel as any).modify('extend', backward ? 'backward' : 'forward', granularity)
      }
      document.execCommand(backward ? 'delete' : 'forwardDelete')
      return true
    }
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown':
    case 'Home':
    case 'End': {
      if (!sel || !(sel as any).modify) return true
      const backward = key === 'ArrowLeft' || key === 'ArrowUp' || key === 'Home'
      const unit =
        key === 'Home' || key === 'End' ? 'lineboundary' : key === 'ArrowUp' || key === 'ArrowDown' ? 'line' : granularity
      ;(sel as any).modify(extend ? 'extend' : 'move', backward ? 'backward' : 'forward', unit)
      return true
    }
    default:
      return false
  }
}
