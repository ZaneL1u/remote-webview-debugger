// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SDK = path.resolve(here, '../sdk/dist/sdk.js')
// The SDK's language packs (loaded on demand, next to sdk.js: /demo-shop/locales/<id>.js).
const LOCALES_DIR = path.resolve(here, '../sdk/dist/locales')
const SDK_MISSING = `
  The page SDK is missing: ${SDK}
  The demo runs the real SDK, so build it first:

      (cd ../sdk && npm ci && npm run build)

  or run \`make website\` from the repository root.
`

/** Ships sdk/dist/sdk.js as /demo-shop/sdk.js (the demo shop loads it like any page would). */
function sdk() {
  /** @type {import('vite').Plugin} */
  const plugin = {
    name: 'rwd-sdk',
    configureServer(server) {
      server.middlewares.use('/demo-shop/sdk.js.map', (_req, res, next) => {
        if (!fs.existsSync(SDK + '.map')) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(fs.readFileSync(SDK + '.map'))
      })
      server.middlewares.use('/demo-shop/locales', (req, res, next) => {
        const m = /^\/([A-Za-z-]+)\.js(?:\?.*)?$/.exec(req.url || '')
        const file = m && path.join(LOCALES_DIR, `${m[1]}.js`)
        if (!file || !fs.existsSync(file)) return next()
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.end(fs.readFileSync(file))
      })
      server.middlewares.use('/demo-shop/sdk.js', (req, res, next) => {
        if (req.url && req.url !== '/' && !req.url.startsWith('/?')) return next()
        if (!fs.existsSync(SDK)) {
          res.statusCode = 404
          res.end('// ' + SDK_MISSING.trim().replace(/\n/g, '\n// '))
          server.config.logger.warn(SDK_MISSING)
          return
        }
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(fs.readFileSync(SDK))
      })
    },
  }
  return plugin
}

/** @type {import('astro').AstroIntegration} */
const sdkIntegration = {
  name: 'rwd-sdk-copy',
  hooks: {
    'astro:build:start': () => {
      if (!fs.existsSync(SDK)) throw new Error(SDK_MISSING)
    },
    'astro:build:done': ({ dir }) => {
      const out = path.join(fileURLToPath(dir), 'demo-shop')
      fs.mkdirSync(out, { recursive: true })
      fs.copyFileSync(SDK, path.join(out, 'sdk.js'))
      // sdk.js ends with a sourceMappingURL comment; ship the map next to it.
      if (fs.existsSync(SDK + '.map')) fs.copyFileSync(SDK + '.map', path.join(out, 'sdk.js.map'))
      if (fs.existsSync(LOCALES_DIR)) {
        fs.mkdirSync(path.join(out, 'locales'), { recursive: true })
        for (const f of fs.readdirSync(LOCALES_DIR)) if (f.endsWith('.js')) fs.copyFileSync(path.join(LOCALES_DIR, f), path.join(out, 'locales', f))
      }
    },
  },
}

// The languages (see src/i18n/locales.ts; Astro needs them here too for the
// sitemap's hreflang alternates). English is the root, the others live under
// their lower-case path.
const LOCALES = {
  en: 'en',
  zh: 'zh-CN',
  'zh-tw': 'zh-TW',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de',
  'pt-br': 'pt-BR',
  ru: 'ru',
  ar: 'ar',
}

export default defineConfig({
  site: 'https://debugger.site',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'en',
    locales: Object.keys(LOCALES),
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: LOCALES },
      filter: page => !page.includes('/404'),
    }),
    sdkIntegration,
  ],
  vite: {
    plugins: [tailwindcss(), sdk()],
    build: { target: 'es2020' },
  },
  server: { port: 5391 },
})
