import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
// Orbitron is used only for small HUD labels (kickers, readouts, the ticker).
import '@fontsource/orbitron/latin-500.css'
import { mountStars, restyleStars } from './stars.ts'
import { mountMotion } from './motion.ts'
import { mountAll as mountLottie } from './lottie.ts'

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

const themeBtn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')
const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark')
themeBtn?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  root.dataset.theme = next
  store('rwd.theme', next)
  restyleStars()
})

mountStars()

/* -------------------------------- language ------------------------------- */

// An explicit choice always wins over the browser language.
document.querySelectorAll<HTMLAnchorElement>('a[data-lang]').forEach(a =>
  a.addEventListener('click', () => {
    store('rwd.lang', a.dataset.lang!)
    if (location.hash) a.href = a.getAttribute('href')!.split('#')[0] + location.hash
  }),
)
const langMenu = document.querySelector<HTMLElement>('[data-lang-menu]')
if (langMenu) {
  const btn = langMenu.querySelector<HTMLButtonElement>('.lang-btn')!
  const menu = langMenu.querySelector<HTMLElement>('.lang-menu')!
  const set = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open))
    menu.hidden = !open
  }
  btn.addEventListener('click', () => set(menu.hidden))
  document.addEventListener('click', e => {
    if (!langMenu.contains(e.target as Node)) set(false)
  })
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) {
      set(false)
      btn.focus()
    }
  })
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll<HTMLAnchorElement>('a')]
    const i = items.indexOf(document.activeElement as HTMLAnchorElement)
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : -1
    if (to >= 0 && to < items.length) {
      e.preventDefault()
      items[to].focus()
    }
  })
}

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
    return JSON.parse(document.querySelector('template[data-i18n]')?.innerHTML || '{}')
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

/* --------------------------------- motion -------------------------------- */

mountMotion()
if (!reduced) mountLottie()

/* ------------------------------- demo modes ------------------------------ */

// One phone, two modes on #demo: "watch" plays the scripted agent against a
// mock gateway, "try" loads the real demo shop and the steps to connect your
// own agent. #demo selects the first, #live the second.
type Mode = 'watch' | 'try'
const demoSection = document.getElementById('demo')
const modeBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-mode-btn]')]
const onMode: ((m: Mode) => void)[] = []
const currentMode = (): Mode => (demoSection?.dataset.mode === 'try' ? 'try' : 'watch')
function setMode(mode: Mode) {
  if (!demoSection) return
  demoSection.dataset.mode = mode
  for (const b of modeBtns) {
    const on = b.dataset.modeBtn === mode
    b.setAttribute('aria-selected', String(on))
    b.tabIndex = on ? 0 : -1
  }
  onMode.forEach(fn => fn(mode))
}
modeBtns.forEach((b, i) => {
  b.addEventListener('click', () => {
    const mode = b.dataset.modeBtn as Mode
    setMode(mode)
    // Keep the address in step, without jumping the page.
    history.replaceState(null, '', mode === 'try' ? '#live' : '#demo')
  })
  b.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = modeBtns[(i + 1) % modeBtns.length]
    next.focus()
    next.click()
  })
})
const fromHash = () => {
  if (location.hash === '#live') setMode('try')
  else if (location.hash === '#demo') setMode('watch')
}
window.addEventListener('hashchange', fromHash)
// Links to #live / #demo pick the mode even when the hash doesn't change.
document.querySelectorAll<HTMLAnchorElement>('a[href="#live"], a[href="#demo"]').forEach(a =>
  a.addEventListener('click', () => setMode(a.getAttribute('href') === '#live' ? 'try' : 'watch')),
)

/* ---------------------------------- demo --------------------------------- */

const demoEl = document.querySelector<HTMLElement>('[data-demo]')
if (demoEl) {
  let demo: { start(): void; suspend(): void; resume(): void } | null = null
  let wantStart = false
  let loading: Promise<void> | null = null
  const load = () =>
    (loading ||= import('../demo/index.ts').then(m => {
      demo = m.mountDemo(demoEl)
      if (currentMode() === 'try') demo.suspend()
    })).then(() => {
      if (wantStart && currentMode() === 'watch') demo?.start()
    })
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
  onMode.push(mode => {
    if (mode === 'try') demo?.suspend()
    else {
      wantStart = true
      void load().then(() => demo?.resume())
    }
  })
}

/* ---------------------------------- live --------------------------------- */

