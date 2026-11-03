English | [简体中文](releasing.zh-CN.md)

# Releasing

The page SDK and the gateway are released separately. Each has its own version, tag and changelog, and its changelog lists only the commits that touched its own paths.

| | Page SDK | Gateway |
|---|---|---|
| Paths | `sdk/`, `packages/chobitsu/` | `gateway/`, `console/`, `deploy/` |
| Tag | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| Version lives in | `sdk/package.json` | the tag (`make` reads it with `git describe`) |
| Changelog | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md), [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md), [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| Published as | npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (jsDelivr, unpkg) | `rwd_<version>_<os>_<arch>.tar.gz` for linux / darwin × amd64 / arm64, image `ghcr.io/zanel1u/remote-webview-debugger` |

A gateway binary embeds the SDK of the same commit; its changelog section says which SDK version that is.

## Cutting a release

On an up-to-date, clean `main` whose CI is green:

```bash
make release-sdk ARGS=--dry-run     # preview: next version and both changelog sections
make release-sdk                    # bump, write the changelogs, commit, tag sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # the tag starts .github/workflows/release.yml
```

`make release-gateway` works the same way. Nothing leaves your machine until you push. To undo a release you have not pushed: `git tag -d <tag> && git reset --hard HEAD~1`.

`ARGS` takes:

| Option | Effect |
|---|---|
| `--dry-run` | Print, change nothing |
| `--major`, `--minor`, `--patch` | Force the bump instead of deriving it from the commits |
| `--version X.Y.Z` | Exact version, e.g. `0.3.0-rc.1` for a prerelease |
| `--edit` | Open both changelogs in `$EDITOR` before committing |

The script is [`scripts/release/release.mjs`](../scripts/release/release.mjs); it uses [changelogen](https://github.com/unjs/changelogen) to read and parse the commits.

## Versions and changelogs

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Since the component's previous tag:

- a breaking change (`feat!:` or a `BREAKING CHANGE:` footer) bumps the major version, or the minor one before 1.0;
- `feat` bumps the minor version;
- `fix`, `perf`, `refactor`, `deploy`, `build` and `docs` bump the patch version.

Those types are what the changelog lists, oldest first; `test`, `ci`, `chore` and the release commits themselves are left out. A scope equal to the component (`fix(sdk):` in the SDK changelog) is dropped, other scopes are shown. The first release of a component keeps the version it has, 0.1.0.

**Chinese entries.** The Chinese changelog has Chinese headings. An entry is the commit subject unless the commit has a `Changelog-Zh:` trailer:

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

To write or polish the Chinese entries at release time instead, use `--edit`.

## What CI does with the tag

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

- **`sdk-v*`:** checks that `sdk/package.json` has the tag's version, builds, runs `npm publish --provenance` unless that version is already on npm (a version with `-` goes to the `next` dist-tag), and creates a GitHub Release with `sdk.js`, `index.mjs`, `index.d.ts` and the npm tarball. SDK releases are not marked as the repository's latest release.
- **`gateway-v*`:** builds the SDK and the console, the four `rwd` binaries with the version from the tag (checked with `rwd version`), pushes the image to GHCR for linux/amd64 and linux/arm64 as `<version>`, `<major>.<minor>` and `latest` (prereleases: `<version>` only), and creates a GitHub Release with the archives and `checksums.txt`.

The Release body is the matching section of the English and the Chinese changelog ([`scripts/release/notes.mjs`](../scripts/release/notes.mjs)), after install instructions for that version.

If the workflow fails before publishing anything, delete the tag (`git push --delete origin <tag>` and `git tag -d <tag>`), fix the problem on `main`, and tag again. A version already on npm can't be published a second time: release the next patch instead.

## One-time setup

- **npm.** The workflow publishes with [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no secret): on npmjs.com, package settings → Trusted publishing → GitHub Actions, repository `ZaneL1u/remote-webview-debugger`, workflow `release.yml`. npm asks a token for a one-time password, so a version the workflow can't publish (such as the first one, before the package exists) is published by hand from the tag's checkout: `cd sdk && npm ci && npm run build && npm publish --access public` after `npm login`. Re-run the failed workflow run afterwards; it skips the publish and creates the GitHub Release.
- **GHCR.** The image appears under the repository owner's packages after the first gateway release. It is linked to the public repository; check once that it is public (package settings → Change visibility).
