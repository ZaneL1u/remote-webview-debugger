import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// 繁體中文（台灣）。

const ui: UiMessages = {
  levels: {
    observe: '僅檢視',
    interact: '檢視並操作',
    advanced: '進階（可執行指令碼、讀取儲存資料）',
  },
  attachLevels: {
    observe: '僅檢視',
    interact: '檢視並操作',
    advanced: '進階（另可執行指令碼、讀取儲存資料）',
  },
  state: {
    none: '閒置：沒有 AI 連線',
    observe: 'AI 正在檢視這個頁面',
    agent: 'AI 正在操作，你的輸入已暫停',
    user: '你已接管，AI 已暫停',
  },
  link: {
    connecting: '連線中',
    online: '線上',
    offline: '離線',
  },
  connecting: '連線中…',
  helpPending: '求助中',
  copy: '複製',
  copied: '已複製',
  noteHelp: '已送出求助，開發人員會透過裝置碼找到你。',
  noteAuto: '已開啟自動允許：AI 加入時不會再詢問，你隨時可以接管或結束。',
  noteShare: '把裝置碼提供給開發人員：AI 加入前會先徵求你的同意，加入後你隨時可以接管或結束。',
  help: '求助',
  cancelHelp: '取消求助',
  collapse: '收合',
  deviceCode: '裝置碼',
  barViewing: 'AI 檢視中',
  barAgent: 'AI 操作中',
  barUser: '由你操作',
  connectedFor: time => `已連線 · ${time}`,
  takeover: '接管',
  handback: '交還 AI',
  end: '結束',
  autoTitle: '自動允許 AI 加入',
  autoOn: level => `不再詢問，以「${level}」加入`,
  autoOff: '每次 AI 要求加入時都先詢問你',
  lockTitle: 'AI 連線時鎖定螢幕',
  lockOn: 'AI 連線期間，你的點擊和滑動會被擋下',
  lockOff: 'AI 連線期間你仍可點擊和捲動，但請盡量別干擾 AI',
  lockedToast: 'AI 連線期間會鎖定螢幕',
  unlockedToast: 'AI 連線期間不再鎖定螢幕',
  autoOffToast: '已關閉自動允許，AI 加入前會先詢問你',
  autoDialogTitle: '要開啟自動允許嗎？',
  autoDialogText:
    '開啟後，AI 要求加入這台裝置時不會再跳出詢問，而是直接以下方選擇的權限加入。每次自動加入時畫面上都會顯示通知，你隨時可以接管或結束，也可以在這裡關閉。',
  turnOn: '開啟',
  cancel: '取消',
  autoOnToast: level => `已開啟自動允許 · ${level}`,
  countdown: seconds => `${seconds} 秒後自動拒絕`,

  agentName: 'AI 助理',
  autoAllowedToast: (agent, level) => `已自動允許「${agent}」加入 · ${level}`,
  attachTitle: 'AI 請求加入',
  attachText: agent => `「${agent}」想要檢視這個頁面，要允許嗎？`,
  confirmTitle: '請確認',
  confirmText: action => `AI 想要${action}，要允許嗎？`,
  allow: '允許',
  deny: '拒絕',
}

