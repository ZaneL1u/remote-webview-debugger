import { domToCanvas } from 'modern-screenshot'
import Protocol from 'devtools-protocol'
import Page = Protocol.Page
import { HIDE_SELECTOR } from './hitTest'
import { isMasked, maskedElements, MASK } from './privacy'

// Page.captureScreenshot for webviews.
//
// JavaScript inside a page cannot read the pixels the webview actually shows.
// Two sources, best first:
//
// 1. A native capture provided by the host app (real pixels: video, canvas,
//    cross-origin images, native overlays on top of the page all included):
//      window.RWDNativeScreenshot()                    any host, returns
//                                                      string | Promise<string>
//      webkit.messageHandlers.rwdScreenshot            iOS WKWebView with a
//                                                      WKScriptMessageHandlerWithReply
//      window.RWDAndroid.screenshot()                  Android
//                                                      @JavascriptInterface
//    Each returns a PNG/JPEG data URL (or bare base64) of the visible webview.
//
// 2. Re-rendering the DOM through SVG foreignObject (modern-screenshot): the
//    browser lays out a styled clone itself, so CSS, fonts, form values and
//    emoji come out right, at device pixel ratio. Not real pixels: canvas,
//    video and cross-origin images without CORS may be blank.

export type ScreenshotSource = 'native' | 'dom'

/** Source of the most recent capture, for diagnostics. */
export let lastSource: ScreenshotSource | undefined

const MAX_SCALE = 2
// iOS Safari refuses canvases larger than 16,777,216 pixels.
const MAX_CANVAS_PIXELS = 16_000_000

interface Region {
  x: number
  y: number
  width: number
  height: number
}

export interface ScreenshotResult extends Page.CaptureScreenshotResponse {
  source: ScreenshotSource
  /** Image size in pixels. */
  width: number
  height: number
}

export async function captureScreenshot(
  params: Page.CaptureScreenshotRequest
): Promise<ScreenshotResult> {
  const { format = 'png', quality, clip, captureBeyondViewport } = params

  const viewport: Region = {
    x: window.scrollX,
    y: window.scrollY,
    width: window.innerWidth,
    height: window.innerHeight,
  }
  const doc = document.documentElement
  const region: Region = clip
    ? clip
    : captureBeyondViewport
      ? {
          x: 0,
          y: 0,
          width: Math.max(doc.scrollWidth, viewport.width),
          height: Math.max(doc.scrollHeight, viewport.height),
        }
      : viewport

  let canvas: HTMLCanvasElement | undefined
  let source: ScreenshotSource = 'native'
  if (contains(viewport, region)) {
    canvas = await captureNative(viewport, region)
  }
  if (!canvas) {
    canvas = await renderDom(region, clip?.scale)
    source = 'dom'
  }
  lastSource = source

  const mimeType =
    format === 'jpeg'
      ? 'image/jpeg'
      : format === 'webp'
        ? 'image/webp'
        : 'image/png'
  const data = canvas
    .toDataURL(mimeType, quality === undefined ? undefined : quality / 100)
    .replace(/^data:image\/\w+;base64,/, '')

  return { data, source, width: canvas.width, height: canvas.height }
}

function contains(outer: Region, inner: Region) {
  return (
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1
  )
}

function getNativeCapture(): (() => unknown) | undefined {
  const w = window as any
  // The Wdmcp* / wdmcp* names are what early integrations registered.
  const fn = w.RWDNativeScreenshot || w.WdmcpNativeScreenshot
  if (typeof fn === 'function') {
    return () => fn()
  }
  const handlers = w.webkit?.messageHandlers
  const ios = handlers?.rwdScreenshot || handlers?.wdmcpScreenshot
  if (ios && typeof ios.postMessage === 'function') {
    return () => ios.postMessage({ type: 'screenshot' })
  }
  const android = w.RWDAndroid || w.WdmcpAndroid
  if (android && typeof android.screenshot === 'function') {
    return () => android.screenshot()
  }
}

