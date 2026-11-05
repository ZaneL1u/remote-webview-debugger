<!-- i18n-source: 4aba3543b3bf9d3d896c32c62bd7303d061f9795 -->
[English](protocol.md) | [简体中文](protocol.zh-CN.md) | [繁體中文](protocol.zh-TW.md) | [日本語](protocol.ja.md) | [한국어](protocol.ko.md) | Español | [Français](protocol.fr.md) | [Deutsch](protocol.de.md) | [Português (Brasil)](protocol.pt-BR.md) | [Русский](protocol.ru.md) | [العربية](protocol.ar.md)

# Protocolo RWD (v1)

Este es el contrato entre el gateway ([`gateway/`](../gateway)), el SDK de página ([`sdk/`](../sdk), con su motor en [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine)), la consola web ([`console/`](../console)) y los clientes MCP. Cuando cambia el protocolo, este documento cambia primero.

Para la visión general (componentes, modelo de consentimiento, almacenamiento, seguridad) consulta [architecture.es.md](architecture.es.md); para integrarlo en una app, [native-integration.es.md](native-integration.es.md).

Convenciones:

- La **URL del gateway** es `https://<host>/v1`, por ejemplo `https://rwd.example.com/v1`. Todos los endpoints cuelgan de ella; el SDK deriva de ella todas las direcciones.
- JSON en todas partes. Las marcas de tiempo son **milisegundos** desde la época Unix.
- `Level` es `"observe" | "interact" | "advanced"` (ver [§6](#6-niveles-de-acceso)).
- El receptor ignora los campos que no aparecen aquí. Los campos nuevos siempre son opcionales, así que un SDK antiguo sigue funcionando con un gateway más nuevo.

## Contenido

1. [Endpoints](#1-endpoints)
2. [Identificadores](#2-identificadores)
3. [Conexión de la página (WebSocket)](#3-conexión-de-la-página-websocket)
4. [Estado de control](#4-estado-de-control)
5. [RPC de página](#5-rpc-de-página)
6. [Niveles de acceso](#6-niveles-de-acceso)
7. [Aprobación de la vinculación](#7-aprobación-de-la-vinculación)
8. [Confirmación de acciones sensibles](#8-confirmación-de-acciones-sensibles)
9. [Sondeo de presencia como respaldo](#9-sondeo-de-presencia-como-respaldo)
10. [API de JavaScript para hosts](#10-api-de-javascript-para-hosts)
11. [Política del proyecto](#11-política-del-proyecto)
12. [API REST de la consola web](#12-api-rest-de-la-consola-web)
13. [Actualizaciones en vivo (SSE)](#13-actualizaciones-en-vivo-sse)
14. [MCP](#14-mcp)
15. [Idiomas](#15-idiomas)
16. [Operación](#16-operación)
17. [DevTools para personas](#17-devtools-para-personas)

## 1. Endpoints

| Ruta | Descripción |
|---|---|
| `GET /v1/sdk.js` | SDK de página (una IIFE que expone el global `RemoteWebviewDebugger`). `Cache-Control: max-age=300`, `Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | El mismo archivo en una URL inmutable, direccionada por contenido (en caché durante un año; se puede usar con SRI). Cualquier otro `<version>` da 404. Ver [§16](#16-operación) |
| `GET /v1/locales/<id>.js`, `GET /v1/sdk/<version>/locales/<id>.js` | Los paquetes de idioma bajo demanda del SDK, que `sdk.js` carga desde su mismo directorio ([§15](#15-idiomas)). `Cache-Control: max-age=300` |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Métricas de Prometheus ([§16](#16-operación)) |
| `WS /v1/page?key=<appKey>` | Conexión de la página ([§3](#3-conexión-de-la-página-websocket)) |
| `POST /v1/presence` | Sondeo de respaldo cuando el WebSocket no logra conectar ([§9](#9-sondeo-de-presencia-como-respaldo)) |
| `WS /v1/devtools?ticket=<ticket>` | La conexión CDP de una ventana de DevTools, solo desde el origen de la consola web ([§17](#17-devtools-para-personas)) |
| `/v1/api/…` | API REST de la consola web ([§12](#12-api-rest-de-la-consola-web)) |
| `/v1/mcp` | Servidor MCP alojado, Streamable HTTP, `Authorization: Bearer rwd_sk_live_…` ([§14](#14-mcp)) |
| `/demo/` | Archivos estáticos de `--demo-dir`, solo si está configurado |
| `/devtools/…` | El frontend de Chrome DevTools que integra la consola web ([§17.4](#174-frontend)) |
| cualquier otra ruta | Aplicación de una sola página de la consola web |

Las rutas desconocidas bajo `/v1/` devuelven `404 {"error":{"code":"not_found",…}}`. Todas las respuestas llevan `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`; todo salvo el SDK lleva además `X-Frame-Options: DENY`, o `SAMEORIGIN` bajo `/devtools/`.

## 2. Identificadores

| Nombre | Formato | Origen |
|---|---|---|
| Clave de app | `rwd_pk_` + 24 caracteres base62 | Se crea junto con un proyecto. Es pública: aparece en el código fuente de la página y solo permite que una página se conecte |
| Clave de API | `rwd_sk_live_` + 32 caracteres base62 | Se crea en la consola web y se muestra una sola vez. Se guarda como HMAC-SHA256 con un pepper del servidor. La consola muestra sus primeros 16 caracteres (`prefix`, p. ej. `rwd_sk_live_ab12`); los dispositivos ven `"…"` más los 4 últimos caracteres del prefijo (`keyHint`) |
| `deviceId` | UUID v4 (se acepta cualquier `[A-Za-z0-9_-]{1,64}`) | Lo genera el SDK y lo guarda en localStorage `rwd:device`, o lo pasa un host nativo con `run({ deviceId })` |
| Código de dispositivo | `XXXX-XXXX` sobre `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | Lo asigna el gateway la primera vez que ve un `deviceId`; no cambia nunca. Cuando un agente se conecta con uno, dan igual las mayúsculas, los guiones y los espacios |
| `pageId` | 12 caracteres base62 (se acepta cualquier `[A-Za-z0-9_-]{1,64}`) | Lo genera el SDK y lo guarda en sessionStorage `rwd:page`: estable entre recargas y navegaciones en la misma pestaña, nuevo en cada pestaña |
| Etiqueta de página | `p1`, `p2`, … | La asigna el gateway por dispositivo; se conserva mientras la página se reconecte dentro del periodo de gracia de 2 minutos |
| Id de sesión (arranque) | El id de arranque propio de la app anfitriona (4–128 caracteres de `[A-Za-z0-9_.:-]`), o si no 16 caracteres hexadecimales generados por el SDK | Un arranque de la app, bajo el cual la página archiva su registro de sesión ([§5.4](#54-registro-de-sesión)). Nunca se envía al gateway salvo en un resultado de `rwd.log` |
| `ref` | `e12`, `o3`, … | `eN`: un elemento de la instantánea más reciente de la página, válido hasta la siguiente instantánea de esa página. `oN`: un elemento que no tiene nodo en la instantánea — una capa superpuesta, o lo que sea que tape un punto de clic ([§5.3](#53-comportamiento-en-la-página)); sigue siendo válido mientras ese elemento esté en la página |
| Token de dispositivo | 64 caracteres hexadecimales | Se emite una vez por `deviceId` ([§3.5](#35-token-de-dispositivo-token-de-reanudación-e-invitaciones)); el gateway solo guarda un hash |
| Token de reanudación | 32 caracteres hexadecimales | Lo rota cada `welcome` ([§3.5](#35-token-de-dispositivo-token-de-reanudación-e-invitaciones)); se guarda como hash |

## 3. Conexión de la página (WebSocket)

### 3.1 Ciclo de vida

1. La página abre `wss://<host>/v1/page?key=<appKey>`. Antes del upgrade el gateway comprueba:
   - límite de frecuencia: 120 conexiones (y llamadas de presencia) por minuto por IP de cliente → `429 rate_limited`;
   - que la clave de app exista y su proyecto no esté desactivado → si no, `401 bad_key`;
   - si el proyecto tiene `allowedOrigins`, la cabecera `Origin` debe coincidir con alguno → si no, `403 origin_not_allowed`.
2. Solo frames de texto, un objeto JSON por frame. Los mensajes entrantes pueden ocupar hasta 16 MiB (las capturas de pantalla llegan en base64).
3. La página debe enviar `hello` en menos de **5 segundos**. Un `hello` mal formado (JSON inválido, `t` incorrecto, `deviceId` / `pageId` no válido) se cierra con `1008`.
4. El gateway responde con `welcome` ([§3.4](#34-welcome)) o cierra con un código de cierre del protocolo ([§3.6](#36-códigos-de-cierre)).
5. El gateway envía `{"t":"hb"}` cada **25 segundos**, además de un ping de WebSocket que hay que contestar en menos de 10 segundos. El SDK se reconecta cuando no recibe nada durante **60 segundos**.
6. Las reconexiones del SDK usan un backoff exponencial de 1 s a 30 s, y cada espera se elige al azar dentro de la mitad superior del escalón actual. Tras **3 intentos consecutivos que terminan antes de un `welcome`**, el SDK pasa al sondeo de presencia ([§9](#9-sondeo-de-presencia-como-respaldo)).
7. Una segunda conexión con el mismo `pageId` sustituye a la primera (que se cierra con `1000 replaced`).
8. Una página que se desconecta conserva su etiqueta y su sitio durante un **periodo de gracia de 2 minutos** (las navegaciones se reconectan con margen de sobra). Pasado ese tiempo queda como `closed` en la línea de tiempo. Dos casos acortan la espera, para que un WebView recreado no se quede en la lista de páginas como *reconectando*:
   - una página que se conecta con un **`pageId` nuevo** descarta de inmediato todas las páginas desconectadas que muestran la misma URL (se ignora el fragmento `#`);
   - una página desconectada cuya URL también muestra una página **conectada** se descarta a los **1,5 s**.

   En ambos casos, si la página descartada era la página seleccionada del agente, la selección pasa a la página activa y el resultado lo indica ([§14.3](#143-herramientas)).
9. El SDK cierra el socket en `pagehide` (para que la página pueda entrar en la back/forward cache) y se reconecta en `pageshow`.

Cada conexión tiene una cola de envío de 64 mensajes. Una página que no da abasto se cierra con `1013 slow consumer` en vez de frenar al gateway.

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
 "deviceToken":"<token>"|null,   // siempre presente en los SDK actuales, ver §3.5
 "resume":"<token>"|null,        // el último token de reanudación que recibió este pageId
 "invite":"<token>"|null}        // de ?rwd_invite=…

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // cuando cambia
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // el usuario solicita asistencia / cancela la solicitud
{"t":"control","action":"takeover"|"handback"|"end"}                // los botones del usuario, §4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"t":"cdp","s":"<session>"|absent,"m":"<CDP JSON>"}                 // respuesta / evento de DevTools, §17.2
{"id":17,"result":{…}}                                              // RPC correcta, §5
{"id":17,"error":{"code":"not_found","message":"…"}}                // RPC fallida, §5
```

- `hello`: el gateway guarda `userId` (hasta 128 caracteres), `ua` (512), `platform` (16), `app`, `url` (2048) y `title` (256). `screen` es informativo.
- `event.summary` es una frase para el agente, ya limpia de valores enmascarados, p. ej. `TypeError: Cannot read properties of undefined (reading 'orderId')`, `POST /api/order → 405`, `Tapped button "Place order"`. El gateway registra cada tipo en la línea de tiempo (hasta 300 bytes) e ignora los tipos desconocidos. Las navegaciones, incluidas las internas de la página, no son eventos: el gateway las deduce de los mensajes `page` (`navigated` en la línea de tiempo, [§12.9](#129-eventos-de-la-línea-de-tiempo)); el SDK las guarda en el registro de sesión ([§5.4](#54-registro-de-sesión)).
- El SDK elimina eventos duplicados (mismo tipo y resumen en 2 s) y envía como máximo 30 cada 10 s. Los eventos y acciones de control generados sin conexión esperan en una cola (hasta 100 mensajes) al siguiente `welcome`.
- `help` y `control` solo se envían por toques del usuario (o llamadas del host nativo, [§10](#10-api-de-javascript-para-hosts)).

### 3.3 Gateway → página

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"Support Bot"}|null,"level":"interact"|null,
 "attachedMs":83000|null}                                     // §4, a todas las páginas del dispositivo
{"t":"help","on":false}                                       // solicitud retirada: se vinculó un agente, un miembro de la consola terminó la sesión o el usuario la finalizó en el dispositivo
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"Support Bot"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7, a la página en primer plano
{"t":"attach_cancel","requestId":"…"}                         // §7, a todas las páginas
{"t":"devtools","s":"<session>","on":true,"by":"Ann"}         // §17.2, se abrió o se cerró una ventana de DevTools ("on":false)
{"t":"cdp","s":"<session>","m":"<CDP JSON>"}                  // §17.2, un comando que viene de esa ventana
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // reservado: el SDK se reconecta pasados afterMs
{"id":17,"method":"rwd.snapshot","params":{}}                 // petición RPC, §5
```

El SDK entiende `reconnect`; el gateway no lo envía hoy en día.

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null,"attachedMs":null},
 "level":null,                       // igual que control.level
 "resume":"<new resume token>",
 "deviceToken":"<token>",            // solo cuando lo emite este welcome
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},   // o null, ver abajo
 "agentLang":"en",                   // el idioma del gateway: "en", "zh", "zh-TW", "fr"…, §15
 "task":{…}}                         // solo mientras el agente vinculado haya definido una
```

`config` es la configuración remota que sale de la política del proyecto cuya clave de app usó la página ([§11](#11-política-del-proyecto)). `config.helpButton` ya viene resuelto para el `userId` de esta página (`all`, o `listed` y el usuario está en la lista). `config.networkExclude` se suma a las reglas que la propia página pasó a `run({ networkExclude })` ([§10](#10-api-de-javascript-para-hosts)). `config.sessionLog` es el interruptor del proyecto para el registro de sesión; `false` detiene la grabación y borra lo que este origen ya había guardado ([§5.4](#54-registro-de-sesión)). `config.eruda` es la política de eruda del proyecto ([§11](#11-política-del-proyecto)); también puede ser `null` o faltar (un gateway o un `config` guardado de antes de que existiera el campo), y el SDK lo interpreta como `{"dock":false,"load":false}`; el `run({ eruda })` de la propia página sigue mandando campo a campo ([§10](#10-api-de-javascript-para-hosts)). El SDK guarda el último `config` en localStorage `rwd:cfg` y lo aplica en la siguiente página hasta que llega su `welcome`.

Si hay una solicitud de vinculación pendiente y la página que se reconecta es la página en primer plano del dispositivo, el gateway vuelve a enviar el `attach_request` justo después del `welcome`.

### 3.5 Token de dispositivo, token de reanudación e invitaciones

**Token de dispositivo.** La primera vez que el gateway ve un `deviceId` procedente de un SDK que maneja tokens, emite un token de dispositivo en `welcome.deviceToken` (32 bytes aleatorios en hexadecimal; solo se guarda un hash). A partir de ahí, todas las páginas de ese dispositivo deben presentarlo en `hello.deviceToken`; si falta o es incorrecto, la conexión se cierra con **4401**. Por tanto, conocer un `deviceId` y la clave de app pública no basta para colarse en el dispositivo de otra persona.

- El SDK guarda el token en localStorage `rwd:dtoken` y lo expone como `status().deviceToken`. localStorage va por origen, así que un host nativo que carga varios dominios guarda el token por su cuenta y lo devuelve con `run({ deviceToken })` ([native-integration.es.md](native-integration.es.md)).
- Un hello que tiene el campo `deviceToken` (aunque sea `null`) maneja tokens. Un hello sin ese campo viene de un SDK que no puede guardar un token; el gateway no le emite ninguno (eso dejaría fuera a las páginas posteriores del dispositivo), pero en cuanto un dispositivo tiene token, todas sus páginas deben presentarlo.

**Token de reanudación.** Cada `welcome` lleva un token `resume` nuevo ligado al `pageId`. Cuando se reconecta una página con un `pageId` conocido, su `hello.resume` debe coincidir con el último emitido; si no, la conexión se cierra con **4409** y el SDK empieza de cero con un `pageId` nuevo. Por tanto, conocer un `pageId` no basta para suplantar una página.

**Invitación.** Cuando la URL de la página lleva `?rwd_invite=<token>`, el SDK quita el parámetro de la barra de direcciones (`history.replaceState`), guarda el token en sessionStorage y lo envía en `hello.invite` hasta que llega un `welcome`. El gateway lo acepta si la invitación pertenece al mismo proyecto, no se ha usado y no ha caducado: el dispositivo queda marcado como `invited` y en asistencia, la línea de tiempo registra de qué invitación vino y la invitación se consume. Las invitaciones no válidas se ignoran en silencio. Ver [§12.6](#126-invitaciones-de-dispositivo).

### 3.6 Códigos de cierre

| Código | Significado | Reacción del SDK |
|---|---|---|
| `1008` | `hello` mal formado | Reconectar con backoff |
| `1013` | La página no dio abasto con su cola de envío | Reconectar con backoff |
| `4401` | Token de dispositivo ausente o incorrecto | Si el token guardado cambió entretanto (otra pestaña acaba de recibirlo), reintentar al instante. Si no hay ningún token y el `deviceId` es el propio del SDK (no lo pasó un host), se perdió el welcome que traía el token (la primera página se fue a mitad del handshake): al cabo de unos 1,5 s, salvo que otra pestaña haya guardado un token para entonces, empezar de nuevo con un `deviceId` nuevo (como mucho dos veces por página). Si no, estado `rejected` y reintento en unos 10 minutos |
| `4409` | El token de reanudación no coincide | `pageId` nuevo y reconectar |
| `4429` | Se alcanzó la cuota de dispositivos en línea del proyecto (`maxOnlineDevices`) | Estado `quota`, reintento en unos 5 minutos |

## 4. Estado de control

Cada dispositivo tiene un único estado de control, que decide el gateway y difunde a todas las páginas del dispositivo con un mensaje `control`.

| Estado | Significado | Interfaz en la página |
|---|---|---|
| `none` | No hay agente vinculado | Píldora plegada con el código de dispositivo (más el botón "Solicitar asistencia" si está activado) |
| `observe` | Hay un agente vinculado que solo mira | "La IA está mirando", la entrada del usuario está bloqueada (salvo que el usuario haya desactivado el bloqueo), borde de pantalla luminoso, botones **Tomar control** y **Finalizar** |
| `agent` | El agente está operando la página | "IA trabajando", el mismo bloqueo, borde y botones, más el cursor del agente |
| `user` | El usuario tomó el control | Sin bloqueo, un borde estático, botones **Devolver** y **Finalizar** |

Transiciones:

| Disparador | Cambio |
|---|---|
| Un agente se vincula ([§7](#7-aprobación-de-la-vinculación)) | `none` → `observe` |
| El agente llama a una herramienta interactiva (click, fill, type, press, select, hover, scroll, drag, navigate, back, reload) | `observe` → `agent`. En `user` el gateway la rechaza con el error `takeover` sin contactar con la página |
| Sin interacción durante `policy.agentIdleMinutes` (2 por defecto; se comprueba cada 10 s) | `agent` → `observe` |
| La página envía `control: takeover` | `observe` / `agent` → `user` |
| La página envía `control: handback` | `user` → `agent` (o `none` si no hay agente vinculado) |
| La página envía `control: end` | Se desvincula el agente y se retira la solicitud de asistencia → `none` |
| El agente se desconecta o es sustituido, su clave se revoca, se agota `policy.attachMaxMinutes` (60 por defecto) o un miembro de la consola termina la sesión | → `none` |

La página se bloquea desde el momento en que un agente se vincula (`observe`), no solo cuando empieza a actuar, y sigue bloqueada al pasar de `agent` a `observe` por inactividad, hasta que el usuario toma el control o el estado vuelve a `none`.

`attachedMs` es cuánto tiempo lleva vinculado el agente, en milisegundos, en el momento en que el gateway envió el mensaje (`null` sin agente). Es una duración para que la página no necesite un reloj sincronizado con el gateway; la barra inferior lo muestra como un contador en marcha "Conectado · 01:23" en `observe`, `agent` y `user`, y "Conectando…" mientras se cae el enlace de la propia página. Con un gateway que no envía el campo, el SDK cuenta desde que la página vio al agente por primera vez.

El SDK también rechaza las RPC interactivas con `takeover` mientras el usuario tiene el control, como segunda comprobación. Recuerda el estado (y cuándo se vinculó el agente) durante 2 minutos en localStorage `rwd:ctl`, de modo que la siguiente página tras una navegación se bloquea al instante, con el contador en marcha, en vez de esperar a su `welcome`. Tomar el control, devolverlo y finalizar solo responden a toques de confianza del usuario; un agente no puede pulsarlos y un host nativo debe presentar la `nativeKey` ([§10](#10-api-de-javascript-para-hosts)).

## 5. RPC de página

### 5.1 Envoltorio

El gateway envía `{"id":<n>,"method":"rwd.…","params":{…}}` a una página; la página responde con `{"id":<n>,"result":{…}}` o `{"id":<n>,"error":{"code":"…","message":"…"}}`. Los ids son únicos por conexión. Si se cae la conexión, las llamadas pendientes fallan de inmediato.

Tiempos de espera en el lado del gateway: 20 s para las llamadas MCP; 45 s para `rwd.click`, `rwd.press` y `rwd.type` con `submit: true` (puede que se pida confirmación al usuario, [§8](#8-confirmación-de-acciones-sensibles)); 15 s para la prueba de conexión de la consola.

Códigos de error:

| Código | Significado |
|---|---|
| `not_found` | `ref` obsoleta o elemento desaparecido, opción desconocida, id de solicitud desconocido |
| `not_interactable` | No visible, deshabilitado, tapado, de solo lectura o no estable en 5 s |
| `timeout` | Se agotó una espera (en la página o en el gateway) |
| `takeover` | El usuario tiene el control |
| `forbidden` | Por encima del nivel concedido ([§6](#6-niveles-de-acceso)), o el usuario rechazó una confirmación |
| `bad_request` | Parámetro ausente o no válido, método desconocido |
| `internal` | Cualquier otra cosa (el mensaje lleva el error de JavaScript) |

Los mensajes que escribe el SDK están en el idioma del agente (`welcome.agentLang`, [§15](#15-idiomas)).

### 5.2 Métodos

Cada método actúa sobre la página que lo recibe.

| Método | Nivel | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<ms>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}`: una instantánea de accesibilidad en el formato para IA de Playwright (YAML, elementos marcados con `[ref=eN]`), seguida de una sección de capas superpuestas cuando algo flota sobre la página ([§5.3](#53-comportamiento-en-la-página)) |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}` (al menos un criterio; `limit` 1–100) | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`, ver [§5.4](#54-registro-de-sesión) | Depende de `op` |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}`: nombres de tecla de Playwright, combinaciones como `Control+A` | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}` (después la página se reconecta) |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | Un registro completo del registro de sesión: `{"seq","session","at","kind","page","imp","size","data"}`, con cabeceras y cuerpos incluidos ([§5.4](#54-registro-de-sesión)) |

Detalles:

- `rwd.query` compara `role` de forma exacta (sin distinguir mayúsculas) y `name` / `text` como subcadenas sin distinguir mayúsculas; `text` abarca el texto propio del elemento y el de sus descendientes, y solo se devuelve la coincidencia más interna.
- `rwd.fill` funciona en inputs de texto, textareas y elementos `contenteditable` (un `<label>` se redirige a su control). Asigna el valor mediante el setter nativo y despacha `input` y `change`, así que los inputs controlados de React y Vue ven el cambio. Un `<select>` necesita `rwd.select`.
- `rwd.type` enfoca `ref` (con el cursor al final) si se indica; si no, escribe en el elemento que tiene el foco; `submit: true` pulsa Enter después.
- `rwd.select` compara cada valor con el value, la etiqueta o el texto de una opción. Para varios valores hace falta un select `multiple`.
- `rwd.scroll` sin `ref` desplaza la página; con `ref` despacha un evento wheel sobre el elemento y desplaza su ancestro desplazable. Los desplazamientos se animan durante unos 0,3 s para que el usuario pueda seguirlos.
- `rwd.navigate` solo acepta URL `http(s)` absolutas o relativas. La navegación, el retroceso y la recarga ocurren 50 ms después de enviar la respuesta.
- `rwd.waitFor` primero duerme `timeMs` (como máximo 60 s) y después consulta el texto visible (`document.body.innerText`) cada 100 ms hasta que aparece `text` y desaparece `textGone`, o falla con `timeout` pasados `timeoutMs`.
- `rwd.screenshot` usa la captura nativa de la app anfitriona cuando hay una registrada y la región está dentro del viewport (`source: "native"`); si no, vuelve a renderizar el DOM (`source: "dom"`; canvas, vídeo e imágenes de otro origen pueden salir en blanco). `ref` recorta al elemento; `fullPage` captura el documento entero. Ver [§10](#10-api-de-javascript-para-hosts).
- `rwd.console` / `rwd.network` con `sinceId` devuelven las `limit` entradas más antiguas posteriores a él; sin él, las `limit` más recientes. Las peticiones en curso tienen `status: 0` y `durationMs: null`; `type` es `xhr`, `fetch`, `websocket`, `beacon` o `eventsource`.
- `rwd.network` omite las peticiones que coinciden con las reglas de exclusión — el `networkExclude` del proyecto más `run({ networkExclude })` ([§11](#11-política-del-proyecto)), más `exclude` solo para esta llamada — y `hidden` las cuenta. `includeExcluded: true` las devuelve todas y deja `hidden` a 0. Las peticiones excluidas se siguen grabando, y `rwd.networkDetail` las sigue devolviendo por id.
- `rwd.networkDetail` oculta las cabeceras `Cookie`, `Set-Cookie`, `Authorization` y `Proxy-Authorization`; los cuerpos se enmascaran y se cortan a 64 KB.
- `rwd.storage` devuelve como máximo 500 entradas, con los valores cortados a 4000 caracteres. Las cookies son las visibles para los scripts (no HttpOnly). Los `rwd:dtoken` y `rwd:resume` del propio SDK siempre se enmascaran.
- `rwd.evaluate` evalúa el código fuente de la función en el ámbito global de la página y la llama con `this = window`; puede devolver una promesa. El resultado se convierte en algo seguro para JSON: `undefined` y las funciones pasan a `null`, los elementos a una breve descripción de la etiqueta, las fechas a cadenas ISO y los ciclos a `"[Circular]"`.

### 5.3 Comportamiento en la página

- **Accionabilidad.** Las acciones de puntero esperan (hasta 5 s) a que el elemento esté conectado, visible, estable durante dos frames de animación, habilitado y desplazado hasta la vista, y a que una prueba de impacto (hit test) en el punto objetivo caiga sobre el elemento o un descendiente. El primer punto que se prueba es el centro visible del elemento, como haría un dedo; si algo lo tapa, se prueban los demás puntos de una cuadrícula de 3×3 dentro de su caja visible, de modo que una insignia encima de un botón no bloquea el clic. Cuando todos los puntos están tapados, la llamada falla con `not_interactable` y un mensaje que nombra el elemento que estorba y su `ref` (*the click point is covered by `<div.popup-mask>` (ref=o1; click it directly…)*), sobre el que el agente puede hacer clic en su lugar. La prueba de impacto ignora la propia interfaz del SDK y otras herramientas de depuración (`.__chobitsu-hide__`, `#eruda`, `#__pageSpy`, `#__vconsole`).
- **Capas superpuestas.** Una instantánea termina con una sección `[Overlays]` cuando hay capas flotando sobre la página: el fondo (backdrop) de un popup, un modal, una hoja inferior. Se detectan haciendo pruebas de impacto en unos cuantos puntos del viewport y quedándose con lo que esté en una caja fija (o absoluta del tamaño del viewport) que cubra al menos el 15 % del viewport y que no contenga ella misma la mitad de los elementos de la instantánea (eso sería la raíz de la propia app, no una capa encima). Cada línea da la etiqueta del elemento, unas pocas palabras de su texto (ya limpio), la parte del viewport que cubre y una `ref`; una capa sin texto ni contenido multimedia se lista como fondo. Un fondo vacío no tiene nodo en la instantánea aria, así que recibe una ref `oN` — eso es lo que permite al agente tocar un fondo para cerrar su popup.
- **Entrada sintética.** Un clic despacha `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click`, más eventos táctiles en dispositivos táctiles. Estos eventos tienen `isTrusted: false`; las páginas que lo comprueban no reaccionarán.
- **Feedback visual.** El objetivo se resalta un momento y un cursor del agente en la página se mueve hasta él antes de despachar la entrada.
- **Enmascaramiento.** Los valores de `input[type=password]`, de los elementos con `data-rwd-mask` y de los `maskSelectors` del proyecto se sustituyen por `••••` en instantáneas y capturas de pantalla (en las capturas nativas se tapan con cajas grises). Esos valores, y el texto que coincide con `maskPatterns`, también se sustituyen en el texto de la console, las URL y cuerpos de red, los valores de almacenamiento y los resúmenes de eventos.
- **Alcance de la instantánea.** La instantánea tiene como raíz `<body>`. La interfaz del SDK vive en un Shadow DOM bajo `<html>`, fuera de `<body>`; los nodos de eruda, PageSpy y vConsole se eliminan de la instantánea.
- **Búferes.** La console, los errores no capturados y la red (XHR, fetch, WebSocket, sendBeacon, EventSource) se graban desde el momento en que carga el SDK, en búferes circulares de 500 entradas cada uno. Cuando se llenan, primero se descartan los logs normales y las peticiones correctas; `dropped` los cuenta. Los cuerpos de respuesta se guardan en caché hasta 5 MB en total, 64 KB cada uno.

### 5.4 Registro de sesión

Los búferes de [§5.3](#53-comportamiento-en-la-página) viven en la memoria de una sola página. El **registro de sesión** es la versión larga: todo lo que ha pasado en este origen desde que se arrancó la app, escrito en **IndexedDB** (base de datos `rwd-log`) por todas las páginas del origen, tanto si el gateway es accesible como si no. Así, un agente que se vincula a posteriori puede leer todo el camino hasta un bug, a través de recargas y páginas. Nunca sale del dispositivo salvo que un agente vinculado lo pida.

**Una sesión es un arranque de la app.** El id se resuelve en este orden:

1. `run({ launchId })` — el id de arranque propio de la app anfitriona, generado en cada arranque en frío e igual para todos los WebView de ese proceso;
2. `window.RWDLaunchId`, que el host o el fragmento de integración pueden definir: una cadena, o una función que devuelve una cadena (o una promesa de una, que se espera como máximo 300 ms);
3. deducido por el SDK: una cookie de sesión `rwd_launch` (sin caducidad, así que muere con el proceso de la app) más un latido cada 10 s. Una sesión por cookie que lleva más de **1 hora** en silencio se trata como un arranque anterior y se empieza un id nuevo, lo que cubre los WebView que conservan las cookies de sesión entre arranques.

El `source` de una sesión indica cuál fue: `app` para 1 y 2, `cookie` para 3.

**Qué se graba.** Cada registro tiene `seq` (la clave, creciente), `at`, `kind`, `page` (el `pageId` de la página que lo escribe) y `data`:

| `kind` | `data` |
|---|---|
| `page` | `event: "open"` (url, título, referrer), `"nav"` (origen, url, título — incluidas las navegaciones internas de la página), `"visibility"` (primer plano / segundo plano), `"hide"` (la página se fue) |
| `action` | La entrada propia (de confianza) del usuario: `"tap"` (la descripción del elemento), `"input"` (descripción del campo y valor), `"submit"`, `"scroll"` (dónde se detuvo el desplazamiento). El valor de un campo de contraseña, de un elemento `data-rwd-mask` o de una coincidencia de `maskSelectors` se guarda como `••••`, nunca en claro; los demás valores se limpian con `maskPatterns` y se cortan a 200 caracteres |
| `agent` | Las llamadas interactivas del agente y `rwd.evaluate`: método, `ref`, tecla, url, valores, texto y el error si falló. Las lecturas (instantáneas, listados) se omiten |
| `control` | Cambios del estado de control con el nombre del agente ([§4](#4-estado-de-control)) |
| `console` | Todos los niveles, con `type`, `text` y `source` |
| `net` | Cada petición terminada: método, url, estado, tipo, duración, tamaño, error. Una **fallida** lleva además `reqHeaders` / `resHeaders` (ocultados como en `rwd.networkDetail`) y `reqBody` / `resBody`, cada uno cortado a 64 KB |

Los errores y avisos de la console, las peticiones fallidas, los toques, entradas y envíos del usuario, las acciones del agente y los cambios de control se marcan como importantes y son los que más tiempo se conservan. Los *problemas*, que seleccionan `problems` y `overview`, son los errores de la console y las peticiones fallidas.

**Límites.** Se guardan los **3** últimos arranques, cada uno dentro de **10 MB**. Si se supera, primero se descartan los registros no importantes más antiguos (logs normales de la console, peticiones correctas) y luego los más antiguos de todos, hasta bajar al 80 % del tope; `trimmed` los cuenta. Si `navigator.storage.estimate()` informa de una cuota por debajo de 64 MB, solo se guarda el arranque actual. Sin IndexedDB (algunos modos privados) no se graba nada y `rwd.log` falla con `internal`.

**Cómo leerlo.** `rwd.log` recibe un `op`:

```jsonc
// op: "sessions" → todos los arranques aún guardados, el más reciente primero
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview", params {"session"?} → un arranque de un vistazo
{"session":{…meta…,"current":true},"first":<ms>,"last":<ms>,
 "pages":[{"at","page","data"}],      // registros de apertura / navegación de páginas, los 60 últimos
 "problems":[…records…]}              // errores de la console y peticiones fallidas, los 20 últimos

// op: "records", params {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                       "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                       "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // pásalo como `after` para la página siguiente
 "hidden":0}                          // peticiones ocultadas por las reglas de exclusión de red (§11)
```

- `session` es por defecto el arranque actual (`"current"` significa lo mismo); un id desconocido falla con `not_found`. Si no hay ningún arranque grabando, se usa el guardado más reciente.
- `problems: true` deja solo los errores de la console y las peticiones fallidas. `text` es una subcadena, sin distinguir mayúsculas, del `data` del registro. `limit` es 1–500, 100 por defecto.
- Los registros vuelven **sin** cabeceras ni cuerpos; `data.hasBody` es `true` donde hay cuerpo. `rwd.logDetail` devuelve ese registro completo y necesita `advanced` ([§6](#6-niveles-de-acceso)), igual que `rwd.networkDetail`.
- Las reglas de exclusión de red también se aplican aquí, así que un registro `net` que coincide con ellas se omite de `records` y se cuenta en `hidden`, salvo que se indique `includeExcluded`.

**Cómo desactivarlo.** `run({ record: false })` impide que una sola página escriba. `policy.sessionLog: false` ([§11](#11-política-del-proyecto)) llega a las páginas como `welcome.config.sessionLog` y detiene la grabación **y borra los registros ya guardados para el origen**. `status().logSession` es el id de sesión en el que escribe una página, o `null` cuando no está grabando.

## 6. Niveles de acceso

| Nivel | Métodos permitidos |
|---|---|
| `observe` | `rwd.ping`, `rwd.snapshot`, `rwd.query`, `rwd.screenshot`, `rwd.console`, `rwd.network`, `rwd.waitFor`, `rwd.log` |
| `interact` | `observe` + `rwd.click`, `rwd.fill`, `rwd.type`, `rwd.press`, `rwd.select`, `rwd.hover`, `rwd.scroll`, `rwd.drag`, `rwd.navigate`, `rwd.back`, `rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`, `rwd.networkDetail`, `rwd.storage`, `rwd.logDetail` |

El nivel de una vinculación es

```
min(nivel que pide el agente (por defecto interact),
    el maxLevel de la clave de API,
    el maxLevel de la política de proyecto combinada,
    el nivel que eligió el usuario en el dispositivo)
```

Ambos lados lo hacen cumplir: el gateway rechaza las llamadas por encima del nivel (error `forbidden`, auditoría `policy.denied`) y el SDK vuelve a comprobarlo contra `welcome.level` / `control.level` antes de ejecutar nada. El gateway trata los métodos desconocidos como `advanced`. Si un gateway no envía nivel mientras hay un agente vinculado, el SDK asume `interact`.

## 7. Aprobación de la vinculación

Cuando un agente llama a `connect_device`, el gateway combina las políticas de los proyectos cuyas páginas están abiertas en el dispositivo ([§11](#11-política-del-proyecto)). Si el `approval` combinado es `prompt`, el usuario debe aprobarlo en el dispositivo:

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"Support Bot","keyHint":"…a91f"},
   "levels":["observe","interact"],   // niveles ofrecidos, limitados por la clave y la política; el último es el que pidió el agente
   "expiresInSec":30,
   "purpose":"devtools"}              // solo cuando un miembro de la consola web pide DevTools (§17.1)
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // o "level": null para denegar
← {"t":"attach_cancel","requestId":"…"}                         // se agotó el tiempo o el agente desistió
```

- La solicitud va a la **página en primer plano** del dispositivo; `attach_cancel` va a todas las páginas.
- Si no hay respuesta en **30 segundos**, cuenta como tiempo agotado. La llamada MCP espera la respuesta.
- Si a la misma clave de API se le deniega **3 veces** en el mismo dispositivo en 10 minutos, sus solicitudes a ese dispositivo se rechazan sin preguntar durante **10 minutos**.
- Solo puede haber una solicitud pendiente por dispositivo.
- El diálogo del SDK vive en un Shadow DOM, solo acepta toques de confianza y se activa 0,4 s después de aparecer, para que un agente no pueda aprobarse a sí mismo. Las pestañas del mismo origen comparten la decisión mediante BroadcastChannel.
- El usuario puede activar **permitir automáticamente** con un nivel máximo en la ventana flotante del SDK; entonces el SDK responde al instante con el nivel ofrecido más alto dentro de ese máximo y muestra un aviso. El permitir automáticamente es para agentes: una solicitud de DevTools siempre se pregunta.
- Con `run({ nativeApproval: true })` el SDK no muestra ningún diálogo. En su lugar, `status().pending` pasa a ser `{kind:"attach", requestId, agent:{name, keyHint}, levels, purpose, expiresAt}` (`purpose` es `"agent"` o `"devtools"`) y el host nativo responde con `nativeDecide(nativeKey, requestId, level | null)`.
- Tras la aprobación, el gateway vincula al agente (sustituyendo a cualquier otro agente del dispositivo), retira la solicitud de asistencia (`{"t":"help","on":false}`) y difunde `{"t":"control","state":"observe","agent":{…},"level":"interact","attachedMs":0}`; la página se bloquea de inmediato ([§4](#4-estado-de-control)).

Con `approval: none` el agente se vincula de inmediato al nivel calculado.

**Volver sin preguntar otra vez.** Un agente que suelta el dispositivo por sí mismo — `disconnect_device`, conectarse a otro dispositivo o que se agote `policy.attachMaxMinutes` — deja tras de sí un permiso: durante **10 minutos**, la misma clave de API puede volver a vincularse a ese dispositivo sin diálogo en el teléfono, con un nivel **no superior al que el usuario concedió antes** (así que pedir `advanced` tras una aprobación de `observe` sigue dando `observe`). No se relaja nada más: la clave, la política y la propia solicitud del agente siguen limitando el nivel, y el dispositivo debe tener una página conectada. Esa vinculación se audita como `attach.resume` junto al habitual `attach.start` ([§12.7](#127-registro-de-auditoría)), y la página ve el mensaje `control` normal, no un `attach_request`.

Volver no consume el permiso: soltar de nuevo abre otra ventana de 10 minutos. El permiso se descarta cuando la sesión termina por cualquier otro motivo: el usuario toca **Finalizar** en el dispositivo, un miembro de la consola la termina (`POST /devices/:id/end`), se revoca la clave de API, otro agente se vincula al dispositivo y sustituye a este, o el usuario deniega una solicitud. También caduca con el proceso del gateway, ya que se guarda en memoria.

## 8. Confirmación de acciones sensibles

Antes de actuar, el SDK pregunta al usuario cuando el agente:

- hace clic (`rwd.click`) en un elemento que coincide con `[data-rwd-confirm]` o con los `confirmSelectors` de la política, o que está dentro de uno;
- pulsa Enter (`rwd.press`, o `rwd.type` con `submit: true`) sobre un elemento así, o en un formulario que contiene uno (no en un textarea ni en un editor de texto enriquecido).

El diálogo dice algo como *La IA quiere hacer clic en "Realizar pedido". ¿Permitir?*, solo acepta toques de confianza y caduca a los **30 segundos**. Una denegación o el tiempo agotado hacen fallar la RPC con `{"code":"forbidden","message":"The user denied this action"}`. Solo puede haber una confirmación abierta a la vez; se cancela cuando el usuario toma el control, el agente se va o se cae la conexión.

Con `nativeApproval: true`, `status().pending` pasa a ser `{kind:"confirm", requestId, action:'click "Place order"', expiresAt}` y el host responde con `nativeDecide(nativeKey, requestId, "allow" | null)`. En `status().pending`, una confirmación pendiente tiene prioridad sobre una solicitud de vinculación pendiente.

## 9. Sondeo de presencia como respaldo

Cuando el WebSocket falla 3 veces seguidas, el SDK pasa a llamar a `POST /v1/presence` cada 60 segundos. Envía `Content-Type: text/plain` con un cuerpo JSON, así que no hace falta preflight de CORS; el gateway responde con `Access-Control-Allow-Origin: *`.

```jsonc
// petición
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// respuesta
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- El gateway usa `key`, `deviceId`, `userId`, `device.{ua, platform, app}`, `deviceToken` y `help`; `pageId` y `page` son informativos. La clave de app y el origen se comprueban igual que en el WebSocket, con el mismo límite de frecuencia.
- Un dispositivo al que se le ha emitido un token de dispositivo ([§3.5](#35-token-de-dispositivo-token-de-reanudación-e-invitaciones)) también debe enviarlo aquí; si no, la llamada falla con `401 bad_token` y no se actualiza nada del dispositivo. Un dispositivo sin token (un SDK antiguo) sigue sondeando sin él.
- `help: true` marca que el dispositivo solicita asistencia, igual que `hello.help`, salvo que ya haya un agente vinculado.
- Un dispositivo que sondea cuenta como en línea durante 90 segundos tras cada llamada.
- `connect: true` le dice a la página que abra el WebSocket ya. El gateway lo activa cuando un agente llama a `connect_device` o `wait_for_device` para ese dispositivo.
- Como red de seguridad, el SDK también reintenta el WebSocket cada 5 sondeos.

## 10. API de JavaScript para hosts

El SDK expone `window.RemoteWebviewDebugger`. Las páginas llaman a `run()`; los hosts nativos inyectan el SDK y llaman a `run()` con opciones adicionales (ver [native-integration.es.md](native-integration.es.md)).

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null: el usuario con sesión iniciada, visible para los agentes y la consola
  helpButton,            // mostrar el botón "Solicitar asistencia" (OR con el helpButton de la política)
  app,                   // { name, version } de la app anfitriona
  lang,                  // una etiqueta de idioma para la interfaz del usuario del teléfono; por defecto según navigator.languages (§15)
  locales,               // paquetes de idioma adicionales; messages: textos sobrescritos por idioma (§15)
  theme,                 // 'auto' (por defecto) | 'system' | 'light' | 'dark'
  style,                 // colores, fuentes, radios, z-index y posiciones como propiedades CSS --rwd-* (sdk/README.es.md)
  lockScreen,            // bloquear la entrada mientras haya un agente vinculado (por defecto true; el usuario puede cambiarlo)
  eruda,                 // true | { dock, load, src, name }: mostrarse como pestaña dentro de eruda
  networkExclude,        // peticiones que no deben aparecer en lo que lee el agente (§11)
  record,                // mantener el registro de sesión (por defecto true; la política puede desactivarlo, §5.4)
  // hosts nativos
  deviceId,              // un id por instalación, compartido por todos los WebView y dominios
  deviceToken,           // el token de status().deviceToken, guardado por el host
  launchId,              // este arranque de la app, compartido por todos los WebView del proceso (§5.4)
  nativeKey,             // un secreto que solo conoce el host; habilita nativeControl / nativeDecide
  nativeApproval,        // el host muestra él mismo las preguntas de vinculación / confirmación
}) // → Promise<{ deviceCode, status }>
```

| Función | Descripción |
|---|---|
| `run(gatewayUrl, appKey, options?)` | Pone la página en línea. Se resuelve en cuanto responde el gateway, o a los 8 s con lo que se sepa. Llamarla de nuevo devuelve la misma promesa |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`. `status` es `idle`, `connecting`, `online`, `polling`, `rejected`, `quota` o `stopped`; `logSession` es el registro de sesión en el que escribe esta página, `null` cuando no está grabando ([§5.4](#54-registro-de-sesión)) |
| `help(on = true)` | Solicitar asistencia o cancelar la solicitud |
| `setUser(userId)` | Cambiar el usuario con sesión iniciada (el SDK se reconecta con un `hello` nuevo) |
| `stop()` | Desconectar y quitar la interfaz; la captura de console y red continúa, con límite |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | Los botones de control propios del host nativo. Devuelve `false` si la clave no coincide |
| `nativeDecide(nativeKey, requestId, value)` | Responder a `status().pending`: un nivel o `null` para `attach`, `'allow'` o `null` para `confirm`. Devuelve `false` si la clave, la solicitud o el valor no son correctos |

**Id de arranque.** Además de `run({ launchId })`, un host puede definir `window.RWDLaunchId` antes de que se ejecute el SDK: una cadena, o una función que devuelve una cadena o una promesa de una (que se espera como máximo 300 ms). Debe tener 4–128 caracteres de `[A-Za-z0-9_.:-]`; cualquier otra cosa se ignora y el SDK deduce el arranque por su cuenta ([§5.4](#54-registro-de-sesión)).

`nativeKey` solo se escribe en el script inyectado y se compara en tiempo constante. Los scripts de la página, incluido el `evaluate_script` de un agente, no pueden leerla, así que no pueden devolver el control ni aprobarse a sí mismos.

**Puentes nativos de captura de pantalla.** Si el host registra uno de estos, `rwd.screenshot` lo usa para obtener los píxeles reales (incluidos vídeo, canvas, imágenes de otro origen y capas nativas superpuestas). Cada uno devuelve una data URL PNG o JPEG, o base64 sin más, del WebView visible:

| Puente | Plataforma |
|---|---|
| `window.RWDNativeScreenshot()` | Cualquier host; devuelve `string` o `Promise<string>` |
| `webkit.messageHandlers.rwdScreenshot` | `WKWebView` de iOS / macOS, registrado como `WKScriptMessageHandlerWithReply`; recibe `{type:"screenshot"}` |
| `window.RWDAndroid.screenshot()` | Android, un método `@JavascriptInterface` |

Implementación de referencia: [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift).

## 11. Política del proyecto

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt: el usuario aprueba cada vinculación en el dispositivo (por defecto prompt)
  maxLevel: Level                  // nivel más alto para este proyecto (por defecto interact)
  maskSelectors: string[]          // selectores CSS adicionales que enmascarar (además de los campos de contraseña y [data-rwd-mask])
  maskPatterns: { name: string; regex: string }[]  // patrones de texto que enmascarar, p. ej. números de teléfono o de identidad (regex de JavaScript)
  confirmSelectors: string[]       // hacer clic en estos requiere el OK del usuario (además de [data-rwd-confirm])
  networkExclude: string[]         // peticiones que no aparecen en lo que leen los agentes (§5.2)
  sessionLog: boolean              // las páginas mantienen un registro de sesión (por defecto true, §5.4)
  helpButton: 'off' | 'all' | 'listed'   // quién ve el botón "Solicitar asistencia" (por defecto off)
  helpUsers: string[]              // userIds para helpButton = listed
  agentIdleMinutes: number         // agent → observe tras esta inactividad (por defecto 2, máx. 120)
  attachMaxMinutes: number         // una vinculación termina pasado este tiempo (por defecto 60, máx. 1440)
  maxOnlineDevices: number         // 0 = ilimitado; por encima, los dispositivos nuevos se cierran con 4429
  maxAgents: number                // agentes vinculados a la vez a los dispositivos de este proyecto; 0 = ilimitado
  eruda: { dock: boolean; load: boolean }  // valor remoto por defecto para run({ eruda }); las opciones locales mandan campo a campo.
                                           // En welcome.config puede ser null o faltar (= ambos false), §3.4
  devtools: 'on' | 'off'          // los admin pueden abrir DevTools en las páginas del proyecto desde la consola web (por defecto on, §17)
}
```

- Los valores se normalizan al guardar: un `approval` distinto de `none` pasa a `prompt`, un `maxLevel` no válido pasa a `interact` y los números se acotan. `maskPatterns` debe compilar; si no, `400 bad_policy`. A `maskSelectors`, `confirmSelectors`, `networkExclude` y `helpUsers` se les quitan las entradas vacías y se cortan a 50 cada uno; `maskPatterns`, a 20.
- **`networkExclude`** es el ruido que un agente no debería tener que atravesar: fuentes que siempre dan 404, beacons de analítica. Cada regla se compara con la URL de la petición como subcadena sin distinguir mayúsculas, como patrón con comodín `*` (`*/404/*`) o como expresión regular cuando se escribe `/…/` (con flags opcionales; por defecto `i`). Una regla que no compila no coincide con nada. Las peticiones que coinciden se omiten de la lista de red y de los eventos `net_fail` de la línea de tiempo, pero la página las sigue grabando, así que un agente puede pedirlas con `includeExcluded` ([§5.2](#52-métodos), [§14.3](#143-herramientas)). Son una comodidad, no un control de privacidad: usa `maskSelectors` / `maskPatterns` para los datos que no deben salir de la página.
- **`sessionLog`** está activado salvo que se ponga a `false`, también en los proyectos guardados antes de que existiera el campo. Desactivarlo impide grabar a todas las páginas del proyecto y borra los registros que ya hay en esos dispositivos para ese origen; una página concreta puede excluirse por su cuenta con `run({ record: false })` ([§5.4](#54-registro-de-sesión)).
- Los campos de enmascaramiento, confirmación, exclusión de red, registro de sesión, asistencia y eruda llegan a las páginas en `welcome.config` ([§3.4](#34-welcome)); las reglas del `run({ networkExclude })` de la propia página se suman a las del proyecto.
- **Varios proyectos en un mismo dispositivo.** Un dispositivo se identifica por su `deviceId`, no por proyecto: las páginas cargadas con distintas claves de app en el mismo teléfono son páginas de un único dispositivo. Cuando un agente se vincula, el gateway combina las políticas de los proyectos cuyas páginas están conectadas y se queda con el valor más estricto: `prompt` si algún proyecto lo pide, el menor `maxLevel`, `agentIdleMinutes` y `attachMaxMinutes`, y el menor `maxAgents` distinto de cero.

## 12. API REST de la consola web

### 12.1 Convenciones

- Ruta base `/v1/api`. Se inicia sesión con `POST /auth/login`; la sesión es una cookie HttpOnly `rwd_session` (12 horas, `SameSite=Lax`, `Secure` sobre HTTPS). La cuenta se vuelve a leer en cada petición, así que desactivar o borrar a un miembro surte efecto al instante.
- Toda petición que no sea `GET` / `HEAD` a un endpoint que requiere sesión debe llevar `X-RWD-CSRF: 1`; si no, `403 csrf`.
- Los errores son `{"error":{"code":"…","message":"…"}}` con un estado 4xx/5xx. Los mensajes siguen el idioma de la petición ([§15](#15-idiomas)).
- Códigos habituales: `401 unauthorized` (sin sesión iniciada), `403 forbidden` (rol insuficiente), `403 csrf`, `404 not_found`, `400 bad_request`, `429 rate_limited`, `500 internal`.

Roles: `owner` (todo, incluidos los miembros), `admin` (proyectos, claves, políticas, dispositivos, invitaciones, auditoría), `member` (ver proyectos y dispositivos, probar conexiones, terminar sesiones, crear invitaciones de dispositivo, leer el registro de auditoría). En las tablas de abajo, *member* significa cualquier cuenta con sesión iniciada.

### 12.2 Cuentas y miembros

| Método | Ruta | Rol | Petición | Respuesta |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}` y la cookie. `401 bad_password`; `429 rate_limited` tras 10 intentos por minuto por IP. Un `email` vacío equivale a `admin` |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`. La contraseña nueva debe tener 8–256 caracteres; `400 bad_password` si la antigua es incorrecta |
| GET | `/auth/oidc/start?redirect=/path` | — | — | `302` al proveedor de inicio de sesión único, con una cookie firmada `rwd_oidc` (state y verificador PKCE, 10 minutos). `404` sin inicio de sesión único |
| GET | `/auth/oidc/callback` | — | `code` y `state` del proveedor | Inicia sesión y `302` a `redirect` (una ruta de la consola web; si no, `/`). Si falla, `302` a `/login?sso_error=<code>`: `provider`, `denied`, `state`, `not_allowed`, `no_account`, `disabled`, `rate_limited` |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity","sso"}`. `sso` es `null`, o `{"provider","name","defaultRole","inviteOnly"}` cuando el inicio de sesión único está activado |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<host>/invite/<token>"}` (válida 7 días, un solo uso). `409 conflict` si el email ya existe |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`. `409 last_owner` si no quedaría ningún owner activo |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`. `409 self`, `409 last_owner` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}` e inicia sesión. Con el mismo límite de frecuencia que el login |

El primer owner se crea al arrancar a partir de `RWD_ADMIN_EMAIL` (por defecto `admin`) y `RWD_ADMIN_PASSWORD` (ver [gateway/README.es.md](../gateway/README.es.md)). La página `/invite/:token` de la consola web acepta una invitación de miembro.

El inicio de sesión único con Feishu, Lark o un proveedor OpenID Connect (`RWD_OIDC_*`, ver [gateway/README.es.md](../gateway/README.es.md#inicio-de-sesión-único)) funciona junto a las contraseñas. El botón de la página de inicio de sesión abre `/auth/oidc/start`; el proveedor devuelve el navegador a `/auth/oidc/callback`, que pone la misma cookie `rwd_session`. Una identidad se busca por el subject del proveedor; si no, se vincula al miembro con el mismo email (lo que también acepta una invitación pendiente); si no, recibe una cuenta nueva con el rol por defecto, salvo que el gateway sea solo por invitación. Esas cuentas son miembros normales: los owners cambian su rol, las desactivan o las borran como se indica arriba.

### 12.3 Proyectos

| Método | Ruta | Rol | Petición | Respuesta |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project` (con la política por defecto) |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`. `policy` se combina con la actual |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | `Project` con una clave de app nueva |
| GET | `/projects/:id/integration` | member | — | `Integration` |

Las entradas de `allowedOrigins` son orígenes completos como `https://m.example.com`, con una etiqueta comodín inicial opcional: `https://*.example.com` coincide con cualquier subdominio, pero no con `https://example.com`. Vacío significa cualquier origen. `inviteUrl` debe ser una URL `http(s)`.

### 12.4 Claves de API

Las claves de API pertenecen al gateway, no a un proyecto: una clave llega a todos los dispositivos.

| Método | Ruta | Rol | Petición | Respuesta |
|---|---|---|---|---|
| GET | `/keys` | member | — | `{"keys":[ApiKey]}` |
| POST | `/keys` | admin | `{"name","maxLevel"?:"interact","expiresInDays"?:90,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}`: la única vez que se devuelve la clave completa |
| DELETE | `/keys/:id` | admin | — | `{"ok":true}`. La revocación es inmediata: el agente de la clave se desvincula y su siguiente petición MCP recibe 401 |

`expiresInDays: 0` significa que no caduca nunca. `ipAllowlist` admite IP o CIDR; si se define, las peticiones MCP desde otras direcciones reciben 401. `GET` / `POST /projects/:id/keys` son alias antiguos de `/keys`.

### 12.5 Dispositivos y estado del gateway

| Método | Ruta | Rol | Respuesta |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}` (`pageSize` ≤ 100). `online` (por defecto): dispositivos en línea, los conectados más recientemente primero. `all`: todos los dispositivos conocidos, los más nuevos primero. En ambos modos, `q` busca en el id de dispositivo, el código de dispositivo (guiones opcionales), el userId, el user agent, la etiqueta del sistema (en cualquiera de los dos idiomas) y los nombres de proyecto |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}`: dispositivos cuya última página vino del proyecto (por defecto `all`, hasta 500); primero los que solicitan asistencia, luego los que están en línea y luego los vistos más recientemente. `waiting` significa que el usuario solicitó asistencia (se muestra como En asistencia) |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | Siempre `200`: `{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<first 4000 characters>","error"?:{"code","message"}}`. Códigos: `device_offline`, `no_page` (la página se está reconectando), `timeout`, `takeover`, `internal` y los códigos RPC de [§5.1](#51-envoltorio) |
| POST | `/devices/:id/end` | member | `{"ok":true}`: desvincula al agente, retira la solicitud de asistencia, el control vuelve a `none` y cierra las ventanas de DevTools ([§17](#17-devtools-para-personas)) |
| POST | `/devices/:id/devtools` | admin | `{"page"?:"p1"}` → `{"ticket","session","page":Page,"frontendUrl"}`; puede esperar hasta 30 s a que responda el usuario ([§17.1](#171-abrir-una-ventana)) |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |

### 12.6 Invitaciones de dispositivo

Una invitación permite a un usuario poner su dispositivo en línea, con la asistencia ya solicitada, con solo abrir un enlace. Nadie tiene que dictar un código de dispositivo.

| Método | Ruta | Rol | Petición | Respuesta |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}` (`link` es la URL de destino sin el token, que no se guarda) |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | `DeviceInvite` con el `link` completo (`<url>?rwd_invite=<token>`) |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url` toma por defecto el `inviteUrl` del proyecto; hace falta uno de los dos. `expiresInMinutes` tiene un tope de 7 días. La página del enlace debe cargar el SDK con la clave de app del mismo proyecto ([§3.5](#35-token-de-dispositivo-token-de-reanudación-e-invitaciones)).

### 12.7 Registro de auditoría

`GET /audit?project=&device=<device code>&actor=&action=&from=&to=&limit=50&before=<id>` (member) → `{"events":[AuditEvent],"nextBefore":<id>|null}`, los más recientes primero. `limit` ≤ 200; `action` busca por prefijo (`attach.` coincide con todos los eventos de vinculación); `actor` coincide con el id o el nombre de un actor.

| Acción | Cuándo |
|---|---|
| `auth.login`, `auth.login_failed` | Inicio de sesión en la consola web |
| `member.invite`, `member.accept`, `member.sso_join`, `member.update`, `member.delete` | Gestión de miembros (`member.sso_join`: una cuenta creada en un primer inicio de sesión único; `auth.login` lleva entonces `"method":"sso"`) |
| `project.create`, `project.update`, `project.delete`, `project.rotate_app_key` | Proyectos |
| `key.create`, `key.revoke` | Claves de API |
| `invite.create`, `invite.delete`, `invite.use` | Invitaciones de dispositivo |
| `attach.request`, `attach.approve`, `attach.deny`, `attach.timeout`, `attach.resume`, `attach.start`, `attach.end` | Vinculaciones de agentes. `attach.resume` significa que la clave volvió dentro del periodo de gracia en vez de preguntar otra vez ([§7](#7-aprobación-de-la-vinculación)); `detail: {level}` |
| `rpc` | Cada RPC de página de un agente; `detail: {method, page, latencyMs, error?}` |
| `control.takeover`, `control.handback`, `control.end` | Los botones del usuario |
| `device.end` | Un miembro de la consola terminó una sesión |
| `policy.denied` | Se rechazó una llamada por encima del nivel concedido |
| `devtools.request`, `devtools.approve`, `devtools.deny`, `devtools.timeout`, `devtools.open`, `devtools.close` | Ventanas de DevTools ([§17](#17-devtools-para-personas)); `close` lleva `detail: {page, durationSec, reason}` |

Los eventos nunca contienen contenido de la página ni valores de parámetros. Se conservan 180 días por defecto (`RWD_AUDIT_RETENTION_DAYS`).

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
  projectId: string            // proyecto de la última página
  projects: string[]           // proyectos de las páginas conectadas
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* cuándo se puso en línea; solo mientras está en línea */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; purpose?: 'devtools'; expiresAt: number } | null
  devtools: { id: string; member: string; page: string /* etiqueta */; since: number }[]  // ventanas de DevTools abiertas (§17)
  task?: Task                  // solo mientras el agente vinculado haya definido una
  pages: number                // páginas conectadas
  sdk: string                  // versión del SDK que informa la página
  currentPage: { label: string; url: string; title: string } | null  // la página que el usuario probablemente está mirando
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // solo en GET /devices
}

type SystemInfo = {            // obtenido a partir del user agent
  os: string; osVersion: string; model: string; browser: string
  label: string                // p. ej. "iOS 18.0 · iPhone · WebView", "Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // la página que el usuario probablemente está mirando
  selected: boolean            // la página sobre la que trabaja el agente
  openerLabel: string | null; connectedAt: number
  connected: boolean           // false mientras se reconecta
  connectedSince: number       // inicio de la conexión actual (se renueva con las recargas)
}

type TimelineEvent = { at: number; page: string /* etiqueta; "" para eventos de todo el dispositivo */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // sustituye al recuento
  timeline: TimelineEvent[]    // los 100 últimos, el más antiguo primero
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* invitación aún no aceptada */
  createdAt: number; lastLoginAt: number | null
  hasPassword: boolean         // false en las cuentas creadas por inicio de sesión único
  sso: string[]                // proveedores vinculados: "feishu", "lark", "oidc"
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* código de dispositivo, prefijo de clave, email de miembro… */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}
```

### 12.9 Eventos de la línea de tiempo

Cada dispositivo guarda en memoria sus 300 últimos eventos de la línea de tiempo; la consola web muestra los 100 últimos y MCP, los 50 últimos por defecto.

| `kind` | Significado |
|---|---|
| `opened` / `closed` | Una página se conectó por primera vez / desapareció tras su periodo de gracia ([§3.1](#31-ciclo-de-vida)) |
| `navigated` / `reloaded` | Una página pasó a una URL nueva / se reconectó en la misma URL |
| `focus` | Una página pasó al primer plano |
| `error` / `console_error` / `net_fail` / `user_tap` | Eventos que informa la página ([§3.2](#32-página--gateway)) |
| `help` | El usuario solicitó asistencia o canceló la solicitud, o llegó a través de una invitación |
| `agent` | Solicitudes de vinculación, denegaciones, tiempos agotados, vinculaciones, cambios de tarea |
| `control` | Cambios del estado de control; el resumen da el motivo (el usuario tomó el control, IA inactiva, el usuario finalizó, …) |
| `offline` | La última página del dispositivo desapareció mientras había un agente vinculado |
| `devtools` | Solicitudes de DevTools, aprobaciones y denegaciones, ventanas abiertas y cerradas, aprobaciones retiradas ([§17](#17-devtools-para-personas)) |

## 13. Actualizaciones en vivo (SSE)

`GET /v1/api/stream[?project=<id>][&lang=<tag>]` (member, autenticación por cookie) emite un flujo `text/event-stream`:

```
retry: 3000

event: device     data: Device                               un dispositivo cambió (en línea, asistencia, control, aprobación, tarea…)
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   cada 25 s
```

Sin `project`, se emiten los eventos de todos los proyectos. `EventSource` no puede definir cabeceras, así que el idioma va en `?lang=`. Un suscriptor lento pierde eventos en vez de frenar al gateway; la consola web vuelve a pedir los datos al reconectarse y recurre al sondeo si el flujo falla.

## 14. MCP

### 14.1 Sesiones

- Endpoint `/v1/mcp` (Streamable HTTP). Toda petición debe llevar `Authorization: Bearer <API key>`. La clave se comprueba en cada petición, así que una clave revocada o caducada, o una dirección fuera de su `ipAllowlist`, recibe 401 al instante.
- El gateway mantiene un estado de agente por clave de API: el dispositivo vinculado y la página seleccionada. Las sesiones MCP que usan la misma clave lo comparten. Un agente está vinculado como mucho a un dispositivo a la vez; conectarse a otro dispositivo lo desvincula del primero. Una clave llega a todos los dispositivos del gateway.
- Más de 5 búsquedas de dispositivo fallidas por minuto con una misma clave se rechazan durante el resto del minuto, lo que impide adivinar códigos de dispositivo.

### 14.2 Resultados

Cada resultado de herramienta termina con lo que ha cambiado en el dispositivo desde la llamada anterior del agente (como máximo 20 líneas), para que el agente se entere de las páginas nuevas, navegaciones, errores y tomas de control sin tener que sondear:

```
[Session changes]
- p3 "Checkout" opened (opened by p2)
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- The user took over
```

El contenido que viene de la página (instantáneas, console, red, almacenamiento, resultados de evaluate, línea de tiempo) va envuelto en una etiqueta y marcado como datos no fiables, para que el agente no siga las instrucciones que encuentre en él.

### 14.3 Herramientas

| Herramienta | Nivel | Parámetros | Descripción |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all` (por defecto `online`), `userId?`, `deviceCode?` (mayúsculas o minúsculas, con o sin guion) | Hasta 50 dispositivos, primero los que solicitan asistencia |
| `connect_device` | — | `device` (código de dispositivo o deviceId), `level?: Level` (por defecto `interact`), `follow?: true` | Vincularse, preguntando antes al usuario si hace falta ([§7](#7-aprobación-de-la-vinculación)); en los 10 minutos siguientes a soltar el dispositivo por sí misma, la misma clave vuelve sin preguntar otra vez, con un nivel no superior al concedido entonces. Selecciona la página en primer plano. Falla si el dispositivo no tiene ninguna página conectada (y empuja a un dispositivo que sondea a reconectarse) |
| `disconnect_device` | — | — | Desvincularse |
| `wait_for_device` | — | `device`, `timeoutSec?: 60` (máx. 300) | Esperar a que el dispositivo tenga una página conectada; a un dispositivo que sondea se le pide que se reconecte |
| `list_pages` | — | — | Páginas del dispositivo: etiqueta, título, URL, seleccionada, primer plano / segundo plano, reconectando, página que la abrió |
| `select_page` | — | `page` (etiqueta) | Cambiar la página seleccionada |
| `take_snapshot` | observe | `page?` | Instantánea de accesibilidad con refs, más las capas superpuestas que flotan sobre la página y sus refs ([§5.3](#53-comportamiento-en-la-página)) |
| `find_elements` | observe | `text?`, `role?`, `name?`, `limit?`, `page?` | Buscar elementos y sus refs sin una instantánea completa (`rwd.query`) |
| `take_screenshot` | observe | `page?`, `fullPage?`, `format?: jpeg\|png` | Devuelve una imagen |
| `wait_for` | observe | `text?`, `textGone?`, `timeSec?` (máx. 30) | Esperar en la página seleccionada |
| `list_console_messages` | observe | `scope?: page\|session`, `types?`, `limit?: 50` | `session` junta todas las páginas conectadas y etiqueta cada línea con su página |
| `list_network_requests` | observe | `scope?`, `failedOnly?`, `limit?: 50`, `exclude?`, `includeExcluded?` | Igual; los ids se listan como `<label>:<id>`. `exclude` añade reglas para esta llamada encima de las del proyecto y la página ([§11](#11-política-del-proyecto)); cuando las reglas ocultan algo, el resultado termina con *N requests hidden by the exclude rules*, y `includeExcluded: true` las muestra |
| `click` / `hover` | interact | `ref` | Un clic bloqueado por una capa superpuesta falla con `not_interactable` y nombra la `ref` del elemento que estorba, sobre el que se puede hacer clic en su lugar ([§5.3](#53-comportamiento-en-la-página)) |
| `fill` | interact | `ref`, `value` | |
| `type_text` | interact | `text`, `ref?`, `submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`, `values` | |
| `scroll` | interact | `ref?`, `dx?`, `dy?` (por defecto `dy: 600`) | |
| `drag` | interact | `fromRef`, `toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]` (1–30), `stopOnError?: true` | Ejecuta `click`, `fill`, `type_text`, `press_key`, `select_option`, `hover`, `scroll` y `wait_for` en orden y devuelve un único resultado para todas |
| `get_network_request` | advanced | `id` (`<label>:<id>` de la lista, o un id a secas para la página seleccionada) | Cabeceras y cuerpos |
| `get_storage` | advanced | `area: local\|session\|cookie`, `page?` | |
| `evaluate_script` | advanced | `function`, `args?`, `page?` | Ejecutar JavaScript en la página; los resultados de más de 20.000 caracteres se cortan |
| `get_session_timeline` | — | `limit?: 50` | La línea de tiempo del dispositivo a través de sus páginas |
| `get_session_overview` | observe | `session?` | El registro de sesión del arranque actual de un vistazo ([§5.4](#54-registro-de-sesión)): cuándo empezó, cuánto hay guardado, recuentos de registros, las páginas visitadas, los 20 últimos errores y peticiones fallidas, y los demás arranques que se conservan |
| `get_session_log` | observe | `session?`, `kinds?`, `problems?`, `page?`, `text?`, `after?`, `limit?`, `seq?`, `exclude?`, `includeExcluded?` | El registro de sesión, registro a registro, como `#<seq> <time> <page> <line>`. `page` acepta una etiqueta como `p2` o un id de página tal como lo imprime el registro; `after` pagina hacia delante desde el `seq` con el que terminó el resultado anterior. `seq`, en cambio, muestra ese registro completo (cabeceras y cuerpos; necesita `advanced`, ya que llama a `rwd.logDetail`) |
| `wait_for_page` | — | `urlContains?`, `titleContains?`, `timeoutSec?: 30` (máx. 300) | Esperar a una página abierta o navegada desde la llamada anterior |
| `wait_for_event` | — | `kind?` ([§12.9](#129-eventos-de-la-línea-de-tiempo)), `page?`, `timeoutSec?: 30` (máx. 300) | Esperar al siguiente evento de la línea de tiempo que coincida |
| `wait_for_control` | — | `timeoutSec?: 120` (máx. 600) | Tras una toma de control, esperar a que el usuario devuelva el control (o finalice) |
| `set_task` | — | `title` (≤ 24 caracteres), `steps?` (≤ 12, ≤ 28 caracteres cada uno), `current?` | Mostrar la tarea y el plan del agente en la parte superior de todas las páginas del dispositivo. `current` es el paso activo; `current = steps.length` significa terminado. Las páginas lo reciben como `task` ([§3.3](#33-gateway--página)); se borra cuando el agente se va |

`page?` ejecuta una sola llamada en otra página (por etiqueta) sin cambiar la selección. Una herramienta por encima del nivel de la vinculación falla con "Requires advanced access; this session was granted interact" y se audita como `policy.denied`.

**Modo seguimiento.** Con `follow: true` (el valor por defecto), la página seleccionada cambia automáticamente cuando la acción del agente abre una página nueva, cuando el usuario trae otra página al primer plano o cuando la página seleccionada lleva 1,5 s desaparecida; el resultado lo indica. Una página seleccionada que se descarta por obsoleta ([§3.1](#31-ciclo-de-vida)) se sustituye por la página que muestra la misma URL, diga lo que diga `follow`, ya que la entrada antigua ha desaparecido.

### 14.4 Puente stdio local

Para clientes MCP que solo hablan stdio:

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

Retransmite stdio al `/v1/mcp` alojado. `--gateway` también puede venir de `RWD_GATEWAY`.

## 15. Idiomas

Idiomas admitidos: inglés (`en`), chino simplificado (`zh`), chino tradicional (`zh-TW`), francés (`fr`), español (`es`), ruso (`ru`), árabe (`ar`, de derecha a izquierda), japonés (`ja`), coreano (`ko`), alemán (`de`) y portugués (`pt`). Se acepta cualquier etiqueta BCP 47, que se asigna a la más cercana: `en-US` → `en`; `zh-CN`, `zh_CN`, `zh-Hans` → `zh`; `zh-HK`, `zh-MO`, `zh-Hant` → `zh-TW`; `fr-CA` → `fr`; `pt-BR`, `pt-PT` → `pt`. `Accept-Language` elige el idioma admitido con mayor peso.

| Destinatario | Qué | Lo elige |
|---|---|---|
| Agente | Instrucciones del servidor MCP, descripciones de herramientas y parámetros, resultados de herramientas, `[Session changes]`, errores | El `RWD_LANG` / `--lang` del gateway (por defecto `en`) |
| Agente, desde la página | Mensajes de error de RPC y resúmenes de eventos que escribe el SDK | `welcome.agentLang`, que lleva el idioma del gateway. El SDK guarda el último valor en localStorage `rwd:alang` para los eventos generados antes del siguiente `welcome`, y usa inglés hasta que se le indique otra cosa |
| Consola web | Mensajes de error, resúmenes de la línea de tiempo y etiquetas del sistema en las respuestas REST y SSE | `?lang=` en la petición, luego `Accept-Language` y luego el idioma del gateway |
| Usuario del teléfono | La píldora, las barras, los diálogos y los avisos del SDK | `run({ lang })`; si no, el primero de `navigator.languages` para el que el SDK tenga paquete (integrado o registrado por la página); si no, inglés. Los paquetes distintos de `en` y `zh` se cargan bajo demanda desde `locales/<id>.js` junto a `sdk.js`, o desde el gateway (`/v1/locales/<id>.js`) |

Así, un usuario que habla chino puede trabajar con un agente que habla inglés: el diálogo dice *AI 想要点击「提交订单」，允许吗？* y, si se rechaza, el agente lee *The user denied this action*.

## 16. Operación

- **Métricas.** `GET /v1/metrics` devuelve texto de Prometheus. Con `RWD_METRICS_TOKEN` definido, requiere `Authorization: Bearer <token>`. Series: `rwd_online_devices{project}`, `rwd_connected_pages`, `rwd_attached_agents`, `rwd_ws_connections`, `rwd_rpc_total{method,result}`, `rwd_rpc_duration_seconds{method}` (histograma), `rwd_http_requests_total{code}`.
- **Versiones del SDK.** La versión del SDK que se usa para la caché son los 12 primeros caracteres hexadecimales del SHA-256 del `sdk.js` integrado en el gateway, así que `/v1/sdk/<version>/sdk.js` cambia cada vez que cambia el archivo. `GET /v1/api/config` la devuelve como `sdkVersion`, junto con `sdkIntegrity` (`sha384-…`, para el atributo `integrity`). La consola web ofrece un fragmento de código que la fija.
- **Base de datos.** `RWD_DATABASE_URL=postgres://…` (o `postgresql://`) selecciona Postgres; si no, `RWD_DATA` (por defecto `rwd.db`) es un archivo SQLite. El esquema se crea y se migra al arrancar.
- **Límites de frecuencia.** Inicio de sesión en la consola web y aceptación de invitaciones: 10 por minuto por IP de cliente. Conexiones de páginas y llamadas de presencia: 120 por minuto por IP de cliente. Las IP de cliente se toman de `X-Forwarded-For` solo con `--trust-proxy`; el mismo interruptor rige `X-Forwarded-Proto` y `X-Forwarded-Host`, que deciden si la cookie de sesión es `Secure` y el esquema y el host del `gatewayUrl` deducido cuando no se define `--public-url`.
- **Retención de la auditoría.** `RWD_AUDIT_RETENTION_DAYS` (por defecto 180); los eventos antiguos se purgan cada 6 horas.

Todos los ajustes del gateway están en [gateway/README.es.md](../gateway/README.es.md).

## 17. DevTools para personas

Los miembros `owner` o `admin` pueden abrir **Chrome DevTools** sobre cualquier página en línea de un dispositivo desde la consola web: Elements (estilos, modelo de caja, resaltado en el dispositivo), Console (en vivo, con inspección de objetos y ejecución de scripts), Network (con los cuerpos de las respuestas) y el almacenamiento de Application. Es el frontend real de DevTools, tal como lo compila [chii](https://github.com/liriliri/chii); el backend es el chobitsu completo que ya lleva el SDK de página, y el gateway retransmite los mensajes CDP.

```
Console /devices/:id/devtools
  └─ iframe /devtools/chii_app.html?ws(s)=<host>/v1/devtools?ticket=…   ← DevTools frontend
        │ CDP (WebSocket)
        ▼
Gateway /v1/devtools ──{"t":"cdp","s","m"}──▶ page WebSocket ──▶ SDK: one session per window ──▶ chobitsu
```

### 17.1 Abrir una ventana

1. La consola web llama a `POST /v1/api/devices/:id/devtools` con `{"page":"p1"}` (si se omite: la página que está mirando el usuario). Solo para `owner` y `admin`.
2. El gateway combina las políticas de los proyectos cuyas páginas están abiertas en el dispositivo; si alguna tiene `devtools: "off"`, la solicitud se rechaza. Si el `approval` combinado es `prompt`, el gateway envía a la página en primer plano un `attach_request` con `"purpose":"devtools"`, `levels: ["advanced"]` y el nombre del miembro como `agent.name`, y espera la respuesta (30 segundos; la petición HTTP también espera). El permitir automáticamente del SDK no se aplica aquí. Con `nativeApproval`, `status().pending.purpose` es `"devtools"` ([§7](#7-aprobación-de-la-vinculación)).
3. Una aprobación dura `policy.attachMaxMinutes` para ese miembro en ese dispositivo, así que una recarga o una navegación se reconecta sin preguntar otra vez. Que el usuario toque **Finalizar** en el dispositivo, o que un miembro de la consola web termine la sesión (`POST /devices/:id/end`), cierra todas las ventanas y retira las aprobaciones.
4. La respuesta es `{"ticket","session","page":Page,"frontendUrl"}`. `ticket` es de un solo uso y vale un minuto; `session` es el id que tendrá la ventana en `Device.devtools`.
5. El frontend se conecta a `WS /v1/devtools?ticket=…`. Solo puede conectarse el propio origen de la consola web (el host de `--public-url` cuando está definido).

Códigos de error: `device_offline`, `no_page` (la página desapareció o se está reconectando), `busy` (el dispositivo está esperando a que el usuario responda a otra solicitud), `timeout`, `denied` (403) y `forbidden` (403, desactivado por la política).

### 17.2 Mensajes de la página

```jsonc
← {"t":"devtools","s":"<session>","on":true,"by":"Ann"}   // se abrió una ventana
← {"t":"devtools","s":"<session>","on":false}              // la ventana se cerró
← {"t":"cdp","s":"<session>","m":"<CDP command, JSON text>"}
→ {"t":"cdp","s":"<session>","m":"<CDP answer, JSON text>"} // de vuelta a la ventana que preguntó
→ {"t":"cdp","m":"<CDP event, JSON text>"}                  // a todas las ventanas de esta página
```

- Una ventana pertenece a una sola conexión de página. Cuando la página se desconecta (recarga, navegación, cierre) el gateway cierra sus ventanas con el código **4100**; la consola web las vuelve a abrir con un ticket nuevo en cuanto la página regresa (la aprobación sigue valiendo, así que no se vuelve a preguntar al usuario). Terminar la sesión las cierra con **4403**; un frontend que no da abasto (una grabación de pantalla en una conexión lenta) se cierra con **1013**.
- Los mensajes CDP hacia la página tienen su propia cola: una ráfaga de comandos del frontend frena a ese frontend en vez de hacer que la página se descarte como consumidor lento, así que las RPC de los agentes no se ven afectadas.
- En el SDK, las ventanas comparten un único chobitsu y los ids de comando se reescriben por ventana. `Runtime.enable` y `Network.enable` los responde el SDK, que recoge ambos desde que carga la página para los agentes, junto con lo que pasó antes de que se abriera la ventana: mensajes de console (texto enmascarado; los objetos no se pueden expandir) y peticiones recientes (cuerpos de respuesta mientras sigan en caché). El `*.disable` de ninguna ventana tiene efecto; cuando se cierra la última ventana, el SDK oculta el resaltado, detiene la grabación de pantalla y libera los objetos que guardaba para las ventanas.
- Mientras una ventana está abierta, la barra inferior de la página muestra que un desarrollador está depurando, con los nombres de los miembros y un botón **Finalizar**.

### 17.3 Estado y auditoría

- `Device.devtools` lista las ventanas abiertas; `Page.connected` y `Page.connectedSince` le dicen a la consola web cuándo volver a abrir una ventana; `Device.pending.purpose` marca una solicitud de DevTools ([§12.8](#128-tipos)).
- Tipo de línea de tiempo `devtools`: solicitudes, aprobaciones y denegaciones, ventanas abiertas y cerradas, aprobaciones retiradas ([§12.9](#129-eventos-de-la-línea-de-tiempo)).
- Acciones de auditoría `devtools.request`, `devtools.approve`, `devtools.deny`, `devtools.timeout`, `devtools.open`, `devtools.close` ([§12.7](#127-registro-de-auditoría)).
- Privacidad: DevTools ve la página tal cual está, y **el enmascaramiento no se aplica**. Por eso está limitado a `owner` y `admin`, se puede desactivar por proyecto, pregunta al usuario en el dispositivo y queda auditado.

### 17.4 Frontend

El frontend es `public/front_end` del paquete de npm `chii` en una versión fijada, comprobado contra su sha512, y se copia a `console/dist/devtools/` cuando se compila la consola web ([`console/scripts/devtools-frontend.mjs`](../console/scripts/devtools-frontend.mjs)). El gateway lo integra comprimido con gzip (unos 3,4 MB) y lo sirve con `Content-Encoding: gzip`; las respuestas bajo `/devtools/` llevan `X-Frame-Options: SAMEORIGIN`.
