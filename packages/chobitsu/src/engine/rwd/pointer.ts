import { computeBox } from '../vendor/playwright/injected/domUtils'
import {
  beginAriaCaches,
  endAriaCaches,
  getAriaDisabled,
} from '../vendor/playwright/injected/roleUtils'
import { elementFromPoint } from '../hitTest'
import { closestComposed } from '../privacy'
import { containsComposed, deepActiveElement, nextFrame, sleep, tagOf, withDomCompat } from './dom'
import { rwdError } from './errors'
import { agentText } from './i18n'
import { refFor } from './snapshot'

// Actionability checks and synthesized pointer input, done inside the page in
// one go (Playwright does the same checks over a dozen CDP round trips).
// Synthesized events are untrusted (isTrusted === false); that is also what
// lets them pass the input lock while the agent is in control.

export interface Point {
  x: number
  y: number
}

export const ACTION_TIMEOUT = 5000
const RETRY_WAITS = [0, 20, 50, 100, 100, 250, 500]

export interface ActionabilityOptions {
  /** Require the point under the element's center to hit it (clicks). */
  hitTest?: boolean
  timeoutMs?: number
}

/**
 * Wait until the element is connected, visible, enabled, stable over two
 * animation frames and in the viewport, and (optionally) receives the
 * pointer at its center. Returns that point in client coordinates.
 */
export async function waitForActionable(
  el: Element,
  options: ActionabilityOptions = {}
): Promise<Point> {
  const deadline = Date.now() + (options.timeoutMs || ACTION_TIMEOUT)
  let reason = ''
  for (let attempt = 0; ; attempt++) {
    if (attempt) {
      if (Date.now() >= deadline) break
      await sleep(RETRY_WAITS[Math.min(attempt, RETRY_WAITS.length - 1)])
    }
    if (!el.isConnected) {
      throw rwdError('not_found', agentText().elementDetached(tagOf(el)))
    }
    reason = withDomCompat(() => checkState(el))
    if (reason) continue

    if (!centerInViewport(el.getBoundingClientRect())) {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior })
    }
    const before = el.getBoundingClientRect()
    await nextFrame()
    if (!el.isConnected) continue
    const rect = el.getBoundingClientRect()
    if (!sameRect(before, rect)) {
      reason = agentText().reasonMoving
      continue
    }
    const points = visiblePoints(rect)
    if (!points.length) {
      reason = agentText().reasonOffscreen
      continue
    }
    if (options.hitTest === false) return points[0]
    // The center first, as a finger would; when something covers it (a
    // popup over a backdrop, a badge over a button), any other exposed spot
    // of the element will do.
    const point = points.find(p => hitsTarget(el, elementFromPoint(p.x, p.y)))
    if (!point) {
      const hit = elementFromPoint(points[0].x, points[0].y)
      reason = agentText().reasonObscured(tagOf(hit), refFor(hit))
      continue
    }
    return point
  }
  throw rwdError('not_interactable', agentText().notActionable(tagOf(el), reason))
}

/**
 * The element a real tap at `p` would be dispatched to: the deepest element
 * under the point (through open shadow roots), as long as it is part of
 * `el`. A ref often names a wrapper whose child holds the listener; events
 * bubble up, never down, so they must start at the hit element.
 */
export function targetAt(el: Element, p: Point): Element {
  let hit: Element | null = elementFromPoint(p.x, p.y)
  while (hit && hit.shadowRoot) {
    const inner = hit.shadowRoot.elementFromPoint(p.x, p.y)
    if (!inner || inner === hit) break
    hit = inner
  }
  return hit && hitsTarget(el, hit) ? hit : el
}

function checkState(el: Element): string {
  if (!computeBox(el).visible) return agentText().reasonHidden
  beginAriaCaches()
  try {
    if (getAriaDisabled(el)) return agentText().reasonDisabled
  } finally {
    endAriaCaches()
  }
  return ''
}

function centerInViewport(r: DOMRect) {
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  return x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight
}

function sameRect(a: DOMRect, b: DOMRect) {
  return (
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  )
}

const SPOTS = [0.5, 0.15, 0.85]

/** The visible center of a box, then other spots on a 3x3 grid inside it. */
function visiblePoints(r: DOMRect): Point[] {
  const left = Math.max(r.left, 0)
  const right = Math.min(r.right, window.innerWidth)
  const top = Math.max(r.top, 0)
  const bottom = Math.min(r.bottom, window.innerHeight)
  if (right <= left || bottom <= top) return []
  const points: Point[] = []
  for (const fy of SPOTS) {
    for (const fx of SPOTS) {
      points.push({ x: left + (right - left) * fx, y: top + (bottom - top) * fy })
    }
  }
  return points
}

