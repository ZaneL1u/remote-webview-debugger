<!-- i18n-source: 36b1f9d52cae376ca3aa02c47b0584fd21b7ab30 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | العربية

<div dir="rtl">

# بوابة rwd

خادم Remote WebView Debugger المكتوب بلغة Go: اتصالات الصفحات، وحالة اتصال الأجهزة، وحالة التحكم، ونقطة نهاية MCP المستضافة، وواجهة REST الخاصة بلوحة التحكم، إضافةً إلى لوحة التحكم وSDK الصفحة المضمَّنين فيه. ملف تنفيذي واحد هو الخادم بأكمله.

- البروتوكول: [docs/protocol.ar.md](../docs/protocol.ar.md)
- البنية ونموذج الموافقة وملاحظات الأمان: [docs/architecture.ar.md](../docs/architecture.ar.md)
- النشر باستخدام Docker Compose: [deploy/platform/README.ar.md](../deploy/platform/README.ar.md)

## البناء والتشغيل

يتطلب البناء Go (الإصدار المحدد في `go.mod`) وNode.js مع npm، لأن لوحة التحكم وSDK يُبنيان ويُضمَّنان داخل الملف التنفيذي. من جذر المستودع:

<div dir="ltr">

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # cross-compile (amd64 or arm64)

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

</div>

افتح http://localhost:8080 وسجّل الدخول بهذا البريد الإلكتروني وكلمة المرور. تستخدم الصفحات والوكلاء عنوان البوابة `http://localhost:8080/v1` (وفي بيئة الإنتاج: `https://rwd.example.com/v1`).

