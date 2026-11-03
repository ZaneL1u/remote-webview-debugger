<!-- i18n-source: e110292ad2a3dca0ad4fca78a52a79f08f95af0b -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | 日本語 | [한국어](releasing.ko.md) | [Español](releasing.es.md) | [Français](releasing.fr.md) | [Deutsch](releasing.de.md) | [Português (Brasil)](releasing.pt-BR.md) | [Русский](releasing.ru.md) | [العربية](releasing.ar.md)

# リリース手順

ページ SDK とゲートウェイは別々にリリースします。それぞれが独自のバージョン、タグ、変更履歴を持ち、変更履歴にはそれぞれのパスに触れたコミットだけが載ります。

| | ページ SDK | ゲートウェイ |
|---|---|---|
| パス | `sdk/`、`packages/chobitsu/` | `gateway/`、`console/`、`deploy/` |
| タグ | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| バージョンの置き場所 | `sdk/package.json` | タグ（`make` が `git describe` で読み取ります） |
| 変更履歴 | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md)、[`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md)、[`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| 公開先 | npm の [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger)（jsDelivr、unpkg） | linux / darwin × amd64 / arm64 向けの `rwd_<version>_<os>_<arch>.tar.gz`、イメージ `ghcr.io/zanel1u/remote-webview-debugger` |

ゲートウェイのバイナリは同じコミットの SDK を埋め込んでいます。それがどの SDK バージョンかは、ゲートウェイの変更履歴の該当セクションに記載されます。

## リリースを作成する

CI が通っている、最新でクリーンな `main` で次を実行します：

```bash
make release-sdk ARGS=--dry-run     # プレビュー：次のバージョンと、両方の変更履歴のセクション
make release-sdk                    # バージョンを上げ、変更履歴を書き、コミットし、sdk-vX.Y.Z をタグ付け
git push origin main sdk-v0.2.0     # タグが .github/workflows/release.yml を起動する
```

`make release-gateway` も同じように動きます。push するまでは何も手元のマシンから出ていきません。まだ push していないリリースを取り消すには：`git tag -d <tag> && git reset --hard HEAD~1`。

`ARGS` に指定できるもの：

| オプション | 効果 |
|---|---|
| `--dry-run` | 内容を表示するだけで、何も変更しません |
| `--major`、`--minor`、`--patch` | コミットから導出せず、上げる桁を強制します |
| `--version X.Y.Z` | バージョンを正確に指定します。例えばプレリリースなら `0.3.0-rc.1` |
| `--edit` | コミット前に両方の変更履歴を `$EDITOR` で開きます |

スクリプトは [`scripts/release/release.mjs`](../scripts/release/release.mjs) で、コミットの読み取りと解析には [changelogen](https://github.com/unjs/changelogen) を使っています。

## バージョンと変更履歴

コミットは [Conventional Commits](https://www.conventionalcommits.org/) に従います。そのコンポーネントの前回のタグ以降について：

- 破壊的変更（`feat!:` または `BREAKING CHANGE:` フッター）はメジャーバージョンを上げます。1.0 より前はマイナーバージョンを上げます。
- `feat` はマイナーバージョンを上げます。
- `fix`、`perf`、`refactor`、`deploy`、`build`、`docs` はパッチバージョンを上げます。

変更履歴に載るのはこれらの種類で、古い順に並びます。`test`、`ci`、`chore` とリリースコミット自体は除外されます。コンポーネントと同じスコープ（SDK の変更履歴における `fix(sdk):`）は省かれ、それ以外のスコープは表示されます。コンポーネントの最初のリリースは、現在のバージョンである 0.1.0 のままになります。

**中国語のエントリ。** 中国語の変更履歴は見出しも中国語です。コミットに `Changelog-Zh:` トレーラーがない限り、エントリはコミットの件名になります：

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

リリース時に中国語のエントリを書いたり整えたりしたい場合は、`--edit` を使ってください。

## タグを受けて CI が行うこと

[`.github/workflows/release.yml`](../.github/workflows/release.yml)：

- **`sdk-v*`：** `sdk/package.json` のバージョンがタグと一致することを確認してビルドし、そのバージョンがまだ npm になければ `npm publish --provenance` を実行し（`-` を含むバージョンは `next` dist-tag に公開されます）、`sdk.js`、`index.mjs`、`index.d.ts` と npm の tarball を添えた GitHub Release を作成します。SDK のリリースはリポジトリの最新リリース（latest）としてはマークされません。
- **`gateway-v*`：** SDK と管理コンソール、タグのバージョンを埋め込んだ 4 つの `rwd` バイナリをビルドし（`rwd version` で確認します）、linux/amd64 と linux/arm64 向けのイメージを `<version>`、`<major>.<minor>`、`latest` として GHCR に push し（プレリリースは `<version>` のみ）、アーカイブと `checksums.txt` を添えた GitHub Release を作成します。

Release の本文は、そのバージョンのインストール手順に続けて、英語と中国語の変更履歴の該当セクションを並べたものです（[`scripts/release/notes.mjs`](../scripts/release/notes.mjs)）。

ワークフローが何かを公開する前に失敗した場合は、タグを削除し（`git push --delete origin <tag>` と `git tag -d <tag>`）、`main` で問題を修正してから、もう一度タグを付けてください。npm に公開済みのバージョンは二度と公開できないので、その場合は次のパッチバージョンをリリースしてください。

## 初回のみの設定

- **npm。** ワークフローは [trusted publishing](https://docs.npmjs.com/trusted-publishers)（OIDC、シークレット不要）で公開します。npmjs.com のパッケージ設定 → Trusted publishing → GitHub Actions で、リポジトリ `ZaneL1u/remote-webview-debugger`、ワークフロー `release.yml` を設定します。npm はトークンにワンタイムパスワードを要求するため、ワークフローで公開できないバージョン（パッケージが存在する前の最初のバージョンなど）は、`npm login` の後にタグをチェックアウトした状態から手動で公開します：`cd sdk && npm ci && npm run build && npm publish --access public`。その後、失敗したワークフローを再実行すると、公開をスキップして GitHub Release を作成します。
- **GHCR。** 最初のゲートウェイリリースの後、イメージはリポジトリオーナーのパッケージの下に現れます。イメージは公開リポジトリに紐付いています。公開設定になっているか一度確認してください（パッケージ設定 → Change visibility）。
