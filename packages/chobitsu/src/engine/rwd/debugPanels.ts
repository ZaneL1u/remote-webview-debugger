// Debug tools' own panels (eruda, vConsole) open over the page. The agent's
// clicks pass through them (hitTest.ts), but they hide what the user and a
// native screenshot see. The snapshot lists an open one; rwd.closeDebugPanel
// folds it back into its floating button, as the tool's own close would.

export interface OpenPanel {
  name: string
  /** Share of the screen it covers, in percent. */
  coverage: number
}

interface Tool {
  name: string
  panel(): Element | null
  isOpen(panel: Element): boolean
  close(): void
}

const TOOLS: Tool[] = [
  {
    name: 'eruda',
    panel() {
      const host = document.getElementById('eruda')
      const root = (host && host.shadowRoot) || host
      return root ? root.querySelector('.eruda-dev-tools') : null
    },
    isOpen(panel) {
      const e = (window as any).eruda
      const dev = e && e._devTools
      if (dev && typeof dev._isShow === 'boolean') return dev._isShow
      return shown(panel)
    },
    close() {
      ;(window as any).eruda.hide()
    },
  },
  {
    name: 'vConsole',
    panel() {
      const host = document.getElementById('__vconsole')
      return host ? host.querySelector('.vc-panel') : null
    },
    isOpen(panel) {
      return shown(panel)
    },
    close() {
      const v = (window as any).vConsole
      if (v && typeof v.hide === 'function') v.hide()
    },
  },
]

function shown(el: Element) {
  const s = getComputedStyle(el)
  if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function coverage(el: Element) {
  const r = el.getBoundingClientRect()
  const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0))
  const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0))
  return Math.round(((w * h) / (window.innerWidth * window.innerHeight || 1)) * 100)
}

/** Debug tool panels open on screen right now. */
export function openDebugPanels(): OpenPanel[] {
  const open: OpenPanel[] = []
  for (const tool of TOOLS) {
    try {
      const panel = tool.panel()
      if (panel && tool.isOpen(panel)) open.push({ name: tool.name, coverage: coverage(panel) })
    } catch {
      // A tool version we don't know: leave it.
    }
  }
  return open
}

/** Close the open panels; returns the names of the tools closed. */
export function closeDebugPanels(): string[] {
  const closed: string[] = []
  for (const tool of TOOLS) {
    try {
      const panel = tool.panel()
      if (!panel || !tool.isOpen(panel)) continue
      tool.close()
      closed.push(tool.name)
    } catch {
      // Ignore.
    }
  }
  return closed
}
