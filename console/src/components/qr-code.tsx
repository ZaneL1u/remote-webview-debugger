import { DownloadIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/** QR code rendered in the browser (the `qrcode` package is loaded on first use). Always dark on white so phones can scan it in dark mode too. */
export function QrCode({
  value,
  size = 192,
  className,
  downloadName,
}: {
  value: string
  size?: number
  className?: string
  /** Shows a download button saving an SVG with this file name (without extension). */
  downloadName?: string
}) {
  const t = useT()
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setFailed(false)
    import('qrcode')
      .then((QRCode) => QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }))
      .then((svg) => !cancelled && setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="rounded-lg border bg-white p-2 shadow-xs" style={{ width: size + 18, height: size + 18 }}>
        {src ? (
          <img src={src} width={size} height={size} alt={t.shell.qr.alt} className="block" data-testid="qr-code" />
        ) : failed ? (
          <div className="flex size-full items-center justify-center text-center text-xs text-neutral-500">{t.shell.qr.failed}</div>
        ) : (
          <Skeleton className="size-full bg-neutral-200" />
        )}
      </div>
      {downloadName && src && (
        <Button variant="ghost" size="xs" nativeButton={false} render={<a href={src} download={`${downloadName}.svg`} />}>
          <DownloadIcon />
          {t.shell.qr.download}
        </Button>
      )}
    </div>
  )
}
