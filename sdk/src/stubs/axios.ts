// chobitsu's lib/util.ts imports axios to fetch scripts and stylesheets for
// the DevTools Sources / CSS panels. A small fetch() stand-in keeps ~15 KB of
// axios out of the bundle.
async function get(url: string, opts: { responseType?: string } = {}): Promise<{ data: any }> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return { data: opts.responseType === 'arraybuffer' ? await res.arrayBuffer() : await res.text() }
}

export default { get }
