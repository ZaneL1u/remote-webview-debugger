<!-- i18n-source: 01d1f8a551ff976520e185700fb811f2c8fdcf56 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | Português (Brasil) | [Русский](README.ru.md) | [العربية](README.ar.md)

# SDK da página do RWD (`sdk/`)

Um único arquivo JS que uma WebView de app ou uma página H5 carrega para que um agente de IA possa inspecionar e operar a página pelo gateway do RWD (`gateway/`) e pelo MCP. Protocolo: [`docs/protocol.pt-BR.md`](../docs/protocol.pt-BR.md); arquitetura: [`docs/architecture.pt-BR.md`](../docs/architecture.pt-BR.md).

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // opcional
    deviceId: "…",               // opcional; passado por um host nativo que injeta o SDK
    helpButton: true,            // opcional; mostra o botão "Solicitar assistência"
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // opcional; uma tag de idioma, por padrão vem dos idiomas do navegador
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## Como obter o SDK

Publicado no npm como [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger); versões e mudanças: [CHANGELOG](CHANGELOG.md).

| Uso | Onde |
|---|---|
| `<script>` de uma CDN | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.2.0/dist/sdk.js` ou `https://unpkg.com/remote-webview-debugger@0.2.0/dist/sdk.js` (IIFE minificado, global `RemoteWebviewDebugger`; fixe a versão e, se quiser, adicione `integrity`) |
| Um bundler | `npm install remote-webview-debugger` e depois `import { run, status } from 'remote-webview-debugger'` (módulo ES com tipos). Importe-o antes do seu próprio código para que a captura comece cedo. Não carregue também a versão `<script>` na mesma página |
| O seu gateway | `https://<gateway>/v1/sdk.js`, a cópia embutida no gateway (também disponível numa URL endereçada por conteúdo para SRI, oferecida pelo console) |
| Um app nativo | Empacote o `dist/sdk.js` do pacote ou baixe-o de uma das opções acima; veja [integração nativa](../docs/native-integration.pt-BR.md) |

## API

