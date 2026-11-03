import type { LocalePack } from './i18n'

// How the <script> build (dist/sdk.js) loads a built-in language pack that is
// not bundled: dist/locales/<id>.js from next to sdk.js (the CDN or wherever
// the page got it), else from the gateway (<gatewayUrl>/locales/<id>.js). The
// pack registers itself through window.RemoteWebviewDebugger.registerLocale.
// The ES module build swaps this file for localeLoader.esm.ts (vite.config.ts).

const TIMEOUT_MS = 10_000

let base = ''
let nonce = ''
try {
  const script = document.currentScript as HTMLScriptElement | null
  if (script && script.src) base = script.src.replace(/[^/]*([?#].*)?$/, '')
  if (script) nonce = script.nonce || script.getAttribute('nonce') || ''
} catch (e) {
  // Injected by a native host: no script element.
}

function inject(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    let timer: ReturnType<typeof setTimeout>
    const done = (ok: boolean) => {
      clearTimeout(timer)
      s.remove()
      if (ok) resolve()
      else reject(new Error(`failed to load ${url}`))
    }
    timer = setTimeout(() => done(false), TIMEOUT_MS)
    s.onload = () => done(true)
    s.onerror = () => done(false)
    s.async = true
    if (nonce) s.nonce = nonce
    s.src = url
    ;(document.head || document.documentElement).appendChild(s)
  })
}

/** Resolves once the pack's script ran (it registered itself), or rejects. */
export function loadLocale(id: string, gatewayUrl?: string): Promise<LocalePack | null> {
  const urls: string[] = []
  if (base) urls.push(`${base}locales/${id}.js`)
  if (gatewayUrl) {
    const url = `${gatewayUrl.replace(/\/+$/, '')}/locales/${id}.js`
    if (urls.indexOf(url) < 0) urls.push(url)
  }
  let chain: Promise<void> = Promise.reject(new Error(`no URL to load locale ${id} from`))
  for (const url of urls) chain = chain.catch(() => inject(url))
  return chain.then(() => null)
}
