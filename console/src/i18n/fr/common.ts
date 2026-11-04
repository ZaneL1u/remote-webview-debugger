import type { common as en } from '../en/common'

/** French plural: 0 and 1 take the singular. */
const pl = (n: number, one: string, other: string) => (n < 2 ? one : other)

export const common: typeof en = {
  cancel: 'Annuler',
  save: 'Enregistrer',
  create: 'Créer',
  delete: 'Supprimer',
  close: 'Fermer',
  copy: 'Copier',
  copied: 'Copié dans le presse-papiers',
  copyFailed: 'Impossible de copier. Sélectionnez le texte et copiez-le manuellement.',
  retry: 'Réessayer',
  loadFailed: 'Impossible de charger',
  unknown: 'Inconnu',
  disabled: 'Désactivé',
  online: 'En ligne',
  offline: 'Hors ligne',

  time: {
    justNow: 'à l’instant',
    secondsAgo: (n) => `il y a ${n} s`,
    minutesAgo: (n) => `il y a ${n} min`,
    hoursAgo: (n) => `il y a ${n} h`,
    daysAgo: (n) => `il y a ${n} ${pl(n, 'jour', 'jours')}`,
    expired: 'Expiré',
    inMinutes: (n) => `dans ${n} min`,
    inHours: (n) => `dans ${n} h`,
    inDays: (n) => `dans ${n} ${pl(n, 'jour', 'jours')}`,
    seconds: (n) => `${n} s`,
    minutes: (n) => `${n} min`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    hours: (n) => `${n} h`,
    daysHours: (d, h) => `${d} j ${h} h`,
    days: (n) => `${n} ${pl(n, 'jour', 'jours')}`,
  },

  unknownDevice: 'Appareil inconnu',

  control: {
    none: 'Inactif',
    observe: 'IA en consultation',
    agent: 'IA aux commandes',
    user: 'Reprise par l’utilisateur',
  },

  roles: {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    member: 'Membre',
  },
  roleDescriptions: {
    owner: 'Accès complet, y compris inviter des membres, modifier leurs rôles et les retirer.',
    admin: 'Gère les projets, les clés d’API, les politiques d’accès, les appareils et les invitations ; peut ouvrir DevTools sur les pages des appareils et consulter le journal d’audit et la liste des membres.',
    member: 'Voit les projets et les appareils ; peut inviter des utilisateurs à se connecter, tester les connexions, terminer des sessions et consulter le journal d’audit.',
  },

  levels: {
    observe: {
      label: 'Consultation seule',
      description: 'Instantanés, captures d’écran, console, liste des requêtes réseau, attente d’un texte. Ne peut pas modifier la page.',
    },
    interact: {
      label: 'Consultation et interaction',
      description: 'Tout ce que permet Consultation seule, plus cliquer, saisir, sélectionner, faire défiler, faire glisser, naviguer, revenir en arrière et recharger.',
    },
    advanced: {
      label: 'Avancé',
      description: 'Tout ce que permet Consultation et interaction, plus exécuter du JS arbitraire dans la page, lire les en-têtes et corps des requêtes, ainsi que localStorage / les cookies.',
    },
  },
  levelTitle: (label, level, description) => `${label} (${level}) : ${description}`,

  maskPresets: {
    phone: 'Numéro de téléphone (Chine)',
    idCard: 'Numéro de carte d’identité (Chine)',
    bankCard: 'Numéro de carte bancaire',
    email: 'Adresse e-mail',
  },
  regex: {
    empty: 'Saisissez une expression régulière',
    matchesEmpty: 'Correspond à la chaîne vide, ce qui masquerait tout le texte',
    syntax: (detail) => `Expression régulière non valide : ${detail}`,
    lookaround: 'Les assertions avant/arrière ((?=, (?!, (?<=, (?<!) ne sont pas prises en charge ; la passerelle utilise la syntaxe RE2',
    backreference: 'Les références arrière (\\1, etc.) ne sont pas prises en charge ; la passerelle utilise la syntaxe RE2',
  },

  badges: {
    help: 'En assistance',
    agentWithName: (label, agent) => `${label} (${agent})`,
    waitingConfirmAction: 'En attente de confirmation de l’action',
    waitingConfirm: 'En attente d’approbation',
    waitingDevtools: 'En attente d’approbation de DevTools',
    waitingTitle: (agent) => `${agent} attend que l’utilisateur approuve sur l’appareil`,
    invited: 'Invité',
    invitedTitle: 'Connecté via un lien d’invitation',
  },

  api: {
    network: 'Impossible de joindre la passerelle. Vérifiez votre connexion réseau.',
    unauthorized: 'Votre session a expiré. Veuillez vous reconnecter.',
    forbidden: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
    notFound: 'Introuvable',
    server: 'Erreur de la passerelle. Veuillez réessayer plus tard.',
    failed: (status) => `Échec de la requête (HTTP ${status})`,
    unknown: 'Erreur inconnue',
    adminName: 'Administrateur',
  },
}
