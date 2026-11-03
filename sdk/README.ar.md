<!-- i18n-source: a4e7bc52d91627a8d67fac32547089d8321a7d2e -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Русский](README.ru.md) | العربية

<div dir="rtl">

# SDK الصفحة لـ RWD (`sdk/`)

ملف JS واحد تحمّله صفحة H5 أو WebView داخل تطبيق، ليتمكّن وكيل ذكاء اصطناعي من فحص الصفحة وتشغيلها عبر بوابة RWD (`gateway/`) و MCP. البروتوكول: [`docs/protocol.ar.md`](../docs/protocol.ar.md)؛ البنية: [`docs/architecture.ar.md`](../docs/architecture.ar.md).

<div dir="ltr">

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // اختياري
    deviceId: "…",               // اختياري؛ يمرّره المضيف الأصلي الذي يحقن SDK
    helpButton: true,            // اختياري؛ يُظهر زر "Get help"
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // اختياري؛ 'en' | 'zh'، والافتراضي من navigator.language
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

</div>

## الحصول على SDK

منشور على npm باسم [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)؛ الإصدارات والتغييرات: [CHANGELOG](CHANGELOG.md).

| الاستخدام | المصدر |
|---|---|
| وسم `<script>` من CDN | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js` أو `https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js` (IIFE مصغَّر، والمتغير العام `RemoteWebviewDebugger`؛ ثبّت رقم الإصدار، وأضف `integrity` إن شئت) |
| أداة تجميع (bundler) | `npm install remote-webview-debugger`، ثم `import { run, status } from 'remote-webview-debugger'` (وحدة ES مع الأنواع). استورده قبل شيفرتك ليبدأ الالتقاط مبكرًا. ولا تحمّل معه نسخة `<script>` في الصفحة نفسها |
| بوابتك | `https://<gateway>/v1/sdk.js`، وهي النسخة المضمَّنة في البوابة (ومتاحة أيضًا على عنوان معنون بالمحتوى لـ SRI تقترحه لوحة التحكم) |
| تطبيق أصلي | ضمّن `dist/sdk.js` من الحزمة في التطبيق، أو نزّله من أحد المصادر أعلاه؛ انظر [التكامل مع التطبيقات الأصلية](../docs/native-integration.ar.md) |

## API

