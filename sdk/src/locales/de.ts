import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// Deutsch.

const ui: UiMessages = {
  levels: {
    observe: 'Nur ansehen',
    interact: 'Ansehen und bedienen',
    advanced: 'Erweitert (Skripte ausführen, Speicher lesen)',
  },
  attachLevels: {
    observe: 'Nur ansehen',
    interact: 'Ansehen und bedienen',
    advanced: 'Erweitert (zusätzlich Skripte ausführen, Speicher lesen)',
  },
  state: {
    none: 'Inaktiv: keine KI verbunden',
    observe: 'KI sieht sich diese Seite an',
    agent: 'KI steuert, Ihre Eingaben sind pausiert',
    user: 'Sie haben übernommen, KI pausiert',
  },
  link: {
    connecting: 'Verbindet',
    online: 'Online',
    offline: 'Offline',
  },
  connecting: 'Verbindet…',
  helpPending: 'In Betreuung',
  copy: 'Kopieren',
  copied: 'Kopiert',
  noteHelp: 'Unterstützung angefordert. Das Entwicklerteam findet Sie über diesen Gerätecode.',
  noteAuto: 'Automatisch zulassen ist an: Die KI verbindet sich ohne Rückfrage. Sie können jederzeit übernehmen oder beenden.',
  noteShare:
    'Geben Sie diesen Gerätecode an das Entwicklerteam weiter. Die KI fragt, bevor sie sich verbindet, und Sie können jederzeit übernehmen oder beenden.',
  help: 'Unterstützung anfordern',
  cancelHelp: 'Anfrage abbrechen',
  collapse: 'Ausblenden',
  deviceCode: 'Gerätecode',
  barViewing: 'KI sieht zu',
  barAgent: 'KI arbeitet',
  barUser: 'Sie steuern',
  connectedFor: time => `Verbunden · ${time}`,
  takeover: 'Übernehmen',
  handback: 'Zurückgeben',
  end: 'Beenden',
  autoTitle: 'KI automatisch zulassen',
  autoOn: level => `Ohne Rückfrage · ${level}`,
  autoOff: 'Jedes Mal fragen, bevor sich die KI verbindet',
  lockTitle: 'Bildschirm sperren, solange die KI verbunden ist',
  lockOn: 'Tippen und Wischen ist blockiert, solange die KI verbunden ist',
  lockOff: 'Sie können weiter tippen und scrollen – kommen Sie der KI möglichst nicht in die Quere',
  lockedToast: 'Bildschirm wird gesperrt, solange die KI verbunden ist',
  unlockedToast: 'Bildschirm wird nicht gesperrt, solange die KI verbunden ist',
  autoOffToast: 'Automatisch zulassen ist aus. Die KI fragt vorher',
  autoDialogTitle: 'Automatisch zulassen aktivieren?',
  autoDialogText:
    'Wenn sich die KI mit diesem Gerät verbinden möchte, verbindet sie sich sofort mit dem unten gewählten Zugriff. Sie sehen jedes Mal einen Hinweis, können jederzeit übernehmen oder beenden und diese Einstellung hier wieder ausschalten.',
  turnOn: 'Aktivieren',
  cancel: 'Abbrechen',
  autoOnToast: level => `Automatisch zulassen an · ${level}`,
  countdown: seconds => `Wird in ${seconds} s abgelehnt`,

  agentName: 'KI-Assistent',
  autoAllowedToast: (agent, level) => `„${agent}“ automatisch zugelassen · ${level}`,
  attachTitle: 'KI bittet um Zugriff',
  attachText: agent => `„${agent}“ möchte diese Seite ansehen. Zulassen?`,
  confirmTitle: 'Bitte bestätigen',
  confirmText: action => `Die KI möchte ${action}. Zulassen?`,
  allow: 'Zulassen',
  deny: 'Ablehnen',
  developer: 'Entwickler',
  devtoolsTitle: 'Ein Entwickler möchte debuggen',
  devtoolsText: name =>
    `„${name}“ möchte diese Seite mit DevTools untersuchen: Struktur, Logs, Netzwerkanfragen und lokaler Speicher werden sichtbar, und Skripte können auf der Seite ausgeführt werden. Zulassen?`,
  devtoolsToast: name => `„${name}“ hat DevTools geöffnet`,
  barDevtools: 'Entwickler debuggt',
  nameSep: ', ',
}

