import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// Русский.

const ui: UiMessages = {
  levels: {
    observe: 'Только просмотр',
    interact: 'Просмотр и управление',
    advanced: 'Расширенный (скрипты, чтение хранилища)',
  },
  attachLevels: {
    observe: 'Только просмотр',
    interact: 'Просмотр и управление',
    advanced: 'Расширенный (плюс скрипты, чтение хранилища)',
  },
  state: {
    none: 'Ожидание: ИИ не подключён',
    observe: 'ИИ просматривает эту страницу',
    agent: 'ИИ управляет, ваш ввод приостановлен',
    user: 'Вы взяли управление, ИИ на паузе',
  },
  link: {
    connecting: 'Подключение',
    online: 'В сети',
    offline: 'Не в сети',
  },
  connecting: 'Подключение…',
  helpPending: 'Идёт поддержка',
  copy: 'Копировать',
  copied: 'Скопировано',
  noteHelp: 'Поддержка запрошена. Разработчик найдёт вас по этому коду устройства.',
  noteAuto: 'Автоматическое разрешение включено: ИИ подключается без вопросов. Вы можете в любой момент взять управление или завершить.',
  noteShare:
    'Сообщите этот код устройства разработчику. ИИ спросит разрешения перед подключением, а вы сможете в любой момент взять управление или завершить.',
  help: 'Запросить поддержку',
  cancelHelp: 'Отменить запрос',
  collapse: 'Свернуть',
  deviceCode: 'Код устройства',
  barViewing: 'ИИ смотрит',
  barAgent: 'ИИ работает',
  barUser: 'Управляете вы',
  connectedFor: time => `Подключено · ${time}`,
  takeover: 'Перехватить',
  handback: 'Вернуть ИИ',
  end: 'Завершить',
  autoTitle: 'Автоматическое разрешение',
  autoOn: level => `Подключается без вопросов · ${level}`,
  autoOff: 'Спрашивать каждый раз, когда ИИ хочет подключиться',
  lockTitle: 'Блокировать экран, пока подключён ИИ',
  lockOn: 'Пока подключён ИИ, ваши касания и свайпы блокируются',
  lockOff: 'Вы можете касаться и прокручивать, но постарайтесь не мешать ИИ',
  lockedToast: 'Экран будет заблокирован, пока подключён ИИ',
  unlockedToast: 'Экран не будет блокироваться, пока подключён ИИ',
  autoOffToast: 'Автоматическое разрешение выключено. ИИ спросит перед подключением',
  autoDialogTitle: 'Включить автоматическое разрешение?',
  autoDialogText:
    'Когда ИИ попросит подключиться к этому устройству, он сразу подключится с выбранным ниже уровнем доступа. Каждый раз вы увидите уведомление, сможете в любой момент взять управление или завершить, а выключить эту функцию можно здесь.',
  turnOn: 'Включить',
  cancel: 'Отмена',
  autoOnToast: level => `Автоматическое разрешение включено · ${level}`,
  countdown: seconds => `Автоотказ через ${seconds} с`,

  agentName: 'ИИ-ассистент',
  autoAllowedToast: (agent, level) => `«${agent}» подключён автоматически · ${level}`,
  attachTitle: 'ИИ хочет подключиться',
  attachText: agent => `«${agent}» хочет просматривать эту страницу. Разрешить?`,
  confirmTitle: 'Подтвердите действие',
  confirmText: action => `ИИ хочет ${action}. Разрешить?`,
  allow: 'Разрешить',
  deny: 'Отклонить',
  developer: 'Разработчик',
  devtoolsTitle: 'Разработчик хочет отладить страницу',
  devtoolsText: name =>
    `«${name}» хочет изучить эту страницу в DevTools: будут видны её структура, логи, сетевые запросы и локальное хранилище, и можно будет выполнять на ней скрипты. Разрешить?`,
  devtoolsToast: name => `«${name}» открыл DevTools`,
  barDevtools: 'Идёт отладка',
  nameSep: ', ',
}

