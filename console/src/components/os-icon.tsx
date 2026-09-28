import { GlobeIcon, TerminalIcon } from 'lucide-react'

import type { Device, DeviceSystem } from '@/lib/types'
import { cn } from '@/lib/utils'

// Small, recognisable OS glyphs for the device list (lucide has no OS marks). Simple shapes drawn for
// 16-20px; they are identifiers, not logos.

export type OsKind = 'ios' | 'macos' | 'android' | 'harmony' | 'windows' | 'linux' | 'web'

export function osKind(system: DeviceSystem | undefined, platform?: string): OsKind {
  const os = (system?.os || '').toLowerCase()
  if (os === 'ios' || os === 'ipados') return 'ios'
  if (os === 'macos') return 'macos'
  if (os === 'android') return 'android'
  if (os === 'harmonyos') return 'harmony'
  if (os === 'windows') return 'windows'
  if (os === 'linux') return 'linux'
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'web'
}

const osNames: Record<OsKind, string> = {
  ios: 'iOS',
  macos: 'macOS',
  android: 'Android',
  harmony: 'HarmonyOS',
  windows: 'Windows',
  linux: 'Linux',
  web: 'Web',
}

const tiles: Record<OsKind, string> = {
  ios: 'bg-foreground text-background',
  macos: 'bg-foreground/80 text-background',
  android: 'bg-[#3ddc84] text-[#073042]',
  harmony: 'bg-[#d6203a] text-white',
  windows: 'bg-[#0078d4] text-white',
  linux: 'bg-[#2b2f36] text-[#f6c344]',
  web: 'bg-muted text-muted-foreground ring-1 ring-border ring-inset',
}

function Glyph({ kind }: { kind: OsKind }) {
  switch (kind) {
    case 'ios':
    case 'macos':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M16.6 12.7c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9ZM14.2 5.6c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4Z" />
        </svg>
      )
    case 'android':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M3.5 18a8.5 8.5 0 0 1 17 0Z" fill="currentColor" />
          <path d="m7 8.6-1.6-2.8M17 8.6l1.6-2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="8.6" cy="14" r="1.25" fill="#3ddc84" />
          <circle cx="15.4" cy="14" r="1.25" fill="#3ddc84" />
        </svg>
      )
    case 'harmony':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M18.4 8.2A7.5 7.5 0 1 0 19.5 12" />
          <circle cx="18.8" cy="5.4" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'windows':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M4 5.6 10.6 4.7v6.6H4ZM11.6 4.6 20 3.4v7.9h-8.4ZM4 12.3h6.6v6.6L4 18ZM11.6 12.3H20v8.3l-8.4-1.2Z" />
        </svg>
      )
    case 'linux':
      return <TerminalIcon strokeWidth={2.4} />
    default:
      return <GlobeIcon strokeWidth={2.2} />
  }
}

/** A small coloured tile with the OS glyph. */
export function OsIcon({ kind, className }: { kind: OsKind; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] [&_svg]:size-3.5',
        tiles[kind],
        className,
      )}
      title={osNames[kind]}
      aria-hidden
    >
      <Glyph kind={kind} />
    </span>
  )
}

/** "iOS 18.1 · iPhone · WeChat 8.0.50" with the OS tile; falls back to the platform when the gateway sends no `system`. */
export function DeviceSystemLabel({
  device,
  className,
  muted,
}: {
  device: Pick<Device, 'system' | 'platform' | 'ua'>
  className?: string
  muted?: boolean
}) {
  const kind = osKind(device.system, device.platform)
  const label = device.system?.label || osNames[kind]
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)} title={device.ua || label}>
      <OsIcon kind={kind} />
      <span className={cn('truncate', muted && 'text-muted-foreground')}>{label}</span>
    </span>
  )
}

export { osNames }
