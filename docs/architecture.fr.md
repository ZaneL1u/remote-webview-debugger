<!-- i18n-source: f1c156537ee729acb5ad4a7266a240554b3452f4 -->
[English](architecture.md) | [简体中文](architecture.zh-CN.md) | [繁體中文](architecture.zh-TW.md) | [日本語](architecture.ja.md) | [한국어](architecture.ko.md) | [Español](architecture.es.md) | Français | [Deutsch](architecture.de.md) | [Português (Brasil)](architecture.pt-BR.md) | [Русский](architecture.ru.md) | [العربية](architecture.ar.md)

# Architecture

Remote WebView Debugger permet à un agent IA d'inspecter et de piloter une page web ouverte sur le téléphone de quelqu'un d'autre : une page H5 dans un navigateur mobile ou une super-app, ou une WebView dans votre propre application. L'agent parle MCP à une passerelle auto-hébergée ; la passerelle parle à un petit SDK qui tourne dans la page. L'utilisateur du téléphone approuve la connexion, voit ce que fait l'agent et peut reprendre la main à tout moment.

Ce document décrit les différentes pièces et les règles qu'elles suivent. Les messages et les points de terminaison exacts se trouvent dans [protocol.fr.md](protocol.fr.md) ; l'intégration dans une application, dans [native-integration.fr.md](native-integration.fr.md) ; le déploiement, dans [gateway/README.fr.md](../gateway/README.fr.md) et [deploy/platform/README.fr.md](../deploy/platform/README.fr.md).

## Composants

```
  AI agent (Claude Code, Cursor, any MCP client)
        │  MCP: Streamable HTTP + Bearer API key
        │  (or stdio through the `rwd mcp` bridge)
        ▼
┌──────────────────────────── Gateway (one Go binary) ────────────────────────────┐
│  /v1/mcp      MCP tools ─────┐                                                  │
│  /v1/api      REST + SSE ────┼──▶ hub: devices, pages, control state, approvals,│
│  /v1/page     page WebSocket ┘        timelines, RPC routing   (in memory)      │
│  /v1/sdk.js   embedded page SDK      store: SQLite or Postgres (persistent)     │
│  /            embedded web console                                              │
└───────────▲──────────────────────────────────────────────▲──────────────────────┘
            │ HTTPS, cookie session                        │ WebSocket (wss://…/v1/page)
       Web console                                         │ POST /v1/presence as a fallback
       (support staff, admins)                             │
                                  ┌──────────── phone ─────┴────────────────────┐
                                  │  H5 page / App WebView                      │
                                  │    page SDK: link to the gateway, UI        │
                                  │      (pill, dialogs, lock) in a Shadow DOM  │
                                  │    engine: snapshots, actions, console and  │
                                  │      network capture, masking, levels       │
                                  │  native host (optional): injects the SDK,   │
                                  │    real screenshots, native dialogs/buttons │
                                  └─────────────────────────────────────────────┘
```

