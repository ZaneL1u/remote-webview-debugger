<!-- i18n-source: b2dcf2a104545f4674491fa5ba7e76271a1ed374 -->
[English](protocol.md) | [简体中文](protocol.zh-CN.md) | [繁體中文](protocol.zh-TW.md) | [日本語](protocol.ja.md) | 한국어 | [Español](protocol.es.md) | [Français](protocol.fr.md) | [Deutsch](protocol.de.md) | [Português (Brasil)](protocol.pt-BR.md) | [Русский](protocol.ru.md) | [العربية](protocol.ar.md)

# RWD 프로토콜(v1)

이 문서는 게이트웨이([`gateway/`](../gateway)), 페이지 SDK([`sdk/`](../sdk), 엔진은 [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine)), 콘솔([`console/`](../console)), MCP 클라이언트 사이의 계약이에요. 프로토콜이 바뀌면 이 문서를 먼저 고쳐요.

전체 구조(구성 요소, 동의 모델, 저장소, 보안)는 [architecture.ko.md](architecture.ko.md)를, 앱 통합은 [native-integration.ko.md](native-integration.ko.md)를 참고하세요.

규칙:

- **게이트웨이 URL**은 `https://<host>/v1` 형식이에요. 예: `https://rwd.example.com/v1`. 모든 엔드포인트가 이 아래에 있고, SDK는 모든 주소를 여기서 만들어 내요.
- 모든 데이터는 JSON이에요. 타임스탬프는 Unix epoch **밀리초**예요.
- `Level`은 `"observe" | "interact" | "advanced"` 중 하나예요([§6](#6-권한-수준) 참고).
- 여기 나오지 않는 필드는 받는 쪽에서 무시해요. 새 필드는 항상 선택 사항이라서, 오래된 SDK도 새 게이트웨이에서 그대로 동작해요.

## 목차

1. [엔드포인트](#1-엔드포인트)
2. [식별자](#2-식별자)
3. [페이지 연결(WebSocket)](#3-페이지-연결websocket)
4. [제어 상태](#4-제어-상태)
5. [페이지 RPC](#5-페이지-rpc)
6. [권한 수준](#6-권한-수준)
7. [접속 승인](#7-접속-승인)
8. [민감한 작업 확인](#8-민감한-작업-확인)
9. [프레즌스 폴링 폴백](#9-프레즌스-폴링-폴백)
10. [호스트용 JavaScript API](#10-호스트용-javascript-api)
11. [프로젝트 정책](#11-프로젝트-정책)
12. [콘솔 REST API](#12-콘솔-rest-api)
13. [실시간 업데이트(SSE)](#13-실시간-업데이트sse)
14. [MCP](#14-mcp)
15. [언어](#15-언어)
16. [운영](#16-운영)
17. [사람을 위한 DevTools](#17-사람을-위한-devtools)

## 1. 엔드포인트

| 경로 | 설명 |
|---|---|
| `GET /v1/sdk.js` | 페이지 SDK(전역 `RemoteWebviewDebugger`를 노출하는 IIFE). `Cache-Control: max-age=300`, `Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | 같은 파일을 변하지 않는 콘텐츠 주소 기반 URL로 제공해요(1년 동안 캐시, SRI와 함께 쓸 수 있음). 다른 `<version>`은 404예요. [§16](#16-운영) 참고 |
| `GET /v1/locales/<id>.js`, `GET /v1/sdk/<version>/locales/<id>.js` | 필요할 때 불러오는 SDK 언어 팩으로, `sdk.js`가 자기와 같은 위치에서 불러와요([§15](#15-언어)). `Cache-Control: max-age=300` |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Prometheus 메트릭([§16](#16-운영)) |
| `WS /v1/page?key=<appKey>` | 페이지 연결([§3](#3-페이지-연결websocket)) |
| `POST /v1/presence` | WebSocket에 연결할 수 없을 때 쓰는 폴링 폴백([§9](#9-프레즌스-폴링-폴백)) |
| `WS /v1/devtools?ticket=<ticket>` | DevTools 창의 CDP 연결로, 콘솔의 출처에서만 가능해요([§17](#17-사람을-위한-devtools)) |
| `/v1/api/…` | 콘솔 REST API([§12](#12-콘솔-rest-api)) |
| `/v1/mcp` | 호스팅 MCP 서버, Streamable HTTP, `Authorization: Bearer rwd_sk_live_…`([§14](#14-mcp)) |
| `/demo/` | `--demo-dir`의 정적 파일. 설정한 경우에만 제공 |
| `/devtools/…` | 콘솔이 내장하는 Chrome DevTools 프런트엔드([§17.4](#174-프런트엔드)) |
| 그 밖의 경로 | 콘솔 싱글 페이지 앱 |

`/v1/` 아래의 알 수 없는 경로는 `404 {"error":{"code":"not_found",…}}`를 반환해요. 모든 응답에는 `X-Content-Type-Options: nosniff`와 `Referrer-Policy: no-referrer`가 붙고, SDK를 제외한 모든 응답에는 `X-Frame-Options: DENY`도 붙으며, `/devtools/` 아래에서는 `SAMEORIGIN`이 붙어요.

## 2. 식별자

| 이름 | 형식 | 생성 |
|---|---|---|
| 앱 키 | `rwd_pk_` + base62 문자 24개 | 프로젝트와 함께 만들어져요. 공개 값이라 페이지 소스에 그대로 드러나며, 페이지를 온라인 상태로 만드는 것 말고는 할 수 있는 일이 없어요 |
| API 키 | `rwd_sk_live_` + base62 문자 32개 | 콘솔에서 만들고 한 번만 보여 줘요. 서버 쪽 pepper를 넣은 HMAC-SHA256으로 저장해요. 콘솔에는 앞 16자(`prefix`, 예: `rwd_sk_live_ab12`)가 보이고, 기기에는 `"…"`와 prefix의 마지막 4자(`keyHint`)가 보여요 |
| `deviceId` | UUID v4(`[A-Za-z0-9_-]{1,64}`이면 무엇이든 허용) | SDK가 생성해 localStorage `rwd:device`에 보관하거나, 네이티브 호스트가 `run({ deviceId })`로 전달해요 |
| 기기 코드 | `23456789ABCDEFGHJKMNPQRSTUVWXYZ` 문자로 이루어진 `XXXX-XXXX` | 게이트웨이가 어떤 `deviceId`를 처음 봤을 때 할당하고, 이후에는 바뀌지 않아요. 에이전트가 이 코드로 접속할 때 대소문자, 대시, 공백은 상관없어요 |
| `pageId` | base62 문자 12개(`[A-Za-z0-9_-]{1,64}`이면 무엇이든 허용) | SDK가 생성해 sessionStorage `rwd:page`에 보관해요. 같은 탭 안에서는 새로고침과 페이지 이동을 거쳐도 유지되고, 탭마다 새로 만들어져요 |
| 페이지 라벨 | `p1`, `p2`, … | 게이트웨이가 기기별로 할당해요. 2분 유예 시간 안에 페이지가 다시 연결되면 그대로 유지돼요 |
| 세션(실행) ID | 호스트 앱 자체의 실행 ID(`[A-Za-z0-9_.:-]` 4–128자), 없으면 SDK가 만든 16진수 16자 | 앱의 실행 한 번을 가리키며, 페이지는 이 ID 아래에 세션 로그를 남겨요([§5.4](#54-세션-로그)). `rwd.log` 결과 말고는 게이트웨이로 보내지 않아요 |
| `ref` | `e12`, `o3`, … | `eN`: 그 페이지의 가장 최근 스냅샷에 있는 요소로, 그 페이지의 다음 스냅샷 전까지 유효해요. `oN`: 스냅샷에 노드가 없는 요소(오버레이, 또는 클릭 지점을 가리는 요소, [§5.3](#53-페이지-안에서의-동작))로, 그 요소가 페이지에 있는 동안 유효해요 |
| 기기 토큰 | 16진수 64자 | `deviceId`마다 한 번 발급돼요([§3.5](#35-기기-토큰-재개-토큰-초대)). 게이트웨이는 해시만 저장해요 |
| 재개 토큰 | 16진수 32자 | `welcome`마다 새로 바뀌어요([§3.5](#35-기기-토큰-재개-토큰-초대)). 해시로 저장해요 |

## 3. 페이지 연결(WebSocket)

### 3.1 수명 주기

1. 페이지가 `wss://<host>/v1/page?key=<appKey>`를 열어요. 업그레이드 전에 게이트웨이는 다음을 확인해요.
   - 속도 제한: 클라이언트 IP당 분당 연결(프레즌스 호출 포함) 120회 → `429 rate_limited`
   - 앱 키가 존재하고 그 프로젝트가 비활성화되지 않았는지 → 아니면 `401 bad_key`
   - 프로젝트에 `allowedOrigins`가 있으면 `Origin` 헤더가 그중 하나와 일치해야 해요 → 아니면 `403 origin_not_allowed`
2. 텍스트 프레임만 쓰고, 프레임 하나에 JSON 객체 하나를 담아요. 들어오는 메시지는 최대 16 MiB까지 받아요(스크린샷이 base64로 인코딩되어 오기 때문이에요).
3. 페이지는 **5초** 안에 `hello`를 보내야 해요. 형식이 잘못된 `hello`(잘못된 JSON, 다른 `t`, 유효하지 않은 `deviceId` / `pageId`)는 `1008`로 닫아요.
4. 게이트웨이는 `welcome`([§3.4](#34-welcome))으로 응답하거나, 프로토콜 종료 코드([§3.6](#36-종료-코드))로 연결을 닫아요.
5. 게이트웨이는 **25초**마다 `{"t":"hb"}`를 보내고, 10초 안에 응답해야 하는 WebSocket ping도 함께 보내요. SDK는 **60초** 동안 아무것도 받지 못하면 다시 연결해요.
6. SDK의 재연결 간격은 1초에서 30초까지 지수 백오프로 늘어나고, 각 지연 시간은 현재 단계의 위쪽 절반에서 무작위로 골라요. **`welcome`을 받기 전에 끝난 시도가 3번 연속**되면 SDK는 프레즌스 폴링([§9](#9-프레즌스-폴링-폴백))으로 전환해요.
7. 같은 `pageId`로 두 번째 연결이 들어오면 첫 번째 연결을 대체해요(첫 번째 연결은 `1000 replaced`로 닫혀요).
8. 연결이 끊긴 페이지는 **2분 유예 시간** 동안 라벨과 자리를 유지해요(페이지 이동으로 인한 재연결은 이 시간 안에 충분히 끝나요). 그 뒤에는 타임라인에 `closed`로 기록돼요. 다음 두 경우에는 기다리는 시간이 줄어들어서, 다시 만들어진 WebView가 페이지 목록에 *재연결 중*으로 남아 있지 않아요.
   - **새 `pageId`**로 연결한 페이지가 있으면, 같은 URL(`#` 프래그먼트는 무시)을 보여 주던 연결 끊긴 페이지를 모두 즉시 정리해요.
   - 연결이 끊긴 페이지의 URL을 **연결된** 페이지도 보여 주고 있으면, 끊긴 페이지는 **1.5초** 뒤에 정리해요.

   어느 경우든 정리된 페이지가 에이전트가 선택한 페이지였다면, 선택은 살아 있는 페이지로 옮겨지고 결과에 그 사실이 표시돼요([§14.3](#143-도구)).
9. SDK는 `pagehide`에서 소켓을 닫고(페이지가 뒤로/앞으로 캐시에 들어갈 수 있도록) `pageshow`에서 다시 연결해요.

연결마다 메시지 64개짜리 전송 큐가 있어요. 따라오지 못하는 페이지는 게이트웨이를 느리게 만드는 대신 `1013 slow consumer`로 닫아요.

### 3.2 페이지 → 게이트웨이

```jsonc
{"t":"hello","v":1,"sdk":"<SDK version>",
 "deviceId":"…","pageId":"…","openerId":"<pageId>"|null,
 "userId":"<string>"|null,
 "page":{"url":"…","title":"…","visibility":"visible"|"hidden"},
 "device":{"ua":"…","platform":"ios"|"android"|"web",
           "screen":{"w":393,"h":852,"dpr":3},
           "app":{"name":"…","version":"…"}|null},
 "help":false,
 "deviceToken":"<token>"|null,   // 현재 SDK에서는 항상 포함, §3.5 참고
 "resume":"<token>"|null,        // 이 pageId가 마지막으로 받은 재개 토큰
 "invite":"<token>"|null}        // ?rwd_invite=…에서 가져옴

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // 바뀌었을 때
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // 사용자가 지원을 요청 / 요청 취소
{"t":"control","action":"takeover"|"handback"|"end"}                // 사용자의 버튼, §4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"t":"cdp","s":"<session>"|absent,"m":"<CDP JSON>"}                 // DevTools 응답 / 이벤트, §17.2
{"id":17,"result":{…}}                                              // RPC 성공, §5
{"id":17,"error":{"code":"not_found","message":"…"}}                // RPC 실패, §5
```

- `hello`: 게이트웨이는 `userId`(최대 128자), `ua`(512), `platform`(16), `app`, `url`(2048), `title`(256)을 보관해요. `screen`은 참고용이에요.
- `event.summary`는 에이전트를 위한 한 문장으로, 마스킹 대상 값은 이미 지워져 있어요. 예: `TypeError: Cannot read properties of undefined (reading 'orderId')`, `POST /api/order → 405`, `Tapped button "Place order"`. 게이트웨이는 각 kind를 타임라인에 기록하고(최대 300바이트) 알 수 없는 kind는 무시해요. 페이지 이동은 페이지 내 이동을 포함해 이벤트가 아니에요. 게이트웨이가 `page` 메시지에서 이동을 알아내고(타임라인의 `navigated`, [§12.9](#129-타임라인-이벤트)), SDK는 이를 세션 로그에 남겨요([§5.4](#54-세션-로그)).
- SDK는 이벤트 중복을 제거하고(2초 안에 같은 kind와 summary) 10초당 최대 30개까지 보내요. 오프라인일 때 생긴 이벤트와 제어 동작은 큐(최대 메시지 100개)에서 다음 `welcome`을 기다려요.
- `help`와 `control`은 사용자의 탭(또는 네이티브 호스트의 호출, [§10](#10-호스트용-javascript-api))으로만 보내요.

### 3.3 게이트웨이 → 페이지

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"Support Bot"}|null,"level":"interact"|null,
 "attachedMs":83000|null}                                     // §4, 기기의 모든 페이지로
{"t":"help","on":false}                                       // 지원 요청 해제: 에이전트가 접속했거나, 콘솔 멤버가 세션을 종료했거나, 사용자가 기기에서 종료함
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"Support Bot"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7, 포그라운드 페이지로
{"t":"attach_cancel","requestId":"…"}                         // §7, 모든 페이지로
{"t":"devtools","s":"<session>","on":true,"by":"Ann"}         // §17.2, DevTools 창이 열림 / 닫힘("on":false)
{"t":"cdp","s":"<session>","m":"<CDP JSON>"}                  // §17.2, 그 창에서 온 명령
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // 예약됨: SDK가 afterMs 뒤에 다시 연결
{"id":17,"method":"rwd.snapshot","params":{}}                 // RPC 요청, §5
```

`reconnect`는 SDK가 이해하지만, 현재 게이트웨이는 보내지 않아요.

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null,"attachedMs":null},
 "level":null,                       // control.level과 같음
 "resume":"<new resume token>",
 "deviceToken":"<token>",            // 이 welcome에서 발급한 경우에만
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},   // 또는 null, 아래 참고
 "agentLang":"en",                   // 게이트웨이의 언어: "en", "zh", "zh-TW", "fr"…, §15
 "task":{…}}                         // 접속한 에이전트가 작업을 설정한 동안에만
```

`config`는 페이지가 사용한 앱 키의 프로젝트 정책([§11](#11-프로젝트-정책))에서 온 원격 설정이에요. `config.helpButton`은 이 페이지의 `userId`를 기준으로 이미 결정된 값이에요(`all`이거나, `listed`이면서 사용자가 목록에 있는 경우). `config.networkExclude`는 페이지가 직접 `run({ networkExclude })`로 전달한 규칙에 더해져요([§10](#10-호스트용-javascript-api)). `config.sessionLog`는 세션 로그에 대한 프로젝트의 스위치예요. `false`이면 기록을 멈추고 이 출처에 이미 보관된 로그를 삭제해요([§5.4](#54-세션-로그)). `config.eruda`는 프로젝트의 eruda 정책이에요([§11](#11-프로젝트-정책)). `null`이거나 아예 없을 수도 있는데(이 필드가 생기기 전의 게이트웨이나 저장된 `config`), SDK는 이를 `{"dock":false,"load":false}`로 읽고, 페이지 자체의 `run({ eruda })`가 필드 단위로 우선해요([§10](#10-호스트용-javascript-api)). SDK는 마지막 `config`를 localStorage `rwd:cfg`에 보관하고, 다음 페이지에서는 그 페이지의 `welcome`이 올 때까지 이 값을 적용해요.

접속 요청이 대기 중이고 다시 연결한 페이지가 그 기기의 포그라운드 페이지라면, 게이트웨이는 `welcome` 바로 뒤에 `attach_request`를 다시 보내요.

### 3.5 기기 토큰, 재개 토큰, 초대

**기기 토큰.** 토큰을 지원하는 SDK에서 어떤 `deviceId`를 처음 보면, 게이트웨이는 `welcome.deviceToken`으로 기기 토큰을 발급해요(무작위 32바이트, 16진수, 해시만 저장). 그 뒤로는 그 기기의 모든 페이지가 `hello.deviceToken`에 이 토큰을 제시해야 하고, 없거나 틀리면 **4401**로 닫아요. 따라서 `deviceId`와 공개된 앱 키를 안다고 해서 남의 기기에 들어갈 수는 없어요.

- SDK는 토큰을 localStorage `rwd:dtoken`에 저장하고 `status().deviceToken`으로 노출해요. localStorage는 출처별로 나뉘므로, 여러 도메인을 불러오는 네이티브 호스트는 토큰을 직접 보관했다가 `run({ deviceToken })`으로 다시 전달해요([native-integration.ko.md](native-integration.ko.md)).
- `deviceToken` 필드가 있는 hello(값이 `null`이라도)는 토큰을 지원하는 것으로 봐요. 이 필드가 없는 hello는 토큰을 보관할 수 없는 SDK에서 온 것이므로 게이트웨이가 토큰을 발급하지 않아요(발급하면 그 기기의 이후 페이지들이 막히기 때문이에요). 하지만 기기에 일단 토큰이 생기면 모든 페이지가 토큰을 제시해야 해요.

**재개 토큰.** 모든 `welcome`에는 `pageId`에 묶인 새 `resume` 토큰이 들어 있어요. 이미 알려진 `pageId`로 페이지가 다시 연결할 때는 `hello.resume`이 마지막으로 발급된 토큰과 일치해야 해요. 일치하지 않으면 **4409**로 닫히고, SDK는 새 `pageId`로 처음부터 다시 시작해요. 따라서 `pageId`를 안다고 해서 페이지를 사칭할 수는 없어요.

**초대.** 페이지 URL에 `?rwd_invite=<token>`이 있으면, SDK는 주소창에서 이 매개변수를 지우고(`history.replaceState`), 토큰을 sessionStorage에 보관한 뒤 `welcome`이 올 때까지 `hello.invite`로 보내요. 초대가 같은 프로젝트의 것이고, 아직 쓰이지 않았고, 만료되지 않았으면 게이트웨이가 받아들여요. 그러면 기기는 `invited`로 표시되고 지원 요청 상태가 되며, 타임라인에는 어느 초대로 들어왔는지 기록되고, 초대는 사용 처리돼요. 유효하지 않은 초대는 조용히 무시해요. [§12.6](#126-기기-초대) 참고.

### 3.6 종료 코드

| 코드 | 의미 | SDK 반응 |
|---|---|---|
| `1008` | 형식이 잘못된 `hello` | 백오프하며 다시 연결 |
| `1013` | 페이지가 전송 큐를 따라오지 못함 | 백오프하며 다시 연결 |
| `4401` | 기기 토큰이 없거나 틀림 | 그사이 저장된 토큰이 바뀌었으면(다른 탭이 방금 받은 경우) 즉시 재시도. 토큰이 아예 없고 `deviceId`가 SDK 자체의 것(호스트가 넘겨준 것이 아님)이면 토큰을 실은 welcome이 유실된 것(첫 페이지가 핸드셰이크 도중에 사라짐)이므로, 약 1.5초 뒤 그때까지 다른 탭이 토큰을 저장하지 않았다면 새 `deviceId`로 처음부터 다시 시작(페이지당 최대 두 번). 그 밖에는 상태를 `rejected`로 두고 약 10분 뒤 재시도 |
| `4409` | 재개 토큰 불일치 | 새 `pageId`로 다시 연결 |
| `4429` | 프로젝트의 온라인 기기 한도(`maxOnlineDevices`)에 도달 | 상태를 `quota`로 두고 약 5분 뒤 재시도 |

## 4. 제어 상태

기기마다 제어 상태가 하나 있어요. 게이트웨이가 이를 결정하고, `control` 메시지로 기기의 모든 페이지에 알려요.

| 상태 | 의미 | 페이지 UI |
|---|---|---|
| `none` | 접속한 에이전트 없음 | 기기 코드가 적힌 접힌 배지(활성화된 경우 지원 요청 버튼도 함께) |
| `observe` | 에이전트가 접속해서 보기만 하는 중 | "AI 보는 중", 사용자 입력 차단(사용자가 잠금을 끄지 않은 경우), 빛나는 화면 테두리, **직접 조작**과 **종료** 버튼 |
| `agent` | 에이전트가 페이지를 조작하는 중 | "AI 조작 중", 같은 잠금·테두리·버튼에 더해 에이전트의 커서 |
| `user` | 사용자가 직접 조작으로 전환함 | 잠금 없음, 움직이지 않는 테두리, **AI에 맡기기**와 **종료** 버튼 |

전환:

| 계기 | 변화 |
|---|---|
| 에이전트가 접속함([§7](#7-접속-승인)) | `none` → `observe` |
| 에이전트가 상호작용 도구를 호출함(click, fill, type, press, select, hover, scroll, drag, navigate, back, reload) | `observe` → `agent`. `user` 상태에서는 게이트웨이가 페이지에 묻지 않고 `takeover` 오류로 거부 |
| `policy.agentIdleMinutes`(기본값 2, 10초마다 확인) 동안 상호작용 없음 | `agent` → `observe` |
| 페이지가 `control: takeover`를 보냄 | `observe` / `agent` → `user` |
| 페이지가 `control: handback`을 보냄 | `user` → `agent`(접속한 에이전트가 없으면 `none`) |
| 페이지가 `control: end`를 보냄 | 에이전트 접속이 해제되고 지원 요청도 해제됨 → `none` |
| 에이전트의 연결이 끊기거나 다른 에이전트로 대체됨, 키가 폐기됨, `policy.attachMaxMinutes`(기본값 60)가 지남, 또는 콘솔 멤버가 세션을 종료함 | → `none` |

페이지는 에이전트가 행동할 때가 아니라 접속한 순간(`observe`)부터 잠기고, 유휴 상태로 `agent` → `observe` 전환이 일어나도 사용자가 직접 조작으로 전환하거나 상태가 `none`으로 돌아갈 때까지 잠긴 채로 있어요.

`attachedMs`는 게이트웨이가 메시지를 보낸 시점에 현재 에이전트가 접속해 있던 시간(밀리초)이에요(에이전트가 없으면 `null`). 기간으로 표현하므로 페이지와 게이트웨이의 시계가 맞을 필요가 없어요. 하단 바는 `observe`, `agent`, `user` 상태에서 이를 "연결됨 · 01:23" 형태의 흐르는 타이머로 보여 주고, 페이지 자체의 연결이 끊긴 동안에는 "연결 중…"을 보여 줘요. 이 필드가 없는 게이트웨이라면 SDK는 페이지가 에이전트를 처음 본 시점부터 시간을 세요.

SDK도 두 번째 확인으로, 사용자가 직접 조작 중인 동안에는 상호작용 RPC를 `takeover`로 거부해요. SDK는 상태(와 에이전트가 접속한 시점)를 localStorage `rwd:ctl`에 2분 동안 기억해요. 그래서 페이지 이동 후 다음 페이지는 `welcome`을 기다리지 않고, 타이머가 흐르는 상태로 즉시 잠겨요. 직접 조작, AI에 맡기기, 종료는 사용자의 신뢰된 탭에만 반응해요. 에이전트는 이 버튼을 누를 수 없고, 네이티브 호스트는 `nativeKey`를 제시해야 해요([§10](#10-호스트용-javascript-api)).

## 5. 페이지 RPC

### 5.1 엔벨로프

게이트웨이는 한 페이지에 `{"id":<n>,"method":"rwd.…","params":{…}}`를 보내고, 페이지는 `{"id":<n>,"result":{…}}` 또는 `{"id":<n>,"error":{"code":"…","message":"…"}}`로 응답해요. ID는 연결 안에서 고유해요. 연결이 끊기면 대기 중인 호출은 즉시 실패해요.

게이트웨이 쪽 제한 시간: MCP 호출은 20초, `rwd.click`, `rwd.press`, `submit: true`인 `rwd.type`은 45초(사용자에게 확인을 요청할 수 있기 때문이에요, [§8](#8-민감한-작업-확인)), 콘솔의 연결 테스트는 15초예요.

오류 코드:

| 코드 | 의미 |
|---|---|
| `not_found` | 오래된 `ref` 또는 사라진 요소, 알 수 없는 옵션, 알 수 없는 요청 ID |
| `not_interactable` | 보이지 않음, 비활성화됨, 가려짐, 읽기 전용, 또는 5초 안에 안정되지 않음 |
| `timeout` | 대기 시간이 다 됨(페이지 또는 게이트웨이에서) |
| `takeover` | 사용자가 직접 조작 중 |
| `forbidden` | 부여된 수준을 넘음([§6](#6-권한-수준)), 또는 사용자가 확인을 거부함 |
| `bad_request` | 매개변수가 없거나 잘못됨, 알 수 없는 메서드 |
| `internal` | 그 밖의 모든 경우(메시지에 JavaScript 오류가 담김) |

SDK가 작성하는 메시지는 에이전트의 언어(`welcome.agentLang`, [§15](#15-언어))로 쓰여요.

### 5.2 메서드

모든 메서드는 그것을 받은 페이지에서 동작해요.

| 메서드 | 수준 | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<ms>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}`: Playwright의 AI 형식(YAML, 요소에 `[ref=eN]` 태그)으로 된 접근성 스냅샷이에요. 페이지 위에 무언가 떠 있으면 그 뒤에 오버레이 섹션이 붙어요([§5.3](#53-페이지-안에서의-동작)) |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}`(기준이 하나 이상 필요, `limit`은 1–100) | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`, [§5.4](#54-세션-로그) 참고 | `op`에 따라 다름 |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}`: Playwright 키 이름, `Control+A` 같은 조합 | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}`(이후 페이지가 다시 연결됨) |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | 세션 로그 기록 하나의 전체 내용: `{"seq","session","at","kind","page","imp","size","data"}`, 헤더와 본문 포함([§5.4](#54-세션-로그)) |

세부 사항:

- `rwd.query`는 `role`을 정확히(대소문자 무시) 비교하고, `name` / `text`는 대소문자를 구분하지 않는 부분 문자열로 비교해요. `text`는 요소 자신과 자손의 텍스트를 대상으로 하고, 가장 안쪽에서 일치한 요소만 반환해요.
- `rwd.fill`은 텍스트 입력란, textarea, `contenteditable` 요소에서 동작해요(`<label>`은 연결된 컨트롤로 대상이 바뀌어요). 네이티브 setter로 값을 설정하고 `input`과 `change`를 디스패치하므로, React와 Vue의 제어 컴포넌트 입력도 변경을 감지해요. `<select>`에는 `rwd.select`를 써야 해요.
- `rwd.type`은 `ref`가 있으면 그 요소에 포커스를 주고(캐럿은 끝에) 입력하고, 없으면 현재 포커스된 요소에 입력해요. `submit: true`이면 입력 뒤에 Enter를 눌러요.
- `rwd.select`는 각 값을 옵션의 value, 라벨, 텍스트와 비교해요. 값이 여러 개면 `multiple` select여야 해요.
- `rwd.scroll`은 `ref`가 없으면 페이지를 스크롤하고, `ref`가 있으면 그 요소에 wheel 이벤트를 디스패치하고 스크롤 가능한 조상 요소를 스크롤해요. 사용자가 따라볼 수 있도록 스크롤은 약 0.3초 동안 애니메이션돼요.
- `rwd.navigate`는 절대 또는 상대 `http(s)` URL만 받아요. 페이지 이동, 뒤로 가기, 새로고침은 응답을 보낸 뒤 50ms 후에 일어나요.
- `rwd.waitFor`는 먼저 `timeMs`(최대 60초)만큼 기다린 다음, 보이는 텍스트(`document.body.innerText`)를 100ms마다 확인하며 `text`가 나타나고 `textGone`이 사라지기를 기다려요. `timeoutMs`가 지나면 `timeout`으로 실패해요.
- `rwd.screenshot`은 호스트 앱이 네이티브 캡처를 등록했고 영역이 뷰포트 안에 있으면 그것을 쓰고(`source: "native"`), 아니면 DOM을 다시 렌더링해요(`source: "dom"`. canvas, video, 교차 출처 이미지는 비어 보일 수 있어요). `ref`를 주면 그 요소 영역으로 자르고, `fullPage`는 문서 전체를 캡처해요. [§10](#10-호스트용-javascript-api) 참고.
- `rwd.console` / `rwd.network`는 `sinceId`가 있으면 그 뒤의 가장 오래된 항목 `limit`개를, 없으면 최신 항목 `limit`개를 반환해요. 진행 중인 요청은 `status: 0`, `durationMs: null`이에요. `type`은 `xhr`, `fetch`, `websocket`, `beacon`, `eventsource` 중 하나예요.
- `rwd.network`는 제외 규칙(프로젝트의 `networkExclude`와 `run({ networkExclude })`([§11](#11-프로젝트-정책)), 그리고 이번 호출에만 적용되는 `exclude`)에 일치하는 요청을 빼고, 그 수를 `hidden`에 세요. `includeExcluded: true`이면 모두 반환하고 `hidden`은 0이에요. 제외된 요청도 기록은 되며, `rwd.networkDetail`로 ID를 지정하면 여전히 반환돼요.
- `rwd.networkDetail`은 `Cookie`, `Set-Cookie`, `Authorization`, `Proxy-Authorization` 헤더를 가리고, 본문은 마스킹한 뒤 64 KB에서 잘라요.
- `rwd.storage`는 최대 500개 항목을 반환하고, 값은 4000자에서 잘라요. 쿠키는 스크립트에서 볼 수 있는 것(HttpOnly가 아닌 것)만이에요. SDK 자체의 `rwd:dtoken`과 `rwd:resume`은 항상 마스킹돼요.
- `rwd.evaluate`는 함수 소스를 페이지의 전역 스코프에서 평가하고 `this = window`로 호출해요. promise를 반환해도 돼요. 결과는 JSON으로 안전하게 변환돼요. `undefined`와 함수는 `null`, 요소는 짧은 태그 설명, 날짜는 ISO 문자열, 순환 참조는 `"[Circular]"`가 돼요.

### 5.3 페이지 안에서의 동작

- **조작 가능 여부 확인.** 포인터 동작은 요소가 문서에 연결되어 있고, 보이고, 두 애니메이션 프레임 동안 안정적이고, 활성화되어 있고, 화면 안으로 스크롤되었고, 대상 지점의 히트 테스트가 그 요소나 자손에 닿을 때까지 기다려요(최대 5초). 먼저 시도하는 지점은 손가락으로 누를 때처럼 요소의 보이는 영역 중심이에요. 무언가가 그곳을 가리고 있으면 보이는 영역 안 3×3 격자의 나머지 지점들을 시도하므로, 버튼 위에 배지가 하나 있다고 해서 클릭이 막히지는 않아요. 모든 지점이 가려져 있으면 호출은 `not_interactable`로 실패하고, 가리는 요소와 그 `ref`를 알려 주는 메시지(*the click point is covered by `<div.popup-mask>` (ref=o1; click it directly…)*)를 돌려줘요. 에이전트는 대신 그 요소를 클릭할 수 있어요. 히트 테스트는 SDK 자체의 UI와 다른 디버깅 도구(`.__chobitsu-hide__`, `#eruda`, `#__pageSpy`, `#__vconsole`)는 건너뛰어요.
- **오버레이.** 팝업의 배경, 모달, 바텀 시트처럼 페이지 위에 레이어가 떠 있으면 스냅샷 끝에 `[Overlays]` 섹션이 붙어요. 뷰포트의 몇몇 지점을 히트 테스트해서, 고정 위치(또는 뷰포트 크기의 절대 위치) 박스 안에 있으면서 뷰포트의 15% 이상을 덮고, 스냅샷 요소의 절반을 스스로 포함하지 않는 것(그렇다면 위에 뜬 레이어가 아니라 앱 자체의 루트일 테니까요)을 골라요. 각 줄에는 요소의 태그, (마스킹된) 텍스트 몇 단어, 덮고 있는 뷰포트 비율, `ref`가 나와요. 텍스트도 미디어도 없는 레이어는 배경으로 표시돼요. 빈 배경은 aria 스냅샷에 노드가 없어서 `oN` ref를 받아요. 덕분에 에이전트가 배경을 탭해 팝업을 닫을 수 있어요.
- **합성 입력.** 클릭은 `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click`을 디스패치하고, 터치 기기에서는 터치 이벤트도 함께 보내요. 이 이벤트들은 `isTrusted: false`이므로, 이 값을 확인하는 페이지는 반응하지 않아요.
- **피드백.** 대상이 잠깐 강조 표시되고, 입력을 디스패치하기 전에 페이지 위의 에이전트 커서가 그곳으로 이동해요.
- **마스킹.** `input[type=password]`, `data-rwd-mask`가 있는 요소, 프로젝트의 `maskSelectors`에 해당하는 요소의 값은 스냅샷과 스크린샷에서 `••••`로 바뀌어요(네이티브 스크린샷에서는 회색 상자로 덮여요). 이 값들과 `maskPatterns`에 일치하는 텍스트는 console 텍스트, 네트워크 URL과 본문, 저장소 값, 이벤트 요약에서도 치환돼요.
- **스냅샷 범위.** 스냅샷의 루트는 `<body>`예요. SDK의 UI는 `<html>` 아래, `<body>` 밖의 Shadow DOM에 있어요. eruda, PageSpy, vConsole 노드는 스냅샷에서 제거돼요.
- **버퍼.** console, 처리되지 않은 오류, 네트워크(XHR, fetch, WebSocket, sendBeacon, EventSource)는 SDK가 로드된 순간부터 각각 항목 500개짜리 링 버퍼에 기록돼요. 가득 차면 일반 로그와 성공한 요청부터 버리고, 그 수를 `dropped`가 세요. 응답 본문은 전체 5 MB, 개당 64 KB까지 캐시돼요.

### 5.4 세션 로그

[§5.3](#53-페이지-안에서의-동작)의 버퍼는 한 페이지의 메모리에만 있어요. **세션 로그**는 그 긴 버전이에요. 앱이 실행된 뒤 이 출처에서 일어난 모든 일을 출처의 모든 페이지가 **IndexedDB**(데이터베이스 `rwd-log`)에 기록하며, 게이트웨이에 연결되어 있는지와는 상관없어요. 그래서 나중에 접속한 에이전트도 새로고침과 여러 페이지를 넘나들며 버그에 이르기까지의 전 과정을 읽을 수 있어요. 접속한 에이전트가 요청하지 않는 한 로그는 기기 밖으로 나가지 않아요.

**세션은 앱의 실행 한 번이에요.** ID는 다음 순서로 정해져요.

1. `run({ launchId })`: 호스트 앱 자체의 실행 ID로, 콜드 스타트마다 새로 만들어지고 그 프로세스의 모든 WebView에서 같아요.
2. `window.RWDLaunchId`: 호스트나 통합 스니펫이 정의할 수 있어요. 문자열이거나, 문자열(또는 문자열의 promise, 최대 300ms 기다림)을 반환하는 함수예요.
3. SDK가 추론: 세션 쿠키 `rwd_launch`(만료 기한이 없어서 앱 프로세스와 함께 사라져요)와 10초마다의 하트비트를 써요. **1시간** 넘게 조용했던 쿠키 세션은 이전 실행으로 보고 새 ID를 시작해요. 실행이 바뀌어도 세션 쿠키를 유지하는 WebView를 이렇게 잡아내요.

세션의 `source`는 어느 경우였는지를 알려 줘요. 1과 2는 `app`, 3은 `cookie`예요.

**기록되는 내용.** 각 기록에는 `seq`(키, 증가값), `at`, `kind`, `page`(기록한 페이지의 `pageId`), `data`가 있어요.

| `kind` | `data` |
|---|---|
| `page` | `event: "open"`(url, title, referrer), `"nav"`(from, url, title. 페이지 내 이동 포함), `"visibility"`(포그라운드 / 백그라운드), `"hide"`(페이지가 사라짐) |
| `action` | 사용자 자신의(신뢰된) 입력: `"tap"`(요소 설명), `"input"`(입력란 설명과 값), `"submit"`, `"scroll"`(스크롤이 멈춘 위치). 비밀번호 입력란, `data-rwd-mask` 요소, `maskSelectors`에 일치하는 요소의 값은 평문이 아닌 `••••`로 저장돼요. 그 밖의 값은 `maskPatterns`로 마스킹하고 200자에서 잘라요 |
| `agent` | 에이전트의 상호작용 호출과 `rwd.evaluate`: 메서드, `ref`, 키, url, 값, 텍스트, 실패했다면 오류. 읽기(스냅샷, 목록)는 기록하지 않아요 |
| `control` | 에이전트 이름이 포함된 제어 상태 변경([§4](#4-제어-상태)) |
| `console` | 모든 레벨, `type`, `text`, `source` 포함 |
| `net` | 완료된 모든 요청: 메서드, url, 상태, 유형, 소요 시간, 크기, 오류. **실패한** 요청에는 `reqHeaders` / `resHeaders`(`rwd.networkDetail`과 같은 방식으로 가림)와 `reqBody` / `resBody`도 담기며, 각각 64 KB에서 잘라요 |

console 오류와 경고, 실패한 요청, 사용자의 탭·입력·제출, 에이전트 동작, 제어 상태 변경은 중요 기록으로 표시되어 가장 오래 보관돼요. `problems`와 `overview`가 골라내는 *문제*는 console 오류와 실패한 요청이에요.

**한도.** 최근 **3**회 실행분을 각각 **10 MB** 안에서 보관해요. 이를 넘으면 중요하지 않은 오래된 기록(일반 console 로그, 성공한 요청)부터, 그다음에는 전체에서 가장 오래된 기록부터 상한의 80%가 될 때까지 버리고, 그 수를 `trimmed`가 세요. `navigator.storage.estimate()`가 보고하는 할당량이 64 MB 미만이면 현재 실행분만 보관해요. IndexedDB가 없으면(일부 비공개 모드) 아무것도 기록되지 않고 `rwd.log`는 `internal`로 실패해요.

**읽는 방법.** `rwd.log`는 `op`를 받아요.

```jsonc
// op: "sessions" → 아직 보관 중인 모든 실행분, 최신순
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview", params {"session"?} → 실행 한 번의 개요
{"session":{…meta…,"current":true},"first":<ms>,"last":<ms>,
 "pages":[{"at","page","data"}],      // 페이지 open / nav 기록, 최근 60개
 "problems":[…records…]}              // console 오류와 실패한 요청, 최근 20개

// op: "records", params {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                       "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                       "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // 다음 페이지를 읽으려면 `after`로 전달
 "hidden":0}                          // 네트워크 제외 규칙이 숨긴 요청 수(§11)
```

- `session`의 기본값은 현재 실행이에요(`"current"`도 같은 뜻이에요). 알 수 없는 ID는 `not_found`로 실패해요. 기록 중인 실행이 없으면 보관된 것 중 가장 최신 실행을 써요.
- `problems: true`이면 console 오류와 실패한 요청만 남겨요. `text`는 기록의 `data`에 대해 대소문자를 구분하지 않는 부분 문자열이에요. `limit`은 1–500이고 기본값은 100이에요.
- 기록은 헤더와 본문 **없이** 반환돼요. 본문이 있는 기록은 `data.hasBody`가 `true`예요. `rwd.logDetail`은 그 기록 하나를 전부 반환하며, `rwd.networkDetail`처럼 `advanced`([§6](#6-권한-수준))가 필요해요.
- 네트워크 제외 규칙은 여기에도 적용돼요. 그래서 규칙에 일치하는 `net` 기록은 `includeExcluded`를 설정하지 않는 한 `records`에서 빠지고 `hidden`에 세어져요.

**끄는 방법.** `run({ record: false })`는 그 페이지 하나만 기록하지 않게 해요. `policy.sessionLog: false`([§11](#11-프로젝트-정책))는 `welcome.config.sessionLog`로 페이지에 전달되어 기록을 멈추고 **그 출처에 이미 보관된 로그를 삭제해요**. `status().logSession`은 페이지가 기록 중인 세션 ID이고, 기록하지 않으면 `null`이에요.

## 6. 권한 수준

| 수준 | 허용되는 메서드 |
|---|---|
| `observe` | `rwd.ping`, `rwd.snapshot`, `rwd.query`, `rwd.screenshot`, `rwd.console`, `rwd.network`, `rwd.waitFor`, `rwd.log` |
| `interact` | `observe` + `rwd.click`, `rwd.fill`, `rwd.type`, `rwd.press`, `rwd.select`, `rwd.hover`, `rwd.scroll`, `rwd.drag`, `rwd.navigate`, `rwd.back`, `rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`, `rwd.networkDetail`, `rwd.storage`, `rwd.logDetail` |

접속의 권한 수준은 다음과 같이 정해져요.

```
min(에이전트가 요청한 수준(기본값 interact),
    API 키의 maxLevel,
    키 소유자의 역할이 허용하는 최고 레벨(§12.4),
    병합된 프로젝트 정책의 maxLevel,
    사용자가 기기에서 고른 수준)
```

양쪽 모두 이 수준을 강제해요. 게이트웨이는 수준을 넘는 호출을 거부하고(오류 `forbidden`, 감사 `policy.denied`), SDK도 무엇이든 실행하기 전에 `welcome.level` / `control.level`과 다시 비교해요. 게이트웨이는 알 수 없는 메서드를 `advanced`로 취급해요. 에이전트가 접속해 있는데 게이트웨이가 수준을 보내지 않으면 SDK는 `interact`로 가정해요.

## 7. 접속 승인

에이전트가 `connect_device`를 호출하면, 게이트웨이는 그 기기에 열려 있는 페이지들의 프로젝트 정책을 병합해요([§11](#11-프로젝트-정책)). 병합된 `approval`이 `prompt`이면 사용자가 기기에서 승인해야 해요.

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"Support Bot","keyHint":"…a91f"},
   "levels":["observe","interact"],   // 제안하는 수준. 키와 정책이 상한이며, 마지막 값이 에이전트가 요청한 수준
   "expiresInSec":30,
   "purpose":"devtools"}              // 콘솔 멤버가 DevTools를 요청했을 때만(§17.1)
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // 거부하려면 "level": null
← {"t":"attach_cancel","requestId":"…"}                         // 시간 초과, 또는 에이전트가 포기함
```

- 요청은 기기의 **포그라운드 페이지**로 가고, `attach_cancel`은 모든 페이지로 가요.
- **30초** 안에 응답이 없으면 시간 초과로 처리해요. MCP 호출은 응답을 기다려요.
- 같은 API 키가 같은 기기에서 10분 안에 **3번** 거부되면, 그 키가 해당 기기에 보내는 요청은 **10분** 동안 묻지 않고 거부돼요.
- 기기마다 대기 중인 요청은 하나만 있을 수 있어요.
- SDK의 대화 상자는 Shadow DOM 안에 있고, 신뢰된 탭만 받으며, 나타난 지 0.4초 뒤에야 활성화돼요. 그래서 에이전트가 스스로 승인할 수 없어요. 같은 출처의 탭들은 BroadcastChannel로 결정을 공유해요.
- 사용자는 SDK의 플로팅 창에서 최대 수준을 정해 **자동 허용**을 켤 수 있어요. 그러면 SDK는 그 범위 안에서 제안된 가장 높은 수준으로 즉시 응답하고 알림을 보여 줘요. 자동 허용은 에이전트를 위한 것이라, DevTools 요청은 항상 물어봐요.
- `run({ nativeApproval: true })`이면 SDK는 대화 상자를 보여 주지 않아요. 대신 `status().pending`이 `{kind:"attach", requestId, agent:{name, keyHint}, levels, purpose, expiresAt}`가 되고(`purpose`는 `"agent"` 또는 `"devtools"`예요), 네이티브 호스트가 `nativeDecide(nativeKey, requestId, level | null)`로 응답해요.
- 승인되면 게이트웨이는 에이전트를 접속시키고(그 기기에 다른 에이전트가 있으면 대체해요), 지원 요청을 해제하고(`{"t":"help","on":false}`), `{"t":"control","state":"observe","agent":{…},"level":"interact","attachedMs":0}`를 브로드캐스트해요. 페이지는 즉시 잠겨요([§4](#4-제어-상태)).

`approval: none`이면 에이전트는 계산된 수준으로 바로 접속해요.

**다시 묻지 않고 돌아오기.** 에이전트가 스스로 기기를 놓으면(`disconnect_device`, 다른 기기에 접속, 또는 `policy.attachMaxMinutes` 만료) 허가가 남아요. **10분** 동안 같은 API 키는 휴대폰에 대화 상자를 띄우지 않고 그 기기에 다시 접속할 수 있으며, 수준은 **사용자가 이전에 허용한 수준을 넘지 않아요**(그래서 `observe`로 승인받은 뒤 `advanced`를 요청해도 `observe`가 돼요). 그 밖에 완화되는 것은 없어요. 키, 정책, 에이전트 자신의 요청이 여전히 수준의 상한이 되고, 기기에는 연결된 페이지가 있어야 해요. 이런 접속은 평소의 `attach.start`와 함께 `attach.resume`으로 감사 로그에 남고([§12.7](#127-감사-로그)), 페이지는 `attach_request`가 아니라 일반 `control` 메시지를 받아요.

다시 돌아와도 허가는 소모되지 않아요. 다시 놓으면 새로운 10분이 시작돼요. 세션이 다른 이유로 끝나면 허가는 사라져요. 사용자가 기기에서 **종료**를 탭한 경우, 콘솔 멤버가 세션을 종료한 경우(`POST /devices/:id/end`), API 키가 폐기된 경우, 다른 에이전트가 그 기기에 접속해 이 에이전트를 대체한 경우, 사용자가 요청을 거부한 경우예요. 허가는 메모리에 보관되므로 게이트웨이 프로세스가 끝나도 사라져요.

## 8. 민감한 작업 확인

에이전트가 다음 작업을 하려고 하면, SDK는 실행하기 전에 사용자에게 물어봐요.

- `[data-rwd-confirm]`이나 정책의 `confirmSelectors`에 일치하는 요소, 또는 그 안에 있는 요소를 클릭(`rwd.click`)할 때
- 그런 요소에서, 또는 그런 요소를 포함한 폼 안에서 Enter를 누를 때(`rwd.press`, 또는 `submit: true`인 `rwd.type`). textarea나 리치 텍스트 편집기 안에서는 해당하지 않아요.

대화 상자에는 *AI가 “주문하기” 클릭을 요청했어요. 허용할까요?* 같은 문구가 표시되고, 신뢰된 탭만 받으며, **30초** 뒤에 만료돼요. 거부하거나 시간이 초과되면 RPC는 `{"code":"forbidden","message":"The user denied this action"}`로 실패해요. 한 번에 하나의 확인만 열 수 있고, 사용자가 직접 조작으로 전환하거나, 에이전트가 떠나거나, 연결이 끊기면 취소돼요.

`nativeApproval: true`이면 `status().pending`이 `{kind:"confirm", requestId, action:'click "Place order"', expiresAt}`가 되고, 호스트가 `nativeDecide(nativeKey, requestId, "allow" | null)`로 응답해요. `status().pending`에서는 대기 중인 확인이 대기 중인 접속 요청보다 우선해요.

## 9. 프레즌스 폴링 폴백

WebSocket이 3번 연속 실패하면 SDK는 대신 60초마다 `POST /v1/presence`를 호출해요. JSON 본문을 `Content-Type: text/plain`으로 보내므로 CORS preflight가 필요 없고, 게이트웨이는 `Access-Control-Allow-Origin: *`로 응답해요.

```jsonc
// 요청
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// 응답
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- 게이트웨이는 `key`, `deviceId`, `userId`, `device.{ua, platform, app}`, `deviceToken`, `help`를 사용하고, `pageId`와 `page`는 참고용이에요. 앱 키와 출처는 WebSocket과 같은 방식으로, 같은 속도 제한을 적용해 확인해요.
- 기기 토큰을 발급받은 기기([§3.5](#35-기기-토큰-재개-토큰-초대))는 여기서도 토큰을 보내야 해요. 그렇지 않으면 호출은 `401 bad_token`으로 실패하고 기기 정보는 아무것도 갱신되지 않아요. 토큰이 없는 기기(오래된 SDK)는 토큰 없이 계속 폴링해요.
- `help: true`는 `hello.help`처럼 기기를 지원 요청 상태로 표시해요. 단, 이미 에이전트가 접속해 있으면 그렇지 않아요.
- 폴링하는 기기는 호출할 때마다 90초 동안 온라인으로 간주돼요.
- `connect: true`는 페이지에 지금 WebSocket을 열라고 알려요. 에이전트가 그 기기에 대해 `connect_device`나 `wait_for_device`를 호출하면 게이트웨이가 이 값을 설정해요.
- 안전장치로, SDK는 다섯 번째 폴링마다 WebSocket도 다시 시도해요.

## 10. 호스트용 JavaScript API

SDK는 `window.RemoteWebviewDebugger`를 노출해요. 페이지는 `run()`을 호출하고, 네이티브 호스트는 SDK를 주입한 뒤 추가 옵션과 함께 `run()`을 호출해요([native-integration.ko.md](native-integration.ko.md) 참고).

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null: 로그인한 사용자. 에이전트와 콘솔에 표시
  helpButton,            // "지원 요청" 버튼 표시(정책의 helpButton과 OR)
  app,                   // 호스트 앱의 { name, version }
  lang,                  // 휴대폰 사용자 UI의 언어 태그. 기본값은 navigator.languages에서(§15)
  locales,               // 추가 언어 팩. messages: 언어별 덮어쓰기(§15)
  theme,                 // 'auto'(기본값) | 'system' | 'light' | 'dark'
  style,                 // 색상, 글꼴, 모서리 반경, z-index, 위치를 --rwd-* CSS 속성으로 지정(sdk/README.ko.md)
  lockScreen,            // 에이전트가 접속한 동안 입력 차단(기본값 true, 사용자가 바꿀 수 있음)
  eruda,                 // true | { dock, load, src, name }: eruda 안의 탭으로 표시
  networkExclude,        // 에이전트가 읽는 내용에서 뺄 요청(§11)
  record,                // 세션 로그 기록(기본값 true, 정책으로 끌 수 있음, §5.4)
  // 네이티브 호스트
  deviceId,              // 설치마다 하나인 ID. 모든 WebView와 도메인이 공유
  deviceToken,           // status().deviceToken의 토큰. 호스트가 보관
  launchId,              // 앱의 이번 실행. 프로세스의 모든 WebView가 공유(§5.4)
  nativeKey,             // 호스트만 아는 비밀 값. nativeControl / nativeDecide를 활성화
  nativeApproval,        // 접속 / 확인 질문을 호스트가 직접 표시
}) // → Promise<{ deviceCode, status }>
```

| 함수 | 설명 |
|---|---|
| `run(gatewayUrl, appKey, options?)` | 페이지를 온라인으로 만들어요. 게이트웨이가 응답하면, 또는 8초 뒤에 그때까지 알게 된 내용으로 resolve돼요. 다시 호출하면 같은 promise를 반환해요 |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`. `status`는 `idle`, `connecting`, `online`, `polling`, `rejected`, `quota`, `stopped` 중 하나예요. `logSession`은 이 페이지가 기록하는 세션 로그이고, 기록하지 않으면 `null`이에요([§5.4](#54-세션-로그)) |
| `help(on = true)` | 지원 요청 또는 요청 취소 |
| `setUser(userId)` | 로그인한 사용자 변경(SDK가 새 `hello`로 다시 연결해요) |
| `stop()` | 연결을 끊고 UI를 제거해요. console과 네트워크 수집은 한도 안에서 계속돼요 |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | 네이티브 호스트 자체의 제어 버튼. 키가 맞지 않으면 `false`를 반환해요 |
| `nativeDecide(nativeKey, requestId, value)` | `status().pending`에 응답해요. `attach`에는 수준 또는 `null`, `confirm`에는 `'allow'` 또는 `null`. 키, 요청, 값이 잘못되면 `false`를 반환해요 |

**실행 ID.** `run({ launchId })` 말고도, 호스트는 SDK가 실행되기 전에 `window.RWDLaunchId`를 정의할 수 있어요. 문자열이거나, 문자열 또는 문자열의 promise를 반환하는 함수예요(최대 300ms 기다림). `[A-Za-z0-9_.:-]` 4–128자여야 하고, 그 밖의 값은 무시되며 SDK가 실행을 직접 추론해요([§5.4](#54-세션-로그)).

`nativeKey`는 주입된 스크립트에만 쓰이고 상수 시간으로 비교돼요. 에이전트의 `evaluate_script`를 포함한 페이지 스크립트는 이 값을 읽을 수 없으므로, 스스로 제어를 되돌려 주거나 자기 자신을 승인할 수 없어요.

**네이티브 스크린샷 브리지.** 호스트가 다음 중 하나를 등록하면 `rwd.screenshot`은 이를 사용해 실제 픽셀(video, canvas, 교차 출처 이미지, 네이티브 오버레이 포함)을 얻어요. 각 브리지는 보이는 WebView의 PNG 또는 JPEG data URL이나 순수 base64를 반환해요.

| 브리지 | 플랫폼 |
|---|---|
| `window.RWDNativeScreenshot()` | 모든 호스트. `string` 또는 `Promise<string>`을 반환 |
| `webkit.messageHandlers.rwdScreenshot` | iOS / macOS `WKWebView`. `WKScriptMessageHandlerWithReply`로 등록하며 `{type:"screenshot"}`을 받음 |
| `window.RWDAndroid.screenshot()` | Android, `@JavascriptInterface` 메서드 |

참고 구현: [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift).

## 11. 프로젝트 정책

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt: 접속할 때마다 사용자가 기기에서 승인(기본값 prompt)
  maxLevel: Level                  // 이 프로젝트의 최고 수준(기본값 interact)
  maskSelectors: string[]          // 추가로 마스킹할 CSS 선택자(비밀번호 입력란과 [data-rwd-mask] 외에)
  maskPatterns: { name: string; regex: string }[]  // 마스킹할 텍스트 패턴. 예: 전화번호, 신분증 번호(JavaScript 정규식)
  confirmSelectors: string[]       // 클릭하려면 사용자의 허락이 필요한 요소([data-rwd-confirm] 외에)
  networkExclude: string[]         // 에이전트가 읽는 내용에서 뺄 요청(§5.2)
  sessionLog: boolean              // 페이지가 세션 로그를 기록(기본값 true, §5.4)
  helpButton: 'off' | 'all' | 'listed'   // "지원 요청" 버튼을 볼 수 있는 대상(기본값 off)
  helpUsers: string[]              // helpButton = listed일 때의 userId 목록
  agentIdleMinutes: number         // 이만큼 활동이 없으면 agent → observe(기본값 2, 최대 120)
  attachMaxMinutes: number         // 접속은 이 시간이 지나면 종료(기본값 60, 최대 1440)
  maxOnlineDevices: number         // 0 = 무제한. 넘으면 새 기기는 4429로 닫힘
  maxAgents: number                // 이 프로젝트의 기기에 동시에 접속할 수 있는 에이전트 수. 0 = 무제한
  eruda: { dock: boolean; load: boolean }  // run({ eruda })의 원격 기본값. 로컬 옵션이 필드 단위로 우선.
                                           // welcome.config에서는 null이거나 없을 수 있음(= 둘 다 false), §3.4
  devtools: 'on' | 'off'          // 관리자가 콘솔에서 이 프로젝트의 페이지에 DevTools를 열 수 있음(기본값 on, §17)
}
```

- 값은 저장할 때 정규화돼요. `none`이 아닌 `approval`은 `prompt`가 되고, 유효하지 않은 `maxLevel`은 `interact`가 되며, 숫자는 범위 안으로 조정돼요. `maskPatterns`는 컴파일할 수 있어야 하고, 그렇지 않으면 `400 bad_policy`예요. `maskSelectors`, `confirmSelectors`, `networkExclude`, `helpUsers`는 빈 항목을 제거하고 각각 50개에서, `maskPatterns`는 20개에서 잘라요.
- **`networkExclude`**는 에이전트가 굳이 헤치고 지나갈 필요가 없는 잡음이에요. 항상 404가 나는 글꼴이나 분석용 비콘 같은 것들이죠. 각 규칙은 요청 URL에 대해 대소문자를 구분하지 않는 부분 문자열로, `*` 와일드카드 패턴(`*/404/*`)으로, 또는 `/…/`로 쓰면 정규식으로(플래그는 선택, 기본값 `i`) 비교해요. 컴파일되지 않는 규칙은 아무것과도 일치하지 않아요. 일치하는 요청은 네트워크 목록과 `net_fail` 타임라인 이벤트에서 빠지지만, 페이지는 여전히 기록하므로 에이전트가 `includeExcluded`로 요청할 수 있어요([§5.2](#52-메서드), [§14.3](#143-도구)). 이 규칙은 편의 기능이지 개인정보 보호 수단이 아니에요. 페이지 밖으로 나가면 안 되는 데이터에는 `maskSelectors` / `maskPatterns`를 쓰세요.
- **`sessionLog`**는 `false`로 설정하지 않는 한 켜져 있어요. 이 필드가 생기기 전에 저장된 프로젝트도 마찬가지예요. 끄면 프로젝트의 모든 페이지가 기록을 멈추고, 그 기기들에 해당 출처로 이미 보관된 로그도 삭제돼요. 페이지 하나만 따로 빠지려면 `run({ record: false })`를 쓰면 돼요([§5.4](#54-세션-로그)).
- 마스킹, 확인, 네트워크 제외, 세션 로그, 지원 요청, eruda 필드는 `welcome.config`로 페이지에 전달돼요([§3.4](#34-welcome)). 페이지 자체의 `run({ networkExclude })` 규칙은 프로젝트의 규칙에 더해져요.
- **한 기기의 여러 프로젝트.** 기기는 프로젝트가 아니라 `deviceId`로 식별돼요. 같은 휴대폰에서 서로 다른 앱 키로 로드된 페이지들은 한 기기의 페이지예요. 에이전트가 접속하면 게이트웨이는 연결된 페이지들의 프로젝트 정책을 병합하면서 가장 엄격한 값을 택해요. 어느 한 프로젝트라도 요구하면 `prompt`, 가장 작은 `maxLevel`, `agentIdleMinutes`, `attachMaxMinutes`, 그리고 0이 아닌 값 중 가장 작은 `maxAgents`예요.

## 12. 콘솔 REST API

### 12.1 규칙

- 기본 경로는 `/v1/api`예요. `POST /auth/login`으로 로그인하고, 세션은 HttpOnly 쿠키 `rwd_session`이에요(12시간, `SameSite=Lax`, HTTPS에서는 `Secure`). 계정 정보는 요청마다 다시 읽으므로, 멤버를 비활성화하거나 삭제하면 즉시 적용돼요.
- 세션이 필요한 엔드포인트에 `GET` / `HEAD`가 아닌 요청을 보낼 때는 `X-RWD-CSRF: 1`이 있어야 하고, 없으면 `403 csrf`예요.
- 오류는 4xx/5xx 상태와 함께 `{"error":{"code":"…","message":"…"}}` 형식으로 와요. 메시지는 요청의 언어를 따라요([§15](#15-언어)).
- 자주 쓰는 코드: `401 unauthorized`(로그인하지 않음), `403 forbidden`(역할 권한 부족), `403 csrf`, `404 not_found`, `400 bad_request`, `429 rate_limited`, `500 internal`.

역할: `owner`(멤버 관리를 포함한 모든 것), `admin`(프로젝트, 모든 사람의 API 키, 정책, 기기, 초대, 감사, 운영 현황), `member`(프로젝트와 기기 읽기, 연결 테스트, 세션 종료, 기기 초대 생성, 자기 API 키 생성과 폐기, 감사 로그 읽기). 아래 표에서 *member*는 로그인한 모든 계정을 뜻해요.

### 12.2 계정과 멤버

| 메서드 | 경로 | 역할 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}`와 쿠키. `401 bad_password`, IP당 분당 10회 시도 후에는 `429 rate_limited`. `email`이 비어 있으면 `admin`으로 간주 |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`. 새 비밀번호는 8–256자여야 해요. 기존 비밀번호가 틀리면 `400 bad_password` |
| GET | `/auth/oidc/start?redirect=/path` | — | — | `302`로 SSO 공급자에게 보내고, 서명된 쿠키 `rwd_oidc`(state와 PKCE verifier, 10분)를 설정해요. SSO가 꺼져 있으면 `404` |
| GET | `/auth/oidc/callback` | — | 공급자가 보낸 `code`와 `state` | 로그인한 뒤 `redirect`(콘솔 경로, 아니면 `/`)로 `302`. 실패하면 `/login?sso_error=<code>`로 `302`: `provider`, `denied`, `state`, `not_allowed`, `no_account`, `conflict`(그 이메일의 멤버가 공급자의 다른 ID와 연결되어 있음), `disabled`, `rate_limited` |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity","sso"}`. `sso`는 `null`이거나, SSO가 켜져 있으면 `{"provider","name","defaultRole","inviteOnly"}` |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<host>/invite/<token>"}`(7일 동안 한 번 유효). 이메일이 이미 있으면 `409 conflict` |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`. 활성 소유자가 한 명도 남지 않게 되면 `409 last_owner` |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`. `409 self`, `409 last_owner` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}`, 그리고 로그인돼요. 로그인과 같은 속도 제한 적용 |

첫 소유자는 게이트웨이가 시작할 때 `RWD_ADMIN_EMAIL`(기본값 `admin`)과 `RWD_ADMIN_PASSWORD`로 만들어져요([gateway/README.ko.md](../gateway/README.ko.md) 참고). 콘솔 페이지 `/invite/:token`에서 멤버 초대를 수락해요.

Feishu, Lark 또는 OpenID Connect 공급자를 통한 SSO 로그인(`RWD_OIDC_*`, [gateway/README.ko.md](../gateway/README.ko.md#sso-로그인) 참고)은 비밀번호와 함께 쓸 수 있어요. 로그인 페이지의 버튼은 `/auth/oidc/start`를 열고, 공급자는 브라우저를 `/auth/oidc/callback`으로 돌려보내며, 여기서 같은 `rwd_session` 쿠키가 설정돼요. ID는 먼저 공급자의 subject로 찾고, 없으면 같은 이메일의 멤버와 연결하며(대기 중인 초대도 이때 수락돼요), 그것도 없으면 기본 역할로 새 계정을 만들어요. 단, 게이트웨이가 초대 전용이면 만들지 않아요. 이렇게 만든 계정도 일반 멤버라서, 소유자가 위와 같이 역할을 바꾸거나 비활성화하거나 삭제할 수 있어요.

### 12.3 프로젝트

| 메서드 | 경로 | 역할 | 요청 | 응답 |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project`(기본 정책 포함) |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`. `policy`는 현재 정책에 병합돼요 |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | 새 앱 키가 담긴 `Project` |
| GET | `/projects/:id/integration` | member | — | `Integration` |

`allowedOrigins` 항목은 `https://m.example.com` 같은 전체 출처이고, 맨 앞 라벨 하나에만 와일드카드를 쓸 수 있어요. `https://*.example.com`은 모든 하위 도메인과 일치하지만 `https://example.com` 자체와는 일치하지 않아요. 비어 있으면 모든 출처를 허용해요. `inviteUrl`은 `http(s)` URL이어야 해요.

### 12.4 API 키

API 키는 프로젝트가 아니라 키를 만든 멤버에게 속해요. 키 하나로 모든 기기에 접근할 수 있어요. 소유자가 없는 키(키에 소유자가 생기기 전에 만든 키와 데모 키)는 *게이트웨이 키*로, owner와 admin만 보고 폐기할 수 있어요.

| 메서드 | 경로 | 역할 | 요청 | 응답 |
|---|---|---|---|---|
| GET | `/keys?mine=1` | member | — | `{"keys":[ApiKey]}`: owner와 admin은 모든 키를, member는 자기 키만 받아요. `mine=1`이면 역할과 관계없이 호출한 사람의 키만 돌려줘요 |
| POST | `/keys` | member | `{"name","maxLevel"?:"interact","expiresInDays"?:0,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}`: 전체 키를 돌려받는 유일한 순간이에요. 키는 호출한 사람의 것이 되고, `maxLevel`이 호출한 사람의 역할이 허용하는 레벨보다 높으면 `403 forbidden` |
| DELETE | `/keys/:id` | member | — | `{"ok":true}`. member는 자기 키만 폐기할 수 있고(다른 사람의 키는 `404 not_found`), owner와 admin은 어떤 키든 폐기할 수 있어요. 폐기는 즉시 적용돼요. 그 키의 에이전트는 접속이 해제되고, 다음 MCP 요청은 401을 받아요 |

`expiresInDays: 0`은 만료 없음이에요. `ipAllowlist`에는 IP나 CIDR을 넣어요. 설정하면 다른 주소에서 온 MCP 요청은 401을 받아요. `GET` / `POST /projects/:id/keys`는 `/keys`의 예전 별칭이에요.

역할별 레벨: owner와 admin은 `advanced`까지, member는 `interact`까지 키를 만들 수 있어요. `advanced`(페이지 JavaScript, 저장소, 요청 본문 전체)는 DevTools 열기(§17)만큼 강한 권한인데, DevTools는 관리자용이기 때문이에요. 이 상한은 키를 쓸 때마다 적용되므로, 더 낮은 역할로 바뀐 소유자의 키는 새 역할의 레벨까지만 동작해요(§6).

키는 소유자가 로그인할 수 있는 동안에만 동작해요. 멤버를 비활성화하면 그 멤버의 키가 멈추고(MCP 요청은 401, `ApiKey.ownerDisabled`는 `true`) 에이전트 접속이 해제돼요. 다시 활성화하면 키도 다시 동작해요. 멤버를 삭제하면 그 멤버의 키가 폐기돼요. 멤버의 역할을 낮추면 새 역할의 레벨을 넘는 키의 에이전트 접속이 해제돼요.

### 12.5 기기와 게이트웨이 상태

| 메서드 | 경로 | 역할 | 응답 |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}`(`pageSize` ≤ 100). `online`(기본값): 온라인 기기, 가장 최근에 연결된 순. `all`: 알려진 모든 기기, 최신순. 두 모드 모두 `q`는 기기 ID, 기기 코드(대시는 생략 가능), userId, 사용자 에이전트, 시스템 라벨(어느 언어로든), 프로젝트 이름과 비교해요 |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}`: 최신 페이지가 이 프로젝트에서 온 기기(기본값 `all`, 최대 500대)를 지원을 요청한 기기, 온라인 기기, 가장 최근에 본 기기 순으로 반환해요. `waiting`은 지원을 요청한 상태(화면에는 “지원 중”으로 표시)를 뜻해요 |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | 항상 `200`: `{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<first 4000 characters>","error"?:{"code","message"}}`. 코드: `device_offline`, `no_page`(페이지가 다시 연결 중), `timeout`, `takeover`, `internal`, 그리고 [§5.1](#51-엔벨로프)의 RPC 코드 |
| POST | `/devices/:id/end` | member | `{"ok":true}`: 에이전트 접속을 해제하고, 지원 요청을 해제하고, 제어 상태를 `none`으로 되돌리고, DevTools 창을 모두 닫아요([§17](#17-사람을-위한-devtools)) |
| POST | `/devices/:id/devtools` | admin | `{"page"?:"p1"}` → `{"ticket","session","page":Page,"frontendUrl"}`; 사용자를 최대 30초 기다릴 수 있어요([§17.1](#171-창-열기)) |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |
| GET | `/insights?tz=<minutes>&days=14` | admin | `Insights`([§12.8](#128-타입)): 게이트웨이의 현재 부하와 지금까지 처리한 디버깅 양. 콘솔의 **운영 현황** 페이지가 사용해요. member는 `403 forbidden` |

`tz`는 브라우저의 `Date.getTimezoneOffset()`(UTC+8이면 `-480`)이라서 '오늘'과 일별 시계열은 보는 사람의 시간대를 따라요. `days`는 1–90(기본 14)이에요. 디버깅 1회는 기기에서 시작된 에이전트 세션(감사 `attach.start`)이나 페이지에서 열린 DevTools 창(`devtools.open`) 중 성공한 것이고, 기기는 기기 코드로 셉니다. 세션은 별도 테이블에 남고 감사 보존 기간([§12.7](#127-감사-로그))에 지워지지 않으므로 합계는 전체 기간 값이에요. 업그레이드 후 처음 시작할 때 아직 남아 있는 감사 이벤트로 한 번 채워 넣어요.

### 12.6 기기 초대

초대를 쓰면 사용자는 링크를 여는 것만으로 이미 지원 요청 상태인 기기를 온라인으로 만들 수 있어요. 누군가가 기기 코드를 불러 줄 필요가 없어요.

| 메서드 | 경로 | 역할 | 요청 | 응답 |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}`(`link`는 토큰을 뺀 대상 URL이에요. 토큰은 저장하지 않아요) |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | 전체 `link`(`<url>?rwd_invite=<token>`)가 담긴 `DeviceInvite` |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url`의 기본값은 프로젝트의 `inviteUrl`이고, 둘 중 하나는 반드시 있어야 해요. `expiresInMinutes`의 상한은 7일이에요. 링크의 페이지는 같은 프로젝트의 앱 키로 SDK를 로드해야 해요([§3.5](#35-기기-토큰-재개-토큰-초대)).

### 12.7 감사 로그

`GET /audit?project=&device=<device code>&actor=&action=&from=&to=&limit=50&before=<id>`(member) → `{"events":[AuditEvent],"nextBefore":<id>|null}`, 최신순. `limit` ≤ 200이고, `action`은 접두사로 비교하며(`attach.`는 모든 접속 이벤트와 일치), `actor`는 행위자 ID나 이름과 비교해요.

| 동작 | 시점 |
|---|---|
| `auth.login`, `auth.login_failed` | 콘솔 로그인 |
| `member.invite`, `member.accept`, `member.sso_join`, `member.update`, `member.delete` | 멤버 관리 (`member.sso_join`: 첫 SSO 로그인 때 만들어진 계정. SSO로 로그인하면 `auth.login`에 `"method":"sso"`가 들어가요) |
| `project.create`, `project.update`, `project.delete`, `project.rotate_app_key` | 프로젝트 |
| `key.create`, `key.revoke` | API 키. `detail.owner`는 키 소유자의 이메일(게이트웨이 키에는 없음) |
| `invite.create`, `invite.delete`, `invite.use` | 기기 초대 |
| `attach.request`, `attach.approve`, `attach.deny`, `attach.timeout`, `attach.resume`, `attach.start`, `attach.end` | 에이전트 접속. `attach.resume`은 키가 다시 묻지 않고 유예 시간 안에 돌아왔다는 뜻이에요([§7](#7-접속-승인)). `detail: {level}` |
| `rpc` | 에이전트의 모든 페이지 RPC. `detail: {method, page, latencyMs, error?, owner?}` |
| `control.takeover`, `control.handback`, `control.end` | 사용자의 버튼 |
| `device.end` | 콘솔 멤버가 세션을 종료함 |
| `policy.denied` | 부여된 수준을 넘는 호출이 거부됨 |
| `devtools.request`, `devtools.approve`, `devtools.deny`, `devtools.timeout`, `devtools.open`, `devtools.close` | DevTools 창([§17](#17-사람을-위한-devtools)); `close`에는 `detail: {page, durationSec, reason}`이 있어요 |

에이전트의 이벤트(`attach.*`, `rpc`, `policy.denied`)는 게이트웨이 키가 아니면 `detail.owner`에 키 소유자의 이메일을 남겨요. 이벤트에는 페이지 내용이나 매개변수 값이 절대 들어가지 않아요. 기본적으로 180일 동안 보관해요(`RWD_AUDIT_RETENTION_DAYS`).

### 12.8 타입

```ts
type Project = {
  id: string; name: string; appKey: string; allowedOrigins: string[]; disabled: boolean
  createdAt: number; policy: Policy; inviteUrl: string
  onlineDevices: number; totalDevices: number
}

type ApiKey = {
  id: string; name: string; prefix: string /* rwd_sk_live_ab12 */
  maxLevel: Level; expiresAt: number | null; ipAllowlist: string[]
  createdAt: number; lastUsedAt: number | null; revokedAt: number | null
  ownerId: string | null       // 키를 만든 멤버. 게이트웨이 키는 null
  ownerName: string; ownerEmail: string  // 게이트웨이 키와 삭제된 멤버는 ""
  ownerDisabled?: true         // 소유자가 비활성화되어 키가 동작하지 않음
}

type Integration = {
  appKey: string; gatewayUrl: string; sdkUrl: string
  firstSeenAt: number | null; onlineDevices: number; lastDevice: Device | null
}

type Device = {
  id: string /* deviceId */; code: string
  projectId: string            // 최신 페이지의 프로젝트
  projects: string[]           // 연결된 페이지들의 프로젝트
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* 온라인이 된 시각. 온라인인 동안에만 */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; purpose?: 'devtools'; expiresAt: number } | null
  devtools: { id: string; member: string; page: string /* label */; since: number }[]  // 열린 DevTools 창 (§17)
  task?: Task                  // 접속한 에이전트가 작업을 설정한 동안에만
  pages: number                // 연결된 페이지 수
  sdk: string                  // 페이지가 보고한 SDK 버전
  currentPage: { label: string; url: string; title: string } | null  // 사용자가 보고 있을 가능성이 가장 높은 페이지
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // GET /devices에서만
}

type SystemInfo = {            // 사용자 에이전트에서 파싱
  os: string; osVersion: string; model: string; browser: string
  label: string                // 예: "iOS 18.0 · iPhone · WebView", "Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // 사용자가 보고 있을 가능성이 가장 높은 페이지
  selected: boolean            // 에이전트가 작업하는 페이지
  openerLabel: string | null; connectedAt: number
  connected: boolean           // 다시 연결하는 동안에는 false
  connectedSince: number       // 현재 연결이 시작된 시각(새로고침마다 갱신됨)
}

type TimelineEvent = { at: number; page: string /* 라벨. 기기 전체 이벤트는 "" */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // 개수 대신 목록
  timeline: TimelineEvent[]    // 최근 100개, 오래된 순
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* 초대를 아직 수락하지 않음 */
  createdAt: number; lastLoginAt: number | null
  hasPassword: boolean         // SSO로 만든 계정은 false
  sso: string[]                // 연결된 공급자: "feishu", "lark", "oidc"
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* 기기 코드, 키 prefix, 멤버 이메일… */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}

type Insights = {              // GET /insights (§12.5)
  serverTime: number
  runtime: {                   // 게이트웨이 프로세스
    goroutines: number; heapBytes: number; sysBytes: number; gcCount: number
    cpus: number; uptimeSec: number; os: string /* linux/amd64 */
    cpuPercent?: number        // 이전 요청 이후의 프로세스 CPU, 100 = 코어 1개. 지원하지 않는 환경에서는 없음
    load?: number[]            // 호스트의 1·5·15분 부하(Linux)
    memTotalBytes?: number; memAvailableBytes?: number  // 호스트 메모리(Linux)
  }
  live: {
    wsConnections: number; connectedPages: number; onlineDevices: number
    attachedAgents: number; helpDevices: number; pendingApprovals: number
  }
  debug: {                     // 디버깅 횟수
    total: number; totalAgent: number; totalDevtools: number
    today: number; todayAgent: number; todayDevtools: number
    devices: number; devicesToday: number  // 디버깅된 서로 다른 기기 수: 전체 / 오늘
    days: { day: number /* 로컬 시간 기준 epoch 이후 일수 */; agent: number; devtools: number }[]  // 오래된 순, 0인 날 포함
  }
}
```

### 12.9 타임라인 이벤트

각 기기는 최근 타임라인 이벤트 300개를 메모리에 보관해요. 콘솔은 최근 100개를, MCP는 기본적으로 최근 50개를 보여 줘요.

| `kind` | 의미 |
|---|---|
| `opened` / `closed` | 페이지가 처음 연결됨 / 유예 시간이 지나 사라짐([§3.1](#31-수명-주기)) |
| `navigated` / `reloaded` | 페이지가 새 URL로 이동함 / 같은 URL에서 다시 연결됨 |
| `focus` | 페이지가 포그라운드로 옴 |
| `error` / `console_error` / `net_fail` / `user_tap` | 페이지가 보고한 이벤트([§3.2](#32-페이지--게이트웨이)) |
| `help` | 사용자가 지원을 요청했거나 요청을 취소함, 또는 초대를 통해 들어옴 |
| `agent` | 접속 요청, 거부, 시간 초과, 접속, 작업 변경 |
| `control` | 제어 상태 변경. 요약에 이유가 나와요(사용자가 직접 조작으로 전환, AI 유휴, 사용자가 종료 등) |
| `offline` | 에이전트가 접속해 있는 동안 기기의 마지막 페이지가 사라짐 |
| `devtools` | DevTools 요청, 승인과 거부, 창 열림과 닫힘, 승인 철회([§17](#17-사람을-위한-devtools)) |

## 13. 실시간 업데이트(SSE)

`GET /v1/api/stream[?project=<id>][&lang=<tag>]`(member, 쿠키 인증)는 `text/event-stream`을 스트리밍해요.

```
retry: 3000

event: device     data: Device                               기기가 바뀜(온라인, 지원 요청, 제어, 승인, 작업…)
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   25초마다
```

`project`가 없으면 모든 프로젝트의 이벤트를 스트리밍해요. `EventSource`는 헤더를 설정할 수 없으므로 언어는 `?lang=`으로 전달해요. 느린 구독자는 게이트웨이를 붙잡는 대신 이벤트를 놓쳐요. 콘솔은 다시 연결할 때 데이터를 새로 가져오고, 스트림이 실패하면 폴링으로 전환해요.

## 14. MCP

### 14.1 세션

- 엔드포인트는 `/v1/mcp`(Streamable HTTP)예요. 모든 요청에는 `Authorization: Bearer <API key>`가 있어야 해요. 키는 요청마다 확인하므로, 폐기되었거나 만료된 키, 또는 `ipAllowlist` 밖의 주소는 즉시 401을 받아요.
- 게이트웨이는 API 키마다 에이전트 상태 하나(접속한 기기와 선택된 페이지)를 보관해요. 같은 키를 쓰는 MCP 세션들은 이 상태를 공유해요. 에이전트는 한 번에 최대 한 기기에만 접속할 수 있고, 다른 기기에 접속하면 처음 기기에서는 접속이 해제돼요. 키 하나로 게이트웨이의 모든 기기에 접근할 수 있어요.
- 한 키로 기기 조회에 분당 5번 넘게 실패하면 그 1분의 남은 시간 동안 거부돼요. 이렇게 해서 기기 코드를 추측하지 못하게 막아요.

### 14.2 결과

모든 도구 결과의 끝에는 에이전트의 이전 호출 이후 기기에서 바뀐 내용이 붙어요(최대 20줄). 그래서 에이전트는 폴링하지 않고도 새 페이지, 페이지 이동, 오류, 직접 조작 전환을 알아차릴 수 있어요.

```
[Session changes]
- p3 "Checkout" opened (opened by p2)
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- The user took over
```

페이지에서 온 내용(스냅샷, console, 네트워크, 저장소, evaluate 결과, 타임라인)은 태그로 감싸고 신뢰할 수 없는 데이터라고 표시해요. 그래서 에이전트는 그 안에 적힌 지시를 따르지 않아요.

### 14.3 도구

| 도구 | 수준 | 매개변수 | 설명 |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all`(기본값 `online`), `userId?`, `deviceCode?`(대소문자 무관, 하이픈 유무 무관) | 최대 50대의 기기. 지원을 요청한 기기가 먼저 |
| `connect_device` | — | `device`(기기 코드 또는 deviceId), `level?: Level`(기본값 `interact`), `follow?: true` | 접속해요. 필요하면 먼저 사용자에게 물어봐요([§7](#7-접속-승인)). 에이전트가 스스로 기기를 놓은 지 10분 안이면 같은 키는 다시 묻지 않고, 그때 허용된 수준을 넘지 않는 선에서 돌아와요. 포그라운드 페이지를 선택해요. 기기에 연결된 페이지가 없으면 실패해요(폴링 중인 기기에는 다시 연결하라고 알려요) |
| `disconnect_device` | — | — | 접속 해제 |
| `wait_for_device` | — | `device`, `timeoutSec?: 60`(최대 300) | 기기에 연결된 페이지가 생길 때까지 기다려요. 폴링 중인 기기에는 다시 연결하라고 알려요 |
| `list_pages` | — | — | 기기의 페이지: 라벨, 제목, URL, 선택 여부, 포그라운드 / 백그라운드, 재연결 중 여부, 연 페이지 |
| `select_page` | — | `page`(라벨) | 선택된 페이지 변경 |
| `take_snapshot` | observe | `page?` | ref가 포함된 접근성 스냅샷, 그리고 페이지 위에 떠 있는 오버레이와 그 ref([§5.3](#53-페이지-안에서의-동작)) |
| `find_elements` | observe | `text?`, `role?`, `name?`, `limit?`, `page?` | 전체 스냅샷 없이 요소와 ref 찾기(`rwd.query`) |
| `take_screenshot` | observe | `page?`, `fullPage?`, `format?: jpeg\|png` | 이미지를 반환 |
| `wait_for` | observe | `text?`, `textGone?`, `timeSec?`(최대 30) | 선택된 페이지에서 기다림 |
| `list_console_messages` | observe | `scope?: page\|session`, `types?`, `limit?: 50` | `session`은 연결된 모든 페이지를 합치고 각 줄에 페이지를 표시해요 |
| `list_network_requests` | observe | `scope?`, `failedOnly?`, `limit?: 50`, `exclude?`, `includeExcluded?` | 위와 같아요. ID는 `<label>:<id>` 형식으로 나와요. `exclude`는 프로젝트와 페이지의 규칙([§11](#11-프로젝트-정책))에 더해 이번 호출에만 적용할 규칙을 추가해요. 규칙이 무언가를 숨겼다면 결과 끝에 *N requests hidden by the exclude rules*가 붙고, `includeExcluded: true`이면 숨겨진 요청도 보여 줘요 |
| `click` / `hover` | interact | `ref` | 오버레이에 막힌 클릭은 `not_interactable`로 실패하고 가리는 요소의 `ref`를 알려 줘요. 대신 그 요소를 클릭할 수 있어요([§5.3](#53-페이지-안에서의-동작)) |
| `fill` | interact | `ref`, `value` | |
| `type_text` | interact | `text`, `ref?`, `submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`, `values` | |
| `scroll` | interact | `ref?`, `dx?`, `dy?`(기본값 `dy: 600`) | |
| `drag` | interact | `fromRef`, `toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]`(1–30), `stopOnError?: true` | `click`, `fill`, `type_text`, `press_key`, `select_option`, `hover`, `scroll`, `wait_for`를 순서대로 실행하고, 전체에 대해 결과 하나를 반환해요 |
| `get_network_request` | advanced | `id`(목록의 `<label>:<id>`, 또는 선택된 페이지라면 ID만) | 헤더와 본문 |
| `get_storage` | advanced | `area: local\|session\|cookie`, `page?` | |
| `evaluate_script` | advanced | `function`, `args?`, `page?` | 페이지에서 JavaScript 실행. 20,000자가 넘는 결과는 잘려요 |
| `get_session_timeline` | — | `limit?: 50` | 여러 페이지를 아우르는 기기의 타임라인 |
| `get_session_overview` | observe | `session?` | 현재 실행의 세션 로그 개요([§5.4](#54-세션-로그)): 시작 시각, 저장된 양, 기록 수, 방문한 페이지, 최근 오류와 실패한 요청 20개, 그리고 이번 실행 외에 아직 보관 중인 실행들 |
| `get_session_log` | observe | `session?`, `kinds?`, `problems?`, `page?`, `text?`, `after?`, `limit?`, `seq?`, `exclude?`, `includeExcluded?` | 세션 로그를 기록 단위로 `#<seq> <time> <page> <line>` 형식으로 보여 줘요. `page`에는 `p2` 같은 라벨이나 로그에 찍힌 페이지 ID를 넣어요. `after`는 이전 결과가 끝난 `seq`부터 다음 페이지를 읽어요. `seq`를 주면 대신 그 기록 하나를 전부 보여 줘요(헤더와 본문 포함. `rwd.logDetail`을 호출하므로 `advanced`가 필요해요) |
| `wait_for_page` | — | `urlContains?`, `titleContains?`, `timeoutSec?: 30`(최대 300) | 이전 호출 이후 열리거나 이동한 페이지를 기다려요 |
| `wait_for_event` | — | `kind?`([§12.9](#129-타임라인-이벤트)), `page?`, `timeoutSec?: 30`(최대 300) | 조건에 맞는 다음 타임라인 이벤트를 기다려요 |
| `wait_for_control` | — | `timeoutSec?: 120`(최대 600) | 사용자가 직접 조작으로 전환한 뒤, 다시 AI에 맡길 때까지(또는 종료할 때까지) 기다려요 |
| `set_task` | — | `title`(≤ 24자), `steps?`(≤ 12개, 각 ≤ 28자), `current?` | 에이전트의 작업과 계획을 기기의 모든 페이지 상단에 표시해요. `current`는 진행 중인 단계이고, `current = steps.length`이면 완료예요. 페이지는 이를 `task`로 받고([§3.3](#33-게이트웨이--페이지)), 에이전트가 떠나면 지워져요 |

`page?`는 선택을 바꾸지 않고 다른 페이지(라벨로 지정)에서 호출 한 번만 실행해요. 접속 수준을 넘는 도구는 "Requires advanced access; this session was granted interact"로 실패하고, `policy.denied`로 감사 로그에 남아요.

**따라가기 모드.** `follow: true`(기본값)이면, 에이전트의 동작으로 새 페이지가 열릴 때, 사용자가 다른 페이지를 포그라운드로 가져올 때, 또는 선택된 페이지가 1.5초 동안 사라져 있을 때 선택된 페이지가 자동으로 옮겨지고 결과에 그 사실이 표시돼요. 오래된 페이지로 정리된 선택 페이지([§3.1](#31-수명-주기))는 `follow` 값과 상관없이 같은 URL을 보여 주는 페이지로 대체돼요. 이전 항목이 이미 사라졌기 때문이에요.

### 14.4 로컬 stdio 브리지

stdio만 지원하는 MCP 클라이언트용이에요.

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

호스팅된 `/v1/mcp`로 stdio를 중계해요. `--gateway`는 `RWD_GATEWAY`로도 지정할 수 있어요.

## 15. 언어

지원 언어: 영어(`en`), 중국어 간체(`zh`), 중국어 번체(`zh-TW`), 프랑스어(`fr`), 스페인어(`es`), 러시아어(`ru`), 아랍어(`ar`, 오른쪽에서 왼쪽), 일본어(`ja`), 한국어(`ko`), 독일어(`de`), 포르투갈어(`pt`). 어떤 BCP 47 태그든 받아서 가장 가까운 언어로 대응시켜요. `en-US` → `en`, `zh-CN`, `zh_CN`, `zh-Hans` → `zh`, `zh-HK`, `zh-MO`, `zh-Hant` → `zh-TW`, `fr-CA` → `fr`, `pt-BR`, `pt-PT` → `pt`. `Accept-Language`에서는 지원 언어 중 가중치가 가장 높은 것을 골라요.

| 대상 | 내용 | 결정 방법 |
|---|---|---|
| 에이전트 | MCP 서버 instructions, 도구와 매개변수 설명, 도구 결과, `[Session changes]`, 오류 | 게이트웨이의 `RWD_LANG` / `--lang`(기본값 `en`) |
| 에이전트(페이지에서) | SDK가 작성하는 RPC 오류 메시지와 이벤트 요약 | 게이트웨이의 언어를 담은 `welcome.agentLang`. SDK는 마지막 값을 localStorage `rwd:alang`에 보관해 다음 `welcome` 전에 생긴 이벤트에 쓰고, 값을 받기 전까지는 영어를 써요 |
| 콘솔 | REST와 SSE 응답의 오류 메시지, 타임라인 요약, 시스템 라벨 | 요청의 `?lang=`, 그다음 `Accept-Language`, 그다음 게이트웨이의 언어 |
| 휴대폰 사용자 | SDK의 배지, 바, 대화 상자, 알림 | `run({ lang })`, 없으면 `navigator.languages` 중 SDK에 언어 팩이 있는(내장되었거나 페이지가 등록한) 첫 번째 언어, 그것도 없으면 영어. `en`과 `zh` 외의 언어 팩은 `sdk.js` 옆의 `locales/<id>.js`나 게이트웨이(`/v1/locales/<id>.js`)에서 필요할 때 불러와요 |

그래서 중국어를 쓰는 사용자도 영어로 동작하는 에이전트와 함께 작업할 수 있어요. 대화 상자에는 *AI 想要点击「提交订单」，允许吗？*가 표시되고, 사용자가 거부하면 에이전트는 *The user denied this action*을 받아요.

## 16. 운영

- **메트릭.** `GET /v1/metrics`는 Prometheus 텍스트를 반환해요. `RWD_METRICS_TOKEN`을 설정하면 `Authorization: Bearer <token>`이 필요해요. 시리즈: `rwd_online_devices{project}`, `rwd_connected_pages`, `rwd_attached_agents`, `rwd_ws_connections`, `rwd_rpc_total{method,result}`, `rwd_rpc_duration_seconds{method}`(히스토그램), `rwd_http_requests_total{code}`.
- **SDK 버전.** 캐시에 쓰는 SDK 버전은 게이트웨이에 내장된 `sdk.js`의 SHA-256 앞 16진수 12자예요. 그래서 파일이 바뀔 때마다 `/v1/sdk/<version>/sdk.js`도 바뀌어요. `GET /v1/api/config`는 이 값을 `sdkVersion`으로, `sdkIntegrity`(`sha384-…`, `integrity` 속성용)와 함께 반환해요. 콘솔은 이 버전을 고정한 스니펫을 제공해요.
- **데이터베이스.** `RWD_DATABASE_URL=postgres://…`(또는 `postgresql://`)이면 Postgres를 써요. 그렇지 않으면 `RWD_DATA`(기본값 `rwd.db`)가 SQLite 파일이에요. 스키마는 시작할 때 만들어지고 마이그레이션돼요.
- **속도 제한.** 콘솔 로그인과 초대 수락: 클라이언트 IP당 분당 10회. SSO 시작과 콜백: 클라이언트 IP당 분당 60회. 페이지 연결과 프레즌스 호출: 클라이언트 IP당 분당 120회. 클라이언트 IP는 `--trust-proxy`가 있을 때만 `X-Forwarded-For`에서 가져와요. 같은 스위치가 `X-Forwarded-Proto`와 `X-Forwarded-Host`도 다루는데, 이 둘은 세션 쿠키에 `Secure`를 붙일지, 그리고 `--public-url`이 설정되지 않았을 때 추론하는 `gatewayUrl`의 스킴과 호스트를 결정해요.
- **감사 로그 보관.** `RWD_AUDIT_RETENTION_DAYS`(기본값 180). 오래된 이벤트는 6시간마다 삭제돼요.

모든 게이트웨이 설정은 [gateway/README.ko.md](../gateway/README.ko.md)에 정리되어 있어요.

## 17. 사람을 위한 DevTools

소유자와 관리자는 콘솔에서 기기의 온라인 페이지 어디서든 **Chrome DevTools**를 열 수 있어요: Elements(스타일, 박스 모델, 기기에서의 강조 표시), Console(실시간, 객체 조사와 스크립트 실행 포함), Network(응답 본문 포함), Application 스토리지예요. 이것은 [chii](https://github.com/liriliri/chii)가 미리 빌드한 진짜 DevTools 프런트엔드이고, 백엔드는 페이지 SDK에 이미 있는 전체 chobitsu이며, 게이트웨이가 CDP 메시지를 중계해요.

```
Console /devices/:id/devtools
  └─ iframe /devtools/chii_app.html?ws(s)=<host>/v1/devtools?ticket=…   ← DevTools frontend
        │ CDP (WebSocket)
        ▼
Gateway /v1/devtools ──{"t":"cdp","s","m"}──▶ page WebSocket ──▶ SDK: one session per window ──▶ chobitsu
```

### 17.1 창 열기

1. 콘솔이 `{"page":"p1"}`과 함께 `POST /v1/api/devices/:id/devtools`를 호출해요(생략하면 사용자가 보고 있는 페이지가 돼요). 소유자와 관리자만 할 수 있어요.
2. 게이트웨이는 그 기기에 열려 있는 페이지들의 프로젝트 정책을 병합해요. 그중 하나라도 `devtools: "off"`이면 요청은 거부돼요. 병합된 `approval`이 `prompt`이면, 게이트웨이는 포그라운드 페이지로 `"purpose":"devtools"`, `levels: ["advanced"]`, 그리고 멤버의 이름을 `agent.name`으로 담은 `attach_request`를 보내고 응답을 기다려요(30초; HTTP 요청도 함께 기다려요). SDK의 자동 허용은 적용되지 않아요. `nativeApproval`이면 `status().pending.purpose`가 `"devtools"`가 돼요([§7](#7-접속-승인)).
3. 승인은 그 기기에서 그 멤버에게 `policy.attachMaxMinutes` 동안 유지되므로, 새로고침이나 페이지 이동은 다시 묻지 않고 재연결돼요. 사용자가 기기에서 **종료**를 탭하거나 콘솔 멤버가 세션을 종료하면(`POST /devices/:id/end`) 모든 창이 닫히고 승인도 철회돼요.
4. 응답은 `{"ticket","session","page":Page,"frontendUrl"}`예요. `ticket`은 한 번만 쓸 수 있고 1분 동안 유효해요. `session`은 그 창이 `Device.devtools`에서 가질 id예요.
5. 프런트엔드는 `WS /v1/devtools?ticket=…`에 연결해요. 콘솔 자신의 출처만 연결할 수 있어요(설정되어 있다면 `--public-url`의 호스트).

오류 코드: `device_offline`, `no_page`(페이지가 사라졌거나 다시 연결 중), `busy`(기기가 다른 요청에 대한 사용자의 응답을 기다리는 중), `timeout`, `denied`(403), `forbidden`(403, 정책으로 꺼짐).

### 17.2 페이지 메시지

```jsonc
← {"t":"devtools","s":"<session>","on":true,"by":"Ann"}   // 창이 열림
← {"t":"devtools","s":"<session>","on":false}              // 창이 닫힘
← {"t":"cdp","s":"<session>","m":"<CDP command, JSON text>"}
→ {"t":"cdp","s":"<session>","m":"<CDP answer, JSON text>"} // 요청한 창으로 돌아감
→ {"t":"cdp","m":"<CDP event, JSON text>"}                  // 이 페이지의 모든 창으로
```

- 창은 하나의 페이지 연결에 속해요. 페이지가 연결을 끊으면(새로고침, 페이지 이동, 닫기) 게이트웨이는 그 창들을 코드 **4100**으로 닫고, 페이지가 돌아오면 콘솔이 새 ticket으로 다시 열어요(승인은 그대로 유지되므로 사용자에게 다시 묻지 않아요). 세션을 종료하면 **4403**으로 닫히고, 따라오지 못하는 프런트엔드(느린 연결에서의 스크린캐스트 등)는 **1013**으로 닫혀요.
- 페이지로 가는 CDP 메시지는 자신만의 큐를 가져요. 프런트엔드에서 명령이 몰리면 페이지를 느린 소비자로 끊는 대신 그 프런트엔드 자체를 느리게 만들므로, 에이전트의 RPC는 영향을 받지 않아요.
- SDK 안에서는 모든 창이 chobitsu 하나를 공유하고, 명령 id는 창마다 다시 씌워져요. `Runtime.enable`과 `Network.enable`은 SDK가 직접 응답하는데, SDK는 에이전트를 위해 페이지가 로드된 순간부터 이 둘을 수집하고 있고, 창이 열리기 전에 일어난 일도 함께 보여 줘요: console 메시지(마스킹된 텍스트; 객체는 펼칠 수 없음)와 최근 요청(아직 캐시에 있는 동안의 응답 본문). 어떤 창의 `*.disable`도 적용되지 않고, 마지막 창이 닫히면 SDK는 강조 표시를 지우고 스크린캐스트를 멈추고 창들을 위해 보관하던 객체를 해제해요.
- 창이 열려 있는 동안, 페이지의 하단 바에는 개발자가 디버깅 중이라는 표시와 멤버들의 이름, **종료** 버튼이 나타나요.

### 17.3 상태와 감사

- `Device.devtools`는 열린 창 목록을 보여주고, `Page.connected`와 `Page.connectedSince`는 콘솔에 창을 언제 다시 열지 알려주고, `Device.pending.purpose`는 DevTools 요청을 표시해요([§12.8](#128-타입)).
- 타임라인 kind `devtools`: 요청, 승인과 거부, 창 열림과 닫힘, 승인 철회([§12.9](#129-타임라인-이벤트)).
- 감사 동작 `devtools.request`, `devtools.approve`, `devtools.deny`, `devtools.timeout`, `devtools.open`, `devtools.close`([§12.7](#127-감사-로그)).
- 개인정보 보호: DevTools는 페이지를 있는 그대로 보여주고, **마스킹이 적용되지 않아요**. 그래서 소유자와 관리자로만 제한되고, 프로젝트별로 끌 수 있고, 기기에서 사용자에게 묻고, 감사 로그에 남아요.

### 17.4 프런트엔드

프런트엔드는 npm 패키지 `chii`의 고정된 버전에서 가져온 `public/front_end`로, sha512로 검증하며, 콘솔을 빌드할 때 `console/dist/devtools/`로 복사돼요([`console/scripts/devtools-frontend.mjs`](../console/scripts/devtools-frontend.mjs)). 게이트웨이는 이를 gzip으로 압축해(약 3.4 MB) 내장하고 `Content-Encoding: gzip`으로 제공해요. `/devtools/` 아래의 응답에는 `X-Frame-Options: SAMEORIGIN`이 붙어요.
