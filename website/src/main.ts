import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
// Orbitron is used only for small HUD labels (kickers, readouts, the ticker).
import '@fontsource/orbitron/latin-500.css'
import './styles/main.css'

const root = document.documentElement
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value)
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/* --------------------------------- theme -------------------------------- */

// Deep space is the site's own theme; the ice-lab light theme is a deliberate
// choice, remembered in localStorage.
const themeBtn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')
const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark')
themeBtn?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  root.dataset.theme = next
  store('rwd.theme', next)
  restyleStars()
})

/* ------------------------------- star field ------------------------------ */

// A thin layer of drifting, breathing dust behind everything. Capped particle
// count, transform-free (one clearRect + fillRect per star), paused while the
// tab is hidden, and completely still under prefers-reduced-motion.
interface Star {
  x: number
  y: number
  r: number
  a: number
  tw: number
  ph: number
  vx: number
  vy: number
}

let starRgb = '190, 214, 255'

function restyleStars() {
  starRgb = getComputedStyle(root).getPropertyValue('--star').trim() || starRgb
}

;(() => {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-stars]')
  const ctx = canvas?.getContext('2d', { alpha: true })
  if (!canvas || !ctx) return
  restyleStars()

  let stars: Star[] = []
  let w = 0
  let h = 0
  let frame = 0
  let last = 0

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // One star per ~16k px², between 40 and 130 of them.
    const n = Math.max(40, Math.min(130, Math.round((w * h) / 16000)))
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.4 + Math.random() * Math.random() * 1.5,
      a: 0.2 + Math.random() * 0.6,
      tw: 0.4 + Math.random() * 1.1,
      ph: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 2.4,
      vy: -2 - Math.random() * 4,
    }))
  }

  const draw = (t: number) => {
    ctx.clearRect(0, 0, w, h)
    for (const s of stars) {
      const a = reduced ? s.a : s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph))
      ctx.fillStyle = `rgba(${starRgb}, ${a.toFixed(3)})`
      if (s.r > 1) {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2)
      }
    }
  }

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    for (const s of stars) {
      s.x += s.vx * dt
      s.y += s.vy * dt
      if (s.y < -2) {
        s.y = h + 2
        s.x = Math.random() * w
      }
      if (s.x < -2) s.x = w + 2
      else if (s.x > w + 2) s.x = -2
    }
    draw(now / 1000)
  }

  const stop = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }
  const play = () => {
    if (frame || reduced || document.hidden) return
    last = performance.now()
    frame = requestAnimationFrame(tick)
  }

  size()
  draw(0)
  play()
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()))
  let resizeTimer = 0
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        size()
        draw(performance.now() / 1000)
      }, 180)
    },
    { passive: true },
  )
})()

/* -------------------------------- language ------------------------------- */

// An explicit choice always wins over the browser language.
document.querySelectorAll<HTMLAnchorElement>('[data-lang]').forEach(a =>
  a.addEventListener('click', () => {
    store('rwd.lang', a.dataset.lang!)
    // Keep the reader's place.
    if (location.hash) a.href = a.getAttribute('href')!.split('#')[0] + location.hash
  }),
)

/* --------------------------------- header -------------------------------- */

const header = document.querySelector<HTMLElement>('[data-header]')
const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 8)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]')
const mobileNav = document.getElementById('mobile-nav')
const setMenu = (open: boolean) => {
  if (!menuBtn || !mobileNav) return
  menuBtn.setAttribute('aria-expanded', String(open))
  mobileNav.hidden = !open
  header?.classList.toggle('menu-open', open)
}
menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'))
mobileNav?.addEventListener('click', e => {
  if ((e.target as Element).closest('a')) setMenu(false)
})
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menuBtn?.getAttribute('aria-expanded') === 'true') {
    setMenu(false)
    menuBtn.focus()
  }
})

/* ---------------------------------- tabs --------------------------------- */

document.querySelectorAll<HTMLElement>('[data-tabs]').forEach(box => {
  const tabs = [...box.querySelectorAll<HTMLButtonElement>('[role=tab]')]
  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const t of tabs) {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      const panel = document.getElementById(t.getAttribute('aria-controls')!)
      if (panel) panel.hidden = !on
    }
    if (focus) tab.focus()
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', e => {
      const n = tabs.length
      const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
      if (to >= 0) {
        e.preventDefault()
        select(tabs[to], true)
      }
    })
  })
})

/* ---------------------------------- copy --------------------------------- */

const i18n = (() => {
  try {
    const raw = document.querySelector('template[data-i18n]')?.innerHTML || '{}'
    return JSON.parse(raw.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
  } catch {
    return {}
  }
})() as { copy?: string; copied?: string }

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(btn => {
  const label = btn.querySelector<HTMLElement>('[data-copy-label]')
  if (label) label.textContent = i18n.copy || 'Copy'
  btn.setAttribute('aria-label', i18n.copy || 'Copy')
  btn.addEventListener('click', async () => {
    const code = btn.closest('.code')?.querySelector('code')?.textContent || ''
    try {
      await navigator.clipboard.writeText(code)
      btn.classList.add('done')
      if (label) label.textContent = i18n.copied || 'Copied'
      setTimeout(() => {
        btn.classList.remove('done')
        if (label) label.textContent = i18n.copy || 'Copy'
      }, 1600)
    } catch {
      // Clipboard blocked: the text is selectable anyway.
    }
  })
})

/* --------------------------------- reveal -------------------------------- */

if (!reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  )
  document.querySelectorAll('.reveal').forEach(el => io.observe(el))
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'))
}

/* ---------------------------------- demo --------------------------------- */

const demoEl = document.querySelector<HTMLElement>('[data-demo]')
if (demoEl) {
  let demo: { start(): void } | null = null
  let wantStart = false
  let loading: Promise<void> | null = null
  const load = () =>
    (loading ||= import('./demo/index').then(m => {
      demo = m.mountDemo(demoEl)
    })).then(() => {
      if (wantStart) demo?.start()
    })
  // Load the phone when the demo comes near; start playing once it is in view.
  const near = new IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) {
        near.disconnect()
        void load()
      }
    },
    { rootMargin: '600px 0px' },
  )
  near.observe(demoEl)
  if (!reduced) {
    const seen = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting && e.intersectionRatio >= 0.3)) {
          seen.disconnect()
          wantStart = true
          void load()
        }
      },
      { threshold: [0, 0.3, 0.6] },
    )
    seen.observe(demoEl)
  }
  // "Try the live demo" starts it right away.
  document.querySelectorAll<HTMLAnchorElement>('a[href="#demo"]').forEach(a =>
    a.addEventListener('click', () => {
      wantStart = true
      void load()
    }),
  )
}
