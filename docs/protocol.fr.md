<!-- i18n-source: 009fbfa49ecd8b79b529fe92dac99fd35d55812b -->
[English](protocol.md) | [简体中文](protocol.zh-CN.md) | [繁體中文](protocol.zh-TW.md) | [日本語](protocol.ja.md) | [한국어](protocol.ko.md) | [Español](protocol.es.md) | Français | [Deutsch](protocol.de.md) | [Português (Brasil)](protocol.pt-BR.md) | [Русский](protocol.ru.md) | [العربية](protocol.ar.md)

# Protocole RWD (v1)

Ce document est le contrat entre la passerelle ([`gateway/`](../gateway)), le SDK de page ([`sdk/`](../sdk), dont le moteur se trouve dans [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine)), la console web ([`console/`](../console)) et les clients MCP. Quand le protocole change, c'est d'abord ce document qui change.

Pour la vue d'ensemble (composants, modèle de consentement, stockage, sécurité), voir [architecture.fr.md](architecture.fr.md) ; pour l'intégration dans une app, voir [native-integration.fr.md](native-integration.fr.md).

Conventions :

- L'**URL de la passerelle** est `https://<host>/v1`, par exemple `https://rwd.example.com/v1`. Tous les points de terminaison se trouvent sous cette URL ; le SDK en déduit toutes les adresses.
- Du JSON partout. Les horodatages sont exprimés en **millisecondes** depuis l'epoch Unix.
- `Level` vaut `"observe" | "interact" | "advanced"` (voir [§6](#6-niveaux-daccès)).
- Le destinataire ignore les champs qui ne sont pas listés ici. Les nouveaux champs sont toujours facultatifs : un ancien SDK continue donc de fonctionner avec une passerelle plus récente.

## Sommaire

1. [Points de terminaison](#1-points-de-terminaison)
2. [Identifiants](#2-identifiants)
3. [Connexion de la page (WebSocket)](#3-connexion-de-la-page-websocket)
4. [État de contrôle](#4-état-de-contrôle)
5. [RPC de page](#5-rpc-de-page)
6. [Niveaux d'accès](#6-niveaux-daccès)
7. [Approbation du rattachement](#7-approbation-du-rattachement)
8. [Confirmation des actions sensibles](#8-confirmation-des-actions-sensibles)
9. [Repli par polling de présence](#9-repli-par-polling-de-présence)
10. [API JavaScript pour les hôtes](#10-api-javascript-pour-les-hôtes)
11. [Politique de projet](#11-politique-de-projet)
12. [API REST de la console](#12-api-rest-de-la-console)
13. [Mises à jour en direct (SSE)](#13-mises-à-jour-en-direct-sse)
14. [MCP](#14-mcp)
15. [Langues](#15-langues)
16. [Exploitation](#16-exploitation)
17. [DevTools pour tout le monde](#17-devtools-pour-tout-le-monde)

## 1. Points de terminaison

| Chemin | Description |
|---|---|
| `GET /v1/sdk.js` | SDK de page (une IIFE qui expose la variable globale `RemoteWebviewDebugger`). `Cache-Control: max-age=300`, `Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | Le même fichier, à une URL immuable adressée par son contenu (mise en cache pendant un an ; utilisable avec SRI). Toute autre `<version>` renvoie 404. Voir [§16](#16-exploitation) |
| `GET /v1/locales/<id>.js`, `GET /v1/sdk/<version>/locales/<id>.js` | Les packs de langue du SDK chargés à la demande, que `sdk.js` va chercher à côté de lui-même ([§15](#15-langues)). `Cache-Control: max-age=300` |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Métriques Prometheus ([§16](#16-exploitation)) |
| `WS /v1/page?key=<appKey>` | Connexion de la page ([§3](#3-connexion-de-la-page-websocket)) |
| `POST /v1/presence` | Repli par polling quand le WebSocket ne parvient pas à se connecter ([§9](#9-repli-par-polling-de-présence)) |
| `WS /v1/devtools?ticket=<ticket>` | La connexion CDP d'une fenêtre DevTools, depuis l'origine de la console uniquement ([§17](#17-devtools-pour-tout-le-monde)) |
| `/v1/api/…` | API REST de la console ([§12](#12-api-rest-de-la-console)) |
| `/v1/mcp` | Serveur MCP hébergé, Streamable HTTP, `Authorization: Bearer rwd_sk_live_…` ([§14](#14-mcp)) |
| `/demo/` | Fichiers statiques de `--demo-dir`, uniquement si l'option est configurée |
| `/devtools/…` | Le frontend Chrome DevTools que la console embarque ([§17.4](#174-frontend)) |
| tout autre chemin | Application monopage de la console |

Les chemins inconnus sous `/v1/` renvoient `404 {"error":{"code":"not_found",…}}`. Toutes les réponses portent `X-Content-Type-Options: nosniff` et `Referrer-Policy: no-referrer` ; toutes, sauf le SDK, portent aussi `X-Frame-Options: DENY`, ou `SAMEORIGIN` sous `/devtools/`.

## 2. Identifiants

| Nom | Format | Origine |
|---|---|---|
| Clé d'application | `rwd_pk_` + 24 caractères base62 | Créée avec un projet. Publique : elle apparaît dans le code source de la page et permet seulement à une page de se mettre en ligne |
| Clé d'API | `rwd_sk_live_` + 32 caractères base62 | Créée dans la console, affichée une seule fois. Stockée en HMAC-SHA256 avec un pepper côté serveur. La console affiche ses 16 premiers caractères (`prefix`, p. ex. `rwd_sk_live_ab12`) ; les appareils voient `"…"` suivi des 4 derniers caractères du préfixe (`keyHint`) |
| `deviceId` | UUID v4 (tout `[A-Za-z0-9_-]{1,64}` est accepté) | Généré par le SDK et conservé dans le localStorage `rwd:device`, ou transmis par un hôte natif avec `run({ deviceId })` |
| Code d'appareil | `XXXX-XXXX` sur l'alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | Attribué par la passerelle la première fois qu'elle voit un `deviceId` ; ne change jamais. Quand un agent s'en sert pour se connecter, la casse, les tirets et les espaces n'ont pas d'importance |
| `pageId` | 12 caractères base62 (tout `[A-Za-z0-9_-]{1,64}` est accepté) | Généré par le SDK, conservé dans le sessionStorage `rwd:page` : stable d'un rechargement ou d'une navigation à l'autre dans le même onglet, nouveau pour chaque onglet |
| Libellé de page | `p1`, `p2`, … | Attribué par la passerelle, par appareil ; conservé tant que la page se reconnecte dans le délai de grâce de 2 minutes |
| Identifiant de session (de lancement) | L'identifiant de lancement propre à l'app hôte (4 à 128 caractères parmi `[A-Za-z0-9_.:-]`), sinon 16 caractères hexadécimaux générés par le SDK | Un lancement de l'app, sous lequel la page range son journal de session ([§5.4](#54-journal-de-session)). Jamais envoyé à la passerelle, sauf dans un résultat de `rwd.log` |
| `ref` | `e12`, `o3`, … | `eN` : un élément du dernier instantané de la page, valable jusqu'au prochain instantané de cette page. `oN` : un élément qui n'a pas de nœud dans l'instantané — une surcouche, ou ce qui recouvre un point de clic ([§5.3](#53-comportement-dans-la-page)) ; il reste valable tant que cet élément est présent dans la page |
| Jeton d'appareil | 64 caractères hexadécimaux | Émis une seule fois par `deviceId` ([§3.5](#35-jeton-dappareil-jeton-de-reprise-et-invitations)) ; la passerelle n'en stocke qu'un hachage |
| Jeton de reprise | 32 caractères hexadécimaux | Renouvelé à chaque `welcome` ([§3.5](#35-jeton-dappareil-jeton-de-reprise-et-invitations)) ; stocké sous forme de hachage |

## 3. Connexion de la page (WebSocket)

### 3.1 Cycle de vie

1. La page ouvre `wss://<host>/v1/page?key=<appKey>`. Avant l'upgrade, la passerelle vérifie :
   - la limitation de débit : 120 connexions (et appels de présence) par minute et par IP client → `429 rate_limited` ;
   - que la clé d'application existe et que son projet n'est pas désactivé → sinon `401 bad_key` ;
   - si le projet définit `allowedOrigins`, que l'en-tête `Origin` correspond à l'une d'elles → sinon `403 origin_not_allowed`.
2. Trames texte uniquement, un objet JSON par trame. Les messages entrants peuvent atteindre 16 Mio (les captures d'écran arrivent encodées en base64).
3. La page doit envoyer `hello` dans les **5 secondes**. Un `hello` malformé (JSON invalide, mauvais `t`, `deviceId` / `pageId` invalide) est fermé avec `1008`.
4. La passerelle répond par `welcome` ([§3.4](#34-welcome)), ou ferme la connexion avec un code de fermeture du protocole ([§3.6](#36-codes-de-fermeture)).
5. La passerelle envoie `{"t":"hb"}` toutes les **25 secondes**, plus un ping WebSocket auquel il faut répondre sous 10 secondes. Le SDK se reconnecte lorsqu'il n'entend plus rien pendant **60 secondes**.
6. Les reconnexions du SDK suivent un backoff exponentiel de 1 s à 30 s, chaque délai étant tiré au hasard dans la moitié supérieure du palier courant. Après **3 tentatives consécutives qui se terminent avant un `welcome`**, le SDK passe au polling de présence ([§9](#9-repli-par-polling-de-présence)).
7. Une deuxième connexion avec le même `pageId` remplace la première (fermée avec `1000 replaced`).
8. Une page qui se déconnecte garde son libellé et sa place pendant un **délai de grâce de 2 minutes** (les navigations se reconnectent bien avant). Passé ce délai, elle apparaît comme `closed` dans la chronologie. Deux cas abrègent l'attente, pour qu'une WebView recréée ne reste pas dans la liste des pages avec l'état *en reconnexion* :
   - une page qui se connecte avec un **nouveau `pageId`** écarte immédiatement toutes les pages déconnectées qui affichent la même URL (le fragment `#` est ignoré) ;
   - une page déconnectée dont l'URL est aussi affichée par une page **connectée** est écartée au bout de **1,5 s** seulement.

   Dans les deux cas, si la page écartée était la page sélectionnée par l'agent, la sélection passe à la page active et le résultat le signale ([§14.3](#143-outils)).
9. Le SDK ferme le socket sur `pagehide` (pour que la page puisse entrer dans le cache précédent/suivant) et se reconnecte sur `pageshow`.

Chaque connexion dispose d'une file d'envoi de 64 messages. Une page qui ne suit pas est fermée avec `1013 slow consumer` plutôt que de ralentir la passerelle.

### 3.2 Page → passerelle

```jsonc
{"t":"hello","v":1,"sdk":"<SDK version>",
 "deviceId":"…","pageId":"…","openerId":"<pageId>"|null,
 "userId":"<string>"|null,
 "page":{"url":"…","title":"…","visibility":"visible"|"hidden"},
 "device":{"ua":"…","platform":"ios"|"android"|"web",
           "screen":{"w":393,"h":852,"dpr":3},
           "app":{"name":"…","version":"…"}|null},
 "help":false,
 "deviceToken":"<token>"|null,   // toujours présent dans les SDK actuels, voir §3.5
 "resume":"<token>"|null,        // le dernier jeton de reprise reçu par ce pageId
 "invite":"<token>"|null}        // issu de ?rwd_invite=…

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // à chaque changement
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // l'utilisateur demande une assistance / annule
{"t":"control","action":"takeover"|"handback"|"end"}                // les boutons de l'utilisateur, §4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"t":"cdp","s":"<session>"|absent,"m":"<CDP JSON>"}                 // réponse / événement DevTools, §17.2
{"id":17,"result":{…}}                                              // succès RPC, §5
{"id":17,"error":{"code":"not_found","message":"…"}}                // échec RPC, §5
```

- `hello` : la passerelle conserve `userId` (jusqu'à 128 caractères), `ua` (512), `platform` (16), `app`, `url` (2048) et `title` (256). `screen` est purement informatif.
- `event.summary` est une phrase destinée à l'agent, déjà débarrassée des valeurs masquées, p. ex. `TypeError: Cannot read properties of undefined (reading 'orderId')`, `POST /api/order → 405`, `Tapped button "Place order"`. La passerelle enregistre chaque type dans la chronologie (jusqu'à 300 octets) et ignore les types inconnus. Les navigations, y compris internes à la page, ne sont pas des événements : la passerelle les déduit des messages `page` (`navigated` dans la chronologie, [§12.9](#129-événements-de-la-chronologie)) ; le SDK les conserve dans le journal de session ([§5.4](#54-journal-de-session)).
- Le SDK dédoublonne les événements (même type et même résumé en moins de 2 s) et en envoie au plus 30 toutes les 10 s. Les événements et les actions de contrôle déclenchés hors ligne attendent dans une file (jusqu'à 100 messages) le prochain `welcome`.
- `help` et `control` ne sont envoyés qu'à la suite d'appuis de l'utilisateur (ou d'appels de l'hôte natif, [§10](#10-api-javascript-pour-les-hôtes)).

### 3.3 Passerelle → page

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"Support Bot"}|null,"level":"interact"|null,
 "attachedMs":83000|null}                                     // §4, à toutes les pages de l'appareil
{"t":"help","on":false}                                       // demande d'assistance levée : un agent s'est rattaché, un membre de la console a terminé la session, ou l'utilisateur l'a terminée sur l'appareil
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"Support Bot"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7, à la page au premier plan
{"t":"attach_cancel","requestId":"…"}                         // §7, à toutes les pages
{"t":"devtools","s":"<session>","on":true,"by":"Ann"}         // §17.2, une fenêtre DevTools s'est ouverte / fermée ("on":false)
{"t":"cdp","s":"<session>","m":"<CDP JSON>"}                  // §17.2, une commande venant de cette fenêtre
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // réservé : le SDK se reconnecte après afterMs
{"id":17,"method":"rwd.snapshot","params":{}}                 // requête RPC, §5
```

`reconnect` est compris par le SDK ; la passerelle ne l'envoie pas à ce jour.

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null,"attachedMs":null},
 "level":null,                       // identique à control.level
 "resume":"<new resume token>",
 "deviceToken":"<token>",            // seulement si ce welcome l'émet
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},   // ou null, voir ci-dessous
 "agentLang":"en",                   // la langue de la passerelle : "en", "zh", "zh-TW", "fr"…, §15
 "task":{…}}                         // seulement si l'agent rattaché en a défini une
```

`config` est la configuration distante issue de la politique du projet dont la page a utilisé la clé d'application ([§11](#11-politique-de-projet)). `config.helpButton` est déjà résolu pour le `userId` de cette page (`all`, ou `listed` et l'utilisateur figure dans la liste). `config.networkExclude` s'ajoute aux règles que la page a elle-même passées à `run({ networkExclude })` ([§10](#10-api-javascript-pour-les-hôtes)). `config.sessionLog` est l'interrupteur du journal de session au niveau du projet ; `false` arrête l'enregistrement et supprime ce que cette origine avait déjà conservé ([§5.4](#54-journal-de-session)). `config.eruda` est la politique eruda du projet ([§11](#11-politique-de-projet)) ; il peut aussi valoir `null` ou être absent (passerelle, ou `config` stockée, antérieure à ce champ), ce que le SDK interprète comme `{"dock":false,"load":false}`, et le `run({ eruda })` de la page l'emporte toujours champ par champ ([§10](#10-api-javascript-pour-les-hôtes)). Le SDK conserve la dernière `config` dans le localStorage `rwd:cfg` et l'applique à la page suivante jusqu'à l'arrivée de son `welcome`.

Si une demande de rattachement est en attente et que la page qui se reconnecte est la page au premier plan de l'appareil, la passerelle renvoie l'`attach_request` juste après le `welcome`.

### 3.5 Jeton d'appareil, jeton de reprise et invitations

**Jeton d'appareil.** La première fois que la passerelle voit un `deviceId` provenant d'un SDK qui gère les jetons, elle émet un jeton d'appareil dans `welcome.deviceToken` (32 octets aléatoires, en hexadécimal ; seul un hachage est stocké). Dès lors, chaque page de cet appareil doit le présenter dans `hello.deviceToken` ; un jeton absent ou erroné entraîne une fermeture avec **4401**. Connaître un `deviceId` et la clé d'application publique ne suffit donc pas pour rejoindre l'appareil de quelqu'un.

- Le SDK stocke le jeton dans le localStorage `rwd:dtoken` et l'expose via `status().deviceToken`. Le localStorage est propre à chaque origine : un hôte natif qui charge plusieurs domaines conserve donc lui-même le jeton et le renvoie avec `run({ deviceToken })` ([native-integration.fr.md](native-integration.fr.md)).
- Un hello qui possède un champ `deviceToken` (même `null`) provient d'un SDK qui gère les jetons. Un hello sans ce champ provient d'un SDK incapable de conserver un jeton ; la passerelle ne lui en émet pas (cela bloquerait les pages suivantes de l'appareil), mais dès qu'un appareil possède un jeton, chaque page doit le présenter.

**Jeton de reprise.** Chaque `welcome` porte un nouveau jeton `resume` lié au `pageId`. Quand une page au `pageId` connu se reconnecte, son `hello.resume` doit correspondre au dernier jeton émis ; sinon la connexion est fermée avec **4409** et le SDK repart avec un nouveau `pageId`. Connaître un `pageId` ne suffit donc pas pour usurper une page.

**Invitation.** Quand l'URL de la page contient `?rwd_invite=<token>`, le SDK retire le paramètre de la barre d'adresse (`history.replaceState`), conserve le jeton dans le sessionStorage et l'envoie dans `hello.invite` jusqu'à l'arrivée d'un `welcome`. La passerelle l'accepte si l'invitation appartient au même projet, n'a pas encore servi et n'a pas expiré : l'appareil est marqué `invited` et en demande d'assistance, la chronologie enregistre l'invitation dont il provient, et l'invitation est consommée. Les invitations invalides sont ignorées silencieusement. Voir [§12.6](#126-invitations-dappareil).

### 3.6 Codes de fermeture

| Code | Signification | Réaction du SDK |
|---|---|---|
| `1008` | `hello` malformé | Reconnexion avec backoff |
| `1013` | La page n'a pas réussi à suivre sa file d'envoi | Reconnexion avec backoff |
| `4401` | Jeton d'appareil absent ou erroné | Si le jeton stocké a changé entre-temps (un autre onglet vient de le recevoir), nouvel essai immédiat. S'il n'y a aucun jeton et que le `deviceId` est celui du SDK (pas transmis par un hôte), le welcome qui portait le jeton a été perdu (la première page est partie en pleine poignée de main) : au bout d'environ 1,5 s, sauf si un autre onglet a stocké un jeton entre-temps, repartir de zéro avec un nouveau `deviceId` (au plus deux fois par page). Sinon état `rejected`, nouvel essai dans 10 minutes environ |
| `4409` | Jeton de reprise non concordant | Nouveau `pageId`, reconnexion |
| `4429` | Le quota d'appareils en ligne du projet (`maxOnlineDevices`) est atteint | État `quota`, nouvel essai dans 5 minutes environ |

## 4. État de contrôle

Chaque appareil a un état de contrôle unique, décidé par la passerelle et diffusé à toutes les pages de l'appareil par un message `control`.

| État | Signification | Interface de la page |
|---|---|---|
| `none` | Aucun agent rattaché | Pastille repliée avec le code d'appareil (plus le bouton « Demander une assistance » s'il est activé) |
| `observe` | Un agent est rattaché et se contente de regarder | « L'IA consulte », la saisie de l'utilisateur est bloquée (sauf s'il a désactivé le verrouillage), bord de l'écran lumineux, boutons **Reprendre** et **Terminer** |
| `agent` | L'agent pilote la page | « L'IA agit », même verrouillage, même bord et mêmes boutons, plus le curseur de l'agent |
| `user` | L'utilisateur a repris la main | Pas de verrouillage, un bord statique, boutons **Rendre** et **Terminer** |

Transitions :

| Déclencheur | Changement |
|---|---|
| Un agent se rattache ([§7](#7-approbation-du-rattachement)) | `none` → `observe` |
| L'agent appelle un outil interactif (click, fill, type, press, select, hover, scroll, drag, navigate, back, reload) | `observe` → `agent`. En `user`, la passerelle refuse avec l'erreur `takeover` sans contacter la page |
| Aucune interaction pendant `policy.agentIdleMinutes` (2 par défaut ; vérifié toutes les 10 s) | `agent` → `observe` |
| La page envoie `control: takeover` | `observe` / `agent` → `user` |
| La page envoie `control: handback` | `user` → `agent` (ou `none` si aucun agent n'est rattaché) |
| La page envoie `control: end` | L'agent est détaché et la demande d'assistance est levée → `none` |
| L'agent se déconnecte ou est remplacé, sa clé est révoquée, `policy.attachMaxMinutes` (60 par défaut) arrive à échéance, ou un membre de la console termine la session | → `none` |

La page se verrouille dès qu'un agent se rattache (`observe`), et pas seulement quand il agit ; elle reste verrouillée lors du retour `agent` → `observe` pour inactivité, jusqu'à ce que l'utilisateur reprenne la main ou que l'état revienne à `none`.

`attachedMs` indique depuis combien de temps l'agent est rattaché, en millisecondes, au moment où la passerelle a envoyé le message (`null` sans agent). C'est une durée, pour que la page n'ait pas besoin d'une horloge commune avec la passerelle ; la barre inférieure l'affiche sous forme de minuteur « Connecté · 01:23 » en `observe`, `agent` et `user`, et « Connexion… » tant que la liaison de la page elle-même est coupée. Avec une passerelle qui n'envoie pas ce champ, le SDK compte à partir du moment où la page a vu l'agent pour la première fois.

Le SDK refuse aussi les RPC interactives avec `takeover` tant que l'utilisateur détient le contrôle, par une seconde vérification. Il mémorise l'état (et le moment où l'agent s'est rattaché) pendant 2 minutes dans le localStorage `rwd:ctl`, si bien que la page suivante, après une navigation, se verrouille immédiatement, minuteur en marche, au lieu d'attendre son `welcome`. Les boutons « Reprendre », « Rendre » et « Terminer » ne répondent qu'aux appuis de confiance de l'utilisateur ; un agent ne peut pas les déclencher, et un hôte natif doit présenter la `nativeKey` ([§10](#10-api-javascript-pour-les-hôtes)).

## 5. RPC de page

### 5.1 Enveloppe

La passerelle envoie `{"id":<n>,"method":"rwd.…","params":{…}}` à une page ; la page répond par `{"id":<n>,"result":{…}}` ou `{"id":<n>,"error":{"code":"…","message":"…"}}`. Les ids sont uniques par connexion. Si la connexion tombe, les appels en attente échouent immédiatement.

Délais d'expiration côté passerelle : 20 s pour les appels MCP, 45 s pour `rwd.click`, `rwd.press` et `rwd.type` avec `submit: true` (l'utilisateur peut avoir à confirmer, [§8](#8-confirmation-des-actions-sensibles)), 15 s pour le test de connexion de la console.

Codes d'erreur :

| Code | Signification |
|---|---|
| `not_found` | `ref` périmée ou élément disparu, option inconnue, id de demande inconnu |
| `not_interactable` | Non visible, désactivé, recouvert, en lecture seule, ou pas stable en moins de 5 s |
| `timeout` | Une attente a expiré (dans la page ou à la passerelle) |
| `takeover` | L'utilisateur détient le contrôle |
| `forbidden` | Au-delà du niveau accordé ([§6](#6-niveaux-daccès)), ou l'utilisateur a refusé une confirmation |
| `bad_request` | Paramètre manquant ou invalide, méthode inconnue |
| `internal` | Tout le reste (le message contient l'erreur JavaScript) |

Les messages rédigés par le SDK sont dans la langue de l'agent (`welcome.agentLang`, [§15](#15-langues)).

### 5.2 Méthodes

Chaque méthode agit sur la page qui la reçoit.

| Méthode | Niveau | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<ms>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}` : un instantané d'accessibilité au format IA de Playwright (YAML, éléments marqués `[ref=eN]`), suivi d'une section des surcouches quand quelque chose flotte au-dessus de la page ([§5.3](#53-comportement-dans-la-page)) |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}` (au moins un critère ; `limit` de 1 à 100) | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`, voir [§5.4](#54-journal-de-session) | Dépend de `op` |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}` : noms de touches Playwright, combinaisons comme `Control+A` | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}` (la page se reconnecte ensuite) |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | Un enregistrement complet du journal de session : `{"seq","session","at","kind","page","imp","size","data"}`, en-têtes et corps compris ([§5.4](#54-journal-de-session)) |

Détails :

- `rwd.query` compare `role` exactement (sans tenir compte de la casse) et `name` / `text` comme sous-chaînes insensibles à la casse ; `text` couvre le texte propre de l'élément et celui de ses descendants, et seule la correspondance la plus profonde est renvoyée.
- `rwd.fill` fonctionne sur les champs de texte, les textareas et les éléments `contenteditable` (un `<label>` est redirigé vers son contrôle). Il définit la valeur via le setter natif et déclenche `input` et `change`, pour que les champs contrôlés de React et Vue voient le changement. Un `<select>` nécessite `rwd.select`.
- `rwd.type` donne le focus à `ref` (curseur à la fin) si elle est fournie, sinon saisit dans l'élément qui a le focus ; `submit: true` appuie ensuite sur Entrée.
- `rwd.select` compare chaque valeur à la valeur, au libellé ou au texte d'une option. Plusieurs valeurs exigent un select `multiple`.
- `rwd.scroll` sans `ref` fait défiler la page ; avec `ref`, il déclenche un événement wheel sur l'élément et fait défiler son ancêtre défilable. Les défilements sont animés sur environ 0,3 s pour que l'utilisateur puisse suivre.
- `rwd.navigate` n'accepte que des URL `http(s)` absolues ou relatives. La navigation, le retour arrière et le rechargement ont lieu 50 ms après l'envoi de la réponse.
- `rwd.waitFor` attend d'abord `timeMs` (60 s au maximum), puis interroge le texte visible (`document.body.innerText`) toutes les 100 ms jusqu'à ce que `text` apparaisse et que `textGone` disparaisse, ou échoue avec `timeout` après `timeoutMs`.
- `rwd.screenshot` utilise la capture native de l'app hôte lorsqu'elle en a enregistré une et que la zone est dans le viewport (`source: "native"`), sinon il refait le rendu du DOM (`source: "dom"` ; les canvas, les vidéos et les images cross-origin peuvent être vides). `ref` recadre sur l'élément ; `fullPage` capture tout le document. Voir [§10](#10-api-javascript-pour-les-hôtes).
- `rwd.console` / `rwd.network` avec `sinceId` renvoient les `limit` entrées les plus anciennes qui le suivent ; sans, les `limit` plus récentes. Les requêtes en cours ont `status: 0` et `durationMs: null` ; `type` vaut `xhr`, `fetch`, `websocket`, `beacon` ou `eventsource`.
- `rwd.network` omet les requêtes couvertes par les règles d'exclusion — le `networkExclude` du projet plus `run({ networkExclude })` ([§11](#11-politique-de-projet)), plus `exclude` pour cet appel seulement — et `hidden` les compte. `includeExcluded: true` les renvoie toutes et laisse `hidden` à 0. Les requêtes exclues restent enregistrées, et `rwd.networkDetail` les renvoie toujours par leur id.
- `rwd.networkDetail` caviarde les en-têtes `Cookie`, `Set-Cookie`, `Authorization` et `Proxy-Authorization` ; les corps sont masqués et tronqués à 64 Ko.
- `rwd.storage` renvoie au plus 500 entrées, avec des valeurs tronquées à 4 000 caractères. Les cookies sont ceux visibles par les scripts (pas HttpOnly). Les `rwd:dtoken` et `rwd:resume` du SDK lui-même sont toujours masqués.
- `rwd.evaluate` évalue le code source de la fonction dans la portée globale de la page et l'appelle avec `this = window` ; elle peut renvoyer une promesse. Le résultat est rendu sérialisable en JSON : `undefined` et les fonctions deviennent `null`, les éléments une courte description de balise, les dates des chaînes ISO, les cycles `"[Circular]"`.

### 5.3 Comportement dans la page

- **Actionnabilité.** Les actions de pointeur attendent (jusqu'à 5 s) que l'élément soit attaché au document, visible, stable sur deux frames d'animation, activé et amené dans la zone visible, et qu'un hit-test au point cible tombe sur l'élément ou sur l'un de ses descendants. Le premier point essayé est le centre visible de l'élément, comme le ferait un doigt ; si quelque chose le recouvre, les autres points d'une grille 3×3 tracée dans sa zone visible sont essayés, si bien qu'un badge posé sur un bouton ne bloque pas le clic. Quand tous les points sont recouverts, l'appel échoue avec `not_interactable` et un message qui nomme l'élément masquant et sa `ref` (*the click point is covered by `<div.popup-mask>` (ref=o1; click it directly…)*), sur lequel l'agent peut cliquer à la place. Le hit-test ignore l'interface propre du SDK et les autres outils de débogage (`.__chobitsu-hide__`, `#eruda`, `#__pageSpy`, `#__vconsole`).
- **Surcouches.** Un instantané se termine par une section `[Overlays]` quand des calques flottent au-dessus de la page : le fond d'une popup, une modale, un panneau glissant depuis le bas (bottom sheet). Ils sont trouvés par hit-test de quelques points du viewport, en gardant ce qui se trouve dans une boîte fixe (ou absolue de la taille du viewport) qui couvre au moins 15 % du viewport et ne contient pas elle-même la moitié des éléments de l'instantané (ce serait alors la racine de l'app, pas un calque posé dessus). Chaque ligne donne la balise de l'élément, quelques mots de son texte (nettoyé), la part du viewport qu'il couvre et une `ref` ; un calque sans texte ni média est listé comme fond. Un fond vide n'a pas de nœud dans l'instantané aria : il reçoit donc une ref `oN` — c'est ce qui permet à un agent de toucher un fond pour fermer sa popup.
- **Saisie synthétique.** Un clic déclenche `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click`, plus des événements tactiles sur les appareils tactiles. Ces événements ont `isTrusted: false` ; les pages qui le vérifient ne réagiront pas.
- **Retour visuel.** La cible est brièvement mise en surbrillance, et un curseur d'agent affiché dans la page se déplace jusqu'à elle avant que la saisie ne soit déclenchée.
- **Masquage.** Les valeurs de `input[type=password]`, des éléments portant `data-rwd-mask` et des `maskSelectors` du projet sont remplacées par `••••` dans les instantanés et les captures d'écran (les captures natives reçoivent des rectangles gris par-dessus). Ces valeurs, ainsi que le texte correspondant à `maskPatterns`, sont aussi remplacées dans le texte de la console, les URL et les corps réseau, les valeurs de stockage et les résumés d'événements.
- **Portée de l'instantané.** L'instantané a pour racine `<body>`. L'interface du SDK vit dans un Shadow DOM sous `<html>`, hors de `<body>` ; les nœuds d'eruda, de PageSpy et de vConsole sont retirés de l'instantané.
- **Tampons.** La console, les erreurs non interceptées et le réseau (XHR, fetch, WebSocket, sendBeacon, EventSource) sont enregistrés dès le chargement du SDK, dans des tampons circulaires de 500 entrées chacun. Quand ils sont pleins, les logs ordinaires et les requêtes réussies sont supprimés en premier ; `dropped` les compte. Les corps de réponse sont mis en cache jusqu'à 5 Mo au total, 64 Ko chacun.

### 5.4 Journal de session

Les tampons du [§5.3](#53-comportement-dans-la-page) vivent dans la mémoire d'une seule page. Le **journal de session** en est la version longue : tout ce qui s'est passé sur cette origine depuis le lancement de l'app, écrit dans **IndexedDB** (base `rwd-log`) par chaque page de l'origine, que la passerelle soit joignable ou non. Un agent qui se rattache après coup peut donc relire tout le chemin qui a mené à un bug, à travers les rechargements et les pages. Le journal ne quitte jamais l'appareil, sauf si un agent rattaché le demande.

**Une session correspond à un lancement de l'app.** L'identifiant est déterminé dans cet ordre :

1. `run({ launchId })` — l'identifiant de lancement propre à l'app hôte, généré à chaque démarrage à froid et identique pour toutes les WebView de ce processus ;
2. `window.RWDLaunchId`, que l'hôte ou le snippet d'intégration peut définir : une chaîne, ou une fonction qui renvoie une chaîne (ou une promesse de chaîne, attendue 300 ms au maximum) ;
3. déduit par le SDK : un cookie de session `rwd_launch` (sans expiration, il disparaît donc avec le processus de l'app) plus un heartbeat toutes les 10 s. Une session par cookie restée silencieuse plus d'**1 heure** est considérée comme un lancement antérieur et un nouvel identifiant est créé, ce qui couvre les WebView qui conservent les cookies de session d'un lancement à l'autre.

La `source` d'une session indique le cas : `app` pour 1 et 2, `cookie` pour 3.

**Ce qui est enregistré.** Chaque enregistrement comporte `seq` (la clé, croissante), `at`, `kind`, `page` (le `pageId` de la page qui écrit) et `data` :

| `kind` | `data` |
|---|---|
| `page` | `event: "open"` (url, title, referrer), `"nav"` (from, url, title — navigations internes à la page comprises), `"visibility"` (premier plan / arrière-plan), `"hide"` (la page a disparu) |
| `action` | Les saisies propres (de confiance) de l'utilisateur : `"tap"` (la description de l'élément), `"input"` (description et valeur du champ), `"submit"`, `"scroll"` (l'endroit où le défilement s'est arrêté). La valeur d'un champ de mot de passe, d'un élément `data-rwd-mask` ou d'une correspondance de `maskSelectors` est stockée sous la forme `••••`, jamais en clair ; les autres valeurs sont nettoyées avec `maskPatterns` et tronquées à 200 caractères |
| `agent` | Les appels interactifs de l'agent et `rwd.evaluate` : méthode, `ref`, touche, url, valeurs, texte, et l'erreur en cas d'échec. Les lectures (instantanés, listes) sont omises |
| `control` | Changements d'état de contrôle, avec le nom de l'agent ([§4](#4-état-de-contrôle)) |
| `console` | Tous les niveaux, avec `type`, `text` et `source` |
| `net` | Chaque requête terminée : méthode, url, statut, type, durée, taille, erreur. Une requête **en échec** porte aussi `reqHeaders` / `resHeaders` (caviardés comme dans `rwd.networkDetail`) et `reqBody` / `resBody`, chacun tronqué à 64 Ko |

Les erreurs et avertissements de la console, les requêtes en échec, les appuis, saisies et envois de l'utilisateur, les actions de l'agent et les changements de contrôle sont marqués comme importants et conservés le plus longtemps. Les *problèmes*, que sélectionnent `problems` et `overview`, sont les erreurs de la console et les requêtes en échec.

**Limites.** Les **3** derniers lancements sont conservés, chacun dans la limite de **10 Mo**. Au-delà, les enregistrements non importants les plus anciens (logs ordinaires de la console, requêtes réussies) sont supprimés d'abord, puis les plus anciens de tous, jusqu'à redescendre à 80 % du plafond ; `trimmed` les compte. Si `navigator.storage.estimate()` indique un quota inférieur à 64 Mo, seul le lancement courant est conservé. Sans IndexedDB (certains modes de navigation privée), rien n'est enregistré et `rwd.log` échoue avec `internal`.

**Lecture.** `rwd.log` prend un `op` :

```jsonc
// op: "sessions" → tous les lancements encore stockés, du plus récent au plus ancien
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview", params {"session"?} → un lancement en un coup d'œil
{"session":{…meta…,"current":true},"first":<ms>,"last":<ms>,
 "pages":[{"at","page","data"}],      // enregistrements page open / nav, les 60 derniers
 "problems":[…records…]}              // erreurs de la console et requêtes en échec, les 20 dernières

// op: "records", params {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                       "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                       "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // à passer comme `after` pour la page suivante
 "hidden":0}                          // requêtes masquées par les règles d'exclusion réseau (§11)
```

- `session` vaut par défaut le lancement courant (`"current"` signifie la même chose) ; un id inconnu échoue avec `not_found`. Si aucun lancement n'est en cours d'enregistrement, le plus récent des lancements stockés est utilisé.
- `problems: true` ne garde que les erreurs de la console et les requêtes en échec. `text` est une sous-chaîne, insensible à la casse, du `data` de l'enregistrement. `limit` va de 1 à 500, 100 par défaut.
- Les enregistrements reviennent **sans** en-têtes ni corps ; `data.hasBody` vaut `true` quand un corps existe. `rwd.logDetail` renvoie cet enregistrement complet et nécessite `advanced` ([§6](#6-niveaux-daccès)), comme `rwd.networkDetail`.
- Les règles d'exclusion réseau s'appliquent ici aussi : un enregistrement `net` couvert par les règles est omis de `records` et compté dans `hidden`, sauf si `includeExcluded` est défini.

**Désactivation.** `run({ record: false })` empêche une seule page d'écrire. `policy.sessionLog: false` ([§11](#11-politique-de-projet)) parvient aux pages sous la forme `welcome.config.sessionLog`, arrête l'enregistrement **et supprime les journaux déjà conservés pour l'origine**. `status().logSession` est l'identifiant de la session dans laquelle une page écrit, ou `null` quand elle n'enregistre pas.

## 6. Niveaux d'accès

| Niveau | Méthodes autorisées |
|---|---|
| `observe` | `rwd.ping`, `rwd.snapshot`, `rwd.query`, `rwd.screenshot`, `rwd.console`, `rwd.network`, `rwd.waitFor`, `rwd.log` |
| `interact` | `observe` + `rwd.click`, `rwd.fill`, `rwd.type`, `rwd.press`, `rwd.select`, `rwd.hover`, `rwd.scroll`, `rwd.drag`, `rwd.navigate`, `rwd.back`, `rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`, `rwd.networkDetail`, `rwd.storage`, `rwd.logDetail` |

Le niveau d'un rattachement est

```
min(niveau demandé par l'agent (interact par défaut),
    le maxLevel de la clé d'API,
    le maxLevel de la politique de projet fusionnée,
    le niveau choisi par l'utilisateur sur l'appareil)
```

Les deux côtés l'appliquent : la passerelle refuse les appels au-dessus du niveau (erreur `forbidden`, audit `policy.denied`), et le SDK vérifie de nouveau par rapport à `welcome.level` / `control.level` avant d'exécuter quoi que ce soit. La passerelle traite les méthodes inconnues comme `advanced`. Si une passerelle n'envoie aucun niveau alors qu'un agent est rattaché, le SDK suppose `interact`.

## 7. Approbation du rattachement

Quand un agent appelle `connect_device`, la passerelle fusionne les politiques des projets dont des pages sont ouvertes sur l'appareil ([§11](#11-politique-de-projet)). Si l'`approval` fusionnée vaut `prompt`, l'utilisateur doit donner son accord sur l'appareil :

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"Support Bot","keyHint":"…a91f"},
   "levels":["observe","interact"],   // niveaux proposés, plafonnés par la clé et la politique ; le dernier est celui demandé par l'agent
   "expiresInSec":30,
   "purpose":"devtools"}              // seulement quand un membre de la console demande DevTools (§17.1)
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // ou "level": null pour refuser
← {"t":"attach_cancel","requestId":"…"}                         // délai expiré, ou l'agent a abandonné
```

- La demande est envoyée à la **page au premier plan** de l'appareil ; `attach_cancel` est envoyé à toutes les pages.
- Sans réponse dans les **30 secondes**, la demande expire. L'appel MCP attend la réponse.
- Si la même clé d'API est refusée **3 fois** sur le même appareil en 10 minutes, ses demandes vers cet appareil sont refusées sans consulter l'utilisateur pendant **10 minutes**.
- Une seule demande peut être en attente par appareil.
- La boîte de dialogue du SDK vit dans un Shadow DOM, n'accepte que les appuis de confiance et ne devient active que 0,4 s après son apparition, pour qu'un agent ne puisse pas s'approuver lui-même. Les onglets de même origine partagent la décision via BroadcastChannel.
- L'utilisateur peut activer l'**autorisation automatique** avec un niveau maximal dans la fenêtre flottante du SDK ; le SDK répond alors immédiatement avec le plus haut niveau proposé dans cette limite et affiche une notification. L'autorisation automatique est réservée aux agents : une demande DevTools est toujours soumise à l'utilisateur.
- Avec `run({ nativeApproval: true })`, le SDK n'affiche aucune boîte de dialogue. À la place, `status().pending` devient `{kind:"attach", requestId, agent:{name, keyHint}, levels, purpose, expiresAt}` (`purpose` vaut `"agent"` ou `"devtools"`) et l'hôte natif répond avec `nativeDecide(nativeKey, requestId, level | null)`.
- Après approbation, la passerelle rattache l'agent (en remplaçant tout autre agent présent sur l'appareil), lève la demande d'assistance (`{"t":"help","on":false}`) et diffuse `{"t":"control","state":"observe","agent":{…},"level":"interact","attachedMs":0}` ; la page se verrouille aussitôt ([§4](#4-état-de-contrôle)).

Avec `approval: none`, l'agent se rattache immédiatement au niveau calculé.

**Revenir sans redemander.** Un agent qui lâche lui-même l'appareil — `disconnect_device`, connexion à un autre appareil, ou échéance de `policy.attachMaxMinutes` — laisse derrière lui une autorisation : pendant **10 minutes**, la même clé d'API peut se rattacher de nouveau à cet appareil sans boîte de dialogue sur le téléphone, à un niveau **qui ne dépasse pas celui accordé précédemment par l'utilisateur** (demander `advanced` après une approbation en `observe` donne donc toujours `observe`). Rien d'autre n'est assoupli : la clé, la politique et la demande de l'agent plafonnent toujours le niveau, et l'appareil doit avoir une page connectée. Un tel rattachement est audité comme `attach.resume`, à côté de l'habituel `attach.start` ([§12.7](#127-journal-daudit)), et la page reçoit le message `control` ordinaire, pas une `attach_request`.

Revenir ne consomme pas l'autorisation : lâcher de nouveau l'appareil ouvre une nouvelle fenêtre de 10 minutes. L'autorisation est abandonnée quand la session se termine pour toute autre raison : l'utilisateur appuie sur **Terminer** sur l'appareil, un membre de la console y met fin (`POST /devices/:id/end`), la clé d'API est révoquée, un autre agent se rattache à l'appareil et remplace celui-ci, ou l'utilisateur refuse une demande. Elle disparaît aussi avec le processus de la passerelle, puisqu'elle est gardée en mémoire.

## 8. Confirmation des actions sensibles

Avant d'agir, le SDK demande l'accord de l'utilisateur quand l'agent :

- clique (`rwd.click`) sur un élément qui correspond à `[data-rwd-confirm]` ou aux `confirmSelectors` de la politique, ou qui se trouve à l'intérieur d'un tel élément ;
- appuie sur Entrée (`rwd.press`, ou `rwd.type` avec `submit: true`) sur un tel élément, ou dans un formulaire qui en contient un (pas dans un textarea ni dans un éditeur de texte enrichi).

La boîte de dialogue dit par exemple *L'IA souhaite cliquer sur « Passer la commande ». Autoriser ?*, n'accepte que les appuis de confiance et expire au bout de **30 secondes**. Un refus ou une expiration fait échouer la RPC avec `{"code":"forbidden","message":"The user denied this action"}`. Une seule confirmation peut être ouverte à la fois ; elle est annulée quand l'utilisateur reprend la main, que l'agent s'en va ou que la connexion tombe.

Avec `nativeApproval: true`, `status().pending` devient `{kind:"confirm", requestId, action:'click "Place order"', expiresAt}` et l'hôte répond avec `nativeDecide(nativeKey, requestId, "allow" | null)`. Dans `status().pending`, une confirmation en attente a priorité sur une demande de rattachement en attente.

## 9. Repli par polling de présence

Quand le WebSocket échoue 3 fois de suite, le SDK appelle à la place `POST /v1/presence` toutes les 60 secondes. Il envoie `Content-Type: text/plain` avec un corps JSON, si bien qu'aucune requête CORS préliminaire (preflight) n'est nécessaire ; la passerelle répond avec `Access-Control-Allow-Origin: *`.

```jsonc
// requête
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// réponse
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- La passerelle utilise `key`, `deviceId`, `userId`, `device.{ua, platform, app}`, `deviceToken` et `help` ; `pageId` et `page` sont purement informatifs. La clé d'application et l'origine sont vérifiées comme pour le WebSocket, avec la même limitation de débit.
- Un appareil qui a reçu un jeton d'appareil ([§3.5](#35-jeton-dappareil-jeton-de-reprise-et-invitations)) doit aussi l'envoyer ici ; sinon l'appel échoue avec `401 bad_token` et rien n'est mis à jour pour l'appareil. Un appareil sans jeton (un ancien SDK) continue son polling sans jeton.
- `help: true` marque l'appareil comme demandant une assistance, comme le fait `hello.help`, sauf si un agent est déjà rattaché.
- Un appareil en polling compte comme en ligne pendant 90 secondes après chaque appel.
- `connect: true` indique à la page d'ouvrir le WebSocket tout de suite. La passerelle le positionne quand un agent appelle `connect_device` ou `wait_for_device` pour cet appareil.
- Par sécurité, le SDK retente aussi le WebSocket tous les 5 polls.

## 10. API JavaScript pour les hôtes

Le SDK expose `window.RemoteWebviewDebugger`. Les pages appellent `run()` ; les hôtes natifs injectent le SDK et appellent `run()` avec des options supplémentaires (voir [native-integration.fr.md](native-integration.fr.md)).

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null : l'utilisateur connecté, visible des agents et de la console
  helpButton,            // affiche le bouton « Demander une assistance » (OU logique avec le helpButton de la politique)
  app,                   // { name, version } de l'app hôte
  lang,                  // une étiquette de langue pour l'interface de l'utilisateur du téléphone ; par défaut d'après navigator.languages (§15)
  locales,               // packs de langue supplémentaires ; messages : remplacements par langue (§15)
  theme,                 // 'auto' (par défaut) | 'system' | 'light' | 'dark'
  style,                 // couleurs, polices, arrondis, z-index, positions sous forme de propriétés CSS --rwd-* (sdk/README.fr.md)
  lockScreen,            // bloque la saisie pendant qu'un agent est rattaché (true par défaut ; l'utilisateur peut le changer)
  eruda,                 // true | { dock, load, src, name } : s'affiche comme un onglet dans eruda
  networkExclude,        // requêtes à tenir à l'écart de ce que lit l'agent (§11)
  record,                // tient le journal de session (true par défaut ; la politique peut le désactiver, §5.4)
  // hôtes natifs
  deviceId,              // un id par installation, partagé par toutes les WebView et tous les domaines
  deviceToken,           // le jeton de status().deviceToken, conservé par l'hôte
  launchId,              // ce lancement de l'app, partagé par toutes les WebView du processus (§5.4)
  nativeKey,             // un secret connu du seul hôte ; active nativeControl / nativeDecide
  nativeApproval,        // l'hôte affiche lui-même les questions de rattachement / de confirmation
}) // → Promise<{ deviceCode, status }>
```

| Fonction | Description |
|---|---|
| `run(gatewayUrl, appKey, options?)` | Met la page en ligne. Se résout dès que la passerelle a répondu, ou au bout de 8 s avec ce qui est connu. L'appeler de nouveau renvoie la même promesse |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`. `status` vaut `idle`, `connecting`, `online`, `polling`, `rejected`, `quota` ou `stopped` ; `logSession` est le journal de session dans lequel cette page écrit, `null` quand elle n'enregistre pas ([§5.4](#54-journal-de-session)) |
| `help(on = true)` | Demander une assistance, ou annuler la demande |
| `setUser(userId)` | Changer d'utilisateur connecté (le SDK se reconnecte avec un nouveau `hello`) |
| `stop()` | Se déconnecter et retirer l'interface ; la capture de la console et du réseau continue, dans des limites fixes |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | Les boutons de contrôle propres à l'hôte natif. Renvoie `false` si la clé ne correspond pas |
| `nativeDecide(nativeKey, requestId, value)` | Répondre à `status().pending` : un niveau ou `null` pour `attach`, `'allow'` ou `null` pour `confirm`. Renvoie `false` si la clé, la demande ou la valeur est incorrecte |

**Identifiant de lancement.** Outre `run({ launchId })`, un hôte peut définir `window.RWDLaunchId` avant l'exécution du SDK : une chaîne, ou une fonction qui renvoie une chaîne ou une promesse de chaîne (attendue 300 ms au maximum). Il doit compter de 4 à 128 caractères parmi `[A-Za-z0-9_.:-]` ; toute autre valeur est ignorée et le SDK déduit lui-même le lancement ([§5.4](#54-journal-de-session)).

`nativeKey` n'est écrite que dans le script injecté et comparée en temps constant. Les scripts de la page, y compris l'`evaluate_script` d'un agent, ne peuvent pas la lire : ils ne peuvent donc ni rendre la main ni s'approuver eux-mêmes.

**Ponts de capture d'écran natifs.** Si l'hôte enregistre l'un d'eux, `rwd.screenshot` l'utilise pour obtenir de vrais pixels (vidéo, canvas, images cross-origin et surcouches natives compris). Chacun renvoie une data URL PNG ou JPEG, ou du base64 brut, de la WebView visible :

| Pont | Plateforme |
|---|---|
| `window.RWDNativeScreenshot()` | Tout hôte ; renvoie `string` ou `Promise<string>` |
| `webkit.messageHandlers.rwdScreenshot` | iOS / macOS `WKWebView`, enregistré comme `WKScriptMessageHandlerWithReply` ; reçoit `{type:"screenshot"}` |
| `window.RWDAndroid.screenshot()` | Android, une méthode `@JavascriptInterface` |

Implémentation de référence : [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift).

## 11. Politique de projet

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt : l'utilisateur approuve chaque rattachement sur l'appareil (prompt par défaut)
  maxLevel: Level                  // niveau le plus élevé pour ce projet (interact par défaut)
  maskSelectors: string[]          // sélecteurs CSS supplémentaires à masquer (en plus des champs de mot de passe et de [data-rwd-mask])
  maskPatterns: { name: string; regex: string }[]  // motifs de texte à masquer, p. ex. numéros de téléphone ou d'identité (regex JavaScript)
  confirmSelectors: string[]       // cliquer sur ces éléments exige l'accord de l'utilisateur (en plus de [data-rwd-confirm])
  networkExclude: string[]         // requêtes tenues à l'écart de ce que lisent les agents (§5.2)
  sessionLog: boolean              // les pages tiennent un journal de session (true par défaut, §5.4)
  helpButton: 'off' | 'all' | 'listed'   // qui voit le bouton « Demander une assistance » (off par défaut)
  helpUsers: string[]              // userIds pour helpButton = listed
  agentIdleMinutes: number         // agent → observe après cette durée d'inactivité (2 par défaut, 120 max)
  attachMaxMinutes: number         // un rattachement prend fin après cette durée (60 par défaut, 1440 max)
  maxOnlineDevices: number         // 0 = illimité ; au-delà, les nouveaux appareils sont fermés avec 4429
  maxAgents: number                // agents rattachés simultanément aux appareils de ce projet ; 0 = illimité
  eruda: { dock: boolean; load: boolean }  // valeur par défaut distante pour run({ eruda }) ; les options locales l'emportent champ par champ.
                                           // Dans welcome.config, il peut valoir null ou être absent (= les deux à false), §3.4
  devtools: 'on' | 'off'          // les admins peuvent ouvrir DevTools sur les pages du projet depuis la console (actif par défaut, §17)
}
```

- Les valeurs sont normalisées à l'enregistrement : une `approval` autre que `none` devient `prompt`, un `maxLevel` invalide devient `interact`, les nombres sont ramenés dans leurs bornes. `maskPatterns` doit compiler, sinon `400 bad_policy`. `maskSelectors`, `confirmSelectors`, `networkExclude` et `helpUsers` sont débarrassés de leurs entrées vides et limités à 50 entrées chacun, `maskPatterns` à 20.
- **`networkExclude`** désigne le bruit qu'un agent ne devrait pas avoir à trier : des polices qui renvoient toujours 404, des beacons d'analytics. Chaque règle est comparée à l'URL de la requête comme sous-chaîne insensible à la casse, comme motif avec joker `*` (`*/404/*`), ou comme expression régulière quand elle est écrite `/…/` (avec des drapeaux facultatifs ; `i` par défaut). Une règle qui ne compile pas ne correspond à rien. Les requêtes correspondantes sont omises de la liste réseau et des événements `net_fail` de la chronologie, mais la page les enregistre toujours, si bien qu'un agent peut les demander avec `includeExcluded` ([§5.2](#52-méthodes), [§14.3](#143-outils)). C'est une commodité, pas un contrôle de confidentialité — utilisez `maskSelectors` / `maskPatterns` pour les données qui ne doivent pas quitter la page.
- **`sessionLog`** est actif sauf s'il vaut `false`, y compris pour les projets enregistrés avant l'existence de ce champ. Le désactiver arrête l'enregistrement sur toutes les pages du projet et supprime les journaux déjà présents sur ces appareils pour cette origine ; une page peut aussi se retirer seule avec `run({ record: false })` ([§5.4](#54-journal-de-session)).
- Les champs de masquage, de confirmation, d'exclusion réseau, de journal de session, d'assistance et d'eruda parviennent aux pages dans `welcome.config` ([§3.4](#34-welcome)) ; les règles du `run({ networkExclude })` propre à une page s'ajoutent à celles du projet.
- **Plusieurs projets sur un même appareil.** Un appareil est identifié par son `deviceId`, pas par projet : des pages chargées avec des clés d'application différentes sur le même téléphone sont des pages d'un seul et même appareil. Quand un agent se rattache, la passerelle fusionne les politiques des projets dont des pages sont connectées en gardant la valeur la plus stricte : `prompt` si un projet le demande, les plus petits `maxLevel`, `agentIdleMinutes` et `attachMaxMinutes`, et le plus petit `maxAgents` non nul.

## 12. API REST de la console

### 12.1 Conventions

- Chemin de base : `/v1/api`. La connexion se fait avec `POST /auth/login` ; la session est un cookie HttpOnly `rwd_session` (12 heures, `SameSite=Lax`, `Secure` en HTTPS). Le compte est relu à chaque requête, si bien que désactiver ou supprimer un membre prend effet immédiatement.
- Toute requête autre que `GET` / `HEAD` vers un point de terminaison qui exige une session doit porter `X-RWD-CSRF: 1`, sinon `403 csrf`.
- Les erreurs prennent la forme `{"error":{"code":"…","message":"…"}}` avec un statut 4xx/5xx. Les messages suivent la langue de la requête ([§15](#15-langues)).
- Codes courants : `401 unauthorized` (non connecté), `403 forbidden` (rôle insuffisant), `403 csrf`, `404 not_found`, `400 bad_request`, `429 rate_limited`, `500 internal`.

Rôles : `owner` (tout, y compris les membres), `admin` (projets, clés, politiques, appareils, invitations, audit), `member` (lecture des projets et des appareils, tests de connexion, fin de sessions, création d'invitations d'appareil, lecture du journal d'audit). Dans les tableaux ci-dessous, *member* désigne n'importe quel compte connecté.

### 12.2 Comptes et membres

| Méthode | Chemin | Rôle | Requête | Réponse |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}` et le cookie. `401 bad_password` ; `429 rate_limited` après 10 tentatives par minute et par IP. Un `email` vide signifie `admin` |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`. Le nouveau mot de passe doit compter de 8 à 256 caractères ; `400 bad_password` si l'ancien est incorrect |
| GET | `/auth/oidc/start?redirect=/path` | — | — | `302` vers le fournisseur d'authentification unique, avec un cookie signé `rwd_oidc` (state et vérificateur PKCE, 10 minutes). `404` sans authentification unique |
| GET | `/auth/oidc/callback` | — | `code` et `state` du fournisseur | Ouvre la session et `302` vers `redirect` (un chemin de la console, sinon `/`). En cas d'échec, `302` vers `/login?sso_error=<code>` : `provider`, `denied`, `state`, `not_allowed`, `no_account`, `conflict` (le membre ayant cette adresse e-mail est rattaché à une autre identité du fournisseur), `tenant` (une autre organisation Feishu ou Lark que `RWD_OIDC_TENANT`), `disabled`, `rate_limited` |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity","sso"}`. `sso` vaut `null`, ou `{"provider","name","defaultRole","inviteOnly"}` quand l'authentification unique est activée |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<host>/invite/<token>"}` (valable 7 jours, une seule fois). `409 conflict` si l'adresse e-mail existe déjà |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`. `409 last_owner` s'il ne devait plus rester aucun owner actif |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`. `409 self`, `409 last_owner` |
| POST | `/members/:id/invite` | owner | — | Un nouveau lien d'invitation pour un membre sans mot de passe (une invitation perdue, ou un compte d'authentification unique qui doit avoir un mot de passe) : `Member & {"inviteUrl"}` comme ci-dessus ; l'ancien lien cesse de fonctionner. `409 has_password` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}` et ouvre la session. Même limitation de débit que pour la connexion |

Le premier owner est créé au démarrage à partir de `RWD_ADMIN_EMAIL` (`admin` par défaut) et de `RWD_ADMIN_PASSWORD` (voir [gateway/README.fr.md](../gateway/README.fr.md)). La page `/invite/:token` de la console sert à accepter une invitation de membre.

L'authentification unique avec Feishu, Lark ou un fournisseur OpenID Connect (`RWD_OIDC_*`, voir [gateway/README.fr.md](../gateway/README.fr.md#authentification-unique)) fonctionne à côté des mots de passe. Le bouton de la page de connexion ouvre `/auth/oidc/start` ; le fournisseur renvoie le navigateur vers `/auth/oidc/callback`, qui pose le même cookie `rwd_session`. Une identité est retrouvée par le subject du fournisseur, sinon rattachée au membre ayant la même adresse e-mail (ce qui accepte aussi une invitation en attente), sinon elle reçoit un nouveau compte avec le rôle par défaut, sauf si la passerelle fonctionne sur invitation uniquement. Ces comptes sont des membres ordinaires : les owners changent leur rôle, les désactivent ou les suppriment comme ci-dessus.

### 12.3 Projets

| Méthode | Chemin | Rôle | Requête | Réponse |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project` (avec la politique par défaut) |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`. `policy` est fusionnée dans la politique actuelle |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | `Project` avec une nouvelle clé d'application |
| GET | `/projects/:id/integration` | member | — | `Integration` |

Les entrées de `allowedOrigins` sont des origines complètes comme `https://m.example.com`, avec éventuellement un joker comme premier libellé : `https://*.example.com` correspond à n'importe quel sous-domaine, mais pas à `https://example.com` lui-même. Une liste vide autorise n'importe quelle origine. `inviteUrl` doit être une URL `http(s)`.

### 12.4 Clés d'API

Les clés d'API appartiennent à la passerelle, pas à un projet : une même clé atteint tous les appareils.

| Méthode | Chemin | Rôle | Requête | Réponse |
|---|---|---|---|---|
| GET | `/keys` | member | — | `{"keys":[ApiKey]}` |
| POST | `/keys` | admin | `{"name","maxLevel"?:"interact","expiresInDays"?:90,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}` : la seule fois où la clé complète est renvoyée |
| DELETE | `/keys/:id` | admin | — | `{"ok":true}`. La révocation est immédiate : l'agent de la clé est détaché et sa prochaine requête MCP reçoit 401 |

`expiresInDays: 0` signifie jamais. `ipAllowlist` accepte des IP ou des CIDR ; quand elle est définie, les requêtes MCP provenant d'autres adresses reçoivent 401. `GET` / `POST /projects/:id/keys` sont d'anciens alias de `/keys`.

### 12.5 Appareils et état de la passerelle

| Méthode | Chemin | Rôle | Réponse |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}` (`pageSize` ≤ 100). `online` (par défaut) : les appareils en ligne, les plus récemment connectés d'abord. `all` : tous les appareils connus, les plus récents d'abord. Dans les deux modes, `q` cherche dans l'id d'appareil, le code d'appareil (tirets facultatifs), le userId, le user agent, le libellé système (dans l'une ou l'autre langue) et les noms de projets |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}` : les appareils dont la dernière page provient du projet (`all` par défaut, jusqu'à 500), ceux qui demandent une assistance d'abord, puis ceux en ligne, puis les plus récemment vus. `waiting` signifie en demande d'assistance (affiché « En assistance ») |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | Toujours `200` : `{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<first 4000 characters>","error"?:{"code","message"}}`. Codes : `device_offline`, `no_page` (la page est en cours de reconnexion), `timeout`, `takeover`, `internal` et les codes RPC du [§5.1](#51-enveloppe) |
| POST | `/devices/:id/end` | member | `{"ok":true}` : détache l'agent, lève la demande d'assistance, ramène le contrôle à `none`, ferme les fenêtres DevTools ([§17](#17-devtools-pour-tout-le-monde)) |
| POST | `/devices/:id/devtools` | admin | `{"page"?:"p1"}` → `{"ticket","session","page":Page,"frontendUrl"}` ; peut attendre jusqu'à 30 s la réponse de l'utilisateur ([§17.1](#171-ouvrir-une-fenêtre)) |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |

### 12.6 Invitations d'appareil

Une invitation permet à un utilisateur de mettre son appareil en ligne, déjà en demande d'assistance, simplement en ouvrant un lien. Personne n'a besoin de dicter un code d'appareil.

| Méthode | Chemin | Rôle | Requête | Réponse |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}` (`link` est l'URL cible sans le jeton, qui n'est pas stocké) |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | `DeviceInvite` avec le `link` complet (`<url>?rwd_invite=<token>`) |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url` prend par défaut l'`inviteUrl` du projet ; l'un des deux est obligatoire. `expiresInMinutes` est plafonné à 7 jours. La page du lien doit charger le SDK avec la clé d'application du même projet ([§3.5](#35-jeton-dappareil-jeton-de-reprise-et-invitations)).

### 12.7 Journal d'audit

`GET /audit?project=&device=<device code>&actor=&action=&from=&to=&limit=50&before=<id>` (member) → `{"events":[AuditEvent],"nextBefore":<id>|null}`, les plus récents d'abord. `limit` ≤ 200 ; `action` est une correspondance par préfixe (`attach.` correspond à tous les événements de rattachement) ; `actor` correspond à un id ou à un nom d'acteur.

| Action | Quand |
|---|---|
| `auth.login`, `auth.login_failed` | Connexion à la console |
| `member.invite`, `member.accept`, `member.sso_join`, `member.update`, `member.delete` | Gestion des membres (`member.sso_join` : un compte créé lors d'une première connexion par authentification unique ; `auth.login` porte alors `"method":"sso"` ; `member.invite` avec `"again":true` : un nouveau lien d'invitation) |
| `project.create`, `project.update`, `project.delete`, `project.rotate_app_key` | Projets |
| `key.create`, `key.revoke` | Clés d'API |
| `invite.create`, `invite.delete`, `invite.use` | Invitations d'appareil |
| `attach.request`, `attach.approve`, `attach.deny`, `attach.timeout`, `attach.resume`, `attach.start`, `attach.end` | Rattachements d'agents. `attach.resume` signifie que la clé est revenue pendant le délai de grâce au lieu de redemander ([§7](#7-approbation-du-rattachement)) ; `detail: {level}` |
| `rpc` | Chaque RPC de page émise par un agent ; `detail: {method, page, latencyMs, error?}` |
| `control.takeover`, `control.handback`, `control.end` | Les boutons de l'utilisateur |
| `device.end` | Un membre de la console a terminé une session |
| `policy.denied` | Un appel au-dessus du niveau accordé a été refusé |
| `devtools.request`, `devtools.approve`, `devtools.deny`, `devtools.timeout`, `devtools.open`, `devtools.close` | Fenêtres DevTools ([§17](#17-devtools-pour-tout-le-monde)) ; `close` porte `detail: {page, durationSec, reason}` |

Les événements ne contiennent jamais le contenu des pages ni les valeurs des paramètres. Ils sont conservés 180 jours par défaut (`RWD_AUDIT_RETENTION_DAYS`).

### 12.8 Types

```ts
type Project = {
  id: string; name: string; appKey: string; allowedOrigins: string[]; disabled: boolean
  createdAt: number; policy: Policy; inviteUrl: string
  onlineDevices: number; totalDevices: number
}

type ApiKey = {
  id: string; name: string; prefix: string /* rwd_sk_live_ab12 */
  maxLevel: Level; expiresAt: number | null; ipAllowlist: string[]
  createdAt: number; lastUsedAt: number | null; revokedAt: number | null
}

type Integration = {
  appKey: string; gatewayUrl: string; sdkUrl: string
  firstSeenAt: number | null; onlineDevices: number; lastDevice: Device | null
}

type Device = {
  id: string /* deviceId */; code: string
  projectId: string            // projet de la dernière page
  projects: string[]           // projets des pages connectées
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* moment de la mise en ligne ; seulement pendant qu'il est en ligne */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; purpose?: 'devtools'; expiresAt: number } | null
  devtools: { id: string; member: string; page: string /* libellé */; since: number }[]  // fenêtres DevTools ouvertes (§17)
  task?: Task                  // seulement si l'agent rattaché en a défini une
  pages: number                // pages connectées
  sdk: string                  // version du SDK signalée par la page
  currentPage: { label: string; url: string; title: string } | null  // la page que l'utilisateur regarde le plus probablement
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // GET /devices uniquement
}

type SystemInfo = {            // déduit du user agent
  os: string; osVersion: string; model: string; browser: string
  label: string                // p. ex. "iOS 18.0 · iPhone · WebView", "Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // la page que l'utilisateur regarde le plus probablement
  selected: boolean            // la page sur laquelle travaille l'agent
  openerLabel: string | null; connectedAt: number
  connected: boolean           // false pendant qu'elle se reconnecte
  connectedSince: number       // début de la connexion en cours (renouvelé par les rechargements)
}

type TimelineEvent = { at: number; page: string /* libellé ; "" pour les événements qui concernent tout l'appareil */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // remplace le décompte
  timeline: TimelineEvent[]    // les 100 plus récents, du plus ancien au plus récent
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* invitation pas encore acceptée */
  createdAt: number; lastLoginAt: number | null
  hasPassword: boolean         // false pour les comptes créés par authentification unique
  sso: string[]                // fournisseurs liés : "feishu", "lark", "oidc"
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* code d'appareil, préfixe de clé, e-mail du membre… */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}
```

### 12.9 Événements de la chronologie

Chaque appareil garde en mémoire ses 300 derniers événements de chronologie ; la console affiche les 100 plus récents, MCP les 50 plus récents par défaut.

| `kind` | Signification |
|---|---|
| `opened` / `closed` | Une page s'est connectée pour la première fois / a disparu après son délai de grâce ([§3.1](#31-cycle-de-vie)) |
| `navigated` / `reloaded` | Une page est passée à une nouvelle URL / s'est reconnectée à la même URL |
| `focus` | Une page est passée au premier plan |
| `error` / `console_error` / `net_fail` / `user_tap` | Événements signalés par la page ([§3.2](#32-page--passerelle)) |
| `help` | L'utilisateur a demandé une assistance ou a annulé sa demande, ou est arrivé par une invitation |
| `agent` | Demandes de rattachement, refus, expirations, rattachements, changements de tâche |
| `control` | Changements d'état de contrôle ; le résumé en donne la raison (l'utilisateur a repris la main, IA inactive, l'utilisateur a terminé, …) |
| `offline` | La dernière page de l'appareil a disparu alors qu'un agent était rattaché |
| `devtools` | Demandes DevTools, approbations et refus, fenêtres ouvertes et fermées, autorisations retirées ([§17](#17-devtools-pour-tout-le-monde)) |

## 13. Mises à jour en direct (SSE)

`GET /v1/api/stream[?project=<id>][&lang=<tag>]` (member, authentification par cookie) diffuse un flux `text/event-stream` :

```
retry: 3000

event: device     data: Device                               un appareil a changé (en ligne, assistance, contrôle, approbation, tâche…)
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   toutes les 25 s
```

Sans `project`, les événements de tous les projets sont diffusés. `EventSource` ne peut pas définir d'en-têtes : la langue passe donc par `?lang=`. Un abonné lent perd des événements plutôt que de retenir la passerelle ; la console recharge les données quand elle se reconnecte et se rabat sur le polling si le flux échoue.

## 14. MCP

### 14.1 Sessions

- Point de terminaison `/v1/mcp` (Streamable HTTP). Chaque requête doit porter `Authorization: Bearer <API key>`. La clé est vérifiée à chaque requête : une clé révoquée ou expirée, ou une adresse hors de son `ipAllowlist`, reçoit donc 401 immédiatement.
- La passerelle garde un état d'agent par clé d'API : l'appareil rattaché et la page sélectionnée. Les sessions MCP qui utilisent la même clé le partagent. Un agent est rattaché à un seul appareil à la fois ; se connecter à un autre appareil le détache du premier. Une clé atteint tous les appareils de la passerelle.
- Au-delà de 5 recherches d'appareil échouées par minute avec une même clé, les recherches suivantes sont refusées jusqu'à la fin de la minute, ce qui empêche de deviner les codes d'appareil.

### 14.2 Résultats

Chaque résultat d'outil se termine par ce qui a changé sur l'appareil depuis l'appel précédent de l'agent (20 lignes au plus), si bien que l'agent remarque les nouvelles pages, les navigations, les erreurs et les reprises de main sans avoir à interroger :

```
[Session changes]
- p3 "Checkout" opened (opened by p2)
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- The user took over
```

Le contenu provenant de la page (instantanés, console, réseau, stockage, résultats d'evaluate, chronologie) est enveloppé dans une balise et étiqueté comme donnée non fiable, pour que l'agent ne suive pas les instructions qui s'y trouvent.

### 14.3 Outils

| Outil | Niveau | Paramètres | Description |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all` (`online` par défaut), `userId?`, `deviceCode?` (casse indifférente, avec ou sans le tiret) | Jusqu'à 50 appareils, ceux qui demandent une assistance d'abord |
| `connect_device` | — | `device` (code d'appareil ou deviceId), `level?: Level` (`interact` par défaut), `follow?: true` | Se rattache, en demandant d'abord l'accord de l'utilisateur si nécessaire ([§7](#7-approbation-du-rattachement)) ; dans les 10 minutes qui suivent l'abandon volontaire de l'appareil, la même clé revient sans redemander, à un niveau qui ne dépasse pas celui accordé alors. Sélectionne la page au premier plan. Échoue si l'appareil n'a aucune page connectée (et incite un appareil en polling à se reconnecter) |
| `disconnect_device` | — | — | Se détacher |
| `wait_for_device` | — | `device`, `timeoutSec?: 60` (300 max) | Attendre que l'appareil ait une page connectée ; un appareil en polling reçoit l'ordre de se reconnecter |
| `list_pages` | — | — | Pages de l'appareil : libellé, titre, URL, sélectionnée, premier plan / arrière-plan, en reconnexion, page d'origine |
| `select_page` | — | `page` (libellé) | Changer la page sélectionnée |
| `take_snapshot` | observe | `page?` | Instantané d'accessibilité avec les refs, plus les surcouches qui flottent au-dessus de la page et leurs refs ([§5.3](#53-comportement-dans-la-page)) |
| `find_elements` | observe | `text?`, `role?`, `name?`, `limit?`, `page?` | Trouver des éléments et leurs refs sans instantané complet (`rwd.query`) |
| `take_screenshot` | observe | `page?`, `fullPage?`, `format?: jpeg\|png` | Renvoie une image |
| `wait_for` | observe | `text?`, `textGone?`, `timeSec?` (30 max) | Attendre sur la page sélectionnée |
| `list_console_messages` | observe | `scope?: page\|session`, `types?`, `limit?: 50` | `session` fusionne toutes les pages connectées et indique la page sur chaque ligne |
| `list_network_requests` | observe | `scope?`, `failedOnly?`, `limit?: 50`, `exclude?`, `includeExcluded?` | Idem ; les ids sont listés sous la forme `<label>:<id>`. `exclude` ajoute des règles pour cet appel en plus de celles du projet et de la page ([§11](#11-politique-de-projet)) ; quand des règles ont masqué quelque chose, le résultat se termine par *N requests hidden by the exclude rules*, et `includeExcluded: true` les affiche |
| `click` / `hover` | interact | `ref` | Un clic bloqué par une surcouche échoue avec `not_interactable` et donne la `ref` de l'élément masquant, sur lequel on peut cliquer à la place ([§5.3](#53-comportement-dans-la-page)) |
| `fill` | interact | `ref`, `value` | |
| `type_text` | interact | `text`, `ref?`, `submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`, `values` | |
| `scroll` | interact | `ref?`, `dx?`, `dy?` (`dy: 600` par défaut) | |
| `drag` | interact | `fromRef`, `toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]` (1 à 30), `stopOnError?: true` | Exécute dans l'ordre `click`, `fill`, `type_text`, `press_key`, `select_option`, `hover`, `scroll` et `wait_for`, et renvoie un seul résultat pour l'ensemble |
| `get_network_request` | advanced | `id` (`<label>:<id>` tiré de la liste, ou un id seul pour la page sélectionnée) | En-têtes et corps |
| `get_storage` | advanced | `area: local\|session\|cookie`, `page?` | |
| `evaluate_script` | advanced | `function`, `args?`, `page?` | Exécuter du JavaScript dans la page ; les résultats de plus de 20 000 caractères sont tronqués |
| `get_session_timeline` | — | `limit?: 50` | La chronologie de l'appareil, toutes pages confondues |
| `get_session_overview` | observe | `session?` | Le journal de session du lancement courant en un coup d'œil ([§5.4](#54-journal-de-session)) : début, volume stocké, nombre d'enregistrements, pages visitées, les 20 dernières erreurs et requêtes en échec, et les autres lancements encore conservés |
| `get_session_log` | observe | `session?`, `kinds?`, `problems?`, `page?`, `text?`, `after?`, `limit?`, `seq?`, `exclude?`, `includeExcluded?` | Le journal de session enregistrement par enregistrement, sous la forme `#<seq> <time> <page> <line>`. `page` accepte un libellé comme `p2` ou un id de page tel que le journal l'affiche ; `after` pagine vers l'avant à partir du `seq` sur lequel s'est terminé le résultat précédent. `seq` affiche à la place cet enregistrement complet (en-têtes et corps ; nécessite `advanced`, car il appelle `rwd.logDetail`) |
| `wait_for_page` | — | `urlContains?`, `titleContains?`, `timeoutSec?: 30` (300 max) | Attendre une page ouverte ou qui a navigué depuis l'appel précédent |
| `wait_for_event` | — | `kind?` ([§12.9](#129-événements-de-la-chronologie)), `page?`, `timeoutSec?: 30` (300 max) | Attendre le prochain événement de chronologie correspondant |
| `wait_for_control` | — | `timeoutSec?: 120` (600 max) | Après une reprise de main, attendre que l'utilisateur rende la main (ou termine) |
| `set_task` | — | `title` (≤ 24 caractères), `steps?` (≤ 12, ≤ 28 caractères chacune), `current?` | Afficher la tâche et le plan de l'agent en haut de chaque page de l'appareil. `current` est l'étape active ; `current = steps.length` signifie terminé. Les pages la reçoivent sous la forme `task` ([§3.3](#33-passerelle--page)) ; elle est effacée quand l'agent s'en va |

`page?` exécute un seul appel sur une autre page (désignée par son libellé) sans changer la sélection. Un outil au-dessus du niveau du rattachement échoue avec « Requires advanced access; this session was granted interact » et est audité comme `policy.denied`.

**Mode suivi.** Avec `follow: true` (par défaut), la page sélectionnée change automatiquement quand l'action de l'agent ouvre une nouvelle page, quand l'utilisateur amène une autre page au premier plan, ou quand la page sélectionnée a disparu depuis 1,5 s ; le résultat le signale. Une page sélectionnée écartée comme périmée ([§3.1](#31-cycle-de-vie)) est remplacée par la page qui affiche la même URL, quelle que soit la valeur de `follow`, puisque l'ancienne entrée n'existe plus.

### 14.4 Pont stdio local

Pour les clients MCP qui ne parlent que stdio :

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

Il relaie stdio vers le `/v1/mcp` hébergé. `--gateway` peut aussi provenir de `RWD_GATEWAY`.

## 15. Langues

Langues prises en charge : anglais (`en`), chinois simplifié (`zh`), chinois traditionnel (`zh-TW`), français (`fr`), espagnol (`es`), russe (`ru`), arabe (`ar`, de droite à gauche), japonais (`ja`), coréen (`ko`), allemand (`de`) et portugais (`pt`). Toute étiquette BCP 47 est acceptée et ramenée à la plus proche : `en-US` → `en` ; `zh-CN`, `zh_CN`, `zh-Hans` → `zh` ; `zh-HK`, `zh-MO`, `zh-Hant` → `zh-TW` ; `fr-CA` → `fr` ; `pt-BR`, `pt-PT` → `pt`. `Accept-Language` retient la langue prise en charge qui a le plus grand poids.

| Public | Quoi | Choisie par |
|---|---|---|
| Agent | Instructions du serveur MCP, descriptions des outils et des paramètres, résultats d'outils, `[Session changes]`, erreurs | Le `RWD_LANG` / `--lang` de la passerelle (`en` par défaut) |
| Agent, depuis la page | Messages d'erreur RPC et résumés d'événements rédigés par le SDK | `welcome.agentLang`, qui transmet la langue de la passerelle. Le SDK conserve la dernière valeur dans le localStorage `rwd:alang` pour les événements déclenchés avant le prochain `welcome`, et utilise l'anglais tant qu'il n'a rien reçu d'autre |
| Console | Messages d'erreur, résumés de chronologie et libellés système dans les réponses REST et SSE | `?lang=` sur la requête, puis `Accept-Language`, puis la langue de la passerelle |
| Utilisateur du téléphone | La pastille, les barres, les boîtes de dialogue et les notifications du SDK | `run({ lang })`, sinon la première des `navigator.languages` pour laquelle le SDK dispose d'un pack (intégré ou enregistré par la page), sinon l'anglais. Les packs autres que `en` et `zh` se chargent à la demande depuis `locales/<id>.js` à côté de `sdk.js`, ou depuis la passerelle (`/v1/locales/<id>.js`) |

Un utilisateur sinophone peut donc travailler avec un agent anglophone : la boîte de dialogue affiche *AI 想要点击「提交订单」，允许吗？* et, en cas de refus, l'agent lit *The user denied this action*.

## 16. Exploitation

- **Métriques.** `GET /v1/metrics` renvoie du texte au format Prometheus. Si `RWD_METRICS_TOKEN` est défini, il exige `Authorization: Bearer <token>`. Séries : `rwd_online_devices{project}`, `rwd_connected_pages`, `rwd_attached_agents`, `rwd_ws_connections`, `rwd_rpc_total{method,result}`, `rwd_rpc_duration_seconds{method}` (histogramme), `rwd_http_requests_total{code}`.
- **Versions du SDK.** La version du SDK utilisée pour la mise en cache correspond aux 12 premiers caractères hexadécimaux du SHA-256 du `sdk.js` embarqué dans la passerelle, si bien que `/v1/sdk/<version>/sdk.js` change chaque fois que le fichier change. `GET /v1/api/config` la renvoie dans `sdkVersion`, avec `sdkIntegrity` (`sha384-…`, pour l'attribut `integrity`). La console propose un snippet qui épingle cette version.
- **Base de données.** `RWD_DATABASE_URL=postgres://…` (ou `postgresql://`) sélectionne Postgres ; sinon `RWD_DATA` (`rwd.db` par défaut) désigne un fichier SQLite. Le schéma est créé et migré au démarrage.
- **Limitation de débit.** Connexion à la console et acceptation d'invitation : 10 par minute et par IP client. Démarrages et callbacks de l'authentification unique : 60 par minute et par IP client. Connexions de pages et appels de présence : 120 par minute et par IP client. Les IP clientes ne sont lues dans `X-Forwarded-For` qu'avec `--trust-proxy` ; la même option régit `X-Forwarded-Proto` et `X-Forwarded-Host`, qui déterminent si le cookie de session est `Secure`, ainsi que le schéma et l'hôte du `gatewayUrl` déduit quand `--public-url` n'est pas défini.
- **Rétention de l'audit.** `RWD_AUDIT_RETENTION_DAYS` (180 par défaut) ; les anciens événements sont purgés toutes les 6 heures.

Tous les paramètres de la passerelle sont listés dans [gateway/README.fr.md](../gateway/README.fr.md).

## 17. DevTools pour tout le monde

Les propriétaires et les administrateurs peuvent ouvrir **Chrome DevTools** sur n'importe quelle page en ligne d'un appareil depuis la console : Elements (styles, boîte de modèle, mise en surbrillance sur l'appareil), Console (en direct, avec inspection d'objets et exécution de scripts), Network (avec les corps de réponse) et le stockage Application. C'est le vrai frontend DevTools, tel qu'empaqueté par [chii](https://github.com/liriliri/chii) ; le backend est le chobitsu complet déjà présent dans le SDK de page, et la passerelle relaie les messages CDP.

```
Console /devices/:id/devtools
  └─ iframe /devtools/chii_app.html?ws(s)=<host>/v1/devtools?ticket=…   ← DevTools frontend
        │ CDP (WebSocket)
        ▼
Gateway /v1/devtools ──{"t":"cdp","s","m"}──▶ page WebSocket ──▶ SDK: one session per window ──▶ chobitsu
```

### 17.1 Ouvrir une fenêtre

1. La console appelle `POST /v1/api/devices/:id/devtools` avec `{"page":"p1"}` (omis : la page que l'utilisateur regarde). Propriétaires et administrateurs uniquement.
2. La passerelle fusionne les politiques des projets dont des pages sont ouvertes sur l'appareil ; si l'une d'elles a `devtools: "off"`, la demande est refusée. Si l'`approval` fusionnée vaut `prompt`, la passerelle envoie à la page au premier plan un `attach_request` avec `"purpose":"devtools"`, `levels: ["advanced"]` et le nom du membre comme `agent.name`, puis attend la réponse (30 secondes ; la requête HTTP attend aussi). L'autorisation automatique du SDK ne s'applique pas. Avec `nativeApproval`, `status().pending.purpose` vaut `"devtools"` ([§7](#7-approbation-du-rattachement)).
3. Une autorisation dure `policy.attachMaxMinutes` pour ce membre sur cet appareil, si bien qu'un rechargement ou une navigation se reconnecte sans redemander. L'utilisateur qui appuie sur **Terminer** sur l'appareil, ou un membre de la console qui termine la session (`POST /devices/:id/end`), ferme toutes les fenêtres et retire les autorisations.
4. La réponse est `{"ticket","session","page":Page,"frontendUrl"}`. `ticket` est à usage unique et valable une minute ; `session` est l'id que la fenêtre aura dans `Device.devtools`.
5. Le frontend se connecte à `WS /v1/devtools?ticket=…`. Seule l'origine propre de la console peut se connecter (l'hôte de `--public-url` quand il est défini).

Codes d'erreur : `device_offline`, `no_page` (la page a disparu ou se reconnecte), `busy` (l'appareil attend que l'utilisateur réponde à une autre demande), `timeout`, `denied` (403) et `forbidden` (403, désactivé par la politique).

### 17.2 Messages de la page

```jsonc
← {"t":"devtools","s":"<session>","on":true,"by":"Ann"}   // une fenêtre s'est ouverte
← {"t":"devtools","s":"<session>","on":false}              // la fenêtre s'est fermée
← {"t":"cdp","s":"<session>","m":"<CDP command, JSON text>"}
→ {"t":"cdp","s":"<session>","m":"<CDP answer, JSON text>"} // vers la fenêtre qui a demandé
→ {"t":"cdp","m":"<CDP event, JSON text>"}                  // vers toutes les fenêtres de cette page
```

- Une fenêtre appartient à une seule connexion de page. Quand la page se déconnecte (rechargement, navigation, fermeture), la passerelle ferme ses fenêtres avec le code **4100** ; la console les rouvre avec un nouveau ticket une fois la page revenue (l'autorisation tient toujours, l'utilisateur n'est donc pas redemandé). Terminer la session les ferme avec **4403** ; un frontend qui ne suit pas (un screencast sur une liaison lente) est fermé avec **1013**.
- Les messages CDP vers la page ont leur propre file : une rafale de commandes venant du frontend ralentit ce frontend au lieu de faire tomber la page comme un consommateur lent, si bien que les RPC des agents ne sont pas affectées.
- Dans le SDK, les fenêtres partagent un seul chobitsu et les ids de commande sont réécrits par fenêtre. `Runtime.enable` et `Network.enable` reçoivent leur réponse du SDK, qui collecte les deux depuis le chargement de la page pour les agents, avec ce qui s'est passé avant l'ouverture de la fenêtre : messages de console (texte masqué ; les objets ne peuvent pas être développés) et requêtes récentes (corps de réponse tant qu'ils sont encore en cache). Aucun `*.disable` d'une fenêtre ne prend effet ; quand la dernière fenêtre se ferme, le SDK masque la surbrillance, arrête le screencast et libère les objets qu'il gardait pour les fenêtres.
- Tant qu'une fenêtre est ouverte, la barre inférieure de la page indique qu'un développeur est en train de déboguer, avec les noms des membres et un bouton **Terminer**.

### 17.3 État et audit

- `Device.devtools` liste les fenêtres ouvertes ; `Page.connected` et `Page.connectedSince` indiquent à la console quand rouvrir une fenêtre ; `Device.pending.purpose` signale une demande DevTools ([§12.8](#128-types)).
- Type de chronologie `devtools` : demandes, approbations et refus, fenêtres ouvertes et fermées, autorisations retirées ([§12.9](#129-événements-de-la-chronologie)).
- Actions d'audit `devtools.request`, `devtools.approve`, `devtools.deny`, `devtools.timeout`, `devtools.open`, `devtools.close` ([§12.7](#127-journal-daudit)).
- Confidentialité : DevTools voit la page telle qu'elle est, et **le masquage ne s'applique pas**. C'est pourquoi c'est réservé aux propriétaires et aux administrateurs, peut être désactivé par projet, demande l'accord de l'utilisateur sur l'appareil, et est audité.

### 17.4 Frontend

Le frontend est `public/front_end` du paquet npm `chii` à une version épinglée, vérifié par son sha512, et copié dans `console/dist/devtools/` lors de la construction de la console ([`console/scripts/devtools-frontend.mjs`](../console/scripts/devtools-frontend.mjs)). La passerelle l'embarque compressé en gzip (environ 3,4 Mo) et le sert avec `Content-Encoding: gzip` ; les réponses sous `/devtools/` portent `X-Frame-Options: SAMEORIGIN`.
