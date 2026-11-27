// WebSocket shim for the website demo. Loaded before sdk.js inside the demo
// iframe: the SDK's gateway connection is tunnelled to the parent page with
// postMessage, where an in-browser mock gateway answers. Nothing goes over
// the network.
//
// The SDK deliberately looks for the browser's native WebSocket constructor
// (walking the prototype chain for a `[native code]` function, so hooks from
// other tools don't see its traffic). A bound function stringifies as native
// code, so the shim exposes one and wires it in as the prototype's
// constructor: the SDK then picks the shim, as it would pick the browser's.
(function () {
  'use strict'
  if (window.__rwdShim) return
  window.__rwdShim = true

  var framed = window.parent && window.parent !== window
  var target = framed ? window.parent : null
  var origin = location.origin
  var sockets = {}
  var seq = 0

  function post(msg) {
    if (!target) return
    msg.__rwd = 'ws'
    try {
      target.postMessage(msg, origin)
    } catch (e) {
      // Parent gone.
    }
  }

  function makeEvent(type, init) {
    try {
      if (type === 'message') return new MessageEvent('message', init)
      if (type === 'close') return new CloseEvent('close', init)
    } catch (e) {
      // Old engines: fall through.
    }
    var ev = new Event(type)
    for (var k in init) if (Object.prototype.hasOwnProperty.call(init, k)) ev[k] = init[k]
    return ev
  }

  function TunnelSocket(url, protocols) {
    var self = this
    this.url = String(url)
    this.protocol = ''
    this.extensions = ''
    this.binaryType = 'blob'
    this.bufferedAmount = 0
    this.readyState = 0
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this._listeners = {}
    this._id = 'ws' + ++seq + '-' + Math.random().toString(36).slice(2, 8)
    sockets[this._id] = this
    void protocols
    if (!target) {
      // Not inside the website: there is no gateway to talk to.
      setTimeout(function () {
        self._finish(1006, 'no gateway', false)
      }, 0)
      return
    }
    // The parent acknowledges right away; give up if it doesn't.
    this._openTimer = setTimeout(function () {
      if (self.readyState === 0) self._finish(1006, 'tunnel timeout', false)
    }, 4000)
    post({ op: 'open', cid: this._id, url: this.url })
  }

  TunnelSocket.CONNECTING = 0
  TunnelSocket.OPEN = 1
  TunnelSocket.CLOSING = 2
  TunnelSocket.CLOSED = 3

  var proto = TunnelSocket.prototype
  proto.CONNECTING = 0
  proto.OPEN = 1
  proto.CLOSING = 2
  proto.CLOSED = 3

  proto.addEventListener = function (type, fn) {
    if (typeof fn !== 'function') return
    ;(this._listeners[type] = this._listeners[type] || []).push(fn)
  }
  proto.removeEventListener = function (type, fn) {
    var list = this._listeners[type]
    if (!list) return
    var i = list.indexOf(fn)
    if (i >= 0) list.splice(i, 1)
  }
  proto.dispatchEvent = function (ev) {
    var handler = this['on' + ev.type]
    try {
      if (typeof handler === 'function') handler.call(this, ev)
    } catch (e) {
      setTimeout(function () {
        throw e
      })
    }
    var list = (this._listeners[ev.type] || []).slice()
    for (var i = 0; i < list.length; i++) {
      try {
        list[i].call(this, ev)
      } catch (e2) {
        setTimeout(function () {
          throw e2
        })
      }
    }
    return true
  }
  proto.send = function (data) {
    if (this.readyState === 0) throw new DOMException('WebSocket is still in CONNECTING state.', 'InvalidStateError')
    if (this.readyState !== 1) return
    post({ op: 'send', cid: this._id, data: String(data) })
  }
  proto.close = function (code, reason) {
    if (this.readyState >= 2) return
    post({ op: 'close', cid: this._id, code: code || 1000, reason: reason || '' })
    this.readyState = 2
    var self = this
    setTimeout(function () {
      self._finish(code || 1000, reason || '', true)
    }, 0)
  }
  proto._open = function () {
    if (this.readyState !== 0) return
    clearTimeout(this._openTimer)
    this.readyState = 1
    this.dispatchEvent(new Event('open'))
  }
  proto._finish = function (code, reason, clean) {
    if (this.readyState === 3) return
    clearTimeout(this._openTimer)
    var wasOpen = this.readyState === 1
    this.readyState = 3
    delete sockets[this._id]
    if (!clean && !wasOpen) this.dispatchEvent(new Event('error'))
    this.dispatchEvent(makeEvent('close', { code: code, reason: reason, wasClean: !!clean }))
  }

  window.addEventListener('message', function (event) {
    if (event.source !== target || event.origin !== origin) return
    var msg = event.data
    if (!msg || msg.__rwd !== 'ws') return
    var ws = sockets[msg.cid]
    if (!ws) return
    if (msg.op === 'open') ws._open()
    else if (msg.op === 'message' && ws.readyState === 1) ws.dispatchEvent(makeEvent('message', { data: msg.data, origin: origin }))
    else if (msg.op === 'close') ws._finish(msg.code || 1000, msg.reason || '', true)
  })

  // The document goes away (navigation, reload): tell the gateway, as a
  // dropped TCP connection would.
  window.addEventListener('pagehide', function () {
    for (var id in sockets) {
      if (Object.prototype.hasOwnProperty.call(sockets, id)) post({ op: 'close', cid: id, code: 1001, reason: 'going away' })
    }
  })

  var Native = TunnelSocket.bind(null)
  Native.prototype = proto
  proto.constructor = Native
  Native.CONNECTING = 0
  Native.OPEN = 1
  Native.CLOSING = 2
  Native.CLOSED = 3
  window.WebSocket = Native
})()
