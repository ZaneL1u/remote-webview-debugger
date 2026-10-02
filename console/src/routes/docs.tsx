import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowDownIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  BotIcon,
  BrainCircuitIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  ClipboardCheckIcon,
  CodeIcon,
  CompassIcon,
  EyeIcon,
  FlaskConicalIcon,
  HandIcon,
  HashIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  MousePointerClickIcon,
  PlugZapIcon,
  ServerIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'

import { Callout } from '@/components/callout'
import { CodeBlock } from '@/components/code-block'
import { CopyButton } from '@/components/copy-button'
import { BRAND, Logo } from '@/components/logo'
import { LevelBadge } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Messages, rich, useT } from '@/i18n'
import { levelMeta } from '@/lib/policy'
import { configQuery, projectsQuery } from '@/lib/queries'
import {
  cspSnippet,
  cursorMcpConfig,
  h5FullSnippet,
  h5PinnedSnippet,
  hostedMcpCommand,
  jsApiSnippet,
  kotlinNativeSnippet,
  localMcpCommand,
  maskSnippet,
  mcpJsonConfig,
  stdioMcpConfig,
  swiftNativeSnippet,
} from '@/lib/snippets'
import type { Level } from '@/lib/types'
import { cn } from '@/lib/utils'

const KEY_PLACEHOLDER = 'rwd_sk_live_…'
const APP_KEY_PLACEHOLDER = 'rwd_pk_…'
const PROJECT_KEY = 'rwd:docs-project'

type TocId = Exclude<keyof Messages['docs']['toc'], 'label'>

// Titles come from t.docs.toc at render time.
const toc: { id: TocId; icon: React.ReactNode }[] = [
  { id: 'overview', icon: <CompassIcon /> },
  { id: 'concepts', icon: <ListTreeIcon /> },
  { id: 'quickstart', icon: <SparklesIcon /> },
  { id: 'h5', icon: <CodeIcon /> },
  { id: 'native', icon: <SmartphoneIcon /> },
  { id: 'mcp', icon: <BotIcon /> },
  { id: 'tools', icon: <WrenchIcon /> },
  { id: 'approval', icon: <ShieldCheckIcon /> },
  { id: 'verify', icon: <ClipboardCheckIcon /> },
  { id: 'troubleshoot', icon: <CircleHelpIcon /> },
]

const tocIds = toc.map((t) => t.id)

