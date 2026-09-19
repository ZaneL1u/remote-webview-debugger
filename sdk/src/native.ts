// Imported first by the entry, before the engine installs its console and
// network hooks: our own traffic must never show up in the page's network log
// (ours or another tool's), and a broken hook elsewhere must not break us.

const w = window as any

/** fetch as it was when the SDK loaded (before our hook). */
export const nativeFetch: typeof fetch | undefined =
  typeof w.fetch === 'function' ? w.fetch.bind(w) : undefined

/**
 * The browser's own WebSocket constructor. Hooks replace window.WebSocket
 * with wrappers or subclasses (PageSpy: `class extends WebSocket`), but the
 * prototype chain still leads to the native constructor.
 */
export function nativeWebSocket(): typeof WebSocket {
  let proto = w.WebSocket && w.WebSocket.prototype
  while (proto) {
    const ctor = proto.constructor
    if (typeof ctor === 'function' && /\[native code\]/.test(Function.prototype.toString.call(ctor))) {
      return ctor
    }
    proto = Object.getPrototypeOf(proto)
  }
  return w.WebSocket
}
