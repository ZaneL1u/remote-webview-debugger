import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { CompassIcon, LockKeyholeIcon, TriangleAlertIcon } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { errorMessage, isForbidden } from '@/lib/api'
import { roleLabels, useMe } from '@/lib/permissions'

export function NotFound() {
  const t = useT()
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <EmptyState
        icon={<CompassIcon />}
        title={t.shell.states.notFound}
        description={t.shell.states.notFoundDescription}
        action={<Button nativeButton={false} render={<Link to="/" />} variant="outline">{t.shell.states.backToDevices}</Button>}
      />
    </div>
  )
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const t = useT()
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <EmptyState
        icon={<TriangleAlertIcon />}
        title={t.common.loadFailed}
        description={errorMessage(error)}
        action={
          <Button variant="outline" onClick={() => (reset ? reset() : window.location.reload())}>
            {t.common.retry}
          </Button>
        }
      />
    </div>
  )
}

export function InlineError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT()
  if (isForbidden(error)) return <Forbidden />
  return (
    <EmptyState
      icon={<TriangleAlertIcon />}
      title={t.common.loadFailed}
      description={errorMessage(error)}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t.common.retry}
          </Button>
        )
      }
    />
  )
}

/** Shown instead of content the signed-in member's role may not see (or when the API answers 403). */
export function Forbidden({ className, description }: { className?: string; description?: string }) {
  const me = useMe()
  const t = useT()
  return (
    <EmptyState
      className={className}
      icon={<LockKeyholeIcon />}
      title={t.shell.states.forbidden}
      description={
        description ?? t.shell.states.forbiddenDescription(roleLabels[me?.role ?? 'member'])
      }
    />
  )
}
