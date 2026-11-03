import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BanIcon, KeyRoundIcon, LoaderCircleIcon, NetworkIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Callout } from '@/components/callout'
import { ChoiceCards } from '@/components/choice-cards'
import { CodeBlock } from '@/components/code-block'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { InlineError } from '@/components/route-states'
import { LevelBadge } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type Messages, rich, useT } from '@/i18n'
import { api } from '@/lib/api'
import { formatDate, formatDay, relativeTime, untilTime } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { levelMeta, levels, parseCidrs } from '@/lib/policy'
import { configQuery, keysQuery } from '@/lib/queries'
import { hostedMcpCommand, localMcpCommand, mcpJsonConfig } from '@/lib/snippets'
import type { ApiKey, CreatedApiKey, Level } from '@/lib/types'
import { cn } from '@/lib/utils'

const KEY_PLACEHOLDER = 'rwd_sk_live_…'

export function KeysPanel() {
  const keys = useQuery(keysQuery)
  const config = useQuery(configQuery)
  const gateway = config.data?.gatewayUrl
  const manage = useCan('key.manage')
  const [createOpen, setCreateOpen] = useState(false)
  const t = useT()

  const sorted = keys.data
    ? [...keys.data].sort((a, b) => keyRank(a) - keyRank(b) || b.createdAt - a.createdAt)
    : []

  return (
    <div className="space-y-5">
      <Card className="gap-0 overflow-hidden pb-0">
        <CardHeader className="pb-4">
          <CardTitle>{t.projects.keys.title}</CardTitle>
          <CardDescription>
            {t.projects.keys.description}
            {!manage && t.projects.keys.readOnly}
          </CardDescription>
          {manage && (
            <CardAction>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusIcon />
                {t.projects.keys.createKey}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <div className="border-t">
          {keys.isPending ? (
            <div className="divide-y">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="ms-auto h-4 w-16" />
                </div>
              ))}
            </div>
          ) : keys.isError ? (
            <InlineError error={keys.error} onRetry={() => keys.refetch()} />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<KeyRoundIcon />}
              title={t.projects.keys.emptyTitle}
              description={t.projects.keys.emptyDescription}
              action={
                manage && (
                  <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    {t.projects.keys.createKey}
                  </Button>
                )
              }
            />
          ) : (
            <KeyList keys={sorted} manage={manage} />
          )}
        </div>
      </Card>

      <McpGuideCard gateway={gateway} />

      {manage && (
        <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} gateway={gateway} />
      )}
    </div>
  )
}

/** Valid keys first, then expired, then revoked. */
function keyRank(k: ApiKey) {
  return k.revokedAt ? 2 : isExpired(k) ? 1 : 0
}

function isExpired(k: ApiKey, now = Date.now()) {
  return !!k.expiresAt && k.expiresAt <= now
}

