import {
  generateAriaTree,
  renderAriaTreeAsJSON,
} from '../vendor/playwright/injected/ariaSnapshot'
import { normalizeWhiteSpace } from '../vendor/playwright/isomorphic/stringUtils'
import { renderAriaSnapshotAsYaml } from '../vendor/playwright/isomorphic/ariaSnapshotRenderer'
import type { AriaNode } from '../vendor/playwright/isomorphic/ariaSnapshot'
import { isDebugUi, isMasked, maskedElements, MASK, scrubPatterns, shownText } from '../privacy'
import { isFormField, tagOf, withDomCompat } from './dom'
import { rwdError } from './errors'
import { agentText } from './i18n'
import { findOverlays } from './overlays'

// The agent's view of the page: Playwright's AI-mode aria snapshot (the same
// YAML Playwright MCP produces), with [ref=eN] on elements the agent can act
// on. The vendored code is used as is; this wrapper only drops debug tools'
// UI (eruda, PageSpy, vConsole; ours lives outside <body>) and masks
// sensitive values.

const OPTIONS = { mode: 'ai' as const }

// ref -> element, from the latest snapshot only.
let refs = new Map<string, Element>()
// Refs for elements the aria snapshot has no node for (a popup's empty
// backdrop, the element covering a click target): oN, kept while connected.
const extraRefs = new Map<string, Element>()
let extraSeq = 0
// The cleaned tree of the latest snapshot (what the agent saw), for rwd.query.
let lastTree: AriaNode | undefined

export function takeSnapshot(): string {
  const root = document.body || document.documentElement
  return withDomCompat(() => {
    const snapshot = generateAriaTree(root, OPTIONS)
    clean(snapshot.root, collectSecrets())
    applyPatterns(snapshot.root)
    lastTree = snapshot.root

    const next = new Map<string, Element>()
    snapshot.info.forEach((info, ref) => {
      if (!isDebugUi(info.element)) next.set(ref, info.element)
    })
    refs = next
    extraRefs.forEach((el, ref) => {
      if (!el.isConnected) extraRefs.delete(ref)
    })

    const { json } = renderAriaTreeAsJSON(snapshot, OPTIONS)
    return renderAriaSnapshotAsYaml(json) + overlaySection(Array.from(next.values()))
  })
}

/** A ref for any element: its snapshot ref, or an oN ref of its own. */
export function refFor(el: Element): string {
  let found = ''
  refs.forEach((other, ref) => {
    if (!found && other === el) found = ref
  })
  extraRefs.forEach((other, ref) => {
    if (!found && other === el) found = ref
  })
  if (found) return found
  const ref = 'o' + ++extraSeq
  extraRefs.set(ref, el)
  return ref
}

// Popups and their backdrops, listed after the tree so the agent knows what
// sits on top and can click a backdrop to close its popup.
function overlaySection(content: Element[]) {
  const overlays = findOverlays(content)
  if (!overlays.length) return ''
  const t = agentText()
  const lines = overlays.map(o =>
    o.kind === 'mask'
      ? t.overlayMask(tagOf(o.element), o.coverage, refFor(o.element))
      : t.overlayLayer(tagOf(o.element), o.text, o.coverage, refFor(o.element))
  )
  return '\n\n' + t.overlayHeader + '\n' + lines.join('\n') + '\n'
}

/** The element behind a ref of the latest snapshot. */
export function resolveRef(ref: unknown): Element {
  if (typeof ref !== 'string' || !ref) {
    throw rwdError('bad_request', agentText().missingParam('ref'))
  }
  const el = refs.get(ref) || extraRefs.get(ref)
  if (!el) {
    throw rwdError('not_found', agentText().refNotInSnapshot(ref))
  }
  if (!el.isConnected) {
    throw rwdError('not_found', agentText().refDetached(ref))
  }
  return el
}

export interface QueryMatch {
  ref: string
  role: string
  name: string
  text: string
}

