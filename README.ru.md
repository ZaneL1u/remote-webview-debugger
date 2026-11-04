<!-- i18n-source: 17d2a3687452758f5c2d903bfc5e90dd1d96013b -->
<div align="center">

# Remote WebView Debugger

**ИИ-агенты отлаживают WebView внутри вашего приложения и ваши H5-страницы — на телефонах реальных пользователей, удалённо, через MCP.**

[debugger.site](https://debugger.site) · [Онлайн-демо](https://debugger.site/#demo) · [Документация](docs/architecture.ru.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | Русский | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

Баг, который проявляется только на телефоне одного пользователя — внутри суперприложения вроде WeChat или в WebView вашего собственного приложения, — отлаживать труднее всего: ни USB-кабеля, ни порта удалённой отладки, ни способа воспроизвести его у себя. Remote WebView Debugger вместо этого открывает такую страницу вашему ИИ-агенту.

- **Один тег script** (или нативная инъекция) — и страница онлайн. Пользователь видит небольшую плашку с кодом устройства и может нажать *Запросить поддержку*.
- **Агент подключается через MCP** — Claude Code, Cursor или любой MCP-клиент — после того как пользователь разрешит это на устройстве. Он читает снимки доступности, console, сетевые запросы и скриншоты, а ещё кликает, вводит текст и прокручивает, как человек, — на всех страницах и во всех WebView этого устройства.
- **Настоящий Chrome DevTools для людей.** Из консоли администратор открывает DevTools на любой подключённой странице — Elements, Console, Network (с тем, что произошло до его открытия) и хранилище Application — после того как пользователь разрешит это на устройстве.
- **Пользователь сохраняет контроль.** Он видит, что делает ИИ (курсор агента, карточка задачи с запланированными шагами, светящаяся рамка), и может в любой момент взять управление или завершить сеанс. Пароли, номера телефонов и карт маскируются ещё до того, как что-либо покинет телефон.
- **Самостоятельный хостинг.** Один бинарный файл на Go со встроенными веб-консолью и SDK; SQLite или Postgres.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## Быстрый старт

Три шага: запустить шлюз, добавить SDK на страницу, направить агента на шлюз.

### 1. Запустите шлюз

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

Откройте `http://<your-host>:8080` и войдите как **`admin`** с этим паролем. Если не задавать `RWD_ADMIN_PASSWORD`, случайный пароль будет один раз выведен в `docker logs rwd`. Образ основан на Alpine (linux/amd64 и linux/arm64), содержит веб-консоль и SDK и хранит всё в томе `rwd-data`; чтобы обновиться, выполните `docker pull` для нового тега и пересоздайте контейнер.

Полезные настройки передаются через `-e` ([все настройки](gateway/README.ru.md)):

| Переменная | Назначение |
|---|---|
| `RWD_ADMIN_EMAIL` | Логин владельца (по умолчанию `admin`) |
| `RWD_PUBLIC_URL` | Адрес, по которому к шлюзу обращаются телефоны и агенты, например `https://rwd.example.com/v1`, если он отличается от адреса в вашем браузере |
| `RWD_LANG=zh` | Описания и результаты MCP-инструментов на китайском |
| `RWD_DATABASE_URL` | `postgres://…`, чтобы использовать Postgres вместо SQLite |
| `RWD_TRUST_PROXY=1` | Только за вашим собственным обратным прокси: брать IP клиента и схему из `X-Forwarded-*` |

<details>
<summary>Другие способы запуска: бинарные файлы, Docker Compose с HTTPS, сборка из исходников</summary>

- **Бинарный файл.** В каждом релизе шлюза на [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) есть `rwd_<version>_<os>_<arch>.tar.gz` для Linux и macOS: распакуйте архив и запустите `./rwd serve --addr :8080`.
- **Docker Compose.** [`deploy/platform`](deploy/platform/README.ru.md) ставит перед шлюзом Caddy: за вашим собственным TLS-прокси или с собственным HTTPS и сертификатом Let's Encrypt (`RWD_DOMAIN=<host>`).
- **Из исходников.** `make -j16` (нужны Go и Node), затем `gateway/bin/rwd-<os>-<arch> serve --addr :8080`.

</details>

### 2. Подключите страницу

Создайте проект в веб-консоли, чтобы получить ключ приложения, и добавьте SDK с адресом вашего шлюза:

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

SDK — это npm-пакет [`remote-webview-debugger`](sdk/README.ru.md): загружайте его с jsDelivr, как показано выше, или с unpkg (`https://unpkg.com/remote-webview-debugger@0.3.0/dist/sdk.js`), либо выполните `npm install remote-webview-debugger` и `import { run } from 'remote-webview-debugger'`. Кроме того, шлюз отдаёт встроенную в него копию по адресу `/v1/sdk.js`.

В приложении внедряйте тот же скрипт в самом начале загрузки документа из нативного кода (iOS `WKUserScript`, Android `addDocumentStartJavaScript`): см. [интеграцию с нативным приложением](docs/native-integration.ru.md) и руководство, встроенное в веб-консоль.

### 3. Подключите агента

Создайте в веб-консоли API-ключ (один ключ даёт доступ ко всем устройствам), затем:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…и попросите: *«Подключись к устройству K7Q2-9M4X и выясни, почему итоговая сумма заказа отображается как `--`»*.

### HTTP или HTTPS?

Шлюз работает по обычному HTTP, и этого вполне достаточно: SDK выбирает `ws://` или `wss://` по адресу шлюза, а веб-консоль и MCP работают в обоих вариантах. Всё решает **отлаживаемая страница**. Браузеры и WebView не позволяют странице с `https://` загружать скрипты по `http://` или открывать соединения `ws://` (смешанное содержимое), даже если сам `sdk.js` загружен с CDN по HTTPS.

| Отлаживаемая страница | Шлюз по обычному HTTP |
|---|---|
| `http://`: локальный dev-сервер, тестовая среда во внутренней сети | ✅ Работает |
| `https://` в браузере или в iOS `WKWebView` | ❌ Блокируется как смешанное содержимое: включите на шлюзе HTTPS |
| `https://` в Android WebView | ⚠️ Только если приложение вызывает `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`, и только в отладочных сборках |

По обычному HTTP API-ключи и пароли веб-консоли передаются без шифрования, поэтому используйте его только в доверенной сети. Чтобы получить HTTPS, запустите [стек Compose](deploy/platform/README.ru.md) с `RWD_DOMAIN=<host>` (сертификат выпускается автоматически) или поставьте контейнер за собственный TLS-прокси и добавьте `-e RWD_TRUST_PROXY=1`.

## Возможности

- **Устройство в центре.** У устройства (одна установка приложения или один браузер) много страниц; один API-ключ и один MCP-сервер дают доступ ко всем устройствам. Агент следует за переходами и вновь открытыми WebView и видит общую хронологию всех страниц.
- **Инструменты агента.** Снимки доступности со ссылками на элементы (aria snapshot из Playwright), поиск, клик, заполнение полей, ввод текста, нажатие клавиш, выбор вариантов, наведение, прокрутка, перетаскивание, навигация, выполнение JavaScript, console, сетевые запросы с телами, хранилище, скриншоты (через нативный мост или DOM), пакетные действия, ожидания и события.
- **Согласие и контроль.** Одобрение на устройстве с уровнями доступа (`observe` / `interact` / `advanced`), необязательное автоматическое разрешение, блокировка экрана, пока действует агент, «Перехватить» / «Вернуть ИИ» / «Завершить», подтверждение чувствительных действий (`data-rwd-confirm`).
- **Конфиденциальность.** Поля паролей, `data-rwd-mask` и настраиваемые селекторы / шаблоны маскируются в снимках, скриншотах, console и сетевых данных. Журнал аудита фиксирует, кто что сделал, но без содержимого страниц.
- **Эксплуатация.** Участники и роли, API-ключи с уровнем / сроком действия / списком разрешённых IP, токены устройств, приглашения по QR-коду, квоты, обновление веб-консоли в реальном времени через SSE, метрики Prometheus.
- **11 языков и собственное оформление.** Веб-консоль, интерфейс на телефоне и тексты для агента — на английском, упрощённом и традиционном китайском, французском, испанском, русском, арабском (справа налево), японском, корейском, немецком и португальском: веб-консоль следует языку браузера (есть переключатель), интерфейс на телефоне — языку телефона или `run({ lang })`, а сторона агента — `RWD_LANG`. SDK страницы принимает ваши собственные языковые пакеты и формулировки, а его внешний вид меняется через CSS-переменные ([языки и оформление SDK](sdk/README.ru.md#языки)).
- **Уживается с eruda.** Необязательная вкладка Remote Debugger внутри eruda; при необходимости SDK может загрузить eruda для разработчиков.

## Структура репозитория

| Путь | Что внутри |
|---|---|
| [`gateway/`](gateway) | Шлюз на Go: WebSocket для страниц, REST и аутентификация веб-консоли, MCP-сервер, аудит, метрики |
| [`sdk/`](sdk) | SDK страницы (`sdk.js`) и его интерфейс на странице |
| [`packages/chobitsu/`](packages/chobitsu) | Встроенная в репозиторий копия [chobitsu](https://github.com/liriliri/chobitsu) и наш движок на стороне страницы в `src/engine/` |
| [`console/`](console) | Веб-консоль (React, Vite) |
| [`website/`](website) | [debugger.site](https://debugger.site) с интерактивным демо |
| [`examples/`](examples) | Многостраничный демо-магазин и macOS-приложение, которое размещает WKWebView так же, как iOS-приложение |
| [`deploy/platform/`](deploy/platform) | Развёртывание через Docker Compose |
| [`docs/`](docs) | [Архитектура](docs/architecture.ru.md), [протокол](docs/protocol.ru.md), [интеграция с нативным приложением](docs/native-integration.ru.md), [выпуск релизов](docs/releasing.ru.md) |

## Релизы

SDK страницы и шлюз выпускаются раздельно, у каждого своя версия, свой тег (`sdk-vX.Y.Z`, `gateway-vX.Y.Z`) и свой журнал изменений: [SDK](sdk/CHANGELOG.md), [шлюз](gateway/CHANGELOG.md). К релизу шлюза прилагаются бинарные файлы `rwd` для Linux и macOS и образ `ghcr.io/zanel1u/remote-webview-debugger`. См. [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases), а для мейнтейнеров — [выпуск релизов](docs/releasing.ru.md).

## Разработка

```bash
make -j16 check                                      # тесты шлюза, проверка типов SDK + тесты Playwright, сборка веб-консоли
cd console && PORT=8080 npm run mock & npm run dev   # веб-консоль с mock-шлюзом в памяти
cd website && npm run dev                            # сайт
```

## Благодарности

Движок на стороне страницы использует [chobitsu](https://github.com/liriliri/chobitsu) (MIT) для перехвата console и сетевых запросов, а также код снимков доступности из [Playwright](https://github.com/microsoft/playwright) (Apache-2.0). DevTools в консоли — это фронтенд Chrome DevTools в сборке [chii](https://github.com/liriliri/chii) (MIT; сам DevTools — BSD-3-Clause). См. [NOTICE](NOTICE).

## Лицензия

[MIT](LICENSE)
