import type { common as en } from '../en/common'

export const common: typeof en = {
  cancel: 'キャンセル',
  save: '保存',
  create: '作成',
  delete: '削除',
  close: '閉じる',
  copy: 'コピー',
  copied: 'クリップボードにコピーしました',
  copyFailed: 'コピーできませんでした。テキストを選択して手動でコピーしてください。',
  retry: '再試行',
  loadFailed: '読み込めませんでした',
  unknown: '不明',
  disabled: '無効',
  online: 'オンライン',
  offline: 'オフライン',

  time: {
    justNow: 'たった今',
    secondsAgo: (n) => `${n} 秒前`,
    minutesAgo: (n) => `${n} 分前`,
    hoursAgo: (n) => `${n} 時間前`,
    daysAgo: (n) => `${n} 日前`,
    expired: '期限切れ',
    inMinutes: (n) => `${n} 分後`,
    inHours: (n) => `${n} 時間後`,
    inDays: (n) => `${n} 日後`,
    seconds: (n) => `${n} 秒`,
    minutes: (n) => `${n} 分`,
    hoursMinutes: (h, m) => `${h} 時間 ${m} 分`,
    hours: (n) => `${n} 時間`,
    daysHours: (d, h) => `${d} 日 ${h} 時間`,
    days: (n) => `${n} 日`,
  },

  unknownDevice: '不明なデバイス',

  control: {
    none: '待機中',
    observe: 'AI 閲覧中',
    agent: 'AI 操作中',
    user: 'ユーザーが引き継ぎ中',
  },

  roles: {
    owner: 'オーナー',
    admin: '管理者',
    member: 'メンバー',
  },
  roleDescriptions: {
    owner: 'メンバーの招待、ロールの変更、メンバーの削除を含むすべての権限があります。',
    admin: 'プロジェクト、API キー、アクセスポリシー、デバイス、招待を管理し、監査ログとメンバー一覧を閲覧できます。',
    member: 'プロジェクトとデバイスを閲覧し、ユーザーへの接続の招待、接続テスト、セッションの終了、監査ログの閲覧ができます。',
  },

  levels: {
    observe: {
      label: '閲覧のみ',
      description: 'スナップショット、スクリーンショット、console、ネットワークリクエスト一覧、テキストの待機。ページは変更できません。',
    },
    interact: {
      label: '閲覧と操作',
      description: '「閲覧のみ」のすべてに加え、クリック、入力、選択、スクロール、ドラッグ、遷移、戻る、再読み込みができます。',
    },
    advanced: {
      label: '高度',
      description: '「閲覧と操作」のすべてに加え、ページ内での任意の JS の実行、リクエストのヘッダーと本文の閲覧、localStorage / cookie の読み取りができます。',
    },
  },
  levelTitle: (label, level, description) => `${label}（${level}）：${description}`,

  maskPresets: {
    phone: '電話番号（中国）',
    idCard: '身分証番号（中国）',
    bankCard: '銀行カード番号',
    email: 'メールアドレス',
  },
  regex: {
    empty: '正規表現を入力してください',
    matchesEmpty: '空文字列に一致するため、すべてのテキストがマスクされてしまいます',
    syntax: (detail) => `正規表現が無効です：${detail}`,
    lookaround: '先読み・後読み（(?=、(?!、(?<=、(?<!）はサポートされていません。ゲートウェイは RE2 構文を使用します',
    backreference: '後方参照（\\1 など）はサポートされていません。ゲートウェイは RE2 構文を使用します',
  },

  badges: {
    help: '対応中',
    agentWithName: (label, agent) => `${label}（${agent}）`,
    waitingConfirmAction: 'ユーザーの操作確認待ち',
    waitingConfirm: 'ユーザーの承認待ち',
    waitingTitle: (agent) => `${agent} はユーザーがデバイス上で承認するのを待っています`,
    invited: '招待',
    invitedTitle: '招待リンクから接続したデバイス',
  },

  api: {
    network: 'ゲートウェイに接続できません。ネットワークを確認してください。',
    unauthorized: 'セッションの有効期限が切れました。もう一度ログインしてください。',
    forbidden: 'この操作を行う権限がありません。',
    notFound: '見つかりません',
    server: 'ゲートウェイでエラーが発生しました。しばらくしてから再試行してください。',
    failed: (status) => `リクエストに失敗しました（HTTP ${status}）`,
    unknown: '不明なエラー',
    adminName: '管理者',
  },
}
