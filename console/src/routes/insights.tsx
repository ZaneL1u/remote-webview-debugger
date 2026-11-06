import { useQuery } from '@tanstack/react-query'
import {
  ActivityIcon,
  BotIcon,
  CableIcon,
  CalendarCheckIcon,
  CpuIcon,
  FileStackIcon,
  GaugeIcon,
  HandHelpingIcon,
  HistoryIcon,
  HourglassIcon,
  MemoryStickIcon,
  ServerIcon,
  TabletSmartphoneIcon,
  TimerIcon,
  WorkflowIcon,
} from 'lucide-react'
import type * as React from 'react'

import { PageHeader } from '@/components/page-header'
import { Forbidden } from '@/components/route-states'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { locale, useT } from '@/i18n'
import { formatCount, formatDuration } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { insightsQuery } from '@/lib/queries'
import type { Insights } from '@/lib/types'
import { cn } from '@/lib/utils'

function bytes(n: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toLocaleString(locale(), { maximumFractionDigits: n < 10 && i > 0 ? 1 : 0 })} ${units[i]}`
}

export function InsightsPage() {
  const allowed = useCan('audit.org')
  const tr = useT()
  const t = tr.shell.insights
  const q = useQuery({ ...insightsQuery, enabled: allowed })
  const d = q.data
  return (
    <div className="space-y-8">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          allowed && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50 [animation-duration:2.4s]" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              {t.refresh}
            </span>
          )
        }
      />
      {!allowed ? (
        <Card>
          <Forbidden description={tr.members.audit.forbidden} />
        </Card>
      ) : (
        <>
          <DebugSection d={d} />
          <LiveSection d={d} />
          <LoadSection d={d} />
        </>
      )}
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground/90 [&_svg]:size-4 [&_svg]:text-muted-foreground">
      {icon}
      {children}
    </h2>
  )
}

function Num({ value, className }: { value?: number; className?: string }) {
  return value === undefined ? (
    <Skeleton className="h-8 w-20" />
  ) : (
    <span className={cn('font-semibold tracking-tight tabular-nums', className)}>{formatCount(value)}</span>
  )
}

/** The three numbers people ask about, then the last two weeks. */
function DebugSection({ d }: { d?: Insights }) {
  const t = useT().shell.insights
  const dbg = d?.debug
  const hero: { label: string; value?: number; icon: React.ReactNode; tone: string; sub?: React.ReactNode }[] = [
    {
      label: t.today,
      value: dbg?.today,
      icon: <CalendarCheckIcon />,
      tone: 'from-brand/15 text-brand',
      sub: dbg && <Split agent={dbg.todayAgent} devtools={dbg.todayDevtools} />,
    },
    {
      label: t.total,
      value: dbg?.total,
      icon: <HistoryIcon />,
      tone: 'from-[oklch(0.65_0.17_300)]/15 text-[oklch(0.55_0.2_300)] dark:text-[oklch(0.8_0.12_300)]',
      sub: dbg && <Split agent={dbg.totalAgent} devtools={dbg.totalDevtools} />,
    },
    {
      label: t.devices,
      value: dbg?.devices,
      icon: <TabletSmartphoneIcon />,
      tone: 'from-success/15 text-success',
      sub: dbg && (
        <span>
          {t.today} <span className="font-medium text-foreground tabular-nums">{formatCount(dbg.devicesToday)}</span>
        </span>
      ),
    },
  ]
  return (
    <section className="space-y-3">
      <SectionTitle icon={<WorkflowIcon />}>{t.debug}</SectionTitle>
      <div className="grid gap-3 md:grid-cols-3">
        {hero.map((h) => (
          <div key={h.label} className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs">
            <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent to-60% opacity-80', h.tone)} />
            <div className="relative flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{h.label}</p>
                <Num value={h.value} className="text-4xl" />
              </div>
              <span className={cn('flex size-10 items-center justify-center rounded-xl bg-background/70 ring-1 ring-border/60 [&_svg]:size-5', h.tone)}>
                {h.icon}
              </span>
            </div>
            <div className="relative mt-3 text-xs text-muted-foreground">{h.sub}</div>
          </div>
        ))}
      </div>
      <DaysChart days={dbg?.days} />
    </section>
  )
}

function Split({ agent, devtools }: { agent: number; devtools: number }) {
  const t = useT().shell.insights
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-brand" />
        {t.legendAgent} <span className="font-medium text-foreground tabular-nums">{formatCount(agent)}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[oklch(0.72_0.14_200)]" />
        {t.legendDevtools} <span className="font-medium text-foreground tabular-nums">{formatCount(devtools)}</span>
      </span>
    </span>
  )
}

function DaysChart({ days }: { days?: Insights['debug']['days'] }) {
  const t = useT().shell.insights
  const max = Math.max(1, ...(days ?? []).map((d) => d.agent + d.devtools))
  const fmt = new Intl.DateTimeFormat(locale(), { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{t.chart}</p>
        <Split agent={(days ?? []).reduce((n, d) => n + d.agent, 0)} devtools={(days ?? []).reduce((n, d) => n + d.devtools, 0)} />
      </div>
      {!days ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="flex h-44 items-end gap-1.5 sm:gap-2.5">
          {days.map((d, i) => {
            const total = d.agent + d.devtools
            const today = i === days.length - 1
            return (
              <div key={d.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                  {total}
                </span>
                <div
                  className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-md bg-muted/60"
                  style={{ height: `${Math.max(total ? 6 : 2, (total / max) * 100)}%` }}
                  title={`${fmt.format(new Date(d.day * 86_400_000))} · ${t.legendAgent} ${d.agent} · ${t.legendDevtools} ${d.devtools}`}
                >
                  <div className="bg-brand transition-all" style={{ height: total ? `${(d.agent / total) * 100}%` : 0 }} />
                  <div className="bg-[oklch(0.72_0.14_200)] transition-all" style={{ height: total ? `${(d.devtools / total) * 100}%` : 0 }} />
                </div>
                <span className={cn('text-[10px] text-muted-foreground tabular-nums sm:text-[11px]', today && 'font-semibold text-foreground', i % 2 && 'max-sm:invisible')}>
                  {fmt.format(new Date(d.day * 86_400_000))}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LiveSection({ d }: { d?: Insights }) {
  const t = useT().shell.insights
  const l = d?.live
  const tiles: { label: string; value?: number; icon: React.ReactNode; tone: string }[] = [
    { label: t.ws, value: l?.wsConnections, icon: <CableIcon />, tone: 'bg-brand-soft text-brand' },
    { label: t.pages, value: l?.connectedPages, icon: <FileStackIcon />, tone: 'bg-brand-soft text-brand' },
    { label: t.online, value: l?.onlineDevices, icon: <TabletSmartphoneIcon />, tone: 'bg-success/12 text-success' },
    {
      label: t.agents,
      value: l?.attachedAgents,
      icon: <BotIcon />,
      tone: 'bg-[oklch(0.95_0.04_300)] text-[oklch(0.5_0.2_300)] dark:bg-[oklch(0.3_0.08_300)] dark:text-[oklch(0.8_0.12_300)]',
    },
    { label: t.help, value: l?.helpDevices, icon: <HandHelpingIcon />, tone: 'bg-success/12 text-success' },
    { label: t.pending, value: l?.pendingApprovals, icon: <HourglassIcon />, tone: 'bg-warning-soft text-warning' },
  ]
  return (
    <section className="space-y-3">
      <SectionTitle icon={<ActivityIcon />}>{t.live}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((x) => (
          <div key={x.label} className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
            <span className={cn('flex size-8 items-center justify-center rounded-lg [&_svg]:size-4', x.tone)}>{x.icon}</span>
            <div className="space-y-0.5">
              <Num value={x.value} className="text-2xl" />
              <p className="truncate text-xs text-muted-foreground">{x.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Meter({ value, tone = 'bg-brand' }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-[width] duration-700', v > 85 ? 'bg-destructive' : v > 60 ? 'bg-warning' : tone)}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

function LoadCard({ icon, label, hint, value, meter }: { icon: React.ReactNode; label: string; hint?: string; value: React.ReactNode; meter?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
        {icon}
        <span className="truncate">{label}</span>
        {hint && <span className="ms-auto truncate text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
      <div className="text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      {meter}
    </div>
  )
}

function LoadSection({ d }: { d?: Insights }) {
  const t = useT().shell.insights
  const r = d?.runtime
  const na = <span className="text-sm font-normal text-muted-foreground">{t.na}</span>
  if (!r) {
    return (
      <section className="space-y-3">
        <SectionTitle icon={<GaugeIcon />}>{t.load}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </section>
    )
  }
  const cpu = r.cpuPercent
  const hostUsed = r.memTotalBytes && r.memAvailableBytes !== undefined ? r.memTotalBytes - r.memAvailableBytes : undefined
  return (
    <section className="space-y-3">
      <SectionTitle icon={<GaugeIcon />}>{t.load}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <LoadCard
          icon={<CpuIcon />}
          label={t.cpu}
          hint={t.cpuHint}
          value={cpu === undefined ? na : `${cpu.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`}
          meter={cpu !== undefined && <Meter value={cpu / Math.max(1, r.cpus)} />}
        />
        <LoadCard
          icon={<MemoryStickIcon />}
          label={t.memory}
          hint={t.memoryHint}
          value={
            <>
              {bytes(r.heapBytes)} <span className="text-sm font-normal text-muted-foreground">/ {bytes(r.sysBytes)}</span>
            </>
          }
          meter={<Meter value={(r.heapBytes / Math.max(1, r.sysBytes)) * 100} />}
        />
        <LoadCard
          icon={<ServerIcon />}
          label={t.hostMemory}
          value={
            hostUsed === undefined ? (
              na
            ) : (
              <>
                {bytes(hostUsed)} <span className="text-sm font-normal text-muted-foreground">/ {bytes(r.memTotalBytes!)}</span>
              </>
            )
          }
          meter={hostUsed !== undefined && <Meter value={(hostUsed / r.memTotalBytes!) * 100} tone="bg-success" />}
        />
        <LoadCard
          icon={<GaugeIcon />}
          label={t.hostLoad}
          hint={t.hostLoadHint}
          value={
            r.load ? (
              <span className="flex items-baseline gap-2">
                {r.load.map((v, i) => (
                  <span key={i} className={cn(i > 0 && 'text-base font-normal text-muted-foreground')}>
                    {v.toFixed(2)}
                  </span>
                ))}
                <span className="text-xs font-normal text-muted-foreground">/ {r.cpus} CPU</span>
              </span>
            ) : (
              na
            )
          }
          meter={r.load && <Meter value={(r.load[0] / Math.max(1, r.cpus)) * 100} />}
        />
        <LoadCard icon={<WorkflowIcon />} label={t.goroutines} hint={r.os} value={formatCount(r.goroutines)} />
        <LoadCard icon={<TimerIcon />} label={t.uptime} value={formatDuration(r.uptimeSec)} />
      </div>
    </section>
  )
}
