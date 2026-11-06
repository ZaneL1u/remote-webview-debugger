<!-- i18n-source: 36b1f9d52cae376ca3aa02c47b0584fd21b7ab30 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | Português (Brasil) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Gateway do rwd

O servidor em Go do Remote WebView Debugger: conexões das páginas, presença dos dispositivos, estado de controle, o endpoint MCP hospedado, a API REST do console, além do console e do SDK da página embutidos. Um único binário é o servidor inteiro.

- Protocolo: [docs/protocol.pt-BR.md](../docs/protocol.pt-BR.md)
- Arquitetura, modelo de consentimento e notas de segurança: [docs/architecture.pt-BR.md](../docs/architecture.pt-BR.md)
- Implantação com Docker Compose: [deploy/platform/README.pt-BR.md](../deploy/platform/README.pt-BR.md)

## Build e execução

O build precisa de Go (a versão do `go.mod`) e de Node.js com npm, porque o console e o SDK são compilados e embutidos no binário. A partir da raiz do repositório:

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # compilação cruzada (amd64 ou arm64)

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

Abra http://localhost:8080 e entre com esse e-mail e essa senha. Páginas e agentes usam a URL do gateway `http://localhost:8080/v1` (em produção: `https://rwd.example.com/v1`).

`go build ./cmd/rwd` dentro de `gateway/` também funciona, mas esse binário traz apenas placeholders no lugar do console e do SDK. O `make` define a versão informada por `rwd version` e `/v1/healthz` a partir da tag `gateway-vX.Y.Z` mais recente (`0.2.0` na própria tag, `0.2.0-3-gabc1234` depois dela, `0.0.0-dev` sem nenhuma tag); `RWD_VERSION=…` sobrescreve esse valor. Binários prontos para Linux e macOS (amd64, arm64) são anexados a cada [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases) `gateway-v*`; mudanças: [CHANGELOG](CHANGELOG.md).

## Comandos

```
rwd serve [flags]                       executa o gateway
rwd mcp --gateway https://host/v1       ponte MCP stdio para agentes locais (chave de API em RWD_API_KEY)
rwd version                             mostra a versão
```

## Configuração (`rwd serve`)

Toda flag tem uma variável de ambiente correspondente; a flag passada na linha de comando prevalece.

