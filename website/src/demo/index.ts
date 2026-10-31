// Mounts the interactive demo: phone frame + mock gateway + scripted agent,
// and the play / pause / restart / speed controls.

import { en } from '../i18n/en'
import { zh } from '../i18n/zh'
import { MockGateway } from './gateway'
import { Cancelled, Player } from './player'
import { Ended, runPrelude, runScenario, type ScenarioCtx } from './scenario'
import { SCRIPT_TEXT } from './script-text'
import { Tools } from './tools'
import { Tunnel } from './tunnel'
import { View, type DemoState } from './view'

const PHONE_W = 399
const PHONE_H = 822

export interface DemoDebug {
  phase: string
  runs: number
  done: boolean
  stopped: string | null
  errors: string[]
  calls: number
}

export function mountDemo(root: HTMLElement) {
  const lang = (root.dataset.lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh'
  const d = (lang === 'zh' ? zh : en).demo
  const st = SCRIPT_TEXT[lang]
  const frame = root.querySelector<HTMLIFrameElement>('[data-phone-frame]')!
  const stage = root.querySelector<HTMLElement>('[data-phone-stage]')!
  const playBtn = root.querySelector<HTMLButtonElement>('[data-play]')!
  const restartBtn = root.querySelector<HTMLButtonElement>('[data-restart]')!
  const speedBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-speed]')]
  const startBtn = root.querySelector<HTMLButtonElement>('[data-start]')

  const states: Record<DemoState, string> = {
    idle: d.stateIdle,
    prelude: d.statePrelude,
    running: d.stateRunning,
    paused: d.statePaused,
    waitApproval: d.stateWaitApproval,
    waitControl: d.stateWaitControl,
    done: d.stateDone,
    stopped: d.stateStopped,
  }
  const view = new View(root, { expand: d.expand, collapse: d.collapse, running: d.running, error: d.error, you: d.you, agent: d.agent, customer: d.customer, states })
  const tunnel = new Tunnel(frame)
  const debug: DemoDebug = { phase: 'idle', runs: 0, done: false, stopped: null, errors: [], calls: 0 }
  ;(window as any).__rwdDemo = debug

  let gw: MockGateway | null = null
  let running = false
  let lastState: DemoState = 'idle'
  const player = new Player(() => syncControls())

  /* ------------------------------- phone ------------------------------- */

  const fit = () => {
    const w = stage.clientWidth || PHONE_W
    // Keep the whole demo card on screen on laptops; phones get a readable size.
    const maxH = window.innerWidth < 720 ? 600 : Math.max(540, Math.min(700, window.innerHeight - 250))
    const s = Math.min(1, w / PHONE_W, maxH / PHONE_H)
    stage.style.setProperty('--s', s.toFixed(4))
    stage.style.height = `${Math.round(PHONE_H * s)}px`
  }
  new ResizeObserver(fit).observe(stage)
  window.addEventListener('resize', fit)
  fit()

  const navigateFrame = (url: string) =>
    new Promise<void>(resolve => {
      const done = () => {
        clearTimeout(timer)
        frame.removeEventListener('load', done)
        resolve()
      }
      const timer = setTimeout(done, 4000)
      frame.addEventListener('load', done)
      const w = frame.contentWindow
      if (!frame.getAttribute('src') || !w) frame.src = url
      else {
        try {
          w.location.replace(url)
        } catch {
          frame.src = url
        }
      }
    })

  const clearStorage = () => {
    for (const store of [localStorage, sessionStorage]) {
      try {
        for (const k of Object.keys(store)) if (k.startsWith('rwd:') || k.startsWith('rwd-demo:') || k === 'demo:order') store.removeItem(k)
      } catch {
        // Storage blocked: the SDK copes.
      }
    }
  }

  /** A fresh phone: new gateway, clean SDK state, the shop's front page. */
  const freshPhone = async () => {
    gw?.dispose()
    gw = null
    tunnel.use(null)
    if (frame.getAttribute('src')) await navigateFrame('about:blank')
    clearStorage()
    const g = (gw = new MockGateway(lang))
    tunnel.use(g)
    await navigateFrame(`/demo-shop/${lang}/index.html`)
    await g.waitFor(() => g.foreground(), 5000)
  }
  let phoneReady: Promise<void> = Promise.resolve()

  const pristine = () => {
    if (!gw || gw.disposed) return false
    const f = gw.foreground()
    let order = null
    try {
      order = sessionStorage.getItem('demo:order')
    } catch {
      // Ignore.
    }
    return !!f && f.url.includes('/index.html') && !order && !gw.device?.help && gw.device?.control === 'none' && !gw.timeline.some(e => e.kind === 'navigated' || e.kind === 'agent')
  }

  /* ------------------------------ controls ------------------------------ */

  const syncControls = () => {
    const playing = running && !player.paused
    playBtn.classList.toggle('is-playing', playing)
    const label = playing ? d.pause : d.play
    playBtn.setAttribute('aria-label', label)
    playBtn.title = label
    for (const b of speedBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === player.speed))
    if (running) view.status(player.paused ? 'paused' : lastState === 'paused' ? 'running' : lastState)
  }

  // Remember the scenario's own state so pause / resume can restore it.
  const origStatus = view.status.bind(view)
  view.status = (s: DemoState) => {
    if (s !== 'paused') lastState = s
    debug.phase = s
    origStatus(player.paused && running && s !== 'done' && s !== 'stopped' ? 'paused' : s)
  }

  async function start() {
    const tk = player.begin()
    running = true
    debug.runs++
    debug.done = false
    debug.stopped = null
    debug.calls = 0
    view.clear()
    view.hideStart()
    syncControls()
    await phoneReady
    if (!player.alive(tk)) return
    if (!pristine()) {
      phoneReady = phoneReady.then(freshPhone)
      await phoneReady
    }
    if (!player.alive(tk) || !gw) return
    const tools = new Tools(gw, lang)
    const ctx: ScenarioCtx = {
      lang,
      gw,
      tools,
      view,
      player,
      token: tk,
      frame,
      onProgress: (n, total) => {
        debug.calls = n
        view.progress(n / total)
      },
    }
    try {
      await runPrelude(ctx)
      await runScenario(ctx)
      view.status('done')
      view.hint(st.hintDone)
      view.progress(1)
      debug.done = true
    } catch (e) {
      if (e instanceof Cancelled || !player.alive(tk)) return
      if (e instanceof Ended) {
        debug.stopped = e.why
        view.status('stopped')
        view.hint(st.hintDone)
        try {
          await view.say(e.why === 'ended' ? st.ended : e.why === 'denied' ? st.denied : st.timeout, ms => player.sleep(tk, ms))
        } catch {
          // Cancelled meanwhile.
        }
        if (!player.alive(tk)) return
        gw?.detachAgent()
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        debug.errors.push(msg)
        view.note(`Demo error: ${msg}`, 'warn')
        view.status('stopped')
      }
    } finally {
      if (player.alive(tk)) {
        running = false
        syncControls()
      }
    }
  }

  const restart = () => {
    player.cancel()
    running = false
    phoneReady = phoneReady.then(freshPhone)
    void phoneReady.then(() => start())
  }

  playBtn.addEventListener('click', () => {
    if (!running) {
      if (debug.runs === 0 && pristine()) void start()
      else restart()
      return
    }
    player.setPaused(!player.paused)
  })
  restartBtn.addEventListener('click', restart)
  startBtn?.addEventListener('click', () => void start())
  for (const b of speedBtns) b.addEventListener('click', () => player.setSpeed(Number(b.dataset.speed) || 1))

  // Pause / resume with the space bar while the demo has focus (not inside the phone).
  root.addEventListener('keydown', e => {
    if (e.key === ' ' && e.target === root) {
      e.preventDefault()
      playBtn.click()
    }
  })

  view.status('idle')
  syncControls()
  phoneReady = freshPhone()

  return {
    start: () => {
      if (!running && debug.runs === 0) void start()
    },
  }
}
