import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ActivityIcon,
  BookOpenIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  UnplugIcon,
} from 'lucide-react'
import type * as React from 'react'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { getT, useT } from '@/i18n'
import { ApiError, errorMessage } from '@/lib/api'
import { formatCount, formatDuration, relativeTime } from '@/lib/format'
import { configQuery, STATUS_POLL_MS, statusQuery } from '@/lib/queries'
import { type StreamState, useStreamState } from '@/lib/stream'
import type { MeasuredStatus } from '@/lib/types'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

export type GatewayHealth = 'checking' | 'connected' | 'degraded' | 'disconnected'

const SLOW_MS = 1500

const healthMeta: Record<GatewayHealth, { dot: string; text: string }> = {
  checking: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  connected: { dot: 'bg-success', text: 'text-foreground' },
  degraded: { dot: 'bg-warning', text: 'text-warning' },
  disconnected: { dot: 'bg-destructive', text: 'text-destructive' },
}

function useGatewayHealth() {
  const status = useQuery(statusQuery)
  const stream = useStreamState()
  const t = useT().shell.gateway
  // A gateway older than section 12.5 has no /status: report what we can.
  const legacy = status.error instanceof ApiError && status.error.status === 404
  const failing = status.isError && !legacy && status.errorUpdatedAt >= status.dataUpdatedAt
  const data = failing ? undefined : status.data

  let health: GatewayHealth
  const reasons: string[] = []
  if (failing) {
    health = 'disconnected'
  } else if (!data && !legacy) {
    health = 'checking'
  } else {
    health = 'connected'
    if (data && !data.ok) reasons.push(t.selfCheckFailed)
    if (data && data.rttMs > SLOW_MS) reasons.push(t.slow(data.rttMs))
    if (stream.status === 'down') reasons.push(t.streamDown)
    if (reasons.length) health = 'degraded'
  }
  return { status, data, legacy, health, reasons, stream }
}

function rttQuality(ms: number) {
  const t = getT().shell.gateway.rtt
  if (ms < 150) return { label: t.good, className: 'text-success' }
  if (ms < SLOW_MS) return { label: t.fair, className: 'text-warning' }
  return { label: t.slow, className: 'text-destructive' }
}

/** Header pill: connection state + latency, with a details popover. */
export function GatewayStatus({ className }: { className?: string }) {
  const { status, data, legacy, health, reasons, stream } = useGatewayHealth()
  const t = useT().shell.gateway
  const m = { ...healthMeta[health], label: t.health[health] }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2 px-2 font-normal text-muted-foreground hover:text-foreground', className)}
            aria-label={t.ariaLabel(m.label)}
            data-gateway={health}
          />
        }
      >
        <span className="relative flex size-2">
          {health === 'connected' && stream.status === 'live' && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40 [animation-duration:2.4s]" />
          )}
          <span className={cn('relative inline-flex size-2 rounded-full', m.dot)} />
        </span>
        <span className={cn('hidden text-xs font-medium lg:inline', m.text)}>{m.label}</span>
        {data && (
          <span className="hidden w-12 text-start font-mono text-[11px] text-muted-foreground tabular-nums md:inline">
            {data.rttMs} ms
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] p-0">
        <StatusDetails
          health={health}
          reasons={reasons}
          data={data}
          legacy={legacy}
          stream={stream}
          error={status.error}
          fetching={status.isFetching}
          refetch={() => void status.refetch()}
          lastOkAt={status.data?.checkedAt}
        />
      </PopoverContent>
    </Popover>
  )
}

