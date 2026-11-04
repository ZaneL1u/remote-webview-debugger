import type { common as en } from '../en/common'

export const common: typeof en = {
  cancel: 'Cancelar',
  save: 'Guardar',
  create: 'Crear',
  delete: 'Eliminar',
  close: 'Cerrar',
  copy: 'Copiar',
  copied: 'Copiado al portapapeles',
  copyFailed: 'No se pudo copiar. Selecciona el texto y cópialo manualmente.',
  retry: 'Reintentar',
  loadFailed: 'No se pudo cargar',
  unknown: 'Desconocido',
  disabled: 'Deshabilitado',
  online: 'En línea',
  offline: 'Sin conexión',

  time: {
    justNow: 'justo ahora',
    secondsAgo: (n) => `hace ${n} s`,
    minutesAgo: (n) => `hace ${n} min`,
    hoursAgo: (n) => `hace ${n} h`,
    daysAgo: (n) => (n === 1 ? 'hace 1 día' : `hace ${n} días`),
    expired: 'Caducado',
    inMinutes: (n) => `en ${n} min`,
    inHours: (n) => `en ${n} h`,
    inDays: (n) => (n === 1 ? 'en 1 día' : `en ${n} días`),
    seconds: (n) => `${n} s`,
    minutes: (n) => `${n} min`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    hours: (n) => `${n} h`,
    daysHours: (d, h) => `${d} d ${h} h`,
    days: (n) => (n === 1 ? '1 día' : `${n} días`),
  },

  unknownDevice: 'Dispositivo desconocido',

  control: {
    none: 'Inactivo',
    observe: 'IA mirando',
    agent: 'IA con el control',
    user: 'El usuario tomó el control',
  },

  roles: {
    owner: 'Propietario',
    admin: 'Administrador',
    member: 'Miembro',
  },
  roleDescriptions: {
    owner: 'Acceso total, incluido invitar miembros, cambiar roles y quitar miembros.',
    admin: 'Gestiona proyectos, claves de API, políticas de acceso, dispositivos e invitaciones; puede abrir DevTools en las páginas de los dispositivos y ver el registro de auditoría y la lista de miembros.',
    member: 'Ve proyectos y dispositivos; puede invitar a usuarios a conectarse, probar conexiones, finalizar sesiones y ver el registro de auditoría.',
  },

  levels: {
    observe: {
      label: 'Solo ver',
      description: 'Instantáneas, capturas de pantalla, console, la lista de solicitudes de red, esperar un texto. No puede cambiar la página.',
    },
    interact: {
      label: 'Ver e interactuar',
      description: 'Todo lo de Solo ver, además de hacer clic, escribir, seleccionar, desplazar, arrastrar, navegar, volver atrás y recargar.',
    },
    advanced: {
      label: 'Avanzado',
      description: 'Todo lo de Ver e interactuar, además de ejecutar JS arbitrario en la página, leer encabezados y cuerpos de solicitudes, y localStorage / cookies.',
    },
  },
  levelTitle: (label, level, description) => `${label} (${level}): ${description}`,

  maskPresets: {
    phone: 'Número de teléfono (CN)',
    idCard: 'Número de documento de identidad (CN)',
    bankCard: 'Número de tarjeta bancaria',
    email: 'Correo electrónico',
  },
  regex: {
    empty: 'Introduce una expresión regular',
    matchesEmpty: 'Coincide con la cadena vacía, lo que enmascararía todo el texto',
    syntax: (detail) => `Expresión regular no válida: ${detail}`,
    lookaround: 'No se admiten aserciones de búsqueda ((?=, (?!, (?<=, (?<!); el gateway usa la sintaxis RE2',
    backreference: 'No se admiten referencias inversas (\\1, etc.); el gateway usa la sintaxis RE2',
  },

  badges: {
    help: 'En asistencia',
    agentWithName: (label, agent) => `${label} (${agent})`,
    waitingConfirmAction: 'Esperando que el usuario confirme la acción',
    waitingConfirm: 'Esperando la aprobación del usuario',
    waitingDevtools: 'Esperando que el usuario apruebe DevTools',
    waitingTitle: (agent) => `${agent} espera que el usuario apruebe en el dispositivo`,
    invited: 'Invitado',
    invitedTitle: 'Conectado mediante un enlace de invitación',
  },

  api: {
    network: 'No se puede acceder al gateway. Revisa tu conexión de red.',
    unauthorized: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    forbidden: 'No tienes permiso para hacer eso.',
    notFound: 'No encontrado',
    server: 'Error del gateway. Vuelve a intentarlo más tarde.',
    failed: (status) => `La solicitud falló (HTTP ${status})`,
    unknown: 'Error desconocido',
    adminName: 'Administrador',
  },
}
