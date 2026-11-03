import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { LoaderCircleIcon, LockKeyholeIcon, MailIcon } from 'lucide-react'
import { useState } from 'react'

import { AuthLayout } from '@/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/i18n'
import { ApiError, api, errorMessage } from '@/lib/api'
import { meQuery } from '@/lib/queries'

const route = getRouteApi('/login')

export function LoginPage() {
  const { redirect } = route.useSearch()
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
        <Card>
          <CardHeader>
            <CardTitle>{t.shell.login.title}</CardTitle>
            <CardDescription>{t.shell.login.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
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
                  <MailIcon className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  {/* Not type=email: the bootstrap owner defaults to the plain name "admin". */}
                  <Input
                    id="email"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    className="ps-9"
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
                  <LockKeyholeIcon className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="ps-9"
                    value={password}
                    aria-invalid={!!error || undefined}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending && <LoaderCircleIcon className="animate-spin" />}
                {t.shell.login.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
    </AuthLayout>
  )
}
