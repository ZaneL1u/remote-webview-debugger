import { cpSync, createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { ensureDevtoolsFrontend } from './scripts/devtools-frontend.mjs'

// The Chrome DevTools frontend lives at /devtools/ (docs/protocol.md §17):
// served from the download cache in dev, copied into dist/devtools on build.
function devtoolsFrontend(): Plugin {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.avif': 'image/avif',
  }
  let outDir = 'dist'
  return {
    name: 'rwd-devtools-frontend',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async configureServer(server) {
      const dir = await ensureDevtoolsFrontend()
      server.middlewares.use('/devtools', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\]|\.\.)+/, '')
        const file = join(dir, rel)
        try {
          if (!file.startsWith(dir) || !statSync(file).isFile()) return next()
        } catch {
          return next()
        }
        res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    async writeBundle() {
      cpSync(await ensureDevtoolsFrontend(), join(outDir, 'devtools'), { recursive: true })
    },
  }
}

// The gateway serves the built console at `/` and the API at `/v1/api`.
// In dev we proxy `/v1` to a local gateway (or the mock server via RWD_GATEWAY).
const gateway = process.env.RWD_GATEWAY ?? 'http://localhost:8080'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), devtoolsFrontend()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/v1': { target: gateway, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        // Split stable vendor code so app deploys don't bust the whole cache.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](@base-ui|@floating-ui|lucide-react|sonner)[\\/]/ },
          ],
        },
      },
    },
  },
})
