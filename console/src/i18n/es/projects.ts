import type { projects as en } from '../en/projects'

export const projects: typeof en = {
  title: 'Proyectos',
  name: 'Nombre del proyecto',
  newProject: 'Nuevo proyecto',
  optional: '(opcional)',
  onlineCount: (online, total) => `<n>${online}</n> en línea / ${total} ${total === 1 ? 'dispositivo' : 'dispositivos'}`,

  list: {
    description:
      'Cada proyecto es una app o un sitio, con su propia clave de app, su política de acceso y sus invitaciones. Todos los dispositivos aparecen en la página Dispositivos.',
    emptyTitle: 'Todavía no hay proyectos',
    emptyManage: 'Crea un proyecto para obtener una clave de app y código de integración listo para usar. Tu primer dispositivo puede estar en línea en minutos.',
    emptyMember: 'Los proyectos aparecerán aquí cuando un administrador los cree.',
  },

  create: {
    description: 'Al crear un proyecto se generan una clave de app (rwd_pk_…) y el código de integración.',
    nameRequired: 'Introduce un nombre de proyecto',
    invalidOrigins: (bad) => `Origen no válido: ${bad.join(', ')}`,
    namePlaceholder: 'p. ej. App de la tienda',
    originsLabel: 'Orígenes permitidos',
    originsHint: 'Uno por línea. Déjalo vacío para permitir cualquier origen; si lo configuras, solo podrán conectarse las páginas de estos orígenes.',
    created: (name) => `Proyecto “${name}” creado`,
  },

  detail: {
    notFoundTitle: 'Proyecto no encontrado',
    notFoundDescription: 'Puede que se haya eliminado.',
    backToList: 'Volver a proyectos',
    tabs: {
      integration: 'Integración',
      devices: 'Dispositivos',
      invites: 'Invitaciones',
      audit: 'Registro de auditoría',
      settings: 'Ajustes',
    },
  },

  keys: {
    title: 'Claves de API',
    pageDescription:
      'Para conectar agentes a través de MCP. Las claves pertenecen a todo el gateway, no a un proyecto: una clave y un servidor MCP llegan a todos los dispositivos.',
    description:
      'Los agentes usan una clave para conectarse a través de MCP. Una clave ve todos los dispositivos del gateway, de todos los proyectos. Mantén las claves en secreto y revoca la que se filtre de inmediato.',
    readOnly: ' Tu rol solo puede ver las claves; para crearlas y revocarlas hace falta un administrador.',
    createKey: 'Crear clave',
    emptyTitle: 'Todavía no hay claves de API',
    emptyDescription: 'Crea una clave y copia el comando de configuración de MCP para tu agente.',

    columns: {
      name: 'Nombre',
      key: 'Clave',
      level: 'Nivel',
      expiry: 'Caducidad',
      ipAllowlist: 'IP permitidas',
      lastUsed: 'Último uso',
      status: 'Estado',
      actions: 'Acciones',
    },
    createdOn: (date) => `Creada el ${date}`,
    neverUsed: 'Nunca usada',
    usedAgo: (ago) => `último uso ${ago}`,

    neverExpires: 'No caduca',
    expiresAtTitle: (date) => `Caduca el ${date}`,
    expiredOn: (date) => `Caducó el ${date}`,
    expiresIn: (until) => `Caduca ${until}`,
    anyIp: 'Cualquier IP',

    revoked: 'Revocada',
    revokedTitle: (date) => `Revocada el ${date}`,
    expired: 'Caducada',
    expiredTitle: (date) => `Caducó el ${date}`,
    active: 'Activa',

    revoke: 'Revocar',
    revokedToast: (name) => `“${name}” revocada`,
    revokeTitle: (name) => `¿Revocar “${name}”?`,
    revokeDescription: (prefix) => `Las sesiones de MCP que usan <c>${prefix}…</c> dejan de funcionar de inmediato. No se puede deshacer.`,

    mcpTabs: {
      hosted: 'Alojado',
      local: 'stdio local',
      json: 'Configuración JSON',
    },
    hostedHint: 'Claude Code se conecta directamente al MCP alojado del gateway (Streamable HTTP), sin instalar nada:',
    localHint: 'Requiere el comando <c>rwd</c> en tu equipo; reenvía stdio al /mcp alojado:',
    jsonHint: 'Para otros clientes que leen un archivo de configuración mcpServers:',

    createdTitle: 'Clave de API creada',
    createdName: (name) => name,
    showOnce:
      '<b>Es la única vez que se muestra la clave completa.</b> No podrás volver a verla después de cerrar, así que cópiala ahora y guárdala en un lugar seguro. Si la pierdes, revócala y crea una nueva.',
    maxPrefix: 'Máx. ',
    keyLabel: 'Clave de API',
    commandLabel: 'Comando de configuración de MCP (incluye la clave)',
    savedClose: 'Ya la guardé, cerrar',

    createTitle: 'Crear clave de API',
    createDescription: 'Ponle a la clave un nombre que te permita reconocerla y revocarla más adelante, p. ej. el del agente o la persona que la usa.',
    nameRequired: 'Introduce un nombre',
    invalidCidrs: (bad) => `Entrada de IP permitida no válida: ${bad.join(', ')} (usa notación CIDR, p. ej. 203.0.113.0/24)`,
    namePlaceholder: 'p. ej. Bot de soporte',
    maxLevel: 'Nivel de permiso máximo',
    advancedWarning:
      '<b>Avanzado puede ejecutar JS arbitrario en la página del usuario y leer cookies y cuerpos de solicitudes</b>, lo que equivale a tener la sesión iniciada del usuario en esa página. Dáselo solo a agentes de confianza y combínalo con una lista de IP permitidas y una caducidad corta.',
    levelHint: 'El nivel efectivo también está limitado por el nivel máximo del proyecto al que pertenece la página; se aplica el más restrictivo.',
    neverWarning:
      'Una clave que no caduca sigue siendo válida si se filtra, hasta que alguien la revoque. Es preferible fijar una caducidad y crear una clave nueva antes de que venza.',
    expiresAround: (date) => `Caduca alrededor del ${date}. Después, MCP devuelve 401.`,
    ipHint:
      'Un CIDR por línea; una IP suelta cuenta como /32 (/128 en IPv6). Déjalo vacío para no restringir; si lo configuras, las llamadas a MCP desde otras IP reciben 401.',

    guideTitle: 'Úsala en tu agente',
    guideDescription: (placeholder) =>
      `Sustituye <c>${placeholder}</c> en los comandos de abajo por tu clave de API. Un único servidor MCP llega a todos los dispositivos: un teléfono que abre páginas de distintos proyectos mantiene el mismo código de dispositivo. Consulta la <link>guía de integración</link> para ver la lista completa de herramientas, los niveles de permiso y el flujo de aprobación.`,
    commonTools: 'Herramientas habituales',
    tools: {
      list: 'Filtrar dispositivos por estado, userId o código de dispositivo',
      connect: 'Conectarse a un dispositivo por su código; si está sin conexión, esperar a que esté en línea',
      pages: 'Listar y cambiar de página en el dispositivo (p1, p2…)',
      snapshot: 'Obtener una instantánea de la página (con ref) o una captura de pantalla',
      act: 'Actuar sobre la página; la primera acción pasa la página a “IA con el control”',
      logs: 'Ver la salida de console, los errores y las solicitudes de red',
      timeline: 'Cronología entre páginas que reconstruye los pasos del usuario',
      control: 'Cuando el usuario toma el control, esperar a que lo devuelva',
    },
    tryTitle: 'Prueba a decirle esto a tu agente',
    tryExample: '“Lista los dispositivos en línea, conéctate a GSJH-EV2J y averigua por qué el total del pago muestra --”',
  },

  policy: {
    title: 'Política de acceso',
    description:
      'Controla si los agentes pueden conectarse, qué pueden hacer y qué pueden ver. Los cambios se aplican de inmediato a las conexiones nuevas; las sesiones existentes conservan su nivel.',
    readOnly: 'Tu rol solo puede ver la política de acceso; para cambiarla hace falta un administrador o el propietario.',
    saved: 'Política de acceso guardada. Se aplica de inmediato a las conexiones nuevas.',
    invalid: 'Algunos ajustes no son válidos. Revisa los campos marcados en rojo.',
    invalidSelectors: (bad) => `No es un selector CSS válido: ${bad.join(', ')}`,
    nameRequired: 'Introduce un nombre',
    duplicateName: 'Nombre duplicado',
    intRange: (min, max) => `Introduce un número entero entre ${min} y ${max}`,
    invalidUrl: 'Debe empezar por http:// o https://',

    approval: {
      title: 'Aprobación de conexiones',
      description:
        'Si el usuario debe aprobar en el dispositivo cuando un agente se conecta con un código de dispositivo. El aviso solo responde a toques reales del usuario; un agente no puede tocarlo por él.',
      prompt: 'Preguntar al usuario (recomendado)',
      promptDescription:
        'La página en primer plano muestra un aviso, y el agente solo se conecta después de que el usuario elija un nivel que permitir. Si no responde en 30 segundos, cuenta como denegación. Tras 3 denegaciones seguidas para la misma clave, los avisos se pausan durante 10 minutos.',
      none: 'Sin aprobación',
      noneDescription: 'Cualquier agente que conozca el código de dispositivo puede conectarse directamente. Solo para entornos de prueba internos.',
    },

    maxLevel: {
      title: 'Nivel de permiso máximo',
      description:
        'El nivel más alto que permite este proyecto. Una conexión recibe el menor de cuatro: el que solicita el agente, el que permite su clave de API, el configurado aquí y el que aprueba el usuario.',
      advancedWarning:
        'Avanzado permite a los agentes ejecutar JS arbitrario y leer cookies y cuerpos de solicitudes, lo que equivale a la sesión iniciada del usuario en la página. Actívalo solo cuando de verdad lo necesites.',
    },

    masking: {
      title: 'Enmascaramiento de privacidad',
      description:
        'Los campos de contraseña y los elementos con el atributo data-rwd-mask siempre se muestran como •••• en instantáneas, capturas de pantalla, console y registros de red. Añade aquí más reglas de enmascaramiento.',
      selectorsLabel: 'Elementos enmascarados (selectores CSS)',
      selectorsHint: 'Uno por línea, p. ej. .user-phone, #id-card.',
      patternsTitle: 'Enmascarar texto con expresiones regulares',
      patternsDescription:
        'El texto que coincida se sustituye por •••• en instantáneas, console y URL de red. Útil para números de teléfono o de documento que aparecen en texto plano. Usa la sintaxis RE2 (sin aserciones de búsqueda ni referencias inversas).',
      patternsList: 'Patrones de enmascaramiento',
      ruleName: (n) => `Nombre de la regla ${n}`,
      ruleRegex: (n) => `Expresión regular de la regla ${n}`,
      removeRule: (n) => `Eliminar la regla ${n}`,
      namePlaceholder: 'Nombre',
      regexPlaceholder: 'Expresión regular, p. ej. 1[3-9]\\d{9}',
      addRule: 'Añadir regla',
      presets: 'Predefinidas:',
      tryLabel: 'Pruébalo: introduce un texto de ejemplo para previsualizar el enmascaramiento',
      sample: 'Ana López 13812345678 ana@example.com DNI 11010119900307123X',
    },

    confirm: {
      title: 'Confirmar acciones sensibles',
      description:
        'Antes de que un agente haga clic en estos elementos (o pulse Enter en su formulario), la página pide al usuario que confirme; si no confirma en 30 segundos, cuenta como denegación. Los elementos con el atributo data-rwd-confirm siempre requieren confirmación.',
      label: 'Elementos que requieren confirmación (selectores CSS)',
      hint: 'Uno por línea, p. ej. botones de pagar, eliminar y realizar pedido.',
    },

    network: {
      title: 'Reglas de exclusión de red',
      description:
        'Las solicitudes que coincidan no aparecen en la lista de red ni en la cronología que ven los agentes (la página las sigue registrando; un agente puede pasar includeExcluded para verlas). Útil para fuentes que siempre dan 404 y balizas de analítica. Las reglas pasadas a run({ networkExclude }) en la página se suman a estas.',
      label: 'Solicitudes excluidas',
      hint: 'Una por línea: un fragmento de URL (sin distinguir mayúsculas y minúsculas), comodines * o /regex/.',
    },

    sessionLog: {
      title: 'Registro de sesión',
      description:
        'Desde cada inicio de la app, las páginas registran en IndexedDB en el teléfono las navegaciones, los toques y entradas del usuario, las acciones del agente, la console y las solicitudes de red (las fallidas, con sus cuerpos). Un agente conectado puede leer todo lo que ocurrió antes de que llegara. Se conservan los 3 últimos inicios, hasta 10 MB cada uno; se aplican las reglas de enmascaramiento.',
      label: 'Guardar un registro de sesión',
      hint: 'Si se desactiva, las páginas dejan de registrar y eliminan los registros que ya hay en el teléfono. Una página concreta también puede excluirse con run({ record: false }).',
    },

    help: {
      title: 'Botón de asistencia',
      description:
        'Un botón flotante “Solicitar asistencia” en la esquina inferior derecha de la página. Cuando el usuario lo toca, el dispositivo se marca como “en asistencia” y pasa al principio de la lista de dispositivos.',
      all: 'Todos los usuarios',
      allDescription: 'Todas las páginas con el SDK muestran el botón de asistencia.',
      listed: 'Usuarios concretos',
      listedDescription: 'Solo se muestra a los userId de la lista de abajo. Útil para despliegues graduales y pruebas beta.',
      off: 'Desactivado',
      offDescription: 'Sin botón flotante. La app puede llamar a help() desde su propia opción de asistencia.',
      usersLabel: 'userId permitidos',
      usersHint: 'Uno por línea, igual que el userId que se pasa a run() / setUser().',
      usersEmpty: 'Con la lista vacía, nadie ve el botón de asistencia.',
    },

    devtools: {
      title: 'DevTools',
      description: 'Los administradores pueden abrir Chrome DevTools en páginas en línea desde los detalles del dispositivo: Elements, Console, Network, almacenamiento y ejecución de scripts.',
      allow: 'Permitir DevTools',
      allowDescription: 'Solo propietarios y administradores pueden abrirlo. Si la aprobación de conexiones está activada, se conecta cuando el usuario acepta en el dispositivo; una aprobación dura la duración máxima de la sesión y el usuario puede finalizarla cuando quiera. DevTools ve la página tal cual: el enmascaramiento no se aplica.',
    },
    eruda: {
      title: 'Integración con eruda',
      description:
        'Cómo funciona el panel de depuración eruda de la página junto con Remote Debugger. run({ eruda }) en el código de la página tiene prioridad sobre estos ajustes.',
      dock: 'Integrar en eruda',
      dockDescription:
        'Añade una pestaña “Remote Debugger” a eruda en lugar del widget flotante. Cuando la IA se conecta, sigue apareciendo la barra de control inferior para que el usuario pueda tomar el control o finalizar en cualquier momento.',
      load: 'Cargar automáticamente la última versión de eruda',
      loadDescription:
        'Si la página no tiene eruda, carga la última versión desde jsDelivr y la inicializa para que los desarrolladores vean la console, la red y el código fuente. Conviene activarlo solo en proyectos de entornos de prueba.',
    },

    limits: {
      title: 'Límites de tiempo y cuotas',
      minutes: 'min',
      devices: '',
      agents: '',
      idle: 'Tiempo de inactividad de la IA',
      idleHint: 'Tras este tiempo sin acciones de la IA, la página vuelve a “IA mirando” y se retira la capa superpuesta. Predeterminado: 2.',
      attach: 'Duración máxima de la sesión',
      attachHint: 'Pasado este tiempo, el agente se desconecta automáticamente, por si nadie finaliza la sesión. Predeterminado: 60.',
      onlineDevices: 'Máximo de dispositivos en línea',
      onlineDevicesHint: 'Por encima de este número se rechazan los dispositivos nuevos (código de cierre 4429). 0 significa sin límite.',
      agentsLabel: 'Máximo de agentes simultáneos',
      agentsHint: 'Agentes conectados a la vez a dispositivos de todo el proyecto. 0 significa sin límite.',
    },

    invite: {
      title: 'Página de invitación',
      description:
        'Los enlaces de invitación abren esta página de forma predeterminada (con el parámetro rwd_invite añadido automáticamente). La página debe tener el SDK integrado.',
      label: 'URL H5 que abren los enlaces de invitación',
      hint: 'Déjalo vacío para introducirla cada vez que crees una invitación.',
    },

    unsaved: 'Cambios sin guardar',
    allSaved: 'Todos los cambios guardados',
    revert: 'Revertir',
    save: 'Guardar política',
  },

  settings: {
    renamed: 'Nombre del proyecto guardado',
    disabledToast: 'Proyecto deshabilitado',
    enabledToast: 'Proyecto habilitado',
    deleted: (name) => `Proyecto “${name}” eliminado`,
    general: 'General',
    meta: (date, id) => `Creado el ${date} · ID del proyecto <c>${id}</c>`,
    disableTitle: 'Deshabilitar el proyecto',
    disableDescription:
      'Mientras esté deshabilitado, las páginas que usan la clave de app de este proyecto no pueden conectarse. Puedes volver a habilitarlo en cualquier momento.',
    running: 'Activo',
    deleteTitle: 'Eliminar el proyecto',
    deleteDescription: 'La clave de app deja de funcionar de inmediato y se eliminan las invitaciones del proyecto. No se puede deshacer.',
    deleteConfirmTitle: (name) => `¿Eliminar el proyecto “${name}”?`,
    deleteConfirmDescription:
      'Se eliminarán la clave de app y las invitaciones, y las páginas que usan esta clave de app ya no podrán conectarse. No se puede deshacer.',
  },
}
