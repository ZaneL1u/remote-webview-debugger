import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  BotIcon,
  ChevronRightIcon,
  CogIcon,
  FilterXIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  ScrollTextIcon,
  SmartphoneIcon,
  UserIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'

import { CodeBlock } from '@/components/code-block'
import { EmptyState } from '@/components/empty-state'
import { InlineError } from '@/components/route-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { locale, useT } from '@/i18n'
import { actionGroups, actionLabel, actorTypeLabel, detailSummary, resultLabel } from '@/lib/audit'
import { formatDate, formatShortDate } from '@/lib/format'
import { auditQuery, projectsQuery } from '@/lib/queries'
import type { AuditEvent, AuditFilters } from '@/lib/types'
import { cn } from '@/lib/utils'

// Labels: members.audit.ranges in the catalogs.
const ranges: { value: 'all' | '1h' | '24h' | '7d' | '30d' | 'custom'; ms?: number }[] = [
  { value: 'all' },
  { value: '1h', ms: 3_600_000 },
  { value: '24h', ms: 86_400_000 },
  { value: '7d', ms: 7 * 86_400_000 },
  { value: '30d', ms: 30 * 86_400_000 },
  { value: 'custom' },
]

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/** `datetime-local` value (local time) -> ms, or undefined. */
function parseLocal(value: string) {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? undefined : ms
}

/**
 * Audit log (docs/protocol.md section 12.7), newest first, paged with `before`.
 * With `projectId` it is scoped to that project; without it, it is the organization-wide log.
 */
