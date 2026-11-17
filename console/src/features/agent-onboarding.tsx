import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRightIcon, BotMessageSquareIcon, ChevronDownIcon, KeyRoundIcon, LoaderCircleIcon, SquareTerminalIcon, WandSparklesIcon } from 'lucide-react'
import { Fragment, useState } from 'react'

import { CodeBlock } from '@/components/code-block'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useT } from '@/i18n'
import { api } from '@/lib/api'
import { configQuery, keysQuery } from '@/lib/queries'
import {
  claudeStdioCommand,
  codexStdioConfig,
  cursorStdioConfig,
  geminiStdioConfig,
  mcpInitCommand,
  skillsAddCommand,
} from '@/lib/snippets'
import { cn } from '@/lib/utils'

const HIDDEN = 'rwd:onboard-hidden'
const PLACEHOLDER = '<API_KEY>'
// Marks where the key goes in the sentence, to show a placeholder chip there instead.
const SLOT = '\u0000'

function readHidden() {
  try {
    return localStorage.getItem(HIDDEN) === '1'
  } catch {
    return false
  }
}

/**
 * "Connect your agent" on the home page: one personal key, then `npx remote-webview-debugger-mcp init` with this
 * gateway filled in (it asks for the key and sets up every agent it finds). By hand: a sentence for the agent
 * (MCP over HTTP), or the stdio snippets from mcp/README.md for Cursor, Codex, Gemini CLI and Claude Code.
 */
