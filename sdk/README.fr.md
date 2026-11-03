<!-- i18n-source: b73d0ad06824fa3a84be92cf17790d5fcb1194a5 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | Français | [Русский](README.ru.md) | [العربية](README.ar.md)

# SDK de page RWD (`sdk/`)

Un fichier JS qu'une WebView d'application ou une page H5 charge, pour qu'un agent IA puisse inspecter et piloter la page via la passerelle RWD (`gateway/`) et MCP. Protocole : [`docs/protocol.fr.md`](../docs/protocol.fr.md) ; architecture : [`docs/architecture.fr.md`](../docs/architecture.fr.md).

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // facultatif
    deviceId: "…",               // facultatif ; fourni par un hôte natif qui injecte le SDK
    helpButton: true,            // facultatif ; affiche le bouton « Besoin d'aide »
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // facultatif ; une étiquette de langue, par défaut d'après les langues du navigateur
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## Obtenir le SDK

Publié sur npm sous le nom [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger) ; versions et modifications : [CHANGELOG](CHANGELOG.md).

| Usage | Source |
|---|---|
| `<script>` depuis un CDN | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.1.0/dist/sdk.js` ou `https://unpkg.com/remote-webview-debugger@0.1.0/dist/sdk.js` (IIFE minifiée, global `RemoteWebviewDebugger` ; épinglez la version, et ajoutez `integrity` si vous le souhaitez) |
| Un bundler | `npm install remote-webview-debugger`, puis `import { run, status } from 'remote-webview-debugger'` (module ES avec types). Importez-le avant votre propre code pour que la capture démarre tôt. Ne chargez pas en plus la version `<script>` sur la même page |
| Votre passerelle | `https://<gateway>/v1/sdk.js`, la copie qu'embarque la passerelle (également disponible à une URL adressée par contenu pour SRI, proposée par la console web) |
| Une application native | Embarquez `dist/sdk.js` du paquet, ou téléchargez-le depuis l'une des sources ci-dessus ; voir [l'intégration native](../docs/native-integration.fr.md) |

## API

