<!-- i18n-source: 8b96028b6553c0ce9fc8b5176a6a613bdaa1228f -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# SDK de página de RWD (`sdk/`)

Un único archivo JS que carga una WebView de app o una página H5 para que un agente de IA pueda inspeccionar y manejar la página a través del gateway de RWD (`gateway/`) y MCP. Protocolo: [`docs/protocol.es.md`](../docs/protocol.es.md); arquitectura: [`docs/architecture.es.md`](../docs/architecture.es.md).

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // opcional
    deviceId: "…",               // opcional; lo pasa un host nativo que inyecta el SDK
    helpButton: true,            // opcional; muestra el botón "Pedir ayuda"
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // opcional; una etiqueta de idioma, por defecto según los idiomas del navegador
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## Cómo obtener el SDK

Publicado en npm como [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger); versiones y cambios: [CHANGELOG](CHANGELOG.md).

| Uso | Dónde |
|---|---|
| `<script>` desde un CDN | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js` o `https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js` (IIFE minificado, global `RemoteWebviewDebugger`; fija la versión y, si quieres, añade `integrity`) |
| Un bundler | `npm install remote-webview-debugger` y luego `import { run, status } from 'remote-webview-debugger'` (módulo ES con tipos). Impórtalo antes que tu propio código para que la captura empiece pronto. No cargues además la versión `<script>` en la misma página |
| Tu gateway | `https://<gateway>/v1/sdk.js`, la copia que integra el gateway (también disponible en una URL direccionada por contenido para SRI, que ofrece la consola web) |
| Una app nativa | Empaqueta `dist/sdk.js` del paquete o descárgalo de uno de los anteriores; consulta [integración nativa](../docs/native-integration.es.md) |

## API

