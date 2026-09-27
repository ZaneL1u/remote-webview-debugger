import { getLang, getT, locale } from '@/i18n'

import type { ControlState } from './types'

export function relativeTime(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return '—'
  const t = getT().common.time
  const diff = Math.max(0, now - ms)
  const s = Math.floor(diff / 1000)
  if (s < 10) return t.justNow
  if (s < 60) return t.secondsAgo(s)
  const m = Math.floor(s / 60)
  if (m < 60) return t.minutesAgo(m)
  const h = Math.floor(m / 60)
  if (h < 24) return t.hoursAgo(h)
  const d = Math.floor(h / 24)
  if (d < 30) return t.daysAgo(d)
  return formatDate(ms)
}

export function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(ms)
  if (getLang() === 'en') return dateFormat('full').format(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Date only: "2026-11-02" / "Nov 2, 2026". */
export function formatDay(ms: number | null | undefined): string {
  if (!ms) return '—'
  if (getLang() === 'en') return dateFormat('day').format(ms)
  return formatDate(ms).slice(0, 10)
}

/** Without the year: "11-02 14:05" / "Nov 2, 14:05". */
export function formatShortDate(ms: number | null | undefined): string {
  if (!ms) return '—'
  if (getLang() === 'en') return dateFormat('short').format(ms)
  return formatDate(ms).slice(5)
}

const enDates = new Map<string, Intl.DateTimeFormat>()
const enOptions: Record<'full' | 'day' | 'short', Intl.DateTimeFormatOptions> = {
  // "Nov 2, 2026, 14:05": 24-hour, like the Chinese format.
  full: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  day: { year: 'numeric', month: 'short', day: 'numeric' },
  short: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
}

function dateFormat(kind: 'full' | 'day' | 'short') {
  let f = enDates.get(kind)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', enOptions[kind])
    enDates.set(kind, f)
  }
  return f
}

export function formatClock(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** Localized on every read: index it at render time, do not copy it into module state. */
export const controlLabels: Record<ControlState, string> = {
  get none() {
    return getT().common.control.none
  },
  get observe() {
    return getT().common.control.observe
  },
  get agent() {
    return getT().common.control.agent
  },
  get user() {
    return getT().common.control.user
  },
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case 'ios':
      return 'iOS'
    case 'android':
      return 'Android'
    case 'web':
      return 'Web'
    default:
      return platform || getT().common.unknown
  }
}

/** Short human summary of a user agent, e.g. "iPhone · iOS 18.1" or "Chrome 140 · macOS". */
export function summarizeUA(ua: string): string {
  if (!ua) return getT().common.unknownDevice
  const ios = ua.match(/(iPhone|iPad).*?OS (\d+)[_.](\d+)/)
  if (ios) return `${ios[1]} · iOS ${ios[2]}.${ios[3]}`
  const android = ua.match(/Android (\d+(?:\.\d+)?);\s*([^;)]+?)(?: Build|\))/)
  if (android) return `${android[2].trim()} · Android ${android[1]}`
  const chrome = ua.match(/Chrome\/(\d+)/)
  const os = /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  if (chrome) return `Chrome ${chrome[1]}${os ? ` · ${os}` : ''}`
  const safari = ua.match(/Version\/(\d+).*Safari/)
  if (safari) return `Safari ${safari[1]}${os ? ` · ${os}` : ''}`
  return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua
}

/** Parses a textarea of origins (one per line or comma separated). */
export function parseOrigins(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,]/)
        .map((s) => s.trim().replace(/\/+$/, ''))
        .filter(Boolean),
    ),
  )
}

/** Returns the entries that do not look like an origin (scheme://host[:port], wildcard host allowed). */
export function invalidOrigins(origins: string[]): string[] {
  return origins.filter((o) => !/^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d+)?$/i.test(o))
}

/** Client-side minimum for new passwords (the contract does not set one; the gateway may be stricter). */
export const MIN_PASSWORD = 8

/** "in 3 days" style countdown; past timestamps read "Expired". */
export function untilTime(ms: number, now = Date.now()): string {
  const t = getT().common.time
  const diff = ms - now
  if (diff <= 0) return t.expired
  const m = Math.ceil(diff / 60_000)
  if (m < 60) return t.inMinutes(m)
  const h = Math.round(m / 60)
  if (h < 48) return t.inHours(h)
  return t.inDays(Math.round(h / 24))
}

/** "3 days 4 h" / "5 h 12 min" / "8 min" / "40s". */
export function formatDuration(sec: number): string {
  const t = getT().common.time
  const s = Math.max(0, Math.floor(sec))
  if (s < 60) return t.seconds(s)
  const m = Math.floor(s / 60)
  if (m < 60) return t.minutes(m)
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? t.hoursMinutes(h, m % 60) : t.hours(h)
  const d = Math.floor(h / 24)
  return h % 24 ? t.daysHours(d, h % 24) : t.days(d)
}

/** Compact count, e.g. 1234 → "1,234". */
export function formatCount(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString(locale())
}
