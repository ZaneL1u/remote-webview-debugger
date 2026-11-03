<!-- i18n-source: 290e0636713e2be8bacb0501c422ae3a327ae0ea -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | Deutsch | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# Deployment mit Docker Compose

Betreibt das Gateway auf einem Docker-Host mit einem kleinen [Caddy](https://caddyserver.com) davor. Zwei Möglichkeiten, es erreichbar zu machen:

- **Hinter einem bestehenden TLS-Proxy** (Standard): Caddy lauscht auf `127.0.0.1:18788`, und Ihr nginx, Caddy, Traefik oder Load Balancer davor terminiert HTTPS.
- **Direktes HTTPS** mit `RWD_DOMAIN`: Caddy bedient die Ports 80 und 443 selbst und holt sich ein Zertifikat von Let's Encrypt.

`deploy.sh` baut alles lokal, überträgt es per ssh und (re)startet den Stack. Die Einstellungen des Gateways sind in [gateway/README.de.md](../../gateway/README.de.md) beschrieben.

## Dateien

| Datei | Zweck |
|---|---|
| `Dockerfile` | Gateway-Image: Alpine plus das vorgebaute Binary `rwd` (Konsole und SDK eingebettet). Läuft als uid 10001 mit `RWD_ADDR=:8080` und `RWD_DATA=/data/rwd.db`, mit Healthcheck auf `/v1/healthz`. Dasselbe Image wird auf GHCR veröffentlicht und läuft auch eigenständig |
| `compose.yml` | Zwei Dienste. `gateway`: aus dem Dockerfile gebaut, `./data` unter `/data` eingehängt, Einstellungen aus `.env`, `RWD_TRUST_PROXY=1` (nur Caddy erreicht ihn), nicht veröffentlicht. `web`: `caddy:2-alpine`, veröffentlicht auf `${BIND:-127.0.0.1}:${PORT:-18788}`, liefert `./demo` unter `/demo/` aus und leitet alles andere an das Gateway weiter |
| `Caddyfile` | Reines HTTP auf `:80`. Vertraut `X-Forwarded-*` nur von `RWD_TRUSTED_PROXIES` (Standard: private Adressbereiche) |
| `compose.tls.yml` | Overlay für direktes HTTPS: fügt die Ports `443/tcp` und `443/udp` (HTTP/3) hinzu, setzt `Caddyfile.tls` ein und speichert Zertifikate im Volume `caddy-data` |
| `Caddyfile.tls` | Liefert `RWD_DOMAIN` per HTTPS mit automatischem Zertifikat aus und leitet HTTP auf HTTPS um |
| `deploy.sh` | Bauen, kopieren, `.env` beim ersten Mal, Datenbank-Backup, Neustart |

Auf dem Server erzeugt `deploy.sh`:

```
~/rwd-platform/
├── .env                      Einstellungen (Modus 600; beim ersten Deployment angelegt, danach unangetastet)
├── Dockerfile  compose.yml  compose.tls.yml  Caddyfile  Caddyfile.tls
├── rwd                       das Gateway-Binary für die Architektur des Servers
├── data/                     rwd.db (SQLite) und Backups rwd.db.bak-<Zeit>
└── demo/platform-demo/       der Demo-Shop, unter https://rwd.example.com/demo/platform-demo/
```

## Voraussetzungen

- **Build-Rechner:** Go, Node.js mit npm, `make`, `ssh`, `scp`, `tar`.
- **Server:** Docker mit dem Compose-Plugin (`docker compose`) und `openssl`. Der ssh-Benutzer muss Docker ausführen dürfen (zum Beispiel als Mitglied der Gruppe `docker`); sudo wird nicht benötigt. Der Server zieht `alpine:3.22` und `caddy:2-alpine`.

## Einstellungen (`.env`)

| Variable | Standard | Beschreibung |
|---|---|---|
| `RWD_ADMIN_PASSWORD` | beim ersten Deployment erzeugt | Passwort des Inhabers; **erforderlich**. Wird bei jedem Start angewendet; eine Änderung setzt also das Passwort des durch `RWD_ADMIN_EMAIL` benannten Inhabers zurück |
| `RWD_ADMIN_EMAIL` | `admin` | Inhaber-Konto (Anmeldename). Wird nur beim ersten Start angelegt; eine spätere Änderung fügt keinen Inhaber hinzu, siehe [gateway/README](../../gateway/README.de.md) |
| `RWD_PUBLIC_URL` | aus Anfragen abgeleitet | Öffentliche Gateway-URL, z. B. `https://rwd.example.com/v1`. Empfohlen |
| `RWD_METRICS_TOKEN` | von `deploy.sh` erzeugt | Bearer-Token für `/v1/metrics` |
| `RWD_DATABASE_URL` | SQLite in `./data` | `postgres://…`, um stattdessen Postgres zu verwenden |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Wie viele Tage das Audit-Log aufbewahrt wird |
| `RWD_LANG` | `en` | Sprache der Texte für den Agent: `en`, `zh`, `zh-TW`, `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` oder `pt` |
| `RWD_MCP_RATE_LIMIT` | — | MCP-Anfragen pro Client-IP und Minute (ohne Wert kein Limit); für eine öffentliche Demo siehe [deploy/demo](../demo/README.md) |
| `RWD_TRUSTED_PROXIES` | `private_ranges` | Adressbereiche (durch Leerzeichen getrennte CIDRs oder Caddys `private_ranges`) des Proxys vor Caddy; siehe unten |
| `BIND` | `127.0.0.1` | Adresse, auf der Caddy veröffentlicht wird |
| `PORT` | `18788` | Port, auf dem Caddy veröffentlicht wird |
| `RWD_DOMAIN` | — | Öffentlicher Hostname für direktes HTTPS (nur mit `compose.tls.yml`) |
| `COMPOSE_FILE` | — | `compose.yml:compose.tls.yml` schaltet direktes HTTPS ein |

Nach dem Bearbeiten von `.env` auf dem Server übernehmen Sie die Änderungen mit `docker compose up -d` im Deployment-Verzeichnis.

## Deployment mit `deploy.sh`

```bash
deploy/platform/deploy.sh <ssh-host> <amd64|arm64> [remote-dir]
```

`<ssh-host>` ist alles, was `ssh` akzeptiert (ein Alias aus `~/.ssh/config`, `user@host`); `<amd64|arm64>` ist die CPU-Architektur des Servers; `remote-dir` ist standardmäßig `rwd-platform` im Home-Verzeichnis des ssh-Benutzers. Das Skript:

1. führt lokal `make platform GOOS=linux GOARCH=<arch>` aus (SDK, Konsole, Gateway-Binary);
2. kopiert Dockerfile, Compose-Dateien und Caddyfiles, die Demoseiten und das Binary auf den Server;
3. schreibt **nur beim ersten Deployment** `.env` (Modus 600) mit einem zufälligen Inhaber-Passwort, `BIND`, `PORT` und den unten genannten optionalen Einstellungen und gibt die Anmeldedaten des Inhabers einmalig aus. Spätere Deployments überschreiben `.env` nie; sie ergänzen nur in neueren Versionen hinzugekommene Einstellungen (etwa `RWD_METRICS_TOKEN`), wenn diese fehlen;
4. stoppt, falls `data/rwd.db` existiert, das Gateway und kopiert die Datenbank nach `data/rwd.db.bak-<YYYYmmddHHMMSS>` (Schemamigrationen laufen beim nächsten Start), und korrigiert dann den Eigentümer von `data/` auf uid 10001 – mit einem Wegwerf-Container statt sudo;
5. führt `docker compose up -d --build` aus und zeigt den Status der Dienste.

Einstellungen für das erste Deployment können als Umgebungsvariablen übergeben werden; sie werden nur gelesen, solange `.env` noch nicht existiert: `BIND`, `PORT`, `RWD_ADMIN_EMAIL`, `RWD_PUBLIC_URL`, `RWD_TRUSTED_PROXIES` und `RWD_DOMAIN`.

### Hinter einem bestehenden TLS-Proxy

```bash
RWD_ADMIN_EMAIL=you@example.com RWD_PUBLIC_URL=https://rwd.example.com/v1 \
  deploy/platform/deploy.sh my-server amd64
```

Caddy wird auf `127.0.0.1:18788` veröffentlicht. Richten Sie Ihren Proxy darauf aus und stellen Sie sicher, dass der Proxy:

- WebSocket-Upgrades durchreicht (Seiten verbinden sich mit `/v1/page`);
- Antworten nicht puffert und langlebige Verbindungen zulässt: Die Live-Aktualisierungen der Konsole (`/v1/api/stream`) und MCP verwenden Streaming-HTTP; das Gateway sendet alle 25 Sekunden einen Heartbeat, Idle-Timeouts über 60 Sekunden reichen also aus;
- `X-Forwarded-For`, `X-Forwarded-Proto: https` und den ursprünglichen `Host` mitsendet.

Zum Beispiel mit nginx:

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

**`RWD_TRUSTED_PROXIES`.** Caddy reicht die `X-Forwarded-*`-Header des Proxys nur dann an das Gateway weiter, wenn sich der Proxy von einer vertrauenswürdigen Adresse aus verbindet. Der Standard `private_ranges` deckt einen Proxy auf demselben Host oder in einem privaten Netz ab. Verbindet sich Ihr Proxy von einer öffentlichen Adresse aus (ein anderer Server, ein CDN oder ein Cloud-Load-Balancer), setzen Sie hier dessen Adressbereiche. Andernfalls hält das Gateway den Proxy für den Client: Jede Anfrage scheint von der IP des Proxys zu kommen (was IP-Zulassungslisten von API-Keys und Rate Limits pro IP aushebelt) und über reines HTTP (sodass das Konsolen-Cookie nicht als `Secure` markiert wird).

Um Caddy auf einer anderen Adresse oder einem anderen Port zu veröffentlichen, setzen Sie `BIND` und `PORT`.

### Direktes HTTPS mit `RWD_DOMAIN`

```bash
RWD_DOMAIN=rwd.example.com RWD_ADMIN_EMAIL=you@example.com \
  deploy/platform/deploy.sh my-server arm64
```

Richten Sie vor dem ersten Deployment das DNS der Domain auf den Server aus und öffnen Sie die Ports 80 und 443 (TCP, plus UDP 443 für HTTP/3). Ist `RWD_DOMAIN` gesetzt, schreibt das erste Deployment `RWD_DOMAIN`, `COMPOSE_FILE=compose.yml:compose.tls.yml`, `BIND=0.0.0.0`, `PORT=80` und `RWD_PUBLIC_URL=https://rwd.example.com/v1` in `.env`. Caddy besorgt und erneuert das Zertifikat selbst (Let's Encrypt über Caddys automatisches HTTPS), speichert es im Volume `caddy-data` und leitet HTTP auf HTTPS um. Port 80 bleibt für die ACME-Challenge und die Umleitung offen.

Um ein bestehendes Deployment auf direktes HTTPS umzustellen, ergänzen Sie diese fünf Zeilen in `.env` und führen `docker compose up -d` aus.

## Manuelles Deployment

Ohne `deploy.sh`:

```bash
make -j16 GOOS=linux GOARCH=amd64                       # → gateway/bin/rwd-linux-amd64
# deploy/platform/* auf den Server kopieren, dazu das Binary als ./rwd
# auf dem Server, in diesem Verzeichnis:
mkdir -p data demo
printf 'RWD_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 12)" > .env && chmod 600 .env
docker run --rm -v "$PWD/data:/data" alpine:3.22 chown -R 10001 /data
docker compose up -d --build
```

### Mit dem Release-Image

Jedes Gateway-Release veröffentlicht außerdem das Image `ghcr.io/zanel1u/remote-webview-debugger` für linux/amd64 und linux/arm64, getaggt mit `<version>` (z. B. `0.2.0`), `<major>.<minor>` und `latest`, mit eingebetteter Konsole und eingebettetem SDK. Um es zu verwenden, statt selbst eines zu bauen, ersetzen Sie die Zeilen `build:` und `image:` des Gateways in `compose.yml` durch `image: ghcr.io/zanel1u/remote-webview-debugger:<version>`, lassen das Binary weg und starten mit `docker compose up -d`. Zum Upgrade ändern Sie den Tag und führen dann `docker compose pull && docker compose up -d` aus (sichern Sie vorher `data/`, wie es `deploy.sh` tut).

Für einen schnellen Test ohne Compose läuft das Image auch eigenständig: siehe den [Schnellstart](../../README.de.md#1-gateway-starten). Eigenständig vertraut es `X-Forwarded-*` nicht; wenn Sie einen eigenen Proxy davorsetzen, ergänzen Sie `-e RWD_TRUST_PROXY=1`.

## Aktualisieren

Führen Sie `deploy.sh` erneut mit demselben Host, derselben Architektur und demselben Verzeichnis aus. Es baut neu, kopiert das neue Binary, sichert die SQLite-Datenbank und startet den Stack neu; `.env` bleibt erhalten. Rechnen Sie mit einer kurzen Unterbrechung. Seiten verbinden sich von selbst wieder: nach einem kurzen Ausfall innerhalb von Sekunden; nach einem längeren fällt eine Seite eventuell zunächst auf Polling zurück und kehrt innerhalb weniger Minuten zum WebSocket zurück, oder sobald sich ein Agent mit ihr verbindet. Agents, die in diesem Moment verbunden sind, müssen sich neu verbinden.

## Backups

- **Automatische Kopien.** Jedes Deployment kopiert `data/rwd.db` vor dem Neustart nach `data/rwd.db.bak-<Zeit>`. Diese sammeln sich an; löschen Sie alte von Zeit zu Zeit.
- **Regelmäßige Backups.** SQLite läuft im WAL-Modus, daher können jüngste Schreibvorgänge in `rwd.db-wal` liegen, solange das Gateway läuft. Eine konsistente Kopie sichern Sie, indem Sie das Gateway kurz anhalten:

  ```bash
  docker compose stop gateway
  docker run --rm -v "$PWD/data:/data" alpine:3.22 cp -p /data/rwd.db "/data/rwd.db.bak-$(date +%Y%m%d%H%M%S)"
  docker compose start gateway
  ```

- **Wiederherstellen.** Gateway stoppen, `data/rwd.db` durch das Backup ersetzen (und `rwd.db-wal` / `rwd.db-shm` löschen), sicherstellen, dass die Datei uid 10001 gehört, Gateway starten.
- Sichern Sie auch `.env`. Datenbank-Backups enthalten den Pepper für API-Keys und das Sitzungsgeheimnis der Konsole: Bewahren Sie sie unter Verschluss auf.

## Postgres

Setzen Sie `RWD_DATABASE_URL` in `.env`, zum Beispiel `postgres://rwd:…@db.example.com:5432/rwd?sslmode=require`, und führen Sie `docker compose up -d` aus. Der Gateway-Container muss die Datenbank erreichen können (eine verwaltete Datenbank oder ein `postgres`-Dienst, den Sie in einer Compose-Override-Datei ergänzen). Das Schema wird beim Start angelegt; Daten aus einer vorhandenen SQLite-Datei werden nicht übernommen. `deploy.sh` sichert nur SQLite, sichern Sie Postgres also mit `pg_dump` oder den Snapshots Ihres Anbieters.

## Im laufenden Betrieb

```bash
docker compose ps                                     # Status
docker compose logs -f gateway                        # Gateway-Logs (das erzeugte Inhaber-Passwort, Fehler…)
curl https://rwd.example.com/v1/healthz               # {"ok":true,"version":"…","db":"sqlite"}
curl -H "Authorization: Bearer $RWD_METRICS_TOKEN" https://rwd.example.com/v1/metrics
```

- **Inhaber-Passwort vergessen:** Ändern Sie `RWD_ADMIN_PASSWORD` in `.env` und führen Sie `docker compose up -d` aus; es wird beim Start angewendet.
- Betreiben Sie **eine** Gateway-Instanz pro Datenbank: Der Live-Zustand (verbundene Seiten, Zustand der Steuerung) lebt im Gateway-Prozess.
- Die Demoseiten unter `/demo/` sind optional; löschen Sie den Inhalt von `demo/`, wenn sie nicht öffentlich sein sollen (das nächste Deployment kopiert sie erneut).
