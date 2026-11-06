import { ArrowUpRightIcon, BookOpenIcon, BotIcon, GlobeIcon, RadioTowerIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-react'
import type * as React from 'react'

import { LanguageSwitcher } from '@/components/language-switcher'
import { BRAND, Logo } from '@/components/logo'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { type Lang, useLang, useT } from '@/i18n'

// Same order as shell.auth.points in the catalogs.
const pointIcons: React.ReactNode[] = [<SmartphoneIcon key="device" />, <BotIcon key="agent" />, <ShieldCheckIcon key="user" />]

const REPO = 'https://github.com/ZaneL1u/remote-webview-debugger'
const SITE = 'https://debugger.site'
// The SDK README's translations (sdk/README.<suffix>.md) and the site's language paths (website/src/i18n/locales.ts).
const readmeSuffix: Record<Lang, string> = {
  en: '',
  zh: '.zh-CN',
  'zh-TW': '.zh-TW',
  ar: '.ar',
  de: '.de',
  es: '.es',
  fr: '.fr',
  ja: '.ja',
  ko: '.ko',
  pt: '.pt-BR',
  ru: '.ru',
}
const sitePath: Record<Lang, string> = {
  en: '',
  zh: 'zh/',
  'zh-TW': 'zh-tw/',
  ar: 'ar/',
  de: 'de/',
  es: 'es/',
  fr: 'fr/',
  ja: 'ja/',
  ko: 'ko/',
  pt: 'pt-br/',
  ru: 'ru/',
}

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

/** Device → gateway → agent, with a pulse running along the line (the product in one picture). */
function Pipeline() {
  const node = 'flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/15 backdrop-blur [&_svg]:size-5'
  const line = 'relative h-px flex-1 overflow-hidden bg-gradient-to-r from-white/10 via-white/25 to-white/10'
  const pulse =
    'absolute inset-y-0 -start-1/3 w-1/3 bg-gradient-to-r from-transparent via-[#b9b0ff] to-transparent motion-safe:animate-[auth-pulse_2.8s_ease-in-out_infinite] rtl:bg-gradient-to-l'
  return (
    <div className="flex max-w-sm items-center gap-3" aria-hidden>
      <span className={node}>
        <SmartphoneIcon />
      </span>
      <span className={line}>
        <span className={pulse} />
      </span>
      <span className={`${node} bg-white/[0.1] ring-white/25`}>
        <RadioTowerIcon />
      </span>
      <span className={line}>
        <span className={pulse} style={{ animationDelay: '1.4s' }} />
      </span>
      <span className={node}>
        <BotIcon />
      </span>
    </div>
  )
}

function BrandPanel() {
  const t = useT()
  return (
    <aside className="relative hidden overflow-hidden bg-[#09091a] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Soft brand light and a faint grid; no hard gradient wall. */}
      <div className="pointer-events-none absolute -top-48 -start-40 size-[38rem] rounded-full bg-[#7c6cff]/30 blur-[130px]" />
      <div className="pointer-events-none absolute -end-32 -bottom-56 size-[36rem] rounded-full bg-[#2e6cff]/25 blur-[130px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(ellipse_at_40%_45%,black_20%,transparent_70%)]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div className="relative flex items-center gap-3">
        <Logo className="size-9 rounded-[9px] ring-1 ring-white/20" />
        <span className="text-[17px] font-semibold tracking-tight">{BRAND.name}</span>
      </div>
      <div className="relative max-w-lg space-y-10">
        <Pipeline />
        <h2 className="text-4xl leading-[1.15] font-semibold tracking-tight text-balance xl:text-[44px]">
          {t.shell.auth.headline[0]}
          <br />
          <span className="bg-gradient-to-r from-[#c9c1ff] via-[#a5b4ff] to-[#8fb8ff] bg-clip-text text-transparent">
            {t.shell.auth.headline[1]}
          </span>
        </h2>
        <ul className="space-y-6">
          {t.shell.auth.points.map((p, i) => (
            <li key={i} className="flex gap-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[#c9c1ff] ring-1 ring-white/10 [&_svg]:size-[18px]">
                {pointIcons[i]}
              </span>
              <div className="space-y-1">
                <p className="font-medium text-white/95">{p.title}</p>
                <p className="text-sm leading-relaxed text-white/55">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative border-t border-white/10 pt-6 text-xs tracking-wide text-white/40">{t.shell.auth.footer}</p>
    </aside>
  )
}

/** Integration guide, source and website: useful before signing in, so they live on this page. */
function AuthLinks() {
  const t = useT()
  const lang = useLang()
  const links = [
    { href: `${REPO}/blob/main/sdk/README${readmeSuffix[lang]}.md`, label: t.shell.auth.links.guide, icon: <BookOpenIcon /> },
    { href: REPO, label: 'GitHub', icon: <GithubMark /> },
    { href: `${SITE}/${sitePath[lang]}`, label: t.shell.auth.links.website, icon: <GlobeIcon /> },
  ]
  return (
    <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4"
        >
          {l.icon}
          {l.label}
          <ArrowUpRightIcon className="!size-3 opacity-0 transition-opacity group-hover:opacity-60 rtl:-scale-x-100" />
        </a>
      ))}
    </nav>
  )
}

/** Login / accept-invite frame: brand panel on wide screens, the form on the right. */
export function AuthLayout({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel />
      <div className="relative flex min-h-dvh flex-col px-4 sm:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--brand)_10%,transparent),transparent_70%)] lg:hidden" />
        <header className="relative flex h-16 items-center justify-between">
          <span className="flex items-center gap-2.5 lg:invisible">
            <Logo className="size-8" />
            <span className="font-semibold tracking-tight">{BRAND.name}</span>
          </span>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher labelClassName="hidden sm:inline" />
          </div>
        </header>
        <main className="relative flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[380px] space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{subtitle}</h1>
              <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
            </div>
            {children}
          </div>
        </main>
        <footer className="relative py-6">
          <AuthLinks />
        </footer>
      </div>
    </div>
  )
}
