import type { Dict } from './en.ts'

// Deutsche Texte. Struktur identisch mit en.ts.

export const de: Dict = {
  meta: {
    title: 'Remote WebView Debugger – KI-Agenten debuggen WebViews auf echten Smartphones',
    description:
      'Open Source, selbst gehostet: Ein Script genügt, und Claude Code, Codex, Cursor oder jeder andere MCP-Client kann H5-Seiten und App-WebViews auf den Smartphones Ihrer Nutzer ansehen und bedienen – nach Zustimmung des Nutzers, mit Maskierung und einer Taste zum Übernehmen. Kein USB-Kabel, kein Debugging-Port.',
    ogTitle: 'Remote WebView Debugger',
    ogDescription:
      'Lassen Sie Ihren KI-Agenten die WebView auf dem Smartphone Ihres Nutzers debuggen. Ein Script, ein Gerätecode, eine MCP-Adresse. Open Source.',
  },
  nav: {
    skip: 'Zum Inhalt springen',
    demo: 'Demo',
    live: 'Selbst testen',
    how: 'So funktioniert es',
    features: 'Funktionen',
    highlights: 'Highlights',
    privacy: 'Datenschutz',
    selfHost: 'Selbst hosten',
    faq: 'FAQ',
    github: 'GitHub',
    menu: 'Menü',
    themeToggle: 'Farbschema wechseln',
    langLabel: 'Sprache',
  },
  hero: {
    eyebrow: 'Open Source · MIT · MCP',
    titleHtml: 'Lassen Sie Ihren KI-Agenten die WebView <em>auf dem Smartphone Ihres Nutzers</em> debuggen.',
    sub:
      'Ein Script in Ihre H5-Seite oder in die WebView Ihrer App. Ihr Nutzer liest einen kurzen Gerätecode vor, und Claude Code, Codex, Cursor oder jeder andere MCP-Client sieht die Seite, liest Console und Netzwerk und klickt sich zum Bug durch – während der Nutzer zusieht und jederzeit übernehmen kann.',
    ctaDemo: 'Demo ansehen',
    ctaLive: 'Mit Ihrem Agenten testen',
    ctaGithub: 'Star auf GitHub',
    ctaSelfHost: 'In 5 Minuten selbst hosten',
    points: ['Kein USB-Kabel', 'Kein Remote-Debugging-Port', 'Kein App-Rebuild, nur ein Script', 'Greift auch nach dem Bug noch'],
    /** Figures under the hero (the numbers are the same in every language). */
    stats: [
      { value: '34', label: 'MCP-Tools' },
      { value: '11', label: 'Sprachen' },
      { value: '1', label: 'Script zum Einbinden' },
      { value: '0', label: 'USB-Kabel' },
    ],
    /** The one-liner under the buttons. */
    installLabel: 'In Ihre Seite einbinden',
    flow: {
      label:
        'Ein KI-Agent spricht MCP mit Ihrem selbst gehosteten Gateway, und dieses erreicht das Seiten-SDK auf dem Smartphone des Nutzers über einen WebSocket.',
      agent: 'KI-Agent',
      agentSub: 'Claude Code · Codex · Cursor · jeder MCP-Client',
      gw: 'Gateway',
      gwSub: 'selbst gehostet · Freigabe · Audit',
      phone: 'Smartphone des Nutzers',
      phoneSub: 'H5-Seite / App-WebView + SDK',
      mcp: 'MCP · HTTPS',
      ws: 'WebSocket',
      state: 'KI steuert',
    },
  },
  demo: {
    kicker: 'Live-Demo',
    title: 'Ein echter Bug, behoben auf einem „echten“ Smartphone',
    lead:
      'Das Smartphone in dieser Demo führt das echte Seiten-SDK in einem Demo-Shop aus. Sein Gateway ist in Ihrem Browser nachgebildet, es verlässt also nichts diesen Tab – aber jeder Snapshot, jeder Klick, jede Console-Zeile und jeder Live-Patch weiter unten ist echt.',
    agentTitle: 'KI-Agent',
    agentSub: 'mit dem MCP-Server von Remote WebView Debugger verbunden',
    skinLabel: 'Agent-Stil',
    skinClaude: 'Claude Code',
    skinCodex: 'Codex',
    /** The two ways to use the demo: one phone, two modes. */
    modeLabel: 'Demo-Modus',
    modeWatch: 'Einem Agenten beim Bugfix zusehen',
    modeWatchSub: 'Geskriptet · läuft in Ihrem Browser',
    modeTry: 'Mit Ihrem Agenten ausprobieren',
    modeTrySub: 'Echtes Gateway · Ihr eigener Key',
    phoneLabel: 'Smartphone des Kunden',
    play: 'Abspielen',
    pause: 'Pause',
    restart: 'Neu starten',
    speed: 'Geschwindigkeit',
    start: 'Demo starten',
    startHint:
      'Sehen Sie zu, wie sich ein Agent mit dem Smartphone verbindet, einen Checkout-Bug reproduziert, die Ursache findet und die Lösung live verifiziert.',
    expand: 'Vollständiges Ergebnis zeigen',
    collapse: 'Einklappen',
    running: 'läuft',
    done: 'Fertig',
    error: 'Fehler',
    you: 'Support',
    agent: 'Agent',
    customer: 'Kunde',
    /** The hand that points at “Allow” when nobody taps it. */
    guideTap: 'Auf „Zulassen“ tippen',
    guideAuto: (s: number) => `automatisch in ${s} s`,
    footnote:
      'Läuft vollständig in Ihrem Browser: das echte SDK (<code>sdk.js</code>) in einem iframe, ein WebSocket-Shim, der zu einem Mock-Gateway in der Seite tunnelt, und ein skriptgesteuerter Agent, der echte RPCs schickt. Die Nachrichten des Agenten folgen der Sprache der Seite; Tool-Ergebnisse erscheinen in der Sprache des Gateways (Englisch oder Chinesisch).',
    stateIdle: 'Bereit',
    statePrelude: 'Der Kunde stößt auf den Bug',
    stateRunning: 'Agent arbeitet',
    statePaused: 'Pausiert',
    stateWaitApproval: 'Warten auf die Freigabe des Kunden',
    stateWaitControl: 'Warten darauf, dass der Kunde zurückgibt',
    stateDone: 'Fertig',
    stateStopped: 'Gestoppt',
  },
  live: {
    kicker: 'Selbst ausprobieren',
    title: 'Jetzt mit Ihrem eigenen Agenten',
    lead:
      'Diese hier ist echt: ein öffentliches Demo-Gateway auf <code>demo.debugger.site</code>, von allem anderen getrennt und täglich geleert. Der Shop im Smartphone wird von dort geladen – holen Sie sich einen Key, richten Sie Ihren Agenten darauf und sehen Sie ihm direkt hier bei der Arbeit zu.',
    steps: [
      {
        title: 'Einen eigenen Key holen',
        body: 'Ein Klick, keine Anmeldung. Der Key gilt nur auf dem Demo-Gateway und bis die Demo neu beginnt.',
      },
      {
        title: 'Das Demo-Gateway zu Ihrem Agenten hinzufügen',
        body:
          'Führen Sie den Befehl einmal im Terminal aus, oder tragen Sie ihn in die Einstellungen Ihres MCP-Clients ein. Der Key ist schon eingesetzt.',
      },
      {
        title: 'Fragen Sie Ihren Agenten',
        body:
          'Der Gerätecode des Shops im Smartphone steht schon im Prompt. Wenn der Agent um Zugriff bittet, tippen Sie im Shop auf <em>Zulassen</em> und sehen ihm zu; <em>Übernehmen</em> oder <em>Beenden</em> geht jederzeit.',
      },
    ],
    phoneTitle: 'Der Demo-Shop, live',
    phoneHint:
      'Das ist <code>demo.debugger.site</code> selbst, mit dem echten SDK. Scannen Sie den Code, um den Shop stattdessen auf Ihrem Smartphone zu öffnen.',
    open: 'In neuem Tab öffnen',
    scan: 'Scannen, um es auf dem Smartphone zu öffnen',
    tabsLabel: 'MCP-Konfiguration für die Demo',
    getKey: 'Meinen Key holen',
    keyIdle: 'Holen Sie sich einen Key, dann steht er im Befehl unten.',
    keyLoading: 'Ihr Key wird geholt…',
    keyReady:
      'Ihr eigener Key ist eingesetzt. Er hört auf zu funktionieren, sobald die Demo neu beginnt (täglich um 04:00 UTC+8); kommen Sie dann für einen neuen zurück.',
    keyFailed: 'Das Demo-Gateway ist gerade nicht erreichbar; bitte versuchen Sie es später erneut.',
    keyLimited: 'Zu viele Keys aus Ihrem Netzwerk; bitte versuchen Sie es in einer Stunde erneut.',
    deviceWaiting: 'Warten, bis der Shop online ist…',
    deviceReady: (code: string) => `Der Gerätecode dieser Seite ist ${code} – er steht schon im Prompt.`,
    deviceUnavailable: 'Der Shop hat keinen Gerätecode gemeldet; lesen Sie ihn aus dem Badge im Shop ab.',
    prompt:
      'Verwende den MCP-Server rwd-demo und verbinde dich mit Gerät XXXX-XXXX. Wähle im Shop bei einem Produkt die Geschenkverpackung, gehe zum Checkout und finde heraus, warum die Gesamtsumme „--“ anzeigt.',
    promptLabel: 'Prompt',
    promptNote: 'Ersetzen Sie <code>XXXX-XXXX</code> durch den Code, der im Shop steht.',
    limitsTitle: 'Grenzen der Demo',
    limits: [
      'Ein Key pro Besucher: Ihr Agent erreicht nur die Seite, deren Code Sie ihm geben, und erst nachdem Sie zugestimmt haben',
      'Nur Stufe <strong>interact</strong>: keine Skripte, keine Request-Bodys, kein Speicher',
      'Ein Agent belegt eine Seite höchstens 15 Minuten (5 im Leerlauf)',
      '120 MCP-Anfragen pro Minute und IP',
      'Täglich um 04:00 (UTC+8) geleert – geben Sie keine echten personenbezogenen Daten ein',
    ],
  },
  how: {
    kicker: 'So funktioniert es',
    title: 'In drei Schritten von „auf meinem Handy geht es nicht“ zur Ursache',
    steps: [
      {
        title: 'Das Seiten-SDK einbinden',
        body:
          'Ein Script in <code>&lt;head&gt;</code>, so früh wie möglich, damit Console und Netzwerk ab der ersten Zeile aufgezeichnet werden. In einer App injizieren Sie dasselbe Script bei Dokumentbeginn.',
      },
      {
        title: 'Der Nutzer gibt seinen Gerätecode weiter',
        body:
          'Jedes Smartphone hat einen festen Code wie <code>K7Q2-9M4X</code> in einem kleinen Badge. Nutzer können auf <em>Unterstützung anfordern</em> tippen, und das Gerät springt an die Spitze der Liste des Agenten.',
      },
      {
        title: 'Ihr Agent verbindet sich über MCP',
        body:
          'Tragen Sie die MCP-Adresse Ihres Gateways mit einem API-Key ein. Dann beschreiben Sie einfach das Problem – der Agent findet das Gerät, bittet um Freigabe und fängt an.',
      },
    ],
    pill: { code: 'K7Q2-9M4X', online: 'Online', help: 'Unterstützung anfordern' },
    chip1: 'sdk.js vom CDN · Console und Netzwerk ab Zeile eins',
    chip3: 'auf dem Smartphone freigegeben · Stufe interact',
    prompt: 'Gerät K7Q2-9M4X kommt nicht durch den Checkout – die Gesamtsumme zeigt „--“. Finde heraus, warum.',
    tabsLabel: 'Konfiguration des MCP-Clients',
    sdkNote:
      'Pinnen Sie in Produktion eine Version, oder nutzen Sie die eigene Kopie Ihres Gateways unter <code>/v1/sdk.js</code> (mit SRI aus der Konsole).',
  },
  features: {
    kicker: 'Was der Agent bekommt',
    title: 'Der DevTools-Workflow, über MCP, auf dem Smartphone eines anderen',
    items: [
      { icon: 'tree', title: 'Barrierefreiheits-Snapshots', body: 'YAML im Playwright-Stil mit Element-Refs. Der Agent liest die Seite als Struktur, nicht als Pixel – und handelt über Refs.' },
      { icon: 'cursor', title: 'Echte Interaktionen', body: 'Klicken, Ausfüllen, Tippen, Tastendrücke, Auswählen, Hover, Scrollen, Ziehen – mit Prüfung der Bedienbarkeit und Events, die React und Vue akzeptieren.' },
      { icon: 'terminal', title: 'Console und Netzwerk', body: 'Ab dem Laden der Seite in begrenzten Puffern aufgezeichnet, sodass Fehler von vor der Verbindung noch da sind. Bodys auf Anfrage.' },
      { icon: 'layers', title: 'Seitenübergreifende Sitzungen', body: 'Liste → Detail → Checkout oder eine zweite WebView: Alle Seiten eines Geräts bilden eine Sitzung, mit seitenübergreifender Zeitleiste.' },
      { icon: 'bell', title: 'Sitzungsänderungen, automatisch', body: 'Jedes Tool-Ergebnis endet mit dem, was sich geändert hat – neue Seite, Navigation, ein Fehler, eine Übernahme durch den Nutzer. Kein Polling.' },
      { icon: 'list', title: 'Aufgabenkarte auf dem Smartphone', body: 'Der Agent zeigt Plan und Fortschritt auf dem Gerät, damit der Nutzer immer weiß, was er tut und warum.' },
      { icon: 'camera', title: 'Screenshots', body: 'Echte Pixel, wenn die App eine Brücke bereitstellt, sonst eine DOM-Nachbildung. Die Maskierung gilt für beides.' },
      { icon: 'scroll', title: 'Sitzungsprotokoll auf dem Gerät', body: 'Seiten, Tipper, Console und jede Anfrage seit dem Start der App, auf dem Smartphone in IndexedDB – auch im Nachhinein lesbar.' },
      { icon: 'wrench', title: 'Live-Patches', body: 'Auf der Stufe advanced kann der Agent die laufende Seite mit <code>evaluate_script</code> patchen und eine Lösung sofort verifizieren.' },
      { icon: 'wifi', title: 'Schlechte Netze', body: 'Ein leichter Heartbeat mit Back-off; nach drei Fehlversuchen ein Presence-Poll einmal pro Minute, und das Gateway weckt die Seite, wenn es nötig ist.' },
      { icon: 'globe', title: '11 Sprachen', body: 'Smartphone-Oberfläche, Console und Texte für den Agenten in 11 Sprachen, inklusive Arabisch von rechts nach links. Eigene Sprachpakete und Formulierungen möglich.' },
      { icon: 'plug', title: 'Jeder MCP-Client', body: 'Streamable HTTP unter <code>/v1/mcp</code> für Claude Code, Codex, Cursor und Co.; für alles andere eine winzige stdio-Brücke.' },
    ],
    toolsTitle: 'Alle Tools',
  },
  highlights: {
    kicker: 'Highlights',
    title: 'Gemacht für die Bugs, die nur draußen auftreten',
    lead: 'Drei Dinge, die Ihnen ein Kabel, ein Remote-Debugging-Port oder eine Bildschirmaufnahme nicht geben.',
    items: [
      {
        title: 'Der Bug ist schon passiert? Das Protokoll liegt noch auf dem Smartphone.',
        body:
          'Ab dem Moment, in dem die App startet, schreibt das SDK ein Sitzungsprotokoll in die IndexedDB des Geräts: besuchte Seiten, Tipper und Eingaben des Nutzers, Console-Ausgaben und jede Anfrage – fehlgeschlagene mit Headern und Bodys. Nichts wird irgendwohin gestreamt; es bleibt auf dem Smartphone, unter denselben Maskierungsregeln, bis ein Agent, den der Nutzer freigegeben hat, es mit <code>get_session_overview</code> und <code>get_session_log</code> abruft. Die letzten drei Starts bleiben erhalten, je bis zu 10 MB.',
        tag: 'Sitzungsprotokoll · Kaltspeicher auf dem Gerät',
        visual: {
          title: 'rwd-log · Start 3 von 3',
          rows: ['09:41:02  öffnen  index.html', '09:41:09  tippen  „Gift box“', '09:41:11  tippen  Buy now', '09:41:12  Fehler  TypeError: order.price.toFixed…', '09:41:13  Netz    GET api/coupon → 404', '09:52:30  agent   verbunden (interact)', '09:52:31  lesen   get_session_log'],
        },
      },
      {
        title: 'Verifizieren Sie die Lösung auf dem Smartphone des Kunden, bevor Sie ausliefern.',
        body:
          'Mit der <strong>advanced</strong>-Freigabe des Nutzers läuft <code>evaluate_script</code> in der Seite – der Agent kann also einen falschen Zustand korrigieren, eine Funktion überschreiben oder eine Ansicht neu rendern und das Ergebnis auf dem echten Gerät sehen: ein Live-Patch, der die Diagnose beweist. Er lebt nur im Speicher dieser Seite; nichts wird persistiert, und sensible Klicks brauchen weiterhin das Ja des Nutzers.',
        tag: 'Live-Patch · evaluate_script',
        visual: {
          title: 'checkout.html · live',
          before: 'Total  --',
          after: 'Total  $208.00',
          code: 'order.price = Number(order.price)',
        },
      },
      {
        title: 'Für Agenten gemacht, nicht für einen Menschen mit DevTools.',
        body:
          'Jedes Tool-Ergebnis endet mit dem, was sich seit dem letzten Aufruf auf dem Gerät geändert hat, der Agent muss also nie pollen. Seiteninhalte werden als nicht vertrauenswürdige Daten übergeben. Eine Aufgabenkarte auf dem Smartphone zeigt den Plan des Agenten, und das Gateway spricht die Sprache des Agenten – Tool-Beschreibungen und Ergebnisse in 11 Sprachen.',
        tag: 'Agent-native · MCP',
        visual: {
          title: 'Tool-Ergebnis · Ende',
          rows: ['[Sitzungsänderungen]', '- p2 „Checkout“ geöffnet (Vordergrund)', '- p1 Console-Fehler: TypeError …', '- der Nutzer hat übernommen'],
        },
      },
    ],
  },
  privacy: {
    kicker: 'Datenschutz und Kontrolle',
    title: 'Das Smartphone des Nutzers bleibt das Smartphone des Nutzers',
    lead: 'Remote-Debugging funktioniert nur mit Vertrauen. Jede Sitzung ist sichtbar, freigegeben und jederzeit unterbrechbar.',
    items: [
      { title: 'Erst die Freigabe', body: 'Ein Agent bittet um Zugriff; der Nutzer sieht, wer fragt, und wählt die Stufe auf dem Smartphone. Nur echte Tipper zählen – ein Script kann sich nicht selbst freigeben.' },
      { title: 'Jederzeit übernehmen oder beenden', body: 'Während der Agent arbeitet, ist die Seite hinter einem leuchtenden Rand gesperrt. Ein Tipp auf <em>Übernehmen</em> pausiert den Agenten, <em>Beenden</em> trennt ihn.' },
      { title: 'Maskiert von Haus aus', body: 'Passwörter und alles, was mit <code>data-rwd-mask</code> markiert ist, erscheinen in Snapshots, Screenshots, Console, Netzwerkdaten und im Sitzungsprotokoll als <code>••••</code>. Selektoren und Regex-Muster lassen sich pro Projekt ergänzen.' },
      { title: 'Sensible Klicks brauchen ein Ja', body: 'Markieren Sie Schaltflächen mit <code>data-rwd-confirm</code> („Bestellung absenden“, „Konto löschen“), und der Nutzer bestätigt jeden Klick des Agenten darauf.' },
      { title: 'Zugriffsstufen', body: '<strong>observe</strong> liest, <strong>interact</strong> bedient, <strong>advanced</strong> ergänzt Skripte, Request-Bodys und Speicher. Pro Key und pro Projekt begrenzbar.' },
      { title: 'Audit-Log', body: 'Jede Verbindung, Freigabe, jeder RPC und jede Übernahme wird mit wer, was und wann festgehalten – niemals Seiteninhalte oder Parameterwerte.' },
    ],
    levels: [
      { name: 'observe', tools: 'Snapshots, Screenshots, Console, Netzwerkliste, Sitzungsprotokoll, Suchen, Warten' },
      { name: 'interact', tools: '+ Klicken, Ausfüllen, Tippen, Tastendrücke, Auswählen, Hover, Scrollen, Ziehen, Navigieren' },
      { name: 'advanced', tools: '+ evaluate_script (Live-Patches), Request- und Response-Bodys, Speicher' },
    ],
  },
  native: {
    kicker: 'Native Apps',
    title: 'In Ihrer App ist es ein User-Script',
    lead:
      'Laden Sie das SDK einmal herunter und injizieren Sie es bei Dokumentbeginn – WKUserScript auf iOS, addDocumentStartJavaScript auf Android. An Ihren Webseiten ändert sich gar nichts.',
    extras: [
      { title: 'Überall ein Gerätecode', body: 'Übergeben Sie eine feste <code>deviceId</code> (und behalten Sie den <code>deviceToken</code>), dann bleibt der Code über WebViews und Domains hinweg gleich.' },
      { title: 'Native Bedienelemente', body: 'Zeigen Sie mit <code>nativeControl()</code> Ihre eigenen Schaltflächen zum Übernehmen, Zurückgeben und Beenden; Seiten-Scripts können die Funktion nicht aufrufen.' },
      { title: 'Native Freigabedialoge', body: '<code>nativeApproval: true</code> übergibt Zugriffsanfragen und Bestätigungen an die Oberfläche Ihrer eigenen App.' },
      { title: 'Screenshots mit echten Pixeln', body: 'Eine kleine Brücke (WKWebView-Snapshot, Android-Bitmap) liefert dem Agenten echte Pixel statt einer DOM-Nachbildung.' },
    ],
    tabs: { ios: 'iOS (Swift)', android: 'Android (Kotlin)', h5: 'H5-Seite' },
  },
  selfHost: {
    kicker: 'Selbst gehostet',
    title: 'Ein Go-Binary. Ihre Server. Ihre Daten.',
    lead:
      'Das Gateway enthält die Web-Konsole und das Seiten-SDK. SQLite von Haus aus, Postgres wenn Sie es brauchen, Docker Compose und Caddy für HTTPS.',
    points: [
      { title: 'Konsole', body: 'Geräte, API-Keys, Mitglieder und Rollen, Einladungen per QR-Code, Richtlinien und ein Audit-Log – plus eine Integrationsanleitung, in der Ihre eigenen Keys schon eingesetzt sind.' },
      { title: 'Datenbank', body: 'Standardmäßig eine SQLite-Datei; mit <code>RWD_DATABASE_URL=postgres://…</code> nutzen Sie Postgres.' },
      { title: 'Betrieb', body: 'Prometheus-Metriken unter <code>/v1/metrics</code>, versionierte SDK-Adressen mit SRI, Health-Check unter <code>/v1/healthz</code>.' },
    ],
    stepsTitle: 'Schnellstart',
    dockerComment: '# ein Container: Konsole + Gateway + SDK',
    deployComment: '# oder selbst bauen, ausliefern und HTTPS von Caddy bekommen',
    resultComment: '# → Konsole  https://rwd.example.com\n# → Gateway  https://rwd.example.com/v1  (MCP unter /v1/mcp)',
    requires: 'Auf dem Server braucht es nur Docker; zum Bauen aus dem Quellcode Go und Node.',
    docsLink: 'Deployment-Anleitung',
  },
  faq: {
    kicker: 'FAQ',
    title: 'Häufige Fragen',
    items: [
      {
        q: 'Muss der Nutzer etwas installieren?',
        a: 'Nein. Bei H5-Seiten ist das SDK Teil Ihrer Seite. In einer App injizieren Sie es aus nativem Code. Der Nutzer sieht nur ein kleines Badge mit seinem Gerätecode und, wenn sich ein Agent verbinden will, einen Freigabedialog.',
      },
      {
        q: 'Was kann der Agent sehen und tun?',
        a: 'Nur das, was der Nutzer freigegeben hat: die WebView-Seiten dieses Geräts, auf der gewährten Stufe. Außerhalb der WebView steuert er nichts. Maskierte Felder bleiben maskiert, und Seiteninhalte gehen als nicht vertrauenswürdige Daten an das Modell.',
      },
      {
        q: 'Der Bug ist passiert, bevor sich der Agent verbunden hat. Ist er verloren?',
        a: 'Nein. Das SDK führt ab dem Start der App ein Sitzungsprotokoll auf dem Gerät – Seiten, Tipper, Console und Anfragen –, sodass ein Agent, der sich später verbindet, mit <code>get_session_log</code> den ganzen Weg zum Bug nachlesen kann. Ansonsten verlässt es das Smartphone nie.',
      },
      {
        q: 'Kann der Agent den Bug auf dem Smartphone beheben?',
        a: 'Er kann eine Lösung verifizieren: Auf der Stufe <strong>advanced</strong> patcht <code>evaluate_script</code> die laufende Seite im Speicher – Zustand korrigieren, eine Funktion überschreiben, neu rendern – und der Agent sieht, ob das Problem verschwindet. Die echte Lösung geht weiterhin durch Ihr normales Release; auf dem Gerät wird nichts persistiert.',
      },
      {
        q: 'Welche Agenten funktionieren damit?',
        a: 'Jeder MCP-Client. Claude Code, Codex und Cursor nutzen die gehostete Streamable-HTTP-Adresse direkt; Clients, die nur stdio sprechen, verwenden <code>rwd mcp</code>, eine kleine Brücke zur selben Adresse.',
      },
      {
        q: 'Welche Plattformen werden unterstützt?',
        a: 'Jede moderne mobile WebView und jeder moderne Browser: WKWebView auf iOS, Android System WebView, App-interne Browser und einfach Safari oder Chrome auf dem Smartphone. Desktop-Browser funktionieren ebenfalls.',
      },
      {
        q: 'Was ist bei schlechten Netzen oder blockierten WebSockets?',
        a: 'Die Seite hält einen leichten Heartbeat-WebSocket mit exponentiellem Back-off. Kommt sie dreimal in Folge nicht durch, fällt sie auf einen Presence-Poll einmal pro Minute zurück, und das Gateway weckt sie, wenn sich ein Agent verbinden will.',
      },
      {
        q: 'Verlangsamt es meine Seite?',
        a: 'Es ist ein Script. Console- und Netzwerk-Aufzeichnungen liegen in begrenzten Ringpuffern (je 500 Einträge, Response-Bodys auf 5 MB begrenzt), das Sitzungsprotokoll wird im Hintergrund geschrieben, und eine untätige Verbindung tauscht nur Heartbeats aus.',
      },
      {
        q: 'Funktioniert es neben eruda, vConsole oder PageSpy?',
        a: 'Ja – Snapshots und Hit-Testing überspringen ihre Knoten, unser eigener Verkehr bleibt aus ihren Netzwerk-Logs heraus, und es kann sogar als Tab in eruda leben.',
      },
      {
        q: 'Ist die Demo oben echt?',
        a: 'Das SDK ist echt und unverändert; nur das Gateway ist in Ihrem Browser simuliert. Ein WebSocket-Shim tunnelt die Verbindung des SDK per <code>postMessage</code> dorthin, und ein skriptgesteuerter Agent schickt dieselben RPCs wie ein echtes Gateway. Für die echte Strecke von Anfang bis Ende <a href="#live">testen Sie es mit Ihrem eigenen Agenten</a>.',
      },
    ],
  },
  footer: {
    tagline: 'Lassen Sie KI-Agenten H5-Seiten und App-WebViews auf echten Smartphones debuggen.',
    project: 'Projekt',
    docs: 'Dokumentation',
    languages: 'Sprachen',
    links: {
      github: 'GitHub',
      issues: 'Issues',
      license: 'MIT-Lizenz',
      protocol: 'Protokoll',
      gateway: 'Gateway',
      sdk: 'Seiten-SDK',
      architecture: 'Architektur',
      native: 'Native Integration',
    },
    note: 'Veröffentlicht unter der MIT-Lizenz. Keine Cookies, kein Tracking.',
  },
  notFound: {
    title: 'Seite nicht gefunden',
    body: 'Diese Seite gibt es nicht – vielleicht ist das Gerät offline gegangen.',
    home: 'Zurück zur Startseite',
  },
  copy: { copy: 'Kopieren', copied: 'Kopiert' },
}
