import type { ScriptText } from './en.ts'

// Was der skriptgesteuerte Agent (und der Kunde) auf Deutsch sagen.

export const de: ScriptText = {
  prompt:
    'Ein Kunde auf Gerät K7Q2-9M4X sagt, der Checkout sei kaputt: Die Gesamtsumme zeigt „--“ und die Bestellung geht nicht durch. Kannst du herausfinden, warum?',
  c1: 'öffnet „Wireless ANC Headphones Pro“',
  c2: 'wählt das Paket **Gift box**',
  c3: 'tippt auf **Buy now**',
  c4: 'sieht die Gesamtsumme „--“ und tippt auf **Unterstützung anfordern**',
  hintPrelude: 'Das ist das echte Seiten-SDK in einem Demo-Shop. Sehen Sie zu, wie der Kunde auf den Bug stößt…',
  hintApprove: 'Tippen Sie auf dem Smartphone auf „Zulassen“, um den Agenten hereinzulassen.',
  hintApproveAuto: (s: number) =>
    `Tippen Sie auf dem Smartphone auf „Zulassen“, um den Agenten hereinzulassen – oder die Demo tippt in ${s} s für Sie.`,
  hintRunning: 'Die Seite ist gesperrt, solange der Agent arbeitet. Tippen Sie auf dem Smartphone auf „Übernehmen“, um die Steuerung zu holen.',
  hintHandback: 'Sie haben die Steuerung. Tippen Sie auf „Zurückgeben“, damit der Agent weitermacht, oder auf „Beenden“, um ihn zu stoppen.',
  hintDone: 'Fertig. Starten Sie neu, um noch einmal zuzusehen, oder probieren Sie den Shop selbst aus.',
  autoApproved: 'Keine Antwort auf dem Smartphone – die Demo hat „Zulassen“ für Sie getippt, damit es weitergeht.',
  approved: (level: string) => `Der Kunde hat den Zugriff erlaubt (**${level}**).`,
  s1: 'Ich suche dieses Gerät und frage den Kunden nach Zugriff.',
  s2: 'Es ist online und als „in Betreuung“ markiert. Ich frage den Zugriff an – der Kunde muss ihn auf dem Smartphone bestätigen.',
  s3: 'Ich bin drin. Ich lege einen Plan auf seinen Bildschirm, damit er mitlesen kann, und sehe mir dann die Seite an.',
  s4: 'Die Gesamtsumme steht tatsächlich auf „--“. Telefonnummer, Zahlungs-PIN und Kartennummer kommen maskiert an, wie es sein soll. Ich sehe in der Console nach.',
  s5: 'Da ist es: `TypeError: order.price.toFixed is not a function`, geworfen beim Berechnen der Gesamtsumme. Das Gutscheinfeld sieht auch verdächtig aus – ich probiere den Code aus dem Banner.',
  s6: '`GET api/coupon` antwortet mit 404 – ein eigenes Problem, das notiere ich. Zurück zur Gesamtsumme: Was ist `order.price`?',
  s7: (price: string) =>
    `\`price\` ist der String \`${price}\` – formatierter Text, keine Zahl, deshalb wirft \`toFixed()\`. Der Checkout liest diesen Wert nur; geschrieben wird er auf der Produktseite. Wie ist der Kunde hierhergekommen?`,
  s7b: 'Die gespeicherte Bestellung enthält keinen Preis als Text – die Daten haben sich geändert, während Sie die Steuerung hatten. Der Console-Fehler bleibt die beste Spur; ich sehe mir den Weg des Kunden an.',
  s8: 'Liste → Produkt → Checkout, mit dem Fehler direkt nach dem Ankommen. Ich reproduziere es auf der Produktseite: zuerst mit Standard, dann mit Gift box.',
  s9: (total: string) => `Mit Standard liegt die Gesamtsumme bei ${total} – der Checkout funktioniert. Jetzt die Geschenkverpackung:`,
  s10: 'Mit Gift box geht es jedes Mal kaputt. Ich lese die Zeile auf der Produktseite, die den Preis schreibt.',
  s11: 'Gefunden. Bevor ich das übergebe, beweise ich die Lösung live auf dem Smartphone des Kunden: ein Patch im Speicher der Seite, der den gespeicherten Preis wieder in eine Zahl verwandelt, dann ein Reload des Checkouts.',
  s12: (total: string) =>
    `Die Gesamtsumme wird als ${total} gerendert – Diagnose bestätigt, abgeschickt wurde nichts. Der Patch lebt nur in dieser Seite; die echte Lösung geht durch Ihr Release. Ich schließe ab und verlasse das Smartphone des Kunden.`,
  s12b: 'Der Checkout zeigt auch nach dem Patch „--“, es steckt also mehr dahinter als der gespeicherte Preis. Ich belasse es bei der Diagnose und übergebe, was ich gefunden habe.',
  takeover: 'Sie haben übernommen – ich pausiere und warte, bis Sie die Steuerung zurückgeben.',
  resumed: 'Danke, ich habe die Steuerung wieder. Ich mache dort weiter, wo ich aufgehört habe.',
  ended: 'Der Kunde hat die Sitzung beendet, also habe ich aufgehört. Auf seinem Smartphone wurde nichts weiter verändert.',
  denied: 'Der Kunde hat den Zugriff abgelehnt, ich kann mir die Seite also nicht ansehen. Ich höre hier auf.',
  timeout: 'Der Kunde hat nicht auf die Anfrage geantwortet, ich kann mich also nicht verbinden. Ich höre hier auf.',
  forbidden: 'Dafür braucht es eine höhere Zugriffsstufe, als der Kunde gewährt hat – ich überspringe diese Prüfung.',
  moving: (where: string) => `Das Smartphone ist jetzt auf einer anderen Seite; ich rufe wieder ${where} auf.`,
  whereCheckout: 'den Checkout',
  whereDetail: 'die Produktseite',
  task: {
    title: 'Gesamtsumme im Checkout zeigt --',
    steps: ['Checkout-Seite ansehen', 'Console und Netzwerk lesen', 'Bestelldaten prüfen', 'Auf der Produktseite reproduzieren', 'Ursache eingrenzen', 'Lösung live verifizieren'],
  },
  /** Names of things on the shop page the scenario looks up (the shop is in English for every language but Chinese). */
  find: { coupon: 'Coupon', apply: 'Apply', pkg: 'Package', buy: 'Buy now', total: 'Total', standard: 'standard', gift: 'gift' },
  fallbackPrice: '"$208.00"',
  standardTotal: '$199.00',
  patchedTotal: '$208.00',
  summary: {
    rootCause: 'Ursache',
    rootCauseText: (price: string) =>
      `Wenn „Gift box“ gewählt ist, schreibt <code>detail.html</code> den <strong>formatierten Preistext</strong> (<code>${price}</code>) in die Bestellung statt einer Zahl. <code>checkout.html</code> ruft dann <code>order.price.toFixed(2)</code> auf, was <code>TypeError: order.price.toFixed is not a function</code> wirft – die Gesamtsumme rendert „--“, und „Place order“ wirft, bevor überhaupt eine Anfrage rausgeht. Mit Standard funktioniert es, weil dort eine Zahl gespeichert wird.`,
    evidence: 'Belege',
    evidenceItems: (price: string) => [
      'Console im Checkout: der TypeError, jedes Mal wenn die Seite mit einer Geschenkverpackung lädt.',
      `<code>sessionStorage["demo:order"].price</code> ist der String <code>${price}</code>.`,
      'Auf dem Gerät reproduziert: Standard ergibt $199.00, Gift box zeigt „--“.',
      'Die Zeile auf der Produktseite, die den Preis schreibt (<code>evaluate_script</code>).',
    ],
    verified: 'Live verifiziert',
    verifiedText: (total: string) =>
      `Ein Patch im Speicher der Seite hat den gespeicherten Preis wieder in eine Zahl verwandelt; nach einem Reload wurde die Gesamtsumme als <strong>${total}</strong> gerendert. Abgeschickt wurde nichts, und auf dem Gerät bleibt nichts zurück.`,
    notVerified: 'Der Live-Patch wurde übersprungen (er braucht die Stufe advanced).',
    fix: 'Lösung',
    fixText: 'Nur zur Anzeige formatieren (das Label für den Einzelpreis macht es schon so) und den Checkout mit <code>Number(order.price)</code> absichern.',
    also: 'Außerdem aufgefallen',
    alsoText: '<code>GET api/coupon?code=VIP40</code> liefert 404, Gutscheincodes lassen sich also nicht einlösen – ein eigener Bug in der Gutschein-API.',
    skipped: 'Einige Prüfungen wurden wegen der gewährten Zugriffsstufe übersprungen.',
    left: 'Auf dem Smartphone des Kunden wurde nichts abgeschickt, und ich habe die Verbindung danach getrennt.',
  },
  /** The extra the gift box adds in the shop's own currency (the diff shown in the summary). */
  diffExtra: 9,
}
