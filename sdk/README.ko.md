<!-- i18n-source: 1c026017b4d185523c9ea373eb979d1cbd58bff0 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD 페이지 SDK (`sdk/`)

앱의 WebView나 H5 페이지가 불러오는 JS 파일 하나예요. 이 파일을 넣으면 AI 에이전트가 RWD 게이트웨이(`gateway/`)와 MCP를 거쳐 페이지를 살펴보고 조작할 수 있어요. 프로토콜: [`docs/protocol.ko.md`](../docs/protocol.ko.md), 아키텍처: [`docs/architecture.ko.md`](../docs/architecture.ko.md).

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // 선택
    deviceId: "…",               // 선택. SDK를 주입하는 네이티브 호스트가 넘겨 줌
    helpButton: true,            // 선택. “지원 요청” 버튼 표시
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // 선택. 언어 태그. 기본값은 브라우저의 언어 설정
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## SDK 받기

npm에 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)로 배포돼 있어요. 버전과 변경 사항: [CHANGELOG](CHANGELOG.md).

| 사용 방식 | 위치 |
|---|---|
| CDN에서 `<script>`로 | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js` 또는 `https://unpkg.com/remote-webview-debugger@0.2.0/dist/sdk.js` (압축된 IIFE, 전역 `RemoteWebviewDebugger`. 버전을 고정하고, 원하면 `integrity`도 추가하세요) |
| 번들러 | `npm install remote-webview-debugger` 후 `import { run, status } from 'remote-webview-debugger'` (타입이 포함된 ES 모듈). 수집이 일찍 시작되도록 직접 작성한 코드보다 먼저 import하세요. 같은 페이지에서 `<script>` 버전을 함께 불러오지 마세요 |
| 직접 운영하는 게이트웨이 | `https://<gateway>/v1/sdk.js`, 게이트웨이에 내장된 사본이에요 (SRI용 콘텐츠 주소 기반 URL도 있고, 콘솔에서 안내해요) |
| 네이티브 앱 | 패키지의 `dist/sdk.js`를 앱에 포함하거나 위 경로 중 하나에서 내려받으세요. [네이티브 연동](../docs/native-integration.ko.md)을 참고하세요 |

## API

