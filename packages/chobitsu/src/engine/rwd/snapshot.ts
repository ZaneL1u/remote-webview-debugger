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

export interface SnapshotScope {
  /** Only the part of the page under this ref (of the previous snapshot or query). */
  ref?: string
  /** Only what is on screen (and its ancestors); elements wholly off screen are left out. */
  viewport?: boolean
}

export interface ScopedSnapshot {
  snapshot: string
  /** Elements with refs left out because they are off screen. */
  omitted: number
}

/** The whole page, as the agent saw it last; refs cover the whole page in every scope. */
export function takeSnapshot(): string {
  return snapshotIn({}).snapshot
}

/**
 * A snapshot of the page, or of part of it. Refs are assigned for the whole
 * page either way, so a ref seen in find_elements works after a scoped
 * snapshot, and the next snapshot keeps them for unchanged elements.
 */
export function snapshotIn(scope: SnapshotScope): ScopedSnapshot {
  const root = document.body || document.documentElement
  return withDomCompat(() => {
    // The subtree's element, before the refs are renewed.
    const under = scope.ref ? resolveRef(scope.ref) : null
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

    let shown = snapshot.root
    let omitted = 0
    if (under) {
      const node = findNode(snapshot.root, n => elementOf(n) === under)
      if (!node) throw rwdError('not_found', agentText().refDetached(scope.ref!))
      shown = { ...snapshot.root, children: [node] }
    } else if (scope.viewport) {
      const kept = onScreen(snapshot.root, { w: window.innerWidth, h: window.innerHeight })
      shown = kept.node || { ...snapshot.root, children: [] }
      omitted = kept.omitted
    }
    const { json } = renderAriaTreeAsJSON({ ...snapshot, root: shown }, OPTIONS)
    // The popups section is about the whole screen; a subtree leaves it out.
    const overlays = under ? '' : overlaySection(Array.from(next.values()))
    return { snapshot: renderAriaSnapshotAsYaml(json) + overlays, omitted }
  })
}

function findNode(node: AriaNode, test: (n: AriaNode) => boolean): AriaNode | undefined {
  if (test(node)) return node
  for (const child of node.children) {
    if (typeof child === 'string') continue
    const found = findNode(child, test)
    if (found) return found
  }
  return undefined
}

/**
 * A copy of the tree without the elements that lie wholly outside the screen,
 * keeping the ancestors of what is on it (a fixed bar inside a long list
 * stays). Elements without a box of their own (display: contents) are judged
 * by their children.
 */
function onScreen(node: AriaNode, view: { w: number; h: number }): { node: AriaNode | null; omitted: number } {
  const el = elementOf(node)
  let off = false
  if (el && el !== document.body && el !== document.documentElement) {
    const r = el.getBoundingClientRect()
    off = (r.width > 0 || r.height > 0) && (r.bottom <= 0 || r.top >= view.h || r.right <= 0 || r.left >= view.w)
  }
  let omitted = 0
  let keptElements = 0
  const children: (AriaNode | string)[] = []
  for (const child of node.children) {
    if (typeof child === 'string') {
      children.push(child)
      continue
    }
    const sub = onScreen(child, view)
    omitted += sub.omitted
    if (sub.node) {
      children.push(sub.node)
      keptElements++
    }
  }
  if (off && !keptElements) return { node: null, omitted: omitted + (node.ref ? 1 : 0) }
  return { node: { ...node, children }, omitted }
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
