import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// 日本語。

/** Starts with a Latin letter or digit: put a space before it after Japanese text. */
const latin = (text: string) => /^[A-Za-z0-9<]/.test(text)

const ui: UiMessages = {
  levels: {
    observe: '閲覧のみ',
    interact: '閲覧と操作',
    advanced: '高度（スクリプト実行、ストレージ読み取り）',
  },
  attachLevels: {
    observe: '閲覧のみ',
    interact: '閲覧と操作',
    advanced: '高度（さらにスクリプト実行、ストレージ読み取り）',
  },
  state: {
    none: '待機中：AI は接続されていません',
    observe: 'AI がこのページを閲覧しています',
    agent: 'AI が操作中です。あなたの入力は一時停止しています',
    user: 'あなたが引き継ぎました。AI は一時停止中です',
  },
  link: {
    connecting: '接続中',
    online: 'オンライン',
    offline: 'オフライン',
  },
  connecting: '接続中…',
  helpPending: '対応中',
  copy: 'コピー',
  copied: 'コピー済み',
  noteHelp: 'サポートを依頼しました。開発者がこのデバイスコードであなたを見つけます。',
  noteAuto: '自動許可がオンです。AI は確認なしで接続します。いつでも引き継ぎや終了ができます。',
  noteShare: 'このデバイスコードを開発者に伝えてください。AI は接続する前に確認を求めます。接続後もいつでも引き継ぎや終了ができます。',
  help: 'サポートを依頼',
  cancelHelp: '依頼を取り消す',
  collapse: '閉じる',
  deviceCode: 'デバイスコード',
  barViewing: 'AI 閲覧中',
  barAgent: 'AI 操作中',
  barUser: '手動操作中',
  connectedFor: time => `接続中 · ${time}`,
  takeover: '引き継ぐ',
  handback: 'AI に戻す',
  end: '終了',
  autoTitle: 'AI の接続を自動許可',
  autoOn: level => `確認なしで接続 · ${level}`,
  autoOff: 'AI が接続しようとするたびに確認します',
  lockTitle: 'AI の接続中は画面をロック',
  lockOn: 'AI の接続中は、タップやスワイプが無効になります',
  lockOff: 'タップやスクロールはできますが、AI の操作を妨げないようご注意ください',
  lockedToast: 'AI の接続中は画面をロックします',
  unlockedToast: 'AI の接続中も画面をロックしません',
  autoOffToast: '自動許可をオフにしました。AI は接続前に確認します',
  autoDialogTitle: '自動許可をオンにしますか？',
  autoDialogText:
    'AI がこのデバイスへの接続を求めると、下で選んだ権限ですぐに接続します。接続のたびに通知が表示され、いつでも引き継ぎや終了ができます。この設定はここでオフにできます。',
  turnOn: 'オンにする',
  cancel: 'キャンセル',
  autoOnToast: level => `自動許可オン · ${level}`,
  countdown: seconds => `${seconds} 秒後に自動で拒否`,

  agentName: 'AI アシスタント',
  autoAllowedToast: (agent, level) => `「${agent}」を自動許可しました · ${level}`,
  attachTitle: 'AI が接続を求めています',
  attachText: agent => `「${agent}」がこのページの閲覧を求めています。許可しますか？`,
  confirmTitle: '確認してください',
  confirmText: action => `AI が${latin(action) ? ' ' : ''}${action}しようとしています。許可しますか？`,
  allow: '許可',
  deny: '拒否',
}

