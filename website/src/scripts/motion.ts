// Motion with GSAP: the hero's entrance, scroll reveals, the flow diagram's
// packets, the tool counter and the highlight screens. Everything respects
// prefers-reduced-motion (then things simply show).

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Wrap each word of the title in a span (keeps the <em> gradient intact). */
function splitWords(el: HTMLElement) {
  let last: HTMLElement | null = null
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      // CJK has no spaces: split into runs of 1-3 characters instead.
      const parts = /[぀-ヿ㐀-鿿가-힯]/.test(text) ? text.match(/[぀-ヿ㐀-鿿가-힯]{1,2}|\S+|\s+/g) || [] : text.match(/\S+|\s+/g) || []
      const frag = document.createDocumentFragment()
      for (const p of parts) {
        if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p))
        else if (/^[.,!?:;。！？、…]+$/.test(p) && last) {
          // Punctuation stays glued to the word (or <em>) before it.
          last.appendChild(document.createTextNode(p))
        } else {
          const s = document.createElement('span')
          s.className = 'w'
          s.textContent = p
          frag.appendChild(s)
          last = s
        }
      }
      node.parentNode?.replaceChild(frag, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // The gradient <em> stays one piece: background-clip: text needs its own text.
      if ((node as Element).tagName === 'EM') {
        ;(node as Element).classList.add('w')
        last = node as HTMLElement
      } else [...node.childNodes].forEach(walk)
    }
  }
  ;[...el.childNodes].forEach(walk)
}

