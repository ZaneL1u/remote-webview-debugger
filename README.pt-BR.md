<!-- i18n-source: 17d2a3687452758f5c2d903bfc5e90dd1d96013b -->
<div align="center">

# Remote WebView Debugger

**Deixe agentes de IA depurarem as WebViews do seu app e as suas páginas H5 — nos celulares de usuários reais, remotamente, via MCP.**

[debugger.site](https://debugger.site) · [Demo ao vivo](https://debugger.site/#demo) · [Documentação](docs/architecture.pt-BR.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | Português (Brasil) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

Um bug que só acontece no celular de um usuário, dentro de um superapp no estilo do WeChat ou na WebView do seu próprio app, é o tipo mais difícil de depurar: sem cabo USB, sem porta de depuração remota, sem como reproduzir na sua máquina. O Remote WebView Debugger coloca essa página diante do seu agente de IA.

- **Uma tag script** (ou uma injeção nativa) coloca a página online. O usuário vê uma pequena pílula com o código do dispositivo e pode tocar em *Solicitar assistência*.
- **Seu agente se conecta via MCP** — Claude Code, Cursor ou qualquer cliente MCP — depois que o usuário aprova no dispositivo. Ele lê snapshots de acessibilidade, console, rede e capturas de tela, e clica, digita e rola como uma pessoa, em todas as páginas e WebViews daquele dispositivo.
- **O Chrome DevTools de verdade para pessoas.** A partir do console, um admin abre o DevTools em qualquer página online — Elements, Console, Network (com o que aconteceu antes dele abrir) e o armazenamento do Application — depois que o usuário aprova no dispositivo.
- **O usuário continua no controle.** Ele vê o que a IA está fazendo (o cursor do agente, um cartão de tarefa com os passos planejados, uma borda luminosa) e pode assumir o controle ou encerrar a sessão a qualquer momento. Senhas e números de telefone e de cartão são mascarados antes de qualquer coisa sair do celular.
- **Auto-hospedado.** Um único binário Go com o console e o SDK embutidos; SQLite ou Postgres.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## Início rápido

Três passos: execute o gateway, adicione o SDK a uma página e aponte seu agente para o gateway.

### 1. Execute o gateway

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

Abra `http://<your-host>:8080` e entre como **`admin`** com essa senha. Se você omitir `RWD_ADMIN_PASSWORD`, uma senha aleatória é exibida uma única vez em `docker logs rwd`. A imagem é baseada em Alpine (linux/amd64 e linux/arm64), embute o console e o SDK e guarda tudo no volume `rwd-data`; para atualizar, faça `docker pull` da nova tag e recrie o contêiner.

Configurações que talvez você queira, passadas com `-e` ([todas as configurações](gateway/README.pt-BR.md)):

| Variável | Para que serve |
|---|---|
| `RWD_ADMIN_EMAIL` | Nome de login do proprietário (padrão `admin`) |
| `RWD_PUBLIC_URL` | O endereço que celulares e agentes usam, por exemplo `https://rwd.example.com/v1`, quando ele é diferente do que aparece no seu navegador |
| `RWD_LANG=zh` | Descrições e resultados das ferramentas MCP em chinês |
| `RWD_DATABASE_URL` | `postgres://…` para usar Postgres em vez de SQLite |
| `RWD_TRUST_PROXY=1` | Somente atrás do seu próprio proxy reverso: obtém o IP do cliente e o esquema de `X-Forwarded-*` |

<details>
<summary>Outras formas de executar: binários, Docker Compose com HTTPS, a partir do código-fonte</summary>

- **Binário.** Cada versão do gateway no [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) tem `rwd_<version>_<os>_<arch>.tar.gz` para Linux e macOS: descompacte e execute `./rwd serve --addr :8080`.
- **Docker Compose.** [`deploy/platform`](deploy/platform/README.pt-BR.md) coloca um Caddy na frente: atrás do seu próprio proxy TLS, ou servindo HTTPS ele mesmo com um certificado Let's Encrypt (`RWD_DOMAIN=<host>`).
- **A partir do código-fonte.** `make -j16` (requer Go e Node), depois `gateway/bin/rwd-<os>-<arch> serve --addr :8080`.

</details>

### 2. Coloque uma página online

Crie um projeto no console para obter uma chave do app e adicione o SDK com o endereço do seu gateway:

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

O SDK é o pacote npm [`remote-webview-debugger`](sdk/README.pt-BR.md): carregue-o do jsDelivr como acima ou do unpkg (`https://unpkg.com/remote-webview-debugger@0.3.0/dist/sdk.js`), ou rode `npm install remote-webview-debugger` e `import { run } from 'remote-webview-debugger'`. Seu gateway também serve a cópia que ele embute em `/v1/sdk.js`.

Em um app, injete o mesmo script no início do documento a partir do código nativo (iOS `WKUserScript`, Android `addDocumentStartJavaScript`): veja a [integração nativa](docs/native-integration.pt-BR.md) e o guia embutido no console.

### 3. Conecte seu agente

Crie uma chave de API no console (uma chave alcança todos os dispositivos) e depois:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…e peça: *“Conecte-se ao dispositivo K7Q2-9M4X e descubra por que o total do checkout aparece como `--`.”*

### HTTP ou HTTPS?

O gateway fala HTTP simples e funciona bem assim: o SDK escolhe `ws://` ou `wss://` pelo endereço do gateway, e o console e o MCP funcionam com qualquer um dos dois. Quem decide é **a página que você depura**. Navegadores e WebViews não deixam uma página `https://` carregar scripts `http://` nem abrir conexões `ws://` (conteúdo misto), mesmo quando o próprio `sdk.js` vem da CDN em HTTPS.

| A página que você depura | Gateway em HTTP simples |
|---|---|
| `http://`: servidor de desenvolvimento local, ambiente de teste na intranet | ✅ Funciona |
| `https://` em um navegador ou em um `WKWebView` do iOS | ❌ Bloqueado como conteúdo misto: dê HTTPS ao gateway |
| `https://` em uma WebView do Android | ⚠️ Só se o app chamar `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`, e apenas em builds de debug |

Em HTTP simples, as chaves de API e as senhas do console trafegam sem criptografia, então use apenas em uma rede de confiança. Para ter HTTPS, rode a [stack do Compose](deploy/platform/README.pt-BR.md) com `RWD_DOMAIN=<host>` (certificado automático), ou coloque o contêiner atrás do seu próprio proxy TLS e adicione `-e RWD_TRUST_PROXY=1`.

## Recursos

- **Centrado no dispositivo.** Um dispositivo (uma instalação do app ou um navegador) tem muitas páginas; uma chave de API e um servidor MCP alcançam todos os dispositivos. O agente acompanha as navegações e as WebViews recém-abertas e vê uma linha do tempo que abrange todas as páginas.
- **Ferramentas do agente.** Snapshots de acessibilidade com refs de elementos (o aria snapshot do Playwright), find, click, fill, type, press, select, hover, scroll, drag, navigate, evaluate, console, rede com corpos, armazenamento, capturas de tela (bridge nativa ou DOM), ações em lote, esperas e eventos.
- **Consentimento e controle.** Aprovação no dispositivo com níveis (`observe` / `interact` / `advanced`), permissão automática opcional, bloqueio de tela enquanto o agente opera, assumir o controle / devolver à IA / encerrar, confirmação para ações sensíveis (`data-rwd-confirm`).
- **Privacidade.** Campos de senha, `data-rwd-mask` e seletores / padrões configuráveis são mascarados em snapshots, capturas de tela, console e dados de rede. O log de auditoria registra quem fez o quê, sem o conteúdo das páginas.
- **Operação.** Membros e papéis, chaves de API com nível / validade / lista de IPs permitidos, tokens do dispositivo, convites por QR code, cotas, console ao vivo via SSE, métricas do Prometheus.
- **11 idiomas e seus próprios estilos.** Console, interface do celular e textos para o agente em inglês, chinês simplificado e tradicional, francês, espanhol, russo, árabe (da direita para a esquerda), japonês, coreano, alemão e português: o console segue o navegador (com seletor de idioma), a interface do celular segue o celular ou `run({ lang })`, e o lado do agente segue `RWD_LANG`. O SDK da página aceita seus próprios pacotes de idioma e textos, e muda de estilo com variáveis CSS ([idiomas e estilos do SDK](sdk/README.pt-BR.md#idiomas)).
- **Combina bem com o eruda.** Aba opcional Remote Debugger dentro do eruda; pode carregar o eruda sob demanda para desenvolvedores.

## Estrutura do repositório

| Caminho | O que é |
|---|---|
| [`gateway/`](gateway) | Gateway em Go: WebSocket das páginas, REST e autenticação do console, servidor MCP, auditoria, métricas |
| [`sdk/`](sdk) | SDK da página (`sdk.js`) e sua interface dentro da página |
| [`packages/chobitsu/`](packages/chobitsu) | Cópia incorporada (vendored) do [chobitsu](https://github.com/liriliri/chobitsu) mais o nosso motor do lado da página em `src/engine/` |
| [`console/`](console) | Console web (React, Vite) |
| [`website/`](website) | [debugger.site](https://debugger.site), com a demo interativa |
| [`examples/`](examples) | Uma loja de demonstração com várias páginas e um app macOS que hospeda WKWebViews como um app iOS |
| [`deploy/platform/`](deploy/platform) | Implantação com Docker Compose |
| [`docs/`](docs) | [Arquitetura](docs/architecture.pt-BR.md), [protocolo](docs/protocol.pt-BR.md), [integração nativa](docs/native-integration.pt-BR.md), [publicação de versões](docs/releasing.pt-BR.md) |

## Versões

O SDK da página e o gateway são publicados separadamente, cada um com sua própria versão, tag (`sdk-vX.Y.Z`, `gateway-vX.Y.Z`) e changelog: [SDK](sdk/CHANGELOG.md), [gateway](gateway/CHANGELOG.md). Cada versão do gateway vem com binários `rwd` para Linux e macOS e com a imagem `ghcr.io/zanel1u/remote-webview-debugger`. Veja o [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) e, para mantenedores, [publicação de versões](docs/releasing.pt-BR.md).

## Desenvolvimento

```bash
make -j16 check                                      # testes do gateway, typecheck + testes Playwright do SDK, build do console
cd console && PORT=8080 npm run mock & npm run dev   # console contra um gateway simulado em memória
cd website && npm run dev                            # o site
```

## Agradecimentos

O motor do lado da página se apoia no [chobitsu](https://github.com/liriliri/chobitsu) (MIT) para a captura de console e de rede, e usa o código de snapshot de acessibilidade do [Playwright](https://github.com/microsoft/playwright) (Apache-2.0). O DevTools do console é o frontend do Chrome DevTools, prebuilt pelo [chii](https://github.com/liriliri/chii) (MIT; o próprio DevTools é BSD-3-Clause). Veja o [NOTICE](NOTICE).

## Licença

[MIT](LICENSE)
