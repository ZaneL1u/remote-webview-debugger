import { elementFromPoint } from '../hitTest'
import { isMasked, MASK, scrub } from '../privacy'

// Layers floating over the page: a popup's backdrop, the popup itself, a
// bottom sheet. A backdrop is an empty <div>, so the aria snapshot has no node
// (and no ref) for it, and the agent cannot click it to close the popup.
// Found by hit testing a few points of the viewport: whatever is on top there
// and sits in a fixed (or viewport-sized absolute) box is a layer.

export interface Overlay {
  element: Element
  kind: 'mask' | 'layer'
  /** Share of the viewport it covers, 0..100. */
  coverage: number
  /** A few words of its text (scrubbed); empty for a mask. */
  text: string
}

const SAMPLES: [number, number][] = [
  [0.5, 0.5],
  [0.25, 0.3],
  [0.75, 0.3],
  [0.25, 0.7],
  [0.75, 0.7],
  [0.5, 0.15],
  [0.5, 0.85],
]
const MIN_COVERAGE = 15 // %: smaller fixed things (floating buttons) are not layers
const FULL_COVERAGE = 80 // %: an absolute box this big acts like a fixed one

/**
 * Layers over the page, topmost first. `contentRefs` are the elements of the
 * snapshot: a fixed box holding most of them is the app's own root, not a
 * layer over it.
 */
export function findOverlays(contentRefs: Element[]): Overlay[] {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!vw || !vh) return []
  const found: Overlay[] = []
  for (const [fx, fy] of SAMPLES) {
    const root = layerOf(elementFromPoint(vw * fx, vh * fy))
    if (!root || found.some(o => o.element === root)) continue
    const coverage = coverageOf(root)
    if (coverage < MIN_COVERAGE) continue
    let inside = 0
    for (const el of contentRefs) if (root.contains(el)) inside++
    if (contentRefs.length >= 4 && inside * 2 >= contentRefs.length) continue
    const text = (root.textContent || '').replace(/\s+/g, ' ').trim()
    const mask = !text && !root.querySelector('img, svg, canvas, video, input, textarea, select, button')
    found.push({
      element: root,
      kind: mask ? 'mask' : 'layer',
      coverage,
      text: mask ? '' : isMasked(root) ? MASK : clip(scrub(text), 30),
    })
  }
  return found
}

/** The positioned box that makes `el` float over the page, if any. */
export function layerOf(el: Element | null): Element | null {
  for (let node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const position = getComputedStyle(node).position
    if (position === 'fixed') return node
    if (position === 'absolute' && coverageOf(node) >= FULL_COVERAGE) return node
  }
  return null
}

function coverageOf(el: Element) {
  const r = el.getBoundingClientRect()
  const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0))
  const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0))
  return Math.round(((w * h) / (window.innerWidth * window.innerHeight)) * 100)
}

function clip(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + '…' : text
}