export function DocsPage() {
  const t = useT()
  const config = useQuery(configQuery)
  const projects = useQuery(projectsQuery)
  const [projectId, setProjectId] = useState<string>(() => {
    try {
      return localStorage.getItem(PROJECT_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const project = projects.data?.find((p) => p.id === projectId) ?? projects.data?.find((p) => !p.disabled) ?? projects.data?.[0]
  const gateway = config.data?.gatewayUrl ?? `${window.location.origin}/v1`
  const appKey = project?.appKey ?? APP_KEY_PLACEHOLDER
  const active = useScrollSpy(tocIds)

  // Jump to the anchor once the lazily loaded page has rendered.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [])

  const choose = (id: string) => {
    setProjectId(id)
    try {
      localStorage.setItem(PROJECT_KEY, id)
    } catch {
      // per-viewer convenience only
    }
  }

  const ctx: DocCtx = {
    gateway,
    appKey,
    origins: project?.allowedOrigins ?? [],
    projectId: project?.id,
    sdkVersion: config.data?.sdkVersion,
    sdkIntegrity: config.data?.sdkIntegrity,
  }

  return (
    <div className="space-y-8">
      <DocsHero />

      <Personalize
        gateway={config.data?.gatewayUrl}
        projects={projects.data}
        loading={projects.isPending}
        project={project}
        onProject={choose}
      />

      <div className="grid gap-10 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:gap-14">
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-0.5" aria-label={t.docs.toc.label}>
            <p className="mb-2 px-2.5 text-xs font-medium tracking-wide text-muted-foreground">{t.docs.toc.label}</p>
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0',
                  active === item.id && 'bg-brand-soft font-medium text-brand hover:bg-brand-soft hover:text-brand',
                )}
                aria-current={active === item.id ? 'location' : undefined}
              >
                {item.icon}
                {t.docs.toc[item.id]}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 max-w-4xl space-y-14">
          <MobileToc />
          <Overview />
          <Concepts />
          <Quickstart ctx={ctx} />
          <H5Section ctx={ctx} />
          <NativeSection ctx={ctx} />
          <McpSection ctx={ctx} />
          <ToolsSection />
          <ApprovalSection />
          <VerifySection ctx={ctx} />
          <TroubleshootSection />
        </div>
      </div>
    </div>
  )
}

type DocCtx = {
  gateway: string
  appKey: string
  origins: string[]
  projectId?: string
  sdkVersion?: string
  sdkIntegrity?: string
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    let frame = 0
    // The current section is the last one whose heading has scrolled under the sticky header.
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        let current = ids[0]
        for (const id of ids) {
          const el = document.getElementById(id)
          if (el && el.getBoundingClientRect().top <= 140) current = id
        }
        const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
        setActive(atEnd ? ids[ids.length - 1] : current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ids.join()])
  return active
}

// ---------- building blocks ----------

function Section({ id, lead, children }: { id: TocId; lead?: React.ReactNode; children: React.ReactNode }) {
  const t = useT()
  const icon = toc.find((item) => item.id === id)?.icon
  const title = t.docs.toc[id]
  return (
    <section id={id} className="space-y-5" aria-labelledby={`${id}-title`}>
      <div className="space-y-2">
        <h2 id={`${id}-title`} className="group flex items-center gap-2.5 text-xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4">{icon}</span>
          {title}
          <a
            href={`#${id}`}
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={t.docs.anchorLabel(title)}
          >
            <HashIcon className="size-4" />
          </a>
        </h2>
        {lead && <p className="leading-relaxed text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  )
}

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="pt-2 text-base font-semibold">
      {children}
    </h3>
  )
}

function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[15px] leading-7 text-foreground/90', className)}>{children}</p>
}

function C({ children }: { children: React.ReactNode }) {
  return <code className="rounded-[5px] border bg-muted px-1 py-px font-mono text-[0.85em] break-words">{children}</code>
}

/** rich() tags shared by the prose: <c> for inline code, <link> for an in-console link. */
const c = (s: React.ReactNode) => <C>{s}</C>
const docLink = (to: '/' | '/projects' | '/keys' | '/audit') => (s: React.ReactNode) => (
  <Link to={to} className="text-brand hover:underline">
    {s}
  </Link>
)

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 pl-5 text-[15px] leading-7 text-foreground/90 marker:text-muted-foreground [&>li]:list-disc">{children}</ul>
}

