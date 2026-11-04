<!-- i18n-source: dddf9c552f85175cc0df9f53d96059634d3650d4 -->
[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | Deutsch | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [العربية](README.ar.md)

# RWD-Seiten-SDK (`sdk/`)

Eine JS-Datei, die eine App-WebView oder H5-Seite lädt, damit ein KI-Agent die Seite über das RWD-Gateway (`gateway/`) und MCP untersuchen und bedienen kann. Protokoll: [`docs/protocol.de.md`](../docs/protocol.de.md); Architektur: [`docs/architecture.de.md`](../docs/architecture.de.md).

```html
<script src="https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js"></script>
<script>
  RemoteWebviewDebugger.run("https://rwd.example.com/v1", "rwd_pk_xxxxxxxx", {
    userId: "u-42",              // optional
    deviceId: "…",               // optional; von einem nativen Host übergeben, der das SDK injiziert
    helpButton: true,            // optional; zeigt den Button "Unterstützung anfordern"
    app: { name: "Shop", version: "3.2.0" },
    lang: "en",                  // optional; ein Sprach-Tag, standardmäßig aus den Browsersprachen
  }).then(({ deviceCode, status }) => console.log(deviceCode, status))
</script>
```

## SDK beziehen

Auf npm veröffentlicht als [`remote-webview-debugger`](https://www.npmjs.com/package/remote-webview-debugger); Versionen und Änderungen: [CHANGELOG](CHANGELOG.md).

| Verwendung | Quelle |
|---|---|
| `<script>` von einem CDN | `https://cdn.jsdelivr.net/npm/remote-webview-debugger@0.3.0/dist/sdk.js` oder `https://unpkg.com/remote-webview-debugger@0.3.0/dist/sdk.js` (minifizierte IIFE, globales `RemoteWebviewDebugger`; pinnen Sie die Version und ergänzen Sie bei Bedarf `integrity`) |
| Ein Bundler | `npm install remote-webview-debugger`, dann `import { run, status } from 'remote-webview-debugger'` (ES-Modul mit Typen). Importieren Sie es vor Ihrem eigenen Code, damit die Erfassung früh beginnt. Laden Sie auf derselben Seite nicht zusätzlich die `<script>`-Variante |
| Ihr Gateway | `https://<gateway>/v1/sdk.js`, die im Gateway eingebettete Kopie (auch unter einer inhaltsadressierten URL für SRI, die die Konsole anbietet) |
| Eine native App | `dist/sdk.js` aus dem Paket mitliefern oder von einer der obigen Quellen herunterladen; siehe [native Integration](../docs/native-integration.de.md) |

## API

| API | Beschreibung |
|---|---|
| `run(gatewayUrl, appKey, opts?)` | Bringt die Seite online (Gerätecode, Badge). Gibt `Promise<{deviceCode, status}>` zurück; ein erneuter Aufruf schadet nicht. Optionen siehe unten. |
| `status()` | `{deviceCode, status, control, help, label, deviceId, pageId, version, lang, deviceToken, level, config, pending, logSession}`; `status` ist `idle / connecting / online / polling / stopped / rejected / quota`, `lang` die UI-Sprache (`null` vor `run()`), `logSession` das Sitzungsprotokoll, in das diese Seite schreibt (`null`, wenn nicht aufgezeichnet wird) |
| `stop()` | Trennt die Verbindung und entfernt die UI (die Erfassung von Console und Netzwerk läuft begrenzt weiter) |
| `setUser(userId)` | Wechselt den Nutzer; verbindet sich einmal mit einem neuen `hello` neu |
| `help(on)` | Unterstützung anfordern / Anfrage abbrechen |
| `nativeControl(nativeKey, action)` | Übernehmen / Zurückgeben / Beenden aus der eigenen UI des nativen Hosts |
| `nativeDecide(nativeKey, requestId, value)` | Beantwortet mit `nativeApproval` die Frage in `status().pending`: eine Stufe oder `null` bei einer Zugriffsanfrage, `'allow'` oder `null` bei der Bestätigung einer sensiblen Aktion |
| `setLang(lang?)` | Wechselt die UI-Sprache zur Laufzeit (die eigene Spracheinstellung einer App); ohne Argument gelten wieder die Browsersprachen. Siehe [Sprachen](#sprachen) |
| `registerLocale(pack)` | Fügt ein Sprachpaket hinzu oder ersetzt eines mit derselben `id` (nimmt auch ein Array). Siehe [Sprachen](#sprachen) |
| `builtinLocales` | Die ids der eingebauten Pakete |

Optionen von `run()`:

| Option | Beschreibung |
|---|---|
| `userId` | Der angemeldete Nutzer, wird mit dem `hello` gesendet |
| `deviceId` | Eine stabile Geräte-ID von einem nativen Host (sonst wird eine in localStorage gespeichert) |
| `helpButton` | Zeigt den Button „Unterstützung anfordern“ (ODER-verknüpft mit der Projektrichtlinie) |
| `app` | `{ name, version }` der Host-App |
| `lang` | Sprache von allem, was der Nutzer auf dem Telefon sieht (Badge, schwebendes Fenster, untere Leiste, Dialoge, Toasts, der eruda-Tab und die Beschreibung „Die KI möchte …“ einer sensiblen Aktion): ein Sprach-Tag wie `'ja'` oder `'pt-BR'`. Standard: die Browsersprachen. Siehe [Sprachen](#sprachen) |
| `locales` | Zusätzliche Sprachpakete, die vor der Sprachwahl registriert werden (wie `registerLocale`) |
| `messages` | Zu überschreibende Meldungen, pro Sprache: `{ en: { ui: { help: 'Contact support' } }, zh: { ui: { help: '联系客服' } } }` |
| `networkExclude` | Anfragen, durch die sich der Agent nicht wühlen soll – Schriften, die immer 404 liefern, Analytics-Beacons: `['.ttf', 'WebTracks', '*beacon*', '/\\/track\\//']`. Jede Regel trifft die URL als Teilstring ohne Beachtung der Groß-/Kleinschreibung, als Muster mit `*`-Platzhalter oder, wenn als `/…/` geschrieben, als regulärer Ausdruck. Wird zu den Regeln der Projektrichtlinie hinzugefügt. Passende Anfragen tauchen weder in der Netzwerkliste noch in `net_fail`-Ereignissen der Zeitleiste auf; die Seite zeichnet sie trotzdem auf, sodass ein Agent sie mit `includeExcluded` abfragen kann |
| `lockScreen` | `false`: die Seite nicht sperren, solange ein Agent verbunden ist (der Nutzer kann das im schwebenden Fenster trotzdem ändern). Standard `true` |
| `theme` | `'auto'` (Standard, folgt dem Seitenhintergrund), `'system'`, `'light'` oder `'dark'` |
| `style` | Farben, Schriften, Radien, z-index und Positionen der UI: `{ accent: '#e11d48', radius: 12, zIndex: 1000, pill: { side: 'left' } }`. Siehe [Styling](#styling) |
| `eruda` | `true` oder `{ dock, load, src, name }`: zeigt Remote Debugger als Tab in eruda; `load` lädt das neueste eruda, wenn die Seite keines hat. Standardmäßig aus; die Projektrichtlinie kann es aus der Ferne einschalten, lokale Optionen haben Feld für Feld Vorrang |
| `record` | `false`: diese Seite schreibt kein Sitzungsprotokoll (bereits Gespeichertes wird nicht gelöscht). Standard `true`; die Projektrichtlinie kann das Protokoll für alle Seiten abschalten |
| `launchId` | Zu welchem App-Start diese Seite gehört, damit jede WebView eines App-Prozesses ihr Sitzungsprotokoll unter einer Sitzung ablegt. Ein nativer Host übergibt hier seine eigene ID (oder definiert `window.RWDLaunchId` als String oder als Funktion, die einen liefert); andernfalls leitet das SDK den Start aus einem Sitzungscookie plus Heartbeat ab |
| `nativeKey`, `deviceToken`, `nativeApproval` | Für native Hosts: das Geheimnis für `nativeControl` / `nativeDecide`, das Geräte-Token, das der Host aufbewahrt, und die Rückfragen zu Verbindung / Bestätigung nativ stellen |

## Sprachen

Eingebaut: Englisch (`en`), vereinfachtes Chinesisch (`zh`), traditionelles Chinesisch (`zh-TW`, auch für `zh-HK`, `zh-MO` und `zh-Hant`), Französisch (`fr`), Spanisch (`es`), Russisch (`ru`), Arabisch (`ar`, von rechts nach links), Japanisch (`ja`), Koreanisch (`ko`), Deutsch (`de`) und Portugiesisch (`pt`, brasilianisch; auch für `pt-PT`).

**Sprachwahl.** Die Sprache des Nutzers ist `run({ lang })`, falls angegeben, danach der Reihe nach jeder Eintrag von `navigator.languages`. Für jedes Tag probiert das SDK das Tag und dann kürzere Formen davon (`pt-BR` → `pt`, `zh-HK` → `zh-TW` → `zh`), nimmt die erste Sprache, für die es ein Paket hat, und fällt sonst auf Englisch zurück. Fehlende Meldungen eines Pakets fallen auf dieselbe Weise zurück, ein unvollständiges Paket ist also kein Problem. `setLang('ja')` wechselt zur Laufzeit; `status().lang` ist das verwendete Paket.

**Laden.** Englisch und vereinfachtes Chinesisch stecken in `sdk.js`. Die übrigen Pakete werden bei Bedarf nachgeladen, wenn eine Seite sie zum ersten Mal braucht (so lange zeigt die UI die Rückfallsprache):

- `<script>`-Build: aus `locales/<id>.js` neben `sdk.js` (der CDN-Pfad, z. B. `…/remote-webview-debugger@0.3.0/dist/locales/ja.js`, oder `/v1/locales/ja.js` Ihres Gateways), und falls das scheitert, vom an `run()` übergebenen Gateway. Um die zusätzliche Anfrage zu vermeiden, laden Sie das Paket selbst, vor oder nach `sdk.js`: `<script src="…/dist/locales/ja.js"></script>`.
- ES-Modul-Build: ein dynamischer Import, sodass Ihr Bundler jede Sprache in einen eigenen Chunk legt. Um eine Sprache stattdessen direkt mitzubündeln: `import ja from 'remote-webview-debugger/locales/ja'`, dann `run(url, key, { locales: [ja] })`.

**Eigene Pakete und Formulierungen.** Ein Paket ist `{ id, name, dir?, ui?, action?, agent? }`; alles Fehlende kommt aus seinen Rückfallsprachen:

```js
RemoteWebviewDebugger.registerLocale({
  id: 'it',
  name: 'Italiano',
  ui: { takeover: 'Prendi il controllo', end: 'Termina', help: 'Richiedi assistenza' /* … */ },
})
RemoteWebviewDebugger.run(url, key, {
  messages: { en: { ui: { help: 'Contact support' } } }, // einzelne Meldungen beliebiger Sprachen ändern
})
```

`ui` ist der UI-Text, `action` ergänzt „Die KI möchte …“ im Bestätigungsdialog, und `agent` ist das, was an den Agent zurückgeht. Die TypeScript-Typen (`LocalePack`, `Messages`, `UiMessages`, `ActionMessages`, `AgentMessages`) listen jeden Schlüssel auf; `src/locales/en.ts` ist die Referenz.

**Zwei Zielgruppen.** Der Nutzer auf dem Telefon bekommt die oben gewählte Sprache. Der Agent liest RPC-Fehlermeldungen und Zusammenfassungen der Zeitleiste (Taps, Navigation innerhalb der Seite, fehlgeschlagene Anfragen) in der Sprache des Gateways, `welcome.agentLang` (`RWD_LANG`), und dieses Paket wird auf dieselbe Weise geladen. Bis ein welcome etwas anderes sagt, gilt Englisch; der letzte Wert wird in localStorage `rwd:alang` gespeichert, sodass auch Ereignisse vor dem welcome der nächsten Seite ihn verwenden.

So kann ein chinesischsprachiger Nutzer mit einem englischsprachigen Agent arbeiten: Der Dialog fragt `AI 想要点击「提交订单」，允许吗？`, und bei Ablehnung liest der Agent `The user denied this action`.

## Styling

Die UI lebt in einem Shadow Root an `#__rwd` (außerhalb von `<body>`), sodass Seiten-CSS sie nur über diese Einstiegspunkte erreicht:

- **CSS Custom Properties** auf `:root` oder `#__rwd`, z. B. `:root { --rwd-accent-rgb: 225, 29, 72; --rwd-radius: 12px; }`.
- **`run({ style })`**, das dieselben Properties auf `#__rwd` setzt. Farben dürfen dort beliebige CSS-Farben sein.
- **`::part()`** für alles andere: `#__rwd::part(bar) { … }`. Parts: `pill`, `window`, `bar`, `task`, `dialog`, `toast`, `button`, `cursor`, `glow`, `overlay`. Klassennamen darin sind keine stabile API.
- **`theme`**: helles oder dunkles Glas (Standard: folgt dem Seitenhintergrund).

| Property | `style`-Feld | Standard | Wofür |
|---|---|---|---|
| `--rwd-accent-rgb` | `accent` | `59, 130, 246` | Buttons, Schalter, der Zeiger des Agents, Hervorhebungen und das Leuchten am Rand |
| `--rwd-danger-rgb` | `danger` | `239, 68, 68` | Der Button „Beenden“ |
| `--rwd-warning-rgb` | `warning` | `245, 158, 11` | „Unterstützung anfordern“ und „In Betreuung“; der Zustand, in dem der Nutzer steuert |
| `--rwd-success-rgb` | `success` | `34, 197, 94` | Online-Punkt; „Kopiert“ |
| `--rwd-font` | `font` | System-UI-Schrift (für Chinesisch, Japanisch, Koreanisch je Sprache) | Aller Text |
| `--rwd-font-mono` | `monoFont` | `ui-monospace, "SF Mono", …` | Gerätecode und Tags |
| `--rwd-radius` | `radius` | `18px` | Schwebendes Fenster; der Dialog ist 2px runder, Aufgabenkarte und Badge 2px weniger, Dialog-Buttons 6px weniger |
| `--rwd-button-radius` | `buttonRadius` | `999px` | Buttons, die untere Leiste und Toasts |
| `--rwd-z-index` | `zIndex` | `2147483647` | Die gesamte UI |
| `--rwd-bar-bottom` | `barBottom` | `14px` | Untere Leiste, oberhalb des unteren Safe-Area-Bereichs |
| `--rwd-task-top` | `taskTop` | `10px` | Aufgabenkarte, unterhalb des oberen Safe-Area-Bereichs |
| `--rwd-toast-bottom` | `toastBottom` | `84px` | Toasts, oberhalb des unteren Safe-Area-Bereichs |
| — | `pill: { side, top }` | rechter Rand (links bei Sprachen, die von rechts nach links laufen), `0.62` | Wo das Badge im Ruhezustand beginnt, bis der Nutzer es verschiebt; `top` von 0 (oben) bis 1 (unten) |

Farben sind `r, g, b`-Tripel, damit die durchscheinenden Abstufungen mitgehen (dieselbe Konvention wie Bootstraps `--bs-*-rgb`).

## Verhalten in der Seite (Protokoll §6–§8, §11)

- Stufen: RPCs werden gegen `welcome.level` / `control.level` geprüft (`forbidden`, „Erfordert die Zugriffsstufe …“). Ein Agent ohne Stufe (ein älteres Gateway) bekommt `interact`; ohne verbundenen Agent wird nichts zusätzlich erzwungen.
- Das Geräte-Token liegt in localStorage `rwd:dtoken`, das Resume-Token in sessionStorage `rwd:resume` (an die pageId gebunden). Close-Code 4401: Hat sich das Token inzwischen geändert (ein anderer Tab des Geräts hat es gerade bekommen), sofort einmal erneut versuchen; gibt es gar kein Token und ist die deviceId die eigene des SDK, ist das welcome mit dem Token verloren gegangen, also nach etwa 1,5 s als neues Gerät von vorn beginnen; sonst `rejected` und nach etwa 10 Minuten erneut versuchen; 4409: mit einer neuen pageId neu verbinden; 4429: `quota`, nach etwa 5 Minuten erneut versuchen.
- `rwd_invite` in der Adresszeile wird bei `run()` entfernt (`history.replaceState`) und mit dem hello gesendet, bis ein welcome eintrifft.
- `welcome.config`: `helpButton` (ODER-verknüpft mit der `run()`-Option), `maskSelectors`, `maskPatterns` (Snapshot, Console, Netzwerk-URLs, Storage-Werte, Zusammenfassungen der Zeitleiste), `confirmSelectors`, `networkExclude` (zu den Regeln der `run()`-Option hinzugefügt), `sessionLog`. Die letzte Konfiguration wird in localStorage `rwd:cfg` gespeichert und verwendet, bis das welcome eintrifft – ein Projekt, das das Sitzungsprotokoll abgeschaltet hat, hält es also schon ab dem ersten Moment der nächsten Seite aus, noch vor jedem welcome.
- Snapshots enden mit einem Abschnitt `[Overlays]`, der auflistet, was über der Seite schwebt – der Hintergrund eines Popups, ein Modal, ein Bottom Sheet –, jeweils mit Tag, einem kurzen Textausschnitt, dem Anteil des Viewports, den es bedeckt, und einer ref. Ein Hintergrund ist ein leeres Element, für das der ARIA-Snapshot keinen Knoten hat; er bekommt deshalb eine `oN`-ref statt `eN`. Genau dadurch kann ein Agent ihn antippen, um das Popup zu schließen.
- Ein Klick zielt zuerst auf die sichtbare Mitte des Elements, dann auf die übrigen Punkte eines 3×3-Rasters darin, sodass ein Badge über einem Button ihn nicht blockiert. Sind alle Punkte verdeckt, schlägt der RPC mit `not_interactable` fehl und nennt das verdeckende Element und seine ref.
- Die Dialoge für Verbindung und sensible Aktionen (`[data-rwd-confirm]`, `confirmSelectors`, einschließlich Enter, das ein Formular absendet) leben in einem Shadow DOM, nehmen nur vertrauenswürdige Taps an und werden 0,4 s nach dem Erscheinen scharf geschaltet. Tabs desselben Origins teilen bereits entschiedene Zugriffsanfragen über BroadcastChannel.

Schon das Laden der Datei startet die Erfassung von Console, nicht abgefangenen Fehlern und Netzwerk (XHR, fetch, WebSocket, sendBeacon, EventSource), jeweils höchstens 500 Einträge; ist der Puffer voll, fliegen zuerst einfache Logs und erfolgreiche Anfragen raus. Response-Bodys werden bis insgesamt 5 MB zwischengespeichert, 64 KB pro Body. Laden Sie die Datei deshalb synchron und früh im `<head>`.

## Sitzungsprotokoll (Protokoll §5.4)

Diese Puffer sind das Gedächtnis einer einzelnen Seite. Parallel dazu schreibt das SDK ein **Sitzungsprotokoll** in IndexedDB (`rwd-log`) auf dem Gerät, sodass ein Agent, der sich erst nach einem Bug verbindet, trotzdem den ganzen Weg dorthin nachlesen kann:

- Eine Sitzung ist ein Start der App, gemeinsam für alle Seiten des Origins: `run({ launchId })`, sonst `window.RWDLaunchId`, sonst abgeleitet aus dem Sitzungscookie `rwd_launch` plus Heartbeat (eine Cookie-Sitzung, die über eine Stunde still war, zählt als neuer Start). `status().logSession` ist die verwendete ID.
- Aufgezeichnet werden: Öffnen der Seite / Navigation innerhalb der Seite / Vorder- und Hintergrund / Verlassen, die Taps, Eingaben, Absendungen und Scroll-Ruhepositionen des Nutzers, die interaktiven Aufrufe des Agents und `rwd.evaluate`, Wechsel der Steuerung, Console auf allen Stufen und jede abgeschlossene Anfrage – fehlgeschlagene auch mit geschwärzten Headern und Bodys (je 64 KB). Das läuft unabhängig davon, ob das Gateway erreichbar ist. Maskierte Felder werden als `••••` gespeichert, `maskPatterns` werden schon beim Schreiben der Einträge angewendet.
- Aufbewahrt werden: die letzten 3 Starts, je 10 MB; darüber hinaus werden zuerst einfache Logs und erfolgreiche Anfragen verworfen. Nur der aktuelle Start, wenn das Speicherkontingent unter 64 MB liegt; ohne IndexedDB gar nichts.
- Der Agent liest es mit `rwd.log` (`observe`) und `rwd.logDetail` (`advanced`, für Header und Bodys). Ansonsten verlässt nichts das Gerät.
- Abschalten mit `run({ record: false })` für eine Seite oder `policy.sessionLog: false` für das Projekt – was zusätzlich löscht, was dieser Origin bereits gespeichert hat.

## Aufbau

- `src/index.ts`: öffentliche API, Sitzung, RPC-Dispatch, Zustand der Steuerung.
- `src/transport.ts`: der WebSocket der Seite (der native Konstruktor), Heartbeat-Timeout, exponentielles Backoff und nach 3 fehlgeschlagenen Versuchen alle 60 s `POST /v1/presence`.
- `src/ids.ts`: deviceId / pageId / openerId.
- `src/launch.ts`: zu welchem App-Start diese Seite gehört (`launchId`, `window.RWDLaunchId`, das Cookie `rwd_launch`).
- `src/pageWatch.ts`: `page`-Nachrichten (url, title, visibility) und Ereignisse der Zeitleiste (Navigation innerhalb der Seite, Taps des Nutzers).
- `src/ui.ts`, `src/lock.ts`: Badge, Button „Unterstützung anfordern“, Sperr-Overlay, Leuchten, Aktionshervorhebung und Dialoge in einem Shadow DOM; blockiert die vertrauenswürdigen Eingaben des Nutzers, solange ein Agent verbunden ist, und zeigt, wie lange die Verbindung schon besteht.
- `src/approval.ts`: Verbindungsfreigabe und Bestätigung sensibler Aktionen (Dialog auf der Seite oder der native Host über `nativeDecide`).
- `src/i18n.ts`, `src/locales/`, `src/localeLoader*.ts`: Sprachpakete (UI-, Aktions- und Agent-Texte pro Sprache), Auswahl und Rückfall, Nachladen bei Bedarf; `scripts/locales.mjs` baut `dist/locales/<id>.js`.
- Die Agent-Engine liegt neben chobitsu in `packages/chobitsu/src/engine/rwd/`: Snapshot, `rwd.query`, Prüfungen der Bedienbarkeit, synthetische Eingaben, Tastatur, Console- / Netzwerkpuffer, Screenshots, `rwd.storage`, das Sitzungsprotokoll in IndexedDB (`coldlog.ts`), Overlay-Erkennung (`overlays.ts`), Stufen und Bestätigungsregeln (`policy.ts`), Texte für den Agent (`i18n.ts`). Die für Snapshots verwendeten Playwright-Quellen liegen in `packages/chobitsu/src/engine/vendor/playwright/`. Der Build bündelt sie aus dem Quellcode in `dist/sdk.js`.

## Build und Tests

```sh
cd sdk
npm ci
npm run build        # dist/sdk.js (IIFE, globales RemoteWebviewDebugger, ES2017), dist/index.mjs + index.d.ts (ES-Modul)
npm run typecheck
npm test             # Playwright: WebKit (iPhone 15) + Chromium (Pixel 7)
npm run gateway      # lokales Mock-Gateway: http://localhost:8787/demo/platform/?key=rwd_pk_demo
```

Die Tests verwenden `test/mock-gateway.mjs`, das den seitenseitigen Teil des Protokolls implementiert (welcome, Zustand der Steuerung, RPCs, Presence; Tokens, Close-Codes, Stufen, Remote-Konfiguration, `agentLang`, Verbindungsfreigabe) und `/v1/sdk.js`, die Sprachpakete unter `/v1/locales/` sowie den Demo-Shop ausliefert. Es prüft selbst keine Stufen, sodass die Tests die Durchsetzung durch die Seite selbst prüfen. Die Specs in `test/e2e/` laufen mit einem `zh-CN`-Browser und `agentLang: 'zh'`, sofern ein Test nichts anderes vorgibt; `i18n.spec.ts` deckt Englisch ab, `locales.spec.ts` die übrigen Sprachpakete, Rückfall, eigene Pakete, Styling und das Layout von rechts nach links. Der Koexistenztest lädt eruda 3.4.3 und PageSpy 2.4.0 von jsdelivr und braucht daher Internetzugang.
