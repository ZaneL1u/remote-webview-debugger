import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Callout } from '@/components/callout'
import { ChoiceCards } from '@/components/choice-cards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type Messages, useT } from '@/i18n'
import { api } from '@/lib/api'
import { useCan } from '@/lib/permissions'
import {
  DEFAULT_POLICY,
  invalidSelectors,
  levelMeta,
  levels,
  maskPresets,
  parseLines,
  previewMask,
  regexProblem,
  resolvePolicy,
} from '@/lib/policy'
import { projectsQuery } from '@/lib/queries'
import type { HelpButtonMode, Policy, Project } from '@/lib/types'
import { cn } from '@/lib/utils'

// Project policy editor (docs/protocol.md section 11) plus the device invite URL (section 12.6).

type Draft = {
  approval: Policy['approval']
  maxLevel: Policy['maxLevel']
  maskSelectors: string
  maskPatterns: { id: number; name: string; regex: string }[]
  confirmSelectors: string
  networkExclude: string
  sessionLog: boolean
  helpButton: HelpButtonMode
  helpUsers: string
  agentIdleMinutes: string
  attachMaxMinutes: string
  maxOnlineDevices: string
  maxAgents: string
  erudaDock: boolean
  erudaLoad: boolean
  devtools: boolean
  inviteUrl: string
}

let rowId = 0

function toDraft(project: Project): Draft {
  const p = resolvePolicy(project.policy)
  return {
    approval: p.approval,
    maxLevel: p.maxLevel,
    maskSelectors: p.maskSelectors.join('\n'),
    maskPatterns: p.maskPatterns.map((m) => ({ id: ++rowId, ...m })),
    confirmSelectors: p.confirmSelectors.join('\n'),
    networkExclude: p.networkExclude.join('\n'),
    sessionLog: p.sessionLog,
    helpButton: p.helpButton,
    helpUsers: p.helpUsers.join('\n'),
    agentIdleMinutes: String(p.agentIdleMinutes),
    attachMaxMinutes: String(p.attachMaxMinutes),
    maxOnlineDevices: String(p.maxOnlineDevices),
    maxAgents: String(p.maxAgents),
    erudaDock: p.eruda.dock,
    erudaLoad: p.eruda.load,
    devtools: p.devtools !== 'off',
    inviteUrl: project.inviteUrl ?? '',
  }
}

type Parsed = { policy: Policy; inviteUrl: string; errors: Partial<Record<keyof Draft, string>>; patternErrors: Record<number, string> }

const numberRules: { key: 'agentIdleMinutes' | 'attachMaxMinutes' | 'maxOnlineDevices' | 'maxAgents'; min: number; max: number }[] = [
  { key: 'agentIdleMinutes', min: 1, max: 120 },
  { key: 'attachMaxMinutes', min: 1, max: 1440 },
  { key: 'maxOnlineDevices', min: 0, max: 1_000_000 },
  { key: 'maxAgents', min: 0, max: 10_000 },
]

function parseDraft(d: Draft, t: Messages): Parsed {
  const m = t.projects.policy
  const errors: Parsed['errors'] = {}
  const patternErrors: Record<number, string> = {}
  const maskSelectors = parseLines(d.maskSelectors)
  const confirmSelectors = parseLines(d.confirmSelectors)
  const badMask = invalidSelectors(maskSelectors)
  if (badMask.length) errors.maskSelectors = m.invalidSelectors(badMask)
  const badConfirm = invalidSelectors(confirmSelectors)
  if (badConfirm.length) errors.confirmSelectors = m.invalidSelectors(badConfirm)

  const names = new Set<string>()
  for (const row of d.maskPatterns) {
    const name = row.name.trim()
    const problem = !name ? m.nameRequired : names.has(name) ? m.duplicateName : regexProblem(row.regex)
    if (problem) patternErrors[row.id] = problem
    names.add(name)
  }

  const nums = {} as Record<(typeof numberRules)[number]['key'], number>
  for (const { key, min, max } of numberRules) {
    const n = Number(d[key])
    if (d[key].trim() === '' || !Number.isInteger(n) || n < min || n > max) {
      errors[key] = m.intRange(min, max)
      nums[key] = DEFAULT_POLICY[key]
    } else nums[key] = n
  }

  const inviteUrl = d.inviteUrl.trim()
  if (inviteUrl && !/^https?:\/\/[^\s/]+/i.test(inviteUrl)) errors.inviteUrl = m.invalidUrl

  return {
    policy: {
      approval: d.approval,
      maxLevel: d.maxLevel,
      maskSelectors,
      maskPatterns: d.maskPatterns.map((m) => ({ name: m.name.trim(), regex: m.regex })),
      confirmSelectors,
      networkExclude: parseLines(d.networkExclude),
      sessionLog: d.sessionLog,
      helpButton: d.helpButton,
      helpUsers: parseLines(d.helpUsers),
      ...nums,
      eruda: { dock: d.erudaDock, load: d.erudaLoad },
      devtools: d.devtools ? 'on' : 'off',
    },
    inviteUrl,
    errors,
    patternErrors,
  }
}

