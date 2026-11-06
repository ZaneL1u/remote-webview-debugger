import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query'

import { api } from './api'
import { POLL_MS } from './query'
import type { AuditFilters, DeviceListParams, DeviceStatusFilter, MeasuredStatus } from './types'

export const meQuery = queryOptions({ queryKey: ['me'], queryFn: api.me, staleTime: 60_000 })

export const configQuery = queryOptions({ queryKey: ['config'], queryFn: api.config, staleTime: 5 * 60_000 })

/** How often the header re-checks the gateway (GET /status). */
export const STATUS_POLL_MS = 12_000

export const statusQuery = queryOptions({
  queryKey: ['status'],
  queryFn: async (): Promise<MeasuredStatus> => {
    const started = performance.now()
    const status = await api.status()
    return { ...status, rttMs: Math.round(performance.now() - started), checkedAt: Date.now() }
  },
  refetchInterval: STATUS_POLL_MS,
  staleTime: 5000,
  retry: 1,
  retryDelay: 1500,
})

export const projectsQuery = queryOptions({ queryKey: ['projects'], queryFn: api.projects, refetchInterval: 5000 })

// `live` is true while the project's SSE stream (section 13) is connected: the stream keeps these
// caches fresh, and the 2 second polling only runs as a fallback while it is down.

export const integrationQuery = (projectId: string, live = false) =>
  queryOptions({
    queryKey: ['projects', projectId, 'integration'],
    queryFn: () => api.integration(projectId),
    refetchInterval: live ? false : POLL_MS,
  })

export const keysQuery = queryOptions({ queryKey: ['keys'], queryFn: () => api.keys() })

export const devicesQuery = (projectId: string, status: DeviceStatusFilter, live = false) =>
  queryOptions({
    queryKey: ['projects', projectId, 'devices', status],
    queryFn: () => api.devices(projectId, status),
    refetchInterval: live ? false : POLL_MS,
  })

/** Every project's devices (section 12.5). Keyed apart from ['devices', id] so stream catch-ups stay targeted. */
export const allDevicesQuery = (params: DeviceListParams, live = false) =>
  queryOptions({
    queryKey: ['device-list', params],
    queryFn: () => api.allDevices(params),
    placeholderData: keepPreviousData,
    // The org stream patches rows and refetches on membership changes; this is only a safety net.
    refetchInterval: live ? 60_000 : POLL_MS + 1000,
  })

export const deviceQuery = (deviceId: string, live = false) =>
  queryOptions({
    queryKey: ['devices', deviceId],
    queryFn: () => api.device(deviceId),
    refetchInterval: live ? false : POLL_MS,
  })

export const membersQuery = queryOptions({ queryKey: ['members'], queryFn: api.members })

export const deviceInvitesQuery = (projectId: string) =>
  queryOptions({
    queryKey: ['projects', projectId, 'invites'],
    queryFn: () => api.deviceInvites(projectId),
    // Picks up "used" without a stream event of its own.
    refetchInterval: 10_000,
  })

export const auditQuery = (filters: AuditFilters) =>
  infiniteQueryOptions({
    queryKey: ['audit', filters],
    queryFn: ({ pageParam }) => api.audit(filters, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    staleTime: 10_000,
  })

export const insightsQuery = queryOptions({ queryKey: ['insights'], queryFn: () => api.insights(), refetchInterval: 5000 })
