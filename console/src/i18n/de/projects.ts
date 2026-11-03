import type { projects as en } from '../en/projects'

export const projects: typeof en = {
  title: 'Projekte',
  name: 'Projektname',
  newProject: 'Neues Projekt',
  optional: '(optional)',
  onlineCount: (online, total) => `<n>${online}</n> online / ${total} ${total === 1 ? 'Gerät' : 'Geräte'}`,

  list: {
    description:
      'Jedes Projekt steht für eine App oder Website, mit eigenem App-Key, eigener Zugriffsrichtlinie und eigenen Einladungen. Alle Geräte sind auf der Seite „Geräte“ aufgeführt.',
    emptyTitle: 'Noch keine Projekte',
    emptyManage:
      'Erstellen Sie ein Projekt, um einen App-Key und fertigen Integrationscode zu erhalten. Ihr erstes Gerät kann in wenigen Minuten online sein.',
    emptyMember: 'Projekte erscheinen hier, sobald ein Admin sie erstellt.',
  },

  create: {
    description: 'Beim Erstellen eines Projekts werden ein App-Key (rwd_pk_…) und Integrationscode erzeugt.',
    nameRequired: 'Geben Sie einen Projektnamen ein',
    invalidOrigins: (bad) => `Ungültiger Origin: ${bad.join(', ')}`,
    namePlaceholder: 'z. B. Shop-App',
    originsLabel: 'Erlaubte Origins',
    originsHint:
      'Einer pro Zeile. Leer lassen, um jeden Origin zu erlauben; sobald gesetzt, können nur Seiten von diesen Origins online gehen.',
    created: (name) => `Projekt „${name}“ erstellt`,
  },

  detail: {
    notFoundTitle: 'Projekt nicht gefunden',
    notFoundDescription: 'Es wurde möglicherweise gelöscht.',
    backToList: 'Zurück zu den Projekten',
    tabs: {
      integration: 'Integration',
      devices: 'Geräte',
      invites: 'Einladungen',
      audit: 'Audit-Log',
      settings: 'Einstellungen',
    },
  },

  keys: {
    title: 'API-Keys',
    pageDescription:
      'Zum Verbinden von Agents über MCP. Keys gehören zum gesamten Gateway, nicht zu einem Projekt: Ein Key und ein MCP-Server erreichen jedes Gerät.',
    description:
      'Agents verbinden sich mit einem Key über MCP. Ein Key sieht jedes Gerät am Gateway, über alle Projekte hinweg. Halten Sie Keys geheim und widerrufen Sie einen Key sofort, wenn er öffentlich geworden ist.',
    readOnly: ' Ihre Rolle kann Keys nur ansehen; zum Erstellen und Widerrufen ist ein Admin nötig.',
    createKey: 'Key erstellen',
    emptyTitle: 'Noch keine API-Keys',
    emptyDescription: 'Erstellen Sie einen Key und kopieren Sie den MCP-Einrichtungsbefehl für Ihren Agent.',

    columns: {
      name: 'Name',
      key: 'Key',
      level: 'Stufe',
      expiry: 'Ablauf',
      ipAllowlist: 'IP-Zulassungsliste',
      lastUsed: 'Zuletzt verwendet',
      status: 'Status',
      actions: 'Aktionen',
    },
    createdOn: (date) => `Erstellt ${date}`,
    neverUsed: 'Nie verwendet',
    usedAgo: (ago) => `zuletzt verwendet ${ago}`,

    neverExpires: 'Läuft nie ab',
    expiresAtTitle: (date) => `Läuft ab am ${date}`,
    expiredOn: (date) => `Abgelaufen am ${date}`,
    expiresIn: (until) => `Läuft ${until} ab`,
    anyIp: 'Jede IP',

    revoked: 'Widerrufen',
    revokedTitle: (date) => `Widerrufen am ${date}`,
    expired: 'Abgelaufen',
    expiredTitle: (date) => `Abgelaufen am ${date}`,
    active: 'Aktiv',

    revoke: 'Widerrufen',
    revokedToast: (name) => `„${name}“ widerrufen`,
    revokeTitle: (name) => `„${name}“ widerrufen?`,
    revokeDescription: (prefix) =>
      `MCP-Sitzungen mit <c>${prefix}…</c> funktionieren sofort nicht mehr. Dies kann nicht rückgängig gemacht werden.`,

    mcpTabs: {
      hosted: 'Gehostet',
      local: 'Lokales stdio',
      json: 'JSON-Konfiguration',
    },
    hostedHint:
      'Claude Code verbindet sich direkt mit dem gehosteten MCP des Gateways (Streamable HTTP), ohne Installation:',
    localHint: 'Erfordert den Befehl <c>rwd</c> auf Ihrem Rechner; er leitet stdio an das gehostete /mcp weiter:',
    jsonHint: 'Für andere Clients, die eine mcpServers-Konfigurationsdatei lesen:',

    createdTitle: 'API-Key erstellt',
    createdName: (name) => name,
    showOnce:
      '<b>Der vollständige Key wird nur dieses eine Mal angezeigt.</b> Nach dem Schließen können Sie ihn nicht mehr ansehen; kopieren Sie ihn also jetzt und bewahren Sie ihn sicher auf. Falls er verloren geht, widerrufen Sie ihn und erstellen Sie einen neuen.',
    maxPrefix: 'Max. ',
    keyLabel: 'API-Key',
    commandLabel: 'MCP-Einrichtungsbefehl (inkl. Key)',
    savedClose: 'Gespeichert, schließen',

    createTitle: 'API-Key erstellen',
    createDescription:
      'Benennen Sie den Key so, dass Sie ihn später erkennen und widerrufen können, z. B. nach dem Agent oder der Person, die ihn verwendet.',
    nameRequired: 'Geben Sie einen Namen ein',
    invalidCidrs: (bad) =>
      `Ungültiger Eintrag in der IP-Zulassungsliste: ${bad.join(', ')} (CIDR-Notation verwenden, z. B. 203.0.113.0/24)`,
    namePlaceholder: 'z. B. Support-Bot',
    maxLevel: 'Maximale Zugriffsstufe',
    advancedWarning:
      '<b>Mit „Erweitert“ lässt sich beliebiges JS in der Seite des Nutzers ausführen und Cookies sowie Request-Bodys lesen</b> – das entspricht dem Besitz der angemeldeten Sitzung des Nutzers auf dieser Seite. Vergeben Sie die Stufe nur an vertrauenswürdige Agents und kombinieren Sie sie mit einer IP-Zulassungsliste und einer kurzen Gültigkeit.',
    levelHint:
      'Die wirksame Stufe ist zusätzlich durch die maximale Stufe des Projekts begrenzt, zu dem die Seite gehört; es gilt die strengere.',
    neverWarning:
      'Ein Key ohne Ablauf bleibt bei einem Leck gültig, bis ihn jemand widerruft. Wählen Sie besser einen Ablauf und erstellen Sie rechtzeitig vorher einen neuen Key.',
    expiresAround: (date) => `Läuft etwa am ${date} ab. Danach liefert MCP 401.`,
    ipHint:
      'Ein CIDR pro Zeile; eine einzelne IP gilt als /32 (/128 bei IPv6). Leer lassen für keine Einschränkung; sobald gesetzt, erhalten MCP-Aufrufe von anderen IPs 401.',

    guideTitle: 'In Ihrem Agent verwenden',
    guideDescription: (placeholder) =>
      `Ersetzen Sie <c>${placeholder}</c> in den Befehlen unten durch Ihren API-Key. Ein MCP-Server erreicht jedes Gerät: Ein Telefon, das Seiten aus verschiedenen Projekten öffnet, behält denselben Gerätecode. Die vollständige Tool-Liste, die Zugriffsstufen und den Freigabeablauf finden Sie in der <link>Integrationsanleitung</link>.`,
    commonTools: 'Häufige Tools',
    tools: {
      list: 'Geräte nach Status, userId oder Gerätecode filtern',
      connect: 'Per Gerätecode mit einem Gerät verbinden; ist es offline, warten, bis es online ist',
      pages: 'Seiten auf dem Gerät auflisten und wechseln (p1, p2…)',
      snapshot: 'Einen Seiten-Snapshot (mit refs) oder einen Screenshot abrufen',
      act: 'Auf der Seite handeln; die erste Aktion schaltet die Seite auf „KI steuert“',
      logs: 'Console-Ausgaben, Fehler und Netzwerkanfragen ansehen',
      timeline: 'Seitenübergreifende Zeitleiste, die die Schritte des Nutzers nachzeichnet',
      control: 'Nachdem der Nutzer übernommen hat, warten, bis er die Steuerung zurückgibt',
    },
    tryTitle: 'Sagen Sie Ihrem Agent zum Beispiel',
    tryExample:
      '„Online-Geräte auflisten, mit GSJH-EV2J verbinden und herausfinden, warum der Gesamtbetrag im Checkout -- anzeigt“',
  },

  policy: {
    title: 'Zugriffsrichtlinie',
    description:
      'Legt fest, ob sich Agents verbinden können, was sie tun und was sie sehen dürfen. Änderungen gelten sofort für neue Verbindungen; bestehende Sitzungen behalten ihre Stufe.',
    readOnly: 'Ihre Rolle kann die Zugriffsrichtlinie nur ansehen; zum Ändern ist ein Admin oder Inhaber nötig.',
    saved: 'Zugriffsrichtlinie gespeichert. Sie gilt sofort für neue Verbindungen.',
    invalid: 'Einige Einstellungen sind ungültig. Prüfen Sie die rot markierten Felder.',
    invalidSelectors: (bad) => `Kein gültiger CSS-Selektor: ${bad.join(', ')}`,
    nameRequired: 'Geben Sie einen Namen ein',
    duplicateName: 'Name bereits vergeben',
    intRange: (min, max) => `Geben Sie eine ganze Zahl von ${min} bis ${max} ein`,
    invalidUrl: 'Muss mit http:// oder https:// beginnen',

    approval: {
      title: 'Verbindungsfreigabe',
      description:
        'Ob der Nutzer auf dem Gerät zustimmen muss, wenn sich ein Agent mit einem Gerätecode verbindet. Die Abfrage reagiert nur auf echtes Tippen des Nutzers; ein Agent kann nicht für ihn tippen.',
      prompt: 'Nutzer fragen (empfohlen)',
      promptDescription:
        'Die Seite im Vordergrund zeigt eine Abfrage, und der Agent verbindet sich erst, wenn der Nutzer eine Stufe zulässt. Keine Antwort innerhalb von 30 Sekunden gilt als Ablehnung. Nach 3 Ablehnungen in Folge für denselben Key werden Abfragen 10 Minuten lang ausgesetzt.',
      none: 'Keine Freigabe',
      noneDescription:
        'Jeder Agent, der den Gerätecode kennt, kann sich direkt verbinden. Nur für interne Testumgebungen.',
    },

    maxLevel: {
      title: 'Maximale Zugriffsstufe',
      description:
        'Die höchste Stufe, die dieses Projekt erlaubt. Eine Verbindung erhält die niedrigste von vier Stufen: die vom Agent angeforderte, die des API-Keys, die hier eingestellte und die vom Nutzer zugelassene.',
      advancedWarning:
        'Mit „Erweitert“ können Agents beliebiges JS ausführen und Cookies sowie Request-Bodys lesen – so gut wie die angemeldete Sitzung des Nutzers auf der Seite. Aktivieren Sie die Stufe nur, wenn Sie sie wirklich brauchen.',
    },

    masking: {
      title: 'Datenschutz-Maskierung',
      description:
        'Passwortfelder und Elemente mit dem Attribut data-rwd-mask erscheinen in Snapshots, Screenshots, Console- und Netzwerk-Logs immer als ••••. Hier fügen Sie weitere Maskierungsregeln hinzu.',
      selectorsLabel: 'Maskierte Elemente (CSS-Selektoren)',
      selectorsHint: 'Einer pro Zeile, z. B. .user-phone, #id-card.',
      patternsTitle: 'Text per regulärem Ausdruck maskieren',
      patternsDescription:
        'Passender Text wird in Snapshots, Console und Netzwerk-URLs durch •••• ersetzt. Gut für Telefon- oder Ausweisnummern, die als Klartext erscheinen. Verwendet RE2-Syntax (keine Lookarounds oder Rückverweise).',
      patternsList: 'Maskierungsmuster',
      ruleName: (n) => `Name von Regel ${n}`,
      ruleRegex: (n) => `Regulärer Ausdruck von Regel ${n}`,
      removeRule: (n) => `Regel ${n} löschen`,
      namePlaceholder: 'Name',
      regexPlaceholder: 'Regulärer Ausdruck, z. B. 1[3-9]\\d{9}',
      addRule: 'Regel hinzufügen',
      presets: 'Vorlagen:',
      tryLabel: 'Ausprobieren: Beispieltext eingeben, um die Maskierung vorab zu sehen',
      sample: 'Max Mustermann 13812345678 max@example.com Ausweis 11010119900307123X',
    },

    confirm: {
      title: 'Sensible Aktionen bestätigen',
      description:
        'Bevor ein Agent diese Elemente anklickt (oder in ihrem Formular Enter drückt), bittet die Seite den Nutzer um Bestätigung; keine Bestätigung innerhalb von 30 Sekunden gilt als Ablehnung. Elemente mit dem Attribut data-rwd-confirm erfordern immer eine Bestätigung.',
      label: 'Elemente, die eine Bestätigung erfordern (CSS-Selektoren)',
      hint: 'Einer pro Zeile, z. B. Buttons zum Bezahlen, Löschen und Bestellen.',
    },

    network: {
      title: 'Netzwerk-Ausschlussregeln',
      description:
        'Passende Anfragen tauchen nicht in der Netzwerkliste und Zeitleiste auf, die Agents sehen (die Seite zeichnet sie weiterhin auf; ein Agent kann includeExcluded übergeben, um sie zu sehen). Gut für Schriften, die immer 404 liefern, und Analytics-Beacons. Regeln, die die Seite an run({ networkExclude }) übergibt, kommen hinzu.',
      label: 'Ausgeschlossene Anfragen',
      hint: 'Einer pro Zeile: ein URL-Fragment (ohne Beachtung der Groß-/Kleinschreibung), *-Platzhalter oder /regex/.',
    },

    sessionLog: {
      title: 'Sitzungsprotokoll',
      description:
        'Ab jedem App-Start zeichnen die Seiten Navigationen, Tippen und Eingaben des Nutzers, Agent-Aktionen, Console und Netzwerkanfragen (fehlgeschlagene mit Bodys) in IndexedDB auf dem Telefon auf. Ein verbundener Agent kann alles lesen, was vor seiner Ankunft passiert ist. Die letzten 3 Starts werden aufbewahrt, jeweils bis zu 10 MB; die Maskierungsregeln gelten.',
      label: 'Sitzungsprotokoll führen',
      hint: 'Wenn aus, beenden die Seiten die Aufzeichnung und löschen die bereits auf dem Telefon gespeicherten Protokolle. Eine einzelne Seite kann sich auch mit run({ record: false }) abmelden.',
    },

    help: {
      title: 'Unterstützungs-Button',
      description:
        'Ein schwebender Button „Unterstützung anfordern“ unten rechts auf der Seite. Tippt der Nutzer darauf, wird das Gerät als „In Betreuung“ markiert und rückt in der Geräteliste nach oben.',
      all: 'Alle Nutzer',
      allDescription: 'Jede Seite mit dem SDK zeigt den Unterstützungs-Button.',
      listed: 'Bestimmte Nutzer',
      listedDescription: 'Nur für die unten aufgeführten userIds sichtbar. Gut für schrittweise Rollouts und Betatests.',
      off: 'Aus',
      offDescription: 'Kein schwebender Button. Die App kann help() aus ihrem eigenen Unterstützungs-Einstieg aufrufen.',
      usersLabel: 'Zugelassene userIds',
      usersHint: 'Eine pro Zeile, passend zur an run() / setUser() übergebenen userId.',
      usersEmpty: 'Bei leerer Liste sieht niemand den Unterstützungs-Button.',
    },

    eruda: {
      title: 'eruda-Integration',
      description:
        'Wie das eruda-Debug-Panel in der Seite mit Remote Debugger zusammenarbeitet. run({ eruda }) im Seitencode überschreibt diese Einstellungen.',
      dock: 'In eruda andocken',
      dockDescription:
        'Fügt eruda einen Tab „Remote Debugger“ hinzu, statt des schwebenden Widgets. Wenn sich die KI verbindet, erscheint trotzdem die untere Steuerleiste, damit der Nutzer jederzeit übernehmen oder beenden kann.',
      load: 'Neuestes eruda automatisch laden',
      loadDescription:
        'Hat die Seite kein eruda, wird die neueste Version von jsDelivr geladen und initialisiert, damit Entwickler Console, Netzwerk und Quellen sehen können. Am besten nur für Projekte in Testumgebungen aktivieren.',
    },

    limits: {
      title: 'Zeitlimits und Kontingente',
      minutes: 'Min.',
      devices: '',
      agents: '',
      idle: 'Leerlauf-Timeout der KI',
      idleHint:
        'Nach dieser Zeit ohne KI-Aktion kehrt die Seite zu „KI sieht zu“ zurück, und die Sperrebene wird aufgehoben. Standard 2.',
      attach: 'Maximale Sitzungsdauer',
      attachHint: 'Danach wird der Agent automatisch getrennt, falls niemand die Sitzung beendet. Standard 60.',
      onlineDevices: 'Max. Online-Geräte',
      onlineDevicesHint: 'Darüber hinaus werden neue Geräte abgewiesen (Close-Code 4429). 0 bedeutet kein Limit.',
      agentsLabel: 'Max. gleichzeitige Agents',
      agentsHint: 'Agents, die im gesamten Projekt gleichzeitig mit Geräten verbunden sind. 0 bedeutet kein Limit.',
    },

    invite: {
      title: 'Einladungsseite',
      description:
        'Einladungslinks öffnen standardmäßig diese Seite (der Parameter rwd_invite wird automatisch angehängt). Die Seite muss das SDK eingebunden haben.',
      label: 'H5-URL, die Einladungslinks öffnen',
      hint: 'Leer lassen, um sie bei jeder neuen Einladung einzugeben.',
    },

    unsaved: 'Ungespeicherte Änderungen',
    allSaved: 'Alle Änderungen gespeichert',
    revert: 'Verwerfen',
    save: 'Richtlinie speichern',
  },

  settings: {
    renamed: 'Projektname gespeichert',
    disabledToast: 'Projekt deaktiviert',
    enabledToast: 'Projekt aktiviert',
    deleted: (name) => `Projekt „${name}“ gelöscht`,
    general: 'Allgemein',
    meta: (date, id) => `Erstellt ${date} · Projekt-ID <c>${id}</c>`,
    disableTitle: 'Projekt deaktivieren',
    disableDescription:
      'Solange es deaktiviert ist, können Seiten mit dem App-Key dieses Projekts nicht online gehen. Sie können es jederzeit wieder aktivieren.',
    running: 'Aktiv',
    deleteTitle: 'Projekt löschen',
    deleteDescription:
      'Der App-Key wird sofort ungültig, und die Einladungen des Projekts werden gelöscht. Dies kann nicht rückgängig gemacht werden.',
    deleteConfirmTitle: (name) => `Projekt „${name}“ löschen?`,
    deleteConfirmDescription:
      'App-Key und Einladungen werden gelöscht, und Seiten mit diesem App-Key können nicht mehr online gehen. Dies kann nicht rückgängig gemacht werden.',
  },
}