| API | الوصف |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | يُدخل الصفحة إلى الاتصال (رمز الجهاز، الشارة). يعيد `Promise<{deviceCode, status}>`؛ واستدعاؤه مرة أخرى لا يضر. الخيارات أدناه. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`؛ قيمة `status` واحدة من `idle / connecting / online / polling / stopped / rejected / quota`، و `lang` لغة الواجهة (`null` قبل `run()`)، و `logSession` سجل الجلسة الذي تكتب فيه هذه الصفحة (`null` حين لا يجري التسجيل) |
| `stop()` | يقطع الاتصال ويزيل الواجهة (يستمر جمع console والشبكة، ضمن حدود) |
| `setUser(userId)` | يغيّر المستخدم؛ ويعيد الاتصال مرة واحدة برسالة `hello` جديدة |
| `help(on)` | طلب المساعدة / إلغاؤه |
| `nativeControl(nativeKey, action)` | تولّي التحكم / إعادة التحكم / الإنهاء من واجهة المضيف الأصلي نفسه |
| `nativeDecide(nativeKey, requestId, value)` | مع `nativeApproval`، يجيب عن `status().pending`: مستوى أو `null` لطلب الربط، و `'allow'` أو `null` لتأكيد إجراء حساس |

خيارات `run()`:

| الخيار | الوصف |
|---|---|
| `userId` | المستخدم المسجَّل دخوله، ويُرسل مع `hello` |
| `deviceId` | معرّف جهاز ثابت يمرّره المضيف الأصلي (وإلا يُحفظ معرّف في localStorage) |
| `helpButton` | يُظهر زر "Get help" (ويُدمج بعملية OR مع سياسة المشروع) |
| `app` | `{ name, version }` للتطبيق المضيف |
| `lang` | لغة كل ما يراه مستخدم الهاتف (الشارة، النافذة العائمة، الشريط السفلي، مربعات الحوار، الإشعارات العابرة، تبويب eruda، ووصف "AI wants to …" للإجراء الحساس): `'en'` أو `'zh'`. الافتراضي: `'zh'` حين يبدأ `navigator.language` بـ `zh`، وإلا `'en'`. |
| `networkExclude` | طلبات لا ينبغي أن يخوض فيها الوكيل — خطوط تُرجع 404 دائمًا، ومنارات التحليلات: `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. تطابق كل قاعدة عنوان URL كسلسلة فرعية دون مراعاة حالة الأحرف، أو كنمط بمحرف البدل `*`، أو كتعبير نمطي حين تُكتب `/…/`. تُضاف إلى قواعد سياسة المشروع. تبقى الطلبات المطابقة خارج قائمة الشبكة وخارج أحداث الخط الزمني `net_fail`؛ لكن الصفحة تظل تسجّلها، فيستطيع الوكيل طلبها عبر `includeExcluded` |
| `lockScreen` | `false`: لا تُقفل الصفحة أثناء ربط وكيل بها (ويظل بإمكان المستخدم تغيير ذلك من النافذة العائمة). الافتراضي `true` |
| `theme` | `'auto'` (الافتراضي، يتبع خلفية الصفحة)، أو `'system'` أو `'light'` أو `'dark'` |
| `eruda` | `true` أو `{ dock, load, src, name }`: يعرض Remote Debugger كتبويب داخل eruda؛ ويحمّل `load` أحدث إصدار من eruda إن لم يكن في الصفحة. معطَّل افتراضيًا؛ ويمكن لسياسة المشروع تفعيله عن بُعد، والخيارات المحلية لها الأولوية حقلًا بحقل |
| `record` | `false`: لا تكتب هذه الصفحة أي سجل جلسة (ولا يُحذف شيء مخزَّن مسبقًا). الافتراضي `true`؛ ويمكن لسياسة المشروع إيقاف السجل لكل الصفحات |
| `launchId` | أيّ تشغيل للتطبيق تنتمي إليه هذه الصفحة، كي تحفظ كل WebView في عملية التطبيق الواحدة سجلّ جلستها تحت جلسة واحدة. يمرّر المضيف الأصلي معرّفه الخاص هنا (أو يعرّف `window.RWDLaunchId` كسلسلة نصية أو كدالة تعيدها)؛ وإلا يستنتج SDK التشغيل من ملف تعريف ارتباط للجلسة مع نبضة دورية |
| `nativeKey`، `deviceToken`، `nativeApproval` | للمضيفين الأصليين: السرّ الخاص بـ `nativeControl` / `nativeDecide`، وتوكن الجهاز الذي يحتفظ به المضيف، وطرح أسئلة الربط / التأكيد بواجهة أصلية |

## اللغات

جمهوران، وإعدادان:

- **مستخدم الهاتف**: `run({ lang })`، وإلا لغة المتصفح (انظر أعلاه). الفهرس: `src/i18n.ts`.
- **الوكيل**: رسائل أخطاء RPC وملخصات الخط الزمني (النقرات، التنقل داخل الصفحة، الطلبات الفاشلة) تتبع `welcome.agentLang` من البوابة (`'en'` / `'zh'`). تكون بالإنجليزية إلى أن تقول رسالة welcome غير ذلك؛ وتُحفظ آخر قيمة في localStorage `rwd:alang`، فتستخدمها كذلك الأحداث التي تسبق رسالة welcome للصفحة التالية. الفهرس: `packages/chobitsu/src/engine/rwd/i18n.ts`.

وهكذا يمكن لمستخدم يتحدث الصينية أن يعمل مع وكيل يتحدث الإنجليزية: يسأل مربع الحوار `AI 想要点击「提交订单」，允许吗？`، وإن رُفض يقرأ الوكيل `The user denied this action`.

## السلوك داخل الصفحة (البروتوكول §6–§8، §11)

