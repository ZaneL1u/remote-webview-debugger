// Input lock while the agent is in control (docs/platform.md A3): besides the
// full-screen overlay, capture-phase listeners on window swallow every trusted
// (real user) pointer, touch, mouse, keyboard and wheel event before the page
// sees it. The agent's synthesized events are untrusted and pass. Events on
// our own controls (take over / end) pass too.
//
// Installed once, as early as possible, so we run before the page's own
// window capture listeners.

const TYPES = [
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointerover',
  'pointerout',
  'pointerenter',
  'pointerleave',
  'pointercancel',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'wheel',
  'keydown',
  'keypress',
  'keyup',
  'beforeinput',
  'dragstart',
  'drop',
  'selectstart',
  'gesturestart',
  'gesturechange',
  'gestureend',
]

export function createLock(isOwnControl: (e: Event) => boolean) {
  let locked = false

  const block = (e: Event) => {
    if (!locked || !e.isTrusted || isOwnControl(e)) return
    if (e.cancelable) e.preventDefault()
    e.stopImmediatePropagation()
  }

  for (const type of TYPES) {
    // passive: false, or Chrome ignores preventDefault on window touch/wheel.
    window.addEventListener(type, block, { capture: true, passive: false })
  }

  return {
    set(on: boolean) {
      if (on && !locked) {
        // Close the virtual keyboard: typing would be swallowed anyway.
        const active = document.activeElement as HTMLElement | null
        if (active && active !== document.body && typeof active.blur === 'function') active.blur()
      }
      locked = on
    },
    get locked() {
      return locked
    },
  }
}