async function captureNative(viewport: Region, region: Region) {
  const capture = getNativeCapture()
  if (!capture) return

  let image: HTMLImageElement
  try {
    const result = await capture()
    if (typeof result !== 'string' || !result) return
    image = await loadImage(
      result.startsWith('data:')
        ? result
        : `data:image/${result.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${result}`
    )
  } catch {
    return
  }

  // The native image covers the visible webview at device pixels.
  const ratio = image.naturalWidth / viewport.width
  const scale = Math.min(ratio, MAX_SCALE)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(region.width * scale))
  canvas.height = Math.max(1, Math.round(region.height * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
      image,
      (region.x - viewport.x) * ratio,
      (region.y - viewport.y) * ratio,
      region.width * ratio,
      region.height * ratio,
      0,
      0,
      canvas.width,
      canvas.height
    )
  // Real pixels cannot be edited like the DOM clone: cover masked elements.
  ctx.fillStyle = '#c7c9cc'
  for (const el of maskedElements()) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    ctx.fillRect(
      (r.left + viewport.x - region.x) * scale,
      (r.top + viewport.y - region.y) * scale,
      r.width * scale,
      r.height * scale
    )
  }
  return canvas
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function renderDom(region: Region, clipScale = 1) {
  let scale = Math.min(window.devicePixelRatio || 1, MAX_SCALE) * clipScale
  const pixels = region.width * region.height * scale * scale
  if (pixels > MAX_CANVAS_PIXELS) {
    scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels)
  }

  // Render a region-sized window onto the document: shift the root by the
  // region offset instead of scrolling. `position: relative` keeps absolutely
  // positioned elements anchored to the shifted root, while fixed elements stay
  // relative to the region, as they do relative to the real viewport.
  return domToCanvas(document.documentElement, {
    width: region.width,
    height: region.height,
    scale,
    backgroundColor: getBackground(),
    style: {
      marginTop: `${-region.y}px`,
      marginLeft: `${-region.x}px`,
      position: 'relative',
    },
    filter: isRendered,
    timeout: 5000,
    onCloneEachNode: stripBackdropFilter,
    onCloneNode: cloned => {
      syncFormState(cloned)
      maskText(cloned)
    },
  })
}

// Our own UI and other debug tools (eruda, PageSpy, vConsole) stay out.
function isRendered(node: Node) {
  return !(node.nodeType === 1 && (node as Element).matches(HIDE_SELECTOR))
}

// Chromium (so Android WebView) stops painting later positive z-index
// elements in a foreignObject once any element has a backdrop-filter: fixed
// bottom bars and toasts vanish. The blur never renders there anyway.
function stripBackdropFilter(cloned: Node) {
  const style = (cloned as HTMLElement).style
  if (!style) return
  style.removeProperty('backdrop-filter')
  style.removeProperty('-webkit-backdrop-filter')
}

// The clone carries attributes, not live state: a radio the user picked, a
// toggled checkbox or a changed <select> would show their initial state.
const FORM_SELECTOR = 'input, option, textarea'

function syncFormState(root: Node) {
  const originals = Array.from(
    document.documentElement.querySelectorAll(FORM_SELECTOR)
  ).filter(el => !el.closest(HIDE_SELECTOR))
  const clones = (root as Element).querySelectorAll(FORM_SELECTOR)
  if (originals.length !== clones.length) return

  originals.forEach((el, i) => {
    const clone = clones[i]
    const masked = isMasked(el)
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        toggleAttribute(clone, 'checked', el.checked)
      } else if (el.type !== 'file') {
        clone.setAttribute('value', masked && el.value ? MASK : el.value)
        // Dots of a password field would still tell its length.
        if (masked && el.type === 'password') clone.setAttribute('type', 'text')
      }
    } else if (el instanceof HTMLOptionElement) {
      toggleAttribute(clone, 'selected', el.selected)
      if (masked) clone.textContent = MASK
    } else if (el instanceof HTMLTextAreaElement) {
      clone.textContent = masked && el.value ? MASK : el.value
    }
  })
}

// Text of elements marked data-rwd-mask (form fields are handled above).
function maskText(root: Node) {
  const selector = '[data-rwd-mask]'
  const originals = Array.from(
    document.documentElement.querySelectorAll(selector)
  ).filter(el => !el.closest(HIDE_SELECTOR))
  const clones = (root as Element).querySelectorAll(selector)
  if (originals.length !== clones.length) return
  originals.forEach((el, i) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
    if ((el.textContent || '').trim()) clones[i].textContent = MASK
  })
}

function toggleAttribute(el: Element, name: string, on: boolean) {
  if (on) el.setAttribute(name, '')
  else el.removeAttribute(name)
}

function getBackground() {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue
    const color = getComputedStyle(el).backgroundColor
    if (color && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color)) {
      return color
    }
  }
  return '#fff'
}
