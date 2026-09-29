import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import {
  BookOpenTextIcon,
  BotIcon,
  FileStackIcon,
  FolderIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  SmartphoneIcon,
  UserIcon,
  WifiIcon,
  XIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'

import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { LiveIndicator } from '@/components/live-indicator'
import { DeviceSystemLabel, OsIcon, osKind, osNames } from '@/components/os-icon'
import { PageHeader } from '@/components/page-header'
import { Pagination } from '@/components/pagination'
import { InlineError } from '@/components/route-states'
import { ControlBadge, HelpBadge, InvitedBadge, LevelBadge, OnlineDot, PendingBadge } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getLang, rich, useT } from '@/i18n'
import { formatCount, formatDate, relativeTime } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { allDevicesQuery, projectsQuery, statusQuery } from '@/lib/queries'
import { useOrgStream } from '@/lib/stream'
import type { Device, DeviceListParams, DeviceListStatus } from '@/lib/types'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

export type DevicesSearch = {
  q?: string
  status?: DeviceListStatus
  project?: string
  page?: number
  pageSize?: number
}

export const DEFAULT_PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300
/** Devices that came online this recently get a "new" tag. */
const FRESH_MS = 2 * 60_000

export function validateDevicesSearch(search: Record<string, unknown>): DevicesSearch {
  const int = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    return Number.isInteger(n) && n > 0 ? n : undefined
  }
  const page = int(search.page)
  const pageSize = int(search.pageSize)
  return {
    q: typeof search.q === 'string' && search.q.trim() ? search.q : undefined,
    status: search.status === 'all' ? 'all' : undefined,
    project: typeof search.project === 'string' && search.project ? search.project : undefined,
    page: page && page > 1 ? page : undefined,
    pageSize: pageSize && pageSize !== DEFAULT_PAGE_SIZE ? Math.min(pageSize, 100) : undefined,
  }
}

/** The list the user last looked at, so a device page can link back to the same page and filters. */
export let lastDevicesSearch: DevicesSearch = {}

const route = getRouteApi('/auth/')

