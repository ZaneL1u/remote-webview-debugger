import type { docs as en } from '../en/docs'

export const docs: typeof en = {
  toc: {
    label: 'Sommaire',
    overview: 'Fonctionnement',
    concepts: 'Notions clés',
    quickstart: 'Démarrage rapide en cinq étapes',
    h5: 'Intégrer une page H5',
    native: 'Intégrer une application native',
    mcp: 'Connecter un agent IA (MCP)',
    tools: 'Outils MCP',
    approval: 'Approbation, reprise en main et confirmation',
    verify: 'Liste de vérification',
    troubleshoot: 'Dépannage',
  },
  anchorLabel: (title) => `Lien vers « ${title} »`,

  hero: {
    eyebrow: (brand) => `Guide d’intégration · ${brand}`,
    title: 'D’une simple balise script à une IA qui débogue les pages sur les téléphones de vos utilisateurs',
    body: 'Le parcours complet : ajouter le SDK à votre page ou à votre application, mettre un appareil en ligne, créer une clé d’API et ajouter la passerelle à Claude Code ou à un autre client MCP, puis l’approbation, la reprise en main et le dépannage. Les exemples de code utilisent déjà l’URL de votre passerelle ; choisissez un projet pour y insérer sa clé d’application.',
  },

  personalize: {
    gateway: 'URL de la passerelle',
    gatewayHint: 'GATEWAY dans le code',
    project: 'Projet',
    projectHint: 'Définit la clé d’application ci-dessous',
    selectProject: 'Sélectionner un projet',
    disabledSuffix: ' (désactivé)',
    noProjects: 'Aucun projet pour l’instant. Créez-en un',
    appKey: 'Clé d’application',
    appKeyHint: 'Publique, appareils uniquement',
  },

  overview: {
    lead: 'Le SDK de votre page se connecte en sortie à la passerelle ; les agents IA utilisent le point de terminaison MCP de la passerelle pour trouver les appareils, s’y connecter et piloter la page. Les utilisateurs voient toujours ce que fait l’IA et peuvent reprendre la main ou terminer la session à tout moment.',
    device: 'Appareil',
    deviceSub: 'WebView d’application / page H5 + SDK',
    gateway: 'Passerelle Remote Debugger',
    gatewaySub: 'Présence, approbation, autorisations, audit',
    agent: 'Agent IA',
    agentSub: 'Claude Code, Cursor et autres',
    console: 'Console (vous êtes ici) : appareils, projets, clés, politiques et journal d’audit',
    noPorts:
      'Votre page n’ouvre aucun port : le SDK se connecte en sortie à la passerelle via WebSocket et, s’il n’y parvient pas, se rabat sur une interrogation HTTP toutes les 60 secondes.',
    oneKey:
      'Une clé d’API voit tous les appareils de la passerelle : un seul serveur MCP suffit. Par défaut, l’utilisateur appuie sur Autoriser sur l’appareil avant qu’un agent se connecte, et le niveau d’autorisation limite ce que l’agent peut faire.',
    masking:
      'Les champs de mot de passe et le contenu masqué s’affichent sous la forme <c>••••</c> dans les instantanés, les captures d’écran et les journaux ; le texte d’origine ne quitte jamais la page.',
  },

  concepts: {
    head: ['Terme', 'Définition', 'Format / exemple'],
    gateway: 'Passerelle',
    gatewayBody: 'Le service Remote Debugger déployé sur votre serveur. Tous les points de terminaison se trouvent sous son /v1.',
    project: 'Projet',
    projectBody:
      'Une source d’intégration (une application, un site ou l’une de ses bases de code H5), avec sa propre clé d’application et sa propre politique. Les appareils et les clés d’API n’appartiennent pas à un projet.',
    projectExample: 'Application Boutique',
    appKey: 'Clé d’application',
    appKeyBody: 'Intégrée à la page pour mettre les appareils en ligne. Publique ; elle ne permet pas de contrôler les appareils.',
    appKeyFormat: 'rwd_pk_ + 24 caractères',
    apiKey: 'Clé d’API',
    apiKeyBody:
      'Permet aux agents IA de se connecter aux appareils via MCP. Appartient à toute la passerelle, pas à un projet. Affichée une seule fois ; prend en charge un niveau maximal, une expiration et une liste d’IP autorisées.',
    apiKeyFormat: 'rwd_sk_live_ + 32 caractères',
    device: 'Appareil',
    deviceBody:
      'Un téléphone (un deviceId). Toutes les pages d’un appareil forment une seule session de débogage, et elles peuvent provenir de projets différents.',
    deviceCode: 'Code d’appareil',
    deviceCodeBody:
      'Un code court et permanent que la passerelle attribue à chaque appareil. Les utilisateurs le lisent au support ; vous le transmettez à l’agent.',
    page: 'Page',
    pageBody: 'Une page ou une WebView de l’appareil qui exécute le SDK, numérotée dans l’ordre d’ouverture.',
    pageFormat: 'p1, p2…',
    approval: 'Approbation',
    approvalBody:
      'Quand le projet de l’une des pages de l’appareil l’active, l’utilisateur confirme sur l’appareil avant qu’un agent se connecte et choisit le niveau d’accès à accorder.',
    level: 'Niveau d’autorisation',
    levelBody:
      'Ce qu’une connexion peut réellement faire : le plus bas entre le niveau demandé par l’agent, le maximum de la clé, le maximum du projet de chaque page de l’appareil et le niveau approuvé par l’utilisateur.',
  },

  quickstart: {
    lead: 'Votre première intégration prend environ 5 minutes si vous suivez ces étapes dans l’ordre.',
    projectTitle: 'Créer un projet et obtenir sa clé d’application',
    projectBody:
      'Créez-en un sur la page <link>Projets</link>, par exemple « Application Boutique ». Vous pouvez laisser les origines autorisées vides pour l’instant.',
    sdkTitle: 'Ajouter le SDK à votre page',
    sdkBody:
      'Sur les pages H5, ajoutez ces deux lignes le plus tôt possible dans <head>. Pour les WebView d’une application, nous recommandons l’injection depuis le code natif (voir « Intégrer une application native »).',
    onlineTitle: 'Ouvrir la page et vérifier que l’appareil est en ligne',
    onlineBody:
      'Une pastille translucide affichant le code d’appareil apparaît en bas à droite de la page (rangée dans l’onglet Remote Debugger d’eruda quand la page utilise eruda), et vous retrouvez l’appareil sur la page <link>Appareils</link> de la console. Ouvrez-le et lancez Tester la connexion pour vérifier que la passerelle peut obtenir un instantané de la page.',
    keyTitle: 'Créer une clé d’API',
    keyBody: (level) =>
      `Allez dans <link>Clés d’API</link> dans la navigation du haut → Créer. Choisissez un niveau (${level} convient généralement au débogage) et une expiration, puis copiez la clé <c>rwd_sk_live_…</c>, qui n’est affichée qu’une seule fois.`,
    mcpTitle: 'Ajouter la passerelle à Claude Code, puis simplement demander',
    mcpExample:
      'Par exemple : « Listez les appareils en ligne, connectez-vous à GSJH-EV2J et trouvez pourquoi le total du panier affiche -- ».',
  },

  h5: {
    lead: 'Pour les pages H5 autonomes, ou les WebView dont vous pouvez modifier le code de page. Le SDK met en mémoire tampon l’activité console et réseau dès son chargement : chargez-le donc de manière synchrone, le plus tôt possible dans <head>.',
    loadTitle: 'Charger et démarrer le SDK',
    latestTab: 'Dernière version',
    pinnedTab: 'Version fixée + SRI',
    latestBody: 'Charge toujours le dernier SDK depuis la passerelle : les mises à niveau de la passerelle prennent effet automatiquement.',
    pinnedBody:
      'Charge une version fixe, et le navigateur vérifie le fichier avec <c>integrity</c> (sha384). Idéal pour les pages soumises à des exigences de sécurité strictes. La version et l’empreinte proviennent de <c>sdkVersion</c> et <c>sdkIntegrity</c> dans <c>GET /v1/api/config</c> ; mettez-les à jour lors des mises à niveau de la passerelle.',
    optionsTitle: 'Options de run()',
    optionsIntro:
      '<c>RemoteWebviewDebugger.run(gatewayUrl, appKey, options?)</c> renvoie <c>Promise<{deviceCode, status}></c> ; l’appeler à nouveau n’a aucun effet de bord.',
    optionsHead: ['Option', 'Description'],
    options: {
      userId:
        'L’utilisateur connecté. La console et les agents peuvent rechercher les appareils par utilisateur ; appelez setUser() quand l’état de connexion change.',
      helpButton:
        'Affiche le bouton d’aide ; quand l’utilisateur appuie dessus, l’appareil est signalé « Aide demandée » dans la console. Combiné par OU avec le point d’accès à l’aide de la politique du projet.',
      app: 'Informations sur l’application hôte <c>{ name, version }</c>, affichées dans la liste des appareils.',
      deviceId:
        'Transmis par l’application lors d’une injection native, pour que l’appareil reste le même d’une WebView et d’un domaine à l’autre. Sur les pages H5 simples, le SDK en génère un et le conserve dans localStorage.',
      nativeKey:
        'Un secret aléatoire généré par l’application, qui n’apparaît que dans le script injecté. nativeControl / nativeDecide l’exigent.',
      deviceToken:
        'Un jeton d’appareil émis par la passerelle. localStorage étant propre à chaque origine, l’application doit le conserver et le retransmettre sur chaque page (voir ci-dessous).',
      nativeApproval:
        'Avec true, le SDK n’affiche pas les boîtes de dialogue d’approbation / de confirmation ; l’application lit status().pending et affiche les siennes, natives.',
      lockScreen:
        'Verrouiller ou non la page pendant que l’IA agit (true par défaut). Les utilisateurs peuvent aussi basculer ce réglage dans le panneau flottant, qui permet également d’activer « Autoriser l’IA automatiquement » après explication et choix d’un niveau d’autorisation.',
      eruda:
        'Intégration eruda, désactivée par défaut. true ou { dock: true } : ajoute un onglet Remote Debugger à eruda au lieu d’afficher le panneau flottant ; { load: true } : charge et initialise la dernière version d’eruda quand la page ne l’a pas. Vous pouvez aussi passer src (URL d’eruda) et name (nom de l’onglet). Paramètres → Intégration eruda du projet permet de l’activer à distance ; chaque option définie ici est prioritaire.',
    },
    jsApiTitle: 'API JS',
    statusValues:
      'Valeurs de <c>status().status</c> : <c>idle</c>, <c>connecting</c>, <c>online</c>, <c>polling</c> (WebSocket indisponible, interrogation toutes les 60 secondes), <c>stopped</c>, <c>rejected</c> (jeton d’appareil non concordant), <c>quota</c> (quota d’appareils en ligne dépassé). <c>nativeControl()</c> et <c>nativeDecide()</c> sont destinés aux hôtes natifs.',
    originsTitle: 'Origines autorisées',
    originsBody:
      'Dès qu’un projet a des origines autorisées, la passerelle vérifie l’Origin de chaque page et refuse la négociation (403) pour les pages qui ne figurent pas dans la liste. Écrivez chaque entrée sous la forme d’une origine complète, par exemple <c>https://m.example.com</c> ; un joker initial est autorisé, comme dans <c>https://*.example.com</c> (correspond aux sous-domaines, pas à example.com lui-même). Laissez vide pour ne pas restreindre.',
    cspTitle: 'CSP',
    cspBody:
      'Si la page a une Content-Security-Policy, autorisez la passerelle pour les scripts et les connexions (WebSocket utilise wss://) :',
    maskTitle: 'Masquer les données sensibles et confirmer les actions sensibles',
    maskBody:
      '<c>input[type=password]</c> et les éléments portant <c>data-rwd-mask</c> s’affichent sous la forme <c>••••</c> dans les instantanés, les captures d’écran et la console. Dans les paramètres du projet, vous pouvez ajouter des sélecteurs de masquage (<c>maskSelectors</c>) et des règles de texte par expression régulière (<c>maskPatterns</c>, par exemple pour les numéros de téléphone ou d’identité). Avant qu’un agent clique sur un élément portant <c>data-rwd-confirm</c> (ou correspondant aux <c>confirmSelectors</c> du projet), l’appareil demande à l’utilisateur de confirmer.',
  },

  native: {
    lead: 'Aucune modification du H5 : l’application injecte le SDK dans chaque WebView dès le début du chargement. Toutes les pages de l’application (y compris celles de domaines tiers) deviennent débogables, avec boîtes de dialogue d’approbation natives, captures d’écran et boutons de reprise en main.',
    cards: [
      {
        title: 'Injecter au début du document',
        body: 'Utilisez WKUserScript(.atDocumentStart) sur iOS et addDocumentStartJavaScript sur Android, pour que la capture commence avant l’exécution de tout script de la page.',
      },
      {
        title: 'Un deviceId stable',
        body: 'Un par installation, conservé dans l’application et partagé par toutes les WebView et tous les domaines, pour que le code d’appareil ne change jamais.',
      },
      {
        title: 'nativeKey',
        body: 'Un secret aléatoire que l’application génère et n’écrit que dans le script injecté. L’evaluate_script de l’agent ne peut pas le lire : l’agent ne peut donc pas se faire passer pour l’utilisateur pour rendre la main ou approuver une connexion.',
      },
      {
        title: 'Conserver le deviceToken',
        body: 'Lisez-le dans status().deviceToken après la première connexion, conservez-le et injectez-le ensuite dans chaque WebView. Sans lui, la passerelle refuse l’appareil avec 4401.',
      },
      {
        title: 'Approbation et confirmation natives',
        body: 'Définissez nativeApproval: true, interrogez status().pending, affichez une boîte de dialogue native, puis répondez avec nativeDecide.',
      },
      {
        title: 'Captures d’écran et boutons natifs',
        body: 'Fournissez un pont de capture d’écran pour que l’agent obtienne les pixels réels ; les boutons Reprendre la main / Rendre la main / Terminer de la barre d’état appellent nativeControl.',
      },
    ],
    iosTab: 'iOS (Swift)',
    androidTab: 'Android (Kotlin, référence)',
    iosIntro:
      'Version allégée du fichier exécutable <c>examples/mock-app/Sources/RWDMockApp/RWDNative.swift</c> du dépôt (l’application de démonstration utilise la même interface) :',
    androidWarning:
      'Il s’agit d’une implémentation de référence qui n’a pas été compilée dans un vrai projet Android. Son interface correspond à celle de la version iOS ; adaptez-la à la structure de votre projet.',
    eventsTitle: 'Événements à gérer en natif',
    eventsHead: ['Situation', 'Que faire'],
    statusBar: 'Barre d’état',
    statusBarBody:
      'Interrogez <c>status()</c> : quand <c>control</c> vaut observe, affichez « L’IA consulte la page » ; agent, affichez « L’IA a la main » et bloquez le bouton Retour ; user, affichez « Vous avez repris la main ».',
    attach: 'Approbation de connexion',
    attachBody:
      "<c>pending.kind === 'attach'</c> : listez <c>pending.levels</c> (le dernier est celui demandé par l’agent) ; une fois que l’utilisateur a choisi un niveau, appelez <c>nativeDecide(key, requestId, level)</c>, ou passez null pour refuser.",
    confirm: 'Confirmation d’action',
    confirmBody:
      "<c>pending.kind === 'confirm'</c> : affichez <c>pending.action</c> (par exemple cliquer sur « Passer la commande ») ; passez <c>'allow'</c> pour autoriser ou null pour refuser.",
    control: 'Reprendre la main / rendre la main / terminer',
    controlBody: "<c>nativeControl(key, 'takeover' | 'handback' | 'end')</c> ; renvoie false si la clé est incorrecte.",
    screenshot: 'Captures d’écran',
    screenshotBody:
      'Sur iOS, enregistrez <c>webkit.messageHandlers.rwdScreenshot</c> (avec réponse) ; sur Android, fournissez <c>window.RWDAndroid.screenshot()</c>. Les deux renvoient une data URL JPEG/PNG.',
    help: 'Demander de l’aide',
    helpBody:
      'Faites appeler <c>help(true)</c> par le point d’accès à l’aide de l’application ; la politique du projet peut déterminer qui le voit en fonction du userId.',
  },

  mcp: {
    lead: 'La passerelle intègre un serveur MCP hébergé (Streamable HTTP) à l’URL de votre passerelle suivie de /mcp. Chaque session MCP est liée à une clé d’API et voit tous les appareils de la passerelle : un seul serveur MCP suffit, inutile d’en créer un par projet.',
    keyTitle: '1. Créer une clé d’API',
    keyBody:
      'Créez-en une sur la page <link>Clés d’API</link>. La clé complète n’est affichée qu’une seule fois : enregistrez-la immédiatement ; si vous la perdez, révoquez-la et créez-en une nouvelle.',
    keyHead: ['Paramètre', 'Description'],
    maxLevel: 'Niveau maximal',
    maxLevelBody:
      '<observe></observe> débogage en lecture seule <interact></interact> reproduction de problèmes (par défaut) <advanced></advanced> exécution de scripts, lecture des corps de requête et du stockage',
    expiry: 'Expiration',
    expiryBody: '90 jours par défaut ; choisissez 7, 30 ou 90 jours, ou jamais. Une fois la clé expirée, MCP renvoie 401.',
    ipAllowlist: 'IP autorisées',
    ipAllowlistBody: 'Facultatif, un CIDR par ligne. Si la liste est définie, seules ces IP de sortie peuvent utiliser la clé.',
    claudeTitle: '2. L’ajouter à Claude Code',
    hostedIntro: 'Mode hébergé, sans rien installer (recommandé) :',
    replaceKey:
      'Remplacez <c>rwd_sk_live_…</c> par votre clé. <c>--scope project</c> l’écrit dans le fichier <c>.mcp.json</c> du projet pour la partager avec vos collègues (ne versionnez pas la clé dans le dépôt). Le <c>.mcp.json</c> équivalent :',
    clientsTitle: '3. Autres clients',
    stdioTab: 'Clients stdio uniquement',
    localTab: 'Pont stdio local',
    cursorBody:
      'Ajoutez-la à <c>~/.cursor/mcp.json</c> (global) ou à <c>.cursor/mcp.json</c> dans votre projet. La plupart des clients qui prennent en charge le MCP distant utilisent ce format :',
    stdioBody:
      'Les clients qui ne peuvent lancer que des commandes locales (par exemple <c>claude_desktop_config.json</c> de Claude Desktop) peuvent passer par un pont avec <c>rwd mcp</c> :',
    localBody:
      '<c>rwd</c> est le binaire de la passerelle lui-même (sa sous-commande <c>rwd mcp</c>). Il se contente de transmettre stdio au <c>/mcp</c> hébergé et lit la clé dans la variable d’environnement <c>RWD_API_KEY</c> :',
    checkTitle: '4. Vérifier la connexion',
    promptsTitle: '5. Simplement demander',
    promptsIntro:
      'L’agent choisit lui-même les outils : list_devices pour trouver l’appareil, connect_device pour s’y connecter (en attendant l’approbation de l’utilisateur), puis instantanés, journaux et actions sur la page. Essayez par exemple :',
    prompts: [
      'Listez les appareils en ligne, connectez-vous à GSJH-EV2J et trouvez pourquoi le total du panier affiche --',
      'L’utilisateur u_20391 demande de l’aide. Connectez-vous à son appareil, reproduisez « Passer la commande ne fait rien » et trouvez la cause',
      'Connectez-vous à K7Q2-9M4X en consultation seule et résumez les erreurs console et les requêtes en échec de la page actuelle',
      'Sur la page produit, choisissez l’option coffret cadeau et passez une commande pour reproduire le problème ; prévenez-moi quand vous avez besoin que je reprenne la main',
      'Attendez que GSJH-EV2J soit en ligne, connectez-vous, ouvrez la page promo et récupérez un bon de réduction, puis revenez à la page de liste',
      'Examinez la chronologie de cet appareil sur les 10 dernières minutes et reconstituez comment l’utilisateur s’est retrouvé sur une page blanche',
    ],
    copyPrompt: 'Copier ce prompt',
  },

  tools: {
    lead: 'Chaque résultat d’outil se termine par les « changements de session » : pages ouvertes, erreurs, reprises en main par l’utilisateur, etc., depuis l’appel précédent, pour que l’agent ne manque rien de ce qui se passe sur l’appareil. Les outils au-dessus du niveau de la connexion renvoient une erreur et sont consignés dans le journal d’audit.',
    groups: {
      device: 'Appareils et connexion',
      observe: 'Consultation',
      interact: 'Interaction',
      advanced: 'Avancé',
    },
    desc: {
      listDevices: 'Lister les appareils, ceux qui demandent de l’aide en premier',
      connectDevice:
        'Se connecter par code d’appareil ou deviceId ; si l’approbation est activée, attend que l’utilisateur confirme sur l’appareil (environ 35 secondes au maximum)',
      disconnectDevice: 'Quitter l’appareil ; la page de l’utilisateur redevient inactive',
      waitForDevice: 'Attendre qu’un appareil soit en ligne ; un appareil en interrogation est invité à se reconnecter immédiatement',
      listPages: 'Pages de l’appareil : libellé, titre, URL, premier plan / arrière-plan, page d’origine',
      selectPage: 'Changer la page sur laquelle agissent les outils suivants (par exemple p2)',
      waitForPage: 'Attendre l’ouverture d’une nouvelle page ou une navigation vers une URL cible',
      waitForControl: 'Après une reprise en main par l’utilisateur, attendre qu’il rende la main',
      waitForEvent: 'Attendre le prochain événement correspondant de la chronologie (navigation, erreur, requête en échec…)',
      getSessionTimeline: 'Chronologie multipage qui reconstitue le parcours de l’utilisateur',
      takeSnapshot: 'Instantané d’accessibilité de la page (YAML), avec les ref des éléments pour click / fill',
      takeScreenshot: 'Capture d’écran ; pixels réels quand l’application fournit un pont de capture',
      findElements: 'Trouver des éléments par texte ou rôle et renvoyer leurs ref ; moins coûteux qu’un instantané complet',
      listConsoleMessages: 'Journaux console et erreurs non interceptées ; scope=session couvre toutes les pages',
      listNetworkRequests: 'Requêtes fetch / XHR / WebSocket et autres',
      waitFor: 'Attendre qu’un texte apparaisse ou disparaisse, ou quelques secondes',
      clickHover: 'Cliquer / survoler. La première interaction fait passer la page à « IA aux commandes »',
      fill: 'Vider et remplir ; fonctionne avec les champs contrôlés React / Vue',
      typeText: 'Saisir caractère par caractère, en déclenchant les événements clavier',
      pressKey: 'Appuyer sur une touche, y compris des combinaisons comme Control+A',
      selectOption: 'Choisir dans une liste déroulante',
      scrollDrag: 'Faire défiler la page ou un élément / glisser-déposer',
      navigation: 'Naviguer, revenir en arrière, recharger',
      batchActions: 'Exécuter plusieurs interactions dans l’ordre et répondre une seule fois, ce qui économise des allers-retours',
      evaluateScript: 'Exécuter du JS dans la page et renvoyer du JSON',
      getNetworkRequest: 'En-têtes et corps de la requête et de la réponse (en-têtes sensibles masqués, corps limité à 64 Ko)',
      getStorage: 'Lire localStorage, sessionStorage ou les cookies non HttpOnly (masqués)',
    },
    anyLevel: 'Tout niveau',
    anyLevelTitle: 'Disponible à tous les niveaux',
    effectiveLevel:
      'Niveau effectif d’une connexion = min(le <c>level</c> demandé par l’agent, le niveau maximal de la clé d’API, le niveau maximal du projet de chaque page de l’appareil, le niveau approuvé par l’utilisateur). La passerelle et le SDK de la page l’appliquent tous les deux.',
  },

  approval: {
    lead: 'Du côté de l’utilisateur, tout ce que fait l’IA est visible et peut être arrêté à tout instant. L’approbation est activée par défaut pour les nouveaux projets.',
    requestTitle: 'L’IA demande à se connecter',
    requestBody:
      'Après l’appel de <c>connect_device</c> par l’agent, la page au premier plan de l’appareil affiche « Bot du support souhaite consulter et contrôler cette page », et l’utilisateur choisit parmi <levels></levels> (seuls les niveaux autorisés par la clé et le projet sont proposés). Quand des pages de plusieurs projets sont ouvertes sur le même appareil, la politique du projet le plus strict l’emporte : si un projet exige une approbation, elle est exigée, et le niveau, le retour en cas d’inactivité et la durée de connexion maximale prennent la plus petite valeur. La boîte de dialogue n’accepte que les vrais appuis de l’utilisateur ; les clics synthétisés par l’agent sont ignorés.',
    levelChoice: (label) => label,
    timeout:
      'Sans réponse sous 30 secondes, la demande est refusée. <b>Après 3 refus d’affilée pour la même clé d’API sur le même appareil, aucune nouvelle approbation n’est demandée pendant 10 minutes</b> ; la connexion échoue immédiatement.',
    activeTitle: 'IA en consultation → IA aux commandes',
    activeBody:
      'Après l’approbation, la pastille affiche « L’IA consulte ». Au premier clic, à la première frappe ou à toute autre interaction de l’agent, elle passe à « IA aux commandes » : une large lueur bleue qui respire éclaire les bords de la page et un voile transparent bloque les saisies de l’utilisateur, ne laissant que Reprendre la main et Terminer. Avant chaque action, un curseur IA apparaît, glisse jusqu’à la cible et indique l’action (par exemple cliquer sur « Passer la commande »), avec une onde à chaque appui. Après 2 minutes sans activité de l’agent, la page revient en consultation (configurable par projet) ; une connexion dure au maximum 60 minutes (configurable par projet).',
    takeoverTitle: 'L’utilisateur reprend la main et la rend',
    takeoverBody:
      'Quand l’utilisateur appuie sur Reprendre la main, la lueur devient orange fixe et les outils d’interaction de l’agent renvoient une erreur <c>takeover</c> ; l’agent doit appeler <c>wait_for_control</c> pour attendre. Quand l’utilisateur appuie sur Rendre la main, l’agent reprend (idéalement après un nouvel instantané et un coup d’œil à la chronologie pour voir ce qu’a fait l’utilisateur). Appuyer sur Terminer déconnecte l’agent.',
    confirmTitle: 'Confirmation des actions sensibles',
    confirmBody:
      'Avant que l’agent clique sur un élément portant <c>data-rwd-confirm</c> ou correspondant aux <c>confirmSelectors</c> du projet (ou appuie sur Enter pour envoyer un tel formulaire), l’appareil demande : « L’IA souhaite cliquer sur “Passer la commande”. Autoriser ? » Si l’utilisateur refuse, l’outil renvoie « L’utilisateur a refusé cette action ». Pendant l’attente de la confirmation, le délai de cet appel passe à 40 secondes.',
    footer:
      'Vous pouvez déconnecter l’agent à tout moment avec Terminer la session sur la page de l’appareil dans la console. Chaque connexion, approbation et action est consignée dans le <link>journal d’audit</link> (sans le contenu des pages ni les valeurs des paramètres).',
  },

  verify: {
    lead: 'Vérifiez ces points dans l’ordre avant la mise en production. Si chaque étape réussit, toute la chaîne fonctionne.',
    gateway: 'La passerelle est joignable',
    sdk: 'Le SDK est en ligne dans la page',
    sdkBody:
      'Dans les outils de développement de la page, exécutez <c>RemoteWebviewDebugger.status().status</c>. Le résultat doit être <c>"online"</c> (ou <c>"polling"</c> : WebSocket est bloqué, cela fonctionne mais plus lentement).',
    console: 'La console trouve l’appareil',
    consoleBody:
      'Recherchez le code d’appareil ou le userId sur la page <link>Appareils</link>. L’appareil doit être en ligne, avec le bon système et la bonne version d’application.',
    test: 'Le test de connexion réussit',
    testBody: 'Ouvrez l’appareil et cliquez sur Tester la connexion. « Connexion établie » s’affiche avec un instantané de la page.',
    mcp: 'MCP est connecté',
    mcpBody: 'rwd apparaît comme Connected dans <c>claude mcp list</c>.',
    agent: 'L’agent peut se connecter',
    agentBody:
      'Demandez à l’agent de « lister les appareils en ligne et se connecter à XXXX-XXXX ». Une demande d’approbation apparaît sur l’appareil ; une fois l’accès autorisé, l’agent obtient un instantané.',
  },

  troubleshoot: {
    lead: 'Quand un appareil ne se connecte pas ou qu’un agent n’arrive pas à se connecter, c’est presque toujours l’une des causes ci-dessous.',
    offlineTitle: 'L’appareil ne se connecte jamais',
    offlineHead: ['Symptôme', 'Cause et solution'],
    handshake401: 'Négociation 401',
    handshake401Body:
      'Clé d’application erronée, ou projet désactivé. Le renouvellement de la clé invalide immédiatement l’ancienne : mettez-la à jour dans votre page / application.',
    handshake403: 'Négociation 403',
    handshake403Body:
      'L’Origin de la page ne figure pas dans les origines autorisées. Ajoutez schéma + hôte + port, ou videz la liste pour supprimer la restriction.',
    refused: '<c>Refused to connect</c> dans la console',
    refusedBody:
      'Bloqué par la CSP de la page. Comme indiqué plus haut, ajoutez les URL https:// et wss:// de la passerelle à <c>script-src</c> et à <c>connect-src</c>.',
    undefined: '<c>RemoteWebviewDebugger</c> n’est pas défini',
    undefinedBody:
      'Le SDK ne s’est pas chargé : URL erronée, blocage par un bloqueur de contenu, ou (en injection native) page chargée avant la fin du téléchargement du SDK.',
    polling: 'status reste à <c>polling</c>',
    pollingBody:
      'Un réseau ou un proxy bloque WebSocket. L’appareil se connecte quand même (interrogation toutes les 60 secondes), et quand un agent se connecte, la passerelle lui demande de réessayer WebSocket immédiatement.',
    outdated: 'SDK obsolète',
    outdatedBody:
      'Une version fixée du SDK peut être incompatible avec la passerelle. Passez à /v1/sdk.js ou mettez à jour la version et l’empreinte integrity.',
    testTimeout: 'En ligne, mais le test expire',
    testTimeoutBody:
      'Le JS de la WebView est suspendu quand l’application est en arrière-plan. Demandez à l’utilisateur de remettre l’application au premier plan et de rester sur une page équipée du SDK, puis réessayez.',
    closeCodesTitle: 'Codes de fermeture WebSocket',
    closeCodesHead: ['Code', 'Signification', 'Solution'],
    code4401: 'Jeton d’appareil (deviceToken) manquant ou non concordant',
    code4401Fix:
      'L’application doit conserver status().deviceToken et le retransmettre à run() dans chaque WebView ; le SDK passe en rejected et réessaie après environ 10 minutes',
    code4409: 'Reprise non concordante (une autre connexion utilise le même pageId)',
    code4409Fix:
      'Le SDK se reconnecte de lui-même avec un nouveau pageId ; rien à faire si c’est occasionnel. Si cela arrive souvent, c’est que sessionStorage est copié',
    code4429: 'Quota d’appareils en ligne du projet dépassé',
    code4429Fix:
      'Augmentez « Appareils en ligne maximum » dans les paramètres du projet ; le SDK passe en quota et réessaie après environ 5 minutes',
    agentTitle: 'Erreurs côté agent',
    agentHead: ['Erreur', 'Cause et solution'],
    mcp401: 'MCP renvoie 401',
    mcp401Body: 'La clé est mal saisie, révoquée ou expirée, ou l’IP de sortie ne figure pas dans la liste des IP autorisées.',
    level: 'Nécessite le niveau advanced…',
    levelBody:
      'L’outil dépasse le niveau de cette connexion. Refaites la demande avec une clé de niveau supérieur et connect_device(level) ; l’utilisateur doit aussi approuver ce niveau.',
    denied: 'Refus de l’utilisateur / délai d’approbation dépassé',
    deniedBody:
      'L’utilisateur a refusé sur l’appareil ou n’a pas répondu sous 30 secondes ; après 3 refus d’affilée, l’accès est bloqué pendant 10 minutes.',
    takeover: 'L’utilisateur a repris la main ; appelez wait_for_control pour attendre qu’il la rende.',
    notFound: 'La ref est obsolète (la page a changé) ; appelez à nouveau take_snapshot ou find_elements.',
    notInteractable: 'L’élément est masqué, désactivé ou recouvert ; faites d’abord défiler ou fermez la superposition.',
    testTitle: 'Utiliser Tester la connexion pour trouver le maillon défaillant',
    testBody:
      'La page de l’appareil et la page Intégration du projet proposent toutes deux Tester la connexion : la passerelle envoie une demande d’instantané à la page actuelle de l’appareil. Si elle réussit, la liaison appareil ↔ passerelle fonctionne et le problème vient de MCP ou de la clé ; si elle échoue, regardez le code d’erreur : <c>device_offline</c>, <c>no_page</c> (page en cours de reconnexion), <c>timeout</c>, <c>takeover</c>.',
    stuck: 'Toujours bloqué ?',
    openIntegration: 'Vérifier en direct sur la page Intégration du projet',
    viewDevices: 'Voir les appareils en ligne',
  },
}
