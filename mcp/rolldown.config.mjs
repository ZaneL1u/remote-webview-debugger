// One file, no runtime dependencies: `npx -y remote-webview-debugger-mcp`
// starts without installing a dependency tree.
import fs from 'node:fs'
import { defineConfig } from 'rolldown'

const { version } = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  input: 'src/cli.ts',
  platform: 'node',
  transform: { define: { __VERSION__: JSON.stringify(version) } },
  output: { file: 'dist/cli.mjs', format: 'esm', minify: true, comments: { legal: false } },
})
