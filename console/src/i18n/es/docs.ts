import type { docs as en } from '../en/docs'

export const docs: typeof en = {
  toc: {
    label: 'Contenido',
    overview: 'Cómo funciona',
    concepts: 'Conceptos clave',
    quickstart: 'Inicio rápido en cinco pasos',
    h5: 'Integrar una página H5',
    native: 'Integrar una app nativa',
    mcp: 'Conectar un agente de IA (MCP)',
    tools: 'Herramientas MCP',
    approval: 'Aprobación, toma de control y confirmación',
    verify: 'Lista de verificación',
    troubleshoot: 'Solución de problemas',
  },
  anchorLabel: (title) => `Enlace a “${title}”`,

  hero: {
    eyebrow: (brand) => `Guía de integración · ${brand}`,
    title: 'De una etiqueta script a una IA que depura páginas en los teléfonos de tus usuarios',
    body: 'El flujo completo: añade el SDK a tu página o app, conecta un dispositivo, crea una clave de API y añade el gateway a Claude Code u otro cliente MCP; después, aprobación, toma de control y solución de problemas. Los ejemplos de código ya usan la URL de tu gateway; elige un proyecto para rellenar su clave de app.',
  },

  personalize: {
    gateway: 'URL del gateway',
    gatewayHint: 'GATEWAY en el código',
    project: 'Proyecto',
    projectHint: 'Define la clave de app de abajo',
    selectProject: 'Seleccionar proyecto',
    disabledSuffix: ' (deshabilitado)',
    noProjects: 'Todavía no hay proyectos. Crea uno',
    appKey: 'Clave de app',
    appKeyHint: 'Pública, solo para dispositivos',
  },

  overview: {
    lead: 'El SDK de tu página se conecta hacia fuera con el gateway; los agentes de IA usan el endpoint MCP del gateway para encontrar dispositivos, conectarse a ellos y manejar la página. Los usuarios siempre ven lo que hace la IA y pueden tomar el control o finalizar la sesión en cualquier momento.',
    device: 'Dispositivo',
    deviceSub: 'WebView de app / página H5 + SDK',
    gateway: 'Gateway de Remote Debugger',
    gatewaySub: 'Presencia, aprobación, permisos, auditoría',
    agent: 'Agente de IA',
    agentSub: 'Claude Code, Cursor y más',
    console: 'Consola web (estás aquí): dispositivos, proyectos, claves, políticas y el registro de auditoría',
    noPorts:
      'Tu página no abre ningún puerto: el SDK se conecta hacia fuera con el gateway por WebSocket y, si no puede, recurre al sondeo HTTP cada 60 segundos.',
    oneKey:
      'Una clave de API ve todos los dispositivos del gateway, así que te basta con un único servidor MCP. De forma predeterminada, el usuario toca Permitir en el dispositivo antes de que un agente se conecte, y el nivel de permiso limita lo que puede hacer el agente.',
    masking:
      'Los campos de contraseña y el contenido enmascarado se muestran como <c>••••</c> en instantáneas, capturas de pantalla y registros; el texto original nunca sale de la página.',
  },

  concepts: {
    head: ['Término', 'Qué es', 'Formato / ejemplo'],
    gateway: 'Gateway',
    gatewayBody: 'El servicio de Remote Debugger desplegado en tu servidor. Todos los endpoints están bajo su /v1.',
    project: 'Proyecto',
    projectBody:
      'Un origen de integración (una app, un sitio o uno de sus códigos H5), con su propia clave de app y su política. Los dispositivos y las claves de API no pertenecen a un proyecto.',
    projectExample: 'App de la tienda',
    appKey: 'Clave de app',
    appKeyBody: 'Se incluye en la página para conectar dispositivos. Es pública; no puede controlar dispositivos.',
    appKeyFormat: 'rwd_pk_ + 24 caracteres',
    apiKey: 'Clave de API',
    apiKeyBody:
      'Permite a los agentes de IA conectarse a dispositivos a través de MCP. Pertenece a todo el gateway, no a un proyecto. Solo se muestra una vez; admite un nivel máximo, una caducidad y una lista de IP permitidas.',
    apiKeyFormat: 'rwd_sk_live_ + 32 caracteres',
    device: 'Dispositivo',
    deviceBody:
      'Un teléfono (un deviceId). Todas las páginas de un dispositivo forman una única sesión de depuración, y pueden venir de proyectos distintos.',
    deviceCode: 'Código de dispositivo',
    deviceCodeBody: 'Un código corto y permanente que el gateway asigna a cada dispositivo. El usuario se lo lee al equipo de soporte; tú se lo pasas al agente.',
    page: 'Página',
    pageBody: 'Una página o WebView del dispositivo que ejecuta el SDK, numerada en el orden en que se abrió.',
    pageFormat: 'p1, p2…',
    approval: 'Aprobación',
    approvalBody:
      'Si el proyecto de alguna página del dispositivo la activa, el usuario confirma en el dispositivo antes de que un agente se conecte y elige cuánto acceso concede.',
    level: 'Nivel de permiso',
    levelBody:
      'Lo que una conexión puede hacer en realidad: el menor entre lo que solicita el agente, el máximo de la clave, el máximo del proyecto de cada página del dispositivo y lo que aprueba el usuario.',
  },

  quickstart: {
    lead: 'Tu primera integración lleva unos 5 minutos si sigues estos pasos en orden.',
    projectTitle: 'Crea un proyecto y obtén su clave de app',
    projectBody: 'Créalo en la página <link>Proyectos</link>, p. ej. “App de la tienda”. Por ahora puedes dejar vacíos los orígenes permitidos.',
    sdkTitle: 'Añade el SDK a tu página',
    sdkBody:
      'En páginas H5, añade estas dos líneas lo antes posible en <head>. Para las WebView dentro de una app, recomendamos inyectarlo desde el código nativo (consulta “Integrar una app nativa”).',
    onlineTitle: 'Abre la página y comprueba que el dispositivo está en línea',
    onlineBody:
      'En la esquina inferior derecha de la página aparece una píldora translúcida con el código de dispositivo (dentro de la pestaña Remote Debugger de eruda si la página tiene eruda), y puedes encontrar el dispositivo en la página <link>Dispositivos</link> de la consola. Ábrelo y ejecuta Probar conexión para confirmar que el gateway puede obtener una instantánea de la página.',
    keyTitle: 'Crea una clave de API',
    keyBody: (level) =>
      `Ve a <link>Claves de API</link> en la navegación superior → Crear. Elige un nivel (${level} suele ser el adecuado para depurar) y una caducidad, y copia la clave <c>rwd_sk_live_…</c>, que solo se muestra una vez.`,
    mcpTitle: 'Añade el gateway a Claude Code y pídeselo sin más',
    mcpExample: 'Por ejemplo: “Lista los dispositivos en línea, conéctate a GSJH-EV2J y averigua por qué el total del pago muestra --”.',
  },

  h5: {
    lead: 'Para páginas H5 independientes, o WebView cuyo código de página puedes cambiar. El SDK almacena la actividad de console y de red desde el momento en que se carga, así que cárgalo de forma síncrona y lo antes posible en <head>.',
    loadTitle: 'Cargar e iniciar el SDK',
    latestTab: 'Última versión',
    pinnedTab: 'Versión fijada + SRI',
    latestBody: 'Carga siempre el SDK más reciente desde el gateway, así las actualizaciones del gateway se aplican automáticamente.',
    pinnedBody:
      'Carga una versión fija, y el navegador comprueba el archivo con <c>integrity</c> (sha384). Útil para páginas con requisitos de seguridad estrictos. La versión y el integrity salen de <c>sdkVersion</c> y <c>sdkIntegrity</c> en <c>GET /v1/api/config</c>; actualízalos cuando se actualice el gateway.',
    optionsTitle: 'Opciones de run()',
    optionsIntro:
      '<c>RemoteWebviewDebugger.run(gatewayUrl, appKey, options?)</c> devuelve <c>Promise<{deviceCode, status}></c>; volver a llamarlo no tiene efectos secundarios.',
    optionsHead: ['Opción', 'Descripción'],
    options: {
      userId: 'El usuario con sesión iniciada. La consola y los agentes pueden buscar dispositivos por usuario; llama a setUser() cuando cambie el estado de la sesión.',
      helpButton:
        'Muestra el botón de ayuda; cuando el usuario lo toca, el dispositivo se marca como “Pidiendo ayuda” en la consola. Se combina con OR con la opción de ayuda de la política del proyecto.',
      app: 'Datos de la app anfitriona <c>{ name, version }</c>, que se muestran en la lista de dispositivos.',
      deviceId:
        'Lo pasa la app al inyectar de forma nativa, para que siga siendo el mismo dispositivo en todas las WebView y dominios. En páginas H5 normales, el SDK genera uno y lo guarda en localStorage.',
      nativeKey: 'Un secreto aleatorio que genera la app y que solo aparece en el script inyectado. nativeControl / nativeDecide lo requieren.',
      deviceToken:
        'Un token de dispositivo emitido por el gateway. localStorage es por origen, así que la app debe guardarlo y volver a pasarlo en cada página (ver más abajo).',
      nativeApproval:
        'Si es true, el SDK no dibuja los diálogos de aprobación / confirmación; la app lee status().pending y muestra los suyos nativos.',
      lockScreen:
        'Si se bloquea la página mientras la IA actúa (predeterminado: true). Los usuarios también pueden cambiarlo en el panel flotante, que además permite activar “Permitir automáticamente las conexiones de IA” tras explicarlo y pedir un nivel de permiso.',
      eruda:
        'Integración con eruda, desactivada por defecto. true o { dock: true }: añade una pestaña Remote Debugger a eruda en lugar de mostrar el panel flotante; { load: true }: carga e inicializa la última versión de eruda si la página no la tiene. También puedes pasar src (URL de eruda) y name (nombre de la pestaña). En el proyecto, Ajustes → Integración con eruda puede activarlo en remoto; cada opción definida aquí tiene prioridad.',
    },
    jsApiTitle: 'API de JS',
    statusValues:
      'Valores de <c>status().status</c>: <c>idle</c>, <c>connecting</c>, <c>online</c>, <c>polling</c> (WebSocket no disponible, sondea cada 60 segundos), <c>stopped</c>, <c>rejected</c> (el token de dispositivo no coincide), <c>quota</c> (supera la cuota de dispositivos en línea). <c>nativeControl()</c> y <c>nativeDecide()</c> son para anfitriones nativos.',
    originsTitle: 'Orígenes permitidos',
    originsBody:
      'Cuando un proyecto tiene orígenes permitidos, el gateway comprueba el Origin de cada página y rechaza el handshake (403) de las páginas que no están en la lista. Escribe cada entrada como un origen completo, p. ej. <c>https://m.example.com</c>; se permite un comodín inicial, como en <c>https://*.example.com</c> (coincide con los subdominios, no con example.com). Déjalo vacío para no restringir.',
    cspTitle: 'CSP',
    cspBody: 'Si la página tiene una Content-Security-Policy, permite el gateway para scripts y conexiones (WebSocket usa wss://):',
    maskTitle: 'Enmascarar datos sensibles y confirmar acciones sensibles',
    maskBody:
      '<c>input[type=password]</c> y los elementos con <c>data-rwd-mask</c> se muestran como <c>••••</c> en instantáneas, capturas de pantalla y la console. En los Ajustes del proyecto puedes añadir selectores de enmascaramiento (<c>maskSelectors</c>) y reglas de texto con expresiones regulares (<c>maskPatterns</c>, p. ej. números de teléfono o de documento). Antes de que un agente haga clic en un elemento con <c>data-rwd-confirm</c> (o que coincida con los <c>confirmSelectors</c> del proyecto), el dispositivo pide confirmación al usuario.',
  },

  native: {
    lead: 'Sin cambios en H5: la app inyecta el SDK en cada WebView cuando empieza a cargar. Todas las páginas de la app (incluidos dominios de terceros) se pueden depurar, con diálogos de aprobación nativos, capturas de pantalla y botones de toma de control.',
    cards: [
      {
        title: 'Inyectar al inicio del documento',
        body: 'Usa WKUserScript(.atDocumentStart) en iOS y addDocumentStartJavaScript en Android, para que la captura empiece antes de que se ejecute cualquier script de la página.',
      },
      {
        title: 'Un deviceId estable',
        body: 'Uno por instalación, guardado en la app y compartido por todas las WebView y dominios, para que el código de dispositivo no cambie nunca.',
      },
      {
        title: 'nativeKey',
        body: 'Un secreto aleatorio que genera la app y que solo escribe en el script inyectado. El evaluate_script del agente no puede leerlo, así que el agente no puede hacerse pasar por el usuario para devolver el control o aprobar una conexión.',
      },
      {
        title: 'Guardar el deviceToken',
        body: 'Léelo de status().deviceToken tras la primera conexión, guárdalo e inyéctalo en cada WebView a partir de entonces. Sin él, el gateway rechaza el dispositivo con 4401.',
      },
      {
        title: 'Aprobación y confirmación nativas',
        body: 'Define nativeApproval: true, consulta status().pending periódicamente, muestra un diálogo nativo y responde con nativeDecide.',
      },
      {
        title: 'Capturas de pantalla y botones nativos',
        body: 'Proporciona un puente de capturas de pantalla para que el agente obtenga píxeles reales; los botones Tomar el control / Devolver el control / Finalizar de la barra de estado llaman a nativeControl.',
      },
    ],
    iosTab: 'iOS (Swift)',
    androidTab: 'Android (Kotlin, referencia)',
    iosIntro:
      'Versión reducida del ejecutable <c>examples/mock-app/Sources/RWDMockApp/RWDNative.swift</c> del repositorio (la app de prueba usa la misma interfaz):',
    androidWarning:
      'Es una implementación de referencia que no se ha compilado en un proyecto Android real. Su interfaz coincide con la versión de iOS; adáptala a la estructura de tu proyecto.',
    eventsTitle: 'Eventos que hay que gestionar de forma nativa',
    eventsHead: ['Escenario', 'Qué hacer'],
    statusBar: 'Barra de estado',
    statusBarBody:
      'Consulta <c>status()</c> periódicamente: si <c>control</c> es observe, muestra “IA mirando”; si es agent, muestra “IA con el control” y bloquea el botón Atrás; si es user, muestra “Tomaste el control”.',
    attach: 'Aprobación de conexión',
    attachBody:
      "<c>pending.kind === 'attach'</c>: muestra <c>pending.levels</c> (el último es el que solicitó el agente); cuando el usuario elija un nivel, llama a <c>nativeDecide(key, requestId, level)</c>, o pasa null para denegar.",
    confirm: 'Confirmación de acción',
    confirmBody:
      "<c>pending.kind === 'confirm'</c>: muestra <c>pending.action</c> (p. ej. tocar “Realizar pedido”); pasa <c>'allow'</c> para permitir o null para denegar.",
    control: 'Tomar el control / devolver el control / finalizar',
    controlBody: "<c>nativeControl(key, 'takeover' | 'handback' | 'end')</c>; devuelve false si la clave es incorrecta.",
    screenshot: 'Capturas de pantalla',
    screenshotBody:
      'En iOS, registra <c>webkit.messageHandlers.rwdScreenshot</c> (con respuesta); en Android, proporciona <c>window.RWDAndroid.screenshot()</c>. Ambos devuelven una URL de datos JPEG/PNG.',
    help: 'Pedir ayuda',
    helpBody: 'Haz que la opción de ayuda propia de la app llame a <c>help(true)</c>; la política del proyecto puede controlar quién la ve por userId.',
  },

  mcp: {
    lead: 'El gateway incluye un servidor MCP alojado (Streamable HTTP) en la URL de tu gateway más /mcp. Cada sesión de MCP está vinculada a una clave de API y ve todos los dispositivos del gateway: basta con un servidor MCP, no hace falta separarlo por proyecto.',
    keyTitle: '1. Crea una clave de API',
    keyBody:
      'Créala en la página <link>Claves de API</link>. La clave completa solo se muestra una vez, así que guárdala enseguida; si la pierdes, revócala y crea una nueva.',
    keyHead: ['Ajuste', 'Descripción'],
    maxLevel: 'Nivel máximo',
    maxLevelBody:
      '<observe></observe> depuración de solo lectura <interact></interact> reproducir problemas (predeterminado) <advanced></advanced> ejecutar scripts, leer cuerpos de solicitudes y almacenamiento',
    expiry: 'Caducidad',
    expiryBody: 'De forma predeterminada, 90 días; elige 7, 30 o 90 días, o sin caducidad. Una vez caducada, MCP devuelve 401.',
    ipAllowlist: 'IP permitidas',
    ipAllowlistBody: 'Opcional, un CIDR por línea. Si se configura, solo estas IP de salida pueden usar la clave.',
    claudeTitle: '2. Añádelo a Claude Code',
    hostedIntro: 'Modo alojado, sin instalar nada (recomendado):',
    replaceKey:
      'Sustituye <c>rwd_sk_live_…</c> por tu clave. <c>--scope project</c> lo escribe en el <c>.mcp.json</c> del proyecto para compartirlo con tu equipo (no subas la clave al repositorio). El <c>.mcp.json</c> equivalente:',
    clientsTitle: '3. Otros clientes',
    stdioTab: 'Clientes solo stdio',
    localTab: 'Puente stdio local',
    cursorBody:
      'Añádelo a <c>~/.cursor/mcp.json</c> (global) o a <c>.cursor/mcp.json</c> en tu proyecto. La mayoría de los clientes que admiten MCP remoto usan este formato:',
    stdioBody:
      'Los clientes que solo pueden lanzar comandos locales (p. ej. <c>claude_desktop_config.json</c> de Claude Desktop) pueden usar <c>rwd mcp</c> como puente:',
    localBody:
      '<c>rwd</c> es el propio binario del gateway (su subcomando <c>rwd mcp</c>). Solo reenvía stdio al <c>/mcp</c> alojado y lee la clave de la variable de entorno <c>RWD_API_KEY</c>:',
    checkTitle: '4. Comprueba la conexión',
    promptsTitle: '5. Pídeselo sin más',
    promptsIntro:
      'El agente elige las herramientas por sí mismo: list_devices para encontrar el dispositivo, connect_device para conectarse (esperando la aprobación del usuario), y después instantáneas, registros y acciones en la página. Prueba algo como:',
    prompts: [
      'Lista los dispositivos en línea, conéctate a GSJH-EV2J y averigua por qué el total del pago muestra --',
      'El usuario u_20391 está pidiendo ayuda. Conéctate a su dispositivo, reproduce “Realizar pedido no hace nada” y encuentra la causa raíz',
      'Conéctate a K7Q2-9M4X solo con acceso Solo ver y resume los errores de console y las solicitudes fallidas de la página actual',
      'En la página del producto, elige la opción de caja regalo y haz un pedido para reproducir el problema; avísame cuando necesites que tome el control',
      'Espera a que GSJH-EV2J esté en línea, conéctate, abre la página de la promoción y canjea un cupón; después vuelve a la página de la lista',
      'Mira la cronología de este dispositivo de los últimos 10 minutos y reconstruye cómo acabó el usuario en una página en blanco',
    ],
    copyPrompt: 'Copiar esta instrucción',
  },

  tools: {
    lead: 'Cada resultado de herramienta termina con los “cambios de sesión”: páginas abiertas, errores, tomas de control del usuario, etc. desde la llamada anterior, así el agente nunca se pierde lo que ocurre en el dispositivo. Las herramientas por encima del nivel de la conexión devuelven un error y quedan en el registro de auditoría.',
    groups: {
      device: 'Dispositivos y conexión',
      observe: 'Observar',
      interact: 'Interactuar',
      advanced: 'Avanzado',
    },
    desc: {
      listDevices: 'Lista los dispositivos, primero los que piden ayuda',
      connectDevice:
        'Se conecta por código de dispositivo o deviceId; con la aprobación activada, espera a que el usuario confirme en el dispositivo (unos 35 segundos como máximo)',
      disconnectDevice: 'Abandona el dispositivo; la página del usuario vuelve a estar inactiva',
      waitForDevice: 'Espera a que un dispositivo esté en línea; a un dispositivo en sondeo se le pide que se reconecte de inmediato',
      listPages: 'Páginas del dispositivo: etiqueta, título, URL, primer plano / segundo plano, quién la abrió',
      selectPage: 'Cambia la página sobre la que actúan las herramientas siguientes (p. ej. p2)',
      waitForPage: 'Espera a que se abra una página nueva o a una navegación a una URL de destino',
      waitForControl: 'Cuando el usuario toma el control, espera a que lo devuelva',
      waitForEvent: 'Espera el siguiente evento de la cronología que coincida (navegación, error, solicitud fallida…)',
      getSessionTimeline: 'Cronología entre páginas que reconstruye el recorrido del usuario',
      takeSnapshot: 'Instantánea de accesibilidad de la página (YAML), con ref de elementos para click / fill',
      takeScreenshot: 'Captura de pantalla; píxeles reales cuando la app proporciona un puente de capturas',
      findElements: 'Busca elementos por texto o rol y devuelve sus ref; más barato que una instantánea completa',
      listConsoleMessages: 'Registros de console y errores no capturados; scope=session abarca todas las páginas',
      listNetworkRequests: 'Solicitudes fetch / XHR / WebSocket y otras',
      waitFor: 'Espera a que un texto aparezca o desaparezca, o unos segundos',
      clickHover: 'Clic / pasar el puntero. La primera interacción pasa la página a “IA con el control”',
      fill: 'Vacía y rellena; funciona con campos controlados de React / Vue',
      typeText: 'Escribe carácter a carácter, disparando eventos de teclado',
      pressKey: 'Pulsa una tecla, incluidas combinaciones como Control+A',
      selectOption: 'Elige en una lista desplegable',
      scrollDrag: 'Desplaza la página o un elemento / arrastra',
      navigation: 'Navegar, volver atrás, recargar',
      batchActions: 'Ejecuta varias interacciones en orden y responde una sola vez, ahorrando idas y vueltas',
      evaluateScript: 'Ejecuta JS en la página y devuelve JSON',
      getNetworkRequest: 'Encabezados y cuerpo de la solicitud y la respuesta (encabezados sensibles enmascarados, cuerpo de hasta 64 KB)',
      getStorage: 'Lee localStorage, sessionStorage o cookies no HttpOnly (enmascarados)',
    },
    anyLevel: 'Cualquier nivel',
    anyLevelTitle: 'Disponible en todos los niveles',
    effectiveLevel:
      'Nivel efectivo de una conexión = min(el <c>level</c> que solicita el agente, el nivel máximo de la clave de API, el nivel máximo del proyecto de cada página del dispositivo, el nivel que aprobó el usuario). Lo aplican tanto el gateway como el SDK de la página.',
  },

  approval: {
    lead: 'Desde el lado del usuario, todo lo que hace la IA es visible y se puede detener en cualquier momento. La aprobación está activada de forma predeterminada en los proyectos nuevos.',
    requestTitle: 'La IA pide conectarse',
    requestBody:
      'Cuando el agente llama a <c>connect_device</c>, la página en primer plano del dispositivo muestra “Bot de soporte quiere ver y controlar esta página”, y el usuario elige entre <levels></levels> (solo aparecen los niveles que permiten la clave y el proyecto). Si en el mismo dispositivo hay abiertas páginas de varios proyectos, se aplica la política más estricta: si algún proyecto requiere aprobación, hace falta aprobación, y el nivel, la vuelta por inactividad y el tiempo máximo de conexión toman el valor más pequeño. El diálogo solo acepta toques reales del usuario; los clics sintetizados por el agente se ignoran.',
    levelChoice: (label) => `“${label}”`,
    timeout:
      '30 segundos sin respuesta cuentan como denegación. <b>Tras 3 denegaciones seguidas para la misma clave de API en el mismo dispositivo, no se pide ninguna aprobación nueva durante 10 minutos</b>; la conexión falla de inmediato.',
    activeTitle: 'IA mirando → IA con el control',
    activeBody:
      'Tras la aprobación, la píldora muestra “IA mirando”. Con el primer clic, pulsación de tecla u otra interacción del agente, pasa a “IA con el control”: un halo azul amplio y pulsante ilumina los bordes de la página y una capa transparente bloquea la interacción del usuario, dejando solo Tomar el control y Finalizar. Antes de cada acción aparece un cursor de IA que se desliza hasta el destino y etiqueta la acción (p. ej. tocar “Realizar pedido”), con una onda en cada toque. Tras 2 minutos sin actividad del agente vuelve a Solo ver (configurable por proyecto); una conexión dura como máximo 60 minutos (configurable por proyecto).',
    takeoverTitle: 'El usuario toma el control y lo devuelve',
    takeoverBody:
      'Cuando el usuario toca Tomar el control, el halo pasa a naranja fijo y las herramientas de interacción del agente devuelven un error <c>takeover</c>; el agente debe llamar a <c>wait_for_control</c> para esperar. Cuando el usuario toca Devolver el control, el agente continúa (idealmente tras una instantánea nueva y un vistazo a la cronología para ver qué hizo el usuario). Tocar Finalizar desconecta al agente.',
    confirmTitle: 'Confirmación de acciones sensibles',
    confirmBody:
      'Antes de que el agente haga clic en un elemento con <c>data-rwd-confirm</c> o que coincida con los <c>confirmSelectors</c> del proyecto (o pulse Enter para enviar un formulario así), el dispositivo pregunta: “La IA quiere tocar ‘Realizar pedido’. ¿Lo permites?”. Si el usuario lo deniega, la herramienta devuelve “El usuario denegó esta acción”. Mientras se espera la confirmación, el tiempo de espera de esa llamada se amplía a 40 segundos.',
    footer:
      'Puedes desconectar al agente en cualquier momento con Finalizar sesión en la página del dispositivo de la consola. Cada conexión, aprobación y acción queda en el <link>registro de auditoría</link> (sin el contenido de la página ni los valores de los parámetros).',
  },

  verify: {
    lead: 'Repásalos en orden antes de pasar a producción. Si todos los pasos funcionan, toda la cadena funciona.',
    gateway: 'El gateway es accesible',
    sdk: 'El SDK está en línea en la página',
    sdkBody:
      'En las herramientas para desarrolladores de la página, ejecuta <c>RemoteWebviewDebugger.status().status</c>. Debe ser <c>"online"</c> (o <c>"polling"</c>: WebSocket está bloqueado, así que funciona pero más lento).',
    console: 'La consola encuentra el dispositivo',
    consoleBody:
      'Busca el código de dispositivo o el userId en la página <link>Dispositivos</link>. Debe aparecer en línea, con el sistema operativo y la versión de la app correctos.',
    test: 'Probar conexión funciona',
    testBody: 'Abre el dispositivo y haz clic en Probar conexión. Muestra que la conexión es correcta y una instantánea de la página.',
    mcp: 'MCP está conectado',
    mcpBody: 'rwd aparece como Connected en <c>claude mcp list</c>.',
    agent: 'El agente puede conectarse',
    agentBody:
      'Pide al agente que “liste los dispositivos en línea y se conecte a XXXX-XXXX”. Aparece un aviso de aprobación en el dispositivo; una vez permitido, el agente obtiene una instantánea.',
  },

  troubleshoot: {
    lead: 'Cuando un dispositivo no se conecta o un agente no puede conectarse, casi siempre se debe a una de las causas siguientes.',
    offlineTitle: 'El dispositivo nunca aparece en línea',
    offlineHead: ['Síntoma', 'Causa y solución'],
    handshake401: 'Handshake 401',
    handshake401Body:
      'Clave de app incorrecta, o el proyecto está deshabilitado. Al rotar la clave, la antigua deja de valer de inmediato, así que actualízala en tu página / app.',
    handshake403: 'Handshake 403',
    handshake403Body:
      'El Origin de la página no está en los orígenes permitidos. Añade esquema + host + puerto, o vacía la lista para quitar la restricción.',
    refused: '<c>Refused to connect</c> en la console',
    refusedBody:
      'Lo bloquea la CSP de la página. Como se indica arriba, añade las URL https:// y wss:// del gateway a <c>script-src</c> y <c>connect-src</c>.',
    undefined: '<c>RemoteWebviewDebugger</c> no está definido',
    undefinedBody:
      'El SDK no se cargó: URL incorrecta, bloqueado por un bloqueador de contenido o (con inyección nativa) la página se cargó antes de que terminara de descargarse el SDK.',
    polling: 'status se queda en <c>polling</c>',
    pollingBody:
      'Una red o un proxy bloquea WebSocket. El dispositivo sigue apareciendo en línea (sondeando cada 60 segundos), y cuando un agente se conecta, el gateway le indica que vuelva a intentar WebSocket de inmediato.',
    outdated: 'SDK desactualizado',
    outdatedBody: 'Una versión fijada del SDK puede ser incompatible con el gateway. Cambia a /v1/sdk.js o actualiza la versión y el integrity.',
    testTimeout: 'En línea, pero la prueba agota el tiempo',
    testTimeoutBody:
      'El JS de la WebView se pausa mientras la app está en segundo plano. Pide al usuario que traiga la app al primer plano y se quede en una página con el SDK, y vuelve a intentarlo.',
    closeCodesTitle: 'Códigos de cierre de WebSocket',
    closeCodesHead: ['Código', 'Significado', 'Solución'],
    code4401: 'Falta el token de dispositivo (deviceToken) o no coincide',
    code4401Fix:
      'La app debe guardar status().deviceToken y volver a pasarlo a run() en cada WebView; el SDK pasa a rejected y reintenta tras unos 10 minutos',
    code4409: 'Reanudación no coincidente (alguien se conectó con el mismo pageId)',
    code4409Fix:
      'El SDK se reconecta por sí solo con un pageId nuevo; si ocurre de vez en cuando, no hay que hacer nada. Si pasa a menudo, se está copiando el sessionStorage',
    code4429: 'Supera la cuota de dispositivos en línea del proyecto',
    code4429Fix: 'Aumenta “Máximo de dispositivos en línea” en los Ajustes del proyecto; el SDK pasa a quota y reintenta tras unos 5 minutos',
    agentTitle: 'Errores en el lado del agente',
    agentHead: ['Error', 'Causa y solución'],
    mcp401: 'MCP devuelve 401',
    mcp401Body: 'La clave está mal escrita, revocada o caducada, o la IP de salida no está en la lista de IP permitidas.',
    level: 'Requiere el nivel advanced…',
    levelBody:
      'La herramienta está por encima del nivel de esta conexión. Vuelve a solicitarlo con una clave de nivel más alto y connect_device(level); el usuario también debe aprobar ese nivel.',
    denied: 'El usuario denegó / la aprobación agotó el tiempo',
    deniedBody: 'El usuario denegó en el dispositivo o no respondió en 30 segundos; tras 3 seguidas se bloquea durante 10 minutos.',
    takeover: 'El usuario tomó el control; llama a wait_for_control para esperar a que lo devuelva.',
    notFound: 'La ref está obsoleta (la página cambió); vuelve a llamar a take_snapshot o find_elements.',
    notInteractable: 'El elemento está oculto, deshabilitado o cubierto; desplázate primero o cierra la capa superpuesta.',
    testTitle: 'Usa Probar conexión para encontrar el tramo que falla',
    testBody:
      'La página del dispositivo y la página Integración del proyecto tienen Probar conexión: el gateway envía una solicitud de instantánea a la página actual del dispositivo. Si funciona, dispositivo ↔ gateway está bien y el problema es MCP o la clave; si falla, revisa el código de error: <c>device_offline</c>, <c>no_page</c> (la página se está reconectando), <c>timeout</c>, <c>takeover</c>.',
    stuck: '¿Sigue sin funcionar?',
    openIntegration: 'Verificar en directo en la página Integración del proyecto',
    viewDevices: 'Ver dispositivos en línea',
  },
}