const agent: AgentMessages = {
  missingParam: name => `缺少參數 ${name}`,
  notString: name => `參數 ${name} 必須是字串`,
  unknownMethod: method => `未知的方法：${method}`,
  needLevel: level => `需要 ${level} 權限`,
  takenOver: '使用者已接管控制，請等待使用者交還',
  userDenied: '使用者拒絕了這項操作',
  confirmBusy: '仍在等待使用者確認上一項操作',

  unknownModifier: m => `未知的修飾鍵：${m}`,
  unknownKey: key => `未知的按鍵：${key}`,

  refNotInSnapshot: ref => `ref=${ref} 不在最新的快照裡，請重新取得快照`,
  refDetached: ref => `ref=${ref} 對應的元素已不在頁面上，請重新取得快照`,
  queryNeedsCriteria: '至少需要 text、role、name 其中一項',
  noSuchRecord: seq => `工作階段記錄裡沒有 seq=${seq} 的項目（可能已被清除）`,
  noSuchSession: id => `這台裝置上沒有工作階段 ${id} 的記錄（只保留最近 3 次啟動）`,
  noSessionLog: '這台裝置上還沒有工作階段記錄（專案可能已關閉記錄，或頁面以 run({ record: false }) 停用了記錄）',
  sessionLogUnavailable: '這個頁面無法使用 IndexedDB，因此沒有工作階段記錄',

  readOnly: tag => `${tag} 是唯讀的`,
  isSelect: tag => `${tag} 是下拉式選單，請用 rwd.select`,
  notFillable: tag => `${tag} 不是文字欄位，無法填入`,
  notSelect: tag => `${tag} 不是下拉式選單（select），請用 click`,
  singleSelect: '這個下拉式選單只能選一個選項',
  noSuchOption: (value, choices) => `下拉式選單裡沒有選項「${value}」，可選：${choices.join('、')}`,
  optionDisabled: value => `選項「${value}」已停用`,

  badUrl: url => `無效的網址：${url}`,
  httpOnly: '只能開啟 http(s) 網址',
  textAppearTimeout: text => `等待文字「${text}」出現逾時`,
  textGoneTimeout: text => `等待文字「${text}」消失逾時`,
  badFunction: message => `無法解析 function：${message}`,
  notAFunction: 'function 必須是函式運算式，例如 "() => document.title"',

  elementDetached: tag => `元素 ${tag} 已不在頁面上，請重新取得快照`,
  notActionable: (tag, reason) => `元素 ${tag} 無法操作：${reason}`,
  notVisible: tag => `元素 ${tag} 不可見`,
  reasonMoving: '元素位置持續變動（可能正在播放動畫）',
  reasonOffscreen: '元素不在可視區域內',
  reasonObscured: (tag, ref) => `點擊位置被 ${tag} 遮住（遮住它的元素 ref=${ref}，可以直接 click 它，例如點遮罩來關閉彈出視窗）`,

  overlayHeader: '[浮層] 以下元素蓋在頁面內容上方。點擊被擋住時，可以直接點它們（例如點遮罩來關閉彈出視窗）：',
  overlayMask: (tag, coverage, ref) => `- 遮罩 ${tag}，覆蓋可視區域的 ${coverage}% [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) => `- 浮層 ${tag}${text ? `「${text}」` : ''}，覆蓋可視區域的 ${coverage}% [ref=${ref}]`,
  reasonHidden: '元素不可見',
  reasonDisabled: '元素已停用',

  storageUnavailable: area => `${area}Storage 無法使用`,
  badStorageArea: "參數 area 必須是 'local'、'session' 或 'cookie'",

  requestFailed: '請求失敗',
  noSuchRequest: id => `找不到 id=${id} 的請求（可能已被捨棄）`,
  netFailed: (what, error) => `${what} → 失敗（${error}）`,
  wsFailed: url => `WebSocket ${url} → 失敗`,

  tapped: (role, text) => `點擊了${role}「${text}」`,
  tappedTag: (role, tag) => `點擊了${role} ${tag}`,
  roles: {
    button: '按鈕',
    link: '連結',
    textbox: '文字欄位',
    searchbox: '搜尋欄位',
    checkbox: '核取方塊',
    radio: '選項按鈕',
    switch: '開關',
    combobox: '下拉式選單',
    listbox: '清單',
    option: '選項',
    tab: '分頁',
    menuitem: '選單項目',
    img: '圖片',
    heading: '標題',
    cell: '儲存格',
    row: '列',
    listitem: '清單項目',
  },
  element: '元素',
}

const action: ActionMessages = {
  quote: name => `「${name}」`,
  click: target => `點擊${target}`,
  enterActivate: target => `在${target}上按 Enter`,
  enterSubmit: target => `按 Enter 送出${target}`,
}

const zhTW: Locale = { id: 'zh-TW', name: '繁體中文', dir: 'ltr', ui, action, agent }

export default zhTW
