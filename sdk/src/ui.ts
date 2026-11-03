import { read, write } from './ids'
import { htmlLang, type UiMessages } from './i18n'

// The SDK's on-page UI, all inside one shadow root whose host is
// `.__chobitsu-hide__` + aria-hidden and sits outside <body>: invisible to the
// agent's snapshot, DOM screenshots and hit testing. One visual language:
// dark glass, hairline borders, a single electric-blue accent, no gradients.
//
//   pill      idle: device code / help, translucent, draggable, snaps to the
//             edges; hidden while docked into eruda
//   bar       an agent is attached: bottom-center status, connected-for timer
//             + take over / hand back / end
//   task      top-center: the agent's task name, progress and planned steps
//   overlay   full-screen, transparent, swallows input in `observe` / `agent`
//   glow      breathing blue edge halo from the moment an agent attaches
//   cursor    the agent's pointer, on screen for the whole operating session
//   hl        brief outline around the element an agent action targets
//   dialog    approval / confirmation (attach request, sensitive action);
//             only trusted taps count, buttons arm after a short delay
//   panel     the Remote Debugger tab inside eruda (its own shadow root; opt-in)
//
// Pages restyle it with the --rwd-* custom properties (VARS below; they
// inherit into the shadow root from :root or #__rwd), run({ style }) which
// sets the same properties on #__rwd, or #__rwd::part(...) for the parts
// named in the markup (pill, window, bar, task, dialog, toast, button…).
// Text comes from the language packs (i18n.ts); rtl languages mirror the
// layout through :host([dir=rtl]).

export type ControlState = 'none' | 'observe' | 'agent' | 'user'
export type LinkView = 'connecting' | 'online' | 'offline'
export type CursorKind = 'click' | 'hover' | 'focus' | 'select' | 'scroll' | 'drag' | 'drop'

/** What the attached agent says it is doing (docs/protocol.md §14.3, set_task). */
export interface AgentTask {
  title: string
  steps: string[]
  current: number
  agent?: string
}

export const BRAND = 'Remote Debugger'

export interface UiOptions {
  helpButton: boolean
  /** Lock the page while an agent is attached, unless the user turned it off. */
  lockScreen: boolean
  /** auto: follow the page's background; system: prefers-color-scheme. */
  theme?: 'auto' | 'system' | 'light' | 'dark'
  /** Language of all of our text (a language pack id) and its direction. */
  lang: string
  dir: 'ltr' | 'rtl'
  text: UiMessages
  style?: StyleOptions
  onHelp(on: boolean): void
  onControl(action: 'takeover' | 'handback' | 'end'): void
  /** The user changed a setting in our window (auto-approve, lock). */
  onSettings(): void
}

/**
 * run({ style }): each field sets one --rwd-* custom property on #__rwd (see
 * VARS). Colors take any CSS color; lengths a number of px or a CSS length.
 */
export interface StyleOptions {
  /** --rwd-accent-rgb: buttons, switches, the agent's pointer and the edge glow. */
  accent?: string
  /** --rwd-danger-rgb: the End button. */
  danger?: string
  /** --rwd-warning-rgb: help, the user-in-control state. */
  warning?: string
  /** --rwd-success-rgb: online dot, copied. */
  success?: string
  /** --rwd-font */
  font?: string
  /** --rwd-font-mono: device code, tags. */
  monoFont?: string
  /** --rwd-radius: floating window (dialog +2px, task card −2px, smaller parts follow). */
  radius?: number | string
  /** --rwd-button-radius: pill-shaped buttons and toasts. */
  buttonRadius?: number | string
  /** --rwd-z-index of the whole UI (default 2147483647). */
  zIndex?: number
  /** --rwd-bar-bottom: bottom bar distance from the bottom safe area (default 14px). */
  barBottom?: number | string
  /** --rwd-task-top: task card distance from the top safe area (default 10px). */
  taskTop?: number | string
  /** --rwd-toast-bottom: toast distance from the bottom safe area (default 84px). */
  toastBottom?: number | string
  /** Where the idle pill starts until the user drags it: the screen edge and the height (0 top … 1 bottom). */
  pill?: { side?: 'left' | 'right'; top?: number }
}

export type AutoLevel = 'observe' | 'interact' | 'advanced'

export interface DialogSpec {
  title: string
  text: string
  hint?: string
  choices?: { value: string; label: string }[]
  /** Preselected choice. */
  choice?: string
  okText: string
  cancelText: string
  /** Auto-deny deadline shown as a countdown; none for a plain question. */
  expiresAt?: number
  /** ok: allowed (with the chosen value), or denied. */
  onDecide(ok: boolean, choice?: string): void
}

export interface DialogHandle {
  close(): void
}

const POS_KEY = 'rwd:pill'
const CURSOR_KEY = 'rwd:cursor'
const TASK_KEY = 'rwd:task-min'
const AUTO_KEY = 'rwd:auto'
const LOCK_KEY = 'rwd:lock'
const EDGE = 8
// A tap that started before the dialog appeared must not answer it.
const ARM_MS = 400
const FONT = `-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif`
const MONO = `ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace`

// The public custom properties and their defaults, mapped onto the names the
// stylesheets use. Colors are r, g, b triplets so translucent shades follow.
const VARS = `
  --accent-rgb: var(--rwd-accent-rgb, 59, 130, 246); --accent: rgb(var(--accent-rgb));
  --danger-rgb: var(--rwd-danger-rgb, 239, 68, 68);
  --warning-rgb: var(--rwd-warning-rgb, 245, 158, 11);
  --success-rgb: var(--rwd-success-rgb, 34, 197, 94);
  --font: var(--rwd-font, ${FONT}); --mono: var(--rwd-font-mono, ${MONO});
  --radius: var(--rwd-radius, 18px); --button-radius: var(--rwd-button-radius, 999px);
`

// Han characters take their shapes from the first CJK font that has them: one
// per language, so Japanese and Traditional Chinese don't render in a
// Simplified Chinese font.
const CJK_FONTS = `
:host(:lang(zh-TW)) { --font: var(--rwd-font, -apple-system, BlinkMacSystemFont, "PingFang TC", "Helvetica Neue", "Microsoft JhengHei", sans-serif); }
:host(:lang(ja)) { --font: var(--rwd-font, -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Helvetica Neue", "Yu Gothic UI", Meiryo, sans-serif); }
:host(:lang(ko)) { --font: var(--rwd-font, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Helvetica Neue", "Malgun Gothic", sans-serif); }
`

// The agent's pointer: a rounded navigation arrow, black with a white rim,
// tip at (0, 0).
const ARROW = `<svg class="arrow" viewBox="0 0 26 26" aria-hidden="true">
<path d="M3.2 1.6 L23.4 9.4 Q24.8 10 23.4 10.7 L14.6 14.6 L10.7 23.4 Q10 24.8 9.4 23.4 L1.6 3.2 Q1.1 1.1 3.2 1.6 Z"
 fill="#0b0d12" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
</svg>`

const COPY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 10.5V4a1.5 1.5 0 0 1 1.5-1.5h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`

const CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.4 6.8 11 12 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const CSS = `
:host {
  all: initial;${VARS}
  --ink: 255, 255, 255; --paper: 12, 14, 20; --fg: #fff; --solid-bg: #fff; --solid-fg: #0b0d12; --track: rgba(var(--ink), .2);
}
${CJK_FONTS}
/* Light pages get light glass (data-theme is set from the page, see Ui.theme). */
:host([data-theme=light]) {
  --ink: 11, 13, 18; --paper: 255, 255, 255; --fg: #0b0d12; --solid-bg: #0b0d12; --solid-fg: #fff; --track: rgba(11, 13, 18, .16);
}
* { box-sizing: border-box; }
.glass {
  background: rgba(var(--paper), .9); color: var(--fg);
  border: 1px solid rgba(var(--ink), .1);
  box-shadow: 0 12px 32px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(var(--ink), .06);
  -webkit-backdrop-filter: blur(18px) saturate(1.5); backdrop-filter: blur(18px) saturate(1.5);
}
.win.glass, .dlg.glass, .task.glass { background: rgba(var(--paper), .96); }
.pill, .bar, .btn { font: 500 12px/16px var(--font); }

