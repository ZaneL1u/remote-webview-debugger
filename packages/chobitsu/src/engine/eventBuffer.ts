import * as objManager from '../lib/objManager'

// Events emitted while no debugger has enabled the domain yet (the page loaded
// target.js but no agent joined, or the agent left). Upstream queued them
// without limit, and every console argument stayed pinned in objManager, so a
// chatty page left open for hours kept growing. Keep only the most recent
// events and release the objects of the ones we drop. Errors and warnings are
// what the agent usually needs, so plain logs are dropped first.

export const BUFFER_LIMIT = 500

interface Pending {
  method: string
  params: any
}

export function createEventBuffer(limit = BUFFER_LIMIT) {
  let items: Pending[] = []
  let dropped = 0

  return {
    push(method: string, params: any) {
      items.push({ method, params })
      if (items.length > limit) {
        let index = items.findIndex(item => !isImportant(item))
        if (index < 0) index = 0
        releaseObjects(items.splice(index, 1)[0].params, 0)
        dropped++
      }
    },
    /** Take everything buffered so far, plus how many events were dropped. */
    drain() {
      const result = { items, dropped }
      items = []
      dropped = 0
      return result
    },
  }
}

function isImportant({ method, params }: Pending) {
  return (
    method === 'Runtime.exceptionThrown' ||
    (method === 'Runtime.consoleAPICalled' &&
      (params.type === 'error' || params.type === 'warning'))
  )
}

function releaseObjects(value: any, depth: number) {
  if (!value || typeof value !== 'object' || depth > 4) return
  if (typeof value.objectId === 'string') {
    try {
      objManager.releaseObj(value.objectId)
    } catch {
      // Already released.
    }
  }
  for (const key in value) {
    releaseObjects(value[key], depth + 1)
  }
}

export function droppedNotice(dropped: number, executionContextId: number) {
  return {
    type: 'warning',
    args: [
      {
        type: 'string',
        value: `[remote-webview] ${dropped} earlier console message(s) were dropped while no debugger was attached (at most ${BUFFER_LIMIT} are kept, errors and warnings first).`,
      },
    ],
    stackTrace: { callFrames: [] },
    executionContextId,
    timestamp: Date.now(),
  }
}
