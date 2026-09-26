import { useSyncExternalStore } from 'react'

// Light / dark / follow the OS. The choice lives in localStorage (per browser) and on <html data-theme>;
// index.html applies it before the first paint so there is no flash.

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'rwd:theme'
const listeners = new Set<() => void>()
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let choice: ThemeChoice = read()

export function setTheme(next: ThemeChoice) {
  choice = next
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // private mode: the choice still applies to this tab
  }
  if (next === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  media?.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', listener)
  }
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => choice)
}

/** The theme actually shown. */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, () => (choice === 'system' ? (media?.matches ? 'dark' : 'light') : choice))
}