/** Only the fields that changed, so concurrent edits of other fields are not overwritten. */
function diffPolicy(before: Policy, after: Policy): Partial<Policy> {
  const patch: Partial<Policy> = {}
  for (const key of Object.keys(after) as (keyof Policy)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) (patch as Record<string, unknown>)[key] = after[key]
  }
  return patch
}

export function PolicyEditor({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const manage = useCan('policy.manage')
  // The draft is edited against `origin`, the project as it was when editing started.
  const [origin, setOrigin] = useState(project)
  const [draft, setDraft] = useState(() => toDraft(project))
  const [showErrors, setShowErrors] = useState(false)
  const t = useT()
  const m = t.projects.policy
  const baseline = useMemo(() => parseDraft(toDraft(origin), t), [origin, t])
  const parsed = useMemo(() => parseDraft(draft, t), [draft, t])
  const policyPatch = diffPolicy(baseline.policy, parsed.policy)
  const inviteChanged = parsed.inviteUrl !== baseline.inviteUrl
  const dirty = Object.keys(policyPatch).length > 0 || inviteChanged
  const invalid = Object.keys(parsed.errors).length > 0 || Object.keys(parsed.patternErrors).length > 0
  const serverKey = JSON.stringify([project.policy, project.inviteUrl])
  const originKey = JSON.stringify([origin.policy, origin.inviteUrl])

  // Follow server-side changes (e.g. another admin) while there is nothing unsaved.
  useEffect(() => {
    if (serverKey !== originKey && !dirty) {
      setOrigin(project)
      setDraft(toDraft(project))
    }
  }, [serverKey, originKey, dirty, project])

  const save = useMutation({
    mutationFn: () =>
      api.updateProject(project.id, {
        ...(Object.keys(policyPatch).length ? { policy: policyPatch } : {}),
        ...(inviteChanged ? { inviteUrl: parsed.inviteUrl } : {}),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (old) => old?.map((p) => (p.id === updated.id ? updated : p)))
      setOrigin(updated)
      setDraft(toDraft(updated))
      setShowErrors(false)
      toast.success(m.saved)
    },
  })

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const err = (key: keyof Draft) => (showErrors || key === 'maskSelectors' || key === 'confirmSelectors' ? parsed.errors[key] : undefined)

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-5">
        <CardTitle>{m.title}</CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-5">
        {!manage && (
          <Callout className="mb-5">
            <p>{m.readOnly}</p>
          </Callout>
        )}
        <form
          id="policy-form"
          onSubmit={(e) => {
            e.preventDefault()
            setShowErrors(true)
            if (invalid) return toast.error(m.invalid)
            if (dirty) save.mutate()
          }}
        >
          <fieldset disabled={!manage} className="space-y-6">
            <Section title={m.approval.title} description={m.approval.description}>
              <ChoiceCards
                name="approval"
                aria-label={m.approval.title}
                value={draft.approval}
                onChange={(v) => set('approval', v)}
                className="sm:grid-cols-2"
                options={[
                  {
                    value: 'prompt',
                    label: m.approval.prompt,
                    description: m.approval.promptDescription,
                  },
                  {
                    value: 'none',
                    label: m.approval.none,
                    description: m.approval.noneDescription,
                    warning: true,
                  },
                ]}
              />
            </Section>

            <Separator />

            <Section title={m.maxLevel.title} description={m.maxLevel.description}>
              <ChoiceCards
                name="maxLevel"
                aria-label={m.maxLevel.title}
                value={draft.maxLevel}
                onChange={(v) => set('maxLevel', v)}
                className="sm:grid-cols-3"
                options={levels.map((l) => ({
                  value: l,
                  label: (
                    <>
                      {levelMeta[l].label}
                      <span className="font-mono text-xs font-normal text-muted-foreground">{l}</span>
                    </>
                  ),
                  description: levelMeta[l].description,
                  warning: l === 'advanced',
                }))}
              />
              {draft.maxLevel === 'advanced' && (
                <Callout tone="warning">
                  <p>{m.maxLevel.advancedWarning}</p>
                </Callout>
              )}
            </Section>

            <Separator />

            <Section title={m.masking.title} description={m.masking.description}>
              <Field label={m.masking.selectorsLabel} hint={m.masking.selectorsHint} error={err('maskSelectors')}>
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={draft.maskSelectors}
                    className="font-mono text-xs md:text-xs"
                    placeholder={'.user-phone\n[name="idCard"]'}
                    aria-invalid={!!err('maskSelectors') || undefined}
                    onChange={(e) => set('maskSelectors', e.target.value)}
                  />
                )}
              </Field>
              <MaskPatterns
                rows={draft.maskPatterns}
                errors={parsed.patternErrors}
                onChange={(rows) => set('maskPatterns', rows)}
              />
            </Section>

            <Separator />

            <Section title={m.confirm.title} description={m.confirm.description}>
              <Field label={m.confirm.label} hint={m.confirm.hint} error={err('confirmSelectors')}>
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={draft.confirmSelectors}
                    className="font-mono text-xs md:text-xs"
                    placeholder={'#submit-order\n.btn-pay'}
                    aria-invalid={!!err('confirmSelectors') || undefined}
                    onChange={(e) => set('confirmSelectors', e.target.value)}
                  />
                )}
              </Field>
            </Section>

            <Separator />

            <Section title={m.network.title} description={m.network.description}>
              <Field label={m.network.label} hint={m.network.hint}>
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={draft.networkExclude}
                    className="font-mono text-xs md:text-xs"
                    placeholder={'.ttf\nWebTracks\n*/404/*'}
                    onChange={(e) => set('networkExclude', e.target.value)}
                  />
                )}
              </Field>
            </Section>

            <Separator />

            <Section title={m.sessionLog.title} description={m.sessionLog.description}>
              <div className="rounded-lg border">
                <label className="flex items-start justify-between gap-4 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{m.sessionLog.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.sessionLog.hint}</span>
                  </span>
                  <Switch checked={draft.sessionLog} onCheckedChange={(v) => set('sessionLog', v)} aria-label={m.sessionLog.label} />
                </label>
              </div>
            </Section>

            <Separator />

            <Section title={m.help.title} description={m.help.description}>
              <ChoiceCards
                name="helpButton"
                aria-label={m.help.title}
                value={draft.helpButton}
                onChange={(v) => set('helpButton', v)}
                className="sm:grid-cols-3"
                options={[
                  { value: 'all', label: m.help.all, description: m.help.allDescription },
                  { value: 'listed', label: m.help.listed, description: m.help.listedDescription },
                  { value: 'off', label: m.help.off, description: m.help.offDescription },
                ]}
              />
              {draft.helpButton === 'listed' && (
                <Field
                  label={m.help.usersLabel}
                  hint={parseLines(draft.helpUsers).length ? m.help.usersHint : m.help.usersEmpty}
                >
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={3}
                      value={draft.helpUsers}
                      className="font-mono text-xs md:text-xs"
                      placeholder={'u_20391\nu_77812'}
                      onChange={(e) => set('helpUsers', e.target.value)}
                    />
                  )}
                </Field>
              )}
            </Section>

            <Separator />

            <Section title={m.devtools.title} description={m.devtools.description}>
              <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{m.devtools.allow}</span>
                  <span className="block text-xs text-muted-foreground">{m.devtools.allowDescription}</span>
                </span>
                <Switch checked={draft.devtools} onCheckedChange={(v) => set('devtools', v)} aria-label={m.devtools.allow} />
              </label>
            </Section>

            <Separator />

            <Section title={m.eruda.title} description={m.eruda.description}>
              <div className="divide-y rounded-lg border">
                <label className="flex items-start justify-between gap-4 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{m.eruda.dock}</span>
                    <span className="block text-xs text-muted-foreground">{m.eruda.dockDescription}</span>
                  </span>
                  <Switch checked={draft.erudaDock} onCheckedChange={(v) => set('erudaDock', v)} aria-label={m.eruda.dock} />
                </label>
                <label className="flex items-start justify-between gap-4 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{m.eruda.load}</span>
                    <span className="block text-xs text-muted-foreground">{m.eruda.loadDescription}</span>
                  </span>
                  <Switch checked={draft.erudaLoad} onCheckedChange={(v) => set('erudaLoad', v)} aria-label={m.eruda.load} />
                </label>
              </div>
            </Section>

            <Separator />

            <Section title={m.limits.title}>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label={m.limits.idle}
                  unit={m.limits.minutes}
                  hint={m.limits.idleHint}
                  value={draft.agentIdleMinutes}
                  error={err('agentIdleMinutes')}
                  onChange={(v) => set('agentIdleMinutes', v)}
                />
                <NumberField
                  label={m.limits.attach}
                  unit={m.limits.minutes}
                  hint={m.limits.attachHint}
                  value={draft.attachMaxMinutes}
                  error={err('attachMaxMinutes')}
                  onChange={(v) => set('attachMaxMinutes', v)}
                />
                <NumberField
                  label={m.limits.onlineDevices}
                  unit={m.limits.devices}
                  hint={m.limits.onlineDevicesHint}
                  value={draft.maxOnlineDevices}
                  error={err('maxOnlineDevices')}
                  onChange={(v) => set('maxOnlineDevices', v)}
                />
                <NumberField
                  label={m.limits.agentsLabel}
                  unit={m.limits.agents}
                  hint={m.limits.agentsHint}
                  value={draft.maxAgents}
                  error={err('maxAgents')}
                  onChange={(v) => set('maxAgents', v)}
                />
              </div>
            </Section>

            <Separator />

            <Section title={m.invite.title} description={m.invite.description}>
              <Field label={m.invite.label} hint={m.invite.hint} error={err('inviteUrl')}>
                {(id) => (
                  <Input
                    id={id}
                    value={draft.inviteUrl}
                    inputMode="url"
                    className="font-mono text-xs md:text-xs"
                    placeholder="https://m.example.com/help"
                    aria-invalid={!!err('inviteUrl') || undefined}
                    onChange={(e) => set('inviteUrl', e.target.value)}
                  />
                )}
              </Field>
            </Section>
          </fieldset>
        </form>
      </CardContent>
      {manage && (
        <div
          className={cn(
            'z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t bg-card/95 px-5 py-3 backdrop-blur',
            // Only follows the viewport while there is something to save.
            dirty && 'sticky bottom-0 shadow-[0_-6px_16px_-12px_rgb(0_0_0/0.35)]',
          )}
        >
          <span className="me-auto text-xs text-muted-foreground">{dirty ? m.unsaved : m.allSaved}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setOrigin(project)
              setDraft(toDraft(project))
              setShowErrors(false)
            }}
          >
            <RotateCcwIcon />
            {m.revert}
          </Button>
          <Button type="submit" form="policy-form" size="sm" disabled={!dirty || save.isPending}>
            {save.isPending && <LoaderCircleIcon className="animate-spin" />}
            {m.save}
          </Button>
        </div>
      )}
    </Card>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (id: string) => React.ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function NumberField({
  label,
  unit,
  hint,
  value,
  error,
  onChange,
}: {
  label: string
  unit: string
  hint: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <div className="relative">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value}
            className="[appearance:textfield] pe-12 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-invalid={!!error || undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
        </div>
      )}
    </Field>
  )
}