const agent: AgentMessages = {
  missingParam: name => `パラメータ ${name} がありません`,
  notString: name => `パラメータ ${name} は文字列である必要があります`,
  unknownMethod: method => `不明なメソッド：${method}`,
  needLevel: level => `${level} レベルが必要です`,
  takenOver: 'ユーザーが引き継ぎました。ユーザーが操作を戻すまで待ってください',
  userDenied: 'ユーザーがこの操作を拒否しました',
  confirmBusy: '前の操作についてユーザーの確認を待っています',

  unknownModifier: m => `不明な修飾キー：${m}`,
  unknownKey: key => `不明なキー：${key}`,

  refNotInSnapshot: ref => `ref=${ref} は最新のスナップショットにありません。スナップショットを取り直してください`,
  refDetached: ref => `ref=${ref} の要素はもうページ上にありません。スナップショットを取り直してください`,
  queryNeedsCriteria: 'text、role、name のいずれか 1 つ以上が必要です',
  noSuchRecord: seq => `セッションログに seq=${seq} のレコードがありません（削除された可能性があります）`,
  noSuchSession: id => `このデバイスにセッションログ ${id} はありません（保持されるのは直近 3 回の起動分のみです）`,
  noSessionLog:
    'このデバイスにはまだセッションログがありません（プロジェクトで記録がオフになっているか、ページが run({ record: false }) を指定している可能性があります）',
  sessionLogUnavailable: 'このページでは IndexedDB を使用できないため、セッションログはありません',

  readOnly: tag => `${tag} は読み取り専用です`,
  isSelect: tag => `${tag} はドロップダウンです。rwd.select を使ってください`,
  notFillable: tag => `${tag} はテキスト入力欄ではないため、入力できません`,
  notSelect: tag => `${tag} はドロップダウン（select）ではありません。click を使ってください`,
  singleSelect: 'このドロップダウンでは 1 つしか選択できません',
  noSuchOption: (value, choices) => `ドロップダウンに選択肢「${value}」はありません。選択可能：${choices.join('、')}`,
  optionDisabled: value => `選択肢「${value}」は無効です`,

  badUrl: url => `無効な URL：${url}`,
  httpOnly: '開けるのは http(s) の URL のみです',
  textAppearTimeout: text => `テキスト「${text}」の表示を待機中にタイムアウトしました`,
  textGoneTimeout: text => `テキスト「${text}」の消失を待機中にタイムアウトしました`,
  badFunction: message => `function を解析できません：${message}`,
  notAFunction: 'function は関数式である必要があります（例："() => document.title"）',

  elementDetached: tag => `要素 ${tag} はもうページ上にありません。スナップショットを取り直してください`,
  notActionable: (tag, reason) => `要素 ${tag} を操作できません：${reason}`,
  notVisible: tag => `要素 ${tag} は表示されていません`,
  reasonMoving: '位置が変化し続けています（アニメーション中の可能性があります）',
  reasonOffscreen: 'ビューポートの外にあります',
  reasonObscured: (tag, ref) =>
    `クリック位置が ${tag} に覆われています（ref=${ref}。この要素を直接 click できます。例：背景のオーバーレイをクリックしてポップアップを閉じる）`,

  overlayHeader:
    '[オーバーレイ] 以下の要素がページの上に重なっています。クリックが遮られる場合は、これらを直接クリックしてください（例：背景のオーバーレイをクリックしてポップアップを閉じる）：',
  overlayMask: (tag, coverage, ref) => `- 背景オーバーレイ ${tag}、ビューポートの ${coverage}% を覆う [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- レイヤー ${tag}${text ? `「${text}」` : ''}、ビューポートの ${coverage}% を覆う [ref=${ref}]`,
  reasonHidden: '表示されていません',
  reasonDisabled: '無効になっています',

  storageUnavailable: area => `${area}Storage は使用できません`,
  badStorageArea: "パラメータ area は 'local'、'session'、'cookie' のいずれかである必要があります",

  requestFailed: 'リクエストに失敗しました',
  noSuchRequest: id => `id=${id} のリクエストはありません（破棄された可能性があります）`,
  netFailed: (what, error) => `${what} → 失敗（${error}）`,
  wsFailed: url => `WebSocket ${url} → 失敗`,

  tapped: (role, text) => `${role}「${text}」をタップしました`,
  tappedTag: (role, tag) => `${role} ${tag} をタップしました`,
  roles: {
    button: 'ボタン',
    link: 'リンク',
    textbox: 'テキスト入力欄',
    searchbox: '検索欄',
    checkbox: 'チェックボックス',
    radio: 'ラジオボタン',
    switch: 'スイッチ',
    combobox: 'ドロップダウン',
    listbox: 'リスト',
    option: '選択肢',
    tab: 'タブ',
    menuitem: 'メニュー項目',
    img: '画像',
    heading: '見出し',
    cell: 'セル',
    row: '行',
    listitem: 'リスト項目',
  },
  element: '要素',
}

// Completes 「AI が…しようとしています」 (ui.confirmText). The target is a
// quoted name (「購入」) or, without one, a Latin tag that needs spaces around it.
const pad = (target: string) => (latin(target) ? ` ${target} ` : target)
const action: ActionMessages = {
  quote: name => `「${name}」`,
  click: target => `${pad(target).trimStart()}をクリック`,
  enterActivate: target => `${pad(target).trimStart()}で Enter キーを押下`,
  enterSubmit: target => `Enter キーで${pad(target)}を送信`,
}

const ja: Locale = { id: 'ja', name: '日本語', dir: 'ltr', ui, action, agent }

export default ja
