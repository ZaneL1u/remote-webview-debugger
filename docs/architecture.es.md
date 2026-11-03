<!-- i18n-source: f1c156537ee729acb5ad4a7266a240554b3452f4 -->
[English](architecture.md) | [简体中文](architecture.zh-CN.md) | [繁體中文](architecture.zh-TW.md) | [日本語](architecture.ja.md) | [한국어](architecture.ko.md) | Español | [Français](architecture.fr.md) | [Deutsch](architecture.de.md) | [Português (Brasil)](architecture.pt-BR.md) | [Русский](architecture.ru.md) | [العربية](architecture.ar.md)

# Arquitectura

Remote WebView Debugger permite que un agente de IA inspeccione y maneje una página web abierta en el teléfono de otra persona: una página H5 en un navegador móvil o en una superapp, o una WebView dentro de tu propia app. El agente habla MCP con un gateway autoalojado; el gateway habla con un pequeño SDK que se ejecuta dentro de la página. El usuario del teléfono aprueba la conexión, ve lo que hace el agente y puede tomar el control en cualquier momento.

Este documento explica las piezas y las reglas que siguen. Los mensajes y endpoints exactos están en [protocol.es.md](protocol.es.md); la integración en apps, en [native-integration.es.md](native-integration.es.md); el despliegue, en [gateway/README.es.md](../gateway/README.es.md) y [deploy/platform/README.es.md](../deploy/platform/README.es.md).

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