export function DevicesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const params: DeviceListParams = {
    status: search.status ?? 'online',
    q: search.q?.trim() ?? '',
    project: search.project ?? '',
    page: search.page ?? 1,
    pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
  }
  const stream = useOrgStream()
  const list = useQuery(allDevicesQuery(params, stream === 'live'))
  const projects = useQuery(projectsQuery)
  const manage = useCan('project.manage')
  const t = useT()
  lastDevicesSearch = search

  const update = (patch: Partial<DevicesSearch>, resetPage = true) =>
    void navigate({
      search: (prev) => validateDevicesSearch({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }),
      replace: true,
    })

  // The list shrank under us (devices went offline): stay on the last page that exists.
  const total = list.data?.total
  useEffect(() => {
    if (total === undefined || list.isPlaceholderData) return
    const pages = Math.max(1, Math.ceil(total / params.pageSize))
    if (params.page > pages) update({ page: pages }, false)
  }, [total, params.page, params.pageSize, list.isPlaceholderData])

  const filtered = !!params.q || !!params.project
  const devices = list.data?.devices ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.devices.list.title}
        description={t.devices.list.description}
        actions={<LiveIndicator status={stream} />}
      />

      <StatsStrip />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:p-4">
          <SearchBox value={search.q ?? ''} onChange={(q) => update({ q: q || undefined })} />
          <div className="flex items-center gap-2">
            <ToggleGroup
              value={[params.status]}
              onValueChange={(v) => v[0] && update({ status: v[0] === 'all' ? 'all' : undefined })}
              aria-label={t.devices.list.scope}
            >
              <ToggleGroupItem value="online">
                <WifiIcon className="size-3.5" />
                {t.devices.list.online}
              </ToggleGroupItem>
              <ToggleGroupItem value="all">{t.devices.list.allDevices}</ToggleGroupItem>
            </ToggleGroup>
            <NativeSelect
              className="min-w-0 flex-1 sm:w-40 sm:flex-none"
              aria-label={t.devices.list.filterByProject}
              value={params.project}
              onChange={(e) => update({ project: e.target.value || undefined })}
            >
              <option value="">{t.devices.list.allProjects}</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <ResultBar
          loading={list.isFetching}
          total={list.data?.total}
          params={params}
          onClear={() => update({ q: undefined, project: undefined })}
          filtered={filtered}
        />

        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError && !list.data ? (
          <InlineError error={list.error} onRetry={() => list.refetch()} />
        ) : devices.length === 0 ? (
          <EmptyDevices
            params={params}
            manage={manage}
            onClear={() => update({ q: undefined, project: undefined })}
            onAll={() => update({ status: 'all' })}
          />
        ) : (
          <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
            <DeviceTable devices={devices} />
            <DeviceCards devices={devices} />
          </div>
        )}

        {list.data && list.data.total > 0 && (
          <Pagination
            className="border-t px-3 py-3 sm:px-4"
            page={params.page}
            pageSize={params.pageSize}
            total={list.data.total}
            onPage={(page) => {
              update({ page }, false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onPageSize={(pageSize) => update({ pageSize })}
          />
        )}
      </Card>
    </div>
  )
}

function StatsStrip() {
  const status = useQuery(statusQuery)
  const d = status.data
  const t = useT().devices.stats
  const tiles: { label: string; value?: number; sub?: string; icon: React.ReactNode; tone: string }[] = [
    {
      label: t.onlineDevices,
      value: d?.onlineDevices,
      sub: d ? t.totalSeen(formatCount(d.totalDevices)) : undefined,
      icon: <SmartphoneIcon />,
      tone: 'bg-success/12 text-success',
    },
    {
      label: t.connectedPages,
      value: d?.connectedPages,
      sub: d ? t.websockets(formatCount(d.wsConnections)) : undefined,
      icon: <FileStackIcon />,
      tone: 'bg-brand-soft text-brand',
    },
    {
      label: t.agentsConnected,
      value: d?.attachedAgents,
      sub:
        d && (d.helpDevices || d.pendingApprovals)
          ? [d.helpDevices ? t.asking(d.helpDevices) : '', d.pendingApprovals ? t.pendingApprovals(d.pendingApprovals) : '']
              .filter(Boolean)
              .join(' · ')
          : t.agentsHint,
      icon: <BotIcon />,
      tone: 'bg-[oklch(0.95_0.04_300)] text-[oklch(0.5_0.2_300)] dark:bg-[oklch(0.3_0.08_300)] dark:text-[oklch(0.8_0.12_300)]',
    },
    {
      label: t.projects,
      value: d?.projects,
      sub: t.projectsHint,
      icon: <FolderIcon />,
      tone: 'bg-warning-soft text-warning',
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t.overview}>
      {tiles.map((tile) => (
        <div key={tile.label} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs sm:px-4 sm:py-3.5">
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 [&_svg]:size-4 sm:[&_svg]:size-[18px]', tile.tone)}>
            {tile.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            {tile.value === undefined ? (
              <Skeleton className="mt-1 h-6 w-10" />
            ) : (
              <p className="text-lg leading-6 font-semibold tabular-nums sm:text-xl sm:leading-7">{formatCount(tile.value)}</p>
            )}
            {tile.sub && <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{tile.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [text, setText] = useState(value)
  const pushed = useRef(value)
  const input = useRef<HTMLInputElement>(null)
  const t = useT().devices.search

  // Follow outside changes (Clear filters, back/forward), not the echo of our own debounced update.
  useEffect(() => {
    if (value !== pushed.current) {
      pushed.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (text === pushed.current) return
    const timer = setTimeout(() => {
      pushed.current = text
      onChange(text.trim() ? text : '')
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  // "/" focuses the search box, like most consoles.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative min-w-0 flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={input}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={t.label}
        placeholder={t.placeholder}
        className="pr-16 pl-9 [&::-webkit-search-cancel-button]:hidden"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            e.preventDefault()
            setText('')
          }
        }}
      />
      {text ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
          aria-label={t.clear}
          onClick={() => {
            setText('')
            input.current?.focus()
          }}
        >
          <XIcon />
        </Button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:block">
          /
        </kbd>
      )}
    </div>
  )
}

function ResultBar({
  loading,
  total,
  params,
  filtered,
  onClear,
}: {
  loading: boolean
  total?: number
  params: DeviceListParams
  filtered: boolean
  onClear: () => void
}) {
  const projects = useQuery(projectsQuery)
  const projectName = projects.data?.find((p) => p.id === params.project)?.name
  const t = useT().devices.result
  return (
    <div className="flex min-h-10 items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:px-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span data-testid="device-total">
          {total === undefined
            ? t.loading
            : rich(t.total(total, params.status === 'online'), {
                n: (s) => <span className="font-medium text-foreground tabular-nums">{s}</span>,
              })}
        </span>
        {params.q && (
          <Badge variant="outline" className="font-normal">
            {t.matching(params.q)}
          </Badge>
        )}
        {projectName && (
          <Badge variant="outline" className="font-normal">
            <FolderIcon />
            {projectName}
          </Badge>
        )}
        {filtered && (
          <button type="button" className="text-brand hover:underline" onClick={onClear}>
            {t.clearFilters}
          </button>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <LoaderCircleIcon className={cn('size-3.5 animate-spin transition-opacity', loading ? 'opacity-100' : 'opacity-0')} />
        <span className="hidden sm:inline">{params.status === 'online' ? t.sortOnline : t.sortAll}</span>
      </span>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="divide-y" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="size-2 rounded-full" />
          <div className="w-36 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="hidden h-4 w-48 md:block" />
          <Skeleton className="hidden h-4 w-32 lg:block" />
          <Skeleton className="ml-auto h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

function EmptyDevices({
  params,
  manage,
  onClear,
  onAll,
}: {
  params: DeviceListParams
  manage: boolean
  onClear: () => void
  onAll: () => void
}) {
  const t = useT().devices.empty
  if (params.q || params.project) {
    return (
      <EmptyState
        icon={<SearchXIcon />}
        title={params.q ? t.noMatch(params.q) : t.noneInProject}
        description={
          params.status === 'online' ? t.searchHintOnline : t.searchHint
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onClear}>
              {t.clearFilters}
            </Button>
            {params.status === 'online' && (
              <Button variant="ghost" size="sm" onClick={onAll}>
                {t.showAll}
              </Button>
            )}
          </div>
        }
      />
    )
  }
  return (
    <EmptyState
      className="py-16"
      icon={<SmartphoneIcon />}
      title={params.status === 'online' ? t.noneOnline : t.noneEver}
      description={
        params.status === 'online' ? t.noneOnlineHint : t.noneEverHint
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="brand" size="sm" nativeButton={false} render={<Link to="/docs" />}>
            <BookOpenTextIcon />
            {t.setupGuide}
          </Button>
          {params.status === 'online' ? (
            <Button variant="outline" size="sm" onClick={onAll}>
              {t.showAll}
            </Button>
          ) : (
            manage && (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/projects" />}>
                <PlusIcon />
                {t.newProject}
              </Button>
            )
          )}
        </div>
      }
    />
  )
}

function shortId(id: string) {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

function pagePath(url: string) {
  try {
    const u = new URL(url)
    return u.host + (u.pathname === '/' ? '' : u.pathname) + u.search
  } catch {
    return url
  }
}

/** The date part of a timestamp: "2026-11-02" / "Nov 2" (the year only when it is not this year; the column is narrow). */
function formatDay(ms: number) {
  if (getLang() === 'zh') return formatDate(ms).slice(0, 10)
  const d = new Date(ms)
  const year = d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  return d.toLocaleDateString('en-US', { year, month: 'short', day: 'numeric' })
}

function StatusBadges({ d }: { d: Device }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-1">
      {d.help && <HelpBadge />}
      {d.pending ? (
        <PendingBadge pending={d.pending} />
      ) : d.control !== 'none' ? (
        <ControlBadge state={d.control} agent={d.agent} />
      ) : (
        !d.help && !d.invited && <span className="text-xs text-muted-foreground">{d.online ? t.devices.row.idle : '—'}</span>
      )}
      {d.level && d.control !== 'none' && !d.pending && <LevelBadge level={d.level} />}
      {d.invited && <InvitedBadge />}
    </div>
  )
}

function SinceCell({ d, now }: { d: Device; now: number }) {
  const t = useT().devices.row
  if (!d.online) {
    return (
      <span className="text-muted-foreground" title={t.lastOnline(formatDate(d.lastSeenAt))}>
        {t.offlineSince(relativeTime(d.lastSeenAt, now))}
      </span>
    )
  }
  const since = d.onlineSince ?? d.lastSeenAt
  const fresh = !!d.onlineSince && now - d.onlineSince < FRESH_MS
  return (
    <span className="inline-flex items-center gap-1.5" title={t.onlineSince(formatDate(since))}>
      {fresh && (
        <Badge variant="success" className="px-1.5 py-0 text-[10px]">
          {t.fresh}
        </Badge>
      )}
      <span className="text-foreground">{t.cameOnline(relativeTime(since, now))}</span>
    </span>
  )
}

function CodeAndId({ d, linkClassName }: { d: Device; linkClassName?: string }) {
  const t = useT().devices.row
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <OnlineDot online={d.online} />
        <Link
          to="/devices/$deviceId"
          params={{ deviceId: d.id }}
          className={cn(
            'rounded-sm font-mono text-[15px] font-semibold tracking-wider outline-none hover:text-brand focus-visible:ring-[3px] focus-visible:ring-ring',
            linkClassName,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {d.code}
        </Link>
        <CopyButton
          value={d.code}
          variant="ghost"
          size="icon-xs"
          ariaLabel={t.copyCode}
          toastLabel={t.codeCopied(d.code)}
          className="size-6 text-muted-foreground [&_svg]:size-3.5"
        />
      </div>
      <div className="mt-0.5 flex items-center gap-1 pl-3.5 text-[11px] text-muted-foreground">
        <span className="truncate font-mono" title={d.id} data-testid="device-id">
          {shortId(d.id)}
        </span>
        <CopyButton
          value={d.id}
          variant="ghost"
          size="icon-xs"
          ariaLabel={t.copyId}
          toastLabel={t.idCopied}
          className="size-5 text-muted-foreground [&_svg]:size-3"
        />
      </div>
    </div>
  )
}

/** Line 1: OS, version, model. Line 2: browser / WebView host and the App. */
function SystemCell({ d }: { d: Device }) {
  const t = useT()
  const kind = osKind(d.system, d.platform)
  const os = d.system ? [`${d.system.os} ${d.system.osVersion}`.trim(), d.system.model].filter(Boolean).join(' · ') : ''
  const host = [d.system?.browser, d.app ? `${d.app.name} ${d.app.version}` : t.devices.row.h5Page].filter(Boolean).join(' · ')
  return (
    <div className="flex min-w-0 items-start gap-2" title={d.ua || d.system?.label}>
      <OsIcon kind={kind} className="mt-px" />
      <div className="min-w-0">
        <p className="truncate">{os || osNames[kind]}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{host}</p>
      </div>
    </div>
  )
}

function DeviceTable({ devices }: { devices: Device[] }) {
  const navigate = useNavigate()
  const now = useNow(15_000)
  const t = useT().devices
  return (
    <div className="hidden lg:block">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[13rem]" />
          <col className="w-[14.5rem]" />
          <col className="w-[10.5rem]" />
          <col />
          <col className="w-[12rem]" />
          <col className="w-[8.5rem]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">{t.table.device}</TableHead>
            <TableHead>{t.table.systemApp}</TableHead>
            <TableHead>{t.table.userProject}</TableHead>
            <TableHead>{t.table.currentPage}</TableHead>
            <TableHead>{t.table.status}</TableHead>
            <TableHead className="pr-4 text-right">{t.table.since}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((d) => (
            <TableRow
              key={d.id}
              data-device-row={d.code}
              className={cn(
                'group cursor-pointer',
                d.help && 'bg-destructive-soft/50 hover:bg-destructive-soft/80 dark:bg-destructive-soft/30 dark:hover:bg-destructive-soft/50',
                !d.online && 'text-muted-foreground',
              )}
              onClick={() => void navigate({ to: '/devices/$deviceId', params: { deviceId: d.id } })}
            >
              <TableCell className={cn('py-3 pl-4', d.help && 'shadow-[inset_3px_0_0_var(--destructive)]')}>
                <CodeAndId d={d} />
              </TableCell>
              <TableCell className="py-3">
                <SystemCell d={d} />
              </TableCell>
              <TableCell className="py-3">
                <p className="truncate font-mono text-[13px]" title={d.userId ?? undefined}>
                  {d.userId ?? <span className="font-sans text-muted-foreground">{t.row.notSignedIn}</span>}
                </p>
                <ProjectLink d={d} />
              </TableCell>
              <TableCell className="py-3">
                {d.currentPage ? (
                  <div className="min-w-0" title={d.currentPage.url}>
                    <p className="truncate">
                      <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{d.currentPage.label}</span>
                      {d.currentPage.title || t.row.untitled}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{pagePath(d.currentPage.url)}</p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{d.online ? t.row.reconnecting : '—'}</span>
                )}
              </TableCell>
              <TableCell className="py-3 whitespace-normal">
                <StatusBadges d={d} />
              </TableCell>
              <TableCell className="py-3 pr-4 text-right text-[13px]">
                <SinceCell d={d} now={now} />
                <p className="mt-0.5 text-[11px] text-muted-foreground" title={formatDate(d.firstSeenAt)}>
                  {t.row.firstSeen(formatDay(d.firstSeenAt))}
                </p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** The projects of the device's open pages (one phone may open several integrations). */
function ProjectLink({ d }: { d: Device }) {
  const projects = useQuery(projectsQuery)
  const ids = d.projects?.length ? d.projects : [d.projectId]
  const nameOf = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? (id === d.projectId ? d.projectName : undefined) ?? id
  return (
    <span className="mt-1 flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      {ids.map((id) => (
        <Link
          key={id}
          to="/projects/$projectId"
          params={{ projectId: id }}
          className="inline-flex max-w-full items-center gap-1 hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <FolderIcon className="size-3 shrink-0" />
          <span className="truncate">{nameOf(id)}</span>
        </Link>
      ))}
    </span>
  )
}

function DeviceCards({ devices }: { devices: Device[] }) {
  const navigate = useNavigate()
  const now = useNow(15_000)
  const t = useT().devices.row
  return (
    <ul className="divide-y lg:hidden">
      {devices.map((d) => (
        <li
          key={d.id}
          data-device-card={d.code}
          className={cn(
            'cursor-pointer space-y-2.5 px-4 py-3.5 transition-colors hover:bg-muted/40 active:bg-muted/60',
            d.help && 'bg-destructive-soft/50 shadow-[inset_3px_0_0_var(--destructive)] dark:bg-destructive-soft/30',
          )}
          onClick={() => void navigate({ to: '/devices/$deviceId', params: { deviceId: d.id } })}
        >
          <div className="flex items-start justify-between gap-3">
            <CodeAndId d={d} />
            <span className="shrink-0 pt-0.5 text-right text-xs">
              <SinceCell d={d} now={now} />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-3.5 text-[13px]">
            <DeviceSystemLabel device={d} className="max-w-full" />
            <span className="text-xs text-muted-foreground">{d.app ? `${d.app.name} ${d.app.version}` : t.h5Page}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-3.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserIcon className="size-3" />
              <span className="font-mono">{d.userId ?? t.notSignedIn}</span>
            </span>
            <ProjectLink d={d} />
          </div>
          {d.currentPage && (
            <p className="truncate pl-3.5 text-xs" title={d.currentPage.url}>
              <span className="mr-1 font-mono text-[11px] text-muted-foreground">{d.currentPage.label}</span>
              {d.currentPage.title || t.untitled}
              <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{pagePath(d.currentPage.url)}</span>
            </p>
          )}
          {(d.help || d.pending || d.control !== 'none' || d.invited) && (
            <div className="pl-3.5">
              <StatusBadges d={d} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
