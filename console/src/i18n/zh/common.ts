import type { common as en } from '../en/common'

export const common: typeof en = {
  cancel: '取消',
  save: '保存',
  create: '创建',
  delete: '删除',
  close: '关闭',
  copy: '复制',
  copied: '已复制到剪贴板',
  copyFailed: '复制失败，请手动选择文本复制',
  retry: '重试',
  loadFailed: '加载失败',
  unknown: '未知',
  disabled: '已停用',
  online: '在线',
  offline: '离线',

  time: {
    justNow: '刚刚',
    secondsAgo: (n) => `${n} 秒前`,
    minutesAgo: (n) => `${n} 分钟前`,
    hoursAgo: (n) => `${n} 小时前`,
    daysAgo: (n) => `${n} 天前`,
    expired: '已过期',
    inMinutes: (n) => `${n} 分钟后`,
    inHours: (n) => `${n} 小时后`,
    inDays: (n) => `${n} 天后`,
    seconds: (n) => `${n} 秒`,
    minutes: (n) => `${n} 分钟`,
    hoursMinutes: (h, m) => `${h} 小时 ${m} 分`,
    hours: (n) => `${n} 小时`,
    daysHours: (d, h) => `${d} 天 ${h} 小时`,
    days: (n) => `${n} 天`,
  },

  unknownDevice: '未知设备',

  control: {
    none: '空闲',
    observe: 'AI 查看中',
    agent: 'AI 操作中',
    user: '用户接管',
  },

  roles: {
    owner: '所有者',
    admin: '管理员',
    member: '成员',
  },
  roleDescriptions: {
    owner: '全部权限，包括邀请成员、修改角色和删除成员。',
    admin: '管理项目、API Key、接入策略、设备和邀请，查看审计和成员列表。',
    member: '查看项目和设备；可以邀请用户接入、测试连接、结束调试、查看审计。',
  },

  levels: {
    observe: {
      label: '仅查看',
      description: '快照、截图、console、网络请求列表、等待文本。不能改变页面。',
    },
    interact: {
      label: '可操作',
      description: '在查看之外，可以点击、输入、选择、滚动、拖拽、跳转、后退、刷新。',
    },
    advanced: {
      label: '高级',
      description: '在操作之外，可以在页面里执行任意 JS、查看请求头和正文、读取 localStorage / Cookie。',
    },
  },
  levelTitle: (label, level, description) => `${label}（${level}）：${description}`,

  maskPresets: {
    phone: '手机号',
    idCard: '身份证号',
    bankCard: '银行卡号',
    email: '邮箱',
  },
  regex: {
    empty: '请填写正则',
    matchesEmpty: '会匹配空字符串，会把所有文本都遮盖掉',
    syntax: (detail) => `正则语法错误：${detail}`,
    lookaround: '不支持环视（(?=、(?!、(?<=、(?<!），网关使用 RE2 语法',
    backreference: '不支持反向引用（\\1 等），网关使用 RE2 语法',
  },

  badges: {
    help: '协助中',
    agentWithName: (label, agent) => `${label}（${agent}）`,
    waitingConfirmAction: '等待用户确认操作',
    waitingConfirm: '等待用户确认',
    waitingTitle: (agent) => `${agent} 正在等待用户在设备上确认`,
    invited: '邀请接入',
    invitedTitle: '通过邀请链接接入的设备',
  },

  api: {
    network: '无法连接到网关，请检查网络',
    unauthorized: '登录已失效，请重新登录',
    forbidden: '没有权限执行该操作',
    notFound: '资源不存在',
    server: '网关内部错误，请稍后重试',
    failed: (status) => `请求失败（HTTP ${status}）`,
    unknown: '未知错误',
    adminName: '管理员',
  },
}
