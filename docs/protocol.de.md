<!-- i18n-source: f8d7479861527272991767e64a8c5860621d75ed -->
[English](protocol.md) | [简体中文](protocol.zh-CN.md) | [繁體中文](protocol.zh-TW.md) | [日本語](protocol.ja.md) | [한국어](protocol.ko.md) | [Español](protocol.es.md) | [Français](protocol.fr.md) | Deutsch | [Português (Brasil)](protocol.pt-BR.md) | [Русский](protocol.ru.md) | [العربية](protocol.ar.md)

# RWD-Protokoll (v1)

Dieses Dokument ist der Vertrag zwischen dem Gateway ([`gateway/`](../gateway)), dem Seiten-SDK ([`sdk/`](../sdk), dessen Engine in [`packages/chobitsu/src/engine/`](../packages/chobitsu/src/engine) liegt), der Konsole ([`console/`](../console)) und MCP-Clients. Wenn sich das Protokoll ändert, wird zuerst dieses Dokument angepasst.

Den Gesamtüberblick (Komponenten, Einwilligungsmodell, Speicherung, Sicherheit) finden Sie in [architecture.de.md](architecture.de.md), die Integration in Apps in [native-integration.de.md](native-integration.de.md).

Konventionen:

- Die **Gateway-URL** ist `https://<host>/v1`, zum Beispiel `https://rwd.example.com/v1`. Alle Endpunkte liegen darunter; das SDK leitet sämtliche Adressen daraus ab.
- Überall JSON. Zeitstempel sind Unix-Epoch-**Millisekunden**.
- `Level` ist `"observe" | "interact" | "advanced"` (siehe [§6](#6-zugriffsstufen)).
- Felder, die hier nicht aufgeführt sind, ignoriert der Empfänger. Neue Felder sind immer optional, sodass ein älteres SDK mit einem neueren Gateway weiter funktioniert.

## Inhalt

1. [Endpunkte](#1-endpunkte)
2. [Bezeichner](#2-bezeichner)
3. [Seitenverbindung (WebSocket)](#3-seitenverbindung-websocket)
4. [Steuerungszustand](#4-steuerungszustand)
5. [Seiten-RPC](#5-seiten-rpc)
6. [Zugriffsstufen](#6-zugriffsstufen)
7. [Verbindungsfreigabe](#7-verbindungsfreigabe)
8. [Bestätigung sensibler Aktionen](#8-bestätigung-sensibler-aktionen)
9. [Presence-Polling als Fallback](#9-presence-polling-als-fallback)
10. [JavaScript-API für Hosts](#10-javascript-api-für-hosts)
11. [Projektrichtlinie](#11-projektrichtlinie)
12. [REST-API der Konsole](#12-rest-api-der-konsole)
13. [Live-Updates (SSE)](#13-live-updates-sse)
14. [MCP](#14-mcp)
15. [Sprachen](#15-sprachen)
16. [Betrieb](#16-betrieb)

## 1. Endpunkte

| Pfad | Beschreibung |
|---|---|
| `GET /v1/sdk.js` | Seiten-SDK (eine IIFE, die das globale `RemoteWebviewDebugger` bereitstellt). `Cache-Control: max-age=300`, `Access-Control-Allow-Origin: *` |
| `GET /v1/sdk/<version>/sdk.js` | Dieselbe Datei unter einer unveränderlichen, inhaltsadressierten URL (ein Jahr gecacht; mit SRI nutzbar). Jede andere `<version>` liefert 404. Siehe [§16](#16-betrieb) |
| `GET /v1/locales/<id>.js`, `GET /v1/sdk/<version>/locales/<id>.js` | Die bei Bedarf geladenen Sprachpakete des SDK, die `sdk.js` von seinem eigenen Ort nachlädt ([§15](#15-sprachen)). `Cache-Control: max-age=300` |
| `GET /v1/healthz` | `{"ok":true,"version":"…","db":"sqlite"\|"postgres"}` |
| `GET /v1/metrics` | Prometheus-Metriken ([§16](#16-betrieb)) |
| `WS /v1/page?key=<appKey>` | Seitenverbindung ([§3](#3-seitenverbindung-websocket)) |
| `POST /v1/presence` | Polling als Fallback, wenn der WebSocket keine Verbindung bekommt ([§9](#9-presence-polling-als-fallback)) |
| `/v1/api/…` | REST-API der Konsole ([§12](#12-rest-api-der-konsole)) |
| `/v1/mcp` | Gehosteter MCP-Server, Streamable HTTP, `Authorization: Bearer rwd_sk_live_…` ([§14](#14-mcp)) |
| `/demo/` | Statische Dateien aus `--demo-dir`, nur wenn konfiguriert |
| jeder andere Pfad | Single-Page-App der Konsole |

Unbekannte Pfade unter `/v1/` liefern `404 {"error":{"code":"not_found",…}}`. Alle Antworten tragen `X-Content-Type-Options: nosniff` und `Referrer-Policy: no-referrer`; alles außer dem SDK trägt außerdem `X-Frame-Options: DENY`.

## 2. Bezeichner

| Name | Format | Herkunft |
|---|---|---|
| App-Key | `rwd_pk_` + 24 Base62-Zeichen | Wird mit einem Projekt angelegt. Öffentlich: Er steht im Seitenquelltext und erlaubt einer Seite nur, online zu gehen |
| API-Key | `rwd_sk_live_` + 32 Base62-Zeichen | Wird in der Konsole angelegt und einmal angezeigt. Gespeichert als HMAC-SHA256 mit einem serverseitigen Pepper. Die Konsole zeigt die ersten 16 Zeichen (`prefix`, z. B. `rwd_sk_live_ab12`); Geräte sehen `"…"` plus die letzten 4 Zeichen des Präfixes (`keyHint`) |
| `deviceId` | UUID v4 (jedes `[A-Za-z0-9_-]{1,64}` wird akzeptiert) | Vom SDK erzeugt und im localStorage unter `rwd:device` gehalten, oder von einem nativen Host mit `run({ deviceId })` übergeben |
| Gerätecode | `XXXX-XXXX` über `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | Vom Gateway vergeben, wenn es eine `deviceId` zum ersten Mal sieht; ändert sich nie. Wenn sich ein Agent damit verbindet, spielen Groß-/Kleinschreibung, Bindestriche und Leerzeichen keine Rolle |
| `pageId` | 12 Base62-Zeichen (jedes `[A-Za-z0-9_-]{1,64}` wird akzeptiert) | Vom SDK erzeugt, im sessionStorage unter `rwd:page` gehalten: stabil über Neuladen und Navigationen im selben Tab, neu für jeden Tab |
| Seitenlabel | `p1`, `p2`, … | Vom Gateway pro Gerät vergeben; bleibt erhalten, solange sich die Seite innerhalb der 2-minütigen Karenzzeit wieder verbindet |
| Sitzungs-(Start-)ID | Die eigene Start-ID der Host-App (4–128 Zeichen aus `[A-Za-z0-9_.:-]`), sonst 16 Hex-Zeichen vom SDK | Ein Start der App, unter dem die Seite ihr Sitzungsprotokoll ablegt ([§5.4](#54-sitzungsprotokoll)). Wird nie an das Gateway gesendet, außer in einem `rwd.log`-Ergebnis |
| `ref` | `e12`, `o3`, … | `eN`: ein Element des letzten Snapshots der Seite, gültig bis zum nächsten Snapshot dieser Seite. `oN`: ein Element, für das der Snapshot keinen Knoten hat – ein Overlay oder was auch immer einen Klickpunkt verdeckt ([§5.3](#53-verhalten-in-der-seite)); es bleibt gültig, solange das Element in der Seite ist |
| Geräte-Token | 64 Hex-Zeichen | Einmal pro `deviceId` ausgestellt ([§3.5](#35-geräte-token-resume-token-und-einladungen)); das Gateway speichert nur einen Hash |
| Resume-Token | 32 Hex-Zeichen | Wird mit jedem `welcome` erneuert ([§3.5](#35-geräte-token-resume-token-und-einladungen)); als Hash gespeichert |

## 3. Seitenverbindung (WebSocket)

### 3.1 Lebenszyklus

1. Die Seite öffnet `wss://<host>/v1/page?key=<appKey>`. Vor dem Upgrade prüft das Gateway:
   - Ratenbegrenzung: 120 Verbindungen (und Presence-Aufrufe) pro Minute und Client-IP → `429 rate_limited`;
   - der App-Key existiert und sein Projekt ist nicht deaktiviert → sonst `401 bad_key`;
   - hat das Projekt `allowedOrigins`, muss der `Origin`-Header zu einem davon passen → sonst `403 origin_not_allowed`.
2. Nur Text-Frames, ein JSON-Objekt pro Frame. Eingehende Nachrichten dürfen bis zu 16 MiB groß sein (Screenshots kommen Base64-kodiert an).
3. Die Seite muss innerhalb von **5 Sekunden** `hello` senden. Ein fehlerhaftes `hello` (ungültiges JSON, falsches `t`, ungültige `deviceId` / `pageId`) wird mit `1008` geschlossen.
4. Das Gateway antwortet mit `welcome` ([§3.4](#34-welcome)) oder schließt mit einem Protokoll-Close-Code ([§3.6](#36-close-codes)).
5. Das Gateway sendet alle **25 Sekunden** `{"t":"hb"}` sowie einen WebSocket-Ping, der innerhalb von 10 Sekunden beantwortet werden muss. Das SDK verbindet sich neu, wenn es **60 Sekunden** lang nichts hört.
6. Neuverbindungen des SDK verwenden exponentielles Backoff von 1 s bis 30 s; jede Wartezeit wird zufällig aus der oberen Hälfte der aktuellen Stufe gewählt. Nach **3 aufeinanderfolgenden Versuchen, die vor einem `welcome` enden**, wechselt das SDK zum Presence-Polling ([§9](#9-presence-polling-als-fallback)).
7. Eine zweite Verbindung mit derselben `pageId` ersetzt die erste (geschlossen mit `1000 replaced`).
8. Eine Seite, deren Verbindung abbricht, behält ihr Label und ihren Platz für eine **Karenzzeit von 2 Minuten** (Navigationen verbinden sich deutlich früher neu). Danach ist sie in der Zeitleiste `closed`. Zwei Fälle verkürzen die Wartezeit, damit eine neu erzeugte WebView nicht als *verbindet neu* in der Seitenliste stehen bleibt:
   - eine Seite, die sich mit einer **neuen `pageId`** verbindet, entfernt sofort jede getrennte Seite, die dieselbe URL zeigt (das `#`-Fragment wird ignoriert);
   - eine getrennte Seite, deren URL auch eine **verbundene** Seite zeigt, wird stattdessen nach **1,5 s** entfernt.

   In beiden Fällen wandert die Auswahl, falls die entfernte Seite die ausgewählte Seite des Agents war, auf die lebende Seite, und das Ergebnis weist darauf hin ([§14.3](#143-tools)).
9. Das SDK schließt den Socket bei `pagehide` (damit die Seite in den Back/Forward-Cache kann) und verbindet sich bei `pageshow` neu.

Jede Verbindung hat eine Sendewarteschlange von 64 Nachrichten. Eine Seite, die nicht hinterherkommt, wird mit `1013 slow consumer` geschlossen, statt das Gateway auszubremsen.

### 3.2 Seite → Gateway

```jsonc
{"t":"hello","v":1,"sdk":"<SDK version>",
 "deviceId":"…","pageId":"…","openerId":"<pageId>"|null,
 "userId":"<string>"|null,
 "page":{"url":"…","title":"…","visibility":"visible"|"hidden"},
 "device":{"ua":"…","platform":"ios"|"android"|"web",
           "screen":{"w":393,"h":852,"dpr":3},
           "app":{"name":"…","version":"…"}|null},
 "help":false,
 "deviceToken":"<token>"|null,   // in aktuellen SDKs immer vorhanden, siehe §3.5
 "resume":"<token>"|null,        // das letzte Resume-Token, das diese pageId erhalten hat
 "invite":"<token>"|null}        // aus ?rwd_invite=…

{"t":"page","url":"…","title":"…","visibility":"visible"|"hidden"}   // bei Änderungen
{"t":"event","kind":"error"|"console_error"|"net_fail"|"user_tap","summary":"…","at":1730000000000}
{"t":"help","on":true}                                              // der Nutzer fordert Hilfe an / bricht ab
{"t":"control","action":"takeover"|"handback"|"end"}                // die Buttons des Nutzers, §4
{"t":"attach_decision","requestId":"…","level":"interact"|null}     // §7
{"id":17,"result":{…}}                                              // RPC-Erfolg, §5
{"id":17,"error":{"code":"not_found","message":"…"}}                // RPC-Fehler, §5
```

- `hello`: Das Gateway übernimmt `userId` (bis zu 128 Zeichen), `ua` (512), `platform` (16), `app`, `url` (2048) und `title` (256). `screen` dient nur zur Information.
- `event.summary` ist ein Satz für den Agent, bereits von maskierten Werten bereinigt, z. B. `TypeError: Cannot read properties of undefined (reading 'orderId')`, `POST /api/order → 405`, `Tapped button "Place order"`. Das Gateway trägt jede Art in die Zeitleiste ein (bis zu 300 Bytes) und ignoriert unbekannte Arten. Navigationen, auch solche innerhalb der Seite, sind keine Events: Das Gateway leitet sie aus `page`-Nachrichten ab (`navigated` in der Zeitleiste, [§12.9](#129-zeitleisten-ereignisse)); das SDK hält sie im Sitzungsprotokoll fest ([§5.4](#54-sitzungsprotokoll)).
- Das SDK dedupliziert Events (gleiche Art und Zusammenfassung innerhalb von 2 s) und sendet höchstens 30 pro 10 s. Events und Steuerungsaktionen, die offline auftreten, warten in einer Warteschlange (bis zu 100 Nachrichten) auf das nächste `welcome`.
- `help` und `control` werden nur bei Tippen des Nutzers gesendet (oder bei Aufrufen des nativen Hosts, [§10](#10-javascript-api-für-hosts)).

### 3.3 Gateway → Seite

```jsonc
{"t":"welcome", …}                                            // §3.4
{"t":"control","state":"none"|"observe"|"agent"|"user",
 "agent":{"name":"Support Bot"}|null,"level":"interact"|null,
 "attachedMs":83000|null}                                     // §4, an jede Seite des Geräts
{"t":"help","on":false}                                       // Hilfe aufgehoben: ein Agent hat sich verbunden, ein Konsolenmitglied hat die Sitzung beendet oder der Nutzer hat sie auf dem Gerät beendet
{"t":"task","task":{"title":"…","steps":["…"],"current":0,"agent":"Support Bot"}|null}  // §14.3 set_task
{"t":"attach_request", …}                                     // §7, an die Seite im Vordergrund
{"t":"attach_cancel","requestId":"…"}                         // §7, an jede Seite
{"t":"hb"}
{"t":"reconnect","afterMs":1000}                              // reserviert: das SDK verbindet sich nach afterMs neu
{"id":17,"method":"rwd.snapshot","params":{}}                 // RPC-Anfrage, §5
```

`reconnect` versteht das SDK; das Gateway sendet es derzeit nicht.

### 3.4 `welcome`

```jsonc
{"t":"welcome",
 "deviceCode":"K7Q2-9M4X",
 "label":"p1",
 "help":false,
 "control":{"state":"none","agent":null,"level":null,"attachedMs":null},
 "level":null,                       // wie control.level
 "resume":"<new resume token>",
 "deviceToken":"<token>",            // nur wenn von diesem welcome ausgestellt
 "config":{"helpButton":false,"maskSelectors":[],"maskPatterns":[],
           "confirmSelectors":[],"networkExclude":[],"sessionLog":true,
           "eruda":{"dock":false,"load":false}},   // oder null, siehe unten
 "agentLang":"en",                   // die Sprache des Gateways: "en", "zh", "zh-TW", "fr"…, §15
 "task":{…}}                         // nur solange der verbundene Agent eine gesetzt hat
```

`config` ist die Remote-Konfiguration aus der Richtlinie des Projekts, dessen App-Key die Seite verwendet hat ([§11](#11-projektrichtlinie)). `config.helpButton` ist für die `userId` dieser Seite bereits aufgelöst (`all`, oder `listed` und der Nutzer steht auf der Liste). `config.networkExclude` wird zu den Regeln hinzugefügt, die die Seite selbst an `run({ networkExclude })` übergeben hat ([§10](#10-javascript-api-für-hosts)). `config.sessionLog` ist der Schalter des Projekts für das Sitzungsprotokoll; `false` beendet die Aufzeichnung und löscht, was dieser Origin bereits gespeichert hat ([§5.4](#54-sitzungsprotokoll)). `config.eruda` ist die eruda-Richtlinie des Projekts ([§11](#11-projektrichtlinie)); sie kann auch `null` sein oder fehlen (ein Gateway oder eine gespeicherte `config` aus der Zeit vor diesem Feld), was das SDK als `{"dock":false,"load":false}` liest, und das eigene `run({ eruda })` der Seite gewinnt weiterhin Feld für Feld ([§10](#10-javascript-api-für-hosts)). Das SDK hält die letzte `config` im localStorage unter `rwd:cfg` und wendet sie auf der nächsten Seite an, bis deren `welcome` eintrifft.

Ist eine Verbindungsanfrage offen und ist die sich neu verbindende Seite die Vordergrundseite des Geräts, sendet das Gateway den `attach_request` direkt nach dem `welcome` erneut.

### 3.5 Geräte-Token, Resume-Token und Einladungen

**Geräte-Token.** Wenn das Gateway eine `deviceId` zum ersten Mal von einem tokenfähigen SDK sieht, stellt es in `welcome.deviceToken` ein Geräte-Token aus (32 Zufallsbytes, hex; gespeichert wird nur ein Hash). Von da an muss jede Seite dieses Geräts es in `hello.deviceToken` vorlegen; bei fehlendem oder falschem Token wird mit **4401** geschlossen. Eine `deviceId` und den öffentlichen App-Key zu kennen reicht also nicht, um sich in das Gerät eines anderen einzuklinken.

- Das SDK speichert das Token im localStorage unter `rwd:dtoken` und stellt es als `status().deviceToken` bereit. localStorage gilt pro Origin; ein nativer Host, der mehrere Domains lädt, verwahrt das Token deshalb selbst und gibt es mit `run({ deviceToken })` zurück ([native-integration.de.md](native-integration.de.md)).
- Ein hello mit einem `deviceToken`-Feld (auch `null`) gilt als tokenfähig. Ein hello ohne das Feld stammt von einem SDK, das kein Token verwahren kann; das Gateway stellt ihm keines aus (das würde die späteren Seiten des Geräts aussperren), aber sobald ein Gerät ein Token hat, muss jede Seite es vorlegen.

**Resume-Token.** Jedes `welcome` enthält ein neues `resume`-Token, das an die `pageId` gebunden ist. Wenn sich eine Seite mit bekannter `pageId` neu verbindet, muss ihr `hello.resume` mit dem zuletzt ausgestellten übereinstimmen, sonst wird die Verbindung mit **4409** geschlossen und das SDK beginnt mit einer neuen `pageId` von vorn. Eine `pageId` zu kennen reicht also nicht, um sich als eine Seite auszugeben.

**Einladung.** Trägt die Seiten-URL `?rwd_invite=<token>`, entfernt das SDK den Parameter aus der Adressleiste (`history.replaceState`), hält das Token im sessionStorage und sendet es in `hello.invite`, bis ein `welcome` eintrifft. Das Gateway akzeptiert es, wenn die Einladung zum selben Projekt gehört, unbenutzt und nicht abgelaufen ist: Das Gerät wird als `invited` markiert und bittet um Hilfe, die Zeitleiste vermerkt, über welche Einladung es kam, und die Einladung ist verbraucht. Ungültige Einladungen werden stillschweigend ignoriert. Siehe [§12.6](#126-geräteeinladungen).

### 3.6 Close-Codes

| Code | Bedeutung | Reaktion des SDK |
|---|---|---|
| `1008` | Fehlerhaftes `hello` | Neu verbinden mit Backoff |
| `1013` | Die Seite kam mit ihrer Sendewarteschlange nicht hinterher | Neu verbinden mit Backoff |
| `4401` | Geräte-Token fehlt oder ist falsch | Hat sich das gespeicherte Token inzwischen geändert (ein anderer Tab hat es gerade erhalten), sofort erneut versuchen; sonst Zustand `rejected`, neuer Versuch nach etwa 10 Minuten |
| `4409` | Resume-Token stimmt nicht überein | Neue `pageId`, neu verbinden |
| `4429` | Das Kontingent des Projekts für Online-Geräte (`maxOnlineDevices`) ist erreicht | Zustand `quota`, neuer Versuch nach etwa 5 Minuten |

## 4. Steuerungszustand

Jedes Gerät hat genau einen Steuerungszustand, den das Gateway festlegt und mit einer `control`-Nachricht an alle Seiten des Geräts sendet.

| Zustand | Bedeutung | Oberfläche der Seite |
|---|---|---|
| `none` | Kein Agent verbunden | Eingeklappter Badge mit dem Gerätecode (plus der Hilfe-Button, wenn aktiviert) |
| `observe` | Ein Agent ist verbunden und sieht nur zu | „KI sieht zu“, die Eingaben des Nutzers sind blockiert (sofern der Nutzer die Sperre nicht ausgeschaltet hat), leuchtender Bildschirmrand, Buttons **Übernehmen** und **Beenden** |
| `agent` | Der Agent bedient die Seite | „KI arbeitet“, dieselbe Sperre, derselbe Rand und dieselben Buttons, dazu der Cursor des Agents |
| `user` | Der Nutzer hat übernommen | Keine Sperre, ein statischer Rand, Buttons **Zurückgeben** und **Beenden** |

Übergänge:

| Auslöser | Änderung |
|---|---|
| Ein Agent verbindet sich ([§7](#7-verbindungsfreigabe)) | `none` → `observe` |
| Der Agent ruft ein interaktives Tool auf (click, fill, type, press, select, hover, scroll, drag, navigate, back, reload) | `observe` → `agent`. In `user` lehnt das Gateway mit dem Fehler `takeover` ab, ohne die Seite zu kontaktieren |
| Keine Interaktion während `policy.agentIdleMinutes` (Standard 2; alle 10 s geprüft) | `agent` → `observe` |
| Die Seite sendet `control: takeover` | `observe` / `agent` → `user` |
| Die Seite sendet `control: handback` | `user` → `agent` (oder `none`, wenn kein Agent verbunden ist) |
| Die Seite sendet `control: end` | Der Agent wird getrennt und die Hilfeanfrage aufgehoben → `none` |
| Der Agent trennt die Verbindung oder wird ersetzt, sein Key wird widerrufen, `policy.attachMaxMinutes` (Standard 60) läuft ab, oder ein Konsolenmitglied beendet die Sitzung | → `none` |

Die Seite sperrt ab dem Moment, in dem sich ein Agent verbindet (`observe`), nicht erst, wenn er handelt, und bleibt auch beim Leerlauf-Übergang `agent` → `observe` gesperrt, bis der Nutzer übernimmt oder der Zustand auf `none` zurückgeht.

`attachedMs` gibt an, wie lange der verbundene Agent zum Zeitpunkt, an dem das Gateway die Nachricht gesendet hat, bereits verbunden ist, in Millisekunden (`null` ohne Agent). Es ist eine Dauer, damit die Seite keine mit dem Gateway gemeinsame Uhr braucht; die untere Leiste zeigt sie in `observe`, `agent` und `user` als laufenden Timer „Verbunden · 01:23“ an, und „Verbindet…“, solange die eigene Verbindung der Seite unterbrochen ist. Bei einem Gateway ohne dieses Feld zählt das SDK ab dem Moment, in dem die Seite den Agent zum ersten Mal gesehen hat.

Als zweite Prüfung lehnt auch das SDK interaktive RPCs mit `takeover` ab, solange der Nutzer die Steuerung hat. Es merkt sich den Zustand (und wann sich der Agent verbunden hat) für 2 Minuten im localStorage unter `rwd:ctl`, sodass die nächste Seite nach einer Navigation sofort sperrt, mit laufendem Timer, statt auf ihr `welcome` zu warten. Übernehmen, Zurückgeben und Beenden reagieren nur auf echtes (trusted) Tippen des Nutzers; ein Agent kann sie nicht drücken, und ein nativer Host muss den `nativeKey` vorlegen ([§10](#10-javascript-api-für-hosts)).

## 5. Seiten-RPC

### 5.1 Nachrichtenformat

Das Gateway sendet `{"id":<n>,"method":"rwd.…","params":{…}}` an eine Seite; die Seite antwortet mit `{"id":<n>,"result":{…}}` oder `{"id":<n>,"error":{"code":"…","message":"…"}}`. IDs sind pro Verbindung eindeutig. Bricht die Verbindung ab, schlagen offene Aufrufe sofort fehl.

Timeouts auf Seite des Gateways: 20 s für MCP-Aufrufe, 45 s für `rwd.click`, `rwd.press` und `rwd.type` mit `submit: true` (der Nutzer wird eventuell um Bestätigung gebeten, [§8](#8-bestätigung-sensibler-aktionen)), 15 s für den Verbindungstest der Konsole.

Fehlercodes:

| Code | Bedeutung |
|---|---|
| `not_found` | Veraltete `ref` oder Element verschwunden, unbekannte Option, unbekannte Anfrage-ID |
| `not_interactable` | Nicht sichtbar, deaktiviert, verdeckt, schreibgeschützt oder nicht innerhalb von 5 s stabil |
| `timeout` | Eine Wartezeit ist abgelaufen (in der Seite oder am Gateway) |
| `takeover` | Der Nutzer hat die Steuerung |
| `forbidden` | Über der gewährten Stufe ([§6](#6-zugriffsstufen)), oder der Nutzer hat eine Bestätigung abgelehnt |
| `bad_request` | Fehlender oder ungültiger Parameter, unbekannte Methode |
| `internal` | Alles andere (die Nachricht enthält den JavaScript-Fehler) |

Vom SDK verfasste Meldungen sind in der Sprache des Agents (`welcome.agentLang`, [§15](#15-sprachen)).

### 5.2 Methoden

Jede Methode wirkt auf die Seite, die sie empfängt.

| Methode | Stufe | params | result |
|---|---|---|---|
| `rwd.ping` | observe | `{}` | `{"at":<ms>}` |
| `rwd.snapshot` | observe | `{}` | `{"url","title","snapshot"}`: ein Barrierefreiheits-Snapshot im AI-Format von Playwright (YAML, Elemente mit `[ref=eN]` markiert), gefolgt von einem Overlay-Abschnitt, wenn etwas über der Seite schwebt ([§5.3](#53-verhalten-in-der-seite)) |
| `rwd.query` | observe | `{"text"?,"role"?,"name"?,"limit"?:20}` (mindestens ein Kriterium; `limit` 1–100) | `{"matches":[{"ref","role","name","text"}],"total"}` |
| `rwd.screenshot` | observe | `{"format"?:"jpeg"\|"png"\|"webp","quality"?:80,"fullPage"?:false,"ref"?}` | `{"data":"<base64>","mimeType","source":"native"\|"dom","width","height"}` |
| `rwd.console` | observe | `{"sinceId"?,"limit"?:100,"types"?:["error","warn"]}` | `{"messages":[{"id","type","text","at","source"?}],"dropped"}` |
| `rwd.network` | observe | `{"sinceId"?,"limit"?:100,"failedOnly"?:false,"exclude"?:[],"includeExcluded"?:false}` | `{"requests":[{"id","method","url","status","type","durationMs","size","error"?,"at"}],"dropped","hidden"}` |
| `rwd.waitFor` | observe | `{"text"?,"textGone"?,"timeMs"?,"timeoutMs"?:10000}` | `{}` |
| `rwd.log` | observe | `{"op":"sessions"\|"overview"\|"records", …}`, siehe [§5.4](#54-sitzungsprotokoll) | Hängt von `op` ab |
| `rwd.click` | interact | `{"ref","button"?:"left","clickCount"?:1}` | `{}` |
| `rwd.hover` | interact | `{"ref"}` | `{}` |
| `rwd.fill` | interact | `{"ref","value"}` | `{}` |
| `rwd.type` | interact | `{"text","ref"?,"submit"?:false}` | `{}` |
| `rwd.press` | interact | `{"key"}`: Tastennamen von Playwright, Kombinationen wie `Control+A` | `{}` |
| `rwd.select` | interact | `{"ref","values":["…"]}` | `{"selected":["…"]}` |
| `rwd.scroll` | interact | `{"ref"?,"dx"?:0,"dy"?:0}` | `{}` |
| `rwd.drag` | interact | `{"fromRef","toRef"}` | `{}` |
| `rwd.navigate` | interact | `{"url"}` | `{}` (danach verbindet sich die Seite neu) |
| `rwd.back` / `rwd.reload` | interact | `{}` | `{}` |
| `rwd.evaluate` | advanced | `{"function":"() => …","args"?:[]}` | `{"value":<JSON>}` |
| `rwd.networkDetail` | advanced | `{"id"}` | `{"request":{"headers","body"?},"response":{"headers","body"?}}` |
| `rwd.storage` | advanced | `{"area":"local"\|"session"\|"cookie"}` | `{"entries":[{"key","value"}]}` |
| `rwd.logDetail` | advanced | `{"seq"}` | Ein Eintrag des Sitzungsprotokolls vollständig: `{"seq","session","at","kind","page","imp","size","data"}`, einschließlich Header und Bodys ([§5.4](#54-sitzungsprotokoll)) |

Details:

- `rwd.query` vergleicht `role` exakt (ohne Beachtung der Groß-/Kleinschreibung) und `name` / `text` als Teilstrings ohne Beachtung der Groß-/Kleinschreibung; `text` umfasst den eigenen Text eines Elements und den seiner Nachfahren, und nur der innerste Treffer wird zurückgegeben.
- `rwd.fill` funktioniert bei Texteingaben, Textareas und `contenteditable`-Elementen (ein `<label>` wird auf sein Steuerelement umgelenkt). Es setzt den Wert über den nativen Setter und löst `input` und `change` aus, sodass kontrollierte Eingabefelder in React und Vue die Änderung mitbekommen. Für ein `<select>` ist `rwd.select` nötig.
- `rwd.type` fokussiert `ref` (Cursor am Ende), wenn angegeben, und tippt sonst in das fokussierte Element; `submit: true` drückt danach Enter.
- `rwd.select` vergleicht jeden Wert mit dem Value, Label oder Text einer Option. Mehrere Werte erfordern ein `multiple`-Select.
- `rwd.scroll` ohne `ref` scrollt die Seite; mit `ref` löst es ein Wheel-Event am Element aus und scrollt dessen scrollbaren Vorfahren. Scrollvorgänge werden über etwa 0,3 s animiert, damit der Nutzer folgen kann.
- `rwd.navigate` akzeptiert nur absolute oder relative `http(s)`-URLs. Navigation, Zurück und Neuladen erfolgen 50 ms nach dem Senden der Antwort.
- `rwd.waitFor` schläft zunächst `timeMs` (höchstens 60 s) und prüft dann alle 100 ms den sichtbaren Text (`document.body.innerText`), bis `text` erscheint und `textGone` verschwindet, oder schlägt nach `timeoutMs` mit `timeout` fehl.
- `rwd.screenshot` nutzt die native Aufnahme der Host-App, wenn eine registriert ist und der Bereich im Viewport liegt (`source: "native"`), und rendert sonst das DOM neu (`source: "dom"`; Canvas, Video und Cross-Origin-Bilder können leer sein). `ref` schneidet auf das Element zu; `fullPage` erfasst das ganze Dokument. Siehe [§10](#10-javascript-api-für-hosts).
- `rwd.console` / `rwd.network` mit `sinceId` liefern die ältesten `limit` Einträge danach, ohne `sinceId` die neuesten `limit`. Laufende Anfragen haben `status: 0` und `durationMs: null`; `type` ist `xhr`, `fetch`, `websocket`, `beacon` oder `eventsource`.
- `rwd.network` lässt die Anfragen weg, auf die die Ausschlussregeln passen – das `networkExclude` des Projekts plus `run({ networkExclude })` ([§11](#11-projektrichtlinie)), plus `exclude` nur für diesen Aufruf –, und `hidden` zählt sie. `includeExcluded: true` liefert alle und lässt `hidden` bei 0. Ausgeschlossene Anfragen werden trotzdem aufgezeichnet, und `rwd.networkDetail` liefert sie weiterhin per ID.
- `rwd.networkDetail` schwärzt die Header `Cookie`, `Set-Cookie`, `Authorization` und `Proxy-Authorization`; Bodys werden maskiert und bei 64 KB abgeschnitten.
- `rwd.storage` liefert höchstens 500 Einträge, Werte werden bei 4000 Zeichen abgeschnitten. Cookies sind die für Skripte sichtbaren (nicht HttpOnly). Die SDK-eigenen `rwd:dtoken` und `rwd:resume` sind immer maskiert.
- `rwd.evaluate` wertet den Funktionsquelltext im globalen Scope der Seite aus und ruft ihn mit `this = window` auf; er darf ein Promise zurückgeben. Das Ergebnis wird JSON-sicher gemacht: `undefined` und Funktionen werden zu `null`, Elemente zu einer kurzen Tag-Beschreibung, Datumswerte zu ISO-Strings, Zyklen zu `"[Circular]"`.

### 5.3 Verhalten in der Seite

- **Bedienbarkeit.** Zeigeraktionen warten (bis zu 5 s), bis das Element eingehängt, sichtbar, über zwei Animation-Frames stabil, aktiviert und in den sichtbaren Bereich gescrollt ist und ein Hit-Test am Zielpunkt auf dem Element oder einem Nachfahren landet. Zuerst wird die sichtbare Mitte des Elements versucht, wie bei einem Finger; ist sie verdeckt, werden die anderen Punkte eines 3×3-Rasters innerhalb seiner sichtbaren Box versucht, sodass ein Badge über einem Button den Klick nicht blockiert. Sind alle Punkte verdeckt, schlägt der Aufruf mit `not_interactable` und einer Meldung fehl, die das verdeckende Element und seine `ref` nennt (*der Klickpunkt ist von `<div.popup-mask>` verdeckt (ref=o1; klicken Sie es direkt an…)*), die der Agent stattdessen anklicken kann. Der Hit-Test überspringt die eigene Oberfläche des SDK und andere Debugging-Tools (`.__chobitsu-hide__`, `#eruda`, `#__pageSpy`, `#__vconsole`).
- **Overlays.** Ein Snapshot endet mit einem `[Overlays]`-Abschnitt, wenn Ebenen über der Seite schweben: der Hintergrund eines Popups, ein Modal, ein Bottom Sheet. Sie werden gefunden, indem einige Punkte des Viewports per Hit-Test geprüft werden und alles behalten wird, was in einer festen (oder viewportgroßen absoluten) Box liegt, die mindestens 15 % des Viewports bedeckt und nicht selbst die Hälfte der Elemente des Snapshots enthält (das wäre die eigene Wurzel der App, keine Ebene darüber). Jede Zeile nennt den Tag des Elements, einige Wörter seines (bereinigten) Texts, den Anteil des Viewports, den es bedeckt, und eine `ref`; eine Ebene ohne Text und ohne Medien wird als Hintergrund aufgeführt. Ein leerer Hintergrund hat keinen Knoten im Aria-Snapshot und bekommt deshalb eine `oN`-ref – so kann ein Agent auf einen Hintergrund tippen, um sein Popup zu schließen.
- **Synthetische Eingaben.** Ein Klick löst `pointerover/enter → pointerdown → mousedown → focus → pointerup → mouseup → click` aus, auf Touch-Geräten zusätzlich Touch-Events. Diese Events haben `isTrusted: false`; Seiten, die das prüfen, reagieren nicht.
- **Rückmeldung.** Das Ziel wird kurz hervorgehoben, und ein Agent-Cursor auf der Seite bewegt sich dorthin, bevor die Eingabe ausgelöst wird.
- **Maskierung.** Werte von `input[type=password]`, von Elementen mit `data-rwd-mask` und von den `maskSelectors` des Projekts werden in Snapshots und Screenshots durch `••••` ersetzt (native Screenshots erhalten graue Kästen darüber). Diese Werte und Text, der auf `maskPatterns` passt, werden außerdem in Console-Text, Netzwerk-URLs und -Bodys, Storage-Werten und Event-Zusammenfassungen ersetzt.
- **Umfang des Snapshots.** Der Snapshot beginnt bei `<body>`. Die Oberfläche des SDK lebt in einem Shadow DOM unter `<html>`, außerhalb von `<body>`; Knoten von eruda, PageSpy und vConsole werden aus dem Snapshot entfernt.
- **Puffer.** Console, nicht abgefangene Fehler und Netzwerk (XHR, fetch, WebSocket, sendBeacon, EventSource) werden ab dem Laden des SDK in Ringpuffern mit je 500 Einträgen aufgezeichnet. Ist ein Puffer voll, werden zuerst einfache Logs und erfolgreiche Anfragen verworfen; `dropped` zählt sie. Response-Bodys werden bis insgesamt 5 MB gecacht, je 64 KB.

### 5.4 Sitzungsprotokoll

Die Puffer aus [§5.3](#53-verhalten-in-der-seite) leben im Speicher einer einzelnen Seite. Das **Sitzungsprotokoll** ist die lange Fassung: alles, was auf diesem Origin seit dem Start der App passiert ist, von jeder Seite des Origins in **IndexedDB** (Datenbank `rwd-log`) geschrieben, ob das Gateway erreichbar ist oder nicht. Ein Agent, der sich erst hinterher verbindet, kann so den ganzen Weg zu einem Fehler nachlesen, über Neuladen und Seiten hinweg. Es verlässt das Gerät nie, es sei denn, ein verbundener Agent fragt danach.

**Eine Sitzung ist ein Start der App.** Die ID wird in dieser Reihenfolge ermittelt:

1. `run({ launchId })` – die eigene Start-ID der Host-App, bei jedem Kaltstart erzeugt und für jede WebView dieses Prozesses gleich;
2. `window.RWDLaunchId`, das der Host oder das Integrations-Snippet definieren kann: ein String oder eine Funktion, die einen String zurückgibt (oder ein Promise darauf, auf das höchstens 300 ms gewartet wird);
3. vom SDK abgeleitet: ein Session-Cookie `rwd_launch` (ohne Ablaufdatum, es stirbt also mit dem App-Prozess) plus ein Heartbeat alle 10 s. Eine Cookie-Sitzung, die länger als **1 Stunde** still war, gilt als früherer Start, und eine neue ID wird begonnen; das erfasst WebViews, die Session-Cookies über Starts hinweg behalten.

Die `source` einer Sitzung sagt, welcher Fall es war: `app` für 1 und 2, `cookie` für 3.

**Was aufgezeichnet wird.** Jeder Eintrag hat `seq` (den Schlüssel, aufsteigend), `at`, `kind`, `page` (die `pageId` der schreibenden Seite) und `data`:

| `kind` | `data` |
|---|---|
| `page` | `event: "open"` (url, title, referrer), `"nav"` (from, url, title – einschließlich Navigationen innerhalb der Seite), `"visibility"` (Vordergrund / Hintergrund), `"hide"` (die Seite ist verschwunden) |
| `action` | Die eigenen (trusted) Eingaben des Nutzers: `"tap"` (die Beschreibung des Elements), `"input"` (Feldbeschreibung und Wert), `"submit"`, `"scroll"` (wo das Scrollen zur Ruhe kam). Der Wert eines Passwortfelds, eines `data-rwd-mask`-Elements oder eines `maskSelectors`-Treffers wird als `••••` gespeichert, nie im Klartext; andere Werte werden mit `maskPatterns` bereinigt und bei 200 Zeichen abgeschnitten |
| `agent` | Die interaktiven Aufrufe des Agents und `rwd.evaluate`: Methode, `ref`, Taste, url, Werte, Text und der Fehler, falls er fehlschlug. Lesezugriffe (Snapshots, Listen) werden weggelassen |
| `control` | Änderungen des Steuerungszustands mit dem Namen des Agents ([§4](#4-steuerungszustand)) |
| `console` | Jede Stufe, mit `type`, `text` und `source` |
| `net` | Jede abgeschlossene Anfrage: Methode, url, Status, Typ, Dauer, Größe, Fehler. Eine **fehlgeschlagene** trägt zusätzlich `reqHeaders` / `resHeaders` (geschwärzt wie in `rwd.networkDetail`) und `reqBody` / `resBody`, jeweils bei 64 KB abgeschnitten |

Console-Fehler und -Warnungen, fehlgeschlagene Anfragen, das Tippen, die Eingaben und Absendevorgänge des Nutzers, Aktionen des Agents und Steuerungsänderungen werden als wichtig markiert und am längsten aufbewahrt. *Probleme*, die `problems` und `overview` auswählen, sind Console-Fehler und fehlgeschlagene Anfragen.

**Grenzen.** Die letzten **3** Starts werden aufbewahrt, jeder mit höchstens **10 MB**. Darüber werden zuerst die ältesten unwichtigen Einträge (einfache Console-Logs, erfolgreiche Anfragen) verworfen, dann die ältesten überhaupt, bis auf 80 % der Obergrenze; `trimmed` zählt sie. Meldet `navigator.storage.estimate()` ein Kontingent unter 64 MB, wird nur der aktuelle Start aufbewahrt. Ohne IndexedDB (in manchen privaten Modi) wird nichts aufgezeichnet, und `rwd.log` schlägt mit `internal` fehl.

**Auslesen.** `rwd.log` nimmt ein `op` entgegen:

```jsonc
// op: "sessions" → jeder noch gespeicherte Start, neueste zuerst
{"sessions":[{"id","source":"app"|"cookie","startedAt","lastAt","bytes","trimmed",
              "counts":{"page","action","agent","control","console","error","net","netFail"},
              "current":true}]}

// op: "overview", params {"session"?} → ein Start auf einen Blick
{"session":{…meta…,"current":true},"first":<ms>,"last":<ms>,
 "pages":[{"at","page","data"}],      // Einträge page open / nav, die letzten 60
 "problems":[…records…]}              // Console-Fehler und fehlgeschlagene Anfragen, die letzten 20

// op: "records", params {"session"?,"kinds"?:["page","action","agent","control","console","net"],
//                       "problems"?:false,"page"?:"<pageId>","text"?,"after"?:<seq>,
//                       "from"?,"to"?,"limit"?:100,"exclude"?:[],"includeExcluded"?:false}
{"session":"…","records":[{"seq","at","kind","page","data"}],
 "next":<seq>|null,                   // als `after` für die nächste Seite übergeben
 "hidden":0}                          // Anfragen, die die Netzwerk-Ausschlussregeln verborgen haben (§11)
```

- `session` ist standardmäßig der aktuelle Start (`"current"` bedeutet dasselbe); eine unbekannte ID schlägt mit `not_found` fehl. Zeichnet kein Start auf, wird der neueste gespeicherte verwendet.
- `problems: true` behält nur Console-Fehler und fehlgeschlagene Anfragen. `text` ist ein Teilstring der `data` des Eintrags, ohne Beachtung der Groß-/Kleinschreibung. `limit` ist 1–500, Standard 100.
- Einträge kommen **ohne** Header und Bodys zurück; `data.hasBody` ist `true`, wo ein Body existiert. `rwd.logDetail` liefert diesen einen Eintrag vollständig und erfordert `advanced` ([§6](#6-zugriffsstufen)), wie `rwd.networkDetail`.
- Die Netzwerk-Ausschlussregeln gelten auch hier: Ein `net`-Eintrag, auf den die Regeln passen, wird aus `records` weggelassen und in `hidden` gezählt, sofern `includeExcluded` nicht gesetzt ist.

**Ausschalten.** `run({ record: false })` hält eine einzelne Seite vom Schreiben ab. `policy.sessionLog: false` ([§11](#11-projektrichtlinie)) erreicht die Seiten als `welcome.config.sessionLog`, beendet die Aufzeichnung **und löscht die für den Origin bereits gespeicherten Protokolle**. `status().logSession` ist die Sitzungs-ID, in die eine Seite schreibt, oder `null`, wenn sie nicht aufzeichnet.

## 6. Zugriffsstufen

| Stufe | Erlaubte Methoden |
|---|---|
| `observe` | `rwd.ping`, `rwd.snapshot`, `rwd.query`, `rwd.screenshot`, `rwd.console`, `rwd.network`, `rwd.waitFor`, `rwd.log` |
| `interact` | `observe` + `rwd.click`, `rwd.fill`, `rwd.type`, `rwd.press`, `rwd.select`, `rwd.hover`, `rwd.scroll`, `rwd.drag`, `rwd.navigate`, `rwd.back`, `rwd.reload` |
| `advanced` | `interact` + `rwd.evaluate`, `rwd.networkDetail`, `rwd.storage`, `rwd.logDetail` |

Die Stufe einer Verbindung ist

```
min(vom Agent angeforderte Stufe (Standard interact),
    maxLevel des API-Keys,
    maxLevel der zusammengeführten Projektrichtlinie,
    die vom Nutzer auf dem Gerät gewählte Stufe)
```

Beide Seiten setzen sie durch: Das Gateway lehnt Aufrufe oberhalb der Stufe ab (Fehler `forbidden`, Audit `policy.denied`), und das SDK prüft vor jeder Ausführung noch einmal gegen `welcome.level` / `control.level`. Unbekannte Methoden behandelt das Gateway als `advanced`. Sendet ein Gateway keine Stufe, obwohl ein Agent verbunden ist, nimmt das SDK `interact` an.

## 7. Verbindungsfreigabe

Wenn ein Agent `connect_device` aufruft, führt das Gateway die Richtlinien der Projekte zusammen, deren Seiten auf dem Gerät geöffnet sind ([§11](#11-projektrichtlinie)). Ist das zusammengeführte `approval` gleich `prompt`, muss der Nutzer auf dem Gerät zustimmen:

```jsonc
← {"t":"attach_request","requestId":"…",
   "agent":{"name":"Support Bot","keyHint":"…a91f"},
   "levels":["observe","interact"],   // angebotene Stufen, begrenzt durch Key und Richtlinie; die letzte ist die vom Agent angeforderte
   "expiresInSec":30}
→ {"t":"attach_decision","requestId":"…","level":"interact"}   // oder "level": null zum Ablehnen
← {"t":"attach_cancel","requestId":"…"}                         // Zeit abgelaufen, oder der Agent hat aufgegeben
```

- Die Anfrage geht an die **Vordergrundseite** des Geräts; `attach_cancel` geht an jede Seite.
- Kommt innerhalb von **30 Sekunden** keine Antwort, gilt das als Timeout. Der MCP-Aufruf wartet auf die Antwort.
- Wird derselbe API-Key auf demselben Gerät innerhalb von 10 Minuten **3-mal** abgelehnt, werden seine Anfragen an dieses Gerät **10 Minuten** lang ohne Rückfrage abgewiesen.
- Pro Gerät kann nur eine Anfrage offen sein.
- Der Dialog des SDK lebt in einem Shadow DOM, akzeptiert nur echtes (trusted) Tippen und wird erst 0,4 s nach dem Erscheinen scharf geschaltet, sodass sich ein Agent nicht selbst freigeben kann. Tabs desselben Origins teilen die Entscheidung über BroadcastChannel.
- Der Nutzer kann im schwebenden Fenster des SDK **Automatisch zulassen** mit einer Höchststufe einschalten; das SDK antwortet dann sofort mit der höchsten angebotenen Stufe innerhalb dieser Grenze und zeigt einen Hinweis an.
- Mit `run({ nativeApproval: true })` zeigt das SDK keinen Dialog. Stattdessen wird `status().pending` zu `{kind:"attach", requestId, agent:{name, keyHint}, levels, expiresAt}`, und der native Host antwortet mit `nativeDecide(nativeKey, requestId, level | null)`.
- Nach der Freigabe verbindet das Gateway den Agent (und ersetzt dabei einen eventuell anderen Agent auf dem Gerät), hebt die Hilfeanfrage auf (`{"t":"help","on":false}`) und sendet `{"t":"control","state":"observe","agent":{…},"level":"interact","attachedMs":0}` an alle Seiten; die Seite sperrt sofort ([§4](#4-steuerungszustand)).

Mit `approval: none` verbindet sich der Agent sofort mit der berechneten Stufe.

**Zurückkommen ohne erneute Rückfrage.** Ein Agent, der das Gerät selbst loslässt – mit `disconnect_device`, durch Verbinden mit einem anderen Gerät oder weil `policy.attachMaxMinutes` abläuft –, hinterlässt eine Freigabe: **10 Minuten** lang darf sich derselbe API-Key ohne Dialog auf dem Telefon wieder mit dem Gerät verbinden, mit **höchstens der Stufe, die der Nutzer zuvor gewährt hat** (wer nach einer `observe`-Freigabe `advanced` anfordert, bekommt also weiterhin `observe`). Sonst wird nichts gelockert: Key, Richtlinie und die eigene Anforderung des Agents begrenzen die Stufe weiterhin, und das Gerät muss eine verbundene Seite haben. Eine solche Verbindung wird neben dem üblichen `attach.start` als `attach.resume` im Audit-Log erfasst ([§12.7](#127-audit-log)), und die Seite sieht die gewöhnliche `control`-Nachricht, keinen `attach_request`.

Das Zurückkommen verbraucht die Freigabe nicht: Erneutes Loslassen startet ein frisches 10-Minuten-Fenster. Die Freigabe verfällt, wenn die Sitzung aus einem anderen Grund endet: Der Nutzer tippt auf dem Gerät auf **Beenden**, ein Konsolenmitglied beendet sie (`POST /devices/:id/end`), der API-Key wird widerrufen, ein anderer Agent verbindet sich mit dem Gerät und ersetzt diesen, oder der Nutzer lehnt eine Anfrage ab. Außerdem verfällt sie mit dem Gateway-Prozess, da sie nur im Speicher gehalten wird.

## 8. Bestätigung sensibler Aktionen

Bevor das SDK handelt, fragt es den Nutzer, wenn der Agent:

- auf ein Element klickt (`rwd.click`), das auf `[data-rwd-confirm]` oder die `confirmSelectors` der Richtlinie passt oder in einem solchen liegt;
- auf einem solchen Element Enter drückt (`rwd.press` oder `rwd.type` mit `submit: true`), oder in einem Formular, das eines enthält (nicht in einer Textarea oder einem Rich-Text-Editor).

Der Dialog lautet etwa *Die KI möchte „Bestellung aufgeben“ antippen. Zulassen?*, akzeptiert nur echtes (trusted) Tippen und läuft nach **30 Sekunden** ab. Eine Ablehnung oder ein Timeout lässt den RPC mit `{"code":"forbidden","message":"The user denied this action"}` fehlschlagen. Es kann immer nur eine Bestätigung offen sein; sie wird abgebrochen, wenn der Nutzer übernimmt, der Agent geht oder die Verbindung abbricht.

Mit `nativeApproval: true` wird `status().pending` zu `{kind:"confirm", requestId, action:'click "Place order"', expiresAt}`, und der Host antwortet mit `nativeDecide(nativeKey, requestId, "allow" | null)`. Eine offene Bestätigung hat in `status().pending` Vorrang vor einer offenen Verbindungsanfrage.

## 9. Presence-Polling als Fallback

Schlägt der WebSocket 3-mal hintereinander fehl, ruft das SDK stattdessen alle 60 Sekunden `POST /v1/presence` auf. Es sendet `Content-Type: text/plain` mit einem JSON-Body, sodass kein CORS-Preflight nötig ist; das Gateway antwortet mit `Access-Control-Allow-Origin: *`.

```jsonc
// Anfrage
{"key":"rwd_pk_…","deviceId":"…","pageId":"…","page":{…},"device":{…},
 "userId":null,"help":false,"deviceToken":"…"}
// Antwort
{"deviceCode":"K7Q2-9M4X","connect":false}
```

- Das Gateway verwendet `key`, `deviceId`, `userId`, `device.{ua, platform, app}`, `deviceToken` und `help`; `pageId` und `page` dienen nur zur Information. App-Key und Origin werden wie beim WebSocket geprüft, mit derselben Ratenbegrenzung.
- Ein Gerät, dem ein Geräte-Token ausgestellt wurde ([§3.5](#35-geräte-token-resume-token-und-einladungen)), muss es auch hier senden; andernfalls schlägt der Aufruf mit `401 bad_token` fehl, und am Gerät wird nichts aktualisiert. Ein Gerät ohne Token (ein älteres SDK) pollt weiterhin ohne.
- `help: true` markiert das Gerät als „bittet um Hilfe“, wie `hello.help`, sofern nicht bereits ein Agent verbunden ist.
- Ein pollendes Gerät gilt nach jedem Aufruf 90 Sekunden lang als online.
- `connect: true` weist die Seite an, den WebSocket jetzt zu öffnen. Das Gateway setzt es, wenn ein Agent `connect_device` oder `wait_for_device` für das Gerät aufruft.
- Als Sicherheitsnetz versucht das SDK außerdem bei jedem 5. Poll erneut den WebSocket.

## 10. JavaScript-API für Hosts

Das SDK stellt `window.RemoteWebviewDebugger` bereit. Seiten rufen `run()` auf; native Hosts injizieren das SDK und rufen `run()` mit zusätzlichen Optionen auf (siehe [native-integration.de.md](native-integration.de.md)).

```js
RemoteWebviewDebugger.run(gatewayUrl, appKey, {
  userId,                // string | null: der angemeldete Nutzer, sichtbar für Agents und die Konsole
  helpButton,            // zeigt den Button "Hilfe anfordern" (ODER-verknüpft mit dem helpButton der Richtlinie)
  app,                   // { name, version } der Host-App
  lang,                  // ein Sprach-Tag für die Oberfläche des Nutzers; Standard aus navigator.languages (§15)
  locales,               // zusätzliche Sprachpakete; messages: Überschreibungen pro Sprache (§15)
  theme,                 // 'auto' (Standard) | 'system' | 'light' | 'dark'
  style,                 // Farben, Schriften, Radien, z-index, Positionen als CSS-Properties --rwd-* (sdk/README.de.md)
  lockScreen,            // Eingaben blockieren, solange ein Agent verbunden ist (Standard true; der Nutzer kann es ändern)
  eruda,                 // true | { dock, load, src, name }: als Tab in eruda anzeigen
  networkExclude,        // Anfragen, die aus dem herausgehalten werden, was der Agent liest (§11)
  record,                // das Sitzungsprotokoll führen (Standard true; die Richtlinie kann es abschalten, §5.4)
  // native Hosts
  deviceId,              // eine ID pro Installation, geteilt von allen WebViews und Domains
  deviceToken,           // das Token aus status().deviceToken, vom Host verwahrt
  launchId,              // dieser Start der App, geteilt von allen WebViews des Prozesses (§5.4)
  nativeKey,             // ein Geheimnis, das nur der Host kennt; aktiviert nativeControl / nativeDecide
  nativeApproval,        // der Host zeigt Verbindungs- und Bestätigungsfragen selbst an
}) // → Promise<{ deviceCode, status }>
```

| Funktion | Beschreibung |
|---|---|
| `run(gatewayUrl, appKey, options?)` | Bringt die Seite online. Wird aufgelöst, sobald das Gateway geantwortet hat, oder nach 8 s mit dem, was bekannt ist. Ein erneuter Aufruf liefert dasselbe Promise |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`. `status` ist `idle`, `connecting`, `online`, `polling`, `rejected`, `quota` oder `stopped`; `logSession` ist das Sitzungsprotokoll, in das diese Seite schreibt, `null`, wenn sie nicht aufzeichnet ([§5.4](#54-sitzungsprotokoll)) |
| `help(on = true)` | Hilfe anfordern oder abbrechen |
| `setUser(userId)` | Den angemeldeten Nutzer ändern (das SDK verbindet sich mit einem neuen `hello` neu) |
| `stop()` | Verbindung trennen und die Oberfläche entfernen; die Aufzeichnung von Console und Netzwerk läuft begrenzt weiter |
| `nativeControl(nativeKey, 'takeover' \| 'handback' \| 'end')` | Die eigenen Steuer-Buttons des nativen Hosts. Gibt `false` zurück, wenn der Key nicht passt |
| `nativeDecide(nativeKey, requestId, value)` | Beantwortet `status().pending`: eine Stufe oder `null` für `attach`, `'allow'` oder `null` für `confirm`. Gibt `false` zurück, wenn Key, Anfrage oder Wert falsch sind |

**Start-ID.** Neben `run({ launchId })` kann ein Host `window.RWDLaunchId` definieren, bevor das SDK läuft: einen String oder eine Funktion, die einen String oder ein Promise darauf zurückgibt (auf das höchstens 300 ms gewartet wird). Sie muss aus 4–128 Zeichen aus `[A-Za-z0-9_.:-]` bestehen; alles andere wird ignoriert, und das SDK leitet den Start selbst ab ([§5.4](#54-sitzungsprotokoll)).

`nativeKey` wird nur in das injizierte Skript geschrieben und in konstanter Zeit verglichen. Seitenskripte, einschließlich des `evaluate_script` eines Agents, können ihn nicht lesen und deshalb weder die Steuerung zurückgeben noch sich selbst freigeben.

**Native Screenshot-Bridges.** Registriert der Host eine davon, verwendet `rwd.screenshot` sie für echte Pixel (einschließlich Video, Canvas, Cross-Origin-Bildern und nativen Overlays). Jede liefert eine PNG- oder JPEG-Data-URL oder reines Base64 der sichtbaren WebView:

| Bridge | Plattform |
|---|---|
| `window.RWDNativeScreenshot()` | Jeder Host; gibt `string` oder `Promise<string>` zurück |
| `webkit.messageHandlers.rwdScreenshot` | iOS / macOS `WKWebView`, registriert als `WKScriptMessageHandlerWithReply`; erhält `{type:"screenshot"}` |
| `window.RWDAndroid.screenshot()` | Android, eine `@JavascriptInterface`-Methode |

Referenzimplementierung: [`examples/mock-app/Sources/RWDMockApp/RWDNative.swift`](../examples/mock-app/Sources/RWDMockApp/RWDNative.swift).

## 11. Projektrichtlinie

```ts
type Policy = {
  approval: 'none' | 'prompt'      // prompt: der Nutzer gibt jede Verbindung auf dem Gerät frei (Standard prompt)
  maxLevel: Level                  // höchste Stufe für dieses Projekt (Standard interact)
  maskSelectors: string[]          // zusätzliche zu maskierende CSS-Selektoren (neben Passwortfeldern und [data-rwd-mask])
  maskPatterns: { name: string; regex: string }[]  // zu maskierende Textmuster, z. B. Telefon- oder Ausweisnummern (JavaScript-Regex)
  confirmSelectors: string[]       // ein Klick darauf braucht das OK des Nutzers (neben [data-rwd-confirm])
  networkExclude: string[]         // Anfragen, die aus dem herausgehalten werden, was Agents lesen (§5.2)
  sessionLog: boolean              // Seiten führen ein Sitzungsprotokoll (Standard true, §5.4)
  helpButton: 'off' | 'all' | 'listed'   // wer den Button "Hilfe anfordern" sieht (Standard off)
  helpUsers: string[]              // userIds für helpButton = listed
  agentIdleMinutes: number         // agent → observe nach so viel Inaktivität (Standard 2, max. 120)
  attachMaxMinutes: number         // eine Verbindung endet nach dieser Dauer (Standard 60, max. 1440)
  maxOnlineDevices: number         // 0 = unbegrenzt; darüber werden neue Geräte mit 4429 geschlossen
  maxAgents: number                // gleichzeitig mit den Geräten dieses Projekts verbundene Agents; 0 = unbegrenzt
  eruda: { dock: boolean; load: boolean }  // Remote-Standard für run({ eruda }); lokale Optionen gewinnen Feld für Feld.
                                           // In welcome.config kann es null sein oder fehlen (= beide false), §3.4
}
```

- Werte werden beim Speichern normalisiert: Ein `approval` außer `none` wird zu `prompt`, ein ungültiges `maxLevel` wird zu `interact`, Zahlen werden auf ihren Bereich begrenzt. `maskPatterns` müssen kompilieren, sonst `400 bad_policy`. Aus `maskSelectors`, `confirmSelectors`, `networkExclude` und `helpUsers` werden leere Einträge entfernt, und sie werden auf je 50 gekürzt, `maskPatterns` auf 20.
- **`networkExclude`** ist das Rauschen, durch das sich ein Agent nicht wühlen sollte: Schriften, die immer 404 liefern, Analytics-Beacons. Jede Regel wird gegen die Anfrage-URL geprüft, als Teilstring ohne Beachtung der Groß-/Kleinschreibung, als `*`-Wildcard-Muster (`*/404/*`) oder als regulärer Ausdruck, wenn sie als `/…/` geschrieben ist (mit optionalen Flags; Standard ist `i`). Eine Regel, die nicht kompiliert, passt auf nichts. Passende Anfragen werden aus der Netzwerkliste und aus `net_fail`-Ereignissen der Zeitleiste herausgelassen, aber die Seite zeichnet sie weiterhin auf, sodass ein Agent sie mit `includeExcluded` anfordern kann ([§5.2](#52-methoden), [§14.3](#143-tools)). Sie dienen der Bequemlichkeit, nicht dem Datenschutz – verwenden Sie `maskSelectors` / `maskPatterns` für Daten, die die Seite nicht verlassen dürfen.
- **`sessionLog`** ist eingeschaltet, sofern es nicht auf `false` gesetzt ist, auch bei Projekten, die gespeichert wurden, bevor es das Feld gab. Ausschalten hält jede Seite des Projekts vom Aufzeichnen ab und löscht die bereits auf diesen Geräten gespeicherten Protokolle für diesen Origin; eine einzelne Seite kann sich mit `run({ record: false })` selbst abmelden ([§5.4](#54-sitzungsprotokoll)).
- Die Felder für Maskierung, Bestätigung, Netzwerk-Ausschluss, Sitzungsprotokoll, Hilfe und eruda erreichen die Seiten in `welcome.config` ([§3.4](#34-welcome)); die eigenen `run({ networkExclude })`-Regeln einer Seite werden zu denen des Projekts hinzugefügt.
- **Mehrere Projekte auf einem Gerät.** Ein Gerät wird über seine `deviceId` identifiziert, nicht über ein Projekt: Seiten, die mit verschiedenen App-Keys auf demselben Telefon geladen werden, sind Seiten eines Geräts. Wenn sich ein Agent verbindet, führt das Gateway die Richtlinien der Projekte zusammen, deren Seiten verbunden sind, und behält jeweils den strengsten Wert: `prompt`, wenn irgendein Projekt es verlangt, die kleinsten Werte von `maxLevel`, `agentIdleMinutes` und `attachMaxMinutes` und den kleinsten von null verschiedenen Wert von `maxAgents`.

## 12. REST-API der Konsole

### 12.1 Konventionen

- Basispfad `/v1/api`. Die Anmeldung erfolgt mit `POST /auth/login`; die Sitzung ist ein HttpOnly-Cookie `rwd_session` (12 Stunden, `SameSite=Lax`, `Secure` über HTTPS). Das Konto wird bei jeder Anfrage neu gelesen, sodass das Deaktivieren oder Löschen eines Mitglieds sofort wirkt.
- Jede Anfrage außer `GET` / `HEAD` an einen Endpunkt, der eine Sitzung erfordert, muss `X-RWD-CSRF: 1` tragen, sonst `403 csrf`.
- Fehler sind `{"error":{"code":"…","message":"…"}}` mit einem 4xx/5xx-Status. Die Meldungen folgen der Sprache der Anfrage ([§15](#15-sprachen)).
- Häufige Codes: `401 unauthorized` (nicht angemeldet), `403 forbidden` (Rolle zu niedrig), `403 csrf`, `404 not_found`, `400 bad_request`, `429 rate_limited`, `500 internal`.

Rollen: `owner` (alles, einschließlich Mitgliedern), `admin` (Projekte, Keys, Richtlinien, Geräte, Einladungen, Audit), `member` (Projekte und Geräte lesen, Verbindungen testen, Sitzungen beenden, Geräteeinladungen erstellen, Audit-Log lesen). In den Tabellen unten bedeutet *member* jedes angemeldete Konto.

### 12.2 Konten und Mitglieder

| Methode | Pfad | Rolle | Anfrage | Antwort |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{"email","password"}` | `{"ok":true}` und das Cookie. `401 bad_password`; `429 rate_limited` nach 10 Versuchen pro Minute und IP. Eine leere `email` bedeutet `admin` |
| POST | `/auth/logout` | — | — | `{"ok":true}` |
| GET | `/me` | member | — | `Member` |
| POST | `/me/password` | member | `{"oldPassword","newPassword"}` | `{"ok":true}`. Das neue Passwort muss 8–256 Zeichen lang sein; `400 bad_password`, wenn das alte falsch ist |
| GET | `/config` | — | — | `{"gatewayUrl","version","sdkVersion","sdkIntegrity"}` |
| GET | `/members` | admin | — | `{"members":[Member]}` |
| POST | `/members` | owner | `{"email","name","role"}` | `Member & {"inviteUrl":"https://<host>/invite/<token>"}` (7 Tage gültig, einmalig). `409 conflict`, wenn die E-Mail-Adresse bereits existiert |
| PATCH | `/members/:id` | owner | `{"name"?,"role"?,"disabled"?}` | `Member`. `409 last_owner`, wenn kein aktiver Inhaber übrig bliebe |
| DELETE | `/members/:id` | owner | — | `{"ok":true}`. `409 self`, `409 last_owner` |
| GET | `/invites/:token` | — | — | `{"email","name"}` |
| POST | `/invites/:token/accept` | — | `{"password","name"?}` | `{"ok":true}` und meldet an. Ratenbegrenzt wie die Anmeldung |

Der erste Inhaber wird beim Start aus `RWD_ADMIN_EMAIL` (Standard `admin`) und `RWD_ADMIN_PASSWORD` angelegt (siehe [gateway/README.de.md](../gateway/README.de.md)). Die Konsolenseite `/invite/:token` nimmt eine Mitgliedereinladung an.

### 12.3 Projekte

| Methode | Pfad | Rolle | Anfrage | Antwort |
|---|---|---|---|---|
| GET | `/projects` | member | — | `{"projects":[Project]}` |
| POST | `/projects` | admin | `{"name","allowedOrigins"?:[]}` | `Project` (mit der Standardrichtlinie) |
| GET | `/projects/:id` | member | — | `Project` |
| PATCH | `/projects/:id` | admin | `{"name"?,"allowedOrigins"?,"disabled"?,"policy"?:Partial<Policy>,"inviteUrl"?}` | `Project`. `policy` wird in die aktuelle Richtlinie eingemischt |
| DELETE | `/projects/:id` | admin | — | `{"ok":true}` |
| POST | `/projects/:id/rotate-app-key` | admin | — | `Project` mit einem neuen App-Key |
| GET | `/projects/:id/integration` | member | — | `Integration` |

Einträge in `allowedOrigins` sind vollständige Origins wie `https://m.example.com`, mit einem optionalen führenden Wildcard-Label: `https://*.example.com` passt auf jede Subdomain, aber nicht auf `https://example.com` selbst. Leer bedeutet jeder Origin. `inviteUrl` muss eine `http(s)`-URL sein.

### 12.4 API-Keys

API-Keys gehören zum Gateway, nicht zu einem Projekt: Ein Key erreicht jedes Gerät.

| Methode | Pfad | Rolle | Anfrage | Antwort |
|---|---|---|---|---|
| GET | `/keys` | member | — | `{"keys":[ApiKey]}` |
| POST | `/keys` | admin | `{"name","maxLevel"?:"interact","expiresInDays"?:90,"ipAllowlist"?:[]}` | `ApiKey & {"key":"rwd_sk_live_…"}`: das einzige Mal, dass der vollständige Key zurückgegeben wird |
| DELETE | `/keys/:id` | admin | — | `{"ok":true}`. Der Widerruf wirkt sofort: Der Agent des Keys wird getrennt, und seine nächste MCP-Anfrage erhält 401 |

`expiresInDays: 0` bedeutet nie. `ipAllowlist` nimmt IPs oder CIDRs; ist sie gesetzt, erhalten MCP-Anfragen von anderen Adressen 401. `GET` / `POST /projects/:id/keys` sind ältere Aliase von `/keys`.

### 12.5 Geräte und Gateway-Status

| Methode | Pfad | Rolle | Antwort |
|---|---|---|---|
| GET | `/devices?status=online\|all&q=&project=&page=1&pageSize=20` | member | `{"devices":[Device],"total","page","pageSize"}` (`pageSize` ≤ 100). `online` (Standard): Online-Geräte, zuletzt verbundene zuerst. `all`: jedes bekannte Gerät, neueste zuerst. In beiden Modi passt `q` auf Geräte-ID, Gerätecode (Bindestriche optional), userId, User-Agent, das Systemlabel (in beiden Sprachen) und Projektnamen |
| GET | `/projects/:id/devices?status=all\|online\|waiting` | member | `{"devices":[Device]}`: Geräte, deren letzte Seite aus dem Projekt kam (Standard `all`, bis zu 500), zuerst die um Hilfe bittenden, dann die online, dann die zuletzt gesehenen. `waiting` bedeutet „bittet um Hilfe“ |
| GET | `/devices/:id` | member | `DeviceDetail` |
| POST | `/devices/:id/test` | member | Immer `200`: `{"ok","latencyMs"?,"page"?:{"label","url","title"},"snapshot"?:"<first 4000 characters>","error"?:{"code","message"}}`. Codes: `device_offline`, `no_page` (die Seite verbindet sich gerade neu), `timeout`, `takeover`, `internal` und die RPC-Codes aus [§5.1](#51-nachrichtenformat) |
| POST | `/devices/:id/end` | member | `{"ok":true}`: trennt den Agent, hebt die Hilfeanfrage auf, Steuerung zurück auf `none` |
| GET | `/status` | member | `{ok, version, db, gatewayUrl, sdkVersion, startedAt, uptimeSec, serverTime, onlineDevices, totalDevices, connectedPages, attachedAgents, helpDevices, pendingApprovals, wsConnections, projects}` |

### 12.6 Geräteeinladungen

Mit einer Einladung bringt ein Nutzer sein Gerät online, und zwar gleich als „bittet um Hilfe“, einfach indem er einen Link öffnet. Niemand muss einen Gerätecode vorlesen.

| Methode | Pfad | Rolle | Anfrage | Antwort |
|---|---|---|---|---|
| GET | `/projects/:id/invites` | member | — | `{"invites":[DeviceInvite]}` (`link` ist die Ziel-URL ohne das Token, das nicht gespeichert wird) |
| POST | `/projects/:id/invites` | member | `{"note","url"?,"expiresInMinutes"?:30}` | `DeviceInvite` mit dem vollständigen `link` (`<url>?rwd_invite=<token>`) |
| DELETE | `/device-invites/:id` | member | — | `{"ok":true}` |

`url` ist standardmäßig die `inviteUrl` des Projekts; eines von beiden ist erforderlich. `expiresInMinutes` ist auf 7 Tage begrenzt. Die Seite hinter dem Link muss das SDK mit dem App-Key desselben Projekts laden ([§3.5](#35-geräte-token-resume-token-und-einladungen)).

### 12.7 Audit-Log

`GET /audit?project=&device=<device code>&actor=&action=&from=&to=&limit=50&before=<id>` (member) → `{"events":[AuditEvent],"nextBefore":<id>|null}`, neueste zuerst. `limit` ≤ 200; `action` ist ein Präfixvergleich (`attach.` passt auf jedes Verbindungsereignis); `actor` passt auf die ID oder den Namen eines Akteurs.

| Aktion | Wann |
|---|---|
| `auth.login`, `auth.login_failed` | Anmeldung an der Konsole |
| `member.invite`, `member.accept`, `member.update`, `member.delete` | Mitgliederverwaltung |
| `project.create`, `project.update`, `project.delete`, `project.rotate_app_key` | Projekte |
| `key.create`, `key.revoke` | API-Keys |
| `invite.create`, `invite.delete`, `invite.use` | Geräteeinladungen |
| `attach.request`, `attach.approve`, `attach.deny`, `attach.timeout`, `attach.resume`, `attach.start`, `attach.end` | Verbindungen von Agents. `attach.resume` bedeutet, dass der Key innerhalb der Karenzzeit zurückgekommen ist, statt erneut zu fragen ([§7](#7-verbindungsfreigabe)); `detail: {level}` |
| `rpc` | Jeder Seiten-RPC eines Agents; `detail: {method, page, latencyMs, error?}` |
| `control.takeover`, `control.handback`, `control.end` | Die Buttons des Nutzers |
| `device.end` | Ein Konsolenmitglied hat eine Sitzung beendet |
| `policy.denied` | Ein Aufruf oberhalb der gewährten Stufe wurde abgelehnt |

Ereignisse enthalten nie Seiteninhalte oder Parameterwerte. Sie werden standardmäßig 180 Tage aufbewahrt (`RWD_AUDIT_RETENTION_DAYS`).

### 12.8 Typen

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
  projectId: string            // Projekt der letzten Seite
  projects: string[]           // Projekte der verbundenen Seiten
  userId: string | null; platform: string; ua: string
  app: { name: string; version: string } | null
  system: SystemInfo
  online: boolean; onlineSince?: number /* seit wann online; nur solange online */
  help: boolean; invited: boolean
  control: 'none' | 'observe' | 'agent' | 'user'
  agent: string | null; level: Level | null
  pending: { kind: 'attach'; agent: string; keyHint?: string; levels: Level[]; expiresAt: number } | null
  task?: Task                  // nur solange der verbundene Agent eine gesetzt hat
  pages: number                // verbundene Seiten
  sdk: string                  // von der Seite gemeldete SDK-Version
  currentPage: { label: string; url: string; title: string } | null  // die Seite, die der Nutzer am wahrscheinlichsten ansieht
  firstSeenAt: number; lastSeenAt: number
  projectName?: string         // nur GET /devices
}

type SystemInfo = {            // aus dem User-Agent geparst
  os: string; osVersion: string; model: string; browser: string
  label: string                // z. B. "iOS 18.0 · iPhone · WebView", "Android 14 · SM-S918B · WebView"
}

type Task = { title: string; steps: string[]; current: number; agent: string }

type Page = {
  id: string; projectId: string; label: string; url: string; title: string
  visibility: 'visible' | 'hidden'
  focused: boolean             // die Seite, die der Nutzer am wahrscheinlichsten ansieht
  selected: boolean            // die Seite, auf der der Agent arbeitet
  openerLabel: string | null; connectedAt: number
}

type TimelineEvent = { at: number; page: string /* Label; "" bei geräteweiten Ereignissen */; kind: string; summary: string }

type DeviceDetail = Omit<Device, 'pages'> & {
  pages: Page[]                // ersetzt die Anzahl
  timeline: TimelineEvent[]    // die letzten 100, älteste zuerst
}

type Member = {
  id: string; email: string; name: string; role: 'owner' | 'admin' | 'member'
  disabled: boolean; pending: boolean /* Einladung noch nicht angenommen */
  createdAt: number; lastLoginAt: number | null
}

type DeviceInvite = {
  id: string; projectId: string; note: string; link: string; expiresAt: number
  usedAt: number | null; deviceId: string | null; createdBy: string; createdAt: number
}

type AuditEvent = {
  id: number; at: number; projectId: string | null
  actorType: 'member' | 'apikey' | 'device' | 'system'; actorId: string; actorName: string
  action: string; target: string /* Gerätecode, Key-Präfix, Mitglieds-E-Mail… */
  result: 'ok' | 'denied' | 'error'; detail: Record<string, unknown>
}
```

### 12.9 Zeitleisten-Ereignisse

Jedes Gerät hält seine letzten 300 Zeitleisten-Ereignisse im Speicher; die Konsole zeigt die letzten 100, MCP standardmäßig die letzten 50.

| `kind` | Bedeutung |
|---|---|
| `opened` / `closed` | Eine Seite hat sich zum ersten Mal verbunden / ist nach ihrer Karenzzeit verschwunden ([§3.1](#31-lebenszyklus)) |
| `navigated` / `reloaded` | Eine Seite ist zu einer neuen URL gewechselt / hat sich mit derselben URL neu verbunden |
| `focus` | Eine Seite ist in den Vordergrund gekommen |
| `error` / `console_error` / `net_fail` / `user_tap` | Von der Seite gemeldete Events ([§3.2](#32-seite--gateway)) |
| `help` | Der Nutzer hat Hilfe angefordert oder abgebrochen oder ist über eine Einladung gekommen |
| `agent` | Verbindungsanfragen, Ablehnungen, Timeouts, Verbindungen, Änderungen der Aufgabe |
| `control` | Änderungen des Steuerungszustands; die Zusammenfassung nennt den Grund (Nutzer hat übernommen, KI im Leerlauf, Nutzer hat beendet, …) |
| `offline` | Die letzte Seite des Geräts ist verschwunden, während ein Agent verbunden war |

## 13. Live-Updates (SSE)

`GET /v1/api/stream[?project=<id>][&lang=<tag>]` (member, Cookie-Authentifizierung) streamt `text/event-stream`:

```
retry: 3000

event: device     data: Device                               ein Gerät hat sich geändert (online, Hilfe, Steuerung, Freigabe, Aufgabe…)
event: timeline   data: {"deviceId", "event": TimelineEvent}
event: ping       data: {}                                   alle 25 s
```

Ohne `project` werden die Ereignisse aller Projekte gestreamt. `EventSource` kann keine Header setzen, daher steht die Sprache in `?lang=`. Ein langsamer Abonnent verpasst Ereignisse, statt das Gateway aufzuhalten; die Konsole lädt die Daten bei der Neuverbindung neu und weicht auf Polling aus, wenn der Stream fehlschlägt.

## 14. MCP

### 14.1 Sitzungen

- Endpunkt `/v1/mcp` (Streamable HTTP). Jede Anfrage muss `Authorization: Bearer <API key>` tragen. Der Key wird bei jeder Anfrage geprüft, sodass ein widerrufener oder abgelaufener Key oder eine Adresse außerhalb seiner `ipAllowlist` sofort 401 erhält.
- Das Gateway hält einen Agent-Zustand pro API-Key: das verbundene Gerät und die ausgewählte Seite. MCP-Sitzungen mit demselben Key teilen ihn. Ein Agent ist jeweils mit höchstens einem Gerät verbunden; das Verbinden mit einem anderen Gerät trennt ihn vom ersten. Ein Key erreicht jedes Gerät am Gateway.
- Mehr als 5 fehlgeschlagene Gerätesuchen pro Minute mit einem Key werden für den Rest der Minute abgewiesen, was das Erraten von Gerätecodes verhindert.

### 14.2 Ergebnisse

Jedes Tool-Ergebnis endet mit dem, was sich seit dem vorherigen Aufruf des Agents auf dem Gerät geändert hat (höchstens 20 Zeilen), sodass der Agent neue Seiten, Navigationen, Fehler und Übernahmen ohne Polling bemerkt:

```
[Session changes]
- p3 "Checkout" opened (opened by p2)
- p3 TypeError: Cannot read properties of undefined (reading 'orderId')
- The user took over
```

Inhalte, die von der Seite stammen (Snapshots, Console, Netzwerk, Storage, evaluate-Ergebnisse, Zeitleiste), werden in ein Tag eingeschlossen und als nicht vertrauenswürdige Daten gekennzeichnet, damit der Agent darin gefundenen Anweisungen nicht folgt.

### 14.3 Tools

| Tool | Stufe | Parameter | Beschreibung |
|---|---|---|---|
| `list_devices` | — | `status?: online\|waiting\|all` (Standard `online`), `userId?`, `deviceCode?` (beliebige Groß-/Kleinschreibung, mit oder ohne Bindestrich) | Bis zu 50 Geräte, die um Hilfe bittenden zuerst |
| `connect_device` | — | `device` (Gerätecode oder deviceId), `level?: Level` (Standard `interact`), `follow?: true` | Verbinden, bei Bedarf nach vorheriger Rückfrage beim Nutzer ([§7](#7-verbindungsfreigabe)); innerhalb von 10 Minuten, nachdem der Agent das Gerät selbst losgelassen hat, kommt derselbe Key ohne erneute Rückfrage zurück, mit höchstens der damals gewährten Stufe. Wählt die Vordergrundseite aus. Schlägt fehl, wenn das Gerät keine verbundene Seite hat (und stößt ein pollendes Gerät an, sich neu zu verbinden) |
| `disconnect_device` | — | — | Trennen |
| `wait_for_device` | — | `device`, `timeoutSec?: 60` (max. 300) | Warten, bis das Gerät eine verbundene Seite hat; ein pollendes Gerät wird angewiesen, sich neu zu verbinden |
| `list_pages` | — | — | Seiten des Geräts: Label, Titel, URL, ausgewählt, Vordergrund / Hintergrund, verbindet neu, Opener |
| `select_page` | — | `page` (Label) | Die ausgewählte Seite wechseln |
| `take_snapshot` | observe | `page?` | Barrierefreiheits-Snapshot mit refs, dazu die Overlays, die über der Seite schweben, und ihre refs ([§5.3](#53-verhalten-in-der-seite)) |
| `find_elements` | observe | `text?`, `role?`, `name?`, `limit?`, `page?` | Elemente und ihre refs ohne vollständigen Snapshot finden (`rwd.query`) |
| `take_screenshot` | observe | `page?`, `fullPage?`, `format?: jpeg\|png` | Gibt ein Bild zurück |
| `wait_for` | observe | `text?`, `textGone?`, `timeSec?` (max. 30) | Auf der ausgewählten Seite warten |
| `list_console_messages` | observe | `scope?: page\|session`, `types?`, `limit?: 50` | `session` führt jede verbundene Seite zusammen und kennzeichnet jede Zeile mit ihrer Seite |
| `list_network_requests` | observe | `scope?`, `failedOnly?`, `limit?: 50`, `exclude?`, `includeExcluded?` | Ebenso; IDs werden als `<label>:<id>` aufgeführt. `exclude` fügt für diesen Aufruf Regeln zu denen des Projekts und der Seite hinzu ([§11](#11-projektrichtlinie)); wenn Regeln etwas verborgen haben, endet das Ergebnis mit *N Anfragen durch die Ausschlussregeln verborgen*, und `includeExcluded: true` zeigt sie an |
| `click` / `hover` | interact | `ref` | Ein von einem Overlay blockierter Klick schlägt mit `not_interactable` fehl und nennt die `ref` des verdeckenden Elements, das stattdessen angeklickt werden kann ([§5.3](#53-verhalten-in-der-seite)) |
| `fill` | interact | `ref`, `value` | |
| `type_text` | interact | `text`, `ref?`, `submit?` | |
| `press_key` | interact | `key` | |
| `select_option` | interact | `ref`, `values` | |
| `scroll` | interact | `ref?`, `dx?`, `dy?` (Standard `dy: 600`) | |
| `drag` | interact | `fromRef`, `toRef` | |
| `navigate_page` | interact | `url` | |
| `go_back` / `reload_page` | interact | — | |
| `batch_actions` | interact | `actions: [{tool, args}]` (1–30), `stopOnError?: true` | Führt `click`, `fill`, `type_text`, `press_key`, `select_option`, `hover`, `scroll` und `wait_for` der Reihe nach aus und liefert ein gemeinsames Ergebnis |
| `get_network_request` | advanced | `id` (`<label>:<id>` aus der Liste oder eine reine ID für die ausgewählte Seite) | Header und Bodys |
| `get_storage` | advanced | `area: local\|session\|cookie`, `page?` | |
| `evaluate_script` | advanced | `function`, `args?`, `page?` | JavaScript in der Seite ausführen; Ergebnisse über 20.000 Zeichen werden abgeschnitten |
| `get_session_timeline` | — | `limit?: 50` | Die seitenübergreifende Zeitleiste des Geräts |
| `get_session_overview` | observe | `session?` | Das Sitzungsprotokoll des aktuellen Starts auf einen Blick ([§5.4](#54-sitzungsprotokoll)): wann er begann, wie viel gespeichert ist, Anzahl der Einträge, die besuchten Seiten, die letzten 20 Fehler und fehlgeschlagenen Anfragen und die außer diesem noch aufbewahrten Starts |
| `get_session_log` | observe | `session?`, `kinds?`, `problems?`, `page?`, `text?`, `after?`, `limit?`, `seq?`, `exclude?`, `includeExcluded?` | Das Sitzungsprotokoll Eintrag für Eintrag, als `#<seq> <time> <page> <line>`. `page` nimmt ein Label wie `p2` oder eine Seiten-ID, wie das Protokoll sie ausgibt; `after` blättert ab der `seq` weiter, mit der das vorherige Ergebnis endete. `seq` zeigt stattdessen diesen einen Eintrag vollständig an (Header und Bodys; erfordert `advanced`, da es `rwd.logDetail` aufruft) |
| `wait_for_page` | — | `urlContains?`, `titleContains?`, `timeoutSec?: 30` (max. 300) | Auf eine Seite warten, die seit dem vorherigen Aufruf geöffnet wurde oder navigiert hat |
| `wait_for_event` | — | `kind?` ([§12.9](#129-zeitleisten-ereignisse)), `page?`, `timeoutSec?: 30` (max. 300) | Auf das nächste passende Ereignis der Zeitleiste warten |
| `wait_for_control` | — | `timeoutSec?: 120` (max. 600) | Nach einer Übernahme warten, bis der Nutzer die Steuerung zurückgibt (oder beendet) |
| `set_task` | — | `title` (≤ 24 Zeichen), `steps?` (≤ 12, je ≤ 28 Zeichen), `current?` | Die Aufgabe und den Plan des Agents oben auf jeder Seite des Geräts anzeigen. `current` ist der aktive Schritt; `current = steps.length` bedeutet erledigt. Seiten erhalten sie als `task` ([§3.3](#33-gateway--seite)); sie wird gelöscht, wenn der Agent geht |

`page?` führt einen einzelnen Aufruf auf einer anderen Seite (per Label) aus, ohne die Auswahl zu ändern. Ein Tool oberhalb der Stufe der Verbindung schlägt mit „Requires advanced access; this session was granted interact“ fehl und wird als `policy.denied` im Audit-Log erfasst.

**Folgemodus.** Mit `follow: true` (Standard) wandert die ausgewählte Seite automatisch, wenn die Aktion des Agents eine neue Seite öffnet, wenn der Nutzer eine andere Seite in den Vordergrund holt oder wenn die ausgewählte Seite seit 1,5 s verschwunden ist; das Ergebnis weist darauf hin. Eine ausgewählte Seite, die als veraltet entfernt wird ([§3.1](#31-lebenszyklus)), wird unabhängig von `follow` durch die Seite ersetzt, die dieselbe URL zeigt, da der alte Eintrag nicht mehr existiert.

### 14.4 Lokale stdio-Bridge

Für MCP-Clients, die nur stdio sprechen:

```bash
RWD_API_KEY=rwd_sk_live_… rwd mcp --gateway https://rwd.example.com/v1
```

Sie leitet stdio an das gehostete `/v1/mcp` weiter. `--gateway` kann auch aus `RWD_GATEWAY` kommen.

## 15. Sprachen

Unterstützte Sprachen: Englisch (`en`), vereinfachtes Chinesisch (`zh`), traditionelles Chinesisch (`zh-TW`), Französisch (`fr`), Spanisch (`es`), Russisch (`ru`), Arabisch (`ar`, von rechts nach links), Japanisch (`ja`), Koreanisch (`ko`), Deutsch (`de`) und Portugiesisch (`pt`). Jedes BCP-47-Tag wird akzeptiert und auf die nächstgelegene abgebildet: `en-US` → `en`; `zh-CN`, `zh_CN`, `zh-Hans` → `zh`; `zh-HK`, `zh-MO`, `zh-Hant` → `zh-TW`; `fr-CA` → `fr`; `pt-BR`, `pt-PT` → `pt`. `Accept-Language` wählt die unterstützte Sprache mit der höchsten Gewichtung.

| Zielgruppe | Was | Gewählt durch |
|---|---|---|
| Agent | Anweisungen des MCP-Servers, Beschreibungen von Tools und Parametern, Tool-Ergebnisse, `[Session changes]`, Fehler | `RWD_LANG` / `--lang` des Gateways (Standard `en`) |
| Agent, von der Seite | Vom SDK verfasste RPC-Fehlermeldungen und Event-Zusammenfassungen | `welcome.agentLang`, das die Sprache des Gateways überträgt. Das SDK hält den letzten Wert im localStorage unter `rwd:alang` für Events, die vor dem nächsten `welcome` auftreten, und verwendet Englisch, bis es etwas anderes erfährt |
| Konsole | Fehlermeldungen, Zusammenfassungen der Zeitleiste und Systemlabels in REST- und SSE-Antworten | `?lang=` an der Anfrage, dann `Accept-Language`, dann die Sprache des Gateways |
| Nutzer | Badge, Leisten, Dialoge und Hinweise des SDK | `run({ lang })`, sonst die erste Sprache aus `navigator.languages`, für die das SDK ein Paket hat (eingebaut oder von der Seite registriert), sonst Englisch. Andere Pakete als `en` und `zh` werden bei Bedarf aus `locales/<id>.js` neben `sdk.js` oder vom Gateway (`/v1/locales/<id>.js`) geladen |

So kann ein chinesischsprachiger Nutzer mit einem englischsprachigen Agent arbeiten: Der Dialog lautet *AI 想要点击「提交订单」，允许吗？*, und bei einer Ablehnung liest der Agent *The user denied this action*.

## 16. Betrieb

- **Metriken.** `GET /v1/metrics` liefert Prometheus-Text. Ist `RWD_METRICS_TOKEN` gesetzt, ist `Authorization: Bearer <token>` erforderlich. Serien: `rwd_online_devices{project}`, `rwd_connected_pages`, `rwd_attached_agents`, `rwd_ws_connections`, `rwd_rpc_total{method,result}`, `rwd_rpc_duration_seconds{method}` (Histogramm), `rwd_http_requests_total{code}`.
- **SDK-Versionen.** Die für das Caching verwendete SDK-Version sind die ersten 12 Hex-Zeichen des SHA-256 der im Gateway eingebetteten `sdk.js`, sodass sich `/v1/sdk/<version>/sdk.js` ändert, sobald sich die Datei ändert. `GET /v1/api/config` liefert sie als `sdkVersion`, zusammen mit `sdkIntegrity` (`sha384-…`, für das `integrity`-Attribut). Die Konsole bietet ein Snippet an, das sie festschreibt.
- **Datenbank.** `RWD_DATABASE_URL=postgres://…` (oder `postgresql://`) wählt Postgres; andernfalls ist `RWD_DATA` (Standard `rwd.db`) eine SQLite-Datei. Das Schema wird beim Start angelegt und migriert.
- **Ratenbegrenzungen.** Anmeldung an der Konsole und Annahme von Einladungen: 10 pro Minute und Client-IP. Seitenverbindungen und Presence-Aufrufe: 120 pro Minute und Client-IP. Client-IPs werden nur mit `--trust-proxy` aus `X-Forwarded-For` übernommen; derselbe Schalter regelt `X-Forwarded-Proto` und `X-Forwarded-Host`, die bestimmen, ob das Sitzungs-Cookie `Secure` ist, sowie Schema und Host der abgeleiteten `gatewayUrl`, wenn `--public-url` nicht gesetzt ist.
- **Aufbewahrung des Audit-Logs.** `RWD_AUDIT_RETENTION_DAYS` (Standard 180); alte Ereignisse werden alle 6 Stunden bereinigt.

Alle Gateway-Einstellungen sind in [gateway/README.de.md](../gateway/README.de.md) aufgeführt.