const agent: AgentMessages = {
  missingParam: name => `Не указан параметр: ${name}`,
  notString: name => `Параметр ${name} должен быть строкой`,
  unknownMethod: method => `Неизвестный метод: ${method}`,
  needLevel: level => `Требуется уровень ${level}`,
  takenOver: 'Пользователь взял управление; дождитесь, пока он вернёт управление',
  userDenied: 'Пользователь отклонил это действие',
  confirmBusy: 'Пользователь ещё не подтвердил предыдущее действие',

  unknownModifier: m => `Неизвестная клавиша-модификатор: ${m}`,
  unknownKey: key => `Неизвестная клавиша: ${key}`,

  refNotInSnapshot: ref => `ref=${ref} нет в последнем снимке; сделайте новый снимок`,
  refDetached: ref => `Элемента с ref=${ref} больше нет на странице; сделайте новый снимок`,
  queryNeedsCriteria: 'Нужен хотя бы один из параметров: text, role или name',
  noSuchRecord: seq => `В журнале сеанса нет записи seq=${seq} (возможно, она уже удалена)`,
  noSuchSession: id => `На этом устройстве нет журнала сеанса ${id} (хранятся только 3 последних запуска)`,
  noSessionLog:
    'На этом устройстве пока нет журнала сеанса (возможно, в проекте отключена запись или страница передала run({ record: false }))',
  sessionLogUnavailable: 'На этой странице недоступен IndexedDB, поэтому журнала сеанса нет',

  readOnly: tag => `${tag} доступен только для чтения`,
  isSelect: tag => `${tag} — выпадающий список; используйте rwd.select`,
  notFillable: tag => `${tag} не является текстовым полем, заполнить его нельзя`,
  notSelect: tag => `${tag} не является выпадающим списком (select); используйте click`,
  singleSelect: 'В этом выпадающем списке можно выбрать только один вариант',
  noSuchOption: (value, choices) => `В выпадающем списке нет варианта «${value}»; доступны: ${choices.join(', ')}`,
  optionDisabled: value => `Вариант «${value}» отключён`,

  badUrl: url => `Недопустимый URL: ${url}`,
  httpOnly: 'Открывать можно только URL http(s)',
  textAppearTimeout: text => `Истекло время ожидания появления текста «${text}»`,
  textGoneTimeout: text => `Истекло время ожидания исчезновения текста «${text}»`,
  badFunction: message => `Не удалось разобрать function: ${message}`,
  notAFunction: 'function должен быть функциональным выражением, например "() => document.title"',

  elementDetached: tag => `Элемента ${tag} больше нет на странице; сделайте новый снимок`,
  notActionable: (tag, reason) => `С элементом ${tag} нельзя взаимодействовать: ${reason}`,
  notVisible: tag => `Элемент ${tag} не виден`,
  reasonMoving: 'его положение всё время меняется (возможно, идёт анимация)',
  reasonOffscreen: 'он за пределами области просмотра',
  reasonObscured: (tag, ref) =>
    `точку нажатия перекрывает ${tag} (ref=${ref}; нажмите на него напрямую, например на фон всплывающего окна, чтобы закрыть его)`,

  overlayHeader:
    '[Оверлеи] Эти элементы лежат поверх страницы. Если нажатие перекрыто, нажимайте на них напрямую (например, на фон, чтобы закрыть всплывающее окно):',
  overlayMask: (tag, coverage, ref) => `- фон ${tag}, закрывает ${coverage}% области просмотра [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- слой ${tag}${text ? ` «${text}»` : ''}, закрывает ${coverage}% области просмотра [ref=${ref}]`,
  reasonHidden: 'он не виден',
  reasonDisabled: 'он отключён',

  storageUnavailable: area => `${area}Storage недоступен`,
  badStorageArea: "Параметр area должен быть 'local', 'session' или 'cookie'",

  requestFailed: 'Запрос не выполнен',
  noSuchRequest: id => `Нет запроса с id=${id} (возможно, он уже отброшен)`,
  netFailed: (what, error) => `${what} → ошибка (${error})`,
  wsFailed: url => `WebSocket ${url} → ошибка`,

  tapped: (role, text) => `Нажатие: ${role} «${text}»`,
  tappedTag: (role, tag) => `Нажатие: ${role} ${tag}`,
  roles: {
    button: 'кнопка',
    link: 'ссылка',
    textbox: 'текстовое поле',
    searchbox: 'поле поиска',
    checkbox: 'флажок',
    radio: 'переключатель',
    switch: 'тумблер',
    combobox: 'выпадающий список',
    listbox: 'список',
    option: 'вариант',
    tab: 'вкладка',
    menuitem: 'пункт меню',
    img: 'изображение',
    heading: 'заголовок',
    cell: 'ячейка',
    row: 'строка',
    listitem: 'элемент списка',
  },
  element: 'элемент',
  devtoolsHistory: (count, dropped) =>
    `—— Записей лога до открытия DevTools: ${count} (только текст, объекты не раскрываются${dropped ? `; ещё ${dropped} отброшено` : ''}) ——`,
}

const action: ActionMessages = {
  quote: name => `«${name}»`,
  click: target => `нажать ${target}`,
  enterActivate: target => `нажать Enter на ${target}`,
  enterSubmit: target => `нажать Enter и отправить ${target}`,
}

const ru: Locale = { id: 'ru', name: 'Русский', dir: 'ltr', ui, action, agent }

export default ru