| API | Descripción |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | Pone la página en línea (código de dispositivo, píldora). Devuelve `Promise<{deviceCode, status}>`; llamarla de nuevo no tiene efectos negativos. Opciones más abajo. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`; `status` es `idle / connecting / online / polling / stopped / rejected / quota`, `lang` es el idioma de la interfaz (`null` antes de `run()`), `logSession` es el registro de sesión en el que escribe esta página (`null` cuando no está grabando) |
| `stop()` | Desconecta y quita la interfaz (la recogida de console / red continúa, de forma acotada) |
| `setUser(userId)` | Cambia el usuario; vuelve a conectar una vez con un `hello` nuevo |
| `help(on)` | Pedir ayuda / cancelar |
| `nativeControl(nativeKey, action)` | «Tomar control» / «Devolver» / «Finalizar» desde la propia interfaz del host nativo |
| `nativeDecide(nativeKey, requestId, value)` | Con `nativeApproval`, responde a `status().pending`: un nivel o `null` para una solicitud de conexión, `'allow'` o `null` para una confirmación de acción sensible |
| `setLang(lang?)` | Cambia el idioma de la interfaz en tiempo de ejecución (el ajuste de idioma propio de una app); sin argumento vuelve a los idiomas del navegador. Consulta [Idiomas](#idiomas) |
| `registerLocale(pack)` | Añade un paquete de idioma o reemplaza el que tenga el mismo `id` (también acepta un array). Consulta [Idiomas](#idiomas) |
| `builtinLocales` | Los ids de los paquetes integrados |

Opciones de `run()`:

| Opción | Descripción |
|---|---|
| `userId` | El usuario con sesión iniciada, enviado con el `hello` |
| `deviceId` | Un id de dispositivo estable proporcionado por un host nativo (si no, se guarda uno en localStorage) |
| `helpButton` | Muestra el botón "Pedir ayuda" (combinado con OR con la política del proyecto) |
| `app` | `{ name, version }` de la app anfitriona |
| `lang` | Idioma de todo lo que ve el usuario del teléfono (píldora, ventana flotante, barra inferior, diálogos, avisos, la pestaña de eruda y la descripción "La IA quiere …" de una acción sensible): una etiqueta de idioma como `'ja'` o `'pt-BR'`. Por defecto: los idiomas del navegador. Consulta [Idiomas](#idiomas) |
| `locales` | Paquetes de idioma adicionales, registrados antes de elegir el idioma (como `registerLocale`) |
| `messages` | Mensajes que se sobrescriben, por idioma: `{ en: { ui: { help: 'Contact support' } }, zh: { ui: { help: '联系客服' } } }` |
| `networkExclude` | Solicitudes con las que el agente no debería tener que lidiar, como fuentes que siempre dan 404 o balizas de analítica: `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. Cada regla coincide con la URL como subcadena sin distinguir mayúsculas y minúsculas, como patrón con comodín `*` o como expresión regular cuando se escribe `/…/`. Se suman a las reglas de la política del proyecto. Las solicitudes que coinciden quedan fuera de la lista de red y de los eventos `net_fail` de la línea de tiempo; la página las sigue registrando, así que un agente puede pedirlas con `includeExcluded` |
| `lockScreen` | `false`: no bloquea la página mientras hay un agente conectado (el usuario puede cambiarlo igualmente en la ventana flotante). Por defecto `true` |
| `theme` | `'auto'` (por defecto, sigue el fondo de la página), `'system'`, `'light'` o `'dark'` |
| `style` | Colores, fuentes, radios, z-index y posiciones de la interfaz: `{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`. Consulta [Estilos](#estilos) |
| `eruda` | `true` o `{ dock, load, src, name }`: muestra Remote Debugger como pestaña dentro de eruda; `load` carga la última versión de eruda cuando la página no tiene ninguna. Desactivado por defecto; la política del proyecto puede activarlo de forma remota, y las opciones locales prevalecen campo a campo |
| `record` | `false`: esta página no escribe registro de sesión (y no se borra nada de lo ya guardado). Por defecto `true`; la política del proyecto puede desactivar el registro para todas las páginas |
| `launchId` | A qué arranque de la app pertenece esta página, para que todas las WebViews de un mismo proceso de la app archiven su registro de sesión bajo una sola sesión. Un host nativo pasa aquí su propio id (o define `window.RWDLaunchId` como una cadena o una función que devuelva una); si no, el SDK deduce el arranque a partir de una cookie de sesión más un heartbeat |
| `nativeKey`, `deviceToken`, `nativeApproval` | Para hosts nativos: el secreto para `nativeControl` / `nativeDecide`, el token de dispositivo que guarda el host y la opción de hacer las preguntas de conexión / confirmación de forma nativa |

## Idiomas

Integrados: inglés (`en`), chino simplificado (`zh`), chino tradicional (`zh-TW`, que también se usa para `zh-HK`, `zh-MO` y `zh-Hant`), francés (`fr`), español (`es`), ruso (`ru`), árabe (`ar`, con diseño de derecha a izquierda), japonés (`ja`), coreano (`ko`), alemán (`de`) y portugués (`pt`, de Brasil; también se usa para `pt-PT`).

**Cómo se elige el idioma.** El idioma del usuario del teléfono es `run({ lang })` si se indica y, si no, cada uno de los `navigator.languages` por orden. Para cada etiqueta, el SDK prueba la etiqueta y luego sus formas más cortas (`pt-BR` → `pt`, `zh-HK` → `zh-TW` → `zh`), se queda con el primer idioma para el que tiene paquete y, si no hay ninguno, usa el inglés. Los mensajes que faltan en un paquete recurren a los idiomas alternativos de la misma forma, así que un paquete parcial no es problema. `setLang('ja')` cambia el idioma en tiempo de ejecución; `status().lang` es el paquete en uso.

**Carga.** El inglés y el chino simplificado van dentro de `sdk.js`. Los demás paquetes se cargan bajo demanda, la primera vez que una página los necesita (durante ese instante, la interfaz muestra el idioma alternativo):

- Versión `<script>`: desde `locales/<id>.js` junto a `sdk.js` (la ruta del CDN, p. ej. `…/remote-webview-debugger@0.1.0/dist/locales/ja.js`, o `/v1/locales/ja.js` de tu gateway) y, si eso falla, desde el gateway que se pasa a `run()`. Para evitar la solicitud adicional, carga tú mismo el paquete, antes o después de `sdk.js`: `<script src="…/dist/locales/ja.js"></script>`.
- Versión de módulo ES: un import dinámico, así que tu bundler pone cada idioma en su propio chunk. Para empaquetar uno desde el principio: `import ja from 'remote-webview-debugger/locales/ja'` y luego `run(url, key, { locales: [ja] })`.

**Tus propios paquetes y textos.** Un paquete es `{ id, name, dir?, ui?, action?, agent? }`; lo que falte se toma de sus idiomas alternativos:

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Chiedi aiuto' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { en: { ui: { help: 'Contact support' } } }, // cambia mensajes sueltos de cualquier idioma
})
```

`ui` es el texto de la interfaz, `action` completa "La IA quiere …" en el diálogo de confirmación y `agent` es lo que vuelve al agente. Los tipos de TypeScript (`LocalePack`, `Messages`, `UiMessages`, `ActionMessages`, `AgentMessages`) enumeran todas las claves; `src/locales/en.ts` es la referencia.

**Dos públicos.** El usuario del teléfono recibe el idioma descrito arriba. El agente lee los mensajes de error de RPC y los resúmenes de la línea de tiempo (toques, navegación dentro de la página, solicitudes fallidas) en el idioma del gateway, `welcome.agentLang` (`RWD_LANG`), y ese paquete se carga de la misma forma. En inglés hasta que un welcome diga otra cosa; el último valor se guarda en localStorage `rwd:alang`, así que los eventos anteriores al welcome de la siguiente página también lo usan.

Así, un usuario que habla chino puede trabajar con un agente que habla inglés: el diálogo pregunta `AI 想要点击「提交订单」，允许吗？` y, si se rechaza, el agente lee `The user denied this action`.

## Estilos

La interfaz vive en un shadow root sobre `#__rwd` (fuera de `<body>`), así que el CSS de la página no la alcanza salvo a través de estos puntos de enganche:

- **Propiedades personalizadas de CSS** en `:root` o `#__rwd`, p. ej. `:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`.
- **`run({ style })`**, que fija esas mismas propiedades en `#__rwd`. Ahí los colores aceptan cualquier color CSS.
- **`::part()`** para todo lo demás: `#__rwd::part(bar) { … }`. Partes: `pill`, `window`, `bar`, `task`, `dialog`, `toast`, `button`, `cursor`, `glow`, `overlay`. Los nombres de clase internos no son una API estable.
- **`theme`**: cristal claro u oscuro (por defecto: sigue el fondo de la página).

| Propiedad | Campo de `style` | Por defecto | Qué |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | Botones, interruptores, el puntero del agente, los resaltados y el brillo de los bordes |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | El botón «Finalizar» |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | «Pedir ayuda»; el estado en que el usuario tiene el control |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | Punto de en línea; "copiado" |
| `--rwd-font` | `font` | fuente de interfaz del sistema (por idioma para chino, japonés y coreano) | Todo el texto |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | Código de dispositivo y etiquetas |
| `--rwd-radius` | `radius` | `18px` | Ventana flotante; el diálogo es 2px más redondeado, la tarjeta de tarea y la píldora 2px menos, y los botones del diálogo 6px menos |
| `--rwd-button-radius` | `buttonRadius` | `999px` | Botones, la barra inferior y los avisos |
| `--rwd-z-index` | `zIndex` | `2147483647` | Toda la interfaz |
| `--rwd-bar-bottom` | `barBottom` | `14px` | Barra inferior, por encima del área segura inferior |
| `--rwd-task-top` | `taskTop` | `10px` | Tarjeta de tarea, por debajo del área segura superior |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | Avisos, por encima del área segura inferior |
| — | `pill: { side, top }` | borde derecho (izquierdo en idiomas de derecha a izquierda), `0.62` | Dónde empieza la píldora en reposo hasta que el usuario la arrastra; `top` de 0 (arriba) a 1 (abajo) |

Los colores son tripletes `r, g, b` para que los tonos translúcidos los sigan (la misma convención que `--bs-*-rgb` de Bootstrap).

