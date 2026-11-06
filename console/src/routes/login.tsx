import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { LoaderCircleIcon, LockKeyholeIcon, LogInIcon, MailIcon } from 'lucide-react'
import { useState } from 'react'

import { AuthLayout } from '@/components/auth-layout'
import { Callout } from '@/components/callout'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/i18n'
import { ApiError, api, errorMessage } from '@/lib/api'
import { configQuery, meQuery } from '@/lib/queries'
import { ssoName, ssoStartUrl } from '@/lib/sso'
import { cn } from '@/lib/utils'

const route = getRouteApi('/login')

export function LoginPage() {
  const { redirect, sso_error: ssoError } = route.useSearch()
  const sso = useQuery(configQuery).data?.sso
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const login = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.login(email, password),
    meta: { silent: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey })
      void navigate({ to: redirect ?? '/', replace: true })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        setError(t.shell.login.badCredentials)
      } else if (err instanceof ApiError && err.status === 403 && err.code !== 'csrf') {
        // e.g. a disabled member; the gateway explains why.
        setError(err.code === 'forbidden' ? t.shell.login.accountBlocked : err.message)
      } else if (err instanceof ApiError && err.status === 429) {
        setError(t.shell.login.tooManyAttempts)
      } else {
        setError(errorMessage(err))
      }
    },
  })

  return (
    <AuthLayout subtitle={t.shell.login.subtitle}>
      <div className="space-y-6">
        {ssoError && (
          <Callout tone="destructive">
            <p>{(t.shell.login.ssoErrors as Record<string, string>)[ssoError] ?? t.shell.login.ssoErrors.provider}</p>
          </Callout>
        )}
        {sso && (
          <>
            {/* A full page load: the gateway redirects to the provider and back (docs/protocol.md section 12.2). */}
            <a
              href={ssoStartUrl(redirect)}
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-brand-gradient h-11 w-full text-[15px] text-white shadow-[0_10px_30px_-12px_rgb(93_92_245/0.8)] transition-[filter,box-shadow] hover:bg-transparent hover:brightness-110',
              )}
            >
              <LogInIcon />
              {t.shell.login.sso(ssoName(sso))}
            </a>
            <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
              <span className="h-px flex-1 bg-border" />
              {t.shell.login.or}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!email.trim()) return setError(t.shell.login.emailRequired)
            if (!password) return setError(t.shell.login.passwordRequired)
            setError(null)
            login.mutate({ email: email.trim(), password })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t.shell.login.email}</Label>
            <div className="relative">
              <MailIcon className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              {/* Not type=email: the bootstrap owner defaults to the plain name "admin". */}
              <Input
                id="email"
                type="text"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={!sso}
                className="h-11 ps-10"
                placeholder="you@example.com"
                value={email}
                aria-invalid={!!error || undefined}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.shell.login.password}</Label>
            <div className="relative">
              <LockKeyholeIcon className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-11 ps-10"
                value={password}
                aria-invalid={!!error || undefined}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button
            type="submit"
            size="lg"
            variant={sso ? 'outline' : 'default'}
            className="h-11 w-full text-[15px]"
            disabled={login.isPending}
          >
            {login.isPending && <LoaderCircleIcon className="animate-spin" />}
            {t.shell.login.submit}
          </Button>
        </form>
        <p className="text-xs leading-relaxed text-muted-foreground/80">{t.shell.login.description}</p>
      </div>
    </AuthLayout>
  )
}