| API | 설명 |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | 페이지를 온라인으로 만들어요 (기기 코드, 배지). `Promise<{deviceCode, status}>`를 반환하고, 여러 번 호출해도 문제없어요. 옵션은 아래를 보세요. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`. `status`는 `idle / connecting / online / polling / stopped / rejected / quota` 중 하나, `lang`은 UI 언어 (`run()` 전에는 `null`), `logSession`은 이 페이지가 기록 중인 세션 로그 (기록하지 않을 때는 `null`) |
| `stop()` | 연결을 끊고 UI를 제거해요 (console / 네트워크 수집은 상한 안에서 계속돼요) |
| `setUser(userId)` | 사용자를 바꿔요. 새 `hello`로 한 번 다시 연결해요 |
| `help(on)` | 지원 요청 / 요청 취소 |
| `nativeControl(nativeKey, action)` | 네이티브 호스트의 자체 UI에서 직접 조작 / AI에 맡기기 / 종료 |
| `nativeDecide(nativeKey, requestId, value)` | `nativeApproval`을 쓸 때 `status().pending`에 응답해요. 접속 요청에는 권한 수준 또는 `null`, 민감한 작업 확인에는 `'allow'` 또는 `null` |
| `setLang(lang?)` | 실행 중에 UI 언어를 바꿔요 (앱 자체의 언어 설정 등). 인자 없이 호출하면 브라우저의 언어 설정으로 돌아가요. [언어](#언어)를 참고하세요 |
| `registerLocale(pack)` | 언어 팩을 추가하거나 같은 `id`의 언어 팩을 교체해요 (배열도 받아요). [언어](#언어)를 참고하세요 |
| `builtinLocales` | 내장된 언어 팩의 id 목록 |

`run()` 옵션:

| 옵션 | 설명 |
|---|---|
| `userId` | 로그인한 사용자. `hello`와 함께 전송돼요 |
| `deviceId` | 네이티브 호스트가 주는 고정 기기 id (없으면 localStorage에 하나를 만들어 보관해요) |
| `helpButton` | “지원 요청” 버튼 표시 (프로젝트 정책과 OR로 합쳐져요) |
| `app` | 호스트 앱의 `{ name, version }` |
| `lang` | 휴대폰 사용자가 보는 모든 것(배지, 플로팅 창, 하단 바, 대화 상자, 토스트, eruda 탭, 민감한 작업의 “AI가 …을(를) 요청했어요” 설명)의 언어. `'ja'`나 `'pt-BR'` 같은 언어 태그예요. 기본값은 브라우저의 언어 설정이에요. [언어](#언어)를 참고하세요 |
| `locales` | 추가 언어 팩. 언어를 고르기 전에 등록돼요 (`registerLocale`과 같아요) |
| `messages` | 언어별로 덮어쓸 메시지: `{ en: { ui: { help: 'Contact support' } }, zh: { ui: { help: '联系客服' } } }` |
| `networkExclude` | 에이전트가 일일이 볼 필요 없는 요청. 늘 404가 나는 폰트, 분석용 비콘 등: `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. 각 규칙은 URL에 대해 대소문자를 구분하지 않는 부분 문자열, `*` 와일드카드 패턴, 또는 `/…/`로 쓰면 정규식으로 매칭돼요. 프로젝트 정책의 규칙에 더해져요. 매칭된 요청은 네트워크 목록과 `net_fail` 타임라인 이벤트에서 빠지지만 페이지는 계속 기록하므로, 에이전트가 `includeExcluded`로 요청할 수 있어요 |
| `lockScreen` | `false`: 에이전트가 접속해 있는 동안 페이지를 잠그지 않아요 (사용자는 플로팅 창에서 언제든 바꿀 수 있어요). 기본값 `true` |
| `theme` | `'auto'` (기본값, 페이지 배경을 따라감), `'system'`, `'light'`, `'dark'` |
| `style` | UI의 색상, 폰트, 모서리 반경, z-index, 위치: `{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`. [스타일](#스타일)을 참고하세요 |
| `eruda` | `true` 또는 `{ dock, load, src, name }`: Remote Debugger를 eruda 안의 탭으로 보여 줘요. `load`는 페이지에 eruda가 없을 때 최신 eruda를 불러와요. 기본적으로 꺼져 있고, 프로젝트 정책으로 원격에서 켤 수 있어요. 필드별로 로컬 옵션이 우선해요 |
| `record` | `false`: 이 페이지는 세션 로그를 쓰지 않아요 (이미 저장된 것은 지우지 않아요). 기본값 `true`. 프로젝트 정책으로 모든 페이지의 로그를 끌 수 있어요 |
| `launchId` | 이 페이지가 앱의 어느 실행에 속하는지. 앱 프로세스 하나의 모든 WebView가 세션 로그를 한 세션 아래에 기록하게 해요. 네이티브 호스트는 자체 id를 여기에 넘기거나 `window.RWDLaunchId`를 문자열 또는 문자열을 반환하는 함수로 정의해요. 그렇지 않으면 SDK가 세션 쿠키와 하트비트로 실행을 추정해요 |
| `nativeKey`, `deviceToken`, `nativeApproval` | 네이티브 호스트용: `nativeControl` / `nativeDecide`에 쓰는 비밀 값, 호스트가 보관하는 기기 토큰, 접속 / 확인 질문을 네이티브 UI로 묻기 |

## 언어

내장 언어: 영어(`en`), 중국어 간체(`zh`), 중국어 번체(`zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant`에도 쓰여요), 프랑스어(`fr`), 스페인어(`es`), 러시아어(`ru`), 아랍어(`ar`, 오른쪽에서 왼쪽으로 배치), 일본어(`ja`), 한국어(`ko`), 독일어(`de`), 포르투갈어(`pt`, 브라질 포르투갈어, `pt-PT`에도 쓰여요).

**언어 선택.** 휴대폰 사용자의 언어는 `run({ lang })`이 있으면 그것, 그다음 `navigator.languages`를 순서대로 봐요. SDK는 각 태그마다 태그 그대로, 그다음 더 짧은 형태(`pt-BR` → `pt`, `zh-HK` → `zh-TW` → `zh`)를 시도해서 언어 팩이 있는 첫 언어를 쓰고, 없으면 영어로 돌아가요. 언어 팩에 없는 메시지도 같은 방식으로 대체되므로 일부만 번역된 언어 팩도 괜찮아요. `setLang('ja')`로 실행 중에 바꿀 수 있고, `status().lang`이 사용 중인 언어 팩이에요.

**불러오기.** 영어와 중국어 간체는 `sdk.js`에 들어 있어요. 나머지 언어 팩은 페이지에서 처음 필요할 때 불러와요 (그 사이에는 UI가 대체 언어로 표시돼요):

- `<script>` 빌드: `sdk.js` 옆의 `locales/<id>.js`에서 불러오고 (CDN 경로라면 `…/remote-webview-debugger@0.2.0/dist/locales/ja.js`, 게이트웨이라면 `/v1/locales/ja.js`), 실패하면 `run()`에 넘긴 게이트웨이에서 불러와요. 추가 요청을 피하려면 `sdk.js` 앞이나 뒤에서 언어 팩을 직접 불러오세요: `<script src="…/dist/locales/ja.js"></script>`.
- ES 모듈 빌드: 동적 import를 쓰므로 번들러가 언어마다 별도 청크를 만들어요. 미리 번들에 넣으려면 `import ja from 'remote-webview-debugger/locales/ja'` 후 `run(url, key, { locales: [ja] })`로 넘기세요.

**직접 만든 언어 팩과 문구.** 언어 팩은 `{ id, name, dir?, ui?, action?, agent? }`예요. 빠진 부분은 대체 언어에서 가져와요:

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Richiedi assistenza' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { en: { ui: { help: 'Contact support' } } }, // 어떤 언어든 개별 메시지만 바꾸기
})
```

`ui`는 UI 문구, `action`은 확인 대화 상자의 “AI가 …을(를) 요청했어요” 부분을 채우는 문구, `agent`는 에이전트에게 돌아가는 문구예요. TypeScript 타입(`LocalePack`, `Messages`, `UiMessages`, `ActionMessages`, `AgentMessages`)에 모든 키가 나와 있고, `src/locales/en.ts`가 기준이에요.

**두 종류의 독자.** 휴대폰 사용자는 위에서 고른 언어로 봐요. 에이전트는 RPC 오류 메시지와 타임라인 요약(탭, 페이지 내 이동, 실패한 요청)을 게이트웨이의 언어 `welcome.agentLang`(`RWD_LANG`)으로 읽고, 이 언어 팩도 같은 방식으로 불러와요. welcome이 다른 값을 알려 주기 전까지는 영어예요. 마지막 값은 localStorage `rwd:alang`에 보관되므로, 다음 페이지의 welcome이 오기 전의 이벤트도 그 언어를 써요.

그래서 중국어를 쓰는 사용자가 영어로 동작하는 에이전트와 함께 작업할 수 있어요. 대화 상자는 `AI 想要点击「提交订单」，允许吗？`라고 묻고, 사용자가 거부하면 에이전트는 `The user denied this action`을 받아요.

## 스타일

UI는 `#__rwd`(`<body>` 바깥)의 shadow root 안에 있어서, 페이지 CSS는 아래 경로를 통해서만 UI에 닿아요:

