// dist/index.d.ts: the public types of src/index.ts in one file, with the
// internal types they mention (Level, Lang, …) inlined.
import { build } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

await build({
  input: { index: 'src/index.ts' },
  plugins: [dts({ emitDtsOnly: true, tsconfig: 'tsconfig.json', compilerOptions: { noEmit: false } })],
  output: { dir: 'dist', format: 'es' },
  logLevel: 'warn',
})
