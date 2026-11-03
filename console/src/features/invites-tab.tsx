import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, LoaderCircleIcon, PlusIcon, QrCodeIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Callout } from '@/components/callout'
import { CodeBlock } from '@/components/code-block'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { QrCode } from '@/components/qr-code'
import { InlineError } from '@/components/route-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { rich, useT } from '@/i18n'
import { api } from '@/lib/api'
import { formatDate, relativeTime, untilTime } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { deviceInvitesQuery } from '@/lib/queries'
import type { DeviceInvite, Project } from '@/lib/types'
import { cn } from '@/lib/utils'

// Device invites (docs/protocol.md section 12.6): a link carrying `rwd_invite=<token>`. When a user opens
// it, the SDK reports the token, the device is marked as assisting and the invite is used up.

const expiryOptions = [
  { minutes: 30, key: 'm30' },
  { minutes: 120, key: 'h2' },
  { minutes: 1440, key: 'd1' },
  { minutes: 10080, key: 'd7' },
] as const

type InviteState = 'active' | 'used' | 'expired'

function inviteState(inv: DeviceInvite, now = Date.now()): InviteState {
  if (inv.usedAt) return 'used'
  return inv.expiresAt <= now ? 'expired' : 'active'
}

const stateRank: Record<InviteState, number> = { active: 0, used: 1, expired: 2 }

