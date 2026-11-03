import type { integration as en } from '../en/integration'

export const integration: typeof en = {
  key: {
    title: 'Informations d’intégration',
    description:
      'La clé d’application figure dans le code source de votre page et est publique par nature : elle permet seulement de mettre des appareils en ligne, pas de les contrôler.',
    gatewayUrl: 'URL de la passerelle',
    appKey: 'Clé d’application',
    rotate: 'Renouveler la clé',
    rotateTitle: 'Renouveler la clé d’application ?',
    rotateNew: 'Une nouvelle clé d’application est générée et l’ancienne cesse immédiatement de fonctionner.',
    rotateImpact:
      'Les pages qui utilisent encore l’ancienne clé ne pourront pas se connecter tant qu’elles ne seront pas mises à jour. Ne le faites que si la clé est utilisée de manière abusive.',
    rotateConfirm: 'Renouveler',
    rotated: 'Clé d’application renouvelée. Mettez rapidement à jour le code d’intégration de vos pages.',
    sdkLatest: 'URL du SDK (dernière version)',
    sdkPinned: (version) => `URL du SDK (version ${version} fixée)`,
  },

  snippet: {
    title: 'Code d’intégration',
    description:
      'Prérempli avec l’URL de la passerelle et la clé d’application de ce projet, prêt à copier. Pour les approbations natives, le pont de capture d’écran, les jetons d’appareil et plus encore, consultez le <link>guide d’intégration</link>.',
    tabH5: 'Page H5',
    tabIos: 'iOS (Swift)',
    tabAndroid: 'Android (Kotlin)',
    sdkVersion: 'Version du SDK',
    latest: 'Dernière',
    pinned: (version) => `Version ${version} fixée (SRI)`,
    pinnedHint:
      'Charge une version fixe que le navigateur vérifie avec son empreinte d’intégrité. Idéal pour les pages soumises à des exigences de sécurité strictes ou à une CSP. Mettez à jour la version et l’empreinte manuellement après une mise à niveau de la passerelle.',
    latestHint: 'Charge toujours le dernier SDK de la passerelle : les mises à niveau de la passerelle s’appliquent sans toucher à la page.',
    h5Hint: 'Ajoutez ceci le plus tôt possible dans la balise <tag>head</tag> de la page :',
    iosHint: 'Aucune modification du code H5 : l’application l’injecte au documentStart avec <c>WKUserScript</c> :',
    androidHint: 'Aucune modification du code H5 : l’application l’injecte avec <c>WebViewCompat.addDocumentStartJavaScript</c> :',
  },

  origins: {
    title: 'Origines autorisées',
    description:
      'Si la liste est définie, seules les pages de ces origines peuvent se connecter avec la clé d’application. Laissez vide pour ne pas restreindre.',
    edit: 'Modifier',
    saved: 'Origines autorisées enregistrées',
    invalid: (bad) =>
      `Non valide : ${bad.join(', ')} (format attendu : https://hôte[:port] ; utilisez *. comme joker de sous-domaine)`,
    unrestricted: 'Sans restriction : les pages de toutes les origines peuvent se connecter.',
  },

  verify: {
    title: 'Vérifier l’intégration',
    description: 'Vérifie en direct si un appareil se connecte et si un agent peut réellement agir sur la page.',
    seen: 'Un appareil s’est connecté',
    waiting: 'En attente du premier appareil',
    firstSeen: (date, online) => `Première connexion le ${date} · en ligne actuellement : ${online}`,
    waitingHint:
      'Ajoutez le code d’intégration à votre page, puis ouvrez-la dans l’application ou dans un navigateur. Cette section se met à jour automatiquement dès qu’un appareil se connecte.',
    projectDisabled: 'Ce projet est désactivé : les appareils ne peuvent pas se connecter.',
    deviceOnline: 'Appareil en ligne',
    deviceOffline: 'Appareil hors ligne',
    platform: 'Plateforme',
    appVersion: 'Version de l’application',
    noApp: '— (page H5)',
    currentPage: 'Page',
    untitled: '(sans titre)',
    sdkVersion: 'Version du SDK',
    lastSeen: 'Dernière activité',
    viewDevice: 'Voir les détails de l’appareil',
    test: 'Tester la connexion',
    testHint:
      'La passerelle envoie une demande d’instantané à l’appareil et affiche le temps aller-retour ainsi que l’instantané, ce qui prouve qu’un agent peut agir sur cet appareil.',
    testing: 'Test en cours…',
  },

  troubleshoot: {
    title: 'L’appareil ne se connecte pas ?',
    description:
      'Vérifiez les causes les plus fréquentes dans cet ordre. Pour aller plus loin, consultez le <link>guide de dépannage</link>.',
    badKey: {
      title: 'Clé non valide ou projet désactivé',
      body: 'La négociation WebSocket de la page renvoie 401. Vérifiez que la clé de votre code d’intégration correspond à celle ci-dessus (un renouvellement invalide immédiatement l’ancienne clé) et que le projet n’est pas désactivé.',
    },
    origin: {
      title: 'Origine non autorisée',
      body: 'La négociation renvoie 403. Ajoutez l’origine de la page (schéma + hôte + port) aux origines autorisées, ou videz la liste pour supprimer la restriction.',
    },
    csp: {
      title: 'La CSP de la page bloque la connexion',
      body: 'La console du navigateur affiche <c>Refused to connect</c>. Ajoutez l’hôte de la passerelle à <c>script-src</c> dans la CSP, et les URL <c>https://</c> et <c>wss://</c> de la passerelle à <c>connect-src</c>.',
    },
    sdkOld: {
      title: 'Version du SDK trop ancienne',
      body: 'Une version fixée du SDK peut ne pas correspondre au protocole de la passerelle. Passez à l’URL de la dernière version /v1/sdk.js, ou mettez à niveau vers une version prise en charge par la passerelle.',
    },
    timeout: {
      title: 'Appareil en ligne mais le test expire',
      body: 'Le JS de la WebView est suspendu quand l’application est en arrière-plan. Demandez à l’utilisateur de remettre l’application au premier plan et de rester sur une page équipée du SDK, puis réessayez.',
    },
  },

  invites: {
    title: 'Inviter des utilisateurs à se connecter',
    description:
      'Envoyez à un utilisateur un lien ou un code QR contenant un jeton d’invitation. Quand il l’ouvre, son appareil se connecte avec la mention « En assistance » : le support n’a pas besoin de lui demander son code d’appareil.',
    create: 'Créer une invitation',
    emptyTitle: 'Aucune invitation pour l’instant',
    emptyDescription:
      'Quand un utilisateur n’arrive pas vraiment à décrire son problème, envoyez-lui une invitation. Il la scanne et son appareil se connecte.',
    howTitle: 'Comment ça marche',
    howSteps: [
      'Créez une invitation avec un numéro de ticket ou une description de l’utilisateur dans la note, pour repérer l’appareil dans la liste.',
      'Envoyez le code QR ou le lien à l’utilisateur. Il ouvre l’URL d’invitation configurée dans les paramètres, ou celle que vous avez définie pour cette invitation.',
      'Dès qu’il l’ouvre, l’appareil apparaît en tête de la liste Appareils avec le badge Invité. Transmettez le code d’appareil à votre agent.',
      'Chaque invitation n’est utilisable qu’une fois et cesse de fonctionner après utilisation ou expiration.',
    ],
    noDefaultUrl:
      'Aucune URL d’invitation par défaut n’est configurée : chaque invitation nécessite donc un lien. Vous pouvez en définir une dans les <link>paramètres</link>.',
    status: {
      used: 'Utilisée',
      expired: 'Expirée',
      active: 'Active',
    },
    deleted: 'Invitation supprimée',
    noNote: '(pas de note)',
    createdBy: (name) => `Créée par ${name} · `,
    usedAgo: (when) => `Utilisée ${when}`,
    viewDevice: 'Voir l’appareil',
    expiredAt: (date) => `Expirée le ${date}`,
    expiresIn: (when) => `Expire ${when}`,
    qrCode: 'Code QR',
    linkCopied: 'Lien d’invitation copié',
    deleteLabel: 'Supprimer l’invitation',
    deleteTitle: 'Supprimer cette invitation ?',
    deleteActive: 'Le lien cesse immédiatement de fonctionner ; quiconque l’ouvre ne sera pas signalé « en assistance ».',
    deleteInactive: 'Seul cet enregistrement est supprimé. Les appareils déjà connectés ne sont pas affectés.',

    createTitle: 'Créer une invitation',
    createDescription:
      'Génère un lien à usage unique. Quand l’utilisateur l’ouvre, son appareil est signalé « en assistance ».',
    noteRequired: 'Saisissez une note',
    badUrl: 'Le lien doit commencer par http:// ou https://',
    urlRequired: 'Le projet n’a pas d’URL d’invitation par défaut. Saisissez un lien.',
    note: 'Note',
    notePlaceholder: 'par exemple Ticket n° 4821 échec du paiement',
    noteHint: 'Affichée dans la chronologie de l’appareil et dans le journal d’audit. N’y mettez pas de données personnelles.',
    url: 'Lien',
    optional: '(facultatif)',
    urlHint: (hasDefault) =>
      `${hasDefault ? 'Laissez vide pour utiliser l’URL d’invitation par défaut du projet.' : 'Le projet n’a pas d’URL d’invitation par défaut : ce champ est donc obligatoire.'} La page doit intégrer le SDK.`,
    expiry: 'Expire après',
    expiryOptions: {
      m30: '30 min',
      h2: '2 heures',
      d1: '1 jour',
      d7: '7 jours',
    },
    submit: 'Créer l’invitation',

    qrTitle: 'Code QR d’invitation',
    qrDescription: (note, when) => `« ${note} » · expire ${when} · usage unique`,
    scanHint: 'Demandez à l’utilisateur de le scanner avec l’appareil photo de son téléphone ou le lecteur de l’application',
    orLink: 'Ou envoyez-lui le lien',
    done: 'Terminé',
  },

  test: {
    failed: 'Échec du test',
    unknownFailure: 'Le test a échoué pour une raison inconnue.',
    ok: 'Connexion établie. Un agent peut agir sur cet appareil.',
    roundTrip: (ms) => `${ms} ms aller-retour`,
    untitled: '(sans titre)',
    snapshotPreview: 'Aperçu de l’instantané (4 000 premiers caractères)',
    emptySnapshot: '(instantané vide)',
    errors: {
      offline:
        'L’appareil n’est pas en ligne. Demandez à l’utilisateur de remettre l’application au premier plan et d’ouvrir une page équipée du SDK, puis réessayez.',
      noPage: 'L’appareil est en ligne mais aucune page n’est connectée. Vérifiez que la page a fini de se charger.',
      timeout:
        'L’appareil n’a pas répondu sous 15 secondes. L’application est peut-être en arrière-plan (le JS de la WebView est suspendu), ou la page est bloquée.',
      takeover: 'L’utilisateur a repris la main : le test ne peut pas s’exécuter pour le moment.',
      notFound: 'L’appareil n’existe pas ou n’appartient plus à ce projet.',
      badRequest: 'Paramètres de requête non valides.',
      internal:
        'La page a rencontré une erreur interne. Vérifiez si la version du SDK est obsolète, ou recherchez des erreurs dans la console de la page.',
      network: 'Impossible de joindre la passerelle. Vérifiez votre connexion réseau.',
    },
  },

  snippets: {
    sampleAppName: 'Boutique',
    usage: 'Utilisation :',
    dependency: (dep) => `Dépendance : ${dep}`,
    h5Head:
      'Chargement synchrone, le plus tôt possible dans <head>, pour que le SDK enregistre la console et le réseau dès le début',
    h5Pinned: (version) =>
      `Version ${version} fixée avec Subresource Integrity (SRI). Mettez à jour la version et integrity après une mise à niveau de la passerelle`,
    userIdOptional: "facultatif : l'ID de l'utilisateur connecté, pour retrouver les appareils par utilisateur",
    helpButton: "afficher le bouton d'assistance",
    iosInstall:
      "À appeler avant webView.load(...) : télécharge le SDK une fois et l'injecte dans le cadre principal au documentStart.",
    deviceIdPerInstall: "Un deviceId (UUID v4) fixe par installation, pour que le code d'appareil ne change jamais.",
    androidWebViewSettings: 'La WebView a besoin de settings.javaScriptEnabled = true et settings.domStorageEnabled = true',
    androidInstall: "À appeler avant webView.loadUrl(...) : télécharge le SDK une fois et l'injecte au début du document.",

    full: {
      userId: "facultatif : l'utilisateur connecté, pour que la console et les agents retrouvent les appareils par utilisateur",
      helpButton: `facultatif : afficher le bouton "Demander une assistance" (combiné par OU avec la politique du projet)`,
      app: "facultatif : informations sur l'application hôte ; les pages H5 autonomes peuvent l'omettre",
      nativeOnly: `Uniquement pour l'injection native par une application ; voir "Intégrer une application native"`,
      deviceCode: "Code d'appareil Remote Debugger",
      example: 'ex.',
    },
    jsApi: {
      help: "demander une assistance (passer false pour annuler)",
      setUser: "à appeler après la connexion / un changement d'utilisateur ; se reconnecte une fois",
      stop: "se déconnecter et retirer l'interface, par exemple quand l'utilisateur désactive le débogage à distance",
    },
    mask: {
      masked: "Affiché sous la forme •••• dans les instantanés, les captures d'écran et la sortie console",
      samplePhone: '06 12 34 56 78',
      confirm: "Avant qu'un agent clique dessus, l'appareil demande à l'utilisateur de confirmer",
      placeOrder: 'Passer la commande',
    },
    native: {
      screenshotBridge: "pont de capture d'écran natif",
      swiftTrimmed: 'Version allégée de examples/mock-app/Sources/RWDMockApp/RWDNative.swift.',
      swiftInstall: 'Appelez RWD.shared.install(into: configuration) avant de créer chaque WKWebView.',
      swiftOnState: "pilote la barre d'état native et les boutons reprendre la main / rendre la main / terminer",
      swiftOnPending: "approbations de connexion et confirmations d'action (boîtes de dialogue natives)",
      swiftNativeKey: [
        "Un secret connu de la seule application : les scripts de la page (y compris evaluate_script d'un agent) ne peuvent pas le lire,",
        "ils ne peuvent donc pas se faire passer pour l'utilisateur pour rendre la main ou approuver une connexion.",
      ],
      swiftDeviceId:
        "Un deviceId par installation, partagé par toutes les WebView et tous les domaines → le code d'appareil ne change jamais.",
      swiftDeviceToken:
        "Émis par la passerelle la première fois qu'elle voit cet appareil. localStorage est propre à chaque domaine : l'application le conserve et l'injecte.",
      swiftEnable:
        "À appeler une fois que l'utilisateur accepte le débogage à distance : télécharge le SDK une fois ; les WebView créées ensuite le reçoivent par injection.",
      swiftOwnHelp: `l'application a son propre point d'accès "Demander une assistance"`,
      swiftNativeApproval: 'les approbations / confirmations utilisent des boîtes de dialogue natives',
      swiftDocumentStart:
        "documentStart : l'enregistrement de la console et du réseau commence avant l'exécution de tout script de la page",
      buttons: 'Boutons natifs',
      swiftDecide:
        'Approbation de connexion : passez un niveau (observe / interact / advanced), ou nil pour refuser. Confirmation d\'action : passez "allow" ou nil.',
      swiftTokenCarried: "les pages ouvertes à partir de maintenant (y compris sur d'autres domaines) le transmettent",
      swiftScreenshot: 'Quand un agent appelle take_screenshot, le SDK obtient les pixels réels via ce pont.',
      kotlinReference:
        "Implémentation de référence (non compilée dans un vrai projet d'application) ; son API reproduit celle de la version iOS à l'identique.",
      kotlinNativeKey: 'Un secret connu de la seule application ; jamais exposé à la page via une interface JS.',
      kotlinOnState: "pilote la barre d'état et les boutons natifs",
      kotlinOnPending: "boîtes de dialogue natives d'approbation / de confirmation",
      kotlinDeviceId: 'Un deviceId par installation, partagé par toutes les WebView et tous les domaines.',
      kotlinEnable: "À appeler une fois que l'utilisateur a accepté le débogage à distance.",
      kotlinInstall: 'À appeler pour chaque WebView avant loadUrl. Nécessite javaScriptEnabled et domStorageEnabled.',
      kotlinButtons:
        'Boutons natifs : takeover | handback | end ; les approbations prennent un niveau ou null, les confirmations "allow" ou null',
      kotlinTokenCarried: 'les WebView créées à partir de maintenant le transmettent',
      kotlinScreenshot:
        'Quand un agent appelle take_screenshot, le SDK appelle window.RWDAndroid.screenshot(), qui renvoie une data URL JPEG.',
    },
  },
}
