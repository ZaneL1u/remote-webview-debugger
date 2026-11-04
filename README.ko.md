<!-- i18n-source: 17d2a3687452758f5c2d903bfc5e90dd1d96013b -->
<div align="center">

# Remote WebView Debugger

**앱 속 WebView와 H5 페이지를 실제 사용자의 휴대폰에서, MCP로 원격으로 AI 에이전트가 디버깅하게 해 줘요.**

[debugger.site](https://debugger.site) · [라이브 데모](https://debugger.site/#demo) · [문서](docs/architecture.ko.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

특정 사용자의 휴대폰에서만, 그것도 WeChat 같은 슈퍼 앱이나 자사 앱의 WebView 안에서만 생기는 버그는 디버깅하기 가장 까다로워요. USB 케이블도, 원격 디버깅 포트도 없고, 내 컴퓨터에서 재현할 방법도 없죠. Remote WebView Debugger는 그 페이지를 대신 AI 에이전트 앞에 가져다 놓아요.

- **script 태그 하나**(또는 네이티브 주입)로 페이지가 온라인이 돼요. 사용자에게는 기기 코드가 적힌 작은 배지가 보이고, *지원 요청*을 탭할 수 있어요.
- **에이전트는 MCP로 접속해요.** Claude Code, Cursor 등 어떤 MCP 클라이언트든, 사용자가 기기에서 승인하면 접속해요. 접근성 스냅샷, console, 네트워크, 스크린샷을 읽고, 사람처럼 클릭하고 입력하고 스크롤해요. 그 기기의 모든 페이지와 WebView를 넘나들면서요.
- **사람을 위한 진짜 Chrome DevTools예요.** 콘솔에서 관리자가 온라인 페이지 어디서든 DevTools를 열어요 — Elements, Console, Network(열리기 전에 있었던 일까지 포함), Application 스토리지 — 사용자가 기기에서 승인한 뒤에요.
- **주도권은 늘 사용자에게 있어요.** AI가 무엇을 하는지(에이전트 커서, 계획한 단계를 보여 주는 작업 카드, 빛나는 화면 테두리) 볼 수 있고, 언제든 직접 조작하거나 세션을 종료할 수 있어요. 비밀번호, 전화번호, 카드 번호는 휴대폰 밖으로 나가기 전에 마스킹돼요.
- **셀프 호스팅.** 콘솔과 SDK를 내장한 Go 바이너리 하나로 돌아가고, 데이터베이스는 SQLite나 Postgres를 써요.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## 빠른 시작

세 단계예요. 게이트웨이를 실행하고, 페이지에 SDK를 추가하고, 에이전트가 게이트웨이를 바라보게 하세요.

### 1. 게이트웨이 실행하기

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

`http://<your-host>:8080`을 열고 **`admin`** 계정과 그 비밀번호로 로그인하세요. `RWD_ADMIN_PASSWORD`를 빼면 무작위 비밀번호가 `docker logs rwd`에 한 번 출력돼요. 이미지는 Alpine 기반(linux/amd64, linux/arm64)이고, 콘솔과 SDK를 내장하며, 모든 데이터를 `rwd-data` 볼륨에 보관해요. 업그레이드하려면 새 태그를 `docker pull`한 뒤 컨테이너를 다시 만드세요.

`-e`로 넘길 만한 설정([전체 설정](gateway/README.ko.md)):

| 변수 | 용도 |
|---|---|
| `RWD_ADMIN_EMAIL` | 소유자 로그인 이름(기본값 `admin`) |
| `RWD_PUBLIC_URL` | 휴대폰과 에이전트가 쓰는 주소(예: `https://rwd.example.com/v1`). 브라우저에서 여는 주소와 다를 때 지정해요 |
| `RWD_LANG=zh` | MCP 도구 설명과 결과를 중국어로 |
| `RWD_DATABASE_URL` | `postgres://…`를 넣으면 SQLite 대신 Postgres를 써요 |
| `RWD_TRUST_PROXY=1` | 직접 운영하는 리버스 프록시 뒤에서만: 클라이언트 IP와 스킴을 `X-Forwarded-*`에서 가져와요 |

<details>
<summary>다른 실행 방법: 바이너리, HTTPS를 갖춘 Docker Compose, 소스에서 빌드</summary>

- **바이너리.** [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases)의 각 게이트웨이 릴리스에는 Linux와 macOS용 `rwd_<version>_<os>_<arch>.tar.gz`가 있어요. 압축을 풀고 `./rwd serve --addr :8080`을 실행하세요.
- **Docker Compose.** [`deploy/platform`](deploy/platform/README.ko.md)은 앞단에 Caddy를 둬요. 직접 운영하는 TLS 프록시 뒤에 두거나, Let's Encrypt 인증서로 직접 HTTPS를 제공할 수 있어요(`RWD_DOMAIN=<host>`).
- **소스에서 빌드.** `make -j16`(Go와 Node 필요) 후 `gateway/bin/rwd-<os>-<arch> serve --addr :8080`을 실행하세요.

</details>

### 2. 페이지를 온라인으로 만들기

콘솔에서 프로젝트를 만들어 앱 키를 받은 뒤, 게이트웨이 주소와 함께 SDK를 추가하세요.

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

SDK는 npm 패키지 [`remote-webview-debugger`](sdk/README.ko.md)예요. 위처럼 jsDelivr에서 불러오거나 unpkg(`https://unpkg.com/remote-webview-debugger@0.3.0/dist/sdk.js`)에서 불러올 수 있고, `npm install remote-webview-debugger` 후 `import { run } from 'remote-webview-debugger'`로 써도 돼요. 게이트웨이도 내장한 사본을 `/v1/sdk.js`에서 제공해요.

앱에서는 같은 스크립트를 네이티브 코드에서 문서 시작 시점에 주입하세요(iOS는 `WKUserScript`, Android는 `addDocumentStartJavaScript`). [네이티브 앱 연동](docs/native-integration.ko.md)과 콘솔에 내장된 가이드를 참고하세요.

### 3. 에이전트 연결하기

콘솔에서 API 키를 만든 뒤(키 하나로 모든 기기에 접근할 수 있어요) 다음을 실행하세요.

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…그리고 이렇게 요청하세요: *“기기 K7Q2-9M4X에 접속해서 결제 합계가 `--`로 표시되는 이유를 찾아 줘.”*

### HTTP와 HTTPS 중 무엇을 쓸까요?

게이트웨이는 평문 HTTP로 통신하고, 그대로도 잘 동작해요. SDK는 게이트웨이 주소를 보고 `ws://`와 `wss://` 중 하나를 고르고, 콘솔과 MCP도 둘 다에서 동작해요. 결정하는 건 **디버깅할 페이지**예요. 브라우저와 WebView는 `https://` 페이지가 `http://` 스크립트를 불러오거나 `ws://` 연결을 여는 것(혼합 콘텐츠)을 허용하지 않아요. `sdk.js` 자체를 HTTPS CDN에서 불러와도 마찬가지예요.

| 디버깅할 페이지 | 평문 HTTP 게이트웨이 |
|---|---|
| `http://`: 로컬 개발 서버, 사내망 테스트 환경 | ✅ 동작해요 |
| 브라우저나 iOS `WKWebView` 안의 `https://` | ❌ 혼합 콘텐츠로 차단돼요: 게이트웨이에 HTTPS를 붙이세요 |
| Android WebView 안의 `https://` | ⚠️ 앱이 `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`를 호출할 때만, 그것도 디버그 빌드에서만 |

평문 HTTP에서는 API 키와 콘솔 비밀번호가 암호화되지 않은 채 오가므로, 신뢰할 수 있는 네트워크 안에서만 쓰세요. HTTPS가 필요하면 [Compose 스택](deploy/platform/README.ko.md)을 `RWD_DOMAIN=<host>`로 실행하거나(인증서 자동 발급), 컨테이너를 직접 운영하는 TLS 프록시 뒤에 두고 `-e RWD_TRUST_PROXY=1`을 추가하세요.

## 기능

- **기기 중심.** 기기 하나(앱 설치 하나 또는 브라우저 하나)에 여러 페이지가 있어요. API 키 하나와 MCP 서버 하나로 모든 기기에 접근해요. 에이전트는 페이지 이동과 새로 열린 WebView를 따라가고, 페이지를 넘나드는 타임라인을 봐요.
- **에이전트 도구.** 요소 ref가 달린 접근성 스냅샷(Playwright의 aria snapshot), 찾기, 클릭, 채우기, 입력, 키 누르기, 선택, 호버, 스크롤, 드래그, 페이지 이동, 스크립트 실행, console, 본문까지 포함한 네트워크, 저장소, 스크린샷(네이티브 브리지 또는 DOM), 일괄 작업, 대기와 이벤트.
- **동의와 제어.** 권한 수준(`observe` / `interact` / `advanced`)을 고르는 기기 내 승인, 선택적 자동 허용, 에이전트가 조작하는 동안의 화면 잠금, 직접 조작 / AI에 맡기기 / 종료, 민감한 작업 확인(`data-rwd-confirm`).
- **개인정보 보호.** 비밀번호 입력란, `data-rwd-mask`, 설정 가능한 선택자 / 패턴은 스냅샷, 스크린샷, console, 네트워크 데이터에서 마스킹돼요. 감사 로그는 누가 무엇을 했는지 기록하되 페이지 내용은 남기지 않아요.
- **운영.** 멤버와 역할, 권한 수준 / 만료일 / IP 허용 목록을 둔 API 키, 기기 토큰, QR 코드 초대, 할당량, SSE 기반 실시간 콘솔, Prometheus 메트릭.
- **11개 언어, 원하는 스타일.** 콘솔, 휴대폰 UI, 에이전트용 텍스트를 영어, 중국어 간체, 중국어 번체, 프랑스어, 스페인어, 러시아어, 아랍어(오른쪽에서 왼쪽), 일본어, 한국어, 독일어, 포르투갈어로 제공해요. 콘솔은 브라우저 언어를 따르고(전환 메뉴 있음), 휴대폰 UI는 휴대폰 언어나 `run({ lang })`을, 에이전트 쪽은 `RWD_LANG`을 따라요. 페이지 SDK에는 직접 만든 언어 팩과 문구를 넣을 수 있고, CSS 변수로 스타일을 바꿀 수 있어요([SDK 언어와 스타일](sdk/README.ko.md#언어)).
- **eruda와 잘 어울려요.** eruda 안에 Remote Debugger 탭을 선택적으로 추가할 수 있고, 개발자를 위해 필요할 때 eruda를 불러올 수도 있어요.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| [`gateway/`](gateway) | Go 게이트웨이: 페이지 WebSocket, REST와 콘솔 인증, MCP 서버, 감사, 메트릭 |
| [`sdk/`](sdk) | 페이지 SDK(`sdk.js`)와 페이지 내 UI |
| [`packages/chobitsu/`](packages/chobitsu) | 벤더링한 [chobitsu](https://github.com/liriliri/chobitsu)와 `src/engine/`에 있는 자체 페이지 측 엔진 |
| [`console/`](console) | 웹 콘솔(React, Vite) |
| [`website/`](website) | 인터랙티브 데모가 있는 [debugger.site](https://debugger.site) |
| [`examples/`](examples) | 여러 페이지로 된 데모 쇼핑몰, 그리고 iOS 앱처럼 WKWebView를 호스팅하는 macOS 앱 |
| [`deploy/platform/`](deploy/platform) | Docker Compose 배포 |
| [`docs/`](docs) | [아키텍처](docs/architecture.ko.md), [프로토콜](docs/protocol.ko.md), [네이티브 앱 연동](docs/native-integration.ko.md), [릴리스](docs/releasing.ko.md) |

## 릴리스

페이지 SDK와 게이트웨이는 따로 릴리스되고, 각자 버전, 태그(`sdk-vX.Y.Z`, `gateway-vX.Y.Z`), 변경 내역을 가져요: [SDK](sdk/CHANGELOG.md), [게이트웨이](gateway/CHANGELOG.md). 게이트웨이 릴리스에는 Linux와 macOS용 `rwd` 바이너리와 이미지 `ghcr.io/zanel1u/remote-webview-debugger`가 포함돼요. [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases)를 보고, 메인테이너라면 [릴리스](docs/releasing.ko.md) 문서도 참고하세요.

## 개발

```bash
make -j16 check                                      # 게이트웨이 테스트, SDK 타입 검사 + Playwright 테스트, 콘솔 빌드
cd console && PORT=8080 npm run mock & npm run dev   # 메모리 내 목 게이트웨이에 붙인 콘솔
cd website && npm run dev                            # 웹사이트
```

## 감사의 말

페이지 측 엔진은 console과 네트워크 수집에 [chobitsu](https://github.com/liriliri/chobitsu)(MIT)를 기반으로 하고, [Playwright](https://github.com/microsoft/playwright)의 접근성 스냅샷 코드(Apache-2.0)를 사용해요. 콘솔의 DevTools는 [chii](https://github.com/liriliri/chii)가 미리 빌드한 Chrome DevTools 프런트엔드예요(MIT; DevTools 자체는 BSD-3-Clause). [NOTICE](NOTICE)를 참고하세요.

## 라이선스

[MIT](LICENSE)
