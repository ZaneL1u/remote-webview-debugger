<!-- i18n-source: 97a0829808d3d00572988c94823b55104f61fbb3 -->
[English](protocol.md) | [简体中文](protocol.zh-CN.md) | [繁體中文](protocol.zh-TW.md) | [日本語](protocol.ja.md) | [한국어](protocol.ko.md) | [Español](protocol.es.md) | [Français](protocol.fr.md) | [Deutsch](protocol.de.md) | Português (Brasil) | [Русский](protocol.ru.md) | [العربية](protocol.ar.md)

# Protocolo RWD (v1)

Este é o contrato entre o gateway ([`gateway/`](../gateway)), o SDK da página ([`sdk/`](../sdk), com o engine em [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine)), o console ([`console/`](../console)) e os clientes MCP. Quando o protocolo muda, este documento muda primeiro.

Para a visão geral (componentes, modelo de consentimento, armazenamento, segurança), veja [architecture.pt-BR.md](architecture.pt-BR.md); para a integração em apps, veja [native-integration.pt-BR.md](native-integration.pt-BR.md).

Convenções:

- A **URL do gateway** é `https://<host>/v1`, por exemplo `https://rwd.example.com/v1`. Todos os endpoints ficam abaixo dela; o SDK deriva todos os endereços a partir dela.
- JSON em tudo. Timestamps são **milissegundos** desde a época Unix.
- `Level` é `"observe" | "interact" | "advanced"` (veja [§6](#6-níveis-de-acesso)).
- Campos não listados aqui são ignorados por quem recebe. Campos novos são sempre opcionais, então um SDK mais antigo continua funcionando com um gateway mais novo.

## Conteúdo

1. [Endpoints](#1-endpoints)
2. [Identificadores](#2-identificadores)
3. [Conexão da página (WebSocket)](#3-conexão-da-página-websocket)
4. [Estado de controle](#4-estado-de-controle)
5. [RPC da página](#5-rpc-da-página)
6. [Níveis de acesso](#6-níveis-de-acesso)
7. [Aprovação da conexão](#7-aprovação-da-conexão)
8. [Confirmação de ações sensíveis](#8-confirmação-de-ações-sensíveis)
9. [Fallback por polling de presença](#9-fallback-por-polling-de-presença)
10. [API JavaScript para hosts](#10-api-javascript-para-hosts)
11. [Política do projeto](#11-política-do-projeto)
12. [API REST do console](#12-api-rest-do-console)
13. [Atualizações em tempo real (SSE)](#13-atualizações-em-tempo-real-sse)
14. [MCP](#14-mcp)
15. [Idiomas](#15-idiomas)
16. [Operação](#16-operação)

## 1. Endpoints

| Caminho | Descrição |
|---|---|
| `GET /v1/sdk.js` | SDK da página (uma IIFE que expõe o global `RemoteWebviewDebugger`). `Cache-Control: max-age=300`, `Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | O mesmo arquivo numa URL imutável, endereçada pelo conteúdo (fica em cache por um ano; dá para usar com SRI). Qualquer outro `<version>` retorna 404. Veja [§16](#16-operação) |
| `GET /v1/locales/<id>.js`, `GET /v1/sdk/<version>/locales/<id>.js` | Os pacotes de idioma do SDK carregados sob demanda, que o `sdk.js` busca ao lado dele mesmo ([§15](#15-idiomas)). `Cache-Control: max-age=300` |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Métricas do Prometheus ([§16](#16-operação)) |
| `WS /v1/page?key=<appKey>` | Conexão da página ([§3](#3-conexão-da-página-websocket)) |
| `POST /v1/presence` | Fallback por polling quando o WebSocket não consegue se conectar ([§9](#9-fallback-por-polling-de-presença)) |
| `/v1/api/…` | API REST do console ([§12](#12-api-rest-do-console)) |
| `/v1/mcp` | Servidor MCP hospedado, Streamable HTTP, `Authorization: Bearer rwd_sk_live_…` ([§14](#14-mcp)) |
| `/demo/` | Arquivos estáticos de `--demo-dir`, só quando configurado |
| qualquer outro caminho | Single-page app do console |

Caminhos desconhecidos sob `/v1/` retornam `404 {"error":{"code":"not_found",…}}`. Todas as respostas trazem `X-Content-Type-Options: nosniff` e `Referrer-Policy: no-referrer`; tudo exceto o SDK também traz `X-Frame-Options: DENY`.

## 2. Identificadores

| Nome | Formato | Origem |
|---|---|---|
| Chave do app | `rwd_pk_` + 24 caracteres base62 | Criada junto com um projeto. Pública: aparece no código-fonte da página e só permite que uma página fique online |
| Chave de API | `rwd_sk_live_` + 32 caracteres base62 | Criada no console e exibida uma única vez. Armazenada como HMAC-SHA256 com um pepper do lado do servidor. O console mostra os 16 primeiros caracteres (`prefix`, por exemplo `rwd_sk_live_ab12`); os dispositivos veem `"…"` mais os 4 últimos caracteres do prefixo (`keyHint`) |
| `deviceId` | UUID v4 (qualquer `[A-Za-z0-9_-]{1,64}` é aceito) | Gerado pelo SDK e guardado no localStorage em `rwd:device`, ou passado por um host nativo com `run({ deviceId })` |
| Código do dispositivo | `XXXX-XXXX` sobre `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | Atribuído pelo gateway na primeira vez que ele vê um `deviceId`; nunca muda. Quando um agente se conecta com ele, maiúsculas/minúsculas, hífens e espaços não importam |
| `pageId` | 12 caracteres base62 (qualquer `[A-Za-z0-9_-]{1,64}` é aceito) | Gerado pelo SDK e guardado no sessionStorage em `rwd:page`: estável entre recarregamentos e navegações na mesma aba, novo para cada aba |
| Rótulo da página | `p1`, `p2`, … | Atribuído pelo gateway por dispositivo; mantido enquanto a página se reconecta dentro do período de tolerância de 2 minutos |
| Id da sessão (inicialização) | O id de inicialização do próprio app host (4–128 caracteres de `[A-Za-z0-9_.:-]`) ou, na falta dele, 16 caracteres hex gerados pelo SDK | Uma inicialização do app, sob a qual a página registra o seu log da sessão ([§5.4](#54-log-da-sessão)). Nunca é enviado ao gateway, exceto num resultado de `rwd.log` |
| `ref` | `e12`, `o3`, … | `eN`: um elemento do snapshot mais recente da página, válido até o próximo snapshot dessa página. `oN`: um elemento que não tem nó no snapshot — uma sobreposição, ou o que estiver cobrindo um ponto de clique ([§5.3](#53-comportamento-na-página)); continua válido enquanto esse elemento estiver na página |
| Token do dispositivo | 64 caracteres hex | Emitido uma vez por `deviceId` ([§3.5](#35-token-do-dispositivo-token-de-retomada-e-convites)); o gateway guarda só um hash |
| Token de retomada | 32 caracteres hex | Trocado a cada `welcome` ([§3.5](#35-token-do-dispositivo-token-de-retomada-e-convites)); guardado como hash |

## 3. Conexão da página (WebSocket)

### 3.1 Ciclo de vida

1. A página abre `wss://<host>/v1/page?key=<appKey>`. Antes do upgrade, o gateway verifica:
   - limite de taxa: 120 conexões (e chamadas de presença) por minuto por IP de cliente → `429 rate_limited`;
   - a chave do app existe e o projeto dela não está desativado → senão `401 bad_key`;
   - se o projeto tiver `allowedOrigins`, o cabeçalho `Origin` precisa bater com uma delas → senão `403 origin_not_allowed`.
2. Só frames de texto, um objeto JSON por frame. Mensagens recebidas podem ter até 16 MiB (capturas de tela chegam codificadas em base64).
3. A página precisa enviar `hello` em até **5 segundos**. Um `hello` malformado (JSON inválido, `t` errado, `deviceId` / `pageId` inválido) é fechado com `1008`.
4. O gateway responde com `welcome` ([§3.4](#34-welcome)) ou fecha com um código de fechamento do protocolo ([§3.6](#36-códigos-de-fechamento)).
5. O gateway envia `{"t":"hb"}` a cada **25 segundos**, além de um ping de WebSocket que precisa ser respondido em até 10 segundos. O SDK se reconecta quando passa **60 segundos** sem ouvir nada.
6. As reconexões do SDK fazem backoff exponencial de 1 s a 30 s, com cada espera sorteada na metade superior do degrau atual. Depois de **3 tentativas seguidas que terminam antes de um `welcome`**, o SDK passa para o polling de presença ([§9](#9-fallback-por-polling-de-presença)).
7. Uma segunda conexão com o mesmo `pageId` substitui a primeira (fechada com `1000 replaced`).
8. Uma página que se desconecta mantém o rótulo e o lugar durante um **período de tolerância de 2 minutos** (navegações se reconectam bem antes disso). Depois disso, ela aparece como `closed` na linha do tempo. Dois casos encurtam a espera, para que uma WebView recriada não fique parada na lista de páginas como *reconectando*:
   - uma página que se conecta com um **`pageId` novo** descarta na hora todas as páginas desconectadas que mostram a mesma URL (o fragmento `#` é ignorado);
   - uma página desconectada cuja URL também é mostrada por uma página **conectada** é descartada após **1,5 s**.

   Em qualquer caso, se a página descartada era a página selecionada pelo agente, a seleção passa para a página viva e o resultado avisa isso ([§14.3](#143-ferramentas)).
9. O SDK fecha o socket no `pagehide` (para que a página possa entrar no back/forward cache) e se reconecta no `pageshow`.

Cada conexão tem uma fila de envio de 64 mensagens. Uma página que não dá conta é fechada com `1013 slow consumer` em vez de deixar o gateway mais lento.

### 3.2 Página → gateway

```jsonc
{"t":"hello","v":1,"sdk":"<SDK version>",
 "deviceId":"…","pageId":"…","openerId":"<pageId>"|null,
 "userId":"<string>"|null,
 "page":{"url":"…","title":"…","visibility":"visible"|"hidden"},
 "device":{"ua":"…","platform":"ios"|"android"|"web",
           "screen":{"w":393,"h":852,"dpr":3},
           "app":{"name":"…","version":"…"}|null},
 "help":false,
 "deviceToken":"<token>"|null,   // sempre presente nos SDKs atuais, veja §3.5
 "resume":"<token>"|null,        // o último token de retomada que este pageId recebeu
 "invite":"<token>"|null}        // vindo de ?rwd_invite=…

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // quando muda
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // o usuário solicita assistência / cancela a solicitação
{"t":"control","action":"takeover"|"handback"|"end"}                // os botões do usuário, §4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"id":17,"result":{…}}                                              // RPC bem-sucedida, §5
{"id":17,"error":{"code":"not_found","message":"…"}}                // RPC com falha, §5
```

- `hello`: o gateway guarda `userId` (até 128 caracteres), `ua` (512), `platform` (16), `app`, `url` (2048) e `title` (256). `screen` é só informativo.
- `event.summary` é uma frase para o agente, já limpa de valores mascarados, por exemplo `TypeError: Cannot read properties of undefined (reading 'orderId')`, `POST /api/order → 405`, `Tapped button "Place order"`. O gateway registra cada tipo na linha do tempo (até 300 bytes) e ignora tipos desconhecidos. Navegações, incluindo as internas da página, não são eventos: o gateway as deduz das mensagens `page` (`navigated` na linha do tempo, [§12.9](#129-eventos-da-linha-do-tempo)); o SDK as guarda no log da sessão ([§5.4](#54-log-da-sessão)).
- O SDK remove eventos duplicados (mesmo tipo e resumo em até 2 s) e envia no máximo 30 a cada 10 s. Eventos e ações de controle gerados offline esperam numa fila (até 100 mensagens) pelo próximo `welcome`.
- `help` e `control` só são enviados por toques do usuário (ou por chamadas do host nativo, [§10](#10-api-javascript-para-hosts)).

### 3.3 Gateway → página

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"Support Bot"}|null,"level":"interact"|null,
 "attachedMs":83000|null}                                     // §4, para todas as páginas do dispositivo
{"t":"help","on":false}                                       // solicitação retirada: um agente se conectou, um membro do console encerrou a sessão ou o usuário a encerrou no dispositivo
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"Support Bot"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7, para a página em primeiro plano
{"t":"attach_cancel","requestId":"…"}                         // §7, para todas as páginas
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // reservado: o SDK se reconecta depois de afterMs
{"id":17,"method":"rwd.snapshot","params":{}}                 // requisição RPC, §5
```

O SDK entende `reconnect`; hoje o gateway não o envia.

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null,"attachedMs":null},
 "level":null,                       // igual a control.level
 "resume":"<new resume token>",
 "deviceToken":"<token>",            // só quando emitido por este welcome
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},   // ou null, veja abaixo
 "agentLang":"en",                   // o idioma do gateway: "en", "zh", "zh-TW", "fr"…, §15
 "task":{…}}                         // só enquanto o agente conectado tiver definido uma
```

`config` é a configuração remota vinda da política do projeto cuja chave do app a página usou ([§11](#11-política-do-projeto)). `config.helpButton` já vem resolvido para o `userId` desta página (`all`, ou `listed` e o usuário está na lista). `config.networkExclude` é somado às regras que a própria página passou para `run({ networkExclude })` ([§10](#10-api-javascript-para-hosts)). `config.sessionLog` é a chave do projeto para o log da sessão; `false` interrompe a gravação e apaga o que essa origem já tinha guardado ([§5.4](#54-log-da-sessão)). `config.eruda` é a política do projeto para o eruda ([§11](#11-política-do-projeto)); ele também pode ser `null` ou estar ausente (um gateway ou um `config` armazenado de antes de o campo existir), o que o SDK lê como `{"dock":false,"load":false}`, e o `run({ eruda })` da própria página continua prevalecendo campo a campo ([§10](#10-api-javascript-para-hosts)). O SDK guarda o último `config` no localStorage em `rwd:cfg` e o aplica na página seguinte até o `welcome` dela chegar.

Se houver um pedido de conexão pendente e a página que se reconecta for a página em primeiro plano do dispositivo, o gateway reenvia o `attach_request` logo depois do `welcome`.

### 3.5 Token do dispositivo, token de retomada e convites

**Token do dispositivo.** Na primeira vez que o gateway vê um `deviceId` vindo de um SDK que entende tokens, ele emite um token do dispositivo em `welcome.deviceToken` (32 bytes aleatórios, em hex; só um hash é armazenado). A partir daí, toda página desse dispositivo precisa apresentá-lo em `hello.deviceToken`; um token ausente ou errado é fechado com **4401**. Portanto, conhecer um `deviceId` e a chave do app pública não basta para entrar no dispositivo de outra pessoa.

- O SDK guarda o token no localStorage em `rwd:dtoken` e o expõe como `status().deviceToken`. O localStorage é por origem, então um host nativo que carrega vários domínios guarda o token ele mesmo e o devolve com `run({ deviceToken })` ([native-integration.pt-BR.md](native-integration.pt-BR.md)).
- Um hello que tem o campo `deviceToken` (mesmo `null`) entende tokens. Um hello sem o campo vem de um SDK que não consegue guardar um token; o gateway não emite token para ele (isso trancaria as páginas seguintes do dispositivo do lado de fora), mas, depois que um dispositivo tem um token, toda página precisa apresentá-lo.

**Token de retomada.** Todo `welcome` traz um novo token `resume` vinculado ao `pageId`. Quando uma página com um `pageId` conhecido se reconecta, o `hello.resume` dela precisa bater com o último emitido; senão a conexão é fechada com **4409** e o SDK recomeça com um `pageId` novo. Portanto, conhecer um `pageId` não basta para se passar por uma página.

**Convite.** Quando a URL da página traz `?rwd_invite=<token>`, o SDK remove o parâmetro da barra de endereço (`history.replaceState`), guarda o token no sessionStorage e o envia em `hello.invite` até chegar um `welcome`. O gateway o aceita se o convite pertencer ao mesmo projeto, não tiver sido usado e não tiver expirado: o dispositivo é marcado como `invited` e em atendimento, a linha do tempo registra de qual convite ele veio e o convite é consumido. Convites inválidos são ignorados em silêncio. Veja [§12.6](#126-convites-de-dispositivo).

### 3.6 Códigos de fechamento

| Código | Significado | Reação do SDK |
|---|---|---|
| `1008` | `hello` malformado | Reconecta com backoff |
| `1013` | A página não deu conta da fila de envio | Reconecta com backoff |
| `4401` | Token do dispositivo ausente ou errado | Se o token armazenado mudou nesse meio-tempo (outra aba acabou de recebê-lo), tenta de novo na hora; senão, estado `rejected` e nova tentativa em cerca de 10 minutos |
| `4409` | Token de retomada não confere | `pageId` novo e reconecta |
| `4429` | A cota de dispositivos online do projeto (`maxOnlineDevices`) foi atingida | Estado `quota` e nova tentativa em cerca de 5 minutos |

## 4. Estado de controle

Cada dispositivo tem um estado de controle, que o gateway decide e transmite para todas as páginas do dispositivo com uma mensagem `control`.

| Estado | Significado | UI da página |
|---|---|---|
| `none` | Nenhum agente conectado | Pílula recolhida com o código do dispositivo (mais o botão "Solicitar assistência", quando ativado) |
| `observe` | Um agente está conectado e só olhando | “IA vendo”, a entrada do usuário fica bloqueada (a menos que o usuário tenha desligado o bloqueio), borda da tela brilhando, botões **Assumir** e **Encerrar** |
| `agent` | O agente está operando a página | “IA operando”, o mesmo bloqueio, a mesma borda e os mesmos botões, além do cursor do agente |
| `user` | O usuário assumiu o controle | Sem bloqueio, uma borda estática, botões **Devolver à IA** e **Encerrar** |

Transições:

| Gatilho | Mudança |
|---|---|
| Um agente se conecta ([§7](#7-aprovação-da-conexão)) | `none` → `observe` |
| O agente chama uma ferramenta interativa (click, fill, type, press, select, hover, scroll, drag, navigate, back, reload) | `observe` → `agent`. Em `user`, o gateway recusa com o erro `takeover` sem falar com a página |
| Nenhuma interação durante `policy.agentIdleMinutes` (padrão 2; verificado a cada 10 s) | `agent` → `observe` |
| A página envia `control: takeover` | `observe` / `agent` → `user` |
| A página envia `control: handback` | `user` → `agent` (ou `none` se não houver agente conectado) |
| A página envia `control: end` | O agente é desconectado e a solicitação de assistência é retirada → `none` |
| O agente se desconecta ou é substituído, a chave dele é revogada, `policy.attachMaxMinutes` (padrão 60) se esgota, ou um membro do console encerra a sessão | → `none` |

A página fica bloqueada desde o momento em que um agente se conecta (`observe`), não só quando ele age, e continua bloqueada na volta de `agent` → `observe` por inatividade, até o usuário assumir o controle ou o estado voltar para `none`.

`attachedMs` é há quanto tempo o agente conectado está conectado, em milissegundos, no momento em que o gateway enviou a mensagem (`null` sem agente). É uma duração, para que a página não precise de um relógio em comum com o gateway; a barra inferior a mostra como um cronômetro “Conectado · 01:23” em `observe`, `agent` e `user`, e “Conectando…” enquanto a conexão da própria página está caída. Com um gateway sem esse campo, o SDK conta a partir de quando a página viu o agente pela primeira vez.

O SDK também recusa RPCs interativas com `takeover` enquanto o usuário está com o controle, como uma segunda verificação. Ele lembra o estado (e quando o agente se conectou) por 2 minutos no localStorage em `rwd:ctl`, para que a próxima página depois de uma navegação já fique bloqueada, com o cronômetro correndo, em vez de esperar pelo seu `welcome`. Assumir, devolver e encerrar só respondem a toques confiáveis do usuário; um agente não consegue pressioná-los, e um host nativo precisa apresentar a `nativeKey` ([§10](#10-api-javascript-para-hosts)).

## 5. RPC da página

### 5.1 Envelope

O gateway envia `{"id":<n>,"method":"rwd.…","params":{…}}` para uma página; a página responde com `{"id":<n>,"result":{…}}` ou `{"id":<n>,"error":{"code":"…","message":"…"}}`. Os ids são únicos por conexão. Se a conexão cair, as chamadas pendentes falham na hora.

Timeouts do lado do gateway: 20 s para chamadas MCP, 45 s para `rwd.click`, `rwd.press` e `rwd.type` com `submit: true` (o usuário pode ser solicitado a confirmar, [§8](#8-confirmação-de-ações-sensíveis)), 15 s para o teste de conexão do console.

Códigos de erro:

| Código | Significado |
|---|---|
| `not_found` | `ref` desatualizada ou elemento sumiu, opção desconhecida, id de requisição desconhecido |
| `not_interactable` | Não visível, desabilitado, coberto, somente leitura, ou não estável em 5 s |
| `timeout` | Uma espera se esgotou (na página ou no gateway) |
| `takeover` | O usuário está com o controle |
| `forbidden` | Acima do nível concedido ([§6](#6-níveis-de-acesso)), ou o usuário negou uma confirmação |
| `bad_request` | Parâmetro ausente ou inválido, método desconhecido |
| `internal` | Qualquer outra coisa (a mensagem traz o erro de JavaScript) |

As mensagens escritas pelo SDK ficam no idioma do agente (`welcome.agentLang`, [§15](#15-idiomas)).

### 5.2 Métodos

Todo método age sobre a página que o recebe.

| Método | Nível | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<ms>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}`: um snapshot de acessibilidade no formato de IA do Playwright (YAML, elementos marcados com `[ref=eN]`), seguido de uma seção de sobreposições quando algo flutua sobre a página ([§5.3](#53-comportamento-na-página)) |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}` (pelo menos um critério; `limit` 1–100) | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`, veja [§5.4](#54-log-da-sessão) | Depende do `op` |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}`: nomes de teclas do Playwright, combinações como `Control+A` | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}` (depois a página se reconecta) |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | Um registro do log da sessão completo: `{"seq","session","at","kind","page","imp","size","data"}`, com cabeçalhos e corpos ([§5.4](#54-log-da-sessão)) |

Detalhes:

- `rwd.query` compara `role` exatamente (ignorando maiúsculas/minúsculas) e `name` / `text` como substrings sem diferenciar maiúsculas/minúsculas; `text` cobre o texto do próprio elemento e dos descendentes, e só a correspondência mais interna é retornada.
- `rwd.fill` funciona em campos de texto, textareas e elementos `contenteditable` (um `<label>` é redirecionado para o seu controle). Ele define o valor pelo setter nativo e dispara `input` e `change`, para que inputs controlados de React e Vue percebam a mudança. Um `<select>` precisa de `rwd.select`.
- `rwd.type` foca `ref` (cursor no fim), se informado; senão digita no elemento com foco; `submit: true` pressiona Enter em seguida.
- `rwd.select` compara cada valor com o value, o label ou o texto de uma opção. Vários valores exigem um select `multiple`.
- `rwd.scroll` sem `ref` rola a página; com `ref`, dispara um evento de roda no elemento e rola o ancestral rolável dele. As rolagens são animadas ao longo de cerca de 0,3 s para que o usuário consiga acompanhar.
- `rwd.navigate` aceita só URLs `http(s)` absolutas ou relativas. Navegação, voltar e recarregar acontecem 50 ms depois de a resposta ser enviada.
- `rwd.waitFor` primeiro dorme `timeMs` (no máximo 60 s), depois verifica o texto visível (`document.body.innerText`) a cada 100 ms até `text` aparecer e `textGone` sumir, ou falha com `timeout` depois de `timeoutMs`.
- `rwd.screenshot` usa a captura nativa do app host quando uma está registrada e a região está dentro da viewport (`source: "native"`); senão, renderiza o DOM de novo (`source: "dom"`; canvas, vídeo e imagens de outras origens podem sair em branco). `ref` recorta no elemento; `fullPage` captura o documento inteiro. Veja [§10](#10-api-javascript-para-hosts).
- `rwd.console` / `rwd.network` com `sinceId` retornam as `limit` entradas mais antigas depois dele; sem ele, as `limit` mais recentes. Requisições em andamento têm `status: 0` e `durationMs: null`; `type` é `xhr`, `fetch`, `websocket`, `beacon` ou `eventsource`.
- `rwd.network` deixa de fora as requisições que as regras de exclusão capturam — o `networkExclude` do projeto mais `run({ networkExclude })` ([§11](#11-política-do-projeto)), mais `exclude` só para esta chamada — e `hidden` as conta. `includeExcluded: true` retorna todas e deixa `hidden` em 0. Requisições excluídas continuam sendo gravadas, e `rwd.networkDetail` continua retornando-as pelo id.
- `rwd.networkDetail` oculta os cabeçalhos `Cookie`, `Set-Cookie`, `Authorization` e `Proxy-Authorization`; os corpos são mascarados e cortados em 64 KB.
- `rwd.storage` retorna no máximo 500 entradas, com valores cortados em 4000 caracteres. Os cookies são os visíveis para scripts (não HttpOnly). Os próprios `rwd:dtoken` e `rwd:resume` do SDK são sempre mascarados.
- `rwd.evaluate` avalia o código-fonte da função no escopo global da página e a chama com `this = window`; ela pode retornar uma promise. O resultado é convertido para algo seguro em JSON: `undefined` e funções viram `null`, elementos viram uma descrição curta da tag, datas viram strings ISO e ciclos viram `"[Circular]"`.

### 5.3 Comportamento na página

- **Acionabilidade.** Ações de ponteiro esperam (até 5 s) até o elemento estar conectado, visível, estável por dois frames de animação, habilitado e rolado para dentro da área visível, e até um hit test no ponto-alvo cair no elemento ou num descendente. O primeiro ponto tentado é o centro visível do elemento, como faria um dedo; se algo o cobrir, os outros pontos de uma grade 3×3 dentro da caixa visível dele são tentados, para que um badge sobre um botão não bloqueie o clique. Quando todos os pontos estão cobertos, a chamada falha com `not_interactable` e uma mensagem que nomeia o elemento que está na frente e a `ref` dele (*the click point is covered by `<div.popup-mask>` (ref=o1; click it directly…)*), no qual o agente pode clicar em vez disso. O hit test ignora a própria UI do SDK e outras ferramentas de depuração (`.__chobitsu-hide__`, `#eruda`, `#__pageSpy`, `#__vconsole`).
- **Sobreposições.** Um snapshot termina com uma seção `[Overlays]` quando há camadas flutuando sobre a página: o fundo escurecido de um popup, um modal, uma bottom sheet. Elas são encontradas fazendo hit test em alguns pontos da viewport e ficando com o que estiver numa caixa fixa (ou absoluta do tamanho da viewport) que cubra pelo menos 15% da viewport e que não contenha ela mesma metade dos elementos do snapshot (isso seria a raiz do próprio app, não uma camada por cima dele). Cada linha traz a tag do elemento, algumas palavras do texto dele (limpo), a fração da viewport que ele cobre e uma `ref`; uma camada sem texto e sem mídia é listada como fundo (backdrop). Um fundo vazio não tem nó no snapshot ARIA, então recebe uma ref `oN` — é isso que permite a um agente tocar num fundo para fechar o popup dele.
- **Entrada sintética.** Um clique dispara `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click`, além de eventos de toque em dispositivos com tela sensível ao toque. Esses eventos têm `isTrusted: false`; páginas que verificam isso não reagem.
- **Feedback.** O alvo é destacado rapidamente, e um cursor do agente na página se move até ele antes de a entrada ser disparada.
- **Máscara.** Os valores de `input[type=password]`, de elementos com `data-rwd-mask` e dos `maskSelectors` do projeto são substituídos por `••••` em snapshots e capturas de tela (as capturas nativas recebem caixas cinza por cima deles). Esses valores, e o texto que bate com `maskPatterns`, também são substituídos no texto do console, nas URLs e corpos de rede, nos valores de armazenamento e nos resumos de eventos.
- **Escopo do snapshot.** O snapshot tem raiz em `<body>`. A UI do SDK vive num Shadow DOM sob `<html>`, fora de `<body>`; nós do eruda, do PageSpy e do vConsole são removidos do snapshot.
- **Buffers.** Console, erros não capturados e rede (XHR, fetch, WebSocket, sendBeacon, EventSource) são gravados desde o momento em que o SDK carrega, em buffers circulares de 500 entradas cada. Quando ficam cheios, logs comuns e requisições bem-sucedidas são descartados primeiro; `dropped` os conta. Os corpos de resposta ficam em cache até 5 MB no total, 64 KB cada.

### 5.4 Log da sessão

Os buffers da [§5.3](#53-comportamento-na-página) vivem na memória de uma página. O **log da sessão** é a versão longa: tudo o que aconteceu nesta origem desde que o app foi iniciado, gravado no **IndexedDB** (banco `rwd-log`) por todas as páginas da origem, com o gateway acessível ou não. Assim, um agente que se conecta depois do fato consegue ler todo o caminho até um bug, passando por recarregamentos e páginas. Ele nunca sai do dispositivo, a menos que um agente conectado o peça.

**Uma sessão é uma inicialização do app.** O id é resolvido nesta ordem:

1. `run({ launchId })` — o id de inicialização do próprio app host, gerado a cada cold start e igual para todas as WebViews desse processo;
2. `window.RWDLaunchId`, que o host ou o snippet de integração pode definir: uma string, ou uma função que retorna uma string (ou uma promise de uma, aguardada por no máximo 300 ms);
3. deduzido pelo SDK: um cookie de sessão `rwd_launch` (sem expiração, então ele morre com o processo do app) mais um heartbeat a cada 10 s. Uma sessão por cookie que ficou em silêncio por mais de **1 hora** é tratada como uma inicialização anterior e um id novo é iniciado, o que pega as WebViews que mantêm cookies de sessão entre inicializações.

O `source` de uma sessão diz qual foi o caso: `app` para 1 e 2, `cookie` para 3.

**O que é gravado.** Cada registro tem `seq` (a chave, crescente), `at`, `kind`, `page` (o `pageId` da página que escreveu) e `data`:

| `kind` | `data` |
|---|---|
| `page` | `event: "open"` (url, título, referrer), `"nav"` (de onde, url, título — incluindo navegações internas da página), `"visibility"` (primeiro plano / segundo plano), `"hide"` (a página foi embora) |
| `action` | A entrada (confiável) do próprio usuário: `"tap"` (a descrição do elemento), `"input"` (descrição do campo e valor), `"submit"`, `"scroll"` (onde a rolagem parou). O valor de um campo de senha, de um elemento `data-rwd-mask` ou de algo que bata com `maskSelectors` é guardado como `••••`, nunca em texto claro; os outros valores são limpos com `maskPatterns` e cortados em 200 caracteres |
| `agent` | As chamadas interativas do agente e `rwd.evaluate`: método, `ref`, tecla, url, valores, texto, e o erro se falhou. Leituras (snapshots, listas) ficam de fora |
| `control` | Mudanças do estado de controle, com o nome do agente ([§4](#4-estado-de-controle)) |
| `console` | Todos os níveis, com `type`, `text` e `source` |
| `net` | Toda requisição concluída: método, url, status, tipo, duração, tamanho, erro. Uma requisição **com falha** também traz `reqHeaders` / `resHeaders` (ocultados como em `rwd.networkDetail`) e `reqBody` / `resBody`, cada um cortado em 64 KB |

Erros e avisos do console, requisições com falha, toques, entradas e envios do usuário, ações do agente e mudanças de controle são marcados como importantes e guardados por mais tempo. *Problemas*, que `problems` e `overview` selecionam, são erros do console e requisições com falha.

**Limites.** As **3** últimas inicializações são guardadas, cada uma dentro de **10 MB**. Acima disso, os registros não importantes mais antigos (logs comuns do console, requisições bem-sucedidas) são descartados primeiro, depois os mais antigos de todos, até chegar a 80% do teto; `trimmed` os conta. Se `navigator.storage.estimate()` informar uma cota abaixo de 64 MB, só a inicialização atual é guardada. Sem IndexedDB (alguns modos privados), nada é gravado e `rwd.log` falha com `internal`.

**Como ler.** `rwd.log` recebe um `op`:

```jsonc
// op: "sessions" → todas as inicializações ainda guardadas, da mais nova para a mais antiga
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview", params {"session"?} → uma inicialização num relance
{"session":{…meta…,"current":true},"first":<ms>,"last":<ms>,
 "pages":[{"at","page","data"}],      // registros de abertura / navegação de páginas, os 60 últimos
 "problems":[…records…]}              // erros do console e requisições com falha, os 20 últimos

// op: "records", params {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                       "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                       "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // passe como `after` para a próxima página
 "hidden":0}                          // requisições ocultadas pelas regras de exclusão de rede (§11)
```

- `session` assume a inicialização atual por padrão (`"current"` significa o mesmo); um id desconhecido falha com `not_found`. Se nenhuma inicialização estiver gravando, é usada a mais nova armazenada.
- `problems: true` mantém só os erros do console e as requisições com falha. `text` é uma substring, sem diferenciar maiúsculas/minúsculas, do `data` do registro. `limit` vai de 1 a 500, padrão 100.
- Os registros voltam **sem** cabeçalhos e corpos; `data.hasBody` é `true` onde existe um corpo. `rwd.logDetail` retorna aquele registro completo e exige `advanced` ([§6](#6-níveis-de-acesso)), assim como `rwd.networkDetail`.
- As regras de exclusão de rede também valem aqui, então um registro `net` que as regras capturam fica de fora de `records` e é contado em `hidden`, a menos que `includeExcluded` esteja definido.

**Como desligar.** `run({ record: false })` impede uma única página de escrever. `policy.sessionLog: false` ([§11](#11-política-do-projeto)) chega às páginas como `welcome.config.sessionLog` e interrompe a gravação **e apaga os logs já guardados para a origem**. `status().logSession` é o id da sessão em que uma página está escrevendo, ou `null` quando ela não está gravando.

## 6. Níveis de acesso

| Nível | Métodos permitidos |
|---|---|
| `observe` | `rwd.ping`, `rwd.snapshot`, `rwd.query`, `rwd.screenshot`, `rwd.console`, `rwd.network`, `rwd.waitFor`, `rwd.log` |
| `interact` | `observe` + `rwd.click`, `rwd.fill`, `rwd.type`, `rwd.press`, `rwd.select`, `rwd.hover`, `rwd.scroll`, `rwd.drag`, `rwd.navigate`, `rwd.back`, `rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`, `rwd.networkDetail`, `rwd.storage`, `rwd.logDetail` |

O nível de uma conexão é

```
min(nível pedido pelo agente (padrão interact),
    o maxLevel da chave de API,
    o maxLevel da política de projeto combinada,
    o nível que o usuário escolheu no dispositivo)
```

Os dois lados o aplicam: o gateway recusa chamadas acima do nível (erro `forbidden`, auditoria `policy.denied`), e o SDK verifica de novo contra `welcome.level` / `control.level` antes de executar qualquer coisa. O gateway trata métodos desconhecidos como `advanced`. Se um gateway não enviar nível enquanto um agente estiver conectado, o SDK assume `interact`.

## 7. Aprovação da conexão

Quando um agente chama `connect_device`, o gateway combina as políticas dos projetos cujas páginas estão abertas no dispositivo ([§11](#11-política-do-projeto)). Se o `approval` combinado for `prompt`, o usuário precisa aprovar no dispositivo:

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"Support Bot","keyHint":"…a91f"},
   "levels":["observe","interact"],   // níveis oferecidos, limitados pela chave e pela política; o último é o que o agente pediu
   "expiresInSec":30}
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // ou "level": null para negar
← {"t":"attach_cancel","requestId":"…"}                         // tempo esgotado, ou o agente desistiu
```

- O pedido vai para a **página em primeiro plano** do dispositivo; `attach_cancel` vai para todas as páginas.
- Sem resposta em **30 segundos**, conta como tempo esgotado. A chamada MCP espera pela resposta.
- Se a mesma chave de API for negada **3 vezes** no mesmo dispositivo em 10 minutos, os pedidos dela para esse dispositivo são recusados sem perguntar durante **10 minutos**.
- Só pode haver um pedido pendente por dispositivo.
- A caixa de diálogo do SDK vive num Shadow DOM, aceita só toques confiáveis e é ativada 0,4 s depois de aparecer, para que um agente não consiga se aprovar sozinho. Abas da mesma origem compartilham a decisão via BroadcastChannel.
- O usuário pode ativar a **permissão automática** com um nível máximo na janela flutuante do SDK; o SDK então responde na hora com o maior nível oferecido dentro desse limite e mostra um aviso.
- Com `run({ nativeApproval: true })`, o SDK não mostra caixa de diálogo. Em vez disso, `status().pending` passa a ser `{kind:"attach", requestId, agent:{name, keyHint}, levels, expiresAt}` e o host nativo responde com `nativeDecide(nativeKey, requestId, level | null)`.
- Depois da aprovação, o gateway conecta o agente (substituindo qualquer outro agente no dispositivo), retira a solicitação de assistência (`{"t":"help","on":false}`) e transmite `{"t":"control","state":"observe","agent":{…},"level":"interact","attachedMs":0}`; a página fica bloqueada na hora ([§4](#4-estado-de-controle)).

Com `approval: none`, o agente se conecta na hora, no nível calculado.

**Voltar sem perguntar de novo.** Um agente que solta o dispositivo por conta própria — `disconnect_device`, conectar-se a outro dispositivo ou `policy.attachMaxMinutes` se esgotando — deixa uma concessão para trás: durante **10 minutos**, a mesma chave de API pode se conectar de novo àquele dispositivo sem caixa de diálogo no celular, com **no máximo o nível que o usuário concedeu antes** (então pedir `advanced` depois de uma aprovação `observe` continua dando `observe`). Nada mais é afrouxado: a chave, a política e o próprio pedido do agente continuam limitando o nível, e o dispositivo precisa ter uma página conectada. Essa conexão é auditada como `attach.resume` ao lado do `attach.start` de sempre ([§12.7](#127-log-de-auditoria)), e a página vê a mensagem `control` comum, não um `attach_request`.

Voltar não consome a concessão: soltar de novo começa uma nova janela de 10 minutos. A concessão é descartada quando a sessão termina por qualquer outro motivo: o usuário toca em **Encerrar** no dispositivo, um membro do console a encerra (`POST /devices/:id/end`), a chave de API é revogada, outro agente se conecta ao dispositivo e substitui este, ou o usuário nega um pedido. Ela também expira junto com o processo do gateway, já que fica em memória.

## 8. Confirmação de ações sensíveis

Antes de agir, o SDK pergunta ao usuário quando o agente:

- clica (`rwd.click`) num elemento que bate com `[data-rwd-confirm]` ou com os `confirmSelectors` da política, ou que está dentro de um desses;
- pressiona Enter (`rwd.press`, ou `rwd.type` com `submit: true`) num elemento desses, ou num formulário que contém um (não numa textarea nem num editor de texto rico).

A caixa de diálogo diz algo como *A IA quer tocar em “Fazer pedido”. Permitir?*, aceita só toques confiáveis e expira depois de **30 segundos**. Uma negação ou o tempo esgotado fazem a RPC falhar com `{"code":"forbidden","message":"The user denied this action"}`. Só pode haver uma confirmação aberta por vez; ela é cancelada quando o usuário assume o controle, o agente sai ou a conexão cai.

Com `nativeApproval: true`, `status().pending` passa a ser `{kind:"confirm", requestId, action:'click "Place order"', expiresAt}` e o host responde com `nativeDecide(nativeKey, requestId, "allow" | null)`. Em `status().pending`, uma confirmação pendente tem precedência sobre um pedido de conexão pendente.

## 9. Fallback por polling de presença

Quando o WebSocket falha 3 vezes seguidas, o SDK passa a chamar `POST /v1/presence` a cada 60 segundos. Ele envia `Content-Type: text/plain` com um corpo JSON, então não é preciso preflight de CORS; o gateway responde com `Access-Control-Allow-Origin: *`.

```jsonc
// requisição
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// resposta
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- O gateway usa `key`, `deviceId`, `userId`, `device.{ua, platform, app}`, `deviceToken` e `help`; `pageId` e `page` são só informativos. Chave do app e origem são verificadas como no WebSocket, com o mesmo limite de taxa.
- Um dispositivo que já recebeu um token do dispositivo ([§3.5](#35-token-do-dispositivo-token-de-retomada-e-convites)) precisa enviá-lo aqui também; senão a chamada falha com `401 bad_token` e nada do dispositivo é atualizado. Um dispositivo sem token (um SDK mais antigo) continua fazendo polling sem ele.
- `help: true` marca o dispositivo como solicitando assistência, como faz `hello.help`, a menos que um agente já esteja conectado.
- Um dispositivo em polling conta como online por 90 segundos depois de cada chamada.
- `connect: true` diz à página para abrir o WebSocket agora. O gateway o define quando um agente chama `connect_device` ou `wait_for_device` para o dispositivo.
- Como rede de segurança, o SDK também tenta o WebSocket de novo a cada 5º polling.

## 10. API JavaScript para hosts

O SDK expõe `window.RemoteWebviewDebugger`. As páginas chamam `run()`; hosts nativos injetam o SDK e chamam `run()` com opções extras (veja [native-integration.pt-BR.md](native-integration.pt-BR.md)).

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null: o usuário logado, mostrado aos agentes e no console
  helpButton,            // mostra o botão "Solicitar assistência" (combinado por OU com o helpButton da política)
  app,                   // { name, version } do app host
  lang,                  // uma tag de idioma para a UI do usuário do celular; padrão a partir de navigator.languages (§15)
  locales,               // pacotes de idioma extras; messages: substituições por idioma (§15)
  theme,                 // 'auto' (padrão) | 'system' | 'light' | 'dark'
  style,                 // cores, fontes, raios, z-index, posições como propriedades CSS --rwd-* (sdk/README.md)
  lockScreen,            // bloqueia a entrada enquanto um agente está conectado (padrão true; o usuário pode mudar)
  eruda,                 // true | { dock, load, src, name }: aparece como uma aba dentro do eruda
  networkExclude,        // requisições a deixar fora do que o agente lê (§11)
  record,                // mantém o log da sessão (padrão true; a política pode desligá-lo, §5.4)
  // hosts nativos
  deviceId,              // um id por instalação, compartilhado por todas as WebViews e domínios
  deviceToken,           // o token de status().deviceToken, guardado pelo host
  launchId,              // esta inicialização do app, compartilhada por todas as WebViews do processo (§5.4)
  nativeKey,             // um segredo que só o host conhece; habilita nativeControl / nativeDecide
  nativeApproval,        // o próprio host mostra as perguntas de conexão / confirmação
}) // → Promise<{ deviceCode, status }>
```

| Função | Descrição |
|---|---|
| `run(gatewayUrl, appKey, options?)` | Coloca a página online. Resolve assim que o gateway responde, ou depois de 8 s com o que se sabe até ali. Chamá-la de novo retorna a mesma promise |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`. `status` é `idle`, `connecting`, `online`, `polling`, `rejected`, `quota` ou `stopped`; `logSession` é o log da sessão em que esta página escreve, `null` quando ela não está gravando ([§5.4](#54-log-da-sessão)) |
| `help(on = true)` | Solicita assistência ou cancela a solicitação |
| `setUser(userId)` | Troca o usuário logado (o SDK se reconecta com um `hello` novo) |
| `stop()` | Desconecta e remove a UI; a captura de console e de rede continua, com limite |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | Os botões de controle do próprio host nativo. Retorna `false` se a chave não bater |
| `nativeDecide(nativeKey, requestId, value)` | Responde a `status().pending`: um nível ou `null` para `attach`, `'allow'` ou `null` para `confirm`. Retorna `false` se a chave, o pedido ou o valor estiver errado |

**Id de inicialização.** Além de `run({ launchId })`, um host pode definir `window.RWDLaunchId` antes de o SDK rodar: uma string, ou uma função que retorna uma string ou uma promise de uma (aguardada por no máximo 300 ms). Ele precisa ter 4–128 caracteres de `[A-Za-z0-9_.:-]`; qualquer outra coisa é ignorada e o SDK deduz a inicialização sozinho ([§5.4](#54-log-da-sessão)).

A `nativeKey` é escrita só no script injetado e comparada em tempo constante. Scripts da página, incluindo o `evaluate_script` de um agente, não conseguem lê-la, então não conseguem devolver o controle nem se aprovar sozinhos.

**Pontes nativas de captura de tela.** Se o host registrar uma destas, `rwd.screenshot` a usa para obter pixels reais (incluindo vídeo, canvas, imagens de outras origens e sobreposições nativas). Cada uma retorna uma data URL PNG ou JPEG, ou base64 puro, da WebView visível:

| Ponte | Plataforma |
|---|---|
| `window.RWDNativeScreenshot()` | Qualquer host; retorna `string` ou `Promise<string>` |
| `webkit.messageHandlers.rwdScreenshot` | `WKWebView` no iOS / macOS, registrada como `WKScriptMessageHandlerWithReply`; recebe `{type:"screenshot"}` |
| `window.RWDAndroid.screenshot()` | Android, um método `@JavascriptInterface` |

Implementação de referência: [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift).

## 11. Política do projeto

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt: o usuário aprova cada conexão no dispositivo (padrão prompt)
  maxLevel: Level                  // nível mais alto para este projeto (padrão interact)
  maskSelectors: string[]          // seletores CSS extras a mascarar (além de campos de senha e [data-rwd-mask])
  maskPatterns: { name: string; regex: string }[]  // padrões de texto a mascarar, por exemplo números de telefone ou documentos (regex JavaScript)
  confirmSelectors: string[]       // clicar nestes exige o OK do usuário (além de [data-rwd-confirm])
  networkExclude: string[]         // requisições deixadas fora do que os agentes leem (§5.2)
  sessionLog: boolean              // as páginas mantêm um log da sessão (padrão true, §5.4)
  helpButton: 'off' | 'all' | 'listed'   // quem vê o botão "Solicitar assistência" (padrão off)
  helpUsers: string[]              // userIds para helpButton = listed
  agentIdleMinutes: number         // agent → observe depois de tanto tempo de inatividade (padrão 2, máx. 120)
  attachMaxMinutes: number         // uma conexão termina depois de tanto tempo (padrão 60, máx. 1440)
  maxOnlineDevices: number         // 0 = ilimitado; acima disso, dispositivos novos são fechados com 4429
  maxAgents: number                // agentes conectados ao mesmo tempo aos dispositivos deste projeto; 0 = ilimitado
  eruda: { dock: boolean; load: boolean }  // padrão remoto para run({ eruda }); as opções locais prevalecem campo a campo.
                                           // Em welcome.config pode ser null ou estar ausente (= ambos false), §3.4
}
```

- Os valores são normalizados ao salvar: um `approval` diferente de `none` vira `prompt`, um `maxLevel` inválido vira `interact`, números são limitados ao intervalo. `maskPatterns` precisa compilar, senão `400 bad_policy`. `maskSelectors`, `confirmSelectors`, `networkExclude` e `helpUsers` perdem as entradas em branco e são cortados em 50 cada; `maskPatterns`, em 20.
- **`networkExclude`** é o ruído pelo qual um agente não deveria ter que passar: fontes que sempre dão 404, beacons de analytics. Cada regra é comparada com a URL da requisição como substring sem diferenciar maiúsculas/minúsculas, como padrão com curinga `*` (`*/404/*`), ou como expressão regular quando escrita `/…/` (com flags opcionais; o padrão é `i`). Uma regra que não compila não captura nada. As requisições capturadas ficam de fora da lista de rede e dos eventos `net_fail` da linha do tempo, mas a página continua gravando-as, então um agente pode pedi-las com `includeExcluded` ([§5.2](#52-métodos), [§14.3](#143-ferramentas)). Elas são uma conveniência, não um controle de privacidade — use `maskSelectors` / `maskPatterns` para dados que não podem sair da página.
- **`sessionLog`** fica ligado a menos que seja definido como `false`, inclusive para projetos salvos antes de o campo existir. Desligá-lo impede todas as páginas do projeto de gravar e apaga os logs que já estão naqueles dispositivos para aquela origem; uma única página pode optar por não gravar por conta própria com `run({ record: false })` ([§5.4](#54-log-da-sessão)).
- Os campos de máscara, confirmação, exclusão de rede, log da sessão, assistência e eruda chegam às páginas em `welcome.config` ([§3.4](#34-welcome)); as regras do próprio `run({ networkExclude })` de uma página são somadas às do projeto.
- **Vários projetos num dispositivo.** Um dispositivo é identificado pelo seu `deviceId`, não pelo projeto: páginas carregadas com chaves do app diferentes no mesmo celular são páginas de um único dispositivo. Quando um agente se conecta, o gateway combina as políticas dos projetos cujas páginas estão conectadas, ficando com o valor mais restritivo: `prompt` se algum projeto o pedir, os menores `maxLevel`, `agentIdleMinutes` e `attachMaxMinutes`, e o menor `maxAgents` diferente de zero.

## 12. API REST do console

### 12.1 Convenções

- Caminho base `/v1/api`. Entre com `POST /auth/login`; a sessão é um cookie HttpOnly `rwd_session` (12 horas, `SameSite=Lax`, `Secure` sobre HTTPS). A conta é lida de novo a cada requisição, então desativar ou excluir um membro tem efeito na hora.
- Toda requisição que não seja `GET` / `HEAD` para um endpoint que exige sessão precisa trazer `X-RWD-CSRF: 1`, senão `403 csrf`.
- Os erros são `{"error":{"code":"…","message":"…"}}` com status 4xx/5xx. As mensagens seguem o idioma da requisição ([§15](#15-idiomas)).
- Códigos comuns: `401 unauthorized` (não logado), `403 forbidden` (papel insuficiente), `403 csrf`, `404 not_found`, `400 bad_request`, `429 rate_limited`, `500 internal`.

Papéis: `owner` (tudo, incluindo membros), `admin` (projetos, chaves, políticas, dispositivos, convites, auditoria), `member` (ler projetos e dispositivos, testar conexões, encerrar sessões, criar convites de dispositivo, ler o log de auditoria). Nas tabelas abaixo, *member* significa qualquer conta logada.

### 12.2 Contas e membros

| Método | Caminho | Papel | Requisição | Resposta |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}` e o cookie. `401 bad_password`; `429 rate_limited` depois de 10 tentativas por minuto por IP. Um `email` vazio significa `admin` |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`. A nova senha precisa ter 8–256 caracteres; `400 bad_password` se a antiga estiver errada |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity"}` |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<host>/invite/<token>"}` (válido por 7 dias, uma vez). `409 conflict` se o e-mail já existir |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`. `409 last_owner` se não sobrar nenhum proprietário ativo |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`. `409 self`, `409 last_owner` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}` e faz o login. Limite de taxa igual ao do login |

O primeiro proprietário é criado na inicialização a partir de `RWD_ADMIN_EMAIL` (padrão `admin`) e `RWD_ADMIN_PASSWORD` (veja [gateway/README.pt-BR.md](../gateway/README.pt-BR.md)). A página do console `/invite/:token` aceita um convite de membro.

### 12.3 Projetos

| Método | Caminho | Papel | Requisição | Resposta |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project` (com a política padrão) |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`. `policy` é mesclada na atual |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | `Project` com uma chave do app nova |
| GET | `/projects/:id/integration` | member | — | `Integration` |

As entradas de `allowedOrigins` são origens completas, como `https://m.example.com`, com um rótulo curinga inicial opcional: `https://*.example.com` aceita qualquer subdomínio, mas não o próprio `https://example.com`. Vazio significa qualquer origem. `inviteUrl` precisa ser uma URL `http(s)`.

### 12.4 Chaves de API

As chaves de API pertencem ao gateway, não a um projeto: uma chave alcança todos os dispositivos.

| Método | Caminho | Papel | Requisição | Resposta |
|---|---|---|---|---|
| GET | `/keys` | member | — | `{"keys":[ApiKey]}` |
| POST | `/keys` | admin | `{"name","maxLevel"?:"interact","expiresInDays"?:90,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}`: a única vez em que a chave completa é retornada |
| DELETE | `/keys/:id` | admin | — | `{"ok":true}`. A revogação é imediata: o agente da chave é desconectado e a próxima requisição MCP dele recebe 401 |

`expiresInDays: 0` significa nunca. `ipAllowlist` aceita IPs ou CIDRs; quando definido, requisições MCP de outros endereços recebem 401. `GET` / `POST /projects/:id/keys` são aliases antigos de `/keys`.

### 12.5 Dispositivos e status do gateway

| Método | Caminho | Papel | Resposta |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}` (`pageSize` ≤ 100). `online` (padrão): dispositivos online, os conectados mais recentemente primeiro. `all`: todos os dispositivos conhecidos, os mais novos primeiro. Nos dois modos, `q` compara com id do dispositivo, código do dispositivo (hífens opcionais), userId, user agent, o rótulo do sistema (em qualquer um dos idiomas) e nomes de projetos |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}`: dispositivos cuja página mais recente veio do projeto (padrão `all`, até 500), primeiro os que solicitam assistência, depois os online, depois os vistos mais recentemente. `waiting` significa que o usuário solicitou assistência (exibido como Em atendimento) |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | Sempre `200`: `{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<first 4000 characters>","error"?:{"code","message"}}`. Códigos: `device_offline`, `no_page` (a página está se reconectando), `timeout`, `takeover`, `internal` e os códigos de RPC da [§5.1](#51-envelope) |
| POST | `/devices/:id/end` | member | `{"ok":true}`: desconecta o agente, retira a solicitação de assistência, controle de volta para `none` |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |

### 12.6 Convites de dispositivo

Um convite permite que um usuário coloque o dispositivo online, com a assistência já solicitada, só abrindo um link. Ninguém precisa ditar um código do dispositivo.

| Método | Caminho | Papel | Requisição | Resposta |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}` (`link` é a URL de destino sem o token, que não é armazenado) |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | `DeviceInvite` com o `link` completo (`<url>?rwd_invite=<token>`) |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url` assume por padrão o `inviteUrl` do projeto; um dos dois é obrigatório. `expiresInMinutes` é limitado a 7 dias. A página do link precisa carregar o SDK com a chave do app do mesmo projeto ([§3.5](#35-token-do-dispositivo-token-de-retomada-e-convites)).

### 12.7 Log de auditoria

`GET /audit?project=&device=<device code>&actor=&action=&from=&to=&limit=50&before=<id>` (member) → `{"events":[AuditEvent],"nextBefore":<id>|null}`, os mais novos primeiro. `limit` ≤ 200; `action` é comparado por prefixo (`attach.` captura todos os eventos de conexão); `actor` compara com o id ou o nome de um ator.

| Ação | Quando |
|---|---|
| `auth.login`, `auth.login_failed` | Login no console |
| `member.invite`, `member.accept`, `member.update`, `member.delete` | Gestão de membros |
| `project.create`, `project.update`, `project.delete`, `project.rotate_app_key` | Projetos |
| `key.create`, `key.revoke` | Chaves de API |
| `invite.create`, `invite.delete`, `invite.use` | Convites de dispositivo |
| `attach.request`, `attach.approve`, `attach.deny`, `attach.timeout`, `attach.resume`, `attach.start`, `attach.end` | Conexões de agentes. `attach.resume` significa que a chave voltou dentro do período de tolerância em vez de perguntar de novo ([§7](#7-aprovação-da-conexão)); `detail: {level}` |
| `rpc` | Toda RPC de página feita por um agente; `detail: {method, page, latencyMs, error?}` |
| `control.takeover`, `control.handback`, `control.end` | Os botões do usuário |
| `device.end` | Um membro do console encerrou uma sessão |
| `policy.denied` | Uma chamada acima do nível concedido foi recusada |

Os eventos nunca contêm conteúdo da página nem valores de parâmetros. Por padrão, são guardados por 180 dias (`RWD_AUDIT_RETENTION_DAYS`).

### 12.8 Tipos

```ts
type Project = {
  id: string; name: string; appKey: string; allowedOrigins: string[]; disabled: boolean
  createdAt: number; policy: Policy; inviteUrl: string
  onlineDevices: number; totalDevices: number
}

type ApiKey = {
  id: string; name: string; prefix: string /* rwd_sk_live_ab12 */
  maxLevel: Level; expiresAt: number | null; ipAllowlist: string[]
  createdAt: number; lastUsedAt: number | null; revokedAt: number | null
}

type Integration = {
  appKey: string; gatewayUrl: string; sdkUrl: string
  firstSeenAt: number | null; onlineDevices: number; lastDevice: Device | null
}

type Device = {
  id: string /* deviceId */; code: string
  projectId: string            // projeto da página mais recente
  projects: string[]           // projetos das páginas conectadas
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* quando ficou online; só enquanto online */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; expiresAt: number } | null
  task?: Task                  // só enquanto o agente conectado tiver definido uma
  pages: number                // páginas conectadas
  sdk: string                  // versão do SDK informada pela página
  currentPage: { label: string; url: string; title: string } | null  // a página que o usuário provavelmente está vendo
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // só em GET /devices
}

type SystemInfo = {            // extraído do user agent
  os: string; osVersion: string; model: string; browser: string
  label: string                // por exemplo "iOS 18.0 · iPhone · WebView", "Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // a página que o usuário provavelmente está vendo
  selected: boolean            // a página em que o agente trabalha
  openerLabel: string | null; connectedAt: number
}

type TimelineEvent = { at: number; page: string /* rótulo; "" para eventos do dispositivo inteiro */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // substitui a contagem
  timeline: TimelineEvent[]    // os 100 mais recentes, do mais antigo para o mais novo
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* convite ainda não aceito */
  createdAt: number; lastLoginAt: number | null
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* código do dispositivo, prefixo da chave, e-mail do membro… */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}
```

### 12.9 Eventos da linha do tempo

Cada dispositivo mantém em memória os seus 300 últimos eventos da linha do tempo; o console mostra os 100 mais recentes e o MCP, por padrão, os 50 mais recentes.

| `kind` | Significado |
|---|---|
| `opened` / `closed` | Uma página se conectou pela primeira vez / sumiu depois do período de tolerância ([§3.1](#31-ciclo-de-vida)) |
| `navigated` / `reloaded` | Uma página foi para uma URL nova / se reconectou na mesma URL |
| `focus` | Uma página veio para o primeiro plano |
| `error` / `console_error` / `net_fail` / `user_tap` | Eventos informados pela página ([§3.2](#32-página--gateway)) |
| `help` | O usuário solicitou assistência ou cancelou a solicitação, ou chegou por um convite |
| `agent` | Pedidos de conexão, negações, tempos esgotados, conexões, mudanças de tarefa |
| `control` | Mudanças do estado de controle; o resumo traz o motivo (usuário assumiu o controle, IA inativa, usuário encerrou, …) |
| `offline` | A última página do dispositivo foi embora enquanto havia um agente conectado |

## 13. Atualizações em tempo real (SSE)

`GET /v1/api/stream[?project=<id>][&lang=<tag>]` (member, autenticação por cookie) transmite `text/event-stream`:

```
retry: 3000

event: device     data: Device                               um dispositivo mudou (online, assistência, controle, aprovação, tarefa…)
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   a cada 25 s
```

Sem `project`, são transmitidos os eventos de todos os projetos. `EventSource` não consegue definir cabeçalhos, então o idioma vai em `?lang=`. Um assinante lento perde eventos em vez de travar o gateway; o console busca tudo de novo quando se reconecta e cai para polling se o stream falhar.

## 14. MCP

### 14.1 Sessões

- Endpoint `/v1/mcp` (Streamable HTTP). Toda requisição precisa trazer `Authorization: Bearer <API key>`. A chave é verificada a cada requisição, então uma chave revogada ou expirada, ou um endereço fora do `ipAllowlist` dela, recebe 401 na hora.
- O gateway mantém um estado de agente por chave de API: o dispositivo conectado e a página selecionada. Sessões MCP que usam a mesma chave o compartilham. Um agente fica conectado a no máximo um dispositivo por vez; conectar-se a outro dispositivo o desconecta do primeiro. Uma chave alcança todos os dispositivos do gateway.
- Mais de 5 buscas de dispositivo com falha por minuto com uma chave são recusadas pelo resto do minuto, o que impede que códigos de dispositivo sejam adivinhados.

### 14.2 Resultados

Todo resultado de ferramenta termina com o que mudou no dispositivo desde a chamada anterior do agente (no máximo 20 linhas), para que o agente perceba páginas novas, navegações, erros e tomadas de controle sem precisar fazer polling:

```
[Session changes]
- p3 "Checkout" opened (opened by p2)
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- The user took over
```

O conteúdo que vem da página (snapshots, console, rede, armazenamento, resultados de evaluate, linha do tempo) é envolvido numa tag e marcado como dado não confiável, para que o agente não siga instruções encontradas nele.

### 14.3 Ferramentas

| Ferramenta | Nível | Parâmetros | Descrição |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all` (padrão `online`), `userId?`, `deviceCode?` (maiúsculas ou minúsculas, com ou sem o hífen) | Até 50 dispositivos, primeiro os que solicitam assistência |
| `connect_device` | — | `device` (código do dispositivo ou deviceId), `level?: Level` (padrão `interact`), `follow?: true` | Conecta, perguntando antes ao usuário se for exigido ([§7](#7-aprovação-da-conexão)); até 10 minutos depois de soltar o dispositivo por conta própria, a mesma chave volta sem perguntar de novo, com no máximo o nível concedido naquela vez. Seleciona a página em primeiro plano. Falha se o dispositivo não tiver página conectada (e cutuca um dispositivo em polling para se reconectar) |
| `disconnect_device` | — | — | Desconecta |
| `wait_for_device` | — | `device`, `timeoutSec?: 60` (máx. 300) | Espera até o dispositivo ter uma página conectada; um dispositivo em polling recebe o aviso para se reconectar |
| `list_pages` | — | — | Páginas do dispositivo: rótulo, título, URL, selecionada, primeiro plano / segundo plano, reconectando, quem abriu |
| `select_page` | — | `page` (rótulo) | Muda a página selecionada |
| `take_snapshot` | observe | `page?` | Snapshot de acessibilidade com refs, mais as sobreposições que flutuam sobre a página e as refs delas ([§5.3](#53-comportamento-na-página)) |
| `find_elements` | observe | `text?`, `role?`, `name?`, `limit?`, `page?` | Encontra elementos e as refs deles sem um snapshot completo (`rwd.query`) |
| `take_screenshot` | observe | `page?`, `fullPage?`, `format?: jpeg\|png` | Retorna uma imagem |
| `wait_for` | observe | `text?`, `textGone?`, `timeSec?` (máx. 30) | Espera na página selecionada |
| `list_console_messages` | observe | `scope?: page\|session`, `types?`, `limit?: 50` | `session` junta todas as páginas conectadas e identifica cada linha com a página dela |
| `list_network_requests` | observe | `scope?`, `failedOnly?`, `limit?: 50`, `exclude?`, `includeExcluded?` | Igual; os ids são listados como `<label>:<id>`. `exclude` acrescenta regras para esta chamada por cima das do projeto e da página ([§11](#11-política-do-projeto)); quando as regras ocultaram algo, o resultado termina com *N requests hidden by the exclude rules*, e `includeExcluded: true` as mostra |
| `click` / `hover` | interact | `ref` | Um clique bloqueado por uma sobreposição falha com `not_interactable` e informa a `ref` do elemento que está na frente, no qual dá para clicar em vez disso ([§5.3](#53-comportamento-na-página)) |
| `fill` | interact | `ref`, `value` | |
| `type_text` | interact | `text`, `ref?`, `submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`, `values` | |
| `scroll` | interact | `ref?`, `dx?`, `dy?` (padrão `dy: 600`) | |
| `drag` | interact | `fromRef`, `toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]` (1–30), `stopOnError?: true` | Executa `click`, `fill`, `type_text`, `press_key`, `select_option`, `hover`, `scroll` e `wait_for` em ordem e retorna um único resultado para todos |
| `get_network_request` | advanced | `id` (`<label>:<id>` da lista, ou um id puro para a página selecionada) | Cabeçalhos e corpos |
| `get_storage` | advanced | `area: local\|session\|cookie`, `page?` | |
| `evaluate_script` | advanced | `function`, `args?`, `page?` | Executa JavaScript na página; resultados acima de 20.000 caracteres são cortados |
| `get_session_timeline` | — | `limit?: 50` | A linha do tempo do dispositivo, passando por todas as páginas |
| `get_session_overview` | observe | `session?` | O log da sessão da inicialização atual num relance ([§5.4](#54-log-da-sessão)): quando começou, quanto está guardado, contagem de registros, as páginas visitadas, os 20 últimos erros e requisições com falha, e as inicializações que ainda estão guardadas além desta |
| `get_session_log` | observe | `session?`, `kinds?`, `problems?`, `page?`, `text?`, `after?`, `limit?`, `seq?`, `exclude?`, `includeExcluded?` | O log da sessão registro por registro, como `#<seq> <time> <page> <line>`. `page` aceita um rótulo como `p2` ou um id de página como o log o imprime; `after` avança a partir do `seq` em que o resultado anterior terminou. `seq`, em vez disso, mostra aquele registro completo (cabeçalhos e corpos; exige `advanced`, já que chama `rwd.logDetail`) |
| `wait_for_page` | — | `urlContains?`, `titleContains?`, `timeoutSec?: 30` (máx. 300) | Espera por uma página aberta ou navegada desde a chamada anterior |
| `wait_for_event` | — | `kind?` ([§12.9](#129-eventos-da-linha-do-tempo)), `page?`, `timeoutSec?: 30` (máx. 300) | Espera pelo próximo evento da linha do tempo correspondente |
| `wait_for_control` | — | `timeoutSec?: 120` (máx. 600) | Depois de o usuário assumir o controle, espera até ele devolver (ou encerrar) |
| `set_task` | — | `title` (≤ 24 caracteres), `steps?` (≤ 12, ≤ 28 caracteres cada), `current?` | Mostra a tarefa e o plano do agente no topo de todas as páginas do dispositivo. `current` é a etapa ativa; `current = steps.length` significa concluído. As páginas o recebem como `task` ([§3.3](#33-gateway--página)); ele é limpo quando o agente sai |

`page?` executa uma única chamada em outra página (pelo rótulo) sem mudar a seleção. Uma ferramenta acima do nível da conexão falha com "Requires advanced access; this session was granted interact" e é auditada como `policy.denied`.

**Modo de acompanhamento.** Com `follow: true` (o padrão), a página selecionada muda automaticamente quando a ação do agente abre uma página nova, quando o usuário traz outra página para o primeiro plano, ou quando a página selecionada sumiu há 1,5 s; o resultado avisa isso. Uma página selecionada que é descartada por estar desatualizada ([§3.1](#31-ciclo-de-vida)) é substituída pela página que mostra a mesma URL, independentemente de `follow`, já que a entrada antiga não existe mais.

### 14.4 Ponte stdio local

Para clientes MCP que só falam stdio:

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

Ela repassa o stdio para o `/v1/mcp` hospedado. `--gateway` também pode vir de `RWD_GATEWAY`.

## 15. Idiomas

Idiomas suportados: inglês (`en`), chinês simplificado (`zh`), chinês tradicional (`zh-TW`), francês (`fr`), espanhol (`es`), russo (`ru`), árabe (`ar`, da direita para a esquerda), japonês (`ja`), coreano (`ko`), alemão (`de`) e português (`pt`). Qualquer tag BCP 47 é aceita e mapeada para o mais próximo: `en-US` → `en`; `zh-CN`, `zh_CN`, `zh-Hans` → `zh`; `zh-HK`, `zh-MO`, `zh-Hant` → `zh-TW`; `fr-CA` → `fr`; `pt-BR`, `pt-PT` → `pt`. `Accept-Language` escolhe o idioma suportado com o maior peso.

| Público | O quê | Escolhido por |
|---|---|---|
| Agente | Instruções do servidor MCP, descrições de ferramentas e parâmetros, resultados de ferramentas, `[Session changes]`, erros | `RWD_LANG` / `--lang` do gateway (padrão `en`) |
| Agente, vindo da página | Mensagens de erro de RPC e resumos de eventos escritos pelo SDK | `welcome.agentLang`, que traz o idioma do gateway. O SDK guarda o último valor no localStorage em `rwd:alang` para os eventos gerados antes do próximo `welcome` e usa inglês até receber outra indicação |
| Console | Mensagens de erro, resumos da linha do tempo e rótulos do sistema nas respostas REST e SSE | `?lang=` na requisição, depois `Accept-Language`, depois o idioma do gateway |
| Usuário do celular | A pílula, as barras, as caixas de diálogo e os avisos do SDK | `run({ lang })`; senão, o primeiro de `navigator.languages` para o qual o SDK tenha um pacote (embutido ou registrado pela página); senão, inglês. Os pacotes além de `en` e `zh` são carregados sob demanda de `locales/<id>.js` ao lado do `sdk.js`, ou do gateway (`/v1/locales/<id>.js`) |

Assim, um usuário que fala chinês pode trabalhar com um agente que fala inglês: a caixa de diálogo diz *AI 想要点击「提交订单」，允许吗？* e, se o pedido for recusado, o agente lê *The user denied this action*.

## 16. Operação

- **Métricas.** `GET /v1/metrics` retorna texto no formato do Prometheus. Com `RWD_METRICS_TOKEN` definido, exige `Authorization: Bearer <token>`. Séries: `rwd_online_devices{project}`, `rwd_connected_pages`, `rwd_attached_agents`, `rwd_ws_connections`, `rwd_rpc_total{method,result}`, `rwd_rpc_duration_seconds{method}` (histograma), `rwd_http_requests_total{code}`.
- **Versões do SDK.** A versão do SDK usada para cache são os 12 primeiros caracteres hex do SHA-256 do `sdk.js` embutido no gateway, então `/v1/sdk/<version>/sdk.js` muda sempre que o arquivo muda. `GET /v1/api/config` a retorna como `sdkVersion`, junto com `sdkIntegrity` (`sha384-…`, para o atributo `integrity`). O console oferece um snippet que a fixa.
- **Banco de dados.** `RWD_DATABASE_URL=postgres://…` (ou `postgresql://`) seleciona o Postgres; caso contrário, `RWD_DATA` (padrão `rwd.db`) é um arquivo SQLite. O schema é criado e migrado na inicialização.
- **Limites de taxa.** Login no console e aceite de convite: 10 por minuto por IP de cliente. Conexões de páginas e chamadas de presença: 120 por minuto por IP de cliente. Os IPs de cliente vêm de `X-Forwarded-For` só com `--trust-proxy`; a mesma opção controla `X-Forwarded-Proto` e `X-Forwarded-Host`, que decidem se o cookie de sessão é `Secure` e o esquema e o host da `gatewayUrl` deduzida quando `--public-url` não está definido.
- **Retenção da auditoria.** `RWD_AUDIT_RETENTION_DAYS` (padrão 180); eventos antigos são removidos a cada 6 horas.

Todas as configurações do gateway estão listadas em [gateway/README.pt-BR.md](../gateway/README.pt-BR.md).
