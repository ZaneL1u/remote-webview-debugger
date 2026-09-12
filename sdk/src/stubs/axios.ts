// chobitsu's lib/util.ts imports axios to fetch scripts and stylesheets for
// the DevTools Sources / CSS panels. The SDK never uses those paths; this
// stub keeps ~15 KB of axios out of the bundle.
const unavailable = () => Promise.reject(new Error('axios is not bundled in the RWD SDK'))

export default { get: unavailable }