- `:root`나 `#__rwd`에 지정하는 **CSS 사용자 지정 속성**. 예: `:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`.
- **`run({ style })`**: 같은 속성을 `#__rwd`에 설정해요. 여기서는 색상에 어떤 CSS 색상 값이든 쓸 수 있어요.
- 그 밖의 것은 **`::part()`**: `#__rwd::part(bar) { … }`. part: `pill`, `window`, `bar`, `task`, `dialog`, `toast`, `button`, `cursor`, `glow`, `overlay`. 내부의 클래스 이름은 안정적인 API가 아니에요.
- **`theme`**: 밝은 유리 또는 어두운 유리 스타일 (기본값: 페이지 배경을 따라감).

| 속성 | `style` 필드 | 기본값 | 적용 대상 |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | 버튼, 스위치, 에이전트의 포인터, 강조 표시, 가장자리 글로우 |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | 종료 버튼 |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | 지원 요청과 지원 중, 사용자 직접 조작 중 상태 |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | 온라인 표시 점, “복사됨” |
| `--rwd-font` | `font` | 시스템 UI 폰트 (중국어, 일본어, 한국어는 언어별) | 모든 텍스트 |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | 기기 코드와 태그 |
| `--rwd-radius` | `radius` | `18px` | 플로팅 창. 대화 상자는 2px 더 둥글고, 작업 카드와 배지는 2px 덜, 대화 상자 버튼은 6px 덜 둥글어요 |
| `--rwd-button-radius` | `buttonRadius` | `999px` | 버튼, 하단 바, 토스트 |
| `--rwd-z-index` | `zIndex` | `2147483647` | UI 전체 |
| `--rwd-bar-bottom` | `barBottom` | `14px` | 하단 바, 하단 안전 영역 위 |
| `--rwd-task-top` | `taskTop` | `10px` | 작업 카드, 상단 안전 영역 아래 |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | 토스트, 하단 안전 영역 위 |
| — | `pill: { side, top }` | 오른쪽 가장자리 (오른쪽에서 왼쪽으로 쓰는 언어에서는 왼쪽), `0.62` | 사용자가 끌어서 옮기기 전까지 대기 중인 배지가 처음 놓이는 위치. `top`은 0(맨 위)부터 1(맨 아래)까지 |