const agent: AgentMessages = {
  missingParam: name => `Fehlender Parameter: ${name}`,
  notString: name => `Parameter ${name} muss ein String sein`,
  unknownMethod: method => `Unbekannte Methode: ${method}`,
  needLevel: level => `Erfordert die Zugriffsstufe ${level}`,
  takenOver: 'Der Nutzer hat übernommen; warten Sie, bis er die Steuerung zurückgibt',
  userDenied: 'Der Nutzer hat diese Aktion abgelehnt',
  confirmBusy: 'Der Nutzer hat die vorherige Aktion noch nicht bestätigt',

  unknownModifier: m => `Unbekannte Modifikatortaste: ${m}`,
  unknownKey: key => `Unbekannte Taste: ${key}`,

  refNotInSnapshot: ref => `ref=${ref} ist nicht im letzten Snapshot; erstellen Sie einen neuen Snapshot`,
  refDetached: ref => `Das Element zu ref=${ref} ist nicht mehr auf der Seite; erstellen Sie einen neuen Snapshot`,
  queryNeedsCriteria: 'Mindestens eines von text, role oder name ist erforderlich',
  noSuchRecord: seq => `Kein Eintrag seq=${seq} im Sitzungsprotokoll (er wurde möglicherweise bereinigt)`,
  noSuchSession: id => `Kein Sitzungsprotokoll ${id} auf diesem Gerät (nur die letzten 3 Starts werden aufbewahrt)`,
  noSessionLog:
    'Noch kein Sitzungsprotokoll auf diesem Gerät (das Projekt hat die Aufzeichnung eventuell deaktiviert, oder die Seite hat run({ record: false }) übergeben)',
  sessionLogUnavailable: 'IndexedDB ist auf dieser Seite nicht verfügbar: kein Sitzungsprotokoll',

  readOnly: tag => `${tag} ist schreibgeschützt`,
  isSelect: tag => `${tag} ist ein Dropdown; verwenden Sie rwd.select`,
  notFillable: tag => `${tag} ist kein Textfeld und kann nicht ausgefüllt werden`,
  notSelect: tag => `${tag} ist kein Dropdown (select); verwenden Sie click`,
  singleSelect: 'Dieses Dropdown erlaubt nur eine Option',
  noSuchOption: (value, choices) => `Das Dropdown hat keine Option „${value}“; verfügbar: ${choices.join(', ')}`,
  optionDisabled: value => `Die Option „${value}“ ist deaktiviert`,

  badUrl: url => `Ungültige URL: ${url}`,
  httpOnly: 'Nur http(s)-URLs können geöffnet werden',
  textAppearTimeout: text => `Zeitüberschreitung beim Warten darauf, dass der Text „${text}“ erscheint`,
  textGoneTimeout: text => `Zeitüberschreitung beim Warten darauf, dass der Text „${text}“ verschwindet`,
  badFunction: message => `function kann nicht geparst werden: ${message}`,
  notAFunction: 'function muss ein Funktionsausdruck sein, z. B. "() => document.title"',

  elementDetached: tag => `Element ${tag} ist nicht mehr auf der Seite; erstellen Sie einen neuen Snapshot`,
  notActionable: (tag, reason) => `Element ${tag} kann nicht bedient werden: ${reason}`,
  notVisible: tag => `Element ${tag} ist nicht sichtbar`,
  reasonMoving: 'seine Position ändert sich ständig (möglicherweise eine Animation)',
  reasonOffscreen: 'es liegt außerhalb des Viewports',
  reasonObscured: (tag, ref) =>
    `der Klickpunkt ist von ${tag} verdeckt (ref=${ref}; klicken Sie es direkt an, z. B. den Hintergrund eines Popups, um das Popup zu schließen)`,

  overlayHeader:
    '[Overlays] Diese Elemente liegen über dem Seiteninhalt. Wenn ein Klick blockiert wird, klicken Sie direkt auf sie (z. B. auf den Hintergrund, um ein Popup zu schließen):',
  overlayMask: (tag, coverage, ref) => `- Hintergrund ${tag}, bedeckt ${coverage} % des Viewports [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- Ebene ${tag}${text ? ` „${text}“` : ''}, bedeckt ${coverage} % des Viewports [ref=${ref}]`,
  reasonHidden: 'es ist nicht sichtbar',
  reasonDisabled: 'es ist deaktiviert',

  storageUnavailable: area => `${area}Storage ist nicht verfügbar`,
  badStorageArea: "Parameter area muss 'local', 'session' oder 'cookie' sein",

  requestFailed: 'Anfrage fehlgeschlagen',
  noSuchRequest: id => `Keine Anfrage mit id=${id} (sie wurde möglicherweise verworfen)`,
  netFailed: (what, error) => `${what} → fehlgeschlagen (${error})`,
  wsFailed: url => `WebSocket ${url} → fehlgeschlagen`,

  tapped: (role, text) => `${role} „${text}“ angetippt`,
  tappedTag: (role, tag) => `${role} ${tag} angetippt`,
  roles: {
    button: 'Schaltfläche',
    link: 'Link',
    textbox: 'Textfeld',
    searchbox: 'Suchfeld',
    checkbox: 'Kontrollkästchen',
    radio: 'Optionsfeld',
    switch: 'Schalter',
    combobox: 'Dropdown',
    listbox: 'Liste',
    option: 'Option',
    tab: 'Tab',
    menuitem: 'Menüeintrag',
    img: 'Bild',
    heading: 'Überschrift',
    cell: 'Zelle',
    row: 'Zeile',
    listitem: 'Listeneintrag',
  },
  element: 'Element',
  devtoolsHistory: (count, dropped) =>
    `—— ${count} Logeinträge von vor dem Öffnen der DevTools (nur Text; Objekte lassen sich nicht aufklappen${dropped ? `; ${dropped} weitere wurden verworfen` : ''}) ——`,
}

const action: ActionMessages = {
  quote: name => `„${name}“`,
  click: target => `${target} antippen`,
  enterActivate: target => `bei ${target} Enter drücken`,
  enterSubmit: target => `${target} mit Enter absenden`,
}

const de: Locale = { id: 'de', name: 'Deutsch', dir: 'ltr', ui, action, agent }

export default de