| API | Description |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | Met la page en ligne (code d'appareil, pastille). Renvoie `Promise<{deviceCode, status}>` ; l'appeler une seconde fois est sans effet. Options ci-dessous. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}` ; `status` vaut `idle / connecting / online / polling / stopped / rejected / quota`, `lang` est la langue de l'interface (`null` avant `run()`), `logSession` le journal de session dans lequel écrit cette page (`null` quand rien n'est enregistré) |
| `stop()` | Se déconnecte et retire l'interface (la collecte de la console / du réseau continue, dans une limite bornée) |
| `setUser(userId)` | Change d'utilisateur ; se reconnecte une fois avec un nouveau `hello` |
| `help(on)` | Demande de l'aide / annule la demande |
| `nativeControl(nativeKey, action)` | « Reprendre » / « Rendre » / « Terminer » depuis l'interface propre de l'hôte natif |
| `nativeDecide(nativeKey, requestId, value)` | Avec `nativeApproval`, répond à `status().pending` : un niveau ou `null` pour une demande de rattachement, `'allow'` ou `null` pour la confirmation d'une action sensible |
| `setLang(lang?)` | Change la langue de l'interface à l'exécution (le réglage de langue propre à une application) ; sans argument, revient aux langues du navigateur. Voir [Langues](#langues) |
| `registerLocale(pack)` | Ajoute un pack de langue, ou remplace celui qui a le même `id` (accepte aussi un tableau). Voir [Langues](#langues) |
| `builtinLocales` | Les identifiants des packs intégrés |

Options de `run()` :

| Option | Description |
|---|---|
| `userId` | L'utilisateur connecté, envoyé avec le `hello` |
| `deviceId` | Un identifiant d'appareil stable fourni par un hôte natif (sinon, un identifiant est conservé dans le localStorage) |
| `helpButton` | Affiche le bouton « Besoin d'aide » (combiné par OU avec la politique du projet) |
| `app` | `{ name, version }` de l'application hôte |
| `lang` | Langue de tout ce que voit l'utilisateur du téléphone (pastille, fenêtre flottante, barre inférieure, boîtes de dialogue, toasts, l'onglet eruda, et la description « AI wants to … » d'une action sensible) : une étiquette de langue comme `'ja'` ou `'pt-BR'`. Par défaut : les langues du navigateur. Voir [Langues](#langues) |
| `locales` | Packs de langue supplémentaires, enregistrés avant le choix de la langue (comme `registerLocale`) |
| `messages` | Messages à remplacer, par langue : `{ en: { ui: { help: 'Contact support' } }, zh: { ui: { help: '联系客服' } } }` |
| `networkExclude` | Les requêtes que l'agent ne devrait pas avoir à éplucher — polices qui renvoient toujours 404, balises d'analytics : `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. Chaque règle correspond à l'URL en tant que sous-chaîne insensible à la casse, en tant que motif avec joker `*`, ou en tant qu'expression régulière quand elle s'écrit `/…/`. S'ajoute aux règles de la politique du projet. Les requêtes correspondantes restent hors de la liste réseau et des événements `net_fail` de la chronologie ; la page les enregistre quand même, si bien qu'un agent peut les demander avec `includeExcluded` |
| `lockScreen` | `false` : ne pas verrouiller la page pendant qu'un agent est rattaché (l'utilisateur peut toujours le changer dans la fenêtre flottante). Par défaut `true` |
| `theme` | `'auto'` (par défaut, suit l'arrière-plan de la page), `'system'`, `'light'` ou `'dark'` |
| `style` | Couleurs, polices, arrondis, z-index et positions de l'interface : `{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`. Voir [Apparence](#apparence) |
| `eruda` | `true` ou `{ dock, load, src, name }` : affiche Remote Debugger dans un onglet d'eruda ; `load` charge la dernière version d'eruda quand la page n'en a pas. Désactivé par défaut ; la politique du projet peut l'activer à distance, les options locales l'emportant champ par champ |
| `record` | `false` : cette page n'écrit aucun journal de session (et rien de ce qui est déjà stocké n'est supprimé). Par défaut `true` ; la politique du projet peut désactiver le journal pour toutes les pages |
| `launchId` | Le lancement de l'application auquel appartient cette page, pour que toutes les WebViews d'un même processus d'application rangent leur journal de session sous une seule session. Un hôte natif passe ici son propre identifiant (ou définit `window.RWDLaunchId` comme une chaîne ou une fonction qui en renvoie une) ; sinon, le SDK déduit le lancement d'un cookie de session et d'un battement de cœur |
| `nativeKey`, `deviceToken`, `nativeApproval` | Pour les hôtes natifs : le secret de `nativeControl` / `nativeDecide`, le jeton d'appareil que conserve l'hôte, et le choix de poser nativement les questions de rattachement / de confirmation |

## Langues

Intégrées : anglais (`en`), chinois simplifié (`zh`), chinois traditionnel (`zh-TW`, utilisé aussi pour `zh-HK`, `zh-MO` et `zh-Hant`), français (`fr`), espagnol (`es`), russe (`ru`), arabe (`ar`, mis en page de droite à gauche), japonais (`ja`), coréen (`ko`), allemand (`de`) et portugais (`pt`, brésilien ; utilisé aussi pour `pt-PT`).

**Choix de la langue.** La langue de l'utilisateur du téléphone est `run({ lang })` si elle est fournie, puis chacune des `navigator.languages` dans l'ordre. Pour chaque étiquette, le SDK essaie l'étiquette puis ses formes plus courtes (`pt-BR` → `pt`, `zh-HK` → `zh-TW` → `zh`), retient la première langue pour laquelle il dispose d'un pack, et se rabat sur l'anglais. Les messages absents d'un pack se rabattent de la même façon : un pack partiel convient donc très bien. `setLang('ja')` change de langue à l'exécution ; `status().lang` est le pack utilisé.