색상은 `r, g, b` 세 값으로 지정해서 반투명한 색조도 함께 바뀌어요 (Bootstrap의 `--bs-*-rgb`와 같은 방식).

## 페이지에서의 동작 (프로토콜 §6–§8, §11)

- 권한 수준: RPC는 `welcome.level` / `control.level`에 따라 검사돼요 (`forbidden`, "Requires the … level"). 권한 수준이 없는 에이전트(구버전 게이트웨이)는 `interact`로 취급하고, 접속한 에이전트가 없으면 추가로 강제하는 것은 없어요.
- 기기 토큰은 localStorage `rwd:dtoken`에, 재개 토큰은 sessionStorage `rwd:resume`(pageId에 묶임)에 보관해요. 종료 코드 4401: 그 사이에 토큰이 바뀌었으면(같은 기기의 다른 탭이 방금 받아 왔으면) 바로 한 번 재시도하고, 아니면 `rejected`가 되고 약 10분 뒤에 재시도해요. 4409: 새 pageId로 다시 연결해요. 4429: `quota`가 되고 약 5분 뒤에 재시도해요.
- 주소창의 `rwd_invite`는 `run()` 때 제거되고(`history.replaceState`) welcome이 올 때까지 hello와 함께 전송돼요.
- `welcome.config`: `helpButton`(`run()` 옵션과 OR), `maskSelectors`, `maskPatterns`(스냅샷, console, 네트워크 URL, 저장소 값, 타임라인 요약), `confirmSelectors`, `networkExclude`(`run()` 옵션의 규칙에 더해짐), `sessionLog`. 마지막 config는 localStorage `rwd:cfg`에 보관돼 welcome이 올 때까지 쓰여요. 그래서 세션 로그를 끈 프로젝트는 다음 페이지에서도 welcome이 오기 전 첫 순간부터 로그가 꺼져 있어요.
- 스냅샷은 마지막에 `[Overlays]` 섹션이 붙어서 팝업의 배경, 모달, 바텀 시트처럼 페이지 위에 떠 있는 것을 나열해요. 각 항목에는 태그, 짧은 텍스트, 뷰포트를 덮는 비율, ref가 있어요. 배경은 aria 스냅샷에 노드가 없는 빈 요소라서 `eN` 대신 `oN` ref를 받아요. 덕분에 에이전트가 배경을 탭해서 팝업을 닫을 수 있어요.
- 클릭은 먼저 요소에서 보이는 부분의 중앙을 노리고, 그다음 요소 안 3×3 격자의 다른 지점을 노려요. 그래서 버튼 위에 배지가 있어도 막히지 않아요. 모든 지점이 가려져 있으면 RPC는 `not_interactable`로 실패하고, 가리고 있는 요소와 그 ref를 알려 줘요.
- 접속 대화 상자와 민감한 작업 대화 상자(`[data-rwd-confirm]`, `confirmSelectors`, Enter로 폼을 제출하는 경우 포함)는 Shadow DOM 안에 있고, 신뢰할 수 있는 탭만 받으며, 나타난 지 0.4초 뒤에 활성화돼요. 같은 출처의 탭들은 BroadcastChannel로 이미 결정된 접속 요청을 공유해요.

