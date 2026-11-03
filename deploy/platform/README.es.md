<!-- i18n-source: 290e0636713e2be8bacb0501c422ae3a327ae0ea -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Despliegue con Docker Compose

Ejecuta el gateway en un host con Docker, con un pequeño [Caddy](https://caddyserver.com) delante. Hay dos formas de exponerlo:

- **Detrás de un proxy TLS existente** (por defecto): Caddy escucha en `127.0.0.1:18788` y tu nginx, Caddy, Traefik o balanceador de carga termina HTTPS delante de él.
- **HTTPS directo** con `RWD_DOMAIN`: Caddy sirve él mismo los puertos 80 y 443 y obtiene un certificado de Let's Encrypt.

`deploy.sh` lo compila todo en local, lo envía por ssh y (re)inicia los servicios. Los ajustes del gateway se describen en [gateway/README.es.md](../../gateway/README.es.md).

## Archivos

| Archivo | Función |
|---|---|
| `Dockerfile` | Imagen del gateway: Alpine más el binario `rwd` precompilado (con la consola web y el SDK integrados). Se ejecuta con el uid 10001, con `RWD_ADDR=:8080` y `RWD_DATA=/data/rwd.db`, y con una comprobación de estado en `/v1/healthz`. La misma imagen se publica en GHCR y también funciona por sí sola |
| `compose.yml` | Dos servicios. `gateway`: se construye desde el Dockerfile, monta `./data` en `/data`, toma los ajustes de `.env`, usa `RWD_TRUST_PROXY=1` (solo Caddy llega a él) y no se publica. `web`: `caddy:2-alpine`, publicado en `${BIND:-127.0.0.1}:${PORT:-18788}`, sirve `./demo` en `/demo/` y hace de proxy hacia el gateway para todo lo demás |
| `Caddyfile` | HTTP plano en `:80`. Solo confía en `X-Forwarded-*` cuando vienen de `RWD_TRUSTED_PROXIES` (por defecto: rangos privados) |
| `compose.tls.yml` | Overlay para HTTPS directo: añade los puertos `443/tcp` y `443/udp` (HTTP/3), cambia a `Caddyfile.tls` y guarda los certificados en el volumen `caddy-data` |
| `Caddyfile.tls` | Sirve `RWD_DOMAIN` por HTTPS con un certificado automático y redirige HTTP a HTTPS |
| `deploy.sh` | Compilación, copia, `.env` inicial, copia de seguridad de la base de datos, reinicio |

En el servidor, `deploy.sh` genera:

```
~/rwd-platform/
├── .env                      ajustes (modo 600; se crea en el primer despliegue y luego no se toca)
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       el binario del gateway para la arquitectura del servidor
├── data/                     rwd.db (SQLite) y las copias de seguridad rwd.db.bak-<hora>
└── demo/platform-demo/       la tienda de demostración, en https://rwd.example.com/demo/platform-demo/
```

## Requisitos

- **Máquina de compilación:** Go, Node.js con npm, `make`, `ssh`, `scp`, `tar`.
- **Servidor:** Docker con el plugin de Compose (`docker compose`) y `openssl`. El usuario de ssh debe poder ejecutar Docker (por ejemplo, perteneciendo al grupo `docker`); no hace falta sudo. El servidor descarga `alpine:3.22` y `caddy:2-alpine`.

## Ajustes (`.env`)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | se genera en el primer despliegue | Contraseña del propietario; **obligatoria**. Se aplica en cada arranque, así que cambiarla restablece la contraseña del propietario indicado por `RWD_ADMIN_EMAIL` |
| `RWD_ADMIN_EMAIL` | `admin` | Cuenta propietaria (nombre de inicio de sesión). Solo se crea en el primer arranque; cambiarla después no añade un propietario, consulta [gateway/README](../../gateway/README.es.md) |
| `RWD_PUBLIC_URL` | se deduce de las solicitudes | URL pública del gateway, p. ej. `https://rwd.example.com/v1`. Recomendada |
| `RWD_METRICS_TOKEN` | la genera `deploy.sh` | Token Bearer para `/v1/metrics` |
| `RWD_DATABASE_URL` | SQLite en `./data` | `postgres://…` para usar Postgres en su lugar |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Días que se conserva el registro de auditoría |
| `RWD_LANG` | `en` | Idioma de los textos dirigidos al agente: `en`, `zh`, `zh-TW`, `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` o `pt` |
| `RWD_MCP_RATE_LIMIT` | — | Solicitudes MCP por IP de cliente y minuto (sin límite si no está definida); para una demo pública, consulta [deploy/demo](../demo/README.md) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Rangos de direcciones (CIDR separados por espacios, o el `private_ranges` de Caddy) del proxy que está delante de Caddy; ver más abajo |
| `BIND` | `127.0.0.1` | Dirección en la que se publica Caddy |
| `PORT` | `18788` | Puerto en el que se publica Caddy |
| `RWD_DOMAIN` | — | Nombre de host público para HTTPS directo (solo con `compose.tls.yml`) |
| `COMPOSE_FILE` | — | `compose.yml:compose.tls.yml` activa el HTTPS directo |

Después de editar `.env` en el servidor, aplícalo con `docker compose up -d` en el directorio del despliegue.

## Desplegar con `deploy.sh`

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` es cualquier cosa que acepte `ssh` (un alias de `~/.ssh/config`, `user@host`); `<amd64|arm64>` es la arquitectura de CPU del servidor; `remote-dir` es por defecto `rwd-platform` en el directorio personal del usuario de ssh. El script:

1. ejecuta `make platform GOOS=linux GOARCH=<arch>` en local (SDK, consola, binario del gateway);
2. copia al servidor el Dockerfile, los archivos de Compose y los Caddyfiles, las páginas de demostración y el binario;
3. **solo en el primer despliegue**, escribe `.env` (modo 600) con una contraseña aleatoria para el propietario, `BIND`, `PORT` y los ajustes opcionales de abajo, y muestra una sola vez el inicio de sesión del propietario. Los despliegues posteriores nunca sobrescriben `.env`; solo añaden al final los ajustes nuevos de versiones más recientes (como `RWD_METRICS_TOKEN`) si faltan;
4. si existe `data/rwd.db`, detiene el gateway y copia la base de datos a `data/rwd.db.bak-<YYYYmmddHHMMSS>` (las migraciones del esquema se ejecutan en el siguiente arranque); después corrige el propietario de `data/` para el uid 10001 con un contenedor desechable en lugar de sudo;
5. ejecuta `docker compose up -d --build` y muestra el estado de los servicios.

Los ajustes del primer despliegue se pueden pasar como variables de entorno; solo se leen mientras `.env` todavía no existe: `BIND`, `PORT`, `RWD_ADMIN_EMAIL`, `RWD_PUBLIC_URL`, `RWD_TRUSTED_PROXIES` y `RWD_DOMAIN`.

### Detrás de un proxy TLS existente

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy se publica en `127.0.0.1:18788`. Apunta tu proxy hacia él y asegúrate de que el proxy:

- deja pasar los upgrades a WebSocket (las páginas se conectan a `/v1/page`);
- no almacena las respuestas en búfer y admite conexiones de larga duración: las actualizaciones en vivo de la consola (`/v1/api/stream`) y MCP usan HTTP en streaming; el gateway envía un heartbeat cada 25 segundos, así que basta con tiempos de inactividad de más de 60 segundos;
- envía `X-Forwarded-For`, `X-Forwarded-Proto: https` y el `Host` original.

Por ejemplo, con nginx:

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

**`RWD_TRUSTED_PROXIES`.** Caddy solo reenvía al gateway las cabeceras `X-Forwarded-*` del proxy cuando este se conecta desde una dirección de confianza. El valor por defecto, `private_ranges`, cubre un proxy en el mismo host o en una red privada. Si tu proxy se conecta desde una dirección pública (otro servidor, una CDN o un balanceador de carga en la nube), define aquí sus rangos. Si no, el gateway ve al proxy como el cliente: todas las solicitudes parecen venir de la IP del proxy (lo que rompe las listas de IP permitidas de las claves de API y los límites de solicitudes por IP) y por HTTP plano (así que la cookie de la consola no se marca como `Secure`).

Para publicar Caddy en otra dirección o puerto, define `BIND` y `PORT`.

### HTTPS directo con `RWD_DOMAIN`

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

Antes del primer despliegue, apunta el DNS del dominio al servidor y abre los puertos 80 y 443 (TCP, más UDP 443 para HTTP/3). Con `RWD_DOMAIN` definida, el primer despliegue escribe en `.env` `RWD_DOMAIN`, `COMPOSE_FILE=compose.yml:compose.tls.yml`, `BIND=0.0.0.0`, `PORT=80` y `RWD_PUBLIC_URL=https://rwd.example.com/v1`. Caddy obtiene y renueva el certificado por su cuenta (Let's Encrypt mediante el HTTPS automático de Caddy), lo guarda en el volumen `caddy-data` y redirige HTTP a HTTPS. El puerto 80 queda abierto para el desafío ACME y la redirección.

Para pasar un despliegue existente a HTTPS directo, añade esas cinco líneas a `.env` y ejecuta `docker compose up -d`.

## Desplegar a mano

Sin `deploy.sh`:

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# copia deploy/platform/* al servidor, y el binario como ./rwd
# en el servidor, dentro de ese directorio:
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### Con la imagen publicada

Cada versión del gateway publica también la imagen `ghcr.io/zanel1u/remote-webview-debugger` para linux/amd64 y linux/arm64, con los tags `<version>` (p. ej. `0.2.0`), `<major>.<minor>` y `latest`, y con la consola y el SDK integrados. Para usarla en lugar de construir una, sustituye las líneas `build:` e `image:` del gateway en `compose.yml` por `image: ghcr.io/zanel1u/remote-webview-debugger:<version>`, omite el binario y arranca con `docker compose up -d`. Para actualizar, cambia el tag y ejecuta `docker compose pull && docker compose up -d` (antes, haz una copia de seguridad de `data/`, como hace `deploy.sh`).

Para una prueba rápida sin Compose, la imagen también funciona por sí sola: consulta el [inicio rápido](../../README.es.md#1-ejecuta-el-gateway). Por sí sola no confía en `X-Forwarded-*`; si pones tu propio proxy delante, añade `-e RWD_TRUST_PROXY=1`.

## Actualizar

Vuelve a ejecutar `deploy.sh` con el mismo host, la misma arquitectura y el mismo directorio. Recompila, copia el nuevo binario, hace una copia de seguridad de la base de datos SQLite y reinicia los servicios; `.env` se conserva. Cuenta con una breve interrupción. Las páginas se reconectan solas: tras un corte breve, en cuestión de segundos; tras uno más largo, una página puede pasar primero al sondeo y volver al WebSocket en unos minutos, o en cuanto un agente se conecte a ella. Los agentes conectados en ese momento tendrán que volver a conectarse.

## Copias de seguridad

- **Copias automáticas.** Cada despliegue copia `data/rwd.db` a `data/rwd.db.bak-<time>` antes de reiniciar. Se van acumulando; borra las antiguas de vez en cuando.
- **Copias de seguridad periódicas.** SQLite funciona en modo WAL, así que las escrituras recientes pueden estar en `rwd.db-wal` mientras el gateway está en marcha. Para obtener una copia coherente, detén el gateway un momento:

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **Restaurar.** Detén el gateway, sustituye `data/rwd.db` por la copia de seguridad (y borra `rwd.db-wal` / `rwd.db-shm`), asegúrate de que pertenece al uid 10001 y arranca el gateway.
- Haz también una copia de seguridad de `.env`. Las copias de la base de datos contienen el pepper de las claves de API y el secreto de sesión de la consola: guárdalas en privado.

## Postgres

Define `RWD_DATABASE_URL` en `.env`, por ejemplo `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`, y ejecuta `docker compose up -d`. El contenedor del gateway tiene que poder llegar a la base de datos (una base de datos gestionada, o un servicio `postgres` que añadas en un archivo override de Compose). El esquema se crea al arrancar; los datos de un archivo SQLite existente no se copian. `deploy.sh` solo hace copias de seguridad de SQLite, así que haz las de Postgres con `pg_dump` o con las instantáneas de tu proveedor.

## Operación diaria

```bash
docker compose ps                                     # estado
docker compose logs -f gateway                        # logs del gateway (la contraseña generada del propietario, errores…)
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **Si olvidaste la contraseña del propietario:** cambia `RWD_ADMIN_PASSWORD` en `.env` y ejecuta `docker compose up -d`; se aplica al arrancar.
- Ejecuta **una sola** instancia del gateway por base de datos: el estado en vivo (páginas conectadas, estado de control) reside en el proceso del gateway.
- Las páginas de demostración en `/demo/` son opcionales; borra el contenido de `demo/` si no quieres que sean públicas (el siguiente despliegue las vuelve a copiar).