export function AgentOnboarding() {
  const t = useT().shell.onboard
  const queryClient = useQueryClient()
  const gateway = useQuery(configQuery).data?.gatewayUrl
  const [hidden, setHidden] = useState(readHidden)
  const [key, setKey] = useState<string | null>(null)
  const create = useMutation({
    // Never expires: it lives in the member's agent config; revoke it on the API keys page when it's no longer needed.
    mutationFn: () => api.createKey({ name: t.keyName, maxLevel: 'interact', expiresInDays: 0, ipAllowlist: [] }),
    onSuccess: (k) => {
      setKey(k.key)
      void queryClient.invalidateQueries({ queryKey: keysQuery.queryKey })
    },
  })
  const toggle = (next: boolean) => {
    setHidden(next)
    try {
      localStorage.setItem(HIDDEN, next ? '1' : '0')
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  }

  const url = `${gateway ?? `${location.origin}/v1`}/mcp`
  const sentence = t.prompt(url, key ?? PLACEHOLDER)
  const command = `claude mcp add --transport http -s user rwd ${url} --header "Authorization: Bearer ${key ?? PLACEHOLDER}"`
  const init = mcpInitCommand(gateway ?? `${location.origin}/v1`)

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        className="group flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-start text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand-soft/40 hover:text-foreground"
      >
        <BotMessageSquareIcon className="size-4 text-brand" />
        <span className="font-medium">{t.show}</span>
        <span className="hidden truncate sm:inline">· {t.description}</span>
        <ChevronDownIcon className="ms-auto size-4" />
      </button>
    )
  }

  return (
    <section
      aria-labelledby="onboard-title"
      className="relative overflow-hidden rounded-2xl border bg-card shadow-xs"
    >
      <div className="pointer-events-none absolute -top-24 -end-24 size-72 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
        <div className="space-y-5">
          <div className="flex items-start gap-3.5">
            <span className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_20px_-8px_rgb(93_92_245/0.7)] [&_svg]:size-5">
              <WandSparklesIcon />
            </span>
            <div className="space-y-1">
              <h2 id="onboard-title" className="text-lg font-semibold tracking-tight">
                {t.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.description}</p>
            </div>
          </div>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <StepDot n={1} done={!!key} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">{t.stepKey}</p>
                {key ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                      <KeyRoundIcon className="size-4 shrink-0 text-brand" />
                      <code className="min-w-0 flex-1 truncate font-mono text-xs">{key}</code>
                      <CopyButton value={key} size="icon-xs" variant="ghost" />
                    </div>
                    <p className="text-xs text-muted-foreground">{t.keyHint}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t.needKey}</p>
                    <Button variant="brand" size="xs" onClick={() => create.mutate()} disabled={create.isPending}>
                      {create.isPending ? <LoaderCircleIcon className="animate-spin" /> : <KeyRoundIcon />}
                      {create.isPending ? t.creating : t.createKey}
                    </Button>
                  </div>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <StepDot n={2} done={false} />
              <p className="pt-0.5 text-sm font-medium">{t.stepInit}</p>
            </li>
            <li className="flex gap-3">
              <StepDot n={3} done={false} />
              <p className="pt-0.5 text-sm font-medium">{t.stepRestart}</p>
            </li>
          </ol>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/docs" hash="mcp" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
              {t.more}
              <ArrowRightIcon className="size-3.5 rtl:-scale-x-100" />
            </Link>
            <button type="button" onClick={() => toggle(true)} className="text-muted-foreground hover:text-foreground">
              {t.dismiss}
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <SquareTerminalIcon className="size-3.5" />
              {t.stepInit}
              <span className="rounded-full bg-brand/10 px-1.5 py-px text-[11px] text-brand">{t.recommended}</span>
            </div>
            <CommandLine value={init} />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.initHint}</p>
            <div className="mt-3 border-t border-brand/15 pt-3">
              <CommandLine value={skillsAddCommand()} />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.skillHint}</p>
            </div>
          </div>
          <details className="group rounded-xl border bg-muted/20 px-4 py-2.5 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground hover:text-foreground">
              <BotMessageSquareIcon className="size-4" />
              {t.manual}
              <ChevronDownIcon className="ms-auto size-4 transition-transform group-open:rotate-180" />
            </summary>
            <Tabs defaultValue="prompt" className="mt-1 gap-3">
              <TabsList>
                <TabsTrigger value="prompt">{t.tabPrompt}</TabsTrigger>
                <TabsTrigger value="cursor">Cursor</TabsTrigger>
                <TabsTrigger value="codex">Codex</TabsTrigger>
                <TabsTrigger value="gemini">Gemini CLI</TabsTrigger>
                <TabsTrigger value="claude">Claude Code</TabsTrigger>
              </TabsList>
              <TabsContent value="prompt" className="space-y-2.5">
                <p className="text-xs leading-relaxed text-muted-foreground">{t.promptHint}</p>
                <div className="rounded-lg border bg-card/60 p-3">
                  <p className="text-[13px] leading-relaxed break-words">
                    {key
                      ? sentence
                      : t.prompt(url, SLOT).split(SLOT).map((part, i, parts) => (
                          <Fragment key={i}>
                            <span className="text-muted-foreground">{part}</span>
                            {i < parts.length - 1 && (
                              <span className="rounded border border-dashed border-brand/40 px-1 font-mono text-[11px] text-brand">{PLACEHOLDER}</span>
                            )}
                          </Fragment>
                        ))}
                  </p>
                  {key && (
                    <div className="mt-2.5 flex justify-end">
                      <CopyButton value={sentence} label={t.copy} size="xs" variant="brand" />
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="cursor" className="space-y-2.5">
                <ConfigHint file="~/.cursor/mcp.json" />
                <CodeBlock lang="json" code={cursorStdioConfig()} />
              </TabsContent>
              <TabsContent value="codex" className="space-y-2.5">
                <ConfigHint file="~/.codex/config.toml" />
                <CodeBlock title="TOML" code={codexStdioConfig()} />
              </TabsContent>
              <TabsContent value="gemini" className="space-y-2.5">
                <ConfigHint file="~/.gemini/settings.json" />
                <CodeBlock lang="json" code={geminiStdioConfig()} />
              </TabsContent>
              <TabsContent value="claude" className="space-y-2.5">
                <p className="text-xs leading-relaxed text-muted-foreground">{t.claudeStdio}</p>
                <CodeBlock lang="bash" code={claudeStdioCommand()} wrap />
                <p className="text-xs leading-relaxed text-muted-foreground">{t.claudeHttp}</p>
                <CodeBlock lang="bash" code={command} wrap />
              </TabsContent>
            </Tabs>
          </details>
        </div>
      </div>
    </section>
  )
}

/** One shell command with a copy button, on the card's own surface. */
function CommandLine({ value }: { value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card/80 px-3 py-2">
      <code className="min-w-0 flex-1 font-mono text-xs leading-relaxed break-all">{value}</code>
      <CopyButton value={value} size="icon-xs" variant="ghost" />
    </div>
  )
}

function ConfigHint({ file }: { file: string }) {
  const t = useT().shell.onboard
  return (
    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">{t.addTo(file)}</p>
      <p>{t.stdioHint}</p>
    </div>
  )
}

function StepDot({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1',
        done ? 'bg-success/15 text-success ring-success/30' : 'bg-brand-soft text-brand ring-brand/25',
      )}
    >
      {n}
    </span>
  )
}
