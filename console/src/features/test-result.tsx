import { CircleAlertIcon, CircleCheckIcon, TimerIcon } from 'lucide-react'

import { CodeBlock } from '@/components/code-block'
import { Badge } from '@/components/ui/badge'
import { getT, type Messages, useT } from '@/i18n'
import { ApiError } from '@/lib/api'
import type { TestResult } from '@/lib/types'

type TestErrorKey = keyof Messages['integration']['test']['errors']

/** Error code from the gateway → catalog key. */
const testErrors: Record<string, TestErrorKey> = {
  device_offline: 'offline',
  offline: 'offline',
  not_online: 'offline',
  no_page: 'noPage',
  timeout: 'timeout',
  takeover: 'takeover',
  not_found: 'notFound',
  bad_request: 'badRequest',
  internal: 'internal',
  network: 'network',
}

/** Turns a test-connection failure (HTTP error or `ok: false` body) into a friendly sentence. */
export function describeTestError(source: unknown): string {
  let code: string | undefined
  let message: string | undefined
  if (source instanceof ApiError) {
    code = source.code
    message = source.message
  } else if (typeof source === 'string') {
    code = source
    message = source
  } else if (source && typeof source === 'object') {
    const o = source as { code?: string; message?: string }
    code = o.code
    message = o.message
  }
  const t = getT().integration.test
  if (code && Object.hasOwn(testErrors, code)) return t.errors[testErrors[code]]
  return message || t.unknownFailure
}

export function TestResultView({ result, error }: { result?: TestResult; error?: unknown }) {
  const t = useT().integration.test
  if (error || (result && !result.ok)) {
    const text = describeTestError(error ?? result?.error)
    return (
      <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm">
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium text-destructive">{t.failed}</p>
          <p className="text-foreground/80">{text}</p>
        </div>
      </div>
    )
  }
  if (!result) return null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CircleCheckIcon className="size-4 text-success" />
        <span className="font-medium">{t.ok}</span>
        {typeof result.latencyMs === 'number' && (
          <Badge variant={result.latencyMs > 1500 ? 'warning' : 'success'}>
            <TimerIcon />
            {t.roundTrip(result.latencyMs)}
          </Badge>
        )}
      </div>
      {result.page && (
        <div className="min-w-0 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {result.page.label}
            </Badge>
            <span className="truncate font-medium">{result.page.title || t.untitled}</span>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={result.page.url}>
            {result.page.url}
          </p>
        </div>
      )}
      {result.snapshot !== undefined && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{t.snapshotPreview}</p>
          <CodeBlock code={result.snapshot || t.emptySnapshot} maxHeight="18rem" />
        </div>
      )}
    </div>
  )
}