function DocTable({ head, rows, className }: { head: string[]; rows: React.ReactNode[][]; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-card', className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3.5 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={cn('px-3.5 py-2.5 leading-6', j === 0 && 'whitespace-nowrap')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="relative space-y-6 [counter-reset:step]">{children}</ol>
}

function Step({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="relative pl-11 [counter-increment:step] before:absolute before:top-0 before:left-0 before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:bg-brand before:text-xs before:font-semibold before:text-brand-foreground before:content-[counter(step)] after:absolute after:top-8 after:bottom-[-1.25rem] after:left-[13px] after:w-px after:bg-border last:after:hidden">
      <p className="pt-0.5 font-medium">{title}</p>
      {children && <div className="mt-2 space-y-3 text-[15px] leading-7 text-foreground/90">{children}</div>}
    </li>
  )
}

// ---------- hero & personalization ----------

function DocsHero() {
  const t = useT()
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 shadow-xs sm:px-8 sm:py-10">
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
      <div className="bg-brand-gradient pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-[0.12] blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Logo className="size-11 drop-shadow-[0_8px_18px_rgb(93_92_245/0.35)] sm:size-16" />
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-brand">{t.docs.hero.eyebrow(BRAND.name)}</p>
          <h1 className="text-[1.375rem] leading-snug font-semibold tracking-tight sm:text-3xl">{t.docs.hero.title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{t.docs.hero.body}</p>
        </div>
      </div>
    </div>
  )
}

function Personalize({
  gateway,
  projects,
  loading,
  project,
  onProject,
}: {
  gateway?: string
  projects?: { id: string; name: string; appKey: string; disabled: boolean }[]
  loading: boolean
  project?: { id: string; name: string; appKey: string }
  onProject: (id: string) => void
}) {
  const t = useT().docs.personalize
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-3 sm:p-5">
      <Field label={t.gateway} hint={t.gatewayHint}>
        {gateway ? <Value value={gateway} /> : <Skeleton className="h-9 w-full" />}
      </Field>
      <Field label={t.project} hint={t.projectHint}>
        {loading ? (
          <Skeleton className="h-9 w-full" />
        ) : projects?.length ? (
          <NativeSelect value={project?.id ?? ''} onChange={(e) => onProject(e.target.value)} aria-label={t.selectProject}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.disabled ? t.disabledSuffix : ''}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Button variant="outline" size="sm" className="h-9 w-full" nativeButton={false} render={<Link to="/projects" />}>
            {t.noProjects}
          </Button>
        )}
      </Field>
      <Field label={t.appKey} hint={t.appKeyHint}>
        {project ? <Value value={project.appKey} /> : <Value value={APP_KEY_PLACEHOLDER} muted />}
      </Field>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="truncate text-muted-foreground">{hint}</span>
      </p>
      {children}
    </div>
  )
}

function Value({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <div className="flex h-9 items-center gap-1 rounded-md border bg-muted/40 pr-1 pl-3">
      <span className={cn('min-w-0 flex-1 truncate font-mono text-[13px]', muted && 'text-muted-foreground')} title={value}>
        {value}
      </span>
      {!muted && <CopyButton value={value} variant="ghost" />}
    </div>
  )
}

function MobileToc() {
  const t = useT()
  return (
    <details className="group rounded-xl border bg-card lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {t.docs.toc.label}
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <nav className="grid grid-cols-2 gap-1 border-t p-2" aria-label={t.docs.toc.label}>
        {toc.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-4"
          >
            {item.icon}
            {t.docs.toc[item.id]}
          </a>
        ))}
      </nav>
    </details>
  )
}

// ---------- sections ----------

function Node({ icon, title, sub, className }: { icon: React.ReactNode; title: string; sub: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card p-3.5 shadow-xs', className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand [&_svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function Link2({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted-foreground md:w-14">
      <ArrowLeftRightIcon className="hidden size-4 md:block" />
      <ArrowDownIcon className="size-4 md:hidden" />
      <span className="font-mono">{label}</span>
    </div>
  )
}

function Overview() {
  const t = useT().docs.overview
  return (
    <Section id="overview" lead={t.lead}>
      <div className="rounded-2xl border bg-muted/30 p-3 sm:p-4">
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          <Node icon={<SmartphoneIcon />} title={t.device} sub={t.deviceSub} />
          <Link2 label="WSS" />
          <Node icon={<ServerIcon />} title={t.gateway} sub={t.gatewaySub} className="border-brand/40 ring-2 ring-brand/10" />
          <Link2 label="MCP" />
          <Node icon={<BrainCircuitIcon />} title={t.agent} sub={t.agentSub} />
        </div>
        <div className="mt-2 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
            <LayoutDashboardIcon className="size-3.5 text-brand" />
            {t.console}
          </div>
        </div>
      </div>
      <Ul>
        <li>{t.noPorts}</li>
        <li>{t.oneKey}</li>
        <li>{rich(t.masking, { c })}</li>
      </Ul>
    </Section>
  )
}