| Componente | Ruta | Función |
|---|---|---|
| Gateway | [`gateway/`](../gateway) | Servidor en Go. Acepta las conexiones de las páginas, mantiene en memoria el estado en vivo de los dispositivos, sirve el endpoint MCP alojado, la API REST de la consola web y sus actualizaciones en vivo, y escribe el registro de auditoría. Integra la consola web y el SDK, así que un solo binario es todo el servidor |
| SDK de página | [`sdk/`](../sdk) | `sdk.js`, que carga la página o inyecta la app. Se encarga de la conexión, la identidad, la interfaz dentro de la página, los diálogos de consentimiento y el bloqueo de pantalla |
| Motor | [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine) | La mitad del lado de la página de cada acción del agente: instantáneas de accesibilidad (el código de aria snapshot de Playwright) y las capas que flotan sobre ellas, comprobaciones de accionabilidad y entrada sintética, captura de console y de red (basada en [chobitsu](https://github.com/liriliri/chobitsu)), capturas de pantalla, enmascaramiento y comprobación de niveles |
| Consola web | [`console/`](../console) | Aplicación de una sola página en React: proyectos y fragmentos de integración, dispositivos y sus líneas de tiempo, claves de API, miembros, políticas, invitaciones, registro de auditoría |
| Host nativo | tu app; referencia en [`examples/mock-app`](../examples/mock-app) | Inyecta el SDK en cada WebView al inicio del documento, guarda el id y el token del dispositivo, proporciona capturas de pantalla reales y, opcionalmente, diálogos de aprobación y botones nativos |

## Una sesión de depuración

1. **La página se pone en línea.** La página carga `sdk.js` (o la app lo inyecta). La captura de console, errores y red empieza de inmediato, en búferes acotados, de modo que un agente que se conecte más tarde sigue viendo lo que pasó antes. `run()` abre un WebSocket con el gateway y envía `hello`; el gateway responde con el **código de dispositivo** (p. ej. `K7Q2-9M4X`) y la configuración remota del proyecto. La píldora de la página muestra el código.
2. **Alguien dirige el agente al dispositivo.** El usuario lee en voz alta el código de dispositivo, toca **Solicitar asistencia** (el dispositivo aparece el primero en todas las listas) o abre un **enlace de invitación** del equipo de soporte, que pone el dispositivo en línea con la asistencia ya solicitada.
3. **El agente se conecta.** Llama a `connect_device` con el código. Salvo que el proyecto diga lo contrario, el usuario ve en el teléfono *La IA quiere unirse* y elige un nivel (solo ver, ver e interactuar, avanzado) o lo rechaza. Antes de eso no se puede leer nada. Una vez dentro el agente, la pantalla se bloquea frente a la entrada del usuario, los bordes se iluminan y la barra inferior cuenta cuánto tiempo lleva conectado.
4. **El agente trabaja.** Toma una instantánea para obtener las refs de los elementos y luego hace clic, rellena y se desplaza por ref. La instantánea también enumera las ventanas emergentes y los fondos (backdrops) que flotan sobre la página, cada uno con su ref, y un clic que una capa bloquea falla con el nombre y la ref de lo que lo bloqueó; así el agente puede tocar un fondo para cerrar su ventana emergente en lugar de adivinar. Su primera acción pasa el dispositivo de *observe* a *agent*, y un cursor del agente muestra dónde actúa. Según su nivel, también puede leer la console, la red, el almacenamiento y capturas de pantalla.
5. **El usuario sigue al mando.** **Tomar control** devuelve la página al usuario y pausa al agente (sus acciones fallan con `takeover` hasta que el usuario toca **Devolver**). **Finalizar** desconecta al agente. Los clics en elementos marcados como sensibles (hacer un pedido, pagar, borrar) necesitan el visto bueno del usuario en el teléfono.
6. **El agente se va** con `disconnect_device`; tras dos minutos sin acciones el dispositivo vuelve a *observe*, y al cumplirse el tiempo máximo de conexión del proyecto (60 minutos por defecto) el agente queda desconectado.

Una acción, de principio a fin:

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

Cada acción es un único viaje de ida y vuelta: las comprobaciones de accionabilidad y el envío de eventos se ejecutan dentro de la página, no a través de la red.

## Dispositivos, páginas y agentes

**Dispositivo.** Un `deviceId`: un perfil de navegador, o una instalación de la app cuando un host nativo pasa su propio id. El gateway asigna a cada dispositivo un código de dispositivo permanente. Los dispositivos no están ligados a proyectos: un teléfono que abre páginas de dos proyectos (dos claves de app) es un solo dispositivo con páginas de ambos. Las claves de API tampoco están ligadas a proyectos, así que un solo servidor MCP llega a todos los dispositivos.

**Página.** Una pestaña o WebView, identificada por un `pageId` que sobrevive a recargas y navegaciones en esa pestaña. El gateway etiqueta las páginas como `p1`, `p2`, … por dispositivo, registra quién abrió a quién y sabe qué página está en primer plano. Una página que se desconecta conserva su etiqueta durante dos minutos, tiempo suficiente para que una navegación vuelva a conectar, pero no cuando el mismo documento aparece en otro sitio: una WebView recreada con un `pageId` nuevo sustituye de inmediato a la entrada anterior, y una página desconectada cuya URL muestra también otra página conectada se descarta a los 1,5 s. Así, una WebView recreada no deja un fantasma en la lista de páginas, y el agente pasa a la página que de verdad está ahí.

**Línea de tiempo.** Cada dispositivo tiene una línea de tiempo (en memoria, los últimos 300 eventos): páginas abiertas, navegadas, recargadas, enfocadas y cerradas; errores, solicitudes fallidas y toques del usuario; solicitudes de asistencia, aprobaciones y cambios de control. Cada resultado de una herramienta MCP termina con las entradas de la línea de tiempo que el agente aún no ha visto, así que se entera de nuevas páginas, errores y tomas de control sin hacer sondeo. En el **modo de seguimiento** (el predeterminado), la página seleccionada del agente pasa a la página que abrió su acción, o a la página a la que cambió el usuario.

**Agente.** El gateway mantiene un estado de agente por clave de API: el dispositivo al que está conectado y su página seleccionada. Un agente está conectado a un solo dispositivo a la vez, y un dispositivo tiene como máximo un agente; un agente recién aprobado sustituye al anterior.

**Estado de control.** Cada dispositivo está en uno de cuatro estados, que decide el gateway y difunde a todas sus páginas:

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

En `observe` y `agent` la entrada del usuario está bloqueada (el usuario puede quitar el bloqueo en la ventana flotante); en `user` el agente todavía puede leer, pero toda llamada interactiva falla con `takeover`, y el agente puede llamar a `wait_for_control` para esperar a que le devuelvan el control.

## Consentimiento y privacidad

La regla de fondo: **tener una clave de API o conocer un código de dispositivo nunca basta para ver la página de un usuario.** Entre el agente y la página hay varias comprobaciones independientes.

| Capa | Qué hace |
|---|---|
| Clave de API | Cada solicitud MCP lleva una. Las claves tienen un nivel máximo, una caducidad (90 días por defecto) y una lista de IP permitidas opcional; revocar una desconecta a su agente de inmediato. Las búsquedas de dispositivos fallidas tienen límite de frecuencia, para que no se puedan adivinar los códigos de dispositivo |
| Código de dispositivo | Solo *identifica* un dispositivo. No concede nada |
| Política del proyecto | `approval: prompt` (el valor por defecto de los proyectos nuevos) exige la aprobación del usuario; `maxLevel` limita lo que puede hacer cualquier agente. Cuando un dispositivo tiene páginas de varios proyectos, se aplica la política más estricta |
| Aprobación del usuario | El teléfono muestra el nombre del agente, la pista de su clave y los niveles disponibles; el usuario elige uno o lo rechaza. El diálogo vive en un Shadow DOM y solo reacciona a toques reales (de confianza), así que un agente no puede aprobarse a sí mismo. Tres rechazos bloquean esa clave en ese dispositivo durante 10 minutos. Los usuarios pueden activar permitir automáticamente en su propio dispositivo. Un agente que soltó el dispositivo por su cuenta (desconexión, cambio de dispositivo, tiempo de conexión agotado) puede volver en un plazo de 10 minutos sin un diálogo nuevo, con un nivel no superior al que el usuario concedió antes; esto se anula si el usuario toca **Finalizar**, si un miembro de la consola web termina la sesión, si hay un rechazo o si se revoca la clave |
| Niveles | `observe` (instantánea, captura de pantalla, console, lista de red), `interact` (+ clic, escribir, desplazarse, navegar…), `advanced` (+ ejecutar JavaScript, cuerpos de solicitudes, almacenamiento). El nivel efectivo es el mínimo entre lo que pidió el agente, la clave, la política y la elección del usuario. **El SDK lo vuelve a aplicar dentro de la página**, con independencia del gateway |
| Control visible | Mientras hay un agente conectado, la página lo muestra: una píldora con el estado del agente, una tarjeta de tarea con su plan, un cursor del agente y un resaltado en cada acción, y un borde luminoso mientras opera. Tomar control, Devolver y Finalizar solo responden a los toques del usuario; un host nativo debe presentar un secreto (`nativeKey`) que los scripts de la página, incluidos los del propio agente, no pueden leer |
| Acciones sensibles | Hacer clic en un elemento marcado con `data-rwd-confirm` (o que coincida con los `confirmSelectors` de la política), o enviar un formulario que contenga uno, espera el visto bueno del usuario en el teléfono |
| Enmascaramiento | Los campos de contraseña, los elementos `data-rwd-mask` y los selectores y patrones de texto de la política (teléfono, tarjeta, números de documento…) se sustituyen por `••••` **dentro de la página**, antes de que nada salga del dispositivo: en instantáneas, capturas de pantalla, texto de la console, URLs y cuerpos de red, valores de almacenamiento y resúmenes de la línea de tiempo. Las cabeceras `Cookie`, `Set-Cookie` y `Authorization` se ocultan siempre. Las reglas `networkExclude` de la política son otra cosa: solo quitan ruido (fuentes que siempre dan 404, balizas de analítica) de las listas que lee el agente, y el agente puede pedir las solicitudes ocultas, así que no son un control de privacidad |
| Contenido no confiable | El contenido de la página que se entrega al agente va envuelto y etiquetado como datos no confiables, para que las instrucciones plantadas en una página no se confundan con las del usuario. Los clics de alto riesgo dependen de la confirmación del usuario, no del criterio del agente |
| Registro de sesión | Se graba en el dispositivo y nunca se transmite a ningún sitio: leerlo requiere `observe` como cualquier otra lectura, y las cabeceras y los cuerpos de las solicitudes fallidas requieren `advanced`. Las reglas de enmascaramiento se aplican al grabar, así que el valor de un campo enmascarado se guarda como `••••`, no se enmascara después. Un proyecto puede desactivar el registro y hacer que se borre lo guardado |
| Auditoría | Inicios de sesión, cambios de claves y de miembros, solicitudes de conexión y sus decisiones, cada RPC (método, página, latencia, resultado), las tomas de control y finalizaciones del usuario, y las llamadas rechazadas. Nunca el contenido de las páginas ni los valores de los parámetros |

Qué sale del teléfono: los metadatos del dispositivo en `hello` (user agent, `userId` si la página lo proporciona, nombre y versión de la app, URLs y títulos de las páginas) y breves resúmenes de la línea de tiempo, desde el momento en que se llama a `run()`; todo lo demás, solo cuando un agente conectado lo pide. El gateway no guarda el contenido de las páginas: las instantáneas, las capturas de pantalla y los logs pasan directamente al agente, y las líneas de tiempo viven en memoria. El registro de sesión se graba en el dispositivo, con las mismas reglas de enmascaramiento, y se queda allí hasta que un agente conectado lo lee (consulta **Almacenamiento** más abajo).

Límites conocidos que conviene decir claramente:

- La entrada es sintética: los eventos tienen `isTrusted: false`, y las páginas que lo comprueban no reaccionarán.
- `interact` permite al agente navegar a cualquier URL `http(s)`; no está limitado a los orígenes del proyecto.
- `advanced` ejecuta JavaScript arbitrario en la página. El enmascaramiento no puede aplicarse a lo que devuelva ese script, así que mantén `maxLevel` en `interact` salvo que lo necesites.
- La captura de red cubre las solicitudes que la página hace desde JavaScript después de cargar el SDK (fetch, XHR, WebSocket, sendBeacon, EventSource). No se ven las imágenes, los scripts, las hojas de estilo ni las solicitudes hechas desde código nativo. El contenido de los iframes no forma parte de las instantáneas.
- Cuando una app pasa a segundo plano, el sistema operativo pausa sus WebViews y el dispositivo queda fuera de línea hasta que vuelve.
- Los puntos de interrupción, la ejecución paso a paso, el profiling y las instantáneas del heap quedan fuera del alcance; para eso usa Safari Web Inspector o `chrome://inspect` con una WebView depurable.

## Almacenamiento

El gateway usa **SQLite** por defecto (Go puro, sin CGO; un archivo definido por `RWD_DATA`) o **Postgres** cuando `RWD_DATABASE_URL` es una URL `postgres://`. El esquema se crea y se migra al arrancar.

| Persistente (base de datos) | Solo en memoria (se pierde al reiniciar) |
|---|---|
| Proyectos y sus políticas, claves de app | Páginas conectadas y sus etiquetas |
| Miembros (contraseñas con PBKDF2-SHA256), invitaciones de miembros pendientes | Estado de control, aprobaciones pendientes, agentes conectados |
| Claves de API (hashes HMAC-SHA256, niveles, caducidad, listas de IP permitidas) | Líneas de tiempo de los dispositivos |
| Dispositivos conocidos: id, código, userId, user agent, app, primera y última vez visto, hash del token de dispositivo | Contadores del límite de frecuencia |
| Invitaciones de dispositivos (hashes de tokens), registro de auditoría | |
| Ajustes: el pepper de las claves y el secreto de firma de sesiones, generados en el primer arranque | |

Tras un reinicio, las páginas vuelven a conectarse solas (el SDK reintenta con espera exponencial) y conservan sus códigos de dispositivo; los agentes se conectan de nuevo. El estado en vivo reside en un solo proceso, así que ejecuta **una sola instancia del gateway** por base de datos.

**En el teléfono, no en el gateway.** Hay un almacén que queda deliberadamente fuera de todo esto: el **registro de sesión**, que el SDK de página escribe en IndexedDB en el dispositivo (base de datos `rwd-log`). Desde el arranque de la app graba las páginas visitadas, los toques y la entrada del usuario, las acciones del agente, los cambios de control, la salida de la console y cada solicitud (las fallidas, con sus cabeceras y cuerpos), tanto si el gateway es accesible como si no. Eso es lo que permite que un agente que se conecta *después* de un bug lea todo el camino hasta él, en lugar de empezar con un búfer vacío. Guarda los tres últimos arranques, hasta 10 MB cada uno, y nada de él llega al gateway ni a nadie más salvo que un agente conectado lo pida con `get_session_overview` / `get_session_log` ([protocol.es.md §5.4](protocol.es.md#54-registro-de-sesión)). Un proyecto puede desactivarlo (`policy.sessionLog`), lo que además borra lo ya guardado en sus dispositivos, y una página concreta puede excluirse con `run({ record: false })`.

## Notas de seguridad para operadores

- **Sírvelo por HTTPS.** Las páginas se conectan por `wss://`, la cookie de la consola web se marca como `Secure` en HTTPS y las claves de API viajan en cabeceras. La configuración de Docker Compose de [deploy/platform](../deploy/platform/README.es.md) termina TLS con Caddy o se coloca detrás de tu propio proxy.
- **Confía en las cabeceras reenviadas solo detrás de un proxy.** `--trust-proxy` hace que el gateway tome las IP de los clientes y su host público de `X-Forwarded-For` / `X-Forwarded-Host`. Sin un proxy delante, cualquiera podría falsificarlas y saltarse las listas de IP permitidas y los límites de frecuencia.
- **Protege la base de datos y sus copias de seguridad.** Contienen el pepper de las claves y el secreto de sesión; con ellos se pueden comprobar sin conexión los hashes de las claves de API y falsificar sesiones de la consola web.
- **La contraseña del propietario.** `RWD_ADMIN_PASSWORD` restablece la contraseña del propietario en cada arranque, lo que sirve también para recuperar la cuenta. Si no está definida en una base de datos nueva, se imprime una vez en el log una contraseña aleatoria.
- **Las claves de app son públicas.** Solo permiten que las páginas se pongan en línea. Usa `allowedOrigins` para impedir que otros sitios usen la tuya; ten en cuenta que `Origin` es una cabecera que impone el navegador y que los clientes que no son navegadores pueden enviar cualquier cosa, y por eso los dispositivos existentes se protegen con tokens de dispositivo (no con claves de app).
- **Trata las claves de API como contraseñas.** Da a cada agente o persona su propia clave, con el nivel más bajo que funcione, una caducidad y, para servidores, una lista de IP permitidas. La revocación es inmediata.
- **Fija la versión del SDK.** Para páginas H5, la consola web ofrece un fragmento que carga una URL del SDK direccionada por contenido con Subresource Integrity. Las apps nativas pueden empaquetar `sdk.js` en lugar de descargarlo en tiempo de ejecución, de modo que un gateway comprometido no pueda enviarles código nuevo.
- **Protege las métricas.** Define `RWD_METRICS_TOKEN` si `/v1/metrics` es accesible desde fuera.
- El inicio de sesión en la consola web tiene límite de frecuencia (10 intentos por minuto por IP), las solicitudes de escritura requieren una cabecera CSRF personalizada y la consola web no se puede incrustar en un marco.
