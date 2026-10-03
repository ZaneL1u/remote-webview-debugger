import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BanIcon, ChevronDownIcon, CircleCheckIcon, LoaderCircleIcon, Trash2Icon, UserPlusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Callout } from '@/components/callout'
import { ChoiceCards } from '@/components/choice-cards'
import { CodeBlock } from '@/components/code-block'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { QrCode } from '@/components/qr-code'
import { Forbidden, InlineError } from '@/components/route-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useT } from '@/i18n'
import { api } from '@/lib/api'
import { formatDate, formatDay, relativeTime } from '@/lib/format'
import { can, roleDescriptions, roleLabels, useMe } from '@/lib/permissions'
import { membersQuery } from '@/lib/queries'
import type { CreatedMember, Member, Role } from '@/lib/types'
import { cn } from '@/lib/utils'

const roles: Role[] = ['owner', 'admin', 'member']
const roleOrder: Record<Role, number> = { owner: 0, admin: 1, member: 2 }

export function MembersPage() {
  const me = useMe()
  const t = useT().members
  const allowed = can(me, 'member.view')
  const manage = can(me, 'member.manage')
  const members = useQuery({ ...membersQuery, enabled: allowed })
  const [inviteOpen, setInviteOpen] = useState(false)

  const sorted = members.data
    ? [...members.data].sort(
        (a, b) =>
          Number(a.disabled) - Number(b.disabled) || roleOrder[a.role] - roleOrder[b.role] || a.createdAt - b.createdAt,
      )
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{t.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.description}</p>
        </div>
        {manage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlusIcon />
            {t.invite}
          </Button>
        )}
      </div>

      {!allowed ? (
        <Card>
          <Forbidden description={t.forbidden} />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden pb-0">
          <CardHeader className="pb-4">
            <CardTitle>{t.allMembers}</CardTitle>
            <CardDescription>
              {manage ? t.manageHint : t.viewHint}
            </CardDescription>
            {members.data && (
              <CardAction>
                <span className="text-sm text-muted-foreground tabular-nums">{t.count(members.data.length)}</span>
              </CardAction>
            )}
          </CardHeader>
          <div className="border-t">
            {members.isPending ? (
              <div className="divide-y">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="ml-auto h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : members.isError ? (
              <InlineError error={members.error} onRetry={() => members.refetch()} />
            ) : sorted.length === 0 ? (
              <EmptyState icon={<UsersIcon />} title={t.empty} />
            ) : (
              <MemberList members={sorted} selfId={me?.id} manage={manage} />
            )}
          </div>
        </Card>
      )}

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{t.rolesTitle}</CardTitle>
        </CardHeader>
        <dl className="grid gap-3 px-5 text-sm sm:grid-cols-3">
          {roles.map((r) => (
            <div key={r} className="space-y-1 rounded-lg bg-muted/50 p-3">
              <dt>
                <RoleBadge role={r} />
              </dt>
              <dd className="text-muted-foreground">{roleDescriptions[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {manage && <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />}
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={role === 'owner' ? 'brand' : role === 'admin' ? 'secondary' : 'outline'}>{roleLabels[role]}</Badge>
}

function MemberStatus({ m }: { m: Member }) {
  const t = useT().members.status
  if (m.disabled) return <Badge variant="muted">{t.disabled}</Badge>
  if (m.pending) return <Badge variant="warning">{t.pending}</Badge>
  return <Badge variant="success">{t.active}</Badge>
}

function Avatar({ m }: { m: Member }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
        m.disabled ? 'bg-muted text-muted-foreground' : 'bg-brand-soft text-brand',
      )}
    >
      {(m.name || m.email).slice(0, 1).toUpperCase()}
    </span>
  )
}

function useMemberMutations(m: Member) {
  const queryClient = useQueryClient()
  const t = useT().members.toast
  const update = useMutation({
    mutationFn: (patch: Partial<Pick<Member, 'role' | 'disabled'>>) => api.updateMember(m.id, patch),
    onSuccess: (updated, patch) => {
      queryClient.setQueryData<Member[]>(membersQuery.queryKey, (old) => old?.map((x) => (x.id === updated.id ? updated : x)))
      const name = updated.name || updated.email
      if (patch.role) toast.success(t.roleChanged(name, roleLabels[updated.role]))
      else toast.success(updated.disabled ? t.disabled(name) : t.enabled(name))
    },
  })
  const remove = useMutation({
    mutationFn: () => api.deleteMember(m.id),
    onSuccess: () => {
      queryClient.setQueryData<Member[]>(membersQuery.queryKey, (old) => old?.filter((x) => x.id !== m.id))
      toast.success(t.deleted(m.name || m.email))
    },
  })
  return { update, remove }
}

function MemberList({ members, selfId, manage }: { members: Member[]; selfId?: string; manage: boolean }) {
  const t = useT().members.table
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t.member}</TableHead>
              <TableHead>{t.role}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead>{t.lastLogin}</TableHead>
              <TableHead>{t.joined}</TableHead>
              {manage && <TableHead className="pr-5 text-right">{t.actions}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <MemberRow key={m.id} m={m} self={m.id === selfId} manage={manage} />
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {members.map((m) => (
          <MemberCard key={m.id} m={m} self={m.id === selfId} manage={manage} />
        ))}
      </ul>
    </>
  )
}

