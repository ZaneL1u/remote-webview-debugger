<!-- i18n-source: e110292ad2a3dca0ad4fca78a52a79f08f95af0b -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | [日本語](releasing.ja.md) | [한국어](releasing.ko.md) | [Español](releasing.es.md) | Français | [Deutsch](releasing.de.md) | [Português (Brasil)](releasing.pt-BR.md) | [Русский](releasing.ru.md) | [العربية](releasing.ar.md)

# Publication des versions

Le SDK de page et la passerelle sont publiés séparément. Chacun a sa propre version, son tag et son journal des modifications, et ce journal ne liste que les commits qui ont touché ses propres chemins.

| | SDK de page | Passerelle |
|---|---|---|
| Chemins | `sdk/`, `packages/chobitsu/` | `gateway/`, `console/`, `deploy/` |
| Tag | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| Emplacement de la version | `sdk/package.json` | le tag (`make` le lit avec `git describe`) |
| Journal des modifications | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md), [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md), [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| Publié sous forme de | npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (jsDelivr, unpkg) | `rwd_<version>_<os>_<arch>.tar.gz` pour linux / darwin × amd64 / arm64, image `ghcr.io/zanel1u/remote-webview-debugger` |

Un binaire de la passerelle embarque le SDK du même commit ; la section correspondante de son journal des modifications indique de quelle version du SDK il s'agit.

## Publier une version

Sur une branche `main` propre et à jour, dont la CI est au vert :

```bash
make release-sdk ARGS=--dry-run     # aperçu : prochaine version et les deux sections du journal des modifications
make release-sdk                    # incrémente la version, écrit les journaux, commite, crée le tag sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # le tag déclenche .github/workflows/release.yml
```

`make release-gateway` fonctionne de la même façon. Rien ne quitte votre machine tant que vous n'avez pas poussé. Pour annuler une version que vous n'avez pas poussée : `git tag -d <tag> && git reset --hard HEAD~1`.

`ARGS` accepte :

| Option | Effet |
|---|---|
| `--dry-run` | Affiche, ne modifie rien |
| `--major`, `--minor`, `--patch` | Impose l'incrément au lieu de le déduire des commits |
| `--version X.Y.Z` | Version exacte, p. ex. `0.3.0-rc.1` pour une préversion |
| `--edit` | Ouvre les deux journaux des modifications dans `$EDITOR` avant le commit |

Le script est [`scripts/release/release.mjs`](../scripts/release/release.mjs) ; il utilise [changelogen](https://github.com/unjs/changelogen) pour lire et analyser les commits.

## Versions et journaux des modifications

Les commits suivent [Conventional Commits](https://www.conventionalcommits.org/). Depuis le tag précédent du composant :

- un changement incompatible (`feat!:` ou un pied de commit `BREAKING CHANGE:`) incrémente la version majeure, ou la mineure avant la 1.0 ;
- `feat` incrémente la version mineure ;
- `fix`, `perf`, `refactor`, `deploy`, `build` et `docs` incrémentent la version de correctif.

Ce sont ces types que liste le journal des modifications, du plus ancien au plus récent ; `test`, `ci`, `chore` et les commits de version eux-mêmes sont laissés de côté. Une portée égale au composant (`fix(sdk):` dans le journal du SDK) est omise, les autres portées sont affichées. La première version d'un composant garde la version qu'il a déjà, 0.1.0.

**Entrées en chinois.** Le journal des modifications en chinois a des titres en chinois. Une entrée reprend l'objet du commit, sauf si le commit comporte une ligne de pied `Changelog-Zh:` :

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

Pour rédiger ou retoucher plutôt les entrées en chinois au moment de la publication, utilisez `--edit`.

## Ce que fait la CI avec le tag

[`.github/workflows/release.yml`](../.github/workflows/release.yml) :

- **`sdk-v*` :** vérifie que `sdk/package.json` porte la version du tag, construit, lance `npm publish --provenance` sauf si cette version est déjà sur npm (une version contenant `-` va dans le dist-tag `next`), et crée une GitHub Release avec `sdk.js`, `index.mjs`, `index.d.ts` et l'archive npm. Les versions du SDK ne sont pas marquées comme la dernière version du dépôt.
- **`gateway-v*` :** construit le SDK et la console web, les quatre binaires `rwd` avec la version issue du tag (vérifiée avec `rwd version`), pousse l'image sur GHCR pour linux/amd64 et linux/arm64 sous `<version>`, `<major>.<minor>` et `latest` (préversions : `<version>` seulement), et crée une GitHub Release avec les archives et `checksums.txt`.

Le corps de la Release est la section correspondante des journaux des modifications anglais et chinois ([`scripts/release/notes.mjs`](../scripts/release/notes.mjs)), précédée des instructions d'installation de cette version.

Si le workflow échoue avant d'avoir publié quoi que ce soit, supprimez le tag (`git push --delete origin <tag>` et `git tag -d <tag>`), corrigez le problème sur `main` et recréez le tag. Une version déjà présente sur npm ne peut pas être publiée une seconde fois : publiez plutôt le correctif suivant.

## Configuration initiale

- **npm.** Le workflow publie avec le [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, sans secret) : sur npmjs.com, paramètres du paquet → Trusted publishing → GitHub Actions, dépôt `ZaneL1u/remote-webview-debugger`, workflow `release.yml`. npm exige d'un jeton un mot de passe à usage unique : une version que le workflow ne peut pas publier (comme la toute première, avant que le paquet n'existe) se publie donc à la main depuis une copie de travail du tag : `cd sdk && npm ci && npm run build && npm publish --access public` après `npm login`. Relancez ensuite l'exécution du workflow qui a échoué ; elle saute la publication et crée la GitHub Release.
- **GHCR.** L'image apparaît dans les paquets du propriétaire du dépôt après la première version de la passerelle. Elle est liée au dépôt public ; vérifiez une fois qu'elle est bien publique (paramètres du paquet → Change visibility).
