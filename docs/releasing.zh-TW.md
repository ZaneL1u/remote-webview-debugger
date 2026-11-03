<!-- i18n-source: 9be9df7e70f41a674848b25979f1ef7cb1f96f33 -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | 繁體中文 | [日本語](releasing.ja.md) | [Español](releasing.es.md) | [Français](releasing.fr.md) | [Русский](releasing.ru.md) | [العربية](releasing.ar.md)

# 發布流程

頁面 SDK 和閘道分開發布，各有自己的版本號、tag 和變更記錄，而且各自的變更記錄只列出動到自己路徑的 commit。

| | 頁面 SDK | 閘道 |
|---|---|---|
| 路徑 | `sdk/`、`packages/chobitsu/` | `gateway/`、`console/`、`deploy/` |
| tag | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| 版本號記錄在 | `sdk/package.json` | tag 本身（`make` 以 `git describe` 讀取） |
| 變更記錄 | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md)、[`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md)、[`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| 發布形式 | npm 套件 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)（jsDelivr、unpkg） | linux / darwin × amd64 / arm64 的 `rwd_<版本號>_<os>_<arch>.tar.gz`，映像檔 `ghcr.io/zanel1u/remote-webview-debugger` |

閘道執行檔內嵌的是同一個 commit 的 SDK；它的變更記錄段落會註明對應的 SDK 版本。

## 發布一個版本

在已更新到最新、工作目錄乾淨且 CI 全部通過的 `main` 上：

```bash
make release-sdk ARGS=--dry-run     # 預覽：下一個版本號和兩份變更記錄的新段落
make release-sdk                    # 提升版本、寫入變更記錄、commit、打上 tag sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # 推送 tag 會觸發 .github/workflows/release.yml
```

`make release-gateway` 的用法相同。在你推送之前，一切都只留在本機。要撤銷一個尚未推送的版本：`git tag -d <tag> && git reset --hard HEAD~1`。

`ARGS` 可接受：

| 選項 | 作用 |
|---|---|
| `--dry-run` | 只印出結果，不做任何更動 |
| `--major`、`--minor`、`--patch` | 強制指定提升幅度，而不是從 commit 推斷 |
| `--version X.Y.Z` | 指定確切版本，例如預發布版 `0.3.0-rc.1` |
| `--edit` | commit 之前先用 `$EDITOR` 開啟兩份變更記錄 |

指令碼是 [`scripts/release/release.mjs`](../scripts/release/release.mjs)；它使用 [changelogen](https://github.com/unjs/changelogen) 讀取並解析 commit。

## 版本號與變更記錄

commit 遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hant/)。從該元件上一個 tag 起算：

- 破壞性變更（`feat!:` 或 `BREAKING CHANGE:` 註腳）提升主版本號，1.0 之前則提升次版本號；
- `feat` 提升次版本號；
- `fix`、`perf`、`refactor`、`deploy`、`build` 和 `docs` 提升修訂號。

變更記錄只列出這些類型，依時間由舊到新排列；`test`、`ci`、`chore` 以及發布 commit 本身不會列出。與元件同名的 scope（SDK 變更記錄裡的 `fix(sdk):`）會省略，其他 scope 照常顯示。元件第一次發布時沿用現有的版本號 0.1.0。

**中文條目。** 中文變更記錄使用中文標題。條目預設就是 commit 標題，除非 commit 帶有 `Changelog-Zh:` 註腳：

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

如果想在發布時才撰寫或潤飾中文條目，請改用 `--edit`。

## CI 拿到 tag 之後做什麼

[`.github/workflows/release.yml`](../.github/workflows/release.yml)：

- **`sdk-v*`：** 檢查 `sdk/package.json` 的版本號與 tag 一致，接著建置；如果這個版本還不在 npm 上，就執行 `npm publish --provenance`（版本號含 `-` 的會發布到 `next` dist-tag），然後建立 GitHub Release，附上 `sdk.js`、`index.mjs`、`index.d.ts` 和 npm tarball。SDK 的 Release 不會被標為儲存庫的最新版本。
- **`gateway-v*`：** 建置 SDK 和主控台，再以 tag 中的版本號建置四個 `rwd` 執行檔（以 `rwd version` 驗證），把 linux/amd64 和 linux/arm64 的映像檔推送到 GHCR，tag 為 `<version>`、`<major>.<minor>` 和 `latest`（預發布版只有 `<version>`），最後建立 GitHub Release，附上壓縮檔和 `checksums.txt`。

Release 內文先是該版本的安裝說明，接著是英文和中文變更記錄中對應的段落（[`scripts/release/notes.mjs`](../scripts/release/notes.mjs)）。

如果工作流程在發布任何東西之前就失敗了，請刪除 tag（`git push --delete origin <tag>` 和 `git tag -d <tag>`），在 `main` 上修正問題，再重新打 tag。已經發布到 npm 的版本號無法再發布第二次：請改為發布下一個修訂版。

## 一次性設定

- **npm。** 工作流程以 [trusted publishing](https://docs.npmjs.com/trusted-publishers)（OIDC，不需要 secret）發布：在 npmjs.com 的套件設定 → Trusted publishing → GitHub Actions，填入儲存庫 `ZaneL1u/remote-webview-debugger`、工作流程 `release.yml`。用 token 發布時 npm 會要求一次性密碼，所以工作流程無法發布的版本（例如套件尚不存在時的第一個版本）要從該 tag 的 checkout 手動發布：先 `npm login`，再執行 `cd sdk && npm ci && npm run build && npm publish --access public`。之後重新執行那次失敗的工作流程；它會跳過發布，只建立 GitHub Release。
- **GHCR。** 第一次發布閘道之後，映像檔會出現在儲存庫擁有者的 packages 底下。它會連結到公開的儲存庫；確認一次它是公開的即可（套件設定 → Change visibility）。
