import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  CheckIcon,
  ChevronRightIcon,
  GlobeIcon,
  LoaderCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ZapIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { CodeBlock } from '@/components/code-block'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { OnlineBadge } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TestResultView } from '@/features/test-result'
import { rich, useT } from '@/i18n'
import { api } from '@/lib/api'
import { formatDate, invalidOrigins, parseOrigins, platformLabel, relativeTime, summarizeUA } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { configQuery, integrationQuery, projectsQuery } from '@/lib/queries'
import { androidSnippet, h5PinnedSnippet, h5Snippet, iosSnippet, pinnedSdkUrl } from '@/lib/snippets'
import { useProjectStream } from '@/lib/stream'
import type { GatewayConfig, Integration, Project } from '@/lib/types'
import { cn } from '@/lib/utils'

export function IntegrationTab({ project }: { project: Project }) {
  const config = useQuery(configQuery)
  const stream = useProjectStream(project.id)
  const integration = useQuery(integrationQuery(project.id, stream === 'live'))
  const gateway = config.data?.gatewayUrl ?? integration.data?.gatewayUrl
  const appKey = project.appKey
  const queryClient = useQueryClient()
  const online = integration.data?.onlineDevices

  // Keep the header's online/total counters in step with the faster integration polling.
  useEffect(() => {
    if (online !== undefined && online !== project.onlineDevices) {
      void queryClient.invalidateQueries({ queryKey: projectsQuery.queryKey })
    }
  }, [online, project.onlineDevices, queryClient])

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="min-w-0 space-y-5 lg:col-span-3">
        <KeyCard project={project} gateway={gateway} sdkUrl={integration.data?.sdkUrl} config={config.data} />
        <SnippetCard gateway={gateway} appKey={appKey} origins={project.allowedOrigins} config={config.data} />
        <OriginsCard project={project} />
      </div>
      <div className="min-w-0 space-y-5 max-lg:order-first lg:col-span-2">
        <VerifyCard project={project} integration={integration.data} loading={integration.isPending} />
        <TroubleshootCard />
      </div>
    </div>
  )
}

function Field({ label, value, mono = true }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-3">
          <span className={cn('min-w-0 flex-1 truncate text-sm', mono && 'font-mono')} title={value}>
            {value}
          </span>
          <CopyButton value={value} variant="ghost" />
        </div>
      ) : (
        <Skeleton className="h-9 w-full" />
      )}
    </div>
  )
}

function KeyCard({
  project,
  gateway,
  sdkUrl,
  config,
}: {
  project: Project
  gateway?: string
  sdkUrl?: string
  config?: GatewayConfig
}) {
  const t = useT()
  const tk = t.integration.key
  const queryClient = useQueryClient()
  const manage = useCan('project.manage')
  const rotate = useMutation({
    mutationFn: () => api.rotateAppKey(project.id),
    onSuccess: (updated) => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (old) =>
        old?.map((p) => (p.id === updated.id ? updated : p)),
      )
      void queryClient.invalidateQueries({ queryKey: ['projects', project.id] })
      toast.success(tk.rotated)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tk.title}</CardTitle>
        <CardDescription>{tk.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={tk.gatewayUrl} value={gateway} />
        <div className="space-y-1.5">
          <Field label={tk.appKey} value={project.appKey} />
          <div className={cn('flex justify-end', !manage && 'hidden')}>
            <ConfirmDialog
              trigger={<Button variant="ghost" size="xs" className="text-muted-foreground" />}
              title={tk.rotateTitle}
              description={
                <div className="space-y-2">
                  <p>{tk.rotateNew}</p>
                  <p>{tk.rotateImpact}</p>
                </div>
              }
              confirmLabel={tk.rotateConfirm}
              destructive
              onConfirm={() => rotate.mutateAsync()}
            >
              <RefreshCwIcon />
              {tk.rotate}
            </ConfirmDialog>
          </div>
        </div>
        {sdkUrl && <Field label={tk.sdkLatest} value={sdkUrl} />}
        {gateway && config?.sdkVersion && (
          <Field label={tk.sdkPinned(config.sdkVersion)} value={pinnedSdkUrl(gateway, config.sdkVersion)} />
        )}
      </CardContent>
    </Card>
  )
}

