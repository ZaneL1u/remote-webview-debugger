// Copie française (vouvoiement) : elle reflète en.ts clé par clé (le type Dict
// le vérifie). Les chaînes peuvent contenir un peu de HTML en ligne de
// confiance (<code>, <em>, <strong>, <a>).

import type { Dict } from './en.ts'

export const fr: Dict = {
  meta: {
    title: 'Remote WebView Debugger — laissez les agents IA déboguer les WebViews sur de vrais téléphones',
    description:
      'Open source, auto-hébergé : ajoutez un seul script et Claude Code, Codex, Cursor ou n’importe quel client MCP peut inspecter et piloter vos pages H5 et les WebViews de votre application sur les téléphones de vos utilisateurs — avec leur accord, avec masquage et un bouton pour reprendre la main. Sans câble USB, sans port de débogage.',
    ogTitle: 'Remote WebView Debugger',
    ogDescription: 'Laissez votre agent IA déboguer la WebView sur le téléphone de votre utilisateur. Un script, un code d’appareil, un point d’accès MCP. Open source.',
  },
  nav: {
    skip: 'Aller au contenu',
    demo: 'Démo',
    live: 'Essayer en direct',
    how: 'Comment ça marche',
    features: 'Fonctionnalités',
    highlights: 'Points forts',
    privacy: 'Confidentialité',
    selfHost: 'Auto-hébergement',
    faq: 'FAQ',
    github: 'GitHub',
    menu: 'Menu',
    themeToggle: 'Changer de thème',
    langLabel: 'Langue',
  },
  hero: {
    eyebrow: 'Open source · MIT · MCP',
    titleHtml: 'Laissez votre agent IA déboguer la WebView <em>sur le téléphone de votre utilisateur</em>.',
    sub:
      'Ajoutez un seul script à votre page H5 ou à la WebView de votre application. Votre utilisateur vous lit un court code d’appareil, et Claude Code, Codex, Cursor ou n’importe quel client MCP peut voir la page, lire la console et le réseau, et cliquer jusqu’au bug — pendant que l’utilisateur regarde et peut reprendre la main à tout moment.',
    ctaDemo: 'Voir la démo',
    ctaLive: 'Essayer avec votre agent',
    ctaGithub: 'Mettre une étoile sur GitHub',
    ctaSelfHost: 'Auto-héberger en 5 minutes',
    points: ['Sans câble USB', 'Sans port de débogage distant', 'Rien à reconstruire, juste un script', 'Fonctionne même après le bug'],
    ticker: [
      'liaison établie',
      'appareil K7Q2-9M4X en ligne',
      'instantané 42 ms',
      '34 outils armés',
      'masquage actif',
      'niveau interact',
      'journal de session · 3 lancements',
      'correctif à chaud vérifié',
      'audit en cours',
      'passerelle auto-hébergée',
      '11 langues',
    ],
    flow: {
      label: 'Un agent IA parle MCP à votre passerelle auto-hébergée, qui atteint le SDK de page sur le téléphone de l’utilisateur par WebSocket.',
      agent: 'Agent IA',
      agentSub: 'Claude Code · Codex · Cursor · tout client MCP',
      gw: 'passerelle rwd',
      gwSub: 'auto-hébergée · accord · audit',
      phone: 'Téléphone de l’utilisateur',
      phoneSub: 'page H5 / WebView + SDK',
      mcp: 'MCP · HTTPS',
      ws: 'WebSocket',
      state: 'IA aux commandes',
    },
  },
  demo: {
    kicker: 'Démo en direct',
    title: 'Un vrai bug, corrigé sur un « vrai » téléphone',
    lead:
      'Le téléphone de cette démo exécute le véritable SDK de page dans une boutique de démonstration. Sa passerelle est simulée dans votre navigateur : rien ne quitte cet onglet — mais chaque instantané, chaque clic, chaque ligne de console et chaque correctif à chaud ci-dessous est réel.',
    agentTitle: 'Agent IA',
    agentSub: 'connecté au serveur MCP rwd',
    skinLabel: 'Style d’agent',
    skinClaude: 'Claude Code',
    skinCodex: 'Codex',
    phoneLabel: 'Téléphone du client',
    play: 'Lancer',
    pause: 'Pause',
    restart: 'Recommencer',
    speed: 'Vitesse',
    start: 'Lancer la démo',
    startHint: 'Regardez un agent se connecter au téléphone, reproduire un bug de paiement, en trouver la cause racine et vérifier le correctif en direct.',
    expand: 'Voir le résultat complet',
    collapse: 'Replier',
    running: 'en cours',
    done: 'Terminé',
    error: 'erreur',
    you: 'Ingénieur support',
    agent: 'Agent',
    customer: 'Client',
    /** The hand that points at “Allow” when nobody taps it. */
    guideTap: 'Touchez « Autoriser »',
    guideAuto: (s: number) => `auto dans ${s} s`,
    footnote:
      'Tout se passe dans votre navigateur : le vrai SDK (<code>sdk.js</code>) dans une iframe, une surcouche WebSocket qui tunnelise vers une passerelle simulée dans la page, et un agent scripté qui émet de vrais RPC. Les messages de l’agent suivent la langue de la page ; les résultats des outils sont dans la langue de la passerelle (anglais ou chinois).',
    stateIdle: 'Prêt',
    statePrelude: 'Le client tombe sur le bug',
    stateRunning: 'L’agent travaille',
    statePaused: 'En pause',
    stateWaitApproval: 'En attente de l’accord du client',
    stateWaitControl: 'En attente que le client rende la main',
    stateDone: 'Terminé',
    stateStopped: 'Arrêté',
  },
  live: {
    kicker: 'En pratique',
    title: 'Maintenant, essayez avec votre propre agent',
    lead:
      'La démo ci-dessus tourne dans votre navigateur. Celle-ci est réelle : une passerelle de démonstration publique sur <code>demo.debugger.site</code>, isolée de tout le reste et remise à zéro chaque jour. La boutique à droite est la vraie, chargée depuis cette passerelle — récupérez une clé, pointez votre agent dessus et regardez-le travailler sur cette page.',
    steps: [
      {
        title: 'Récupérez votre propre clé',
        body: 'Un clic, sans inscription. La clé ne fonctionne que sur la passerelle de démonstration et expire à la prochaine remise à zéro.',
      },
      {
        title: 'Ajoutez la passerelle de démonstration à votre agent',
        body: 'Lancez la commande une fois dans un terminal, ou ajoutez-la aux réglages de votre client MCP. La clé est déjà renseignée.',
      },
      {
        title: 'Demandez à votre agent',
        body: 'Le code d’appareil de la boutique à droite est déjà dans l’invite. Quand l’agent demande à se connecter, touchez <em>Autoriser</em> dans la boutique et regardez-le travailler ; vous pouvez <em>Reprendre</em> ou <em>Terminer</em> à tout moment.',
      },
    ],
    phoneTitle: 'La boutique de démonstration, en direct',
    phoneHint: 'Ceci est <code>demo.debugger.site</code> lui-même, avec le vrai SDK. Scannez le code pour l’ouvrir plutôt sur votre téléphone.',
    open: 'Ouvrir dans un nouvel onglet',
    scan: 'Scannez pour l’ouvrir sur votre téléphone',
    tabsLabel: 'Configuration MCP de la démo',
    getKey: 'Obtenir ma clé',
    keyIdle: 'Obtenez une clé : elle sera insérée dans la commande ci-dessous.',
    keyLoading: 'Obtention de votre clé…',
    keyReady: 'Votre clé est insérée. Elle cesse de fonctionner à la prochaine remise à zéro de la démo (chaque jour à 04:00 UTC+8) ; revenez ici pour en obtenir une nouvelle.',
    keyFailed: 'La passerelle de démonstration est injoignable pour le moment ; merci de réessayer plus tard.',
    keyLimited: 'Trop de clés demandées depuis votre réseau ; merci de réessayer dans une heure.',
    deviceWaiting: 'En attente de la mise en ligne de la boutique…',
    deviceReady: (code: string) => `Le code d’appareil de cette page est ${code} — il est déjà dans l’invite.`,
    deviceUnavailable: 'La boutique n’a pas communiqué de code d’appareil ; lisez-le sur la pastille affichée dans la boutique.',
    prompt:
      'Utilise le serveur MCP rwd-demo et connecte-toi à l’appareil XXXX-XXXX. Dans la boutique, choisis le conditionnement « Gift box » pour un produit, passe au paiement et trouve pourquoi le total affiche « -- ».',
    promptLabel: 'Invite',
    promptNote: 'Remplacez <code>XXXX-XXXX</code> par le code affiché dans la boutique.',
    limitsTitle: 'Limites de la démo',
    limits: [
      'Une clé par visiteur : votre agent n’atteint que la page dont vous lui donnez le code, et seulement après votre autorisation',
      'Niveau <strong>interact</strong> uniquement : pas de scripts, pas de corps de requête, pas de stockage',
      'Un agent garde une page 15 minutes au maximum (5 s’il reste inactif)',
      '120 requêtes MCP par minute et par IP',
      'Remise à zéro chaque jour à 04:00 (UTC+8) — n’y saisissez aucune donnée personnelle réelle',
    ],
  },
  how: {
    kicker: 'Comment ça marche',
    title: 'Trois étapes entre « ça ne marche pas sur mon téléphone » et la cause racine',
    steps: [
      {
        title: 'Ajoutez le SDK de page',
        body:
          'Un script dans <code>&lt;head&gt;</code>, le plus tôt possible, pour que la console et le réseau soient enregistrés dès la première ligne. Dans une application, injectez le même script au début du document.',
      },
      {
        title: 'L’utilisateur communique un code d’appareil',
        body:
          'Chaque téléphone reçoit un code permanent comme <code>K7Q2-9M4X</code>, affiché dans une petite pastille. L’utilisateur peut toucher <em>Demander une assistance</em> : l’appareil passe alors en tête de la liste de l’agent.',
      },
      {
        title: 'Votre agent se connecte via MCP',
        body:
          'Ajoutez le point d’accès MCP hébergé par la passerelle, avec une clé d’API. Décrivez ensuite simplement le problème : l’agent trouve l’appareil, demande l’autorisation et se met au travail.',
      },
    ],
    pill: { code: 'K7Q2-9M4X', online: 'En ligne', help: 'Demander une assistance' },
    chip1: 'sdk.js depuis le CDN · console + réseau dès la première ligne',
    chip3: 'autorisé sur le téléphone · niveau interact',
    prompt: 'L’appareil K7Q2-9M4X ne peut pas payer — le total affiche « -- ». Trouve pourquoi.',
    tabsLabel: 'Configuration du client MCP',
    sdkNote: 'Épinglez une version en production, ou utilisez la copie embarquée par votre passerelle sur <code>/v1/sdk.js</code> (avec le SRI fourni par la console).',
  },
  features: {
    kicker: 'Ce que reçoit l’agent',
    title: 'Le flux de travail des DevTools, via MCP, sur le téléphone de quelqu’un d’autre',
    items: [
      { icon: 'tree', title: 'Instantanés d’accessibilité', body: 'Du YAML à la façon de Playwright, avec des ref d’éléments. L’agent lit la page comme une structure, pas comme des pixels — et agit sur des ref.' },
      { icon: 'cursor', title: 'De vraies interactions', body: 'click, fill, type, press, select, hover, scroll, drag — avec vérification de l’actionnabilité et les événements que React et Vue acceptent.' },
      { icon: 'terminal', title: 'Console et réseau', body: 'Enregistrés dès le chargement de la page dans des tampons bornés : les erreurs survenues avant l’arrivée de l’agent sont toujours là. Les corps sur demande.' },
      { icon: 'layers', title: 'Sessions multipages', body: 'Liste → fiche produit → paiement, ou une seconde WebView : toutes les pages d’un appareil forment une seule session, avec une chronologie commune.' },
      { icon: 'bell', title: 'Les changements de session, poussés', body: 'Chaque résultat d’outil se termine par ce qui a changé — nouvelle page, navigation, erreur, reprise en main par l’utilisateur. Aucun sondage.' },
      { icon: 'list', title: 'Carte de tâche sur le téléphone', body: 'L’agent affiche son plan et sa progression sur l’appareil : l’utilisateur sait toujours ce qu’il fait, et pourquoi.' },
      { icon: 'camera', title: 'Captures d’écran', body: 'Les pixels natifs quand l’application fournit un pont, un rendu du DOM sinon. Le masquage s’applique aux deux.' },
      { icon: 'scroll', title: 'Journal de session sur l’appareil', body: 'Pages, touchers, console et chaque requête depuis le lancement de l’application, conservés sur le téléphone dans IndexedDB — lisibles après coup.' },
      { icon: 'wrench', title: 'Correctifs à chaud', body: 'Au niveau advanced, l’agent peut modifier la page en cours d’exécution avec <code>evaluate_script</code> et vérifier un correctif sur place.' },
      { icon: 'wifi', title: 'Réseaux capricieux', body: 'Un battement de cœur léger avec temporisation progressive ; après trois échecs, un sondage de présence une fois par minute, et la passerelle réveille la page quand il faut.' },
      { icon: 'globe', title: '11 langues', body: 'Interface du téléphone, console et textes destinés à l’agent en 11 langues, arabe de droite à gauche inclus. Apportez vos propres packs et vos propres formulations.' },
      { icon: 'plug', title: 'Tout client MCP', body: 'Streamable HTTP sur <code>/v1/mcp</code> pour Claude Code, Codex, Cursor et compagnie ; un petit pont stdio pour tout le reste.' },
    ],
    toolsTitle: 'Tous les outils',
  },
  highlights: {
    kicker: 'Points forts',
    title: 'Pensé pour les bugs qui n’arrivent que dehors',
    lead: 'Trois choses qu’un câble, un port de débogage distant ou une capture vidéo ne vous donneront pas.',
    items: [
      {
        title: 'Le bug a déjà eu lieu ? Le journal est encore sur le téléphone.',
        body:
          'Dès le lancement de l’application, le SDK écrit un journal de session dans l’IndexedDB de l’appareil : pages visitées, touchers et saisies de l’utilisateur, sorties console et chaque requête — celles qui ont échoué avec leurs en-têtes et leurs corps. Rien n’est diffusé où que ce soit ; tout reste sur le téléphone, sous les mêmes règles de masquage, jusqu’à ce qu’un agent autorisé par l’utilisateur le demande avec <code>get_session_overview</code> et <code>get_session_log</code>. Les trois derniers lancements sont conservés, jusqu’à 10 Mo chacun.',
        tag: 'Journal de session · conservé sur l’appareil',
        visual: {
          title: 'rwd-log · lancement 3 sur 3',
          rows: ['09:41:02  ouvre  index.html', '09:41:09  touche « Gift box »', '09:41:11  touche Buy now', '09:41:12  erreur TypeError: order.price.toFixed…', '09:41:13  réseau GET api/coupon → 404', '09:52:30  agent  connecté (interact)', '09:52:31  lit    get_session_log'],
        },
      },
      {
        title: 'Vérifiez le correctif sur le téléphone du client, avant de livrer.',
        body:
          'Avec l’accord <strong>advanced</strong> de l’utilisateur, <code>evaluate_script</code> s’exécute dans la page : l’agent peut corriger un état erroné, remplacer une fonction ou réafficher une vue, puis observer le résultat sur l’appareil réel — un correctif à chaud qui prouve le diagnostic. Il ne vit que dans la mémoire de cette page ; rien n’est conservé, et les clics sensibles demandent toujours l’accord de l’utilisateur.',
        tag: 'Correctif à chaud · evaluate_script',
        visual: {
          title: 'checkout.html · live',
          before: 'Total  --',
          after: 'Total  $208.00',
          code: 'order.price = Number(order.price)',
        },
      },
      {
        title: 'Fait pour les agents, pas pour un humain avec des DevTools.',
        body:
          'Chaque résultat d’outil se termine par ce qui a changé sur l’appareil depuis l’appel précédent : l’agent n’a jamais besoin de sonder. Le contenu des pages est transmis comme des données non fiables. Une carte de tâche sur le téléphone affiche le plan de l’agent, et la passerelle parle la langue de l’agent — descriptions et résultats des outils en 11 langues.',
        tag: 'Pensé pour les agents · MCP',
        visual: {
          title: 'résultat d’outil · fin',
          rows: ['[Changements de session]', '- p2 « Checkout » ouverte (premier plan)', '- p1 erreur console : TypeError …', '- l’utilisateur a repris la main'],
        },
      },
    ],
  },
  privacy: {
    kicker: 'Confidentialité et contrôle',
    title: 'Le téléphone de l’utilisateur reste le téléphone de l’utilisateur',
    lead: 'Le débogage à distance ne fonctionne que si les gens lui font confiance. Chaque session est visible, autorisée et interruptible.',
    items: [
      { title: 'L’autorisation d’abord', body: 'Un agent demande à se connecter ; l’utilisateur voit qui demande et choisit un niveau sur le téléphone. Seuls de vrais touchers comptent : un script ne peut pas s’autoriser lui-même.' },
      { title: 'Reprendre la main ou terminer, à tout moment', body: 'Pendant que l’agent travaille, la page est verrouillée derrière une bordure lumineuse. Un toucher sur <em>Reprendre</em> met l’agent en pause ; <em>Terminer</em> le déconnecte.' },
      { title: 'Masqué par défaut', body: 'Les mots de passe, et tout ce qui est marqué <code>data-rwd-mask</code>, apparaissent sous la forme <code>••••</code> dans les instantanés, les captures d’écran, la console, les données réseau et le journal de session. Ajoutez vos sélecteurs et vos expressions régulières projet par projet.' },
      { title: 'Les clics sensibles demandent un oui', body: 'Marquez les boutons avec <code>data-rwd-confirm</code> (« Valider la commande », « Supprimer le compte ») et l’utilisateur confirme chaque clic de l’agent dessus.' },
      { title: 'Niveaux d’accès', body: '<strong>observe</strong> lit, <strong>interact</strong> agit, <strong>advanced</strong> ajoute les scripts, les corps de requête et le stockage. Plafonné par clé et par projet.' },
      { title: 'Journal d’audit', body: 'Chaque connexion, autorisation, RPC et reprise en main est enregistrée avec qui, quoi et quand — jamais le contenu des pages ni la valeur des paramètres.' },
    ],
    levels: [
      { name: 'observe', tools: 'instantanés, captures d’écran, console, liste des requêtes, journal de session, recherche, attentes' },
      { name: 'interact', tools: '+ click, fill, type, press, select, hover, scroll, drag, navigate' },
      { name: 'advanced', tools: '+ evaluate_script (correctifs à chaud), corps des requêtes et des réponses, stockage' },
    ],
  },
  native: {
    kicker: 'Applications natives',
    title: 'Dans votre application, c’est un seul script utilisateur',
    lead:
      'Téléchargez le SDK une fois et injectez-le au début du document — WKUserScript sur iOS, addDocumentStartJavaScript sur Android. Vos pages web ne changent pas d’une ligne.',
    extras: [
      { title: 'Un seul code d’appareil partout', body: 'Passez un <code>deviceId</code> stable (et conservez le <code>deviceToken</code>) pour que le code survive aux changements de WebView et de domaine.' },
      { title: 'Contrôles natifs', body: 'Affichez vos propres boutons reprendre la main / rendre la main / terminer avec <code>nativeControl()</code> ; les scripts de la page ne peuvent pas l’appeler.' },
      { title: 'Boîtes de dialogue d’autorisation natives', body: '<code>nativeApproval: true</code> confie les demandes de connexion et les confirmations à l’interface de votre propre application.' },
      { title: 'Captures d’écran en pixels réels', body: 'Un petit pont (snapshot WKWebView, bitmap Android) donne à l’agent de vrais pixels au lieu d’un rendu du DOM.' },
    ],
    tabs: { ios: 'iOS (Swift)', android: 'Android (Kotlin)', h5: 'Page H5' },
  },
  selfHost: {
    kicker: 'Auto-hébergé',
    title: 'Un seul binaire Go. Vos serveurs. Vos données.',
    lead: 'La passerelle embarque la console web et le SDK de page. SQLite d’emblée, Postgres quand il le faut, Docker Compose et Caddy pour le HTTPS.',
    points: [
      { title: 'Console', body: 'Appareils, clés d’API, membres et rôles, invitations par QR code, règles et journal d’audit — plus un guide d’intégration déjà rempli avec vos propres clés.' },
      { title: 'Stockage', body: 'Un fichier SQLite par défaut ; définissez <code>RWD_DATABASE_URL=postgres://…</code> pour utiliser Postgres.' },
      { title: 'Exploitation', body: 'Métriques Prometheus sur <code>/v1/metrics</code>, URL de SDK versionnées avec SRI, contrôle de santé sur <code>/v1/healthz</code>.' },
    ],
    stepsTitle: 'Démarrage rapide',
    dockerComment: '# un seul conteneur : console + passerelle + SDK',
    deployComment: '# ou compilez-la, déployez-la et obtenez le HTTPS avec Caddy',
    resultComment: '# → console     https://rwd.example.com\n# → passerelle  https://rwd.example.com/v1  (MCP sur /v1/mcp)',
    requires: 'Docker suffit côté serveur ; compiler depuis les sources demande Go et Node.',
    docsLink: 'Guide de déploiement',
  },
  faq: {
    kicker: 'FAQ',
    title: 'Les questions qu’on nous pose',
    items: [
      {
        q: 'L’utilisateur doit-il installer quelque chose ?',
        a: 'Non. Pour une page H5, le SDK fait partie de votre page. Dans une application, vous l’injectez depuis le code natif. L’utilisateur ne voit qu’une petite pastille avec son code d’appareil et, quand un agent se connecte, une demande d’autorisation.',
      },
      {
        q: 'Que peut voir et faire l’agent ?',
        a: 'Seulement ce que l’utilisateur a autorisé : les pages WebView de cet appareil, au niveau accordé. Il ne pilote jamais rien en dehors de la WebView. Les champs masqués restent masqués, et le contenu des pages est transmis au modèle comme des données non fiables.',
      },
      {
        q: 'Le bug est survenu avant la connexion de l’agent. Est-il perdu ?',
        a: 'Non. Le SDK conserve sur l’appareil un journal de session depuis le lancement de l’application — pages, touchers, console et requêtes — et un agent qui se connecte plus tard relit tout le chemin jusqu’au bug avec <code>get_session_log</code>. En dehors de cela, le journal ne quitte jamais le téléphone.',
      },
      {
        q: 'L’agent peut-il corriger le bug sur le téléphone ?',
        a: 'Il peut vérifier un correctif : au niveau <strong>advanced</strong>, <code>evaluate_script</code> modifie en mémoire la page en cours d’exécution — corriger un état, remplacer une fonction, réafficher une vue — et l’agent voit si le problème disparaît. Le vrai correctif passe toujours par votre livraison habituelle ; rien n’est conservé sur l’appareil.',
      },
      {
        q: 'Quels agents fonctionnent avec ?',
        a: 'N’importe quel client MCP. Claude Code, Codex et Cursor utilisent directement le point d’accès Streamable HTTP hébergé ; les clients qui ne parlent que stdio passent par <code>rwd mcp</code>, un petit pont vers ce même point d’accès.',
      },
      {
        q: 'Quelles plateformes sont prises en charge ?',
        a: 'Toute WebView ou tout navigateur mobile moderne : WKWebView sur iOS, Android System WebView, navigateurs intégrés aux applications, ainsi que Safari ou Chrome mobile. Les navigateurs de bureau fonctionnent aussi.',
      },
      {
        q: 'Et sur un mauvais réseau, ou si les WebSockets sont bloqués ?',
        a: 'La page maintient un WebSocket de battement de cœur léger, avec temporisation exponentielle. Si la connexion échoue trois fois de suite, elle bascule sur un sondage de présence une fois par minute, et la passerelle la réveille quand un agent veut se connecter.',
      },
      {
        q: 'Est-ce que ça ralentit ma page ?',
        a: 'C’est un seul script. Les enregistrements de console et de réseau vivent dans des tampons circulaires bornés (500 entrées chacun, corps de réponse plafonnés à 5 Mo), le journal de session est écrit en arrière-plan, et une connexion inactive n’échange que des battements de cœur.',
      },
      {
        q: 'Est-ce que ça cohabite avec eruda, vConsole ou PageSpy ?',
        a: 'Oui — leurs nœuds sont ignorés par les instantanés et les tests de clic, notre propre trafic n’apparaît pas dans leurs journaux réseau, et le débogueur peut même s’installer comme un onglet dans eruda.',
      },
      {
        q: 'La démo ci-dessus est-elle réelle ?',
        a: 'Le SDK est réel et non modifié ; seule la passerelle est simulée dans votre navigateur. Une surcouche WebSocket tunnelise la connexion du SDK vers elle avec <code>postMessage</code>, et un agent scripté envoie les mêmes RPC qu’une vraie passerelle. Pour la version réelle de bout en bout, <a href="#live">essayez avec votre propre agent</a>.',
      },
    ],
  },
  footer: {
    tagline: 'Laissez des agents IA déboguer vos pages H5 et les WebViews de vos applications sur de vrais téléphones.',
    project: 'Projet',
    docs: 'Documentation',
    languages: 'Langues',
    links: {
      github: 'GitHub',
      issues: 'Tickets',
      license: 'Licence MIT',
      protocol: 'Protocole',
      gateway: 'Passerelle',
      sdk: 'SDK de page',
      architecture: 'Architecture',
      native: 'Intégration native',
    },
    note: 'Publié sous licence MIT. Aucun cookie, aucun traçage.',
  },
  notFound: {
    title: 'Page introuvable',
    body: 'Cette page n’existe pas — l’appareil est peut-être passé hors ligne.',
    home: 'Retour à l’accueil',
  },
  copy: { copy: 'Copier', copied: 'Copié' },
}
