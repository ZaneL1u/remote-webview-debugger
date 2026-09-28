import { useId } from 'react'

import { getT } from '@/i18n'
import { cn } from '@/lib/utils'

export const BRAND = {
  name: 'Remote Debugger',
  short: 'RD',
  /** Localized on every read. */
  get tagline() {
    return getT().shell.tagline
  },
}

/**
 * The mark: a WebView (phone frame with an address bar) reached remotely (signal arcs) and driven by an
 * agent (cursor reaching into the screen). Same drawing as public/favicon.svg; reads at 16px.
 */
export function Logo({ className }: { className?: string }) {
  const id = useId()
  const g = `rwd-logo-${id.replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={g} x1="2" y1="0" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8F7CFF" />
          <stop offset=".5" stopColor="#5D5CF5" />
          <stop offset="1" stopColor="#2E6CFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${g})`} />
      <rect x="6.25" y="6" width="13.5" height="20" rx="3.4" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M10.4 10.4h5.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5" />
      <path
        d="M22.4 8.4a4.4 4.4 0 0 1 3.2 3.2M23 4.5a8 8 0 0 1 5.5 5.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M13.6 13.4l11.6 4.4-4.9 1.8-1.8 4.9z"
        fill="#fff"
        stroke={`url(#${g})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  )
}

/** Logo plus wordmark. `compact` shows the short mark only (tight headers). */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Logo className="size-7" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-semibold tracking-tight">{compact ? BRAND.short : BRAND.name}</span>
      </span>
    </span>
  )
}
