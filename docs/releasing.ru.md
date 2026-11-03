<!-- i18n-source: 9be9df7e70f41a674848b25979f1ef7cb1f96f33 -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | [日本語](releasing.ja.md) | [Español](releasing.es.md) | [Français](releasing.fr.md) | Русский | [العربية](releasing.ar.md)

# Выпуск релизов

SDK страницы и шлюз выпускаются раздельно. У каждого своя версия, свой тег и свой журнал изменений, и в журнал попадают только коммиты, затронувшие его собственные пути.

| | SDK страницы | Шлюз |
|---|---|---|
| Пути | `sdk/`, `packages/chobitsu/` | `gateway/`, `console/`, `deploy/` |
| Тег | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| Где хранится версия | `sdk/package.json` | в теге (`make` читает её через `git describe`) |
| Журнал изменений | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md), [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md), [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| Публикуется как | npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (jsDelivr, unpkg) | `rwd_<version>_<os>_<arch>.tar.gz` для linux / darwin × amd64 / arm64, образ `ghcr.io/zanel1u/remote-webview-debugger` |

Бинарный файл шлюза содержит SDK из того же коммита; какая это версия SDK, указано в соответствующем разделе журнала изменений шлюза.

## Как выпустить релиз

На актуальной, чистой ветке `main` с зелёным CI:

```bash
make release-sdk ARGS=--dry-run     # предпросмотр: следующая версия и оба раздела журналов изменений
make release-sdk                    # повысить версию, записать журналы, сделать коммит, тег sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # тег запускает .github/workflows/release.yml
```

`make release-gateway` работает так же. Пока вы не сделали push, ничего не покидает вашу машину. Чтобы отменить релиз, который ещё не отправлен: `git tag -d <tag> && git reset --hard HEAD~1`.

`ARGS` принимает:

| Параметр | Действие |
|---|---|
| `--dry-run` | Только вывести, ничего не менять |
| `--major`, `--minor`, `--patch` | Принудительно выбрать, какую часть версии повысить, вместо вывода из коммитов |
| `--version X.Y.Z` | Точная версия, например `0.3.0-rc.1` для пререлиза |
| `--edit` | Открыть оба журнала изменений в `$EDITOR` перед коммитом |

Скрипт — [`scripts/release/release.mjs`](../scripts/release/release.mjs); для чтения и разбора коммитов он использует [changelogen](https://github.com/unjs/changelogen).

## Версии и журналы изменений

Коммиты следуют [Conventional Commits](https://www.conventionalcommits.org/). С момента предыдущего тега компонента:

- ломающее изменение (`feat!:` или футер `BREAKING CHANGE:`) повышает мажорную версию, а до 1.0 — минорную;
- `feat` повышает минорную версию;
- `fix`, `perf`, `refactor`, `deploy`, `build` и `docs` повышают патч-версию.

Именно эти типы попадают в журнал изменений, от старых к новым; `test`, `ci`, `chore` и сами релизные коммиты не включаются. Scope, совпадающий с компонентом (`fix(sdk):` в журнале SDK), отбрасывается, остальные scope показываются. Первый релиз компонента сохраняет текущую версию — 0.1.0.

**Записи на китайском.** В китайском журнале изменений заголовки на китайском. Запись — это тема коммита, если только у коммита нет трейлера `Changelog-Zh:`:

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

Чтобы написать или отшлифовать китайские записи уже во время релиза, используйте `--edit`.

## Что CI делает с тегом

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

- **`sdk-v*`:** проверяет, что в `sdk/package.json` указана версия из тега, собирает, выполняет `npm publish --provenance`, если этой версии ещё нет в npm (версия с `-` уходит в dist-tag `next`), и создаёт GitHub Release с `sdk.js`, `index.mjs`, `index.d.ts` и npm-архивом пакета. Релизы SDK не помечаются как последний релиз репозитория.
- **`gateway-v*`:** собирает SDK и веб-консоль, четыре бинарных файла `rwd` с версией из тега (проверяется через `rwd version`), отправляет образ в GHCR для linux/amd64 и linux/arm64 с тегами `<version>`, `<major>.<minor>` и `latest` (для пререлизов — только `<version>`) и создаёт GitHub Release с архивами и `checksums.txt`.

Текст релиза — соответствующий раздел английского и китайского журналов изменений ([`scripts/release/notes.mjs`](../scripts/release/notes.mjs)), после инструкций по установке этой версии.

Если workflow упал, ничего не опубликовав, удалите тег (`git push --delete origin <tag>` и `git tag -d <tag>`), исправьте проблему в `main` и поставьте тег заново. Версию, которая уже есть в npm, повторно опубликовать нельзя: выпустите следующую патч-версию.

## Первоначальная настройка

- **npm.** Workflow публикует пакет через [доверенную публикацию](https://docs.npmjs.com/trusted-publishers) (OIDC, без секретов): на npmjs.com в настройках пакета → Trusted publishing → GitHub Actions, репозиторий `ZaneL1u/remote-webview-debugger`, workflow `release.yml`. С токеном npm требует одноразовый пароль, поэтому версию, которую workflow опубликовать не может (например, самую первую, пока пакета ещё нет), публикуют вручную из checkout тега: `cd sdk && npm ci && npm run build && npm publish --access public` после `npm login`. Затем перезапустите упавший запуск workflow; он пропустит публикацию и создаст GitHub Release.
- **GHCR.** Образ появляется среди пакетов владельца репозитория после первого релиза шлюза. Он связан с публичным репозиторием; один раз проверьте, что он публичный (настройки пакета → Change visibility).
