import { agentText, RwdError, toLevel, type Level } from '@chobitsu/engine/rwd'
import { base62 } from './ids'
import type { DialogHandle, Ui } from './ui'

// The user's consent on this device (docs/protocol.md §7, §8):
//
//   attach    an agent asks to join (`attach_request`); the user picks a level
//             or refuses → `attach_decision`
//   confirm   the agent is about to click a sensitive element; the RPC waits
//
// Either our dialog asks (trusted taps only), or, with run({nativeApproval}),
// the native host does: it reads status().pending and answers through
// nativeDecide(nativeKey, …). A decision on one tab of this origin dismisses
// the same request on the others (BroadcastChannel).

const CONFIRM_MS = 30_000

export interface AttachPending {
  kind: 'attach'
  requestId: string
  agent: { name: string; keyHint: string | null }
  levels: Level[]
  /** 'devtools': a person asks to open Chrome DevTools on the page (protocol §17). */
  purpose: 'agent' | 'devtools'
  expiresAt: number
}

export interface ConfirmPending {
  kind: 'confirm'
  requestId: string
  action: string
  expiresAt: number
}

interface Open<P> {
  info: P
  dialog: DialogHandle | null
  timer: ReturnType<typeof setTimeout>
  finish(value: string | null): void
}

export interface ApprovalOptions {
  ui: Ui
  native: boolean
  send(msg: object): void
}

export class Approvals {
  private attach: Open<AttachPending> | null = null
  private confirmation: Open<ConfirmPending> | null = null
  private channel: BroadcastChannel | null = null

  constructor(private opts: ApprovalOptions) {
    const BC = (window as any).BroadcastChannel
    if (typeof BC !== 'function') return
    try {
      this.channel = new BC('rwd:approval') as BroadcastChannel
      this.channel.onmessage = (e: MessageEvent) => {
        const m = e.data
        if (m && m.t === 'decided' && this.attach && this.attach.info.requestId === m.requestId) this.dropAttach()
      }
    } catch (e) {
      this.channel = null
    }
  }

  /** What the native host should ask about, if anything (a confirmation first). */
  pending(): AttachPending | ConfirmPending | null {
    const open = this.confirmation || this.attach
    return open ? { ...open.info } : null
  }

  onAttachRequest(msg: any) {
    const requestId = typeof msg.requestId === 'string' ? msg.requestId : ''
    if (!requestId) return
    this.dropAttach()
    const levels: Level[] = []
    for (const l of Array.isArray(msg.levels) ? msg.levels : []) {
      const level = toLevel(l)
      if (levels.indexOf(level) < 0) levels.push(level)
    }
    if (!levels.length) levels.push('observe')
    const agent = msg.agent && typeof msg.agent === 'object' ? msg.agent : {}
    const t = this.opts.ui.t
    const info: AttachPending = {
      kind: 'attach',
      requestId,
      agent: {
        name: String(agent.name || t.agentName),
        keyHint: agent.keyHint ? String(agent.keyHint) : null,
      },
      levels,
      purpose: msg.purpose === 'devtools' ? 'devtools' : 'agent',
      expiresAt: Date.now() + (Number(msg.expiresInSec) > 0 ? Number(msg.expiresInSec) : 30) * 1000,
    }
    const open: Open<AttachPending> = {
      info,
      dialog: null,
      // No answer in time: the gateway treats it as refused and cancels.
      timer: setTimeout(() => this.dropAttach(), info.expiresAt - Date.now()),
      finish: value => {
        if (this.attach !== open) return
        this.dropAttach()
        const level = value === null ? null : levels.indexOf(value as Level) >= 0 ? value : null
        this.opts.send({ t: 'attach_decision', requestId, level })
        if (this.channel) this.channel.postMessage({ t: 'decided', requestId })
      },
    }
    this.attach = open
    // The user turned on auto-approve in our window: answer at once, and say so.
    // That switch is about AI agents; a person's DevTools is always asked.
    const auto = info.purpose === 'agent' ? this.opts.ui.autoLevel() : null
    if (auto) {
      const rank = (l: Level) => ['observe', 'interact', 'advanced'].indexOf(l)
      const allowed = levels.filter(l => rank(l) <= rank(auto))
      const level = allowed.length ? allowed[allowed.length - 1] : levels[0]
      open.finish(level)
      this.opts.ui.toast(t.autoAllowedToast(info.agent.name, t.attachLevels[level]))
      return
    }
    if (!this.opts.native && info.purpose === 'devtools') {
      open.dialog = this.opts.ui.dialog({
        title: t.devtoolsTitle,
        text: t.devtoolsText(info.agent.name),
        okText: t.allow,
        cancelText: t.deny,
        expiresAt: info.expiresAt,
        onDecide: ok => open.finish(ok ? levels[levels.length - 1] : null),
      })
    } else if (!this.opts.native) {
      open.dialog = this.opts.ui.dialog({
        title: t.attachTitle,
        text: t.attachText(info.agent.name),
        hint: info.agent.keyHint ? `API Key ${info.agent.keyHint}` : undefined,
        choices: levels.map(value => ({ value, label: t.attachLevels[value] })),
        // The last one is what the agent asked for.
        choice: levels[levels.length - 1],
        okText: t.allow,
        cancelText: t.deny,
        expiresAt: info.expiresAt,
        onDecide: (ok, choice) => open.finish(ok ? choice || levels[levels.length - 1] : null),
      })
    }
  }