export function InvitesTab({ project }: { project: Project }) {
  const ti = useT().integration.invites
  const invites = useQuery(deviceInvitesQuery(project.id))
  const manage = useCan('invite.manage')
  const [createOpen, setCreateOpen] = useState(false)
  const [shown, setShown] = useState<DeviceInvite | null>(null)

  const sorted = invites.data
    ? [...invites.data].sort(
        (a, b) => stateRank[inviteState(a)] - stateRank[inviteState(b)] || b.expiresAt - a.expiresAt,
      )
    : []

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="gap-0 overflow-hidden pb-0 lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle>{ti.title}</CardTitle>
          <CardDescription>{ti.description}</CardDescription>
          {manage && (
            <CardAction>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusIcon />
                {ti.create}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <div className="border-t">
          {invites.isPending ? (
            <div className="divide-y">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="ms-auto h-4 w-16" />
                </div>
              ))}
            </div>
          ) : invites.isError ? (
            <InlineError error={invites.error} onRetry={() => invites.refetch()} />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<QrCodeIcon />}
              title={ti.emptyTitle}
              description={ti.emptyDescription}
              action={
                manage && (
                  <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    {ti.create}
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y">
              {sorted.map((inv) => (
                <InviteRow key={inv.id} invite={inv} project={project} manage={manage} onShow={() => setShown(inv)} />
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{ti.howTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 ps-4 text-sm text-muted-foreground marker:text-foreground/60">
            {ti.howSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {!project.inviteUrl && (
            <Callout tone="warning" className="mt-4">
              <p>
                {rich(ti.noDefaultUrl, {
                  link: (s) => (
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      search={{ tab: 'settings' }}
                      className="mx-0.5 text-brand hover:underline"
                    >
                      {s}
                    </Link>
                  ),
                })}
              </p>
            </Callout>
          )}
        </CardContent>
      </Card>

      {manage && (
        <CreateInviteDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          project={project}
          onCreated={(inv) => setShown(inv)}
        />
      )}
      <InviteQrDialog invite={shown} onOpenChange={(open) => !open && setShown(null)} />
    </div>
  )
}

function InviteStatus({ invite }: { invite: DeviceInvite }) {
  const ts = useT().integration.invites.status
  const state = inviteState(invite)
  if (state === 'used') return <Badge variant="success">{ts.used}</Badge>
  if (state === 'expired') return <Badge variant="muted">{ts.expired}</Badge>
  return <Badge variant="brand">{ts.active}</Badge>
}

function InviteRow({
  invite: inv,
  project,
  manage,
  onShow,
}: {
  invite: DeviceInvite
  project: Project
  manage: boolean
  onShow: () => void
}) {
  const t = useT()
  const ti = t.integration.invites
  const queryClient = useQueryClient()
  const state = inviteState(inv)
  const remove = useMutation({
    mutationFn: () => api.deleteDeviceInvite(inv.id),
    onSuccess: () => {
      queryClient.setQueryData<DeviceInvite[]>(deviceInvitesQuery(project.id).queryKey, (old) => old?.filter((x) => x.id !== inv.id))
      toast.success(ti.deleted)
    },
  })

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3', state !== 'active' && 'text-muted-foreground')}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{inv.note || ti.noNote}</span>
          <InviteStatus invite={inv} />
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground" title={inv.link}>
          {inv.link}
        </p>
        <p className="text-xs text-muted-foreground">
          {inv.createdBy && ti.createdBy(inv.createdBy)}
          {state === 'used' ? (
            <>
              {ti.usedAgo(relativeTime(inv.usedAt))}
              {inv.deviceId && (
                <>
                  {' · '}
                  <Link
                    to="/devices/$deviceId"
                    params={{ deviceId: inv.deviceId }}
                    search={{ from: project.id }}
                    className="inline-flex items-center text-brand hover:underline"
                  >
                    {ti.viewDevice}
                    <ChevronRightIcon className="size-3 rtl:-scale-x-100" />
                  </Link>
                </>
              )}
            </>
          ) : state === 'expired' ? (
            ti.expiredAt(formatDate(inv.expiresAt))
          ) : (
            <span title={formatDate(inv.expiresAt)}>{ti.expiresIn(untilTime(inv.expiresAt))}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {state === 'active' && (
          <>
            <Button variant="outline" size="xs" onClick={onShow}>
              <QrCodeIcon />
              {ti.qrCode}
            </Button>
            <CopyButton value={inv.link} variant="ghost" toastLabel={ti.linkCopied} />
          </>
        )}
        {manage && (
          <ConfirmDialog
            trigger={<Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" aria-label={ti.deleteLabel} />}
            title={ti.deleteTitle}
            description={state === 'active' ? ti.deleteActive : ti.deleteInactive}
            confirmLabel={t.common.delete}
            destructive
            onConfirm={() => remove.mutateAsync()}
          >
            <Trash2Icon />
          </ConfirmDialog>
        )}
      </div>
    </li>
  )
}

function CreateInviteDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onCreated: (invite: DeviceInvite) => void
}) {
  const t = useT()
  const ti = t.integration.invites
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const defaultUrl = project.inviteUrl ?? ''

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createDeviceInvite>[1]) => api.createDeviceInvite(project.id, input),
    onSuccess: (invite) => {
      void queryClient.invalidateQueries({ queryKey: deviceInvitesQuery(project.id).queryKey })
      onOpenChange(false)
      onCreated(invite)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setNote('')
          setUrl('')
          setMinutes(30)
          setError(null)
          create.reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ti.createTitle}</DialogTitle>
          <DialogDescription>{ti.createDescription}</DialogDescription>
        </DialogHeader>
        <form
          id="create-invite"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = note.trim()
            if (!trimmed) return setError(ti.noteRequired)
            const link = url.trim()
            if (link && !/^https?:\/\/[^\s/]+/i.test(link)) return setError(ti.badUrl)
            if (!link && !defaultUrl) return setError(ti.urlRequired)
            setError(null)
            create.mutate({ note: trimmed, url: link || undefined, expiresInMinutes: minutes })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-note">{ti.note}</Label>
            <Input
              id="invite-note"
              value={note}
              maxLength={100}
              autoFocus
              placeholder={ti.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{ti.noteHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-url">
              {ti.url} <span className="font-normal text-muted-foreground">{ti.optional}</span>
            </Label>
            <Input
              id="invite-url"
              value={url}
              inputMode="url"
              className="font-mono text-xs md:text-xs"
              placeholder={defaultUrl || 'https://m.example.com/help'}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{ti.urlHint(!!defaultUrl)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium" id="invite-expiry-label">
              {ti.expiry}
            </p>
            <ToggleGroup
              value={[String(minutes)]}
              onValueChange={(v) => v[0] !== undefined && setMinutes(Number(v[0]))}
              aria-labelledby="invite-expiry-label"
            >
              {expiryOptions.map((o) => (
                <ToggleGroupItem key={o.minutes} value={String(o.minutes)}>
                  {ti.expiryOptions[o.key]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form="create-invite" disabled={create.isPending}>
            {create.isPending && <LoaderCircleIcon className="animate-spin" />}
            {ti.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InviteQrDialog({ invite, onOpenChange }: { invite: DeviceInvite | null; onOpenChange: (open: boolean) => void }) {
  const ti = useT().integration.invites
  // Keep the last invite while the closing animation runs.
  const [last, setLast] = useState<DeviceInvite | null>(invite)
  if (invite && invite !== last) setLast(invite)
  const inv = invite ?? last

  return (
    <Dialog open={!!invite} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {inv && (
          <>
            <DialogHeader>
              <DialogTitle>{ti.qrTitle}</DialogTitle>
              <DialogDescription>{ti.qrDescription(inv.note, untilTime(inv.expiresAt))}</DialogDescription>
            </DialogHeader>
            <QrCode value={inv.link} size={208} className="py-1" downloadName={`rwd-invite-${inv.id}`} />
            <p className="text-center text-sm text-muted-foreground">{ti.scanHint}</p>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{ti.orLink}</p>
              <CodeBlock code={inv.link} wrap />
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{ti.done}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
