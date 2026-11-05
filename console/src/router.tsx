import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { AppShell } from '@/components/app-shell'
import { NotFound, RouteError } from '@/components/route-states'
import { ApiError } from '@/lib/api'
import { meQuery } from '@/lib/queries'
import { AuditPage } from '@/routes/audit'
import { DeviceDetailPage } from '@/routes/device-detail'
import { DeviceDevtoolsPage } from '@/routes/device-devtools'
import { DevicesPage, validateDevicesSearch } from '@/routes/devices'
import { KeysPage } from '@/routes/keys'
import { AcceptInvitePage } from '@/routes/invite'
import { LoginPage } from '@/routes/login'
import { MembersPage } from '@/routes/members'
import { ProjectDetailPage, projectTabs, type ProjectTab } from '@/routes/project-detail'
import { ProjectsPage } from '@/routes/projects'

type RouterContext = { queryClient: QueryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string; sso_error?: string } => ({
    redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') ? search.redirect : undefined,
    // Set by the gateway when single sign-on fails (docs/protocol.md section 12.2).
    sso_error: typeof search.sso_error === 'string' ? search.sso_error : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    // Already signed in: skip the login form.
    const me = await context.queryClient.fetchQuery(meQuery).catch(() => null)
    if (me) throw redirect({ to: search.redirect ?? '/', replace: true })
  },
  component: LoginPage,
})

// Public: a member invited by the owner sets a password here (docs/protocol.md section 12.2).
const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  component: AcceptInvitePage,
})

async function requireSignIn({ context, location }: { context: RouterContext; location: { href: string } }) {
  try {
    await context.queryClient.ensureQueryData(meQuery)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
    }
    throw err
  }
}

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: requireSignIn,
  component: AppShell,
  errorComponent: RouteError,
})

// Device-first: the home page lists every project's devices (docs/protocol.md section 12.5).
const devicesRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  validateSearch: validateDevicesSearch,
  component: DevicesPage,
})

const projectsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/projects',
  component: ProjectsPage,
})

const projectRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/projects/$projectId',
  validateSearch: (search: Record<string, unknown>): { tab?: ProjectTab } => ({
    tab: projectTabs.includes(search.tab as ProjectTab) ? (search.tab as ProjectTab) : undefined,
  }),
  // API keys used to be a project tab; they belong to the gateway now.
  beforeLoad: ({ location }) => {
    if ((location.search as { tab?: unknown }).tab === 'keys') throw redirect({ to: '/keys', replace: true })
  },
  component: ProjectDetailPage,
})

const keysRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/keys',
  component: KeysPage,
})

const deviceRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/devices/$deviceId',
  // `from`: the project whose device tab linked here, so the back link returns to it.
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' && search.from ? search.from : undefined,
  }),
  component: DeviceDetailPage,
})

// Chrome DevTools on a page of the device (docs/protocol.md section 17): full
// window, outside the app shell.
const deviceDevtoolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/devices/$deviceId/devtools',
  validateSearch: (search: Record<string, unknown>): { page?: string } => ({
    page: typeof search.page === 'string' && search.page ? search.page : undefined,
  }),
  beforeLoad: requireSignIn,
  component: DeviceDevtoolsPage,
  errorComponent: RouteError,
})

// Old links (before devices became first-class) keep working.
const legacyDeviceRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/projects/$projectId/devices/$deviceId',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/devices/$deviceId', params: { deviceId: params.deviceId }, search: { from: params.projectId }, replace: true })
  },
})

const docsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/docs',
  // Code-split: the guide is long and only needed when someone opens it.
  component: lazyRouteComponent(() => import('@/routes/docs'), 'DocsPage'),
})

const membersRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/members',
  component: MembersPage,
})

const auditRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/audit',
  component: AuditPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  inviteRoute,
  deviceDevtoolsRoute,
  authRoute.addChildren([
    devicesRoute,
    projectsRoute,
    projectRoute,
    keysRoute,
    deviceRoute,
    legacyDeviceRoute,
    docsRoute,
    membersRoute,
    auditRoute,
  ]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

