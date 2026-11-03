import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import {
  ChevronLeftIcon,
  FolderXIcon,
  PlugZapIcon,
  QrCodeIcon,
  ScrollTextIcon,
  SettingsIcon,
  SmartphoneIcon,
} from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { InlineError } from '@/components/route-states'
import { OnlineDot } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuditLog } from '@/features/audit-log'
import { DevicesTab } from '@/features/devices-tab'
import { IntegrationTab } from '@/features/integration-tab'
import { InvitesTab } from '@/features/invites-tab'
import { SettingsTab } from '@/features/settings-tab'
import { rich, useT } from '@/i18n'
import { projectsQuery } from '@/lib/queries'

export const projectTabs = ['integration', 'devices', 'invites', 'audit', 'settings'] as const
export type ProjectTab = (typeof projectTabs)[number]

const route = getRouteApi('/auth/projects/$projectId')

export function ProjectDetailPage() {
  const { projectId } = route.useParams()
  const { tab } = route.useSearch()
  const navigate = route.useNavigate()
  const t = useT()
  // The API has no GET /projects/:id, so the project comes from the (cached, polled) list.
  const projects = useQuery(projectsQuery)
  const project = projects.data?.find((p) => p.id === projectId)
  const current: ProjectTab = tab ?? (project && project.totalDevices === 0 ? 'integration' : 'devices')

  if (projects.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (projects.isError) {
    return (
      <Card>
        <InlineError error={projects.error} onRetry={() => projects.refetch()} />
      </Card>
    )
  }
  if (!project) {
    return (
      <Card>
        <EmptyState
          icon={<FolderXIcon />}
          title={t.projects.detail.notFoundTitle}
          description={t.projects.detail.notFoundDescription}
          action={<Button nativeButton={false} render={<Link to="/projects" />} variant="outline">{t.projects.detail.backToList}</Button>}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4 rtl:-scale-x-100" />
          {t.projects.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{project.name}</h1>
          {project.disabled && <Badge variant="destructive">{t.common.disabled}</Badge>}
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <OnlineDot online={project.onlineDevices > 0} />
            <span>
              {rich(t.projects.onlineCount(project.onlineDevices, project.totalDevices), {
                n: (s) => <span className="font-medium text-foreground tabular-nums">{s}</span>,
              })}
            </span>
          </span>
        </div>
      </div>

      <Tabs
        value={current}
        onValueChange={(value) => void navigate({ search: { tab: value as ProjectTab }, replace: true })}
      >
        <TabsList>
          <TabsTrigger value="integration">
            <PlugZapIcon />
            {t.projects.detail.tabs.integration}
          </TabsTrigger>
          <TabsTrigger value="devices">
            <SmartphoneIcon />
            {t.projects.detail.tabs.devices}
          </TabsTrigger>
          <TabsTrigger value="invites">
            <QrCodeIcon />
            {t.projects.detail.tabs.invites}
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollTextIcon />
            {t.projects.detail.tabs.audit}
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon />
            {t.projects.detail.tabs.settings}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="integration">
          <IntegrationTab project={project} />
        </TabsContent>
        <TabsContent value="devices">
          <DevicesTab project={project} />
        </TabsContent>
        <TabsContent value="invites">
          <InvitesTab project={project} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLog projectId={project.id} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab project={project} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