**Chargement.** L'anglais et le chinois simplifié sont inclus dans `sdk.js`. Les autres packs se chargent à la demande, la première fois qu'une page en a besoin (l'interface affiche la langue de repli pendant ce court instant) :

- Version `<script>` : depuis `locales/<id>.js` à côté de `sdk.js` (le chemin du CDN, par exemple `…/remote-webview-debugger@0.1.0/dist/locales/ja.js`, ou `/v1/locales/ja.js` sur votre passerelle), puis depuis la passerelle passée à `run()` en cas d'échec. Pour éviter la requête supplémentaire, chargez vous-même le pack, avant ou après `sdk.js` : `<script src="…/dist/locales/ja.js"></script>`.
- Version module ES : un import dynamique, si bien que votre bundler place chaque langue dans son propre chunk. Pour en intégrer une d'emblée au bundle : `import ja from 'remote-webview-debugger/locales/ja'`, puis `run(url, key, { locales: [ja] })`.

**Vos propres packs et formulations.** Un pack est `{ id, name, dir?, ui?, action?, agent? }` ; tout ce qui est omis provient de ses langues de repli :

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Chiedi aiuto' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { en: { ui: { help: 'Contact support' } } }, // remplace des messages isolés, dans n'importe quelle langue
})
```

`ui` est le texte de l'interface, `action` complète « AI wants to … » dans la boîte de dialogue de confirmation, et `agent` est ce qui est renvoyé à l'agent. Les types TypeScript (`LocalePack`, `Messages`, `UiMessages`, `ActionMessages`, `AgentMessages`) listent toutes les clés ; `src/locales/en.ts` sert de référence.

**Deux publics.** L'utilisateur du téléphone reçoit la langue décrite ci-dessus. L'agent lit les messages d'erreur RPC et les résumés de la chronologie (touchers, navigation dans la page, requêtes échouées) dans la langue de la passerelle, `welcome.agentLang` (`RWD_LANG`), dont le pack se charge de la même façon. Anglais tant qu'aucun welcome n'indique autre chose ; la dernière valeur est conservée dans le localStorage `rwd:alang`, si bien que les événements antérieurs au welcome de la page suivante l'utilisent aussi.

Un utilisateur sinophone peut donc travailler avec un agent anglophone : la boîte de dialogue demande `AI 想要点击「提交订单」，允许吗？` et, en cas de refus, l'agent lit `The user denied this action`.

## Apparence

L'interface vit dans une shadow root sur `#__rwd` (en dehors de `<body>`) : le CSS de la page ne l'atteint donc qu'à travers ces points d'accroche :

