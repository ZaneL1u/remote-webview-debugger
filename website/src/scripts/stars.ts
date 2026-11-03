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

export function restyleStars() {
  starRgb = getComputedStyle(document.documentElement).getPropertyValue('--star').trim() || starRgb
}

export function mountStars() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
}
