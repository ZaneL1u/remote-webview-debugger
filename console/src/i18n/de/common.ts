import type { common as en } from '../en/common'

export const common: typeof en = {
  cancel: 'Abbrechen',
  save: 'Speichern',
  create: 'Erstellen',
  delete: 'Löschen',
  close: 'Schließen',
  copy: 'Kopieren',
  copied: 'In die Zwischenablage kopiert',
  copyFailed: 'Kopieren fehlgeschlagen. Markieren Sie den Text und kopieren Sie ihn manuell.',
  retry: 'Erneut versuchen',
  loadFailed: 'Laden fehlgeschlagen',
  unknown: 'Unbekannt',
  disabled: 'Deaktiviert',
  online: 'Online',
  offline: 'Offline',

  time: {
    justNow: 'gerade eben',
    secondsAgo: (n) => `vor ${n} s`,
    minutesAgo: (n) => `vor ${n} Min.`,
    hoursAgo: (n) => `vor ${n} Std.`,
    daysAgo: (n) => (n === 1 ? 'vor 1 Tag' : `vor ${n} Tagen`),
    expired: 'Abgelaufen',
    inMinutes: (n) => `in ${n} Min.`,
    inHours: (n) => `in ${n} Std.`,
    inDays: (n) => (n === 1 ? 'in 1 Tag' : `in ${n} Tagen`),
    seconds: (n) => `${n} s`,
    minutes: (n) => `${n} Min.`,
    hoursMinutes: (h, m) => `${h} Std. ${m} Min.`,
    hours: (n) => `${n} Std.`,
    daysHours: (d, h) => `${d} Tg. ${h} Std.`,
    days: (n) => (n === 1 ? '1 Tag' : `${n} Tage`),
  },

  unknownDevice: 'Unbekanntes Gerät',

  control: {
    none: 'Inaktiv',
    observe: 'KI sieht zu',
    agent: 'KI steuert',
    user: 'Nutzer hat übernommen',
  },

  roles: {
    owner: 'Inhaber',
    admin: 'Admin',
    member: 'Mitglied',
  },
  roleDescriptions: {
    owner: 'Voller Zugriff, einschließlich Mitglieder einladen, Rollen ändern und Mitglieder entfernen.',
    admin: 'Verwaltet Projekte, API-Keys, Zugriffsrichtlinien, Geräte und Einladungen; sieht das Audit-Log und die Mitgliederliste.',
    member: 'Sieht Projekte und Geräte; kann Nutzer zum Verbinden einladen, Verbindungen testen, Sitzungen beenden und das Audit-Log ansehen.',
  },

  levels: {
    observe: {
      label: 'Nur ansehen',
      description: 'Snapshots, Screenshots, Console, Liste der Netzwerkanfragen, Warten auf Text. Kann die Seite nicht verändern.',
    },
    interact: {
      label: 'Ansehen und bedienen',
      description: 'Alles aus „Nur ansehen“, dazu klicken, tippen, auswählen, scrollen, ziehen, navigieren, zurückgehen und neu laden.',
    },
    advanced: {
      label: 'Erweitert',
      description: 'Alles aus „Ansehen und bedienen“, dazu beliebiges JS in der Seite ausführen, Request-Header und -Bodys sowie localStorage / Cookies lesen.',
    },
  },
  levelTitle: (label, level, description) => `${label} (${level}): ${description}`,

  maskPresets: {
    phone: 'Telefonnummer (CN)',
    idCard: 'Ausweisnummer (CN)',
    bankCard: 'Bankkartennummer',
    email: 'E-Mail',
  },
  regex: {
    empty: 'Geben Sie einen regulären Ausdruck ein',
    matchesEmpty: 'Passt auf den leeren String und würde damit den gesamten Text maskieren',
    syntax: (detail) => `Ungültiger regulärer Ausdruck: ${detail}`,
    lookaround: 'Lookarounds ((?=, (?!, (?<=, (?<!) werden nicht unterstützt; das Gateway verwendet RE2-Syntax',
    backreference: 'Rückverweise (\\1 usw.) werden nicht unterstützt; das Gateway verwendet RE2-Syntax',
  },

  badges: {
    help: 'In Betreuung',
    agentWithName: (label, agent) => `${label} (${agent})`,
    waitingConfirmAction: 'Wartet auf Bestätigung der Aktion',
    waitingConfirm: 'Wartet auf Freigabe',
    waitingTitle: (agent) => `${agent} wartet darauf, dass der Nutzer auf dem Gerät zustimmt`,
    invited: 'Eingeladen',
    invitedTitle: 'Über einen Einladungslink verbunden',
  },

  api: {
    network: 'Gateway nicht erreichbar. Prüfen Sie Ihre Netzwerkverbindung.',
    unauthorized: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    forbidden: 'Dazu fehlt Ihnen die Berechtigung.',
    notFound: 'Nicht gefunden',
    server: 'Gateway-Fehler. Bitte versuchen Sie es später erneut.',
    failed: (status) => `Anfrage fehlgeschlagen (HTTP ${status})`,
    unknown: 'Unbekannter Fehler',
    adminName: 'Administrator',
  },
}
