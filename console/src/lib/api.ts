import { getT, htmlLang } from '@/i18n'

import type {
  ApiKey,
  AuditFilters,
  AuditPage,
  CreatedApiKey,
  CreatedMember,
  CreateKeyInput,
  Device,
  DeviceDetail,
  DeviceInvite,
  DeviceListPage,
  DeviceListParams,
  DeviceStatusFilter,
  DevtoolsGrant,
  GatewayConfig,
  GatewayStatus,
  Insights,
  Integration,
  Me,
  Member,
  Project,
  ProjectPatch,
  Role,
  TestResult,
} from './types'

const BASE = '/v1/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Registers the global 401 handler (redirects to the login page). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; skipAuthRedirect?: boolean }

async function request<T>(path: string, { method = 'GET', body, skipAuthRedirect }: RequestOptions = {}): Promise<T> {
  // The gateway localizes its error messages from Accept-Language.
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': htmlLang() }
  if (method !== 'GET') headers['X-RWD-CSRF'] = '1'
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', getT().common.api.network)
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    if (res.status === 401 && !skipAuthRedirect) onUnauthorized?.()
    throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? defaultMessage(res.status))
  }
  return data as T
}

function defaultMessage(status: number) {
  const t = getT().common.api
  if (status === 401) return t.unauthorized
  if (status === 403) return t.forbidden
  if (status === 404) return t.notFound
  if (status >= 500) return t.server
  return t.failed(status)
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return getT().common.api.unknown
}

export function isForbidden(err: unknown) {
  return err instanceof ApiError && err.status === 403 && err.code !== 'csrf'
}

/** A phase 1 gateway answers `{"admin":true}`; treat that single administrator as the owner. */
function normalizeMe(raw: Partial<Me> & { admin?: boolean }): Me {
  if (raw.role) return { id: raw.id ?? '', email: raw.email ?? '', name: raw.name ?? '', role: raw.role, hasPassword: raw.hasPassword, sso: raw.sso }
  return { id: raw.id ?? 'admin', email: raw.email ?? 'admin', name: raw.name ?? getT().common.api.adminName, role: 'owner' }
}

function auditQuery(filters: AuditFilters, before: number | null, limit: number) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  params.set('limit', String(limit))
  if (before !== null) params.set('before', String(before))
  return params.toString()
}

export const api = {
  login: (email: string, password: string) =>
    request<{ ok: true }>('/auth/login', { method: 'POST', body: { email, password }, skipAuthRedirect: true }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST', skipAuthRedirect: true }),
  me: () => request<Partial<Me> & { admin?: boolean }>('/me', { skipAuthRedirect: true }).then(normalizeMe),
  changePassword: (oldPassword: string, newPassword: string) =>
    // A wrong old password must not be mistaken for an expired session.
    request<{ ok: true }>('/me/password', { method: 'POST', body: { oldPassword, newPassword }, skipAuthRedirect: true }),
  config: () => request<GatewayConfig>('/config'),

  members: () => request<{ members: Member[] }>('/members').then((r) => r.members),
  inviteMember: (input: { email: string; name: string; role: Role }) =>
    request<CreatedMember>('/members', { method: 'POST', body: input }),
  updateMember: (id: string, patch: Partial<Pick<Member, 'role' | 'disabled' | 'name'>>) =>
    request<Member>(`/members/${enc(id)}`, { method: 'PATCH', body: patch }),
  deleteMember: (id: string) => request<{ ok: true }>(`/members/${enc(id)}`, { method: 'DELETE' }),
  memberInvite: (token: string) =>
    request<{ email: string; name: string }>(`/invites/${enc(token)}`, { skipAuthRedirect: true }),
  acceptMemberInvite: (token: string, input: { password: string; name?: string }) =>
    request<{ ok: true }>(`/invites/${enc(token)}/accept`, { method: 'POST', body: input, skipAuthRedirect: true }),

  projects: () => request<{ projects: Project[] }>('/projects').then((r) => r.projects),
  createProject: (input: { name: string; allowedOrigins: string[] }) =>
    request<Project>('/projects', { method: 'POST', body: input }),
  updateProject: (id: string, patch: ProjectPatch) =>
    request<Project>(`/projects/${enc(id)}`, { method: 'PATCH', body: patch }),
  deleteProject: (id: string) => request<{ ok: true }>(`/projects/${enc(id)}`, { method: 'DELETE' }),
  rotateAppKey: (id: string) => request<Project>(`/projects/${enc(id)}/rotate-app-key`, { method: 'POST' }),
  integration: (id: string) => request<Integration>(`/projects/${enc(id)}/integration`),

  /** Members get their own keys; owners and admins everyone's, or only their own with `mine` (section 12.4). */
  keys: (opts: { mine?: boolean } = {}) =>
    request<{ keys: ApiKey[] }>(opts.mine ? '/keys?mine=1' : '/keys').then((r) => r.keys),
  createKey: (input: CreateKeyInput) => request<CreatedApiKey>('/keys', { method: 'POST', body: input }),
  revokeKey: (id: string) => request<{ ok: true }>(`/keys/${enc(id)}`, { method: 'DELETE' }),

  status: () => request<GatewayStatus>('/status'),
  insights: () => request<Insights>(`/insights?tz=${new Date().getTimezoneOffset()}`),

  /** Every project's devices, paged (section 12.5). */
  allDevices: ({ status, q, project, page, pageSize }: DeviceListParams) => {
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) })
    if (q) params.set('q', q)
    if (project) params.set('project', project)
    return request<DeviceListPage>(`/devices?${params}`)
  },
  devices: (projectId: string, status: DeviceStatusFilter) =>
    request<{ devices: Device[] }>(`/projects/${enc(projectId)}/devices?status=${status}`).then((r) => r.devices),
  device: (id: string) => request<DeviceDetail>(`/devices/${enc(id)}`),
  testDevice: (id: string) => request<TestResult>(`/devices/${enc(id)}/test`, { method: 'POST' }),
  endDevice: (id: string) => request<{ ok: true }>(`/devices/${enc(id)}/end`, { method: 'POST' }),
  openDevtools: (id: string, page?: string) =>
    request<DevtoolsGrant>(`/devices/${enc(id)}/devtools`, { method: 'POST', body: { page: page ?? '' } }),

  deviceInvites: (projectId: string) =>
    request<{ invites: DeviceInvite[] }>(`/projects/${enc(projectId)}/invites`).then((r) => r.invites),
  createDeviceInvite: (projectId: string, input: { note: string; url?: string; expiresInMinutes: number }) =>
    request<DeviceInvite>(`/projects/${enc(projectId)}/invites`, { method: 'POST', body: input }),
  deleteDeviceInvite: (id: string) => request<{ ok: true }>(`/device-invites/${enc(id)}`, { method: 'DELETE' }),

  audit: (filters: AuditFilters, before: number | null, limit = 50) =>
    request<AuditPage>(`/audit?${auditQuery(filters, before, limit)}`),
}

function enc(s: string) {
  return encodeURIComponent(s)
}
