<!-- i18n-source: 06e0ec95125ff3b75eba28c600e7a94e88fe2da9 -->
[English](translating.md) | 简体中文

# 文档翻译

README 和文档以英文撰写，并翻译成简体中文、繁体中文、日语、西班牙语、法语、俄语和阿拉伯语。英文是原文：先改英文，再同步译文。更新日志由发版脚本生成，只有英文和简体中文两版。

## 文件组织

译文放在英文文件旁边，在 `.md` 前加上语言代码：

| 语言 | 后缀 | 示例 |
|---|---|---|
| English | | `docs/protocol.md` |
| 简体中文 | `.zh-CN` | `docs/protocol.zh-CN.md` |
| 繁體中文 | `.zh-TW` | `docs/protocol.zh-TW.md` |
| 日本語 | `.ja` | `docs/protocol.ja.md` |
| Español | `.es` | `docs/protocol.es.md` |
| Français | `.fr` | `docs/protocol.fr.md` |
| Русский | `.ru` | `docs/protocol.ru.md` |
| العربية | `.ar` | `docs/protocol.ar.md` |

放在同一目录下，指向代码、示例和图片的相对链接在每种语言里都不用改。哪些文档要翻译、翻译成哪些语言，记录在 [`scripts/docs/i18n.mjs`](../scripts/docs/i18n.mjs)。

每份译文：

- 第一行是 `<!-- i18n-source: <id> -->`，即翻译时所依据的英文文件的 git blob id；
- 带有检查脚本要求的语言切换行（当前语言是纯文本，其他语言是链接）；
- 标题（数量、级别、顺序）、代码块（数量和语言标记）和表格与英文版一致；
- 链接到其他已翻译文档时指向同一语言的版本，锚点按那个版本的标题生成；
- 阿拉伯语版把正文包在 `<div dir="rtl">` 里，每个代码块再包一层 `<div dir="ltr">`。

代码、命令、标识符和环境变量保持英文。术语用控制台和手机端界面在该语言里的用词。

## 改了英文文档之后

1. 运行检查，`make check` 也会运行它：

   ```bash
   node scripts/docs/i18n.mjs check
   ```

   你改过的文件的每份译文都会被报为过期，并附上一条 `git diff <old> <new>`，显示自翻译以来英文文件改了什么（英文改动提交后，旧的 blob 才在仓库里）。
2. 把同样的改动同步到每份译文。按意思翻译，不要逐字直译；可以人工翻译，也可以用模型翻译，但提交前要读一遍。
3. 标记为已同步，再检查一次：

   ```bash
   node scripts/docs/i18n.mjs stamp docs/protocol.*.md
   node scripts/docs/i18n.mjs check
   ```

译文过期只是警告，所以英文的修正可以先合入，译文随后跟上；`check --strict` 会把它们变成错误。缺少译文、切换行不对、结构和英文对不上、断链或锚点不存在，始终是错误。

## 新增文档或语言

- **新增文档：** 把英文路径加进 `scripts/docs/i18n.mjs` 的 `DOCS`，写好各语言译文并打上标记。
- **新增语言：** 加进 `LANGS`（顺序就是切换行里的顺序），翻译所有文档，再更新现有每种语言的切换行；检查脚本会打印每个文件应有的那一行。
