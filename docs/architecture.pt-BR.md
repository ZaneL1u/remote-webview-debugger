<!-- i18n-source: f1c156537ee729acb5ad4a7266a240554b3452f4 -->
[English](architecture.md) | [简体中文](architecture.zh-CN.md) | [繁體中文](architecture.zh-TW.md) | [日本語](architecture.ja.md) | [한국어](architecture.ko.md) | [Español](architecture.es.md) | [Français](architecture.fr.md) | [Deutsch](architecture.de.md) | Português (Brasil) | [Русский](architecture.ru.md) | [العربية](architecture.ar.md)

# Arquitetura

O Remote WebView Debugger permite que um agente de IA inspecione e opere uma página web aberta no celular de outra pessoa: uma página H5 em um navegador móvel ou superapp, ou uma WebView dentro do seu próprio app. O agente fala MCP com um gateway auto-hospedado; o gateway fala com um pequeno SDK que roda dentro da página. O usuário do celular aprova a conexão, vê o que o agente faz e pode assumir o controle a qualquer momento.

Este documento explica as peças e as regras que elas seguem. As mensagens e os endpoints exatos estão em [protocol.pt-BR.md](protocol.pt-BR.md); a integração com apps, em [native-integration.pt-BR.md](native-integration.pt-BR.md); a implantação, em [gateway/README.pt-BR.md](../gateway/README.pt-BR.md) e [deploy/platform/README.pt-BR.md](../deploy/platform/README.pt-BR.md).

## Componentes

```
  AI agent (Claude Code, Cursor, any MCP client)
        │  MCP: Streamable HTTP + Bearer API key
        │  (or stdio through the `rwd mcp` bridge)
        ▼
┌──────────────────────────── Gateway (one Go binary) ────────────────────────────┐
│  /v1/mcp      MCP tools ─────┐                                                  │
│  /v1/api      REST + SSE ────┼──▶ hub: devices, pages, control state, approvals,│
│  /v1/page     page WebSocket ┘        timelines, RPC routing   (in memory)      │
│  /v1/sdk.js   embedded page SDK      store: SQLite or Postgres (persistent)     │
│  /            embedded web console                                              │
└───────────▲──────────────────────────────────────────────▲──────────────────────┘
            │ HTTPS, cookie session                        │ WebSocket (wss://…/v1/page)
       Web console                                         │ POST /v1/presence as a fallback
       (support staff, admins)                             │
                                  ┌──────────── phone ─────┴────────────────────┐
                                  │  H5 page / App WebView                      │
                                  │    page SDK: link to the gateway, UI        │
                                  │      (pill, dialogs, lock) in a Shadow DOM  │
                                  │    engine: snapshots, actions, console and  │
                                  │      network capture, masking, levels       │
                                  │  native host (optional): injects the SDK,   │
                                  │    real screenshots, native dialogs/buttons │
                                  └─────────────────────────────────────────────┘
```

