import { toast } from 'sonner'

import { getT } from '@/i18n'

export async function copyText(text: string, label = getT().common.copied) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // Fallback for plain-http deployments where the async clipboard API is unavailable.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (!ok) throw new Error('copy failed')
    }
    toast.success(label)
    return true
  } catch {
    toast.error(getT().common.copyFailed)
    return false
  }
}
