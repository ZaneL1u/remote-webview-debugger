import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRightIcon, FolderPlusIcon, LoaderCircleIcon, PlusIcon, SmartphoneIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { InlineError } from '@/components/route-states'
import { OnlineDot } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { rich, useT } from '@/i18n'
import { api } from '@/lib/api'
import { formatDay, invalidOrigins, parseOrigins } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { projectsQuery } from '@/lib/queries'
import type { Project } from '@/lib/types'

export function ProjectsPage() {
  const projects = useQuery(projectsQuery)
  const manage = useCan('project.manage')
  const [open, setOpen] = useState(false)
  const t = useT()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{t.projects.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.projects.list.description}</p>
        </div>
        {manage && (
          <Button onClick={() => setOpen(true)}>
            <PlusIcon />
            {t.projects.newProject}
          </Button>
        )}
      </div>

      {projects.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="gap-4 px-5">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </Card>
          ))}
        </div>
      ) : projects.isError ? (
        <Card>
          <InlineError error={projects.error} onRetry={() => projects.refetch()} />
        </Card>
      ) : projects.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderPlusIcon />}
            title={t.projects.list.emptyTitle}
            description={manage ? t.projects.list.emptyManage : t.projects.list.emptyMember}
            action={
              manage && (
                <Button onClick={() => setOpen(true)}>
                  <PlusIcon />
                  {t.projects.newProject}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {manage && <CreateProjectDialog open={open} onOpenChange={setOpen} />}
    </div>
  )
}

function ProjectCard({ project: p }: { project: Project }) {
  const t = useT()
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: p.id }}
      className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <Card className="h-full gap-4 px-5 transition-colors group-hover:border-foreground/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-medium">{p.name}</h2>
              {p.disabled && <Badge variant="muted">{t.common.disabled}</Badge>}
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{p.appKey}</p>
          </div>
          <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <OnlineDot online={p.onlineDevices > 0} />
            <span className="text-muted-foreground">
              {rich(t.projects.onlineCount(p.onlineDevices, p.totalDevices), {
                n: (s) => <span className="font-medium text-foreground tabular-nums">{s}</span>,
              })}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{formatDay(p.createdAt)}</span>
        </div>
      </Card>
    </Link>
  )
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [origins, setOrigins] = useState('')
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  const create = useMutation({
    mutationFn: api.createProject,
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (old) => (old ? [...old, project] : [project]))
      void queryClient.invalidateQueries({ queryKey: projectsQuery.queryKey })
      toast.success(t.projects.create.created(project.name))
      onOpenChange(false)
      void navigate({ to: '/projects/$projectId', params: { projectId: project.id }, search: { tab: 'integration' } })
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setName('')
          setOrigins('')
          setError(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.projects.newProject}</DialogTitle>
          <DialogDescription>{t.projects.create.description}</DialogDescription>
        </DialogHeader>
        <form
          id="create-project"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return setError(t.projects.create.nameRequired)
            const list = parseOrigins(origins)
            const bad = invalidOrigins(list)
            if (bad.length) return setError(t.projects.create.invalidOrigins(bad))
            setError(null)
            create.mutate({ name: trimmed, allowedOrigins: list })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="project-name">{t.projects.name}</Label>
            <Input
              id="project-name"
              placeholder={t.projects.create.namePlaceholder}
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-origins">
              {t.projects.create.originsLabel} <span className="font-normal text-muted-foreground">{t.projects.optional}</span>
            </Label>
            <Textarea
              id="project-origins"
              placeholder={'https://m.example.com\nhttps://*.example.com'}
              value={origins}
              rows={3}
              className="font-mono text-xs md:text-xs"
              onChange={(e) => setOrigins(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.projects.create.originsHint}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form="create-project" disabled={create.isPending}>
            {create.isPending ? <LoaderCircleIcon className="animate-spin" /> : <SmartphoneIcon />}
            {t.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