/* idle floating window: a translucent pill that expands into a card */
.pill {
  position: fixed; z-index: 3; top: 0; left: 0;
  display: flex; align-items: center; gap: 8px;
  max-width: calc(100vw - ${EDGE * 2}px); padding: 7px 12px 7px 8px; border-radius: 999px; white-space: nowrap;
  background: rgba(var(--paper), .55); color: var(--fg); border: 1px solid rgba(var(--ink), .14);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .18);
  -webkit-backdrop-filter: blur(16px) saturate(1.6); backdrop-filter: blur(16px) saturate(1.6);
  pointer-events: auto; touch-action: none; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  transition: opacity .22s ease, transform .22s cubic-bezier(.2, .9, .2, 1), background .2s ease;
}
.pill:active { transform: scale(.97); }
.pill.open { background: rgba(var(--paper), .85); }
.pill.hidden { opacity: 0; transform: scale(.9); pointer-events: none; visibility: hidden; transition: opacity .22s ease, transform .22s ease, visibility 0s linear .22s; }
.pill.snap { transition: left .22s cubic-bezier(.2, .9, .2, 1), top .22s cubic-bezier(.2, .9, .2, 1), opacity .22s ease, transform .22s ease; }
.logo { position: relative; flex: none; width: 18px; height: 18px; border-radius: 6px; background: #0b0d12; box-shadow: inset 0 0 0 1px rgba(var(--ink), .18); }
.logo .dot { position: absolute; left: 5px; top: 5px; }
.brand { font-weight: 650; letter-spacing: .2px; }
.win {
  position: fixed; z-index: 3; width: min(calc(100vw - ${EDGE * 2}px), 300px); padding: 14px; border-radius: var(--radius);
  font: 13px/18px var(--font); pointer-events: auto;
  opacity: 0; visibility: hidden; transform: scale(.92) translateY(6px);
  transition: opacity .2s ease, transform .24s cubic-bezier(.2, .9, .2, 1), visibility 0s linear .24s;
}
.win.open { opacity: 1; visibility: visible; transform: none; transition: opacity .2s ease, transform .24s cubic-bezier(.2, .9, .2, 1); }
.win .head { display: flex; align-items: center; gap: 8px; }
.win .name { font-weight: 700; font-size: 14px; }
.win .link { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(var(--ink), .6); }
.win .k { margin-top: 14px; font: 600 10px/14px var(--mono); letter-spacing: 1px; text-transform: uppercase; color: rgba(var(--ink), .45); }
.win .codebox { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.win .big { font: 700 24px/30px var(--mono); letter-spacing: 1.5px; }
.win .note { margin-top: 10px; font-size: 12px; line-height: 17px; color: rgba(var(--ink), .55); }
.win .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
/* Equal halves; a label too long for half the card gets its own row. */
.win .row .btn { flex: 1 0 0; min-width: max-content; text-align: center; white-space: nowrap; }
.code { font: 500 12px/16px var(--mono); letter-spacing: .5px; color: rgba(var(--ink), .7); }
.pill { border-radius: calc(var(--radius) - 2px); padding: 7px 12px 7px 9px; gap: 9px; }
.pill .lines { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.pill .brand { font-size: 12px; line-height: 16px; cursor: pointer; }
.pill .copy, .pill .logo { cursor: pointer; }
.pill .copy {
  display: inline-flex; align-items: center; gap: 5px; margin: 0 -4px; padding: 1px 4px; border-radius: 6px;
  font: 600 12px/16px var(--mono); letter-spacing: .6px; color: rgba(var(--ink), .78); transition: background .15s ease, color .15s ease;
}
.pill .copy:active { background: rgba(var(--ink), .14); }
.pill .copy svg { width: 12px; height: 12px; opacity: .7; }
.pill .copy.done { color: rgb(var(--success-rgb)); }
.win .opts { margin-top: 12px; border-radius: calc(var(--radius) - 8px); background: rgba(var(--ink), .05); box-shadow: inset 0 0 0 1px rgba(var(--ink), .08); }
.win .opt { display: flex; align-items: center; gap: 10px; padding: 8px 10px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.win .opt + .opt { border-top: 1px solid rgba(var(--ink), .08); }
.win .opt .t { flex: 1; min-width: 0; font-size: 12px; line-height: 16px; font-weight: 600; }
.win .opt small { display: block; margin-top: 1px; font-size: 10.5px; line-height: 14px; font-weight: 400; color: rgba(var(--ink), .5); }
.sw { position: relative; flex: none; width: 30px; height: 18px; border-radius: 999px; background: var(--track); transition: background .2s ease; }
.sw::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .22s cubic-bezier(.2, .9, .2, 1);
}
.sw.on { background: var(--accent); }
.sw.on::after { transform: translateX(12px); }
.toast {
  position: fixed; z-index: 4; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + var(--rwd-toast-bottom, 84px));
  max-width: calc(100vw - 32px); padding: 10px 16px; border-radius: var(--button-radius); font: 600 13px/18px var(--font);
  pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  animation: rwd-toast 3.2s cubic-bezier(.2, .9, .2, 1) both;
}
@keyframes rwd-toast {
  0% { opacity: 0; transform: translate(-50%, 12px) scale(.96); }
  8%, 88% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 6px); }
}

