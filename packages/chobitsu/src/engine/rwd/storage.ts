import { MASK, scrub } from '../privacy'
import { rwdError } from './errors'
import { agentText } from './i18n'

// rwd.storage (docs/protocol.md §5.2, §6): localStorage, sessionStorage or the
// cookies scripts can read (not HttpOnly). Values go through the same masking
// as console text; the SDK's own credentials never leave the page.

const ENTRY_LIMIT = 500
const VALUE_LIMIT = 4000
const OWN_SECRETS = /^rwd:(dtoken|resume)$/

export function readStorage(params: any = {}) {
  const area = params.area
  const raw: [string, string][] = []
  if (area === 'local' || area === 'session') {
    let store: Storage
    try {
      store = area === 'local' ? window.localStorage : window.sessionStorage
      for (let i = 0; i < store.length && raw.length < ENTRY_LIMIT; i++) {
        const key = store.key(i)
        if (key !== null) raw.push([key, store.getItem(key) || ''])
      }
    } catch (e) {
      throw rwdError('internal', agentText().storageUnavailable(area))
    }
  } else if (area === 'cookie') {
    const cookie = document.cookie || ''
    for (const part of cookie.split(';')) {
      const at = part.indexOf('=')
      const key = (at < 0 ? '' : part.slice(0, at)).trim()
      const value = at < 0 ? part.trim() : part.slice(at + 1).trim()
      if ((key || value) && raw.length < ENTRY_LIMIT) raw.push([key, value])
    }
  } else {
    throw rwdError('bad_request', agentText().badStorageArea)
  }
  const entries = raw.map(([key, value]) => {
    value = OWN_SECRETS.test(key) ? MASK : scrub(value)
    if (value.length > VALUE_LIMIT) value = value.slice(0, VALUE_LIMIT) + '…'
    return { key, value }
  })
  return { entries }
}