| Flag / variável de ambiente | Padrão | Descrição |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | Endereço de escuta (HTTP simples; coloque TLS na frente, veja [deploy/platform](../deploy/platform/README.pt-BR.md)) |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | Banco de dados. Uma URL `postgres://` ou `postgresql://` seleciona o Postgres; qualquer outra coisa é o caminho de um arquivo SQLite. `RWD_DATABASE_URL` tem precedência sobre `RWD_DATA`. O schema é criado e migrado na inicialização |
| `--public-url` / `RWD_PUBLIC_URL` | deduzida de cada requisição | URL pública do gateway terminando em `/v1`, por exemplo `https://rwd.example.com/v1`. Usada nos snippets de integração, nos links de convite e em `/v1/api/config`. Defina-a quando o gateway não conseguir deduzir o próprio endereço público |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | desligado | Pega o IP do cliente de `X-Forwarded-For`, e o esquema e o host da URL pública deduzida (e se o cookie do console é `Secure`) de `X-Forwarded-Proto` / `X-Forwarded-Host`. Ligue apenas atrás de um proxy reverso; caso contrário, os clientes podem forjar esses cabeçalhos e driblar listas de IPs permitidos e limites de taxa. Sem essa opção, toda requisição conta como HTTP simples, diga o proxy o que disser, então o cookie do console é definido sem `Secure` e as URLs deduzidas começam com `http://` (nesse caso, defina `--public-url`) |
| `--lang` / `RWD_LANG` | `en` | Idioma de tudo o que a IA lê: instruções do MCP, descrições de ferramentas e parâmetros, resultados das ferramentas, `[Session changes]` e erros. Também chega ao SDK da página como `welcome.agentLang`, para que os erros e resumos de eventos escritos na página fiquem no mesmo idioma. Um entre `en`, `zh` (chinês simplificado), `zh-TW` (chinês tradicional), `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` ou `pt`; tags regionais são aceitas e mapeadas para a mais próxima (`zh-CN` → `zh`, `zh-HK` → `zh-TW`, `pt-BR` → `pt`). O console escolhe o idioma a cada requisição (`?lang=` ou `Accept-Language`) e usa este como fallback |
| `--demo-dir` / `RWD_DEMO_DIR` | — | Serve este diretório em `/demo/` (opcional, para páginas de demonstração) |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0` (sem limite) | Requisições MCP permitidas por IP de cliente por minuto; as excedentes recebem `429` com `Retry-After: 60`. Pensado para um gateway cuja chave de API é pública, como uma demo ([deploy/demo](../deploy/demo/README.md)). Atrás de um proxy, precisa de `--trust-proxy` para enxergar os IPs dos clientes |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | desligado | Roda uma demo pública: `POST /v1/demo/keys` (sem login, CORS aberto) entrega a cada visitante uma chave de API própria (nível `interact`, válida por 24 horas, 5 por IP por hora), então os visitantes nunca compartilham um agente; e `list_devices` exige um `deviceCode`, então ninguém consegue listar os dispositivos de outros visitantes. Veja [deploy/demo](../deploy/demo/README.md) |
| `RWD_ADMIN_EMAIL` | `admin` | E-mail (nome de login) da conta proprietária. Um proprietário só é criado enquanto o banco de dados não tem nenhum (na primeira inicialização); mudar este valor depois **não** cria um segundo proprietário, apenas indica a qual proprietário `RWD_ADMIN_PASSWORD` se aplica |
| `RWD_ADMIN_PASSWORD` | — | Senha do proprietário. Usada quando o proprietário é criado e em **toda** inicialização posterior para redefinir a senha do proprietário indicado por `RWD_ADMIN_EMAIL`, o que também serve como recuperação de conta. Se esse e-mail não for de um proprietário (outro membro, ou ninguém), ele é ignorado e o log avisa, listando os proprietários. Quando não está definida num banco de dados vazio, uma senha aleatória é gerada e impressa uma única vez no log |
| `RWD_METRICS_TOKEN` | — | Quando definida, `/v1/metrics` exige `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Dias de retenção do log de auditoria |
| `RWD_OIDC_*` | — | Login único, veja [abaixo](#login-único) |

Outras coisas que vale saber:

- Os segredos de que o gateway precisa (o pepper das chaves de API e o segredo de sessão do console) são gerados na primeira inicialização e guardados no banco de dados. Faça backup do banco e mantenha os backups privados.
- O gateway mantém o estado ao vivo (páginas conectadas, estado de controle, linhas do tempo) em memória, então rode uma única instância por banco de dados.
- Health check: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## Login único

Os membros também podem entrar com Feishu, Lark ou qualquer provedor OpenID Connect (Keycloak, Okta, Microsoft Entra ID, Google, Authing, …); e-mail e senha continuam funcionando. Defina o provedor e as credenciais de cliente dele, e a página de login passa a mostrar **Entrar com …**.

| Variável de ambiente | Padrão | Descrição |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`, `lark` ou `oidc`; liga o login único. Definir só `RWD_OIDC_ISSUER` equivale a `oidc` |
| `RWD_OIDC_CLIENT_ID`, `RWD_OIDC_CLIENT_SECRET` | — | As credenciais do app (App ID e App Secret no Feishu e no Lark). Obrigatórias |
| `RWD_OIDC_ISSUER` | — | Issuer do OpenID Connect, por exemplo `https://sso.example.com/realms/acme`; os endpoints são lidos do `/.well-known/openid-configuration` dele (só `oidc`) |
| `RWD_OIDC_AUTH_URL`, `RWD_OIDC_TOKEN_URL`, `RWD_OIDC_USERINFO_URL` | os do provedor | Substituem os endpoints; defina os três para um provedor OpenID Connect sem discovery |
| `RWD_OIDC_SCOPES` | `openid profile email` (`oidc`), nenhum (Feishu, Lark) | Escopos separados por espaço. No Feishu e no Lark, adicione `contact:user.email:readonly` (e `contact:user.employee:readonly` para o e-mail corporativo) para que as contas recebam um e-mail |
| `RWD_OIDC_NAME` | o nome do provedor | Rótulo do botão de login, por exemplo `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | Papel das contas criadas num primeiro login: `member` ou `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | desligado | Não cria contas: só membros existentes ou convidados (com o mesmo e-mail) conseguem entrar |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | Domínios de e-mail autorizados a entrar, separados por vírgula, por exemplo `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | desligado | Só `oidc`: confia no e-mail de um provedor que não envia `email_verified` (Microsoft Entra ID). Apenas para um provedor de um único tenant cujos e-mails sua organização controla |
| `RWD_OIDC_TENANT` | — | Só Feishu e Lark: o `tenant_key` da sua organização; pessoas de outras organizações são recusadas (`sso_error=tenant`). O registro de auditoria `auth.login` de cada login único mostra o `tenant` |
| `RWD_OIDC_SYNC_MINUTES` | `60` (Feishu, Lark) | Com que frequência desativar os membros que saíram da organização; `0` desliga. Veja abaixo |

Registre esta URL de redirecionamento no provedor; ela precisa coincidir exatamente: `https://<host>/v1/api/auth/oidc/callback`, ou seja, a origem de `RWD_PUBLIC_URL` (ou da requisição, quando ela não está definida) seguida de `/v1/api/auth/oidc/callback`. Atrás de um proxy, defina `RWD_PUBLIC_URL` para que a URL seja estável.

O primeiro login de uma identidade a junta ao membro com o mesmo e-mail (um membro convidado mantém o papel do convite, e o convite é consumido) ou cria uma conta com `RWD_OIDC_DEFAULT_ROLE`, a menos que `RWD_OIDC_INVITE_ONLY=1`. Os logins seguintes encontram a conta pelo subject do provedor (`open_id` no Feishu e no Lark), então uma mudança de e-mail não atrapalha. Uma conta já vinculada a outra identidade do provedor não é vinculada de novo (uma caixa de correio reatribuída recebe `sso_error=conflict`), e o convite de um membro desativado não é tocado. O e-mail de um provedor OpenID Connect só conta com `email_verified: true` (ou `RWD_OIDC_TRUST_EMAIL=1`), e uma conta sem e-mail recebe o nome de login `<provider>:<subject>`. Os proprietários gerenciam esses membros na página **Membros** como qualquer outro: mudam o papel, desativam ou removem; um membro desativado não consegue entrar de nenhuma das formas. Contas criadas por login único não têm senha. O gateway lê o usuário no endpoint userinfo do provedor com o access token que acabou de receber (fluxo authorization code com PKCE); ele não usa o ID token. Inícios e callbacks são limitados a 60 por minuto por IP de cliente (atrás de um proxy, ative `--trust-proxy`, senão todos compartilham o IP do proxy).

**Quem consegue entrar.** O e-mail do provedor decide em qual membro existente um primeiro login se transforma, proprietários incluídos, então quem pode definir e-mails no provedor pode tomar essas contas. Com Feishu ou Lark, use um app personalizado: só pessoas da sua organização conseguem entrar, com os e-mails da sua organização. Um app da loja, ou um compartilhado com organizações conectadas, deixa outras organizações entrarem também: nesse caso defina `RWD_OIDC_TENANT`. Com um provedor OpenID Connect em que qualquer pessoa pode entrar (Google, um Entra ID multi-tenant), defina `RWD_OIDC_ALLOWED_DOMAINS` ou `RWD_OIDC_INVITE_ONLY=1`, senão qualquer pessoa ganha uma conta (o log avisa na inicialização); e nunca defina `RWD_OIDC_TRUST_EMAIL=1` nesse caso.

**Trocar o app ou desligar o login único.** Os `open_id`s do Feishu e do Lark pertencem a um único app: depois de trocar para outro App ID, os membros são vinculados de novo pelo e-mail, e as contas sem e-mail (`feishu:…`) precisam ser removidas e convidadas de novo. Contas criadas por login único não têm senha: um proprietário dá uma a elas com **Novo link** na página **Membros**, um link de convite para definir a senha (ele também substitui um convite perdido), por exemplo antes de desligar o login único.

**Feishu ou Lark.** Na [Feishu Open Platform](https://open.feishu.cn/app) (Lark: [open.larksuite.com](https://open.larksuite.com/app)), crie um app personalizado (企业自建应用), que só pessoas da sua organização podem usar, e depois:

1. Copie o App ID e o App Secret de **Credentials & Basic Info** para `RWD_OIDC_CLIENT_ID` e `RWD_OIDC_CLIENT_SECRET`.
2. Em **Security Settings → Redirect URLs**, adicione a URL de redirecionamento acima.
3. Em **Permissions & Scopes**, adicione `contact:user.email:readonly` (e `contact:user.employee:readonly` para o e-mail corporativo) e liste os mesmos escopos em `RWD_OIDC_SCOPES`. Para perceber quem saiu, o app também precisa de `contact:contact.base:readonly` e `contact:user.employee:readonly` e, em **Data permissions → Contacts range**, de todas as pessoas que entram.
4. Torne o app disponível para as pessoas que devem entrar, e crie e publique uma versão para que as configurações entrem em vigor.

**Pessoas que saem.** Com Feishu ou Lark, o gateway consulta a Open Platform a cada `RWD_OIDC_SYNC_MINUTES` sobre cada membro vinculado ao app e desativa quem consta como desligado ou como tendo saído da organização: essas pessoas têm a sessão encerrada, as chaves de API delas param de funcionar e os agentes delas são desconectados, e o log de auditoria registra `member.update` por `system` com `"reason":"left_organization"`. Depois, um proprietário pode removê-las, o que revoga as chaves delas de vez. Só um “desligado” explícito conta: um membro fora do escopo de contatos, ou uma requisição que falhou, não muda nada (o log diz o que falhou), e o último proprietário nunca é desativado. Sem a permissão de contatos nada é verificado, e quem saiu mantém chaves de API funcionando até que um proprietário o desative; já a sessão dele no console termina em até 12 horas, porque ele não consegue mais entrar.

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

## Conectando um agente

Crie uma chave de API no console (**Chaves de API**) e depois adicione o endpoint MCP hospedado ao seu cliente, por exemplo o Claude Code:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

Para clientes que só falam stdio, o mesmo binário faz a ponte do stdio para o endpoint hospedado:

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| Configuração do `rwd mcp` | Descrição |
|---|---|
| `--gateway` / `RWD_GATEWAY` | URL do gateway terminando em `/v1` |
| `RWD_API_KEY` | Chave de API (só por variável de ambiente, para não aparecer em listas de processos) |

Uma chave alcança todos os dispositivos do gateway. As ferramentas estão listadas em [protocol.pt-BR.md §14](../docs/protocol.pt-BR.md#14-mcp).

## Estrutura do código-fonte

```
cmd/rwd/            ponto de entrada: serve, mcp (ponte stdio), version
internal/store/     SQLite / Postgres: projetos e políticas, membros, chaves de API (HMAC; nível,
                    expiração, lista de IPs permitidos), dispositivos e tokens de dispositivo,
                    convites de dispositivo, log de auditoria, configurações
internal/hub/       estado ao vivo: dispositivos, páginas, máquina de estados do controle, aprovação
                    de conexão, verificação de níveis, linhas do tempo, roteamento de RPC,
                    assinaturas SSE, métricas
internal/server/    HTTP: WebSocket das páginas, polling de presença, REST com login e papéis,
                    ferramentas MCP, SSE, /v1/metrics, arquivos estáticos
internal/i18n/      textos para os agentes e o console, em 11 idiomas
internal/ids/       chaves do app, chaves de API, códigos de dispositivo, segredos
internal/web/       o console e o SDK embutidos (preparados por `make gateway`; caso contrário,
                    placeholders)
scripts/embed.sh    copia console/dist e sdk.js para internal/web para o go:embed
```

## Testes

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` percorre o fluxo inteiro com páginas simuladas e um cliente MCP: conexão pelo código do dispositivo; aprovação no dispositivo (permitir, negar, negações repetidas e bloqueio, apenas visualizar); reconexão dentro do período de carência sem uma segunda aprovação; verificação de níveis; snapshots; bloqueio na primeira interação; acompanhamento entre páginas e descarte de uma página substituída por uma WebView recriada; assumir e devolver o controle; ações em lote; encerramento pelo usuário; registros de auditoria; tokens de dispositivo (4401), tokens de retomada (4409) e cotas (4429); convites de uso único; expiração de chaves e listas de IPs permitidos; revogação imediata; convites e papéis de membros; SSE e métricas; e falhas de autenticação.

Os mesmos testes rodam contra o Postgres (cada teste no próprio schema temporário):

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

`make -j16 check` na raiz do repositório roda as verificações do gateway, do SDK e do console que a CI executa.
