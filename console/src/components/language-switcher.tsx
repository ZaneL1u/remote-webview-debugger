import { LanguagesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { htmlLang, type Lang, languages, setLang, useLang, useT } from '@/i18n'
import { cn } from '@/lib/utils'

/** Language menu; the choice is remembered per browser (i18n/index.ts). */
export function LanguageSwitcher({
  className,
  labelClassName = 'hidden sm:inline',
}: {
  className?: string
  /** Visibility of the language name next to the icon. */
  labelClassName?: string
}) {
  const t = useT()
  const lang = useLang()
  const current = languages.find((l) => l.value === lang)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-1.5 px-2 text-muted-foreground hover:text-foreground', className)}
            aria-label={t.shell.language}
            title={t.shell.language}
            data-testid="language-switcher"
          />
        }
      >
        <LanguagesIcon />
        <span className={cn('text-xs font-medium', labelClassName)}>{current?.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-32">
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
          {languages.map((l) => (
            <DropdownMenuRadioItem key={l.value} value={l.value} lang={htmlLang(l.value)} closeOnClick>
              {l.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
