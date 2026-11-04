// chobitsu's sendMessage() only needs ids that are unique in this page.
// licia's uuid pulls in randomBytes, whose eval('require') (for Node) would
// keep the minifier from renaming anything in the bundle.
let n = 0

export default function uuid(): string {
  return `rwd-${Date.now().toString(36)}-${(++n).toString(36)}`
}
