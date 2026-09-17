import { agentText, closestComposed, describeForAgent, isDebugUi, isMasked, flushLog, logRecord, MASK, scrub, tagOf } from '@chobitsu/engine/rwd'

// Page state for the gateway: url / title / visibility changes (`page`
// messages) and timeline events: in-page navigations and the user's taps.
// The same, plus the user's input, submits and scrolling, go to the session
// log.

export interface PageState {
  url: string
  title: string
  visibility: 'visible' | 'hidden'
}

export function currentPage(): PageState {
  return {
    url: location.href,
    title: document.title,
    visibility: document.visibilityState === 'hidden' ? 'hidden' : 'visible',
  }
}

export function shortLocation(url: string) {
  try {
    const u = new URL(url)
    // No query string: it may carry tokens.
    return u.pathname + u.hash
  } catch (e) {
    return url.split('?')[0]
  }
}

export interface PageWatchOptions {
  onChange(page: PageState): void
  onNav(summary: string): void
  onTap(summary: string, target: Element): void
}

const TAP_TARGETS =
  'a, button, input, select, textarea, label, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=switch], [role=option], [onclick]'

/** 'Tapped button "Place order"': role and accessible name, never a field's value. In the agent's language. */
export function tapSummary(target: Element): string {
  const el = closestComposed(target, TAP_TARGETS) || target
  const { role, name } = describeForAgent(el)
  let text = name
  if (!text && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    text = isMasked(el) ? MASK : scrub((el.textContent || '').replace(/\s+/g, ' ').trim())
  }
  if (text.length > 30) text = text.slice(0, 30) + '…'
  const t = agentText()
  const label = t.roles[role] || t.element
  return text ? t.tapped(label, text) : t.tappedTag(label, tagOf(el))
}

function fieldName(el: Element) {
  const { role, name } = describeForAgent(el)
  return name ? `${role} "${name.length > 30 ? name.slice(0, 30) + '…' : name}"` : tagOf(el)
}

function fieldValue(el: Element): string {
  if (isMasked(el)) return MASK
  if (el instanceof HTMLInputElement) {
    if (el.type === 'password') return MASK
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'checked' : 'unchecked'
  }
  const value = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el.value : ''
  const text = scrub(value)
  return text.length > 200 ? text.slice(0, 200) + '…' : text
}

export function watchPage(opts: PageWatchOptions) {
  let last = currentPage()
  let timer: ReturnType<typeof setTimeout> | undefined

  const check = () => {
    timer = undefined
    const page = currentPage()
    if (page.url === last.url && page.title === last.title && page.visibility === last.visibility) return
    const prev = last
    last = page
    if (page.url !== prev.url) {
      opts.onNav(agentText().inPageNav(shortLocation(prev.url), shortLocation(page.url)))
      logRecord('page', { event: 'nav', url: scrub(page.url), from: scrub(prev.url), title: scrub(page.title) })
    }
    if (page.visibility !== prev.visibility) {
      logRecord('page', { event: 'visibility', state: page.visibility })
      // The app may be killed in the background: write now.
      if (page.visibility === 'hidden') flushLog()
    }
    opts.onChange(page)
  }
  const schedule = () => {
    if (!timer) timer = setTimeout(check, 50)
  }

  for (const name of ['pushState', 'replaceState'] as const) {
    const orig = history[name]
    if (typeof orig !== 'function') continue
    history[name] = function (this: History) {
      const result = orig.apply(this, arguments as any)
      schedule()
      return result
    }
  }
  window.addEventListener('popstate', schedule)
  window.addEventListener('hashchange', schedule)
  document.addEventListener('visibilitychange', check)

  // <title> changes. The SDK runs in <head>, so <head> exists.
  try {
    new MutationObserver(schedule).observe(document.head || document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  } catch (e) {
    // No MutationObserver: url changes still re-read the title.
  }

  // The user's taps, for the timeline. Untrusted clicks are the agent's own.
  window.addEventListener(
    'click',
    e => {
      if (!e.isTrusted) return
      const target = (e.composedPath ? e.composedPath()[0] : e.target) as Element
      if (!target || target.nodeType !== 1 || isDebugUi(target)) return
      try {
        const summary = tapSummary(target)
        opts.onTap(summary, target)
        logRecord('action', { event: 'tap', target: summary, tag: tagOf(target) }, true)
      } catch (err) {
        // Timeline only.
      }
    },
    true
  )

  // Session log: what the user typed (masked fields never), submitted and
  // where they scrolled to.
  document.addEventListener(
    'change',
    e => {
      const el = e.target as Element
      if (!e.isTrusted || !el || el.nodeType !== 1 || isDebugUi(el)) return
      try {
        logRecord('action', { event: 'input', target: fieldName(el), value: fieldValue(el) }, true)
      } catch (err) {
        // Log only.
      }
    },
    true
  )
  document.addEventListener(
    'submit',
    e => {
      const form = e.target as Element
      if (!e.isTrusted || !form || form.nodeType !== 1) return
      try {
        logRecord('action', { event: 'submit', target: fieldName(form) }, true)
      } catch (err) {
        // Log only.
      }
    },
    true
  )
  const scrolls = new Map<EventTarget, ReturnType<typeof setTimeout>>()
  document.addEventListener(
    'scroll',
    e => {
      if (!e.isTrusted || !e.target) return
      const target = e.target
      const old = scrolls.get(target)
      if (old) clearTimeout(old)
      scrolls.set(
        target,
        setTimeout(() => {
          scrolls.delete(target)
          const el = target === document ? document.scrollingElement : (target as Element)
          if (!el || isDebugUi(el)) return
          logRecord('action', {
            event: 'scroll',
            target: target === document ? 'page' : tagOf(el),
            y: Math.round(el.scrollTop),
            x: Math.round(el.scrollLeft),
          })
        }, 600)
      )
    },
    true
  )

  return { check }
}