.dot { position: relative; flex: none; width: 8px; height: 8px; border-radius: 50%; background: #6b7280; }
.online .dot { background: rgb(var(--success-rgb)); }
.observe .dot { background: var(--accent); }
.agent .dot { background: var(--accent); }
.observe .dot::after, .agent .dot::after, .task .now .mark::after {
  content: ""; position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid var(--accent); animation: rwd-ping 1.4s cubic-bezier(.2, .6, .3, 1) infinite;
}
.user .dot { background: rgb(var(--warning-rgb)); }

.btn {
  flex: none; margin: 0; padding: 7px 14px; border: 0; border-radius: var(--button-radius);
  font-weight: 600; letter-spacing: .2px; cursor: pointer; pointer-events: auto;
  -webkit-tap-highlight-color: transparent; transition: transform .12s ease, background .15s ease;
}
.btn:active { transform: scale(.96); }
.btn.light { background: var(--solid-bg); color: var(--solid-fg); }
.btn.accent { background: var(--accent); color: #fff; }
.btn.ghost { background: rgba(var(--ink), .08); color: rgba(var(--ink), .9); box-shadow: inset 0 0 0 1px rgba(var(--ink), .14); }
.btn.stop { background: rgb(var(--danger-rgb)); color: #fff; box-shadow: 0 6px 16px rgba(var(--danger-rgb), .35); }
.btn.help { background: rgb(var(--warning-rgb)); color: #0b0d12; padding: 4px 10px; }
.btn.help.on { background: rgba(var(--warning-rgb), .18); color: #fcd34d; }

/* bottom bar while an agent is attached */
.bar {
  position: fixed; z-index: 3; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--rwd-bar-bottom, 14px));
  display: flex; align-items: center; gap: 12px; padding: 7px 7px 7px 18px; border-radius: var(--button-radius);
  white-space: nowrap; pointer-events: none; max-width: calc(100vw - 24px);
  user-select: none; -webkit-user-select: none;
  opacity: 0; visibility: hidden; transform: translate(-50%, 18px) scale(.96);
  transition: opacity .22s ease, transform .3s cubic-bezier(.2, .9, .2, 1), visibility 0s linear .3s;
}
.observe .bar, .agent .bar, .user .bar {
  pointer-events: auto; opacity: 1; visibility: visible; transform: translateX(-50%);
  transition: opacity .22s ease, transform .3s cubic-bezier(.2, .9, .2, 1);
}
.bar .status { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 14px; font-weight: 650; letter-spacing: .3px; }
.bar .text { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.bar .head { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.bar .since { overflow: hidden; text-overflow: ellipsis; font-size: 12px; line-height: 16px; font-weight: 500; font-variant-numeric: tabular-nums; color: rgba(var(--ink), .55); }
/* The label stays whole (the agent's name gives way); when it can't fit next to
   the buttons (a long language, a narrow phone) the buttons move below it. */
.bar .label { flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.bar.stack { flex-wrap: wrap; justify-content: center; row-gap: 8px; width: calc(100vw - 24px); padding: 10px 7px 7px; border-radius: min(var(--button-radius), 26px); }
.bar.stack .status { flex: 1 0 100%; justify-content: center; }
.bar.stack .acts { flex: 1 0 100%; }
.bar.stack .acts .btn { flex: 1; }
.bar .who { color: rgba(var(--ink), .5); font-weight: 500; overflow: hidden; text-overflow: ellipsis; max-width: 96px; }
.bar .acts { display: flex; gap: 8px; }
.bar .btn { min-width: 78px; min-height: 46px; padding: 12px 22px; font-size: 15px; line-height: 20px; font-weight: 700; text-align: center; }

/* task card */
.task {
  position: fixed; z-index: 3; left: 50%; transform: translateX(-50%);
  top: calc(env(safe-area-inset-top, 0px) + var(--rwd-task-top, 10px));
  width: min(calc(100vw - 24px), 380px); padding: 12px 14px 12px; border-radius: calc(var(--radius) - 2px);
  pointer-events: none; cursor: pointer; font: 13px/18px var(--font);
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  opacity: 0; visibility: hidden; transform: translate(-50%, -14px) scale(.97);
  transition: opacity .22s ease, transform .3s cubic-bezier(.2, .9, .2, 1), visibility 0s linear .3s;
}
.task.on {
  pointer-events: auto; opacity: 1; visibility: visible; transform: translateX(-50%);
  transition: opacity .22s ease, transform .3s cubic-bezier(.2, .9, .2, 1);
}
.task li { transition: color .25s ease; }
.task .mark { transition: background .25s ease, box-shadow .25s ease; }
.task .top { display: flex; align-items: center; gap: 8px; }
.task .tag {
  flex: none; padding: 2px 6px; border-radius: 5px; font: 600 10px/14px var(--mono); letter-spacing: 1px;
  color: var(--accent); background: rgba(var(--accent-rgb), .14); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .35);
}
.task .agent { flex: 1; min-width: 0; color: rgba(var(--ink), .5); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task .count { flex: none; font: 600 12px/16px var(--mono); color: rgba(var(--ink), .6); }
.task .title { margin-top: 8px; font-size: 16px; line-height: 22px; font-weight: 700; letter-spacing: .2px; }
.task .track { margin-top: 8px; height: 3px; border-radius: 3px; background: rgba(var(--ink), .1); overflow: hidden; }
.task .fill { height: 100%; width: 0; background: var(--accent); box-shadow: 0 0 8px var(--accent); transition: width .35s cubic-bezier(.2, .9, .2, 1); }
.task ol {
  list-style: none; margin: 10px -6px 0 0; padding: 0 6px 0 0;
  max-height: min(26vh, 134px); overflow-y: auto; overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch; touch-action: pan-y; scrollbar-width: thin;
}
.task ol.more { -webkit-mask-image: linear-gradient(#000 82%, transparent); mask-image: linear-gradient(#000 82%, transparent); }
.task ol.more.end { -webkit-mask-image: none; mask-image: none; }
.task li { display: flex; align-items: flex-start; gap: 10px; padding: 4px 0; color: rgba(var(--ink), .42); }
.task .mark {
  position: relative; flex: none; width: 16px; height: 16px; margin-top: 1px; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px rgba(var(--ink), .25);
}
.task .done { color: rgba(var(--ink), .62); }
.task .done .mark { background: var(--accent); box-shadow: none; color: #fff; }
.task .done .mark svg { width: 16px; height: 16px; display: block; }
.task .now { color: var(--fg); font-weight: 600; }
.task .now .mark { box-shadow: inset 0 0 0 2px var(--accent); }
.task .now .mark::before { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: var(--accent); }
.task.min ol { display: none; }
.task.min .title { font-size: 14px; line-height: 20px; }

.overlay {
  position: fixed; z-index: 1; top: 0; right: 0; bottom: 0; left: 0;
  display: none; background: transparent; pointer-events: auto; touch-action: none;
}
.glow { position: fixed; z-index: 2; pointer-events: none; display: none; top: 0; right: 0; bottom: 0; left: 0; }
.observe.locked .overlay, .agent.locked .overlay { display: block; }
/* From the moment an agent attaches: a strong, wide breathing halo, so the
   user sees at a glance that the AI is connected and their input is paused. */
.observe .glow, .agent .glow {
  display: block;
  box-shadow:
    inset 0 0 0 5px rgba(var(--accent-rgb), .95),
    inset 0 0 36px 14px rgba(var(--accent-rgb), .8),
    inset 0 0 140px 56px rgba(var(--accent-rgb), .42);
  animation: rwd-glow 1.9s ease-in-out infinite;
}
.user .glow { display: block; box-shadow: inset 0 0 0 3px rgba(var(--warning-rgb), .9), inset 0 0 18px 4px rgba(var(--warning-rgb), .3); }

.cursor {
  position: fixed; z-index: 3; top: 0; left: 0; width: 0; height: 0;
  pointer-events: none; opacity: 0; will-change: transform; transition: opacity .2s ease;
}
.cursor.on { opacity: 1; }
.cursor .arrow {
  position: absolute; left: -2px; top: -2px; width: 26px; height: 26px; overflow: visible;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .35)) drop-shadow(0 0 12px rgba(var(--accent-rgb), .45));
  transform-origin: 2px 2px; transition: transform .09s ease-out;
}
.cursor.press .arrow { transform: scale(.82); }
.ripple {
  position: fixed; z-index: 3; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%;
  border: 2px solid var(--accent); background: rgba(var(--accent-rgb), .16); pointer-events: none;
  animation: rwd-ripple .45s cubic-bezier(.2, .7, .3, 1) forwards;
}
.hl {
  position: fixed; z-index: 2; pointer-events: none; border-radius: 6px;
  outline: 2px solid rgba(var(--accent-rgb), .9); outline-offset: 2px; background: rgba(var(--accent-rgb), .08);
  transition: opacity .25s ease;
}

.scrim {
  position: fixed; z-index: 4; top: 0; right: 0; bottom: 0; left: 0;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(4, 6, 10, .46); pointer-events: auto; touch-action: none;
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  animation: rwd-fade .2s ease both;
}
.scrim.out { animation: rwd-fade-out .18s ease both; pointer-events: none; }
.dlg {
  width: 100%; max-width: 330px; padding: 18px 16px 14px; border-radius: calc(var(--radius) + 2px);
  font: 14px/20px var(--font); user-select: none; -webkit-user-select: none;
  animation: rwd-pop .26s cubic-bezier(.2, .9, .2, 1) both;
}
.scrim.out .dlg { animation: rwd-pop-out .18s ease both; }
.dlg .tag {
  display: inline-block; padding: 2px 6px; border-radius: 5px; font: 600 10px/14px var(--mono); letter-spacing: 1px;
  color: var(--accent); background: rgba(var(--accent-rgb), .14); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .35);
}
.dlg h3 { margin: 10px 0 6px; font-size: 17px; line-height: 24px; font-weight: 700; }
.dlg p { margin: 0; word-break: break-word; color: rgba(var(--ink), .78); }
.dlg .hint, .dlg .count { margin-top: 6px; color: rgba(var(--ink), .45); font-size: 12px; line-height: 16px; }
.choices { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.dlg button {
  margin: 0; font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: transform .12s ease, background .15s ease, box-shadow .15s ease, opacity .15s ease;
}
.dlg button:active { transform: scale(.97); }
.choice {
  padding: 10px 12px; border: 0; border-radius: calc(var(--radius) - 6px); text-align: left; color: rgba(var(--ink), .85);
  background: rgba(var(--ink), .06); box-shadow: inset 0 0 0 1px rgba(var(--ink), .12);
}
.choice.on { color: var(--fg); background: rgba(var(--accent-rgb), .16); box-shadow: inset 0 0 0 1.5px var(--accent); }
.dlg .acts { display: flex; gap: 8px; margin-top: 16px; }
.dlg .acts button { flex: 1; padding: 11px; border: 0; border-radius: calc(var(--radius) - 6px); font-weight: 650; }
.dlg .acts .deny { background: rgba(var(--ink), .08); color: rgba(var(--ink), .9); box-shadow: inset 0 0 0 1px rgba(var(--ink), .14); }
.dlg .acts .allow { background: var(--accent); color: #fff; box-shadow: 0 6px 18px rgba(var(--accent-rgb), .4); }
.dlg button[disabled] { opacity: .45; }

@keyframes rwd-ping { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(1.9); opacity: 0; } }
@keyframes rwd-glow { 0%, 100% { opacity: .22; } 50% { opacity: 1; } }
@keyframes rwd-ripple { from { transform: scale(.25); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
@keyframes rwd-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rwd-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes rwd-pop { from { opacity: 0; transform: translateY(10px) scale(.94); } to { opacity: 1; transform: none; } }
@keyframes rwd-pop-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(6px) scale(.97); } }
/* Right-to-left languages: mirror what is not symmetric. The pill and the
   window stay where the user put them (they are placed in JS). */
:host([dir=rtl]) .pill { padding: 7px 9px 7px 12px; }
:host([dir=rtl]) .win .link { margin-left: 0; margin-right: auto; }
:host([dir=rtl]) .bar { padding: 7px 18px 7px 7px; }
:host([dir=rtl]) .task ol { margin: 10px 0 0 -6px; padding: 0 0 0 6px; }
:host([dir=rtl]) .choice { text-align: right; }
:host([dir=rtl]) .sw::after { left: auto; right: 2px; }
:host([dir=rtl]) .sw.on::after { transform: translateX(-12px); }
/* Arabic script joins its letters: no letter spacing, and no monospace font for the label. */
:host([dir=rtl]) .win .k { font-family: var(--font); letter-spacing: 0; }
:host([dir=rtl]) .btn, :host([dir=rtl]) .bar .status { letter-spacing: 0; }
/* Device codes read left to right in any language. */
.ltr { direction: ltr; unicode-bidi: isolate; }

@media (prefers-reduced-motion: reduce) {
  .observe .glow, .agent .glow, .observe .dot::after, .agent .dot::after, .task .now .mark::after { animation: none; }
  .observe .glow, .agent .glow { opacity: .9; }
  .pill, .pill.snap, .hl, .win, .bar, .task, .scrim, .dlg { transition: none !important; animation: none !important; }
}
`

// The eruda tab. Colors follow eruda's light / dark theme through currentColor.
const PANEL_CSS = `
:host { all: initial; display: block; color: inherit;${VARS}}
* { box-sizing: border-box; }
.panel { padding: 14px; font: 13px/18px var(--font); color: inherit; }
.head { display: flex; align-items: center; gap: 8px; }
.logo { position: relative; width: 22px; height: 22px; border-radius: 6px; flex: none; background: #0b0d12; }
.logo::after { content: ""; position: absolute; inset: 7px; border-radius: 50%; background: var(--accent); }
.name { font-weight: 600; font-size: 14px; }
.status { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; opacity: .8; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #8e8e93; }
.online .dot { background: rgb(var(--success-rgb)); }
.observe .dot, .agent .dot { background: var(--accent); }
.user .dot { background: rgb(var(--warning-rgb)); }
.card { margin-top: 12px; padding: 12px; border-radius: 10px;
  border: 1px solid rgba(127, 127, 127, .25); background: rgba(127, 127, 127, .08); }
.k { font-size: 12px; opacity: .65; }
.code { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.code b { font: 600 22px/28px var(--mono); letter-spacing: 1px; }
.state { margin-top: 10px; font-size: 13px; }
.hint { margin-top: 8px; font-size: 12px; opacity: .65; }
.acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
button { margin: 0; padding: 7px 14px; border: 0; border-radius: 8px; font: 600 13px/18px var(--font);
  cursor: pointer; -webkit-tap-highlight-color: transparent; }
.primary { background: var(--accent); color: #fff; }
.ghost { background: rgba(127, 127, 127, .16); color: inherit; }
.warn { background: rgb(var(--warning-rgb)); color: #0b0d12; }
.small { padding: 4px 10px; font-size: 12px; }
${CJK_FONTS}
:host([dir=rtl]) .status { margin-left: 0; margin-right: auto; }
.ltr { direction: ltr; unicode-bidi: isolate; }
`

export class Ui {
  readonly host: HTMLElement
  /** Our text, in the user's language. */
  t: UiMessages
  private root: ShadowRoot | HTMLElement
  private frame: HTMLElement
  private pill: HTMLElement
  private win: HTMLElement
  private winOpen = false
  private bar: HTMLElement
  private taskEl: HTMLElement
  private cursor: HTMLElement
  private cursorAt: { x: number; y: number } | null = null
  private panel: HTMLElement | null = null
  private control: ControlState = 'none'
  /** When the agent attached (local clock); null: none attached. */
  private since: number | null = null
  private sinceEl: HTMLElement | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  private link: LinkView = 'connecting'
  private code = ''
  private help = false
  private agent = 'AI'
  private task: AgentTask | null = null
  private taskKey = ''
  private taskPct = 0
  private dragged = false
  private onClickBound = (e: Event) => this.onClick(e)
  private dialogs: HTMLElement[] = []

  constructor(private opts: UiOptions) {
    this.t = opts.text
    const host = document.createElement('div')
    host.id = '__rwd'
    host.className = '__chobitsu-hide__'
    host.setAttribute('aria-hidden', 'true')
    host.setAttribute('lang', htmlLang(opts.lang))
    host.setAttribute('dir', opts.dir)
    host.style.cssText =
      'all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:var(--rwd-z-index,2147483647);pointer-events:none;'
    applyStyle(host, opts.style)
    this.host = host
    this.root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host

    const style = document.createElement('style')
    style.textContent = CSS
    this.frame = document.createElement('div')
    this.frame.innerHTML =
      '<div class="overlay" part="overlay"></div><div class="glow" part="glow"></div>' +
      '<div class="pill" part="pill" data-action="toggle" role="status"></div><div class="win glass" part="window" role="dialog"></div>' +
      '<div class="bar glass" part="bar" role="status"></div>' +
      '<div class="task glass" part="task" data-action="task" role="status"></div>' +
      `<div class="cursor" part="cursor">${ARROW}</div>`
    this.pill = this.frame.querySelector('.pill') as HTMLElement
    this.win = this.frame.querySelector('.win') as HTMLElement
    this.bar = this.frame.querySelector('.bar') as HTMLElement
    this.taskEl = this.frame.querySelector('.task') as HTMLElement
    this.cursor = this.frame.querySelector('.cursor') as HTMLElement
    this.root.appendChild(style)
    this.root.appendChild(this.frame)

    this.root.addEventListener('click', e => this.onClick(e))
    // The page's colors settle after load; the system theme can change.
    window.addEventListener('load', () => this.render())
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.render())
    } catch (e) {
      // Old WebView.
    }
    // iOS only turns a tap on a non-control element into a click when the
    // element itself listens for it.
    this.taskEl.addEventListener('click', e => this.onClick(e))
    this.pill.addEventListener('click', e => this.onClick(e))
    this.bindDrag()
    window.addEventListener('resize', () => this.place())
    this.render()
  }

  /** Switch language: the next render uses the new text and direction. */
  setText(text: UiMessages, lang: string, dir: 'ltr' | 'rtl') {
    this.t = text
    this.opts.lang = lang
    this.opts.dir = dir
    this.host.setAttribute('lang', htmlLang(lang))
    this.host.setAttribute('dir', dir)
    if (this.panel) {
      const host = (this.panel.getRootNode() as ShadowRoot).host
      if (host) {
        host.setAttribute('lang', htmlLang(lang))
        host.setAttribute('dir', dir)
      }
    }
    this.render()
  }

  mount() {
    // Outside <body>: the snapshot walks <body> only. Available before <body>
    // exists, so the lock shows without a gap on navigation.
    if (!this.host.isConnected) document.documentElement.appendChild(this.host)
    this.place()
  }

  unmount() {
    this.host.remove()
    this.setTicker(false)
  }

  /** Whether an event belongs to our own controls (they must keep working under the lock). */
  isOwnControl(e: Event) {
    const path = e.composedPath ? e.composedPath() : []
    for (const el of [this.pill, this.win, this.bar, this.taskEl, this.panel]) {
      if (el && path.indexOf(el) >= 0) return true
    }
    for (const d of this.dialogs) if (path.indexOf(d) >= 0) return true
    return false
  }

  /** The level the user lets agents attach with automatically, or null (ask every time). */
  autoLevel(): AutoLevel | null {
    const v = read('localStorage', AUTO_KEY)
    return v === 'observe' || v === 'interact' || v === 'advanced' ? v : null
  }

  /** Whether the page locks while the agent operates. */
  lockScreen(): boolean {
    const v = read('localStorage', LOCK_KEY)
    return v === null ? this.opts.lockScreen : v === '1'
  }

  /** Light or dark glass, matching the page by default. */
  theme(): 'light' | 'dark' {
    const t = this.opts.theme || 'auto'
    if (t === 'light' || t === 'dark') return t
    const system = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
    return t === 'system' ? system : pageTheme() || 'light'
  }

  /** A short note above the bottom bar. */
  toast(text: string) {
    const t = document.createElement('div')
    t.className = 'toast glass'
    t.setAttribute('part', 'toast')
    t.textContent = text
    this.frame.appendChild(t)
    setTimeout(() => t.remove(), 3300)
  }

  setHelpButton(on: boolean) {
    if (this.opts.helpButton === on) return
    this.opts.helpButton = on
    this.render()
  }

  /**
   * Render the Remote Debugger tab into `container` (eruda's tool element). While
   * docked, the idle pill is hidden; the bottom bar still shows whenever an
   * agent is attached, so the user can always take over or end.
   */
  dock(container: HTMLElement) {
    const host = document.createElement('div')
    host.className = '__chobitsu-hide__'
    host.setAttribute('lang', htmlLang(this.opts.lang))
    host.setAttribute('dir', this.opts.dir)
    applyStyle(host, this.opts.style)
    const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host
    const style = document.createElement('style')
    style.textContent = PANEL_CSS
    const panel = document.createElement('div')
    panel.className = 'panel'
    root.appendChild(style)
    root.appendChild(panel)
    root.addEventListener('click', e => this.onClick(e))
    container.appendChild(host)
    this.panel = panel
    this.render()
  }

  undock() {
    if (this.panel) {
      const host = (this.panel.getRootNode() as ShadowRoot).host || this.panel
      if (host.parentNode) host.parentNode.removeChild(host)
    }
    this.panel = null
    this.render()
  }

  /** A modal question; the caller enforces the deadline and closes it. */
  dialog(spec: DialogSpec): DialogHandle {
    const scrim = document.createElement('div')
    scrim.className = 'scrim'
    const box = document.createElement('div')
    box.className = 'dlg glass'
    box.setAttribute('role', 'dialog')
    box.setAttribute('part', 'dialog')
    scrim.appendChild(box)
    const el = (tag: string, cls: string, text: string, parent: HTMLElement = box) => {
      const node = document.createElement(tag)
      if (cls) node.className = cls
      node.textContent = text
      parent.appendChild(node)
      return node
    }
    el('span', 'tag', BRAND.toUpperCase())
    el('h3', '', spec.title)
    el('p', '', spec.text)
    if (spec.hint) el('p', 'hint', spec.hint)
    let choice = spec.choice
    const choiceButtons: HTMLElement[] = []
    if (spec.choices && spec.choices.length) {
      const list = el('div', 'choices', '')
      for (const c of spec.choices) {
        const b = el('button', 'choice', c.label, list) as HTMLButtonElement
        b.type = 'button'
        b.setAttribute('data-choice', c.value)
        choiceButtons.push(b)
      }
    }
    const count = el('p', 'count', '')
    const acts = el('div', 'acts', '')
    const deny = el('button', 'deny', spec.cancelText, acts) as HTMLButtonElement
    const allow = el('button', 'allow', spec.okText, acts) as HTMLButtonElement
    const buttons = [deny, allow].concat(choiceButtons as HTMLButtonElement[])
    for (const b of buttons) {
      b.type = 'button'
      b.setAttribute('part', 'button')
      b.disabled = true
    }
    const paint = () => {
      for (const b of choiceButtons) b.className = b.getAttribute('data-choice') === choice ? 'choice on' : 'choice'
      if (spec.expiresAt === undefined) return
      const left = Math.max(0, Math.ceil((spec.expiresAt - Date.now()) / 1000))
      count.textContent = this.t.countdown(left)
    }
    paint()
    const ticker = setInterval(paint, 1000)
    if (spec.expiresAt === undefined) count.remove()
    const arm = setTimeout(() => {
      for (const b of buttons) b.disabled = false
    }, ARM_MS)

    let open = true
    const close = () => {
      if (!open) return
      open = false
      clearInterval(ticker)
      clearTimeout(arm)
      const i = this.dialogs.indexOf(scrim)
      if (i >= 0) this.dialogs.splice(i, 1)
      scrim.classList.add('out')
      setTimeout(() => scrim.remove(), 190)
    }
    scrim.addEventListener('click', e => {
      e.stopPropagation()
      // Only real taps: the agent's synthesized clicks (and page scripts'
      // element.click()) are untrusted.
      if (!e.isTrusted || !open) return
      const target = e.target as Element
      const b = target && target.closest ? (target.closest('button') as HTMLButtonElement | null) : null
      if (!b || b.disabled) return
      if (b.hasAttribute('data-choice')) {
        choice = b.getAttribute('data-choice') || undefined
        paint()
        return
      }
      close()
      spec.onDecide(b === allow, choice)
    })
    this.dialogs.push(scrim)
    this.frame.appendChild(scrim)
    return { close }
  }

  setLink(link: LinkView, code?: string) {
    this.link = link
    if (code) this.code = code
    this.render()
  }

  setControl(state: ControlState, agent?: string, since?: number | null) {
    if (agent) this.agent = agent
    this.control = state
    this.since = state === 'none' ? null : since == null ? this.since || Date.now() : since
    this.setTicker(this.since != null)
    // The pointer stays on screen for as long as the agent operates.
    if (state === 'agent') this.showCursor()
    else this.cursor.classList.remove('on')
    if (state === 'none') this.task = null
    this.render()
  }

  setTask(task: AgentTask | null) {
    this.task = task && typeof task.title === 'string' ? task : null
    if (this.task && this.task.agent) this.agent = this.task.agent
    this.render()
  }

  setHelp(on: boolean) {
    this.help = on
    this.render()
  }

  highlight(el: Element) {
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return
    const box = document.createElement('div')
    box.className = 'hl'
    box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`
    this.frame.appendChild(box)
    setTimeout(() => (box.style.opacity = '0'), 500)
    setTimeout(() => box.remove(), 800)
  }

  /**
   * Glide the agent's pointer to (x, y), then press (taps). Resolves once it
   * has arrived, so the real input follows the pointer the user sees. Kept
   * quick: the glide is 90-240 ms depending on the distance.
   */
  pointer(x: number, y: number, kind: CursorKind): Promise<void> {
    const c = this.cursor
    const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    let from = this.cursorAt
    if (!from || !c.classList.contains('on')) {
      from = from || { x: Math.min(window.innerWidth - 24, x + 30), y: Math.min(window.innerHeight - 12, y + 48) }
      this.placeCursor(from.x, from.y)
    }
    const distance = Math.sqrt((x - from.x) * (x - from.x) + (y - from.y) * (y - from.y))
    const ms = reduced || distance < 2 ? 0 : Math.round(Math.min(240, Math.max(90, 70 + distance * 0.35)))
    c.style.transition = `transform ${ms}ms cubic-bezier(.2, .9, .25, 1), opacity .2s ease`
    c.style.transform = `translate3d(${x}px, ${y}px, 0)`
    c.classList.add('on')
    this.saveCursor(x, y)
    return new Promise(resolve => {
      setTimeout(() => {
        if (kind === 'click' || kind === 'focus' || kind === 'select' || kind === 'drop') this.tap(x, y)
        resolve()
      }, ms)
    })
  }

  private tap(x: number, y: number) {
    const c = this.cursor
    c.classList.add('press')
    setTimeout(() => c.classList.remove('press'), 90)
    const r = document.createElement('div')
    r.className = 'ripple'
    r.style.left = `${x}px`
    r.style.top = `${y}px`
    this.frame.appendChild(r)
    setTimeout(() => r.remove(), 600)
  }

  /** Show the resting pointer: where it last was (also on the previous page), else mid-screen. */
  private showCursor() {
    if (this.cursor.classList.contains('on')) return
    let at = this.cursorAt
    if (!at) {
      try {
        const saved = JSON.parse(read('sessionStorage', CURSOR_KEY) || 'null')
        if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') at = saved
      } catch (e) {
        // Ignore.
      }
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    at = at
      ? { x: Math.min(vw - 12, Math.max(12, at.x)), y: Math.min(vh - 12, Math.max(12, at.y)) }
      : { x: vw * 0.5, y: vh * 0.5 }
    this.placeCursor(at.x, at.y)
    this.cursor.classList.add('on')
    this.saveCursor(at.x, at.y)
  }

  private placeCursor(x: number, y: number) {
    const c = this.cursor
    c.style.transition = 'none'
    c.style.transform = `translate3d(${x}px, ${y}px, 0)`
    void c.offsetWidth
  }

  private saveCursor(x: number, y: number) {
    this.cursorAt = { x, y }
    write('sessionStorage', CURSOR_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) }))
  }

  private render() {
    this.host.setAttribute('data-theme', this.theme())
    this.frame.className = `${this.control} ${this.link}${this.lockScreen() ? ' locked' : ''}`
    const make = (tag: string, cls: string, text: string, parent: HTMLElement, action?: string) => {
      const el = document.createElement(tag)
      if (cls) el.className = cls
      if (text) el.textContent = text
      if (action) {
        el.setAttribute('data-action', action)
        ;(el as HTMLButtonElement).type = 'button'
        if (tag === 'button') el.setAttribute('part', 'button')
        // A listener on the element itself: touch target adjustment (Android)
        // and iOS click synthesis only treat such elements as tap targets.
        el.addEventListener('click', this.onClickBound)
      }
      parent.appendChild(el)
      return el
    }
    const clear = (el: HTMLElement) => {
      while (el.firstChild) el.removeChild(el.firstChild)
    }

    // Idle floating window: the pill, and the card it expands into.
    const idle = this.control === 'none' && !this.panel
    if (!idle) this.winOpen = false
    const t = this.t
    const pill = this.pill
    pill.className = `pill ${this.control} ${this.link}${idle ? '' : ' hidden'}${this.winOpen ? ' open' : ''}${
      pill.classList.contains('snap') ? ' snap' : ''
    }`
    clear(pill)
    // Each part is its own tap target: browsers snap touches to the nearest
    // clickable element, and a tap on the name must not land on the code.
    const logo = make('span', 'logo', '', pill, 'toggle')
    make('span', 'dot', '', logo)
    const lines = make('span', 'lines', '', pill)
    make('span', 'brand', BRAND, lines, 'toggle')
    if (this.code) {
      // Tap the code to copy it; anywhere else on the pill opens the card.
      const copy = make('span', 'copy', '', lines, 'copy')
      make('span', 'ltr', this.code, copy)
      if (this.help) copy.appendChild(document.createTextNode(` · ${t.helpPending}`))
      copy.insertAdjacentHTML('beforeend', COPY_ICON)
    } else {
      make('span', 'code', this.link === 'online' ? '' : t.connecting, lines)
    }
    pill.setAttribute('aria-label', pill.textContent || '')

    const win = this.win
    win.className = `win glass ${this.control} ${this.link}${this.winOpen ? ' open' : ''}`
    clear(win)
    const head = make('div', 'head', '', win)
    const wlogo = make('span', 'logo', '', head)
    make('span', 'dot', '', wlogo)
    make('span', 'name', BRAND, head)
    const link = make('span', 'link', '', head)
    make('span', 'dot', '', link)
    make('span', '', t.link[this.link], link)
    make('div', 'k', t.deviceCode, win)
    const codebox = make('div', 'codebox', '', win)
    make('span', 'big ltr', this.code || '—', codebox)
    if (this.code) make('button', 'btn ghost', t.copy, codebox, 'copy')
    make(
      'div',
      'note',
      this.help ? t.noteHelp : this.autoLevel() ? t.noteAuto : t.noteShare,
      win
    )
    this.renderOptions(make, win)
    const row = make('div', 'row', '', win)
    if (this.opts.helpButton) make('button', this.help ? 'btn ghost' : 'btn accent', this.help ? t.cancelHelp : t.help, row, 'help')
    make('button', 'btn ghost', t.collapse, row, 'toggle')

    // Bottom bar.
    const bar = this.bar
    bar.className = 'bar glass'
    clear(bar)
    const status = make('span', 'status', '', bar)
    make('span', 'dot', '', status)
    const text = make('span', 'text', '', status)
    const line = make('span', 'head', '', text)
    const acts = make('span', 'acts', '', bar)
    switch (this.control) {
      case 'observe':
        make('span', 'label', t.barViewing, line)
        make('span', 'who', this.agent, line)
        // Locked already: the user needs a way back in before the agent acts.
        make('button', 'btn light', t.takeover, acts, 'takeover')
        make('button', 'btn stop', t.end, acts, 'end')
        break
      case 'agent':
        make('span', 'label', t.barAgent, line)
        make('button', 'btn light', t.takeover, acts, 'takeover')
        make('button', 'btn stop', t.end, acts, 'end')
        break
      case 'user':
        make('span', 'label', t.barUser, line)
        make('button', 'btn accent', t.handback, acts, 'handback')
        make('button', 'btn stop', t.end, acts, 'end')
        break
    }
    this.sinceEl = this.control === 'none' ? null : make('span', 'since', '', text)
    this.tick()
    bar.setAttribute('aria-label', bar.textContent || '')

    this.renderTask(make, clear)
    this.renderPanel(make, clear)
    this.place()
  }

  /** The connected-for timer, every second while an agent is attached. */
  private setTicker(on: boolean) {
    if (on && !this.ticker) this.ticker = setInterval(() => this.tick(), 1000)
    if (!on && this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }
  }

  private tick() {
    const el = this.sinceEl
    if (!el) return
    // Not online: the gateway (and the agent behind it) can't reach us right now.
    el.textContent =
      this.link !== 'online' ? this.t.connecting : this.since == null ? '' : this.t.connectedFor(clock(Date.now() - this.since))
  }

  private renderOptions(
    make: (tag: string, cls: string, text: string, parent: HTMLElement, action?: string) => HTMLElement,
    parent: HTMLElement
  ) {
    const t = this.t
    const auto = this.autoLevel()
    const lock = this.lockScreen()
    const opts = make('div', 'opts', '', parent)
    const row = (action: string, title: string, note: string, on: boolean) => {
      const el = make('div', 'opt', '', opts, action)
      el.setAttribute('role', 'switch')
      el.setAttribute('aria-checked', on ? 'true' : 'false')
      const t = make('span', 't', title, el)
      make('small', '', note, t)
      make('span', on ? 'sw on' : 'sw', '', el)
    }
    row('auto', t.autoTitle, auto ? t.autoOn(t.levels[auto]) : t.autoOff, !!auto)
    row('lock', t.lockTitle, lock ? t.lockOn : t.lockOff, lock)
  }

  private renderTask(
    make: (tag: string, cls: string, text: string, parent: HTMLElement, action?: string) => HTMLElement,
    clear: (el: HTMLElement) => void
  ) {
    const el = this.taskEl
    const task = this.task
    const show = !!task && this.control !== 'none'
    const min = read('sessionStorage', TASK_KEY) === '1'
    el.className = `task glass${show ? ' on' : ''}${min ? ' min' : ''}`
    // Keep the last content while it fades out.
    if (!task || !show) {
      this.taskKey = ''
      return
    }
    // Rebuild only when the task changes, so the user's scroll position in
    // the step list and the progress animation survive unrelated renders.
    const key = JSON.stringify([task.title, task.steps, task.current, task.agent || this.agent, min])
    if (key === this.taskKey) return
    this.taskKey = key
    clear(el)
    const total = task.steps.length
    const current = Math.max(0, Math.min(task.current | 0, total))
    const top = make('div', 'top', '', el)
    make('span', 'tag', 'AGENT', top)
    make('span', 'agent', task.agent || this.agent, top)
    if (total) make('span', 'count', `${Math.min(current + 1, total)}/${total}`, top)
    make('div', 'title', task.title, el)
    if (total) {
      const track = make('div', 'track', '', el)
      const fill = make('div', 'fill', '', track)
      const pct = Math.round((current / total) * 100)
      fill.style.width = `${this.taskPct}%`
      void fill.offsetWidth
      fill.style.width = `${pct}%`
      this.taskPct = pct
      const list = make('ol', '', '', el)
      task.steps.forEach((step, i) => {
        const li = make('li', i < current ? 'done' : i === current ? 'now' : '', '', list)
        const mark = make('span', 'mark', '', li)
        if (i < current) mark.innerHTML = CHECK
        make('span', '', step, li)
      })
      // Scrollable when long; keep the current step in view and fade the
      // bottom edge while more steps are below.
      const edge = () => list.classList.toggle('end', list.scrollTop + list.clientHeight >= list.scrollHeight - 2)
      if (list.scrollHeight > list.clientHeight + 2) {
        list.classList.add('more')
        const now = list.querySelector('.now') as HTMLElement | null
        if (now) list.scrollTop = Math.max(0, now.offsetTop - list.offsetTop - list.clientHeight / 2 + now.offsetHeight / 2)
        edge()
        list.addEventListener('scroll', edge, { passive: true })
      }
      if (min && current < total) make('div', 'agent', `${this.opts.dir === 'rtl' ? '←' : '→'} ${task.steps[current]}`, el)
    }
  }

  private renderPanel(
    make: (tag: string, cls: string, text: string, parent: HTMLElement, action?: string) => HTMLElement,
    clear: (el: HTMLElement) => void
  ) {
    const panel = this.panel
    if (!panel) return
    const t = this.t
    panel.className = `panel ${this.control} ${this.link}`
    clear(panel)
    const head = make('div', 'head', '', panel)
    make('span', 'logo', '', head)
    make('span', 'name', BRAND, head)
    const status = make('span', 'status', '', head)
    make('span', 'dot', '', status)
    make('span', '', t.link[this.link], status)

    const card = make('div', 'card', '', panel)
    make('div', 'k', t.deviceCode, card)
    const code = make('div', 'code', '', card)
    make('b', 'ltr', this.code || '—', code)
    if (this.code) make('button', 'ghost small', t.copy, code, 'copy')
    make('div', 'state', this.task && this.control !== 'none' ? `${t.state[this.control]} · ${this.task.title}` : t.state[this.control], card)
    make('div', 'hint', t.noteShare, card)

    const acts = make('div', 'acts', '', panel)
    if (this.control === 'agent') {
      make('button', 'primary', t.takeover, acts, 'takeover')
      make('button', 'ghost', t.end, acts, 'end')
    } else if (this.control === 'user') {
      make('button', 'primary', t.handback, acts, 'handback')
      make('button', 'ghost', t.end, acts, 'end')
    } else if (this.control === 'observe') {
      make('button', 'primary', t.takeover, acts, 'takeover')
      make('button', 'ghost', t.end, acts, 'end')
    }
    if (this.opts.helpButton && this.control === 'none') {
      make('button', this.help ? 'ghost' : 'warn', this.help ? t.cancelHelp : t.help, acts, 'help')
    }
  }

  private onClick(e: Event) {
    // Only real taps: the agent cannot press our buttons.
    if (!e.isTrusted || this.dragged) return
    const target = e.target as Element
    const button = target && target.closest ? target.closest('[data-action]') : null
    if (!button) return
    e.preventDefault()
    e.stopPropagation()
    const action = button.getAttribute('data-action')
    if (action === 'help') {
      this.opts.onHelp(!this.help)
    } else if (action === 'auto') {
      this.toggleAuto()
    } else if (action === 'lock') {
      const on = !this.lockScreen()
      write('localStorage', LOCK_KEY, on ? '1' : '0')
      this.toast(on ? this.t.lockedToast : this.t.unlockedToast)
      this.opts.onSettings()
      this.render()
    } else if (action === 'toggle') {
      this.winOpen = !this.winOpen
      this.render()
    } else if (action === 'task') {
      const min = read('sessionStorage', TASK_KEY) === '1'
      write('sessionStorage', TASK_KEY, min ? null : '1')
      this.render()
    } else if (action === 'copy') {
      copyText(this.code)
      if (button.classList.contains('copy')) {
        button.classList.add('done')
        button.textContent = this.t.copied
        setTimeout(() => this.render(), 1200)
      } else {
        button.textContent = this.t.copied
        setTimeout(() => (button.textContent = this.t.copy), 1500)
      }
    } else if (action === 'takeover' || action === 'handback' || action === 'end') {
      this.opts.onControl(action)
    }
  }

  /** Turning auto-approve on is a decision: say what it means and pick the level. */
  private toggleAuto() {
    const t = this.t
    if (this.autoLevel()) {
      write('localStorage', AUTO_KEY, null)
      this.toast(t.autoOffToast)
      this.opts.onSettings()
      this.render()
      return
    }
    this.dialog({
      title: t.autoDialogTitle,
      text: t.autoDialogText,
      choices: (['observe', 'interact'] as AutoLevel[]).map(value => ({ value, label: t.levels[value] })),
      choice: 'interact',
      okText: t.turnOn,
      cancelText: t.cancel,
      onDecide: (ok, choice) => {
        if (!ok) return
        const level = choice === 'observe' ? 'observe' : 'interact'
        write('localStorage', AUTO_KEY, level)
        this.toast(t.autoOnToast(t.levels[level]))
        this.opts.onSettings()
        this.render()
      },
    })
  }

  /** Bottom bar: stack the buttons below the status when its label would be cut off. */
  private fitBar() {
    const bar = this.bar
    bar.classList.remove('stack')
    const label = bar.querySelector('.label') as HTMLElement | null
    if (label && label.scrollWidth > label.clientWidth + 1) bar.classList.add('stack')
  }

  private savedPosition(): { side: 'left' | 'right'; top: number } {
    try {
      const saved = JSON.parse(read('localStorage', POS_KEY) || 'null')
      if (saved && (saved.side === 'left' || saved.side === 'right') && typeof saved.top === 'number') {
        return saved
      }
    } catch (e) {
      // Ignore.
    }
    const pill = this.opts.style && this.opts.style.pill
    const side = pill && (pill.side === 'left' || pill.side === 'right') ? pill.side : this.opts.dir === 'rtl' ? 'left' : 'right'
    const top = pill && typeof pill.top === 'number' && pill.top >= 0 && pill.top <= 1 ? pill.top : 0.62
    return { side, top }
  }

  /** Put the idle pill at its saved edge and height, kept inside the viewport; fit the bottom bar. */
  private place() {
    if (!this.host.isConnected) return
    this.fitBar()
    const { side, top } = this.savedPosition()
    const w = this.pill.offsetWidth
    const h = this.pill.offsetHeight
    const maxTop = Math.max(EDGE, window.innerHeight - h - EDGE)
    const y = Math.min(maxTop, Math.max(EDGE, top * window.innerHeight))
    const x = side === 'left' ? EDGE : Math.max(EDGE, window.innerWidth - w - EDGE)
    this.pill.style.left = `${x}px`
    this.pill.style.top = `${y}px`
    // The card opens from the pill, toward the middle of the screen.
    const ww = this.win.offsetWidth
    const wh = this.win.offsetHeight
    const below = y + h / 2 < window.innerHeight / 2
    const wx = side === 'left' ? EDGE : Math.max(EDGE, window.innerWidth - ww - EDGE)
    const wy = below ? Math.min(window.innerHeight - wh - EDGE, y + h + 8) : Math.max(EDGE, y - wh - 8)
    this.win.style.left = `${wx}px`
    this.win.style.top = `${wy}px`
    this.win.style.transformOrigin = `${side === 'left' ? 'left' : 'right'} ${below ? 'top' : 'bottom'}`
  }

  private bindDrag() {
    const t = this.t
    const pill = this.pill
    let start: { x: number; y: number; left: number; top: number; id: number } | null = null
    let moving = false

    pill.addEventListener('pointerdown', e => {
      if (!e.isTrusted || (e.target as Element).closest('button')) return
      const r = pill.getBoundingClientRect()
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, id: e.pointerId }
      moving = false
      this.dragged = false
      pill.classList.remove('snap')
      try {
        pill.setPointerCapture(e.pointerId)
      } catch (err) {
        // Old webview.
      }
    })
    pill.addEventListener('pointermove', e => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!moving && Math.abs(dx) + Math.abs(dy) < 6) return
      moving = true
      pill.style.left = `${start.left + dx}px`
      pill.style.top = `${start.top + dy}px`
    })
    const end = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      start = null
      if (!moving) return
      moving = false
      this.dragged = true
      // Swallow the click that ends the drag.
      setTimeout(() => (this.dragged = false), 0)
      const r = pill.getBoundingClientRect()
      const side = r.left + r.width / 2 < window.innerWidth / 2 ? 'left' : 'right'
      write('localStorage', POS_KEY, JSON.stringify({ side, top: r.top / window.innerHeight }))
      pill.classList.add('snap')
      this.place()
    }
    pill.addEventListener('pointerup', end)
    pill.addEventListener('pointercancel', end)
  }
}

/** Whether the page looks light or dark: the first opaque background of body / html. */
function pageTheme(): 'light' | 'dark' | null {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/)
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) continue
    const luminance = (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255
    return luminance > 0.5 ? 'light' : 'dark'
  }
  return null
}

/** 83_000 → "01:23"; from an hour on "1:02:03". */
function clock(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const two = (n: number) => (n < 10 ? '0' : '') + n
  const h = Math.floor(sec / 3600)
  return (h ? h + ':' : '') + two(Math.floor(sec / 60) % 60) + ':' + two(sec % 60)
}

function copyText(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => copyFallback(text))
      return
    }
  } catch (e) {
    // Fall through.
  }
  copyFallback(text)
}

