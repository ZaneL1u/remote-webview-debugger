<!-- i18n-source: 2b1a4c4698c0c1c90cb95a52c17aaab9848c06e2 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Gateway rwd

El servidor en Go de Remote WebView Debugger: conexiones de páginas, presencia de dispositivos, estado de control, el endpoint MCP alojado, la API REST de la consola web, además de la consola y el SDK de página integrados. Un solo binario es todo el servidor.

- Protocolo: [docs/protocol.es.md](../docs/protocol.es.md)
- Arquitectura, modelo de consentimiento y notas de seguridad: [docs/architecture.es.md](../docs/architecture.es.md)
- Despliegue con Docker Compose: [deploy/platform/README.es.md](../deploy/platform/README.es.md)

## Compilar y ejecutar

Para compilar necesitas Go (la versión indicada en `go.mod`) y Node.js con npm, porque la consola y el SDK se compilan e integran en el binario. Desde la raíz del repositorio:

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # compilación cruzada (amd64 o arm64)

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

Abre http://localhost:8080 e inicia sesión con ese correo y esa contraseña. Las páginas y los agentes usan la URL del gateway `http://localhost:8080/v1` (en producción: `https://rwd.example.com/v1`).

`go build ./cmd/rwd` dentro de `gateway/` también funciona, pero ese binario solo lleva marcadores de posición en lugar de la consola y el SDK. `make` fija la versión que muestran `rwd version` y `/v1/healthz` a partir del último tag `gateway-vX.Y.Z` (`0.2.0` justo en el tag, `0.2.0-3-gabc1234` después de él, `0.0.0-dev` si no hay ninguno); `RWD_VERSION=…` la sobrescribe. Los binarios publicados para Linux y macOS (amd64, arm64) se adjuntan a cada [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases) `gateway-v*`; cambios: [CHANGELOG](CHANGELOG.md).

## Comandos

```
rwd serve [flags]                       ejecuta el gateway
rwd mcp --gateway https://host/v1       puente MCP por stdio para agentes locales (clave de API en RWD_API_KEY)
rwd version                             muestra la versión
```

## Configuración (`rwd serve`)

Cada flag tiene su variable de entorno; si se pasa el flag en la línea de comandos, este tiene prioridad.

