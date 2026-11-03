import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// 简体中文。

const ui: UiMessages = {
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
  helpPending: '协助中',
  copy: '复制',
  copied: '已复制',
  noteHelp: '已请求协助，开发同学会通过设备码找到你。',
  noteAuto: '已开启自动允许：AI 接入时不再询问，你随时可以接管或结束。',
  noteShare: '把设备码发给开发同学：AI 接入前会先征得你的同意，接入后你随时可以接管或结束。',
  help: '请求协助',
  cancelHelp: '取消请求',
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

const agent: AgentMessages = {
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

const action: ActionMessages = {
  quote: name => `「${name}」`,
  click: target => `点击${target}`,
  enterActivate: target => `按 Enter 触发${target}`,
  enterSubmit: target => `按 Enter 提交${target}`,
}

const zh: Locale = { id: 'zh', name: '简体中文', dir: 'ltr', ui, action, agent }

export default zh
