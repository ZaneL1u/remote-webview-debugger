<!-- i18n-source: 1de93768d1f6453d5cd81a0a70e3d0d7449a8e4e -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | العربية

<div dir="rtl">

# خادم MCP لـ RWD (`mcp/`)

تربط `remote-webview-debugger-mcp` أي وكيل MCP — Cursor و Codex و Gemini CLI و Windsurf و Cline و VS Code و opencode و Claude Code و Claude Desktop — ببوابة واحدة أو أكثر من بوابات Remote WebView Debugger. يشغّلها الوكيل بوصفها خادم MCP محليًا عبر stdio؛ وهي تمرّر كل استدعاء أداة إلى نقطة MCP في البوابة (`/v1/mcp`) مع مفتاح API الخاص بك.

- **كل وكيل، بأمر واحد.** `npx -y remote-webview-debugger-mcp`. لا شيء يحتاج إلى تثبيت، ولا اعتماديات وقت التشغيل.
- **عدة بوابات.** اضبط ما تشاء من البوابات، لكلٍّ منها عنوانها ومفتاح API الخاص بها. تظهر أجهزة جميع البوابات في قائمة واحدة، موسومة باسم البوابة.
- **تصمد أمام إعادة التشغيل.** حين تُعاد تشغيل البوابة أو تنقطع الشبكة، يفتح الخادم جلسة جديدة ويعيد إرسال الاستدعاء إن لم يكن قد وصل إلى البوابة أصلًا.
- **المفاتيح خارج إعدادات الوكلاء.** تُحفظ البوابات والمفاتيح في ملف واحد لا يقرؤه سواك. ولا يحتوي إعداد كل وكيل إلا على أمر `npx`.

