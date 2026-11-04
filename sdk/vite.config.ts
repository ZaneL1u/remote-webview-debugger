import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const pkg = JSON.parse(readFileSync(here('./package.json'), 'utf8'))
// Language packs that load on demand (en and zh are bundled); see src/i18n.ts.
const LOCALES = ['zh-TW', 'fr', 'es', 'ru', 'ar', 'ja', 'ko', 'de', 'pt']

// The UI's stylesheets are template literals in src/ui.ts: the JS minifier
// keeps strings as they are, so drop their comments and spacing here.
const UI_CSS = /(const (?:CSS|PANEL_CSS|VARS|CJK_FONTS) = `)([^`]*)(`)/g
const minifyCss = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/;}/g, '}')
const uiCss = {
  name: 'rwd-ui-css',
  transform(code: string, id: string) {
    if (!/[\\/]src[\\/]ui\.ts$/.test(id)) return null
    return { code: code.replace(UI_CSS, (_m, open: string, css: string, close: string) => open + minifyCss(css) + close), map: null }
  },
}

// dist/sdk.js: one minified IIFE, global `RemoteWebviewDebugger`, for a
// <script> tag (CDN or the gateway's /v1/sdk.js). `vite build --mode esm` adds
// dist/index.mjs, the same SDK as an ES module for bundlers, with each
// on-demand language pack as its own entry (dist/locales/<id>.mjs) that
// index.mjs imports dynamically. scripts/locales.mjs adds the packs for the
// <script> build (dist/locales/<id>.js). The agent engine
// lives next to the vendored chobitsu (packages/chobitsu/src/engine) and is bundled
// from source; its third-party imports resolve to this package's node_modules
// so `npm ci` here is all a build needs.
export default defineConfig(({ mode }) => ({
  define: {
    __RWD_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: [
      { find: '@chobitsu', replacement: here('../packages/chobitsu/src') },
      { find: 'rwd:locale-loader', replacement: here(mode === 'esm' ? './src/localeLoader.esm.ts' : './src/localeLoader.ts') },
      { find: /^licia\/uuid$/, replacement: here('./src/stubs/uuid.ts') },
      { find: 'licia', replacement: here('./node_modules/licia') },
      { find: 'modern-screenshot', replacement: here('./node_modules/modern-screenshot') },
      { find: 'axios', replacement: here('./src/stubs/axios.ts') },
      // The full chobitsu (DevTools sessions, docs/protocol.md §13): no
      // polyfills, and screencast frames drawn with modern-screenshot.
      { find: /^core-js\/.*/, replacement: here('./src/stubs/empty.ts') },
      { find: 'html2canvas', replacement: here('./src/stubs/html2canvas.ts') },
      { find: /^luna-dom-highlighter$/, replacement: here('./src/stubs/domHighlighter.ts') },
    ],
  },
  plugins: [
    uiCss,
    {
      // Overlay.ts does require('luna-dom-highlighter/luna-dom-highlighter.css')
      // and expects CSS text; the stand-in highlighter styles itself.
      name: 'rwd-highlighter-css',
      enforce: 'pre',
      resolveId(source) {
        return source.endsWith('luna-dom-highlighter.css') ? '\0rwd-highlighter-css' : null
      },
      load(id) {
        return id === '\0rwd-highlighter-css' ? 'module.exports = ""' : null
      },
    },
  ],
  build: {
    target: 'es2017',
    outDir: 'dist',
    emptyOutDir: mode !== 'esm',
    sourcemap: true,
    reportCompressedSize: true,
    lib: {
      entry:
        mode === 'esm'
          ? Object.fromEntries([['index', here('./src/index.ts')]].concat(LOCALES.map(id => [`locales/${id}`, here(`./src/locales/${id}.ts`)])))
          : here('./src/index.ts'),
      name: 'RemoteWebviewDebugger',
      formats: mode === 'esm' ? ['es'] : ['iife'],
      fileName: (_format, entry) => (mode === 'esm' ? `${entry}.mjs` : 'sdk.js'),
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