파일을 불러오는 순간부터 console, 처리되지 않은 오류, 네트워크(XHR, fetch, WebSocket, sendBeacon, EventSource)를 종류별로 최대 500개까지 수집해요. 가득 차면 일반 로그와 성공한 요청부터 버려요. 응답 본문은 합계 5 MB, 하나당 64 KB까지 캐시해요. 그러니 `<head>`에서 동기적으로, 최대한 일찍 불러오세요.

## 세션 로그 (프로토콜 §5.4)

위의 버퍼는 한 페이지의 메모리일 뿐이에요. 이와 별도로 SDK는 기기의 IndexedDB(`rwd-log`)에 **세션 로그**를 기록해서, 버그가 난 뒤에 접속한 에이전트도 버그에 이르기까지의 과정을 처음부터 읽을 수 있어요:

- 세션 하나는 앱의 실행 한 번이고, 같은 출처의 모든 페이지가 공유해요. `run({ launchId })`, 없으면 `window.RWDLaunchId`, 그것도 없으면 세션 쿠키 `rwd_launch`와 하트비트로 추정해요 (쿠키 세션이 한 시간 넘게 조용하면 새 실행으로 봐요). `status().logSession`이 사용 중인 id예요.
- 기록하는 것: 페이지 열기 / 페이지 내 이동 / 포그라운드·백그라운드 전환 / 페이지 떠나기, 사용자의 탭, 입력, 제출, 스크롤이 멈춘 위치, 에이전트의 상호작용 호출과 `rwd.evaluate`, 제어 상태 변경, 모든 레벨의 console, 끝난 모든 요청(실패한 요청은 민감 정보를 가린 헤더와 본문까지, 각 64 KB). 게이트웨이에 닿을 수 있든 없든 동작해요. 마스킹된 필드는 `••••`로 저장되고, `maskPatterns`는 기록을 쓸 때 적용돼요.
- 보관: 최근 3번의 실행, 실행당 10 MB. 넘으면 일반 로그와 성공한 요청부터 버려요. 저장소 할당량이 64 MB 미만이면 현재 실행만 보관하고, IndexedDB가 없으면 아무것도 보관하지 않아요.
- 에이전트는 `rwd.log`(`observe`)와 `rwd.logDetail`(`advanced`, 헤더와 본문용)로 읽어요. 그 밖에는 아무것도 기기를 떠나지 않아요.
- 끄기: 한 페이지는 `run({ record: false })`, 프로젝트 전체는 `policy.sessionLog: false`. 후자는 이 출처에 이미 저장된 로그도 지워요.

