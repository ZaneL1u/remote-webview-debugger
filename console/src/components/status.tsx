import { BotIcon, EyeIcon, HandIcon, HourglassIcon, LifeBuoyIcon, MoonIcon, QrCodeIcon, ShieldIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useT } from '@/i18n'
import { controlLabels } from '@/lib/format'
import { levelMeta } from '@/lib/policy'
import type { ControlState, Level, PendingApproval } from '@/lib/types'
import { cn } from '@/lib/utils'

export function OnlineDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden>
      {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />}
      <span className={cn('relative inline-flex size-2 rounded-full', online ? 'bg-success' : 'bg-muted-foreground/40')} />
    </span>
  )
}

export function OnlineBadge({ online }: { online: boolean }) {
  const t = useT()
  return (
    <Badge variant={online ? 'success' : 'muted'}>
      <OnlineDot online={online} className="size-1.5 [&>span]:size-1.5" />
      {online ? t.common.online : t.common.offline}
    </Badge>
  )
}

export function ControlBadge({ state, agent }: { state: ControlState; agent?: string | null }) {
  const t = useT()
  const label = controlLabels[state] ?? state
  const title = agent && state !== 'none' ? t.common.badges.agentWithName(label, agent) : label
  switch (state) {
    case 'observe':
      return (
        <Badge variant="brand" title={title}>
          <EyeIcon />
          {label}
        </Badge>
      )
    case 'agent':
      return (
        <Badge variant="default" className="bg-brand text-brand-foreground" title={title}>
          <BotIcon />
          {label}
        </Badge>
      )
    case 'user':
      return (
        <Badge variant="warning" title={title}>
          <HandIcon />
          {label}
        </Badge>
      )
    default:
      return (
        <Badge variant="muted" title={title}>
          <MoonIcon />
          {label}
        </Badge>
      )
  }
}

export function HelpBadge() {
  const t = useT()
  return (
    <Badge variant="destructive" className="animate-pulse">
      <LifeBuoyIcon />
      {t.common.badges.help}
    </Badge>
  )
}

/** Permission level of an attach or an API key (section 6). */
export function LevelBadge({ level, prefix }: { level: Level; prefix?: string }) {
  const t = useT()
  const m = levelMeta[level]
  return (
    <Badge
      variant={level === 'advanced' ? 'warning' : level === 'interact' ? 'secondary' : 'outline'}
      title={t.common.levelTitle(m.label, level, m.description)}
    >
      <ShieldIcon />
      {prefix}
      {m.label}
    </Badge>
  )
}

export function pendingAgentName(pending: PendingApproval) {
  return typeof pending.agent === 'string' ? pending.agent : pending.agent?.name || 'agent'
}

/** An agent asked to attach and the user has not answered on the device yet (section 7). */
export function PendingBadge({ pending }: { pending: PendingApproval }) {
  const t = useT()
  const agent = pendingAgentName(pending)
  const label = pending.kind === 'confirm' ? t.common.badges.waitingConfirmAction : t.common.badges.waitingConfirm
  return (
    <Badge variant="warning" className="animate-pulse" title={t.common.badges.waitingTitle(agent)}>
      <HourglassIcon />
      {label}
    </Badge>
  )
}

export function InvitedBadge() {
  const t = useT()
  return (
    <Badge variant="brand" title={t.common.badges.invitedTitle}>
      <QrCodeIcon />
      {t.common.badges.invited}
    </Badge>
  )
}
