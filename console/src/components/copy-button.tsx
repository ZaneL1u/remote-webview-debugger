import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  label?: string
  /** Accessible name when there is no visible label (defaults to Copy). */
  ariaLabel?: string
  toastLabel?: string
  className?: string
  size?: 'xs' | 'sm' | 'icon-xs' | 'icon-sm'
  variant?: 'outline' | 'ghost' | 'secondary' | 'brand'
}

export function CopyButton({ value, label, ariaLabel, toastLabel, className, size, variant = 'outline' }: Props) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const icon = copied ? <CheckIcon className="text-success" /> : <CopyIcon />
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (label ? 'xs' : 'icon-xs')}
      className={cn(className)}
      aria-label={ariaLabel ?? label ?? t.common.copy}
      title={ariaLabel}
      data-copied={copied || undefined}
      onClick={async (e) => {
        // Copy buttons sit inside clickable rows and cards; copying must not navigate.
        e.stopPropagation()
        e.preventDefault()
        if (await copyText(value, toastLabel)) setCopied(true)
      }}
    >
      {icon}
      {label}
    </Button>
  )
}
