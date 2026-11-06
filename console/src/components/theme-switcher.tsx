import { MonitorIcon, MoonStarIcon, SunIcon } from 'lucide-react'

import { useT } from '@/i18n'
import { setTheme, type ThemeChoice, useThemeChoice } from '@/lib/theme'
import { cn } from '@/lib/utils'

/** Follow the OS (default), light or dark, as a three-way segmented control. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const t = useT()
  const choice = useThemeChoice()
  const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: t.shell.nav.themeSystem, icon: <MonitorIcon /> },
    { value: 'light', label: t.shell.nav.themeLight, icon: <SunIcon /> },
    { value: 'dark', label: t.shell.nav.themeDark, icon: <MoonStarIcon /> },
  ]
  return (
    <div
      role="radiogroup"
      aria-label={t.shell.nav.appearance}
      className={cn('inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 ring-1 ring-border/60', className)}
    >
      {options.map((o) => {
        const on = choice === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              'flex h-7 flex-1 items-center justify-center rounded-md px-2 text-muted-foreground transition-all outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:size-3.5',
              on && 'bg-background text-foreground shadow-sm ring-1 ring-border/70',
            )}
          >
            {o.icon}
          </button>
        )
      })}
    </div>
  )
}
