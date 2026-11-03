import type { common as en } from '../en/common'

export const common: typeof en = {
  cancel: '取消',
  save: '儲存',
  create: '建立',
  delete: '刪除',
  close: '關閉',
  copy: '複製',
  copied: '已複製到剪貼簿',
  copyFailed: '無法複製，請手動選取文字後複製',
  retry: '重試',
  loadFailed: '無法載入',
  unknown: '未知',
  disabled: '已停用',
  online: '線上',
  offline: '離線',

  time: {
    justNow: '剛剛',
    secondsAgo: (n) => `${n} 秒前`,
    minutesAgo: (n) => `${n} 分鐘前`,
    hoursAgo: (n) => `${n} 小時前`,
    daysAgo: (n) => `${n} 天前`,
    expired: '已過期',
    inMinutes: (n) => `${n} 分鐘後`,
    inHours: (n) => `${n} 小時後`,
    inDays: (n) => `${n} 天後`,
    seconds: (n) => `${n} 秒`,
    minutes: (n) => `${n} 分鐘`,
    hoursMinutes: (h, m) => `${h} 小時 ${m} 分`,
    hours: (n) => `${n} 小時`,
    daysHours: (d, h) => `${d} 天 ${h} 小時`,
    days: (n) => `${n} 天`,
  },

  unknownDevice: '未知裝置',

  control: {
    none: '閒置',
    observe: 'AI 檢視中',
    agent: 'AI 操作中',
    user: '使用者已接管',
  },

  roles: {
    owner: '擁有者',
    admin: '管理員',
    member: '成員',
  },
  roleDescriptions: {
    owner: '擁有全部權限，包括邀請成員、變更角色和移除成員。',
    admin: '管理專案、API 金鑰、連線策略、裝置和邀請，可查看稽核記錄和成員清單。',
    member: '可查看專案和裝置；可以邀請使用者連線、測試連線、結束除錯，以及查看稽核記錄。',
  },

  levels: {
    observe: {
      label: '僅檢視',
      description: '快照、截圖、console、網路請求清單、等待文字出現。無法變更頁面。',
    },
    interact: {
      label: '檢視並操作',
      description: '包含「僅檢視」的全部能力，另可點擊、輸入、選取、捲動、拖曳、跳轉、返回上一頁和重新整理。',
    },
    advanced: {
      label: '進階',
      description: '包含「檢視並操作」的全部能力，另可在頁面中執行任意 JS、查看請求標頭和內容，以及讀取 localStorage / cookie。',
    },
  },
  levelTitle: (label, level, description) => `${label}（${level}）：${description}`,

  maskPresets: {
    phone: '手機號碼（中國大陸）',
    idCard: '身分證字號（中國大陸）',
    bankCard: '銀行卡號',
    email: '電子郵件',
  },
  regex: {
    empty: '請輸入正規表示式',
    matchesEmpty: '會比對到空字串，導致所有文字都被遮蔽',
    syntax: (detail) => `正規表示式語法錯誤：${detail}`,
    lookaround: '不支援環顧（(?=、(?!、(?<=、(?<!），閘道使用 RE2 語法',
    backreference: '不支援反向參考（\\1 等），閘道使用 RE2 語法',
  },

  badges: {
    help: '協助中',
    agentWithName: (label, agent) => `${label}（${agent}）`,
    waitingConfirmAction: '等待使用者確認操作',
    waitingConfirm: '等待使用者核准',
    waitingTitle: (agent) => `${agent} 正在等待使用者在裝置上核准`,
    invited: '邀請連線',
    invitedTitle: '透過邀請連結連線的裝置',
  },

  api: {
    network: '無法連線到閘道，請檢查網路',
    unauthorized: '登入已逾時，請重新登入',
    forbidden: '你沒有權限執行這項操作',
    notFound: '找不到資源',
    server: '閘道發生錯誤，請稍後再試',
    failed: (status) => `請求失敗（HTTP ${status}）`,
    unknown: '未知的錯誤',
    adminName: '管理員',
  },
}
