<!-- i18n-source: e110292ad2a3dca0ad4fca78a52a79f08f95af0b -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | [日本語](releasing.ja.md) | 한국어 | [Español](releasing.es.md) | [Français](releasing.fr.md) | [Deutsch](releasing.de.md) | [Português (Brasil)](releasing.pt-BR.md) | [Русский](releasing.ru.md) | [العربية](releasing.ar.md)

# 릴리스

페이지 SDK와 게이트웨이는 따로 릴리스돼요. 각자 버전, 태그, 변경 내역이 있고, 변경 내역에는 자기 경로를 건드린 커밋만 나열돼요.

| | 페이지 SDK | 게이트웨이 |
|---|---|---|
| 경로 | `sdk/`, `packages/chobitsu/` | `gateway/`, `console/`, `deploy/` |
| 태그 | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| 버전 위치 | `sdk/package.json` | 태그(`make`가 `git describe`로 읽어요) |
| 변경 내역 | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md), [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md), [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| 배포 형태 | npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (jsDelivr, unpkg) | linux / darwin × amd64 / arm64용 `rwd_<version>_<os>_<arch>.tar.gz`, 이미지 `ghcr.io/zanel1u/remote-webview-debugger` |

게이트웨이 바이너리는 같은 커밋의 SDK를 내장하고, 변경 내역의 해당 섹션에 그 SDK 버전이 적혀 있어요.

## 릴리스 만들기

최신 상태이고 깨끗하며 CI가 통과한 `main`에서:

```bash
make release-sdk ARGS=--dry-run     # 미리 보기: 다음 버전과 두 변경 내역의 섹션
make release-sdk                    # 버전 올리기, 변경 내역 작성, 커밋, sdk-vX.Y.Z 태그
git push origin main sdk-v0.2.0     # 태그가 .github/workflows/release.yml을 시작함
```

`make release-gateway`도 똑같이 동작해요. 푸시하기 전까지는 아무것도 내 컴퓨터 밖으로 나가지 않아요. 아직 푸시하지 않은 릴리스를 되돌리려면: `git tag -d <tag> && git reset --hard HEAD~1`.

`ARGS`에 넣을 수 있는 옵션:

| 옵션 | 효과 |
|---|---|
| `--dry-run` | 출력만 하고 아무것도 바꾸지 않아요 |
| `--major`, `--minor`, `--patch` | 커밋에서 추론하지 않고 올릴 자리를 강제로 지정해요 |
| `--version X.Y.Z` | 정확한 버전. 예: 프리릴리스라면 `0.3.0-rc.1` |
| `--edit` | 커밋하기 전에 `$EDITOR`로 두 변경 내역을 열어요 |

스크립트는 [`scripts/release/release.mjs`](../scripts/release/release.mjs)이고, 커밋을 읽고 파싱하는 데 [changelogen](https://github.com/unjs/changelogen)을 사용해요.

## 버전과 변경 내역

커밋은 [Conventional Commits](https://www.conventionalcommits.org/)를 따라요. 해당 컴포넌트의 이전 태그 이후로:

- 호환성을 깨는 변경(`feat!:` 또는 `BREAKING CHANGE:` 푸터)은 메이저 버전을 올려요. 1.0 이전에는 마이너 버전을 올려요.
- `feat`는 마이너 버전을 올려요.
- `fix`, `perf`, `refactor`, `deploy`, `build`, `docs`는 패치 버전을 올려요.

변경 내역에는 이 타입들이 오래된 것부터 나열돼요. `test`, `ci`, `chore`와 릴리스 커밋 자체는 빠져요. 컴포넌트와 같은 스코프(SDK 변경 내역의 `fix(sdk):`)는 생략되고, 다른 스코프는 표시돼요. 컴포넌트의 첫 릴리스는 현재 버전인 0.1.0을 그대로 써요.

**중국어 항목.** 중국어 변경 내역은 중국어 제목을 써요. 커밋에 `Changelog-Zh:` 트레일러가 없으면 커밋 제목이 그대로 항목이 돼요.

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

릴리스할 때 중국어 항목을 직접 쓰거나 다듬으려면 `--edit`를 쓰세요.

## 태그를 받으면 CI가 하는 일

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

- **`sdk-v*`:** `sdk/package.json`의 버전이 태그와 같은지 확인하고, 빌드한 뒤, 그 버전이 아직 npm에 없으면 `npm publish --provenance`를 실행해요(`-`가 들어간 버전은 `next` dist-tag로 가요). 그리고 `sdk.js`, `index.mjs`, `index.d.ts`, npm tarball을 담은 GitHub Release를 만들어요. SDK 릴리스는 저장소의 최신 릴리스로 표시되지 않아요.
- **`gateway-v*`:** SDK와 콘솔, 태그의 버전을 넣은 `rwd` 바이너리 네 개를 빌드하고(`rwd version`으로 확인해요), 이미지를 linux/amd64와 linux/arm64용으로 `<version>`, `<major>.<minor>`, `latest` 태그를 달아 GHCR에 푸시한 뒤(프리릴리스는 `<version>`만), 아카이브와 `checksums.txt`를 담은 GitHub Release를 만들어요.

Release 본문은 그 버전의 설치 방법 뒤에 영어와 중국어 변경 내역의 해당 섹션을 붙인 것이에요([`scripts/release/notes.mjs`](../scripts/release/notes.mjs)).

워크플로가 무엇이든 게시하기 전에 실패했다면, 태그를 지우고(`git push --delete origin <tag>`와 `git tag -d <tag>`) `main`에서 문제를 고친 뒤 다시 태그를 다세요. 이미 npm에 있는 버전은 다시 게시할 수 없으니, 그럴 때는 다음 패치 버전으로 릴리스하세요.

## 처음 한 번만 하는 설정

- **npm.** 워크플로는 [trusted publishing](https://docs.npmjs.com/trusted-publishers)(OIDC, 시크릿 없음)으로 게시해요. npmjs.com에서 패키지 설정 → Trusted publishing → GitHub Actions로 가서 저장소 `ZaneL1u/remote-webview-debugger`, 워크플로 `release.yml`을 지정하세요. npm은 토큰에 일회용 비밀번호를 요구하므로, 워크플로가 게시할 수 없는 버전(패키지가 생기기 전의 첫 버전 등)은 태그를 체크아웃한 상태에서 직접 게시해요: `npm login` 후 `cd sdk && npm ci && npm run build && npm publish --access public`. 그다음 실패한 워크플로 실행을 다시 돌리면 게시는 건너뛰고 GitHub Release를 만들어요.
- **GHCR.** 이미지는 첫 게이트웨이 릴리스 뒤에 저장소 소유자의 패키지 아래에 나타나요. 공개 저장소에 연결되어 있지만, 공개 상태인지 한 번 확인하세요(패키지 설정 → Change visibility).
