<!-- i18n-source: 4c7f2c79aaa7a9d135f0f53019843c330a2e70d1 -->

<div dir="rtl">

<div align="center">

# Remote WebView Debugger

**دَع وكلاء الذكاء الاصطناعي يصحّحون الـ WebViews داخل تطبيقك وصفحات H5 الخاصة بك — على هواتف المستخدمين الحقيقيين، عن بُعد، عبر MCP.**

[debugger.site](https://debugger.site) · [عرض حي](https://debugger.site/#demo) · [التوثيق](docs/architecture.ar.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Русский](README.ru.md) | العربية

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

الخلل الذي لا يظهر إلا على هاتف مستخدم واحد، داخل تطبيق شامل على غرار WeChat أو داخل WebView في تطبيقك أنت، هو أصعب أنواع الأخطاء تصحيحًا: لا كابل USB، ولا منفذ للتصحيح عن بُعد، ولا سبيل لإعادة إنتاجه على جهازك. يضع Remote WebView Debugger تلك الصفحة أمام وكيل الذكاء الاصطناعي الخاص بك بدلًا من ذلك.

- **وسم سكربت واحد** (أو حقن أصلي) يجعل الصفحة متصلة. يرى المستخدم شارة صغيرة تحمل رمز الجهاز، ويمكنه النقر على *طلب المساعدة*.
- **يتصل وكيلك عبر MCP** — Claude Code أو Cursor أو أي عميل MCP — بعد أن يوافق المستخدم على الجهاز. يقرأ لقطات إمكانية الوصول، و console، والشبكة، ولقطات الشاشة، وينقر ويكتب ويمرّر كما يفعل الإنسان، عبر كل صفحة و WebView على ذلك الجهاز.
- **يبقى المستخدم متحكمًا.** يرى ما يفعله الذكاء الاصطناعي (مؤشر الوكيل، وبطاقة مهمة بالخطوات المخطط لها، وحافة متوهجة)، ويستطيع تولّي التحكم أو إنهاء الجلسة في أي وقت. وتُخفى كلمات المرور وأرقام الهواتف والبطاقات قبل أن يغادر أي شيء الهاتف.
- **استضافة ذاتية.** ملف تنفيذي واحد بلغة Go تُضمَّن فيه لوحة التحكم و SDK؛ مع SQLite أو Postgres.

<div dir="ltr">

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

</div>

## البدء السريع

ثلاث خطوات: شغّل البوابة، وأضف SDK إلى صفحة، ووجّه وكيلك إلى البوابة.

### 1. تشغيل البوابة

<div dir="ltr">

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

</div>

افتح `http://<your-host>:8080` وسجّل الدخول باسم **`admin`** وبكلمة المرور تلك. إن لم تضبط `RWD_ADMIN_PASSWORD` فستُطبع كلمة مرور عشوائية مرة واحدة في `docker logs rwd`. الصورة مبنية على Alpine (لـ linux/amd64 و linux/arm64)، وتُضمَّن فيها لوحة التحكم و SDK، وتحفظ كل شيء في وحدة التخزين `rwd-data`؛ وللترقية، نفّذ `docker pull` للوسم الجديد ثم أعد إنشاء الحاوية.

إعدادات قد تحتاج إليها، تُمرَّر عبر `-e` ([كل الإعدادات](gateway/README.ar.md)):

| المتغير | الغرض |
|---|---|
| `RWD_ADMIN_EMAIL` | اسم دخول المالك (الافتراضي `admin`) |
| `RWD_PUBLIC_URL` | العنوان الذي تستخدمه الهواتف والوكلاء، مثل `https://rwd.example.com/v1`، حين يختلف عن العنوان الذي في متصفحك |
| `RWD_LANG=zh` | أوصاف أدوات MCP ونتائجها باللغة الصينية |
| `RWD_DATABASE_URL` | `postgres://…` لاستخدام Postgres بدلًا من SQLite |
| `RWD_TRUST_PROXY=1` | فقط خلف وكيلك العكسي الخاص: يأخذ عنوان IP للعميل والمخطط (scheme) من `X-Forwarded-*` |

<details>
<summary>طرق أخرى للتشغيل: ملفات تنفيذية، و Docker Compose مع HTTPS، ومن المصدر</summary>

- **ملف تنفيذي.** يحتوي كل إصدار للبوابة على [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) على `rwd_<version>_<os>_<arch>.tar.gz` لـ Linux و macOS: فُكّ ضغطه وشغّل `./rwd serve --addr :8080`.
- **Docker Compose.** يضيف [`deploy/platform`](deploy/platform/README.ar.md) خادم Caddy في الواجهة: خلف وكيل TLS الخاص بك، أو مقدّمًا HTTPS بنفسه بشهادة Let's Encrypt (`RWD_DOMAIN=<host>`).
- **من المصدر.** `make -j16` (يحتاج إلى Go و Node)، ثم `gateway/bin/rwd-<os>-<arch> serve --addr :8080`.

</details>

### 2. جعل صفحة متصلة

أنشئ مشروعًا في لوحة التحكم للحصول على مفتاح التطبيق، ثم أضف SDK مع عنوان بوابتك:

<div dir="ltr">

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

</div>

SDK هو حزمة npm [`remote-webview-debugger`](sdk/README.ar.md): حمّله من jsDelivr كما في المثال أعلاه أو من unpkg (`https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`)، أو نفّذ `npm install remote-webview-debugger` ثم `import { run } from 'remote-webview-debugger'`. وتقدّم بوابتك كذلك النسخة المضمَّنة فيها على `/v1/sdk.js`.

داخل تطبيق، احقن السكربت نفسه عند بدء المستند من الشيفرة الأصلية (`WKUserScript` في iOS، و `addDocumentStartJavaScript` في Android): انظر [التكامل مع التطبيقات الأصلية](docs/native-integration.ar.md) والدليل المدمج في لوحة التحكم.

### 3. ربط وكيلك

أنشئ مفتاح API في لوحة التحكم (مفتاح واحد يصل إلى كل الأجهزة)، ثم:

<div dir="ltr">

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

</div>

…واطلب منه: *«اتصل بالجهاز `K7Q2-9M4X` واكتشف لماذا يظهر إجمالي الدفع `--`.»*

### HTTP أم HTTPS؟

تتحدث البوابة HTTP العادي وتعمل به جيدًا: يختار SDK بين `ws://` و `wss://` بحسب عنوان البوابة، وتعمل لوحة التحكم و MCP عبر أيٍّ منهما. ما يحسم الأمر هو **الصفحة التي تصحّحها**. فالمتصفحات و WebViews لا تسمح لصفحة `https://` بتحميل سكربتات `http://` أو فتح اتصالات `ws://` (المحتوى المختلط)، حتى لو جاء `sdk.js` نفسه من CDN عبر HTTPS.

| الصفحة التي تصحّحها | البوابة عبر HTTP العادي |
|---|---|
| `http://`: خادم تطوير محلي، بيئة اختبار في شبكة داخلية | ✅ تعمل |
| `https://` في متصفح أو في `WKWebView` على iOS | ❌ تُحجب بوصفها محتوى مختلطًا: وفّر HTTPS للبوابة |
| `https://` في WebView على Android | ⚠️ فقط إن استدعى التطبيق `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`، وفي إصدارات التصحيح فقط |

عبر HTTP العادي، تنتقل مفاتيح API وكلمات مرور لوحة التحكم دون تشفير، فاقصر استخدامه على شبكة تثق بها. وللحصول على HTTPS، شغّل [حزمة Compose](deploy/platform/README.ar.md) مع `RWD_DOMAIN=<host>` (شهادة تلقائية)، أو ضع الحاوية خلف وكيل TLS الخاص بك وأضف `-e RWD_TRUST_PROXY=1`.

## الميزات

- **الجهاز أولًا.** للجهاز (تثبيت واحد لتطبيق أو متصفح واحد) صفحات كثيرة؛ ومفتاح API واحد وخادم MCP واحد يصلان إلى كل الأجهزة. يتابع الوكيل عمليات التنقل والـ WebViews المفتوحة حديثًا، ويرى خطًا زمنيًا يمتد عبر الصفحات.
- **أدوات الوكيل.** لقطات إمكانية الوصول مع مراجع للعناصر (لقطة aria من Playwright)، والبحث، والنقر، والملء، والكتابة، والضغط على المفاتيح، والاختيار، والتمرير فوق العناصر، والتمرير، والسحب، والتنقل، وتنفيذ الشيفرة، و console، والشبكة مع أجسام الطلبات، والتخزين، ولقطات الشاشة (عبر الجسر الأصلي أو DOM)، والإجراءات المجمّعة، والانتظار، والأحداث.
- **الموافقة والتحكم.** موافقة على الجهاز بمستويات (`observe` / `interact` / `advanced`)، وموافقة تلقائية اختيارية، وقفل الشاشة أثناء عمل الوكيل، وتولّي التحكم / إعادة التحكم / إنهاء، وتأكيد للإجراءات الحساسة (`data-rwd-confirm`).
- **الخصوصية.** حقول كلمات المرور، و `data-rwd-mask`، والمحدِّدات / الأنماط القابلة للضبط تُخفى في اللقطات ولقطات الشاشة وبيانات console والشبكة. ويسجّل سجل التدقيق من فعل ماذا، دون محتوى الصفحة.
- **التشغيل والإدارة.** الأعضاء والأدوار، ومفاتيح API بمستوى / تاريخ انتهاء / قائمة سماح IP، وتوكنات الأجهزة، والدعوات عبر رمز QR، والحصص، ولوحة تحكم حيّة عبر SSE، ومقاييس Prometheus.
- **11 لغة، وتنسيقك الخاص.** لوحة التحكم وواجهة الهاتف والنصوص الموجّهة إلى الوكيل بالإنجليزية، والصينية المبسطة والتقليدية، والفرنسية، والإسبانية، والروسية، والعربية (من اليمين إلى اليسار)، واليابانية، والكورية، والألمانية، والبرتغالية: تتبع لوحة التحكم لغة المتصفح (مع مبدِّل للغة)، وتتبع واجهة الهاتف لغة الهاتف أو `run({ lang })`، ويتبع جانب الوكيل `RWD_LANG`. ويقبل SDK الصفحة حزم لغات ونصوصًا خاصة بك، ويُعاد تنسيقه عبر متغيرات CSS ([لغات SDK وتنسيقه](sdk/README.ar.md#اللغات)).
- **يتوافق جيدًا مع eruda.** تبويب Remote Debugger اختياري داخل eruda؛ ويمكنه تحميل eruda للمطورين عند الطلب.

## بنية المستودع

| المسار | المحتوى |
|---|---|
| [`gateway/`](gateway) | بوابة Go: WebSocket الصفحات، وREST ومصادقة لوحة التحكم، وخادم MCP، والتدقيق، والمقاييس |
| [`sdk/`](sdk) | SDK الصفحة (`sdk.js`) وواجهته داخل الصفحة |
| [`packages/chobitsu/`](packages/chobitsu) | نسخة مُضمَّنة من [chobitsu](https://github.com/liriliri/chobitsu) إضافةً إلى محركنا العامل في جانب الصفحة في `src/engine/` |
| [`console/`](console) | لوحة التحكم (React، Vite) |
| [`website/`](website) | [debugger.site](https://debugger.site)، مع العرض التفاعلي |
| [`examples/`](examples) | متجر تجريبي متعدد الصفحات وتطبيق macOS يستضيف WKWebViews كما يفعل تطبيق iOS |
| [`deploy/platform/`](deploy/platform) | النشر عبر Docker Compose |
| [`docs/`](docs) | [البنية](docs/architecture.ar.md)، [البروتوكول](docs/protocol.ar.md)، [التكامل مع التطبيقات الأصلية](docs/native-integration.ar.md)، [إصدار النسخ](docs/releasing.ar.md) |

## الإصدارات

يُصدَر SDK الصفحة والبوابة كلٌّ على حدة، ولكلٍّ منهما رقم إصدار ووسم (`sdk-vX.Y.Z`، `gateway-vX.Y.Z`) وسجل تغييرات خاص به: [SDK](sdk/CHANGELOG.md)، [البوابة](gateway/CHANGELOG.md). يأتي كل إصدار للبوابة مع ملفات `rwd` التنفيذية لـ Linux و macOS والصورة `ghcr.io/zanel1u/remote-webview-debugger`. انظر [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases)، وللمشرفين على المشروع [إصدار النسخ](docs/releasing.ar.md).

## التطوير

<div dir="ltr">

```bash
make -j16 check                                      # اختبارات البوابة، وفحص أنواع SDK + اختبارات Playwright، وبناء لوحة التحكم
cd console && PORT=8080 npm run mock & npm run dev   # لوحة التحكم مقابل بوابة وهمية في الذاكرة
cd website && npm run dev                            # الموقع
```

</div>

## شكر وتقدير

يبني المحرك العامل في جانب الصفحة على [chobitsu](https://github.com/liriliri/chobitsu) (MIT) لالتقاط console والشبكة، ويستخدم شيفرة لقطات إمكانية الوصول من [Playwright](https://github.com/microsoft/playwright) (Apache-2.0). انظر [NOTICE](NOTICE).

## الترخيص

[MIT](LICENSE)

</div>
