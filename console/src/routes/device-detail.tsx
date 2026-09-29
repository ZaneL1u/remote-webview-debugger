import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import {
  AppWindowIcon,
  ArrowDownIcon,
  BotIcon,
  ChevronLeftIcon,
  CircleDotIcon,
  CircleXIcon,
  CompassIcon,
  CrosshairIcon,
  HandIcon,
  HourglassIcon,
  LifeBuoyIcon,
  LoaderCircleIcon,
  MousePointerClickIcon,
  PlugIcon,
  PowerIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  SmartphoneIcon,
  SquareTerminalIcon,
  UnplugIcon,
  WifiOffIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Callout } from '@/components/callout'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { LiveIndicator } from '@/components/live-indicator'
import { DeviceSystemLabel, OsIcon, osKind } from '@/components/os-icon'
import { InlineError } from '@/components/route-states'
import {
  ControlBadge,
  HelpBadge,
  InvitedBadge,
  LevelBadge,
  OnlineBadge,
  PendingBadge,
  pendingAgentName,
} from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { TestResultView } from '@/features/test-result'
import { rich, useT } from '@/i18n'
import { ApiError, api } from '@/lib/api'
import { formatClock, formatDate, relativeTime } from '@/lib/format'
import { levelMeta } from '@/lib/policy'
import { deviceQuery, projectsQuery } from '@/lib/queries'
import { type StreamStatus, useOrgStream } from '@/lib/stream'
import type { DeviceDetail, Page, PendingApproval, TimelineEvent } from '@/lib/types'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { lastDevicesSearch } from '@/routes/devices'

const route = getRouteApi('/auth/devices/$deviceId')

export function DeviceDetailPage() {
  const { deviceId } = route.useParams()
  const { from } = route.useSearch()
  const stream = useOrgStream()
  const device = useQuery(deviceQuery(deviceId, stream === 'live'))
  const projects = useQuery(projectsQuery)
  const fromProject = from ? projects.data?.find((p) => p.id === from) : undefined
  const t = useT().devices.detail

  const backClass = 'inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
  const back = from ? (
    <Link to="/projects/$projectId" params={{ projectId: from }} search={{ tab: 'devices' }} className={backClass}>
      <ChevronLeftIcon className="size-4" />
      {fromProject ? t.projectDevices(fromProject.name) : t.projectDevicesFallback}
    </Link>
  ) : (
    <Link to="/" search={lastDevicesSearch} className={backClass}>
      <ChevronLeftIcon className="size-4" />
      {t.allDevices}
    </Link>
  )

  if (device.isPending) {
    return (
      <div className="space-y-5">
        {back}
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-5 lg:grid-cols-5">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72 lg:col-span-3" />
        </div>
      </div>
    )
  }
  if (device.isError) {
    const notFound = device.error instanceof ApiError && device.error.status === 404
    return (
      <div className="space-y-5">
        {back}
        <Card>
          {notFound ? (
            <EmptyState icon={<SmartphoneIcon />} title={t.notFound} description={t.notFoundHint} />
          ) : (
            <InlineError error={device.error} onRetry={() => device.refetch()} />
          )}
        </Card>
      </div>
    )
  }

  const d = device.data
  return (
    <div className="space-y-5">
      {back}
      <DeviceHeader device={d} stream={stream} />
      {d.pending && <PendingCallout pending={d.pending} />}
      <div className="grid gap-5 lg:grid-cols-5">
        <PagesCard pages={d.pages} online={d.online} className="lg:col-span-2" />
        <TimelineCard events={d.timeline} className="lg:col-span-3" />
      </div>
    </div>
  )
}

