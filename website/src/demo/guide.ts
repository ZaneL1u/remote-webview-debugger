// The guiding hand: when the demo waits for the visitor to tap "Allow" on
// the phone and nobody does, a hand (with a Lottie tap ripple) points at the
// button, counts down, and finally "taps" it for them.

import { gsap } from 'gsap'
import { play } from '../scripts/lottie.ts'
import type { AnimationItem } from 'lottie-web'

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

export class Guide {
  private el: HTMLElement
  private hand: HTMLElement
  private count: HTMLElement
  private tapEl: HTMLElement
  private tap: AnimationItem | null = null
  private bob: gsap.core.Tween | null = null
  private follow = 0
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private frame: HTMLIFrameElement, root: HTMLElement) {
    this.el = root.querySelector<HTMLElement>('[data-guide]')!
    this.hand = this.el.querySelector<HTMLElement>('.guide-hand')!
    this.count = this.el.querySelector<HTMLElement>('[data-guide-count]')!
    this.tapEl = this.el.querySelector<HTMLElement>('[data-lottie="tap"]')!
  }

  private target(): { x: number; y: number } | null {
    const doc = this.frame.contentDocument
    if (!doc) return null
    const btn = findInShadow(doc, '.scrim .allow')
    if (!btn) return null
    const r = btn.getBoundingClientRect()
    if (!r.width || !r.height) return null
    // The frame sits under the status bar inside .phone-screen; the guide shares that box.
    return { x: r.left + r.width / 2, y: this.frame.offsetTop + r.top + r.height / 2 }
  }

  /** Point at "Allow" (once it is on screen). Resolves true when the button was found. */
  async show(): Promise<boolean> {
    for (let i = 0; i < 40; i++) {
      if (this.target()) break
      await new Promise(r => setTimeout(r, 100))
    }
    const t = this.target()
    if (!t) return false
    this.place(t)
    this.el.classList.add('on')
    if (!this.reduced) {
      if (!this.tap) this.tap = await play(this.tapEl, 'tap', { loop: true })
      else this.tap.play()
      this.bob?.kill()
      gsap.set(this.hand, { x: 10, y: 14, rotate: -8, scale: 1 })
      this.bob = gsap.to(this.hand, { y: 6, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1 })
    }
    // The dialog can move (keyboard, resize): keep following it.
    clearInterval(this.follow)
    this.follow = window.setInterval(() => {
      const n = this.target()
      if (n) this.place(n)
    }, 250)
    return true
  }

  private place(t: { x: number; y: number }) {
    this.el.style.left = `${t.x}px`
    this.el.style.top = `${t.y}px`
  }

  countdown(seconds: number) {
    this.count.textContent = `${seconds}s`
  }

  /** The hand presses the button: a quick dip, then the ripple. */
  async press() {
    if (this.reduced) return
    this.bob?.kill()
    await gsap.to(this.hand, { y: 2, scale: 0.86, duration: 0.14, ease: 'power2.in' })
    await gsap.to(this.hand, { y: 10, scale: 1, duration: 0.22, ease: 'power2.out' })
  }

  hide() {
    clearInterval(this.follow)
    this.el.classList.remove('on')
    this.bob?.kill()
    this.tap?.stop()
  }
}