function hitsTarget(el: Element, hit: Element) {
  if (containsComposed(el, hit)) return true
  // A styled checkbox: the input sits under its label's custom box.
  const label = closestComposed(hit, 'label') as HTMLLabelElement | null
  if (label && label.control === el) return true
  if (el instanceof HTMLLabelElement && el.control && containsComposed(el.control, hit)) {
    return true
  }
  return false
}

/* ------------------------------- synthesis -------------------------------- */

export const hasTouch =
  navigator.maxTouchPoints > 0 || 'ontouchstart' in window

const BUTTONS: { [name: string]: number } = { left: 0, middle: 1, right: 2 }
const BUTTON_MASKS = [1, 4, 2]

let hovered: Element | null = null

function mouseInit(x: number, y: number, init: MouseEventInit = {}): MouseEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    ...init,
  }
}

function firePointer(type: string, el: Element, x: number, y: number, init: PointerEventInit = {}) {
  if (typeof PointerEvent === 'undefined') return true
  const enterLeave = type === 'pointerenter' || type === 'pointerleave'
  return el.dispatchEvent(
    new PointerEvent(type, {
      ...mouseInit(x, y, init),
      bubbles: !enterLeave,
      cancelable: !enterLeave,
      pointerId: hasTouch ? 2 : 1,
      pointerType: hasTouch ? 'touch' : 'mouse',
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: init.buttons ? 0.5 : 0,
    })
  )
}

function fireMouse(type: string, el: Element, x: number, y: number, init: MouseEventInit = {}) {
  const enterLeave = type === 'mouseenter' || type === 'mouseleave'
  return el.dispatchEvent(
    new MouseEvent(type, {
      ...mouseInit(x, y, init),
      bubbles: !enterLeave,
      cancelable: !enterLeave,
    })
  )
}

let touchId = 1

function fireTouch(type: string, el: Element, x: number, y: number) {
  try {
    const touch = new Touch({
      identifier: touchId,
      target: el,
      clientX: x,
      clientY: y,
      pageX: x + window.scrollX,
      pageY: y + window.scrollY,
      screenX: x,
      screenY: y,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })
    const active = type === 'touchend' || type === 'touchcancel' ? [] : [touch]
    return el.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        touches: active,
        targetTouches: active,
        changedTouches: [touch],
      })
    )
  } catch (e) {
    // No Touch constructor (desktop Safari): pointer and mouse events only.
    return true
  }
}

/** Move the (virtual) pointer onto el: over/enter on change, then move. */
export function moveTo(el: Element, p: Point) {
  if (hovered !== el) {
    const prev = hovered
    if (prev && prev.isConnected) {
      firePointer('pointerout', prev, p.x, p.y, { relatedTarget: el })
      firePointer('pointerleave', prev, p.x, p.y, { relatedTarget: el })
      fireMouse('mouseout', prev, p.x, p.y, { relatedTarget: el })
      fireMouse('mouseleave', prev, p.x, p.y, { relatedTarget: el })
    }
    firePointer('pointerover', el, p.x, p.y, { relatedTarget: prev })
    firePointer('pointerenter', el, p.x, p.y, { relatedTarget: prev })
    fireMouse('mouseover', el, p.x, p.y, { relatedTarget: prev })
    fireMouse('mouseenter', el, p.x, p.y, { relatedTarget: prev })
    hovered = el
  }
  firePointer('pointermove', el, p.x, p.y)
  fireMouse('mousemove', el, p.x, p.y)
}

const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable=false])'

/** What a real mousedown does to focus: focus the target or blur. */
export function focusFor(el: Element) {
  const target = closestComposed(el, FOCUSABLE) as HTMLElement | null
  const active = deepActiveElement() as HTMLElement | null
  if (target) {
    if (active !== target) target.focus({ preventScroll: true })
  } else if (active && active !== document.body && typeof active.blur === 'function') {
    active.blur()
  }
}