function PendingCallout({ pending }: { pending: PendingApproval }) {
  const now = useNow(1000)
  const left = Math.max(0, Math.ceil((pending.expiresAt - now) / 1000))
  const agent = pendingAgentName(pending)
  const requested = pending.levels.at(-1)
  const t = useT().devices.detail.pending
  return (
    <Callout tone="warning">
      <p className="font-medium">
        {pending.kind === 'confirm' ? t.confirm(agent) : t.attach(agent)}
      </p>
      <p className="text-muted-foreground">
        {requested &&
          pending.kind !== 'confirm' &&
          rich(t.requested(levelMeta[requested].label, requested), {
            b: (s) => <span className="font-medium text-foreground">{s}</span>,
          })}
        {left > 0 ? t.left(left) : t.expired}
        {t.manual}
      </p>
    </Callout>
  )
}

function DeviceHeader({ device: d, stream }: { device: DeviceDetail; stream: StreamStatus }) {
  const queryClient = useQueryClient()
  const projects = useQuery(projectsQuery)
  const projectIds = d.projects?.length ? d.projects : [d.projectId]
  const projectName = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? id
  const [testOpen, setTestOpen] = useState(false)
  const t = useT().devices.detail
  const test = useMutation({ mutationFn: () => api.testDevice(d.id), meta: { silent: true } })
  const end = useMutation({
    mutationFn: () => api.endDevice(d.id),
    onSuccess: () => {
      toast.success(t.ended)
      void queryClient.invalidateQueries({ queryKey: deviceQuery(d.id).queryKey })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <OsIcon kind={osKind(d.system, d.platform)} className="size-7 rounded-lg [&_svg]:size-[18px]" />
            <h1 className="font-mono text-2xl font-semibold tracking-wider">{d.code}</h1>
            <CopyButton value={d.code} variant="ghost" ariaLabel={t.copyCode} toastLabel={t.codeCopied} />
            <OnlineBadge online={d.online} />
            {d.pending ? <PendingBadge pending={d.pending} /> : <ControlBadge state={d.control} agent={d.agent} />}
            {d.help && <HelpBadge />}
            {d.invited && <InvitedBadge />}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {d.agent && d.control !== 'none' && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BotIcon className="size-4" />
                {t.agent}
                <span className="text-foreground">{d.agent}</span>
                {d.level && <LevelBadge level={d.level} />}
              </p>
            )}
            <LiveIndicator status={stream} />
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={!d.online}
            onClick={() => {
              setTestOpen(true)
              test.mutate()
            }}
          >
            <ZapIcon />
            {t.test}
          </Button>
          <ConfirmDialog
            trigger={<Button variant="outline" className="flex-1 text-destructive hover:text-destructive sm:flex-none" />}
            disabled={d.control === 'none'}
            title={t.endTitle}
            description={t.endDescription}
            confirmLabel={t.end}
            destructive
            onConfirm={() => end.mutateAsync()}
          >
            <PowerIcon />
            {t.end}
          </ConfirmDialog>
        </div>
      </div>

      <Card className="py-4">
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted-foreground">{t.meta.deviceId}</dt>
              <dd className="mt-0.5 flex items-center gap-1">
                <span className="truncate font-mono text-[13px]" title={d.id}>
                  {d.id}
                </span>
                <CopyButton value={d.id} variant="ghost" ariaLabel={t.copyId} toastLabel={t.idCopied} />
              </dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted-foreground">{t.meta.system}</dt>
              <dd className="mt-1">
                <DeviceSystemLabel device={d} className="max-w-full" />
              </dd>
            </div>
            <Meta label={t.meta.userId} value={d.userId ?? '—'} mono={!!d.userId} />
            <Meta label={t.meta.app} value={d.app ? `${d.app.name} ${d.app.version}` : t.meta.h5Page} />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t.meta.project}</dt>
              <dd className="mt-0.5 flex flex-wrap gap-x-2">
                {projectIds.map((id) => (
                  <Link key={id} to="/projects/$projectId" params={{ projectId: id }} className="truncate hover:text-brand hover:underline">
                    {projectName(id)}
                  </Link>
                ))}
              </dd>
            </div>
            <Meta
              label={t.meta.level}
              value={d.level && d.control !== 'none' ? t.meta.levelValue(levelMeta[d.level].label, d.level) : t.meta.notConnected}
            />
            <Meta
              label={d.online ? t.meta.onlineSince : t.meta.lastSeen}
              value={d.online ? (d.onlineSince ? relativeTime(d.onlineSince) : t.meta.online) : relativeTime(d.lastSeenAt)}
              title={formatDate(d.online ? (d.onlineSince ?? d.lastSeenAt) : d.lastSeenAt)}
            />
            <Meta label={t.meta.firstSeen} value={formatDate(d.firstSeenAt)} />
            <Meta label={t.meta.sdk} value={d.sdk || '—'} mono />
            <Meta label={t.meta.pages} value={t.meta.pageCount(d.pages.length)} />
          </dl>
        </CardContent>
      </Card>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.testDialog.title(d.code)}</DialogTitle>
            <DialogDescription>{t.testDialog.description}</DialogDescription>
          </DialogHeader>
          {test.isPending ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              {t.testDialog.waiting}
            </div>
          ) : (
            <TestResultView result={test.data} error={test.error} />
          )}
          {!test.isPending && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => test.mutate()} disabled={!d.online}>
                {t.testDialog.again}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Meta({ label, value, mono, title }: { label: string; value: string; mono?: boolean; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate', mono && 'font-mono')} title={title ?? value}>
        {value}
      </dd>
    </div>
  )
}

