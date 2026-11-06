import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import {
  ChevronsUpDownIcon,
  FileClockIcon,
  GaugeIcon,
  KeyRoundIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  PlugZapIcon,
  TabletSmartphoneIcon,
  UsersRoundIcon,
  XIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useState } from 'react'

import { GatewayStatus } from '@/components/gateway-status'
import { LanguageSwitcher } from '@/components/language-switcher'
import { BRAND, Logo } from '@/components/logo'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChangePasswordDialog } from '@/features/change-password-dialog'
import { useT } from '@/i18n'
import { api } from '@/lib/api'
import { can, roleLabels, useMe } from '@/lib/permissions'
import { configQuery, meQuery } from '@/lib/queries'
import { useOrgStream } from '@/lib/stream'

type To = '/' | '/projects' | '/keys' | '/audit' | '/members' | '/docs' | '/insights'
type NavItem = { to: To; label: string; icon: React.ReactNode; exact?: boolean }
type NavGroup = { label: string; items: NavItem[] }

function useNav(): NavGroup[] {
  const t = useT()
  const me = useMe()
  const admin: NavItem[] = [
    // A gauge: how hard the gateway works and how much it has debugged.
    ...(can(me, 'audit.org') ? [{ to: '/insights' as const, label: t.shell.nav.insights, icon: <GaugeIcon /> }] : []),
    ...(can(me, 'member.view') ? [{ to: '/members' as const, label: t.shell.nav.members, icon: <UsersRoundIcon /> }] : []),
    ...(can(me, 'audit.org') ? [{ to: '/audit' as const, label: t.shell.nav.audit, icon: <FileClockIcon /> }] : []),
  ]
  return [
    {
      label: t.shell.nav.groups.workspace,
      items: [
        // A phone reached from afar: the device list is the home page.
        { to: '/', label: t.shell.nav.devices, icon: <TabletSmartphoneIcon />, exact: true },
        // Stacked layers: each project is one integration (an app or a site) on top of the same devices.
        { to: '/projects', label: t.shell.nav.projects, icon: <LayersIcon /> },
      ],
    },
    {
      label: t.shell.nav.groups.connect,
      items: [
        // A plug: how pages and agents get connected.
        { to: '/docs', label: t.shell.nav.docs, icon: <PlugZapIcon /> },
        { to: '/keys', label: t.shell.nav.keys, icon: <KeyRoundIcon /> },
      ],
    },
    ...(admin.length ? [{ label: t.shell.nav.groups.admin, items: admin }] : []),
  ]
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useNav()
  const t = useT()
  return (
    <nav className="space-y-6" aria-label={t.shell.nav.main}>
      {groups.map((g) => (
        <div key={g.label} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">{g.label}</p>
          {g.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className="group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring data-[status=active]:bg-brand-soft data-[status=active]:text-foreground [&_svg]:size-[18px] [&_svg]:text-muted-foreground/80 [&_svg]:transition-colors hover:[&_svg]:text-foreground data-[status=active]:[&_svg]:text-brand"
              activeProps={{ 'aria-current': 'page' }}
              activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

function Account({ onPassword }: { onPassword: () => void }) {
  const t = useT()
  const me = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: api.logout,
    meta: { silent: true },
    onSettled: () => {
      // Forget who is signed in (the login route checks it), leave, and only then drop the rest of the cache:
      // clearing it while the pages are still mounted makes their queries refetch and fail with 401.
      void queryClient.cancelQueries()
      queryClient.removeQueries({ queryKey: meQuery.queryKey })
      void navigate({ to: '/login', replace: true }).then(() => queryClient.clear())
    },
  })
  const initial = (me?.name || me?.email || '?').slice(0, 1).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg p-2 text-start transition-colors outline-none hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring"
            aria-label={t.shell.nav.accountMenu}
          />
        }
      >
        <span className="bg-brand-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-background">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{me?.name || me?.email}</span>
          <span className="block truncate text-xs text-muted-foreground">{me ? roleLabels[me.role] : ''}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <div className="space-y-1 px-2 py-1.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{me?.name || '—'}</span>
            {me && <Badge variant="secondary">{roleLabels[me.role]}</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
        </div>
        <DropdownMenuSeparator />
        {/* Single sign-on accounts have no password to change. */}
        {me?.hasPassword !== false && (
          <DropdownMenuItem onClick={onPassword}>
            <KeyRoundIcon />
            {t.shell.nav.changePassword}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => logout.mutate()}>
          <LogOutIcon />
          {t.shell.nav.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Sidebar({ onPassword, onNavigate }: { onPassword: () => void; onNavigate?: () => void }) {
  const t = useT()
  const config = useQuery(configQuery)
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="-ms-1 flex items-center gap-2.5 rounded-md px-1 py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          aria-label={t.shell.nav.home(BRAND.name)}
        >
          <Logo className="size-8" />
          <span className="text-[15px] font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="space-y-3 border-t p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <GatewayStatus className="-ms-1" />
          <LanguageSwitcher labelClassName="hidden" />
        </div>
        <ThemeSwitcher className="flex w-full" />
        <Account onPassword={onPassword} />
        {config.data?.version && (
          <p className="px-2 font-mono text-[10px] text-muted-foreground/60">{t.shell.nav.gatewayVersion(config.data.version)}</p>
        )}
      </div>
    </div>
  )
}

export function AppShell() {
  const t = useT()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const me = useMe()
  const path = useLocation({ select: (l) => l.pathname })
  // One org-wide SSE connection for the whole signed-in session (lib/stream.ts).
  useOrgStream()
  useEffect(() => setDrawer(false), [path])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-brand-foreground focus:not-sr-only focus:fixed focus:top-2 focus:start-2"
      >
        {t.shell.nav.skipToContent}
      </a>
      {/* Wide screens: a fixed sidebar on the start side. */}
      <aside className="sticky top-0 hidden h-dvh border-e bg-sidebar lg:block">
        <Sidebar onPassword={() => setPasswordOpen(true)} />
      </aside>
      {/* Narrow screens: a top bar and the same sidebar in a drawer. */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-header px-3 backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setDrawer(true)} aria-label={t.shell.nav.main} aria-expanded={drawer} data-testid="nav-menu">
          <MenuIcon />
        </Button>
        <Link to="/" className="flex items-center gap-2" aria-label={t.shell.nav.home(BRAND.name)}>
          <Logo className="size-7" />
          <span className="font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
        <div className="ms-auto flex items-center">
          <GatewayStatus />
        </div>
      </header>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.shell.nav.main} data-testid="nav-drawer">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in"
            aria-label={t.shell.onboard.dismiss}
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] border-e bg-sidebar shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-left rtl:motion-safe:slide-in-from-right">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 end-3 z-10"
              onClick={() => setDrawer(false)}
              aria-label={t.shell.onboard.dismiss}
            >
              <XIcon />
            </Button>
            <Sidebar
              onPassword={() => {
                setDrawer(false)
                setPasswordOpen(true)
              }}
              onNavigate={() => setDrawer(false)}
            />
          </aside>
        </div>
      )}
      <main id="main" className="min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
          <Outlet />
        </div>
      </main>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} email={me?.email} />
    </div>
  )
}
