import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { StreamStatus } from '@/lib/stream'

const dots: Record<StreamStatus, string> = {
  live: 'bg-success animate-pulse',
  connecting: 'bg-muted-foreground/50',
  down: 'bg-warning',
}

export function LiveIndicator({ status, className }: { status: StreamStatus; className?: string }) {
  const m = useT().shell.live[status]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      title={m.title}
      data-stream={status}
      role="status"
    >
      <span className={cn('size-1.5 rounded-full', dots[status])} />
      {m.label}
    </span>
  )
}