| Componente | Caminho | Papel |
|---|---|---|
| Gateway | [`gateway/`](../gateway) | Servidor em Go. Aceita as conexões das páginas, mantém em memória o estado ao vivo dos dispositivos, serve o endpoint MCP hospedado, a API REST do console e as atualizações ao vivo, e grava o log de auditoria. Embute o console e o SDK, então um único binário é o servidor inteiro |
| SDK da página | [`sdk/`](../sdk) | `sdk.js`, carregado pela página ou injetado pelo app. Cuida da conexão, da identidade, da interface dentro da página, dos diálogos de consentimento e do bloqueio de tela |
| Motor | [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine) | A metade, do lado da página, de cada ação do agente: snapshots de acessibilidade (o código de aria snapshot do Playwright) e as camadas que flutuam sobre a página, verificações de acionabilidade e entrada sintética, captura de console e de rede (baseada no [chobitsu](https://github.com/liriliri/chobitsu)), capturas de tela, mascaramento, verificação de níveis |
| Console | [`console/`](../console) | Aplicação React de página única: projetos e trechos de integração, dispositivos e suas linhas do tempo, chaves de API, membros, políticas, convites, log de auditoria |
| Host nativo | o seu app; referência em [`examples/mock-app`](../examples/mock-app) | Injeta o SDK em cada WebView no início do documento, guarda o id e o token do dispositivo, fornece capturas de tela reais e, opcionalmente, diálogos de aprovação e botões nativos |

## Uma sessão de depuração

1. **A página fica online.** A página carrega `sdk.js` (ou o app o injeta). A captura de console, erros e rede começa na hora, em buffers limitados, para que um agente que se conecte depois ainda veja o que aconteceu antes. `run()` abre um WebSocket com o gateway e envia `hello`; o gateway responde com o **código do dispositivo** (por exemplo `K7Q2-9M4X`) e a configuração remota do projeto. A pílula na página mostra o código.
2. **Alguém aponta o agente para o dispositivo.** O usuário lê o código do dispositivo em voz alta, toca em **Solicitar assistência** (o dispositivo passa a aparecer primeiro em todas as listas) ou abre um **link de convite** enviado pelo suporte, que coloca o dispositivo online com a assistência já solicitada.
3. **O agente se conecta.** Ele chama `connect_device` com o código. A não ser que o projeto diga o contrário, o usuário vê *A IA quer se conectar* no celular e escolhe um nível (apenas visualizar, visualizar e interagir, avançado) ou recusa. Nada pode ser lido antes disso. Assim que o agente entra, a tela fica bloqueada para a entrada do usuário, as bordas brilham e a barra inferior conta há quanto tempo ele está conectado.
4. **O agente trabalha.** Ele faz um snapshot para obter as refs dos elementos e depois clica, preenche e rola por ref. O snapshot também lista os pop-ups e fundos que flutuam sobre a página, cada um com uma ref, e um clique bloqueado por uma camada falha com o nome e a ref do que o bloqueou — assim o agente pode tocar no fundo para fechar o pop-up em vez de tentar adivinhar. A primeira ação muda o dispositivo de *observe* para *agent*, e um cursor do agente mostra onde ele atua. Dependendo do nível, ele também pode ler console, rede, armazenamento e capturas de tela.
5. **O usuário continua no comando.** **Assumir** devolve a página ao usuário e pausa o agente (as ações dele falham com `takeover` até o usuário tocar em **Devolver à IA**). **Encerrar** desconecta o agente. Cliques em elementos marcados como sensíveis (fazer pedido, pagar, excluir) precisam do OK do usuário no celular.
6. **O agente sai** com `disconnect_device`; depois de dois minutos sem ações, o dispositivo volta para *observe*; e, ao atingir o tempo máximo de conexão do projeto (60 minutos por padrão), o agente é desconectado.

Uma ação, de ponta a ponta:

```
agent ─ click(ref=e12) ─▶ MCP handler
   gateway: API key valid? → attached? → level ≥ interact? → user hasn't taken over?
            observe (screen locked) → agent → RPC {"method":"rwd.click","params":{"ref":"e12"}}
   ─── WebSocket ──▶ SDK: level ≥ interact? not taken over? sensitive element → ask the user
                     engine: wait until visible, stable, enabled, hit-testable (≤ 5 s)
                             move the agent cursor, highlight, dispatch pointer/mouse/touch events
   ◀── {"id":…, "result":{}} ───
   gateway: audit "rpc" (method, page, latency; no payload)
agent ◀─ "Clicked e12 (page p2)." + [Session changes] (new pages, navigations, errors, takeovers)
```

Cada ação é uma única ida e volta: as verificações de acionabilidade e o disparo dos eventos rodam dentro da página, não pela rede.

## Dispositivos, páginas e agentes

**Dispositivo.** Um `deviceId`: um perfil de navegador, ou uma instalação do app quando um host nativo passa o próprio id. O gateway atribui a cada dispositivo um código do dispositivo permanente. Dispositivos não pertencem a projetos: um celular que abre páginas de dois projetos (duas chaves do app) é um único dispositivo com páginas dos dois. As chaves de API também não pertencem a projetos, então um servidor MCP alcança todos os dispositivos.

**Página.** Uma aba ou WebView, identificada por um `pageId` que sobrevive a recarregamentos e navegações naquela aba. O gateway rotula as páginas como `p1`, `p2`, … por dispositivo, registra quem abriu quem e acompanha qual página está em primeiro plano. Uma página que se desconecta mantém o rótulo por dois minutos, tempo suficiente para uma navegação se reconectar — mas não quando o mesmo documento reaparece em outro lugar: uma WebView recriada com um novo `pageId` substitui na hora a entrada antiga, e uma página desconectada cuja URL também aparece em outra página conectada é removida após 1,5 s. Assim, uma WebView recriada não deixa um fantasma na lista de páginas, e o agente é levado para a página que realmente está lá.

**Linha do tempo.** Cada dispositivo tem uma linha do tempo (em memória, últimos 300 eventos): páginas abertas, navegadas, recarregadas, focadas e fechadas; erros, requisições com falha e os toques do usuário; solicitações de assistência, aprovações e mudanças de controle. Todo resultado de ferramenta MCP termina com as entradas da linha do tempo que o agente ainda não viu, para que ele perceba novas páginas, erros e tomadas de controle sem polling. No **modo de acompanhamento** (o padrão), a página selecionada do agente passa para a página que a ação dele abriu, ou para a página para a qual o usuário mudou.

**Agente.** O gateway mantém um estado de agente por chave de API: o dispositivo ao qual ele está conectado e a página selecionada. Um agente fica conectado a um dispositivo por vez, e um dispositivo tem no máximo um agente; um agente recém-aprovado substitui o anterior.

**Estado de controle.** Cada dispositivo está em um de quatro estados, decidido pelo gateway e transmitido a todas as suas páginas:

```
                 agent attaches                first interactive action
       ┌──────┐ ───────────────▶ ┌─────────┐ ─────────────────────────▶ ┌───────┐
       │ none │                  │ observe │                            │ agent │
       └──────┘ ◀─────────────── └─────────┘ ◀───────────────────────── └───────┘
           ▲     agent leaves,        │        idle (default 2 min)        │
           │     End, time limit      │ Take over                Take over │
           │                          ▼                                    ▼
           │                        ┌──────┐ ◀─────────────────────────────┘
           └─────────── End ─────── │ user │ ────── Hand back ──────▶ agent
                                    └──────┘
```

Em `observe` e `agent` a entrada do usuário fica bloqueada (o usuário pode desligar o bloqueio na janela flutuante); em `user` o agente ainda pode ler, mas toda chamada interativa falha com `takeover`, e o agente pode chamar `wait_for_control` para esperar a devolução do controle.

## Consentimento e privacidade

A regra que guia tudo: **ter uma chave de API ou conhecer um código do dispositivo nunca basta para ver a página de um usuário.** Várias verificações independentes ficam entre um agente e a página.

| Camada | O que faz |
|---|---|
| Chave de API | Toda requisição MCP traz uma. As chaves têm um nível máximo, uma validade (90 dias por padrão) e uma lista de IPs permitidos opcional; revogar uma desconecta o agente dela na hora. Buscas de dispositivo que falham têm limite de taxa, para que os códigos do dispositivo não possam ser adivinhados |
| Código do dispositivo | Apenas *identifica* um dispositivo. Não concede nada |
| Política do projeto | `approval: prompt` (o padrão para projetos novos) exige a aprovação do usuário; `maxLevel` limita o que qualquer agente pode fazer. Quando um dispositivo tem páginas de vários projetos, vale a política mais restritiva |
| Aprovação do usuário | O celular mostra o nome do agente, a dica da chave e os níveis oferecidos; o usuário escolhe um ou recusa. O diálogo fica em um Shadow DOM e só reage a toques reais (confiáveis), então um agente não consegue aprovar a si mesmo. Três recusas bloqueiam aquela chave no dispositivo por 10 minutos. Os usuários podem optar pela permissão automática no próprio dispositivo. Um agente que largou o dispositivo por conta própria (desconexão, troca de dispositivo, tempo de conexão esgotado) pode voltar em até 10 minutos sem um novo diálogo, com no máximo o nível que o usuário concedeu antes; o usuário tocar em **Encerrar**, um membro do console encerrar a sessão, uma recusa ou a revogação da chave anulam isso |
| Níveis | `observe` (snapshot, captura de tela, console, lista de rede), `interact` (+ clicar, digitar, rolar, navegar…), `advanced` (+ executar JavaScript, corpos das requisições, armazenamento). O nível efetivo é o mínimo entre o que o agente pediu, a chave, a política e a escolha do usuário. **O SDK o aplica de novo dentro da página**, independentemente do gateway |
| Controle visível | Enquanto um agente está conectado, a página mostra isso: uma pílula com o estado do agente, um cartão de tarefa com o plano, um cursor do agente e um destaque em cada ação, e uma borda luminosa enquanto ele opera. Assumir, Devolver à IA e Encerrar respondem apenas aos toques do usuário; um host nativo precisa apresentar um segredo (`nativeKey`) que os scripts da página, inclusive os do próprio agente, não conseguem ler |
| Ações sensíveis | Clicar em um elemento marcado com `data-rwd-confirm` (ou que corresponda aos `confirmSelectors` da política), ou enviar um formulário que contenha um, espera o OK do usuário no celular |
| Mascaramento | Campos de senha, elementos `data-rwd-mask` e os seletores e padrões de texto da política (números de telefone, cartão, documento…) são substituídos por `••••` **dentro da página**, antes de qualquer coisa sair do dispositivo: em snapshots, capturas de tela, texto do console, URLs e corpos de rede, valores de armazenamento e resumos da linha do tempo. Os cabeçalhos `Cookie`, `Set-Cookie` e `Authorization` são sempre ocultados. As regras `networkExclude` da política são outra coisa: elas só tiram ruído (fontes que sempre dão 404, beacons de analytics) das listas que o agente lê, e o agente pode pedir as requisições ocultas, então não são um controle de privacidade |
| Conteúdo não confiável | O conteúdo da página entregue ao agente vem embrulhado e rotulado como dado não confiável, para que instruções plantadas em uma página não sejam confundidas com as do usuário. Cliques de alto risco dependem da confirmação do usuário, não do julgamento do agente |
| Log da sessão | Gravado no dispositivo, nunca transmitido para lugar nenhum: lê-lo exige `observe`, como qualquer outra leitura, e os cabeçalhos e corpos das requisições com falha exigem `advanced`. As regras de mascaramento valem no momento da gravação, então o valor de um campo mascarado é guardado como `••••`, não mascarado depois. Um projeto pode desligar o log e mandar apagar o que está guardado |
| Auditoria | Logins, mudanças de chaves e de membros, pedidos de conexão e decisões, cada RPC (método, página, latência, resultado), as tomadas de controle e os encerramentos feitos pelo usuário, e chamadas recusadas. Nunca o conteúdo da página nem os valores dos parâmetros |

O que sai do celular: os metadados do dispositivo em `hello` (user agent, `userId` se a página informar um, nome e versão do app, URLs e títulos das páginas) e resumos curtos da linha do tempo, a partir do momento em que `run()` é chamado; todo o resto, só quando um agente conectado pede. O gateway não armazena conteúdo das páginas: snapshots, capturas de tela e logs passam direto para o agente, e as linhas do tempo vivem em memória. O log da sessão é gravado no dispositivo, sob as mesmas regras de mascaramento, e fica lá até um agente conectado lê-lo (veja **Armazenamento** abaixo).

Limites conhecidos que vale dizer com clareza:

- A entrada é sintética: os eventos têm `isTrusted: false`, e páginas que verificam isso não reagem.
- `interact` deixa o agente navegar para qualquer URL `http(s)`; não fica restrito às origens do projeto.
- `advanced` executa JavaScript arbitrário na página. O mascaramento não se aplica ao que esse script retorna, então mantenha `maxLevel` em `interact`, a menos que você precise dele.
- A captura de rede cobre as requisições que a página faz por JavaScript depois que o SDK carregou (fetch, XHR, WebSocket, sendBeacon, EventSource). Imagens, scripts, folhas de estilo e requisições feitas pelo código nativo não aparecem. O conteúdo dentro de iframes não entra nos snapshots.
- Quando um app vai para segundo plano, o sistema operacional pausa as WebViews dele, e o dispositivo fica offline até o app voltar.
- Breakpoints, execução passo a passo, profiling e heap snapshots estão fora do escopo; para isso, use o Safari Web Inspector ou `chrome://inspect` com uma WebView depurável.

## Armazenamento

O gateway usa **SQLite** por padrão (Go puro, sem CGO; um arquivo definido por `RWD_DATA`) ou **Postgres** quando `RWD_DATABASE_URL` é uma URL `postgres://`. O esquema é criado e migrado na inicialização.

| Persistente (banco de dados) | Só em memória (perdido ao reiniciar) |
|---|---|
| Projetos e suas políticas, chaves do app | Páginas conectadas e seus rótulos |
| Membros (senhas em PBKDF2-SHA256), convites de membros pendentes | Estado de controle, aprovações pendentes, agentes conectados |
| Chaves de API (hashes HMAC-SHA256, níveis, validade, listas de IPs permitidos) | Linhas do tempo dos dispositivos |
| Dispositivos conhecidos: id, código, userId, user agent, app, primeira e última vez visto, hash do token do dispositivo | Contadores de limite de taxa |
| Convites de dispositivo (hashes dos tokens), log de auditoria | |
| Configurações: o pepper das chaves e o segredo de assinatura das sessões, gerados na primeira inicialização | |

Depois de um reinício, as páginas se reconectam sozinhas (o SDK tenta de novo com backoff) e mantêm seus códigos do dispositivo; os agentes se conectam de novo. O estado ao vivo fica em um único processo, então rode **uma instância do gateway** por banco de dados.

**No celular, não no gateway.** Um armazenamento fica deliberadamente fora de tudo isso: o **log da sessão**, que o SDK da página grava no IndexedDB do dispositivo (banco de dados `rwd-log`). Desde a inicialização do app, ele registra as páginas visitadas, os toques e a entrada do usuário, as ações do agente, as mudanças de controle, a saída do console e cada requisição — as que falharam com seus cabeçalhos e corpos —, esteja o gateway acessível ou não. É isso que permite a um agente que se conecta *depois* de um bug ler todo o caminho até ele, em vez de começar de um buffer vazio. Ele guarda as três últimas inicializações, até 10 MB cada, e nada nele chega ao gateway nem a mais ninguém, a menos que um agente conectado peça com `get_session_overview` / `get_session_log` ([protocol.pt-BR.md §5.4](protocol.pt-BR.md#54-log-da-sessão)). Um projeto pode desligá-lo (`policy.sessionLog`), o que também apaga o que já está guardado nos seus dispositivos, e uma página específica pode ficar de fora com `run({ record: false })`.

## Notas de segurança para operadores

- **Sirva por HTTPS.** As páginas se conectam por `wss://`, o cookie do console é marcado como `Secure` em HTTPS e as chaves de API trafegam em cabeçalhos. A configuração Docker Compose em [deploy/platform](../deploy/platform/README.pt-BR.md) termina o TLS com o Caddy ou fica atrás do seu próprio proxy.
- **Confie em cabeçalhos encaminhados só atrás de um proxy.** `--trust-proxy` faz o gateway obter os IPs dos clientes e o próprio host público de `X-Forwarded-For` / `X-Forwarded-Host`. Sem um proxy na frente, qualquer pessoa poderia forjá-los e contornar as listas de IPs permitidos e os limites de taxa.
- **Proteja o banco de dados e os backups.** Eles contêm o pepper das chaves e o segredo das sessões; com eles, os hashes das chaves de API podem ser verificados offline e sessões do console podem ser forjadas.
- **A senha do proprietário.** `RWD_ADMIN_PASSWORD` redefine a senha do proprietário a cada inicialização, o que também serve para recuperar a conta. Se ela não estiver definida em um banco de dados novo, uma senha aleatória é exibida uma única vez no log.
- **As chaves do app são públicas.** Elas só permitem que páginas fiquem online. Use `allowedOrigins` para impedir que outros sites usem a sua; note que `Origin` é um cabeçalho imposto pelo navegador e clientes que não são navegadores podem enviar qualquer coisa, e é por isso que os tokens do dispositivo (não as chaves do app) protegem os dispositivos existentes.
- **Trate as chaves de API como senhas.** Dê a cada agente ou pessoa a própria chave, com o menor nível que funcione, uma validade e, para servidores, uma lista de IPs permitidos. A revogação é imediata.
- **Fixe o SDK.** Para páginas H5, o console oferece um trecho que carrega o SDK por uma URL endereçada por conteúdo, com Subresource Integrity. Apps nativos podem embutir o `sdk.js` em vez de baixá-lo em tempo de execução, para que um gateway comprometido não consiga enviar código novo para eles.
- **Proteja as métricas.** Defina `RWD_METRICS_TOKEN` se `/v1/metrics` puder ser acessado de fora.
- O login no console tem limite de taxa (10 tentativas por minuto por IP), as requisições de escrita exigem um cabeçalho CSRF personalizado e o console não pode ser exibido em frames.