export function AuditLog({ projectId }: { projectId?: string }) {
  const t = useT().members.audit
  const [project, setProject] = useState('')
  const [action, setAction] = useState('')
  const [device, setDevice] = useState('')
  const [actor, setActor] = useState('')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  // Re-anchor relative ranges ("last hour") whenever the filters change, not on every render.
  const [anchor, setAnchor] = useState(() => Date.now())
  const projects = useQuery({ ...projectsQuery, enabled: !projectId, refetchInterval: false })

  const debouncedDevice = useDebounced(device.trim())
  const debouncedActor = useDebounced(actor.trim())

  const filters = useMemo<AuditFilters>(() => {
    const preset = ranges.find((r) => r.value === range)
    return {
      project: projectId ?? (project || undefined),
      action: action || undefined,
      device: debouncedDevice || undefined,
      actor: debouncedActor || undefined,
      from: range === 'custom' ? parseLocal(from) : preset?.ms ? anchor - preset.ms : undefined,
      to: range === 'custom' ? parseLocal(to) : undefined,
    }
  }, [projectId, project, action, debouncedDevice, debouncedActor, range, from, to, anchor])

  const audit = useInfiniteQuery(auditQuery(filters))
  const events = useMemo(() => audit.data?.pages.flatMap((p) => p.events) ?? [], [audit.data])
  const filtered = !!(project || action || device || actor || range !== 'all')

  const clear = () => {
    setProject('')
    setAction('')
    setDevice('')
    setActor('')
    setRange('all')
    setFrom('')
    setTo('')
  }

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-2 sm:grid-cols-2', projectId ? 'lg:grid-cols-4' : 'lg:grid-cols-5')}>
        {!projectId && (
          <NativeSelect aria-label={t.project} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">{t.allProjects}</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect aria-label={t.actionType} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{t.allActions}</option>
          {actionGroups.map((g) => (
            <optgroup key={g.key} label={t.groups[g.key]}>
              {g.actions.map((value) => (
                <option key={value} value={value}>
                  {t.actions[value]}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t.timeRange}
          value={range}
          onChange={(e) => {
            setRange(e.target.value)
            setAnchor(Date.now())
          }}
        >
          {ranges.map((r) => (
            <option key={r.value} value={r.value}>
              {t.ranges[r.value]}
            </option>
          ))}
        </NativeSelect>
        <Input aria-label={t.device} placeholder={t.devicePlaceholder} value={device} onChange={(e) => setDevice(e.target.value)} />
        <Input aria-label={t.actor} placeholder={t.actorPlaceholder} value={actor} onChange={(e) => setActor(e.target.value)} />
      </div>
      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input type="datetime-local" aria-label={t.from} className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-muted-foreground">{t.rangeSeparator}</span>
          <Input type="datetime-local" aria-label={t.to} className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}
      {filtered && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{audit.isSuccess ? t.loaded(events.length, audit.hasNextPage) : ' '}</span>
          <Button variant="ghost" size="xs" onClick={clear}>
            <FilterXIcon />
            {t.clearFilters}
          </Button>
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {audit.isPending ? (
          <div className="divide-y">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-12" />
              </div>
            ))}
          </div>
        ) : audit.isError ? (
          <InlineError error={audit.error} onRetry={() => audit.refetch()} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<ScrollTextIcon />}
            title={filtered ? t.noMatches : t.empty}
            description={filtered ? t.noMatchesHint : t.emptyHint}
            action={
              filtered && (
                <Button variant="outline" size="sm" onClick={clear}>
                  {t.clearFilters}
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y" aria-label={t.listLabel}>
            {events.map((e) => (
              <AuditRow key={e.id} event={e} showProject={!projectId} projectName={projects.data?.find((p) => p.id === e.projectId)?.name} />
            ))}
          </ul>
        )}
      </Card>

      {audit.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => audit.fetchNextPage()} disabled={audit.isFetchingNextPage}>
            {audit.isFetchingNextPage && <LoaderCircleIcon className="animate-spin" />}
            {t.loadMore}
          </Button>
        </div>
      )}
      {audit.isSuccess && !audit.hasNextPage && events.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">{t.end}</p>
      )}
    </div>
  )
}

const actorIcons: Record<AuditEvent['actorType'], React.ReactNode> = {
  member: <UserIcon />,
  apikey: <KeyRoundIcon />,
  device: <SmartphoneIcon />,
  system: <CogIcon />,
}

function ResultBadge({ result }: { result: AuditEvent['result'] }) {
  return (
    <Badge variant={result === 'ok' ? 'success' : result === 'denied' ? 'warning' : 'destructive'}>
      {resultLabel(result)}
    </Badge>
  )
}

function AuditRow({ event: e, showProject, projectName }: { event: AuditEvent; showProject: boolean; projectName?: string }) {
  const t = useT().members.audit
  const [open, setOpen] = useState(false)
  const summary = detailSummary(e)
  const hasDetail = e.detail && Object.keys(e.detail).length > 0

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRightIcon
          className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90', !hasDetail && 'opacity-30')}
        />
        {/* Phones: action and result first, then time and actor. */}
        <div className="min-w-0 flex-1 space-y-0.5 md:hidden">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="font-medium">{actionLabel(e.action)}</span>
              {e.target && <span className="ml-1.5 font-mono text-xs break-all text-muted-foreground">{e.target}</span>}
            </span>
            <ResultBadge result={e.result} />
          </div>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0 font-mono tabular-nums">{formatShortDate(e.at)}</span>
            <span className="shrink-0 [&_svg]:size-3">{actorIcons[e.actorType] ?? <BotIcon />}</span>
            <span className="truncate">{e.actorName || e.actorId}</span>
            {showProject && projectName && <span className="truncate">· {projectName}</span>}
          </p>
          {summary && <p className="truncate text-xs text-muted-foreground">{summary}</p>}
        </div>
        <div className="hidden min-w-0 flex-1 gap-x-4 md:grid md:grid-cols-[9.5rem_minmax(0,11rem)_minmax(0,1fr)_auto] md:items-center">
          <span className="font-mono text-xs text-muted-foreground tabular-nums" title={new Date(e.at).toLocaleString(locale())}>
            {formatDate(e.at)}
          </span>
          <span className="flex min-w-0 items-center gap-1.5" title={`${actorTypeLabel(e.actorType)} · ${e.actorId}`}>
            <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">{actorIcons[e.actorType] ?? <BotIcon />}</span>
            <span className="truncate">{e.actorName || e.actorId}</span>
          </span>
          <span className="min-w-0 space-y-0.5">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-medium">{actionLabel(e.action)}</span>
              {e.target && <span className="truncate font-mono text-xs text-muted-foreground">{e.target}</span>}
              {showProject && projectName && <Badge variant="outline">{projectName}</Badge>}
            </span>
            {summary && <span className="block truncate text-xs text-muted-foreground">{summary}</span>}
          </span>
          <span className="justify-self-end">
            <ResultBadge result={e.result} />
          </span>
        </div>
      </button>
      {open && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3 pl-11 text-xs">
          <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">{t.detail.action}</dt>
            <dd className="font-mono">{e.action}</dd>
            <dt className="text-muted-foreground">{t.detail.actor}</dt>
            <dd className="break-all">
              {actorTypeLabel(e.actorType)} · <span className="font-mono">{e.actorId}</span>
            </dd>
            <dt className="text-muted-foreground">{t.detail.id}</dt>
            <dd className="font-mono">{e.id}</dd>
          </dl>
          {hasDetail ? (
            <CodeBlock code={JSON.stringify(e.detail, null, 2)} maxHeight="16rem" />
          ) : (
            <p className="text-muted-foreground">{t.detail.none}</p>
          )}
        </div>
      )}
    </li>
  )
}
