<!-- i18n-source: 068ae438288cfae0d5a68d844c1952e8a3a6704c -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | Français | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Passerelle rwd

Le serveur Go de Remote WebView Debugger : connexions des pages, présence des appareils, état du contrôle, point de terminaison MCP hébergé, API REST de la console web, sans oublier la console web et le SDK de page embarqués. Un seul binaire constitue tout le serveur.

- Protocole : [docs/protocol.fr.md](../docs/protocol.fr.md)
- Architecture, modèle de consentement et notes de sécurité : [docs/architecture.fr.md](../docs/architecture.fr.md)
- Déploiement avec Docker Compose : [deploy/platform/README.fr.md](../deploy/platform/README.fr.md)

## Compilation et exécution

La compilation nécessite Go (la version indiquée dans `go.mod`) ainsi que Node.js avec npm, car la console web et le SDK sont compilés puis embarqués dans le binaire. Depuis la racine du dépôt :

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # compilation croisée (amd64 ou arm64)

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

Ouvrez http://localhost:8080 et connectez-vous avec cet e-mail et ce mot de passe. Les pages et les agents utilisent l'URL de passerelle `http://localhost:8080/v1` (en production : `https://rwd.example.com/v1`).

`go build ./cmd/rwd` dans `gateway/` fonctionne aussi, mais ce binaire ne contient que des fichiers de substitution à la place de la console web et du SDK. `make` fixe la version renvoyée par `rwd version` et `/v1/healthz` à partir du dernier tag `gateway-vX.Y.Z` (`0.2.0` sur le tag, `0.2.0-3-gabc1234` après, `0.0.0-dev` s'il n'y en a aucun) ; `RWD_VERSION=…` permet de la remplacer. Des binaires pour Linux et macOS (amd64, arm64) sont joints à chaque [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases) `gateway-v*` ; modifications : [CHANGELOG](CHANGELOG.md).

## Commandes

```
rwd serve [options]                     lance la passerelle
rwd mcp --gateway https://host/v1       pont MCP stdio pour les agents locaux (clé d'API lue dans RWD_API_KEY)
rwd version                             affiche la version
```

## Configuration (`rwd serve`)

Chaque option a sa variable d'environnement ; une option passée en ligne de commande l'emporte.

