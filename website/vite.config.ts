import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderNotFound, renderPage } from './src/render.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const SDK = path.resolve(here, '../sdk/dist/sdk.js')
const SDK_MISSING = `
  The page SDK is missing: ${SDK}
  The demo runs the real SDK, so build it first:

      (cd ../sdk && npm ci && npm run build)

  or run \`make website\` from the repository root.
`

/** index.html / zh/index.html / 404.html are stubs: the markup comes from src/render.ts. */
function pages(): Plugin {
  return {
    name: 'rwd-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const m = html.match(/<!--rwd-page:(en|zh|404)-->/)
        if (!m) return html
        return m[1] === '404' ? renderNotFound() : renderPage(m[1] as 'en' | 'zh')
      },
    },
  }
}

/** Ships sdk/dist/sdk.js as /demo-shop/sdk.js (the demo shop loads it like any page would). */
function sdk(): Plugin {
  return {
    name: 'rwd-sdk',
    configureServer(server) {
      server.middlewares.use('/demo-shop/sdk.js.map', (_req, res, next) => {
        if (!fs.existsSync(SDK + '.map')) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(fs.readFileSync(SDK + '.map'))
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
    buildStart() {
      if (this.environment?.mode !== 'dev' && !fs.existsSync(SDK)) this.error(SDK_MISSING)
    },
    generateBundle() {
      if (!fs.existsSync(SDK)) this.error(SDK_MISSING)
      this.emitFile({ type: 'asset', fileName: 'demo-shop/sdk.js', source: fs.readFileSync(SDK) })
      // sdk.js ends with a sourceMappingURL comment; ship the map next to it.
      if (fs.existsSync(SDK + '.map')) this.emitFile({ type: 'asset', fileName: 'demo-shop/sdk.js.map', source: fs.readFileSync(SDK + '.map') })
    },
  }
}

export default defineConfig({
  appType: 'mpa',
  plugins: [pages(), sdk()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        en: path.resolve(here, 'index.html'),
        zh: path.resolve(here, 'zh/index.html'),
        notfound: path.resolve(here, '404.html'),
      },
    },
  },
  server: { port: 5391 },
  preview: { port: 4391 },
})
