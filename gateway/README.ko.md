<!-- i18n-source: 0dcd3b6faee7da70bf01670a986f2e0c4d1d102e -->
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
| `--demo-keys` / `RWD_DEMO_KEYS=1` | 꺼짐 | 공개 데모를 운영해요. `POST /v1/demo/keys`(로그인 없이, CORS 허용)가 방문자마다 전용 API 키(권한 수준 `interact`, 24시간 유효, IP당 시간마다 5개)를 발급하므로 방문자끼리 에이전트를 공유하지 않아요. 또 `list_devices`에는 `deviceCode`가 필요해서 다른 방문자의 기기를 목록으로 볼 수 없어요. [deploy/demo](../deploy/demo/README.md) 참고 |
| `RWD_ADMIN_EMAIL` | `admin` | 소유자 계정의 이메일(로그인 이름). 소유자는 데이터베이스에 소유자가 없을 때만(첫 시작 때) 생성돼요. 나중에 이 값을 바꿔도 두 번째 소유자가 생기지 **않고**, `RWD_ADMIN_PASSWORD`를 어느 소유자에게 적용할지만 정해요 |
| `RWD_ADMIN_PASSWORD` | — | 소유자 비밀번호. 소유자를 만들 때 쓰이고, 이후 **매번** 시작할 때 `RWD_ADMIN_EMAIL`로 지정한 소유자의 비밀번호를 재설정해요. 계정 복구 수단도 겸해요. 그 이메일이 소유자의 것이 아니면(다른 멤버이거나 아무도 아니면) 무시되고, 로그에 그 사실과 소유자 목록이 남아요. 빈 데이터베이스에서 설정하지 않으면 무작위 비밀번호를 만들어 로그에 한 번 출력해요 |
| `RWD_METRICS_TOKEN` | — | 설정하면 `/v1/metrics`에 `Authorization: Bearer <token>`이 필요해요 |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | 감사 로그 보관 일수 |
| `RWD_OIDC_*` | — | SSO 로그인. [아래](#sso-로그인) 참고 |

그 밖에 알아 둘 것:

- 게이트웨이에 필요한 비밀 값(API 키 pepper와 콘솔 세션 비밀 값)은 첫 시작 때 생성돼 데이터베이스에 저장돼요. 데이터베이스를 백업하고, 백업은 외부에 노출되지 않게 보관하세요.
- 게이트웨이는 실시간 상태(연결된 페이지, 제어 상태, 타임라인)를 메모리에 두므로, 데이터베이스 하나당 인스턴스는 하나만 실행하세요.
- 헬스 체크: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## SSO 로그인

멤버는 Feishu, Lark 또는 임의의 OpenID Connect 공급자(Keycloak, Okta, Microsoft Entra ID, Google, Authing 등)로도 로그인할 수 있어요. 이메일과 비밀번호 로그인도 그대로 쓸 수 있어요. 공급자와 클라이언트 자격 증명을 설정하면 로그인 페이지에 **…(으)로 로그인** 버튼이 나타나요.

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`, `lark` 또는 `oidc`. 설정하면 SSO가 켜져요. `RWD_OIDC_ISSUER`만 설정하면 `oidc`로 간주해요 |
| `RWD_OIDC_CLIENT_ID`, `RWD_OIDC_CLIENT_SECRET` | — | 앱의 자격 증명(Feishu와 Lark에서는 App ID와 App Secret). 필수예요 |
| `RWD_OIDC_ISSUER` | — | OpenID Connect issuer. 예: `https://sso.example.com/realms/acme`. 엔드포인트는 issuer의 `/.well-known/openid-configuration`에서 읽어요 (`oidc` 전용) |
| `RWD_OIDC_AUTH_URL`, `RWD_OIDC_TOKEN_URL`, `RWD_OIDC_USERINFO_URL` | 공급자 기본값 | 엔드포인트를 덮어써요. 디스커버리를 지원하지 않는 OpenID Connect 공급자라면 세 개 모두 설정하세요 |
| `RWD_OIDC_SCOPES` | `openid profile email` (`oidc`), 없음 (Feishu, Lark) | 공백으로 구분한 scope. Feishu와 Lark에서는 계정에 이메일이 들어가도록 `contact:user.email:readonly`(기업 이메일까지 받으려면 `contact:user.employee:readonly`도)를 추가하세요 |
| `RWD_OIDC_NAME` | 공급자 이름 | 로그인 버튼에 표시할 이름. 예: `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | 첫 로그인 때 만들어지는 계정의 역할: `member` 또는 `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | 꺼짐 | 계정을 만들지 않아요. 기존 멤버나 초대받은 멤버(같은 이메일)만 로그인할 수 있어요 |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | 로그인을 허용할 이메일 도메인(쉼표로 구분). 예: `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | 꺼짐 | `oidc` 전용: `email_verified`를 보내지 않는 공급자(Microsoft Entra ID)의 이메일을 신뢰해요. 조직이 이메일을 관리하는 단일 테넌트 공급자에서만 쓰세요 |
| `RWD_OIDC_TENANT` | — | Feishu와 Lark 전용: 조직의 `tenant_key`. 다른 조직 사람은 거부돼요(`sso_error=tenant`). SSO 로그인마다 `auth.login` 감사 기록에 `tenant`가 남아요 |
| `RWD_OIDC_SYNC_MINUTES` | `60` (Feishu, Lark) | 조직을 떠난 멤버를 비활성화하는 주기(분). `0`이면 꺼져요. 아래를 참고하세요 |
| `RWD_OIDC_KEY_CHECK` | 켜짐 (Feishu, Lark) | API 키를 쓸 때마다 소유자가 아직 재직 중인지 확인해요. `0`이면 꺼져요. 아래를 참고하세요 |

공급자에 다음 리디렉션 URL을 등록하세요. 정확히 일치해야 해요: `https://<host>/v1/api/auth/oidc/callback`. 즉 `RWD_PUBLIC_URL`의 origin(설정하지 않았으면 요청의 origin) 뒤에 `/v1/api/auth/oidc/callback`을 붙인 주소예요. 프록시 뒤에서는 URL이 바뀌지 않도록 `RWD_PUBLIC_URL`을 설정하세요.

어떤 ID로 처음 로그인하면 같은 이메일의 멤버와 연결되거나(초대받은 멤버는 초대된 역할을 유지하고, 초대는 사용 처리돼요), `RWD_OIDC_INVITE_ONLY=1`이 아니면 `RWD_OIDC_DEFAULT_ROLE` 역할로 계정이 만들어져요. 이후 로그인에서는 공급자의 subject(Feishu와 Lark에서는 `open_id`)로 계정을 찾으므로, 이메일이 바뀌어도 상관없어요. 공급자의 다른 ID와 이미 연결된 계정은 다시 연결하지 않고(주인이 바뀐 메일함은 `sso_error=conflict`를 받아요), 비활성화된 멤버의 초대는 그대로 둬요. OpenID Connect 공급자의 이메일은 `email_verified: true`일 때만(또는 `RWD_OIDC_TRUST_EMAIL=1`일 때) 인정하고, 이메일이 없는 계정은 로그인 이름이 `<provider>:<subject>`가 돼요. 소유자는 이 멤버들도 다른 멤버처럼 **멤버** 페이지에서 관리해요. 역할을 바꾸거나 비활성화하거나 삭제할 수 있고, 비활성화된 멤버는 어느 방식으로도 로그인할 수 없어요. SSO로 만든 계정에는 비밀번호가 없어요. 게이트웨이는 방금 받은 액세스 토큰으로 공급자의 userinfo 엔드포인트에서 사용자 정보를 읽어요(PKCE를 쓰는 authorization code flow). ID 토큰은 쓰지 않아요. 시작과 콜백은 클라이언트 IP당 분당 60회로 제한돼요(프록시 뒤에서는 `--trust-proxy`를 켜세요. 그러지 않으면 모두가 프록시의 IP를 함께 쓰게 돼요).

**누가 로그인할 수 있는지.** 첫 로그인이 어느 기존 멤버(소유자 포함)와 연결될지는 공급자의 이메일이 결정해요. 그래서 공급자에서 이메일을 설정할 수 있는 사람은 그 계정들을 가로챌 수 있어요. Feishu나 Lark에서는 사내 앱을 쓰세요. 조직 구성원만, 조직의 이메일로 로그인할 수 있어요. 스토어 앱이나 연결된 조직과 공유한 앱이면 다른 조직 사람도 로그인할 수 있으니 `RWD_OIDC_TENANT`를 설정하세요. 누구나 로그인할 수 있는 OpenID Connect 공급자(Google, 멀티 테넌트 Entra ID)라면 `RWD_OIDC_ALLOWED_DOMAINS`나 `RWD_OIDC_INVITE_ONLY=1`을 설정하세요. 그러지 않으면 누구나 계정을 얻게 돼요(시작할 때 로그에 경고가 남아요). 그리고 그런 공급자에서는 절대 `RWD_OIDC_TRUST_EMAIL=1`을 설정하지 마세요.

**앱을 바꾸거나 SSO를 끌 때.** Feishu와 Lark의 `open_id`는 앱 하나에 속해요. 다른 App ID로 바꾸면 멤버는 이메일로 다시 연결되고, 이메일이 없는 계정(`feishu:…`)은 삭제한 뒤 다시 초대해야 해요. SSO로 만든 계정에는 비밀번호가 없어요. SSO를 끄기 전 등에 소유자가 **멤버** 페이지의 **새 링크**로 비밀번호를 설정하는 초대 링크를 만들어 줄 수 있어요(잃어버린 초대를 대신할 때도 써요).

**Feishu 또는 Lark.** [Feishu Open Platform](https://open.feishu.cn/app)(Lark는 [open.larksuite.com](https://open.larksuite.com/app))에서 조직 구성원만 쓸 수 있는 사내 앱(custom app, 企业自建应用)을 만든 다음:

1. **Credentials & Basic Info**에서 App ID와 App Secret을 복사해 `RWD_OIDC_CLIENT_ID`와 `RWD_OIDC_CLIENT_SECRET`에 넣으세요.
2. **Security Settings → Redirect URLs**에 위의 리디렉션 URL을 추가하세요.
3. **Permissions & Scopes**에서 `contact:user.email:readonly`(기업 이메일까지 받으려면 `contact:user.employee:readonly`도)를 추가하고, 같은 scope를 `RWD_OIDC_SCOPES`에 나열하세요. 떠난 사람을 알아차리려면 앱에 `contact:contact.base:readonly`와 `contact:user.employee:readonly`도 필요하고, **Data permissions → Contacts range**에 로그인하는 모든 사람을 포함해야 해요.
4. 앱의 사용 가능 범위를 로그인할 사람들로 설정하고, 버전을 만들어 게시하세요. 그래야 설정이 적용돼요.

**떠난 사람.** Feishu나 Lark에서는 게이트웨이가 `RWD_OIDC_SYNC_MINUTES`분마다 앱과 연결된 각 멤버를 Open Platform에 조회하고, 퇴사했거나 조직을 떠난 것으로 표시된 멤버를 비활성화해요. 그 멤버는 로그아웃되고, API 키가 작동하지 않게 되고, 에이전트 접속도 해제돼요. 감사 로그에는 `system`이 수행한 `member.update`가 `"reason":"left_organization"`과 함께 기록돼요. 이후 소유자가 그 멤버를 삭제하면 키가 완전히 폐기돼요. 명시적인 "퇴사" 상태만 인정해요. 연락처 범위 밖의 멤버나 실패한 요청은 아무것도 바꾸지 않고(무엇이 실패했는지는 로그에 남아요), 마지막 소유자는 절대 비활성화하지 않아요. 연락처 권한이 없으면 동기화는 아무것도 확인하지 않고, 아래의 키 확인이 앱에 연결된 멤버의 키를 거부해요. `RWD_OIDC_KEY_CHECK=0`까지 설정했다면 떠난 사람의 API 키는 소유자가 비활성화할 때까지 계속 작동해요. 다만 더 이상 로그인할 수 없으니 콘솔 세션은 12시간 안에 끝나요.

**떠난 사람의 키.** Feishu나 Lark에서는 키 소유자가 앱에 연결되어 있으면, 게이트웨이가 API 키를 쓸 때마다 소유자가 아직 재직 중인지도 확인해요. `RWD_OIDC_KEY_CHECK=0`이면 꺼져요. MCP 요청은 매번 인증하므로 오래 유지되는 세션의 도구 호출도 하나하나 확인해요. 위와 같은 연락처 조회를 써요. 퇴사했거나 조직을 떠났으면 요청은 "API 키 소유자가 조직을 떠났다"는 401을 받고, 소유자의 에이전트 접속이 해제되며, 소유자는 위와 같이 비활성화되고 감사 로그에 기록돼요(마지막 소유자의 키는 거부하지만 마지막 소유자를 비활성화하지는 않아요). 재직 중이면 그 결과를 60초 동안 믿기 때문에 도구 호출이 몰려도 한 번만 조회해요(동시 호출은 조회 하나를 함께 써요). `tenant_access_token`도 만료 직전까지 재사용해요. 조회가 실패하면(네트워크, 연락처 범위 밖, 권한 부족) 지난 24시간 안의 조회가 재직 중이라고 했을 때만 키를 통과시켜요. 그렇지 않으면 요청은 "API 키 소유자의 재직 여부를 확인할 수 없으니 관리자에게 문의하라"는 401을 받고, 로그에 경고가 남으며, 멤버는 비활성화되지 않아요. 게이트웨이 키와 Feishu나 Lark ID가 없는 소유자(비밀번호 계정)는 확인하지 않아요.

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

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