- **Propriétés personnalisées CSS** sur `:root` ou `#__rwd`, par exemple `:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`.
- **`run({ style })`**, qui définit ces mêmes propriétés sur `#__rwd`. Les couleurs y acceptent n'importe quelle couleur CSS.
- **`::part()`** pour tout le reste : `#__rwd::part(bar) { … }`. Parts : `pill`, `window`, `bar`, `task`, `dialog`, `toast`, `button`, `cursor`, `glow`, `overlay`. Les noms de classes internes ne constituent pas une API stable.
- **`theme`** : verre clair ou sombre (par défaut : suit l'arrière-plan de la page).

| Propriété | Champ de `style` | Par défaut | Rôle |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | Boutons, interrupteurs, pointeur de l'agent, mises en surbrillance et lueur des bords |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | Le bouton « Terminer » |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | « Besoin d'aide » ; l'état où l'utilisateur a la main |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | Point « en ligne » ; « copié » |
| `--rwd-font` | `font` | police d'interface du système (adaptée à la langue pour le chinois, le japonais et le coréen) | Tout le texte |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | Code d'appareil et badges |
| `--rwd-radius` | `radius` | `18px` | Fenêtre flottante ; la boîte de dialogue est arrondie de 2px de plus, la carte de tâche et la pastille de 2px de moins, les boutons de la boîte de dialogue de 6px de moins |
| `--rwd-button-radius` | `buttonRadius` | `999px` | Boutons, barre inférieure et toasts |
| `--rwd-z-index` | `zIndex` | `2147483647` | Toute l'interface |
| `--rwd-bar-bottom` | `barBottom` | `14px` | Barre inférieure, au-dessus de la zone sûre du bas |
| `--rwd-task-top` | `taskTop` | `10px` | Carte de tâche, sous la zone sûre du haut |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | Toasts, au-dessus de la zone sûre du bas |
| — | `pill: { side, top }` | bord droit (gauche dans les langues de droite à gauche), `0.62` | Position de départ de la pastille au repos, jusqu'à ce que l'utilisateur la déplace ; `top` va de 0 (en haut) à 1 (en bas) |

Les couleurs sont des triplets `r, g, b` pour que les nuances translucides suivent (la même convention que les `--bs-*-rgb` de Bootstrap).

## Comportement dans la page (protocole §6–§8, §11)

- Niveaux : les RPC sont vérifiés par rapport à `welcome.level` / `control.level` (`forbidden`, « Requires the … level »). Un agent sans niveau (passerelle plus ancienne) reçoit `interact` ; sans agent rattaché, rien de plus n'est imposé.
- Le jeton d'appareil est conservé dans le localStorage `rwd:dtoken`, le jeton de reprise dans le sessionStorage `rwd:resume` (lié au pageId). Code de fermeture 4401 : si le jeton a changé entre-temps (un autre onglet de l'appareil vient de le recevoir), réessayer une fois immédiatement, sinon `rejected` et nouvel essai au bout d'environ 10 minutes ; 4409 : se reconnecter avec un nouveau pageId ; 4429 : `quota`, nouvel essai au bout d'environ 5 minutes.
- `rwd_invite` dans la barre d'adresse est retiré lors de `run()` (`history.replaceState`) et envoyé avec le hello jusqu'à l'arrivée d'un welcome.
- `welcome.config` : `helpButton` (combiné par OU avec l'option de `run()`), `maskSelectors`, `maskPatterns` (instantané, console, URL réseau, valeurs du stockage, résumés de la chronologie), `confirmSelectors`, `networkExclude` (ajouté aux règles de l'option de `run()`), `sessionLog`. La dernière configuration est conservée dans le localStorage `rwd:cfg` et utilisée jusqu'à l'arrivée du welcome — ainsi, un projet qui a désactivé le journal de session le garde désactivé dès le premier instant de la page suivante, avant tout welcome.
- Les instantanés se terminent par une section `[Overlays]` qui liste ce qui flotte au-dessus de la page — le voile d'une popup, une fenêtre modale, un panneau glissant depuis le bas — avec sa balise, un court extrait de texte, la part de la zone d'affichage qu'il couvre et une référence. Un voile est un élément vide pour lequel l'aria snapshot n'a pas de nœud : il reçoit donc une référence `oN` au lieu de `eN` ; c'est ce qui permet à un agent de le toucher pour fermer la popup.
- Un clic vise d'abord le centre visible de l'élément, puis les autres points d'une grille 3×3 à l'intérieur, si bien qu'un badge posé sur un bouton ne le bloque pas. Quand tous les points sont recouverts, le RPC échoue avec `not_interactable` en nommant l'élément qui masque et sa référence.
- Les boîtes de dialogue de rattachement et d'action sensible (`[data-rwd-confirm]`, `confirmSelectors`, y compris la touche Entrée qui soumet un formulaire) vivent dans un Shadow DOM, n'acceptent que les touchers de confiance et ne s'activent que 0,4 s après leur apparition. Les onglets de même origine partagent les demandes de rattachement déjà tranchées via BroadcastChannel.

Le chargement du fichier lance la collecte de la console, des erreurs non interceptées et du réseau (XHR, fetch, WebSocket, sendBeacon, EventSource), 500 entrées au plus pour chacun ; une fois plein, ce sont les journaux ordinaires et les requêtes réussies qui partent en premier. Les corps de réponse sont mis en cache jusqu'à 5 Mo au total, 64 Ko chacun. Chargez-le donc de façon synchrone et tôt dans le `<head>`.

## Journal de session (protocole §5.4)

Ces tampons sont la mémoire d'une seule page. En parallèle, le SDK écrit un **journal de session** dans IndexedDB (`rwd-log`) sur l'appareil, pour qu'un agent qui se rattache après un bug puisse quand même lire tout le chemin qui y a mené :

