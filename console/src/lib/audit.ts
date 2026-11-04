import { getT, type Messages } from '@/i18n'

import type { AuditEvent } from './types'

type AuditMessages = Messages['members']['audit']
type Action = keyof AuditMessages['actions']

// docs/protocol.md section 12.7 actions, grouped for the filter. Labels live in the catalogs
// (members.audit.groups / members.audit.actions).
export const actionGroups: { key: keyof AuditMessages['groups']; actions: Action[] }[] = [
  {
    key: 'auth',
    actions: ['auth.login', 'auth.login_failed', 'member.invite', 'member.accept', 'member.update', 'member.delete'],
  },
  {
    key: 'projects',
    actions: ['project.create', 'project.update', 'project.delete', 'project.rotate_app_key', 'key.create', 'key.revoke'],
  },
  {
    key: 'invites',
    actions: ['invite.create', 'invite.delete', 'invite.use'],
  },
  {
    key: 'attach',
    actions: ['attach.request', 'attach.approve', 'attach.deny', 'attach.timeout', 'attach.start', 'attach.resume', 'attach.end'],
  },
  {
    key: 'devtools',
    actions: ['devtools.request', 'devtools.approve', 'devtools.deny', 'devtools.timeout', 'devtools.open', 'devtools.close'],
  },
  {
    key: 'control',
    actions: ['rpc', 'policy.denied', 'control.takeover', 'control.handback', 'control.end', 'device.end'],
  },
]

export function actionLabel(action: string) {
  const labels: Record<string, string> = getT().members.audit.actions
  return labels[action] ?? action
}

export function actorTypeLabel(type: AuditEvent['actorType']) {
  return getT().members.audit.actorTypes[type] ?? type
}

export function resultLabel(result: AuditEvent['result']) {
  return getT().members.audit.results[result] ?? result
}

/** A short human summary of the interesting detail fields, or null. */
export function detailSummary(e: AuditEvent): string | null {
  const t = getT().members.audit
  const d = e.detail ?? {}
  const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : null)
  if (e.action === 'rpc' || e.action === 'policy.denied') {
    // RPC methods as agents see them (section 5).
    const method = str(d.method)
    const parts = [method ? t.summary.method(t.rpc[method] ?? method, method) : null]
    if (str(d.page)) parts.push(t.summary.page(String(d.page)))
    if (typeof d.latencyMs === 'number') parts.push(`${d.latencyMs} ms`)
    if (str(d.error)) parts.push(t.summary.error(String(d.error)))
    if (str(d.required)) parts.push(t.summary.required(String(d.required)))
    return parts.filter(Boolean).join(' · ') || null
  }
  if (str(d.level)) return t.summary.level(String(d.level))
  if (str(d.note)) return t.summary.note(String(d.note))
  if (str(d.reason)) return String(d.reason)
  return null
}
