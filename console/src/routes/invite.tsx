import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { LinkIcon, LoaderCircleIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { AuthLayout } from '@/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { rich, useT } from '@/i18n'
import { ApiError, api, errorMessage } from '@/lib/api'
import { MIN_PASSWORD } from '@/lib/format'
import { meQuery } from '@/lib/queries'

const route = getRouteApi('/invite/$token')

export function AcceptInvitePage() {
  const { token } = route.useParams()
  const t = useT()
  const invite = useQuery({
    queryKey: ['member-invite', token],
    queryFn: () => api.memberInvite(token),
    retry: false,
    staleTime: Infinity,
  })

  return (
    <AuthLayout subtitle={t.shell.invite.subtitle}>
        <Card>
          {invite.isPending ? (
            <CardContent className="space-y-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          ) : invite.isError ? (
            <EmptyState
              icon={<LinkIcon />}
              title={invite.error instanceof ApiError && invite.error.status < 500 ? t.shell.invite.invalid : t.common.loadFailed}
              description={
                invite.error instanceof ApiError && invite.error.status < 500
                  ? t.shell.invite.invalidDescription
                  : errorMessage(invite.error)
              }
              action={
                <Button variant="outline" nativeButton={false} render={<Link to="/login" search={{}} />}>
                  {t.shell.invite.goToLogin}
                </Button>
              }
            />
          ) : (
            <AcceptForm token={token} email={invite.data.email} defaultName={invite.data.name} />
          )}
        </Card>
    </AuthLayout>
  )
}

function AcceptForm({ token, email, defaultName }: { token: string; email: string; defaultName: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const t = useT()
  const [name, setName] = useState(defaultName)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const accept = useMutation({
    mutationFn: () => api.acceptMemberInvite(token, { password, name: name.trim() || undefined }),
    meta: { silent: true },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: meQuery.queryKey })
      await queryClient.fetchQuery(meQuery).catch(() => null)
      toast.success(t.shell.invite.welcome)
      void navigate({ to: '/', replace: true })
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 410)) setError(t.shell.invite.expired)
      else setError(errorMessage(err))
    },
  })

  return (
    <>
      <CardHeader>
        <CardTitle>{t.shell.invite.title}</CardTitle>
        <CardDescription>
          {rich(t.shell.invite.description(email), { b: (s) => <span className="font-medium text-foreground">{s}</span> })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return setError(t.shell.invite.nameRequired)
            if (password.length < MIN_PASSWORD) return setError(t.shell.invite.passwordTooShort(MIN_PASSWORD))
            if (password !== confirm) return setError(t.shell.invite.passwordMismatch)
            setError(null)
            accept.mutate()
          }}
        >
          {/* Lets password managers save the right username. */}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <div className="space-y-2">
            <Label htmlFor="invite-name">{t.shell.invite.name}</Label>
            <Input id="invite-name" value={name} maxLength={64} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password">{t.shell.invite.password}</Label>
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.shell.invite.passwordHint(MIN_PASSWORD)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-confirm">{t.shell.invite.confirm}</Label>
            <Input
              id="invite-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={accept.isPending}>
            {accept.isPending && <LoaderCircleIcon className="animate-spin" />}
            {t.shell.invite.submit}
          </Button>
        </form>
      </CardContent>
    </>
  )
}
