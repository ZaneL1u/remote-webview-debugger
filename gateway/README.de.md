<!-- i18n-source: 0dcd3b6faee7da70bf01670a986f2e0c4d1d102e -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | Deutsch | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# rwd-Gateway

Der Go-Server von Remote WebView Debugger: Seitenverbindungen, Geräte-Presence, Zustand der Steuerung, der gehostete MCP-Endpunkt, die REST-API der Konsole sowie die eingebettete Konsole und das Seiten-SDK. Ein einziges Binary ist der ganze Server.

- Protokoll: [docs/protocol.de.md](../docs/protocol.de.md)
- Architektur, Einwilligungsmodell und Sicherheitshinweise: [docs/architecture.de.md](../docs/architecture.de.md)
- Deployment mit Docker Compose: [deploy/platform/README.de.md](../deploy/platform/README.de.md)

## Bauen und starten

Zum Bauen brauchen Sie Go (die Version aus `go.mod`) und Node.js mit npm, weil die Konsole und das SDK gebaut und in das Binary eingebettet werden. Im Wurzelverzeichnis des Repositorys:

```bash
make -j16                                    # → gateway/bin/rwd-<os>-<arch>
make -j16 GOOS=linux GOARCH=amd64            # Cross-Compiling (amd64 oder arm64)

RWD_ADMIN_EMAIL=you@example.com RWD_ADMIN_PASSWORD='change-me' \
  gateway/bin/rwd-darwin-arm64 serve --addr :8080
```

Öffnen Sie http://localhost:8080 und melden Sie sich mit dieser E-Mail-Adresse und diesem Passwort an. Seiten und Agents verwenden die Gateway-URL `http://localhost:8080/v1` (in Produktion: `https://rwd.example.com/v1`).

