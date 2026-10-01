import { KeysPanel } from '@/features/keys-panel'
import { useT } from '@/i18n'

export function KeysPage() {
  const t = useT()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{t.projects.keys.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.projects.keys.pageDescription}</p>
      </div>
      <KeysPanel />
    </div>
  )
}
