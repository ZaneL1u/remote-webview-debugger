import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// Español (neutro internacional, «tú»).

const ui: UiMessages = {
  levels: {
    observe: 'Solo ver',
    interact: 'Ver e interactuar',
    advanced: 'Avanzado (ejecutar scripts, leer almacenamiento)',
  },
  attachLevels: {
    observe: 'Solo ver',
    interact: 'Ver e interactuar',
    advanced: 'Avanzado (además, ejecutar scripts y leer almacenamiento)',
  },
  state: {
    none: 'Inactivo: no hay ninguna IA conectada',
    observe: 'La IA está viendo esta página',
    agent: 'La IA tiene el control; tu interacción está en pausa',
    user: 'Tomaste el control; la IA está en pausa',
  },
  link: {
    connecting: 'Conectando',
    online: 'En línea',
    offline: 'Sin conexión',
  },
  connecting: 'Conectando…',
  helpPending: 'En asistencia',
  copy: 'Copiar',
  copied: 'Copiado',
  noteHelp: 'Asistencia solicitada. El equipo de desarrollo te encontrará con este código de dispositivo.',
  noteAuto: '“Permitir automáticamente” está activado: la IA se conecta sin preguntar. Puedes tomar el control o finalizar en cualquier momento.',
  noteShare:
    'Comparte este código de dispositivo con el equipo de desarrollo. La IA te pedirá permiso antes de conectarse, y puedes tomar el control o finalizar en cualquier momento.',
  help: 'Solicitar asistencia',
  cancelHelp: 'Cancelar solicitud',
  collapse: 'Ocultar',
  deviceCode: 'Código de dispositivo',
  barViewing: 'IA mirando',
  barAgent: 'IA operando',
  barUser: 'Tu turno',
  connectedFor: time => `Conectado · ${time}`,
  takeover: 'Tomar control',
  handback: 'Devolver',
  end: 'Finalizar',
  autoTitle: 'Permitir IA automáticamente',
  autoOn: level => `Se conecta sin preguntar · ${level}`,
  autoOff: 'Preguntarme cada vez que la IA quiera conectarse',
  lockTitle: 'Bloquear la pantalla mientras la IA esté conectada',
  lockOn: 'Tus toques y deslizamientos se bloquean mientras la IA está conectada',
  lockOff: 'Puedes seguir tocando y desplazándote; intenta no interferir con la IA',
  lockedToast: 'La pantalla se bloqueará mientras la IA esté conectada',
  unlockedToast: 'La pantalla no se bloqueará mientras la IA esté conectada',
  autoOffToast: '“Permitir automáticamente” desactivado. La IA preguntará antes de conectarse',
  autoDialogTitle: '¿Activar “Permitir automáticamente”?',
  autoDialogText:
    'Cuando la IA pida conectarse a este dispositivo, se conectará al instante con el nivel de acceso que elijas abajo. Verás un aviso cada vez, podrás tomar el control o finalizar en cualquier momento y desactivar esto aquí.',
  turnOn: 'Activar',
  cancel: 'Cancelar',
  autoOnToast: level => `“Permitir automáticamente” activado · ${level}`,
  countdown: seconds => `Se denegará en ${seconds} s`,

  agentName: 'Asistente de IA',
  autoAllowedToast: (agent, level) => `“${agent}” se conectó automáticamente · ${level}`,
  attachTitle: 'La IA quiere conectarse',
  attachText: agent => `“${agent}” quiere ver esta página. ¿Lo permites?`,
  confirmTitle: 'Confirma, por favor',
  confirmText: action => `La IA quiere ${action}. ¿Lo permites?`,
  allow: 'Permitir',
  deny: 'Denegar',
  developer: 'Desarrollador',
  devtoolsTitle: 'Un desarrollador quiere depurar',
  devtoolsText: name =>
    `“${name}” quiere inspeccionar esta página con DevTools: podrá ver su estructura, registros, solicitudes de red y almacenamiento local, y ejecutar scripts en ella. ¿Lo permites?`,
  devtoolsToast: name => `“${name}” abrió DevTools`,
  barDevtools: 'Desarrollador depurando',
  nameSep: ', ',
}

