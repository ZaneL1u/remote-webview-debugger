import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRightIcon, FileStackIcon, QrCodeIcon, SmartphoneIcon, UserIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { LiveIndicator } from '@/components/live-indicator'
import { InlineError } from '@/components/route-states'
import { ControlBadge, HelpBadge, InvitedBadge, LevelBadge, OnlineDot, PendingBadge } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { locale, useT } from '@/i18n'
import { platformLabel, relativeTime, summarizeUA } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { devicesQuery } from '@/lib/queries'
import { useProjectStream } from '@/lib/stream'
import type { Device, DeviceStatusFilter, Project } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Labels come from t.devices.tab.filters at render time. */
const filters: DeviceStatusFilter[] = ['online', 'waiting', 'all']

/** Help first, then online, then most recently seen (the API already sorts; this keeps it stable). */
function sortDevices(list: Device[]) {
  return [...list].sort(
    (a, b) => Number(b.help) - Number(a.help) || Number(b.online) - Number(a.online) || b.lastSeenAt - a.lastSeenAt,
  )
}

export function DevicesTab({ project }: { project: Project }) {
  const [status, setStatus] = useState<DeviceStatusFilter>('online')
  const stream = useProjectStream(project.id)
  const devices = useQuery(devicesQuery(project.id, status, stream === 'live'))
  const canInvite = useCan('invite.manage')
  const list = useMemo(() => (devices.data ? sortDevices(devices.data) : []), [devices.data])
  const helpCount = list.filter((d) => d.help).length
  const t = useT().devices.tab

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          value={[status]}
          onValueChange={(v) => v[0] && setStatus(v[0] as DeviceStatusFilter)}
          aria-label={t.filterLabel}
        >
          {filters.map((f) => (
            <ToggleGroupItem key={f} value={f}>
              {t.filters[f]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {helpCount > 0 && <span className="font-medium text-success">{t.asking(helpCount)}</span>}
          <LiveIndicator status={stream} />
          {canInvite && (
            <Button
              variant="outline"
              size="xs"
              nativeButton={false}
              render={<Link to="/projects/$projectId" params={{ projectId: project.id }} search={{ tab: 'invites' }} />}
            >
              <QrCodeIcon />
              {t.invite}
            </Button>
          )}
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {devices.isPending ? (
          <div className="divide-y">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ms-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : devices.isError ? (
          <InlineError error={devices.error} onRetry={() => devices.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<SmartphoneIcon />}
            title={status === 'online' ? t.emptyOnline : status === 'waiting' ? t.emptyWaiting : t.emptyAll}
            description={
              project.totalDevices === 0 ? t.emptyNewHint : t.emptyHint
            }
            action={
              project.totalDevices === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link to="/projects/$projectId" params={{ projectId: project.id }} search={{ tab: 'integration' }} />}
                >
                  {t.setupGuide}
                </Button>
              ) : status !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => setStatus('all')}>
                  {t.showAll}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DeviceTable devices={list} projectId={project.id} />
            <DeviceCards devices={list} projectId={project.id} />
          </>
        )}
      </Card>
    </div>
  )
}

function DeviceTable({ devices, projectId }: { devices: Device[]; projectId: string }) {
  const navigate = useNavigate()
  const t = useT().devices.tab
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-4">{t.deviceCode}</TableHead>
            <TableHead>{t.userId}</TableHead>
            <TableHead>{t.platform}</TableHead>
            <TableHead>{t.appVersion}</TableHead>
            <TableHead className="text-end">{t.pages}</TableHead>
            <TableHead>{t.control}</TableHead>
            <TableHead className="pe-4 text-end">{t.lastSeen}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((d) => (
            <TableRow
              key={d.id}
              className={cn('cursor-pointer', d.help && 'bg-success/[0.06] hover:bg-success/10 dark:bg-success/[0.07]')}
              onClick={() =>
                void navigate({ to: '/devices/$deviceId', params: { deviceId: d.id }, search: { from: projectId } })
              }
            >
              <TableCell className={cn('ps-4', d.help && 'shadow-[inset_3px_0_0_var(--success)] rtl:shadow-[inset_-3px_0_0_var(--success)]')}>
                <div className="flex items-center gap-2">
                  <OnlineDot online={d.online} />
                  <Link
                    to="/devices/$deviceId"
                    params={{ deviceId: d.id }}
                    search={{ from: projectId }}
                    className="font-mono font-medium tracking-wide hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {d.code}
                  </Link>
                  {d.help && <HelpBadge />}
                  {d.invited && <InvitedBadge />}
                </div>
              </TableCell>
              <TableCell className="max-w-40 truncate text-muted-foreground" title={d.userId ?? undefined}>
                {d.userId ?? '—'}
              </TableCell>
              <TableCell className="max-w-56" title={d.ua}>
                <span>{platformLabel(d.platform)}</span>
                <span className="block truncate text-xs text-muted-foreground">{summarizeUA(d.ua)}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">{d.app?.version ?? '—'}</TableCell>
              <TableCell className="text-end tabular-nums">{d.pages}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  {d.pending ? <PendingBadge pending={d.pending} /> : <ControlBadge state={d.control} agent={d.agent} />}
                  {d.level && d.control !== 'none' && !d.pending && <LevelBadge level={d.level} />}
                </div>
              </TableCell>
              <TableCell className="pe-4 text-end text-muted-foreground" title={new Date(d.lastSeenAt).toLocaleString(locale())}>
                {d.online ? <span className="text-success">{t.online}</span> : relativeTime(d.lastSeenAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DeviceCards({ devices, projectId }: { devices: Device[]; projectId: string }) {
  const t = useT().devices.tab
  return (
    <ul className="divide-y md:hidden">
      {devices.map((d) => (
        <li key={d.id}>
          <Link
            to="/devices/$deviceId"
            params={{ deviceId: d.id }}
            search={{ from: projectId }}
            className={cn(
              'flex items-center gap-3 px-4 py-3 active:bg-muted/60',
              d.help && 'bg-success/[0.06] shadow-[inset_3px_0_0_var(--success)] rtl:shadow-[inset_-3px_0_0_var(--success)]',
            )}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <OnlineDot online={d.online} />
                <span className="font-mono font-medium tracking-wide">{d.code}</span>
                {d.help && <HelpBadge />}
                {d.pending ? <PendingBadge pending={d.pending} /> : <ControlBadge state={d.control} agent={d.agent} />}
                {d.level && d.control !== 'none' && !d.pending && <LevelBadge level={d.level} />}
                {d.invited && <InvitedBadge />}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {platformLabel(d.platform)}
                  {d.app?.version ? ` · v${d.app.version}` : ''}
                </span>
                {d.userId && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="size-3" />
                    {d.userId}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FileStackIcon className="size-3" />
                  {t.pageCount(d.pages)}
                </span>
                <span>{d.online ? t.online : relativeTime(d.lastSeenAt)}</span>
              </div>
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
