import { toLang, type Lang } from '@chobitsu/engine/rwd'

// The phone user's UI text (pill, floating window, bottom bar, dialogs,
// toasts, eruda tab), in run({ lang }) or the browser's language. What goes
// back to the agent is in the engine's catalog (engine/rwd/i18n.ts), in the
// language the gateway asks for.

export type { Lang }

/** run({ lang }) if valid, else the browser's language: zh* → 'zh', anything else → 'en'. */
export function resolveLang(option: unknown): Lang {
  const chosen = toLang(option)
  if (chosen) return chosen
  let browser = ''
  try {
    browser = navigator.language || ''
  } catch (e) {
    // No navigator: English.
  }
  return /^zh\b/i.test(browser) ? 'zh' : 'en'
}

type LevelText = { observe: string; interact: string; advanced: string }

const EN = {
  /** Levels in the floating window (auto-allow). */
  levels: {
    observe: 'View only',
    interact: 'View and interact',
    advanced: 'Advanced (run scripts, read storage)',
  } as LevelText,
  /** Levels in the attach dialog: what each choice adds. */
  attachLevels: {
    observe: 'View only',
    interact: 'View and interact',
    advanced: 'Advanced (also run scripts, read storage)',
  } as LevelText,
  state: {
    none: 'Idle: no AI connected',
    observe: 'AI is viewing this page',
    agent: 'AI is in control; your input is paused',
    user: "You've taken over; AI is paused",
  },
  link: {
    connecting: 'Connecting',
    online: 'Online',
    offline: 'Offline',
  },
  connecting: 'Connecting…',
  helpPending: 'Help requested',
  copy: 'Copy',
  copied: 'Copied',
  noteHelp: 'Help requested. The developer will find you by this device code.',
  noteAuto: 'Auto-allow is on: AI joins without asking. You can take over or end anytime.',
  noteShare: 'Share this device code with the developer. AI asks before joining, and you can take over or end anytime.',
  help: 'Get help',
  cancelHelp: 'Cancel help',
  collapse: 'Hide',
  deviceCode: 'Device code',
  barViewing: 'AI is viewing',
  barAgent: 'AI working',
  barUser: 'Your turn',
  connectedFor: (time: string) => `Connected · ${time}`,
  takeover: 'Take over',
  handback: 'Hand back',
  end: 'End',
  autoTitle: 'Auto-allow AI',
  autoOn: (level: string) => `Joins without asking · ${level}`,
  autoOff: 'Ask me each time AI wants to join',
  lockTitle: 'Lock screen while AI is connected',
  lockOn: 'Your taps and swipes are blocked while AI is connected',
  lockOff: "You can still tap and scroll; try not to get in the AI's way",
  lockedToast: 'Screen will lock while AI is connected',
  unlockedToast: "Screen won't lock while AI is connected",
  autoOffToast: 'Auto-allow is off. AI will ask before joining',
  autoDialogTitle: 'Turn on auto-allow?',
  autoDialogText:
    "When AI asks to join this device, it joins right away with the access you pick below. You'll see a notice each time, can take over or end anytime, and can turn this off here.",
  turnOn: 'Turn on',
  cancel: 'Cancel',
  autoOnToast: (level: string) => `Auto-allow on · ${level}`,
  countdown: (seconds: number) => `Auto-deny in ${seconds}s`,

  // approval
  agentName: 'AI assistant',
  autoAllowedToast: (agent: string, level: string) => `Auto-allowed "${agent}" · ${level}`,
  attachTitle: 'AI wants to join',
  attachText: (agent: string) => `"${agent}" wants to view this page. Allow?`,
  confirmTitle: 'Please confirm',
  confirmText: (action: string) => `AI wants to ${action}. Allow?`,
  allow: 'Allow',
  deny: 'Deny',
}

export type UiText = typeof EN

const ZH: UiText = {
  levels: {
    observe: '仅查看',
    interact: '查看并操作',
    advanced: '高级（可执行脚本、读取存储）',
  },
  attachLevels: {
    observe: '仅查看',
    interact: '查看并操作',
    advanced: '高级（另可执行脚本、读取存储）',
  },
  state: {
    none: '空闲：没有 AI 接入',
    observe: 'AI 正在查看这个页面',
    agent: 'AI 正在操作，你的输入已暂停',
    user: '你已接管，AI 已暂停',
  },
  link: {
    connecting: '连接中',
    online: '在线',
    offline: '离线',
  },
  connecting: '连接中…',
  helpPending: '求助中',
  copy: '复制',
  copied: '已复制',
  noteHelp: '已发出求助，开发同学会通过设备码找到你。',
  noteAuto: '已开启自动允许：AI 接入时不再询问，你随时可以接管或结束。',
  noteShare: '把设备码发给开发同学：AI 接入前会先征得你的同意，接入后你随时可以接管或结束。',
  help: '求助',
  cancelHelp: '取消求助',
  collapse: '收起',
  deviceCode: '设备码',
  barViewing: 'AI 查看中',
  barAgent: 'AI 操作中',
  barUser: '你在操作',
  connectedFor: time => `已连接 · ${time}`,
  takeover: '接管',
  handback: '交还 AI',
  end: '结束',
  autoTitle: '自动允许 AI 接入',
  autoOn: level => `不再询问，以「${level}」接入`,
  autoOff: '每次 AI 请求接入都先问你',
  lockTitle: 'AI 接入时锁定屏幕',
  lockOn: 'AI 接入期间你的点击和滑动会被拦住',
  lockOff: 'AI 接入期间你仍可以点和滑，注意别和 AI 抢操作',
  lockedToast: 'AI 接入期间会锁定屏幕',
  unlockedToast: 'AI 接入期间不再锁定屏幕',
  autoOffToast: '已关闭自动允许，AI 接入前会先问你',
  autoDialogTitle: '开启自动允许接入？',
  autoDialogText:
    '开启后，AI 请求接入这台设备时不再弹窗询问，直接按下面选的权限接入。每次自动接入都会在屏幕上提示，你随时可以接管或结束，也可以在这里关掉。',
  turnOn: '开启',
  cancel: '取消',
  autoOnToast: level => `已开启自动允许接入 · ${level}`,
  countdown: seconds => `${seconds} 秒后自动拒绝`,

  agentName: 'AI 助手',
  autoAllowedToast: (agent, level) => `已自动允许「${agent}」接入 · ${level}`,
  attachTitle: 'AI 请求接入',
  attachText: agent => `「${agent}」请求查看此页面，允许吗？`,
  confirmTitle: '需要你的确认',
  confirmText: action => `AI 想要${action}，允许吗？`,
  allow: '允许',
  deny: '拒绝',
}

export function uiText(lang: Lang): UiText {
  return lang === 'zh' ? ZH : EN
}