| API | Descrição |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | Coloca a página online (código do dispositivo, pílula). Retorna `Promise<{deviceCode, status}>`; chamar de novo não tem efeito colateral. Opções abaixo. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`; `status` é `idle / connecting / online / polling / stopped / rejected / quota`, `lang` é o idioma da interface (`null` antes de `run()`), `logSession` é o log da sessão em que esta página grava (`null` quando não está gravando) |
| `stop()` | Desconecta e remove a interface (a coleta de console / rede continua, com limite) |
| `setUser(userId)` | Troca o usuário; reconecta uma vez com um novo `hello` |
| `help(on)` | Solicita assistência / cancela a solicitação |
| `nativeControl(nativeKey, action)` | Assumir o controle / devolver o controle / encerrar a partir da interface do próprio host nativo |
| `nativeDecide(nativeKey, requestId, value)` | Com `nativeApproval`, responde a `status().pending`: um nível ou `null` para um pedido de conexão, `'allow'` ou `null` para a confirmação de uma ação sensível |
| `setLang(lang?)` | Troca o idioma da interface em tempo de execução (a configuração de idioma do próprio app); sem argumento, volta aos idiomas do navegador. Veja [Idiomas](#idiomas) |
| `registerLocale(pack)` | Adiciona um pacote de idioma, ou substitui um com o mesmo `id` (também aceita um array). Veja [Idiomas](#idiomas) |
| `builtinLocales` | Os ids dos pacotes embutidos |

Opções de `run()`:

| Opção | Descrição |
|---|---|
| `userId` | O usuário logado, enviado com o `hello` |
| `deviceId` | Um id de dispositivo estável vindo de um host nativo (senão, um é guardado no localStorage) |
| `helpButton` | Mostra o botão "Solicitar assistência" (combinado com OR com a política do projeto) |
| `app` | `{ name, version }` do app host |
| `lang` | Idioma de tudo o que o usuário do celular vê (pílula, janela flutuante, barra inferior, diálogos, toasts, a aba do eruda e a descrição "A IA quer …" de uma ação sensível): uma tag de idioma como `'ja'` ou `'pt-BR'`. Padrão: os idiomas do navegador. Veja [Idiomas](#idiomas) |
| `locales` | Pacotes de idioma extras, registrados antes de o idioma ser escolhido (como `registerLocale`) |
| `messages` | Mensagens a sobrescrever, por idioma: `{ en: { ui: { help: 'Contact support' } }, zh: { ui: { help: '联系客服' } } }` |
| `networkExclude` | Requisições em que o agente não deveria ter que se atolar — fontes que sempre dão 404, beacons de analytics: `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. Cada regra casa com a URL como substring sem diferenciar maiúsculas de minúsculas, como padrão com curinga `*` ou como regex quando escrita `/…/`. Somadas às regras da política do projeto. As requisições que casam ficam fora da lista de rede e fora dos eventos `net_fail` da linha do tempo; a página continua registrando-as, então um agente pode pedi-las com `includeExcluded` |
| `lockScreen` | `false`: não bloqueia a página enquanto um agente estiver conectado (o usuário ainda pode mudar isso na janela flutuante). Padrão `true` |
| `theme` | `'auto'` (padrão, segue o fundo da página), `'system'`, `'light'` ou `'dark'` |
| `style` | Cores, fontes, raios, z-index e posições da interface: `{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`. Veja [Estilos](#estilos) |
| `eruda` | `true` ou `{ dock, load, src, name }`: mostra o Remote Debugger como uma aba dentro do eruda; `load` carrega o eruda mais recente quando a página não tem um. Desligado por padrão; a política do projeto pode ligá-lo remotamente, e as opções locais prevalecem campo a campo |
| `record` | `false`: esta página não grava log da sessão (e nada do que já está armazenado é apagado). Padrão `true`; a política do projeto pode desligar o log para todas as páginas |
| `launchId` | A qual inicialização do app esta página pertence, para que todas as WebViews de um mesmo processo do app arquivem o log da sessão numa única sessão. Um host nativo passa o próprio id aqui (ou define `window.RWDLaunchId` como uma string ou uma função que retorna uma); caso contrário, o SDK deduz a inicialização a partir de um cookie de sessão mais um heartbeat |
| `nativeKey`, `deviceToken`, `nativeApproval` | Para hosts nativos: o segredo para `nativeControl` / `nativeDecide`, o token do dispositivo que o host guarda, e fazer as perguntas de conexão / confirmação de forma nativa |

## Idiomas

Embutidos: inglês (`en`), chinês simplificado (`zh`), chinês tradicional (`zh-TW`, usado também para `zh-HK`, `zh-MO` e `zh-Hant`), francês (`fr`), espanhol (`es`), russo (`ru`), árabe (`ar`, com layout da direita para a esquerda), japonês (`ja`), coreano (`ko`), alemão (`de`) e português (`pt`, do Brasil; usado também para `pt-PT`).

**Como o idioma é escolhido.** O idioma do usuário do celular é `run({ lang })`, se informado, e depois cada um dos `navigator.languages`, em ordem. Para cada tag, o SDK tenta a própria tag e depois formas mais curtas dela (`pt-BR` → `pt`, `zh-HK` → `zh-TW` → `zh`), fica com o primeiro idioma para o qual tem pacote e, se não houver nenhum, usa o inglês. As mensagens que faltam num pacote caem nos idiomas de fallback da mesma forma, então um pacote parcial não é problema. `setLang('ja')` troca o idioma em tempo de execução; `status().lang` é o pacote em uso.

**Carregamento.** Inglês e chinês simplificado vêm dentro do `sdk.js`. Os demais pacotes são carregados sob demanda, na primeira vez que uma página precisa deles (nesse instante, a interface mostra o idioma de fallback):

- Build `<script>`: a partir de `locales/<id>.js` ao lado do `sdk.js` (o caminho da CDN, por exemplo `…/remote-webview-debugger@0.2.0/dist/locales/ja.js`, ou `/v1/locales/ja.js` do seu gateway) e, se isso falhar, a partir do gateway passado para `run()`. Para evitar a requisição extra, carregue você mesmo o pacote, antes ou depois do `sdk.js`: `<script src="…/dist/locales/ja.js"></script>`.
- Build de módulo ES: um import dinâmico, então o seu bundler coloca cada idioma no próprio chunk. Para incluir um idioma no bundle desde o início: `import ja from 'remote-webview-debugger/locales/ja'` e depois `run(url, key, { locales: [ja] })`.

**Seus próprios pacotes e textos.** Um pacote é `{ id, name, dir?, ui?, action?, agent? }`; o que ficar de fora vem dos idiomas de fallback dele:

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Richiedi assistenza' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { en: { ui: { help: 'Contact support' } } }, // altera mensagens avulsas de qualquer idioma
})
```

`ui` é o texto da interface, `action` completa "A IA quer …" no diálogo de confirmação e `agent` é o que volta para o agente. Os tipos de TypeScript (`LocalePack`, `Messages`, `UiMessages`, `ActionMessages`, `AgentMessages`) listam todas as chaves; `src/locales/en.ts` é a referência.

**Dois públicos.** O usuário do celular recebe o idioma descrito acima. O agente lê as mensagens de erro de RPC e os resumos da linha do tempo (toques, navegação dentro da página, requisições com falha) no idioma do gateway, `welcome.agentLang` (`RWD_LANG`), e esse pacote é carregado da mesma forma. Fica em inglês até que um welcome diga outra coisa; o último valor é guardado no localStorage `rwd:alang`, então os eventos anteriores ao welcome da próxima página também o usam.

Assim, um usuário que fala chinês pode trabalhar com um agente que fala inglês: o diálogo pergunta `AI 想要点击「提交订单」，允许吗？` e, se a ação for recusada, o agente lê `The user denied this action`.

## Estilos

A interface fica num shadow root em `#__rwd` (fora do `<body>`), então o CSS da página não a alcança, exceto por estes ganchos:

- **CSS custom properties** em `:root` ou `#__rwd`, por exemplo `:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`.
- **`run({ style })`**, que define as mesmas propriedades em `#__rwd`. Ali, as cores aceitam qualquer cor CSS.
- **`::part()`** para todo o resto: `#__rwd::part(bar) { … }`. Parts: `pill`, `window`, `bar`, `task`, `dialog`, `toast`, `button`, `cursor`, `glow`, `overlay`. Os nomes de classe internos não são uma API estável.
- **`theme`**: vidro claro ou escuro (padrão: segue o fundo da página).

| Propriedade | Campo de `style` | Padrão | O quê |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | Botões, chaves, o ponteiro do agente, destaques e o brilho nas bordas |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | O botão Encerrar |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | Solicitar assistência e Em atendimento; o estado de usuário no controle |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | Ponto de online; "copiado" |
| `--rwd-font` | `font` | fonte de interface do sistema (por idioma para chinês, japonês e coreano) | Todo o texto |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | Código do dispositivo e tags |
| `--rwd-radius` | `radius` | `18px` | Janela flutuante; o diálogo é 2px mais arredondado, o cartão de tarefa e a pílula 2px menos, os botões do diálogo 6px menos |
| `--rwd-button-radius` | `buttonRadius` | `999px` | Botões, a barra inferior e os toasts |
| `--rwd-z-index` | `zIndex` | `2147483647` | A interface inteira |
| `--rwd-bar-bottom` | `barBottom` | `14px` | Barra inferior, acima da área segura inferior |
| `--rwd-task-top` | `taskTop` | `10px` | Cartão de tarefa, abaixo da área segura superior |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | Toasts, acima da área segura inferior |
| — | `pill: { side, top }` | borda direita (esquerda nos idiomas da direita para a esquerda), `0.62` | Onde a pílula ociosa começa até o usuário arrastá-la; `top` vai de 0 (topo) a 1 (base) |

As cores são trios `r, g, b` para que os tons translúcidos acompanhem (a mesma convenção do `--bs-*-rgb` do Bootstrap).