| Option / variable d'environnement | Valeur par défaut | Description |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | Adresse d'écoute (HTTP simple ; placez TLS devant, voir [deploy/platform](../deploy/platform/README.fr.md)) |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | Base de données. Une URL `postgres://` ou `postgresql://` sélectionne Postgres ; toute autre valeur est le chemin d'un fichier SQLite. `RWD_DATABASE_URL` a priorité sur `RWD_DATA`. Le schéma est créé et migré au démarrage |
| `--public-url` / `RWD_PUBLIC_URL` | déduite de chaque requête | URL publique de la passerelle, terminée par `/v1`, par exemple `https://rwd.example.com/v1`. Utilisée dans les extraits d'intégration, les liens d'invitation et `/v1/api/config`. À définir lorsque la passerelle ne peut pas deviner son adresse publique |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | désactivé | Prend l'IP du client dans `X-Forwarded-For`, et le schéma et l'hôte de l'URL publique déduite (ainsi que le caractère `Secure` ou non du cookie de la console web) dans `X-Forwarded-Proto` / `X-Forwarded-Host`. À n'activer que derrière un proxy inverse, sinon les clients peuvent falsifier ces en-têtes et contourner les listes d'IP autorisées et les limites de débit. Sans cette option, chaque requête est traitée comme du HTTP simple, quoi qu'en dise le proxy : le cookie de la console web est alors posé sans `Secure` et les URL déduites commencent par `http://` (définissez `--public-url` dans ce cas) |
| `--lang` / `RWD_LANG` | `en` | Langue de tout ce que lit l'IA : instructions MCP, descriptions des outils et des paramètres, résultats des outils, `[Session changes]` et erreurs. Elle est aussi transmise au SDK de page sous la forme `welcome.agentLang`, afin que les erreurs et les résumés d'événements rédigés dans la page soient dans la même langue. Valeurs possibles : `en`, `zh` (chinois simplifié), `zh-TW` (chinois traditionnel), `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` ou `pt` ; les étiquettes régionales sont acceptées et ramenées à la plus proche (`zh-CN` → `zh`, `zh-HK` → `zh-TW`, `pt-BR` → `pt`). La console web choisit sa langue à chaque requête (`?lang=` ou `Accept-Language`) et se rabat sur celle-ci |
| `--demo-dir` / `RWD_DEMO_DIR` | — | Sert ce répertoire sous `/demo/` (facultatif, pour des pages de démonstration) |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0` (aucune limite) | Nombre de requêtes MCP autorisées par IP client et par minute ; au-delà, la réponse est `429` avec `Retry-After: 60`. Prévu pour une passerelle dont la clé d'API est publique, comme une démo ([deploy/demo](../deploy/demo/README.md)). Derrière un proxy, il faut `--trust-proxy` pour voir les IP des clients |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | désactivé | Fait tourner une démo publique : `POST /v1/demo/keys` (sans connexion, CORS ouvert) remet à chaque visiteur sa propre clé d'API (niveau `interact`, valable 24 heures, 5 par IP et par heure), si bien que les visiteurs ne partagent jamais un agent ; et `list_devices` exige un `deviceCode`, si bien que personne ne peut lister les appareils des autres visiteurs. Voir [deploy/demo](../deploy/demo/README.md) |
| `RWD_ADMIN_EMAIL` | `admin` | E-mail (identifiant de connexion) du compte propriétaire. Un propriétaire n'est créé que si la base de données n'en contient aucun (au premier démarrage) ; modifier cette valeur par la suite ne crée **pas** de second propriétaire, cela indique seulement à quel propriétaire s'applique `RWD_ADMIN_PASSWORD` |
| `RWD_ADMIN_PASSWORD` | — | Mot de passe du propriétaire. Utilisé à la création du propriétaire, puis à **chaque** démarrage suivant pour réinitialiser le mot de passe du propriétaire désigné par `RWD_ADMIN_EMAIL`, ce qui sert aussi de procédure de récupération du compte. Si cet e-mail n'est pas celui d'un propriétaire (un autre membre, ou personne), il est ignoré et le journal le signale en nommant les propriétaires. S'il n'est pas défini et que la base de données est vide, un mot de passe aléatoire est généré et affiché une seule fois dans le journal |
| `RWD_METRICS_TOKEN` | — | Si défini, `/v1/metrics` exige `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Nombre de jours de conservation du journal d'audit |
| `RWD_OIDC_*` | — | Authentification unique, voir [plus bas](#authentification-unique) |

Autres points utiles :

- Les secrets dont la passerelle a besoin (le pepper des clés d'API et le secret de session de la console web) sont générés au premier démarrage et stockés dans la base de données. Sauvegardez la base de données et gardez les sauvegardes privées.
- La passerelle conserve l'état en direct (pages connectées, état du contrôle, chronologies) en mémoire : n'exécutez donc qu'une instance par base de données.
- Contrôle de santé : `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## Authentification unique

Les membres peuvent aussi se connecter avec Feishu, Lark ou n'importe quel fournisseur OpenID Connect (Keycloak, Okta, Microsoft Entra ID, Google, Authing, …) ; l'e-mail et le mot de passe continuent de fonctionner. Définissez le fournisseur et ses identifiants client, et la page de connexion affiche **Se connecter avec …**.

| Variable d'environnement | Valeur par défaut | Description |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`, `lark` ou `oidc` ; active l'authentification unique. Définir seulement `RWD_OIDC_ISSUER` revient à `oidc` |
| `RWD_OIDC_CLIENT_ID`, `RWD_OIDC_CLIENT_SECRET` | — | Identifiants de l'application (App ID et App Secret pour Feishu et Lark). Obligatoires |
| `RWD_OIDC_ISSUER` | — | Émetteur (issuer) OpenID Connect, par exemple `https://sso.example.com/realms/acme` ; les points de terminaison sont lus dans son `/.well-known/openid-configuration` (`oidc` uniquement) |
| `RWD_OIDC_AUTH_URL`, `RWD_OIDC_TOKEN_URL`, `RWD_OIDC_USERINFO_URL` | ceux du fournisseur | Remplacent les points de terminaison ; définissez les trois pour un fournisseur OpenID Connect sans découverte |
| `RWD_OIDC_SCOPES` | `openid profile email` (`oidc`), aucun (Feishu, Lark) | Scopes séparés par des espaces. Pour Feishu et Lark, ajoutez `contact:user.email:readonly` (et `contact:user.employee:readonly` pour l'e-mail professionnel) afin que les comptes aient une adresse e-mail |
| `RWD_OIDC_NAME` | le nom du fournisseur | Libellé du bouton de connexion, par exemple `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | Rôle des comptes créés lors d'une première connexion : `member` ou `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | désactivé | Ne crée aucun compte : seuls les membres existants ou invités (même e-mail) peuvent se connecter |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | Domaines d'e-mail autorisés à se connecter, séparés par des virgules, par exemple `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | désactivé | `oidc` uniquement : fait confiance à l'adresse e-mail d'un fournisseur qui n'envoie pas `email_verified` (Microsoft Entra ID). Uniquement pour un fournisseur mono-locataire dont votre organisation contrôle les adresses e-mail |

Enregistrez cette URL de redirection auprès du fournisseur ; elle doit correspondre exactement : `https://<host>/v1/api/auth/oidc/callback`, c'est-à-dire l'origine de `RWD_PUBLIC_URL` (celle de la requête s'il n'est pas défini) suivie de `/v1/api/auth/oidc/callback`. Derrière un proxy, définissez `RWD_PUBLIC_URL` pour que l'URL reste stable.

La première connexion d'une identité la rattache au membre ayant la même adresse e-mail (un membre invité conserve le rôle de l'invitation, et l'invitation est consommée), ou crée un compte avec `RWD_OIDC_DEFAULT_ROLE`, sauf si `RWD_OIDC_INVITE_ONLY=1`. Les connexions suivantes retrouvent le compte par le subject du fournisseur (`open_id` pour Feishu et Lark) : un changement d'adresse e-mail n'a donc pas d'importance. Un compte déjà rattaché à une autre identité du fournisseur n'est pas rattaché à nouveau (une boîte mail réattribuée reçoit `sso_error=conflict`), et l'invitation d'un membre désactivé reste intacte. L'adresse e-mail d'un fournisseur OpenID Connect ne compte qu'avec `email_verified: true` (ou `RWD_OIDC_TRUST_EMAIL=1`), et un compte sans adresse e-mail reçoit l'identifiant de connexion `<provider>:<subject>`. Les propriétaires gèrent ces membres sur la page **Membres** comme tous les autres : changer leur rôle, les désactiver ou les supprimer ; un membre désactivé ne peut se connecter d'aucune des deux façons. Les comptes créés par authentification unique n'ont pas de mot de passe. La passerelle lit l'utilisateur sur le point de terminaison userinfo du fournisseur avec le jeton d'accès qu'elle vient de recevoir (flux authorization code avec PKCE) ; elle n'utilise pas le jeton d'identité (ID token). Les démarrages et les callbacks sont limités à 60 par minute et par IP client (derrière un proxy, activez `--trust-proxy`, sinon tout le monde partage l'IP du proxy).

**Qui peut entrer.** L'adresse e-mail du fournisseur détermine à quel membre existant une première connexion est rattachée, propriétaires compris : quiconque peut définir les adresses e-mail chez le fournisseur peut donc prendre le contrôle de ces comptes. Avec Feishu ou Lark, utilisez une application personnalisée : seules les personnes de votre organisation peuvent se connecter, avec les adresses e-mail de votre organisation. Avec un fournisseur OpenID Connect auquel n'importe qui peut se connecter (Google, un Entra ID multilocataire), définissez `RWD_OIDC_ALLOWED_DOMAINS` ou `RWD_OIDC_INVITE_ONLY=1`, sinon n'importe qui obtient un compte (le journal le signale au démarrage) ; et n'y définissez jamais `RWD_OIDC_TRUST_EMAIL=1`.

**Changer d'application ou désactiver l'authentification unique.** Les `open_id` de Feishu et Lark appartiennent à une seule application : après le passage à un autre App ID, les membres sont rattachés à nouveau par adresse e-mail, et les comptes sans adresse e-mail (`feishu:…`) doivent être supprimés puis invités à nouveau. Les comptes créés par authentification unique n'ont pas non plus de mot de passe : quand l'authentification unique est désactivée, un propriétaire les supprime et les invite à nouveau.

**Feishu ou Lark.** Sur la [Feishu Open Platform](https://open.feishu.cn/app) (Lark : [open.larksuite.com](https://open.larksuite.com/app)), créez une application personnalisée (企业自建应用), que seules les personnes de votre organisation peuvent utiliser, puis :

1. Copiez l'App ID et l'App Secret depuis **Credentials & Basic Info** dans `RWD_OIDC_CLIENT_ID` et `RWD_OIDC_CLIENT_SECRET`.
2. Dans **Security Settings → Redirect URLs**, ajoutez l'URL de redirection ci-dessus.
3. Dans **Permissions & Scopes**, ajoutez `contact:user.email:readonly` (et `contact:user.employee:readonly` pour l'e-mail professionnel), et listez les mêmes scopes dans `RWD_OIDC_SCOPES`.
4. Limitez la disponibilité de l'application aux personnes qui doivent se connecter, puis créez et publiez une version pour que les paramètres prennent effet.

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

## Connecter un agent

Créez une clé d'API dans la console web (**API keys**), puis ajoutez le point de terminaison MCP hébergé à votre client, par exemple Claude Code :

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

Pour les clients qui ne parlent que stdio, le même binaire relaie stdio vers le point de terminaison hébergé :

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| Réglage de `rwd mcp` | Description |
|---|---|
| `--gateway` / `RWD_GATEWAY` | URL de la passerelle, terminée par `/v1` |
| `RWD_API_KEY` | Clé d'API (uniquement par variable d'environnement, pour qu'elle n'apparaisse pas dans la liste des processus) |

Une seule clé donne accès à tous les appareils de la passerelle. Les outils sont listés dans [protocol.fr.md §14](../docs/protocol.fr.md#14-mcp).

## Organisation du code source

```
cmd/rwd/            point d'entrée : serve, mcp (pont stdio), version
internal/store/     SQLite / Postgres : projets et politiques, membres, clés d'API (HMAC ; niveau,
                    expiration, liste d'IP autorisées), appareils et jetons d'appareil, invitations
                    d'appareil, journal d'audit, paramètres
internal/hub/       état en direct : appareils, pages, machine à états du contrôle, approbation de
                    connexion, vérification des niveaux, chronologies, routage RPC, abonnements SSE,
                    métriques
internal/server/    HTTP : WebSocket des pages, interrogation de présence, REST avec connexion et rôles,
                    outils MCP, SSE, /v1/metrics, fichiers statiques
internal/i18n/      textes pour les agents et la console web, en 11 langues
internal/ids/       clés d'application, clés d'API, codes d'appareil, secrets
internal/web/       console web et SDK embarqués (mis en place par `make gateway`, sinon fichiers de
                    substitution)
scripts/embed.sh    copie console/dist et sdk.js dans internal/web pour go:embed
```

## Tests

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` exerce tout le parcours avec des pages simulées et un client MCP : connexion par code d'appareil ; approbation sur l'appareil (autorisation, refus, refus répétés et blocage, consultation seule) ; reconnexion pendant le délai de grâce sans seconde approbation ; vérification des niveaux ; instantanés ; verrouillage à la première interaction ; suivi d'une page à l'autre et abandon d'une page remplacée par une WebView recréée ; reprise et restitution de la main ; actions groupées ; fin de session par l'utilisateur ; enregistrements d'audit ; jetons d'appareil (4401), jetons de reprise (4409) et quotas (4429) ; invitations à usage unique ; expiration des clés et listes d'IP autorisées ; révocation immédiate ; invitations de membres et rôles ; SSE et métriques ; et échecs d'authentification.

Les mêmes tests s'exécutent sur Postgres (chaque test dans son propre schéma temporaire) :

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

`make -j16 check` à la racine du dépôt lance les vérifications de la passerelle, du SDK et de la console web exécutées par la CI.