function Identity({ m, self }: { m: Member; self: boolean }) {
  const t = useT().members
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar m={m} />
      <div className="min-w-0">
        <p className={cn('flex items-center gap-1.5 truncate font-medium', m.disabled && 'text-muted-foreground')}>
          <span className="truncate">{m.name || t.noName}</span>
          {self && <Badge variant="outline">{t.you}</Badge>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
      </div>
    </div>
  )
}

function MemberRow({ m, self, manage }: { m: Member; self: boolean; manage: boolean }) {
  const t = useT().members
  const { update, remove } = useMemberMutations(m)
  return (
    <TableRow className={cn(m.disabled && 'text-muted-foreground')}>
      <TableCell className="max-w-72 pl-5">
        <Identity m={m} self={self} />
      </TableCell>
      <TableCell>
        {manage && !self ? <RoleMenu m={m} onChange={(role) => update.mutate({ role })} pending={update.isPending} /> : <RoleBadge role={m.role} />}
      </TableCell>
      <TableCell>
        <MemberStatus m={m} />
      </TableCell>
      <TableCell className="text-muted-foreground" title={formatDate(m.lastLoginAt)}>
        {m.lastLoginAt ? relativeTime(m.lastLoginAt) : t.neverSignedIn}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDay(m.createdAt)}</TableCell>
      {manage && (
        <TableCell className="pr-5 text-right">
          {self ? (
            <span className="text-xs text-muted-foreground">{t.cantEditSelf}</span>
          ) : (
            <MemberActions m={m} update={update} remove={remove} />
          )}
        </TableCell>
      )}
    </TableRow>
  )
}

function MemberCard({ m, self, manage }: { m: Member; self: boolean; manage: boolean }) {
  const t = useT().members
  const { update, remove } = useMemberMutations(m)
  return (
    <li className="space-y-2.5 px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <Identity m={m} self={self} />
        <MemberStatus m={m} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {manage && !self ? <RoleMenu m={m} onChange={(role) => update.mutate({ role })} pending={update.isPending} /> : <RoleBadge role={m.role} />}
        <span>{m.lastLoginAt ? t.signedInAgo(relativeTime(m.lastLoginAt)) : t.neverSignedIn}</span>
        {manage && !self && (
          <span className="ml-auto">
            <MemberActions m={m} update={update} remove={remove} />
          </span>
        )}
      </div>
    </li>
  )
}

