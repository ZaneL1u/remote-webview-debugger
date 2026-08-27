// Response bodies kept for Network.getResponseBody. Upstream stored every
// response body forever (`resTxtMap`), so a long-lived page polling an API grew
// without bound. Keep the most recent bodies only: each truncated to
// ENTRY_LIMIT characters, at most TOTAL_LIMIT characters in all, oldest evicted
// first.

export const BODY_TOTAL_LIMIT = 5 * 1024 * 1024
export const BODY_ENTRY_LIMIT = 64 * 1024

export function createBodyCache(
  totalLimit = BODY_TOTAL_LIMIT,
  entryLimit = BODY_ENTRY_LIMIT
) {
  const bodies = new Map<string, string>()
  let total = 0

  function remove(id: string) {
    const body = bodies.get(id)
    if (body === undefined) return
    total -= body.length
    bodies.delete(id)
  }

  return {
    set(id: string, body: unknown) {
      remove(id)
      let text = typeof body === 'string' ? body : ''
      if (text.length > entryLimit) {
        text =
          text.slice(0, entryLimit) +
          `\n…[truncated, ${text.length} characters in total]`
      }
      bodies.set(id, text)
      total += text.length
      while (total > totalLimit && bodies.size > 1) {
        remove(bodies.keys().next().value as string)
      }
    },
    // Typed loosely like the Map it replaces: undefined for unknown ids.
    get(id: string): any {
      return bodies.get(id)
    },
    has(id: string) {
      return bodies.has(id)
    },
  }
}
