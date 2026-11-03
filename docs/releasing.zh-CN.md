[English](releasing.md) | 简体中文

# 发版流程

页面 SDK 和网关分开发版，各有自己的版本号、tag 和更新日志，更新日志里只列出改动了各自路径的提交。

| | 页面 SDK | 网关 |
|---|---|---|
| 路径 | `sdk/`、`packages/chobitsu/` | `gateway/`、`console/`、`deploy/` |
| tag | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| 版本号记录在 | `sdk/package.json` | tag 本身（`make` 用 `git describe` 读取） |
| 更新日志 | [`sdk/CHANGELOG.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md)、[英文版](../sdk/CHANGELOG.md) | [`gateway/CHANGELOG.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md)、[英文版](../gateway/CHANGELOG.md) |
| 发布为 | npm 包 [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)（jsDelivr、unpkg） | linux / darwin × amd64 / arm64 的 `rwd_<版本号>_<os>_<arch>.tar.gz`，镜像 `ghcr.io/zanel1u/remote-webview-debugger` |

网关二进制内嵌的是同一个提交里的 SDK，它的更新日志会写明对应的 SDK 版本。

## 发一个版本

在最新、干净、CI 全绿的 `main` 上：

```bash
make release-sdk ARGS=--dry-run     # 预览：下一个版本号和两份更新日志的新段落
make release-sdk                    # 升版本、写更新日志、提交、打 tag sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # 推送 tag 触发 .github/workflows/release.yml
```

`make release-gateway` 用法相同。推送之前一切都只在本地。撤销一个还没推送的版本：`git tag -d <tag> && git reset --hard HEAD~1`。

`ARGS` 支持：

| 选项 | 作用 |
|---|---|
| `--dry-run` | 只打印，不改任何东西 |
| `--major`、`--minor`、`--patch` | 指定升级幅度，不按提交推断 |
| `--version X.Y.Z` | 指定版本号，例如预发布版 `0.3.0-rc.1` |
| `--edit` | 提交前用 `$EDITOR` 打开两份更新日志 |

脚本是 [`scripts/release/release.mjs`](../scripts/release/release.mjs)，用 [changelogen](https://github.com/unjs/changelogen) 读取和解析提交。

## 版本号与更新日志

提交遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)。从该组件上一个 tag 起：

- 不兼容变更（`feat!:` 或 `BREAKING CHANGE:` 脚注）升主版本号，1.0 之前升次版本号；
- `feat` 升次版本号；
- `fix`、`perf`、`refactor`、`deploy`、`build`、`docs` 升修订号。

更新日志只列这些类型，按时间从早到晚；`test`、`ci`、`chore` 和发版提交本身不列。与组件同名的 scope（SDK 日志里的 `fix(sdk):`）会省略，其他 scope 照常显示。组件的第一次发版沿用现有版本号 0.1.0。

**中文条目。** 中文更新日志的标题是中文的；条目默认是提交标题，如果提交里有 `Changelog-Zh:` 脚注就用它：

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

也可以在发版时加 `--edit`，手动补写或润色中文条目。

## 推送 tag 之后 CI 做什么

[`.github/workflows/release.yml`](../.github/workflows/release.yml)：

- **`sdk-v*`：** 检查 `sdk/package.json` 的版本号与 tag 一致，构建，执行 `npm publish --provenance`（版本号带 `-` 的发到 `next` dist-tag），然后创建 GitHub Release，附上 `sdk.js`、`index.mjs`、`index.d.ts` 和 npm 包文件。SDK 的 Release 不会被标为仓库的最新版本。
- **`gateway-v*`：** 构建 SDK 和控制台，再用 tag 里的版本号构建四个 `rwd` 二进制（用 `rwd version` 校验），把 linux/amd64 和 linux/arm64 镜像推到 GHCR，tag 为 `<版本号>`、`<主版本>.<次版本>` 和 `latest`（预发布版只有 `<版本号>`），最后创建 GitHub Release，附上压缩包和 `checksums.txt`。

Release 正文是该版本的安装方式，加上英文和中文更新日志里对应的段落（[`scripts/release/notes.mjs`](../scripts/release/notes.mjs)）。

如果工作流在发布任何东西之前就失败了：删掉 tag（`git push --delete origin <tag>` 和 `git tag -d <tag>`），在 `main` 上修好，再重新打 tag。已经发到 npm 的版本号不能再发一次，只能发下一个修订版。

## 一次性设置

- **npm。** 第一次发布需要 token：在 npmjs.com 创建一个能发布 `remote-webview-debugger` 的 granular access token，存为仓库 secret `NPM_TOKEN`。包创建之后，在 npmjs.com 给它添加 trusted publisher（包设置 → Trusted publishing → GitHub Actions，仓库 `ZaneL1u/remote-webview-debugger`，工作流 `release.yml`），然后删掉这个 secret，之后工作流就通过 OIDC 发布。
- **GHCR。** 第一次网关发版后，镜像出现在仓库所有者的 packages 里，默认是私有的。到包设置里改成公开（Change visibility），只需一次。