function Concepts() {
  const t = useT().docs.concepts
  return (
    <Section id="concepts">
      <DocTable
        head={t.head}
        rows={[
          [t.gateway, t.gatewayBody, <C key="g">https://host/v1</C>],
          [t.project, t.projectBody, t.projectExample],
          [t.appKey, t.appKeyBody, <C key="pk">{t.appKeyFormat}</C>],
          [t.apiKey, t.apiKeyBody, <C key="sk">{t.apiKeyFormat}</C>],
          [t.device, t.deviceBody, 'UUID'],
          [t.deviceCode, t.deviceCodeBody, <C key="dc">GSJH-EV2J</C>],
          [t.page, t.pageBody, <C key="p">{t.pageFormat}</C>],
          [t.approval, t.approvalBody, (['observe', 'interact', 'advanced'] as Level[]).map((l) => levelMeta[l].label).join(' / ')],
          [t.level, t.levelBody, <C key="lv">observe / interact / advanced</C>],
        ]}
      />
    </Section>
  )
}

function Quickstart({ ctx }: { ctx: DocCtx }) {
  const t = useT().docs.quickstart
  return (
    <Section id="quickstart" lead={t.lead}>
      <Steps>
        <Step title={t.projectTitle}>
          <P>{rich(t.projectBody, { link: docLink('/projects') })}</P>
        </Step>
        <Step title={t.sdkTitle}>
          <P>{t.sdkBody}</P>
          <CodeBlock lang="html" code={`<script src="${ctx.gateway}/sdk.js"></script>\n<script>RemoteWebviewDebugger.run(${JSON.stringify(ctx.gateway)}, ${JSON.stringify(ctx.appKey)})</script>`} />
        </Step>
        <Step title={t.onlineTitle}>
          <P>{rich(t.onlineBody, { link: docLink('/') })}</P>
        </Step>
        <Step title={t.keyTitle}>
          <P>{rich(t.keyBody(levelMeta.interact.label), { c, link: docLink('/keys') })}</P>
        </Step>
        <Step title={t.mcpTitle}>
          <CodeBlock lang="bash" code={hostedMcpCommand(ctx.gateway, KEY_PLACEHOLDER)} wrap />
          <P>{t.mcpExample}</P>
        </Step>
      </Steps>
    </Section>
  )
}

function H5Section({ ctx }: { ctx: DocCtx }) {
  const t = useT().docs.h5
  const pinnable = !!(ctx.sdkVersion && ctx.sdkIntegrity)
  return (
    <Section id="h5" lead={t.lead}>
      <H3>{t.loadTitle}</H3>
      <Tabs defaultValue="latest" className="gap-3">
        <TabsList>
          <TabsTrigger value="latest">{t.latestTab}</TabsTrigger>
          <TabsTrigger value="pinned" disabled={!pinnable}>
            {t.pinnedTab}
            {ctx.sdkVersion ? ` ${ctx.sdkVersion}` : ''}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="latest" className="space-y-3">
          <P>{t.latestBody}</P>
          <CodeBlock lang="html" code={h5FullSnippet(ctx.gateway, ctx.appKey)} />
        </TabsContent>
        <TabsContent value="pinned" className="space-y-3">
          <P>{rich(t.pinnedBody, { c })}</P>
          {pinnable && (
            <CodeBlock lang="html" code={h5PinnedSnippet(ctx.gateway, ctx.appKey, ctx.sdkVersion!, ctx.sdkIntegrity!)} />
          )}
        </TabsContent>
      </Tabs>

      <H3>{t.optionsTitle}</H3>
      <P>{rich(t.optionsIntro, { c })}</P>
      <DocTable
        head={t.optionsHead}
        rows={[
          [<C key="1">userId</C>, t.options.userId],
          [<C key="2">helpButton</C>, t.options.helpButton],
          [<C key="3">app</C>, rich(t.options.app, { c })],
          [<C key="4">deviceId</C>, t.options.deviceId],
          [<C key="5">nativeKey</C>, t.options.nativeKey],
          [<C key="6">deviceToken</C>, t.options.deviceToken],
          [<C key="7">nativeApproval</C>, t.options.nativeApproval],
          [<C key="9">lockScreen</C>, t.options.lockScreen],
          [<C key="8">eruda</C>, t.options.eruda],
        ]}
      />

      <H3>{t.jsApiTitle}</H3>
      <CodeBlock lang="js" code={jsApiSnippet()} />
      <P className="text-sm text-muted-foreground">{rich(t.statusValues, { c })}</P>

      <H3>{t.originsTitle}</H3>
      <P>{rich(t.originsBody, { c })}</P>

      <H3>{t.cspTitle}</H3>
      <P>{t.cspBody}</P>
      <CodeBlock lang="bash" code={cspSnippet(ctx.gateway)} />

      <H3>{t.maskTitle}</H3>
      <P>{rich(t.maskBody, { c })}</P>
      <CodeBlock lang="html" code={maskSnippet()} />
    </Section>
  )
}

function NativeSection({ ctx }: { ctx: DocCtx }) {
  const t = useT().docs.native
  return (
    <Section id="native" lead={t.lead}>
      <div className="grid gap-3 sm:grid-cols-2">
        {t.cards.map(({ title, body }) => (
          <div key={title} className="rounded-xl border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <CheckIcon className="size-4 text-success" />
              {title}
            </p>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="ios" className="gap-3">
        <TabsList>
          <TabsTrigger value="ios">{t.iosTab}</TabsTrigger>
          <TabsTrigger value="android">{t.androidTab}</TabsTrigger>
        </TabsList>
        <TabsContent value="ios" className="space-y-3">
          <P>{rich(t.iosIntro, { c })}</P>
          <CodeBlock lang="swift" code={swiftNativeSnippet(ctx.gateway, ctx.appKey)} maxHeight="34rem" />
        </TabsContent>
        <TabsContent value="android" className="space-y-3">
          <Callout tone="warning">
            <p>{t.androidWarning}</p>
          </Callout>
          <CodeBlock lang="kotlin" code={kotlinNativeSnippet(ctx.gateway, ctx.appKey, ctx.origins)} maxHeight="34rem" />
        </TabsContent>
      </Tabs>

      <H3>{t.eventsTitle}</H3>
      <DocTable
        head={t.eventsHead}
        rows={[
          [t.statusBar, rich(t.statusBarBody, { c })],
          [t.attach, rich(t.attachBody, { c })],
          [t.confirm, rich(t.confirmBody, { c })],
          [t.control, rich(t.controlBody, { c })],
          [t.screenshot, rich(t.screenshotBody, { c })],
          [t.help, rich(t.helpBody, { c })],
        ]}
      />
    </Section>
  )
}

function McpSection({ ctx }: { ctx: DocCtx }) {
  const t = useT().docs.mcp
  return (
    <Section id="mcp" lead={t.lead}>
      <H3 id="mcp-key">{t.keyTitle}</H3>
      <P>{rich(t.keyBody, { link: docLink('/keys') })}</P>
      <DocTable
        head={t.keyHead}
        rows={[
          [
            t.maxLevel,
            <span key="l" className="flex flex-wrap items-center gap-1.5">
              {rich(t.maxLevelBody, {
                observe: () => <LevelBadge level="observe" />,
                interact: () => <LevelBadge level="interact" />,
                advanced: () => <LevelBadge level="advanced" />,
              })}
            </span>,
          ],
          [t.expiry, t.expiryBody],
          [t.ipAllowlist, t.ipAllowlistBody],
        ]}
      />

      <H3 id="mcp-claude">{t.claudeTitle}</H3>
      <P>{t.hostedIntro}</P>
      <CodeBlock lang="bash" code={hostedMcpCommand(ctx.gateway, KEY_PLACEHOLDER)} wrap />
      <P>{rich(t.replaceKey, { c })}</P>
      <CodeBlock lang="json" code={mcpJsonConfig(ctx.gateway, KEY_PLACEHOLDER)} />

      <H3 id="mcp-clients">{t.clientsTitle}</H3>
      <Tabs defaultValue="cursor" className="gap-3">
        <TabsList>
          <TabsTrigger value="cursor">Cursor</TabsTrigger>
          <TabsTrigger value="stdio">{t.stdioTab}</TabsTrigger>
          <TabsTrigger value="local">{t.localTab}</TabsTrigger>
        </TabsList>
        <TabsContent value="cursor" className="space-y-3">
          <P>{rich(t.cursorBody, { c })}</P>
          <CodeBlock lang="json" code={cursorMcpConfig(ctx.gateway, KEY_PLACEHOLDER)} />
        </TabsContent>
        <TabsContent value="stdio" className="space-y-3">
          <P>{rich(t.stdioBody, { c })}</P>
          <CodeBlock lang="json" code={stdioMcpConfig(ctx.gateway, KEY_PLACEHOLDER)} />
        </TabsContent>
        <TabsContent value="local" className="space-y-3">
          <P>{rich(t.localBody, { c })}</P>
          <CodeBlock lang="bash" code={localMcpCommand(ctx.gateway, KEY_PLACEHOLDER)} wrap />
        </TabsContent>
      </Tabs>

      <H3 id="mcp-check">{t.checkTitle}</H3>
      <CodeBlock lang="bash" code={'claude mcp list\n# rwd: ' + ctx.gateway + '/mcp (HTTP) - ✓ Connected'} />

      <H3 id="mcp-prompts">{t.promptsTitle}</H3>
      <P>{t.promptsIntro}</P>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {t.prompts.map((prompt) => (
          <div key={prompt} className="group relative rounded-xl border bg-card p-3.5 pr-11 text-sm leading-6 shadow-xs">
            <SparklesIcon className="mb-1.5 size-4 text-brand" />
            {prompt}
            <CopyButton value={prompt} variant="ghost" ariaLabel={t.copyPrompt} className="absolute top-2 right-2 opacity-60 group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </Section>
  )
}

type ToolKey = keyof Messages['docs']['tools']['desc']
type Tool = { key: ToolKey; name: string; args: string; level: Level | null }

// Descriptions and group titles come from t.docs.tools at render time.
const toolGroups: { id: keyof Messages['docs']['tools']['groups']; icon: React.ReactNode; tools: Tool[] }[] = [
  {
    id: 'device',
    icon: <PlugZapIcon />,
    tools: [
      { key: 'listDevices', name: 'list_devices', args: 'status?, userId?, deviceCode?', level: null },
      { key: 'connectDevice', name: 'connect_device', args: 'device, level?, follow?', level: null },
      { key: 'disconnectDevice', name: 'disconnect_device', args: '—', level: null },
      { key: 'waitForDevice', name: 'wait_for_device', args: 'device, timeoutSec?', level: null },
      { key: 'listPages', name: 'list_pages', args: '—', level: null },
      { key: 'selectPage', name: 'select_page', args: 'page', level: null },
      { key: 'waitForPage', name: 'wait_for_page', args: 'urlContains?, titleContains?, timeoutSec?', level: null },
      { key: 'waitForControl', name: 'wait_for_control', args: 'timeoutSec?', level: null },
      { key: 'waitForEvent', name: 'wait_for_event', args: 'kind?, page?, timeoutSec?', level: null },
      { key: 'getSessionTimeline', name: 'get_session_timeline', args: 'limit?', level: null },
    ],
  },
  {
    id: 'observe',
    icon: <EyeIcon />,
    tools: [
      { key: 'takeSnapshot', name: 'take_snapshot', args: '—', level: 'observe' },
      { key: 'takeScreenshot', name: 'take_screenshot', args: 'fullPage?, format?', level: 'observe' },
      { key: 'findElements', name: 'find_elements', args: 'text?, role?, name?, limit?', level: 'observe' },
      { key: 'listConsoleMessages', name: 'list_console_messages', args: 'scope?, types?, limit?', level: 'observe' },
      { key: 'listNetworkRequests', name: 'list_network_requests', args: 'scope?, failedOnly?, limit?', level: 'observe' },
      { key: 'waitFor', name: 'wait_for', args: 'text?, textGone?, timeSec?', level: 'observe' },
    ],
  },
  {
    id: 'interact',
    icon: <MousePointerClickIcon />,
    tools: [
      { key: 'clickHover', name: 'click / hover', args: 'ref', level: 'interact' },
      { key: 'fill', name: 'fill', args: 'ref, value', level: 'interact' },
      { key: 'typeText', name: 'type_text', args: 'text, ref?, submit?', level: 'interact' },
      { key: 'pressKey', name: 'press_key', args: 'key', level: 'interact' },
      { key: 'selectOption', name: 'select_option', args: 'ref, values', level: 'interact' },
      { key: 'scrollDrag', name: 'scroll / drag', args: 'ref?, dx?, dy? / fromRef, toRef', level: 'interact' },
      { key: 'navigation', name: 'navigate_page / go_back / reload_page', args: 'url / — / —', level: 'interact' },
      { key: 'batchActions', name: 'batch_actions', args: 'actions, stopOnError?', level: 'interact' },
    ],
  },
  {
    id: 'advanced',
    icon: <FlaskConicalIcon />,
    tools: [
      { key: 'evaluateScript', name: 'evaluate_script', args: 'function, args?', level: 'advanced' },
      { key: 'getNetworkRequest', name: 'get_network_request', args: 'id, page?', level: 'advanced' },
      { key: 'getStorage', name: 'get_storage', args: 'area', level: 'advanced' },
    ],
  },
]

function ToolsSection() {
  const t = useT().docs.tools
  return (
    <Section id="tools" lead={t.lead}>
      <div className="space-y-5">
        {toolGroups.map((g) => (
          <div key={g.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2.5 text-sm font-medium [&_svg]:size-4 [&_svg]:text-brand">
              {g.icon}
              {t.groups[g.id]}
            </div>
            <ul className="divide-y">
              {g.tools.map((tool) => (
                <li key={tool.name} className="grid gap-x-4 gap-y-1 px-3.5 py-2.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] font-medium break-words">{tool.name}</p>
                    <p className="font-mono text-[11px] break-words text-muted-foreground">{tool.args}</p>
                  </div>
                  <p className="text-[13px] leading-6 text-muted-foreground">{t.desc[tool.key]}</p>
                  <div className="sm:justify-self-end">
                    {tool.level ? (
                      <LevelBadge level={tool.level} />
                    ) : (
                      <Badge variant="muted" title={t.anyLevelTitle}>
                        {t.anyLevel}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <P className="text-sm text-muted-foreground">{rich(t.effectiveLevel, { c })}</P>
    </Section>
  )
}

function ApprovalSection() {
  const t = useT().docs.approval
  return (
    <Section id="approval" lead={t.lead}>
      <Steps>
        <Step title={t.requestTitle}>
          <P>
            {rich(t.requestBody, {
              c,
              levels: () =>
                (['observe', 'interact', 'advanced'] as Level[]).map((l, i) => (
                  <span key={l}>
                    {i > 0 && ' / '}
                    {t.levelChoice(levelMeta[l].label)}
                  </span>
                )),
            })}
          </P>
          <Callout tone="info">
            <p>{rich(t.timeout, { b: (s) => <span className="font-medium">{s}</span> })}</p>
          </Callout>
        </Step>
        <Step title={t.activeTitle}>
          <P>{t.activeBody}</P>
        </Step>
        <Step
          title={
            <span className="inline-flex items-center gap-1.5">
              <HandIcon className="size-4 text-warning" />
              {t.takeoverTitle}
            </span>
          }
        >
          <P>{rich(t.takeoverBody, { c })}</P>
        </Step>
        <Step title={t.confirmTitle}>
          <P>{rich(t.confirmBody, { c })}</P>
        </Step>
      </Steps>
      <P className="text-sm text-muted-foreground">{rich(t.footer, { link: docLink('/audit') })}</P>
    </Section>
  )
}

function VerifySection({ ctx }: { ctx: DocCtx }) {
  const t = useT().docs.verify
  const items: { title: string; body: React.ReactNode }[] = useMemo(
    () => [
      { title: t.gateway, body: <CodeBlock lang="bash" code={`curl ${ctx.gateway}/healthz\n# {"ok":true,"version":"…"}`} /> },
      { title: t.sdk, body: <P>{rich(t.sdkBody, { c })}</P> },
      { title: t.console, body: <P>{rich(t.consoleBody, { link: docLink('/') })}</P> },
      { title: t.test, body: <P>{t.testBody}</P> },
      { title: t.mcp, body: <P>{rich(t.mcpBody, { c })}</P> },
      { title: t.agent, body: <P>{t.agentBody}</P> },
    ],
    [ctx.gateway, t],
  )
  return (
    <Section id="verify" lead={t.lead}>
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={it.title} className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2.5 font-medium">
              <span className="flex size-6 items-center justify-center rounded-full bg-success/12 text-xs font-semibold text-success tabular-nums">
                {i + 1}
              </span>
              {it.title}
            </p>
            <div className="mt-2.5 pl-8.5">{it.body}</div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function TroubleshootSection() {
  const t = useT().docs.troubleshoot
  return (
    <Section id="troubleshoot" lead={t.lead}>
      <H3>{t.offlineTitle}</H3>
      <DocTable
        head={t.offlineHead}
        rows={[
          [t.handshake401, t.handshake401Body],
          [t.handshake403, t.handshake403Body],
          [rich(t.refused, { c }), rich(t.refusedBody, { c })],
          [rich(t.undefined, { c }), t.undefinedBody],
          [rich(t.polling, { c }), t.pollingBody],
          [t.outdated, t.outdatedBody],
          [t.testTimeout, t.testTimeoutBody],
        ]}
      />

      <H3>{t.closeCodesTitle}</H3>
      <DocTable
        head={t.closeCodesHead}
        rows={[
          [<C key="1">4401</C>, t.code4401, t.code4401Fix],
          [<C key="2">4409</C>, t.code4409, t.code4409Fix],
          [<C key="3">4429</C>, t.code4429, t.code4429Fix],
        ]}
      />

      <H3>{t.agentTitle}</H3>
      <DocTable
        head={t.agentHead}
        rows={[
          [t.mcp401, t.mcp401Body],
          [t.level, t.levelBody],
          [t.denied, t.deniedBody],
          [<C key="t">takeover</C>, t.takeover],
          [<C key="n">not_found</C>, t.notFound],
          [<C key="i">not_interactable</C>, t.notInteractable],
        ]}
      />

      <Callout tone="info">
        <p className="font-medium">{t.testTitle}</p>
        <p className="text-muted-foreground">{rich(t.testBody, { c })}</p>
      </Callout>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-4 text-sm">
        <TerminalIcon className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">{t.stuck}</span>
        <Link to="/projects" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
          {t.openIntegration}
          <ArrowRightIcon className="size-3.5" />
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
          {t.viewDevices}
          <ArrowRightIcon className="size-3.5" />
        </Link>
        <KeyRoundIcon className="ml-auto hidden size-4 text-muted-foreground sm:block" />
      </div>
    </Section>
  )
}