function RoleMenu({ m, onChange, pending }: { m: Member; onChange: (role: Role) => void; pending: boolean }) {
  const t = useT().members
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="xs" aria-label={t.changeRole(m.name || m.email)} disabled={pending} />}
      >
        {pending && <LoaderCircleIcon className="animate-spin" />}
        {roleLabels[m.role]}
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.role}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={m.role} onValueChange={(v) => v !== m.role && onChange(v as Role)}>
            {roles.map((r) => (
              <DropdownMenuRadioItem key={r} value={r} className="items-start" closeOnClick>
                <span className="space-y-0.5">
                  <span className="block font-medium">{roleLabels[r]}</span>
                  <span className="block text-xs whitespace-normal text-muted-foreground">{roleDescriptions[r]}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MemberActions({
  m,
  update,
  remove,
}: {
  m: Member
  update: ReturnType<typeof useMemberMutations>['update']
  remove: ReturnType<typeof useMemberMutations>['remove']
}) {
  const t = useT().members
  const label = m.name || m.email
  return (
    <div className="inline-flex items-center gap-1">
      {m.disabled ? (
        <Button variant="ghost" size="xs" disabled={update.isPending} onClick={() => update.mutate({ disabled: false })}>
          <CircleCheckIcon />
          {t.enable}
        </Button>
      ) : (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="xs" />}
          title={t.disableTitle(label)}
          description={t.disableDescription}
          confirmLabel={t.disable}
          destructive
          onConfirm={() => update.mutateAsync({ disabled: true })}
        >
          <BanIcon />
          {t.disable}
        </ConfirmDialog>
      )}
      <ConfirmDialog
        trigger={<Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" aria-label={t.deleteAria(label)} />}
        title={t.deleteTitle(label)}
        description={m.pending ? t.deletePendingDescription : t.deleteDescription}
        confirmLabel={t.delete}
        destructive
        onConfirm={() => remove.mutateAsync()}
      >
        <Trash2Icon />
        {t.delete}
      </ConfirmDialog>
    </div>
  )
}

function InviteMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const t = useT()
  const d = t.members.inviteDialog
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedMember | null>(null)

  const invite = useMutation({
    mutationFn: () => api.inviteMember({ email: email.trim(), name: name.trim(), role }),
    onSuccess: (member) => {
      setCreated(member)
      void queryClient.invalidateQueries({ queryKey: membersQuery.queryKey })
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // The invite link is shown only once; close only via the explicit button.
        if (!next && created) return
        onOpenChange(next)
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setEmail('')
          setName('')
          setRole('member')
          setError(null)
          setCreated(null)
          invite.reset()
        }
      }}
      disablePointerDismissal={!!created}
    >
      <DialogContent showCloseButton={!created}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{d.createdTitle}</DialogTitle>
              <DialogDescription>
                {d.createdDescription(created.name || created.email, roleLabels[created.role])}
              </DialogDescription>
            </DialogHeader>
            <Callout tone="warning">
              <p>
                <span className="font-medium">{d.onceWarning}</span>
                {d.lostHint}
              </p>
            </Callout>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <QrCode value={created.inviteUrl} size={148} />
              <div className="w-full min-w-0 flex-1 space-y-1.5">
                <p className="text-xs text-muted-foreground">{d.link}</p>
                <CodeBlock code={created.inviteUrl} wrap />
                <p className="text-xs text-muted-foreground">{d.scanHint}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{d.done}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{d.title}</DialogTitle>
              <DialogDescription>{d.description}</DialogDescription>
            </DialogHeader>
            <form
              id="invite-member"
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(d.invalidEmail)
                if (!name.trim()) return setError(d.nameRequired)
                setError(null)
                invite.mutate()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="member-email">{d.email}</Label>
                  <Input
                    id="member-email"
                    type="email"
                    autoFocus
                    value={email}
                    placeholder="name@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-name">{d.name}</Label>
                  <Input id="member-name" value={name} maxLength={64} placeholder={d.namePlaceholder} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{d.role}</p>
                <ChoiceCards
                  name="member-role"
                  aria-label={d.role}
                  value={role}
                  onChange={setRole}
                  options={roles.map((r) => ({
                    value: r,
                    label: roleLabels[r],
                    description: roleDescriptions[r],
                    warning: r === 'owner',
                  }))}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" form="invite-member" disabled={invite.isPending}>
                {invite.isPending && <LoaderCircleIcon className="animate-spin" />}
                {d.submit}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
