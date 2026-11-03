import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// Français (vouvoiement).

const ui: UiMessages = {
  levels: {
    observe: 'Consultation seule',
    interact: 'Consultation et interaction',
    advanced: 'Avancé (exécuter des scripts, lire le stockage)',
  },
  attachLevels: {
    observe: 'Consultation seule',
    interact: 'Consultation et interaction',
    advanced: 'Avancé (en plus : exécuter des scripts, lire le stockage)',
  },
  state: {
    none: 'Inactif : aucune IA connectée',
    observe: 'L’IA consulte cette page',
    agent: 'L’IA a la main ; vos actions sont suspendues',
    user: 'Vous avez repris la main ; l’IA est en pause',
  },
  link: {
    connecting: 'Connexion',
    online: 'En ligne',
    offline: 'Hors ligne',
  },
  connecting: 'Connexion…',
  helpPending: 'En assistance',
  copy: 'Copier',
  copied: 'Copié',
  noteHelp: 'Assistance demandée. Le développeur vous retrouvera grâce à ce code d’appareil.',
  noteAuto:
    'Autorisation automatique activée : l’IA se connecte sans vous demander. Vous pouvez reprendre la main ou terminer à tout moment.',
  noteShare:
    'Communiquez ce code d’appareil au développeur. L’IA vous demandera avant de se connecter, et vous pourrez reprendre la main ou terminer à tout moment.',
  help: 'Demander une assistance',
  cancelHelp: 'Annuler la demande',
  collapse: 'Masquer',
  deviceCode: 'Code d’appareil',
  barViewing: 'L’IA consulte',
  barAgent: 'L’IA agit',
  barUser: 'À vous',
  connectedFor: time => `Connecté · ${time}`,
  takeover: 'Reprendre',
  handback: 'Rendre',
  end: 'Terminer',
  autoTitle: 'Autoriser l’IA automatiquement',
  autoOn: level => `Connexion sans demande · ${level}`,
  autoOff: 'Me demander chaque fois que l’IA veut se connecter',
  lockTitle: 'Verrouiller l’écran quand l’IA est connectée',
  lockOn: 'Vos touchers et balayages sont bloqués tant que l’IA est connectée',
  lockOff: 'Vous pouvez toujours toucher et faire défiler ; évitez de gêner l’IA',
  lockedToast: 'Écran verrouillé quand l’IA est connectée',
  unlockedToast: 'Écran déverrouillé quand l’IA est connectée',
  autoOffToast: 'L’IA vous demandera avant de se connecter',
  autoDialogTitle: 'Activer l’autorisation automatique ?',
  autoDialogText:
    'Quand l’IA demande à se connecter à cet appareil, elle se connecte immédiatement avec l’accès choisi ci-dessous. Un avis s’affiche à chaque fois ; vous pouvez reprendre la main ou terminer à tout moment, et désactiver cette option ici.',
  turnOn: 'Activer',
  cancel: 'Annuler',
  autoOnToast: level => `Autorisation auto · ${level}`,
  countdown: seconds => `Refus automatique dans ${seconds} s`,

  agentName: 'Assistant IA',
  autoAllowedToast: (agent, level) => `Accès auto pour « ${agent} » · ${level}`,
  attachTitle: 'L’IA souhaite se connecter',
  attachText: agent => `« ${agent} » souhaite consulter cette page. Autoriser ?`,
  confirmTitle: 'Confirmation requise',
  confirmText: action => `L’IA souhaite ${action}. Autoriser ?`,
  allow: 'Autoriser',
  deny: 'Refuser',
}

