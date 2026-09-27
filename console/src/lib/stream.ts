import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'

import { htmlLang, onLangChange } from '@/i18n'

import type { Device, DeviceDetail, DeviceListPage, DeviceStatusFilter, Integration, TimelineEvent } from './types'

// Live updates over SSE (docs/protocol.md sections 13 and 12.5). The console opens ONE org-wide
// EventSource (`GET /stream` without `project`) for the whole signed-in session and writes every event
// straight into the React Query caches: the cross-project device list, per-project device lists, device
// details and the integration checklist. While it is down those queries fall back to polling (`live` in
// queries.ts).

export type StreamStatus = 'connecting' | 'live' | 'down'

export type StreamState = {
  status: StreamStatus
  /** When the current status began (ms). */
  since: number
  /** Last message of any kind from the gateway, including pings. */
  lastEventAt: number | null
}

const SILENCE_MS = 60_000 // the gateway pings every 25 seconds
const RETRY_MIN_MS = 2_000
const RETRY_MAX_MS = 30_000
const LINGER_MS = 5_000 // keep the connection across route changes
const LIST_REFETCH_MS = 1_500 // at most one device-list refetch per this interval
const JUST_NOW_MS = 15_000

class OrgStream {
  state: StreamState = { status: 'connecting', since: Date.now(), lastEventAt: null }
  private listeners = new Set<() => void>()
  private source: EventSource | null = null
  private retryMs = RETRY_MIN_MS
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private silenceTimer: ReturnType<typeof setTimeout> | undefined
  private lingerTimer: ReturnType<typeof setTimeout> | undefined
  private listTimer: ReturnType<typeof setTimeout> | undefined
  /** Last known online flag per device, to tell membership changes from in-place updates. */
  private online = new Map<string, boolean>()

  constructor(private readonly queryClient: QueryClient) {
    // The stream URL carries the UI language; reopen it so gateway-made text follows a switch.
    onLangChange(() => {
      if (!this.source) return
      this.teardown()
      // Lingering after the last subscriber left (say, signed out): stay closed.
      if (this.listeners.size) this.connect()
    })
  }

  subscribe(listener: () => void) {
    clearTimeout(this.lingerTimer)
    this.listeners.add(listener)
    if (!this.source && this.retryTimer === undefined) this.connect()
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size) this.lingerTimer = setTimeout(() => this.close(), LINGER_MS)
    }
  }

  private setStatus(status: StreamStatus) {
    if (status === this.state.status) return
    this.state = { ...this.state, status, since: Date.now() }
    this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  private connect() {
    this.retryTimer = undefined
    if (typeof EventSource === 'undefined') return this.setStatus('down')
    // EventSource cannot set Accept-Language, so the language rides in the query string.
    const source = new EventSource(`/v1/api/stream?lang=${encodeURIComponent(htmlLang())}`, { withCredentials: true })
    this.source = source
    source.addEventListener('open', () => {
      this.retryMs = RETRY_MIN_MS
      this.alive()
      this.setStatus('live')
      // Catch up on whatever changed while there was no stream (including before the first connect).
      const qc = this.queryClient
      void qc.invalidateQueries({ queryKey: ['device-list'] })
      void qc.invalidateQueries({ queryKey: ['devices'] })
      void qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'projects' && (q.queryKey[2] === 'devices' || q.queryKey[2] === 'integration'),
      })
    })
    source.addEventListener('ping', () => this.alive())
    source.addEventListener('device', (e) => {
      this.alive()
      const device = parse<Device>(e)
      if (device?.id) this.applyDevice(device)
    })
    source.addEventListener('timeline', (e) => {
      this.alive()
      const data = parse<{ deviceId: string; event: TimelineEvent }>(e)
      if (data?.deviceId && data.event) applyTimeline(this.queryClient, data.deviceId, data.event)
    })
    source.addEventListener('error', () => {
      this.setStatus('down')
      // CONNECTING: the browser retries by itself. CLOSED (HTTP error, wrong content type): we retry.
      if (source.readyState === EventSource.CLOSED) this.reconnectLater()
    })
  }

  private alive() {
    this.state = { ...this.state, lastEventAt: Date.now() }
    this.emit()
    clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      this.setStatus('down')
      this.reconnectLater()
    }, SILENCE_MS)
  }

  private reconnectLater() {
    this.teardown()
    this.retryTimer = setTimeout(() => this.connect(), this.retryMs)
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS)
  }

  private teardown() {
    clearTimeout(this.silenceTimer)
    this.source?.close()
    this.source = null
  }

  private close() {
    this.teardown()
    clearTimeout(this.retryTimer)
    clearTimeout(this.listTimer)
    this.retryTimer = undefined
    this.listTimer = undefined
    this.retryMs = RETRY_MIN_MS
    this.online.clear()
    this.state = { status: 'connecting', since: Date.now(), lastEventAt: null }
  }

  private applyDevice(device: Device) {
    const qc = this.queryClient
    applyProjectDevice(qc, device)

    // Cross-project list: patch rows in place; refetch (throttled) when the set of rows may change.
    let known = this.online.get(device.id)
    for (const [key, page] of qc.getQueriesData<DeviceListPage>({ queryKey: ['device-list'] })) {
      if (!page) continue
      const i = page.devices.findIndex((d) => d.id === device.id)
      if (i < 0) continue
      const old = page.devices[i]
      known ??= old.online
      const devices = page.devices.slice()
      devices[i] = { ...old, ...device, projectName: device.projectName ?? old.projectName }
      qc.setQueryData<DeviceListPage>(key, { ...page, devices })
    }
    this.online.set(device.id, device.online)
    const membership =
      known === undefined
        ? !device.online || Date.now() - (device.onlineSince ?? device.firstSeenAt ?? 0) < JUST_NOW_MS
        : known !== device.online
    if (membership) this.refetchListSoon()
  }

  private refetchListSoon() {
    if (this.listTimer !== undefined) return
    this.listTimer = setTimeout(() => {
      this.listTimer = undefined
      void this.queryClient.invalidateQueries({ queryKey: ['device-list'] })
    }, LIST_REFETCH_MS)
  }
}

