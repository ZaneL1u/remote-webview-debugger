import type { projects as en } from '../en/projects'

/** French plural: 0 and 1 take the singular. */
const pl = (n: number, one: string, other: string) => (n < 2 ? one : other)

export const projects: typeof en = {
  title: 'Projets',
  name: 'Nom du projet',
  newProject: 'Nouveau projet',
  optional: '(facultatif)',
  onlineCount: (online, total) => `<n>${online}</n> en ligne / ${total} ${pl(total, 'appareil', 'appareils')}`,

  list: {
    description:
      'Chaque projet correspond à une application ou à un site, avec sa propre clé d’application, sa politique d’accès et ses invitations. Tous les appareils sont listés sur la page Appareils.',
    emptyTitle: 'Aucun projet pour l’instant',
    emptyManage: 'Créez un projet pour obtenir une clé d’application et du code d’intégration prêt à l’emploi. Votre premier appareil peut être en ligne en quelques minutes.',
    emptyMember: 'Les projets apparaîtront ici dès qu’un administrateur en aura créé.',
  },

  create: {
    description: 'La création d’un projet génère une clé d’application (rwd_pk_…) et du code d’intégration.',
    nameRequired: 'Saisissez un nom de projet',
    invalidOrigins: (bad) => `Origine non valide : ${bad.join(', ')}`,
    namePlaceholder: 'par exemple Application Boutique',
    originsLabel: 'Origines autorisées',
    originsHint: 'Une par ligne. Laissez vide pour autoriser toutes les origines ; une fois la liste définie, seules les pages de ces origines peuvent se connecter.',
    created: (name) => `Projet « ${name} » créé`,
  },

  detail: {
    notFoundTitle: 'Projet introuvable',
    notFoundDescription: 'Il a peut-être été supprimé.',
    backToList: 'Retour aux projets',
    tabs: {
      integration: 'Intégration',
      devices: 'Appareils',
      invites: 'Invitations',
      audit: 'Journal d’audit',
      settings: 'Paramètres',
    },
  },

  keys: {
    title: 'Clés d’API',
    pageDescription:
      'Pour connecter des agents via MCP. Les clés appartiennent à toute la passerelle, pas à un projet : une seule clé et un seul serveur MCP atteignent tous les appareils.',
    description:
      'Les agents utilisent une clé pour se connecter via MCP. Une clé voit tous les appareils de la passerelle, tous projets confondus. Gardez vos clés secrètes et révoquez immédiatement toute clé divulguée.',
    readOnly: ' Votre rôle permet seulement de consulter les clés ; leur création et leur révocation nécessitent un administrateur.',
    createKey: 'Créer une clé',
    emptyTitle: 'Aucune clé d’API pour l’instant',
    emptyDescription: 'Créez une clé et copiez la commande de configuration MCP pour votre agent.',

    columns: {
      name: 'Nom',
      key: 'Clé',
      level: 'Niveau',
      expiry: 'Expiration',
      ipAllowlist: 'IP autorisées',
      lastUsed: 'Dernière utilisation',
      status: 'État',
      actions: 'Actions',
    },
    createdOn: (date) => `Créée le ${date}`,
    neverUsed: 'Jamais utilisée',
    usedAgo: (ago) => `dernière utilisation ${ago}`,

    neverExpires: 'N’expire jamais',
    expiresAtTitle: (date) => `Expire le ${date}`,
    expiredOn: (date) => `Expirée le ${date}`,
    expiresIn: (until) => `Expire ${until}`,
    anyIp: 'Toute adresse IP',

    revoked: 'Révoquée',
    revokedTitle: (date) => `Révoquée le ${date}`,
    expired: 'Expirée',
    expiredTitle: (date) => `Expirée le ${date}`,
    active: 'Active',

    revoke: 'Révoquer',
    revokedToast: (name) => `« ${name} » révoquée`,
    revokeTitle: (name) => `Révoquer « ${name} » ?`,
    revokeDescription: (prefix) => `Les sessions MCP qui utilisent <c>${prefix}…</c> cessent immédiatement de fonctionner. Cette action est irréversible.`,

    mcpTabs: {
      hosted: 'Hébergé',
      local: 'stdio local',
      json: 'Configuration JSON',
    },
    hostedHint: 'Claude Code se connecte directement au MCP hébergé de la passerelle (Streamable HTTP), sans rien installer :',
    localHint: 'Nécessite la commande <c>rwd</c> sur votre machine ; elle transmet stdio au /mcp hébergé :',
    jsonHint: 'Pour les autres clients qui lisent un fichier de configuration mcpServers :',

    createdTitle: 'Clé d’API créée',
    createdName: (name) => name,
    showOnce:
      '<b>C’est la seule fois que la clé complète est affichée.</b> Vous ne pourrez plus la consulter après avoir fermé cette fenêtre : copiez-la maintenant et conservez-la en lieu sûr. En cas de perte, révoquez-la et créez-en une nouvelle.',
    maxPrefix: 'Max. ',
    keyLabel: 'Clé d’API',
    commandLabel: 'Commande de configuration MCP (clé incluse)',
    savedClose: 'Je l’ai enregistrée, fermer',

    createTitle: 'Créer une clé d’API',
    createDescription: 'Nommez la clé pour pouvoir la reconnaître et la révoquer plus tard, par exemple d’après l’agent ou le collègue qui l’utilise.',
    nameRequired: 'Saisissez un nom',
    invalidCidrs: (bad) => `Entrée d’IP autorisée non valide : ${bad.join(', ')} (utilisez la notation CIDR, par exemple 203.0.113.0/24)`,
    namePlaceholder: 'par exemple Bot du support',
    maxLevel: 'Niveau d’autorisation maximal',
    advancedWarning:
      '<b>Avancé permet d’exécuter du JS arbitraire dans la page de l’utilisateur et de lire les cookies et les corps de requête</b>, ce qui revient à détenir la session connectée de l’utilisateur sur cette page. Ne l’accordez qu’à des agents de confiance, et associez-le à une liste d’IP autorisées et à une expiration courte.',
    levelHint: 'Le niveau effectif est aussi plafonné par le niveau maximal du projet auquel appartient la page ; le plus strict des deux s’applique.',
    neverWarning: 'Une clé sans expiration reste valable en cas de fuite, jusqu’à ce que quelqu’un la révoque. Préférez une expiration et créez une nouvelle clé avant qu’elle n’arrive à échéance.',
    expiresAround: (date) => `Expire vers le ${date}. Ensuite, MCP renvoie 401.`,
    ipHint: 'Un CIDR par ligne ; une adresse IP seule compte comme /32 (/128 en IPv6). Laissez vide pour ne pas restreindre ; une fois la liste définie, les appels MCP depuis d’autres IP reçoivent 401.',

    guideTitle: 'Utilisez-la dans votre agent',
    guideDescription: (placeholder) =>
      `Remplacez <c>${placeholder}</c> par votre clé d’API dans les commandes ci-dessous. Un seul serveur MCP atteint tous les appareils : un téléphone qui ouvre des pages de projets différents garde le même code d’appareil. Consultez le <link>guide d’intégration</link> pour la liste complète des outils, les niveaux d’autorisation et le processus d’approbation.`,
    commonTools: 'Outils courants',
    tools: {
      list: 'Filtrer les appareils par état, userId ou code d’appareil',
      connect: 'Se connecter à un appareil par son code d’appareil ; attendre qu’il soit en ligne s’il est hors ligne',
      pages: 'Lister les pages de l’appareil et passer de l’une à l’autre (p1, p2…)',
      snapshot: 'Obtenir un instantané de la page (avec les ref) ou une capture d’écran',
      act: 'Agir sur la page ; la première action fait passer la page à « IA aux commandes »',
      logs: 'Consulter la sortie console, les erreurs et les requêtes réseau',
      timeline: 'Chronologie multipage qui retrace le parcours de l’utilisateur',
      control: 'Après une reprise en main par l’utilisateur, attendre qu’il rende la main',
    },
    tryTitle: 'Essayez de dire ceci à votre agent',
    tryExample: '« Listez les appareils en ligne, connectez-vous à GSJH-EV2J et trouvez pourquoi le total du panier affiche -- »',
  },

  policy: {
    title: 'Politique d’accès',
    description:
      'Détermine si les agents peuvent se connecter, ce qu’ils peuvent faire et ce qu’ils peuvent voir. Les modifications s’appliquent immédiatement aux nouvelles connexions ; les sessions en cours conservent leur niveau.',
    readOnly: 'Votre rôle permet seulement de consulter la politique d’accès ; sa modification nécessite un administrateur ou un propriétaire.',
    saved: 'Politique d’accès enregistrée. Elle s’applique immédiatement aux nouvelles connexions.',
    invalid: 'Certains paramètres ne sont pas valides. Vérifiez les champs signalés en rouge.',
    invalidSelectors: (bad) => `Sélecteur CSS non valide : ${bad.join(', ')}`,
    nameRequired: 'Saisissez un nom',
    duplicateName: 'Nom en double',
    intRange: (min, max) => `Saisissez un nombre entier compris entre ${min} et ${max}`,
    invalidUrl: 'Doit commencer par http:// ou https://',

    approval: {
      title: 'Approbation des connexions',
      description:
        'Indique si l’utilisateur doit approuver sur l’appareil lorsqu’un agent se connecte avec un code d’appareil. L’invite ne réagit qu’aux vrais appuis de l’utilisateur ; un agent ne peut pas appuyer à sa place.',
      prompt: 'Demander à l’utilisateur (recommandé)',
      promptDescription:
        'La page au premier plan affiche une invite, et l’agent ne se connecte qu’une fois que l’utilisateur a choisi le niveau à autoriser. Sans réponse sous 30 secondes, la demande est refusée. Après 3 refus d’affilée pour la même clé, les invites sont suspendues pendant 10 minutes.',
      none: 'Sans approbation',
      noneDescription: 'Tout agent qui connaît le code d’appareil peut se connecter directement. Réservé aux environnements de test internes.',
    },

    maxLevel: {
      title: 'Niveau d’autorisation maximal',
      description:
        'Le niveau le plus élevé autorisé par ce projet. Une connexion obtient le plus bas de ces quatre niveaux : celui demandé par l’agent, celui autorisé par sa clé d’API, celui défini ici et celui approuvé par l’utilisateur.',
      advancedWarning:
        'Avancé permet aux agents d’exécuter du JS arbitraire et de lire les cookies et les corps de requête, ce qui équivaut à la session connectée de l’utilisateur sur la page. Ne l’activez qu’en cas de réel besoin.',
    },

    masking: {
      title: 'Masquage des données personnelles',
      description:
        'Les champs de mot de passe et les éléments portant l’attribut data-rwd-mask s’affichent toujours sous la forme •••• dans les instantanés, les captures d’écran, la console et les journaux réseau. Ajoutez ici d’autres règles de masquage.',
      selectorsLabel: 'Éléments masqués (sélecteurs CSS)',
      selectorsHint: 'Un par ligne, par exemple .user-phone, #id-card.',
      patternsTitle: 'Masquer du texte par expression régulière',
      patternsDescription:
        'Le texte correspondant est remplacé par •••• dans les instantanés, la console et les URL réseau. Utile pour les numéros de téléphone ou d’identité qui apparaissent en clair. Utilise la syntaxe RE2 (sans assertions avant/arrière ni références arrière).',
      patternsList: 'Motifs de masquage',
      ruleName: (n) => `Nom de la règle ${n}`,
      ruleRegex: (n) => `Expression régulière de la règle ${n}`,
      removeRule: (n) => `Supprimer la règle ${n}`,
      namePlaceholder: 'Nom',
      regexPlaceholder: 'Expression régulière, par exemple 1[3-9]\\d{9}',
      addRule: 'Ajouter une règle',
      presets: 'Préréglages :',
      tryLabel: 'Essayez : saisissez un exemple de texte pour prévisualiser le masquage',
      sample: 'Jeanne Martin 13812345678 jeanne@example.com ID 11010119900307123X',
    },

    confirm: {
      title: 'Confirmer les actions sensibles',
      description:
        'Avant qu’un agent clique sur ces éléments (ou appuie sur Enter dans leur formulaire), la page demande à l’utilisateur de confirmer ; sans confirmation sous 30 secondes, l’action est refusée. Les éléments portant l’attribut data-rwd-confirm nécessitent toujours une confirmation.',
      label: 'Éléments nécessitant une confirmation (sélecteurs CSS)',
      hint: 'Un par ligne, par exemple les boutons de paiement, de suppression et de commande.',
    },

    network: {
      title: 'Règles d’exclusion réseau',
      description:
        'Les requêtes correspondantes n’apparaissent pas dans la liste réseau ni dans la chronologie que voient les agents (la page les enregistre quand même ; un agent peut passer includeExcluded pour les voir). Utile pour les polices toujours en 404 et les balises d’analyse. Les règles passées à run({ networkExclude }) dans la page s’ajoutent à celles-ci.',
      label: 'Requêtes exclues',
      hint: 'Une par ligne : un fragment d’URL (insensible à la casse), des jokers * ou une /regex/.',
    },

    sessionLog: {
      title: 'Journal de session',
      description:
        'Dès chaque lancement de l’application, les pages enregistrent dans IndexedDB, sur le téléphone, les navigations, les appuis et saisies de l’utilisateur, les actions de l’agent, la console et les requêtes réseau (avec le corps pour les requêtes en échec). Un agent connecté peut lire tout ce qui s’est passé avant son arrivée. Les 3 derniers lancements sont conservés, jusqu’à 10 Mo chacun ; les règles de masquage s’appliquent.',
      label: 'Conserver un journal de session',
      hint: 'Une fois désactivé, les pages arrêtent l’enregistrement et suppriment les journaux déjà présents sur le téléphone. Une page peut aussi s’en exclure avec run({ record: false }).',
    },

    help: {
      title: 'Bouton d’assistance',
      description:
        'Un bouton flottant « Demander une assistance » en bas à droite de la page. Quand l’utilisateur appuie dessus, l’appareil est signalé « En assistance » et remonte en tête de la liste des appareils.',
      all: 'Tous les utilisateurs',
      allDescription: 'Toutes les pages équipées du SDK affichent le bouton d’assistance.',
      listed: 'Utilisateurs spécifiques',
      listedDescription: 'Affiché uniquement pour les userId listés ci-dessous. Idéal pour les déploiements progressifs et les tests bêta.',
      off: 'Désactivé',
      offDescription: 'Pas de bouton flottant. L’application peut appeler help() depuis son propre point d’accès à l’assistance.',
      usersLabel: 'userId autorisés',
      usersHint: 'Un par ligne, correspondant au userId passé à run() / setUser().',
      usersEmpty: 'Si la liste est vide, personne ne voit le bouton d’assistance.',
    },

    devtools: {
      title: 'DevTools',
      description: 'Les administrateurs peuvent ouvrir Chrome DevTools sur les pages en ligne depuis le détail de l’appareil : Elements, Console, Network, stockage et exécution de scripts.',
      allow: 'Autoriser DevTools',
      allowDescription: 'Seuls les propriétaires et les administrateurs peuvent l’ouvrir. Si l’approbation des connexions est activée, la connexion se fait après l’accord de l’utilisateur sur l’appareil ; une approbation vaut pour la durée maximale de session, et l’utilisateur peut y mettre fin à tout moment. DevTools voit la page telle quelle : le masquage ne s’y applique pas.',
    },
    eruda: {
      title: 'Intégration eruda',
      description:
        'Comment le panneau de débogage eruda de la page fonctionne avec Remote Debugger. run({ eruda }) dans le code de la page prévaut sur ces paramètres.',
      dock: 'Intégrer dans eruda',
      dockDescription:
        'Ajoute un onglet « Remote Debugger » à eruda au lieu du widget flottant. Quand l’IA se connecte, la barre de contrôle inférieure apparaît quand même, pour que l’utilisateur puisse reprendre la main ou terminer à tout moment.',
      load: 'Charger automatiquement la dernière version d’eruda',
      loadDescription:
        'Si la page n’a pas eruda, charge la dernière version depuis jsDelivr et l’initialise pour que les développeurs voient la console, le réseau et les sources. À n’activer de préférence que pour les projets d’environnement de test.',
    },

    limits: {
      title: 'Limites de temps et quotas',
      minutes: 'min',
      devices: '',
      agents: '',
      idle: 'Délai d’inactivité de l’IA',
      idleHint: 'Passé ce délai sans action de l’IA, la page revient à « IA en consultation » et le voile est retiré. 2 par défaut.',
      attach: 'Durée maximale de session',
      attachHint: 'L’agent est déconnecté automatiquement au-delà de cette durée, au cas où personne ne termine la session. 60 par défaut.',
      onlineDevices: 'Appareils en ligne maximum',
      onlineDevicesHint: 'Au-delà, les nouveaux appareils sont refusés (code de fermeture 4429). 0 signifie aucune limite.',
      agentsLabel: 'Agents simultanés maximum',
      agentsHint: 'Agents connectés simultanément à des appareils sur l’ensemble du projet. 0 signifie aucune limite.',
    },

    invite: {
      title: 'Page d’invitation',
      description:
        'Les liens d’invitation ouvrent cette page par défaut (avec le paramètre rwd_invite ajouté automatiquement). La page doit intégrer le SDK.',
      label: 'URL H5 ouverte par les liens d’invitation',
      hint: 'Laissez vide pour la saisir à chaque création d’invitation.',
    },

    unsaved: 'Modifications non enregistrées',
    allSaved: 'Toutes les modifications sont enregistrées',
    revert: 'Annuler les modifications',
    save: 'Enregistrer la politique',
  },

  settings: {
    renamed: 'Nom du projet enregistré',
    disabledToast: 'Projet désactivé',
    enabledToast: 'Projet activé',
    deleted: (name) => `Projet « ${name} » supprimé`,
    general: 'Général',
    meta: (date, id) => `Créé le ${date} · ID du projet <c>${id}</c>`,
    disableTitle: 'Désactiver le projet',
    disableDescription:
      'Tant que le projet est désactivé, les pages qui utilisent sa clé d’application ne peuvent pas se connecter. Vous pouvez le réactiver à tout moment.',
    running: 'Actif',
    deleteTitle: 'Supprimer le projet',
    deleteDescription: 'La clé d’application cesse immédiatement de fonctionner et les invitations du projet sont supprimées. Cette action est irréversible.',
    deleteConfirmTitle: (name) => `Supprimer le projet « ${name} » ?`,
    deleteConfirmDescription:
      'La clé d’application et les invitations seront supprimées, et les pages qui utilisent cette clé d’application ne pourront plus se connecter. Cette action est irréversible.',
  },
}
