import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import {
  BookOpenTextIcon,
  ChevronDownIcon,
  FolderKanbanIcon,
  KeyRoundIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  ScrollTextIcon,
  SmartphoneIcon,
  SunIcon,
  UsersIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'

import { GatewayStatus } from '@/components/gateway-status'
import { LanguageSwitcher } from '@/components/language-switcher'
import { BRAND, Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChangePasswordDialog } from '@/features/change-password-dialog'
import { isCompact, useLang, useT } from '@/i18n'
import { api } from '@/lib/api'
import { can, roleLabels, useMe } from '@/lib/permissions'
import { configQuery } from '@/lib/queries'
import { useOrgStream } from '@/lib/stream'
import { setTheme, type ThemeChoice, useThemeChoice } from '@/lib/theme'
import { cn } from '@/lib/utils'

type NavItem = { to: '/' | '/projects' | '/keys' | '/audit' | '/members'; label: string; icon: React.ReactNode; exact?: boolean }

const navBase =
  'relative inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:size-4'
const navActive = 'bg-accent text-foreground'

export function AppShell() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const config = useQuery(configQuery)
  const me = useMe()
  const t = useT()
  // Labels in alphabetic languages are wider: the inline nav needs lg before it fits next to the header actions.
  const wide = !isCompact(useLang())
  const theme = useThemeChoice()
  const [passwordOpen, setPasswordOpen] = useState(false)
  // One org-wide SSE connection for the whole signed-in session (lib/stream.ts).
  useOrgStream()
  const logout = useMutation({
    mutationFn: api.logout,
    meta: { silent: true },
    onSettled: () => {
      queryClient.clear()
      void navigate({ to: '/login', replace: true })
    },
  })
  const initial = (me?.name || me?.email || '?').slice(0, 1).toUpperCase()

  const nav: NavItem[] = [
    { to: '/', label: t.shell.nav.devices, icon: <SmartphoneIcon />, exact: true },
    { to: '/projects', label: t.shell.nav.projects, icon: <FolderKanbanIcon /> },
    { to: '/keys', label: t.shell.nav.keys, icon: <KeyRoundIcon /> },
    ...(can(me, 'audit.org') ? [{ to: '/audit' as const, label: t.shell.nav.audit, icon: <ScrollTextIcon /> }] : []),
    ...(can(me, 'member.view') ? [{ to: '/members' as const, label: t.shell.nav.members, icon: <UsersIcon /> }] : []),
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-brand-foreground focus:not-sr-only focus:fixed focus:top-2 focus:start-2"
      >
        {t.shell.nav.skipToContent}
      </a>
      <header className="sticky top-0 z-40 border-b bg-header backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <Link
            to="/"
            className="-ms-1 flex shrink-0 items-center gap-2.5 rounded-md px-1 py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            aria-label={t.shell.nav.home(BRAND.name)}
          >
            <Logo className="size-7" />
            <span className="font-semibold tracking-tight">
              <span className="xl:hidden">{BRAND.short}</span>
              <span className="hidden xl:inline">{BRAND.name}</span>
            </span>
          </Link>
          <span className={cn('mx-1.5 hidden h-5 w-px bg-border', wide ? 'lg:block' : 'md:block')} aria-hidden />
          <nav className={cn('hidden items-center gap-0.5', wide ? 'lg:flex' : 'md:flex')} aria-label={t.shell.nav.main}>
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={navBase}
                activeProps={{ className: navActive, 'aria-current': 'page' }}
                activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
            <GatewayStatus />
            <LanguageSwitcher labelClassName="hidden xl:inline" />
            <Link
              to="/docs"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 max-sm:size-8 max-sm:px-0')}
              activeProps={{ className: 'border-brand/40 bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand' }}
              aria-label={t.shell.nav.docs}
            >
              <BookOpenTextIcon />
              <span className="hidden sm:inline">{t.shell.nav.docs}</span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" className="gap-1.5 px-1.5" aria-label={t.shell.nav.accountMenu} />}
              >
                <span className="bg-brand-gradient flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                  {initial}
                </span>
                <span className="hidden max-w-28 truncate lg:inline">{me?.name || me?.email}</span>
                <ChevronDownIcon className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <div className="space-y-1 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{me?.name || '—'}</span>
                    {me && <Badge variant="secondary">{roleLabels[me.role]}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t.shell.nav.appearance}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
                    <DropdownMenuRadioItem value="system">
                      <MonitorIcon />
                      {t.shell.nav.themeSystem}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="light">
                      <SunIcon />
                      {t.shell.nav.themeLight}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <MoonIcon />
                      {t.shell.nav.themeDark}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                  <KeyRoundIcon />
                  {t.shell.nav.changePassword}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout.mutate()}>
                  <LogOutIcon />
                  {t.shell.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Phones: the sections stay one tap away in a second row. */}
        <nav
          className={cn(
            'mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            wide ? 'lg:hidden' : 'md:hidden',
          )}
          aria-label={t.shell.nav.main}
        >
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(navBase, 'h-8 shrink-0')}
              activeProps={{ className: navActive, 'aria-current': 'page' }}
              activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2">
            <Logo className="size-4" />
            <span className="font-medium text-foreground/80">{BRAND.name}</span>
            <span className="hidden sm:inline">· {BRAND.tagline}</span>
          </span>
          <span className="flex items-center gap-4">
            <Link to="/docs" className="hover:text-foreground">
              {t.shell.nav.docs}
            </Link>
            {config.data?.version && <span className="font-mono">{t.shell.nav.gatewayVersion(config.data.version)}</span>}
          </span>
        </div>
      </footer>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} email={me?.email} />
    </div>
  )
}
