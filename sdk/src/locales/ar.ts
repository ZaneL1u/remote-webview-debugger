import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// العربية (من اليمين إلى اليسار).

const ui: UiMessages = {
  levels: {
    observe: 'العرض فقط',
    interact: 'العرض والتفاعل',
    advanced: 'متقدّم (تشغيل السكربتات وقراءة التخزين)',
  },
  attachLevels: {
    observe: 'العرض فقط',
    interact: 'العرض والتفاعل',
    advanced: 'متقدّم (يضيف تشغيل السكربتات وقراءة التخزين)',
  },
  state: {
    none: 'خامل: لا يوجد ذكاء اصطناعي مرتبط',
    observe: 'الذكاء الاصطناعي يعرض هذه الصفحة',
    agent: 'الذكاء الاصطناعي يتحكم، وإدخالك متوقف مؤقتًا',
    user: 'تولّيت التحكم، والذكاء الاصطناعي متوقف مؤقتًا',
  },
  link: {
    connecting: 'جارٍ الاتصال',
    online: 'متصل',
    offline: 'غير متصل',
  },
  connecting: 'جارٍ الاتصال…',
  helpPending: 'قيد المساعدة',
  copy: 'نسخ',
  copied: 'تم النسخ',
  noteHelp: 'تم طلب المساعدة. سيعثر عليك المطوّر من خلال رمز الجهاز هذا.',
  noteAuto: 'السماح التلقائي مفعّل: يرتبط الذكاء الاصطناعي دون سؤال، ويمكنك تولّي التحكم أو الإنهاء في أي وقت.',
  noteShare: 'يُرجى مشاركة رمز الجهاز هذا مع المطوّر. يطلب الذكاء الاصطناعي الإذن قبل الربط، ويمكنك تولّي التحكم أو الإنهاء في أي وقت.',
  help: 'طلب المساعدة',
  cancelHelp: 'إلغاء الطلب',
  collapse: 'إخفاء',
  deviceCode: 'رمز الجهاز',
  barViewing: 'المساعد يشاهد',
  barAgent: 'المساعد يعمل',
  barUser: 'أنت تتحكم',
  connectedFor: time => `متصل · ${time}`,
  takeover: 'تولّي التحكم',
  handback: 'إعادة التحكم',
  end: 'إنهاء',
  autoTitle: 'السماح التلقائي للذكاء الاصطناعي',
  autoOn: level => `يرتبط دون سؤال · ${level}`,
  autoOff: 'السؤال في كل مرة يطلب فيها الذكاء الاصطناعي الربط',
  lockTitle: 'قفل الشاشة أثناء ربط الذكاء الاصطناعي',
  lockOn: 'تُحظر نقراتك وتمريراتك ما دام الذكاء الاصطناعي مرتبطًا',
  lockOff: 'يظل بإمكانك النقر والتمرير، مع تجنّب اعتراض عمل الذكاء الاصطناعي',
  lockedToast: 'ستُقفل الشاشة أثناء ربط الذكاء الاصطناعي',
  unlockedToast: 'لن تُقفل الشاشة أثناء ربط الذكاء الاصطناعي',
  autoOffToast: 'أُوقف السماح التلقائي. سيطلب الذكاء الاصطناعي الإذن قبل الربط',
  autoDialogTitle: 'تفعيل السماح التلقائي؟',
  autoDialogText:
    'عندما يطلب الذكاء الاصطناعي الربط بهذا الجهاز، يرتبط فورًا بمستوى الوصول المحدد أدناه. سيظهر إشعار في كل مرة، ويمكنك تولّي التحكم أو الإنهاء في أي وقت، وإيقاف هذا الخيار من هنا.',
  turnOn: 'تفعيل',
  cancel: 'إلغاء',
  autoOnToast: level => `السماح التلقائي مفعّل · ${level}`,
  countdown: seconds => `رفض تلقائي خلال ${seconds} ث`,

  agentName: 'مساعد الذكاء الاصطناعي',
  autoAllowedToast: (agent, level) => `سُمح تلقائيًا لـ«${agent}» · ${level}`,
  attachTitle: 'الذكاء الاصطناعي يطلب الربط',
  attachText: agent => `يطلب «${agent}» عرض هذه الصفحة. السماح بذلك؟`,
  confirmTitle: 'يُرجى التأكيد',
  confirmText: action => `يريد الذكاء الاصطناعي ${action}. السماح بذلك؟`,
  allow: 'سماح',
  deny: 'رفض',
}