function KeyList({ keys, manage }: { keys: ApiKey[]; manage: boolean }) {
  const t = useT()
  const c = t.projects.keys.columns
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-5">{c.name}</TableHead>
              <TableHead>{c.key}</TableHead>
              <TableHead>{c.level}</TableHead>
              <TableHead>{c.expiry}</TableHead>
              <TableHead>{c.ipAllowlist}</TableHead>
              <TableHead>{c.lastUsed}</TableHead>
              <TableHead>{c.status}</TableHead>
              {manage && <TableHead className="pe-5 text-end">{c.actions}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.id} className={cn((k.revokedAt || isExpired(k)) && 'text-muted-foreground')}>
                <TableCell className="max-w-44 ps-5">
                  <p className="truncate font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">{t.projects.keys.createdOn(formatDay(k.createdAt))}</p>
                </TableCell>
                <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                <TableCell>{k.maxLevel ? <LevelBadge level={k.maxLevel} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <KeyExpiry k={k} />
                </TableCell>
                <TableCell className="max-w-44">
                  <IpList ips={k.ipAllowlist} />
                </TableCell>
                <TableCell className="text-muted-foreground">{k.lastUsedAt ? relativeTime(k.lastUsedAt) : t.projects.keys.neverUsed}</TableCell>
                <TableCell>
                  <KeyStatus k={k} />
                </TableCell>
                {manage && (
                  <TableCell className="pe-5 text-end">
                    {!k.revokedAt && <RevokeButton k={k} />}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 px-5 py-3">
            <div className={cn('min-w-0 flex-1 space-y-1.5', (k.revokedAt || isExpired(k)) && 'text-muted-foreground')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{k.name}</span>
                <KeyStatus k={k} />
                {k.maxLevel && <LevelBadge level={k.maxLevel} />}
              </div>
              <p className="font-mono text-xs">{k.prefix}…</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <KeyExpiry k={k} />
                <IpList ips={k.ipAllowlist} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.projects.keys.createdOn(formatDate(k.createdAt))} ·{' '}
                {k.lastUsedAt ? t.projects.keys.usedAgo(relativeTime(k.lastUsedAt)) : t.projects.keys.neverUsed}
              </p>
            </div>
            {manage && !k.revokedAt && <RevokeButton k={k} />}
          </li>
        ))}
      </ul>
    </>
  )
}

function KeyExpiry({ k }: { k: ApiKey }) {
  const t = useT()
  if (k.expiresAt === undefined) return <span className="text-muted-foreground">—</span>
  if (k.expiresAt === null) return <span className="text-muted-foreground">{t.projects.keys.neverExpires}</span>
  const left = k.expiresAt - Date.now()
  return (
    <span
      className={cn('text-xs', left <= 0 ? 'text-muted-foreground' : left < 7 * 86_400_000 ? 'text-warning' : 'text-muted-foreground')}
      title={t.projects.keys.expiresAtTitle(formatDate(k.expiresAt))}
    >
      {left <= 0
        ? t.projects.keys.expiredOn(formatDay(k.expiresAt))
        : t.projects.keys.expiresIn(untilTime(k.expiresAt))}
    </span>
  )
}

function IpList({ ips }: { ips?: string[] }) {
  const t = useT()
  if (!ips) return <span className="text-muted-foreground">—</span>
  if (!ips.length) return <span className="text-xs text-muted-foreground">{t.projects.keys.anyIp}</span>
  return (
    <span className="flex min-w-0 items-center gap-1 font-mono text-xs" title={ips.join('\n')}>
      <NetworkIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{ips[0]}</span>
      {ips.length > 1 && <span className="shrink-0 text-muted-foreground">+{ips.length - 1}</span>}
    </span>
  )
}

function KeyStatus({ k }: { k: ApiKey }) {
  const t = useT()
  if (k.revokedAt) {
    return (
      <Badge variant="muted" title={t.projects.keys.revokedTitle(formatDate(k.revokedAt))}>
        {t.projects.keys.revoked}
      </Badge>
    )
  }
  if (isExpired(k)) {
    return (
      <Badge variant="destructive" title={t.projects.keys.expiredTitle(formatDate(k.expiresAt))}>
        {t.projects.keys.expired}
      </Badge>
    )
  }
  return <Badge variant="success">{t.projects.keys.active}</Badge>
}

function RevokeButton({ k }: { k: ApiKey }) {
  const queryClient = useQueryClient()
  const t = useT()
  const revoke = useMutation({
    mutationFn: () => api.revokeKey(k.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keysQuery.queryKey })
      toast.success(t.projects.keys.revokedToast(k.name))
    },
  })
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" />}
      title={t.projects.keys.revokeTitle(k.name)}
      description={<p>{rich(t.projects.keys.revokeDescription(k.prefix), { c: (s) => <span className="font-mono">{s}</span> })}</p>}
      confirmLabel={t.projects.keys.revoke}
      destructive
      onConfirm={() => revoke.mutateAsync()}
    >
      <BanIcon />
      {t.projects.keys.revoke}
    </ConfirmDialog>
  )
}