/**
 * Elements of a fresh snapshot (refs stay stable for unchanged elements) by
 * role (exact), accessible name and / or text (substrings, case-insensitive).
 * Text matches return the innermost elements only, not every ancestor.
 */
export function querySnapshot(params: { role?: unknown; name?: unknown; text?: unknown; limit?: unknown }) {
  const lower = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')
  const role = lower(params.role)
  const name = lower(params.name)
  const text = lower(params.text)
  if (!role && !name && !text) throw rwdError('bad_request', agentText().queryNeedsCriteria)
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 20))
  takeSnapshot()
  const matches: QueryMatch[] = []
  const walk = (node: AriaNode): { text: string; matched: boolean } => {
    let all = node.name || ''
    let inner = false
    for (const child of node.children) {
      if (typeof child === 'string') {
        all += ' ' + child
      } else {
        const sub = walk(child)
        all += ' ' + sub.text
        inner = inner || sub.matched
      }
    }
    all = normalizeWhiteSpace(all)
    const ok =
      !!node.ref &&
      refs.has(node.ref) &&
      (!role || node.role.toLowerCase() === role) &&
      (!name || (node.name || '').toLowerCase().indexOf(name) >= 0) &&
      (!text || all.toLowerCase().indexOf(text) >= 0)
    // Ancestors of a text match contain the same text: keep the innermost.
    if (ok && !(text && inner)) {
      matches.push({ ref: node.ref!, role: node.role, name: node.name || '', text: all.length > 100 ? all.slice(0, 100) + '…' : all })
    }
    return { text: all, matched: ok || inner }
  }
  if (lastTree) walk(lastTree)
  return { matches: matches.slice(0, limit), total: matches.length }
}

function applyPatterns(node: AriaNode) {
  if (node.name) node.name = scrubPatterns(node.name)
  for (const key in node.props) node.props[key] = scrubPatterns(node.props[key])
  node.children = node.children.map(child => {
    if (typeof child === 'string') return scrubPatterns(child)
    applyPatterns(child)
    return child
  })
}

interface Secret {
  element: Element
  text: string
}

function collectSecrets(): Secret[] {
  const secrets: Secret[] = []
  const elements = maskedElements()
  for (let i = 0; i < elements.length; i++) {
    const text = normalizeWhiteSpace(shownText(elements[i]))
    if (text) secrets.push({ element: elements[i], text })
  }
  return secrets
}

function clean(node: AriaNode, secrets: Secret[]) {
  const children: (AriaNode | string)[] = []
  for (const child of node.children) {
    if (typeof child !== 'string') {
      const el = elementOf(child)
      if (el && isDebugUi(el)) continue
      clean(child, secrets)
    }
    children.push(child)
  }
  node.children = children

  const el = elementOf(node)
  if (!el || !secrets.length) return

  if (isMasked(el)) {
    // A field keeps its label; anything else shows nothing of its content.
    if (!isFormField(el) && node.name) node.name = MASK
    node.children = node.children.map(child =>
      typeof child === 'string' && child ? MASK : child
    )
    return
  }

  // Text of masked descendants that was merged into this node's text or name.
  const inside: string[] = []
  for (const secret of secrets) {
    if (el.contains(secret.element)) inside.push(secret.text)
  }
  if (!inside.length) return
  const scrub = (text: string) => {
    for (const secret of inside) text = text.split(secret).join(MASK)
    return text
  }
  if (node.name) node.name = scrub(node.name)
  node.children = node.children.map(child =>
    typeof child === 'string' ? scrub(child) : child
  )
}

// The vendored ariaSnapshot.ts keeps each node's element under a private
// symbol, Symbol('element'). Find it once instead of patching the vendored code.
let elementSymbol: symbol | undefined

function elementOf(node: AriaNode): Element | undefined {
  if (!elementSymbol) {
    const symbols = Object.getOwnPropertySymbols(node)
    for (const symbol of symbols) {
      if (String(symbol) === 'Symbol(element)') elementSymbol = symbol
    }
    if (!elementSymbol) return undefined
  }
  return (node as any)[elementSymbol]
}
