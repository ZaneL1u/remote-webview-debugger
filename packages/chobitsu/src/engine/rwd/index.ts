// RWD agent engine: what the page SDK (sdk/) exposes to the gateway.
//
//   startObserving(emit)        console / errors / network collection, from load
//   callMethod(method, params)  the rwd.* RPC methods of docs/protocol.md §5, §6
//   setAgentLang / setUserLang  language of agent-facing / user-facing text (./i18n.ts)
//
// Importing this module installs chobitsu's console and network hooks.

export { setNetworkExclude, startObserving } from './observe'
export { currentSession, flushLog, logRecord, newId, startLog, stopLog } from './coldlog'
export type { LogKind } from './coldlog'
export type { EmitEvent, EventKind } from './observe'
export { callMethod, hasMethod, INTERACTIVE_METHODS } from './actions'
export type { ActionHooks, PointerKind } from './actions'
export { toRpcError, RwdError } from './errors'
export { agentText, getAgentLang, getUserLang, setAgentLang, setUserLang, toLang, userText } from './i18n'
export type { Lang } from './i18n'
export { describeForAgent } from './dom'
export { isMasked, isDebugUi, MASK } from '../privacy'
export { tagOf } from './dom'
export { closestComposed, scrub, setMaskRules } from '../privacy'
export { LEVELS, levelAllows, requiredLevel, setConfirmSelectors, toLevel } from './policy'
export type { Level } from './policy'
