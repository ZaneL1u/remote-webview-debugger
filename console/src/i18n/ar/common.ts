import type { common as en } from '../en/common'

/** Arabic plural forms (CLDR): zero, one, two, few (3–10), many (11–99), other (100, 101…). `#` is the number. */
export type PluralForms = { zero?: string; one: string; two: string; few: string; many: string; other: string }

/** Picks the Arabic plural form for `n` and puts the number in place of `#`. */
export function plural(n: number, f: PluralForms): string {
  const m = n % 100
  const whole = Number.isInteger(n)
  const form =
    n === 0 && f.zero !== undefined
      ? f.zero
      : n === 1
        ? f.one
        : n === 2
          ? f.two
          : whole && m >= 3 && m <= 10
            ? f.few
            : whole && m >= 11 && m <= 99
              ? f.many
              : f.other
  return form.replace('#', String(n))
}

const seconds = (n: number) => plural(n, { one: 'ثانية واحدة', two: 'ثانيتان', few: '# ثوانٍ', many: '# ثانية', other: '# ثانية' })
const minutes = (n: number) => plural(n, { one: 'دقيقة واحدة', two: 'دقيقتان', few: '# دقائق', many: '# دقيقة', other: '# دقيقة' })
const hours = (n: number) => plural(n, { one: 'ساعة واحدة', two: 'ساعتان', few: '# ساعات', many: '# ساعة', other: '# ساعة' })
const days = (n: number) => plural(n, { one: 'يوم واحد', two: 'يومان', few: '# أيام', many: '# يومًا', other: '# يوم' })

export const common: typeof en = {
  cancel: 'إلغاء',
  save: 'حفظ',
  create: 'إنشاء',
  delete: 'حذف',
  close: 'إغلاق',
  copy: 'نسخ',
  copied: 'تم النسخ إلى الحافظة',
  copyFailed: 'تعذّر النسخ. يُرجى تحديد النص ونسخه يدويًا.',
  retry: 'إعادة المحاولة',
  loadFailed: 'تعذّر التحميل',
  unknown: 'غير معروف',
  disabled: 'معطّل',
  online: 'متصل',
  offline: 'غير متصل',

  time: {
    justNow: 'قبل لحظات',
    secondsAgo: (n) => plural(n, { one: 'منذ ثانية', two: 'منذ ثانيتين', few: 'منذ # ثوانٍ', many: 'منذ # ثانية', other: 'منذ # ثانية' }),
    minutesAgo: (n) => plural(n, { one: 'منذ دقيقة', two: 'منذ دقيقتين', few: 'منذ # دقائق', many: 'منذ # دقيقة', other: 'منذ # دقيقة' }),
    hoursAgo: (n) => plural(n, { one: 'منذ ساعة', two: 'منذ ساعتين', few: 'منذ # ساعات', many: 'منذ # ساعة', other: 'منذ # ساعة' }),
    daysAgo: (n) => plural(n, { one: 'منذ يوم', two: 'منذ يومين', few: 'منذ # أيام', many: 'منذ # يومًا', other: 'منذ # يوم' }),
    expired: 'منتهي الصلاحية',
    inMinutes: (n) => plural(n, { one: 'بعد دقيقة', two: 'بعد دقيقتين', few: 'بعد # دقائق', many: 'بعد # دقيقة', other: 'بعد # دقيقة' }),
    inHours: (n) => plural(n, { one: 'بعد ساعة', two: 'بعد ساعتين', few: 'بعد # ساعات', many: 'بعد # ساعة', other: 'بعد # ساعة' }),
    inDays: (n) => plural(n, { one: 'بعد يوم', two: 'بعد يومين', few: 'بعد # أيام', many: 'بعد # يومًا', other: 'بعد # يوم' }),
    seconds,
    minutes,
    hoursMinutes: (h, m) => `${hours(h)} و${minutes(m)}`,
    hours,
    daysHours: (d, h) => `${days(d)} و${hours(h)}`,
    days,
  },

  unknownDevice: 'جهاز غير معروف',

  control: {
    none: 'خامل',
    observe: 'الذكاء الاصطناعي يشاهد',
    agent: 'الذكاء الاصطناعي يتحكم',
    user: 'تولّى المستخدم التحكم',
  },

  roles: {
    owner: 'المالك',
    admin: 'المسؤول',
    member: 'عضو',
  },
  roleDescriptions: {
    owner: 'صلاحيات كاملة، بما فيها دعوة الأعضاء وتغيير الأدوار وإزالة الأعضاء.',
    admin: 'يدير المشاريع ومفاتيح API وسياسات الوصول والأجهزة والدعوات، ويمكنه الاطلاع على سجل التدقيق وقائمة الأعضاء.',
    member: 'يطّلع على المشاريع والأجهزة، ويمكنه دعوة المستخدمين للاتصال واختبار الاتصالات وإنهاء الجلسات وعرض سجل التدقيق.',
  },

  levels: {
    observe: {
      label: 'العرض فقط',
      description: 'اللقطات ولقطات الشاشة وconsole وقائمة طلبات الشبكة وانتظار النصوص. لا يمكنه تغيير الصفحة.',
    },
    interact: {
      label: 'العرض والتفاعل',
      description: 'كل ما في «العرض فقط»، إضافةً إلى النقر والكتابة والاختيار والتمرير والسحب والتنقل والرجوع وإعادة التحميل.',
    },
    advanced: {
      label: 'متقدّم',
      description: 'كل ما في «العرض والتفاعل»، إضافةً إلى تشغيل أي JS في الصفحة، وقراءة ترويسات الطلبات ومحتواها، وlocalStorage / ملفات تعريف الارتباط.',
    },
  },
  levelTitle: (label, level, description) => `${label} (${level}): ${description}`,

  maskPresets: {
    phone: 'رقم الهاتف (الصين)',
    idCard: 'رقم بطاقة الهوية (الصين)',
    bankCard: 'رقم البطاقة المصرفية',
    email: 'البريد الإلكتروني',
  },
  regex: {
    empty: 'يُرجى إدخال تعبير نمطي',
    matchesEmpty: 'يطابق السلسلة الفارغة، ما سيُخفي النص كله',
    syntax: (detail) => `تعبير نمطي غير صالح: ${detail}`,
    lookaround: 'التحقق الأمامي والخلفي ((?=، (?!، (?<=، (?<!) غير مدعوم؛ تستخدم البوابة صيغة RE2',
    backreference: 'المراجع الخلفية (\\1 وما شابهها) غير مدعومة؛ تستخدم البوابة صيغة RE2',
  },

  badges: {
    help: 'قيد المساعدة',
    agentWithName: (label, agent) => `${label} (${agent})`,
    waitingConfirmAction: 'بانتظار تأكيد المستخدم للإجراء',
    waitingConfirm: 'بانتظار موافقة المستخدم',
    waitingTitle: (agent) => `ينتظر ${agent} موافقة المستخدم على الجهاز`,
    invited: 'مدعو',
    invitedTitle: 'متصل عبر رابط دعوة',
  },

  api: {
    network: 'تعذّر الوصول إلى البوابة. يُرجى التحقق من الشبكة.',
    unauthorized: 'انتهت صلاحية جلستك. يُرجى تسجيل الدخول مجددًا.',
    forbidden: 'ليست لديك صلاحية للقيام بذلك.',
    notFound: 'غير موجود',
    server: 'خطأ في البوابة. يُرجى المحاولة لاحقًا.',
    failed: (status) => `فشل الطلب (HTTP ${status})`,
    unknown: 'خطأ غير معروف',
    adminName: 'المسؤول',
  },
}