| Flag / variable de entorno | Valor por defecto | Descripción |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | Dirección de escucha (HTTP plano; pon TLS delante, consulta [deploy/platform](../deploy/platform/README.es.md)) |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | Base de datos. Una URL `postgres://` o `postgresql://` selecciona Postgres; cualquier otro valor es la ruta de un archivo SQLite. `RWD_DATABASE_URL` tiene prioridad sobre `RWD_DATA`. El esquema se crea y se migra al arrancar |
| `--public-url` / `RWD_PUBLIC_URL` | se deduce de cada solicitud | URL pública del gateway terminada en `/v1`, p. ej. `https://rwd.example.com/v1`. Se usa en los fragmentos de integración, los enlaces de invitación y `/v1/api/config`. Defínela cuando el gateway no pueda deducir su dirección pública |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | desactivado | Toma la IP del cliente de `X-Forwarded-For`, y el esquema y el host de la URL pública deducida (y si la cookie de la consola es `Secure`) de `X-Forwarded-Proto` / `X-Forwarded-Host`. Actívalo solo detrás de un proxy inverso; de lo contrario, los clientes pueden falsificar estas cabeceras y saltarse las listas de IP permitidas y los límites de solicitudes. Sin él, cada solicitud cuenta como HTTP plano diga lo que diga el proxy, así que la cookie de la consola se emite sin `Secure` y las URL deducidas empiezan por `http://` (en ese caso, define `--public-url`) |
| `--lang` / `RWD_LANG` | `en` | Idioma de todo lo que lee la IA: instrucciones MCP, descripciones de herramientas y parámetros, resultados de herramientas, `[Session changes]` y errores. También llega al SDK de página como `welcome.agentLang`, para que los errores y los resúmenes de eventos que se escriben en la página coincidan. Uno de `en`, `zh` (chino simplificado), `zh-TW` (chino tradicional), `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` o `pt`; se aceptan etiquetas regionales, que se asignan a la más cercana (`zh-CN` → `zh`, `zh-HK` → `zh-TW`, `pt-BR` → `pt`). La consola elige su idioma en cada solicitud (`?lang=` o `Accept-Language`) y, si no, usa este |
| `--demo-dir` / `RWD_DEMO_DIR` | — | Sirve este directorio en `/demo/` (opcional, para páginas de demostración) |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0` (sin límite) | Solicitudes MCP permitidas por IP de cliente y minuto; las que excedan reciben `429` con `Retry-After: 60`. Pensado para un gateway cuya clave de API es pública, como una demo ([deploy/demo](../deploy/demo/README.md)). Detrás de un proxy necesita `--trust-proxy` para ver las IP de los clientes |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | desactivado | Ejecuta una demo pública: `POST /v1/demo/keys` (sin iniciar sesión, CORS abierto) entrega a cada visitante su propia clave de API (nivel `interact`, válida 24 horas, 5 por IP y hora), así que los visitantes nunca comparten un agente; y `list_devices` exige un `deviceCode`, así que nadie puede listar los dispositivos de otros visitantes. Consulta [deploy/demo](../deploy/demo/README.md) |
| `RWD_ADMIN_EMAIL` | `admin` | Correo (nombre de inicio de sesión) de la cuenta propietaria. Solo se crea un propietario mientras la base de datos no tenga ninguno (en el primer arranque); cambiar este valor después **no** crea un segundo propietario, solo indica a qué propietario se aplica `RWD_ADMIN_PASSWORD` |
| `RWD_ADMIN_PASSWORD` | — | Contraseña del propietario. Se usa al crear el propietario y en **cada** arranque posterior para restablecer la contraseña del propietario indicado por `RWD_ADMIN_EMAIL`, lo que sirve también para recuperar la cuenta. Si ese correo no es de un propietario (es de otro miembro o de nadie), se ignora y el log lo indica, con los nombres de los propietarios. Si no está definida y la base de datos está vacía, se genera una contraseña aleatoria y se muestra una sola vez en el log |
| `RWD_METRICS_TOKEN` | — | Si está definida, `/v1/metrics` exige `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Días que se conserva el registro de auditoría |
| `RWD_OIDC_*` | — | Inicio de sesión único, ver [más abajo](#inicio-de-sesión-único) |

Otras cosas que conviene saber:

- Los secretos que necesita el gateway (el pepper de las claves de API y el secreto de sesión de la consola) se generan en el primer arranque y se guardan en la base de datos. Haz copias de seguridad de la base de datos y guárdalas en privado.
- El gateway mantiene el estado en vivo (páginas conectadas, estado de control, líneas de tiempo) en memoria, así que ejecuta una sola instancia por base de datos.
- Comprobación de estado: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## Inicio de sesión único

Los miembros también pueden iniciar sesión con Feishu, Lark o cualquier proveedor OpenID Connect (Keycloak, Okta, Microsoft Entra ID, Google, Authing, …); el correo y la contraseña siguen funcionando. Define el proveedor y sus credenciales de cliente, y la página de inicio de sesión mostrará **Iniciar sesión con …**.

| Variable de entorno | Valor por defecto | Descripción |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`, `lark` u `oidc`; activa el inicio de sesión único. Definir solo `RWD_OIDC_ISSUER` equivale a `oidc` |
| `RWD_OIDC_CLIENT_ID`, `RWD_OIDC_CLIENT_SECRET` | — | Credenciales de la aplicación (App ID y App Secret en Feishu y Lark). Obligatorias |
| `RWD_OIDC_ISSUER` | — | Issuer de OpenID Connect, p. ej. `https://sso.example.com/realms/acme`; los endpoints se leen de su `/.well-known/openid-configuration` (solo `oidc`) |
| `RWD_OIDC_AUTH_URL`, `RWD_OIDC_TOKEN_URL`, `RWD_OIDC_USERINFO_URL` | los del proveedor | Sustituyen los endpoints; define los tres para un proveedor OpenID Connect sin descubrimiento |
| `RWD_OIDC_SCOPES` | `openid profile email` (`oidc`), ninguno (Feishu, Lark) | Scopes separados por espacios. En Feishu y Lark, añade `contact:user.email:readonly` (y `contact:user.employee:readonly` para el correo corporativo) para que las cuentas tengan correo |
| `RWD_OIDC_NAME` | el nombre del proveedor | Texto del botón de inicio de sesión, p. ej. `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | Rol de las cuentas creadas en un primer inicio de sesión: `member` o `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | desactivado | No se crean cuentas: solo pueden iniciar sesión los miembros existentes o invitados (mismo correo) |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | Dominios de correo que pueden iniciar sesión, separados por comas, p. ej. `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | desactivado | Solo `oidc`: confía en el correo de un proveedor que no envía `email_verified` (Microsoft Entra ID). Solo para un proveedor de un único inquilino cuyos correos controla tu organización |
| `RWD_OIDC_TENANT` | — | Solo Feishu y Lark: el `tenant_key` de tu organización; se rechaza a las personas de otras organizaciones (`sso_error=tenant`). El registro de auditoría `auth.login` de cada inicio de sesión único muestra su `tenant` |

Registra esta URL de redirección en el proveedor; debe coincidir exactamente: `https://<host>/v1/api/auth/oidc/callback`, es decir, el origen de `RWD_PUBLIC_URL` (el de la solicitud si no está definida) seguido de `/v1/api/auth/oidc/callback`. Detrás de un proxy, define `RWD_PUBLIC_URL` para que la URL sea estable.

El primer inicio de sesión de una identidad la une al miembro con el mismo correo (un miembro invitado conserva el rol de la invitación, y la invitación queda usada) o crea una cuenta con `RWD_OIDC_DEFAULT_ROLE`, salvo con `RWD_OIDC_INVITE_ONLY=1`. Los inicios de sesión posteriores encuentran la cuenta por el subject del proveedor (`open_id` en Feishu y Lark), así que da igual si cambia el correo. Una cuenta ya vinculada a otra identidad del proveedor no se vuelve a vincular (un buzón reasignado recibe `sso_error=conflict`), y la invitación de un miembro desactivado no se toca. El correo de un proveedor OpenID Connect solo cuenta con `email_verified: true` (o con `RWD_OIDC_TRUST_EMAIL=1`), y una cuenta sin correo recibe el nombre de inicio de sesión `<provider>:<subject>`. Los propietarios gestionan estos miembros en la página **Miembros** como a cualquier otro: cambian su rol, los desactivan o los eliminan; un miembro desactivado no puede iniciar sesión de ninguna de las dos formas. Las cuentas creadas por inicio de sesión único no tienen contraseña. El gateway lee el usuario del endpoint userinfo del proveedor con el token de acceso que acaba de recibir (flujo de código de autorización con PKCE); no usa el ID token. Los inicios y los callbacks están limitados a 60 por minuto por IP de cliente (detrás de un proxy, activa `--trust-proxy`, o todos compartirán la IP del proxy).

**Quién puede entrar.** El correo del proveedor decide con qué miembro existente se une un primer inicio de sesión, propietarios incluidos, así que quien pueda definir correos en el proveedor puede apoderarse de esas cuentas. Con Feishu o Lark, usa una aplicación personalizada: solo las personas de tu organización pueden iniciar sesión, con los correos de tu organización. Una aplicación de la tienda, o una compartida con organizaciones conectadas, también deja entrar a otras organizaciones: en ese caso define `RWD_OIDC_TENANT`. Con un proveedor OpenID Connect en el que cualquiera puede iniciar sesión (Google, un Entra ID multiinquilino), define `RWD_OIDC_ALLOWED_DOMAINS` o `RWD_OIDC_INVITE_ONLY=1`, o cualquiera obtendrá una cuenta (el log lo advierte al arrancar); y nunca definas `RWD_OIDC_TRUST_EMAIL=1` en ese caso.

**Cambiar la aplicación o desactivar el inicio de sesión único.** Los `open_id` de Feishu y Lark pertenecen a una sola aplicación: tras cambiar a otro App ID, los miembros se vuelven a vincular por correo, y las cuentas sin correo (`feishu:…`) hay que eliminarlas e invitarlas de nuevo. Las cuentas creadas por inicio de sesión único no tienen contraseña: un propietario les da una con **Nuevo enlace** en la página **Miembros**, un enlace de invitación para definir una contraseña (también sustituye a una invitación perdida), por ejemplo antes de desactivar el inicio de sesión único.

**Feishu o Lark.** En la [Feishu Open Platform](https://open.feishu.cn/app) (Lark: [open.larksuite.com](https://open.larksuite.com/app)), crea una aplicación personalizada (企业自建应用), que solo pueden usar las personas de tu organización, y luego:

1. Copia el App ID y el App Secret de **Credentials & Basic Info** en `RWD_OIDC_CLIENT_ID` y `RWD_OIDC_CLIENT_SECRET`.
2. En **Security Settings → Redirect URLs**, añade la URL de redirección de arriba.
3. En **Permissions & Scopes**, añade `contact:user.email:readonly` (y `contact:user.employee:readonly` para el correo corporativo), y pon los mismos scopes en `RWD_OIDC_SCOPES`.
4. Limita la disponibilidad de la aplicación a las personas que deben iniciar sesión, y crea y publica una versión para que los ajustes surtan efecto.

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

## Conectar un agente

Crea una clave de API en la consola (**API keys**) y añade el endpoint MCP alojado a tu cliente; por ejemplo, en Claude Code:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

Para clientes que solo hablan stdio, el mismo binario reenvía stdio al endpoint alojado:

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| Ajuste de `rwd mcp` | Descripción |
|---|---|
| `--gateway` / `RWD_GATEWAY` | URL del gateway terminada en `/v1` |
| `RWD_API_KEY` | Clave de API (solo por variable de entorno, para que no aparezca en las listas de procesos) |

Una sola clave llega a todos los dispositivos del gateway. Las herramientas se enumeran en [protocol.es.md §14](../docs/protocol.es.md#14-mcp).

## Estructura del código

```
cmd/rwd/            punto de entrada: serve, mcp (puente stdio), version
internal/store/     SQLite / Postgres: proyectos y políticas, miembros, claves de API (HMAC; nivel,
                    caducidad, lista de IP permitidas), dispositivos y tokens de dispositivo,
                    invitaciones de dispositivo, registro de auditoría, ajustes
internal/hub/       estado en vivo: dispositivos, páginas, máquina de estados de control, aprobación
                    de conexión, comprobaciones de nivel, líneas de tiempo, enrutamiento RPC,
                    suscripciones SSE, métricas
internal/server/    HTTP: WebSocket de páginas, sondeo de presencia, REST con inicio de sesión y
                    roles, herramientas MCP, SSE, /v1/metrics, archivos estáticos
internal/i18n/      textos para agentes y para la consola, en 11 idiomas
internal/ids/       claves de app, claves de API, códigos de dispositivo, secretos
internal/web/       la consola y el SDK integrados (los coloca `make gateway`; si no, marcadores de posición)
scripts/embed.sh    coloca console/dist y sdk.js en internal/web para go:embed
```

## Pruebas

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` recorre todo el flujo con páginas simuladas y un cliente MCP: conexión por código de dispositivo; aprobación en el dispositivo (permitir, denegar, denegaciones repetidas y bloqueo, solo ver); reconexión dentro del período de gracia sin una segunda aprobación; comprobaciones de nivel; instantáneas; bloqueo en la primera interacción; seguimiento entre páginas y descarte de una página que una WebView recreada ha sustituido; tomar y devolver el control; acciones por lotes; finalización por parte del usuario; registros de auditoría; tokens de dispositivo (4401), tokens de reanudación (4409) y cuotas (4429); invitaciones de un solo uso; caducidad de claves y listas de IP permitidas; revocación inmediata; invitaciones y roles de miembros; SSE y métricas; y fallos de autenticación.

Las mismas pruebas se ejecutan contra Postgres (cada prueba en su propio esquema temporal):

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

`make -j16 check` en la raíz del repositorio ejecuta las comprobaciones del gateway, el SDK y la consola que ejecuta la CI.
