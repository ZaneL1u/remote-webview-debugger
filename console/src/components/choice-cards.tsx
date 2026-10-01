import type * as React from 'react'

import { cn } from '@/lib/utils'

export type Choice<T extends string> = {
  value: T
  label: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  /** Highlights a risky choice. */
  warning?: boolean
}

/** A radio group drawn as selectable cards (native radios, so labels and keyboard work as expected). */
export function ChoiceCards<T extends string>({
  name,
  value,
  onChange,
  options,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  name: string
  value: T
  onChange: (value: T) => void
  options: Choice<T>[]
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('grid gap-2', className)}>
      {options.map((o) => {
        const checked = o.value === value
        return (
          <label
            key={o.value}
            className={cn(
              'relative flex cursor-pointer gap-3 rounded-lg border bg-card p-3 text-sm transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring',
              checked ? (o.warning ? 'border-warning bg-warning-soft/60' : 'border-brand bg-brand-soft/40') : 'hover:bg-muted/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                checked ? (o.warning ? 'border-warning' : 'border-brand') : 'border-input',
              )}
            >
              {checked && <span className={cn('size-2 rounded-full', o.warning ? 'bg-warning' : 'bg-brand')} />}
            </span>
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="flex items-center gap-1.5 font-medium [&_svg]:size-4">
                {o.icon}
                {o.label}
              </span>
              {o.description && <span className="block text-xs leading-relaxed text-muted-foreground">{o.description}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}
