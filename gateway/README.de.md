<!-- i18n-source: 048ece68ecafa5fd74a1bc0378b1a0eb32f2cf96 -->
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
| `RWD_ADMIN_EMAIL` | `admin` | E-Mail-Adresse (Anmeldename) des Inhaber-Kontos. Ein Inhaber wird nur angelegt, solange die Datenbank noch keinen hat (beim ersten Start); eine spätere Änderung legt **keinen** zweiten Inhaber an, sondern bestimmt nur, für welchen Inhaber `RWD_ADMIN_PASSWORD` gilt |
| `RWD_ADMIN_PASSWORD` | — | Passwort des Inhabers. Wird beim Anlegen des Inhabers verwendet und setzt bei **jedem** weiteren Start das Passwort des durch `RWD_ADMIN_EMAIL` benannten Inhabers zurück, was zugleich als Kontowiederherstellung dient. Gehört diese E-Mail-Adresse keinem Inhaber (einem anderen Mitglied oder niemandem), wird sie ignoriert, und das Log sagt das und nennt die Inhaber. Ist sie bei leerer Datenbank nicht gesetzt, wird ein zufälliges Passwort erzeugt und einmalig ins Log geschrieben |
| `RWD_METRICS_TOKEN` | — | Wenn gesetzt, verlangt `/v1/metrics` den Header `Authorization: Bearer <token>` |
| `RWD_AUDIT_RETENTION_DAYS` | `180` | Wie viele Tage das Audit-Log aufbewahrt wird |

Außerdem wissenswert:

- Geheimnisse, die das Gateway braucht (der Pepper für API-Keys und das Sitzungsgeheimnis der Konsole), werden beim ersten Start erzeugt und in der Datenbank gespeichert. Sichern Sie die Datenbank und halten Sie die Backups unter Verschluss.
- Das Gateway hält den Live-Zustand (verbundene Seiten, Zustand der Steuerung, Zeitleisten) im Speicher; betreiben Sie daher eine Instanz pro Datenbank.
- Healthcheck: `GET /v1/healthz` → `{"ok":true,"version":"…","db":"sqlite"|"postgres"}`.

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
