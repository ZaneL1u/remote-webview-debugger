<!-- i18n-source: 290e0636713e2be8bacb0501c422ae3a327ae0ea -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | Português (Brasil) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Implantação com Docker Compose

Roda o gateway num host Docker com um pequeno [Caddy](https://caddyserver.com) na frente. Há duas formas de expô-lo:

- **Atrás de um proxy TLS já existente** (padrão): o Caddy escuta em `127.0.0.1:18788`, e o seu nginx, Caddy, Traefik ou load balancer termina o HTTPS na frente dele.
- **HTTPS direto** com `RWD_DOMAIN`: o próprio Caddy atende as portas 80 e 443 e obtém um certificado da Let's Encrypt.

O `deploy.sh` faz o build de tudo localmente, envia por ssh e (re)inicia a stack. As configurações do gateway estão descritas em [gateway/README.pt-BR.md](../../gateway/README.pt-BR.md).

## Arquivos

| Arquivo | Finalidade |
|---|---|
| `Dockerfile` | Imagem do gateway: Alpine mais o binário `rwd` pré-compilado (com o console e o SDK embutidos). Roda como uid 10001 com `RWD_ADDR=:8080` e `RWD_DATA=/data/rwd.db`, com health check em `/v1/healthz`. A mesma imagem é publicada no GHCR e também roda sozinha |
| `compose.yml` | Dois serviços. `gateway`: construído a partir do Dockerfile, `./data` montado em `/data`, configurações vindas do `.env`, `RWD_TRUST_PROXY=1` (só o Caddy chega até ele), não publicado. `web`: `caddy:2-alpine`, publicado em `${BIND:-127.0.0.1}:${PORT:-18788}`, serve `./demo` em `/demo/` e encaminha todo o resto para o gateway |
| `Caddyfile` | HTTP simples em `:80`. Só confia em `X-Forwarded-*` vindos de `RWD_TRUSTED_PROXIES` (padrão: faixas privadas) |
| `compose.tls.yml` | Overlay para HTTPS direto: adiciona as portas `443/tcp` e `443/udp` (HTTP/3), troca para o `Caddyfile.tls` e guarda os certificados no volume `caddy-data` |
| `Caddyfile.tls` | Serve `RWD_DOMAIN` por HTTPS com certificado automático e redireciona HTTP para HTTPS |
| `deploy.sh` | Build, cópia, `.env` inicial, backup do banco de dados, reinício |

No servidor, o `deploy.sh` gera:

```
~/rwd-platform/
├── .env                      configurações (modo 600; criado no primeiro deploy e depois não é mais alterado)
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       o binário do gateway para a arquitetura do servidor
├── data/                     rwd.db (SQLite) e os backups rwd.db.bak-<data>
└── demo/platform-demo/       a loja de demonstração, em https://rwd.example.com/demo/platform-demo/
```

## Requisitos

- **Máquina de build:** Go, Node.js com npm, `make`, `ssh`, `scp`, `tar`.
- **Servidor:** Docker com o plugin Compose (`docker compose`) e `openssl`. O usuário do ssh precisa poder rodar o Docker (por exemplo, estar no grupo `docker`); não é preciso sudo. O servidor baixa `alpine:3.22` e `caddy:2-alpine`.

## Configurações (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | gerada no primeiro deploy | Senha do proprietário; **obrigatória**. Aplicada em toda inicialização, então alterá-la redefine a senha do proprietário indicado por `RWD_ADMIN_EMAIL` |
| `RWD_ADMIN_EMAIL` | `admin` | Conta proprietária (nome de login). Criada apenas na primeira inicialização; mudá-la depois não adiciona um proprietário, veja o [gateway/README](../../gateway/README.pt-BR.md) |
| `RWD_PUBLIC_URL` | deduzida das requisições | URL pública do gateway, por exemplo `https://rwd.example.com/v1`. Recomendada |
| `RWD_METRICS_TOKEN` | gerado pelo `deploy.sh` | Token Bearer para `/v1/metrics` |
| `RWD_DATABASE_URL` | SQLite em `./data` | `postgres://…` para usar o Postgres |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Dias de retenção do log de auditoria |
| `RWD_LANG` | `en` | Idioma dos textos voltados ao agente: `en`, `zh`, `zh-TW`, `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` ou `pt` |
| `RWD_MCP_RATE_LIMIT` | — | Requisições MCP por IP de cliente por minuto (sem limite quando não definida); para uma demo pública, veja [deploy/demo](../demo/README.md) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Faixas de endereços (CIDRs separados por espaço, ou o `private_ranges` do Caddy) do proxy que fica na frente do Caddy; veja abaixo |
| `BIND` | `127.0.0.1` | Endereço em que o Caddy é publicado |
| `PORT` | `18788` | Porta em que o Caddy é publicado |
| `RWD_DOMAIN` | — | Nome de host público para HTTPS direto (somente com `compose.tls.yml`) |
| `COMPOSE_FILE` | — | `compose.yml:compose.tls.yml` liga o HTTPS direto |

Depois de editar o `.env` no servidor, aplique as mudanças com `docker compose up -d` no diretório da implantação.

## Deploy com `deploy.sh`

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` é qualquer coisa que o `ssh` aceite (um alias do `~/.ssh/config`, `user@host`); `<amd64|arm64>` é a arquitetura de CPU do servidor; `remote-dir` é, por padrão, `rwd-platform` no diretório home do usuário do ssh. O script:

1. roda `make platform GOOS=linux GOARCH=<arch>` localmente (SDK, console, binário do gateway);
2. copia para o servidor o Dockerfile, os arquivos do compose e os Caddyfiles, as páginas de demonstração e o binário;
3. **somente no primeiro deploy**, grava o `.env` (modo 600) com uma senha de proprietário aleatória, `BIND`, `PORT` e as configurações opcionais abaixo, e mostra o login do proprietário uma única vez. Os deploys seguintes nunca sobrescrevem o `.env`; só acrescentam, quando faltam, configurações adicionadas em versões mais novas (como `RWD_METRICS_TOKEN`);
4. se `data/rwd.db` existir, para o gateway e copia o banco de dados para `data/rwd.db.bak-<YYYYmmddHHMMSS>` (as migrações de schema rodam na próxima inicialização) e depois ajusta o dono de `data/` para o uid 10001, usando um contêiner descartável em vez de sudo;
5. roda `docker compose up -d --build` e mostra o status dos serviços.

As configurações do primeiro deploy podem ser passadas como variáveis de ambiente; elas só são lidas quando o `.env` ainda não existe: `BIND`, `PORT`, `RWD_ADMIN_EMAIL`, `RWD_PUBLIC_URL`, `RWD_TRUSTED_PROXIES` e `RWD_DOMAIN`.

### Atrás de um proxy TLS já existente

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

O Caddy é publicado em `127.0.0.1:18788`. Aponte o seu proxy para ele e garanta que o proxy:

- repasse os upgrades de WebSocket (as páginas se conectam a `/v1/page`);
- não faça buffer das respostas e permita conexões de longa duração: as atualizações ao vivo do console (`/v1/api/stream`) e o MCP usam HTTP em streaming; o gateway envia um heartbeat a cada 25 segundos, então timeouts de inatividade acima de 60 segundos bastam;
- envie `X-Forwarded-For`, `X-Forwarded-Proto: https` e o `Host` original.

Por exemplo, com nginx:

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    server_name rwd.example.com;
    # listen 443 ssl; ssl_certificate …; ssl_certificate_key …;

    location / {
        proxy_pass http://127.0.0.1:18788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

**`RWD_TRUSTED_PROXIES`.** O Caddy só repassa ao gateway os cabeçalhos `X-Forwarded-*` do proxy quando o proxy se conecta a partir de um endereço confiável. O padrão, `private_ranges`, cobre um proxy no mesmo host ou numa rede privada. Se o seu proxy se conecta a partir de um endereço público (outro servidor, uma CDN ou um load balancer de nuvem), defina aqui as faixas dele. Caso contrário, o gateway enxerga o proxy como o cliente: toda requisição parece vir do IP do proxy (o que quebra as listas de IPs permitidos das chaves de API e os limites de taxa por IP) e por HTTP simples (então o cookie do console não é marcado como `Secure`).

Para publicar o Caddy em outro endereço ou porta, defina `BIND` e `PORT`.

### HTTPS direto com `RWD_DOMAIN`

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

Antes do primeiro deploy, aponte o DNS do domínio para o servidor e abra as portas 80 e 443 (TCP, mais UDP 443 para HTTP/3). Com `RWD_DOMAIN` definido, o primeiro deploy grava no `.env` `RWD_DOMAIN`, `COMPOSE_FILE=compose.yml:compose.tls.yml`, `BIND=0.0.0.0`, `PORT=80` e `RWD_PUBLIC_URL=https://rwd.example.com/v1`. O Caddy obtém e renova o certificado sozinho (Let's Encrypt pelo HTTPS automático do Caddy), guarda-o no volume `caddy-data` e redireciona HTTP para HTTPS. A porta 80 continua aberta para o desafio ACME e para o redirecionamento.

Para mudar uma implantação existente para HTTPS direto, acrescente essas cinco linhas ao `.env` e rode `docker compose up -d`.

## Deploy manual

Sem o `deploy.sh`:

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# copie deploy/platform/* para o servidor, junto com o binário como ./rwd
# no servidor, nesse diretório:
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### Com a imagem publicada

Cada release do gateway também publica a imagem `ghcr.io/zanel1u/remote-webview-debugger` para linux/amd64 e linux/arm64, com as tags `<version>` (por exemplo `0.2.0`), `<major>.<minor>` e `latest`, com o console e o SDK embutidos. Para usá-la em vez de fazer o build de uma, substitua as linhas `build:` e `image:` do gateway no `compose.yml` por `image: ghcr.io/zanel1u/remote-webview-debugger:<version>`, dispense o binário e inicie com `docker compose up -d`. Para atualizar, troque a tag e rode `docker compose pull && docker compose up -d` (faça antes o backup de `data/`, como o `deploy.sh` faz).

Para um teste rápido sem Compose, a imagem também roda sozinha: veja o [início rápido](../../README.pt-BR.md#1-execute-o-gateway). Sozinha, ela não confia em `X-Forwarded-*`; se você colocar o seu próprio proxy na frente, adicione `-e RWD_TRUST_PROXY=1`.

## Atualização

Rode o `deploy.sh` de novo com o mesmo host, a mesma arquitetura e o mesmo diretório. Ele refaz o build, copia o novo binário, faz o backup do banco SQLite e reinicia a stack; o `.env` é mantido. Conte com uma breve interrupção. As páginas se reconectam sozinhas: depois de uma queda curta, em segundos; depois de uma mais longa, uma página pode primeiro cair para o polling e voltar ao WebSocket em poucos minutos, ou assim que um agente se conectar a ela. Os agentes conectados naquele momento precisam se conectar de novo.

## Backups

- **Cópias automáticas.** Cada deploy copia `data/rwd.db` para `data/rwd.db.bak-<data>` antes de reiniciar. Elas se acumulam; apague as antigas de tempos em tempos.
- **Backups regulares.** O SQLite roda em modo WAL, então gravações recentes podem estar em `rwd.db-wal` enquanto o gateway está rodando. Para fazer o backup de uma cópia consistente, pare o gateway por um instante:

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **Restauração.** Pare o gateway, substitua `data/rwd.db` pelo backup (e apague `rwd.db-wal` / `rwd.db-shm`), confira se o arquivo pertence ao uid 10001 e inicie o gateway.
- Faça backup do `.env` também. Os backups do banco de dados contêm o pepper das chaves de API e o segredo de sessão do console: guarde-os em local privado.

## Postgres

Defina `RWD_DATABASE_URL` no `.env`, por exemplo `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`, e rode `docker compose up -d`. O contêiner do gateway precisa conseguir alcançar o banco de dados (um banco gerenciado, ou um serviço `postgres` que você adicione num arquivo de override do compose). O schema é criado na inicialização; os dados não são copiados de um arquivo SQLite existente. O `deploy.sh` só faz backup do SQLite, então faça o backup do Postgres com `pg_dump` ou com os snapshots do seu provedor.

## Operação do dia a dia

```bash
docker compose ps                                     # status
docker compose logs -f gateway                        # logs do gateway (a senha de proprietário gerada, erros…)
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **Esqueceu a senha do proprietário:** altere `RWD_ADMIN_PASSWORD` no `.env` e rode `docker compose up -d`; ela é aplicada na inicialização.
- Rode **uma única** instância do gateway por banco de dados: o estado ao vivo (páginas conectadas, estado de controle) fica no processo do gateway.
- As páginas de demonstração em `/demo/` são opcionais; apague o conteúdo de `demo/` se não quiser que fiquem públicas (o próximo deploy as copia de novo).
