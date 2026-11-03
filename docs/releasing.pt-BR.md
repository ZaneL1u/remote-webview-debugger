<!-- i18n-source: e110292ad2a3dca0ad4fca78a52a79f08f95af0b -->
[English](releasing.md) | [简体中文](releasing.zh-CN.md) | [繁體中文](releasing.zh-TW.md) | [日本語](releasing.ja.md) | [한국어](releasing.ko.md) | [Español](releasing.es.md) | [Français](releasing.fr.md) | [Deutsch](releasing.de.md) | Português (Brasil) | [Русский](releasing.ru.md) | [العربية](releasing.ar.md)

# Publicação de versões

O SDK da página e o gateway são publicados separadamente. Cada um tem sua própria versão, tag e changelog, e o changelog de cada um lista apenas os commits que mexeram nos seus próprios caminhos.

| | SDK da página | Gateway |
|---|---|---|
| Caminhos | `sdk/`, `packages/chobitsu/` | `gateway/`, `console/`, `deploy/` |
| Tag | `sdk-vX.Y.Z` | `gateway-vX.Y.Z` |
| Onde fica a versão | `sdk/package.json` | a tag (o `make` a lê com `git describe`) |
| Changelog | [`sdk/CHANGELOG.md`](../sdk/CHANGELOG.md), [`.zh-CN.md`](../sdk/CHANGELOG.zh-CN.md) | [`gateway/CHANGELOG.md`](../gateway/CHANGELOG.md), [`.zh-CN.md`](../gateway/CHANGELOG.zh-CN.md) |
| Publicado como | npm [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) (jsDelivr, unpkg) | `rwd_<version>_<os>_<arch>.tar.gz` para linux / darwin × amd64 / arm64, imagem `ghcr.io/zanel1u/remote-webview-debugger` |

Um binário do gateway embute o SDK do mesmo commit; a seção do changelog dele diz qual versão do SDK é essa.

## Criando uma versão

Em uma `main` atualizada e limpa, com o CI verde:

```bash
make release-sdk ARGS=--dry-run     # prévia: próxima versão e as duas seções do changelog
make release-sdk                    # incrementa a versão, escreve os changelogs, faz o commit e cria a tag sdk-vX.Y.Z
git push origin main sdk-v0.2.0     # a tag dispara .github/workflows/release.yml
```

`make release-gateway` funciona do mesmo jeito. Nada sai da sua máquina até você fazer o push. Para desfazer uma versão que você ainda não enviou: `git tag -d <tag> && git reset --hard HEAD~1`.

`ARGS` aceita:

| Opção | Efeito |
|---|---|
| `--dry-run` | Exibe, sem mudar nada |
| `--major`, `--minor`, `--patch` | Força o tipo de incremento em vez de deduzi-lo dos commits |
| `--version X.Y.Z` | Versão exata, por exemplo `0.3.0-rc.1` para uma pré-versão |
| `--edit` | Abre os dois changelogs no `$EDITOR` antes do commit |

O script é [`scripts/release/release.mjs`](../scripts/release/release.mjs); ele usa o [changelogen](https://github.com/unjs/changelogen) para ler e analisar os commits.

## Versões e changelogs

Os commits seguem o [Conventional Commits](https://www.conventionalcommits.org/). Desde a tag anterior do componente:

- uma mudança incompatível (`feat!:` ou um rodapé `BREAKING CHANGE:`) incrementa a versão major, ou a minor antes da 1.0;
- `feat` incrementa a versão minor;
- `fix`, `perf`, `refactor`, `deploy`, `build` e `docs` incrementam a versão patch.

Esses tipos são o que o changelog lista, do mais antigo para o mais recente; `test`, `ci`, `chore` e os próprios commits de versão ficam de fora. Um escopo igual ao componente (`fix(sdk):` no changelog do SDK) é omitido; os demais escopos aparecem. A primeira versão de um componente mantém a versão que ele já tem, 0.1.0.

**Entradas em chinês.** O changelog em chinês tem títulos em chinês. Uma entrada é o assunto do commit, a não ser que o commit tenha um trailer `Changelog-Zh:`:

```
fix(sdk): the pill no longer covers the bottom bar

Changelog-Zh: 设备码胶囊不再遮住底栏
```

Para escrever ou revisar as entradas em chinês na hora de publicar a versão, use `--edit`.

## O que o CI faz com a tag

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

- **`sdk-v*`:** verifica se `sdk/package.json` tem a versão da tag, compila, executa `npm publish --provenance`, a menos que essa versão já esteja no npm (uma versão com `-` vai para a dist-tag `next`), e cria um GitHub Release com `sdk.js`, `index.mjs`, `index.d.ts` e o tarball do npm. As versões do SDK não são marcadas como a versão mais recente (latest) do repositório.
- **`gateway-v*`:** compila o SDK e o console, os quatro binários `rwd` com a versão da tag (verificada com `rwd version`), envia a imagem para o GHCR para linux/amd64 e linux/arm64 como `<version>`, `<major>.<minor>` e `latest` (pré-versões: apenas `<version>`) e cria um GitHub Release com os arquivos compactados e o `checksums.txt`.

O corpo do Release é a seção correspondente do changelog em inglês e em chinês ([`scripts/release/notes.mjs`](../scripts/release/notes.mjs)), depois das instruções de instalação daquela versão.

Se o workflow falhar antes de publicar qualquer coisa, apague a tag (`git push --delete origin <tag>` e `git tag -d <tag>`), corrija o problema na `main` e crie a tag de novo. Uma versão que já está no npm não pode ser publicada uma segunda vez: publique a próxima versão patch.

## Configuração inicial

- **npm.** O workflow publica com [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, sem segredo): em npmjs.com, configurações do pacote → Trusted publishing → GitHub Actions, repositório `ZaneL1u/remote-webview-debugger`, workflow `release.yml`. O npm exige uma senha de uso único (OTP) de um token, então uma versão que o workflow não consegue publicar (como a primeira, antes de o pacote existir) é publicada à mão a partir de um checkout da tag: `cd sdk && npm ci && npm run build && npm publish --access public` depois de `npm login`. Depois, rode de novo a execução do workflow que falhou; ela pula a publicação e cria o GitHub Release.
- **GHCR.** A imagem aparece nos pacotes do dono do repositório depois da primeira versão do gateway. Ela fica vinculada ao repositório público; confira uma vez se ela é pública (configurações do pacote → Change visibility).
