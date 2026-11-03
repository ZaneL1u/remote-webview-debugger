<!-- i18n-source: f1c156537ee729acb5ad4a7266a240554b3452f4 -->
[English](architecture.md) | [简体中文](architecture.zh-CN.md) | [繁體中文](architecture.zh-TW.md) | [日本語](architecture.ja.md) | [한국어](architecture.ko.md) | [Español](architecture.es.md) | [Français](architecture.fr.md) | Deutsch | [Português (Brasil)](architecture.pt-BR.md) | [Русский](architecture.ru.md) | [العربية](architecture.ar.md)

# Architektur

Mit Remote WebView Debugger kann ein KI-Agent eine Webseite untersuchen und bedienen, die auf dem Smartphone eines anderen Menschen geöffnet ist: eine H5-Seite in einem mobilen Browser oder einer Super-App oder eine WebView in Ihrer eigenen App. Der Agent spricht MCP mit einem selbst gehosteten Gateway; das Gateway spricht mit einem kleinen SDK, das in der Seite läuft. Der Nutzer des Smartphones gibt die Verbindung frei, sieht, was der Agent tut, und kann jederzeit übernehmen.

Dieses Dokument erklärt die beteiligten Teile und die Regeln, denen sie folgen. Die genauen Nachrichten und Endpunkte stehen in [protocol.de.md](protocol.de.md), die App-Integration in [native-integration.de.md](native-integration.de.md), das Deployment in [gateway/README.de.md](../gateway/README.de.md) und [deploy/platform/README.de.md](../deploy/platform/README.de.md).

## Komponenten

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