`go build ./cmd/rwd` in `gateway/` funktioniert auch, aber dieses Binary enthält statt der Konsole und des SDK nur Platzhalter. `make` setzt die Version, die `rwd version` und `/v1/healthz` melden, aus dem neuesten Tag `gateway-vX.Y.Z` (`0.2.0` auf dem Tag, `0.2.0-3-gabc1234` danach, `0.0.0-dev` ohne Tag); `RWD_VERSION=…` überschreibt sie. Fertige Binarys für Linux und macOS (amd64, arm64) hängen an jedem [GitHub Release](https://github.com/ZaneL1u/remote-webview-debugger/releases) `gateway-v*`; Änderungen: [CHANGELOG](CHANGELOG.md).

## Befehle

```
rwd serve [Optionen]                    startet das Gateway
rwd mcp --gateway https://host/v1       stdio-MCP-Bridge für lokale Agents (API-Key aus RWD_API_KEY)
rwd version                             gibt die Version aus
```

## Konfiguration (`rwd serve`)

Jede Option hat eine Umgebungsvariable; eine auf der Kommandozeile angegebene Option hat Vorrang.

| Option / Umgebungsvariable | Standard | Beschreibung |
|---|---|---|
| `--addr` / `RWD_ADDR` | `:8080` | Listen-Adresse (reines HTTP; TLS gehört davor, siehe [deploy/platform](../deploy/platform/README.de.md)) |
| `--data` / `RWD_DATABASE_URL` / `RWD_DATA` | `rwd.db` | Datenbank. Eine URL `postgres://` oder `postgresql://` wählt Postgres; alles andere ist ein Pfad zu einer SQLite-Datei. `RWD_DATABASE_URL` hat Vorrang vor `RWD_DATA`. Das Schema wird beim Start angelegt und migriert |
| `--public-url` / `RWD_PUBLIC_URL` | aus jeder Anfrage abgeleitet | Öffentliche Gateway-URL mit `/v1` am Ende, z. B. `https://rwd.example.com/v1`. Wird in Integrations-Snippets, Einladungslinks und `/v1/api/config` verwendet. Setzen Sie sie, wenn das Gateway seine öffentliche Adresse nicht ableiten kann |
| `--trust-proxy` / `RWD_TRUST_PROXY=1` | aus | Übernimmt die Client-IP aus `X-Forwarded-For` sowie Schema und Host der abgeleiteten öffentlichen URL (und ob das Konsolen-Cookie `Secure` ist) aus `X-Forwarded-Proto` / `X-Forwarded-Host`. Schalten Sie das nur hinter einem Reverse Proxy ein, sonst können Clients diese Header fälschen und IP-Zulassungslisten und Rate Limits umgehen. Ohne diese Option gilt jede Anfrage als reines HTTP, egal was der Proxy sagt: Das Konsolen-Cookie wird ohne `Secure` gesetzt, und abgeleitete URLs beginnen mit `http://` (setzen Sie in diesem Fall `--public-url`) |
| `--lang` / `RWD_LANG` | `en` | Sprache von allem, was die KI liest: MCP-Anweisungen, Beschreibungen von Tools und Parametern, Tool-Ergebnisse, `[Sitzungsänderungen]` und Fehler. Sie erreicht auch das Seiten-SDK als `welcome.agentLang`, sodass in der Seite erzeugte Fehler und Ereigniszusammenfassungen dazu passen. Eine von `en`, `zh` (vereinfachtes Chinesisch), `zh-TW` (traditionelles Chinesisch), `fr`, `es`, `ru`, `ar`, `ja`, `ko`, `de` oder `pt`; regionale Tags werden akzeptiert und der nächstliegenden zugeordnet (`zh-CN` → `zh`, `zh-HK` → `zh-TW`, `pt-BR` → `pt`). Die Konsole wählt ihre Sprache pro Anfrage (`?lang=` oder `Accept-Language`) und fällt auf diese zurück |
| `--demo-dir` / `RWD_DEMO_DIR` | — | Liefert dieses Verzeichnis unter `/demo/` aus (optional, für Demoseiten) |
| `--mcp-rate-limit` / `RWD_MCP_RATE_LIMIT` | `0` (kein Limit) | Erlaubte MCP-Anfragen pro Client-IP und Minute; darüber hinaus gibt es `429` mit `Retry-After: 60`. Gedacht für ein Gateway, dessen API-Key öffentlich ist, etwa eine Demo ([deploy/demo](../deploy/demo/README.md)). Hinter einem Proxy braucht es `--trust-proxy`, um die Client-IPs zu sehen |
| `--demo-keys` / `RWD_DEMO_KEYS=1` | aus | Betreibt eine öffentliche Demo: `POST /v1/demo/keys` (ohne Anmeldung, CORS offen) gibt jedem Besucher einen eigenen API-Schlüssel (Stufe `interact`, 24 Stunden gültig, 5 pro IP und Stunde), sodass sich Besucher nie einen Agent teilen; und `list_devices` verlangt einen `deviceCode`, sodass niemand die Geräte anderer Besucher auflisten kann. Siehe [deploy/demo](../deploy/demo/README.md) |
| `RWD_ADMIN_EMAIL` | `admin` | E-Mail-Adresse (Anmeldename) des Inhaber-Kontos. Ein Inhaber wird nur angelegt, solange die Datenbank noch keinen hat (beim ersten Start); eine spätere Änderung legt **keinen** zweiten Inhaber an, sondern bestimmt nur, für welchen Inhaber `RWD_ADMIN_PASSWORD` gilt |
| `RWD_ADMIN_PASSWORD` | — | Passwort des Inhabers. Wird beim Anlegen des Inhabers verwendet und setzt bei **jedem** weiteren Start das Passwort des durch `RWD_ADMIN_EMAIL` benannten Inhabers zurück, was zugleich als Kontowiederherstellung dient. Gehört diese E-Mail-Adresse keinem Inhaber (einem anderen Mitglied oder niemandem), wird sie ignoriert, und das Log sagt das und nennt die Inhaber. Ist sie bei leerer Datenbank nicht gesetzt, wird ein zufälliges Passwort erzeugt und einmalig ins Log geschrieben |
| `RWD_METRICS_TOKEN` | — | Wenn gesetzt, verlangt `/v1/metrics` den Header `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Wie viele Tage das Audit-Log aufbewahrt wird |
| `RWD_OIDC_*` | — | Single Sign-on, siehe [unten](#single-sign-on) |

Außerdem wissenswert:

- Geheimnisse, die das Gateway braucht (der Pepper für API-Keys und das Sitzungsgeheimnis der Konsole), werden beim ersten Start erzeugt und in der Datenbank gespeichert. Sichern Sie die Datenbank und halten Sie die Backups unter Verschluss.
- Das Gateway hält den Live-Zustand (verbundene Seiten, Zustand der Steuerung, Zeitleisten) im Speicher; betreiben Sie daher eine Instanz pro Datenbank.
- Healthcheck: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

## Single Sign-on

Mitglieder können sich auch mit Feishu, Lark oder einem beliebigen OpenID-Connect-Anbieter (Keycloak, Okta, Microsoft Entra ID, Google, Authing, …) anmelden; E-Mail-Adresse und Passwort funktionieren weiterhin. Setzen Sie den Anbieter und seine Client-Zugangsdaten, dann zeigt die Anmeldeseite **Mit … anmelden**.

| Umgebungsvariable | Standard | Beschreibung |
|---|---|---|
| `RWD_OIDC_PROVIDER` | — | `feishu`, `lark` oder `oidc`; schaltet Single Sign-on ein. Ist nur `RWD_OIDC_ISSUER` gesetzt, gilt `oidc` |
| `RWD_OIDC_CLIENT_ID`, `RWD_OIDC_CLIENT_SECRET` | — | Zugangsdaten der App (App ID und App Secret bei Feishu und Lark). Erforderlich |
| `RWD_OIDC_ISSUER` | — | OpenID-Connect-Issuer, z. B. `https://sso.example.com/realms/acme`; die Endpunkte werden aus seiner `/.well-known/openid-configuration` gelesen (nur `oidc`) |
| `RWD_OIDC_AUTH_URL`, `RWD_OIDC_TOKEN_URL`, `RWD_OIDC_USERINFO_URL` | die des Anbieters | Überschreiben die Endpunkte; setzen Sie alle drei für einen OpenID-Connect-Anbieter ohne Discovery |
| `RWD_OIDC_SCOPES` | `openid profile email` (`oidc`), keine (Feishu, Lark) | Durch Leerzeichen getrennte Scopes. Fügen Sie bei Feishu und Lark `contact:user.email:readonly` hinzu (und `contact:user.employee:readonly` für die Firmen-E-Mail-Adresse), damit Konten eine E-Mail-Adresse bekommen |
| `RWD_OIDC_NAME` | der Name des Anbieters | Beschriftung der Anmeldeschaltfläche, z. B. `Okta` |
| `RWD_OIDC_DEFAULT_ROLE` | `member` | Rolle der Konten, die bei einer ersten Anmeldung angelegt werden: `member` oder `admin` |
| `RWD_OIDC_INVITE_ONLY=1` | aus | Legt keine Konten an: Nur bestehende oder eingeladene Mitglieder (gleiche E-Mail-Adresse) können sich anmelden |
| `RWD_OIDC_ALLOWED_DOMAINS` | — | Durch Kommas getrennte E-Mail-Domains, die sich anmelden dürfen, z. B. `example.com` |
| `RWD_OIDC_TRUST_EMAIL=1` | aus | Nur `oidc`: Vertraut der E-Mail-Adresse eines Anbieters, der kein `email_verified` sendet (Microsoft Entra ID). Nur für einen Single-Tenant-Anbieter, dessen E-Mail-Adressen Ihre Organisation kontrolliert |
| `RWD_OIDC_TENANT` | — | Nur Feishu und Lark: der `tenant_key` Ihrer Organisation; Personen anderer Organisationen werden abgewiesen (`sso_error=tenant`). Der `auth.login`-Eintrag jeder Single-Sign-on-Anmeldung im Audit-Log zeigt ihren `tenant` |
| `RWD_OIDC_SYNC_MINUTES` | `60` (Feishu, Lark) | Wie oft (in Minuten) Mitglieder deaktiviert werden, die die Organisation verlassen haben; `0` schaltet das ab. Siehe unten |
| `RWD_OIDC_KEY_CHECK` | an (Feishu, Lark) | Prüft bei jeder Verwendung eines API-Keys, ob sein Inhaber noch beschäftigt ist; `0` schaltet das ab. Siehe unten |

Registrieren Sie diese Weiterleitungs-URL beim Anbieter; sie muss exakt übereinstimmen: `https://<host>/v1/api/auth/oidc/callback`, also der Origin von `RWD_PUBLIC_URL` (ohne Wert der Origin der Anfrage), gefolgt von `/v1/api/auth/oidc/callback`. Setzen Sie hinter einem Proxy `RWD_PUBLIC_URL`, damit die URL stabil bleibt.

Die erste Anmeldung einer Identität verknüpft sie mit dem Mitglied mit derselben E-Mail-Adresse (ein eingeladenes Mitglied behält die Rolle aus der Einladung, und die Einladung ist damit verbraucht) oder legt ein Konto mit `RWD_OIDC_DEFAULT_ROLE` an, außer bei `RWD_OIDC_INVITE_ONLY=1`. Spätere Anmeldungen finden das Konto über das Subject des Anbieters (`open_id` bei Feishu und Lark), sodass eine geänderte E-Mail-Adresse keine Rolle spielt. Ein Konto, das bereits mit einer anderen Identität des Anbieters verknüpft ist, wird nicht erneut verknüpft (ein neu vergebenes Postfach erhält `sso_error=conflict`), und die Einladung eines deaktivierten Mitglieds bleibt unberührt. Die E-Mail-Adresse eines OpenID-Connect-Anbieters zählt nur mit `email_verified: true` (oder `RWD_OIDC_TRUST_EMAIL=1`), und ein Konto ohne E-Mail-Adresse erhält den Anmeldenamen `<provider>:<subject>`. Inhaber verwalten diese Mitglieder auf der Seite **Mitglieder** wie alle anderen: Rolle ändern, deaktivieren oder entfernen; ein deaktiviertes Mitglied kann sich auf keinem der beiden Wege anmelden. Per Single Sign-on angelegte Konten haben kein Passwort. Das Gateway liest den Benutzer mit dem gerade erhaltenen Access Token vom Userinfo-Endpunkt des Anbieters (Authorization Code Flow mit PKCE); das ID-Token verwendet es nicht. Starts und Callbacks sind auf 60 pro Minute und Client-IP begrenzt (schalten Sie hinter einem Proxy `--trust-proxy` ein, sonst teilen sich alle die IP des Proxys).

**Wer hereinkommt.** Die E-Mail-Adresse des Anbieters entscheidet, mit welchem bestehenden Mitglied eine erste Anmeldung verknüpft wird, Inhaber eingeschlossen; wer beim Anbieter E-Mail-Adressen festlegen kann, kann diese Konten also übernehmen. Verwenden Sie bei Feishu oder Lark eine eigene App: Nur Personen in Ihrer Organisation können sich anmelden, mit den E-Mail-Adressen Ihrer Organisation. Eine Store-App oder eine mit verbundenen Organisationen geteilte App lässt auch andere Organisationen herein: Setzen Sie dann `RWD_OIDC_TENANT`. Bei einem OpenID-Connect-Anbieter, bei dem sich jeder anmelden kann (Google, ein mandantenfähiges Entra ID), setzen Sie `RWD_OIDC_ALLOWED_DOMAINS` oder `RWD_OIDC_INVITE_ONLY=1`, sonst bekommt jeder ein Konto (das Log warnt beim Start); und setzen Sie dort niemals `RWD_OIDC_TRUST_EMAIL=1`.

**Die App wechseln oder Single Sign-on abschalten.** Die `open_id`s von Feishu und Lark gehören zu einer App: Nach dem Wechsel zu einer anderen App ID werden Mitglieder erneut über die E-Mail-Adresse verknüpft, und Konten ohne E-Mail-Adresse (`feishu:…`) müssen entfernt und neu eingeladen werden. Per Single Sign-on angelegte Konten haben kein Passwort: Ein Inhaber gibt ihnen eines mit **Neuer Link** auf der Seite **Mitglieder**, einem Einladungslink zum Festlegen eines Passworts (er ersetzt auch eine verlorene Einladung), etwa bevor Single Sign-on abgeschaltet wird.

**Feishu oder Lark.** Legen Sie auf der [Feishu Open Platform](https://open.feishu.cn/app) (Lark: [open.larksuite.com](https://open.larksuite.com/app)) eine eigene App (企业自建应用) an, die nur Personen in Ihrer Organisation nutzen können, und gehen Sie dann so vor:

1. Kopieren Sie App ID und App Secret aus **Credentials & Basic Info** in `RWD_OIDC_CLIENT_ID` und `RWD_OIDC_CLIENT_SECRET`.
2. Fügen Sie unter **Security Settings → Redirect URLs** die Weiterleitungs-URL von oben hinzu.
3. Fügen Sie unter **Permissions & Scopes** `contact:user.email:readonly` hinzu (und `contact:user.employee:readonly` für die Firmen-E-Mail-Adresse), und tragen Sie dieselben Scopes in `RWD_OIDC_SCOPES` ein. Damit bemerkt wird, wer gegangen ist, braucht die App außerdem `contact:contact.base:readonly` und `contact:user.employee:readonly` sowie unter **Data permissions → Contacts range** alle, die sich anmelden.
4. Beschränken Sie die Verfügbarkeit der App auf die Personen, die sich anmelden sollen, und erstellen und veröffentlichen Sie eine Version, damit die Einstellungen wirksam werden.

**Wer geht.** Bei Feishu oder Lark fragt das Gateway alle `RWD_OIDC_SYNC_MINUTES` Minuten bei der Open Platform nach jedem mit der App verknüpften Mitglied und deaktiviert diejenigen, die als ausgetreten oder als aus der Organisation ausgeschieden geführt werden: Sie werden abgemeldet, ihre API-Keys funktionieren nicht mehr, ihre Agents werden getrennt, und das Audit-Log verzeichnet `member.update` durch `system` mit `"reason":"left_organization"`. Ein Inhaber kann sie danach entfernen, was ihre Keys endgültig widerruft. Nur ein ausdrückliches „ausgetreten“ zählt: Ein Mitglied außerhalb des Kontaktbereichs oder eine fehlgeschlagene Anfrage ändert nichts (das Log sagt, was fehlgeschlagen ist), und der letzte Inhaber wird nie deaktiviert. Ohne die Kontaktberechtigung prüft die Synchronisierung nichts, und die unten beschriebene Key-Prüfung lehnt die Keys von Mitgliedern ab, die mit der App verknüpft sind; ist zusätzlich `RWD_OIDC_KEY_CHECK=0` gesetzt, behält, wer gegangen ist, funktionierende API-Keys, bis ein Inhaber ihn deaktiviert, wobei seine Konsolensitzung innerhalb von 12 Stunden endet, da er sich nicht mehr anmelden kann.

**Keys von Leuten, die gehen.** Bei Feishu oder Lark prüft das Gateway außerdem bei jeder Verwendung eines API-Keys, ob dessen Inhaber noch beschäftigt ist, sofern der Inhaber mit der App verknüpft ist; `RWD_OIDC_KEY_CHECK=0` schaltet das ab. Jede MCP-Anfrage wird authentifiziert, das gilt also auch für jeden Tool-Aufruf einer langen Sitzung. Es ist dieselbe Kontaktabfrage wie oben. Ausgeschieden oder gegangen: Die Anfrage bekommt 401 mit „der Inhaber des Keys hat die Organisation verlassen“, die Agents des Inhabers werden getrennt, und der Inhaber wird wie oben deaktiviert und protokolliert (die Keys des letzten Inhabers werden abgelehnt, der letzte Inhaber selbst wird aber nicht deaktiviert). Aktiv: Die Antwort gilt 60 Sekunden lang, eine Folge von Tool-Aufrufen fragt also nur einmal (gleichzeitige Aufrufe teilen sich eine Abfrage), und das `tenant_access_token` wird bis kurz vor seinem Ablauf wiederverwendet. Eine fehlgeschlagene Abfrage (Netzwerk, außerhalb des Kontaktbereichs, fehlende Berechtigung) lässt den Key nur durch, wenn eine Abfrage in den letzten 24 Stunden „aktiv“ ergab; sonst bekommt die Anfrage 401 mit „es ließ sich nicht bestätigen, dass der Inhaber des Keys noch beschäftigt ist; wenden Sie sich an einen Admin“, das Log enthält eine Warnung, und das Mitglied wird nicht deaktiviert. Gateway-Keys und Inhaber ohne Feishu- oder Lark-Identität (Konten mit Passwort) werden nicht geprüft.

```bash
RWD_PUBLIC_URL=https://rwd.example.com/v1 \
RWD_OIDC_PROVIDER=feishu RWD_OIDC_CLIENT_ID=cli_a1b2c3d4 RWD_OIDC_CLIENT_SECRET='…' \
RWD_OIDC_SCOPES='contact:user.email:readonly contact:user.employee:readonly' \
  rwd serve
```

## Einen Agent verbinden

Legen Sie in der Konsole einen API-Key an (**API-Keys**) und tragen Sie dann den gehosteten MCP-Endpunkt in Ihrem Client ein, zum Beispiel in Claude Code:

```bash
claude mcp add --transport http rwd https://rwd.example.com/v1/mcp \
  --header "Authorization: Bearer rwd_sk_live_…"
```

Für Clients, die nur stdio sprechen, leitet dasselbe Binary stdio an den gehosteten Endpunkt weiter:

```bash
claude mcp add rwd -e RWD_API_KEY=rwd_sk_live_… -- rwd mcp --gateway https://rwd.example.com/v1
```

| Einstellung von `rwd mcp` | Beschreibung |
|---|---|
| `--gateway` / `RWD_GATEWAY` | Gateway-URL mit `/v1` am Ende |
| `RWD_API_KEY` | API-Key (nur als Umgebungsvariable, damit er nicht in Prozesslisten auftaucht) |

Ein Key erreicht jedes Gerät am Gateway. Die Tools sind in [protocol.de.md §14](../docs/protocol.de.md#14-mcp) aufgeführt.

## Aufbau des Quellcodes

```
cmd/rwd/            Einstiegspunkt: serve, mcp (stdio-Bridge), version
internal/store/     SQLite / Postgres: Projekte und Richtlinien, Mitglieder, API-Keys (HMAC; Stufe,
                    Ablauf, IP-Zulassungsliste), Geräte und Geräte-Tokens, Geräteeinladungen,
                    Audit-Log, Einstellungen
internal/hub/       Live-Zustand: Geräte, Seiten, Zustandsautomat der Steuerung, Verbindungsfreigabe,
                    Stufenprüfung, Zeitleisten, RPC-Routing, SSE-Abonnements, Metriken
internal/server/    HTTP: WebSocket der Seiten, Presence-Polling, REST mit Anmeldung und Rollen,
                    MCP-Tools, SSE, /v1/metrics, statische Dateien
internal/i18n/      Texte für Agents und die Konsole in 11 Sprachen
internal/ids/       App-Keys, API-Keys, Gerätecodes, Geheimnisse
internal/web/       die eingebettete Konsole und das SDK (von `make gateway` bereitgestellt, sonst
                    Platzhalter)
scripts/embed.sh    kopiert console/dist und sdk.js für go:embed nach internal/web
```

## Tests

```bash
cd gateway && go test -race ./...
```

`internal/server/server_test.go` spielt den gesamten Ablauf mit simulierten Seiten und einem MCP-Client durch: Verbinden per Gerätecode; Freigabe auf dem Gerät (zulassen, ablehnen, wiederholte Ablehnungen und Sperre, nur ansehen); erneutes Verbinden innerhalb der Kulanzzeit ohne zweite Freigabe; Stufenprüfungen; Snapshots; Sperren bei der ersten Interaktion; Folgen über Seiten hinweg und Verwerfen einer Seite, die eine neu erzeugte WebView ersetzt hat; Übernehmen und Zurückgeben; gebündelte Aktionen; Beenden durch den Nutzer; Audit-Einträge; Geräte-Tokens (4401), Resume-Tokens (4409) und Kontingente (4429); einmalige Einladungen; Ablauf von Keys und IP-Zulassungslisten; sofortiges Widerrufen; Einladungen von Mitgliedern und Rollen; SSE und Metriken; sowie Authentifizierungsfehler.

Dieselben Tests laufen auch gegen Postgres (jeder Test in einem eigenen temporären Schema):

```bash
RWD_TEST_DATABASE_URL='postgres://user:pw@127.0.0.1:5432/rwd?sslmode=disable' go test -race ./internal/server/
```

`make -j16 check` im Wurzelverzeichnis des Repositorys führt die Prüfungen für Gateway, SDK und Konsole aus, die auch die CI ausführt.