function McpCommands({ gateway, apiKey }: { gateway: string; apiKey: string }) {
  const t = useT()
  return (
    <Tabs defaultValue="hosted" className="gap-3">
      <TabsList>
        <TabsTrigger value="hosted">{t.projects.keys.mcpTabs.hosted}</TabsTrigger>
        <TabsTrigger value="local">{t.projects.keys.mcpTabs.local}</TabsTrigger>
        <TabsTrigger value="json">{t.projects.keys.mcpTabs.json}</TabsTrigger>
      </TabsList>
      <TabsContent value="hosted" className="space-y-2">
        <p className="text-xs text-muted-foreground">{t.projects.keys.hostedHint}</p>
        <CodeBlock lang="bash" code={hostedMcpCommand(gateway, apiKey)} wrap />
      </TabsContent>
      <TabsContent value="local" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {rich(t.projects.keys.localHint, { c: (s) => <code className="font-mono">{s}</code> })}
        </p>
        <CodeBlock lang="bash" code={localMcpCommand(gateway, apiKey)} wrap />
      </TabsContent>
      <TabsContent value="json" className="space-y-2">
        <p className="text-xs text-muted-foreground">{t.projects.keys.jsonHint}</p>
        <CodeBlock lang="json" code={mcpJsonConfig(gateway, apiKey)} />
      </TabsContent>
    </Tabs>
  )
}

/** Expiry choices in days; 0 means the key never expires. */
const expiryOptions = [7, 30, 90, 0]