export function click(
  el: Element,
  p: Point,
  { button = 'left', clickCount = 1 }: { button?: string; clickCount?: number } = {}
) {
  const b = BUTTONS[button] === undefined ? 0 : BUTTONS[button]
  const down = { button: b, buttons: BUTTON_MASKS[b] }
  const up = { button: b, buttons: 0 }
  const count = Math.max(1, Math.min(3, clickCount | 0 || 1))

  if (hasTouch && b === 0) {
    for (let i = 1; i <= count; i++) {
      touchId++
      firePointer('pointerover', el, p.x, p.y)
      firePointer('pointerenter', el, p.x, p.y)
      firePointer('pointerdown', el, p.x, p.y, down)
      const started = fireTouch('touchstart', el, p.x, p.y)
      firePointer('pointerup', el, p.x, p.y, up)
      const ended = fireTouch('touchend', el, p.x, p.y)
      firePointer('pointerout', el, p.x, p.y)
      firePointer('pointerleave', el, p.x, p.y)
      // A cancelled touch suppresses the compatibility mouse events and the
      // click, as on a real device (FastClick-style libraries click themselves).
      if (!started || !ended) continue
      if (hovered !== el) {
        fireMouse('mouseover', el, p.x, p.y)
        hovered = el
      }
      fireMouse('mousemove', el, p.x, p.y)
      if (fireMouse('mousedown', el, p.x, p.y, { ...down, detail: i })) focusFor(el)
      fireMouse('mouseup', el, p.x, p.y, { ...up, detail: i })
      fireMouse('click', el, p.x, p.y, { ...up, detail: i })
    }
  } else {
    moveTo(el, p)
    for (let i = 1; i <= count; i++) {
      const pointerDown = firePointer('pointerdown', el, p.x, p.y, down)
      // A cancelled pointerdown suppresses mousedown/mouseup, not the click.
      if (pointerDown && fireMouse('mousedown', el, p.x, p.y, { ...down, detail: i })) {
        focusFor(el)
      }
      firePointer('pointerup', el, p.x, p.y, up)
      if (pointerDown) fireMouse('mouseup', el, p.x, p.y, { ...up, detail: i })
      if (b === 0) fireMouse('click', el, p.x, p.y, { ...up, detail: i })
      else if (b === 1) fireMouse('auxclick', el, p.x, p.y, { ...up, detail: i })
    }
    if (b === 2) fireMouse('contextmenu', el, p.x, p.y, { button: 2, buttons: 0 })
  }
  if (count === 2 && b === 0) fireMouse('dblclick', el, p.x, p.y, { detail: 2 })
}

export function hover(el: Element, p: Point) {
  moveTo(el, p)
}

export function wheel(el: Element, p: Point, dx: number, dy: number) {
  try {
    el.dispatchEvent(
      new WheelEvent('wheel', { ...mouseInit(p.x, p.y), deltaX: dx, deltaY: dy, deltaMode: 0 })
    )
  } catch (e) {
    // Old webview without the WheelEvent constructor.
  }
}

export async function drag(from: Element, p1: Point, to: Element, p2: Point) {
  const down = { button: 0, buttons: 1 }
  const up = { button: 0, buttons: 0 }
  touchId++
  moveTo(from, p1)
  firePointer('pointerdown', from, p1.x, p1.y, down)
  fireMouse('mousedown', from, p1.x, p1.y, down)
  if (hasTouch) fireTouch('touchstart', from, p1.x, p1.y)

  const draggable = closestComposed(from, '[draggable=true], a[href], img')
  let dataTransfer: DataTransfer | null = null
  if (draggable && draggable.getAttribute('draggable') !== 'false') {
    try {
      dataTransfer = new DataTransfer()
    } catch (e) {
      dataTransfer = null
    }
  }
  if (dataTransfer && !fireDrag('dragstart', draggable!, p1, dataTransfer)) {
    dataTransfer = null
  }

  const steps = 5
  let over: Element = from
  for (let i = 1; i <= steps; i++) {
    const p = { x: p1.x + ((p2.x - p1.x) * i) / steps, y: p1.y + ((p2.y - p1.y) * i) / steps }
    const under = i === steps ? to : elementFromPoint(p.x, p.y)
    if (dataTransfer) {
      fireDrag('drag', draggable!, p, dataTransfer)
      if (under !== over) fireDrag('dragenter', under, p, dataTransfer)
      fireDrag('dragover', under, p, dataTransfer)
    } else {
      moveTo(under, p)
      firePointer('pointermove', under, p.x, p.y, down)
      fireMouse('mousemove', under, p.x, p.y, down)
      // Touches stay targeted at the element they started on.
      if (hasTouch) fireTouch('touchmove', from, p.x, p.y)
    }
    over = under
    await nextFrame()
  }

  if (dataTransfer) {
    // drop only fires where dragover was cancelled, i.e. on a drop target.
    if (!fireDrag('dragover', to, p2, dataTransfer)) fireDrag('drop', to, p2, dataTransfer)
    fireDrag('dragend', draggable!, p2, dataTransfer)
  } else {
    firePointer('pointerup', to, p2.x, p2.y, up)
    fireMouse('mouseup', to, p2.x, p2.y, up)
    if (hasTouch) fireTouch('touchend', from, p2.x, p2.y)
  }
}

function fireDrag(type: string, el: Element, p: Point, dataTransfer: DataTransfer) {
  try {
    return el.dispatchEvent(
      new DragEvent(type, { ...mouseInit(p.x, p.y), dataTransfer })
    )
  } catch (e) {
    return true
  }
}
