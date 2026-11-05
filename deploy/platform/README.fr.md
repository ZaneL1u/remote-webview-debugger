<!-- i18n-source: 633220a8fe1b3ddd3a313fd33ae0414507b2953f -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | Français | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Déploiement avec Docker Compose

Exécute la passerelle sur un hôte Docker, derrière un petit [Caddy](https://caddyserver.com). Deux façons de l'exposer :

- **Derrière un proxy TLS existant** (par défaut) : Caddy écoute sur `127.0.0.1:18788` et votre nginx, Caddy, Traefik ou répartiteur de charge termine le HTTPS devant lui.
- **HTTPS direct** avec `RWD_DOMAIN` : Caddy sert lui-même les ports 80 et 443 et obtient un certificat auprès de Let's Encrypt.

`deploy.sh` compile tout en local, l'envoie par ssh et (re)démarre la pile. Les paramètres de la passerelle sont décrits dans [gateway/README.fr.md](../../gateway/README.fr.md).

## Fichiers

| Fichier | Rôle |
|---|---|
| `Dockerfile` | Image de la passerelle : Alpine plus le binaire `rwd` précompilé (console web et SDK embarqués). S'exécute sous l'uid 10001 avec `RWD_ADDR=:8080` et `RWD_DATA=/data/rwd.db`, avec un contrôle de santé sur `/v1/healthz`. La même image est publiée sur GHCR et fonctionne aussi seule |
| `compose.yml` | Deux services. `gateway` : construit à partir du Dockerfile, `./data` monté sur `/data`, paramètres lus dans `.env`, `RWD_TRUST_PROXY=1` (seul Caddy peut l'atteindre), aucun port publié. `web` : `caddy:2-alpine`, publié sur `${BIND:-127.0.0.1}:${PORT:-18788}`, sert `./demo` sous `/demo/` et transmet tout le reste à la passerelle |
| `Caddyfile` | HTTP simple sur `:80`. Ne fait confiance à `X-Forwarded-*` que depuis `RWD_TRUSTED_PROXIES` (par défaut : plages privées) |
| `compose.tls.yml` | Surcouche pour le HTTPS direct : ajoute les ports `443/tcp` et `443/udp` (HTTP/3), remplace le Caddyfile par `Caddyfile.tls`, conserve les certificats dans le volume `caddy-data` |
| `Caddyfile.tls` | Sert `RWD_DOMAIN` en HTTPS avec un certificat automatique et redirige le HTTP vers le HTTPS |
| `deploy.sh` | Compilation, copie, `.env` initial, sauvegarde de la base de données, redémarrage |

Sur le serveur, `deploy.sh` produit :

```
~/rwd-platform/
├── .env                      paramètres (mode 600 ; créé au premier déploiement, plus modifié ensuite)
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       le binaire de la passerelle pour l'architecture du serveur
├── data/                     rwd.db (SQLite) et sauvegardes rwd.db.bak-<date>
└── demo/platform-demo/       la boutique de démo, sur https://rwd.example.com/demo/platform-demo/
```

## Prérequis

- **Machine de compilation :** Go, Node.js avec npm, `make`, `ssh`, `scp`, `tar`.
- **Serveur :** Docker avec le plugin Compose (`docker compose`), et `openssl`. L'utilisateur ssh doit pouvoir exécuter Docker (par exemple en faisant partie du groupe `docker`) ; sudo n'est pas nécessaire. Le serveur télécharge `alpine:3.22` et `caddy:2-alpine`.

## Paramètres (`.env`)

| Variable | Valeur par défaut | Description |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | générée au premier déploiement | Mot de passe du propriétaire ; **obligatoire**. Appliqué à chaque démarrage : le modifier réinitialise donc le mot de passe du propriétaire désigné par `RWD_ADMIN_EMAIL` |
| `RWD_ADMIN_EMAIL` | `admin` | Compte propriétaire (identifiant de connexion). Créé uniquement au premier démarrage ; le modifier ensuite n'ajoute pas de propriétaire, voir [gateway/README](../../gateway/README.fr.md) |
| `RWD_PUBLIC_URL` | déduite des requêtes | URL publique de la passerelle, par exemple `https://rwd.example.com/v1`. Recommandé |
| `RWD_METRICS_TOKEN` | générée par `deploy.sh` | Jeton Bearer pour `/v1/metrics` |
| `RWD_DATABASE_URL` | SQLite dans `./data` | `postgres://…` pour utiliser Postgres à la place |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Nombre de jours de conservation du journal d'audit |
| `RWD_LANG` | `en` | Langue des textes destinés à l'agent : `en`, `zh`, `zh-TW`, `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` ou `pt` |
| `RWD_MCP_RATE_LIMIT` | — | Requêtes MCP par IP client et par minute (aucune limite si non défini) ; pour une démo publique, voir [deploy/demo](../demo/README.md) |
| `RWD_OIDC_PROVIDER`, `RWD_OIDC_*` | — | Authentification unique avec Feishu, Lark ou OpenID Connect, voir [gateway/README](../../gateway/README.fr.md#authentification-unique) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Plages d'adresses (CIDR séparés par des espaces, ou `private_ranges` de Caddy) du proxy placé devant Caddy ; voir plus bas |
| `BIND` | `127.0.0.1` | Adresse sur laquelle Caddy est publié |
| `PORT` | `18788` | Port sur lequel Caddy est publié |
| `RWD_DOMAIN` | — | Nom d'hôte public pour le HTTPS direct (avec `compose.tls.yml` uniquement) |
| `COMPOSE_FILE` | — | `compose.yml:compose.tls.yml` active le HTTPS direct |

Après avoir modifié `.env` sur le serveur, appliquez les changements avec `docker compose up -d` dans le répertoire de déploiement.

## Déployer avec `deploy.sh`

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` est tout ce qu'accepte `ssh` (un alias de `~/.ssh/config`, `user@host`) ; `<amd64|arm64>` est l'architecture du processeur du serveur ; `remote-dir` vaut par défaut `rwd-platform` dans le répertoire personnel de l'utilisateur ssh. Le script :

1. exécute `make platform GOOS=linux GOARCH=<arch>` en local (SDK, console web, binaire de la passerelle) ;
2. copie sur le serveur le Dockerfile, les fichiers compose et les Caddyfiles, les pages de démo et le binaire ;
3. **au premier déploiement uniquement**, écrit `.env` (mode 600) avec un mot de passe propriétaire aléatoire, `BIND`, `PORT` et les paramètres facultatifs ci-dessous, puis affiche une seule fois les identifiants du propriétaire. Les déploiements suivants n'écrasent jamais `.env` ; ils se contentent d'y ajouter les paramètres apparus dans les nouvelles versions (comme `RWD_METRICS_TOKEN`) lorsqu'ils manquent ;
4. si `data/rwd.db` existe, arrête la passerelle et copie la base de données vers `data/rwd.db.bak-<YYYYmmddHHMMSS>` (les migrations de schéma s'exécutent au démarrage suivant), puis attribue `data/` à l'uid 10001 à l'aide d'un conteneur jetable plutôt que de sudo ;
5. exécute `docker compose up -d --build` et affiche l'état des services.

Les paramètres du premier déploiement peuvent être passés en variables d'environnement ; ils ne sont lus que tant que `.env` n'existe pas : `BIND`, `PORT`, `RWD_ADMIN_EMAIL`, `RWD_PUBLIC_URL`, `RWD_TRUSTED_PROXIES` et `RWD_DOMAIN`.

### Derrière un proxy TLS existant

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy est publié sur `127.0.0.1:18788`. Faites pointer votre proxy vers cette adresse et vérifiez que le proxy :

- transmet les upgrades WebSocket (les pages se connectent à `/v1/page`) ;
- ne met pas les réponses en tampon et accepte les connexions de longue durée : les mises à jour en direct de la console web (`/v1/api/stream`) et MCP utilisent du HTTP en streaming ; la passerelle envoie un heartbeat toutes les 25 secondes, donc un délai d'inactivité supérieur à 60 secondes suffit ;
- envoie `X-Forwarded-For`, `X-Forwarded-Proto: https` et l'en-tête `Host` d'origine.

Par exemple, avec nginx :

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    server_name rwd.example.com;
    # listen 443 ssl; ssl_certificate …; ssl_certificate_key …;

    location / {
        proxy_pass http://127.0.0.1:18788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

**`RWD_TRUSTED_PROXIES`.** Caddy ne transmet les en-têtes `X-Forwarded-*` du proxy à la passerelle que si le proxy se connecte depuis une adresse de confiance. La valeur par défaut, `private_ranges`, couvre un proxy situé sur le même hôte ou sur un réseau privé. Si votre proxy se connecte depuis une adresse publique (un autre serveur, un CDN ou un répartiteur de charge cloud), indiquez ici ses plages d'adresses. Sinon, la passerelle prend le proxy pour le client : chaque requête semble provenir de l'IP du proxy (ce qui casse les listes d'IP autorisées des clés d'API et les limites de débit par IP) et arriver en HTTP simple (le cookie de la console web n'est alors pas marqué `Secure`).

Pour publier Caddy sur une autre adresse ou un autre port, définissez `BIND` et `PORT`.

### HTTPS direct avec `RWD_DOMAIN`

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

Avant le premier déploiement, faites pointer le DNS du domaine vers le serveur et ouvrez les ports 80 et 443 (TCP, plus UDP 443 pour HTTP/3). Lorsque `RWD_DOMAIN` est défini, le premier déploiement écrit `RWD_DOMAIN`, `COMPOSE_FILE=compose.yml:compose.tls.yml`, `BIND=0.0.0.0`, `PORT=80` et `RWD_PUBLIC_URL=https://rwd.example.com/v1` dans `.env`. Caddy obtient et renouvelle le certificat tout seul (Let's Encrypt via le HTTPS automatique de Caddy), le conserve dans le volume `caddy-data` et redirige le HTTP vers le HTTPS. Le port 80 reste ouvert pour le challenge ACME et la redirection.

Pour faire passer un déploiement existant au HTTPS direct, ajoutez ces cinq lignes à `.env` et exécutez `docker compose up -d`.

## Déploiement manuel

Sans `deploy.sh` :

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# copiez deploy/platform/* sur le serveur, ainsi que le binaire sous le nom ./rwd
# sur le serveur, dans ce répertoire :
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### Avec l'image publiée

Chaque version de la passerelle publie aussi l'image `ghcr.io/zanel1u/remote-webview-debugger` pour linux/amd64 et linux/arm64, avec les tags `<version>` (par exemple `0.2.0`), `<major>.<minor>` et `latest`, console web et SDK embarqués. Pour l'utiliser au lieu d'en construire une, remplacez les lignes `build:` et `image:` de la passerelle dans `compose.yml` par `image: ghcr.io/zanel1u/remote-webview-debugger:<version>`, laissez de côté le binaire et démarrez avec `docker compose up -d`. Pour mettre à jour, changez le tag puis lancez `docker compose pull && docker compose up -d` (sauvegardez d'abord `data/`, comme le fait `deploy.sh`).

Pour un essai rapide sans Compose, l'image fonctionne aussi seule : voir le [démarrage rapide](../../README.fr.md#1-lancer-la-passerelle). Seule, elle ne fait pas confiance à `X-Forwarded-*` ; si vous placez votre propre proxy devant, ajoutez `-e RWD_TRUST_PROXY=1`.

## Mise à jour

Relancez `deploy.sh` avec le même hôte, la même architecture et le même répertoire. Il recompile, copie le nouveau binaire, sauvegarde la base de données SQLite et redémarre la pile ; `.env` est conservé. Attendez-vous à une courte interruption. Les pages se reconnectent d'elles-mêmes : en quelques secondes après une brève coupure ; après une coupure plus longue, une page peut d'abord se rabattre sur l'interrogation périodique, puis revenir au WebSocket en quelques minutes, ou dès qu'un agent s'y connecte. Les agents connectés à ce moment-là doivent se reconnecter.

## Sauvegardes

- **Copies automatiques.** Chaque déploiement copie `data/rwd.db` vers `data/rwd.db.bak-<time>` avant le redémarrage. Ces copies s'accumulent ; supprimez les anciennes de temps en temps.
- **Sauvegardes régulières.** SQLite fonctionne en mode WAL : des écritures récentes peuvent donc se trouver dans `rwd.db-wal` tant que la passerelle tourne. Pour obtenir une copie cohérente, arrêtez brièvement la passerelle :

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **Restauration.** Arrêtez la passerelle, remplacez `data/rwd.db` par la sauvegarde (et supprimez `rwd.db-wal` / `rwd.db-shm`), vérifiez que le fichier appartient à l'uid 10001, puis démarrez la passerelle.
- Sauvegardez aussi `.env`. Les sauvegardes de la base de données contiennent le pepper des clés d'API et le secret de session de la console web : conservez-les en lieu sûr.

## Postgres

Définissez `RWD_DATABASE_URL` dans `.env`, par exemple `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`, puis exécutez `docker compose up -d`. Le conteneur de la passerelle doit pouvoir joindre la base de données (une base managée, ou un service `postgres` que vous ajoutez dans un fichier compose de surcharge). Le schéma est créé au démarrage ; les données d'un fichier SQLite existant ne sont pas reprises. `deploy.sh` ne sauvegarde que SQLite : sauvegardez Postgres avec `pg_dump` ou les snapshots de votre fournisseur.

## Au quotidien

```bash
docker compose ps                                     # état
docker compose logs -f gateway                        # journaux de la passerelle (mot de passe propriétaire généré, erreurs…)
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **Mot de passe propriétaire oublié :** modifiez `RWD_ADMIN_PASSWORD` dans `.env` et exécutez `docker compose up -d` ; il est appliqué au démarrage.
- N'exécutez **qu'une** instance de passerelle par base de données : l'état en direct (pages connectées, état du contrôle) réside dans le processus de la passerelle.
- Les pages de démo sous `/demo/` sont facultatives ; videz `demo/` si vous ne voulez pas qu'elles soient publiques (le déploiement suivant les recopie).
