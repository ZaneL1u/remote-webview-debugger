<!-- i18n-source: 633220a8fe1b3ddd3a313fd33ae0414507b2953f -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | العربية

<div dir="rtl">

# النشر باستخدام Docker Compose

يشغّل هذا الإعداد البوابة على مضيف Docker مع خادم [Caddy](https://caddyserver.com) صغير أمامها. وهناك طريقتان لإتاحتها:

- **خلف بروكسي TLS قائم** (الافتراضي): يستمع Caddy على `127.0.0.1:18788`، ويتولى nginx أو Caddy أو Traefik أو موازن الأحمال لديك إنهاء HTTPS أمامه.
- **HTTPS مباشر** عبر `RWD_DOMAIN`: يخدم Caddy المنفذين 80 و443 بنفسه ويحصل على شهادة من Let's Encrypt.

يبني `deploy.sh` كل شيء محليًا، وينقله عبر ssh، ثم يشغّل الحزمة (أو يعيد تشغيلها). إعدادات البوابة موصوفة في [gateway/README.ar.md](../../gateway/README.ar.md).

## الملفات

| الملف | الغرض |
|---|---|
| `Dockerfile` | صورة البوابة: Alpine مع الملف التنفيذي `rwd` المبني مسبقًا (ولوحة التحكم وSDK مضمَّنان فيه). تعمل بالمعرّف uid 10001 مع `RWD_ADDR=:8080` و`RWD_DATA=/data/rwd.db`، وبفحص سلامة على `/v1/healthz`. الصورة نفسها تُنشر على GHCR ويمكن تشغيلها وحدها أيضًا |
| `compose.yml` | خدمتان. `gateway`: تُبنى من Dockerfile، ويُركَّب `./data` على `/data`، وتُقرأ الإعدادات من `.env`، مع `RWD_TRUST_PROXY=1` (لا يصل إليها سوى Caddy)، ولا تُتاح منافذها خارجيًا. `web`: `caddy:2-alpine`، تُتاح على `${BIND:-127.0.0.1}:${PORT:-18788}`، وتقدّم `./demo` على `/demo/` وتمرّر كل ما عدا ذلك إلى البوابة |
| `Caddyfile` | HTTP عادي على `:80`. لا يثق بترويسات `X-Forwarded-*` إلا إذا جاءت من `RWD_TRUSTED_PROXIES` (الافتراضي: النطاقات الخاصة) |
| `compose.tls.yml` | ملف تراكب لـ HTTPS المباشر: يضيف المنفذين `443/tcp` و`443/udp` (HTTP/3)، ويستخدم `Caddyfile.tls` بدلًا من `Caddyfile`، ويحفظ الشهادات في وحدة التخزين `caddy-data` |
| `Caddyfile.tls` | يخدم `RWD_DOMAIN` عبر HTTPS بشهادة تلقائية ويعيد توجيه HTTP إلى HTTPS |
| `deploy.sh` | البناء، والنسخ، وإنشاء `.env` في المرة الأولى، والنسخ الاحتياطي لقاعدة البيانات، وإعادة التشغيل |

على الخادم، ينتج `deploy.sh` ما يلي:

<div dir="ltr">

```
~/rwd-platform/
├── .env                      settings (mode 600; created on the first deploy, then left alone)
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       the gateway binary for the server's architecture
├── data/                     rwd.db (SQLite) and rwd.db.bak-<time> backups
└── demo/platform-demo/       the demo shop, at https://rwd.example.com/demo/platform-demo/
```

</div>

## المتطلبات

- **جهاز البناء:** Go، وNode.js مع npm، و`make`، و`ssh`، و`scp`، و`tar`.
- **الخادم:** Docker مع إضافة Compose (`docker compose`)، و`openssl`. يجب أن يستطيع مستخدم ssh تشغيل Docker (كأن يكون عضوًا في المجموعة `docker`)؛ ولا حاجة إلى sudo. يسحب الخادم الصورتين `alpine:3.22` و`caddy:2-alpine`.

## الإعدادات (`.env`)

| المتغير | القيمة الافتراضية | الوصف |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | تُولَّد عند أول نشر | كلمة مرور المالك؛ **إلزامية**. تُطبَّق عند كل تشغيل، لذا فإن تغييرها يعيد تعيين كلمة مرور المالك المحدد بـ `RWD_ADMIN_EMAIL` |
| `RWD_ADMIN_EMAIL` | `admin` | حساب المالك (اسم الدخول). لا يُنشأ إلا عند أول تشغيل؛ وتغييره لاحقًا لا يضيف مالكًا، راجع [gateway/README](../../gateway/README.ar.md) |
| `RWD_PUBLIC_URL` | يُستنتج من الطلبات | العنوان العام للبوابة، مثل `https://rwd.example.com/v1`. يُنصح بضبطه |
| `RWD_METRICS_TOKEN` | يولّده `deploy.sh` | توكن Bearer للمسار `/v1/metrics` |
| `RWD_DATABASE_URL` | SQLite في `./data` | `postgres://…` لاستخدام Postgres بدلًا منه |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | عدد أيام الاحتفاظ بسجل التدقيق |
| `RWD_LANG` | `en` | لغة النصوص الموجّهة إلى الوكيل: `en`، `zh`، `zh-TW`، `fr`، `es`، `ru`، `ar`، `ja`، `ko`، `de` أو `pt` |
| `RWD_MCP_RATE_LIMIT` | — | عدد طلبات MCP لكل عنوان IP للعميل في الدقيقة (بلا حد إن لم يُضبط)؛ للعرض التوضيحي العلني، راجع [deploy/demo](../demo/README.md) |
| `RWD_OIDC_PROVIDER`، `RWD_OIDC_*` | — | تسجيل الدخول الموحّد عبر Feishu أو Lark أو OpenID Connect، راجع [gateway/README](../../gateway/README.ar.md#تسجيل-الدخول-الموحّد) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | نطاقات عناوين البروكسي الموجود أمام Caddy (نطاقات CIDR مفصولة بمسافات، أو `private_ranges` الخاصة بـ Caddy)؛ راجع ما يلي |
| `BIND` | `127.0.0.1` | العنوان الذي يُتاح عليه Caddy |
| `PORT` | `18788` | المنفذ الذي يُتاح عليه Caddy |
| `RWD_DOMAIN` | — | اسم المضيف العام لـ HTTPS المباشر (مع `compose.tls.yml` فقط) |
| `COMPOSE_FILE` | — | القيمة `compose.yml:compose.tls.yml` تفعّل HTTPS المباشر |

بعد تعديل `.env` على الخادم، طبّق التغييرات بتشغيل `docker compose up -d` في مجلد النشر.

## النشر باستخدام `deploy.sh`

<div dir="ltr">

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

</div>

`<ssh-host>` هو أي قيمة يقبلها `ssh` (اسم مستعار من `~/.ssh/config`، أو `user@host`)؛ و`<amd64|arm64>` هي معمارية المعالج على الخادم؛ وقيمة `remote-dir` الافتراضية هي `rwd-platform` داخل المجلد الرئيسي لمستخدم ssh. يقوم السكربت بما يلي:

1. يشغّل `make platform GOOS=linux GOARCH=<arch>` محليًا (SDK، ولوحة التحكم، والملف التنفيذي للبوابة)؛
2. ينسخ Dockerfile وملفات compose وملفات Caddyfile وصفحات العرض التوضيحي والملف التنفيذي إلى الخادم؛
3. **عند أول نشر فقط**، يكتب `.env` (بالصلاحيات 600) متضمنًا كلمة مرور عشوائية للمالك و`BIND` و`PORT` والإعدادات الاختيارية أدناه، ويطبع بيانات دخول المالك مرة واحدة. لا تستبدل عمليات النشر اللاحقة `.env` أبدًا؛ بل تضيف إليه فقط الإعدادات المستحدثة في الإصدارات الأحدث (مثل `RWD_METRICS_TOKEN`) إن كانت غائبة؛
4. إذا كان `data/rwd.db` موجودًا، يوقف البوابة وينسخ قاعدة البيانات إلى `data/rwd.db.bak-<YYYYmmddHHMMSS>` (تُنفَّذ عمليات ترحيل المخطط عند التشغيل التالي)، ثم يصحّح ملكية `data/` لتكون للمعرّف uid 10001، مستخدمًا حاوية مؤقتة بدلًا من sudo؛
5. يشغّل `docker compose up -d --build` ويعرض حالة الخدمات.

يمكن تمرير إعدادات النشر الأول بوصفها متغيرات بيئة، ولا تُقرأ إلا إذا لم يكن `.env` موجودًا بعد: `BIND`، و`PORT`، و`RWD_ADMIN_EMAIL`، و`RWD_PUBLIC_URL`، و`RWD_TRUSTED_PROXIES`، و`RWD_DOMAIN`.

### خلف بروكسي TLS قائم

<div dir="ltr">

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

</div>

يُتاح Caddy على `127.0.0.1:18788`. وجّه البروكسي لديك إليه وتأكد من أنه:

- يمرّر طلبات ترقية WebSocket (تتصل الصفحات بـ `/v1/page`)؛
- لا يخزّن الاستجابات مؤقتًا (buffering) ويسمح بالاتصالات طويلة الأمد: فالتحديثات الحية في لوحة التحكم (`/v1/api/stream`) وMCP تستخدم HTTP المتدفق؛ وترسل البوابة نبضة كل 25 ثانية، لذا تكفي مهلة خمول تزيد على 60 ثانية؛
- يرسل `X-Forwarded-For` و`X-Forwarded-Proto: https` والترويسة `Host` الأصلية.

مثال باستخدام nginx:

<div dir="ltr">

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    server_name rwd.example.com;
    # listen 443 ssl; ssl_certificate …; ssl_certificate_key …;

    location / {
        proxy_pass http://127.0.0.1:18788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

</div>

**`RWD_TRUSTED_PROXIES`.** لا يمرّر Caddy ترويسات `X-Forwarded-*` القادمة من البروكسي إلى البوابة إلا إذا اتصل البروكسي من عنوان موثوق. القيمة الافتراضية `private_ranges` تغطي البروكسي الموجود على المضيف نفسه أو في شبكة خاصة. أما إذا كان البروكسي يتصل من عنوان عام (خادم آخر، أو CDN، أو موازن أحمال سحابي)، فاضبط هذا المتغير على نطاقاته. وإلا فسترى البوابة البروكسي على أنه العميل: سيبدو كل طلب قادمًا من عنوان IP الخاص بالبروكسي (مما يعطّل قوائم السماح لعناوين IP في مفاتيح API وحدود المعدل لكل IP)، وعبر HTTP عادي (فلا يُوسَم ملف تعريف الارتباط الخاص بلوحة التحكم بـ `Secure`).

لإتاحة Caddy على عنوان أو منفذ آخر، اضبط `BIND` و`PORT`.

### HTTPS مباشر عبر `RWD_DOMAIN`

<div dir="ltr">

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

</div>

قبل النشر الأول، وجّه سجلات DNS للنطاق إلى الخادم وافتح المنفذين 80 و443 (TCP، إضافةً إلى UDP 443 لـ HTTP/3). عند ضبط `RWD_DOMAIN`، يكتب النشر الأول في `.env` القيم `RWD_DOMAIN` و`COMPOSE_FILE=compose.yml:compose.tls.yml` و`BIND=0.0.0.0` و`PORT=80` و`RWD_PUBLIC_URL=https://rwd.example.com/v1`. يحصل Caddy على الشهادة ويجددها بنفسه (Let's Encrypt عبر ميزة HTTPS التلقائي في Caddy)، ويحفظها في وحدة التخزين `caddy-data`، ويعيد توجيه HTTP إلى HTTPS. يبقى المنفذ 80 مفتوحًا لتحدي ACME ولإعادة التوجيه.

لتحويل نشر قائم إلى HTTPS المباشر، أضف هذه الأسطر الخمسة إلى `.env` وشغّل `docker compose up -d`.

## النشر يدويًا

من دون `deploy.sh`:

<div dir="ltr">

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# copy deploy/platform/* to the server, plus the binary as ./rwd
# on the server, in that directory:
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

</div>

### باستخدام صورة الإصدار

ينشر كل إصدار من البوابة أيضًا الصورة `ghcr.io/zanel1u/remote-webview-debugger` للمنصتين linux/amd64 وlinux/arm64، بالوسوم `<version>` (مثل `0.2.0`) و`<major>.<minor>` و`latest`، مع لوحة التحكم وSDK مضمَّنين. لتشغيلها بدلًا من بناء صورة، ضع `image: ghcr.io/zanel1u/remote-webview-debugger:<version>` مكان سطرَي `build:` و`image:` الخاصين بالبوابة في `compose.yml`، واستغنِ عن الملف التنفيذي، ثم ابدأ بـ `docker compose up -d`. للترقية غيّر الوسم ثم شغّل `docker compose pull && docker compose up -d` (خذ نسخة احتياطية من `data/` أولًا، كما يفعل `deploy.sh`).

لتجربة سريعة من دون Compose، تعمل الصورة وحدها أيضًا: راجع [البدء السريع](../../README.ar.md#1-تشغيل-البوابة). وعند تشغيلها وحدها لا تثق بترويسات `X-Forwarded-*`؛ فإن وضعت بروكسي خاصًا بك أمامها، فأضف `-e RWD_TRUST_PROXY=1`.

## الترقية

شغّل `deploy.sh` مجددًا بالمضيف والمعمارية والمجلد أنفسها. سيعيد البناء، وينسخ الملف التنفيذي الجديد، ويأخذ نسخة احتياطية من قاعدة بيانات SQLite، ويعيد تشغيل الحزمة؛ ويُحتفظ بـ `.env` كما هو. توقّع انقطاعًا قصيرًا. تعيد الصفحات الاتصال من تلقاء نفسها: بعد انقطاع وجيز خلال ثوانٍ؛ وبعد انقطاع أطول قد تتحول الصفحة أولًا إلى الاستطلاع الدوري (polling) ثم تعود إلى WebSocket خلال بضع دقائق، أو فور اتصال وكيل بها. أما الوكلاء المرتبطون في تلك اللحظة فعليهم الاتصال من جديد.

## النسخ الاحتياطي

- **نسخ تلقائية.** تنسخ كل عملية نشر `data/rwd.db` إلى `data/rwd.db.bak-<time>` قبل إعادة التشغيل. تتراكم هذه النسخ؛ فاحذف القديمة منها من حين لآخر.
- **نسخ احتياطية منتظمة.** يعمل SQLite بنمط WAL، لذا قد تبقى أحدث عمليات الكتابة في `rwd.db-wal` أثناء عمل البوابة. للحصول على نسخة متّسقة، أوقف البوابة لفترة وجيزة:

  <div dir="ltr">

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

  </div>

- **الاستعادة.** أوقف البوابة، وضع النسخة الاحتياطية مكان `data/rwd.db` (واحذف `rwd.db-wal` / `rwd.db-shm`)، وتأكد من أن ملكيتها للمعرّف uid 10001، ثم شغّل البوابة.
- خذ نسخة احتياطية من `.env` أيضًا. تحتوي النسخ الاحتياطية لقاعدة البيانات على قيمة pepper لمفاتيح API وسرّ جلسات لوحة التحكم: فاحفظها في مكان خاص.

## Postgres

اضبط `RWD_DATABASE_URL` في `.env`، مثل `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`، وشغّل `docker compose up -d`. يجب أن تستطيع حاوية البوابة الوصول إلى قاعدة البيانات (قاعدة بيانات مُدارة، أو خدمة `postgres` تضيفها في ملف compose override). يُنشأ المخطط عند بدء التشغيل؛ ولا تُنسخ البيانات من ملف SQLite موجود. لا ينسخ `deploy.sh` احتياطيًا إلا SQLite، لذا خذ نسخًا احتياطية من Postgres باستخدام `pg_dump` أو اللقطات التي يوفرها مزوّد الخدمة.

## التشغيل اليومي

<div dir="ltr">

```bash
docker compose ps                                     # status
docker compose logs -f gateway                        # gateway logs (the generated owner password, errors…)
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

</div>

- **نسيت كلمة مرور المالك:** غيّر `RWD_ADMIN_PASSWORD` في `.env` وشغّل `docker compose up -d`؛ فهي تُطبَّق عند بدء التشغيل.
- شغّل نسخة **واحدة** من البوابة لكل قاعدة بيانات: فالحالة الحية (الصفحات المتصلة، وحالة التحكم) موجودة داخل عملية البوابة.
- صفحات العرض التوضيحي تحت `/demo/` اختيارية؛ احذف محتويات `demo/` إن لم تُرد إتاحتها للعموم (ستنسخها عملية النشر التالية مجددًا).

</div>