const agent: AgentMessages = {
  missingParam: name => `Paramètre manquant : ${name}`,
  notString: name => `Le paramètre ${name} doit être une chaîne`,
  unknownMethod: method => `Méthode inconnue : ${method}`,
  needLevel: level => `Nécessite le niveau ${level}`,
  takenOver: 'L’utilisateur a repris la main ; attendez qu’il vous la rende',
  userDenied: 'L’utilisateur a refusé cette action',
  confirmBusy: 'L’utilisateur n’a pas encore confirmé l’action précédente',

  unknownModifier: m => `Touche de modification inconnue : ${m}`,
  unknownKey: key => `Touche inconnue : ${key}`,

  refNotInSnapshot: ref => `ref=${ref} ne figure pas dans le dernier instantané ; prenez un nouvel instantané`,
  refDetached: ref => `L’élément de ref=${ref} n’est plus sur la page ; prenez un nouvel instantané`,
  queryNeedsCriteria: 'Au moins un critère parmi text, role ou name est requis',
  noSuchRecord: seq => `Aucun enregistrement seq=${seq} dans le journal de session (il a peut-être été supprimé)`,
  noSuchSession: id => `Aucun journal de session ${id} sur cet appareil (seuls les 3 derniers lancements sont conservés)`,
  noSessionLog:
    'Aucun journal de session sur cet appareil pour l’instant (le projet a peut-être désactivé l’enregistrement, ou la page a passé run({ record: false }))',
  sessionLogUnavailable: 'IndexedDB n’est pas disponible sur cette page : pas de journal de session',

  readOnly: tag => `${tag} est en lecture seule`,
  isSelect: tag => `${tag} est une liste déroulante ; utilisez rwd.select`,
  notFillable: tag => `${tag} n’est pas un champ de texte et ne peut pas être rempli`,
  notSelect: tag => `${tag} n’est pas une liste déroulante (select) ; utilisez click`,
  singleSelect: 'Cette liste déroulante n’accepte qu’une seule option',
  noSuchOption: (value, choices) => `La liste déroulante n’a pas d’option « ${value} » ; options disponibles : ${choices.join(', ')}`,
  optionDisabled: value => `L’option « ${value} » est désactivée`,

  badUrl: url => `URL non valide : ${url}`,
  httpOnly: 'Seules les URL http(s) peuvent être ouvertes',
  textAppearTimeout: text => `Délai dépassé en attendant l’apparition du texte « ${text} »`,
  textGoneTimeout: text => `Délai dépassé en attendant la disparition du texte « ${text} »`,
  badFunction: message => `Impossible d’analyser function : ${message}`,
  notAFunction: 'function doit être une expression de fonction, par exemple "() => document.title"',

  elementDetached: tag => `L’élément ${tag} n’est plus sur la page ; prenez un nouvel instantané`,
  notActionable: (tag, reason) => `Impossible d’agir sur l’élément ${tag} : ${reason}`,
  notVisible: tag => `L’élément ${tag} n’est pas visible`,
  reasonMoving: 'sa position change sans cesse (il est peut-être animé)',
  reasonOffscreen: 'il est en dehors de la fenêtre d’affichage',
  reasonObscured: (tag, ref) =>
    `le point de clic est recouvert par ${tag} (ref=${ref} ; cliquez directement dessus, par exemple sur le fond d’une fenêtre contextuelle pour la fermer)`,

  overlayHeader:
    '[Superpositions] Ces éléments recouvrent la page. Si un clic est bloqué, cliquez directement dessus (par exemple sur le fond pour fermer une fenêtre contextuelle) :',
  overlayMask: (tag, coverage, ref) => `- fond ${tag}, couvre ${coverage} % de la fenêtre d’affichage [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- calque ${tag}${text ? ` « ${text} »` : ''}, couvre ${coverage} % de la fenêtre d’affichage [ref=${ref}]`,
  reasonHidden: 'il n’est pas visible',
  reasonDisabled: 'il est désactivé',

  storageUnavailable: area => `${area}Storage n’est pas disponible`,
  badStorageArea: "Le paramètre area doit valoir 'local', 'session' ou 'cookie'",

  requestFailed: 'Échec de la requête',
  noSuchRequest: id => `Aucune requête avec id=${id} (elle a peut-être été supprimée)`,
  netFailed: (what, error) => `${what} → échec (${error})`,
  wsFailed: url => `WebSocket ${url} → échec`,

  // The role names carry their article: "Appui sur le bouton « Payer »".
  tapped: (role, text) => `Appui sur ${role} « ${text} »`,
  tappedTag: (role, tag) => `Appui sur ${role} ${tag}`,
  roles: {
    button: 'le bouton',
    link: 'le lien',
    textbox: 'le champ de texte',
    searchbox: 'le champ de recherche',
    checkbox: 'la case à cocher',
    radio: 'le bouton radio',
    switch: 'l’interrupteur',
    combobox: 'la liste déroulante',
    listbox: 'la liste',
    option: 'l’option',
    tab: 'l’onglet',
    menuitem: 'l’élément de menu',
    img: 'l’image',
    heading: 'le titre',
    cell: 'la cellule',
    row: 'la ligne',
    listitem: 'l’élément de liste',
  },
  element: 'l’élément',
}

const action: ActionMessages = {
  quote: name => `« ${name} »`,
  click: target => `cliquer sur ${target}`,
  enterActivate: target => `appuyer sur Enter pour activer ${target}`,
  enterSubmit: target => `appuyer sur Enter pour envoyer ${target}`,
}

const fr: Locale = { id: 'fr', name: 'Français', dir: 'ltr', ui, action, agent }

export default fr
