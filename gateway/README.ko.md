<!-- i18n-source: 048ece68ecafa5fd74a1bc0378b1a0eb32f2cf96 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# rwd 게이트웨이

Remote WebView Debugger의 Go 서버예요. 페이지 연결, 기기 온라인 상태, 제어 상태, 호스팅되는 MCP 엔드포인트, 콘솔의 REST API를 맡고, 콘솔과 페이지 SDK도 내장하고 있어요. 바이너리 하나가 서버 전체예요.

- 프로토콜: [docs/protocol.ko.md](../docs/protocol.ko.md)
- 아키텍처, 동의 모델, 보안 관련 사항: [docs/architecture.ko.md](../docs/architecture.ko.md)
- Docker Compose 배포: [deploy/platform/README.ko.md](../deploy/platform/README.ko.md)

## 빌드와 실행

콘솔과 SDK를 빌드해서 바이너리에 내장하므로, 빌드하려면 Go(`go.mod`에 적힌 버전)와 npm이 포함된 Node.js가 필요해요. 저장소 루트에서:

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # 크로스 컴파일 (amd64 또는 arm64)

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

http://localhost:8080 을 열고 위의 이메일과 비밀번호로 로그인하세요. 페이지와 에이전트는 게이트웨이 URL `http://localhost:8080/v1`을 써요 (프로덕션에서는 `https://rwd.example.com/v1`).

`gateway/` 안에서 `go build ./cmd/rwd`로 빌드해도 되지만, 이 바이너리에는 콘솔과 SDK 대신 플레이스홀더만 들어가요. `make`는 `rwd version`과 `/v1/healthz`가 알려 주는 버전을 최신 `gateway-vX.Y.Z` 태그로 정해요 (태그 위치에서는 `0.2.0`, 그 이후에는 `0.2.0-3-gabc1234`, 태그가 없으면 `0.0.0-dev`). `RWD_VERSION=…`으로 덮어쓸 수 있어요. Linux와 macOS(amd64, arm64)용 릴리스 바이너리는 각 `gateway-v*` [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases)에 첨부돼 있어요. 변경 사항: [CHANGELOG](CHANGELOG.md).

## 명령어

```
rwd serve [flags]                       게이트웨이 실행
rwd mcp --gateway https://host/v1       로컬 에이전트용 stdio MCP 브리지 (API 키는 RWD_API_KEY에서 읽음)
rwd version                             버전 출력
```

## 설정 (`rwd serve`)

모든 플래그에는 대응하는 환경 변수가 있고, 명령줄에서 준 플래그가 우선해요.

