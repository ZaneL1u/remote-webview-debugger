import type { common as en } from '../en/common'

/** Russian plural: 1 день, 2 дня, 5 дней. */
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`

export const common: typeof en = {
  cancel: 'Отмена',
  save: 'Сохранить',
  create: 'Создать',
  delete: 'Удалить',
  close: 'Закрыть',
  copy: 'Копировать',
  copied: 'Скопировано в буфер обмена',
  copyFailed: 'Не удалось скопировать. Выделите текст и скопируйте его вручную.',
  retry: 'Повторить',
  loadFailed: 'Не удалось загрузить',
  unknown: 'Неизвестно',
  disabled: 'Отключён',
  online: 'В сети',
  offline: 'Не в сети',

  time: {
    justNow: 'только что',
    secondsAgo: (n) => `${n} с назад`,
    minutesAgo: (n) => `${n} мин назад`,
    hoursAgo: (n) => `${n} ч назад`,
    daysAgo: (n) => `${days(n)} назад`,
    expired: 'Срок истёк',
    inMinutes: (n) => `через ${n} мин`,
    inHours: (n) => `через ${n} ч`,
    inDays: (n) => `через ${days(n)}`,
    seconds: (n) => `${n} с`,
    minutes: (n) => `${n} мин`,
    hoursMinutes: (h, m) => `${h} ч ${m} мин`,
    hours: (n) => `${n} ч`,
    daysHours: (d, h) => `${d} д ${h} ч`,
    days,
  },

  unknownDevice: 'Неизвестное устройство',

  control: {
    none: 'Ожидание',
    observe: 'ИИ просматривает',
    agent: 'ИИ управляет',
    user: 'Пользователь взял управление',
  },

  roles: {
    owner: 'Владелец',
    admin: 'Администратор',
    member: 'Участник',
  },
  roleDescriptions: {
    owner: 'Полный доступ, включая приглашение участников, смену ролей и удаление участников.',
    admin: 'Управляет проектами, API-ключами, политиками доступа, устройствами и приглашениями; может открывать DevTools на страницах устройств, видит журнал аудита и список участников.',
    member: 'Видит проекты и устройства; может приглашать пользователей к подключению, проверять подключение, завершать сеансы и смотреть журнал аудита.',
  },

  levels: {
    observe: {
      label: 'Только просмотр',
      description: 'Снимки, скриншоты, console, список сетевых запросов, ожидание текста. Изменять страницу нельзя.',
    },
    interact: {
      label: 'Просмотр и управление',
      description: 'Всё из уровня «Только просмотр», а также нажатие, ввод, выбор, прокрутка, перетаскивание, переходы, возврат назад и перезагрузка.',
    },
    advanced: {
      label: 'Расширенный',
      description: 'Всё из уровня «Просмотр и управление», а также выполнение любого JS на странице, чтение заголовков и тел запросов, localStorage / cookie.',
    },
  },
  levelTitle: (label, level, description) => `${label} (${level}): ${description}`,

  maskPresets: {
    phone: 'Номер телефона (Китай)',
    idCard: 'Номер удостоверения личности (Китай)',
    bankCard: 'Номер банковской карты',
    email: 'Email',
  },
  regex: {
    empty: 'Введите регулярное выражение',
    matchesEmpty: 'Совпадает с пустой строкой и замаскирует весь текст',
    syntax: (detail) => `Недопустимое регулярное выражение: ${detail}`,
    lookaround: 'Просмотр вперёд и назад ((?=, (?!, (?<=, (?<!) не поддерживается: шлюз использует синтаксис RE2',
    backreference: 'Обратные ссылки (\\1 и т. п.) не поддерживаются: шлюз использует синтаксис RE2',
  },

  badges: {
    help: 'Идёт поддержка',
    agentWithName: (label, agent) => `${label} (${agent})`,
    waitingConfirmAction: 'Ждёт подтверждения действия',
    waitingConfirm: 'Ждёт одобрения пользователя',
    waitingDevtools: 'Ждёт одобрения DevTools',
    waitingTitle: (agent) => `${agent} ждёт, пока пользователь одобрит подключение на устройстве`,
    invited: 'По приглашению',
    invitedTitle: 'Подключено по ссылке-приглашению',
  },

  api: {
    network: 'Нет связи со шлюзом. Проверьте сеть.',
    unauthorized: 'Сеанс истёк. Войдите снова.',
    forbidden: 'У вас нет прав на это действие.',
    notFound: 'Не найдено',
    server: 'Ошибка шлюза. Повторите попытку позже.',
    failed: (status) => `Запрос не выполнен (HTTP ${status})`,
    unknown: 'Неизвестная ошибка',
    adminName: 'Администратор',
  },
}
