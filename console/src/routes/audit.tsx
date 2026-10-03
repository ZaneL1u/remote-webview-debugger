import { Card } from '@/components/ui/card'
import { Forbidden } from '@/components/route-states'
import { AuditLog } from '@/features/audit-log'
import { useT } from '@/i18n'
import { useCan } from '@/lib/permissions'

export function AuditPage() {
  const allowed = useCan('audit.org')
  const t = useT().members.audit
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{t.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t.description}
        </p>
      </div>
      {allowed ? (
        <AuditLog />
      ) : (
        <Card>
          <Forbidden description={t.forbidden} />
        </Card>
      )}
    </div>
  )
}