## Comportamiento en la página (protocolo §6–§8, §11)

- Niveles: las RPC se comprueban contra `welcome.level` / `control.level` (`forbidden`, "Requires the … level"). Un agente sin nivel (un gateway antiguo) recibe `interact`; sin ningún agente conectado no se impone nada adicional.
- El token de dispositivo se guarda en localStorage `rwd:dtoken` y el token de reanudación en sessionStorage `rwd:resume` (ligado al pageId). Código de cierre 4401: si el token cambió entretanto (otra pestaña del dispositivo acaba de recibirlo), reintenta una vez de inmediato; si no, `rejected` y reintenta al cabo de unos 10 minutos; 4409: vuelve a conectar con un pageId nuevo; 4429: `quota`, reintenta al cabo de unos 5 minutos.
- `rwd_invite` en la barra de direcciones se retira en `run()` (`history.replaceState`) y se envía con el hello hasta que llega un welcome.
- `welcome.config`: `helpButton` (combinado con OR con la opción de `run()`), `maskSelectors`, `maskPatterns` (instantánea, console, URLs de red, valores de almacenamiento, resúmenes de la línea de tiempo), `confirmSelectors`, `networkExclude` (se suma a las reglas de la opción de `run()`), `sessionLog`. La última configuración se guarda en localStorage `rwd:cfg` y se usa hasta que llega el welcome; así, un proyecto que desactivó el registro de sesión lo mantiene desactivado desde el primer momento de la siguiente página, antes de cualquier welcome.
- Las instantáneas terminan con una sección `[Overlays]` que enumera lo que flota sobre la página (el fondo de una ventana emergente, un modal, una hoja inferior) con su etiqueta, un fragmento corto de texto, cuánto del viewport cubre y una ref. Un fondo es un elemento vacío para el que el aria snapshot no tiene nodo, así que recibe una ref `oN` en lugar de `eN`; eso es lo que permite al agente tocarlo para cerrar la ventana emergente.
- Un clic apunta primero al centro visible del elemento y luego a los demás puntos de una cuadrícula de 3×3 dentro de él, para que una insignia encima de un botón no lo bloquee. Cuando todos los puntos están tapados, la RPC falla con `not_interactable` e indica el elemento que lo tapa y su ref.
- Los diálogos de conexión y de acciones sensibles (`[data-rwd-confirm]`, `confirmSelectors`, incluido el envío de un formulario con Enter) viven en un Shadow DOM, solo aceptan toques de confianza y se activan 0,4 s después de aparecer. Las pestañas del mismo origen comparten por BroadcastChannel las solicitudes de conexión ya decididas.

Cargar el archivo empieza a recoger la console, los errores no capturados y la red (XHR, fetch, WebSocket, sendBeacon, EventSource), con un máximo de 500 entradas de cada tipo; cuando se llena, se descartan primero los logs simples y las solicitudes correctas. Los cuerpos de las respuestas se guardan en caché hasta 5 MB en total, 64 KB cada uno. Por eso conviene cargarlo de forma síncrona y pronto en `<head>`.

## Registro de sesión (protocolo §5.4)

Esos búferes son la memoria de una sola página. En paralelo, el SDK escribe un **registro de sesión** en IndexedDB (`rwd-log`) en el dispositivo, para que un agente que se conecte después de un bug pueda seguir leyendo todo el camino hasta él:

- Una sesión es un arranque de la app, compartido por todas las páginas del origen: `run({ launchId })`; si no, `window.RWDLaunchId`; si no, se deduce de la cookie de sesión `rwd_launch` más un heartbeat (una sesión de cookie que lleva más de una hora en silencio cuenta como un arranque nuevo). `status().logSession` es el id en uso.
- Qué se graba: apertura de página / navegación dentro de la página / primer plano-segundo plano / salida, los toques del usuario, la entrada de texto, los envíos y las posiciones en las que se detiene el desplazamiento, las llamadas interactivas del agente y `rwd.evaluate`, los cambios de control, la console de todos los niveles y cada solicitud terminada (las fallidas, también con las cabeceras y los cuerpos ocultados, 64 KB cada uno). Funciona tanto si el gateway es accesible como si no. Los campos enmascarados se guardan como `••••`, y los `maskPatterns` se aplican al escribir los registros.
- Qué se conserva: los 3 últimos arranques, 10 MB cada uno; por encima de eso, se descartan primero los logs simples y las solicitudes correctas. Solo el arranque actual cuando la cuota de almacenamiento es inferior a 64 MB; nada en absoluto sin IndexedDB.
- El agente lo lee con `rwd.log` (`observe`) y `rwd.logDetail` (`advanced`, para cabeceras y cuerpos). Fuera de eso, nada sale del dispositivo.
- Se desactiva con `run({ record: false })` para una página, o con `policy.sessionLog: false` para el proyecto, lo que además borra lo que este origen ya había guardado.

## Estructura

- `src/index.ts`: API pública, sesión, despacho de RPC, estado de control.
- `src/transport.ts`: el WebSocket de la página (el constructor nativo), tiempo de espera del heartbeat, espera exponencial y, tras 3 intentos fallidos, `POST /v1/presence` cada 60 s.
- `src/ids.ts`: deviceId / pageId / openerId.
- `src/launch.ts`: a qué arranque de la app pertenece esta página (`launchId`, `window.RWDLaunchId`, la cookie `rwd_launch`).
- `src/pageWatch.ts`: mensajes `page` (url, título, visibilidad) y eventos de la línea de tiempo (navegación dentro de la página, toques del usuario).
- `src/ui.ts`, `src/lock.ts`: la píldora, el botón de ayuda, la capa de bloqueo, el brillo, el resaltado de acciones y los diálogos en un Shadow DOM; bloquea la entrada de confianza del usuario mientras hay un agente conectado y muestra cuánto tiempo lleva conectado.
- `src/approval.ts`: aprobación de conexión y confirmación de acciones sensibles (diálogo en la página, o el host nativo mediante `nativeDecide`).
- `src/i18n.ts`, `src/locales/`, `src/localeLoader*.ts`: paquetes de idioma (textos de interfaz, de acción y del agente por idioma), elección del idioma y alternativas, carga bajo demanda; `scripts/locales.mjs` genera `dist/locales/<id>.js`.
- El motor del agente vive junto a chobitsu en `packages/chobitsu/src/engine/rwd/`: instantánea, `rwd.query`, comprobaciones de accionabilidad, entrada sintetizada, teclado, búferes de console / red, capturas de pantalla, `rwd.storage`, el registro de sesión en IndexedDB (`coldlog.ts`), detección de capas superpuestas (`overlays.ts`), niveles y reglas de confirmación (`policy.ts`) y textos dirigidos al agente (`i18n.ts`). Las fuentes de Playwright usadas para las instantáneas están en `packages/chobitsu/src/engine/vendor/playwright/`. La compilación las empaqueta desde el código fuente en `dist/sdk.js`.

## Compilación y tests

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE, global RemoteWebviewDebugger, ES2017), dist/index.mjs + index.d.ts (módulo ES)
npm run typecheck
npm test             # Playwright: WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # gateway simulado local: http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

Los tests usan `test/mock-gateway.mjs`, que implementa el lado de la página del protocolo (welcome, estado de control, RPC, presencia; tokens, códigos de cierre, niveles, configuración remota, `agentLang`, aprobación de conexión) y sirve `/v1/sdk.js`, los paquetes de idioma bajo `/v1/locales/` y la tienda de demostración. No comprueba los niveles por sí mismo, así que los tests ejercitan la aplicación de niveles de la propia página. Las specs de `test/e2e/` se ejecutan con un navegador en `zh-CN` y `agentLang: 'zh'` salvo que un test indique otra cosa; `i18n.spec.ts` cubre el inglés, y `locales.spec.ts`, los demás paquetes de idioma, las alternativas, los paquetes personalizados, los estilos y el diseño de derecha a izquierda. El test de coexistencia carga eruda 3.4.3 y PageSpy 2.4.0 desde jsdelivr, así que necesita acceso a internet.