## 구조

- `src/index.ts`: 공개 API, 세션, RPC 디스패치, 제어 상태.
- `src/transport.ts`: 페이지 WebSocket(네이티브 생성자 사용), 하트비트 타임아웃, 지수 백오프, 3번 연속 실패하면 60초마다 `POST /v1/presence`.
- `src/ids.ts`: deviceId / pageId / openerId.
- `src/launch.ts`: 이 페이지가 앱의 어느 실행에 속하는지 (`launchId`, `window.RWDLaunchId`, `rwd_launch` 쿠키).
- `src/pageWatch.ts`: `page` 메시지(url, title, visibility)와 타임라인 이벤트(페이지 내 이동, 사용자의 탭).
- `src/ui.ts`, `src/lock.ts`: Shadow DOM 안의 배지, 지원 요청 버튼, 잠금 오버레이, 글로우, 동작 강조 표시, 대화 상자. 에이전트가 접속해 있는 동안 사용자의 신뢰할 수 있는 입력을 막고, 연결된 지 얼마나 됐는지 보여 줘요.
- `src/approval.ts`: 접속 승인과 민감한 작업 확인 (페이지 대화 상자, 또는 `nativeDecide`를 통한 네이티브 호스트).
- `src/i18n.ts`, `src/locales/`, `src/localeLoader*.ts`: 언어 팩(언어별 UI, action, agent 문구), 선택과 대체, 필요할 때 불러오기. `scripts/locales.mjs`가 `dist/locales/<id>.js`를 빌드해요.
- 에이전트 엔진은 chobitsu 옆의 `packages/chobitsu/src/engine/rwd/`에 있어요: 스냅샷, `rwd.query`, 조작 가능 여부 검사, 합성 입력, 키보드, console / 네트워크 버퍼, 스크린샷, `rwd.storage`, IndexedDB 세션 로그(`coldlog.ts`), 오버레이 감지(`overlays.ts`), 권한 수준과 확인 규칙(`policy.ts`), 에이전트용 문구(`i18n.ts`). 스냅샷에 쓰는 Playwright 소스는 `packages/chobitsu/src/engine/vendor/playwright/`에 있어요. 빌드할 때 이것들을 소스에서 바로 `dist/sdk.js`로 번들링해요.

## 빌드와 테스트

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE, 전역 RemoteWebviewDebugger, ES2017), dist/index.mjs + index.d.ts (ES 모듈)
npm run typecheck
npm test             # Playwright: WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # 로컬 모의 게이트웨이: http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

테스트는 `test/mock-gateway.mjs`를 써요. 이 모의 게이트웨이는 프로토콜의 페이지 쪽(welcome, 제어 상태, RPC, presence, 토큰, 종료 코드, 권한 수준, 원격 config, `agentLang`, 접속 승인)을 구현하고, `/v1/sdk.js`, `/v1/locales/` 아래의 언어 팩, 데모 쇼핑몰을 제공해요. 권한 수준은 직접 검사하지 않으므로, 테스트는 페이지 자체의 강제 동작을 검증해요. `test/e2e/`의 스펙은 따로 지정하지 않는 한 `zh-CN` 브라우저와 `agentLang: 'zh'`로 실행돼요. `i18n.spec.ts`는 영어를, `locales.spec.ts`는 나머지 언어 팩, 대체, 사용자 정의 언어 팩, 스타일, 오른쪽에서 왼쪽으로 쓰는 레이아웃을 다뤄요. 공존 테스트는 jsdelivr에서 eruda 3.4.3과 PageSpy 2.4.0을 불러오므로 인터넷 연결이 필요해요.
