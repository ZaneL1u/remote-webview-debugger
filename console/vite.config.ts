import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The gateway serves the built console at `/` and the API at `/v1/api`.
// In dev we proxy `/v1` to a local gateway (or the mock server via RWD_GATEWAY).
const gateway = process.env.RWD_GATEWAY ?? 'http://localhost:8080'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
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