يمكن للوكلاء الذين يدعمون MCP عبر HTTP أن يتصلوا بالبوابة مباشرةً أيضًا (انظر [README الرئيسي](../README.ar.md#3-ربط-وكيلك)). هذه الحزمة مخصّصة للوكلاء الذين لا يشغّلون إلا خوادم محلية، ولاستخدام عدة بوابات، ولإعداد لا يضع المفاتيح في إعدادات الوكلاء.

## البدء السريع

أنشئ مفتاح API في لوحة تحكم البوابة (مفاتيح API؛ مفتاح واحد يصل إلى كل الأجهزة)، ثم شغّل:

<div dir="ltr">

```bash
npx -y remote-webview-debugger-mcp init
```

</div>

يسألك `init` عن عنوان البوابة ومفتاح API، ويتحقق منهما مقابل البوابة. ثم يضيف خادم MCP إلى الوكلاء الذين يعثر عليهم على هذا الجهاز، ويعرض عليك تثبيت مهارة الوكيل. أعد تشغيل وكيلك واطلب منه: *«اعرض الأجهزة المتصلة»*.

ما يغيّره `init`:

| | |
|---|---|
| البوابات والمفاتيح | `~/.config/remote-webview-debugger/mcp.json` (الصلاحيات 0600؛ و `%APPDATA%\remote-webview-debugger\mcp.json` على Windows) |
| الوكلاء | يضيف الخادم باسم `remote-webview-debugger` إلى إعداد MCP الخاص بكل وكيل، ويحفظ نسخة احتياطية من الملف القديم باسم `<file>.bak`. لا يمسّ ملفًا يحتوي على تعليقات؛ بل يعطيك المقطع لتلصقه بنفسك |
| المهارة | `npx skills add ZaneL1u/remote-webview-debugger --skill remote-webview-debugger -g`، إن وافقت |

شغّل `init` مرة أخرى لإضافة بوابة أخرى أو وكيل آخر. تبقى البوابات الموجودة كما هي، وتُستبدل البوابة التي تحمل الاسم نفسه.

## مهارة الوكيل

تخبر المهارة الوكيل متى يستخدم Remote WebView Debugger وكيف: الاتصال، والموافقة على الهاتف، و `set_task`، واللقطات قبل الإجراءات، وكيفية تقصّي الخلل. وهي تتبع صيغة [Agent Skills](https://agentskills.io)، وتُثبَّت عبر [`skills`](https://github.com/vercel-labs/skills):

<div dir="ltr">

```bash
npx skills add ZaneL1u/remote-webview-debugger
```

</div>

لا يثبّت `skills add` إلا المهارة؛ أما خادم MCP فيأتي من `init` (أو من إضافة، انظر أدناه). والمهارة تعرف ذلك: حين تغيب الأدوات، تطلب من الوكيل أن يطلب منك تشغيل `init`. والمهارة موجودة أيضًا في حزمة npm تحت `skills/`.

**الإضافات** تثبّت خادم MCP والمهارة معًا. شغّل `init` مرة واحدة على أي حال، كي يعرف الخادم بواباتك:

- **Claude Code:** `/plugin marketplace add ZaneL1u/remote-webview-debugger`، ثم `/plugin install remote-webview-debugger@remote-webview-debugger`.
- **Gemini CLI:** `gemini extensions install https://github.com/ZaneL1u/remote-webview-debugger`.

## الإعداد اليدوي لوكيل

يشغّل كل وكيل الأمر نفسه: `npx -y remote-webview-debugger-mcp@latest`. مع `@latest`، يلتقط npx الإصدار الجديد عند بدء الوكيل؛ وتتبع أدوات الخادم أدوات البوابة. على Windows، استخدم `"command": "cmd"` مع `"args": ["/c", "npx", "-y", "remote-webview-debugger-mcp@latest"]`.

قد تستمر أدوات الانتظار في البوابة (`wait_for_device`، `wait_for_control`، …) حتى 10 دقائق. وحيث يكون للوكيل مهلة للأدوات، ترفعها المقاطع أدناه إلى 660 ثانية.

### Cursor، Windsurf، Claude Desktop

`~/.cursor/mcp.json` أو `~/.codeium/windsurf/mcp_config.json` أو `claude_desktop_config.json`:

<div dir="ltr">

```json
{
  "mcpServers": {
    "remote-webview-debugger": {
      "command": "npx",
      "args": ["-y", "remote-webview-debugger-mcp@latest"]
    }
  }
}
```

</div>

### Codex

`~/.codex/config.toml`:

<div dir="ltr">

```toml
[mcp_servers.remote-webview-debugger]
command = "npx"
args = ["-y", "remote-webview-debugger-mcp@latest"]
startup_timeout_sec = 30
tool_timeout_sec = 660
```

</div>

### Gemini CLI

`~/.gemini/settings.json` (`timeout` بالمللي ثانية):

<div dir="ltr">

```json
{
  "mcpServers": {
    "remote-webview-debugger": {
      "command": "npx",
      "args": ["-y", "remote-webview-debugger-mcp@latest"],
      "timeout": 660000
    }
  }
}
```

</div>

### VS Code (GitHub Copilot) و Cline

VS Code: يحتوي ملف `mcp.json` الخاص بالمستخدم (الأمر **MCP: Open User Configuration**) على `servers`، ولكلٍّ منها `"type": "stdio"`. Cline: يفتح **MCP Servers → Configure** الملف `cline_mcp_settings.json`، الذي يأخذ صيغة `mcpServers` أعلاه، مع `"timeout": 660` (بالثواني).

<div dir="ltr">

```json
{
  "servers": {
    "remote-webview-debugger": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "remote-webview-debugger-mcp@latest"]
    }
  }
}
```

</div>

### opencode

`~/.config/opencode/opencode.json`:

<div dir="ltr">

```json
{
  "mcp": {
    "remote-webview-debugger": {
      "type": "local",
      "command": ["npx", "-y", "remote-webview-debugger-mcp@latest"],
      "enabled": true
    }
  }
}
```

</div>

### Claude Code

<div dir="ltr">

```bash
claude mcp add -s user remote-webview-debugger -- npx -y remote-webview-debugger-mcp@latest
```

</div>

## البوابات

يكتب `init` ملف الإعداد نيابةً عنك. ويمكنك أيضًا تحريره يدويًا:

<div dir="ltr">

```json
{
  "gateways": {
    "prod": { "url": "https://rwd.example.com", "apiKey": "rwd_sk_live_…" },
    "staging": { "url": "https://rwd-staging.example.com", "apiKeyEnv": "RWD_KEY_STAGING" }
  }
}
```

</div>

- `url` هو عنوان البوابة. كلٌّ من `https://rwd.example.com` و `…/v1` و `…/v1/mcp` يعمل.
- لكل بوابة إما `apiKey`، وإما `apiKeyEnv` يسمّي متغير بيئة يحمل المفتاح.
- أسماء البوابات أحرف لاتينية صغيرة وأرقام و `-` و `_`. وهذه الأسماء هي ما يراه الوكلاء.

تعمل متغيرات البيئة بدلًا من الملف، أو إضافةً إليه. والبوابة المضبوطة في البيئة تحلّ محل بوابة الملف التي تحمل الاسم نفسه. اضبطها في إعداد MCP للوكيل (`env`)، أو في الصدفة (shell) التي تشغّل الوكيل:

| المتغير | المعنى |
|---|---|
| `RWD_CONFIG` | ملف إعداد آخر (أو `--config <file>`) |
| `RWD_URL`، `RWD_API_KEY` | بوابة واحدة باسم `default` (أو `RWD_NAME`) |
| `RWD_GATEWAYS` | عدة بوابات: `prod=https://rwd.example.com,lab=http://10.0.0.5:8080` |
| `RWD_API_KEY_<NAME>` | مفتاح كل بوابة في `RWD_GATEWAYS` (`RWD_API_KEY_PROD`، `RWD_API_KEY_LAB`) |

## عدة بوابات

مع بوابة واحدة، يمرّر الخادم الأدوات والنتائج كما هي. ومع عدة بوابات:

- يسأل `list_devices` كل البوابات في وقت واحد، ويجمع الأجهزة تحت `## <gateway> (<host>)`. والبوابة المتوقفة أو التي ترفض المفتاح تُظهر خطأها هناك، بينما تواصل البقية الإجابة. مرّر `gateway` لسؤال بوابة واحدة فقط.
- يقبل `connect_device` و `wait_for_device` وسيطًا اختياريًا `gateway`، أو جهازًا مكتوبًا بصيغة `<gateway>:<code>` (`prod:K7Q2-9M4X`). ومن دون أيٍّ منهما، يبحث الخادم عن رمز الجهاز في كل البوابات ويستخدم التي تحتوي عليه. وإن وُجد الرمز في عدة بوابات، أو حُدِّد الجهاز بـ deviceId، يُطلب من الوكيل أن يسمّي البوابة.
- بعد `connect_device`، تذهب كل الأدوات الأخرى إلى بوابة ذلك الجهاز، وتبدأ النتيجة بـ `[gateway: <name> (<host>)]`. والارتباط بجهاز على بوابة أخرى يفكّ الارتباط بالجهاز السابق، كي لا يبقى ذلك الهاتف مقفلًا.
- يُظهر `list_gateways` (المتاح أيضًا مع بوابة واحدة) عنوان كل بوابة وإصدارها وحالتها، والبوابة التي يوجد عليها الجهاز المرتبط.

## الأوامر

<div dir="ltr">

```bash
npx -y remote-webview-debugger-mcp                 # خادم MCP عبر stdio (ما يشغّله الوكلاء)
npx -y remote-webview-debugger-mcp init            # إضافة البوابات، وإعداد الوكلاء، وتثبيت المهارة
npx -y remote-webview-debugger-mcp doctor          # فحص كل بوابة ومفتاح؛ وعرض الوكلاء الذين عُثر عليهم
```

</div>

يعمل `init` أيضًا دون أسئلة، للسكربتات ولوثائق الإعداد الخاصة بالفريق:

<div dir="ltr">

```bash
RWD_API_KEY=rwd_sk_live_… npx -y remote-webview-debugger-mcp init \
  --gateway prod=https://rwd.example.com --clients cursor,codex --skill -y
```

</div>

| الخيار | المعنى |
|---|---|
| `--gateway [name=]<url>` | بوابة تُضاف (يمكن تكراره). من دون اسم، يُشتقّ اسم من المضيف |
| `--api-key <key>` | مفتاح API الخاص بها (لبوابة واحدة). وإلا فمن `RWD_API_KEY_<NAME>` أو `RWD_API_KEY` أو بسؤالك |
| `--api-key-env <VAR>` | يحفظ «اقرأ المفتاح من `VAR`» بدلًا من المفتاح نفسه |
| `--clients <ids>` | `claude-code`، `cursor`، `codex`، `gemini`، `windsurf`، `cline`، `vscode`، `opencode`، `claude-desktop`، أو `all`، `detected`، `none` |
| `--skill`، `--no-skill` | تثبيت المهارة أو عدم تثبيتها (الافتراضي: السؤال؛ ومع `-y`: عدم التثبيت) |
| `--name <name>` | اسم الخادم في إعدادات الوكلاء (الافتراضي `remote-webview-debugger`) |
| `--config <file>` | ملف إعداد آخر. والوكلاء الذين يُعدّون في التشغيل نفسه يحصلون على `RWD_CONFIG` |
| `--no-verify` | الحفظ دون التحقق من البوابة والمفتاح |
| `-y`، `--yes` | دون أسئلة: إعداد الوكلاء الذين عُثر عليهم، ولا مهارة إلا مع `--skill` |

## استكشاف الأخطاء وإصلاحها

- **لا توجد لدى الوكيل أدوات Remote WebView Debugger.** أعد تشغيل الوكيل بعد `init`. وشغّل `npx -y remote-webview-debugger-mcp doctor` للتحقق من سلامة ملف الإعداد والبوابات.
- **«rejected the API key».** أُلغي المفتاح، أو انتهت صلاحيته، أو أُزيل مالكه. أنشئ مفتاحًا جديدًا في لوحة التحكم وشغّل `init` مرة أخرى باسم البوابة نفسه.
- **البدء الأول بطيء.** ينزّل npx الحزمة في المرة الأولى، ومرة أخرى بعد كل إصدار جديد. وتستخدم مرات البدء اللاحقة ذاكرة npx المؤقتة.
- **ينتهي الاستدعاء بانقضاء المهلة بعد 60 ثانية.** مهلة الأدوات الخاصة بالوكيل نفسه قصيرة جدًا. ارفعها كما هو موضّح في [الإعداد اليدوي لوكيل](#الإعداد-اليدوي-لوكيل).

## الإصدارات

تحمل الحزمة رقم إصدار البوابة، وتُصدَر معها (`gateway-vX.Y.Z`، انظر [إصدار النسخ](../docs/releasing.ar.md)). وأي إصدار يعمل مع أي بوابة: فالأدوات تأتي من البوابة وقت التشغيل.

## التطوير

<div dir="ltr">

```bash
cd mcp && npm ci
npm run build       # dist/cli.mjs، ملف واحد دون اعتماديات وقت التشغيل
npm test            # البناء، ثم اختبارات الوحدات والاختبارات الشاملة مقابل بوابتين وهميتين
node dist/cli.mjs doctor
```

</div>

</div>
