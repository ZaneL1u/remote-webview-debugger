// chobitsu's Overlay domain draws the DevTools element highlight with
// luna-dom-highlighter (~50 KB with its polyfill). This stand-in draws the
// same four boxes (margin, border, padding, content) and a size label.

interface Rgba {
  r: number
  g: number
  b: number
  a?: number
}

interface Config {
  contentColor?: Rgba | string
  paddingColor?: Rgba | string
  borderColor?: Rgba | string
  marginColor?: Rgba | string
  showInfo?: boolean
}

function color(c: Rgba | string | undefined) {
  if (!c || typeof c === 'string') return c || 'transparent'
  return `rgba(${c.r},${c.g},${c.b},${c.a === undefined ? 1 : c.a})`
}

export default class DomHighlighter {
  private el: HTMLDivElement
  private boxes: HTMLDivElement[] = []
  private label: HTMLDivElement
  private node: Node | null = null
  private config: Config = {}
  private onScroll = () => this.draw()

  constructor(container: HTMLElement, private opts: { showInfo?: boolean; monitorResize?: boolean } = {}) {
    this.el = document.createElement('div')
    this.el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none'
    for (let i = 0; i < 4; i++) {
      const box = document.createElement('div')
      box.style.cssText = 'position:fixed;box-sizing:border-box'
      this.boxes.push(box)
      this.el.appendChild(box)
    }
    this.label = document.createElement('div')
    this.label.style.cssText =
      'position:fixed;padding:2px 6px;border-radius:3px;background:#fff;color:#222;font:12px/16px -apple-system,Roboto,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap'
    this.el.appendChild(this.label)
    container.appendChild(this.el)
    window.addEventListener('scroll', this.onScroll, true)
    this.hide()
  }

  highlight(node: Node, config: Config) {
    this.node = node
    this.config = config || {}
    this.draw()
  }

  hide() {
    this.node = null
    this.el.style.display = 'none'
  }

  destroy() {
    window.removeEventListener('scroll', this.onScroll, true)
    this.el.remove()
  }

  private draw() {
    const node = this.node
    if (!node || !node.isConnected) return this.hide()
    let rect: DOMRect
    let el: Element | null = null
    if (node.nodeType === 1) {
      el = node as Element
      rect = el.getBoundingClientRect()
    } else {
      const range = document.createRange()
      range.selectNode(node)
      rect = range.getBoundingClientRect()
    }
    const s = el ? getComputedStyle(el) : null
    const px = (v: string | undefined) => parseFloat(v || '') || 0
    const side = (prefix: string, suffix = '') =>
      ['Top', 'Right', 'Bottom', 'Left'].map(d => (s ? px((s as any)[prefix + d + suffix]) : 0))
    const margin = side('margin')
    const border = side('border', 'Width')
    const padding = side('padding')
    const layers = [
      { inset: margin.map(v => -v), fill: this.config.marginColor },
      { inset: [0, 0, 0, 0], fill: this.config.borderColor },
      { inset: border, fill: this.config.paddingColor },
      { inset: border.map((v, i) => v + padding[i]), fill: this.config.contentColor },
    ]
    layers.forEach((layer, i) => {
      const [t, r, b, l] = layer.inset
      const st = this.boxes[i].style
      st.left = rect.left + l + 'px'
      st.top = rect.top + t + 'px'
      st.width = Math.max(0, rect.width - l - r) + 'px'
      st.height = Math.max(0, rect.height - t - b) + 'px'
      st.background = color(layer.fill)
    })
    const showInfo = this.config.showInfo !== false && this.opts.showInfo !== false && el
    this.label.style.display = showInfo ? 'block' : 'none'
    if (showInfo && el) {
      const id = el.id ? '#' + el.id : ''
      const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''
      this.label.textContent = `${el.tagName.toLowerCase()}${id}${cls}  ${Math.round(rect.width)} × ${Math.round(rect.height)}`
      const below = rect.top < 24
      this.label.style.left = Math.max(0, rect.left) + 'px'
      this.label.style.top = (below ? rect.bottom + 4 : rect.top - 22) + 'px'
    }
    this.el.style.display = 'block'
  }
}