- Une session correspond à un lancement de l'application, partagé par toutes les pages de l'origine : `run({ launchId })`, sinon `window.RWDLaunchId`, sinon déduit du cookie de session `rwd_launch` et d'un battement de cœur (une session de cookie restée silencieuse plus d'une heure compte comme un nouveau lancement). `status().logSession` donne l'identifiant utilisé.
- Enregistré : ouverture de page / navigation dans la page / premier plan-arrière-plan / départ, les touchers, saisies, soumissions et positions de défilement au repos de l'utilisateur, les appels interactifs de l'agent et `rwd.evaluate`, les changements de contrôle, la console à tous les niveaux, et chaque requête terminée — les requêtes échouées aussi avec leurs en-têtes et corps expurgés (64 Ko chacun). Il fonctionne que la passerelle soit joignable ou non. Les champs masqués sont stockés sous la forme `••••`, et les `maskPatterns` sont appliqués au moment où les enregistrements sont écrits.
- Conservé : les 3 derniers lancements, 10 Mo chacun ; au-delà, les journaux ordinaires et les requêtes réussies sont supprimés en premier. Seul le lancement en cours quand le quota de stockage est inférieur à 64 Mo ; rien du tout sans IndexedDB.
- Lu par l'agent avec `rwd.log` (`observe`) et `rwd.logDetail` (`advanced`, pour les en-têtes et les corps). Rien ne quitte l'appareil autrement.
- Désactivé avec `run({ record: false })` pour une page, ou `policy.sessionLog: false` pour le projet — ce qui supprime aussi ce que cette origine a déjà stocké.

## Organisation

- `src/index.ts` : API publique, session, distribution des RPC, état de contrôle.
- `src/transport.ts` : le WebSocket de la page (le constructeur natif), délai d'expiration du battement de cœur, backoff exponentiel et, après 3 tentatives échouées, `POST /v1/presence` toutes les 60 s.
- `src/ids.ts` : deviceId / pageId / openerId.
- `src/launch.ts` : le lancement de l'application auquel appartient cette page (`launchId`, `window.RWDLaunchId`, le cookie `rwd_launch`).
- `src/pageWatch.ts` : messages `page` (url, titre, visibilité) et événements de la chronologie (navigation dans la page, touchers de l'utilisateur).
- `src/ui.ts`, `src/lock.ts` : la pastille, le bouton d'aide, la surcouche de verrouillage, la lueur, la mise en surbrillance des actions et les boîtes de dialogue dans un Shadow DOM ; bloque les saisies de confiance de l'utilisateur pendant qu'un agent est rattaché, et affiche depuis combien de temps il est connecté.
- `src/approval.ts` : approbation du rattachement et confirmation des actions sensibles (boîte de dialogue dans la page, ou hôte natif via `nativeDecide`).
- `src/i18n.ts`, `src/locales/`, `src/localeLoader*.ts` : packs de langue (textes de l'interface, des actions et de l'agent pour chaque langue), choix et repli, chargement à la demande ; `scripts/locales.mjs` construit `dist/locales/<id>.js`.
- Le moteur de l'agent se trouve à côté de chobitsu dans `packages/chobitsu/src/engine/rwd/` : instantané, `rwd.query`, vérifications d'actionnabilité, saisie synthétisée, clavier, tampons console / réseau, captures d'écran, `rwd.storage`, le journal de session dans IndexedDB (`coldlog.ts`), détection des surcouches (`overlays.ts`), niveaux et règles de confirmation (`policy.ts`), textes destinés à l'agent (`i18n.ts`). Les sources Playwright utilisées pour les instantanés se trouvent dans `packages/chobitsu/src/engine/vendor/playwright/`. Le build les regroupe depuis les sources dans `dist/sdk.js`.

## Build et tests

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE, global RemoteWebviewDebugger, ES2017), dist/index.mjs + index.d.ts (module ES)
npm run typecheck
npm test             # Playwright : WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # passerelle simulée locale : http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

Les tests utilisent `test/mock-gateway.mjs`, qui implémente le côté page du protocole (welcome, état de contrôle, RPC, présence ; jetons, codes de fermeture, niveaux, configuration distante, `agentLang`, approbation du rattachement) et sert `/v1/sdk.js`, les packs de langue sous `/v1/locales/` ainsi que la boutique de démonstration. Elle ne vérifie pas elle-même les niveaux : les tests mettent donc à l'épreuve le contrôle propre à la page. Les specs de `test/e2e/` s'exécutent avec un navigateur `zh-CN` et `agentLang: 'zh'` sauf indication contraire d'un test ; `i18n.spec.ts` couvre l'anglais, `locales.spec.ts` les autres packs de langue, le repli, les packs personnalisés, l'apparence et la mise en page de droite à gauche. Le test de coexistence charge eruda 3.4.3 et PageSpy 2.4.0 depuis jsdelivr : il nécessite donc un accès à Internet.
