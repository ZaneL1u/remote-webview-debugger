import type { Dict } from './en.ts'

// Textos en español (neutro internacional, «tú»). Misma estructura que en.ts.

export const es: Dict = {
  meta: {
    title: 'Remote WebView Debugger — deja que los agentes de IA depuren WebViews en teléfonos reales',
    description:
      'Código abierto y autoalojado: añade un script y Claude Code, Codex, Cursor o cualquier cliente MCP podrá inspeccionar y operar páginas H5 y WebViews de apps en los teléfonos de tus usuarios, con la aprobación del usuario, con enmascarado y con un botón para tomar el control. Sin cable USB, sin puerto de depuración.',
    ogTitle: 'Remote WebView Debugger',
    ogDescription: 'Deja que tu agente de IA depure la WebView del teléfono de tu usuario. Un script, un código de dispositivo, un endpoint MCP. Código abierto.',
  },
  nav: {
    skip: 'Saltar al contenido',
    demo: 'Demo',
    live: 'Pruébalo en vivo',
    how: 'Cómo funciona',
    features: 'Características',
    highlights: 'Lo destacado',
    privacy: 'Privacidad',
    selfHost: 'Autoalojado',
    faq: 'FAQ',
    github: 'GitHub',
    menu: 'Menú',
    themeToggle: 'Cambiar el tema de color',
    langLabel: 'Idioma',
  },
  hero: {
    eyebrow: 'Código abierto · MIT · MCP',
    titleHtml: 'Deja que tu agente de IA depure la WebView <em>del teléfono de tu usuario</em>.',
    sub:
      'Añade un script a tu página H5 o a la WebView de tu app. Tu usuario te dicta un código de dispositivo corto y Claude Code, Codex, Cursor o cualquier cliente MCP puede ver la página, leer la console y la red, y recorrer el bug a base de clics, mientras el usuario lo mira todo y puede tomar el control en cualquier momento.',
    ctaDemo: 'Ver la demo',
    ctaLive: 'Pruébalo con tu agente',
    ctaGithub: 'Dale una estrella en GitHub',
    ctaSelfHost: 'Autoalójalo en 5 minutos',
    /** The quick-start box under the buttons: a prompt for your agent, or the script tag. */
    quick: {
      label: 'Inicio rápido',
      agent: 'Pídeselo a tu agente',
      script: 'Etiqueta script',
      agentHint: 'Pégalo en Claude Code, Codex o Cursor',
      prompt: 'Añade Remote WebView Debugger a este proyecto siguiendo https://debugger.site/llms.txt',
    },
    flow: {
      label: 'Un agente de IA habla MCP con tu gateway autoalojado, que llega por WebSocket al SDK de página en el teléfono del usuario.',
      agent: 'Agente de IA',
      agentSub: 'Claude Code · Codex · Cursor · cualquier cliente MCP',
      gw: 'Gateway',
      gwSub: 'autoalojado · aprobación · auditoría',
      phone: 'Teléfono del usuario',
      phoneSub: 'página H5 / WebView de la app + SDK',
      mcp: 'MCP · HTTPS',
      ws: 'WebSocket',
      state: 'IA operando',
    },
  },
  demo: {
    kicker: 'Demo en vivo',
    title: 'Un bug real, resuelto en un teléfono “real”',
    lead:
      'El teléfono ejecuta el SDK de página real dentro de una tienda de demostración; solo el gateway está simulado, en esta pestaña. Cada instantánea, clic, línea de console y parche en vivo que ves abajo ocurre de verdad.',
    agentTitle: 'Agente de IA',
    agentSub: 'conectado al servidor MCP de Remote WebView Debugger',
    skinLabel: 'Estilo del agente',
    skinClaude: 'Claude Code',
    skinCodex: 'Codex',
    /** The two ways to use the demo: one phone, two modes. */
    modeLabel: 'Modo de la demo',
    modeWatch: 'Mira a un agente arreglar un bug',
    modeWatchSub: 'Con guion · corre en tu navegador',
    modeTry: 'Pruébalo con tu agente',
    modeTrySub: 'Gateway real · tu propia clave',
    phoneLabel: 'Teléfono del cliente',
    play: 'Reproducir',
    pause: 'Pausar',
    restart: 'Reiniciar',
    speed: 'Velocidad',
    start: 'Ejecutar la demo',
    startHint: 'Mira cómo un agente se conecta al teléfono, reproduce un bug del pago, encuentra la causa raíz y verifica la solución en vivo.',
    expand: 'Ver el resultado completo',
    collapse: 'Ocultar',
    running: 'en curso',
    done: 'Listo',
    error: 'error',
    you: 'Ingeniero de soporte',
    agent: 'Agente',
    customer: 'Cliente',
    /** The hand that points at “Allow” when nobody taps it. */
    guideTap: 'Toca “Permitir”',
    guideAuto: (s: number) => `automático en ${s} s`,
    footnote: '<code>sdk.js</code> sin modificar en un iframe · su WebSocket tunelizado por postMessage hasta un gateway simulado en esta pestaña · cada RPC se ejecuta de verdad.',
    stateIdle: 'Listo',
    statePrelude: 'El cliente se topa con el bug',
    stateRunning: 'El agente está trabajando',
    statePaused: 'En pausa',
    stateWaitApproval: 'Esperando la aprobación del cliente',
    stateWaitControl: 'Esperando a que el cliente devuelva el control',
    stateDone: 'Terminado',
    stateStopped: 'Detenido',
  },
  live: {
    kicker: 'Manos a la obra',
    title: 'Ahora pruébalo con tu propio agente',
    lead:
      'Esta es de verdad: un gateway de demostración público en <code>demo.debugger.site</code>, aislado de todo lo demás y borrado cada día. La tienda del teléfono se carga desde ahí: consigue una clave, apunta tu agente a ella y míralo trabajar aquí mismo.',
    steps: [
      {
        title: 'Consigue tu propia clave',
        body: 'Un clic, sin registro. La clave solo funciona en el gateway de demostración y dura hasta que la demo se reinicia.',
      },
      {
        title: 'Añade el gateway de demostración a tu agente',
        body: 'Ejecuta el comando una vez en una terminal, o añádelo a los ajustes de tu cliente MCP. La clave ya viene rellenada.',
      },
      {
        title: 'Pídeselo a tu agente',
        body: 'El código de dispositivo de la tienda del teléfono ya está en el prompt. Cuando el agente pida conectarse, toca <em>Permitir</em> en la tienda y míralo trabajar; puedes usar <em>Tomar control</em> o <em>Finalizar</em> en cualquier momento.',
      },
    ],
    phoneTitle: 'La tienda de demostración, en vivo',
    phoneHint: 'Esto es <code>demo.debugger.site</code> en persona, ejecutando el SDK real. Escanea el código para abrirlo en tu teléfono.',
    open: 'Abrir en una pestaña nueva',
    scan: 'Escanea para abrirlo en tu teléfono',
    tabsLabel: 'Configuración MCP de la demo',
    getKey: 'Conseguir mi clave',
    keyIdle: 'Consigue una clave y se rellenará en el comando de abajo.',
    keyLoading: 'Consiguiendo tu clave…',
    keyReady: 'Tu clave ya está rellenada. Deja de funcionar cuando la demo se reinicia (cada día a las 04:00 UTC+8); vuelve aquí para pedir otra.',
    keyFailed: 'Ahora mismo no se puede contactar con el gateway de demostración; inténtalo de nuevo más tarde.',
    keyLimited: 'Demasiadas claves desde tu red; inténtalo de nuevo en una hora.',
    deviceWaiting: 'Esperando a que la tienda se conecte…',
    deviceReady: (code: string) => `El código de dispositivo de esta página es ${code}, ya rellenado en el prompt.`,
    deviceUnavailable: 'La tienda no informó de ningún código de dispositivo; léelo en la píldora de la tienda.',
    prompt:
      'Usa el servidor MCP rwd-demo y conéctate al dispositivo XXXX-XXXX. En la tienda, elige el paquete “Gift box” de un producto, ve a la página de pago y averigua por qué el total muestra “--”.',
    promptLabel: 'Prompt',
    promptNote: 'Sustituye <code>XXXX-XXXX</code> por el código que se muestra en la tienda.',
    limitsTitle: 'Límites de la demo',
    limits: [
      'Una clave por visitante: tu agente solo llega a la página cuyo código le des, y después de que lo permitas',
      'Solo nivel <strong>interact</strong>: sin scripts, sin cuerpos de solicitudes y sin almacenamiento',
      'Un agente se queda con una página 15 minutos como máximo (5 si está inactivo)',
      '120 solicitudes MCP por minuto y por IP',
      'Se borra cada día a las 04:00 (UTC+8): no introduzcas datos personales reales',
    ],
  },
  how: {
    kicker: 'Cómo funciona',
    title: 'Tres pasos desde “en mi teléfono no funciona” hasta la causa raíz',
    steps: [
      {
        title: 'Añade el SDK de página',
        body:
          'Un script en <code>&lt;head&gt;</code>, lo más arriba posible, para que la console y la red se graben desde la primera línea. En una app, inyecta el mismo script al inicio del documento.',
      },
      {
        title: 'El usuario comparte un código de dispositivo',
        body:
          'Cada teléfono recibe un código permanente como <code>K7Q2-9M4X</code> en una pequeña píldora. El usuario puede tocar <em>Solicitar asistencia</em> y el dispositivo salta al principio de la lista del agente.',
      },
      {
        title: 'Tu agente se conecta por MCP',
        body:
          'Añade el endpoint MCP que aloja el gateway con una clave de API. Después basta con describir el problema: el agente encuentra el dispositivo, pide aprobación y se pone a trabajar.',
      },
    ],
    pill: { code: 'K7Q2-9M4X', online: 'En línea', help: 'Solicitar asistencia' },
    chip1: 'sdk.js desde el CDN · console y red desde la primera línea',
    chip3: 'aprobado en el teléfono · nivel interact',
    prompt: 'El dispositivo K7Q2-9M4X no puede pagar: el total muestra “--”. Averigua por qué.',
    tabsLabel: 'Configuración del cliente MCP',
    sdkNote: 'Fija una versión en producción, o usa la copia que lleva tu propio gateway en <code>/v1/sdk.js</code> (con SRI desde la consola).',
  },
  features: {
    kicker: 'Lo que recibe el agente',
    title: 'El flujo de DevTools, por MCP, en el teléfono de otra persona',
    items: [
      { icon: 'tree', title: 'Instantáneas de accesibilidad', body: 'YAML al estilo de Playwright con refs de elementos. El agente lee la página como estructura, no como píxeles, y actúa sobre las refs.' },
      { icon: 'cursor', title: 'Interacciones reales', body: 'click, fill, type, press, select, hover, scroll, drag, con comprobaciones de que el elemento es operable y con eventos que React y Vue aceptan.' },
      { icon: 'terminal', title: 'Console y red', body: 'Se graban desde que carga la página, en búferes acotados, así que los errores anteriores a la llegada del agente siguen ahí. Los cuerpos, a petición.' },
      { icon: 'layers', title: 'Sesiones con varias páginas', body: 'Lista → detalle → pago, o una segunda WebView: todas las páginas de un dispositivo forman una sola sesión, con una línea de tiempo común.' },
      { icon: 'bell', title: 'Los cambios de sesión te llegan solos', body: 'Cada resultado de herramienta termina con lo que cambió: una página nueva, una navegación, un error, el usuario tomando el control. Sin sondeos.' },
      { icon: 'list', title: 'Tarjeta de tarea en el teléfono', body: 'El agente muestra su plan y su progreso en el dispositivo, para que el usuario sepa siempre qué está haciendo y por qué.' },
      { icon: 'camera', title: 'Capturas de pantalla', body: 'Píxeles nativos cuando la app ofrece un puente, y una representación del DOM si no. El enmascarado se aplica a las dos.' },
      { icon: 'scroll', title: 'Registro de sesión en el dispositivo', body: 'Páginas, toques, console y todas las solicitudes desde que se inició la app, guardados en el teléfono en IndexedDB y legibles a posteriori.' },
      { icon: 'wrench', title: 'Parches en vivo', body: 'En el nivel advanced, el agente puede parchear la página en marcha con <code>evaluate_script</code> y verificar una solución en el momento.' },
      { icon: 'wifi', title: 'Redes malas', body: 'Un heartbeat ligero con back-off; tras tres fallos, un sondeo de presencia una vez por minuto, y el gateway despierta la página cuando hace falta.' },
      { icon: 'globe', title: '11 idiomas', body: 'Interfaz del teléfono, console y textos dirigidos al agente en 11 idiomas, incluido el árabe de derecha a izquierda. Trae tus propios paquetes y tus propios textos.' },
      { icon: 'plug', title: 'Cualquier cliente MCP', body: 'Streamable HTTP en <code>/v1/mcp</code> para Claude Code, Codex, Cursor y compañía; un pequeño puente stdio para todo lo demás.' },
    ],
    toolsTitle: 'Todas las herramientas',
    /** The tools by what they are for (the tool names themselves are in lib/snippets.ts). */
    toolGroups: [
      { title: 'Dispositivos y control', body: 'Encuentra un dispositivo, conéctate con la aprobación del usuario, espera a que devuelva el control, suéltalo.' },
      { title: 'Páginas', body: 'Cada pestaña y WebView del dispositivo, siguiendo las navegaciones.' },
      { title: 'Ver la página', body: 'Estructura con refs de elementos, búsqueda de texto, píxeles.' },
      { title: 'Actuar', body: 'Entrada real sobre refs, comprobando que se puede actuar; lotes en una sola ida y vuelta.' },
      { title: 'Depurar', body: 'Console, red con cuerpos, almacenamiento y scripts en la página.' },
      { title: 'Historial', body: 'Qué pasó entre páginas, antes de conectarte y desde entonces.' },
    ],
    levelsLabel: 'Nivel necesario',
  },
  highlights: {
    kicker: 'Lo destacado',
    title: 'Hecho para los bugs que solo pasan ahí fuera',
    lead: 'Tres cosas que no te dará un cable, ni un puerto de depuración remota, ni una grabación de pantalla.',
    items: [
      {
        title: '¿El bug ya ocurrió? El registro sigue en el teléfono.',
        body:
          'Desde que la app se inicia, el SDK escribe un registro de sesión en el IndexedDB del dispositivo: páginas visitadas, los toques y lo que escribió el usuario, la salida de console y todas las solicitudes — las fallidas con encabezados y cuerpos. Nada se transmite a ninguna parte: se queda en el teléfono, con las mismas reglas de enmascarado, hasta que un agente aprobado por el usuario lo pide con <code>get_session_overview</code> y <code>get_session_log</code>. Se conservan los tres últimos inicios, de hasta 10 MB cada uno.',
        tag: 'Registro de sesión · almacenado en frío en el dispositivo',
        visual: {
          title: 'rwd-log · inicio 3 de 3',
          rows: ['09:41:02  abrir   index.html', '09:41:09  toque   “Gift box”', '09:41:11  toque   Buy now', '09:41:12  error   TypeError: order.price.toFixed…', '09:41:13  red     GET api/coupon → 404', '09:52:30  agente  conectado (interact)', '09:52:31  lee     get_session_log'],
        },
      },
      {
        title: 'Verifica la solución en el teléfono del cliente, antes de publicarla.',
        body:
          'Con la aprobación <strong>advanced</strong> del usuario, <code>evaluate_script</code> se ejecuta en la página, así que el agente puede corregir un estado erróneo, sustituir una función o volver a renderizar una vista y ver el resultado en el dispositivo real: un parche en vivo que demuestra el diagnóstico. Solo vive en la memoria de esa página; nada queda guardado, y los clics sensibles siguen necesitando el sí del usuario.',
        tag: 'Parche en vivo · evaluate_script',
        visual: {
          title: 'checkout.html · en vivo',
          before: 'Total  --',
          after: 'Total  $208.00',
          code: 'order.price = Number(order.price)',
        },
      },
      {
        title: 'Pensado para agentes, no para una persona con DevTools.',
        body:
          'Cada resultado de herramienta termina con lo que cambió en el dispositivo desde la llamada anterior, así que el agente nunca sondea. El contenido de la página se entrega como datos no confiables. Una tarjeta de tarea en el teléfono muestra el plan del agente, y el gateway habla el idioma del agente: descripciones y resultados de las herramientas en 11 idiomas.',
        tag: 'Nativo para agentes · MCP',
        visual: {
          title: 'resultado de herramienta · final',
          rows: ['[Cambios de sesión]', '- se abrió p2 “Checkout” (primer plano)', '- error de console en p1: TypeError …', '- el usuario tomó el control'],
        },
      },
    ],
  },
  privacy: {
    kicker: 'Privacidad y control',
    title: 'El teléfono del usuario sigue siendo del usuario',
    lead: 'La depuración remota solo funciona si la gente confía en ella. Cada sesión se ve, se aprueba y se puede interrumpir.',
    items: [
      { title: 'Primero, la aprobación', body: 'Un agente pide conectarse; el usuario ve quién lo pide y elige un nivel en el teléfono. Solo cuentan los toques reales: un script no puede aprobarse a sí mismo.' },
      { title: 'Toma el control o finaliza, cuando quieras', body: 'Mientras el agente trabaja, la página queda bloqueada detrás de un borde luminoso. Un toque en <em>Tomar control</em> pone al agente en pausa; <em>Finalizar</em> lo desconecta.' },
      { title: 'Enmascarado por defecto', body: 'Las contraseñas, y todo lo marcado con <code>data-rwd-mask</code>, aparecen como <code>••••</code> en instantáneas, capturas de pantalla, console, datos de red y el registro de sesión. Añade selectores y expresiones regulares por proyecto.' },
      { title: 'Los clics sensibles necesitan un sí', body: 'Marca botones con <code>data-rwd-confirm</code> (“Hacer el pedido”, “Eliminar la cuenta”) y el usuario confirmará cada clic del agente sobre ellos.' },
      { title: 'Niveles de permiso', body: '<strong>observe</strong> lee, <strong>interact</strong> opera, <strong>advanced</strong> añade scripts, cuerpos de solicitudes y almacenamiento. Con un tope por clave y por proyecto.' },
      { title: 'Registro de auditoría', body: 'Cada conexión, aprobación, RPC y toma de control se graba con quién, qué y cuándo; nunca el contenido de las páginas ni los valores de los parámetros.' },
    ],
    levels: [
      { name: 'observe', tools: 'instantáneas, capturas de pantalla, console, lista de red, registro de sesión, find, wait' },
      { name: 'interact', tools: '+ click, fill, type, press, select, hover, scroll, drag, navigate' },
      { name: 'advanced', tools: '+ evaluate_script (parches en vivo), cuerpos de solicitud y respuesta, almacenamiento' },
    ],
  },
  native: {
    kicker: 'Apps nativas',
    title: 'En tu app es un solo user script',
    lead:
      'Descarga el SDK una vez e inyéctalo al inicio del documento: WKUserScript en iOS, addDocumentStartJavaScript en Android. Tus páginas web no cambian en nada.',
    extras: [
      { title: 'Un mismo código de dispositivo en todas partes', body: 'Pasa un <code>deviceId</code> estable (y guarda el <code>deviceToken</code>) para que el código sobreviva entre WebViews y dominios.' },
      { title: 'Controles nativos', body: 'Muestra tus propios botones de tomar control / devolver / finalizar con <code>nativeControl()</code>; los scripts de la página no pueden llamarlo.' },
      { title: 'Diálogos de aprobación nativos', body: '<code>nativeApproval: true</code> deja las solicitudes de conexión y las confirmaciones en manos de la interfaz de tu app.' },
      { title: 'Capturas con píxeles reales', body: 'Un pequeño puente (snapshot de WKWebView, bitmap en Android) le da al agente píxeles de verdad en lugar de una representación del DOM.' },
    ],
    tabs: { ios: 'iOS (Swift)', android: 'Android (Kotlin)', h5: 'Página H5' },
  },
  selfHost: {
    kicker: 'Autoalojado',
    title: 'Un binario de Go. Tus servidores. Tus datos.',
    lead: 'El gateway lleva integrados la consola web y el SDK de página. SQLite desde el primer momento, Postgres cuando lo necesites, Docker Compose y Caddy para el HTTPS.',
    points: [
      { title: 'Consola', body: 'Dispositivos, claves de API, miembros y roles, invitaciones por QR, políticas y un registro de auditoría, más una guía de integración ya rellenada con tus propias claves.' },
      { title: 'Almacenamiento', body: 'Un archivo SQLite por defecto; define <code>RWD_DATABASE_URL=postgres://…</code> para usar Postgres.' },
      { title: 'Operación', body: 'Métricas de Prometheus en <code>/v1/metrics</code>, URL del SDK versionadas con SRI, comprobación de salud en <code>/v1/healthz</code>.' },
    ],
    stepsTitle: 'Inicio rápido',
    dockerComment: '# un contenedor: consola + gateway + SDK',
    deployComment: '# o compílalo, despliégalo y consigue HTTPS con Caddy',
    resultComment: '# → consola  https://rwd.example.com\n# → gateway  https://rwd.example.com/v1  (MCP en /v1/mcp)',
    requires: 'Al servidor solo le hace falta Docker; compilar desde el código fuente necesita Go y Node.',
    docsLink: 'Guía de despliegue',
    agentTitle: 'O déjaselo a tu agente',
    agentPrompt: 'Despliega un gateway de Remote WebView Debugger en mi servidor y añádelo a tus servidores MCP siguiendo https://debugger.site/llms.txt',
  },
  faq: {
    kicker: 'FAQ',
    title: 'Lo que suele preguntar la gente',
    items: [
      {
        q: '¿Tiene que instalar algo el usuario?',
        a: 'No. En las páginas H5 el SDK forma parte de tu página. En una app lo inyectas desde el código nativo. El usuario solo ve una pequeña píldora con su código de dispositivo y, cuando un agente se conecta, un diálogo de aprobación.',
      },
      {
        q: '¿Qué puede ver y hacer el agente?',
        a: 'Solo lo que el usuario aprobó: las páginas WebView de ese dispositivo, con el nivel concedido. Nunca controla nada fuera de la WebView. Los campos enmascarados siguen enmascarados, y el contenido de la página se le pasa al modelo como datos no confiables.',
      },
      {
        q: 'El bug ocurrió antes de que el agente se conectara. ¿Se perdió?',
        a: 'No. El SDK guarda en el dispositivo un registro de sesión desde que se inició la app (páginas, toques, console y solicitudes), así que un agente que se conecte después puede leer todo el camino hasta el bug con <code>get_session_log</code>. Por lo demás, nunca sale del teléfono.',
      },
      {
        q: '¿Puede el agente arreglar el bug en el teléfono?',
        a: 'Puede verificar una solución: en el nivel <strong>advanced</strong>, <code>evaluate_script</code> parchea en memoria la página en marcha (corregir el estado, sustituir una función, volver a renderizar) y el agente ve si el problema desaparece. La solución de verdad sigue publicándose por tu proceso habitual; en el dispositivo no queda nada guardado.',
      },
      {
        q: '¿Con qué agentes funciona?',
        a: 'Con cualquier cliente MCP. Claude Code, Codex y Cursor usan directamente el endpoint Streamable HTTP alojado; los clientes que solo hablan stdio usan <code>rwd mcp</code>, un pequeño puente al mismo endpoint.',
      },
      {
        q: '¿Qué plataformas están soportadas?',
        a: 'Cualquier WebView o navegador móvil moderno: WKWebView en iOS, Android System WebView, navegadores dentro de apps y el Safari o el Chrome móvil de toda la vida. Los navegadores de escritorio también funcionan.',
      },
      {
        q: '¿Y si la red es mala o los WebSockets están bloqueados?',
        a: 'La página mantiene un WebSocket de heartbeat ligero con back-off exponencial. Si no consigue conectarse tres veces seguidas, pasa a un sondeo de presencia una vez por minuto, y el gateway la despierta cuando un agente quiere conectarse.',
      },
      {
        q: '¿Ralentiza mi página?',
        a: 'Es un solo script. Los registros de console y de red viven en búferes circulares acotados (500 entradas cada uno, cuerpos de respuesta con un tope de 5 MB), el registro de sesión se escribe en segundo plano y una conexión inactiva solo intercambia heartbeats.',
      },
      {
        q: '¿Funciona junto a eruda, vConsole o PageSpy?',
        a: 'Sí: sus nodos se omiten en las instantáneas y en la detección de clics, nuestro propio tráfico no aparece en sus registros de red, y hasta puede vivir como una pestaña dentro de eruda.',
      },
      {
        q: '¿La demo de arriba es real?',
        a: 'El SDK es real y sin modificar; solo el gateway está simulado en tu navegador. Un shim de WebSocket le lleva la conexión del SDK con <code>postMessage</code>, y un agente con guion envía las mismas RPC que enviaría un gateway real. Para verlo de verdad y de principio a fin, <a href="#live">pruébalo con tu propio agente</a>.',
      },
    ],
  },
  footer: {
    tagline: 'Deja que los agentes de IA depuren páginas H5 y WebViews de apps en teléfonos reales.',
    project: 'Proyecto',
    docs: 'Documentación',
    languages: 'Idiomas',
    links: {
      github: 'GitHub',
      issues: 'Issues',
      license: 'Licencia MIT',
      protocol: 'Protocolo',
      gateway: 'Gateway',
      sdk: 'SDK de página',
      architecture: 'Arquitectura',
      native: 'Integración nativa',
    },
    note: 'Publicado bajo la licencia MIT. Sin cookies, sin seguimiento.',
  },
  notFound: {
    title: 'Página no encontrada',
    body: 'Esta página no existe; quizá el dispositivo se quedó sin conexión.',
    home: 'Volver a la página principal',
  },
  copy: { copy: 'Copiar', copied: 'Copiado' },
}
