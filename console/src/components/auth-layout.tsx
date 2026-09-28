import { BotIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-react'
import type * as React from 'react'

import { LanguageSwitcher } from '@/components/language-switcher'
import { BRAND, Logo } from '@/components/logo'
import { useT } from '@/i18n'

// Same order as shell.auth.points in the catalogs.
const pointIcons: React.ReactNode[] = [<SmartphoneIcon key="device" />, <BotIcon key="agent" />, <ShieldCheckIcon key="user" />]

/** Login / accept-invite frame: brand panel on wide screens, the form on the right. */
export function AuthLayout({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  const t = useT()
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <LanguageSwitcher className="absolute top-3 right-3 z-10 sm:top-4 sm:right-4" labelClassName="" />
      <aside className="bg-brand-gradient relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_75%)]"
          style={{
            backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.35) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo className="size-10 rounded-[10px] ring-1 ring-white/30" />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </div>
        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
            {t.shell.auth.headline[0]}
            <br />
            {t.shell.auth.headline[1]}
          </h2>
          <ul className="space-y-5">
            {t.shell.auth.points.map((p, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 [&_svg]:size-[18px]">
                  {pointIcons[i]}
                </span>
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm leading-relaxed text-white/75">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">{t.shell.auth.footer}</p>
      </aside>
      <div className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-7">
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <Logo className="size-11 lg:hidden" />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
                <span className="lg:hidden">{BRAND.name}</span>
                <span className="hidden lg:inline">{subtitle}</span>
              </h1>
              <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
