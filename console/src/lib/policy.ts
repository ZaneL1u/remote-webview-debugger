import { getT, type Messages } from '@/i18n'

import type { Level, MaskPattern, Policy } from './types'

// docs/protocol.md section 11. Defaults apply to any field the gateway omits.
export const DEFAULT_POLICY: Policy = {
  approval: 'prompt',
  maxLevel: 'interact',
  maskSelectors: [],
  maskPatterns: [],
  confirmSelectors: [],
  networkExclude: [],
  sessionLog: true,
  helpButton: 'all',
  helpUsers: [],
  agentIdleMinutes: 2,
  attachMaxMinutes: 60,
  maxOnlineDevices: 0,
  maxAgents: 0,
  eruda: { dock: false, load: false },
}

export function resolvePolicy(policy: Partial<Policy> | undefined): Policy {
  return {
    ...DEFAULT_POLICY,
    ...policy,
    // Projects saved before the switch existed have no value: on.
    sessionLog: policy?.sessionLog !== false,
    eruda: { ...DEFAULT_POLICY.eruda, ...policy?.eruda },
  }
}

export const levels: Level[] = ['observe', 'interact', 'advanced']

function levelEntry(l: Level) {
  return {
    get label() {
      return getT().common.levels[l].label
    },
    short: l,
    get description() {
      return getT().common.levels[l].description
    },
  }
}

/** Labels are localized on every read: index it at render time, do not copy it into module state. */
export const levelMeta: Record<Level, { label: string; short: string; description: string }> = {
  observe: levelEntry('observe'),
  interact: levelEntry('interact'),
  advanced: levelEntry('advanced'),
}

export function levelRank(level: Level) {
  return levels.indexOf(level)
}

function preset(key: keyof Messages['common']['maskPresets'], regex: string): MaskPattern {
  return {
    get name() {
      return getT().common.maskPresets[key]
    },
    regex,
  }
}

/** Names are localized on every read (a preset added to a policy keeps the name it had then). */
export const maskPresets: MaskPattern[] = [
  preset('phone', '1[3-9]\\d{9}'),
  preset('idCard', '\\d{17}[\\dXx]'),
  preset('bankCard', '\\d{16,19}'),
  preset('email', '[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+'),
]

/** Explains why a mask regex is unusable, or returns null when it is fine. */
export function regexProblem(regex: string): string | null {
  const t = getT().common.regex
  if (!regex) return t.empty
  try {
    const re = new RegExp(regex)
    if (re.test('')) return t.matchesEmpty
  } catch (err) {
    return t.syntax(err instanceof Error ? err.message.replace(/^Invalid regular expression: /, '') : String(err))
  }
  // The gateway is written in Go (RE2), which has no lookaround or backreferences.
  if (/\(\?<?[=!]/.test(regex)) return t.lookaround
  if (/\\[1-9]/.test(regex)) return t.backreference
  return null
}

/** Masks `text` with every valid pattern, the way the SDK will. */
export function previewMask(text: string, patterns: MaskPattern[]) {
  let out = text
  for (const p of patterns) {
    if (regexProblem(p.regex)) continue
    out = out.replace(new RegExp(p.regex, 'g'), '••••')
  }
  return out
}

/** Returns the entries that the browser cannot parse as CSS selectors. */
export function invalidSelectors(selectors: string[]): string[] {
  const probe = document.createDocumentFragment()
  return selectors.filter((s) => {
    try {
      probe.querySelector(s)
      return false
    } catch {
      return true
    }
  })
}

/** Splits a textarea into trimmed, de-duplicated, non-empty lines. */
export function parseLines(text: string): string[] {
  return Array.from(new Set(text.split('\n').map((s) => s.trim()).filter(Boolean)))
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

function isIPv6(s: string) {
  if (!/^[0-9a-f:.]+$/i.test(s) || !s.includes(':')) return false
  try {
    // The URL parser validates and normalizes IPv6 literals.
    new URL(`http://[${s}]/`)
    return true
  } catch {
    return false
  }
}

/** Normalizes an IP allowlist entry to CIDR (a bare address becomes /32 or /128); null when invalid. */
export function normalizeCidr(entry: string): string | null {
  const [ip, prefix, ...rest] = entry.split('/')
  if (rest.length) return null
  const v4 = IPV4.test(ip)
  const v6 = !v4 && isIPv6(ip)
  if (!v4 && !v6) return null
  const max = v4 ? 32 : 128
  if (prefix === undefined) return `${ip}/${max}`
  if (!/^\d{1,3}$/.test(prefix) || Number(prefix) > max) return null
  return `${ip}/${Number(prefix)}`
}

export function parseCidrs(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []
  for (const entry of text.split(/[\n,，\s]+/).map((s) => s.trim()).filter(Boolean)) {
    const cidr = normalizeCidr(entry)
    if (cidr) {
      if (!valid.includes(cidr)) valid.push(cidr)
    } else invalid.push(entry)
  }
  return { valid, invalid }
}
