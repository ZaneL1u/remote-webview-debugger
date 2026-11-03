<!-- i18n-source: e110292ad2a3dca0ad4fca78a52a79f08f95af0b -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | [日本語](releasing.ja.md) | [한국어](releasing.ko.md) | Español | [Français](releasing.fr.md) | [Deutsch](releasing.de.md) | [Português (Brasil)](releasing.pt-BR.md) | [Русский](releasing.ru.md) | [العربية](releasing.ar.md)

# Publicación de versiones

El SDK de página y el gateway se publican por separado. Cada uno tiene su propia versión, su etiqueta y su registro de cambios, y su registro de cambios solo enumera los commits que tocaron sus propias rutas.

| | SDK de página | Gateway |
|---|---|---|
| Rutas | `sdk/`, `packages/chobitsu/` | `gateway/`, `console/`, `deploy/` |
| Etiqueta | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| Dónde vive la versión | `sdk/package.json` | la etiqueta (`make` la lee con `git describe`) |
| Registro de cambios | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md), [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md), [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| Se publica como | npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (jsDelivr, unpkg) | `rwd_<version>_<os>_<arch>.tar.gz` para linux / darwin × amd64 / arm64, imagen `ghcr.io/zanel1u/remote-webview-debugger` |

Un binario del gateway integra el SDK del mismo commit; la sección de su registro de cambios indica qué versión del SDK es.

## Publicar una versión

En una `main` actualizada y limpia, con la CI en verde:

```bash
make release-sdk ARGS=--dry-run     # vista previa: siguiente versión y las dos secciones del registro de cambios
make release-sdk                    # incrementa la versión, escribe los registros de cambios, hace commit y crea la etiqueta sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # la etiqueta lanza .github/workflows/release.yml
```

`make release-gateway` funciona igual. Nada sale de tu máquina hasta que haces push. Para deshacer una versión que aún no has subido: `git tag -d <tag> && git reset --hard HEAD~1`.

`ARGS` admite:

| Opción | Efecto |
|---|---|
| `--dry-run` | Muestra el resultado sin cambiar nada |
| `--major`, `--minor`, `--patch` | Fuerza el incremento en lugar de deducirlo de los commits |
| `--version X.Y.Z` | Versión exacta, p. ej. `0.3.0-rc.1` para una versión preliminar |
| `--edit` | Abre ambos registros de cambios en `$EDITOR` antes del commit |

El script es [`scripts/release/release.mjs`](../scripts/release/release.mjs); usa [changelogen](https://github.com/unjs/changelogen) para leer y analizar los commits.

## Versiones y registros de cambios

Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/). Desde la etiqueta anterior del componente:

- un cambio incompatible (`feat!:` o un pie `BREAKING CHANGE:`) incrementa la versión mayor, o la menor antes de la 1.0;
- `feat` incrementa la versión menor;
- `fix`, `perf`, `refactor`, `deploy`, `build` y `docs` incrementan la versión de parche.

Esos tipos son los que enumera el registro de cambios, del más antiguo al más reciente; `test`, `ci`, `chore` y los propios commits de publicación quedan fuera. Un scope igual al componente (`fix(sdk):` en el registro de cambios del SDK) se omite; los demás scopes se muestran. La primera versión de un componente conserva la versión que tiene, 0.1.0.

**Entradas en chino.** El registro de cambios en chino tiene los encabezados en chino. Cada entrada es el asunto del commit, salvo que el commit tenga un trailer `Changelog-Zh:`:

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

Si prefieres escribir o pulir las entradas en chino en el momento de publicar, usa `--edit`.

## Qué hace la CI con la etiqueta

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

- **`sdk-v*`:** comprueba que `sdk/package.json` tenga la versión de la etiqueta, compila, ejecuta `npm publish --provenance` salvo que esa versión ya esté en npm (una versión con `-` va a la dist-tag `next`) y crea una GitHub Release con `sdk.js`, `index.mjs`, `index.d.ts` y el tarball de npm. Las versiones del SDK no se marcan como la última versión del repositorio.
- **`gateway-v*`:** compila el SDK y la consola web, y los cuatro binarios `rwd` con la versión de la etiqueta (comprobada con `rwd version`), sube la imagen a GHCR para linux/amd64 y linux/arm64 como `<version>`, `<major>.<minor>` y `latest` (versiones preliminares: solo `<version>`) y crea una GitHub Release con los archivos comprimidos y `checksums.txt`.

El cuerpo de la Release es la sección correspondiente del registro de cambios en inglés y en chino ([`scripts/release/notes.mjs`](../scripts/release/notes.mjs)), precedida de las instrucciones de instalación de esa versión.

Si el workflow falla antes de publicar nada, borra la etiqueta (`git push --delete origin <tag>` y `git tag -d <tag>`), corrige el problema en `main` y vuelve a crear la etiqueta. Una versión que ya está en npm no se puede publicar por segunda vez: publica el siguiente parche en su lugar.

## Configuración inicial

- **npm.** El workflow publica con [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, sin secretos): en npmjs.com, ajustes del paquete → Trusted publishing → GitHub Actions, repositorio `ZaneL1u/remote-webview-debugger`, workflow `release.yml`. Al publicar con un token, npm pide una contraseña de un solo uso, así que una versión que el workflow no puede publicar (como la primera, antes de que exista el paquete) se publica a mano desde un checkout de la etiqueta: `cd sdk && npm ci && npm run build && npm publish --access public` después de `npm login`. Luego vuelve a ejecutar la ejecución fallida del workflow; se salta la publicación y crea la GitHub Release.
- **GHCR.** La imagen aparece entre los paquetes del propietario del repositorio tras la primera versión del gateway. Está vinculada al repositorio público; comprueba una vez que sea pública (ajustes del paquete → Change visibility).