- المستويات: تُفحص استدعاءات RPC مقابل `welcome.level` / `control.level` (`forbidden`، "Requires the … level"). الوكيل الذي بلا مستوى (من بوابة أقدم) يحصل على `interact`؛ وحين لا يكون أي وكيل مرتبطًا لا يُفرض شيء إضافي.
- يُحفظ توكن الجهاز في localStorage `rwd:dtoken`، وتوكن الاستئناف في sessionStorage `rwd:resume` (مقيَّدًا بـ pageId). رمز الإغلاق 4401: إن كان التوكن قد تغيّر في الأثناء (تبويب آخر للجهاز حصل عليه للتو)، يُعاد المحاولة فورًا مرة واحدة، وإلا `rejected` وإعادة المحاولة بعد نحو 10 دقائق؛ 4409: إعادة الاتصال بـ pageId جديد؛ 4429: `quota`، وإعادة المحاولة بعد نحو 5 دقائق.
- يُنتزع `rwd_invite` من شريط العنوان عند `run()` (`history.replaceState`) ويُرسل مع hello إلى أن تصل رسالة welcome.
- `welcome.config`: `helpButton` (بعملية OR مع خيار `run()`)، و `maskSelectors`، و `maskPatterns` (اللقطة، console، عناوين URL للشبكة، قيم التخزين، ملخصات الخط الزمني)، و `confirmSelectors`، و `networkExclude` (تُضاف إلى قواعد خيار `run()`)، و `sessionLog`. يُحفظ آخر إعداد في localStorage `rwd:cfg` ويُستخدم إلى أن تصل رسالة welcome — فالمشروع الذي أوقف سجل الجلسة يبقيه موقوفًا منذ اللحظة الأولى للصفحة التالية، قبل أي welcome.
- تنتهي اللقطات بقسم `[Overlays]` يسرد ما يطفو فوق الصفحة — الخلفية المعتمة لنافذة منبثقة، أو نافذة مشروطة (modal)، أو لوحة سفلية — مع وسمها، ومقطع نصي قصير، والنسبة التي تغطيها من منفذ العرض، ومرجع ref. الخلفية المعتمة عنصر فارغ لا عقدة له في لقطة aria، لذا تحصل على مرجع `oN` بدلًا من `eN`؛ وهذا ما يتيح للوكيل النقر عليها لإغلاق النافذة المنبثقة.
- تستهدف النقرة أولًا المركز المرئي للعنصر، ثم النقاط الأخرى من شبكة 3×3 داخله، فلا تحجب شارةٌ فوق زرٍّ ذلك الزر. وحين تكون كل النقاط مغطاة، يفشل RPC بـ `not_interactable` ويسمّي العنصر الحاجب ومرجعه.
- مربعا حوار الربط والإجراء الحساس (`[data-rwd-confirm]`، و `confirmSelectors`، بما في ذلك إرسال نموذج بمفتاح Enter) يعيشان في Shadow DOM، ولا يقبلان إلا النقرات الموثوقة، ولا يصبحان فعّالين إلا بعد 0.4 ثانية من ظهورهما. تتشارك التبويبات من الأصل (origin) نفسه طلبات الربط التي حُسمت عبر BroadcastChannel.

يبدأ تحميل الملف بجمع console والأخطاء غير الملتقطة والشبكة (XHR، fetch، WebSocket، sendBeacon، EventSource)، بحد أقصى 500 مدخل لكلٍّ منها؛ وعند الامتلاء تُحذف السجلات العادية والطلبات الناجحة أولًا. تُخزَّن أجسام الاستجابات مؤقتًا حتى 5 MB إجمالًا، و 64 KB لكلٍّ منها. لذا حمّله بشكل متزامن ومبكرًا في `<head>`.

## سجل الجلسة (البروتوكول §5.4)

تلك المخازن المؤقتة هي ذاكرة صفحة واحدة. وبالتوازي يكتب SDK **سجل جلسة** في IndexedDB (`rwd-log`) على الجهاز، كي يتمكّن الوكيل الذي يرتبط بعد وقوع خلل من قراءة كل ما أدى إليه:

- الجلسة الواحدة هي تشغيل واحد للتطبيق، تتشاركه كل صفحات الأصل (origin): `run({ launchId })`، وإلا `window.RWDLaunchId`، وإلا يُستنتج من ملف تعريف ارتباط الجلسة `rwd_launch` مع نبضة دورية (جلسة ملف تعريف ارتباط صامتة لأكثر من ساعة تُعدّ تشغيلًا جديدًا). `status().logSession` هو المعرّف المستخدم.
- ما يُسجَّل: فتح الصفحة / التنقل داخلها / الانتقال بين المقدمة والخلفية / المغادرة، ونقرات المستخدم وإدخاله وعمليات الإرسال ومواضع استقرار التمرير، واستدعاءات الوكيل التفاعلية و `rwd.evaluate`، وتغييرات حالة التحكم، و console بكل مستوياته، وكل طلب مكتمل — والفاشلة منها مع ترويساتها وأجسامها بعد التنقيح (64 KB لكلٍّ منها). يعمل سواء أمكن الوصول إلى البوابة أم لا. تُخزَّن الحقول المخفاة بصورة `••••`، وتُطبَّق `maskPatterns` لحظة كتابة السجلات.
- ما يُحتفظ به: آخر 3 تشغيلات، 10 MB لكلٍّ منها؛ وما زاد عن ذلك تُحذف منه السجلات العادية والطلبات الناجحة أولًا. التشغيل الحالي فقط حين تكون حصة التخزين دون 64 MB؛ ولا شيء على الإطلاق في غياب IndexedDB.
- يقرؤه الوكيل عبر `rwd.log` (`observe`) و `rwd.logDetail` (`advanced`، للترويسات والأجسام). ولا يغادر الجهازَ شيءٌ منه بخلاف ذلك.
- يُوقَف بـ `run({ record: false })` لصفحة واحدة، أو بـ `policy.sessionLog: false` للمشروع — وهذا يحذف أيضًا ما خزّنه هذا الأصل مسبقًا.