  onAttachCancel(requestId: string) {
    if (this.attach && this.attach.info.requestId === requestId) this.dropAttach()
  }

  /** Resolves when the user allows `action`; rejects with `forbidden` otherwise. */
  confirm(action: string): Promise<void> {
    if (this.confirmation) return Promise.reject(new RwdError('forbidden', agentText().confirmBusy))
    return new Promise<void>((resolve, reject) => {
      const info: ConfirmPending = { kind: 'confirm', requestId: base62(12), action, expiresAt: Date.now() + CONFIRM_MS }
      const open: Open<ConfirmPending> = {
        info,
        dialog: null,
        timer: setTimeout(() => open.finish(null), CONFIRM_MS),
        finish: value => {
          if (this.confirmation !== open) return
          clearTimeout(open.timer)
          if (open.dialog) open.dialog.close()
          this.confirmation = null
                if (value === 'allow') resolve()
          else reject(new RwdError('forbidden', agentText().userDenied))
        },
      }
      this.confirmation = open
      if (!this.opts.native) {
        const t = this.opts.ui.t
        open.dialog = this.opts.ui.dialog({
          title: t.confirmTitle,
          text: t.confirmText(action),
          okText: t.allow,
          cancelText: t.deny,
          expiresAt: info.expiresAt,
          onDecide: ok => open.finish(ok ? 'allow' : null),
        })
      }
      })
  }

  /** The user can no longer be asked on behalf of this agent (takeover, end, offline). */
  cancelConfirm() {
    if (this.confirmation) this.confirmation.finish(null)
  }

  /** Answer from the native host; false when there is no such request or the value is invalid. */
  decide(requestId: string, value: string | null): boolean {
    if (this.attach && this.attach.info.requestId === requestId) {
      if (value !== null && this.attach.info.levels.indexOf(value as Level) < 0) return false
      this.attach.finish(value)
      return true
    }
    if (this.confirmation && this.confirmation.info.requestId === requestId) {
      if (value !== null && value !== 'allow') return false
      this.confirmation.finish(value)
      return true
    }
    return false
  }

  destroy() {
    this.dropAttach()
    this.cancelConfirm()
    if (this.channel) this.channel.close()
    this.channel = null
  }

  private dropAttach() {
    const open = this.attach
    if (!open) return
    this.attach = null
    clearTimeout(open.timer)
    if (open.dialog) open.dialog.close()
  }
}
