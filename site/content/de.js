/**
 * German texts. Only words live here: links, icons, colors and art come from
 * pt.js, and arrays line up with pt.js BY POSITION (see ../content.js). A
 * text left out shows in Portuguese.
 *
 * Wording follows the app's own German (src/i18n/de.js): "du", "Partie",
 * "Kommandeur", "Zum Home-Bildschirm".
 */

export const CONTENT = {
  meta: {
    pages: {
      home: {
        title: 'Hit Easy · Lebenspunktezähler für Commander',
        description: 'Lebenspunktezähler für Commander-Runden: Leben, Kommandeurschaden, Gift und Züge mit einem Tippen, mit Statistik pro Deck. Kostenlos, funktioniert offline, ohne App Store.',
      },
      download: {
        title: 'Hit Easy herunterladen · Android, iPhone und Computer',
        description: 'Installiere Hit Easy direkt aus dem Browser, ohne App Store: Schritt für Schritt für Android, iPhone, iPad und Computer.',
      },
      account: {
        title: 'Dein Konto · Hit Easy',
        description: 'Erstelle dein Hit-Easy-Konto oder melde dich an: Deine Partien bleiben gespeichert und Freunde markieren dich über dein @.',
      },
      stats: {
        title: 'Deine Statistik · Hit Easy',
        description: 'Siegquote pro Deck, durchschnittliche Platzierung, Rivalen und letzte Partien, direkt aus deinem Hit-Easy-Konto.',
      },
    },
  },

  nav: {
    links: [
      { label: 'Funktionen' },
      { label: 'So funktioniert’s' },
      { label: 'Statistik' },
      { label: 'Download' },
    ],
    signIn: 'Anmelden',
    account: 'Mein Konto',
    cta: { label: 'Kostenlos laden' },
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    menuLabel: 'Hauptmenü',
    language: 'Sprache',
  },

  hero: {
    eyebrow: 'Lebenspunktezähler für Commander',
    title: 'Commander, ganz einfach.',
    text: 'Leben, Kommandeurschaden, Gift und Züge mit einem einzigen Tippen. Jede Partie wird zur Statistik deines Decks, gespeichert in deinem Konto.',
    primary: { label: 'Kostenlos laden' },
    secondary: { label: 'Im Browser öffnen' },
    badges: ['Funktioniert offline', 'Android, iPhone und Computer', 'Ohne App Store'],
    screenshot: {
      alt: 'Tischansicht von Hit Easy mit vier Spielern: Ana mit 34 Leben ist am Zug, Bruno hat 21, Carla 40 und Davi 12, davon 8 Kommandeurschaden. In der Mitte Zug 7.',
    },
  },

  features: {
    eyebrow: 'Funktionen',
    title: 'Für den Tisch gemacht, nicht fürs Handbuch',
    text: 'Jede Geste ist für Leute gedacht, die gerade Karten in der Hand halten.',
    items: [
      {
        title: 'Ein Tippen, ein Punkt',
        text: 'Tippe auf den Rand, um Leben abzuziehen oder hinzuzufügen. Halte gedrückt, und die Zahl läuft immer schneller. Mehrere Tipper hintereinander werden zu einem Eintrag.',
      },
      {
        title: 'Zum Angreifen ziehen',
        text: 'Ziehe vom Angreifer zum Ziel, und der Schaden wird mit Urheber gespeichert. So weiß die App, wer wen getroffen hat.',
      },
      {
        title: 'Automatisches Ausscheiden',
        text: 'Null Leben, 21 Schaden vom selben Kommandeur oder 10 Gift: Die App merkt es und verkündet den Sieger.',
      },
      {
        title: 'Flächenschaden und Entziehen',
        text: 'Doppeltippen in der Mitte: Schaden an alle, nur an die Gegner oder Entziehen, mit Gewinn der Summe oder des Betrags, den jeder verloren hat.',
      },
      {
        title: 'Züge mit ehrlicher Uhr',
        text: 'Die Uhr pausiert von selbst, wenn niemand am Tisch ist. Ein Gang zur Toilette wird nicht zum längsten Zug des Abends.',
      },
      {
        title: 'Geheime Abstimmungen',
        text: 'Bei Abstimmungskarten wählt jeder, ohne die Wahl der anderen zu sehen, und reicht das Gerät von Hand zu Hand.',
      },
      {
        title: 'Manazähler',
        text: 'Schwebendes Mana pro Farbe, das beim Zugwechsel verfällt und dich warnt, wenn noch etwas übrig ist.',
      },
      {
        title: 'Funktioniert ohne Internet',
        text: 'Einmal geöffnet, läuft die App offline. Eine Commander-Runde findet überall statt.',
      },
      {
        title: 'Geteilte Partien',
        text: 'Markiere deine Freunde über ihr @. Die Partie kommt bei ihnen als Einladung an und landet im Verlauf jedes Einzelnen.',
      },
    ],
  },

  how: {
    eyebrow: 'So funktioniert’s',
    title: 'Vom Tisch zur Statistik in drei Schritten',
    steps: [
      {
        title: 'Tisch einrichten',
        text: '2 bis 6 Spieler. Wähle, wer spielt, und den Kommandeur jedes Einzelnen: Die Decks, die diese Person schon einmal dabeihatte, stehen ganz oben.',
      },
      {
        title: 'Spielen',
        text: 'Das ganze Feld ist Gestenfläche. Der Kreis in der Mitte gibt den Zug weiter, macht rückgängig und öffnet das Menü.',
      },
      {
        title: 'Zahlen ansehen',
        text: 'Siegquote pro Deck und pro Spieler, verursachter und erlittener Schaden, durchschnittliche Platzierung, Rivalitäten und der Verlauf jeder Partie.',
      },
    ],
  },

  'stats-teaser': {
    eyebrow: 'Statistik',
    title: 'Dein Verlauf auf jedem Gerät',
    text: 'Mit einem Konto landen die Partien nach dem Ende in der Cloud und erscheinen auf dem Handy, dem Tablet und hier auf der Website.',
    bullets: [
      'Siegquote jedes Decks',
      'Rivalitäten: Wer trifft wen am häufigsten',
      'Wie du meistens gewinnst',
    ],
    primary: { label: 'Kostenloses Konto erstellen' },
    secondary: { label: 'Meine Statistik ansehen' },
    note: 'Konto erstellen und Partien aufzeichnen ist kostenlos. Der vollständige Verlauf gehört zum Statistik-Zugang, der während der Tests von Hand vergeben wird.',
    sample: {
      tag: 'Beispiel',
      title: 'Deine Decks',
      gamesLabel: 'Partien',
      kpis: [
        { label: 'Partien' },
        { label: 'Siege' },
        { label: 'Platzierung', value: '1,9' },
      ],
    },
  },

  install: {
    eyebrow: 'Download',
    title: 'In Sekunden installiert',
    text: 'Hit Easy ist eine Web-App: Sie wird direkt aus dem Browser installiert, ohne Store und fast ohne Speicherplatz, und aktualisiert sich selbst.',
    detected: 'Für dein Gerät',
    others: 'Andere Geräte',
    tabs: { android: 'Android', ios: 'iPhone und iPad', desktop: 'Computer' },
    installButton: 'Hit Easy installieren',
    installed: 'Fertig! Hit Easy ist auf deinem Startbildschirm.',
    dismissed: 'Installation abgebrochen. Du kannst sie jederzeit nachholen.',
    standalone: 'Du nutzt bereits die installierte App.',
    openApp: 'App öffnen',
    copyLink: 'Link kopieren',
    copied: 'Link kopiert',
    copyFailed: 'Kopieren nicht möglich. Halte die Adresse in der Leiste gedrückt, um sie zu kopieren.',
    guides: {
      'ios-safari': {
        title: 'iPhone und iPad, in Safari',
        steps: [
          { text: 'Tippe unten auf „App öffnen“.' },
          { text: 'Tippe auf Teilen, das Quadrat mit dem Pfeil nach oben. In neueren iOS-Versionen steckt es im •••-Knopf der Leiste.' },
          { text: 'Wähle „Zum Home-Bildschirm“. Fehlt der Eintrag, scrolle in der Liste nach unten.' },
          { text: 'Tippe auf „Hinzufügen“. Das Hit-Easy-Symbol erscheint auf dem Home-Bildschirm.' },
        ],
      },
      'ios-default': {
        title: 'iPhone und iPad, in Chrome, Edge oder Firefox',
        steps: [
          { text: 'Tippe unten auf „App öffnen“.' },
          { text: 'Tippe auf die Teilen-Taste neben der Adressleiste.' },
          { text: 'Wähle „Zum Home-Bildschirm“.' },
          { text: 'Bestätige mit „Hinzufügen“.' },
        ],
        note: 'Erfordert iOS 16.4 oder neuer. Bei älteren Versionen öffne diese Website in Safari.',
      },
      'ios-in-app': {
        title: 'Du bist in einer anderen App',
        steps: [
          { text: 'Tippe auf „Link kopieren“.' },
          { text: 'Öffne Safari und füge den Link in die Adressleiste ein.' },
          { text: 'Tippe in der App auf Teilen und dann auf „Zum Home-Bildschirm“.' },
        ],
        note: 'Browser innerhalb von Instagram, Facebook und ähnlichen Apps können keine Apps installieren.',
      },
      'android-chrome': {
        title: 'Android, in Chrome',
        steps: [
          { text: 'Tippe unten auf „App öffnen“.' },
          { text: 'Tippe oben rechts auf das Menü ⋮.' },
          { text: 'Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.' },
          { text: 'Bestätige mit „Installieren“.' },
        ],
      },
      'android-samsung': {
        title: 'Android, in Samsung Internet',
        steps: [
          { text: 'Tippe unten auf „App öffnen“.' },
          { text: 'Tippe auf das Menü ☰ in der unteren Leiste.' },
          { text: 'Wähle „Seite hinzufügen zu“ und dann „Startbildschirm“.' },
          { text: 'Bestätige mit „Hinzufügen“.' },
        ],
      },
      'android-firefox': {
        title: 'Android, in Firefox',
        steps: [
          { text: 'Tippe unten auf „App öffnen“.' },
          { text: 'Tippe auf das Menü ⋮.' },
          { text: 'Wähle „Installieren“ oder „Zum Startbildschirm hinzufügen“.' },
        ],
      },
      'android-in-app': {
        title: 'Du bist in einer anderen App',
        steps: [
          { text: 'Tippe auf „Link kopieren“.' },
          { text: 'Öffne Chrome und füge den Link in die Adressleiste ein.' },
          { text: 'Wähle im Menü ⋮ „App installieren“.' },
        ],
        note: 'Browser innerhalb von Instagram, Facebook und ähnlichen Apps können keine Apps installieren.',
      },
      'android-default': {
        title: 'Android',
        steps: [
          { text: 'Tippe unten auf „App öffnen“.' },
          { text: 'Öffne das Menü des Browsers.' },
          { text: 'Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.' },
        ],
      },
      'desktop-safari': {
        title: 'Mac, in Safari',
        steps: [
          { text: 'Klicke unten auf „App öffnen“.' },
          { text: 'Wähle im Menü Ablage „Zum Dock hinzufügen“.' },
          { text: 'Bestätige mit „Hinzufügen“.' },
        ],
        note: 'Erfordert macOS Sonoma oder neuer.',
      },
      'desktop-firefox': {
        title: 'Computer, in Firefox',
        steps: [
          { text: 'Klicke auf „App öffnen“: Sie funktioniert direkt im Browser.' },
          { text: 'Um sie als App zu installieren, öffne die Website in Chrome oder Edge.' },
        ],
      },
      'desktop-default': {
        title: 'Computer, in Chrome oder Edge',
        steps: [
          { text: 'Klicke unten auf „App öffnen“.' },
          { text: 'Klicke in der Adressleiste rechts auf das Installieren-Symbol.' },
          { text: 'Bestätige mit „Installieren“. Hit Easy öffnet sich in einem eigenen Fenster.' },
        ],
        note: 'Die App ist für ein Tablet oder Handy in der Tischmitte gemacht, funktioniert aber auch am Computer.',
      },
    },
  },

  faq: {
    eyebrow: 'Fragen',
    title: 'Häufige Fragen',
    items: [
      {
        q: 'Was kostet es?',
        a: 'Spielen, Partien aufzeichnen und ein Konto erstellen ist kostenlos. Der vollständige Statistik-Verlauf in der Cloud gehört zum Premium-Zugang; während der Tests wird dieser Zugang von Hand vergeben, Konto für Konto.',
      },
      {
        q: 'Muss ich es aus einem App Store laden?',
        a: 'Nein. Hit Easy ist eine Web-App (PWA): Sie wird direkt aus dem Browser installiert, braucht wenig Platz und aktualisiert sich selbst.',
      },
      {
        q: 'Funktioniert es ohne Internet?',
        a: 'Ja. Einmal geöffnet, funktioniert der Tisch offline. Das Internet wird nur gebraucht, um neue Kommandeure zu suchen und das Konto zu synchronisieren.',
      },
      {
        q: 'Funktioniert es auf dem iPhone?',
        a: 'Ja: in Safari und ab iOS 16.4 auch in Chrome und Edge. Installiert wird über die Teilen-Taste, mit „Zum Home-Bildschirm“.',
      },
      {
        q: 'Wandern meine Partien von einem Gerät zum anderen?',
        a: 'Mit angemeldetem Konto ja: Die Partien landen nach dem Ende in der Cloud. Ohne Konto behält jedes Gerät seinen eigenen Verlauf, und du kannst eine Datei exportieren und importieren.',
      },
      {
        q: 'Wie kommen meine Freunde in die Statistik?',
        a: 'Jede Person erstellt ein Konto und wählt ein @. Wer den Tisch einrichtet, markiert das @ jedes Einzelnen; die Partie kommt bei ihnen als Einladung an und landet nur im Verlauf derer, die annehmen.',
      },
      {
        q: 'Was macht ihr mit meinen Daten?',
        a: 'Wir speichern nur, was die App zum Funktionieren braucht. Die Details stehen in der Datenschutzerklärung (auf Portugiesisch).',
        link: { label: 'Datenschutzerklärung lesen' },
      },
    ],
  },

  cta: {
    title: 'Nimm es mit zur nächsten Runde',
    text: 'Kostenlos, ohne Pflicht-Anmeldung und in Sekunden startklar.',
    primary: { label: 'Kostenlos laden' },
    secondary: { label: 'Im Browser öffnen' },
  },

  footer: {
    text: 'Lebenspunktezähler für Commander-Runden.',
    columns: [
      {
        title: 'App',
        links: [{ label: 'App öffnen' }, { label: 'Download' }, { label: 'Funktionen' }],
      },
      {
        title: 'Konto',
        links: [{ label: 'Konto erstellen' }, { label: 'Anmelden' }, { label: 'Statistik' }],
      },
      {
        title: 'Über',
        links: [{ label: 'Datenschutz' }, { label: 'Häufige Fragen' }],
      },
    ],
    contact: 'Kontakt',
    legal: 'Hit Easy ist ein unabhängiges Projekt ohne Verbindung zu Wizards of the Coast. Magic: The Gathering ist eine Marke von Wizards of the Coast.',
  },

  account: {
    title: 'Dein Hit-Easy-Konto',
    text: 'Dasselbe Konto wie in der App. Damit bleiben deine Partien gespeichert und Freunde können dich über dein @ markieren.',
    loading: 'Dein Konto wird geladen…',
    cloudOff: 'Konten sind noch nicht verfügbar.',
    tabs: { signUp: 'Konto erstellen', signIn: 'Anmelden' },
    email: 'E-Mail',
    password: 'Passwort',
    passwordHint: 'Mindestens 8 Zeichen',
    show: 'Zeigen',
    hide: 'Verbergen',
    signUpSubmit: 'Konto erstellen',
    signInSubmit: 'Anmelden',
    forgot: 'Passwort vergessen',
    google: 'Weiter mit Google',
    apple: 'Weiter mit Apple',
    or: 'oder',
    working: 'Bitte warten…',
    terms: 'Mit dem Erstellen des Kontos stimmst du der {link} zu.',
    termsLink: 'Datenschutzerklärung',
    checkInboxTitle: 'Sieh in deine E-Mails',
    checkInboxText: 'Wir haben einen Bestätigungslink an {email} geschickt. Öffne ihn, um die Anmeldung abzuschließen.',
    backToForm: 'Zurück',
    resetSent: 'Falls es ein Konto mit {email} gibt, haben wir einen Link zum Erstellen eines neuen Passworts geschickt.',
    forgotNeedsEmail: 'Gib oben deine E-Mail ein und tippe noch einmal auf „Passwort vergessen“.',
    errors: {
      invalid_credentials: 'E-Mail oder Passwort falsch.',
      user_already_exists: 'Mit dieser E-Mail gibt es schon ein Konto. Nutze „Anmelden“.',
      email_exists: 'Mit dieser E-Mail gibt es schon ein Konto. Nutze „Anmelden“.',
      email_not_confirmed: 'Bestätige deine E-Mail vor dem Anmelden: Such den Link in deinem Posteingang.',
      weak_password: 'Schwaches Passwort. Nutze mindestens 8 Zeichen und mische Buchstaben und Ziffern.',
      email_address_invalid: 'Diese E-Mail sieht nicht gültig aus.',
      validation_failed: 'Prüfe E-Mail und Passwort.',
      over_email_send_rate_limit: 'Zu viele E-Mails in kurzer Zeit. Warte ein paar Minuten und versuch es erneut.',
      over_request_rate_limit: 'Zu viele Versuche in kurzer Zeit. Warte ein paar Minuten und versuch es erneut.',
      signup_disabled: 'Neue Anmeldungen sind gerade geschlossen.',
      network: 'Keine Verbindung zum Server. Prüfe dein Internet und versuch es erneut.',
      shortPassword: 'Das Passwort braucht mindestens 8 Zeichen.',
      badEmail: 'Gib eine gültige E-Mail ein.',
      generic: 'Etwas ist schiefgelaufen. Versuch es erneut.',
    },
    recovery: {
      title: 'Neues Passwort erstellen',
      text: 'Wähle das Passwort, das du ab jetzt in der App und auf der Website nutzt.',
      submit: 'Neues Passwort speichern',
      done: 'Passwort geändert. Du bist bereits angemeldet.',
    },
    profile: {
      hello: 'Hallo, {name}',
      signedInAs: 'Angemeldet als {email}',
      handleTitle: 'Dein @',
      handleText: 'So markieren dich deine Freunde am Tisch, damit die Partie in deinem Verlauf landet.',
      handlePlaceholder: 'dein_name',
      handleSave: '@ speichern',
      handleRules: '3 bis 20 Zeichen: Kleinbuchstaben, Ziffern oder _.',
      handleFree: 'Verfügbar',
      handleTaken: 'Schon vergeben',
      handleCurrent: 'Das ist dein aktuelles @',
      handleChecking: 'Wird geprüft…',
      handleInvalid: '3 bis 20 Kleinbuchstaben, Ziffern oder _.',
      handleSaved: '@ gespeichert',
      handleTooSoon: 'Das @ kann nur alle 15 Tage geändert werden. Wieder möglich am {date}.',
      handleChangeInApp: 'Um dein @ zu ändern, nutze die App: Einstellungen, Konto.',
      nameTitle: 'Name in Partien',
      nameText: 'So sehen dich deine Freunde. Leer gelassen erscheint dein @.',
      namePlaceholder: 'Wie dich der Tisch nennt',
      nameSave: 'Name speichern',
      nameSaved: 'Name gespeichert',
      accessTitle: 'Statistik-Zugang',
      accessOn: 'Freigeschaltet',
      accessOff: 'Noch nicht freigeschaltet',
      accessUntil: 'Gültig bis {date}',
      accessOffText: 'Deine Partien werden weiter gespeichert. Während der Tests wird der Zugang von Hand vergeben, Konto für Konto.',
      recheck: 'Ich habe Zugang, prüfen',
      stillLocked: 'Für dieses Konto ist noch kein Zugang eingetragen.',
      stats: 'Statistik ansehen',
      install: 'App installieren',
      openApp: 'App öffnen',
      signOut: 'Abmelden',
      tip: 'Öffnest du die App im selben Browser, bist du schon angemeldet.',
    },
  },

  stats: {
    title: 'Deine Statistik',
    signedOutTitle: 'Melde dich an, um deine Statistik zu sehen',
    signedOutText: 'Die Statistik kommt aus den Partien, die in deinem Konto gespeichert sind.',
    signedOutButton: 'Anmelden oder Konto erstellen',
    checking: 'Dein Zugang wird geprüft…',
    loading: 'Partien werden geladen…',
    lockedTitle: 'Die Statistik liegt in deinem Konto',
    lockedText: 'Deine Partien werden sicher gespeichert, sobald sie enden. Mit freigeschaltetem Zugang erscheint der vollständige Verlauf auf allen deinen Geräten.',
    recheck: 'Ich habe Zugang, prüfen',
    stillLocked: 'Für dieses Konto ist noch kein Zugang eingetragen.',
    earlyAccess: 'Während der Tests wird der Zugang von Hand vergeben, einzeln.',
    emptyTitle: 'Noch keine Partien in der Cloud',
    emptyText: 'Spiel in der App mit angemeldetem Konto: Jede Partie wird nach dem Ende hochgeladen.',
    openApp: 'App öffnen',
    noHandle: 'Wähle dein @, damit wir wissen, welche Partien deine sind.',
    noHandleButton: '@ wählen',
    notFound: 'Dein @ taucht noch in keiner Partie auf. Bitte die Person, die den Tisch einrichtet, dich über dein @ zu markieren. Bis dahin siehst du hier die Übersicht aller Partien des Kontos.',
    error: 'Die Partien konnten nicht geladen werden. Prüfe dein Internet und versuch es erneut.',
    retry: 'Erneut versuchen',
    refresh: 'Aktualisieren',
    kpis: {
      games: 'Partien',
      wins: 'Siege',
      winrate: 'Siegquote',
      avgPlace: 'Ø Platzierung',
      avgDamage: 'Schaden pro Partie',
      kills: 'Ausgeschaltet',
      avgTurn: 'Ø Zugdauer',
      avgMatch: 'Ø Partiedauer',
    },
    decksTitle: 'Deine Decks',
    decksText: 'Wie du mit jedem Kommandeur abschneidest.',
    playersTitle: 'Spieler',
    playersText: 'Alle, die in den Partien des Kontos vorkommen.',
    gamesOne: '1 Partie',
    gamesMany: '{n} Partien',
    winsShort: '{n}S',
    placeValue: '{n}',
    avgPlace: 'Ø Platz {n}',
    rivalsTitle: 'Mit wem du am meisten spielst',
    rivalsText: 'Gemeinsame Partien und wer vorne lag.',
    rivalScore: 'Du {a} × {b}',
    recentTitle: 'Letzte Partien',
    place: 'Platz {n}',
    youWon: 'Du hast gewonnen',
    winner: 'Gewonnen: {name}',
    noWinner: 'Kein Sieger',
    players: '{n} Spieler',
    moreInApp: 'Den Verlauf jeder Partie, die Abstimmungen und die vollständigen Rivalitäten findest du in der App.',
    openAppStats: 'In der App öffnen',
  },
};
