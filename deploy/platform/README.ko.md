<!-- i18n-source: 633220a8fe1b3ddd3a313fd33ae0414507b2953f -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Docker Compose 배포

Docker 호스트에서 게이트웨이를 실행하고, 그 앞에 작은 [Caddy](https://caddyserver.com)를 둬요. 외부에 공개하는 방법은 두 가지예요:

- **기존 TLS 프록시 뒤에 두기** (기본값): Caddy는 `127.0.0.1:18788`에서 수신하고, 그 앞의 nginx, Caddy, Traefik 또는 로드 밸런서가 HTTPS를 종료해요.
- `RWD_DOMAIN`으로 **직접 HTTPS 제공하기**: Caddy가 직접 80번과 443번 포트를 열고 Let's Encrypt에서 인증서를 받아요.

`deploy.sh`는 모든 것을 로컬에서 빌드하고, ssh로 서버에 보낸 다음 스택을 (다시) 시작해요. 게이트웨이 설정은 [gateway/README.ko.md](../../gateway/README.ko.md)에 설명돼 있어요.

## 파일

| 파일 | 용도 |
|---|---|
| `Dockerfile` | 게이트웨이 이미지: Alpine에 미리 빌드한 `rwd` 바이너리(콘솔과 SDK 내장)를 더한 것. uid 10001로, `RWD_ADDR=:8080`과 `RWD_DATA=/data/rwd.db`로 실행되고, `/v1/healthz`로 헬스 체크를 해요. 같은 이미지가 GHCR에도 게시되며 단독으로도 실행돼요 |
| `compose.yml` | 서비스 두 개. `gateway`: Dockerfile로 빌드, `./data`를 `/data`에 마운트, 설정은 `.env`에서, `RWD_TRUST_PROXY=1`(Caddy만 접근하므로), 외부에 포트를 공개하지 않음. `web`: `caddy:2-alpine`, `${BIND:-127.0.0.1}:${PORT:-18788}`에 공개, `./demo`를 `/demo/`에서 제공하고 나머지는 모두 게이트웨이로 프록시 |
| `Caddyfile` | `:80`에서 일반 HTTP. `X-Forwarded-*`는 `RWD_TRUSTED_PROXIES`(기본값: 사설 대역)에서 온 것만 신뢰해요 |
| `compose.tls.yml` | 직접 HTTPS용 오버레이: `443/tcp`와 `443/udp`(HTTP/3) 포트를 추가하고, `Caddyfile.tls`로 바꾸고, 인증서는 `caddy-data` 볼륨에 보관해요 |
| `Caddyfile.tls` | 자동 인증서로 `RWD_DOMAIN`을 HTTPS로 제공하고, HTTP를 HTTPS로 리디렉션해요 |
| `deploy.sh` | 빌드, 복사, 최초 `.env` 생성, 데이터베이스 백업, 재시작 |

서버에서 `deploy.sh`가 만드는 구조:

```
~/rwd-platform/
├── .env                      설정 (권한 600. 첫 배포 때 생성되고 이후로는 건드리지 않음)
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       서버 아키텍처용 게이트웨이 바이너리
├── data/                     rwd.db (SQLite)와 rwd.db.bak-<time> 백업
└── demo/platform-demo/       데모 쇼핑몰, https://rwd.example.com/demo/platform-demo/
```

## 요구 사항

- **빌드 머신:** Go, npm이 포함된 Node.js, `make`, `ssh`, `scp`, `tar`.
- **서버:** Compose 플러그인(`docker compose`)이 포함된 Docker, `openssl`. ssh 사용자가 Docker를 실행할 수 있어야 해요 (예: `docker` 그룹에 속해 있음). sudo는 필요 없어요. 서버는 `alpine:3.22`와 `caddy:2-alpine`을 내려받아요.

## 설정 (`.env`)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | 첫 배포 때 생성 | 소유자 비밀번호. **필수**예요. 시작할 때마다 적용되므로, 바꾸면 `RWD_ADMIN_EMAIL`로 지정한 소유자의 비밀번호가 재설정돼요 |
| `RWD_ADMIN_EMAIL` | `admin` | 소유자 계정(로그인 이름). 첫 시작 때만 생성되며, 나중에 바꿔도 소유자가 추가되지 않아요. [gateway/README](../../gateway/README.ko.md) 참고 |
| `RWD_PUBLIC_URL` | 요청에서 추론 | 공개 게이트웨이 URL. 예: `https://rwd.example.com/v1`. 설정을 권장해요 |
| `RWD_METRICS_TOKEN` | `deploy.sh`가 생성 | `/v1/metrics`용 Bearer 토큰 |
| `RWD_DATABASE_URL` | `./data`의 SQLite | 대신 Postgres를 쓰려면 `postgres://…` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 감사 로그 보관 일수 |
| `RWD_LANG` | `en` | 에이전트용 문구의 언어: `en`, `zh`, `zh-TW`, `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` 또는 `pt` |
| `RWD_MCP_RATE_LIMIT` | — | 클라이언트 IP당 분당 MCP 요청 수 (설정하지 않으면 제한 없음). 공개 데모용이에요. [deploy/demo](../demo/README.md) 참고 |
| `RWD_OIDC_PROVIDER`, `RWD_OIDC_*` | — | Feishu, Lark 또는 OpenID Connect를 통한 SSO 로그인. [gateway/README](../../gateway/README.ko.md#sso-로그인) 참고 |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Caddy 앞에 있는 프록시의 주소 대역 (공백으로 구분한 CIDR, 또는 Caddy의 `private_ranges`). 아래 참고 |
| `BIND` | `127.0.0.1` | Caddy를 공개할 주소 |
| `PORT` | `18788` | Caddy를 공개할 포트 |
| `RWD_DOMAIN` | — | 직접 HTTPS에 쓸 공개 호스트 이름 (`compose.tls.yml`과 함께일 때만) |
| `COMPOSE_FILE` | — | `compose.yml:compose.tls.yml`이면 직접 HTTPS가 켜져요 |

서버에서 `.env`를 고친 뒤에는 배포 디렉터리에서 `docker compose up -d`를 실행해 적용하세요.

## `deploy.sh`로 배포하기

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>`는 `ssh`가 받는 것이면 무엇이든 돼요 (`~/.ssh/config`의 별칭, `user@host`). `<amd64|arm64>`는 서버의 CPU 아키텍처이고, `remote-dir`의 기본값은 ssh 사용자 홈 디렉터리의 `rwd-platform`이에요. 스크립트는:

1. 로컬에서 `make platform GOOS=linux GOARCH=<arch>`를 실행해요 (SDK, 콘솔, 게이트웨이 바이너리).
2. Dockerfile, compose 파일, Caddyfile, 데모 페이지, 바이너리를 서버로 복사해요.
3. **첫 배포 때만** 무작위 소유자 비밀번호, `BIND`, `PORT`, 아래의 선택 설정으로 `.env`(권한 600)를 쓰고, 소유자 로그인 정보를 한 번 출력해요. 이후 배포에서는 `.env`를 덮어쓰지 않고, 새 버전에서 추가된 설정(`RWD_METRICS_TOKEN` 등)이 없을 때만 덧붙여요.
4. `data/rwd.db`가 있으면 게이트웨이를 멈추고 데이터베이스를 `data/rwd.db.bak-<YYYYmmddHHMMSS>`로 복사한 다음(스키마 마이그레이션은 다음 시작 때 실행돼요), sudo 대신 일회용 컨테이너로 `data/`의 소유자를 uid 10001로 맞춰요.
5. `docker compose up -d --build`를 실행하고 서비스 상태를 보여 줘요.

첫 배포 설정은 환경 변수로 줄 수 있어요. 아직 `.env`가 없을 때만 읽어요: `BIND`, `PORT`, `RWD_ADMIN_EMAIL`, `RWD_PUBLIC_URL`, `RWD_TRUSTED_PROXIES`, `RWD_DOMAIN`.

### 기존 TLS 프록시 뒤에 두기

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy는 `127.0.0.1:18788`에 공개돼요. 프록시가 여기를 가리키게 하고, 프록시가 다음을 지키는지 확인하세요:

- WebSocket 업그레이드를 전달해요 (페이지는 `/v1/page`에 연결해요).
- 응답을 버퍼링하지 않고 오래 유지되는 연결을 허용해요. 콘솔의 실시간 업데이트(`/v1/api/stream`)와 MCP는 스트리밍 HTTP를 써요. 게이트웨이가 25초마다 하트비트를 보내므로 유휴 타임아웃은 60초 이상이면 충분해요.
- `X-Forwarded-For`, `X-Forwarded-Proto: https`, 원래의 `Host`를 보내요.

예를 들어 nginx라면:

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

**`RWD_TRUSTED_PROXIES`.** Caddy는 프록시가 신뢰하는 주소에서 연결할 때만 프록시의 `X-Forwarded-*` 헤더를 게이트웨이로 넘겨요. 기본값 `private_ranges`는 같은 호스트나 사설 네트워크에 있는 프록시를 포함해요. 프록시가 공인 주소에서 연결한다면(다른 서버, CDN, 클라우드 로드 밸런서) 이 값을 그 대역으로 설정하세요. 그렇지 않으면 게이트웨이는 프록시를 클라이언트로 봐요. 모든 요청이 프록시의 IP에서 온 것처럼 보이고(API 키의 IP 허용 목록과 IP별 요청 속도 제한이 제대로 동작하지 않아요), 일반 HTTP로 들어온 것처럼 보여요(콘솔 쿠키에 `Secure`가 붙지 않아요).

Caddy를 다른 주소나 포트에 공개하려면 `BIND`와 `PORT`를 설정하세요.

### `RWD_DOMAIN`으로 직접 HTTPS 제공하기

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

첫 배포 전에 도메인의 DNS가 서버를 가리키게 하고 80번과 443번 포트(TCP, 그리고 HTTP/3용 UDP 443)를 여세요. `RWD_DOMAIN`이 설정돼 있으면 첫 배포 때 `.env`에 `RWD_DOMAIN`, `COMPOSE_FILE=compose.yml:compose.tls.yml`, `BIND=0.0.0.0`, `PORT=80`, `RWD_PUBLIC_URL=https://rwd.example.com/v1`을 써요. Caddy가 인증서를 알아서 발급하고 갱신하며(Caddy의 자동 HTTPS를 통한 Let's Encrypt), `caddy-data` 볼륨에 보관하고 HTTP를 HTTPS로 리디렉션해요. 80번 포트는 ACME 챌린지와 리디렉션을 위해 계속 열어 둬요.

기존 배포를 직접 HTTPS로 바꾸려면 이 다섯 줄을 `.env`에 추가하고 `docker compose up -d`를 실행하세요.

## 직접 배포하기

`deploy.sh` 없이:

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# deploy/platform/*과 바이너리(./rwd라는 이름으로)를 서버에 복사
# 서버의 그 디렉터리에서:
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### 릴리스 이미지 사용하기

게이트웨이를 릴리스할 때마다 linux/amd64와 linux/arm64용 이미지 `ghcr.io/zanel1u/remote-webview-debugger`도 게시돼요. 태그는 `<version>`(예: `0.2.0`), `<major>.<minor>`, `latest`이고, 콘솔과 SDK가 내장돼 있어요. 직접 빌드하는 대신 이 이미지를 쓰려면 `compose.yml`에서 게이트웨이의 `build:`와 `image:` 줄을 `image: ghcr.io/zanel1u/remote-webview-debugger:<version>`으로 바꾸고, 바이너리는 건너뛰고, `docker compose up -d`로 시작하세요. 업그레이드는 태그를 바꾼 다음 `docker compose pull && docker compose up -d`를 실행하면 돼요 (`deploy.sh`처럼 먼저 `data/`를 백업하세요).

Compose 없이 빠르게 써 보려면 이미지를 단독으로 실행해도 돼요. [빠른 시작](../../README.ko.md#1-게이트웨이-실행하기)을 참고하세요. 단독으로 실행하면 `X-Forwarded-*`를 신뢰하지 않으므로, 직접 프록시를 앞에 둔다면 `-e RWD_TRUST_PROXY=1`을 추가하세요.

## 업그레이드

같은 호스트, 아키텍처, 디렉터리로 `deploy.sh`를 다시 실행하세요. 다시 빌드하고, 새 바이너리를 복사하고, SQLite 데이터베이스를 백업하고, 스택을 재시작해요. `.env`는 그대로 유지돼요. 잠깐 서비스가 끊길 수 있어요. 페이지는 스스로 다시 연결해요. 짧은 중단이면 몇 초 안에, 긴 중단이면 페이지가 먼저 폴링으로 전환했다가 몇 분 안에, 또는 에이전트가 접속하는 즉시 WebSocket으로 돌아와요. 그 순간 접속해 있던 에이전트는 다시 접속해야 해요.

## 백업

- **자동 사본.** 배포할 때마다 재시작 전에 `data/rwd.db`를 `data/rwd.db.bak-<time>`으로 복사해요. 계속 쌓이므로 가끔 오래된 것을 지우세요.
- **정기 백업.** SQLite는 WAL 모드로 동작하므로, 게이트웨이가 실행 중이면 최근에 쓴 내용이 `rwd.db-wal`에 남아 있을 수 있어요. 게이트웨이를 잠깐 멈추고 일관된 사본을 백업하세요:

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **복원.** 게이트웨이를 멈추고, `data/rwd.db`를 백업으로 바꾸고(`rwd.db-wal` / `rwd.db-shm`은 지우세요), 소유자가 uid 10001인지 확인한 다음 게이트웨이를 시작하세요.
- `.env`도 백업하세요. 데이터베이스 백업에는 API 키 pepper와 콘솔 세션 비밀 값이 들어 있으니 외부에 노출되지 않게 보관하세요.

## Postgres

`.env`에 `RWD_DATABASE_URL`을 설정하고(예: `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`) `docker compose up -d`를 실행하세요. 게이트웨이 컨테이너가 데이터베이스에 접근할 수 있어야 해요 (관리형 데이터베이스, 또는 compose override 파일에 추가한 `postgres` 서비스). 스키마는 시작할 때 생성되며, 기존 SQLite 파일의 데이터는 옮겨지지 않아요. `deploy.sh`는 SQLite만 백업하므로, Postgres는 `pg_dump`나 클라우드 제공업체의 스냅샷으로 백업하세요.

## 일상 운영

```bash
docker compose ps                                     # 상태
docker compose logs -f gateway                        # 게이트웨이 로그 (생성된 소유자 비밀번호, 오류 등)
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **소유자 비밀번호를 잊었을 때:** `.env`의 `RWD_ADMIN_PASSWORD`를 바꾸고 `docker compose up -d`를 실행하세요. 시작할 때 적용돼요.
- 데이터베이스 하나당 게이트웨이 인스턴스는 **하나만** 실행하세요. 실시간 상태(연결된 페이지, 제어 상태)는 게이트웨이 프로세스 안에 있어요.
- `/demo/` 아래의 데모 페이지는 선택 사항이에요. 공개하고 싶지 않다면 `demo/`의 내용을 지우세요 (다음 배포 때 다시 복사돼요).
