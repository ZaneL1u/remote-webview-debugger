// Text the page produces, for two audiences:
//
//   agent   RPC error messages and timeline event summaries: they go back to
//           the AI agent, in the language the gateway asks for
//           (welcome.agentLang).
//   user    what the phone user reads about an agent action (the
//           sensitive-action confirmation), in the page SDK's UI language.
//
// English lives here and is the default. The page SDK owns the other
// languages (sdk/src/locales/) and hands the engine the resolved text with
// setAgentText / setUserText.

/* ------------------------------ agent-facing ------------------------------ */

export const AGENT_EN = {
  missingParam: (name: string) => `Missing parameter: ${name}`,
  notString: (name: string) => `Parameter ${name} must be a string`,
  unknownMethod: (method: string) => `Unknown method: ${method}`,
  needLevel: (level: string) => `Requires the ${level} level`,
  takenOver: 'The user has taken over; wait until they hand control back',
  userDenied: 'The user denied this action',
  confirmBusy: 'Still waiting for the user to confirm the previous action',

  // keyboard
  unknownModifier: (m: string) => `Unknown modifier key: ${m}`,
  unknownKey: (key: string) => `Unknown key: ${key}`,

  // refs and queries
  refNotInSnapshot: (ref: string) => `ref=${ref} is not in the latest snapshot; take a new snapshot`,
  refDetached: (ref: string) => `The element of ref=${ref} is no longer on the page; take a new snapshot`,
  queryNeedsCriteria: 'At least one of text, role or name is required',
  noSuchRecord: (seq: string) => `No session log record seq=${seq} (it may have been cleaned up)`,
  noSuchSession: (id: string) => `No session log ${id} on this device (only the last 3 launches are kept)`,
  noSessionLog: 'No session log on this device yet (the project may have turned recording off, or the page passed run({ record: false }))',
  sessionLogUnavailable: 'IndexedDB is not available on this page: no session log',

  // editing and select
  readOnly: (tag: string) => `${tag} is read-only`,
  isSelect: (tag: string) => `${tag} is a dropdown; use rwd.select`,
  notFillable: (tag: string) => `${tag} is not a text field and cannot be filled`,
  notSelect: (tag: string) => `${tag} is not a dropdown (select); use click`,
  singleSelect: 'This dropdown allows only one option',
  noSuchOption: (value: string, choices: string[]) => `The dropdown has no option "${value}"; available: ${choices.join(', ')}`,
  optionDisabled: (value: string) => `Option "${value}" is disabled`,

  // navigation, waiting, evaluate
  badUrl: (url: string) => `Invalid URL: ${url}`,
  httpOnly: 'Only http(s) URLs can be opened',
  textAppearTimeout: (text: string) => `Timed out waiting for the text "${text}" to appear`,
  textGoneTimeout: (text: string) => `Timed out waiting for the text "${text}" to disappear`,
  badFunction: (message: string) => `Cannot parse function: ${message}`,
  notAFunction: 'function must be a function expression, e.g. "() => document.title"',

  // actionability
  elementDetached: (tag: string) => `Element ${tag} is no longer on the page; take a new snapshot`,
  notActionable: (tag: string, reason: string) => `Element ${tag} cannot be operated: ${reason}`,
  notVisible: (tag: string) => `Element ${tag} is not visible`,
  reasonMoving: 'its position keeps changing (it may be animating)',
  reasonOffscreen: 'it is outside the viewport',
  reasonObscured: (tag: string, ref: string) =>
    `the click point is covered by ${tag} (ref=${ref}; click it directly, e.g. a popup's backdrop to close the popup)`,

  // overlays listed after the snapshot
  overlayHeader: '[Overlays] These elements sit on top of the page. When a click is blocked, click them directly (e.g. the backdrop to close a popup):',
  overlayMask: (tag: string, coverage: number, ref: string) => `- backdrop ${tag}, covers ${coverage}% of the viewport [ref=${ref}]`,
  overlayLayer: (tag: string, text: string, coverage: number, ref: string) =>
    `- layer ${tag}${text ? ` "${text}"` : ''}, covers ${coverage}% of the viewport [ref=${ref}]`,
  reasonHidden: 'it is not visible',
  reasonDisabled: 'it is disabled',

  // storage
  storageUnavailable: (area: string) => `${area}Storage is not available`,
  badStorageArea: "Parameter area must be 'local', 'session' or 'cookie'",

  // network
  requestFailed: 'Request failed',
  noSuchRequest: (id: string) => `No request with id=${id} (it may have been dropped)`,
  netFailed: (what: string, error: string) => `${what} → failed (${error})`,
  wsFailed: (url: string) => `WebSocket ${url} → failed`,

  // timeline
  tapped: (role: string, text: string) => `Tapped ${role} "${text}"`,
  tappedTag: (role: string, tag: string) => `Tapped ${role} ${tag}`,
  roles: {
    button: 'button',
    link: 'link',
    textbox: 'text field',
    searchbox: 'search field',
    checkbox: 'checkbox',
    radio: 'radio button',
    switch: 'switch',
    combobox: 'dropdown',
    listbox: 'list',
    option: 'option',
    tab: 'tab',
    menuitem: 'menu item',
    img: 'image',
    heading: 'heading',
    cell: 'cell',
    row: 'row',
    listitem: 'list item',
  } as { [role: string]: string },
  element: 'element',

  // DevTools for people (docs/protocol.md §17): above the console history it replays
  devtoolsHistory: (count: number, dropped: number) =>
    `—— ${count} log entries from before DevTools opened (text only; objects cannot be expanded${dropped ? `; ${dropped} more were dropped` : ''}) ——`,
}

export type AgentText = typeof AGENT_EN

/* ------------------------------- user-facing ------------------------------ */

// What the agent is about to do, completing "AI wants to …" in the SDK's
// confirmation dialog (or a native host's, from status().pending.action).
export const USER_EN = {
  quote: (name: string) => `"${name}"`,
  click: (target: string) => `click ${target}`,
  enterActivate: (target: string) => `press Enter on ${target}`,
  enterSubmit: (target: string) => `press Enter to submit ${target}`,
}

export type UserText = typeof USER_EN

let agent: AgentText = AGENT_EN
let user: UserText = USER_EN

export function setAgentText(text: AgentText) {
  agent = text
}

export function setUserText(text: UserText) {
  user = text
}

/** Agent-facing text in the gateway's language. */
export function agentText(): AgentText {
  return agent
}

/** User-facing text in the SDK's UI language. */
export function userText(): UserText {
  return user
}
