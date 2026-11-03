// The guiding hand: when the demo waits for the visitor to tap "Allow" on the
// phone and nobody does, a ring traces the button while the seconds run out,
// a hand taps the button's corner (clear of its label), and at the end the
// demo taps it for them.

import { gsap } from 'gsap'

/** The SDK's dialog button inside the (same-origin) phone frame, through its shadow roots. */
function findInShadow(root: Document | ShadowRoot, selector: string): HTMLElement | null {
  const hit = root.querySelector<HTMLElement>(selector)
  if (hit) return hit
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const h = findInShadow(el.shadowRoot, selector)
      if (h) return h
    }
  }
  return null
}

interface Box {
  x: number
  y: number
  w: number
  h: number
  r: number
}

export class Guide {
  private el: HTMLElement
  private hand: SVGElement
  private fill: SVGRectElement
  private count: HTMLElement
  private follow = 0
  private total = 1
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private frame: HTMLIFrameElement, root: HTMLElement) {
    this.el = root.querySelector<HTMLElement>('[data-guide]')!
    this.hand = this.el.querySelector<SVGElement>('.guide-hand')!
    this.fill = this.el.querySelector<SVGRectElement>('[data-guide-fill]')!
    this.count = this.el.querySelector<HTMLElement>('[data-guide-count]')!
  }

  /** The Allow button, in phone-screen coordinates (the frame sits under the status bar). */
  private target(): Box | null {
    const doc = this.frame.contentDocument
    if (!doc) return null
    const btn = findInShadow(doc, '.scrim .allow')
    if (!btn) return null
    const r = btn.getBoundingClientRect()
    if (!r.width || !r.height) return null
    const radius = parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 12
    return { x: r.left, y: this.frame.offsetTop + r.top, w: r.width, h: r.height, r: radius }
  }

  private place(b: Box) {
    const s = this.el.style
    s.left = `${b.x}px`
    s.top = `${b.y}px`
    s.width = `${b.w}px`
    s.height = `${b.h}px`
    s.setProperty('--r', `${b.r}px`)
    // The ring's geometry as attributes: Safari ignores SVG geometry set in CSS.
    const pad = 5
    for (const rect of this.el.querySelectorAll<SVGRectElement>('.guide-ring rect')) {
      rect.setAttribute('x', '1')
      rect.setAttribute('y', '1')
      rect.setAttribute('width', String(b.w + pad * 2 - 2))
      rect.setAttribute('height', String(b.h + pad * 2 - 2))
      rect.setAttribute('rx', String(b.r + pad - 1))
    }
  }

  /** Point at "Allow" once it is on screen; `seconds` until the demo taps it. Resolves true when found. */
  async show(seconds: number): Promise<boolean> {
    for (let i = 0; i < 40; i++) {
      if (this.target()) break
      await new Promise(r => setTimeout(r, 100))
    }
    const t = this.target()
    if (!t) return false
    this.total = Math.max(1, seconds)
    this.el.classList.remove('pressing')
    this.fill.style.transition = 'none'
    this.fill.style.strokeDashoffset = '100'
    this.count.textContent = ''
    this.place(t)
    void this.fill.getBoundingClientRect()
    this.fill.style.transition = ''
    this.el.classList.add('on')
    // The dialog can move (keyboard, resize, scroll inside the frame): follow it.
    clearInterval(this.follow)
    this.follow = window.setInterval(() => {
      const n = this.target()
      if (n) this.place(n)
    }, 250)
    return true
  }

  /** `left` seconds to go: the ring traces this second's share of the button. */
  countdown(left: number) {
    this.count.textContent = String(left)
    this.fill.style.strokeDashoffset = String((100 * (left - 1)) / this.total)
  }

  /** The hand presses the button: a dip, a burst from the fingertip, a flash of the ring. */
  async press() {
    this.count.textContent = ''
    this.fill.style.strokeDashoffset = '0'
    if (this.reduced) return
    this.el.classList.add('pressing')
    const tips = [...this.el.querySelectorAll<HTMLElement>('.guide-tip i')]
    gsap.set(this.hand, { x: 0, y: 0, rotate: -8, scale: 1, transformOrigin: '15px 4px' })
    await gsap.to(this.hand, { y: 1, scale: 0.86, duration: 0.14, ease: 'power2.in' })
    gsap.fromTo(tips, { scale: 0.4, opacity: 0.95 }, { scale: 4.2, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08 })
    gsap.fromTo(this.fill, { opacity: 1 }, { opacity: 0.35, duration: 0.18, yoyo: true, repeat: 1 })
    await gsap.to(this.hand, { y: 0, scale: 1, duration: 0.24, ease: 'power2.out' })
  }

  hide() {
    clearInterval(this.follow)
    this.el.classList.remove('on')
    gsap.killTweensOf(this.hand)
    gsap.set(this.hand, { clearProps: 'transform' })
    this.el.querySelectorAll<HTMLElement>('.guide-tip i').forEach(i => gsap.set(i, { clearProps: 'all' }))
    window.setTimeout(() => {
      if (!this.el.classList.contains('on')) this.el.classList.remove('pressing')
    }, 400)
  }
}
