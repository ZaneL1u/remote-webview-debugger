import { getT } from '@/i18n'
import type { SSOConfig } from '@/lib/types'

/** The provider's name for buttons and badges: RWD_OIDC_NAME, else the localized provider name. */
export function ssoName(sso: SSOConfig | null | undefined, kind?: string): string {
  const providers: Record<string, string> = getT().shell.login.providers
  if (sso && (kind === undefined || kind === sso.provider) && sso.name) return sso.name
  const k = kind ?? sso?.provider ?? 'oidc'
  return providers[k] ?? k
}

/** Where the login button goes: the gateway sends the browser on to the provider (docs/protocol.md section 12.2). */
export function ssoStartUrl(redirect?: string): string {
  return `/v1/api/auth/oidc/start?redirect=${encodeURIComponent(redirect ?? '/')}`
}
