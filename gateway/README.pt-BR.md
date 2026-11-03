<!-- i18n-source: 048ece68ecafa5fd74a1bc0378b1a0eb32f2cf96 -->
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
| `RWD_ADMIN_EMAIL` | `admin` | E-mail (nome de login) da conta proprietária. Um proprietário só é criado enquanto o banco de dados não tem nenhum (na primeira inicialização); mudar este valor depois **não** cria um segundo proprietário, apenas indica a qual proprietário `RWD_ADMIN_PASSWORD` se aplica |
| `RWD_ADMIN_PASSWORD` | — | Senha do proprietário. Usada quando o proprietário é criado e em **toda** inicialização posterior para redefinir a senha do proprietário indicado por `RWD_ADMIN_EMAIL`, o que também serve como recuperação de conta. Se esse e-mail não for de um proprietário (outro membro, ou ninguém), ele é ignorado e o log avisa, listando os proprietários. Quando não está definida num banco de dados vazio, uma senha aleatória é gerada e impressa uma única vez no log |
| `RWD_METRICS_TOKEN` | — | Quando definida, `/v1/metrics` exige `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Dias de retenção do log de auditoria |

Outras coisas que vale saber:

- Os segredos de que o gateway precisa (o pepper das chaves de API e o segredo de sessão do console) são gerados na primeira inicialização e guardados no banco de dados. Faça backup do banco e mantenha os backups privados.
- O gateway mantém o estado ao vivo (páginas conectadas, estado de controle, linhas do tempo) em memória, então rode uma única instância por banco de dados.
- Health check: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

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
