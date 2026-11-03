import type { docs as en } from '../en/docs'

export const docs: typeof en = {
  toc: {
    label: 'Inhalt',
    overview: 'So funktioniert es',
    concepts: 'Grundbegriffe',
    quickstart: 'Schnellstart in fünf Schritten',
    h5: 'H5-Seite integrieren',
    native: 'Native App integrieren',
    mcp: 'KI-Agent verbinden (MCP)',
    tools: 'MCP-Tools',
    approval: 'Freigabe, Übernahme und Bestätigung',
    verify: 'Checkliste zur Überprüfung',
    troubleshoot: 'Fehlerbehebung',
  },
  anchorLabel: (title) => `Link zu „${title}“`,

  hero: {
    eyebrow: (brand) => `Integrationsanleitung · ${brand}`,
    title: 'Vom ersten Script-Tag bis zur KI, die Seiten auf den Telefonen Ihrer Nutzer debuggt',
    body: 'Der gesamte Ablauf: das SDK in Ihre Seite oder App einbinden, ein Gerät online bringen, einen API-Key erstellen und das Gateway in Claude Code oder einem anderen MCP-Client hinzufügen, dann Freigabe, Übernahme und Fehlerbehebung. Die Codebeispiele verwenden bereits Ihre Gateway-URL; wählen Sie ein Projekt, um dessen App-Key einzusetzen.',
  },

  personalize: {
    gateway: 'Gateway-URL',
    gatewayHint: 'GATEWAY im Code',
    project: 'Projekt',
    projectHint: 'Setzt den App-Key unten',
    selectProject: 'Projekt wählen',
    disabledSuffix: ' (deaktiviert)',
    noProjects: 'Noch keine Projekte. Erstellen Sie eines',
    appKey: 'App-Key',
    appKeyHint: 'Öffentlich, nur für Geräte',
  },

  overview: {
    lead: 'Das SDK in Ihrer Seite baut eine ausgehende Verbindung zum Gateway auf; KI-Agents nutzen den MCP-Endpunkt des Gateways, um Geräte zu finden, sich mit ihnen zu verbinden und die Seite zu steuern. Nutzer sehen immer, was die KI tut, und können jederzeit übernehmen oder die Sitzung beenden.',
    device: 'Gerät',
    deviceSub: 'App-WebView / H5-Seite + SDK',
    gateway: 'Remote Debugger Gateway',
    gatewaySub: 'Präsenz, Freigabe, Berechtigungen, Audit',
    agent: 'KI-Agent',
    agentSub: 'Claude Code, Cursor und weitere',
    console: 'Konsole (Sie sind hier): Geräte, Projekte, Keys, Richtlinien und Audit-Log',
    noPorts:
      'Ihre Seite öffnet keine Ports: Das SDK verbindet sich per WebSocket ausgehend mit dem Gateway und weicht, wenn das nicht geht, auf HTTP-Polling alle 60 Sekunden aus.',
    oneKey:
      'Ein API-Key sieht jedes Gerät am Gateway, daher genügt ein einziger MCP-Server. Standardmäßig tippt der Nutzer auf dem Gerät auf „Zulassen“, bevor sich ein Agent verbindet, und die Zugriffsstufe begrenzt, was der Agent tun kann.',
    masking:
      'Passwortfelder und maskierte Inhalte erscheinen in Snapshots, Screenshots und Logs als <c>••••</c>; der Originaltext verlässt die Seite nie.',
  },

  concepts: {
    head: ['Begriff', 'Was es ist', 'Format / Beispiel'],
    gateway: 'Gateway',
    gatewayBody: 'Der Remote-Debugger-Dienst auf Ihrem Server. Alle Endpunkte liegen unter seinem /v1.',
    project: 'Projekt',
    projectBody:
      'Eine Integrationsquelle (eine App, eine Website oder eine ihrer H5-Codebasen) mit eigenem App-Key und eigener Richtlinie. Geräte und API-Keys gehören zu keinem Projekt.',
    projectExample: 'Shop-App',
    appKey: 'App-Key',
    appKeyBody: 'In die Seite eingebettet, um Geräte online zu bringen. Öffentlich; kann keine Geräte steuern.',
    appKeyFormat: 'rwd_pk_ + 24 Zeichen',
    apiKey: 'API-Key',
    apiKeyBody:
      'Ermöglicht KI-Agents, sich über MCP mit Geräten zu verbinden. Gehört zum gesamten Gateway, nicht zu einem Projekt. Wird nur einmal angezeigt; unterstützt eine maximale Stufe, einen Ablauf und eine IP-Zulassungsliste.',
    apiKeyFormat: 'rwd_sk_live_ + 32 Zeichen',
    device: 'Gerät',
    deviceBody:
      'Ein Telefon (eine deviceId). Alle Seiten auf einem Gerät bilden eine Debugging-Sitzung und können aus verschiedenen Projekten stammen.',
    deviceCode: 'Gerätecode',
    deviceCodeBody:
      'Ein kurzer, dauerhafter Code, den das Gateway jedem Gerät zuweist. Nutzer lesen ihn dem Support vor; Sie geben ihn an den Agent weiter.',
    page: 'Seite',
    pageBody: 'Eine Seite oder WebView auf dem Gerät mit laufendem SDK, nummeriert in der Reihenfolge des Öffnens.',
    pageFormat: 'p1, p2…',
    approval: 'Freigabe',
    approvalBody:
      'Wenn das Projekt einer Seite auf dem Gerät sie aktiviert, bestätigt der Nutzer auf dem Gerät, bevor sich ein Agent verbindet, und wählt, wie viel Zugriff er gewährt.',
    level: 'Zugriffsstufe',
    levelBody:
      'Was eine Verbindung tatsächlich darf: das Minimum aus der vom Agent angeforderten Stufe, dem Maximum des Keys, dem Maximum des Projekts jeder Seite auf dem Gerät und der vom Nutzer zugelassenen Stufe.',
  },

  quickstart: {
    lead: 'Ihre erste Integration dauert etwa 5 Minuten, wenn Sie diese Schritte der Reihe nach befolgen.',
    projectTitle: 'Projekt erstellen und App-Key erhalten',
    projectBody:
      'Erstellen Sie eines auf der Seite <link>Projekte</link>, z. B. „Shop-App“. Die erlaubten Origins können Sie vorerst leer lassen.',
    sdkTitle: 'SDK in Ihre Seite einbinden',
    sdkBody:
      'Fügen Sie auf H5-Seiten diese zwei Zeilen möglichst weit oben im <head> ein. Für WebViews in einer App empfehlen wir die Injektion aus nativem Code (siehe „Native App integrieren“).',
    onlineTitle: 'Seite öffnen und prüfen, ob das Gerät online ist',
    onlineBody:
      'Unten rechts auf der Seite erscheint ein halbtransparentes Gerätecode-Badge (bei Seiten mit eruda steckt es im Tab „Remote Debugger“ von eruda), und Sie finden das Gerät auf der Seite <link>Geräte</link> der Konsole. Öffnen Sie es und führen Sie „Verbindung testen“ aus, um zu bestätigen, dass das Gateway einen Seiten-Snapshot abrufen kann.',
    keyTitle: 'API-Key erstellen',
    keyBody: (level) =>
      `Gehen Sie in der oberen Navigation zu <link>API-Keys</link> → Erstellen. Wählen Sie eine Stufe (${level} passt meist zum Debuggen) und einen Ablauf, und kopieren Sie dann den Key <c>rwd_sk_live_…</c>, der nur einmal angezeigt wird.`,
    mcpTitle: 'Gateway in Claude Code hinzufügen und einfach fragen',
    mcpExample:
      'Zum Beispiel: „Online-Geräte auflisten, mit GSJH-EV2J verbinden und herausfinden, warum der Gesamtbetrag im Checkout -- anzeigt“.',
  },

  h5: {
    lead: 'Für eigenständige H5-Seiten oder WebViews, deren Seitencode Sie ändern können. Das SDK puffert Console- und Netzwerkaktivität ab dem Moment, in dem es lädt; laden Sie es daher synchron und möglichst früh im <head>.',
    loadTitle: 'SDK laden und starten',
    latestTab: 'Neueste',
    pinnedTab: 'Feste Version + SRI',
    latestBody: 'Lädt immer das neueste SDK vom Gateway, sodass Gateway-Upgrades automatisch wirken.',
    pinnedBody:
      'Lädt eine feste Version, und der Browser prüft die Datei anhand von <c>integrity</c> (sha384). Gut für Seiten mit strengen Sicherheitsanforderungen. Version und Integrity stammen aus <c>sdkVersion</c> und <c>sdkIntegrity</c> in <c>GET /v1/api/config</c>; aktualisieren Sie sie bei einem Gateway-Upgrade.',
    optionsTitle: 'Optionen von run()',
    optionsIntro:
      '<c>RemoteWebviewDebugger.run(gatewayUrl, appKey, options?)</c> gibt <c>Promise<{deviceCode, status}></c> zurück; ein erneuter Aufruf hat keine Nebenwirkungen.',
    optionsHead: ['Option', 'Beschreibung'],
    options: {
      userId:
        'Der angemeldete Nutzer. Konsole und Agents können Geräte nach Nutzer suchen; rufen Sie setUser() auf, wenn sich der Anmeldestatus ändert.',
      helpButton:
        'Zeigt den Button „Unterstützung anfordern“; tippt der Nutzer darauf, wird das Gerät in der Konsole als „In Betreuung“ markiert. ODER-verknüpft mit dem Unterstützungs-Button der Projektrichtlinie.',
      app: 'Infos zur Host-App <c>{ name, version }</c>, angezeigt in der Geräteliste.',
      deviceId:
        'Wird bei nativer Injektion von der App übergeben, damit es über WebViews und Domains hinweg dasselbe Gerät bleibt. Auf reinen H5-Seiten erzeugt das SDK eine und speichert sie in localStorage.',
      nativeKey:
        'Ein von der App erzeugtes zufälliges Geheimnis, das nur im injizierten Skript vorkommt. nativeControl / nativeDecide benötigen es.',
      deviceToken:
        'Ein vom Gateway ausgestelltes Geräte-Token. localStorage gilt pro Origin, daher muss die App es speichern und auf jeder Seite wieder übergeben (siehe unten).',
      nativeApproval:
        'Bei true zeichnet das SDK keine Freigabe- / Bestätigungsdialoge; die App liest status().pending und zeigt stattdessen native Dialoge.',
      lockScreen:
        'Ob die Seite gesperrt wird, während die KI handelt (Standard true). Nutzer können das auch im schwebenden Panel umschalten, wo sich nach einer Erklärung und der Wahl einer Zugriffsstufe auch „KI-Verbindungen automatisch zulassen“ einschalten lässt.',
      eruda:
        'eruda-Integration, standardmäßig aus. true oder { dock: true }: fügt eruda einen Tab „Remote Debugger“ hinzu, statt das schwebende Panel zu zeigen; { load: true }: lädt und initialisiert das neueste eruda, wenn die Seite keines hat. Sie können auch src (eruda-URL) und name (Tab-Name) übergeben. Über Einstellungen → eruda-Integration des Projekts lässt es sich aus der Ferne einschalten; jede hier gesetzte Option hat Vorrang.',
    },
    jsApiTitle: 'JS-API',
    statusValues:
      'Werte von <c>status().status</c>: <c>idle</c>, <c>connecting</c>, <c>online</c>, <c>polling</c> (WebSocket nicht verfügbar, Abfrage alle 60 Sekunden), <c>stopped</c>, <c>rejected</c> (Geräte-Token passt nicht), <c>quota</c> (Kontingent für Online-Geräte überschritten). <c>nativeControl()</c> und <c>nativeDecide()</c> sind für native Hosts.',
    originsTitle: 'Erlaubte Origins',
    originsBody:
      'Sobald ein Projekt erlaubte Origins hat, prüft das Gateway den Origin jeder Seite und lehnt den Handshake (403) für Seiten ab, die nicht auf der Liste stehen. Geben Sie jeden Eintrag als vollständigen Origin an, z. B. <c>https://m.example.com</c>; ein führender Platzhalter ist erlaubt, wie in <c>https://*.example.com</c> (passt auf Subdomains, nicht auf example.com selbst). Leer lassen für keine Einschränkung.',
    cspTitle: 'CSP',
    cspBody:
      'Hat die Seite eine Content-Security-Policy, erlauben Sie das Gateway für Skripte und Verbindungen (WebSocket verwendet wss://):',
    maskTitle: 'Sensible Daten maskieren und sensible Aktionen bestätigen',
    maskBody:
      '<c>input[type=password]</c> und Elemente mit <c>data-rwd-mask</c> erscheinen in Snapshots, Screenshots und der Console als <c>••••</c>. In den Einstellungen des Projekts können Sie Maskierungs-Selektoren (<c>maskSelectors</c>) und Textregeln per regulärem Ausdruck (<c>maskPatterns</c>, z. B. Telefon- oder Ausweisnummern) hinzufügen. Bevor ein Agent ein Element mit <c>data-rwd-confirm</c> (oder eines, das zu <c>confirmSelectors</c> des Projekts passt) anklickt, bittet das Gerät den Nutzer um Bestätigung.',
  },

  native: {
    lead: 'Keine Änderungen am H5-Code: Die App injiziert das SDK in jede WebView, sobald sie zu laden beginnt. Jede Seite in der App (auch Drittanbieter-Domains) wird debugbar, mit nativen Freigabedialogen, Screenshots und Übernahme-Buttons.',
    cards: [
      {
        title: 'Bei Dokumentbeginn injizieren',
        body: 'Verwenden Sie WKUserScript(.atDocumentStart) unter iOS und addDocumentStartJavaScript unter Android, damit die Aufzeichnung beginnt, bevor ein Seitenskript läuft.',
      },
      {
        title: 'Eine stabile deviceId',
        body: 'Eine pro Installation, in der App gespeichert und von allen WebViews und Domains geteilt, damit sich der Gerätecode nie ändert.',
      },
      {
        title: 'nativeKey',
        body: 'Ein zufälliges Geheimnis, das die App erzeugt und nur in das injizierte Skript schreibt. evaluate_script des Agents kann es nicht lesen, daher kann sich der Agent nicht als Nutzer ausgeben, um die Steuerung zurückzugeben oder eine Verbindung freizugeben.',
      },
      {
        title: 'deviceToken speichern',
        body: 'Lesen Sie es nach der ersten Verbindung aus status().deviceToken, speichern Sie es und injizieren Sie es ab dann in jede WebView. Ohne es weist das Gateway das Gerät mit 4401 ab.',
      },
      {
        title: 'Native Freigabe und Bestätigung',
        body: 'Setzen Sie nativeApproval: true, fragen Sie status().pending ab, zeigen Sie einen nativen Dialog und antworten Sie dann mit nativeDecide.',
      },
      {
        title: 'Native Screenshots und Buttons',
        body: 'Stellen Sie eine Screenshot-Bridge bereit, damit der Agent echte Pixel erhält; die Buttons Übernehmen / An KI zurückgeben / Beenden der Statusleiste rufen nativeControl auf.',
      },
    ],
    iosTab: 'iOS (Swift)',
    androidTab: 'Android (Kotlin, Referenz)',
    iosIntro:
      'Gekürzt aus der lauffähigen Datei <c>examples/mock-app/Sources/RWDMockApp/RWDNative.swift</c> im Repository (die Mock-App verwendet dieselbe Schnittstelle):',
    androidWarning:
      'Dies ist eine Referenzimplementierung, die nicht in einem echten Android-Projekt kompiliert wurde. Ihre Schnittstelle entspricht der iOS-Version; passen Sie sie an Ihre Projektstruktur an.',
    eventsTitle: 'Nativ zu behandelnde Ereignisse',
    eventsHead: ['Szenario', 'Was zu tun ist'],
    statusBar: 'Statusleiste',
    statusBarBody:
      'Fragen Sie <c>status()</c> ab: Ist <c>control</c> observe, zeigen Sie „KI sieht zu“; bei agent „KI steuert“ und sperren Sie die Zurück-Taste; bei user „Sie haben übernommen“.',
    attach: 'Verbindungsfreigabe',
    attachBody:
      "<c>pending.kind === 'attach'</c>: Listen Sie <c>pending.levels</c> auf (die letzte ist die vom Agent angeforderte); sobald der Nutzer eine Stufe wählt, rufen Sie <c>nativeDecide(key, requestId, level)</c> auf, oder übergeben Sie null zum Ablehnen.",
    confirm: 'Aktionsbestätigung',
    confirmBody:
      "<c>pending.kind === 'confirm'</c>: Zeigen Sie <c>pending.action</c> an (z. B. „Bestellen“ antippen); übergeben Sie <c>'allow'</c> zum Zulassen oder null zum Ablehnen.",
    control: 'Übernehmen / zurückgeben / beenden',
    controlBody:
      "<c>nativeControl(key, 'takeover' | 'handback' | 'end')</c>; gibt false zurück, wenn der Key falsch ist.",
    screenshot: 'Screenshots',
    screenshotBody:
      'Registrieren Sie unter iOS <c>webkit.messageHandlers.rwdScreenshot</c> (mit Antwort); stellen Sie unter Android <c>window.RWDAndroid.screenshot()</c> bereit. Beide geben eine JPEG/PNG-Data-URL zurück.',
    help: 'Unterstützung anfordern',
    helpBody:
      'Lassen Sie den eigenen Einstieg „Unterstützung anfordern“ der App <c>help(true)</c> aufrufen; die Projektrichtlinie kann per userId steuern, wer ihn sieht.',
  },

  mcp: {
    lead: 'Das Gateway bringt einen gehosteten MCP-Server (Streamable HTTP) unter Ihrer Gateway-URL plus /mcp mit. Jede MCP-Sitzung ist an einen API-Key gebunden und sieht jedes Gerät am Gateway: Ein MCP-Server genügt, eine Aufteilung nach Projekt ist nicht nötig.',
    keyTitle: '1. API-Key erstellen',
    keyBody:
      'Erstellen Sie einen auf der Seite <link>API-Keys</link>. Der vollständige Key wird nur einmal angezeigt, speichern Sie ihn also sofort; falls er verloren geht, widerrufen Sie ihn und erstellen Sie einen neuen.',
    keyHead: ['Einstellung', 'Beschreibung'],
    maxLevel: 'Maximale Stufe',
    maxLevelBody:
      '<observe></observe> Debuggen nur lesend <interact></interact> Probleme nachstellen (Standard) <advanced></advanced> Skripte ausführen, Request-Bodys und Speicher lesen',
    expiry: 'Ablauf',
    expiryBody:
      'Standardmäßig 90 Tage; wählbar sind 7, 30 oder 90 Tage oder nie. Nach dem Ablauf liefert MCP 401.',
    ipAllowlist: 'IP-Zulassungsliste',
    ipAllowlistBody:
      'Optional, ein CIDR pro Zeile. Wenn gesetzt, können nur diese ausgehenden IPs den Key verwenden.',
    claudeTitle: '2. In Claude Code hinzufügen',
    hostedIntro: 'Gehosteter Modus, ohne Installation (empfohlen):',
    replaceKey:
      'Ersetzen Sie <c>rwd_sk_live_…</c> durch Ihren Key. <c>--scope project</c> schreibt ihn in die <c>.mcp.json</c> des Projekts, um ihn mit dem Team zu teilen (committen Sie den Key nicht ins Repository). Die entsprechende <c>.mcp.json</c>:',
    clientsTitle: '3. Andere Clients',
    stdioTab: 'Nur-stdio-Clients',
    localTab: 'Lokale stdio-Bridge',
    cursorBody:
      'Fügen Sie es zu <c>~/.cursor/mcp.json</c> (global) oder <c>.cursor/mcp.json</c> in Ihrem Projekt hinzu. Die meisten Clients mit Remote-MCP-Unterstützung verwenden dieses Format:',
    stdioBody:
      'Clients, die nur lokale Befehle starten können (z. B. <c>claude_desktop_config.json</c> von Claude Desktop), können mit <c>rwd mcp</c> überbrücken:',
    localBody:
      '<c>rwd</c> ist das Gateway-Binary selbst (sein Unterbefehl <c>rwd mcp</c>). Es leitet nur stdio an das gehostete <c>/mcp</c> weiter und liest den Key aus der Umgebungsvariablen <c>RWD_API_KEY</c>:',
    checkTitle: '4. Verbindung prüfen',
    promptsTitle: '5. Einfach fragen',
    promptsIntro:
      'Der Agent wählt die Tools selbst: list_devices, um das Gerät zu finden, connect_device, um sich zu verbinden (und auf die Freigabe des Nutzers zu warten), dann Snapshots, Logs und Seitenaktionen. Probieren Sie zum Beispiel:',
    prompts: [
      'Online-Geräte auflisten, mit GSJH-EV2J verbinden und herausfinden, warum der Gesamtbetrag im Checkout -- anzeigt',
      'Nutzer u_20391 hat Unterstützung angefordert. Mit seinem Gerät verbinden, „Bestellen reagiert nicht“ nachstellen und die Ursache finden',
      'Nur mit „Nur ansehen“ mit K7Q2-9M4X verbinden und die Console-Fehler und fehlgeschlagenen Anfragen der aktuellen Seite zusammenfassen',
      'Auf der Produktseite die Geschenkbox-Option wählen und eine Bestellung aufgeben, um das Problem nachzustellen; Bescheid geben, wenn ich übernehmen soll',
      'Warten, bis GSJH-EV2J online ist, verbinden, die Aktionsseite öffnen und einen Gutschein einlösen, dann zurück zur Listenseite',
      'Die Zeitleiste dieses Geräts der letzten 10 Minuten ansehen und rekonstruieren, wie der Nutzer auf einer leeren Seite gelandet ist',
    ],
    copyPrompt: 'Diesen Prompt kopieren',
  },

  tools: {
    lead: 'Jedes Tool-Ergebnis endet mit den „Sitzungsänderungen“: seit dem letzten Aufruf geöffnete Seiten, Fehler, Übernahmen durch den Nutzer usw., sodass der Agent nichts verpasst, was auf dem Gerät passiert. Tools oberhalb der Stufe der Verbindung liefern einen Fehler und werden im Audit-Log erfasst.',
    groups: {
      device: 'Geräte und Verbindung',
      observe: 'Ansehen',
      interact: 'Bedienen',
      advanced: 'Erweitert',
    },
    desc: {
      listDevices: 'Geräte auflisten, die mit Unterstützungsanfrage zuerst',
      connectDevice:
        'Per Gerätecode oder deviceId verbinden; bei aktivierter Freigabe wird auf die Bestätigung des Nutzers auf dem Gerät gewartet (bis zu etwa 35 Sekunden)',
      disconnectDevice: 'Das Gerät verlassen; die Seite des Nutzers wird wieder inaktiv',
      waitForDevice: 'Warten, bis ein Gerät online ist; ein Gerät im Polling wird zum sofortigen Neuverbinden aufgefordert',
      listPages: 'Seiten auf dem Gerät: Label, Titel, URL, Vordergrund / Hintergrund, öffnende Seite',
      selectPage: 'Die Seite wechseln, auf die spätere Tools wirken (z. B. p2)',
      waitForPage: 'Warten, bis sich eine neue Seite öffnet oder zu einer Ziel-URL navigiert wird',
      waitForControl: 'Nachdem der Nutzer übernommen hat, warten, bis er die Steuerung zurückgibt',
      waitForEvent: 'Auf das nächste passende Ereignis der Zeitleiste warten (Navigation, Fehler, fehlgeschlagene Anfrage…)',
      getSessionTimeline: 'Seitenübergreifende Zeitleiste, die den Weg des Nutzers rekonstruiert',
      takeSnapshot: 'Barrierefreiheits-Snapshot der Seite (YAML) mit Element-refs für click / fill',
      takeScreenshot: 'Screenshot; echte Pixel, wenn die App eine Screenshot-Bridge bereitstellt',
      findElements: 'Elemente nach Text oder Rolle finden und refs zurückgeben; günstiger als ein vollständiger Snapshot',
      listConsoleMessages: 'Console-Logs und nicht abgefangene Fehler; scope=session umfasst alle Seiten',
      listNetworkRequests: 'fetch / XHR / WebSocket und andere Anfragen',
      waitFor: 'Warten, bis Text erscheint oder verschwindet, oder einige Sekunden warten',
      clickHover: 'Klicken / Hover. Die erste Interaktion schaltet die Seite auf „KI steuert“',
      fill: 'Leeren und ausfüllen; funktioniert mit kontrollierten Inputs in React / Vue',
      typeText: 'Zeichen für Zeichen tippen und dabei Tastaturereignisse auslösen',
      pressKey: 'Eine Taste drücken, auch Kombinationen wie Control+A',
      selectOption: 'Aus einem Dropdown auswählen',
      scrollDrag: 'Seite oder Element scrollen / ziehen',
      navigation: 'Navigieren, zurückgehen, neu laden',
      batchActions: 'Mehrere Interaktionen nacheinander ausführen und einmal antworten, um Roundtrips zu sparen',
      evaluateScript: 'JS in der Seite ausführen und JSON zurückgeben',
      getNetworkRequest:
        'Request- und Response-Header sowie Body (sensible Header maskiert, Body bis 64 KB)',
      getStorage: 'localStorage, sessionStorage oder Cookies ohne HttpOnly lesen (maskiert)',
    },
    anyLevel: 'Jede Stufe',
    anyLevelTitle: 'Auf jeder Stufe verfügbar',
    effectiveLevel:
      'Wirksame Stufe einer Verbindung = min(die vom Agent angeforderte <c>level</c>, die maximale Stufe des API-Keys, die maximale Stufe des Projekts jeder Seite auf dem Gerät, die vom Nutzer zugelassene Stufe). Sowohl das Gateway als auch das SDK in der Seite setzen sie durch.',
  },

  approval: {
    lead: 'Aus Sicht des Nutzers ist alles, was die KI tut, sichtbar und lässt sich jederzeit stoppen. Bei neuen Projekten ist die Freigabe standardmäßig aktiviert.',
    requestTitle: 'Die KI bittet um Zugriff',
    requestBody:
      'Nachdem der Agent <c>connect_device</c> aufgerufen hat, zeigt die Seite im Vordergrund des Geräts „Support-Bot möchte diese Seite ansehen und steuern“, und der Nutzer wählt <levels></levels> (nur Stufen, die Key und Projekt erlauben, werden angeboten). Sind auf einem Gerät Seiten aus mehreren Projekten geöffnet, gilt die strengste Projektrichtlinie: Verlangt ein Projekt eine Freigabe, ist sie erforderlich, und für Stufe, Leerlauf-Rückfall und maximale Verbindungsdauer gilt jeweils der kleinste Wert. Der Dialog akzeptiert nur echtes Tippen des Nutzers; vom Agent erzeugte Klicks werden ignoriert.',
    levelChoice: (label) => label,
    timeout:
      '30 Sekunden ohne Antwort gelten als Ablehnung. <b>Nach 3 Ablehnungen in Folge für denselben API-Key auf demselben Gerät wird 10 Minuten lang keine neue Freigabe angefragt</b>; Verbindungsversuche schlagen sofort fehl.',
    activeTitle: 'KI sieht zu → KI steuert',
    activeBody:
      'Nach der Freigabe zeigt das Badge „KI sieht sich diese Seite an“. Bei der ersten Interaktion des Agents (Klick, Tastendruck o. Ä.) wechselt es zu „KI steuert“: Ein breiter, pulsierender blauer Schein leuchtet an den Seitenrändern, und eine transparente Ebene blockiert die Eingaben des Nutzers, sodass nur Übernehmen und Beenden bleiben. Vor jeder Aktion erscheint ein KI-Cursor, gleitet zum Ziel und beschriftet die Aktion (z. B. „Bestellen“ antippen), mit einer Welle bei jedem Tippen. Nach 2 Minuten ohne Agent-Aktivität fällt die Verbindung auf „Nur ansehen“ zurück (pro Projekt konfigurierbar); eine Verbindung dauert höchstens 60 Minuten (pro Projekt konfigurierbar).',
    takeoverTitle: 'Der Nutzer übernimmt und gibt zurück',
    takeoverBody:
      'Tippt der Nutzer auf „Übernehmen“, wird der Schein gleichmäßig orange, und die Interaktions-Tools des Agents liefern einen <c>takeover</c>-Fehler; der Agent sollte mit <c>wait_for_control</c> warten. Tippt der Nutzer auf „Zurückgeben“, macht der Agent weiter (idealerweise nach einem neuen Snapshot und einem Blick in die Zeitleiste, um zu sehen, was der Nutzer getan hat). „Beenden“ trennt den Agent.',
    confirmTitle: 'Bestätigung sensibler Aktionen',
    confirmBody:
      'Bevor der Agent ein Element mit <c>data-rwd-confirm</c> oder passend zu <c>confirmSelectors</c> des Projekts anklickt (oder ein solches Formular mit Enter absendet), fragt das Gerät: „Die KI möchte ‚Bestellen‘ antippen. Zulassen?“ Lehnt der Nutzer ab, liefert das Tool „Der Nutzer hat diese Aktion abgelehnt“. Während auf die Bestätigung gewartet wird, verlängert sich das Timeout dieses Aufrufs auf 40 Sekunden.',
    footer:
      'Sie können den Agent jederzeit mit „Sitzung beenden“ auf der Geräteseite der Konsole trennen. Jede Verbindung, Freigabe und Aktion wird im <link>Audit-Log</link> erfasst (ohne Seiteninhalte oder Parameterwerte).',
  },

  verify: {
    lead: 'Gehen Sie diese Punkte vor dem Livegang der Reihe nach durch. Besteht jeder Schritt, funktioniert die gesamte Kette.',
    gateway: 'Gateway ist erreichbar',
    sdk: 'SDK ist in der Seite online',
    sdkBody:
      'Führen Sie in den Entwicklertools der Seite <c>RemoteWebviewDebugger.status().status</c> aus. Das Ergebnis sollte <c>"online"</c> sein (oder <c>"polling"</c>: WebSocket ist blockiert, es funktioniert also, ist aber langsamer).',
    console: 'Die Konsole findet das Gerät',
    consoleBody:
      'Suchen Sie auf der Seite <link>Geräte</link> nach dem Gerätecode oder der userId. Es sollte online sein, mit dem richtigen Betriebssystem und der richtigen App-Version.',
    test: 'Verbindungstest erfolgreich',
    testBody: 'Öffnen Sie das Gerät und klicken Sie auf „Verbindung testen“. Es erscheinen „Verbunden“ und ein Seiten-Snapshot.',
    mcp: 'MCP ist verbunden',
    mcpBody: 'rwd zeigt in <c>claude mcp list</c> den Status Connected.',
    agent: 'Der Agent kann sich verbinden',
    agentBody:
      'Bitten Sie den Agent: „Online-Geräte auflisten und mit XXXX-XXXX verbinden“. Auf dem Gerät erscheint eine Freigabeabfrage; nach dem Zulassen erhält der Agent einen Snapshot.',
  },

  troubleshoot: {
    lead: 'Wenn ein Gerät nicht online geht oder sich ein Agent nicht verbinden kann, liegt es fast immer an einer der folgenden Ursachen.',
    offlineTitle: 'Das Gerät geht nie online',
    offlineHead: ['Symptom', 'Ursache und Lösung'],
    handshake401: 'Handshake 401',
    handshake401Body:
      'Falscher App-Key, oder das Projekt ist deaktiviert. Erneuern macht den alten Key sofort ungültig, aktualisieren Sie ihn also in Ihrer Seite / App.',
    handshake403: 'Handshake 403',
    handshake403Body:
      'Der Origin der Seite steht nicht in den erlaubten Origins. Fügen Sie Schema + Host + Port hinzu, oder leeren Sie die Liste, um die Einschränkung aufzuheben.',
    refused: '<c>Refused to connect</c> in der Console',
    refusedBody:
      'Von der CSP der Seite blockiert. Fügen Sie wie oben gezeigt die https://- und wss://-URLs des Gateways zu <c>script-src</c> und <c>connect-src</c> hinzu.',
    undefined: '<c>RemoteWebviewDebugger</c> ist undefined',
    undefinedBody:
      'Das SDK wurde nicht geladen: falsche URL, von einem Content-Blocker blockiert oder (bei nativer Injektion) die Seite wurde geladen, bevor das SDK fertig heruntergeladen war.',
    polling: 'status bleibt <c>polling</c>',
    pollingBody:
      'Ein Netzwerk oder Proxy blockiert WebSocket. Das Gerät geht trotzdem online (Abfrage alle 60 Sekunden), und wenn sich ein Agent verbindet, fordert das Gateway es auf, WebSocket sofort erneut zu versuchen.',
    outdated: 'Veraltetes SDK',
    outdatedBody:
      'Eine fest eingestellte SDK-Version ist eventuell nicht mit dem Gateway kompatibel. Wechseln Sie zu /v1/sdk.js oder aktualisieren Sie Version und Integrity.',
    testTimeout: 'Online, aber der Test läuft in eine Zeitüberschreitung',
    testTimeoutBody:
      'Das JS der WebView ist pausiert, solange die App im Hintergrund ist. Bitten Sie den Nutzer, die App in den Vordergrund zu holen und auf einer Seite mit dem SDK zu bleiben, und versuchen Sie es dann erneut.',
    closeCodesTitle: 'WebSocket-Close-Codes',
    closeCodesHead: ['Code', 'Bedeutung', 'Lösung'],
    code4401: 'Geräte-Token (deviceToken) fehlt oder passt nicht',
    code4401Fix:
      'Die App muss status().deviceToken speichern und in jeder WebView wieder an run() übergeben; das SDK wechselt zu rejected und versucht es nach etwa 10 Minuten erneut',
    code4409: 'Resume passt nicht (jemand hat sich mit derselben pageId verbunden)',
    code4409Fix:
      'Das SDK verbindet sich selbst mit einer neuen pageId neu; bei gelegentlichem Auftreten ist nichts zu tun. Kommt es häufig vor, wird sessionStorage kopiert',
    code4429: 'Kontingent des Projekts für Online-Geräte überschritten',
    code4429Fix:
      'Erhöhen Sie „Max. Online-Geräte“ in den Einstellungen des Projekts; das SDK wechselt zu quota und versucht es nach etwa 5 Minuten erneut',
    agentTitle: 'Fehler auf Agent-Seite',
    agentHead: ['Fehler', 'Ursache und Lösung'],
    mcp401: 'MCP liefert 401',
    mcp401Body:
      'Der Key ist falsch eingegeben, widerrufen oder abgelaufen, oder die ausgehende IP steht nicht in der Zulassungsliste.',
    level: 'Erfordert die Zugriffsstufe advanced…',
    levelBody:
      'Das Tool liegt über der Stufe dieser Verbindung. Fordern Sie mit einem Key höherer Stufe und connect_device(level) erneut an; der Nutzer muss diese Stufe ebenfalls zulassen.',
    denied: 'Nutzer hat abgelehnt / Zeitüberschreitung bei der Freigabe',
    deniedBody:
      'Der Nutzer hat auf dem Gerät abgelehnt oder nicht innerhalb von 30 Sekunden reagiert; nach 3 Mal in Folge ist für 10 Minuten gesperrt.',
    takeover: 'Der Nutzer hat übernommen; rufen Sie wait_for_control auf, um auf die Rückgabe zu warten.',
    notFound: 'Die ref ist veraltet (die Seite hat sich geändert); rufen Sie take_snapshot oder find_elements erneut auf.',
    notInteractable:
      'Das Element ist ausgeblendet, deaktiviert oder verdeckt; scrollen Sie zuerst oder schließen Sie das Overlay.',
    testTitle: 'Mit „Verbindung testen“ die fehlerhafte Station finden',
    testBody:
      'Die Geräteseite und die Integrationsseite des Projekts haben beide „Verbindung testen“: Das Gateway sendet eine Snapshot-Anfrage an die aktuelle Seite des Geräts. Gelingt sie, ist Gerät ↔ Gateway in Ordnung, und das Problem liegt bei MCP oder dem Key; schlägt sie fehl, prüfen Sie den Fehlercode: <c>device_offline</c>, <c>no_page</c> (Seite verbindet sich neu), <c>timeout</c>, <c>takeover</c>.',
    stuck: 'Funktioniert es immer noch nicht?',
    openIntegration: 'Live auf der Integrationsseite des Projekts prüfen',
    viewDevices: 'Online-Geräte ansehen',
  },
}