function CreateKeyDialog({
  open,
  onOpenChange,
  gateway,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  gateway?: string
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [level, setLevel] = useState<Level>('interact')
  const [expiresInDays, setExpiresInDays] = useState(90)
  const [ipText, setIpText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const t = useT()

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createKey>[0]) => api.createKey(input),
    onSuccess: (key) => {
      setCreated(key)
      void queryClient.invalidateQueries({ queryKey: keysQuery.queryKey })
    },
  })

  const close = () => {
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Once the plaintext key is shown, only the explicit button closes the dialog.
        if (!next && created) return
        onOpenChange(next)
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setName('')
          setLevel('interact')
          setExpiresInDays(90)
          setIpText('')
          setError(null)
          setCreated(null)
          create.reset()
        }
      }}
      disablePointerDismissal={!!created}
    >
      <DialogContent className="sm:max-w-2xl" showCloseButton={!created}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t.projects.keys.createdTitle}</DialogTitle>
              <DialogDescription>{t.projects.keys.createdName(created.name)}</DialogDescription>
            </DialogHeader>
            <Callout tone="warning">
              <p>{rich(t.projects.keys.showOnce, { b: (s) => <span className="font-medium">{s}</span> })}</p>
            </Callout>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {created.maxLevel && <LevelBadge level={created.maxLevel} prefix={t.projects.keys.maxPrefix} />}
              <KeyExpiry k={created} />
              <IpList ips={created.ipAllowlist} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t.projects.keys.keyLabel}</p>
              <CodeBlock code={created.key} wrap />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t.projects.keys.commandLabel}</p>
              {gateway ? <McpCommands gateway={gateway} apiKey={created.key} /> : <Skeleton className="h-16 w-full" />}
            </div>
            <DialogFooter>
              <Button onClick={close}>{t.projects.keys.savedClose}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.projects.keys.createTitle}</DialogTitle>
              <DialogDescription>{t.projects.keys.createDescription}</DialogDescription>
            </DialogHeader>
            <form
              id="create-key"
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = name.trim()
                if (!trimmed) return setError(t.projects.keys.nameRequired)
                const { valid, invalid } = parseCidrs(ipText)
                if (invalid.length) return setError(t.projects.keys.invalidCidrs(invalid))
                setError(null)
                create.mutate({ name: trimmed, maxLevel: level, expiresInDays, ipAllowlist: valid })
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="key-name">{t.projects.keys.columns.name}</Label>
                <Input
                  id="key-name"
                  value={name}
                  maxLength={64}
                  autoFocus
                  placeholder={t.projects.keys.namePlaceholder}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{t.projects.keys.maxLevel}</p>
                <ChoiceCards
                  name="key-level"
                  aria-label={t.projects.keys.maxLevel}
                  value={level}
                  onChange={setLevel}
                  className="sm:grid-cols-3"
                  options={levels.map((l) => ({
                    value: l,
                    label: levelMeta[l].label,
                    description: levelMeta[l].description,
                    warning: l === 'advanced',
                  }))}
                />
                {level === 'advanced' && (
                  <Callout tone="warning">
                    <p>{rich(t.projects.keys.advancedWarning, { b: (s) => <span className="font-medium">{s}</span> })}</p>
                  </Callout>
                )}
                <p className="text-xs text-muted-foreground">{t.projects.keys.levelHint}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium" id="key-expiry-label">
                  {t.projects.keys.columns.expiry}
                </p>
                <ToggleGroup
                  value={[String(expiresInDays)]}
                  onValueChange={(v) => v[0] !== undefined && setExpiresInDays(Number(v[0]))}
                  aria-labelledby="key-expiry-label"
                >
                  {expiryOptions.map((days) => (
                    <ToggleGroupItem key={days} value={String(days)}>
                      {days ? t.common.time.days(days) : t.projects.keys.neverExpires}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {expiresInDays === 0 ? (
                  <Callout tone="warning">
                    <p>{t.projects.keys.neverWarning}</p>
                  </Callout>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t.projects.keys.expiresAround(formatDay(Date.now() + expiresInDays * 86_400_000))}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-ips">
                  {t.projects.keys.columns.ipAllowlist}{' '}
                  <span className="font-normal text-muted-foreground">{t.projects.optional}</span>
                </Label>
                <Textarea
                  id="key-ips"
                  rows={2}
                  value={ipText}
                  className="font-mono text-xs md:text-xs"
                  placeholder={'203.0.113.0/24\n2001:db8::/32'}
                  onChange={(e) => setIpText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.projects.keys.ipHint}</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                {t.common.cancel}
              </Button>
              <Button type="submit" form="create-key" disabled={create.isPending}>
                {create.isPending && <LoaderCircleIcon className="animate-spin" />}
                {t.common.create}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Tool names and the catalog key of their description. */
const tools: [string, keyof Messages['projects']['keys']['tools']][] = [
  ['list_devices', 'list'],
  ['connect_device / wait_for_device', 'connect'],
  ['list_pages / select_page', 'pages'],
  ['take_snapshot / take_screenshot', 'snapshot'],
  ['click / fill / type_text / press_key …', 'act'],
  ['list_console_messages / list_network_requests', 'logs'],
  ['get_session_timeline', 'timeline'],
  ['wait_for_control', 'control'],
]

function McpGuideCard({ gateway }: { gateway?: string }) {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.projects.keys.guideTitle}</CardTitle>
        <CardDescription>
          {rich(t.projects.keys.guideDescription(KEY_PLACEHOLDER), {
            c: (s) => <span className="font-mono">{s}</span>,
            link: (s) => (
              <Link to="/docs" hash="mcp" className="text-brand hover:underline">
                {s}
              </Link>
            ),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {gateway ? <McpCommands gateway={gateway} apiKey={KEY_PLACEHOLDER} /> : <Skeleton className="h-24 w-full" />}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.projects.keys.commonTools}</p>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {tools.map(([name, key]) => (
              <div key={name} className="contents">
                <dt className="font-mono text-xs leading-5 break-all text-foreground/90">{name}</dt>
                <dd className="-mt-1.5 text-muted-foreground sm:mt-0">{t.projects.keys.tools[key]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium">{t.projects.keys.tryTitle}</p>
          <p className="mt-1 text-muted-foreground">{t.projects.keys.tryExample}</p>
        </div>
      </CardContent>
    </Card>
  )
}
