import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// 한국어.

/**
 * 앞말의 받침에 맞는 조사(을/를, 이/가…)를 고릅니다. 한글 음절이나 숫자로
 * 끝나면 받침으로 판단하고, 그 밖에는 “을(를)”처럼 두 형태를 함께 씁니다.
 */
function josa(word: string, withFinal: string, withoutFinal: string) {
  const s = word.replace(/[\s"'“”‘’)\]」』]+$/, '')
  const c = s.charCodeAt(s.length - 1)
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? withFinal : withoutFinal
  const digit = '0123456789'.indexOf(s.charAt(s.length - 1))
  if (digit >= 0) return '0136780'.includes(String(digit)) ? withFinal : withoutFinal
  return `${withFinal}(${withoutFinal})`
}

const ui: UiMessages = {
  levels: {
    observe: '보기 전용',
    interact: '보기 및 조작',
    advanced: '고급(스크립트 실행, 저장소 읽기)',
  },
  attachLevels: {
    observe: '보기 전용',
    interact: '보기 및 조작',
    advanced: '고급(스크립트 실행, 저장소 읽기도 가능)',
  },
  state: {
    none: '대기 중: 접속한 AI 없음',
    observe: 'AI가 이 페이지를 보고 있어요',
    agent: 'AI가 조작 중이에요. 그동안 입력이 멈춰요',
    user: '직접 조작 중이에요. AI는 잠시 멈췄어요',
  },
  link: {
    connecting: '연결 중',
    online: '온라인',
    offline: '오프라인',
  },
  connecting: '연결 중…',
  helpPending: '도움 요청 중',
  copy: '복사',
  copied: '복사됨',
  noteHelp: '도움을 요청했어요. 개발자가 이 기기 코드로 찾아올 거예요.',
  noteAuto: '자동 허용이 켜져 있어요. AI가 묻지 않고 접속해요. 언제든 직접 조작하거나 종료할 수 있어요.',
  noteShare: '이 기기 코드를 개발자에게 알려 주세요. AI는 접속하기 전에 먼저 물어보고, 언제든 직접 조작하거나 종료할 수 있어요.',
  help: '도움 요청',
  cancelHelp: '요청 취소',
  collapse: '숨기기',
  deviceCode: '기기 코드',
  barViewing: 'AI 보는 중',
  barAgent: 'AI 조작 중',
  barUser: '직접 조작 중',
  connectedFor: time => `연결됨 · ${time}`,
  takeover: '직접 조작',
  handback: 'AI에 맡기기',
  end: '종료',
  autoTitle: 'AI 자동 허용',
  autoOn: level => `묻지 않고 접속 · ${level}`,
  autoOff: 'AI가 접속하려고 할 때마다 물어봐요',
  lockTitle: 'AI 접속 중 화면 잠금',
  lockOn: 'AI가 접속해 있는 동안 탭과 스와이프가 막혀요',
  lockOff: 'AI가 접속해 있어도 탭하고 스크롤할 수 있어요. AI 조작을 방해하지 않게 주의해 주세요',
  lockedToast: 'AI가 접속해 있는 동안 화면이 잠겨요',
  unlockedToast: 'AI가 접속해 있어도 화면을 잠그지 않아요',
  autoOffToast: '자동 허용을 껐어요. AI가 접속 전에 물어봐요',
  autoDialogTitle: '자동 허용을 켤까요?',
  autoDialogText:
    'AI가 이 기기에 접속을 요청하면 묻지 않고 아래에서 고른 권한으로 바로 접속해요. 접속할 때마다 화면에 알림이 표시되고, 언제든 직접 조작하거나 종료할 수 있어요. 이 설정은 여기서 다시 끌 수 있어요.',
  turnOn: '켜기',
  cancel: '취소',
  autoOnToast: level => `자동 허용 켜짐 · ${level}`,
  countdown: seconds => `${seconds}초 후 자동 거부`,

  agentName: 'AI 어시스턴트',
  autoAllowedToast: (agent, level) => `“${agent}” 자동 허용됨 · ${level}`,
  attachTitle: 'AI 접속 요청',
  attachText: agent => `“${agent}”${josa(agent, '이', '가')} 이 페이지를 보려고 해요. 허용할까요?`,
  confirmTitle: '확인이 필요해요',
  confirmText: action => `AI가 ${action}${josa(action, '을', '를')} 요청했어요. 허용할까요?`,
  allow: '허용',
  deny: '거부',
}

const agent: AgentMessages = {
  missingParam: name => `매개변수가 없습니다: ${name}`,
  notString: name => `${name} 매개변수는 문자열이어야 합니다`,
  unknownMethod: method => `알 수 없는 메서드: ${method}`,
  needLevel: level => `${level} 권한 수준이 필요합니다`,
  takenOver: '사용자가 직접 조작으로 전환했습니다. 사용자가 다시 맡길 때까지 기다리세요',
  userDenied: '사용자가 이 작업을 거부했습니다',
  confirmBusy: '이전 작업에 대한 사용자 확인을 아직 기다리는 중입니다',

  unknownModifier: m => `알 수 없는 보조 키: ${m}`,
  unknownKey: key => `알 수 없는 키: ${key}`,

  refNotInSnapshot: ref => `ref=${ref} 항목이 최근 스냅샷에 없습니다. 스냅샷을 다시 가져오세요`,
  refDetached: ref => `ref=${ref}에 해당하는 요소가 더 이상 페이지에 없습니다. 스냅샷을 다시 가져오세요`,
  queryNeedsCriteria: 'text, role, name 중 하나 이상이 필요합니다',
  noSuchRecord: seq => `세션 로그에 seq=${seq} 기록이 없습니다(이미 정리되었을 수 있습니다)`,
  noSuchSession: id => `이 기기에는 세션 ${id}의 로그가 없습니다(최근 3회 실행분만 보관됩니다)`,
  noSessionLog:
    '이 기기에는 아직 세션 로그가 없습니다(프로젝트에서 기록을 껐거나, 페이지가 run({ record: false })로 기록을 껐을 수 있습니다)',
  sessionLogUnavailable: '이 페이지에서는 IndexedDB를 사용할 수 없어 세션 로그가 없습니다',

  readOnly: tag => `${tag} 요소는 읽기 전용입니다`,
  isSelect: tag => `${tag} 요소는 드롭다운입니다. rwd.select를 사용하세요`,
  notFillable: tag => `${tag} 요소는 텍스트 입력란이 아니라서 값을 입력할 수 없습니다`,
  notSelect: tag => `${tag} 요소는 드롭다운(select)이 아닙니다. click을 사용하세요`,
  singleSelect: '이 드롭다운은 옵션을 하나만 선택할 수 있습니다',
  noSuchOption: (value, choices) => `드롭다운에 “${value}” 옵션이 없습니다. 선택 가능한 옵션: ${choices.join(', ')}`,
  optionDisabled: value => `“${value}” 옵션은 비활성화되어 있습니다`,

  badUrl: url => `잘못된 URL: ${url}`,
  httpOnly: 'http(s) URL만 열 수 있습니다',
  textAppearTimeout: text => `“${text}” 텍스트가 나타나기를 기다리다 시간이 초과되었습니다`,
  textGoneTimeout: text => `“${text}” 텍스트가 사라지기를 기다리다 시간이 초과되었습니다`,
  badFunction: message => `function을 해석할 수 없습니다: ${message}`,
  notAFunction: 'function은 함수 표현식이어야 합니다. 예: "() => document.title"',

  elementDetached: tag => `${tag} 요소가 더 이상 페이지에 없습니다. 스냅샷을 다시 가져오세요`,
  notActionable: (tag, reason) => `${tag} 요소를 조작할 수 없습니다: ${reason}`,
  notVisible: tag => `${tag} 요소가 보이지 않습니다`,
  reasonMoving: '위치가 계속 바뀌고 있습니다(애니메이션 중일 수 있습니다)',
  reasonOffscreen: '뷰포트 밖에 있습니다',
  reasonObscured: (tag, ref) =>
    `클릭 지점이 ${tag} 요소에 가려져 있습니다(ref=${ref}. 이 요소를 직접 클릭할 수 있습니다. 예: 팝업 배경을 클릭해 팝업 닫기)`,

  overlayHeader: '[오버레이] 아래 요소들이 페이지 위를 덮고 있습니다. 클릭이 막히면 이 요소들을 직접 클릭하세요(예: 배경을 클릭해 팝업 닫기):',
  overlayMask: (tag, coverage, ref) => `- 배경 ${tag}, 뷰포트의 ${coverage}%를 덮음 [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- 레이어 ${tag}${text ? ` “${text}”` : ''}, 뷰포트의 ${coverage}%를 덮음 [ref=${ref}]`,
  reasonHidden: '보이지 않습니다',
  reasonDisabled: '비활성화되어 있습니다',

  storageUnavailable: area => `${area}Storage를 사용할 수 없습니다`,
  badStorageArea: "area 매개변수는 'local', 'session', 'cookie' 중 하나여야 합니다",

  requestFailed: '요청 실패',
  noSuchRequest: id => `id=${id} 요청이 없습니다(이미 버려졌을 수 있습니다)`,
  netFailed: (what, error) => `${what} → 실패(${error})`,
  wsFailed: url => `WebSocket ${url} → 실패`,

  tapped: (role, text) => `${role} “${text}” 탭함`,
  tappedTag: (role, tag) => `${role} ${tag} 탭함`,
  roles: {
    button: '버튼',
    link: '링크',
    textbox: '텍스트 입력란',
    searchbox: '검색창',
    checkbox: '체크박스',
    radio: '라디오 버튼',
    switch: '스위치',
    combobox: '드롭다운',
    listbox: '목록',
    option: '옵션',
    tab: '탭',
    menuitem: '메뉴 항목',
    img: '이미지',
    heading: '제목',
    cell: '셀',
    row: '행',
    listitem: '목록 항목',
  },
  element: '요소',
}

const action: ActionMessages = {
  quote: name => `“${name}”`,
  click: target => `${target} 클릭`,
  enterActivate: target => `${target}에서 Enter 키 누르기`,
  enterSubmit: target => `Enter 키로 ${target} 제출`,
}

const ko: Locale = { id: 'ko', name: '한국어', dir: 'ltr', ui, action, agent }

export default ko
