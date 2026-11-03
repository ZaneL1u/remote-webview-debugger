<!-- i18n-source: 9d368db4a362be21a3c387a4cc6eee7935f0427d -->
<div align="center">

# Remote WebView Debugger

**Deja que tus agentes de IA depuren las WebViews de tu app y tus páginas H5 en los teléfonos de usuarios reales, de forma remota y a través de MCP.**

[debugger.site](https://debugger.site) · [Demo en vivo](https://debugger.site/#demo) · [Documentación](docs/architecture.es.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

[![CI](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaneL1u/remote-webview-debugger/actions/workflows/ci.yml)
[![SDK on npm](https://img.shields.io/npm/v/remote-webview-debugger?label=sdk&color=cb3837)](https://www.npmjs.com/package/remote-webview-debugger)
[![Gateway release](https://img.shields.io/github/v/release/ZaneL1u/remote-webview-debugger?filter=gateway-v*&label=gateway&color=2496ed)](https://github.com/ZaneL1u/remote-webview-debugger/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

Un bug que solo aparece en el teléfono de un usuario, dentro de una superapp al estilo de WeChat o de la WebView de tu propia app, es de lo más difícil de depurar: no hay cable USB, no hay puerto de depuración remota y no hay forma de reproducirlo en tu máquina. Remote WebView Debugger, en cambio, pone esa página delante de tu agente de IA.

- **Una etiqueta script** (o una inyección nativa) pone una página en línea. El usuario ve una pequeña píldora con un código de dispositivo y puede tocar *Pedir ayuda*.
- **Tu agente se conecta por MCP** (Claude Code, Cursor o cualquier cliente MCP) después de que el usuario lo apruebe en el dispositivo. Lee instantáneas de accesibilidad, la console, la red y capturas de pantalla, y hace clic, escribe y se desplaza como lo haría una persona, en todas las páginas y WebViews de ese dispositivo.
- **El usuario mantiene el control.** Ve lo que hace la IA (el cursor del agente, una tarjeta de tarea con los pasos previstos, un borde luminoso) y puede tomar el control o finalizar la sesión en cualquier momento. Las contraseñas y los números de teléfono y de tarjeta se enmascaran antes de que nada salga del teléfono.
- **Autoalojado.** Un único binario de Go con la consola web y el SDK integrados; SQLite o Postgres.

```
Claude Code / Cursor ──MCP (HTTPS)──▶ Gateway ──WebSocket──▶ SDK in the page ──▶ DOM · console · network
                                         ▲
                                   Web console
```

## Inicio rápido

Tres pasos: ejecuta el gateway, añade el SDK a una página y apunta tu agente al gateway.

### 1. Ejecuta el gateway

```bash
docker run -d --name rwd -p 8080:8080 -v rwd-data:/data \
  -e RWD_ADMIN_PASSWORD='change-me' \
  ghcr.io/zanel1u/remote-webview-debugger:latest
```

Abre `http://<your-host>:8080` e inicia sesión como **`admin`** con esa contraseña. Si omites `RWD_ADMIN_PASSWORD`, se genera una aleatoria que se imprime una sola vez en `docker logs rwd`. La imagen está basada en Alpine (linux/amd64 y linux/arm64), integra la consola web y el SDK, y guarda todo en el volumen `rwd-data`; para actualizar, haz `docker pull` de la nueva etiqueta y vuelve a crear el contenedor.

Ajustes que quizá quieras, pasados con `-e` ([todos los ajustes](gateway/README.es.md)):

| Variable | Para qué sirve |
|---|---|
| `RWD_ADMIN_EMAIL` | Nombre de inicio de sesión del propietario (por defecto `admin`) |
| `RWD_PUBLIC_URL` | La dirección que usan los teléfonos y los agentes, p. ej. `https://rwd.example.com/v1`, cuando difiere de la que ves en tu navegador |
| `RWD_LANG=zh` | Descripciones y resultados de las herramientas MCP en chino |
| `RWD_DATABASE_URL` | `postgres://…` para usar Postgres en lugar de SQLite |
| `RWD_TRUST_PROXY=1` | Solo detrás de tu propio proxy inverso: toma la IP y el esquema del cliente de `X-Forwarded-*` |

<details>
<summary>Otras formas de ejecutarlo: binarios, Docker Compose con HTTPS, desde el código fuente</summary>

- **Binario.** Cada versión del gateway en [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) incluye `rwd_<version>_<os>_<arch>.tar.gz` para Linux y macOS: descomprímelo y ejecuta `./rwd serve --addr :8080`.
- **Docker Compose.** [`deploy/platform`](deploy/platform/README.es.md) añade un Caddy por delante: detrás de tu propio proxy TLS, o sirviendo HTTPS él mismo con un certificado de Let's Encrypt (`RWD_DOMAIN=<host>`).
- **Desde el código fuente.** `make -j16` (necesita Go y Node) y luego `gateway/bin/rwd-<os>-<arch> serve --addr :8080`.

</details>

### 2. Pon una página en línea

Crea un proyecto en la consola web para obtener una clave de app y luego añade el SDK con la dirección de tu gateway:

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>RemoteWebviewDebugger.run('https://rwd.example.com/v1', 'rwd_pk_…')</script>
```

El SDK es el paquete de npm [`remote-webview-debugger`](sdk/README.es.md): cárgalo desde jsDelivr como arriba o desde unpkg (`https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js`), o haz `npm install remote-webview-debugger` e `import { run } from 'remote-webview-debugger'`. Tu gateway también sirve la copia que lleva integrada en `/v1/sdk.js`.

En una app, inyecta el mismo script al inicio del documento desde el código nativo (iOS `WKUserScript`, Android `addDocumentStartJavaScript`): consulta [integración nativa](docs/native-integration.es.md) y la guía integrada en la consola web.

### 3. Conecta tu agente

Crea una clave de API en la consola web (una sola clave llega a todos los dispositivos) y luego:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp --header "Authorization: Bearer rwd_sk_live_…"
```

…y pregunta: *"Conéctate al dispositivo K7Q2-9M4X y averigua por qué el total del pago muestra `--`."*

### ¿HTTP o HTTPS?

El gateway habla HTTP plano y funciona bien así: el SDK elige `ws://` o `wss://` según la dirección del gateway, y la consola web y MCP funcionan con cualquiera de los dos. Lo que decide es **la página que depuras**. Los navegadores y las WebViews no permiten que una página `https://` cargue scripts `http://` ni abra conexiones `ws://` (contenido mixto), aunque el propio `sdk.js` venga del CDN por HTTPS.

| La página que depuras | Gateway por HTTP plano |
|---|---|
| `http://`: servidor de desarrollo local, entorno de pruebas en la intranet | ✅ Funciona |
| `https://` en un navegador o en un `WKWebView` de iOS | ❌ Bloqueado como contenido mixto: dale HTTPS al gateway |
| `https://` en una WebView de Android | ⚠️ Solo si la app llama a `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`, y únicamente en compilaciones de depuración |

Por HTTP plano, las claves de API y las contraseñas de la consola web viajan sin cifrar, así que limítalo a una red de confianza. Para tener HTTPS, ejecuta el [stack de Compose](deploy/platform/README.es.md) con `RWD_DOMAIN=<host>` (certificado automático), o pon el contenedor detrás de tu propio proxy TLS y añade `-e RWD_TRUST_PROXY=1`.

## Características

- **Centrado en el dispositivo.** Un dispositivo (una instalación de la app o un navegador) tiene muchas páginas; una sola clave de API y un solo servidor MCP llegan a todos los dispositivos. El agente sigue las navegaciones y las WebViews recién abiertas, y ve una línea de tiempo que abarca todas las páginas.
- **Herramientas para el agente.** Instantáneas de accesibilidad con refs de elementos (el aria snapshot de Playwright), buscar, hacer clic, rellenar, escribir, pulsar teclas, seleccionar, pasar el cursor, desplazarse, arrastrar, navegar, evaluar, console, red con cuerpos, almacenamiento, capturas de pantalla (puente nativo o DOM), acciones por lotes, esperas y eventos.
- **Consentimiento y control.** Aprobación en el dispositivo con niveles (`observe` / `interact` / `advanced`), opción de permitir automáticamente, bloqueo de pantalla mientras opera el agente, tomar el control / devolver el control / finalizar, y confirmación para acciones sensibles (`data-rwd-confirm`).
- **Privacidad.** Los campos de contraseña, `data-rwd-mask` y los selectores y patrones configurables se enmascaran en instantáneas, capturas de pantalla, console y datos de red. El registro de auditoría guarda quién hizo qué, sin contenido de las páginas.
- **Operación.** Miembros y roles, claves de API con nivel / caducidad / lista de IP permitidas, tokens de dispositivo, invitaciones por código QR, cuotas, consola web en vivo por SSE y métricas de Prometheus.
- **11 idiomas y tus propios estilos.** La consola web, la interfaz del teléfono y los textos dirigidos al agente están en inglés, chino simplificado y tradicional, francés, español, ruso, árabe (de derecha a izquierda), japonés, coreano, alemán y portugués: la consola web sigue al navegador (con un selector), la interfaz del teléfono sigue al teléfono o a `run({ lang })`, y la parte del agente sigue a `RWD_LANG`. El SDK de página acepta tus propios paquetes de idioma y textos, y se le puede cambiar el estilo con variables CSS ([idiomas y estilos del SDK](sdk/README.es.md#idiomas)).
- **Se lleva bien con eruda.** Pestaña opcional de Remote Debugger dentro de eruda; puede cargar eruda bajo demanda para los desarrolladores.

## Estructura del repositorio

| Ruta | Qué contiene |
|---|---|
| [`gateway/`](gateway) | Gateway en Go: WebSocket de páginas, REST y autenticación de la consola web, servidor MCP, auditoría, métricas |
| [`sdk/`](sdk) | SDK de página (`sdk.js`) y su interfaz dentro de la página |
| [`packages/chobitsu/`](packages/chobitsu) | Copia integrada de [chobitsu](https://github.com/liriliri/chobitsu) más nuestro motor del lado de la página en `src/engine/` |
| [`console/`](console) | Consola web (React, Vite) |
| [`website/`](website) | [debugger.site](https://debugger.site), con la demo interactiva |
| [`examples/`](examples) | Una tienda de demostración con varias páginas y una app de macOS que aloja WKWebViews como una app de iOS |
| [`deploy/platform/`](deploy/platform) | Despliegue con Docker Compose |
| [`docs/`](docs) | [Arquitectura](docs/architecture.es.md), [protocolo](docs/protocol.es.md), [integración nativa](docs/native-integration.es.md), [publicación de versiones](docs/releasing.es.md) |

## Versiones

El SDK de página y el gateway se publican por separado, cada uno con su propia versión, su etiqueta (`sdk-vX.Y.Z`, `gateway-vX.Y.Z`) y su registro de cambios: [SDK](sdk/CHANGELOG.md), [gateway](gateway/CHANGELOG.md). Cada versión del gateway incluye binarios `rwd` para Linux y macOS y la imagen `ghcr.io/zanel1u/remote-webview-debugger`. Consulta [GitHub Releases](https://github.com/ZaneL1u/remote-webview-debugger/releases) y, si mantienes el proyecto, [publicación de versiones](docs/releasing.es.md).

## Desarrollo

```bash
make -j16 check                                      # tests del gateway, typecheck + tests de Playwright del SDK, build de la consola
cd console && PORT=8080 npm run mock & npm run dev   # consola contra un gateway simulado en memoria
cd website && npm run dev                            # el sitio web
```

## Agradecimientos

El motor del lado de la página se basa en [chobitsu](https://github.com/liriliri/chobitsu) (MIT) para capturar la console y la red, y usa el código de instantáneas de accesibilidad de [Playwright](https://github.com/microsoft/playwright) (Apache-2.0). Consulta [NOTICE](NOTICE).

## Licencia

[MIT](LICENSE)