## بنية الشيفرة

- `src/index.ts`: الواجهة العامة، والجلسة، وتوزيع RPC، وحالة التحكم.
- `src/transport.ts`: اتصال WebSocket للصفحة (بالمُنشئ الأصلي)، ومهلة النبضة، والتراجع الأسّي، وبعد 3 محاولات فاشلة `POST /v1/presence` كل 60 ثانية.
- `src/ids.ts`: deviceId / pageId / openerId.
- `src/launch.ts`: أيّ تشغيل للتطبيق تنتمي إليه هذه الصفحة (`launchId`، `window.RWDLaunchId`، ملف تعريف الارتباط `rwd_launch`).
- `src/pageWatch.ts`: رسائل `page` (url، title، visibility) وأحداث الخط الزمني (التنقل داخل الصفحة، نقرات المستخدم).
- `src/ui.ts`، `src/lock.ts`: الشارة، وزر المساعدة، وطبقة القفل، والتوهّج، وإبراز الإجراء، ومربعات الحوار في Shadow DOM؛ يحجب إدخال المستخدم الموثوق أثناء ربط وكيل، ويعرض منذ متى هو متصل.
- `src/approval.ts`: الموافقة على الربط وتأكيد الإجراء الحساس (مربع حوار في الصفحة، أو المضيف الأصلي عبر `nativeDecide`).
- `src/i18n.ts`: نصوص واجهة المستخدم (en / zh).
- يعيش محرّك الوكيل بجوار chobitsu في `packages/chobitsu/src/engine/rwd/`: اللقطة، و `rwd.query`، وفحوص قابلية التنفيذ، والإدخال المُصطنَع، ولوحة المفاتيح، ومخازن console / الشبكة المؤقتة، ولقطات الشاشة، و `rwd.storage`، وسجل الجلسة في IndexedDB (`coldlog.ts`)، وكشف الطبقات العائمة (`overlays.ts`)، والمستويات وقواعد التأكيد (`policy.ts`)، والنصوص الموجّهة إلى الوكيل (`i18n.ts`). مصادر Playwright المستخدمة في اللقطات موجودة في `packages/chobitsu/src/engine/vendor/playwright/`. ويجمّعها البناء من المصدر في `dist/sdk.js`.

## البناء والاختبار

<div dir="ltr">

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE، المتغير العام RemoteWebviewDebugger، ES2017)، dist/index.mjs + index.d.ts (وحدة ES)
npm run typecheck
npm test             # Playwright: WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # بوابة وهمية محلية: http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

</div>

تستخدم الاختبارات `test/mock-gateway.mjs`، الذي ينفّذ جانب الصفحة من البروتوكول (welcome، حالة التحكم، استدعاءات RPC، presence؛ التوكنات، رموز الإغلاق، المستويات، الإعداد عن بُعد، `agentLang`، الموافقة على الربط) ويقدّم `/v1/sdk.js` والمتجر التجريبي. وهو لا يتحقق من المستويات بنفسه، فتختبر الاختبارات الإنفاذ الذي تقوم به الصفحة ذاتها. تعمل المواصفات في `test/e2e/` بمتصفح `zh-CN` و `agentLang: 'zh'` ما لم يقل الاختبار غير ذلك؛ ويغطي `i18n.spec.ts` الإنجليزية. يحمّل اختبار التعايش eruda 3.4.3 و PageSpy 2.4.0 من jsdelivr، لذا يحتاج إلى اتصال بالإنترنت.

</div>
