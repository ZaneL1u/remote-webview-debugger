import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LoaderCircleIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PolicyEditor } from '@/features/policy-editor'
import { rich, useT } from '@/i18n'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { projectsQuery } from '@/lib/queries'
import type { Project } from '@/lib/types'

export function SettingsTab({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(project.name)
  const manage = useCan('project.manage')
  const t = useT()

  const applyUpdate = (updated: Project) =>
    queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (old) => old?.map((p) => (p.id === updated.id ? updated : p)))

  const rename = useMutation({
    mutationFn: (newName: string) => api.updateProject(project.id, { name: newName }),
    onSuccess: (updated) => {
      applyUpdate(updated)
      toast.success(t.projects.settings.renamed)
    },
  })
  const toggle = useMutation({
    mutationFn: (disabled: boolean) => api.updateProject(project.id, { disabled }),
    onSuccess: (updated) => {
      applyUpdate(updated)
      toast.success(updated.disabled ? t.projects.settings.disabledToast : t.projects.settings.enabledToast)
    },
  })
  const remove = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (old) => old?.filter((p) => p.id !== project.id))
      toast.success(t.projects.settings.deleted(project.name))
      void navigate({ to: '/projects', replace: true })
    },
  })

  const trimmed = name.trim()

  return (
    <div className="max-w-3xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t.projects.settings.general}</CardTitle>
          <CardDescription>
            {rich(t.projects.settings.meta(formatDate(project.createdAt), project.id), {
              c: (s) => <span className="font-mono">{s}</span>,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (trimmed && trimmed !== project.name) rename.mutate(trimmed)
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="settings-name">{t.projects.name}</Label>
              <Input
                id="settings-name"
                value={name}
                maxLength={64}
                disabled={!manage}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={!manage || !trimmed || trimmed === project.name || rename.isPending}>
              {rename.isPending && <LoaderCircleIcon className="animate-spin" />}
              {t.common.save}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PolicyEditor project={project} />

      {manage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t.projects.settings.disableTitle}</CardTitle>
              <CardDescription>{t.projects.settings.disableDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm">{project.disabled ? t.common.disabled : t.projects.settings.running}</span>
                <Switch
                  checked={project.disabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(checked) => toggle.mutate(checked)}
                  aria-label={t.projects.settings.disableTitle}
                />
              </label>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">{t.projects.settings.deleteTitle}</CardTitle>
              <CardDescription>{t.projects.settings.deleteDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmDialog
                trigger={<Button variant="destructive" size="sm" />}
                title={t.projects.settings.deleteConfirmTitle(project.name)}
                description={t.projects.settings.deleteConfirmDescription}
                confirmLabel={t.projects.settings.deleteTitle}
                destructive
                onConfirm={() => remove.mutateAsync()}
              >
                <Trash2Icon />
                {t.projects.settings.deleteTitle}
              </ConfirmDialog>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