const agent: AgentMessages = {
  missingParam: name => `معامل مفقود: ${name}`,
  notString: name => `يجب أن يكون المعامل ${name} سلسلة نصية`,
  unknownMethod: method => `طريقة غير معروفة: ${method}`,
  needLevel: level => `يتطلب المستوى ${level}`,
  takenOver: 'تولّى المستخدم التحكم؛ انتظر حتى يعيده',
  userDenied: 'رفض المستخدم هذا الإجراء',
  confirmBusy: 'ما زال المستخدم لم يؤكد الإجراء السابق بعد',

  unknownModifier: m => `مفتاح تعديل غير معروف: ${m}`,
  unknownKey: key => `مفتاح غير معروف: ${key}`,

  refNotInSnapshot: ref => `ref=${ref} غير موجود في أحدث لقطة؛ خذ لقطة جديدة`,
  refDetached: ref => `العنصر المقابل لـ ref=${ref} لم يعد موجودًا في الصفحة؛ خذ لقطة جديدة`,
  queryNeedsCriteria: 'يلزم واحد على الأقل من text أو role أو name',
  noSuchRecord: seq => `لا يوجد سجل seq=${seq} في سجل الجلسة (ربما حُذف)`,
  noSuchSession: id => `لا يوجد سجل الجلسة ${id} على هذا الجهاز (تُحفظ آخر 3 عمليات تشغيل فقط)`,
  noSessionLog: 'لا يوجد سجل جلسة على هذا الجهاز بعد (ربما أوقف المشروع التسجيل، أو مرّرت الصفحة run({ record: false }))',
  sessionLogUnavailable: 'IndexedDB غير متاح في هذه الصفحة: لا يوجد سجل جلسة',

  readOnly: tag => `${tag} للقراءة فقط`,
  isSelect: tag => `${tag} قائمة منسدلة؛ استخدم rwd.select`,
  notFillable: tag => `${tag} ليس حقل نص ولا يمكن ملؤه`,
  notSelect: tag => `${tag} ليس قائمة منسدلة (select)؛ استخدم click`,
  singleSelect: 'تسمح هذه القائمة المنسدلة بخيار واحد فقط',
  noSuchOption: (value, choices) => `لا يوجد في القائمة المنسدلة الخيار «${value}»؛ الخيارات المتاحة: ${choices.join('، ')}`,
  optionDisabled: value => `الخيار «${value}» معطّل`,

  badUrl: url => `عنوان URL غير صالح: ${url}`,
  httpOnly: 'لا يمكن فتح إلا عناوين http(s)',
  textAppearTimeout: text => `انتهت المهلة في انتظار ظهور النص «${text}»`,
  textGoneTimeout: text => `انتهت المهلة في انتظار اختفاء النص «${text}»`,
  badFunction: message => `تعذّر تحليل function: ${message}`,
  notAFunction: 'يجب أن تكون function تعبير دالة، مثل "() => document.title"',

  elementDetached: tag => `العنصر ${tag} لم يعد موجودًا في الصفحة؛ خذ لقطة جديدة`,
  notActionable: (tag, reason) => `لا يمكن التعامل مع العنصر ${tag}: ${reason}`,
  notVisible: tag => `العنصر ${tag} غير مرئي`,
  reasonMoving: 'موضعه يتغير باستمرار (ربما يتحرك في رسم متحرك)',
  reasonOffscreen: 'يقع خارج منطقة العرض',
  reasonObscured: (tag, ref) =>
    `نقطة النقر مغطاة بـ ${tag} (ref=${ref}؛ انقر عليه مباشرة، مثل خلفية نافذة منبثقة لإغلاقها)`,

  overlayHeader: '[طبقات علوية] هذه العناصر فوق محتوى الصفحة. عندما تُحجب نقرة، انقر عليها مباشرة (مثل الخلفية لإغلاق نافذة منبثقة):',
  overlayMask: (tag, coverage, ref) => `- خلفية ${tag}، تغطي ${coverage}% من منطقة العرض [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- طبقة ${tag}${text ? ` «${text}»` : ''}، تغطي ${coverage}% من منطقة العرض [ref=${ref}]`,
  reasonHidden: 'غير مرئي',
  reasonDisabled: 'معطّل',

  storageUnavailable: area => `${area}Storage غير متاح`,
  badStorageArea: "يجب أن يكون المعامل area إحدى القيم 'local' أو 'session' أو 'cookie'",

  requestFailed: 'فشل الطلب',
  noSuchRequest: id => `لا يوجد طلب id=${id} (ربما أُسقط)`,
  netFailed: (what, error) => `${what} → فشل (${error})`,
  wsFailed: url => `WebSocket ${url} → فشل`,

  tapped: (role, text) => `نقرة على ${role} «${text}»`,
  tappedTag: (role, tag) => `نقرة على ${role} ${tag}`,
  roles: {
    button: 'زر',
    link: 'رابط',
    textbox: 'حقل نص',
    searchbox: 'حقل بحث',
    checkbox: 'مربع اختيار',
    radio: 'زر اختيار',
    switch: 'مفتاح تبديل',
    combobox: 'قائمة منسدلة',
    listbox: 'قائمة',
    option: 'خيار',
    tab: 'علامة تبويب',
    menuitem: 'عنصر قائمة',
    img: 'صورة',
    heading: 'عنوان',
    cell: 'خلية',
    row: 'صف',
    listitem: 'عنصر قائمة',
  },
  element: 'عنصر',
}

const action: ActionMessages = {
  quote: name => `«${name}»`,
  click: target => `النقر على ${target}`,
  enterActivate: target => `الضغط على Enter في ${target}`,
  enterSubmit: target => `الضغط على Enter لإرسال ${target}`,
}

const ar: Locale = { id: 'ar', name: 'العربية', dir: 'rtl', ui, action, agent }

export default ar
