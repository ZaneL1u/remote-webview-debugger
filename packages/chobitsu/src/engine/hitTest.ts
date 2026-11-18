// Hit testing for synthesized input. Our own in-page UI (the remote-debugging
// banner, overlays) is marked `__chobitsu-hide__` and is invisible to the
// agent's DOM tree and snapshot, so input must pass through it too. Otherwise
// a click aimed at the page's own bottom bar can land on the banner's "end"
// button and close the session.
//
// Other in-page debug tools float their entry buttons over the page too
// (eruda's gear, PageSpy's logo, vConsole's switch). They are not part of the
// app, so the agent's clicks go through them as well.

export const HIDE_SELECTOR = '.__chobitsu-hide__, #eruda, #__pageSpy, #__vconsole'

export function elementFromPoint(x: number, y: number): Element {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!el.closest(HIDE_SELECTOR)) return el
  }
  return document.documentElement
}

/**
 * The element's box in the coordinates elementFromPoint and real input use.
 * Under an ancestor with CSS `zoom`, WebKit (iOS WebView, Safari) and older
 * Chromium report getBoundingClientRect divided by the zoom, so the box sits
 * left of and above where the element is drawn, the more so the further
 * right: a tap aimed at it lands on a neighbour. Scale it back by the
 * element's effective zoom where the engine does that.
 */
export function clientRect(el: Element): DOMRect {
  const r = el.getBoundingClientRect()
  if (rectsIncludeZoom()) return r
  const z = effectiveZoom(el)
  return z === 1 ? r : new DOMRect(r.x * z, r.y * z, r.width * z, r.height * z)
}

let zoomedRects: boolean | null = null

/** Whether getBoundingClientRect already reports zoomed (drawn) coordinates. */
function rectsIncludeZoom(): boolean {
  if (zoomedRects !== null) return zoomedRects
  const root = document.body || document.documentElement
  const outer = document.createElement('div')
  outer.className = '__chobitsu-hide__'
  outer.style.cssText = 'position:fixed;left:0;top:0;zoom:2;visibility:hidden;pointer-events:none'
  const inner = document.createElement('div')
  inner.style.cssText = 'margin-left:10px;width:10px;height:10px'
  outer.appendChild(inner)
  root.appendChild(outer)
  // 20 when rects are in drawn pixels; 10 when divided by the zoom (or no zoom support,
  // where effectiveZoom is 1 anyway).
  zoomedRects = inner.getBoundingClientRect().left > 15
  outer.remove()
  return zoomedRects
}

function effectiveZoom(el: Element): number {
  let z = 1
  for (let n: Element | null = el; n; n = n.parentElement || ((n.getRootNode() as ShadowRoot).host ?? null)) {
    const v = parseFloat(getComputedStyle(n).zoom)
    if (v > 0 && isFinite(v)) z *= v
  }
  return z
}
