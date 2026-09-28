import { LoaderCircleIcon } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'

import { useT } from '@/i18n'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

type Props = {
  /** The element that opens the dialog, e.g. `<Button variant="outline" />`. Its children go in `children`. */
  trigger: React.ReactElement
  children: React.ReactNode
  title: string
  description: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  disabled?: boolean
  /** Resolves when done; the dialog closes on success and stays open on failure. */
  onConfirm: () => Promise<unknown>
}

export function ConfirmDialog({ trigger, children, title, description, confirmLabel, destructive, disabled, onConfirm }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger render={trigger} disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" disabled={pending} />}>{t.common.cancel}</AlertDialogClose>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={async () => {
              setPending(true)
              try {
                await onConfirm()
                setOpen(false)
              } catch {
                // Errors are surfaced by the global mutation toast.
              } finally {
                setPending(false)
              }
            }}
          >
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
