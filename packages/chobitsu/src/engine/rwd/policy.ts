import { closestComposed, validSelectors } from '../privacy'
import { deepActiveElement, describeForAgent, tagOf } from './dom'
import { userText } from './i18n'

// Permission levels and sensitive-action confirmation (docs/protocol.md §6,
// §8). The gateway checks levels first; the page checks again.

export type Level = 'observe' | 'interact' | 'advanced'
export const LEVELS: Level[] = ['observe', 'interact', 'advanced']

const METHOD_LEVELS: { [method: string]: Level } = {
  'rwd.ping': 'observe',
  'rwd.snapshot': 'observe',
  'rwd.screenshot': 'observe',
  'rwd.console': 'observe',
  'rwd.network': 'observe',
  'rwd.waitFor': 'observe',
  'rwd.query': 'observe',
  'rwd.log': 'observe',
  'rwd.click': 'interact',
  'rwd.fill': 'interact',
  'rwd.type': 'interact',
  'rwd.press': 'interact',
  'rwd.select': 'interact',
  'rwd.hover': 'interact',
  'rwd.scroll': 'interact',
  'rwd.drag': 'interact',
  'rwd.navigate': 'interact',
  'rwd.back': 'interact',
  'rwd.reload': 'interact',
  'rwd.evaluate': 'advanced',
  'rwd.networkDetail': 'advanced',
  'rwd.storage': 'advanced',
  'rwd.logDetail': 'advanced',
}

/** Level a method needs; unknown methods need nothing (they fail as bad_request). */
export function requiredLevel(method: string): Level | null {
  return Object.prototype.hasOwnProperty.call(METHOD_LEVELS, method) ? METHOD_LEVELS[method] : null
}

/** A level string from the gateway; anything unknown is the most restrictive. */
export function toLevel(value: unknown): Level {
  return LEVELS.indexOf(value as Level) >= 0 ? (value as Level) : 'observe'
}

export function levelAllows(granted: Level, needed: Level) {
  return LEVELS.indexOf(granted) >= LEVELS.indexOf(needed)
}

export const CONFIRM_SELECTOR = '[data-rwd-confirm]'
let confirmSelector = CONFIRM_SELECTOR

/** Project policy `confirmSelectors`, on top of [data-rwd-confirm]. */
export function setConfirmSelectors(list: unknown) {
  confirmSelector = [CONFIRM_SELECTOR].concat(validSelectors(list)).join(', ')
}

/** The element (or the ancestor) that asks for confirmation, if any. */
export function confirmTarget(el: Element): Element | null {
  return closestComposed(el, confirmSelector)
}

function label(el: Element) {
  let name = describeForAgent(el).name
  if (!name) name = (el.textContent || '').replace(/\s+/g, ' ').trim()
  if (name.length > 30) name = name.slice(0, 30) + '…'
  return name ? userText().quote(name) : tagOf(el)
}

/**
 * 'click "Place order"' when clicking `el` needs the user's consent, else
 * null. In the user's language: the SDK shows it as "AI wants to …".
 */
export function clickConfirmation(el: Element): string | null {
  const target = confirmTarget(el)
  return target ? userText().click(label(target)) : null
}

/**
 * Pressing Enter in a form that holds (or is) a confirm element submits it:
 * 'press Enter to submit "Place order"'. Enter in a textarea or rich editor
 * only adds a line; Enter on a focused confirm button activates it.
 */
export function enterConfirmation(): string | null {
  const el = deepActiveElement()
  if (!el || el === document.body) return null
  const own = confirmTarget(el)
  if (own) return userText().enterActivate(label(own))
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return null
  const form = (el as HTMLInputElement).form || closestComposed(el, 'form')
  if (!form) return null
  const inside = confirmTarget(form) || form.querySelector(confirmSelector)
  return inside ? userText().enterSubmit(label(inside)) : null
}
