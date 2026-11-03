<!-- i18n-source: e110292ad2a3dca0ad4fca78a52a79f08f95af0b -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | [日本語](releasing.ja.md) | [한국어](releasing.ko.md) | [Español](releasing.es.md) | [Français](releasing.fr.md) | Deutsch | [Português (Brasil)](releasing.pt-BR.md) | [Русский](releasing.ru.md) | [العربية](releasing.ar.md)

# Releases erstellen

Das Seiten-SDK und das Gateway werden getrennt veröffentlicht. Jedes hat seine eigene Version, sein eigenes Tag und sein eigenes Changelog, und sein Changelog listet nur die Commits auf, die seine eigenen Pfade berührt haben.

| | Seiten-SDK | Gateway |
|---|---|---|
| Pfade | `sdk/`, `packages/chobitsu/` | `gateway/`, `console/`, `deploy/` |
| Tag | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| Version steht in | `sdk/package.json` | dem Tag (`make` liest es mit `git describe`) |
| Changelog | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md), [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md), [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| Veröffentlicht als | npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (jsDelivr, unpkg) | `rwd_<version>_<os>_<arch>.tar.gz` für linux / darwin × amd64 / arm64, Image `ghcr.io/zanel1u/remote-webview-debugger` |

Ein Gateway-Binary bettet das SDK desselben Commits ein; sein Changelog-Abschnitt nennt die zugehörige SDK-Version.

## Ein Release erstellen

Auf einem aktuellen, sauberen `main` mit grüner CI:

```bash
make release-sdk ARGS=--dry-run     # Vorschau: nächste Version und beide Changelog-Abschnitte
make release-sdk                    # Version erhöhen, Changelogs schreiben, committen, sdk-vX.Y.Z taggen
git push origin main sdk-v0.2.0     # das Tag startet .github/workflows/release.yml
```

`make release-gateway` funktioniert genauso. Nichts verlässt Ihren Rechner, bevor Sie pushen. Um ein Release rückgängig zu machen, das Sie noch nicht gepusht haben: `git tag -d <tag> && git reset --hard HEAD~1`.

`ARGS` akzeptiert:

| Option | Wirkung |
|---|---|
| `--dry-run` | Ausgeben, nichts ändern |
| `--major`, `--minor`, `--patch` | Die Erhöhung erzwingen, statt sie aus den Commits abzuleiten |
| `--version X.Y.Z` | Exakte Version, z. B. `0.3.0-rc.1` für eine Vorabversion |
| `--edit` | Beide Changelogs vor dem Commit in `$EDITOR` öffnen |

Das Script ist [`scripts/release/release.mjs`](../scripts/release/release.mjs); es verwendet [changelogen](https://github.com/unjs/changelogen), um die Commits zu lesen und zu parsen.

## Versionen und Changelogs

Commits folgen den [Conventional Commits](https://www.conventionalcommits.org/). Seit dem vorherigen Tag der Komponente gilt:

- Eine Breaking Change (`feat!:` oder eine `BREAKING CHANGE:`-Fußzeile) erhöht die Major-Version, vor 1.0 die Minor-Version;
- `feat` erhöht die Minor-Version;
- `fix`, `perf`, `refactor`, `deploy`, `build` und `docs` erhöhen die Patch-Version.

Diese Typen listet das Changelog auf, die ältesten zuerst; `test`, `ci`, `chore` und die Release-Commits selbst werden weggelassen. Ein Scope, der der Komponente entspricht (`fix(sdk):` im SDK-Changelog), entfällt, andere Scopes werden angezeigt. Das erste Release einer Komponente behält die Version, die sie hat: 0.1.0.

**Chinesische Einträge.** Das chinesische Changelog hat chinesische Überschriften. Ein Eintrag ist der Betreff des Commits, sofern der Commit keinen `Changelog-Zh:`-Trailer hat:

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

Um die chinesischen Einträge stattdessen beim Release zu schreiben oder zu überarbeiten, verwenden Sie `--edit`.

## Was die CI mit dem Tag macht

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

- **`sdk-v*`:** prüft, dass `sdk/package.json` die Version des Tags hat, baut, führt `npm publish --provenance` aus, sofern diese Version nicht schon auf npm liegt (eine Version mit `-` geht an das Dist-Tag `next`), und erstellt ein GitHub Release mit `sdk.js`, `index.mjs`, `index.d.ts` und dem npm-Tarball. SDK-Releases werden nicht als neuestes Release des Repositorys markiert.
- **`gateway-v*`:** baut das SDK und die Konsole, die vier `rwd`-Binaries mit der Version aus dem Tag (geprüft mit `rwd version`), pusht das Image für linux/amd64 und linux/arm64 als `<version>`, `<major>.<minor>` und `latest` nach GHCR (Vorabversionen: nur `<version>`) und erstellt ein GitHub Release mit den Archiven und `checksums.txt`.

Der Text des Releases ist der passende Abschnitt aus dem englischen und dem chinesischen Changelog ([`scripts/release/notes.mjs`](../scripts/release/notes.mjs)), nach einer Installationsanleitung für diese Version.

Schlägt der Workflow fehl, bevor etwas veröffentlicht wurde, löschen Sie das Tag (`git push --delete origin <tag>` und `git tag -d <tag>`), beheben das Problem auf `main` und taggen erneut. Eine Version, die bereits auf npm liegt, kann kein zweites Mal veröffentlicht werden: Veröffentlichen Sie stattdessen den nächsten Patch.

## Einmalige Einrichtung

- **npm.** Der Workflow veröffentlicht per [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, kein Secret): auf npmjs.com unter Paketeinstellungen → Trusted publishing → GitHub Actions, Repository `ZaneL1u/remote-webview-debugger`, Workflow `release.yml`. npm verlangt von einem Token ein Einmalpasswort; eine Version, die der Workflow nicht veröffentlichen kann (etwa die erste, bevor das Paket existiert), wird daher von Hand aus dem Checkout des Tags veröffentlicht: `cd sdk && npm ci && npm run build && npm publish --access public` nach `npm login`. Führen Sie anschließend den fehlgeschlagenen Workflow-Lauf erneut aus; er überspringt die Veröffentlichung und erstellt das GitHub Release.
- **GHCR.** Das Image erscheint nach dem ersten Gateway-Release unter den Paketen des Repository-Inhabers. Es ist mit dem öffentlichen Repository verknüpft; prüfen Sie einmal, dass es öffentlich ist (Paketeinstellungen → Change visibility).