| Composant | Chemin | Rôle |
|---|---|---|
| Passerelle | [`gateway/`](../gateway) | Serveur Go. Accepte les connexions des pages, garde en mémoire l'état des appareils en direct, sert le point de terminaison MCP hébergé, l'API REST de la console web et ses mises à jour en direct, et tient le journal d'audit. Embarque la console web et le SDK : un seul binaire constitue tout le serveur |
| SDK de page | [`sdk/`](../sdk) | `sdk.js`, chargé par la page ou injecté par l'application. Gère la connexion, l'identité, l'interface dans la page, les boîtes de dialogue de consentement et le verrouillage de l'écran |
| Moteur | [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine) | La moitié côté page de chaque action de l'agent : instantanés d'accessibilité (le code d'aria snapshot de Playwright) et les calques qui flottent par-dessus, vérifications d'actionnabilité et saisie synthétique, capture de la console et du réseau (construite sur [chobitsu](https://github.com/liriliri/chobitsu)), captures d'écran, masquage, contrôle des niveaux |
| Console web | [`console/`](../console) | Application monopage React : projets et extraits d'intégration, appareils et leurs chronologies, clés d'API, membres, politiques, invitations, journal d'audit |
| Hôte natif | votre application ; référence dans [`examples/mock-app`](../examples/mock-app) | Injecte le SDK dans chaque WebView au début du document, conserve l'identifiant et le jeton d'appareil, fournit de vraies captures d'écran et, en option, des boîtes de dialogue d'approbation et des boutons natifs |

## Une session de débogage

1. **La page se met en ligne.** La page charge `sdk.js` (ou l'application l'injecte). La capture de la console, des erreurs et du réseau démarre aussitôt, dans des tampons de taille bornée, si bien qu'un agent qui se connecte plus tard voit quand même ce qui s'est passé avant. `run()` ouvre un WebSocket vers la passerelle et envoie `hello` ; la passerelle répond avec le **code d'appareil** (p. ex. `K7Q2-9M4X`) et la configuration distante du projet. La pastille de la page affiche le code.
2. **Quelqu'un oriente l'agent vers l'appareil.** L'utilisateur lit le code d'appareil à voix haute, touche **Demander une assistance** (l'appareil apparaît alors en tête de toutes les listes), ou ouvre un **lien d'invitation** envoyé par le support, qui met l'appareil en ligne avec une demande d'assistance déjà en cours.
3. **L'agent se connecte.** Il appelle `connect_device` avec le code. Sauf configuration contraire du projet, l'utilisateur voit *L'IA souhaite se connecter* sur le téléphone et choisit un niveau (consultation seule, consultation et interaction, avancé) ou refuse. Rien n'est lisible avant cela. Une fois l'agent entré, l'écran est verrouillé contre les saisies de l'utilisateur, les bords s'illuminent et la barre inférieure affiche depuis combien de temps il est connecté.
4. **L'agent travaille.** Il prend un instantané pour obtenir les références des éléments, puis clique, remplit et fait défiler par référence. L'instantané liste aussi les popups et les voiles qui flottent au-dessus de la page, chacun avec une référence, et un clic bloqué par un calque échoue en indiquant le nom et la référence de ce qui l'a bloqué — l'agent peut ainsi toucher un voile pour fermer sa popup au lieu de deviner. Sa première action fait passer l'appareil de *observe* à *agent*, et un curseur d'agent montre où il agit. Selon son niveau, il peut aussi lire la console, le réseau, le stockage et des captures d'écran.
5. **L'utilisateur reste maître.** **Reprendre** rend la page à l'utilisateur et met l'agent en pause (ses actions échouent avec `takeover` jusqu'à ce que l'utilisateur touche **Rendre**). **Terminer** détache l'agent. Les clics sur des éléments marqués comme sensibles (passer commande, payer, supprimer) nécessitent l'accord de l'utilisateur sur le téléphone.
6. **L'agent s'en va** avec `disconnect_device` ; après deux minutes sans action, l'appareil repasse en *observe*, et une fois la durée maximale de rattachement du projet écoulée (60 minutes par défaut), l'agent est détaché.

Une action, de bout en bout :

```
agent ─ click(ref=e12) ─▶ MCP handler
   gateway: API key valid? → attached? → level ≥ interact? → user hasn't taken over?
            observe (screen locked) → agent → RPC {"method":"rwd.click","params":{"ref":"e12"}}
   ─── WebSocket ──▶ SDK: level ≥ interact? not taken over? sensitive element → ask the user
                     engine: wait until visible, stable, enabled, hit-testable (≤ 5 s)
                             move the agent cursor, highlight, dispatch pointer/mouse/touch events
   ◀── {"id":…, "result":{}} ───
   gateway: audit "rpc" (method, page, latency; no payload)
agent ◀─ "Clicked e12 (page p2)." + [Session changes] (new pages, navigations, errors, takeovers)
```

Chaque action se fait en un seul aller-retour : les vérifications d'actionnabilité et l'envoi des événements s'exécutent dans la page, pas à travers le réseau.

## Appareils, pages et agents

**Appareil.** Un `deviceId` : un profil de navigateur, ou une installation d'application quand un hôte natif fournit son propre identifiant. La passerelle attribue à chaque appareil un code d'appareil permanent. Les appareils ne sont pas liés aux projets : un téléphone qui ouvre des pages de deux projets (deux clés d'application) est un seul appareil avec des pages des deux. Les clés d'API ne sont pas non plus liées aux projets, si bien qu'un seul serveur MCP donne accès à tous les appareils.

**Page.** Un onglet ou une WebView, identifié par un `pageId` qui survit aux rechargements et aux navigations dans cet onglet. La passerelle nomme les pages `p1`, `p2`, … pour chaque appareil, enregistre qui a ouvert qui, et suit la page au premier plan. Une page qui se déconnecte garde son libellé pendant deux minutes, le temps qu'une navigation se reconnecte — mais pas quand le même document réapparaît ailleurs : une WebView recréée sous un nouveau `pageId` remplace immédiatement l'ancienne entrée, et une page déconnectée dont l'URL est aussi affichée par une autre page connectée est retirée au bout de 1,5 s. Ainsi, une WebView recréée ne laisse pas de fantôme dans la liste des pages, et l'agent est déplacé vers la page qui existe réellement.

**Chronologie.** Chaque appareil a une chronologie (en mémoire, les 300 derniers événements) : pages ouvertes, parcourues, rechargées, mises au premier plan et fermées ; erreurs, requêtes échouées et touchers de l'utilisateur ; demandes d'assistance, approbations et changements de contrôle. Chaque résultat d'outil MCP se termine par les entrées de la chronologie que l'agent n'a pas encore vues : il remarque ainsi les nouvelles pages, les erreurs et les reprises de main sans avoir à interroger en boucle. En **mode suivi** (par défaut), la page sélectionnée par l'agent passe à une page que son action a ouverte, ou à la page vers laquelle l'utilisateur est allé.

**Agent.** La passerelle garde un état d'agent par clé d'API : l'appareil auquel il est rattaché et sa page sélectionnée. Un agent est rattaché à un seul appareil à la fois, et un appareil a au plus un agent ; un agent nouvellement approuvé remplace le précédent.

**État de contrôle.** Chaque appareil est dans l'un de quatre états, décidé par la passerelle et diffusé à toutes ses pages :

```
                 agent attaches                first interactive action
       ┌──────┐ ───────────────▶ ┌─────────┐ ─────────────────────────▶ ┌───────┐
       │ none │                  │ observe │                            │ agent │
       └──────┘ ◀─────────────── └─────────┘ ◀───────────────────────── └───────┘
           ▲     agent leaves,        │        idle (default 2 min)        │
           │     End, time limit      │ Take over                Take over │
           │                          ▼                                    ▼
           │                        ┌──────┐ ◀─────────────────────────────┘
           └─────────── End ─────── │ user │ ────── Hand back ──────▶ agent
                                    └──────┘
```

En `observe` et `agent`, les saisies de l'utilisateur sont bloquées (l'utilisateur peut désactiver le verrouillage dans la fenêtre flottante) ; en `user`, l'agent peut encore lire, mais chaque appel interactif échoue avec `takeover`, et l'agent peut appeler `wait_for_control` pour attendre que la main lui soit rendue.

## Consentement et confidentialité

Le principe directeur : **posséder une clé d'API ou connaître un code d'appareil ne suffit jamais pour voir la page d'un utilisateur.** Plusieurs contrôles indépendants s'interposent entre un agent et la page.

| Couche | Rôle |
|---|---|
| Clé d'API | Chaque requête MCP en porte une. Les clés ont un niveau maximal, une expiration (90 jours par défaut) et une liste d'IP autorisées facultative ; en révoquer une détache immédiatement son agent. Les recherches d'appareil échouées sont soumises à une limitation de débit, pour qu'on ne puisse pas deviner les codes d'appareil |
| Code d'appareil | Ne fait qu'*identifier* un appareil. Il n'accorde rien |
| Politique du projet | `approval: prompt` (la valeur par défaut des nouveaux projets) exige l'approbation de l'utilisateur ; `maxLevel` plafonne ce que n'importe quel agent peut faire. Quand un appareil a des pages de plusieurs projets, c'est la politique la plus stricte qui s'applique |
| Approbation de l'utilisateur | Le téléphone affiche le nom de l'agent, l'indice de sa clé et les niveaux proposés ; l'utilisateur en choisit un ou refuse. La boîte de dialogue vit dans un Shadow DOM et ne réagit qu'aux vrais touchers (de confiance), si bien qu'un agent ne peut pas s'approuver lui-même. Trois refus bloquent cette clé sur l'appareil pendant 10 minutes. Les utilisateurs peuvent activer l'autorisation automatique sur leur propre appareil. Un agent qui a lâché l'appareil de lui-même (déconnexion, changement d'appareil, durée de rattachement épuisée) peut revenir dans les 10 minutes sans nouvelle boîte de dialogue, à un niveau au plus égal à celui que l'utilisateur avait accordé ; un toucher de l'utilisateur sur **Terminer**, un membre de la console web qui met fin à la session, un refus ou la révocation de la clé annule cette possibilité |
| Niveaux | `observe` (instantané, capture d'écran, console, liste réseau), `interact` (+ clic, saisie, défilement, navigation…), `advanced` (+ exécution de JavaScript, corps des requêtes, stockage). Le niveau effectif est le minimum entre ce que l'agent a demandé, la clé, la politique et le choix de l'utilisateur. **Le SDK le fait respecter une seconde fois dans la page**, indépendamment de la passerelle |
| Contrôle visible | Tant qu'un agent est rattaché, la page le montre : une pastille avec l'état de l'agent, une carte de tâche avec son plan, un curseur d'agent et une mise en surbrillance à chaque action, une bordure lumineuse pendant qu'il agit. Reprendre, Rendre et Terminer ne répondent qu'aux touchers de l'utilisateur ; un hôte natif doit présenter un secret (`nativeKey`) que les scripts de la page, y compris ceux de l'agent, ne peuvent pas lire |
| Actions sensibles | Cliquer sur un élément marqué `data-rwd-confirm` (ou correspondant aux `confirmSelectors` de la politique), ou soumettre un formulaire qui en contient un, attend l'accord de l'utilisateur sur le téléphone |
| Masquage | Les champs de mot de passe, les éléments `data-rwd-mask` ainsi que les sélecteurs et motifs de texte de la politique (numéros de téléphone, de carte, d'identité…) sont remplacés par `••••` **dans la page**, avant que quoi que ce soit ne quitte l'appareil : dans les instantanés, les captures d'écran, le texte de la console, les URL et les corps réseau, les valeurs du stockage et les résumés de la chronologie. Les en-têtes `Cookie`, `Set-Cookie` et `Authorization` sont toujours expurgés. Les règles `networkExclude` de la politique sont autre chose : elles ne font qu'écarter le bruit (polices qui renvoient toujours 404, balises d'analytics) des listes que lit l'agent, et un agent peut demander à voir les requêtes masquées ; ce n'est donc pas un contrôle de confidentialité |
| Contenu non fiable | Le contenu de la page transmis à l'agent est encapsulé et étiqueté comme donnée non fiable, pour que des instructions placées dans une page ne soient pas prises pour celles de l'utilisateur. Les clics à haut risque reposent sur la confirmation de l'utilisateur, pas sur le jugement de l'agent |
| Journal de session | Enregistré sur l'appareil, jamais diffusé où que ce soit : le lire exige `observe` comme toute autre lecture, et les en-têtes et corps des requêtes échouées exigent `advanced`. Les règles de masquage s'appliquent au moment de l'enregistrement : la valeur d'un champ masqué est stockée sous la forme `••••`, et non masquée après coup. Un projet peut désactiver le journal et faire supprimer ce qui est stocké |
| Audit | Connexions, modifications de clés et de membres, demandes de rattachement et décisions, chaque RPC (méthode, page, latence, résultat), reprises de main et fins de session par l'utilisateur, et appels refusés. Jamais le contenu des pages ni les valeurs des paramètres |

Ce qui quitte le téléphone : les métadonnées de l'appareil dans `hello` (user agent, `userId` si la page en fournit un, nom et version de l'application, URL et titres des pages) et de courts résumés de chronologie, dès l'appel de `run()` ; tout le reste uniquement quand un agent rattaché le demande. La passerelle ne stocke pas le contenu des pages : les instantanés, captures d'écran et journaux transitent vers l'agent, et les chronologies vivent en mémoire. Le journal de session est enregistré sur l'appareil, selon les mêmes règles de masquage, et y reste jusqu'à ce qu'un agent rattaché le lise (voir **Stockage** ci-dessous).

Limites connues, à dire clairement :

- Les saisies sont synthétiques : les événements ont `isTrusted: false`, et les pages qui le vérifient n'y réagiront pas.
- `interact` permet à l'agent de naviguer vers n'importe quelle URL `http(s)` ; ce n'est pas limité aux origines du projet.
- `advanced` exécute du JavaScript arbitraire dans la page. Le masquage ne peut pas s'appliquer à ce que renvoie un tel script : gardez donc `maxLevel` à `interact` sauf si vous en avez besoin.
- La capture réseau couvre les requêtes que la page émet en JavaScript après le chargement du SDK (fetch, XHR, WebSocket, sendBeacon, EventSource). Les images, scripts, feuilles de style et requêtes émises par le code natif ne sont pas vus. Le contenu des iframes ne fait pas partie des instantanés.
- Quand une application passe en arrière-plan, le système met ses WebViews en pause, et l'appareil est hors ligne jusqu'à son retour.
- Points d'arrêt, exécution pas à pas, profilage et instantanés du tas sont hors périmètre ; utilisez pour cela Safari Web Inspector ou `chrome://inspect` avec une WebView débogable.

## Stockage

La passerelle utilise **SQLite** par défaut (pur Go, sans CGO ; un fichier défini par `RWD_DATA`) ou **Postgres** quand `RWD_DATABASE_URL` est une URL `postgres://`. Le schéma est créé et migré au démarrage.

| Persistant (base de données) | En mémoire uniquement (perdu au redémarrage) |
|---|---|
| Projets et leurs politiques, clés d'application | Pages connectées et leurs libellés |
| Membres (mots de passe en PBKDF2-SHA256), invitations de membres en attente | État de contrôle, approbations en attente, agents rattachés |
| Clés d'API (empreintes HMAC-SHA256, niveaux, expiration, listes d'IP autorisées) | Chronologies des appareils |
| Appareils connus : identifiant, code, userId, user agent, application, première et dernière apparition, empreinte du jeton d'appareil | Compteurs de limitation de débit |
| Invitations d'appareil (empreintes des jetons), journal d'audit | |
| Réglages : le poivre des clés et le secret de signature des sessions, générés au premier démarrage | |

Après un redémarrage, les pages se reconnectent d'elles-mêmes (le SDK réessaie avec un délai croissant) et gardent leurs codes d'appareil ; les agents se reconnectent. L'état en direct vit dans un seul processus : faites donc tourner **une seule instance de passerelle** par base de données.

**Sur le téléphone, pas sur la passerelle.** Un stockage se trouve délibérément en dehors de tout cela : le **journal de session**, que le SDK de page écrit dans IndexedDB sur l'appareil (base `rwd-log`). Dès le lancement de l'application, il enregistre les pages visitées, les touchers et saisies de l'utilisateur, les actions de l'agent, les changements de contrôle, la sortie console et chaque requête — les requêtes échouées avec leurs en-têtes et leurs corps —, que la passerelle soit joignable ou non. C'est ce qui permet à un agent qui se rattache *après* un bug de lire tout le chemin qui y a mené, au lieu de partir d'un tampon vide. Il conserve les trois derniers lancements, jusqu'à 10 Mo chacun, et rien de son contenu n'atteint la passerelle ni qui que ce soit d'autre, sauf si un agent rattaché le demande avec `get_session_overview` / `get_session_log` ([protocol.fr.md §5.4](protocol.fr.md#54-journal-de-session)). Un projet peut le désactiver (`policy.sessionLog`), ce qui supprime aussi ce qui est déjà stocké sur ses appareils, et une page donnée peut s'en exclure avec `run({ record: false })`.

## Notes de sécurité pour les opérateurs

- **Servez-la en HTTPS.** Les pages se connectent en `wss://`, le cookie de la console web est marqué `Secure` en HTTPS, et les clés d'API circulent dans des en-têtes. Le déploiement Docker Compose de [deploy/platform](../deploy/platform/README.fr.md) termine le TLS avec Caddy ou se place derrière votre propre proxy.
- **Ne faites confiance aux en-têtes transférés que derrière un proxy.** `--trust-proxy` fait prendre à la passerelle les IP des clients et son hôte public dans `X-Forwarded-For` / `X-Forwarded-Host`. Sans proxy en frontal, n'importe qui pourrait les falsifier et contourner les listes d'IP autorisées et les limitations de débit.
- **Protégez la base de données et ses sauvegardes.** Elles contiennent le poivre des clés et le secret des sessions ; avec eux, on peut vérifier hors ligne les empreintes des clés d'API et forger des sessions de console web.
- **Le mot de passe du propriétaire.** `RWD_ADMIN_PASSWORD` réinitialise le mot de passe du propriétaire à chaque démarrage, ce qui sert aussi de récupération de compte. S'il n'est pas défini sur une base de données neuve, un mot de passe aléatoire est affiché une seule fois dans le journal.
- **Les clés d'application sont publiques.** Elles permettent seulement aux pages de se mettre en ligne. Utilisez `allowedOrigins` pour empêcher d'autres sites d'utiliser la vôtre ; notez que `Origin` est un en-tête imposé par le navigateur et que les clients hors navigateur peuvent envoyer n'importe quoi : c'est pourquoi ce sont les jetons d'appareil (et non les clés d'application) qui protègent les appareils existants.
- **Traitez les clés d'API comme des mots de passe.** Donnez à chaque agent ou personne sa propre clé, avec le niveau le plus bas qui suffit, une expiration et, pour les serveurs, une liste d'IP autorisées. La révocation est immédiate.
- **Épinglez le SDK.** Pour les pages H5, la console web propose un extrait qui charge le SDK depuis une URL adressée par contenu, avec Subresource Integrity. Les applications natives peuvent embarquer `sdk.js` au lieu de le télécharger à l'exécution, de sorte qu'une passerelle compromise ne puisse pas leur pousser du nouveau code.
- **Protégez les métriques.** Définissez `RWD_METRICS_TOKEN` si `/v1/metrics` est accessible de l'extérieur.
- La connexion à la console web est soumise à une limitation de débit (10 tentatives par minute et par IP), les requêtes d'écriture exigent un en-tête CSRF personnalisé, et la console web ne peut pas être intégrée dans un cadre.
