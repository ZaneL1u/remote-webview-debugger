// RPC error codes of the RWD protocol (docs/protocol.md §5.1).
export type RwdErrorCode =
  | 'not_found'
  | 'not_interactable'
  | 'timeout'
  | 'takeover'
  | 'forbidden'
  | 'bad_request'
  | 'internal'

export class RwdError extends Error {
  code: RwdErrorCode
  constructor(code: RwdErrorCode, message: string) {
    super(message)
    this.code = code
    this.message = message
    Object.setPrototypeOf(this, RwdError.prototype)
  }
}

export function rwdError(code: RwdErrorCode, message: string) {
  return new RwdError(code, message)
}

/** The `error` object of an RPC reply. */
export function toRpcError(e: any): { code: RwdErrorCode; message: string } {
  if (e instanceof RwdError) return { code: e.code, message: e.message }
  const message =
    e && typeof e === 'object' && 'message' in e
      ? `${e.name || 'Error'}: ${e.message}`
      : String(e)
  return { code: 'internal', message }
}
