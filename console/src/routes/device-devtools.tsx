import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeftIcon, HourglassIcon, LoaderCircleIcon, PowerIcon, RotateCwIcon, ShieldAlertIcon, WrenchIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { LiveIndicator } from '@/components/live-indicator'
import { OnlineBadge } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { useT } from '@/i18n'
import { ApiError, api, errorMessage } from '@/lib/api'
import { deviceQuery } from '@/lib/queries'
import { useOrgStream } from '@/lib/stream'
import type { DeviceDetail, DevtoolsGrant } from '@/lib/types'
import { useNow } from '@/lib/use-now'

// Chrome DevTools on one page of a device (docs/protocol.md section 17). The
// frontend runs in an iframe from /devtools/ and talks CDP to the page through
// the gateway. A reload or navigation of the page ends the session; once the
// page is back we open a new one (the user's approval still holds).

const route = getRouteApi('/devices/$deviceId/devtools')

type State =
  | { kind: 'requesting' }
  | { kind: 'open'; grant: DevtoolsGrant; seen: boolean }
  | { kind: 'checking' }
  | { kind: 'reloading'; since: number; label: string }
  | { kind: 'ended' }
  | { kind: 'error'; error: unknown }

export function DeviceDevtoolsPage() {
  const { deviceId } = route.useParams()
  const { page } = route.useSearch()
  const navigate = useNavigate()
  const stream = useOrgStream()
  const device = useQuery(deviceQuery(deviceId, stream === 'live'))
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State>({ kind: 'requesting' })
  const t = useT().devices.devtools

  // Ask the gateway (and through it the user on the device) for a session.
  useEffect(() => {
    let cancelled = false
    setState({ kind: 'requesting' })
    api.openDevtools(deviceId, page).then(
      (grant) => {
        if (cancelled) return
        setState({ kind: 'open', grant, seen: false })
        // The URL names the page the session is on.
        if (!page) void navigate({ to: '/devices/$deviceId/devtools', params: { deviceId }, search: { page: grant.page.label }, replace: true })
      },
      (error) => !cancelled && setState({ kind: 'error', error }),
    )
    return () => {
      cancelled = true
    }
    // `page` filled in from the grant must not start another request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, attempt])

  // Follow the session in the device's live state. The stream keeps the
  // window list current but not each page's connection, so once the window is
  // gone the page list is read fresh to tell a reload from an end.
  const d = device.data
  useEffect(() => {
    if (!d || state.kind !== 'open') return
    const listed = d.devtools?.some((w) => w.id === state.grant.session) ?? false
    if (listed && !state.seen) setState({ ...state, seen: true })
    if (listed || !state.seen) return
    const { grant } = state
    setState({ kind: 'checking' })
    api.device(deviceId).then(
      (fresh) => {
        const p = fresh.pages.find((x) => x.id === grant.page.id)
        // Gone because the page reloaded (or is reloading; a device whose only
        // page navigates is briefly offline too): reconnect when it is back.
        // Otherwise someone ended it (the user on the device, an admin).
        const reloaded = !p || p.connected === false || p.connectedSince > grant.page.connectedSince
        setState(reloaded ? { kind: 'reloading', since: Date.now(), label: grant.page.label } : { kind: 'ended' })
      },
      (error) => setState({ kind: 'error', error }),
    )
  }, [d, state, deviceId])

  // While the page reloads: reconnect as soon as it is connected again.
  const reloadingLabel = state.kind === 'reloading' ? state.label : null
  useEffect(() => {
    if (!reloadingLabel) return
    let stopped = false
    const check = () =>
      api.device(deviceId).then(
        (fresh) => {
          if (!stopped && fresh.pages.some((x) => x.label === reloadingLabel && x.connected)) setAttempt((a) => a + 1)
        },
        () => {},
      )
    const timer = setInterval(check, 1000)
    void check()
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [reloadingLabel, deviceId])

  const label = state.kind === 'open' ? state.grant.page.label : page
  return (
    <div className="flex h-dvh flex-col bg-background">
      <Header device={d} deviceId={deviceId} label={label} stream={stream} onReconnect={() => setAttempt((a) => a + 1)} />
      <main className="relative min-h-0 flex-1">
        {state.kind === 'open' && (
          <iframe
            key={state.grant.ticket}
            title="DevTools"
            src={state.grant.frontendUrl}
            className="absolute inset-0 size-full border-0"
            // Clipboard for "Copy as cURL", "Copy element" and friends.
            allow="clipboard-read; clipboard-write"
          />
        )}
        {(state.kind === 'requesting' || state.kind === 'checking') && <Requesting device={d} />}
        {state.kind === 'reloading' && <Reloading since={state.since} onRetry={() => setAttempt((a) => a + 1)} />}
        {state.kind === 'ended' && (
          <Centered>
            <EmptyState
              icon={<PowerIcon />}
              title={t.ended.title}
              description={t.ended.description}
              action={
                <Button variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                  <RotateCwIcon />
                  {t.reconnect}
                </Button>
              }
            />
          </Centered>
        )}
        {state.kind === 'error' && <Failed error={state.error} onRetry={() => setAttempt((a) => a + 1)} />}
      </main>
    </div>
  )
}

function Header({
  device: d,
  deviceId,
  label,
  stream,
  onReconnect,
}: {
  device: DeviceDetail | undefined
  deviceId: string
  label: string | undefined
  stream: ReturnType<typeof useOrgStream>
  onReconnect: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const t = useT().devices.devtools
  const pages = (d?.pages ?? []).filter((p) => p.connected !== false || p.label === label)
  const windows = d?.devtools ?? []
  const end = useMutation({
    mutationFn: () => api.endDevice(deviceId),
    onSuccess: () => {
      toast.success(t.endedToast)
      void queryClient.invalidateQueries({ queryKey: deviceQuery(deviceId).queryKey })
    },
  })
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3 text-sm">
      <Link
        to="/devices/$deviceId"
        params={{ deviceId }}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
        <span className="font-mono font-medium tracking-wider text-foreground">{d?.code ?? t.device}</span>
      </Link>
      {d && <OnlineBadge online={d.online} />}
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <WrenchIcon className="size-4" />
        {t.title}
      </span>
      <NativeSelect
        aria-label={t.page}
        className="w-auto max-w-[min(40vw,28rem)]"
        value={label ?? ''}
        onChange={(e) =>
          void navigate({ to: '/devices/$deviceId/devtools', params: { deviceId }, search: { page: e.target.value || undefined } }).then(onReconnect)
        }
      >
        {!label && <option value="">{t.userPage}</option>}
        {pages.map((p) => (
          <option key={p.id} value={p.label}>
            {p.label} · {p.title || p.url}
          </option>
        ))}
      </NativeSelect>
      {windows.length > 1 && (
        <Badge variant="muted" title={windows.map((w) => t.window(w.member, w.page)).join(t.nameSep)}>
          {t.windows(windows.length)}
        </Badge>
      )}
      <div className="ml-auto flex items-center gap-2">
        <LiveIndicator status={stream} />
        <Button variant="ghost" size="sm" onClick={onReconnect}>
          <RotateCwIcon />
          {t.reconnect}
        </Button>
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive" />}
          title={t.endTitle}
          description={t.endDescription}
          confirmLabel={t.endConfirm}
          destructive
          onConfirm={() => end.mutateAsync()}
        >
          <PowerIcon />
          {t.end}
        </ConfirmDialog>
      </div>
    </header>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6">{children}</div>
}

function Requesting({ device: d }: { device: DeviceDetail | undefined }) {
  const now = useNow(1000)
  const t = useT().devices.devtools
  const pending = d?.pending?.purpose === 'devtools' ? d.pending : null
  const left = pending ? Math.max(0, Math.ceil((pending.expiresAt - now) / 1000)) : 0
  return (
    <Centered>
      <EmptyState
        icon={pending ? <HourglassIcon /> : <LoaderCircleIcon className="animate-spin" />}
        title={pending ? t.waiting.title : t.connecting.title}
        description={pending ? t.waiting.description(left) : t.connecting.description}
      />
    </Centered>
  )
}

function Reloading({ since, onRetry }: { since: number; onRetry: () => void }) {
  const now = useNow(1000)
  const t = useT().devices.devtools
  const slow = now - since > 15_000
  return (
    <Centered>
      <EmptyState
        icon={<LoaderCircleIcon className="animate-spin" />}
        title={t.reloading.title}
        description={slow ? t.reloading.slow : t.reloading.description}
        action={
          slow ? (
            <Button variant="outline" onClick={onRetry}>
              <RotateCwIcon />
              {t.retry}
            </Button>
          ) : undefined
        }
      />
    </Centered>
  )
}

function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT().devices.devtools
  const code = error instanceof ApiError ? error.code : ''
  const titles: Record<string, string> = t.errors
  return (
    <Centered>
      <EmptyState
        icon={<ShieldAlertIcon />}
        title={titles[code] ?? t.failed}
        description={errorMessage(error)}
        action={
          <Button variant="outline" onClick={onRetry}>
            <RotateCwIcon />
            {t.retry}
          </Button>
        }
      />
    </Centered>
  )
}
