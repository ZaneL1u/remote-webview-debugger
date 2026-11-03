import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const pkg = JSON.parse(readFileSync(here('./package.json'), 'utf8'))

// dist/sdk.js: one minified IIFE, global `RemoteWebviewDebugger`, for a
// <script> tag (CDN or the gateway's /v1/sdk.js). `vite build --mode esm` adds
// dist/index.mjs, the same SDK as an ES module for bundlers. The agent engine
// lives next to the vendored chobitsu (packages/chobitsu/src/engine) and is bundled
// from source; its third-party imports resolve to this package's node_modules
// so `npm ci` here is all a build needs.
export default defineConfig(({ mode }) => ({
  define: {
    __RWD_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@chobitsu': here('../packages/chobitsu/src'),
      licia: here('./node_modules/licia'),
      'modern-screenshot': here('./node_modules/modern-screenshot'),
      axios: here('./src/stubs/axios.ts'),
    },
  },
  build: {
    target: 'es2017',
    outDir: 'dist',
    emptyOutDir: mode !== 'esm',
    sourcemap: true,
    reportCompressedSize: true,
    lib: {
      entry: here('./src/index.ts'),
      name: 'RemoteWebviewDebugger',
      formats: mode === 'esm' ? ['es'] : ['iife'],
      fileName: () => (mode === 'esm' ? 'index.mjs' : 'sdk.js'),
    },
    rolldownOptions: {
      // licia is CommonJS, one function per file; unused helpers pulled in by
      // chobitsu's DevTools-only code can go.
      treeshake: {
        moduleSideEffects: (id: string) => !/[\\/]licia[\\/]/.test(id) || /[\\/]licia[\\/]uncaught\.js$/.test(id),
      },
      output: {
        banner: `/*! remote-webview-debugger sdk v${pkg.version} | includes chobitsu (MIT), Playwright (Apache-2.0), licia (MIT), modern-screenshot (MIT) */`,
        // Loaded twice (two script tags)? Keep the first instance: hooks and UI
        // must not be installed again.
        // (An IIFE only: a module can't return early, and a bundler loads it once.)
        intro:
          mode === 'esm'
            ? undefined
            : 'if (typeof window !== "undefined" && window.RemoteWebviewDebugger && window.RemoteWebviewDebugger.version) return window.RemoteWebviewDebugger;',
      },
    },
  },
}))