function PagesCard({ pages, online, className }: { pages: Page[]; online: boolean; className?: string }) {
  const sorted = [...pages].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  const t = useT().devices.detail.pages
  return (
    <Card className={cn('gap-0 pb-0', className)}>
      <CardHeader className="pb-4">
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      {sorted.length === 0 ? (
        <EmptyState
          className="border-t py-10"
          icon={<AppWindowIcon />}
          title={online ? t.none : t.offline}
          description={online ? undefined : t.offlineHint}
        />
      ) : (
        <ul className="divide-y border-t">
          {sorted.map((p) => (
            <li key={p.id} className={cn('space-y-1.5 px-5 py-3', p.selected && 'bg-brand-soft/50')}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {p.label}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={p.title}>
                  {p.title || t.untitled}
                </span>
                {p.selected && (
                  <Badge variant="brand" title={t.aiPageTitle}>
                    <CrosshairIcon />
                    {t.aiPage}
                  </Badge>
                )}
                {p.focused && (
                  <Badge variant="outline" title={t.userViewingTitle}>
                    {t.userViewing}
                  </Badge>
                )}
                <Badge variant={p.visibility === 'visible' ? 'success' : 'muted'}>
                  {p.visibility === 'visible' ? t.foreground : t.background}
                </Badge>
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground" title={p.url}>
                {p.url}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.connected(relativeTime(p.connectedAt), p.openerLabel || undefined)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Labels live in t.devices.detail.timeline.kinds. */
const kindMeta: Record<string, { icon: React.ReactNode; tone: string }> = {
  nav: { icon: <CompassIcon />, tone: 'text-brand' },
  navigated: { icon: <CompassIcon />, tone: 'text-brand' },
  reloaded: { icon: <CompassIcon />, tone: 'text-muted-foreground' },
  opened: { icon: <AppWindowIcon />, tone: 'text-success' },
  closed: { icon: <XIcon />, tone: 'text-muted-foreground' },
  focus: { icon: <AppWindowIcon />, tone: 'text-foreground' },
  agent: { icon: <PlugIcon />, tone: 'text-brand' },
  offline: { icon: <UnplugIcon />, tone: 'text-muted-foreground' },
  error: { icon: <CircleXIcon />, tone: 'text-destructive' },
  console_error: { icon: <SquareTerminalIcon />, tone: 'text-destructive' },
  net_fail: { icon: <WifiOffIcon />, tone: 'text-warning' },
  user_tap: { icon: <MousePointerClickIcon />, tone: 'text-foreground' },
  page_open: { icon: <AppWindowIcon />, tone: 'text-success' },
  page_close: { icon: <XIcon />, tone: 'text-muted-foreground' },
  help: { icon: <LifeBuoyIcon />, tone: 'text-destructive' },
  control: { icon: <HandIcon />, tone: 'text-warning' },
  agent_connect: { icon: <PlugIcon />, tone: 'text-brand' },
  agent_disconnect: { icon: <UnplugIcon />, tone: 'text-muted-foreground' },
  agent_action: { icon: <BotIcon />, tone: 'text-brand' },
  connect: { icon: <PlugIcon />, tone: 'text-success' },
  disconnect: { icon: <UnplugIcon />, tone: 'text-muted-foreground' },
  test: { icon: <ZapIcon />, tone: 'text-brand' },
  // Invites, approvals and confirmations (sections 3.5, 7, 8). The contract does not list these kinds; unknown kinds still render generically.
  invite: { icon: <QrCodeIcon />, tone: 'text-brand' },
  attach_request: { icon: <HourglassIcon />, tone: 'text-warning' },
  approval: { icon: <ShieldCheckIcon />, tone: 'text-success' },
  confirm: { icon: <ShieldCheckIcon />, tone: 'text-warning' },
  denied: { icon: <ShieldXIcon />, tone: 'text-destructive' },
}

function TimelineCard({ events, className }: { events: TimelineEvent[]; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [unseen, setUnseen] = useState(0)
  const prevCount = useRef(0)
  const last = events.at(-1)
  const signature = `${events.length}:${last?.at ?? 0}`
  const t = useT().devices.detail.timeline
  const kindLabels: Record<string, string | undefined> = t.kinds

  // Keep the newest event in view unless the user has scrolled up to read older ones.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const added = Math.max(0, events.length - prevCount.current)
    prevCount.current = events.length
    if (stick.current) {
      el.scrollTop = el.scrollHeight
      setUnseen(0)
    } else if (added) {
      setUnseen((n) => n + added)
    }
  }, [signature])

  const jumpToBottom = () => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    stick.current = true
    setUnseen(0)
  }

  return (
    <Card className={cn('gap-0 pb-0', className)}>
      <CardHeader className="pb-4">
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <div className="relative border-t">
        {events.length === 0 ? (
          <EmptyState className="py-10" icon={<CircleDotIcon />} title={t.empty} description={t.emptyHint} />
        ) : (
          <div
            ref={scroller}
            className="h-[26rem] overflow-y-auto overscroll-contain px-2 py-2 lg:h-[32rem]"
            onScroll={(e) => {
              const el = e.currentTarget
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
              if (stick.current && unseen) setUnseen(0)
            }}
          >
            <ol className="space-y-0.5">
              {events.map((ev, i) => {
                const meta = kindMeta[ev.kind] ?? { icon: <CircleDotIcon />, tone: 'text-muted-foreground' }
                const label = kindLabels[ev.kind] ?? ev.kind
                return (
                  <li
                    key={`${ev.at}-${i}`}
                    className="flex items-start gap-2.5 rounded-md px-3 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <span className="w-16 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums" title={formatDate(ev.at)}>
                      {formatClock(ev.at)}
                    </span>
                    <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', meta.tone)} title={label}>
                      {meta.icon}
                    </span>
                    {ev.page && (
                      <Badge variant="outline" className="mt-px shrink-0 px-1.5 font-mono text-[11px]">
                        {ev.page}
                      </Badge>
                    )}
                    <span
                      className={cn(
                        'min-w-0 flex-1 break-words',
                        (ev.kind === 'error' || ev.kind === 'console_error') && 'font-mono text-xs leading-5 text-destructive',
                      )}
                    >
                      {ev.summary}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
        {unseen > 0 && (
          <Button
            size="xs"
            variant="brand"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md"
            onClick={jumpToBottom}
          >
            <ArrowDownIcon />
            {t.newEvents(unseen)}
          </Button>
        )}
      </div>
    </Card>
  )
}
