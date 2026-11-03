import type { integration as en } from '../en/integration'

export const integration: typeof en = {
  key: {
    title: 'Integrationsdaten',
    description:
      'Der App-Key steht im Quelltext Ihrer Seite und ist bewusst öffentlich: Er kann Geräte nur online bringen, nicht steuern.',
    gatewayUrl: 'Gateway-URL',
    appKey: 'App-Key',
    rotate: 'Key erneuern',
    rotateTitle: 'App-Key erneuern?',
    rotateNew: 'Ein neuer App-Key wird erzeugt, und der alte ist sofort ungültig.',
    rotateImpact:
      'Seiten, die noch den alten Key verwenden, können erst wieder online gehen, wenn sie aktualisiert sind. Tun Sie das nur, wenn der Key missbraucht wird.',
    rotateConfirm: 'Erneuern',
    rotated: 'App-Key erneuert. Aktualisieren Sie bald den Integrationscode in Ihren Seiten.',
    sdkLatest: 'SDK-URL (neueste)',
    sdkPinned: (version) => `SDK-URL (fest auf ${version})`,
  },

  snippet: {
    title: 'Integrationscode',
    description:
      'Bereits mit Gateway-URL und App-Key dieses Projekts ausgefüllt, fertig zum Kopieren. Native Freigaben, Screenshot-Bridge, Geräte-Token und mehr finden Sie in der <link>Integrationsanleitung</link>.',
    tabH5: 'H5-Seite',
    tabIos: 'iOS (Swift)',
    tabAndroid: 'Android (Kotlin)',
    sdkVersion: 'SDK-Version',
    latest: 'Neueste',
    pinned: (version) => `Fest ${version} (SRI)`,
    pinnedHint:
      'Lädt eine feste Version, die der Browser anhand ihres Integritäts-Hashs prüft. Gut für Seiten mit strengen Sicherheitsvorgaben oder CSP. Nach einem Gateway-Upgrade Version und Integrity von Hand aktualisieren.',
    latestHint: 'Lädt immer das neueste SDK des Gateways, sodass Gateway-Upgrades ohne Änderung an der Seite wirken.',
    h5Hint: 'Fügen Sie dies möglichst weit oben im <tag>head</tag> der Seite ein:',
    iosHint: 'Keine Änderung am H5-Code: Die App injiziert es bei documentStart mit <c>WKUserScript</c>:',
    androidHint: 'Keine Änderung am H5-Code: Die App injiziert es mit <c>WebViewCompat.addDocumentStartJavaScript</c>:',
  },

  origins: {
    title: 'Erlaubte Origins',
    description:
      'Wenn gesetzt, können nur Seiten von diesen Origins mit dem App-Key online gehen. Leer lassen für keine Einschränkung.',
    edit: 'Bearbeiten',
    saved: 'Erlaubte Origins gespeichert',
    invalid: (bad) =>
      `Ungültig: ${bad.join(', ')} (erwartet wird https://host[:port]; *. dient als Platzhalter für Subdomains)`,
    unrestricted: 'Keine Einschränkung: Seiten jedes Origins können online gehen.',
  },

  verify: {
    title: 'Integration prüfen',
    description: 'Prüft live, ob ein Gerät online geht und ein Agent die Seite tatsächlich bedienen kann.',
    seen: 'Ein Gerät ist online gegangen',
    waiting: 'Warte auf das erste Gerät',
    firstSeen: (date, online) => `Zuerst online ${date} · jetzt ${online} online`,
    waitingHint:
      'Fügen Sie den Integrationscode in Ihre Seite ein und öffnen Sie sie in der App oder einem Browser. Die Anzeige aktualisiert sich automatisch, sobald ein Gerät online geht.',
    projectDisabled: 'Dieses Projekt ist deaktiviert, daher können keine Geräte online gehen.',
    deviceOnline: 'Gerät online',
    deviceOffline: 'Gerät offline',
    platform: 'Plattform',
    appVersion: 'App-Version',
    noApp: '— (H5-Seite)',
    currentPage: 'Seite',
    untitled: '(ohne Titel)',
    sdkVersion: 'SDK-Version',
    lastSeen: 'Zuletzt gesehen',
    viewDevice: 'Gerätedetails ansehen',
    test: 'Verbindung testen',
    testHint:
      'Das Gateway sendet dem Gerät eine Snapshot-Anfrage und zeigt die Antwortzeit und den Snapshot an. So ist belegt, dass ein Agent dieses Gerät bedienen kann.',
    testing: 'Wird getestet…',
  },

  troubleshoot: {
    title: 'Gerät geht nicht online?',
    description:
      'Gehen Sie die häufigsten Ursachen in dieser Reihenfolge durch. Mehr dazu in der <link>Anleitung zur Fehlerbehebung</link>.',
    badKey: {
      title: 'Ungültiger Key oder deaktiviertes Projekt',
      body: 'Der WebSocket-Handshake der Seite liefert 401. Prüfen Sie, ob der Key in Ihrem Integrationscode mit dem oben übereinstimmt (Erneuern macht den alten Key sofort ungültig) und ob das Projekt nicht deaktiviert ist.',
    },
    origin: {
      title: 'Origin nicht erlaubt',
      body: 'Der Handshake liefert 403. Fügen Sie den Origin der Seite (Schema + Host + Port) zu den erlaubten Origins hinzu, oder leeren Sie die Liste, um die Einschränkung aufzuheben.',
    },
    csp: {
      title: 'Die CSP der Seite blockiert die Verbindung',
      body: 'Die Browser-Console zeigt <c>Refused to connect</c>. Fügen Sie den Gateway-Host zu <c>script-src</c> der CSP hinzu und die <c>https://</c>- und <c>wss://</c>-URLs des Gateways zu <c>connect-src</c>.',
    },
    sdkOld: {
      title: 'SDK-Version zu alt',
      body: 'Eine fest eingestellte SDK-Version passt eventuell nicht zum Protokoll des Gateways. Wechseln Sie zur neuesten URL /v1/sdk.js oder aktualisieren Sie auf eine vom Gateway unterstützte Version.',
    },
    timeout: {
      title: 'Gerät online, aber der Test läuft in eine Zeitüberschreitung',
      body: 'Das JS der WebView ist pausiert, solange die App im Hintergrund ist. Bitten Sie den Nutzer, die App in den Vordergrund zu holen und auf einer Seite mit dem SDK zu bleiben, und versuchen Sie es dann erneut.',
    },
  },

  invites: {
    title: 'Nutzer zum Verbinden einladen',
    description:
      'Senden Sie einem Nutzer einen Link oder QR-Code mit einem Einladungstoken. Sobald er ihn öffnet, geht sein Gerät als „In Betreuung“ markiert online, und der Support muss nicht nach dem Gerätecode fragen.',
    create: 'Einladung erstellen',
    emptyTitle: 'Noch keine Einladungen',
    emptyDescription:
      'Wenn ein Nutzer sein Problem nicht genau beschreiben kann, senden Sie ihm eine Einladung. Er scannt sie, und sein Gerät verbindet sich.',
    howTitle: 'So funktioniert es',
    howSteps: [
      'Erstellen Sie eine Einladung mit einer Ticketnummer oder einer Beschreibung des Nutzers in der Notiz, damit Sie das Gerät in der Liste wiedererkennen.',
      'Senden Sie dem Nutzer den QR-Code oder Link. Er öffnet die in den Einstellungen hinterlegte Einladungs-URL oder eine, die Sie für diese Einladung festlegen.',
      'Sobald er sie öffnet, erscheint das Gerät oben in der Geräteliste mit dem Badge „Eingeladen“. Geben Sie den Gerätecode an Ihren Agent weiter.',
      'Jede Einladung funktioniert einmal und wird nach der Verwendung oder dem Ablauf ungültig.',
    ],
    noDefaultUrl:
      'Es ist keine Standard-Einladungs-URL konfiguriert, daher braucht jede Einladung einen Link. Sie können eine in den <link>Einstellungen</link> festlegen.',
    status: {
      used: 'Verwendet',
      expired: 'Abgelaufen',
      active: 'Aktiv',
    },
    deleted: 'Einladung gelöscht',
    noNote: '(keine Notiz)',
    createdBy: (name) => `Erstellt von ${name} · `,
    usedAgo: (when) => `Verwendet ${when}`,
    viewDevice: 'Gerät ansehen',
    expiredAt: (date) => `Abgelaufen ${date}`,
    expiresIn: (when) => `Läuft ${when} ab`,
    qrCode: 'QR-Code',
    linkCopied: 'Einladungslink kopiert',
    deleteLabel: 'Einladung löschen',
    deleteTitle: 'Diese Einladung löschen?',
    deleteActive: 'Der Link wird sofort ungültig; wer ihn öffnet, wird nicht als „In Betreuung“ markiert.',
    deleteInactive: 'Nur dieser Eintrag wird gelöscht. Bereits verbundene Geräte sind nicht betroffen.',

    createTitle: 'Einladung erstellen',
    createDescription: 'Erzeugt einen Einmal-Link. Sobald der Nutzer ihn öffnet, wird sein Gerät als „In Betreuung“ markiert.',
    noteRequired: 'Geben Sie eine Notiz ein',
    badUrl: 'Der Link muss mit http:// oder https:// beginnen',
    urlRequired: 'Das Projekt hat keine Standard-Einladungs-URL. Geben Sie einen Link ein.',
    note: 'Notiz',
    notePlaceholder: 'z. B. Ticket #4821 Zahlung fehlgeschlagen',
    noteHint: 'Erscheint in der Zeitleiste des Geräts und im Audit-Log. Keine personenbezogenen Daten eintragen.',
    url: 'Link',
    optional: '(optional)',
    urlHint: (hasDefault) =>
      `${hasDefault ? 'Leer lassen, um die Standard-Einladungs-URL des Projekts zu verwenden.' : 'Das Projekt hat keine Standard-Einladungs-URL, daher ist dieses Feld erforderlich.'} Die Seite muss das SDK eingebunden haben.`,
    expiry: 'Läuft ab nach',
    expiryOptions: {
      m30: '30 Min.',
      h2: '2 Stunden',
      d1: '1 Tag',
      d7: '7 Tage',
    },
    submit: 'Einladung erstellen',

    qrTitle: 'QR-Code der Einladung',
    qrDescription: (note, when) => `„${note}“ · läuft ${when} ab · einmal verwendbar`,
    scanHint: 'Lassen Sie den Nutzer ihn mit der Handykamera oder dem Scanner der App scannen',
    orLink: 'Oder senden Sie dem Nutzer den Link',
    done: 'Fertig',
  },

  test: {
    failed: 'Test fehlgeschlagen',
    unknownFailure: 'Test aus unbekanntem Grund fehlgeschlagen.',
    ok: 'Verbunden. Ein Agent kann dieses Gerät bedienen.',
    roundTrip: (ms) => `${ms} ms Antwortzeit`,
    untitled: '(ohne Titel)',
    snapshotPreview: 'Snapshot-Vorschau (erste 4.000 Zeichen)',
    emptySnapshot: '(leerer Snapshot)',
    errors: {
      offline:
        'Das Gerät ist nicht online. Bitten Sie den Nutzer, die App in den Vordergrund zu holen und eine Seite mit dem SDK zu öffnen, und versuchen Sie es dann erneut.',
      noPage: 'Das Gerät ist online, hat aber keine verbundene Seite. Stellen Sie sicher, dass die Seite fertig geladen ist.',
      timeout:
        'Das Gerät hat nicht innerhalb von 15 Sekunden geantwortet. Die App ist eventuell im Hintergrund (das JS der WebView ist pausiert), oder die Seite hängt.',
      takeover: 'Der Nutzer hat übernommen, daher kann der Test gerade nicht laufen.',
      notFound: 'Das Gerät existiert nicht oder gehört nicht mehr zu diesem Projekt.',
      badRequest: 'Ungültige Anfrageparameter.',
      internal:
        'Auf der Seite ist ein interner Fehler aufgetreten. Prüfen Sie, ob die SDK-Version veraltet ist, oder suchen Sie in der Console der Seite nach Fehlern.',
      network: 'Gateway nicht erreichbar. Prüfen Sie Ihre Netzwerkverbindung.',
    },
  },

  snippets: {
    sampleAppName: 'Shop',
    usage: 'Verwendung:',
    dependency: (dep) => `Abhängigkeit: ${dep}`,
    h5Head:
      'Synchron und möglichst früh im <head> laden, damit das SDK Console und Netzwerk von Anfang an aufzeichnet',
    h5Pinned: (version) =>
      `Fest auf Version ${version} mit Subresource Integrity (SRI). Nach einem Gateway-Upgrade Version und integrity aktualisieren`,
    userIdOptional: 'optional: ID des angemeldeten Nutzers, um Geräte nach Nutzer zu finden',
    helpButton: 'Unterstützungs-Button anzeigen',
    iosInstall:
      'Vor webView.load(...) aufrufen: lädt das SDK einmal herunter und injiziert es bei documentStart in den Hauptframe.',
    deviceIdPerInstall: 'Eine pro Installation feste deviceId (UUID v4), damit sich der Gerätecode nie ändert.',
    androidWebViewSettings: 'Die WebView braucht settings.javaScriptEnabled = true und settings.domStorageEnabled = true',
    androidInstall: 'Vor webView.loadUrl(...) aufrufen: lädt das SDK einmal herunter und injiziert es bei Dokumentbeginn.',

    full: {
      userId: 'optional: der angemeldete Nutzer, damit Konsole und Agents Geräte nach Nutzer finden',
      helpButton: 'optional: den "Unterstützung anfordern"-Button anzeigen (ODER-verknüpft mit der Projektrichtlinie)',
      app: 'optional: Infos zur Host-App; eigenständige H5-Seiten können das weglassen',
      nativeOnly: 'Nur für native Injektion durch eine App; siehe "Native App integrieren"',
      deviceCode: 'Gerätecode von Remote Debugger',
      example: 'z. B.',
    },
    jsApi: {
      help: 'Unterstützung anfordern (false übergeben, um abzubrechen)',
      setUser: 'nach Anmeldung / Nutzerwechsel aufrufen; verbindet einmal neu',
      stop: 'Verbindung trennen und die UI entfernen, z. B. wenn der Nutzer Remote-Debugging ausschaltet',
    },
    mask: {
      masked: 'Erscheint in Snapshots, Screenshots und Console-Ausgaben als ••••',
      samplePhone: '0151 23456789',
      confirm: 'Bevor ein Agent es anklickt, bittet das Gerät den Nutzer um Bestätigung',
      placeOrder: 'Bestellen',
    },
    native: {
      screenshotBridge: 'native Screenshot-Bridge',
      swiftTrimmed: 'Gekürzte Fassung von examples/mock-app/Sources/RWDMockApp/RWDNative.swift.',
      swiftInstall: 'RWD.shared.install(into: configuration) vor dem Erstellen jeder WKWebView aufrufen.',
      swiftOnState: 'steuert die native Statusleiste und die Buttons Übernehmen / Zurückgeben / Beenden',
      swiftOnPending: 'Verbindungsfreigaben und Aktionsbestätigungen (native Dialoge)',
      swiftNativeKey: [
        'Ein Geheimnis, das nur die App kennt: Seitenskripte (auch evaluate_script eines Agents) können es nicht lesen,',
        'also können sie sich nicht als Nutzer ausgeben, um die Steuerung zurückzugeben oder eine Verbindung freizugeben.',
      ],
      swiftDeviceId:
        'Eine deviceId pro Installation, gemeinsam für alle WebViews und alle Domains → der Gerätecode ändert sich nie.',
      swiftDeviceToken:
        'Vom Gateway ausgestellt, wenn es dieses Gerät zum ersten Mal sieht. localStorage gilt pro Domain, daher speichert die App es und injiziert es.',
      swiftEnable:
        'Aufrufen, sobald der Nutzer dem Remote-Debugging zustimmt: lädt das SDK einmal herunter; danach erstellte WebViews bekommen es injiziert.',
      swiftOwnHelp: 'die App hat einen eigenen "Unterstützung anfordern"-Einstieg',
      swiftNativeApproval: 'Freigaben / Bestätigungen über native Dialoge',
      swiftDocumentStart: 'documentStart: Die Aufzeichnung von Console und Netzwerk beginnt, bevor ein Seitenskript läuft',
      buttons: 'Native Buttons',
      swiftDecide:
        'Verbindungsfreigabe: eine Stufe übergeben (observe / interact / advanced) oder nil zum Ablehnen. Aktionsbestätigung: "allow" oder nil übergeben.',
      swiftTokenCarried: 'ab jetzt geöffnete Seiten (auch andere Domains) tragen es mit',
      swiftScreenshot: 'Wenn ein Agent take_screenshot aufruft, bekommt das SDK über diese Bridge die echten Pixel.',
      kotlinReference:
        'Referenzimplementierung (nicht in einem echten App-Projekt kompiliert); ihre API entspricht eins zu eins der iOS-Version.',
      kotlinNativeKey: 'Ein Geheimnis, das nur die App kennt; wird der Seite über keine JS-Schnittstelle zugänglich gemacht.',
      kotlinOnState: 'steuert die native Statusleiste und die Buttons',
      kotlinOnPending: 'native Freigabe- / Bestätigungsdialoge',
      kotlinDeviceId: 'Eine deviceId pro Installation, gemeinsam für alle WebViews und alle Domains.',
      kotlinEnable: 'Einmal aufrufen, nachdem der Nutzer dem Remote-Debugging zugestimmt hat.',
      kotlinInstall: 'Für jede WebView vor loadUrl aufrufen. Braucht javaScriptEnabled und domStorageEnabled.',
      kotlinButtons:
        'Native Buttons: takeover | handback | end; Freigaben erhalten eine Stufe oder null, Bestätigungen "allow" oder null',
      kotlinTokenCarried: 'ab jetzt erstellte WebViews tragen es mit',
      kotlinScreenshot:
        'Wenn ein Agent take_screenshot aufruft, ruft das SDK window.RWDAndroid.screenshot() auf, das eine JPEG-Data-URL zurückgibt.',
    },
  },
}