| Komponente | Pfad | Aufgabe |
|---|---|---|
| Gateway | [`gateway/`](../gateway) | Go-Server. Nimmt Seitenverbindungen an, hält den Live-Zustand der Geräte im Speicher, stellt den gehosteten MCP-Endpunkt, die REST-API der Konsole und deren Live-Updates bereit und führt das Audit-Log. Bettet Konsole und SDK ein, sodass ein einziges Binary der komplette Server ist |
| Seiten-SDK | [`sdk/`](../sdk) | `sdk.js`, von der Seite geladen oder von der App injiziert. Verantwortlich für Verbindung, Identität, die Oberfläche in der Seite, Zustimmungsdialoge und die Bildschirmsperre |
| Engine | [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine) | Die seitenseitige Hälfte jeder Agent-Aktion: Barrierefreiheits-Snapshots (Aria-Snapshot-Code von Playwright) und die darüber schwebenden Ebenen, Bedienbarkeitsprüfungen und synthetische Eingaben, Erfassung von Console und Netzwerk (auf Basis von [chobitsu](https://github.com/liriliri/chobitsu)), Screenshots, Maskierung, Prüfung der Zugriffsstufen |
| Konsole | [`console/`](../console) | React-Single-Page-App: Projekte und Integrations-Snippets, Geräte und ihre Zeitleisten, API-Keys, Mitglieder, Richtlinien, Einladungen, Audit-Log |
| Nativer Host | Ihre App; Referenz in [`examples/mock-app`](../examples/mock-app) | Injiziert das SDK bei Dokumentbeginn in jede WebView, verwaltet Geräte-ID und -Token, liefert echte Screenshots und optional native Freigabedialoge und Buttons |

## Eine Debugging-Sitzung

1. **Die Seite geht online.** Die Seite lädt `sdk.js` (oder die App injiziert es). Die Erfassung von Console, Fehlern und Netzwerk beginnt sofort, in begrenzten Puffern, sodass ein Agent, der sich später verbindet, auch sieht, was vorher geschah. `run()` öffnet eine WebSocket-Verbindung zum Gateway und sendet `hello`; das Gateway antwortet mit dem **Gerätecode** des Geräts (z. B. `K7Q2-9M4X`) und der Remote-Konfiguration des Projekts. Das Badge auf der Seite zeigt den Code.
2. **Jemand richtet den Agenten auf das Gerät.** Der Nutzer liest den Gerätecode vor, tippt auf **Unterstützung anfordern** (das Gerät steht dann in jeder Liste ganz oben) oder öffnet einen **Einladungslink** vom Support, der das Gerät bereits mit einer Unterstützungsanfrage online bringt.
3. **Der Agent verbindet sich.** Er ruft `connect_device` mit dem Code auf. Sofern das Projekt nichts anderes vorgibt, sieht der Nutzer auf dem Smartphone *KI bittet um Zugriff*, wählt eine Zugriffsstufe (Nur ansehen, Ansehen und bedienen, Erweitert) oder lehnt ab. Vorher ist nichts lesbar. Sobald der Agent verbunden ist, sperrt sich der Bildschirm gegen Eingaben des Nutzers, die Ränder leuchten und die untere Leiste zählt mit, wie lange die Verbindung schon besteht.
4. **Der Agent arbeitet.** Er erstellt einen Snapshot, um Element-Refs zu erhalten, und klickt, füllt aus und scrollt dann per Ref. Der Snapshot listet auch die Popups und Hintergrundebenen auf, die über der Seite schweben, jeweils mit eigener Ref, und ein Klick, den eine Ebene verdeckt, schlägt mit Name und Ref des verdeckenden Elements fehl – so kann der Agent auf einen Hintergrund tippen, um dessen Popup zu schließen, statt zu raten. Seine erste Aktion schaltet das Gerät von *observe* auf *agent*, und ein Agent-Cursor zeigt, wo er handelt. Je nach Zugriffsstufe kann er außerdem Console, Netzwerk, Speicher und Screenshots lesen.
5. **Der Nutzer behält das Sagen.** **Übernehmen** gibt die Seite an den Nutzer zurück und pausiert den Agenten (seine Aktionen schlagen mit `takeover` fehl, bis der Nutzer auf **Zurückgeben** tippt). **Beenden** trennt den Agenten. Klicks auf Elemente, die als sensibel markiert sind (Bestellung aufgeben, bezahlen, löschen), brauchen das OK des Nutzers auf dem Smartphone.
6. **Der Agent geht** mit `disconnect_device`; nach zwei Minuten ohne Aktionen fällt das Gerät auf *observe* zurück, und nach der maximalen Verbindungsdauer des Projekts (standardmäßig 60 Minuten) wird der Agent getrennt.

Eine Aktion, von Anfang bis Ende:

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

Jede Aktion ist ein einziger Roundtrip: Die Bedienbarkeitsprüfungen und das Auslösen der Ereignisse laufen in der Seite, nicht über das Netzwerk.

## Geräte, Seiten und Agenten

**Gerät.** Eine `deviceId`: ein Browserprofil oder, wenn ein nativer Host eine eigene ID übergibt, eine App-Installation. Das Gateway vergibt jedem Gerät einen dauerhaften Gerätecode. Geräte sind nicht an Projekte gebunden: Ein Smartphone, das Seiten aus zwei Projekten (zwei App-Keys) öffnet, ist ein Gerät mit Seiten aus beiden. Auch API-Keys sind nicht an Projekte gebunden, sodass ein MCP-Server jedes Gerät erreicht.

**Seite.** Ein Tab oder eine WebView, identifiziert durch eine `pageId`, die Neuladen und Navigationen in diesem Tab übersteht. Das Gateway benennt die Seiten pro Gerät `p1`, `p2`, …, hält fest, wer wen geöffnet hat, und verfolgt, welche Seite im Vordergrund ist. Eine Seite, deren Verbindung abbricht, behält ihre Bezeichnung zwei Minuten lang – lange genug, damit sich eine Navigation wieder verbinden kann –, aber nicht, wenn dasselbe Dokument an anderer Stelle wieder auftaucht: Eine WebView, die unter einer neuen `pageId` neu erstellt wird, ersetzt den alten Eintrag sofort, und eine getrennte Seite, deren URL auch eine andere verbundene Seite zeigt, wird nach 1,5 s entfernt. So hinterlässt eine neu erstellte WebView keinen Geistereintrag in der Seitenliste, und der Agent wird auf die Seite verschoben, die tatsächlich da ist.

**Zeitleiste.** Jedes Gerät hat eine Zeitleiste (im Speicher, die letzten 300 Ereignisse): geöffnete, navigierte, neu geladene, fokussierte und geschlossene Seiten; Fehler, fehlgeschlagene Requests und Taps des Nutzers; Unterstützungsanfragen, Freigaben und Kontrollwechsel. Jedes MCP-Tool-Ergebnis endet mit den Zeitleisteneinträgen, die der Agent noch nicht gesehen hat, sodass er neue Seiten, Fehler und Übernahmen ohne Polling bemerkt. Im **Folgemodus** (Standard) wechselt die ausgewählte Seite des Agenten zu einer Seite, die seine Aktion geöffnet hat, oder zu der Seite, zu der der Nutzer gewechselt ist.

**Agent.** Das Gateway führt pro API-Key einen Agent-Zustand: das Gerät, mit dem er verbunden ist, und seine ausgewählte Seite. Ein Agent ist jeweils mit einem Gerät verbunden, und ein Gerät hat höchstens einen Agenten; ein neu freigegebener Agent ersetzt den vorherigen.

**Kontrollzustand.** Jedes Gerät befindet sich in einem von vier Zuständen, die das Gateway festlegt und an alle seine Seiten verteilt:

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

In `observe` und `agent` sind die Eingaben des Nutzers blockiert (der Nutzer kann die Sperre im schwebenden Fenster ausschalten); in `user` kann der Agent weiterhin lesen, aber jeder interaktive Aufruf schlägt mit `takeover` fehl, und der Agent kann mit `wait_for_control` auf die Rückgabe warten.

## Zustimmung und Datenschutz

Der Leitsatz: **Ein API-Key oder die Kenntnis eines Gerätecodes reicht nie aus, um die Seite eines Nutzers zu sehen.** Mehrere voneinander unabhängige Prüfungen stehen zwischen einem Agenten und der Seite.

| Ebene | Was sie tut |
|---|---|
| API-Key | Jeder MCP-Request trägt einen. Keys haben eine maximale Zugriffsstufe, ein Ablaufdatum (standardmäßig 90 Tage) und optional eine IP-Zulassungsliste; wird ein Key widerrufen, wird sein Agent sofort getrennt. Fehlgeschlagene Gerätesuchen sind ratenbegrenzt, damit sich Gerätecodes nicht erraten lassen |
| Gerätecode | *Identifiziert* nur ein Gerät. Er gewährt nichts |
| Projektrichtlinie | `approval: prompt` (Standard für neue Projekte) verlangt die Freigabe durch den Nutzer; `maxLevel` begrenzt, was ein Agent tun darf. Hat ein Gerät Seiten aus mehreren Projekten, gilt die strengste Richtlinie |
| Freigabe durch den Nutzer | Das Smartphone zeigt den Namen des Agenten, den Key-Hinweis und die angebotenen Zugriffsstufen; der Nutzer wählt eine aus oder lehnt ab. Der Dialog liegt in einem Shadow DOM und reagiert nur auf echte (vertrauenswürdige) Taps, sodass sich ein Agent nicht selbst freigeben kann. Nach drei Ablehnungen ist der Key für 10 Minuten von diesem Gerät ausgesperrt. Nutzer können auf ihrem eigenen Gerät „Automatisch zulassen“ aktivieren. Ein Agent, der das Gerät selbst losgelassen hat (Trennen, Gerätewechsel, Verbindungsdauer aufgebraucht), darf innerhalb von 10 Minuten ohne neuen Dialog zurückkehren, höchstens mit der Zugriffsstufe, die der Nutzer zuvor gewährt hat; tippt der Nutzer auf **Beenden**, beendet ein Konsolenmitglied die Sitzung, lehnt der Nutzer ab oder wird der Key widerrufen, entfällt das |
| Zugriffsstufen | `observe` (Snapshot, Screenshot, Console, Netzwerkliste), `interact` (+ Klicken, Tippen, Scrollen, Navigieren…), `advanced` (+ JavaScript ausführen, Request-Bodys, Speicher). Die wirksame Stufe ist das Minimum aus der vom Agenten angefragten Stufe, der des Keys, der Richtlinie und der Wahl des Nutzers. **Das SDK setzt sie in der Seite erneut durch**, unabhängig vom Gateway |
| Sichtbare Kontrolle | Solange ein Agent verbunden ist, zeigt die Seite das an: ein Badge mit dem Zustand des Agenten, eine Aufgabenkarte mit seinem Plan, ein Agent-Cursor und eine Hervorhebung bei jeder Aktion, ein leuchtender Rand, während er arbeitet. Übernehmen, Zurückgeben und Beenden reagieren nur auf Taps des Nutzers; ein nativer Host muss ein Geheimnis (`nativeKey`) vorlegen, das Seiten-Scripts – auch die eigenen Scripts des Agenten – nicht lesen können |
| Sensible Aktionen | Ein Klick auf ein Element mit `data-rwd-confirm` (oder eines, das zu den `confirmSelectors` der Richtlinie passt) oder das Absenden eines Formulars, das ein solches enthält, wartet auf das OK des Nutzers auf dem Smartphone |
| Maskierung | Passwortfelder, Elemente mit `data-rwd-mask` sowie die Selektoren und Textmuster der Richtlinie (Telefon-, Karten-, Ausweisnummern…) werden **in der Seite** durch `••••` ersetzt, bevor irgendetwas das Gerät verlässt: in Snapshots, Screenshots, Console-Text, Netzwerk-URLs und -Bodys, Speicherwerten und Zeitleisten-Zusammenfassungen. Die Header `Cookie`, `Set-Cookie` und `Authorization` werden immer geschwärzt. Die `networkExclude`-Regeln der Richtlinie sind etwas anderes: Sie halten nur Rauschen (Schriftarten, die immer 404 liefern, Analytics-Beacons) aus den Listen heraus, die ein Agent liest, und ein Agent kann die ausgeblendeten Requests anfordern – sie sind also kein Datenschutzmechanismus |
| Nicht vertrauenswürdige Inhalte | Seiteninhalte, die an den Agenten gehen, werden als nicht vertrauenswürdige Daten verpackt und gekennzeichnet, damit in einer Seite platzierte Anweisungen nicht für die des Nutzers gehalten werden. Riskante Klicks beruhen auf der Bestätigung durch den Nutzer, nicht auf dem Urteil des Agenten |
| Sitzungsprotokoll | Wird auf dem Gerät aufgezeichnet und nirgendwohin gestreamt: Zum Lesen ist wie bei jedem anderen Lesezugriff `observe` nötig, für Header und Bodys fehlgeschlagener Requests `advanced`. Die Maskierungsregeln greifen bereits beim Aufzeichnen, sodass der Wert eines maskierten Felds als `••••` gespeichert und nicht erst später maskiert wird. Ein Projekt kann das Protokoll abschalten und das Gespeicherte löschen lassen |
| Audit | Anmeldungen, Änderungen an Keys und Mitgliedern, Verbindungsanfragen und -entscheidungen, jeder RPC (Methode, Seite, Latenz, Ergebnis), Übernahmen und Beendigungen durch den Nutzer sowie abgelehnte Aufrufe. Niemals Seiteninhalte oder Parameterwerte |

Was das Smartphone verlässt: die Gerätemetadaten in `hello` (User-Agent, `userId`, falls die Seite eine angibt, App-Name und -Version, URLs und Titel der Seiten) und kurze Zeitleisten-Zusammenfassungen, ab dem Aufruf von `run()`; alles andere nur, wenn ein verbundener Agent danach fragt. Das Gateway speichert keine Seiteninhalte: Snapshots, Screenshots und Logs werden an den Agenten durchgereicht, und Zeitleisten liegen im Speicher. Das Sitzungsprotokoll wird auf dem Gerät aufgezeichnet, unter denselben Maskierungsregeln, und bleibt dort, bis ein verbundener Agent es liest (siehe **Speicherung** unten).

Bekannte Grenzen, offen ausgesprochen:

- Eingaben sind synthetisch: Ereignisse haben `isTrusted: false`, und Seiten, die das prüfen, reagieren nicht darauf.
- Mit `interact` kann der Agent zu jeder beliebigen `http(s)`-URL navigieren; das ist nicht auf die Origins des Projekts beschränkt.
- `advanced` führt beliebiges JavaScript in der Seite aus. Auf das, was ein solches Script zurückgibt, kann keine Maskierung angewendet werden; belassen Sie `maxLevel` also auf `interact`, sofern Sie es nicht brauchen.
- Die Netzwerkerfassung umfasst Requests, die die Seite nach dem Laden des SDK aus JavaScript heraus stellt (fetch, XHR, WebSocket, sendBeacon, EventSource). Bilder, Scripts, Stylesheets und Requests aus nativem Code sind nicht sichtbar. Inhalte in iframes sind nicht Teil der Snapshots.
- Geht eine App in den Hintergrund, pausiert das Betriebssystem ihre WebViews, und das Gerät ist offline, bis sie zurückkehrt.
- Breakpoints, schrittweises Debuggen, Profiling und Heap-Snapshots sind nicht vorgesehen; verwenden Sie dafür den Safari Web Inspector oder `chrome://inspect` mit einer debugfähigen WebView.

## Speicherung

Das Gateway verwendet standardmäßig **SQLite** (reines Go, kein CGO; eine Datei, festgelegt durch `RWD_DATA`) oder **Postgres**, wenn `RWD_DATABASE_URL` eine `postgres://`-URL ist. Das Schema wird beim Start angelegt und migriert.

| Dauerhaft (Datenbank) | Nur im Speicher (geht beim Neustart verloren) |
|---|---|
| Projekte und ihre Richtlinien, App-Keys | Verbundene Seiten und ihre Bezeichnungen |
| Mitglieder (Passwörter als PBKDF2-SHA256), offene Mitgliedereinladungen | Kontrollzustand, offene Freigaben, verbundene Agenten |
| API-Keys (HMAC-SHA256-Hashes, Zugriffsstufen, Ablaufdatum, IP-Zulassungslisten) | Zeitleisten der Geräte |
| Bekannte Geräte: ID, Code, userId, User-Agent, App, zuerst und zuletzt gesehen, Hash des Geräte-Tokens | Zähler für Ratenbegrenzung |
| Geräteeinladungen (Token-Hashes), Audit-Log | |
| Einstellungen: der Key-Pepper und das Geheimnis zum Signieren von Sitzungen, beim ersten Start erzeugt | |

Nach einem Neustart verbinden sich die Seiten von selbst wieder (das SDK versucht es mit Backoff erneut) und behalten ihre Gerätecodes; Agenten verbinden sich neu. Der Live-Zustand lebt in einem einzigen Prozess; betreiben Sie also **eine Gateway-Instanz** pro Datenbank.

**Auf dem Smartphone, nicht auf dem Gateway.** Ein Speicher liegt bewusst außerhalb all dessen: das **Sitzungsprotokoll**, das das Seiten-SDK auf dem Gerät in IndexedDB schreibt (Datenbank `rwd-log`). Ab dem Start der App zeichnet es die besuchten Seiten auf, die Taps und Eingaben des Nutzers, die Aktionen des Agenten, Kontrollwechsel, Console-Ausgaben und jeden Request – fehlgeschlagene mit Headern und Bodys –, ob das Gateway erreichbar ist oder nicht. Dadurch kann ein Agent, der sich *nach* einem Bug verbindet, den ganzen Weg dorthin nachlesen, statt mit einem leeren Puffer zu beginnen. Es behält die letzten drei App-Starts mit jeweils bis zu 10 MB, und nichts davon erreicht das Gateway oder sonst jemanden, sofern nicht ein verbundener Agent mit `get_session_overview` / `get_session_log` danach fragt ([protocol.de.md §5.4](protocol.de.md#54-sitzungsprotokoll)). Ein Projekt kann es abschalten (`policy.sessionLog`), wodurch auch das bereits auf seinen Geräten Gespeicherte gelöscht wird, und eine einzelne Seite kann sich mit `run({ record: false })` davon ausnehmen.

## Sicherheitshinweise für Betreiber

- **Liefern Sie über HTTPS aus.** Seiten verbinden sich über `wss://`, das Konsolen-Cookie wird unter HTTPS als `Secure` markiert, und API-Keys werden in Headern übertragen. Das Docker-Compose-Setup in [deploy/platform](../deploy/platform/README.de.md) terminiert TLS mit Caddy oder steht hinter Ihrem eigenen Proxy.
- **Vertrauen Sie weitergeleiteten Headern nur hinter einem Proxy.** Mit `--trust-proxy` übernimmt das Gateway Client-IPs und seinen öffentlichen Host aus `X-Forwarded-For` / `X-Forwarded-Host`. Ohne vorgeschalteten Proxy könnte jeder sie fälschen und IP-Zulassungslisten und Ratenbegrenzungen umgehen.
- **Schützen Sie die Datenbank und ihre Backups.** Sie enthalten den Key-Pepper und das Sitzungsgeheimnis; damit lassen sich API-Key-Hashes offline prüfen und Konsolensitzungen fälschen.
- **Das Inhaber-Passwort.** `RWD_ADMIN_PASSWORD` setzt das Passwort des Inhabers bei jedem Start zurück, was zugleich als Kontowiederherstellung dient. Ist es bei einer neuen Datenbank nicht gesetzt, wird einmalig ein zufälliges Passwort im Log ausgegeben.
- **App-Keys sind öffentlich.** Sie erlauben nur, Seiten online zu bringen. Verwenden Sie `allowedOrigins`, damit andere Websites Ihren nicht verwenden; beachten Sie, dass `Origin` ein vom Browser durchgesetzter Header ist und Clients außerhalb des Browsers beliebige Werte senden können – deshalb schützen Geräte-Tokens (nicht App-Keys) bestehende Geräte.
- **Behandeln Sie API-Keys wie Passwörter.** Geben Sie jedem Agenten und jeder Person einen eigenen Key, mit der niedrigsten Zugriffsstufe, die ausreicht, einem Ablaufdatum und – für Server – einer IP-Zulassungsliste. Ein Widerruf wirkt sofort.
- **Pinnen Sie das SDK.** Für H5-Seiten bietet die Konsole ein Snippet an, das eine inhaltsadressierte SDK-URL mit Subresource Integrity lädt. Native Apps können `sdk.js` mitliefern, statt es zur Laufzeit herunterzuladen, sodass ein kompromittiertes Gateway ihnen keinen neuen Code unterschieben kann.
- **Schützen Sie die Metriken.** Setzen Sie `RWD_METRICS_TOKEN`, wenn `/v1/metrics` von außen erreichbar ist.
- Die Anmeldung an der Konsole ist ratenbegrenzt (10 Versuche pro Minute und IP), schreibende Requests erfordern einen eigenen CSRF-Header, und die Konsole kann nicht in Frames eingebettet werden.
