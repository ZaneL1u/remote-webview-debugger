import { useMemo } from 'react'

import { CopyButton } from '@/components/copy-button'
import { useT } from '@/i18n'
import { type CodeLang, tokenize } from '@/lib/highlight'
import { cn } from '@/lib/utils'

type Props = {
  code: string
  title?: string
  /** Enables syntax colouring. */
  lang?: CodeLang
  className?: string
  maxHeight?: string
  wrap?: boolean
}

const langLabels: Partial<Record<CodeLang, string>> = {
  html: 'HTML',
  js: 'JavaScript',
  swift: 'Swift',
  kotlin: 'Kotlin',
  bash: 'Shell',
  json: 'JSON',
}

const copyOnInk =
  'border-white/10 bg-white/[0.06] text-code-foreground shadow-none hover:bg-white/15 hover:text-white dark:hover:bg-white/15'

/** Copyable code on an always-dark surface. */
export function CodeBlock({ code, title, lang, className, maxHeight, wrap }: Props) {
  const t = useT()
  const tokens = useMemo(() => (lang ? tokenize(code, lang) : null), [code, lang])
  const label = title ?? (lang ? langLabels[lang] : undefined)
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-code-border bg-code text-code-foreground shadow-sm',
        className,
      )}
    >
      {label ? (
        <div className="flex items-center justify-between gap-2 border-b border-code-border bg-white/[0.03] py-1.5 pr-1.5 pl-3">
          <span className="flex items-center gap-2 text-xs font-medium text-code-muted">
            <span className="flex gap-1" aria-hidden>
              <span className="size-2 rounded-full bg-white/15" />
              <span className="size-2 rounded-full bg-white/15" />
              <span className="size-2 rounded-full bg-white/15" />
            </span>
            {label}
          </span>
          <CopyButton value={code} label={t.common.copy} variant="ghost" className="text-code-muted hover:bg-white/10 hover:text-white" />
        </div>
      ) : (
        <CopyButton value={code} variant="outline" className={cn('absolute top-2 right-2 z-10', copyOnInk)} />
      )}
      <pre
        className={cn(
          'overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed [scrollbar-color:rgb(255_255_255/0.2)_transparent]',
          wrap ? 'break-all whitespace-pre-wrap' : 'whitespace-pre',
          !label && 'pr-12',
        )}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code>
          {tokens
            ? tokens.map((t, i) =>
                t.cls ? (
                  <span key={i} className={t.cls}>
                    {t.text}
                  </span>
                ) : (
                  t.text
                ),
              )
            : code}
        </code>
      </pre>
    </div>
  )
}
