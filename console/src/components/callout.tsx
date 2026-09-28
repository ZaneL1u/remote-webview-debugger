import { InfoIcon, TriangleAlertIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const tones = {
  info: { box: 'border-brand/25 bg-brand-soft/50', icon: <InfoIcon className="text-brand" /> },
  warning: { box: 'border-warning/40 bg-warning-soft', icon: <TriangleAlertIcon className="text-warning" /> },
  destructive: { box: 'border-destructive/30 bg-destructive-soft', icon: <TriangleAlertIcon className="text-destructive" /> },
}

export function Callout({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof tones
  children: React.ReactNode
  className?: string
}) {
  const t = tones[tone]
  return (
    <div className={cn('flex gap-2.5 rounded-lg border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', t.box, className)}>
      {t.icon}
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  )
}
