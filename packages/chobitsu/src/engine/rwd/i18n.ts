// Text the page produces in two languages, for two audiences:
//
//   agent   RPC error messages and timeline event summaries: they go back to
//           the AI agent. The gateway picks the language (welcome.agentLang);
//           English until a welcome says otherwise.
//   user    what the phone user reads about an agent action (the
//           sensitive-action confirmation): the page SDK's UI language,
//           run({ lang }).

export type Lang = 'en' | 'zh'

let agentLang: Lang = 'en'
let userLang: Lang = 'en'

/** 'en' / 'zh' (also 'zh-CN', 'en_US'…); null for anything else. */
export function toLang(value: unknown): Lang | null {
  if (typeof value !== 'string') return null
  const v = value.toLowerCase()
  if (v === 'zh' || v.indexOf('zh-') === 0 || v.indexOf('zh_') === 0) return 'zh'
  if (v === 'en' || v.indexOf('en-') === 0 || v.indexOf('en_') === 0) return 'en'
  return null
}

export function setAgentLang(lang: unknown) {
  agentLang = toLang(lang) || 'en'
}

export function getAgentLang(): Lang {
  return agentLang
}

export function setUserLang(lang: unknown) {
  userLang = toLang(lang) || 'en'
}

export function getUserLang(): Lang {
  return userLang
}

/* ------------------------------ agent-facing ------------------------------ */

const AGENT_EN = {
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
}

type AgentText = typeof AGENT_EN

const AGENT_ZH: AgentText = {
  missingParam: name => `缺少参数 ${name}`,
  notString: name => `参数 ${name} 必须是字符串`,
  unknownMethod: method => `未知方法：${method}`,
  needLevel: level => `需要 ${level} 权限`,
  takenOver: '用户已接管控制，等待用户交还',
  userDenied: '用户拒绝了该操作',
  confirmBusy: '正在等待用户确认上一个操作',

  unknownModifier: m => `未知的修饰键：${m}`,
  unknownKey: key => `未知的按键：${key}`,

  refNotInSnapshot: ref => `ref=${ref} 不在最近一次快照里，请重新获取快照`,
  refDetached: ref => `ref=${ref} 对应的元素已不在页面上，请重新获取快照`,
  queryNeedsCriteria: '至少需要 text、role、name 之一',
  noSuchRecord: seq => `会话日志里没有 seq=${seq} 的记录（可能已被清理）`,
  noSuchSession: id => `这台设备上没有会话 ${id} 的日志（只保留最近 3 次启动）`,
  noSessionLog: '这台设备上还没有会话日志（项目可能关闭了记录，或页面用 run({ record: false }) 关掉了）',
  sessionLogUnavailable: '这个页面用不了 IndexedDB，没有会话日志',

  readOnly: tag => `${tag} 是只读的`,
  isSelect: tag => `${tag} 是下拉框，请用 rwd.select`,
  notFillable: tag => `${tag} 不是输入框，不能填写`,
  notSelect: tag => `${tag} 不是下拉框（select），请用 click 操作`,
  singleSelect: '该下拉框只能选一项',
  noSuchOption: (value, choices) => `下拉框里没有选项「${value}」，可选：${choices.join('、')}`,
  optionDisabled: value => `选项「${value}」已禁用`,

  badUrl: url => `无效的网址：${url}`,
  httpOnly: '只能打开 http(s) 网址',
  textAppearTimeout: text => `等待文字「${text}」出现超时`,
  textGoneTimeout: text => `等待文字「${text}」消失超时`,
  badFunction: message => `无法解析 function：${message}`,
  notAFunction: 'function 必须是函数表达式，例如 "() => document.title"',

  elementDetached: tag => `元素 ${tag} 已不在页面上，请重新获取快照`,
  notActionable: (tag, reason) => `元素 ${tag} 不可操作：${reason}`,
  notVisible: tag => `元素 ${tag} 不可见`,
  reasonMoving: '元素位置一直在变化（可能在动画中）',
  reasonOffscreen: '元素不在可视区域内',
  reasonObscured: (tag, ref) => `点击位置被 ${tag} 遮挡（遮挡元素 ref=${ref}，可以直接 click 它，比如点遮罩关闭弹窗）`,

  overlayHeader: '[浮层] 下面这些元素盖在页面内容上方。点击被挡住时，可以直接点它们（比如点遮罩关闭弹窗）：',
  overlayMask: (tag, coverage, ref) => `- 遮罩 ${tag}，覆盖视口 ${coverage}% [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) => `- 弹层 ${tag}${text ? `「${text}」` : ''}，覆盖视口 ${coverage}% [ref=${ref}]`,
  reasonHidden: '元素不可见',
  reasonDisabled: '元素已禁用',

  storageUnavailable: area => `${area}Storage 不可用`,
  badStorageArea: "参数 area 必须是 'local'、'session' 或 'cookie'",

  requestFailed: '请求失败',
  noSuchRequest: id => `找不到请求 id=${id}（可能已被丢弃）`,
  netFailed: (what, error) => `${what} → 失败（${error}）`,
  wsFailed: url => `WebSocket ${url} → 失败`,

  tapped: (role, text) => `点击了${role}「${text}」`,
  tappedTag: (role, tag) => `点击了${role} ${tag}`,
  roles: {
    button: '按钮',
    link: '链接',
    textbox: '输入框',
    searchbox: '搜索框',
    checkbox: '复选框',
    radio: '单选框',
    switch: '开关',
    combobox: '下拉框',
    listbox: '列表',
    option: '选项',
    tab: '标签页',
    menuitem: '菜单项',
    img: '图片',
    heading: '标题',
    cell: '单元格',
    row: '行',
    listitem: '列表项',
  },
  element: '元素',
}

/** Agent-facing text in the gateway's language. */
export function agentText(): AgentText {
  return agentLang === 'zh' ? AGENT_ZH : AGENT_EN
}

/* ------------------------------- user-facing ------------------------------ */

// What the agent is about to do, completing "AI wants to …" in the SDK's
// confirmation dialog (or a native host's, from status().pending.action).
const USER_EN = {
  quote: (name: string) => `"${name}"`,
  click: (target: string) => `click ${target}`,
  enterActivate: (target: string) => `press Enter on ${target}`,
  enterSubmit: (target: string) => `press Enter to submit ${target}`,
}

type UserText = typeof USER_EN

const USER_ZH: UserText = {
  quote: name => `「${name}」`,
  click: target => `点击${target}`,
  enterActivate: target => `按 Enter 触发${target}`,
  enterSubmit: target => `按 Enter 提交${target}`,
}

/** User-facing text in the SDK's UI language. */
export function userText(): UserText {
  return userLang === 'zh' ? USER_ZH : USER_EN
}
