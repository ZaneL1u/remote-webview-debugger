import { useMutation } from '@tanstack/react-query'
import { LoaderCircleIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/i18n'
import { ApiError, api, errorMessage } from '@/lib/api'
import { MIN_PASSWORD } from '@/lib/format'

export function ChangePasswordDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email?: string
}) {
  const t = useT()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const change = useMutation({
    mutationFn: () => api.changePassword(oldPassword, newPassword),
    meta: { silent: true },
    onSuccess: () => {
      toast.success(t.shell.password.changed)
      onOpenChange(false)
    },
    onError: (err) => {
      // The contract does not name the error code; any 400/401 here means the old password was rejected.
      if (err instanceof ApiError && (err.status === 401 || err.code === 'bad_password')) setError(t.shell.password.wrongCurrent)
      else setError(errorMessage(err))
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setOldPassword('')
          setNewPassword('')
          setConfirm('')
          setError(null)
          change.reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.shell.password.title}</DialogTitle>
          <DialogDescription>{t.shell.password.description}</DialogDescription>
        </DialogHeader>
        <form
          id="change-password"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!oldPassword) return setError(t.shell.password.currentRequired)
            if (newPassword.length < MIN_PASSWORD) return setError(t.shell.password.tooShort(MIN_PASSWORD))
            if (newPassword === oldPassword) return setError(t.shell.password.sameAsCurrent)
            if (newPassword !== confirm) return setError(t.shell.password.mismatch)
            setError(null)
            change.mutate()
          }}
        >
          <input type="text" name="username" autoComplete="username" value={email ?? ''} readOnly hidden />
          <div className="space-y-2">
            <Label htmlFor="old-password">{t.shell.password.current}</Label>
            <Input
              id="old-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t.shell.password.new}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.shell.password.hint(MIN_PASSWORD)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t.shell.password.confirm}</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form="change-password" disabled={change.isPending}>
            {change.isPending && <LoaderCircleIcon className="animate-spin" />}
            {t.shell.password.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