// WebViews without the async clipboard API.
function copyFallback(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:-1000px;opacity:0;'
  document.body.appendChild(area)
  area.select()
  try {
    document.execCommand('copy')
  } catch (e) {
    // Nothing more to try.
  }
  area.remove()
}

/** r, g, b of any CSS color ('#e11d48', 'tomato', 'rgb(…)', '225, 29, 72'); null if it isn't one. */
function rgbTriplet(color: string): string | null {
  const v = color.trim()
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(v)) return v
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return null
    // The canvas keeps its previous color for an invalid one: try two.
    ctx.fillStyle = '#000'
    ctx.fillStyle = v
    const a = String(ctx.fillStyle)
    ctx.fillStyle = '#fff'
    ctx.fillStyle = v
    if (String(ctx.fillStyle) !== a) return null
    const hex = a.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
    if (hex) return [hex[1], hex[2], hex[3]].map(h => parseInt(h, 16)).join(', ')
    const rgb = a.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    return rgb ? `${rgb[1]}, ${rgb[2]}, ${rgb[3]}` : null
  } catch (e) {
    return null
  }
}

function length(v: number | string) {
  return typeof v === 'number' ? `${v}px` : v
}

/** run({ style }) as --rwd-* properties on a host element. */
function applyStyle(host: HTMLElement, style: StyleOptions | undefined) {
  if (!style) return
  const set = (name: string, value: string | null) => {
    if (value) host.style.setProperty(name, value)
  }
  const color = (name: string, v: unknown) => {
    if (typeof v === 'string') set(name, rgbTriplet(v))
  }
  color('--rwd-accent-rgb', style.accent)
  color('--rwd-danger-rgb', style.danger)
  color('--rwd-warning-rgb', style.warning)
  color('--rwd-success-rgb', style.success)
  if (typeof style.font === 'string') set('--rwd-font', style.font)
  if (typeof style.monoFont === 'string') set('--rwd-font-mono', style.monoFont)
  for (const [key, name] of [
    ['radius', '--rwd-radius'],
    ['buttonRadius', '--rwd-button-radius'],
    ['barBottom', '--rwd-bar-bottom'],
    ['taskTop', '--rwd-task-top'],
    ['toastBottom', '--rwd-toast-bottom'],
  ] as const) {
    const v = style[key]
    if (typeof v === 'number' || typeof v === 'string') set(name, length(v))
  }
  if (typeof style.zIndex === 'number') set('--rwd-z-index', String(Math.round(style.zIndex)))
}
