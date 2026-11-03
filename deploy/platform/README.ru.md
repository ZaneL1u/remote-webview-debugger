<!-- i18n-source: 290e0636713e2be8bacb0501c422ae3a327ae0ea -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | Русский | [العربية](README.ar.md)

# Развёртывание через Docker Compose

Шлюз запускается на хосте с Docker, перед ним стоит небольшой [Caddy](https://caddyserver.com). Открыть его наружу можно двумя способами:

- **За существующим TLS-прокси** (по умолчанию): Caddy слушает `127.0.0.1:18788`, а ваш nginx, Caddy, Traefik или балансировщик нагрузки перед ним терминирует HTTPS.
- **Прямой HTTPS** с `RWD_DOMAIN`: Caddy сам обслуживает порты 80 и 443 и получает сертификат от Let's Encrypt.

`deploy.sh` собирает всё локально, передаёт по ssh и (пере)запускает стек. Настройки шлюза описаны в [gateway/README.ru.md](../../gateway/README.ru.md).

## Файлы

| Файл | Назначение |
|---|---|
| `Dockerfile` | Образ шлюза: Alpine плюс заранее собранный бинарник `rwd` (со встроенными веб-консолью и SDK). Работает под uid 10001 с `RWD_ADDR=:8080` и `RWD_DATA=/data/rwd.db`, проверка работоспособности — по `/v1/healthz`. Этот же образ публикуется в GHCR и может запускаться самостоятельно |
| `compose.yml` | Два сервиса. `gateway`: собирается из Dockerfile, `./data` смонтирован в `/data`, настройки из `.env`, `RWD_TRUST_PROXY=1` (до него добирается только Caddy), наружу не публикуется. `web`: `caddy:2-alpine`, опубликован на `${BIND:-127.0.0.1}:${PORT:-18788}`, раздаёт `./demo` по пути `/demo/` и проксирует всё остальное на шлюз |
| `Caddyfile` | Обычный HTTP на `:80`. Доверяет `X-Forwarded-*` только от `RWD_TRUSTED_PROXIES` (по умолчанию — частные диапазоны адресов) |
| `compose.tls.yml` | Оверлей для прямого HTTPS: добавляет порты `443/tcp` и `443/udp` (HTTP/3), подставляет `Caddyfile.tls`, хранит сертификаты в томе `caddy-data` |
| `Caddyfile.tls` | Обслуживает `RWD_DOMAIN` по HTTPS с автоматическим сертификатом и перенаправляет HTTP на HTTPS |
| `deploy.sh` | Сборка, копирование, первоначальный `.env`, резервная копия базы данных, перезапуск |

На сервере `deploy.sh` создаёт:

```
~/rwd-platform/
├── .env                      настройки (права 600; создаётся при первом развёртывании, дальше не трогается)
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       бинарник шлюза под архитектуру сервера
├── data/                     rwd.db (SQLite) и резервные копии rwd.db.bak-<время>
└── demo/platform-demo/       демо-магазин по адресу https://rwd.example.com/demo/platform-demo/
```

## Требования

- **Машина для сборки:** Go, Node.js с npm, `make`, `ssh`, `scp`, `tar`.
- **Сервер:** Docker с плагином Compose (`docker compose`) и `openssl`. Пользователь ssh должен иметь право запускать Docker (например, состоять в группе `docker`); sudo не нужен. Сервер скачивает `alpine:3.22` и `caddy:2-alpine`.

## Настройки (`.env`)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | генерируется при первом развёртывании | Пароль владельца; **обязательна**. Применяется при каждом запуске, поэтому её изменение сбрасывает пароль владельца с email из `RWD_ADMIN_EMAIL` |
| `RWD_ADMIN_EMAIL` | `admin` | Учётная запись владельца (логин). Создаётся только при первом запуске; если потом изменить значение, нового владельца не появится, см. [gateway/README](../../gateway/README.ru.md) |
| `RWD_PUBLIC_URL` | определяется по запросам | Публичный URL шлюза, например `https://rwd.example.com/v1`. Рекомендуется задать |
| `RWD_METRICS_TOKEN` | генерируется `deploy.sh` | Bearer-токен для `/v1/metrics` |
| `RWD_DATABASE_URL` | SQLite в `./data` | `postgres://…`, чтобы использовать Postgres |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Сколько дней хранить журнал аудита |
| `RWD_LANG` | `en` | Язык текстов для агента: `en`, `zh`, `zh-TW`, `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` или `pt` |
| `RWD_MCP_RATE_LIMIT` | — | MCP-запросов в минуту с одного IP клиента (если не задано — без ограничения); для публичного демо см. [deploy/demo](../demo/README.md) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Диапазоны адресов (CIDR через пробел или `private_ranges` из Caddy) прокси, стоящего перед Caddy; см. ниже |
| `BIND` | `127.0.0.1` | Адрес, на котором публикуется Caddy |
| `PORT` | `18788` | Порт, на котором публикуется Caddy |
| `RWD_DOMAIN` | — | Публичное имя хоста для прямого HTTPS (только вместе с `compose.tls.yml`) |
| `COMPOSE_FILE` | — | `compose.yml:compose.tls.yml` включает прямой HTTPS |

Отредактировав `.env` на сервере, примените изменения командой `docker compose up -d` в каталоге развёртывания.

## Развёртывание с `deploy.sh`

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` — всё, что принимает `ssh` (алиас из `~/.ssh/config`, `user@host`); `<amd64|arm64>` — архитектура процессора сервера; `remote-dir` по умолчанию — `rwd-platform` в домашнем каталоге пользователя ssh. Скрипт:

1. локально запускает `make platform GOOS=linux GOARCH=<arch>` (SDK, веб-консоль, бинарник шлюза);
2. копирует на сервер Dockerfile, compose-файлы и Caddyfile, демо-страницы и бинарник;
3. **только при первом развёртывании** записывает `.env` (права 600) со случайным паролем владельца, `BIND`, `PORT` и необязательными настройками, перечисленными ниже, и один раз выводит данные для входа владельца. Последующие развёртывания никогда не перезаписывают `.env`, а лишь дописывают недостающие настройки, появившиеся в новых версиях (например, `RWD_METRICS_TOKEN`);
4. если `data/rwd.db` существует, останавливает шлюз и копирует базу данных в `data/rwd.db.bak-<YYYYmmddHHMMSS>` (миграции схемы выполнятся при следующем запуске), затем передаёт владение `data/` uid 10001 с помощью одноразового контейнера вместо sudo;
5. запускает `docker compose up -d --build` и показывает состояние сервисов.

Настройки первого развёртывания можно передать через переменные окружения; они читаются, только пока `.env` ещё не существует: `BIND`, `PORT`, `RWD_ADMIN_EMAIL`, `RWD_PUBLIC_URL`, `RWD_TRUSTED_PROXIES` и `RWD_DOMAIN`.

### За существующим TLS-прокси

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy публикуется на `127.0.0.1:18788`. Направьте на него свой прокси и убедитесь, что прокси:

- пропускает апгрейд до WebSocket (страницы подключаются к `/v1/page`);
- не буферизует ответы и допускает долгоживущие соединения: обновления веб-консоли в реальном времени (`/v1/api/stream`) и MCP используют потоковый HTTP; шлюз отправляет heartbeat каждые 25 секунд, так что тайм-аута простоя больше 60 секунд достаточно;
- передаёт `X-Forwarded-For`, `X-Forwarded-Proto: https` и исходный `Host`.

Например, с nginx:

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

**`RWD_TRUSTED_PROXIES`.** Caddy передаёт заголовки `X-Forwarded-*` от прокси дальше шлюзу, только если прокси подключается с доверенного адреса. Значение по умолчанию, `private_ranges`, покрывает прокси на том же хосте или в частной сети. Если ваш прокси подключается с публичного адреса (другой сервер, CDN или облачный балансировщик нагрузки), укажите здесь его диапазоны. Иначе шлюз примет прокси за клиента: все запросы будут выглядеть так, будто приходят с IP прокси (из-за этого перестают работать списки разрешённых IP у API-ключей и ограничения частоты запросов по IP) и по обычному HTTP (поэтому cookie веб-консоли не получит флаг `Secure`).

Чтобы опубликовать Caddy на другом адресе или порту, задайте `BIND` и `PORT`.

### Прямой HTTPS с `RWD_DOMAIN`

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

Перед первым развёртыванием направьте DNS домена на сервер и откройте порты 80 и 443 (TCP, а также UDP 443 для HTTP/3). Если задан `RWD_DOMAIN`, первое развёртывание записывает в `.env` `RWD_DOMAIN`, `COMPOSE_FILE=compose.yml:compose.tls.yml`, `BIND=0.0.0.0`, `PORT=80` и `RWD_PUBLIC_URL=https://rwd.example.com/v1`. Caddy сам получает и продлевает сертификат (Let's Encrypt через автоматический HTTPS в Caddy), хранит его в томе `caddy-data` и перенаправляет HTTP на HTTPS. Порт 80 остаётся открытым для ACME-проверки и перенаправления.

Чтобы перевести существующее развёртывание на прямой HTTPS, добавьте эти пять строк в `.env` и выполните `docker compose up -d`.

## Развёртывание вручную

Без `deploy.sh`:

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# скопируйте deploy/platform/* на сервер, а бинарник — как ./rwd
# на сервере, в этом каталоге:
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### С образом из релиза

Каждый релиз шлюза также публикует образ `ghcr.io/zanel1u/remote-webview-debugger` для linux/amd64 и linux/arm64 с тегами `<version>` (например, `0.2.0`), `<major>.<minor>` и `latest`, со встроенными веб-консолью и SDK. Чтобы использовать его вместо локальной сборки, замените строки `build:` и `image:` шлюза в `compose.yml` на `image: ghcr.io/zanel1u/remote-webview-debugger:<version>`, пропустите бинарник и запустите `docker compose up -d`. Для обновления смените тег, затем выполните `docker compose pull && docker compose up -d` (предварительно сделайте резервную копию `data/`, как это делает `deploy.sh`).

Чтобы быстро попробовать без Compose, образ можно запустить и самостоятельно: см. [быстрый старт](../../README.ru.md#1-запустите-шлюз). При самостоятельном запуске он не доверяет `X-Forwarded-*`; если вы ставите перед ним свой прокси, добавьте `-e RWD_TRUST_PROXY=1`.

## Обновление

Запустите `deploy.sh` ещё раз с тем же хостом, архитектурой и каталогом. Скрипт пересоберёт всё, скопирует новый бинарник, сделает резервную копию базы SQLite и перезапустит стек; `.env` сохраняется. Ожидайте короткий перерыв в работе. Страницы переподключаются сами: после короткого простоя — за секунды; после более долгого страница может сначала перейти на опрос и вернуться на WebSocket в течение нескольких минут или сразу, как только к ней подключится агент. Агентам, подключённым в этот момент, придётся подключиться заново.

## Резервные копии

- **Автоматические копии.** Каждое развёртывание перед перезапуском копирует `data/rwd.db` в `data/rwd.db.bak-<time>`. Они накапливаются, так что время от времени удаляйте старые.
- **Регулярные резервные копии.** SQLite работает в режиме WAL, поэтому, пока шлюз запущен, последние записи могут находиться в `rwd.db-wal`. Чтобы получить согласованную копию, ненадолго остановите шлюз:

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **Восстановление.** Остановите шлюз, замените `data/rwd.db` резервной копией (и удалите `rwd.db-wal` / `rwd.db-shm`), убедитесь, что файл принадлежит uid 10001, и запустите шлюз.
- Делайте резервную копию и `.env`. Резервные копии базы данных содержат pepper для API-ключей и секрет сеансов веб-консоли: храните их в закрытом месте.

## Postgres

Задайте `RWD_DATABASE_URL` в `.env`, например `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`, и выполните `docker compose up -d`. Контейнер шлюза должен иметь доступ к базе данных (управляемая база данных или сервис `postgres`, добавленный в файл переопределения compose). Схема создаётся при запуске; данные из существующего файла SQLite не переносятся. `deploy.sh` делает резервные копии только SQLite, поэтому для Postgres используйте `pg_dump` или снимки вашего провайдера.

## Повседневная работа

```bash
docker compose ps                                     # состояние
docker compose logs -f gateway                        # журнал шлюза (сгенерированный пароль владельца, ошибки…)
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **Забыли пароль владельца:** измените `RWD_ADMIN_PASSWORD` в `.env` и выполните `docker compose up -d`; новый пароль применится при запуске.
- На одну базу данных запускайте **один** экземпляр шлюза: живое состояние (подключённые страницы, состояние управления) хранится в процессе шлюза.
- Демо-страницы в `/demo/` необязательны; если не хотите, чтобы они были публичными, удалите содержимое `demo/` (при следующем развёртывании они скопируются снова).