const agent: AgentMessages = {
  missingParam: name => `Falta el parámetro: ${name}`,
  notString: name => `El parámetro ${name} debe ser una cadena`,
  unknownMethod: method => `Método desconocido: ${method}`,
  needLevel: level => `Requiere el nivel ${level}`,
  takenOver: 'El usuario tomó el control; espera a que lo devuelva',
  userDenied: 'El usuario denegó esta acción',
  confirmBusy: 'Todavía se espera que el usuario confirme la acción anterior',

  unknownModifier: m => `Tecla modificadora desconocida: ${m}`,
  unknownKey: key => `Tecla desconocida: ${key}`,

  refNotInSnapshot: ref => `ref=${ref} no está en la última instantánea; toma una nueva instantánea`,
  refDetached: ref => `El elemento de ref=${ref} ya no está en la página; toma una nueva instantánea`,
  queryNeedsCriteria: 'Se requiere al menos uno de text, role o name',
  noSuchRecord: seq => `No hay ningún registro seq=${seq} en el registro de sesión (puede que se haya eliminado)`,
  noSuchSession: id => `No hay registro de sesión ${id} en este dispositivo (solo se conservan los 3 últimos inicios)`,
  noSessionLog:
    'Este dispositivo aún no tiene registro de sesión (puede que el proyecto haya desactivado la grabación o que la página haya pasado run({ record: false }))',
  sessionLogUnavailable: 'IndexedDB no está disponible en esta página: no hay registro de sesión',

  readOnly: tag => `${tag} es de solo lectura`,
  isSelect: tag => `${tag} es una lista desplegable; usa rwd.select`,
  notFillable: tag => `${tag} no es un campo de texto y no se puede rellenar`,
  notSelect: tag => `${tag} no es una lista desplegable (select); usa click`,
  singleSelect: 'Esta lista desplegable solo admite una opción',
  noSuchOption: (value, choices) => `La lista desplegable no tiene la opción “${value}”; disponibles: ${choices.join(', ')}`,
  optionDisabled: value => `La opción “${value}” está deshabilitada`,

  badUrl: url => `URL no válida: ${url}`,
  httpOnly: 'Solo se pueden abrir URL http(s)',
  textAppearTimeout: text => `Se agotó el tiempo de espera para que apareciera el texto “${text}”`,
  textGoneTimeout: text => `Se agotó el tiempo de espera para que desapareciera el texto “${text}”`,
  badFunction: message => `No se puede analizar function: ${message}`,
  notAFunction: 'function debe ser una expresión de función, p. ej. "() => document.title"',

  elementDetached: tag => `El elemento ${tag} ya no está en la página; toma una nueva instantánea`,
  notActionable: (tag, reason) => `No se puede operar sobre el elemento ${tag}: ${reason}`,
  notVisible: tag => `El elemento ${tag} no es visible`,
  reasonMoving: 'su posición sigue cambiando (puede que esté en una animación)',
  reasonOffscreen: 'está fuera del área visible',
  reasonObscured: (tag, ref) =>
    `el punto de clic está cubierto por ${tag} (ref=${ref}; haz clic en él directamente, p. ej. en el fondo de una ventana emergente para cerrarla)`,

  overlayHeader:
    '[Capas superpuestas] Estos elementos están encima de la página. Si un clic queda bloqueado, haz clic en ellos directamente (p. ej. en el fondo para cerrar una ventana emergente):',
  overlayMask: (tag, coverage, ref) => `- fondo ${tag}, cubre el ${coverage} % del área visible [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- capa ${tag}${text ? ` “${text}”` : ''}, cubre el ${coverage} % del área visible [ref=${ref}]`,
  reasonHidden: 'no es visible',
  reasonDisabled: 'está deshabilitado',

  storageUnavailable: area => `${area}Storage no está disponible`,
  badStorageArea: "El parámetro area debe ser 'local', 'session' o 'cookie'",

  requestFailed: 'La solicitud falló',
  noSuchRequest: id => `No hay ninguna solicitud con id=${id} (puede que se haya descartado)`,
  netFailed: (what, error) => `${what} → falló (${error})`,
  wsFailed: url => `WebSocket ${url} → falló`,

  tapped: (role, text) => `Toque en ${role} “${text}”`,
  tappedTag: (role, tag) => `Toque en ${role} ${tag}`,
  roles: {
    button: 'botón',
    link: 'enlace',
    textbox: 'campo de texto',
    searchbox: 'campo de búsqueda',
    checkbox: 'casilla de verificación',
    radio: 'botón de opción',
    switch: 'interruptor',
    combobox: 'lista desplegable',
    listbox: 'lista',
    option: 'opción',
    tab: 'pestaña',
    menuitem: 'elemento de menú',
    img: 'imagen',
    heading: 'encabezado',
    cell: 'celda',
    row: 'fila',
    listitem: 'elemento de lista',
  },
  element: 'elemento',
  devtoolsHistory: (count, dropped) =>
    `—— ${count} registros de antes de abrir DevTools (solo texto; los objetos no se pueden expandir${dropped ? `; se descartaron ${dropped} más` : ''}) ——`,
}

const action: ActionMessages = {
  quote: name => `“${name}”`,
  click: target => `tocar ${target}`,
  enterActivate: target => `pulsar Enter en ${target}`,
  enterSubmit: target => `pulsar Enter para enviar ${target}`,
}

const es: Locale = { id: 'es', name: 'Español', dir: 'ltr', ui, action, agent }

export default es