function StatusDetails({
  health,
  reasons,
  data,
  legacy,
  stream,
  error,
  fetching,
  refetch,
  lastOkAt,
}: {
  health: GatewayHealth
  reasons: string[]
  data?: MeasuredStatus
  legacy: boolean
  stream: StreamState
  error: unknown
  fetching: boolean
  refetch: () => void
  lastOkAt?: number
}) {
  const now = useNow(1000)
  const config = useQuery(configQuery)
  const gatewayUrl = data?.gatewayUrl ?? config.data?.gatewayUrl
  const t = useT().shell.gateway
  const m = { ...healthMeta[health], label: t.health[health] }
  const icon =
    health === 'connected' ? (
      <CircleCheckIcon className="text-success" />
    ) : health === 'degraded' ? (
      <CircleAlertIcon className="text-warning" />
    ) : health === 'disconnected' ? (
      <UnplugIcon className="text-destructive" />
    ) : (
      <LoaderCircleIcon className="animate-spin text-muted-foreground" />
    )
  const summary =
    health === 'disconnected'
      ? t.unreachable(errorMessage(error), STATUS_POLL_MS / 1000)
      : health === 'degraded'
        ? t.reasons(reasons)
        : health === 'checking'
          ? t.checkingSummary
          : legacy
            ? t.legacySummary
            : t.okSummary
  const uptime = data ? data.uptimeSec + Math.max(0, Math.floor((now - data.checkedAt) / 1000)) : null

  return (
    <div className="divide-y" data-testid="gateway-status-details">
      <div className="flex gap-3 p-4">
        <span className="mt-0.5 [&_svg]:size-5">{icon}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <PopoverTitle className={cn('font-semibold', m.text)}>{t.title(m.label)}</PopoverTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-border">
        <Stat label={t.latency}>
          {data ? (
            <>
              <span className="font-mono tabular-nums">{data.rttMs} ms</span>
              <span className={cn('ms-1.5 text-xs', rttQuality(data.rttMs).className)}>{rttQuality(data.rttMs).label}</span>
            </>
          ) : (
            '—'
          )}
        </Stat>
        <Stat label={t.stream}>
          <span className="inline-flex items-center gap-1.5" data-stream-detail={stream.status}>
            <span
              className={cn(
                'size-1.5 rounded-full',
                stream.status === 'live' ? 'bg-success' : stream.status === 'down' ? 'bg-warning' : 'bg-muted-foreground/50',
              )}
            />
            {stream.status === 'live' ? t.streamLive : stream.status === 'down' ? t.streamPolling : t.streamConnecting}
          </span>
        </Stat>
        <Stat label={t.onlineDevices}>
          <span className="tabular-nums">{formatCount(data?.onlineDevices)}</span>
          {data && <span className="text-xs text-muted-foreground"> / {formatCount(data.totalDevices)}</span>}
        </Stat>
        <Stat label={t.agents}>
          <span className="tabular-nums">{formatCount(data?.attachedAgents)}</span>
        </Stat>
        <Stat label={t.pages}>
          <span className="tabular-nums">{formatCount(data?.connectedPages)}</span>
          {data && <span className="text-xs text-muted-foreground"> · WS {formatCount(data.wsConnections)}</span>}
        </Stat>
        <Stat label={t.projects}>
          <span className="tabular-nums">{formatCount(data?.projects)}</span>
        </Stat>
        <Stat label={t.version}>
          <span className="font-mono text-xs">{data?.version ?? config.data?.version ?? '—'}</span>
        </Stat>
        <Stat label={t.sdkVersion}>
          <span className="font-mono text-xs">{data?.sdkVersion ?? config.data?.sdkVersion ?? '—'}</span>
        </Stat>
        <Stat label={t.uptime}>{uptime !== null ? formatDuration(uptime) : '—'}</Stat>
        <Stat label={t.database}>{data?.db ? dbLabel(data.db) : '—'}</Stat>
      </dl>

      {gatewayUrl && (
        <div className="space-y-1 px-4 py-3">
          <p className="text-xs text-muted-foreground">{t.url}</p>
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={gatewayUrl}>
              {gatewayUrl}
            </span>
            <CopyButton value={gatewayUrl} variant="ghost" toastLabel={t.urlCopied} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ActivityIcon className="size-3.5" />
          {data
            ? t.checkedAt(relativeTime(data.checkedAt, now))
            : lastOkAt
              ? t.lastOk(relativeTime(lastOkAt, now))
              : t.neverConnected}
          {stream.status === 'live' && stream.since
            ? now - stream.since < 60_000
              ? t.streamJustConnected
              : t.streamConnectedFor(formatDuration((now - stream.since) / 1000))
            : ''}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={refetch} disabled={fetching}>
            <RefreshCwIcon className={cn(fetching && 'animate-spin')} />
            {t.check}
          </Button>
          <Button variant="ghost" size="xs" nativeButton={false} render={<Link to="/docs" hash="troubleshoot" />}>
            <BookOpenIcon />
            {t.troubleshoot}
          </Button>
        </div>
      </div>
    </div>
  )
}

function dbLabel(db: string) {
  const d = db.toLowerCase()
  if (d.includes('postgres')) return 'PostgreSQL'
  if (d.includes('sqlite')) return 'SQLite'
  return db
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-popover px-4 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm">{children}</dd>
    </div>
  )
}