export function mountMotion() {
  const reveals = [...document.querySelectorAll<HTMLElement>('.reveal')]
  if (reduced) {
    document.documentElement.classList.add('no-motion')
    reveals.forEach(el => el.classList.add('in'))
    return
  }

  /* ------------------------------- hero ------------------------------- */
  const hero = document.querySelector<HTMLElement>('.hero')
  if (hero) {
    const title = hero.querySelector<HTMLElement>('[data-hero="title"]')
    if (title) splitWords(title)
    const words = title ? [...title.querySelectorAll('.w')] : []
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    const pick = (k: string) => hero.querySelector<HTMLElement>(`[data-hero="${k}"]`)
    const nodes = [...hero.querySelectorAll<HTMLElement>('[data-flow-node]')]
    const flow = hero.querySelector<HTMLElement>('[data-flow]')
    const stats = pick('stats')
    ;[pick('eyebrow'), pick('sub'), pick('cta'), pick('install'), pick('points'), flow, stats, title].forEach(el => el?.classList.add('in'))
    tl.from(pick('eyebrow'), { y: 14, opacity: 0, duration: 0.6 }, 0.05)
      .from(words, { y: 28, opacity: 0, rotateX: -40, duration: 0.8, stagger: 0.045 }, 0.15)
      .from(pick('sub'), { y: 16, opacity: 0, duration: 0.7 }, 0.55)
      .from(pick('cta')?.children || [], { y: 14, opacity: 0, duration: 0.5, stagger: 0.07 }, 0.75)
      .from(pick('install'), { y: 12, opacity: 0, duration: 0.6 }, 0.9)
      .from(pick('points')?.children || [], { opacity: 0, duration: 0.5, stagger: 0.04 }, 1.05)
    if (flow) {
      tl.from(flow, { opacity: 0, scale: 0.96, duration: 0.8 }, 0.3)
        .from(nodes, { y: 18, opacity: 0, duration: 0.6, stagger: 0.14 }, 0.5)
        .from(hero.querySelectorAll('.flow-link'), { opacity: 0, scaleY: 0, transformOrigin: 'top', duration: 0.5, stagger: 0.14 }, 0.62)
    }
    if (stats) {
      tl.from(stats.children, { opacity: 0, y: 10, duration: 0.6, stagger: 0.08 }, 1.1)
      // The figures count up once, from zero.
      stats.querySelectorAll<HTMLElement>('[data-count-to]').forEach((el, i) => {
        const to = Number(el.dataset.countTo) || 0
        const o = { v: 0 }
        el.textContent = '0'
        tl.to(o, { v: to, duration: 1.1, ease: 'power2.out', onUpdate: () => (el.textContent = String(Math.round(o.v))) }, 1.15 + i * 0.08)
      })
    }
    // Packets travelling down the wires, forever.
    hero.querySelectorAll<HTMLElement>('[data-wire]').forEach((wire, wi) => {
      wire.querySelectorAll('i').forEach((p, pi) => {
        gsap.fromTo(p, { top: -16 }, { top: '100%', duration: 1.9, ease: 'sine.inOut', repeat: -1, delay: wi * 0.45 + pi * 0.95 })
      })
    })
    // The phone breathes with the mouse: a touch of parallax on the flow card.
    if (flow && window.matchMedia('(hover: hover)').matches) {
      const qx = gsap.quickTo(flow, 'rotateY', { duration: 0.6, ease: 'power2.out' })
      const qy = gsap.quickTo(flow, 'rotateX', { duration: 0.6, ease: 'power2.out' })
      gsap.set(flow, { transformPerspective: 900, transformStyle: 'preserve-3d' })
      hero.addEventListener('pointermove', e => {
        const r = flow.getBoundingClientRect()
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height
        qx(gsap.utils.clamp(-6, 6, dx * 10))
        qy(gsap.utils.clamp(-6, 6, -dy * 10))
      })
      hero.addEventListener('pointerleave', () => {
        qx(0)
        qy(0)
      })
    }
  }

  /* ------------------------------ reveals ------------------------------ */
  // Siblings that reveal together stagger; everything else fades up on its own.
  const groups = new Map<Element, HTMLElement[]>()
  for (const el of reveals) {
    if (el.closest('.hero')) continue
    const parent = el.parentElement!
    const list = groups.get(parent) || []
    list.push(el)
    groups.set(parent, list)
  }
  for (const [parent, els] of groups) {
    const stagger = els.length > 1 ? 0.09 : 0
    ScrollTrigger.batch(els, {
      start: 'top 92%',
      once: true,
      onEnter: batch => {
        batch.forEach(el => el.classList.add('in'))
        gsap.from(batch, { y: 22, opacity: 0, duration: 0.85, ease: 'power3.out', stagger, overwrite: true, clearProps: 'transform' })
      },
    })
    void parent
  }

  /* --------------------------- the tool counter --------------------------- */
  const count = document.querySelector<HTMLElement>('[data-count]')
  if (count) {
    const n = Number(count.dataset.count) || 0
    ScrollTrigger.create({
      trigger: count,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        const o = { v: 0 }
        gsap.to(o, { v: n, duration: 1.2, ease: 'power2.out', onUpdate: () => (count.textContent = String(Math.round(o.v))) })
      },
    })
  }

  /* --------------------------- highlight screens --------------------------- */
  document.querySelectorAll<HTMLElement>('[data-log-rows]').forEach(screen => {
    const rows = [...screen.querySelectorAll<HTMLElement>('.log-row')]
    gsap.set(rows, { opacity: 0, x: -6 })
    ScrollTrigger.create({
      trigger: screen,
      start: 'top 85%',
      once: true,
      onEnter: () => gsap.to(rows, { opacity: 1, x: 0, duration: 0.4, stagger: 0.22, ease: 'power2.out' }),
    })
  })
  const patch = document.querySelector<HTMLElement>('[data-patch]')
  if (patch) {
    const val = patch.querySelector<HTMLElement>('[data-patch-val]')!
    const code = patch.querySelector<HTMLElement>('.patch-code')!
    const text = code.textContent || ''
    const show = () => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.4 })
      tl.set(patch, { className: 'screen-body patch' })
        .set(val, { textContent: val.dataset.before || '--' })
        .set(code, { textContent: '' })
        .to(code, { duration: 1.1, ease: 'none', onUpdate() {
          code.textContent = text.slice(0, Math.round(this.progress() * text.length))
        } }, 0.6)
        .to(val, { duration: 0.25, opacity: 0, ease: 'power1.in' }, '+=0.3')
        .add(() => {
          val.textContent = val.dataset.after || ''
          patch.classList.add('is-fixed')
        })
        .to(val, { duration: 0.4, opacity: 1, scale: 1.08, ease: 'back.out(2)' })
        .to(val, { duration: 0.3, scale: 1 })
    }
    ScrollTrigger.create({ trigger: patch, start: 'top 85%', once: true, onEnter: show })
  }
}