function SnippetCard({
  gateway,
  appKey,
  origins,
  config,
}: {
  gateway?: string
  appKey: string
  origins: string[]
  config?: GatewayConfig
}) {
  const t = useT()
  const ts = t.integration.snippet
  const [variant, setVariant] = useState<'latest' | 'pinned'>('latest')
  const pinnable = !!(config?.sdkVersion && config.sdkIntegrity)
  const pinned = pinnable && variant === 'pinned'
  const code = (s: React.ReactNode) => <code className="font-mono text-xs">{s}</code>
  return (
    <Card>
      <CardHeader>
        <CardTitle>{ts.title}</CardTitle>
        <CardDescription>
          {rich(ts.description, {
            link: (s) => (
              <Link to="/docs" hash="native" className="text-brand hover:underline">
                {s}
              </Link>
            ),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {gateway ? (
          <Tabs defaultValue="h5" className="gap-3">
            <TabsList>
              <TabsTrigger value="h5">{ts.tabH5}</TabsTrigger>
              <TabsTrigger value="ios">{ts.tabIos}</TabsTrigger>
              <TabsTrigger value="android">{ts.tabAndroid}</TabsTrigger>
            </TabsList>
            <TabsContent value="h5" className="space-y-3">
              {pinnable && (
                <div className="space-y-2">
                  <ToggleGroup
                    value={[variant]}
                    onValueChange={(v) => v[0] && setVariant(v[0] as 'latest' | 'pinned')}
                    aria-label={ts.sdkVersion}
                  >
                    <ToggleGroupItem value="latest">{ts.latest}</ToggleGroupItem>
                    <ToggleGroupItem value="pinned">{ts.pinned(config?.sdkVersion ?? '')}</ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-xs text-muted-foreground">{pinned ? ts.pinnedHint : ts.latestHint}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {rich(ts.h5Hint, { tag: (s) => code(<>&lt;{s}&gt;</>) })}
              </p>
              <CodeBlock
                lang="html"
                code={
                  pinned && config?.sdkVersion && config.sdkIntegrity
                    ? h5PinnedSnippet(gateway, appKey, config.sdkVersion, config.sdkIntegrity)
                    : h5Snippet(gateway, appKey)
                }
              />
            </TabsContent>
            <TabsContent value="ios" className="space-y-2">
              <p className="text-sm text-muted-foreground">{rich(ts.iosHint, { c: code })}</p>
              <CodeBlock lang="swift" code={iosSnippet(gateway, appKey)} maxHeight="26rem" />
            </TabsContent>
            <TabsContent value="android" className="space-y-2">
              <p className="text-sm text-muted-foreground">{rich(ts.androidHint, { c: code })}</p>
              <CodeBlock lang="kotlin" code={androidSnippet(gateway, appKey, origins)} maxHeight="26rem" />
            </TabsContent>
          </Tabs>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </CardContent>
    </Card>
  )
}

function OriginsCard({ project }: { project: Project }) {
  const t = useT()
  const to = t.integration.origins
  const queryClient = useQueryClient()
  const manage = useCan('project.manage')
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (allowedOrigins: string[]) => api.updateProject(project.id, { allowedOrigins }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (old) =>
        old?.map((p) => (p.id === updated.id ? updated : p)),
      )
      toast.success(to.saved)
      setEditing(false)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{to.title}</CardTitle>
        <CardDescription>{to.description}</CardDescription>
        {!editing && manage && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setText(project.allowedOrigins.join('\n'))
                setError(null)
                setEditing(true)
              }}
            >
              <PencilIcon />
              {to.edit}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              const list = parseOrigins(text)
              const bad = invalidOrigins(list)
              if (bad.length) return setError(to.invalid(bad))
              setError(null)
              save.mutate(list)
            }}
          >
            <Textarea
              value={text}
              rows={4}
              autoFocus
              aria-label={to.title}
              className="font-mono text-xs md:text-xs"
              placeholder={'https://m.example.com\nhttps://*.example.com'}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending && <LoaderCircleIcon className="animate-spin" />}
                {t.common.save}
              </Button>
            </div>
          </form>
        ) : project.allowedOrigins.length ? (
          <div className="flex flex-wrap gap-2">
            {project.allowedOrigins.map((o) => (
              <Badge key={o} variant="secondary" className="font-mono">
                <GlobeIcon />
                {o}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{to.unrestricted}</p>
        )}
      </CardContent>
    </Card>
  )
}

type StepState = 'done' | 'active' | 'pending'

function Step({
  index,
  title,
  state,
  last,
  children,
}: {
  index: number
  title: string
  state: StepState
  last?: boolean
  children?: React.ReactNode
}) {
  return (
    <li className="relative flex gap-3">
      {!last && (
        <span
          className={cn('absolute top-7 bottom-0 left-[13px] w-px', state === 'done' ? 'bg-success/50' : 'bg-border')}
          aria-hidden
        />
      )}
      <span
        className={cn(
          'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
          state === 'done' && 'border-success bg-success text-white dark:text-background',
          state === 'active' && 'border-brand bg-brand-soft text-brand',
          state === 'pending' && 'bg-card text-muted-foreground',
        )}
      >
        {state === 'done' ? <CheckIcon className="size-4" /> : index}
      </span>
      <div className={cn('min-w-0 flex-1 pb-6', last && 'pb-0')}>
        <p className={cn('pt-1 text-sm font-medium', state === 'pending' && 'text-muted-foreground')}>{title}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  )
}

function VerifyCard({
  project,
  integration,
  loading,
}: {
  project: Project
  integration?: Integration
  loading: boolean
}) {
  const tv = useT().integration.verify
  const device = integration?.lastDevice ?? null
  const focused = device?.currentPage ?? null
  const test = useMutation({ mutationFn: (id: string) => api.testDevice(id), meta: { silent: true } })

  const seen = !!integration?.firstSeenAt
  const step1: StepState = seen ? 'done' : 'active'
  const step2: StepState = device ? (device.online ? 'done' : 'active') : 'pending'
  const step3: StepState = test.data?.ok ? 'done' : device?.online ? 'active' : 'pending'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tv.title}
          {!seen && !loading && <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        <CardDescription>{tv.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-7 w-3/5" />
          </div>
        ) : (
          <ol>
            <Step index={1} title={seen ? tv.seen : tv.waiting} state={step1}>
              {seen ? (
                <p className="text-xs text-muted-foreground">
                  {tv.firstSeen(formatDate(integration?.firstSeenAt), integration?.onlineDevices ?? 0)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tv.waitingHint}
                  {project.disabled && <span className="mt-1 block text-destructive">{tv.projectDisabled}</span>}
                </p>
              )}
            </Step>
            <Step index={2} title={device && !device.online ? tv.deviceOffline : tv.deviceOnline} state={step2}>
              {device && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-base font-semibold tracking-wider">{device.code}</span>
                    <OnlineBadge online={device.online} />
                  </div>
                  <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">{tv.platform}</dt>
                    <dd className="truncate" title={device.ua}>
                      {platformLabel(device.platform)} · {summarizeUA(device.ua)}
                    </dd>
                    <dt className="text-muted-foreground">{tv.appVersion}</dt>
                    <dd className="truncate">{device.app ? `${device.app.name} ${device.app.version}` : tv.noApp}</dd>
                    <dt className="text-muted-foreground">{tv.currentPage}</dt>
                    <dd className="truncate" title={focused?.url}>
                      {focused ? (
                        <>
                          <span className="font-medium">{focused.title || tv.untitled}</span>
                          <span className="block truncate font-mono text-muted-foreground">{focused.url}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                    <dt className="text-muted-foreground">{tv.sdkVersion}</dt>
                    <dd className="font-mono">{device.sdk || '—'}</dd>
                    {!device.online && (
                      <>
                        <dt className="text-muted-foreground">{tv.lastSeen}</dt>
                        <dd>{relativeTime(device.lastSeenAt)}</dd>
                      </>
                    )}
                  </dl>
                  <Link
                    to="/devices/$deviceId"
                    params={{ deviceId: device.id }}
                    search={{ from: project.id }}
                    className="inline-flex items-center gap-0.5 text-xs text-brand hover:underline"
                  >
                    {tv.viewDevice}
                    <ChevronRightIcon className="size-3" />
                  </Link>
                </div>
              )}
            </Step>
            <Step index={3} title={tv.test} state={step3} last>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{tv.testHint}</p>
                <Button
                  variant="brand"
                  size="sm"
                  disabled={!device?.online || test.isPending}
                  onClick={() => device && test.mutate(device.id)}
                >
                  {test.isPending ? <LoaderCircleIcon className="animate-spin" /> : <ZapIcon />}
                  {test.isPending ? tv.testing : tv.test}
                </Button>
                {(test.data || test.error) && !test.isPending && (
                  <TestResultView result={test.data} error={test.error} />
                )}
              </div>
            </Step>
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

const troubleshooting = ['badKey', 'origin', 'csp', 'sdkOld', 'timeout'] as const

function TroubleshootCard() {
  const tt = useT().integration.troubleshoot
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlertIcon className="size-4 text-muted-foreground" />
          {tt.title}
        </CardTitle>
        <CardDescription>
          {rich(tt.description, {
            link: (s) => (
              <Link to="/docs" hash="troubleshoot" className="text-brand hover:underline">
                {s}
              </Link>
            ),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {troubleshooting.map((id) => (
            <li key={id} className="py-2.5 first:pt-0 last:pb-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {tt[id].title}
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {rich(tt[id].body, { c: (s) => <code className="font-mono">{s}</code> })}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
