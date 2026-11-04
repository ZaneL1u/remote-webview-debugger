// chobitsu's Page domain renders DevTools screencast frames with html2canvas;
// the SDK already bundles modern-screenshot, so draw with that instead.
import { domToCanvas } from 'modern-screenshot'

export interface Options {
  scale?: number
  width?: number
  height?: number
  ignoreElements?: (node: Element) => boolean
  [key: string]: unknown
}

export default function html2canvas(el: HTMLElement, opts: Options = {}): Promise<HTMLCanvasElement> {
  const ignore = opts.ignoreElements
  return domToCanvas(el, {
    scale: opts.scale || 1,
    width: opts.width,
    height: opts.height,
    filter: node => !(ignore && node instanceof Element && ignore(node)),
  })
}