function MaskPatterns({
  rows,
  errors,
  onChange,
}: {
  rows: Draft['maskPatterns']
  errors: Record<number, string>
  onChange: (rows: Draft['maskPatterns']) => void
}) {
  const t = useT()
  const m = t.projects.policy.masking
  // Follows the language until the user edits the sample.
  const [edited, setSample] = useState<string | null>(null)
  const sample = edited ?? m.sample
  const valid = rows.filter((r) => !errors[r.id])
  const preview = previewMask(sample, valid)

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{m.patternsTitle}</p>
        <p className="text-xs text-muted-foreground">{m.patternsDescription}</p>
      </div>
      {rows.length > 0 && (
        <ul className="space-y-2" aria-label={m.patternsList}>
          {rows.map((row, i) => (
            <li key={row.id} className="space-y-1">
              <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[9rem_1fr_auto]">
                <Input
                  aria-label={m.ruleName(i + 1)}
                  value={row.name}
                  maxLength={32}
                  placeholder={m.namePlaceholder}
                  className="max-sm:col-span-2"
                  onChange={(e) => onChange(rows.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))}
                />
                <Input
                  aria-label={m.ruleRegex(i + 1)}
                  value={row.regex}
                  placeholder={m.regexPlaceholder}
                  className="font-mono text-xs md:text-xs"
                  aria-invalid={!!errors[row.id] || undefined}
                  onChange={(e) => onChange(rows.map((r) => (r.id === row.id ? { ...r, regex: e.target.value } : r)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={m.removeRule(i + 1)}
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                >
                  <XIcon />
                </Button>
              </div>
              {errors[row.id] && <p className="text-xs text-destructive">{errors[row.id]}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="xs" onClick={() => onChange([...rows, { id: ++rowId, name: '', regex: '' }])}>
          <PlusIcon />
          {m.addRule}
        </Button>
        <span className="text-xs text-muted-foreground">{m.presets}</span>
        {maskPresets.map((p) => {
          const exists = rows.some((r) => r.regex === p.regex)
          return (
            <Button
              key={p.name}
              type="button"
              variant="secondary"
              size="xs"
              disabled={exists}
              onClick={() => onChange([...rows, { id: ++rowId, ...p }])}
            >
              <PlusIcon />
              {p.name}
            </Button>
          )
        })}
      </div>
      {rows.length > 0 && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <Label htmlFor="mask-sample" className="text-xs text-muted-foreground">
            {m.tryLabel}
          </Label>
          <Input id="mask-sample" value={sample} className="bg-card text-xs md:text-xs" onChange={(e) => setSample(e.target.value)} />
          <p className="font-mono text-xs break-all" data-testid="mask-preview">
            {preview}
          </p>
        </div>
      )}
    </div>
  )
}
