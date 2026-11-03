<!-- i18n-source: 9be9df7e70f41a674848b25979f1ef7cb1f96f33 -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | [日本語](releasing.ja.md) | [Español](releasing.es.md) | [Français](releasing.fr.md) | [Русский](releasing.ru.md) | العربية

<div dir="rtl">

# إصدار النسخ

يُصدَر SDK الصفحة والبوابة كلٌّ على حدة. لكلٍّ منهما رقم إصدار ووسم (tag) وسجل تغييرات خاص به، ولا يذكر سجل تغييرات أيٍّ منهما إلا الإيداعات (commits) التي مسّت مساراته هو.

| | SDK الصفحة | البوابة |
|---|---|---|
| المسارات | `sdk/`، `packages/chobitsu/` | `gateway/`، `console/`، `deploy/` |
| الوسم | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| موضع رقم الإصدار | `sdk/package.json` | الوسم نفسه (يقرؤه `make` عبر `git describe`) |
| سجل التغييرات | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md)، [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md)، [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| يُنشَر على شكل | حزمة npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (عبر jsDelivr و unpkg) | `rwd_<version>_<os>_<arch>.tar.gz` لـ linux / darwin × amd64 / arm64، والصورة `ghcr.io/zanel1u/remote-webview-debugger` |

يضمّ الملف التنفيذي للبوابة SDK الإيداع نفسه، ويذكر قسمها في سجل التغييرات أيّ إصدار من SDK هو.

## إنشاء إصدار

على فرع `main` محدَّث ونظيف واجتاز CI:

<div dir="ltr">

```bash
make release-sdk ARGS=--dry-run     # معاينة: الإصدار التالي وقسما سجل التغييرات
make release-sdk                    # رفع الإصدار، وكتابة سجلّي التغييرات، والإيداع، ووضع الوسم sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # الوسم يُطلق .github/workflows/release.yml
```

</div>

يعمل `make release-gateway` بالطريقة نفسها. لا يغادر شيءٌ جهازك حتى تنفّذ push. للتراجع عن إصدار لم تدفعه بعد: `git tag -d <tag> && git reset --hard HEAD~1`.

يقبل `ARGS`:

| الخيار | الأثر |
|---|---|
| `--dry-run` | يطبع النتيجة دون أن يغيّر شيئًا |
| `--major`، `--minor`، `--patch` | يفرض نوع الرفع بدلًا من استنتاجه من الإيداعات |
| `--version X.Y.Z` | رقم إصدار محدد، مثل `0.3.0-rc.1` لإصدار تجريبي |
| `--edit` | يفتح سجلّي التغييرات في `$EDITOR` قبل الإيداع |

السكربت هو [`scripts/release/release.mjs`](../scripts/release/release.mjs)؛ ويستخدم [changelogen](https://github.com/unjs/changelogen) لقراءة الإيداعات وتحليلها.

## أرقام الإصدارات وسجلات التغييرات

تتبع الإيداعات [Conventional Commits](https://www.conventionalcommits.org/). منذ الوسم السابق للمكوّن:

- التغيير الكاسر (`feat!:` أو تذييل `BREAKING CHANGE:`) يرفع الإصدار الرئيسي، أو الثانوي قبل 1.0؛
- `feat` يرفع الإصدار الثانوي؛
- `fix` و `perf` و `refactor` و `deploy` و `build` و `docs` ترفع إصدار التصحيح (patch).

هذه الأنواع هي ما يذكره سجل التغييرات، الأقدم أولًا؛ أما `test` و `ci` و `chore` وإيداعات الإصدار نفسها فتُستبعد. النطاق (scope) المطابق لاسم المكوّن (`fix(sdk):` في سجل تغييرات SDK) يُحذف، وتُعرض النطاقات الأخرى. يحتفظ الإصدار الأول لأي مكوّن بالرقم الموجود فيه، أي 0.1.0.

**المدخلات الصينية.** لسجل التغييرات الصيني عناوين صينية. المدخل هو عنوان الإيداع، ما لم يحتوِ الإيداع على تذييل `Changelog-Zh:`:

<div dir="ltr">

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

</div>

إن أردت كتابة المدخلات الصينية أو تنقيحها وقت الإصدار بدلًا من ذلك، فاستخدم `--edit`.

## ما يفعله CI بالوسم

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

- **`sdk-v*`:** يتحقق من أن `sdk/package.json` يحمل رقم إصدار الوسم، ويبني، ويشغّل `npm publish --provenance` ما لم يكن ذلك الإصدار موجودًا على npm مسبقًا (الإصدار الذي يحتوي على `-` يذهب إلى dist-tag `next`)، وينشئ GitHub Release يضم `sdk.js` و `index.mjs` و `index.d.ts` وأرشيف npm. لا تُعلَّم إصدارات SDK بوصفها أحدث إصدار في المستودع.
- **`gateway-v*`:** يبني SDK ولوحة التحكم، والملفات التنفيذية الأربعة لـ `rwd` برقم الإصدار المأخوذ من الوسم (ويتحقق منه عبر `rwd version`)، ويدفع الصورة إلى GHCR لـ linux/amd64 و linux/arm64 بالأوسمة `<version>` و `<major>.<minor>` و `latest` (الإصدارات التجريبية: `<version>` فقط)، وينشئ GitHub Release يضم الأرشيفات و `checksums.txt`.

نص الـ Release هو القسم المقابل من سجل التغييرات الإنجليزي والصيني ([`scripts/release/notes.mjs`](../scripts/release/notes.mjs))، تسبقه تعليمات التثبيت لذلك الإصدار.

إذا فشل سير العمل قبل أن ينشر أي شيء، فاحذف الوسم (`git push --delete origin <tag>` و `git tag -d <tag>`)، وأصلح المشكلة على `main`، ثم ضع الوسم من جديد. لا يمكن نشر إصدار موجود على npm مرة ثانية: أصدر التصحيح التالي بدلًا من ذلك.

## الإعداد لمرة واحدة

- **npm.** ينشر سير العمل عبر [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC، دون أي سرّ): على npmjs.com، إعدادات الحزمة ← Trusted publishing ← GitHub Actions، المستودع `ZaneL1u/remote-webview-debugger`، وسير العمل `release.yml`. يطلب npm من التوكن كلمة مرور لمرة واحدة، لذا فالإصدار الذي لا يستطيع سير العمل نشره (مثل الإصدار الأول، قبل أن تُنشأ الحزمة) يُنشر يدويًا من نسخة مسحوبة على الوسم: `cd sdk && npm ci && npm run build && npm publish --access public` بعد `npm login`. بعدها أعد تشغيل سير العمل الفاشل؛ فسيتخطى النشر وينشئ GitHub Release.
- **GHCR.** تظهر الصورة ضمن حزم مالك المستودع بعد أول إصدار للبوابة. وهي مرتبطة بالمستودع العام؛ تحقّق مرة واحدة من أنها عامة (إعدادات الحزمة ← Change visibility).

</div>