| 플래그 / 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | 수신 주소 (일반 HTTP. 앞단에서 TLS를 처리하세요. [deploy/platform](../deploy/platform/README.ko.md) 참고) |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | 데이터베이스. `postgres://` 또는 `postgresql://` URL이면 Postgres를, 그 밖의 값은 SQLite 파일 경로로 써요. `RWD_DATABASE_URL`이 `RWD_DATA`보다 우선해요. 스키마는 시작할 때 생성되고 마이그레이션돼요 |
| `--public-url` / `RWD_PUBLIC_URL` | 요청마다 추론 | `/v1`로 끝나는 공개 게이트웨이 URL. 예: `https://rwd.example.com/v1`. 연동 코드 조각, 초대 링크, `/v1/api/config`에 쓰여요. 게이트웨이가 자신의 공개 주소를 추론할 수 없을 때 설정하세요 |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | 꺼짐 | 클라이언트 IP를 `X-Forwarded-For`에서, 추론한 공개 URL의 스킴과 호스트(그리고 콘솔 쿠키에 `Secure`를 붙일지)를 `X-Forwarded-Proto` / `X-Forwarded-Host`에서 가져와요. 리버스 프록시 뒤에서만 켜세요. 그렇지 않으면 클라이언트가 이 헤더를 위조해서 IP 허용 목록과 요청 속도 제한을 우회할 수 있어요. 끄면 프록시가 뭐라고 하든 모든 요청을 일반 HTTP로 취급하므로, 콘솔 쿠키에 `Secure`가 붙지 않고 추론한 URL은 `http://`로 시작해요 (이 경우 `--public-url`을 설정하세요) |
| `--lang` / `RWD_LANG` | `en` | AI가 읽는 모든 것의 언어: MCP instructions, 도구와 매개변수 설명, 도구 결과, `[Session changes]`, 오류. 페이지 SDK에도 `welcome.agentLang`으로 전달돼서, 페이지에서 만드는 오류와 이벤트 요약도 같은 언어가 돼요. `en`, `zh`(중국어 간체), `zh-TW`(중국어 번체), `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de`, `pt` 중 하나예요. 지역 태그도 받으며 가장 가까운 언어로 매핑돼요 (`zh-CN` → `zh`, `zh-HK` → `zh-TW`, `pt-BR` → `pt`). 콘솔은 요청마다 언어를 고르고(`?lang=` 또는 `Accept-Language`), 정하지 못하면 이 값을 써요 |
| `--demo-dir` / `RWD_DEMO_DIR` | — | 이 디렉터리를 `/demo/`에서 제공해요 (선택, 데모 페이지용) |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0` (제한 없음) | 클라이언트 IP당 분당 허용하는 MCP 요청 수. 넘으면 `429`와 `Retry-After: 60`을 받아요. 데모처럼 API 키가 공개된 게이트웨이용이에요 ([deploy/demo](../deploy/demo/README.md)). 프록시 뒤에서는 클라이언트 IP를 보려면 `--trust-proxy`가 필요해요 |
| `RWD_ADMIN_EMAIL` | `admin` | 소유자 계정의 이메일(로그인 이름). 소유자는 데이터베이스에 소유자가 없을 때만(첫 시작 때) 생성돼요. 나중에 이 값을 바꿔도 두 번째 소유자가 생기지 **않고**, `RWD_ADMIN_PASSWORD`를 어느 소유자에게 적용할지만 정해요 |
| `RWD_ADMIN_PASSWORD` | — | 소유자 비밀번호. 소유자를 만들 때 쓰이고, 이후 **매번** 시작할 때 `RWD_ADMIN_EMAIL`로 지정한 소유자의 비밀번호를 재설정해요. 계정 복구 수단도 겸해요. 그 이메일이 소유자의 것이 아니면(다른 멤버이거나 아무도 아니면) 무시되고, 로그에 그 사실과 소유자 목록이 남아요. 빈 데이터베이스에서 설정하지 않으면 무작위 비밀번호를 만들어 로그에 한 번 출력해요 |
| `RWD_METRICS_TOKEN` | — | 설정하면 `/v1/metrics`에 `Authorization: Bearer <token>`이 필요해요 |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 감사 로그 보관 일수 |

그 밖에 알아 둘 것:

- 게이트웨이에 필요한 비밀 값(API 키 pepper와 콘솔 세션 비밀 값)은 첫 시작 때 생성돼 데이터베이스에 저장돼요. 데이터베이스를 백업하고, 백업은 외부에 노출되지 않게 보관하세요.
- 게이트웨이는 실시간 상태(연결된 페이지, 제어 상태, 타임라인)를 메모리에 두므로, 데이터베이스 하나당 인스턴스는 하나만 실행하세요.
- 헬스 체크: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## 에이전트 연결

콘솔(**API 키**)에서 API 키를 만들고, 호스팅되는 MCP 엔드포인트를 클라이언트에 추가하세요. 예를 들어 Claude Code에서는:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

stdio만 지원하는 클라이언트라면, 같은 바이너리가 stdio를 호스팅되는 엔드포인트로 중계해요:

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| `rwd mcp` 설정 | 설명 |
|---|---|
| `--gateway` / `RWD_GATEWAY` | `/v1`로 끝나는 게이트웨이 URL |
| `RWD_API_KEY` | API 키 (프로세스 목록에 보이지 않도록 환경 변수로만 받아요) |

키 하나로 게이트웨이의 모든 기기에 접근할 수 있어요. 도구 목록은 [protocol.ko.md §14](../docs/protocol.ko.md#14-mcp)에 있어요.

## 소스 구조

```
cmd/rwd/            진입점: serve, mcp (stdio 브리지), version
internal/store/     SQLite / Postgres: 프로젝트와 정책, 멤버, API 키 (HMAC. 권한 수준, 만료,
                    IP 허용 목록), 기기와 기기 토큰, 기기 초대, 감사 로그, 설정
internal/hub/       실시간 상태: 기기, 페이지, 제어 상태 머신, 접속 승인, 권한 수준 검사,
                    타임라인, RPC 라우팅, SSE 구독, 메트릭
internal/server/    HTTP: 페이지 WebSocket, presence 폴링, 로그인과 역할이 있는 REST, MCP 도구,
                    SSE, /v1/metrics, 정적 파일
internal/i18n/      에이전트와 콘솔용 문구(11개 언어)
internal/ids/       앱 키, API 키, 기기 코드, 비밀 값
internal/web/       내장된 콘솔과 SDK (`make gateway`가 배치, 그 밖에는 플레이스홀더)
scripts/embed.sh    console/dist와 sdk.js를 go:embed용으로 internal/web에 배치
```

## 테스트

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go`는 시뮬레이션한 페이지와 MCP 클라이언트로 전체 흐름을 검증해요: 기기 코드로 연결하기, 기기에서의 승인(허용, 거부, 반복 거부와 잠금, 보기 전용), 유예 시간 안에 두 번째 승인 없이 다시 접속하기, 권한 수준 검사, 스냅샷, 첫 상호작용 때 잠그기, 페이지를 넘나들며 따라가기와 다시 만들어진 WebView가 대체한 페이지 정리하기, 직접 조작과 AI에 맡기기, 묶음 동작, 사용자에 의한 종료, 감사 기록, 기기 토큰(4401), 재개 토큰(4409), 할당량(4429), 일회용 초대, 키 만료와 IP 허용 목록, 즉시 폐기, 멤버 초대와 역할, SSE와 메트릭, 인증 실패.

같은 테스트를 Postgres에서도 실행할 수 있어요 (테스트마다 임시 스키마를 따로 써요):

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

저장소 루트에서 `make -j16 check`를 실행하면 CI가 실행하는 게이트웨이, SDK, 콘솔 검사를 모두 돌려요.