## Comportamento na página (protocolo §6–§8, §11)

- Níveis: as RPCs são verificadas contra `welcome.level` / `control.level` (`forbidden`, "Requer o nível …"). Um agente sem nível (um gateway mais antigo) recebe `interact`; sem agente conectado, nada extra é aplicado.
- O token do dispositivo fica no localStorage `rwd:dtoken`, o token de retomada no sessionStorage `rwd:resume` (vinculado ao pageId). Código de fechamento 4401: se o token mudou nesse meio-tempo (outra aba do dispositivo acabou de recebê-lo), tenta de novo uma vez na hora; se não há token nenhum e o deviceId é o próprio do SDK, o welcome com o token se perdeu, então depois de uns 1,5 s recomeça como um novo dispositivo; senão, `rejected` e nova tentativa depois de uns 10 minutos; 4409: reconecta com um novo pageId; 4429: `quota`, nova tentativa depois de uns 5 minutos.
- `rwd_invite` na barra de endereço é retirado em `run()` (`history.replaceState`) e enviado com o hello até chegar um welcome.
- `welcome.config`: `helpButton` (combinado com OR com a opção de `run()`), `maskSelectors`, `maskPatterns` (snapshot, console, URLs de rede, valores de armazenamento, resumos da linha do tempo), `confirmSelectors`, `networkExclude` (somado às regras da opção de `run()`), `sessionLog`. A última config é guardada no localStorage `rwd:cfg` e usada até o welcome chegar — assim, um projeto que desligou o log da sessão o mantém desligado desde o primeiro instante da próxima página, antes de qualquer welcome.
- Os snapshots terminam com uma seção `[Overlays]` que lista o que flutua sobre a página — o fundo de um pop-up, um modal, um bottom sheet — com a tag, um trecho curto de texto, quanto da viewport cobre e uma ref. Um fundo é um elemento vazio que não tem nó no snapshot ARIA, então recebe uma ref `oN` em vez de `eN`; é isso que permite a um agente tocar nele para fechar o pop-up.
- Um clique mira primeiro o centro visível do elemento e depois os outros pontos de uma grade 3×3 dentro dele, para que um selo sobre um botão não o bloqueie. Quando todos os pontos estão cobertos, a RPC falha com `not_interactable` e informa o elemento que está cobrindo e a ref dele.
- Os diálogos de conexão e de ação sensível (`[data-rwd-confirm]`, `confirmSelectors`, incluindo Enter enviando um formulário) ficam num Shadow DOM, aceitam só toques confiáveis (trusted) e só ficam ativos 0,4 s depois de aparecerem. Abas da mesma origem compartilham os pedidos de conexão já decididos via BroadcastChannel.

Carregar o arquivo já começa a coletar console, erros não capturados e rede (XHR, fetch, WebSocket, sendBeacon, EventSource), no máximo 500 entradas de cada; quando o buffer enche, logs simples e requisições bem-sucedidas saem primeiro. Os corpos de resposta ficam em cache até 5 MB no total, 64 KB cada. Por isso, carregue-o de forma síncrona e cedo no `<head>`.

## Log da sessão (protocolo §5.4)

Esses buffers são a memória de uma única página. Em paralelo, o SDK grava um **log da sessão** no IndexedDB (`rwd-log`) do dispositivo, para que um agente que se conecte depois de um bug ainda consiga ler todo o caminho até ele:

- Uma sessão é uma inicialização do app, compartilhada por todas as páginas da origem: `run({ launchId })`, senão `window.RWDLaunchId`, senão deduzida a partir do cookie de sessão `rwd_launch` mais um heartbeat (uma sessão de cookie sem sinal por mais de uma hora conta como uma nova inicialização). `status().logSession` é o id em uso.
- O que é gravado: abertura de página / navegação dentro da página / primeiro plano e segundo plano / saída, os toques do usuário, entradas de texto, envios de formulário e posições em que a rolagem parou, as chamadas interativas do agente e `rwd.evaluate`, mudanças de controle, console em todos os níveis e todas as requisições concluídas — as que falharam também com cabeçalhos e corpos redigidos (64 KB cada). Funciona esteja o gateway acessível ou não. Os campos mascarados são guardados como `••••`, e os `maskPatterns` são aplicados à medida que os registros são gravados.
- O que é mantido: as 3 últimas inicializações, 10 MB cada; acima disso, logs simples e requisições bem-sucedidas são descartados primeiro. Só a inicialização atual quando a cota de armazenamento é menor que 64 MB; nada sem IndexedDB.
- Lido pelo agente com `rwd.log` (`observe`) e `rwd.logDetail` (`advanced`, para cabeçalhos e corpos). Fora isso, nada sai do dispositivo.
- Desligado com `run({ record: false })` para uma página, ou `policy.sessionLog: false` para o projeto — o que também apaga o que esta origem já tinha armazenado.

## Estrutura do código

- `src/index.ts`: API pública, sessão, despacho de RPC, estado de controle.
- `src/transport.ts`: o WebSocket da página (o construtor nativo), timeout de heartbeat, backoff exponencial e, depois de 3 tentativas falhas, `POST /v1/presence` a cada 60 s.
- `src/ids.ts`: deviceId / pageId / openerId.
- `src/launch.ts`: a qual inicialização do app esta página pertence (`launchId`, `window.RWDLaunchId`, o cookie `rwd_launch`).
- `src/pageWatch.ts`: mensagens `page` (url, title, visibility) e eventos da linha do tempo (navegação dentro da página, toques do usuário).
- `src/ui.ts`, `src/lock.ts`: a pílula, o botão “Solicitar assistência”, a camada de bloqueio, o brilho, o destaque de ação e os diálogos num Shadow DOM; bloqueia as entradas confiáveis do usuário enquanto um agente está conectado e mostra há quanto tempo ele está conectado.
- `src/approval.ts`: aprovação de conexão e confirmação de ação sensível (diálogo na página, ou o host nativo via `nativeDecide`).
- `src/i18n.ts`, `src/locales/`, `src/localeLoader*.ts`: pacotes de idioma (textos de interface, de ação e do agente por idioma), escolha e fallback, carregamento sob demanda; `scripts/locales.mjs` gera `dist/locales/<id>.js`.
- O motor do agente fica ao lado do chobitsu, em `packages/chobitsu/src/engine/rwd/`: snapshot, `rwd.query`, verificações de acionabilidade, entrada sintetizada, teclado, buffers de console / rede, capturas de tela, `rwd.storage`, o log da sessão no IndexedDB (`coldlog.ts`), detecção de sobreposições (`overlays.ts`), níveis e regras de confirmação (`policy.ts`), textos voltados ao agente (`i18n.ts`). Os fontes do Playwright usados nos snapshots estão em `packages/chobitsu/src/engine/vendor/playwright/`. O build os empacota a partir do código-fonte em `dist/sdk.js`.

## Build e testes

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE, global RemoteWebviewDebugger, ES2017), dist/index.mjs + index.d.ts (módulo ES)
npm run typecheck
npm test             # Playwright: WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # gateway mock local: http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

Os testes usam `test/mock-gateway.mjs`, que implementa o lado da página do protocolo (welcome, estado de controle, RPCs, presença; tokens, códigos de fechamento, níveis, config remota, `agentLang`, aprovação de conexão) e serve `/v1/sdk.js`, os pacotes de idioma em `/v1/locales/` e a loja de demonstração. Ele não verifica os níveis por conta própria, então os testes exercitam a aplicação feita pela própria página. As specs em `test/e2e/` rodam com um navegador `zh-CN` e `agentLang: 'zh'`, a menos que o teste diga outra coisa; `i18n.spec.ts` cobre o inglês, `locales.spec.ts` os outros pacotes de idioma, o fallback, pacotes personalizados, estilos e o layout da direita para a esquerda. O teste de coexistência carrega o eruda 3.4.3 e o PageSpy 2.4.0 do jsdelivr, então precisa de acesso à internet.
