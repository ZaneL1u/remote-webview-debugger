import type { common as en } from '../en/common'

export const common: typeof en = {
  cancel: '취소',
  save: '저장',
  create: '만들기',
  delete: '삭제',
  close: '닫기',
  copy: '복사',
  copied: '클립보드에 복사했어요',
  copyFailed: '복사하지 못했어요. 텍스트를 선택해 직접 복사해 주세요.',
  retry: '다시 시도',
  loadFailed: '불러오지 못했어요',
  unknown: '알 수 없음',
  disabled: '비활성화됨',
  online: '온라인',
  offline: '오프라인',

  time: {
    justNow: '방금',
    secondsAgo: (n) => `${n}초 전`,
    minutesAgo: (n) => `${n}분 전`,
    hoursAgo: (n) => `${n}시간 전`,
    daysAgo: (n) => `${n}일 전`,
    expired: '만료됨',
    inMinutes: (n) => `${n}분 후`,
    inHours: (n) => `${n}시간 후`,
    inDays: (n) => `${n}일 후`,
    seconds: (n) => `${n}초`,
    minutes: (n) => `${n}분`,
    hoursMinutes: (h, m) => `${h}시간 ${m}분`,
    hours: (n) => `${n}시간`,
    daysHours: (d, h) => `${d}일 ${h}시간`,
    days: (n) => `${n}일`,
  },

  unknownDevice: '알 수 없는 기기',

  control: {
    none: '대기 중',
    observe: 'AI 보는 중',
    agent: 'AI 조작 중',
    user: '사용자 직접 조작 중',
  },

  roles: {
    owner: '소유자',
    admin: '관리자',
    member: '멤버',
  },
  roleDescriptions: {
    owner: '멤버 초대, 역할 변경, 멤버 삭제를 포함한 모든 권한이 있어요.',
    admin: '프로젝트, API 키, 접근 정책, 기기, 초대를 관리하고 감사 로그와 멤버 목록을 볼 수 있어요.',
    member: '프로젝트와 기기를 볼 수 있고, 사용자 접속 초대, 연결 테스트, 세션 종료, 감사 로그 보기를 할 수 있어요.',
  },

  levels: {
    observe: {
      label: '보기 전용',
      description: '스냅샷, 스크린샷, console, 네트워크 요청 목록, 텍스트 대기. 페이지를 바꿀 수 없어요.',
    },
    interact: {
      label: '보기 및 조작',
      description: '보기 전용의 모든 기능에 더해 클릭, 입력, 선택, 스크롤, 드래그, 페이지 이동, 뒤로 가기, 새로고침을 할 수 있어요.',
    },
    advanced: {
      label: '고급',
      description: '보기 및 조작의 모든 기능에 더해 페이지에서 임의의 JS 실행, 요청 헤더와 본문 읽기, localStorage / 쿠키 읽기를 할 수 있어요.',
    },
  },
  levelTitle: (label, level, description) => `${label}(${level}): ${description}`,

  maskPresets: {
    phone: '휴대폰 번호(중국)',
    idCard: '신분증 번호(중국)',
    bankCard: '은행 카드 번호',
    email: '이메일',
  },
  regex: {
    empty: '정규식을 입력해 주세요',
    matchesEmpty: '빈 문자열과 일치해서 모든 텍스트가 마스킹돼요',
    syntax: (detail) => `정규식이 올바르지 않아요: ${detail}`,
    lookaround: '전후방 탐색((?=, (?!, (?<=, (?<!)은 지원하지 않아요. 게이트웨이는 RE2 문법을 사용해요',
    backreference: '역참조(\\1 등)는 지원하지 않아요. 게이트웨이는 RE2 문법을 사용해요',
  },

  badges: {
    help: '지원 중',
    agentWithName: (label, agent) => `${label}(${agent})`,
    waitingConfirmAction: '사용자의 작업 확인 대기 중',
    waitingConfirm: '사용자 승인 대기 중',
    waitingTitle: (agent) => `${agent}: 사용자가 기기에서 승인하기를 기다리는 중`,
    invited: '초대됨',
    invitedTitle: '초대 링크로 접속한 기기',
  },

  api: {
    network: '게이트웨이에 연결할 수 없어요. 네트워크를 확인해 주세요.',
    unauthorized: '로그인이 만료되었어요. 다시 로그인해 주세요.',
    forbidden: '이 작업을 할 권한이 없어요.',
    notFound: '찾을 수 없어요',
    server: '게이트웨이 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
    failed: (status) => `요청에 실패했어요(HTTP ${status})`,
    unknown: '알 수 없는 오류',
    adminName: '관리자',
  },
}