// "Try" mode: the public demo gateway hands each visitor an API key of their
// own (POST /v1/demo/keys), remembered in this browser until the demo starts
// over (resetAt in rwd-demo.json). The real shop runs in the phone and
// reports its device code (examples/platform-demo/rwd-boot.js), which goes
// into the prompt.
const liveEl = document.querySelector<HTMLElement>('[data-live]')
if (liveEl) {
  type Stored = { key: string; issuedAt: number }
  const STORE = 'rwd.demoKey'
  const status = liveEl.querySelector<HTMLElement>('[data-live-status]')
  const text = liveEl.querySelector<HTMLElement>('[data-live-text]')
  const button = liveEl.querySelector<HTMLButtonElement>('[data-live-get]')
  const timeout = () => AbortSignal.timeout?.(10000)
  const show = (state: 'loading' | 'ready' | 'failed' | 'limited') => {
    liveEl.dataset.liveState = state
    if (text) text.textContent = status?.dataset[state] || ''
    if (state === 'ready' && status && !reduced) {
      const dot = status.querySelector<HTMLElement>('.status-dot')
      if (dot && !dot.dataset.lottieMounted) {
        dot.dataset.lottieMounted = '1'
        dot.classList.add('live-key-check')
        void import('./lottie.ts').then(m => m.play(dot, 'check', { loop: false }))
      }
    }
  }
  const fill = (key: string) => {
    liveEl.querySelectorAll('[data-live-key]').forEach(el => (el.textContent = key))
    show('ready')
  }
  const stored = (): Stored | null => {
    try {
      return JSON.parse(localStorage.getItem(STORE) || 'null')
    } catch {
      return null
    }
  }
  let restoring: Promise<void> | null = null
  const restore = () =>
    (restoring ||= fetch(liveEl.dataset.live || '', { cache: 'no-store', signal: timeout() })
      .then(res => (res.ok ? (res.json() as Promise<{ resetAt?: number }>) : null))
      .then(cfg => {
        if (liveEl.dataset.liveState !== 'idle') return
        const s = stored()
        if (s?.key && cfg?.resetAt && s.issuedAt > cfg.resetAt) fill(s.key)
        else if (!cfg) show('failed')
      })
      .catch(() => {
        if (liveEl.dataset.liveState === 'idle') show('failed')
      }))
  button?.addEventListener('click', () => {
    show('loading')
    button.disabled = true
    fetch(liveEl.dataset.liveKeys || '', { method: 'POST', signal: timeout() })
      .then(async res => {
        if (res.status === 429) return show('limited')
        const body = res.ok ? ((await res.json()) as { key?: string; expiresAt?: number }) : null
        if (!body?.key) return show('failed')
        try {
          localStorage.setItem(STORE, JSON.stringify({ key: body.key, issuedAt: (body.expiresAt || Date.now()) - 86400000 }))
        } catch {
          // No storage: the key still works, it just isn't remembered.
        }
        fill(body.key)
      })
      .catch(() => show('failed'))
      .finally(() => (button.disabled = false))
  })

  const frame = liveEl.querySelector<HTMLIFrameElement>('[data-live-frame]')
  const loadingEl = liveEl.querySelector<HTMLElement>('[data-live-loading]')
  const devStatus = [...liveEl.querySelectorAll<HTMLElement>('[data-live-device-status]')]
  const origin = liveEl.dataset.liveOrigin || ''
  let codeShown = false
  const device = (code: string | null) => {
    for (const st of devStatus) {
      const t = st.querySelector<HTMLElement>('[data-live-device-text]')
      st.classList.remove('is-waiting')
      if (code) {
        st.classList.add('is-ready')
        if (t) t.textContent = (st.dataset.readyTpl || '{code}').replace('{code}', code)
      } else if (!codeShown && t) t.textContent = st.dataset.unavailable || ''
    }
    if (!code) return
    codeShown = true
    liveEl.querySelectorAll('[data-live-device]').forEach(el => {
      el.textContent = code
      el.classList.add('is-filled')
    })
    liveEl.querySelectorAll('[data-live-phone-code]').forEach(el => (el.textContent = code))
    liveEl.classList.add('is-online')
  }
  window.addEventListener('message', e => {
    if (e.origin !== origin || !e.data || e.data.rwdDemo !== 'device') return
    const code = String(e.data.deviceCode || '')
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) device(code)
  })
  // The real shop loads only when the visitor picks "try": one shop at a time.
  const loadShop = () => {
    if (!frame || frame.getAttribute('src')) return
    frame.addEventListener('load', () => {
      if (loadingEl) loadingEl.hidden = true
      // No code within a while: the shop may be an older build; say so.
      setTimeout(() => {
        if (!codeShown) device(null)
      }, 15000)
    })
    frame.src = frame.dataset.src || ''
  }
  onMode.push(mode => {
    if (mode !== 'try') return
    void restore()
    loadShop()
  })
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          near.disconnect()
          void restore()
        }
      },
      { rootMargin: '600px 0px' },
    )
    near.observe(liveEl)
  } else {
    void restore()
  }
}

fromHash()
