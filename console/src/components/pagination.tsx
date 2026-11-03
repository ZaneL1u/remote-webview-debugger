import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

export const PAGE_SIZES = [10, 20, 50, 100] as const

/** 1 … 4 5 [6] 7 8 … 20 */
function pageItems(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | 'gap')[] = [1]
  const start = Math.max(2, Math.min(page - 1, pages - 4))
  const end = Math.min(pages - 1, Math.max(page + 1, 5))
  if (start > 2) out.push('gap')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < pages - 1) out.push('gap')
  out.push(pages)
  return out
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  className?: string
}) {
  const t = useT().shell.pagination
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav
      className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm', className)}
      aria-label={t.label}
    >
      <p className="text-muted-foreground tabular-nums" data-testid="pagination-summary">
        {total === 0 ? t.empty : t.summary(from, to, total)}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-muted-foreground">
          <span className="hidden sm:inline">{t.perPage}</span>
          <NativeSelect
            className="w-[5.5rem]"
            value={String(pageSize)}
            aria-label={t.perPageAria}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {t.perPageOption(n)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t.previous}
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeftIcon className="rtl:-scale-x-100" />
          </Button>
          <span className="px-2 text-muted-foreground tabular-nums sm:hidden">
            {page} / {pages}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageItems(page, pages).map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="w-6 text-center text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  className={cn('tabular-nums', p === page && 'font-semibold text-foreground')}
                  aria-label={t.page(p)}
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => onPage(p)}
                >
                  {p}
                </Button>
              ),
            )}
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t.next}
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRightIcon className="rtl:-scale-x-100" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