function parse<T>(e: Event): T | null {
  try {
    return JSON.parse((e as MessageEvent<string>).data) as T
  } catch {
    return null
  }
}

function matches(status: DeviceStatusFilter, d: Device) {
  return status === 'all' || (status === 'online' ? d.online : d.help)
}

function applyProjectDevice(queryClient: QueryClient, device: Device) {
  const projectId = device.projectId
  for (const [key, list] of queryClient.getQueriesData<Device[]>({ queryKey: ['projects', projectId, 'devices'] })) {
    if (!list) continue
    const status = key[3] as DeviceStatusFilter
    const rest = list.filter((d) => d.id !== device.id)
    queryClient.setQueryData<Device[]>(key, matches(status, device) ? [device, ...rest] : rest)
  }

  const detailKey = ['devices', device.id]
  const detail = queryClient.getQueryData<DeviceDetail>(detailKey)
  if (detail) {
    const { pages, ...fields } = device
    queryClient.setQueryData<DeviceDetail>(detailKey, { ...detail, ...fields })
    // The event only carries a page count; fetch the page list when it may have changed.
    const cur = device.currentPage
    if (pages !== detail.pages.length || cur?.label !== detail.currentPage?.label || cur?.url !== detail.currentPage?.url) {
      void queryClient.invalidateQueries({ queryKey: detailKey, exact: true })
    }
  }

  const integrationKey = ['projects', projectId, 'integration']
  const integration = queryClient.getQueryData<Integration>(integrationKey)
  if (integration) {
    if (integration.lastDevice?.id === device.id && integration.lastDevice.online === device.online) {
      queryClient.setQueryData<Integration>(integrationKey, { ...integration, lastDevice: device })
    } else {
      void queryClient.invalidateQueries({ queryKey: integrationKey, exact: true })
    }
  }
}

function applyTimeline(queryClient: QueryClient, deviceId: string, event: TimelineEvent) {
  queryClient.setQueryData<DeviceDetail>(['devices', deviceId], (old) => {
    if (!old) return old
    const dup = old.timeline
      .slice(-20)
      .some((e) => e.at === event.at && e.kind === event.kind && e.summary === event.summary)
    return dup ? old : { ...old, timeline: [...old.timeline, event].slice(-100) }
  })
}

const streams = new WeakMap<QueryClient, OrgStream>()

function useStream() {
  const queryClient = useQueryClient()
  let stream = streams.get(queryClient)
  if (!stream) {
    stream = new OrgStream(queryClient)
    streams.set(queryClient, stream)
  }
  return stream
}

/** Joins the org-wide SSE stream while the calling component is mounted and returns its state. */
export function useStreamState(): StreamState {
  const stream = useStream()
  const subscribe = useCallback((listener: () => void) => stream.subscribe(listener), [stream])
  return useSyncExternalStore(subscribe, () => stream.state)
}

/** Joins the org-wide SSE stream; returns only its status (re-renders only when the status changes). */
export function useOrgStream(): StreamStatus {
  const stream = useStream()
  const subscribe = useCallback((listener: () => void) => stream.subscribe(listener), [stream])
  return useSyncExternalStore(subscribe, () => stream.state.status)
}

/**
 * Kept for the project pages: every project is served by the same org-wide stream, so the id is not
 * needed (the device events carry their projectId).
 */
export function useProjectStream(_projectId: string): StreamStatus {
  return useOrgStream()
}
