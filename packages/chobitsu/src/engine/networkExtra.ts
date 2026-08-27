import { createId } from '../lib/util'
import { fullUrl } from '../lib/request'

// Requests the upstream Network domain does not see: navigator.sendBeacon
// (analytics, "page closed" reports) and EventSource streams. Both hooks keep
// the original behaviour and stay subclass-safe, like the WebSocket hook.

type Trigger = (method: string, params: any) => void

const now = () => Date.now() / 1000

export function enableBeacon(trigger: Trigger) {
  const nav = navigator as any
  const origSendBeacon = nav.sendBeacon
  if (typeof origSendBeacon !== 'function') return

  nav.sendBeacon = function (url: string, data?: any) {
    const queued = origSendBeacon.apply(this, arguments)
    try {
      const requestId = createId()
      const request: any = { method: 'POST', url: fullUrl(String(url)), headers: {} }
      if (typeof data === 'string') request.postData = data
      trigger('Network.requestWillBeSent', {
        requestId,
        type: 'Ping',
        request,
        timestamp: now(),
      })
      if (queued) {
        // The response of a beacon is never exposed to the page.
        trigger('Network.loadingFinished', {
          requestId,
          encodedDataLength: typeof data === 'string' ? data.length : 0,
          timestamp: now(),
        })
      } else {
        trigger('Network.loadingFailed', {
          requestId,
          errorText: 'sendBeacon was refused by the browser',
          timestamp: now(),
          type: 'Ping',
        })
      }
    } catch (e) {
      // Never break the page's beacon because of our bookkeeping.
    }
    return queued
  }
}

export function enableEventSource(trigger: Trigger) {
  const OrigEventSource = (window as any).EventSource
  if (typeof OrigEventSource !== 'function') return

  function EventSource(this: any, url: string, init?: any) {
    const es = Reflect.construct(
      OrigEventSource,
      init === undefined ? [url] : [url, init],
      new.target || OrigEventSource
    )
    try {
      const requestId = createId()
      trigger('Network.requestWillBeSent', {
        requestId,
        type: 'EventSource',
        request: { method: 'GET', url: fullUrl(String(url)), headers: {} },
        timestamp: now(),
      })
      let opened = false
      es.addEventListener('open', function () {
        if (opened) return
        opened = true
        trigger('Network.responseReceived', {
          requestId,
          type: 'EventSource',
          response: { status: 200, headers: {} },
          timestamp: now(),
        })
      })
      es.addEventListener('error', function () {
        // EventSource reconnects by itself unless the stream is closed for good.
        if (es.readyState !== OrigEventSource.CLOSED) return
        trigger('Network.loadingFailed', {
          requestId,
          errorText: opened ? 'EventSource closed' : 'EventSource failed',
          timestamp: now(),
          type: 'EventSource',
        })
      })
    } catch (e) {
      // Bookkeeping only.
    }
    return es
  }
  EventSource.prototype = OrigEventSource.prototype
  ;(EventSource as any).CONNECTING = OrigEventSource.CONNECTING
  ;(EventSource as any).OPEN = OrigEventSource.OPEN
  ;(EventSource as any).CLOSED = OrigEventSource.CLOSED
  ;(window as any).EventSource = EventSource
}
