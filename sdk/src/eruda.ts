import { BRAND, type Ui } from './ui'

// Working together with eruda (docs/protocol.md §10). Off by default: the page
// shows our floating window. Turned on by run({ eruda }) or by the project
// policy (welcome.config.eruda); run() options win field by field.

export interface ErudaOptions {
  /** Show Remote Debugger as a tab inside eruda instead of the floating window. Default true. */
  dock?: boolean
  /** Load eruda when the page has none (the latest release by default) and init it. Default false. */
  load?: boolean
  /** Script URL for `load`. */
  src?: string
  /** Name of the eruda tab. */
  name?: string
}

export interface ErudaRemote {
  dock?: boolean
  load?: boolean
}

interface Resolved {
  dock: boolean
  load: boolean
  src: string
  name: string
}

export const ERUDA_SRC = 'https://cdn.jsdelivr.net/npm/eruda'

export function resolveEruda(local: boolean | ErudaOptions | undefined, remote: ErudaRemote | null | undefined): Resolved {
  const opts: ErudaOptions = local === true ? {} : local && typeof local === 'object' ? local : {}
  const localOn = local === true || (!!local && typeof local === 'object')
  const pick = (key: 'dock' | 'load', localDefault: boolean) => {
    if (typeof opts[key] === 'boolean') return opts[key] as boolean
    if (localOn && key === 'dock') return localDefault
    return !!(remote && remote[key])
  }
  return {
    dock: local === false ? false : pick('dock', true),
    load: local === false ? false : pick('load', false),
    src: typeof opts.src === 'string' && opts.src ? opts.src : ERUDA_SRC,
    name: typeof opts.name === 'string' && opts.name ? opts.name : BRAND,
  }
}

/** Keeps the page in line with the resolved settings; apply() is idempotent. */
export class ErudaBridge {
  private loading = false
  private docked: string | null = null
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(private ui: Ui) {}

  apply(r: Resolved) {
    if (r.load) this.load(r.src)
    if (r.dock) this.dock(r.name)
    else this.undock()
  }

  private load(src: string) {
    const w = window as any
    if (this.loading || w.eruda) return
    this.loading = true
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      try {
        if (w.eruda && !w.eruda._isInit) w.eruda.init()
      } catch (e) {
        // A broken eruda build must not break the page.
      }
    }
    script.onerror = () => {
      this.loading = false
    }
    ;(document.head || document.documentElement).appendChild(script)
  }

  /** Register the tab once eruda is initialized (it may load after us). Gives up after a minute. */
  private dock(name: string) {
    if (this.docked === name || this.timer) return
    if (this.docked) this.undock()
    let tries = 0
    this.timer = setInterval(() => {
      const eruda = (window as any).eruda
      if (++tries > 120) this.stopWaiting()
      if (!eruda || typeof eruda.add !== 'function' || !eruda._isInit) return
      this.stopWaiting()
      const ui = this.ui
      try {
        if (typeof eruda.get === 'function' && eruda.get(name)) return
        eruda.add({
          name,
          init($el: any) {
            this._$el = $el
            const el = $el && typeof $el.get === 'function' ? $el.get(0) : $el && $el[0]
            if (el) ui.dock(el)
          },
          show() {
            if (this._$el) this._$el.show()
            return this
          },
          hide() {
            if (this._$el) this._$el.hide()
            return this
          },
          destroy() {
            ui.undock()
          },
        })
        this.docked = name
      } catch (e) {
        // eruda without tool support: keep the floating window.
      }
    }, 500)
  }

  private undock() {
    this.stopWaiting()
    const name = this.docked
    if (!name) return
    this.docked = null
    try {
      const eruda = (window as any).eruda
      if (eruda && typeof eruda.remove === 'function') eruda.remove(name)
    } catch (e) {
      // Ignore.
    }
    this.ui.undock()
  }

  private stopWaiting() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }
}