يعمل `go build ./cmd/rwd` داخل `gateway/` أيضًا، لكن الملف التنفيذي الناتج لا يحمل سوى عناصر نائبة بدلًا من لوحة التحكم وSDK. يضبط `make` الإصدار الذي يُبلِغ عنه `rwd version` و`/v1/healthz` اعتمادًا على أحدث وسم `gateway-vX.Y.Z` (`0.2.0` عند الوسم نفسه، و`0.2.0-3-gabc1234` بعده، و`0.0.0-dev` إن لم يوجد وسم)؛ ويمكن تجاوزه بـ `RWD_VERSION=…`. تُرفق الملفات التنفيذية الجاهزة لنظامَي Linux وmacOS (`amd64` و`arm64`) بكل [إصدار على GitHub](https://github.com/ZaneL1u/remote-webview-debugger/releases) يحمل الوسم `gateway-v*`؛ وللاطلاع على التغييرات: [سجل التغييرات](CHANGELOG.md).

## الأوامر

<div dir="ltr">

```
rwd serve [flags]                       run the gateway
rwd mcp --gateway https://host/v1       stdio MCP bridge for local agents (API key from RWD_API_KEY)
rwd version                             print the version
```

</div>

## الإعدادات (`rwd serve`)

لكل خيار متغير بيئة مقابل؛ والخيار المُمرَّر في سطر الأوامر له الأولوية.

| الخيار / متغير البيئة | القيمة الافتراضية | الوصف |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | عنوان الاستماع (HTTP عادي؛ ضع TLS أمامه، راجع [deploy/platform](../deploy/platform/README.ar.md)) |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | قاعدة البيانات. عنوان URL يبدأ بـ `postgres://` أو `postgresql://` يختار Postgres؛ وأي قيمة أخرى تُعدّ مسار ملف SQLite. يتقدّم `RWD_DATABASE_URL` على `RWD_DATA`. يُنشأ المخطط ويُرحَّل عند بدء التشغيل |
| `--public-url` / `RWD_PUBLIC_URL` | يُستنتج من كل طلب | العنوان العام للبوابة، وينتهي بـ `/v1`، مثل `https://rwd.example.com/v1`. يُستخدم في مقتطفات التكامل وروابط الدعوة و`/v1/api/config`. اضبطه عندما لا تستطيع البوابة استنتاج عنوانها العام |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | معطَّل | يأخذ عنوان IP للعميل من `X-Forwarded-For`، ويأخذ مخطط العنوان العام المستنتَج ومضيفه (وكذلك ما إذا كان ملف تعريف الارتباط الخاص بلوحة التحكم `Secure`) من `X-Forwarded-Proto` / `X-Forwarded-Host`. لا تفعّله إلا خلف بروكسي عكسي، وإلا أمكن للعملاء تزوير هذه الترويسات والتحايل على قوائم السماح لعناوين IP وحدود معدل الطلبات. من دونه يُعامَل كل طلب على أنه HTTP عادي أيًّا كان ما يقوله البروكسي، فيُضبط ملف تعريف الارتباط الخاص بلوحة التحكم من دون `Secure` وتبدأ العناوين المستنتَجة بـ `http://` (اضبط `--public-url` في هذه الحالة) |
| `--lang` / `RWD_LANG` | `en` | لغة كل ما يقرؤه الذكاء الاصطناعي: تعليمات MCP، وأوصاف الأدوات ومعاملاتها، ونتائج الأدوات، و`[Session changes]`، والأخطاء. وتصل أيضًا إلى SDK الصفحة بوصفها `welcome.agentLang`، فتتطابق معها الأخطاء وملخصات الأحداث التي تُكتب داخل الصفحة. القيمة واحدة من `en`، و`zh` (الصينية المبسطة)، و`zh-TW` (الصينية التقليدية)، و`fr`، و`es`، و`ru`، و`ar`، و`ja`، و`ko`، و`de`، و`pt`؛ وتُقبل الوسوم الإقليمية وتُطابَق مع أقرب لغة منها (`zh-CN` → `zh`، `zh-HK` → `zh-TW`، `pt-BR` → `pt`). أما لوحة التحكم فتختار لغتها لكل طلب (`?lang=` أو `Accept-Language`) وتعود إلى هذه القيمة احتياطيًا |
| `--demo-dir` / `RWD_DEMO_DIR` | — | يقدّم هذا المجلد على المسار `/demo/` (اختياري، لصفحات العرض التوضيحي) |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0` (بلا حد) | عدد طلبات MCP المسموح بها لكل عنوان IP للعميل في الدقيقة؛ وما يزيد عليها يتلقى `429` مع `Retry-After: 60`. مخصّص لبوابة مفتاح API فيها علني، مثل العرض التوضيحي ([deploy/demo](../deploy/demo/README.md)). وخلف بروكسي يحتاج إلى `--trust-proxy` كي يرى عناوين IP للعملاء |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | معطَّل | تشغيل عرض توضيحي عام: يمنح `POST /v1/demo/keys` (دون تسجيل دخول، ومع CORS مفتوح) كل زائر مفتاح API خاصًا به (المستوى `interact`، صالح 24 ساعة، و5 مفاتيح لكل IP في الساعة)، فلا يتشارك الزوار وكيلًا واحدًا أبدًا؛ ويتطلب `list_devices` قيمة `deviceCode`، فلا يستطيع أحد سرد أجهزة الزوار الآخرين. راجع [deploy/demo](../deploy/demo/README.md) |
| `RWD_ADMIN_EMAIL` | `admin` | البريد الإلكتروني (اسم الدخول) لحساب المالك. لا يُنشأ مالك إلا إذا كانت قاعدة البيانات خالية من أي مالك (أي عند أول تشغيل)؛ وتغيير هذه القيمة لاحقًا **لا** يُنشئ مالكًا ثانيًا، بل يحدد فقط المالك الذي تنطبق عليه `RWD_ADMIN_PASSWORD` |
| `RWD_ADMIN_PASSWORD` | — | كلمة مرور المالك. تُستخدم عند إنشاء المالك، ثم عند **كل** تشغيل لاحق لإعادة تعيين كلمة مرور المالك المحدد بـ `RWD_ADMIN_EMAIL`، وهو ما يصلح أيضًا لاستعادة الحساب. إذا لم يكن هذا البريد لمالك (بل لعضو آخر، أو لا يخص أحدًا)، تُتجاهل القيمة ويذكر السجل ذلك مع أسماء المالكين. وإذا لم تُضبط وكانت قاعدة البيانات فارغة، تُولَّد كلمة مرور عشوائية وتُطبع مرة واحدة في السجل |
| `RWD_METRICS_TOKEN` | — | عند ضبطه، يتطلب `/v1/metrics` الترويسة `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | عدد أيام الاحتفاظ بسجل التدقيق |
| `RWD_OIDC_*` | — | تسجيل الدخول الموحّد، راجع [أدناه](#تسجيل-الدخول-الموحّد) |

أمور أخرى تستحق المعرفة:

- الأسرار التي تحتاجها البوابة (قيمة pepper لمفاتيح API وسرّ جلسات لوحة التحكم) تُولَّد عند أول تشغيل وتُخزَّن في قاعدة البيانات. احتفظ بنسخ احتياطية من قاعدة البيانات وأبقِها خاصة.
- تحتفظ البوابة بالحالة الحية (الصفحات المتصلة، وحالة التحكم، والخطوط الزمنية) في الذاكرة، لذا شغّل نسخة واحدة فقط لكل قاعدة بيانات.
- فحص السلامة: `GET /v1/healthz` ← `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## تسجيل الدخول الموحّد

يمكن للأعضاء أيضًا تسجيل الدخول عبر Feishu أو Lark أو أي مزوّد OpenID Connect (Keycloak، وOkta، وMicrosoft Entra ID، وGoogle، وAuthing، …)؛ ويظل تسجيل الدخول بالبريد الإلكتروني وكلمة المرور متاحًا. اضبط المزوّد وبيانات اعتماد العميل الخاصة به، فتعرض صفحة تسجيل الدخول الزر **تسجيل الدخول عبر …**.

| متغير البيئة | القيمة الافتراضية | الوصف |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu` أو `lark` أو `oidc`؛ يفعّل تسجيل الدخول الموحّد. ضبط `RWD_OIDC_ISSUER` وحده يعني `oidc` |
| `RWD_OIDC_CLIENT_ID`، `RWD_OIDC_CLIENT_SECRET` | — | بيانات اعتماد التطبيق (App ID و App Secret في Feishu و Lark). إلزامية |
| `RWD_OIDC_ISSUER` | — | جهة الإصدار (issuer) في OpenID Connect، مثل `https://sso.example.com/realms/acme`؛ وتُقرأ نقاط النهاية من `/.well-known/openid-configuration` الخاص بها (لـ `oidc` فقط) |
| `RWD_OIDC_AUTH_URL`، `RWD_OIDC_TOKEN_URL`، `RWD_OIDC_USERINFO_URL` | نقاط نهاية المزوّد | تتجاوز نقاط النهاية؛ اضبط الثلاثة جميعًا لمزوّد OpenID Connect لا يدعم الاكتشاف (discovery) |
| `RWD_OIDC_SCOPES` | `openid profile email` (`oidc`)، ولا شيء (Feishu، Lark) | نطاقات صلاحيات (scopes) مفصولة بمسافات. في Feishu و Lark أضف `contact:user.email:readonly` (و `contact:user.employee:readonly` للبريد الإلكتروني المؤسسي) كي تحصل الحسابات على بريد إلكتروني |
| `RWD_OIDC_NAME` | اسم المزوّد | تسمية زر تسجيل الدخول، مثل `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | دور الحسابات التي تُنشأ عند أول تسجيل دخول: `member` أو `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | معطَّل | لا تُنشأ أي حسابات: لا يستطيع تسجيل الدخول إلا الأعضاء الحاليون أو المدعوون (بالبريد الإلكتروني نفسه) |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | نطاقات البريد الإلكتروني المسموح لها بتسجيل الدخول، مفصولة بفواصل، مثل `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | معطَّل | لـ `oidc` فقط: الوثوق بالبريد الإلكتروني لمزوّد لا يرسل `email_verified` (Microsoft Entra ID). فقط لمزوّد أحادي المستأجر تتحكم مؤسستك في عناوين بريده الإلكتروني |
| `RWD_OIDC_TENANT` | — | لـ Feishu و Lark فقط: قيمة `tenant_key` لمؤسستك؛ ويُرفض أفراد المؤسسات الأخرى (`sso_error=tenant`). يُظهر سجل التدقيق `auth.login` لكل تسجيل دخول موحّد قيمة `tenant` الخاصة به |
| `RWD_OIDC_SYNC_MINUTES` | `60` (Feishu، Lark) | كم مرة تُعطَّل حسابات الأعضاء الذين غادروا المؤسسة؛ و `0` يوقف ذلك. انظر أدناه |

سجّل عنوان إعادة التوجيه هذا لدى المزوّد، ويجب أن يتطابق تمامًا: `https://<host>/v1/api/auth/oidc/callback`، أي أصل (origin) `RWD_PUBLIC_URL` (أو أصل الطلب إن لم يُضبط) متبوعًا بـ `/v1/api/auth/oidc/callback`. وخلف بروكسي، اضبط `RWD_PUBLIC_URL` كي يبقى العنوان ثابتًا.

عند أول تسجيل دخول لهوية ما، تنضم إلى العضو صاحب البريد الإلكتروني نفسه (ويحتفظ العضو المدعو بالدور الذي دُعي به، وتُستهلك الدعوة)، أو يُنشأ حساب بالدور `RWD_OIDC_DEFAULT_ROLE` ما لم يُضبط `RWD_OIDC_INVITE_ONLY=1`. وفي المرات التالية يُعثر على الحساب بمعرّف subject لدى المزوّد (`open_id` في Feishu و Lark)، فلا يضر تغيّر البريد الإلكتروني. ولا يُربط من جديد حسابٌ مرتبط أصلًا بهوية أخرى لدى المزوّد (فيحصل صندوق البريد الذي أُعيد تخصيصه على `sso_error=conflict`)، ولا تُمسّ دعوة العضو المعطَّل. ولا يُعتدّ بالبريد الإلكتروني لمزوّد OpenID Connect إلا مع `email_verified: true` (أو `RWD_OIDC_TRUST_EMAIL=1`)، ويحصل الحساب الذي لا بريد له على اسم الدخول `<provider>:<subject>`. يدير المالكون هؤلاء الأعضاء في صفحة **الأعضاء** كغيرهم: يغيّرون دورهم أو يعطّلونهم أو يحذفونهم؛ والعضو المعطَّل لا يستطيع تسجيل الدخول بأي من الطريقتين. الحسابات التي أنشأها تسجيل الدخول الموحّد ليست لها كلمة مرور. تقرأ البوابة بيانات المستخدم من نقطة النهاية userinfo لدى المزوّد باستخدام access token الذي تلقّته للتو (تدفق authorization code مع PKCE)؛ ولا تستخدم ID token. ويقتصر بدء تسجيل الدخول واستدعاءات الرجوع (callbacks) على 60 في الدقيقة لكل IP عميل (وخلف بروكسي فعّل `--trust-proxy`، وإلا تشارك الجميع عنوان IP البروكسي).

**من يستطيع الدخول.** يحدد البريد الإلكتروني لدى المزوّد أيَّ عضو حالي يصبحه أول تسجيل دخول، بمن في ذلك المالكون، لذا يستطيع كل من يقدر على ضبط عناوين البريد الإلكتروني لدى المزوّد الاستيلاء على تلك الحسابات. مع Feishu أو Lark استخدم تطبيقًا مخصّصًا: لا يستطيع تسجيل الدخول إلا أفراد مؤسستك، وبعناوين البريد الإلكتروني الخاصة بمؤسستك. أما تطبيق المتجر، أو التطبيق المشترك مع مؤسسات مرتبطة، فيُدخل مؤسسات أخرى أيضًا: اضبط عندها `RWD_OIDC_TENANT`. ومع مزوّد OpenID Connect يستطيع أي شخص تسجيل الدخول إليه (Google، أو Entra ID متعدد المستأجرين)، اضبط `RWD_OIDC_ALLOWED_DOMAINS` أو `RWD_OIDC_INVITE_ONLY=1`، وإلا حصل أي شخص على حساب (ويحذّر السجل عند بدء التشغيل)؛ ولا تضبط `RWD_OIDC_TRUST_EMAIL=1` معه أبدًا.

**تغيير التطبيق أو إيقاف تسجيل الدخول الموحّد.** تنتمي معرّفات `open_id` في Feishu و Lark إلى تطبيق واحد: بعد الانتقال إلى App ID آخر يُربط الأعضاء من جديد عبر البريد الإلكتروني، أما الحسابات التي لا بريد لها (`feishu:…`) فيجب حذفها ودعوتها من جديد. الحسابات التي أنشأها تسجيل الدخول الموحّد ليست لها كلمة مرور: يمنحها المالك واحدة عبر **رابط جديد** في صفحة **الأعضاء**، وهو رابط دعوة لتعيين كلمة مرور (ويحل أيضًا محل دعوة مفقودة)، مثلًا قبل إيقاف تسجيل الدخول الموحّد.

**Feishu أو Lark.** على [Feishu Open Platform](https://open.feishu.cn/app) (وفي Lark: [open.larksuite.com](https://open.larksuite.com/app))، أنشئ تطبيقًا مخصّصًا (企业自建应用) لا يستخدمه إلا أفراد مؤسستك، ثم:

1. انسخ App ID و App Secret من **Credentials & Basic Info** إلى `RWD_OIDC_CLIENT_ID` و `RWD_OIDC_CLIENT_SECRET`.
2. في **Security Settings → Redirect URLs**، أضف عنوان إعادة التوجيه المذكور أعلاه.
3. في **Permissions & Scopes**، أضف `contact:user.email:readonly` (و `contact:user.employee:readonly` للبريد الإلكتروني المؤسسي)، وأدرج النطاقات نفسها في `RWD_OIDC_SCOPES`. ولكي تلاحظ البوابة من غادر، يحتاج التطبيق أيضًا إلى `contact:contact.base:readonly` و `contact:user.employee:readonly`، وإلى أن يشمل **Data permissions → Contacts range** كل من يسجّل الدخول.
4. اجعل التطبيق متاحًا للأشخاص الذين ينبغي أن يسجّلوا الدخول، ثم أنشئ إصدارًا وانشره كي تسري الإعدادات.

**من يغادرون.** مع Feishu أو Lark تسأل البوابة Open Platform كل `RWD_OIDC_SYNC_MINUTES` دقيقة عن كل عضو مرتبط بالتطبيق، وتعطّل من يظهرون مستقيلين أو مغادرين للمؤسسة: يُسجَّل خروجهم، وتتوقف مفاتيح API الخاصة بهم عن العمل، ويُفصل وكلاؤهم، ويسجّل سجل التدقيق `member.update` من `system` مع `"reason":"left_organization"`. وبعد ذلك يستطيع المالك حذفهم، فتُلغى مفاتيحهم نهائيًا. لا يُعتدّ إلا بحالة «مستقيل» صريحة: العضو الواقع خارج نطاق جهات الاتصال، أو الطلب الذي فشل، لا يغيّر شيئًا (ويذكر السجل ما الذي فشل)، ولا يُعطَّل آخر مالك أبدًا. ومن دون صلاحية جهات الاتصال لا يُفحص شيء، ويحتفظ من غادر بمفاتيح API عاملة حتى يعطّله مالك؛ أما جلسته في لوحة التحكم فتنتهي خلال 12 ساعة لأنه لم يعد يستطيع تسجيل الدخول.

<div dir="ltr">

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

</div>

## ربط الوكيل

أنشئ مفتاح API في لوحة التحكم (**API keys**)، ثم أضف نقطة نهاية MCP المستضافة إلى عميلك، مثلًا في Claude Code:

<div dir="ltr">

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

</div>

وللعملاء الذين لا يتعاملون إلا مع stdio، يتولى الملف التنفيذي نفسه تمرير stdio إلى نقطة النهاية المستضافة:

<div dir="ltr">

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

</div>

| إعداد `rwd mcp` | الوصف |
|---|---|
| `--gateway` / `RWD_GATEWAY` | عنوان البوابة، وينتهي بـ `/v1` |
| `RWD_API_KEY` | مفتاح API (عبر متغير البيئة فقط، كي لا يظهر في قوائم العمليات) |

مفتاح واحد يصل إلى كل الأجهزة المتصلة بالبوابة. الأدوات مدرجة في [protocol.ar.md §14](../docs/protocol.ar.md#14-mcp).

## بنية الشيفرة المصدرية

<div dir="ltr">

```
cmd/rwd/            entry point: serve, mcp (stdio bridge), version
internal/store/     SQLite / Postgres: projects and policies, members, API keys (HMAC; level, expiry,
                    IP allowlist), devices and device tokens, device invites, audit log, settings
internal/hub/       live state: devices, pages, control state machine, attach approval, level checks,
                    timelines, RPC routing, SSE subscriptions, metrics
internal/server/    HTTP: page WebSocket, presence polling, REST with sign-in and roles, MCP tools,
                    SSE, /v1/metrics, static files
internal/i18n/      text for agents and the console, in 11 languages
internal/ids/       app keys, API keys, device codes, secrets
internal/web/       the embedded console and SDK (staged by `make gateway`, placeholders otherwise)
scripts/embed.sh    stages console/dist and sdk.js into internal/web for go:embed
```

</div>

## الاختبارات

<div dir="ltr">

```bash
cd gateway && go test -race ./...
```

</div>

يقود `internal/server/server_test.go` المسار الكامل بصفحات محاكاة وعميل MCP: الاتصال عبر رمز الجهاز؛ والموافقة على الجهاز (السماح، والرفض، والرفض المتكرر وما يتبعه من حظر، والعرض فقط)؛ وإعادة الارتباط خلال فترة السماح دون موافقة ثانية؛ والتحقق من المستويات؛ واللقطات؛ وقفل الشاشة عند أول تفاعل؛ وتتبّع الانتقال بين الصفحات وإسقاط صفحة استُبدلت بـ WebView أُعيد إنشاؤه؛ وتولّي التحكم وإعادة التحكم؛ والإجراءات المجمّعة؛ وإنهاء المستخدم للجلسة؛ وسجلات التدقيق؛ وتوكنات الأجهزة (4401)، وتوكنات الاستئناف (4409)، والحصص (4429)؛ والدعوات أحادية الاستخدام؛ وانتهاء صلاحية المفاتيح وقوائم السماح لعناوين IP؛ والإلغاء الفوري؛ ودعوات الأعضاء وأدوارهم؛ وSSE والمقاييس؛ وحالات فشل المصادقة.

تُشغَّل الاختبارات نفسها على Postgres (كل اختبار في مخطط مؤقت خاص به):

<div dir="ltr">

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

</div>

يشغّل `make -j16 check` في جذر المستودع فحوص البوابة وSDK ولوحة التحكم التي يشغّلها CI.

</div>
