import { ChevronDownIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

/** A styled native `<select>`: accessible, and uses the platform picker on phones. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative w-full min-w-0', className)} data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-1 pr-8 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-ring',
          'aria-invalid:border-destructive',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
