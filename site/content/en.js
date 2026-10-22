/**
 * English texts. Only words live here: links, icons, colors and art come from
 * pt.js, and arrays line up with pt.js BY POSITION (see ../content.js). A
 * text left out shows in Portuguese.
 *
 * Wording follows the app's own English (src/i18n/en.js): "match", "deck",
 * "Add to Home Screen".
 */

export const CONTENT = {
  meta: {
    pages: {
      home: {
        title: 'Hit Easy · life counter for Commander',
        description: 'A life counter for Commander tables: life, commander damage, poison and turns in one tap, with statistics per deck. Free, works offline, no app store.',
      },
      download: {
        title: 'Download Hit Easy · Android, iPhone and computer',
        description: 'Install Hit Easy straight from the browser, no app store: step by step for Android, iPhone, iPad and computer.',
      },
      account: {
        title: 'Your account · Hit Easy',
        description: 'Create your Hit Easy account or sign in: your matches are kept safe and friends can tag you by your @.',
      },
      stats: {
        title: 'Your statistics · Hit Easy',
        description: 'Win rate per deck, average placement, rivals and recent matches, straight from your Hit Easy account.',
      },
    },
  },

  nav: {
    links: [
      { label: 'Features' },
      { label: 'How it works' },
      { label: 'Statistics' },
      { label: 'Download' },
    ],
    signIn: 'Sign in',
    account: 'My account',
    cta: { label: 'Get it free' },
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menuLabel: 'Main',
    language: 'Language',
  },

  hero: {
    eyebrow: 'Life counter for Commander',
    title: 'Commander, made simple.',
    text: 'Life, commander damage, poison and turns in a single tap. Every match becomes statistics for your deck, saved in your account.',
    primary: { label: 'Get it free' },
    secondary: { label: 'Open in the browser' },
    badges: ['Works offline', 'Android, iPhone and computer', 'No app store'],
    screenshot: {
      alt: 'Hit Easy table screen with four players: Ana on 34 life and taking her turn, Bruno on 21, Carla on 40 and Davi on 12, with 8 commander damage. Turn 7 in the center.',
    },
  },

  features: {
    eyebrow: 'Features',
    title: 'Made for the table, not for the manual',
    text: 'Every gesture was designed for someone holding cards.',
    items: [
      {
        title: 'One tap, one point',
        text: 'Tap the edge to take or add life. Hold, and the number runs, speeding up. Taps in a row become a single entry.',
      },
      {
        title: 'Drag to attack',
        text: 'Drag from the attacker to the target and the damage is recorded with its author. That is how the app knows who hit whom.',
      },
      {
        title: 'Automatic elimination',
        text: 'Zero life, 21 damage from the same commander or 10 poison: the app notices and announces the winner.',
      },
      {
        title: 'Area damage and drain',
        text: 'Double tap the center: damage to everyone, only to opponents, or drain, gaining the total or the same amount from each.',
      },
      {
        title: 'Turns with an honest clock',
        text: 'The clock pauses by itself when nobody is at the table. A trip to the bathroom does not become the longest turn of the night.',
      },
      {
        title: 'Secret votes',
        text: 'For voting cards, everyone chooses without seeing the others\' choices, passing the device from hand to hand.',
      },
      {
        title: 'Mana counter',
        text: 'Floating mana per color, which resets when the turn passes and warns you when some is still left.',
      },
      {
        title: 'Works without internet',
        text: 'Once opened, the app runs offline. A Commander table happens anywhere.',
      },
      {
        title: 'Shared matches',
        text: 'Tag your friends by their @. The match reaches them as an invite and goes into each one\'s history.',
      },
    ],
  },

  how: {
    eyebrow: 'How it works',
    title: 'From the table to the statistics in three steps',
    steps: [
      {
        title: 'Set up the table',
        text: 'From 2 to 6 players. Pick who plays and each one\'s commander: the decks that person has brought before come first.',
      },
      {
        title: 'Play',
        text: 'The whole panel is a gesture area. The central circle passes the turn, undoes and opens the menu.',
      },
      {
        title: 'See the numbers',
        text: 'Win rate per deck and per player, damage dealt and taken, average placement, rivalries and the timeline of every match.',
      },
    ],
  },

  'stats-teaser': {
    eyebrow: 'Statistics',
    title: 'Your history on any device',
    text: 'With an account, matches go up to the cloud when they end and show up on your phone, your tablet and here on the site.',
    bullets: [
      'Win rate of each deck',
      'Rivalries: who hits whom the most',
      'How you usually win',
    ],
    primary: { label: 'Create a free account' },
    secondary: { label: 'See my statistics' },
    note: 'Creating the account and recording matches is free. The full history is part of statistics access, which is granted manually during testing.',
    sample: {
      tag: 'Example',
      title: 'Your decks',
      gamesLabel: 'matches',
      kpis: [
        { label: 'Matches' },
        { label: 'Wins' },
        { label: 'Placement', value: '1.9' },
      ],
    },
  },

  install: {
    eyebrow: 'Download',
    title: 'Install in seconds',
    text: 'Hit Easy is a web app: it installs straight from the browser, with no store and no storage to spare, and it updates itself.',
    detected: 'For your device',
    others: 'Other devices',
    tabs: { android: 'Android', ios: 'iPhone and iPad', desktop: 'Computer' },
    installButton: 'Install Hit Easy',
    installed: 'Done! Hit Easy is on your home screen.',
    dismissed: 'Installation cancelled. You can install it whenever you like.',
    standalone: 'You are already using the installed app.',
    openApp: 'Open the app',
    copyLink: 'Copy link',
    copied: 'Link copied',
    copyFailed: 'Could not copy. Press and hold the address in the bar to copy it.',
    guides: {
      'ios-safari': {
        title: 'iPhone and iPad, in Safari',
        steps: [
          { text: 'Tap "Open the app" below.' },
          { text: 'Tap Share, the square with the arrow pointing up. On newer iOS versions it is inside the ••• button in the bar.' },
          { text: 'Choose "Add to Home Screen". If it is missing, scroll the list down.' },
          { text: 'Tap "Add". The Hit Easy icon shows up on your home screen.' },
        ],
      },
      'ios-default': {
        title: 'iPhone and iPad, in Chrome, Edge or Firefox',
        steps: [
          { text: 'Tap "Open the app" below.' },
          { text: 'Tap the Share button next to the address bar.' },
          { text: 'Choose "Add to Home Screen".' },
          { text: 'Confirm with "Add".' },
        ],
        note: 'Requires iOS 16.4 or newer. On earlier versions, open this site in Safari.',
      },
      'ios-in-app': {
        title: 'You are inside another app',
        steps: [
          { text: 'Tap "Copy link".' },
          { text: 'Open Safari and paste the link into the address bar.' },
          { text: 'In the app, tap Share and then "Add to Home Screen".' },
        ],
        note: 'Browsers inside Instagram, Facebook and similar apps cannot install apps.',
      },
      'android-chrome': {
        title: 'Android, in Chrome',
        steps: [
          { text: 'Tap "Open the app" below.' },
          { text: 'Tap the ⋮ menu in the top right corner.' },
          { text: 'Choose "Install app" or "Add to Home screen".' },
          { text: 'Confirm with "Install".' },
        ],
      },
      'android-samsung': {
        title: 'Android, in Samsung Internet',
        steps: [
          { text: 'Tap "Open the app" below.' },
          { text: 'Tap the ☰ menu in the bottom bar.' },
          { text: 'Choose "Add page to" and then "Home screen".' },
          { text: 'Confirm with "Add".' },
        ],
      },
      'android-firefox': {
        title: 'Android, in Firefox',
        steps: [
          { text: 'Tap "Open the app" below.' },
          { text: 'Tap the ⋮ menu.' },
          { text: 'Choose "Install" or "Add to Home screen".' },
        ],
      },
      'android-in-app': {
        title: 'You are inside another app',
        steps: [
          { text: 'Tap "Copy link".' },
          { text: 'Open Chrome and paste the link into the address bar.' },
          { text: 'In the ⋮ menu, choose "Install app".' },
        ],
        note: 'Browsers inside Instagram, Facebook and similar apps cannot install apps.',
      },
      'android-default': {
        title: 'Android',
        steps: [
          { text: 'Tap "Open the app" below.' },
          { text: 'Open the browser menu.' },
          { text: 'Choose "Install app" or "Add to Home screen".' },
        ],
      },
      'desktop-safari': {
        title: 'Mac, in Safari',
        steps: [
          { text: 'Click "Open the app" below.' },
          { text: 'In the File menu, choose "Add to Dock".' },
          { text: 'Confirm with "Add".' },
        ],
        note: 'Requires macOS Sonoma or newer.',
      },
      'desktop-firefox': {
        title: 'Computer, in Firefox',
        steps: [
          { text: 'Click "Open the app": it works right in the browser.' },
          { text: 'To install it as an app, open the site in Chrome or Edge.' },
        ],
      },
      'desktop-default': {
        title: 'Computer, in Chrome or Edge',
        steps: [
          { text: 'Click "Open the app" below.' },
          { text: 'In the address bar, click the install icon on the right.' },
          { text: 'Confirm with "Install". Hit Easy opens in its own window.' },
        ],
        note: 'The app was made for a tablet or phone in the middle of the table, but it works on a computer too.',
      },
    },
  },

  faq: {
    eyebrow: 'Questions',
    title: 'Frequently asked questions',
    items: [
      {
        q: 'How much does it cost?',
        a: 'Playing, recording matches and creating the account are free. The full statistics history in the cloud is part of premium access; during testing, that access is granted manually, account by account.',
      },
      {
        q: 'Do I need to download it from an app store?',
        a: 'No. Hit Easy is a web app (PWA): it installs straight from the browser, takes little space and updates itself.',
      },
      {
        q: 'Does it work without internet?',
        a: 'Yes. Once opened, the table works offline. The internet is only used to look up new commanders and to sync the account.',
      },
      {
        q: 'Does it work on iPhone?',
        a: 'Yes: in Safari, and also in Chrome and Edge from iOS 16.4 on. You install it from the Share button, with "Add to Home Screen".',
      },
      {
        q: 'Do my matches move from one device to another?',
        a: 'With the account signed in, yes: matches go up to the cloud when they end. Without an account, each device keeps its own history, and you can export and import a file.',
      },
      {
        q: 'How do my friends get into the statistics?',
        a: 'Each person creates an account and picks an @. Whoever sets up the table tags each one\'s @; the match reaches them as an invite and only goes into the history of whoever accepts.',
      },
      {
        q: 'What do you do with my data?',
        a: 'We keep only what the app needs to work. The details are in the privacy policy (in Portuguese).',
        link: { label: 'Read the privacy policy' },
      },
    ],
  },

  cta: {
    title: 'Bring it to your next table',
    text: 'Free, no sign-up required, ready in seconds.',
    primary: { label: 'Get it free' },
    secondary: { label: 'Open in the browser' },
  },

  footer: {
    text: 'A life counter for Commander tables.',
    columns: [
      {
        title: 'App',
        links: [{ label: 'Open the app' }, { label: 'Download' }, { label: 'Features' }],
      },
      {
        title: 'Account',
        links: [{ label: 'Create account' }, { label: 'Sign in' }, { label: 'Statistics' }],
      },
      {
        title: 'About',
        links: [{ label: 'Privacy' }, { label: 'FAQ' }],
      },
    ],
    contact: 'Contact',
    legal: 'Hit Easy is an independent project, not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast.',
  },

  account: {
    title: 'Your Hit Easy account',
    text: 'The same account as the app. With it, your matches are kept safe and friends can tag you by your @.',
    loading: 'Loading your account…',
    cloudOff: 'Accounts are not available yet.',
    tabs: { signUp: 'Create account', signIn: 'Sign in' },
    email: 'E-mail',
    password: 'Password',
    passwordHint: 'At least 8 characters',
    show: 'Show',
    hide: 'Hide',
    signUpSubmit: 'Create account',
    signInSubmit: 'Sign in',
    forgot: 'I forgot my password',
    google: 'Continue with Google',
    apple: 'Continue with Apple',
    or: 'or',
    working: 'Please wait…',
    terms: 'By creating the account, you agree to the {link}.',
    termsLink: 'privacy policy',
    checkInboxTitle: 'Check your e-mail',
    checkInboxText: 'We sent a confirmation link to {email}. Open the link to finish signing up.',
    backToForm: 'Back',
    resetSent: 'If there is an account with {email}, we sent a link to create a new password.',
    forgotNeedsEmail: 'Type your e-mail in the field above and tap "I forgot my password" again.',
    errors: {
      invalid_credentials: 'Wrong e-mail or password.',
      user_already_exists: 'There is already an account with this e-mail. Use "Sign in".',
      email_exists: 'There is already an account with this e-mail. Use "Sign in".',
      email_not_confirmed: 'Confirm your e-mail before signing in: look for the link in your inbox.',
      weak_password: 'Weak password. Use at least 8 characters, mixing letters and numbers.',
      email_address_invalid: 'This e-mail does not look valid.',
      validation_failed: 'Check the e-mail and the password.',
      over_email_send_rate_limit: 'Too many e-mails in a short time. Wait a few minutes and try again.',
      over_request_rate_limit: 'Too many attempts in a short time. Wait a few minutes and try again.',
      signup_disabled: 'New sign-ups are closed right now.',
      network: 'No connection to the server. Check your internet and try again.',
      shortPassword: 'The password needs at least 8 characters.',
      badEmail: 'Type a valid e-mail.',
      generic: 'Something went wrong. Try again.',
    },
    recovery: {
      title: 'Create a new password',
      text: 'Choose the password you will use from now on, in the app and on the site.',
      submit: 'Save new password',
      done: 'Password changed. You are already signed in.',
    },
    profile: {
      hello: 'Hi, {name}',
      signedInAs: 'Signed in as {email}',
      handleTitle: 'Your @',
      handleText: 'It is how your friends tag you at the table, so the match goes into your history.',
      handlePlaceholder: 'your_name',
      handleSave: 'Save @',
      handleRules: '3 to 20 characters: lowercase letters, numbers or _.',
      handleFree: 'Available',
      handleTaken: 'Already taken',
      handleCurrent: 'It is your current @',
      handleChecking: 'Checking…',
      handleInvalid: 'Use 3 to 20 lowercase letters, numbers or _.',
      handleSaved: '@ saved',
      handleTooSoon: 'The @ can only be changed every 15 days. Unlocks on {date}.',
      handleChangeInApp: 'To change your @, use the app: Settings, Account.',
      nameTitle: 'Name in matches',
      nameText: 'How you show up to your friends. Left blank, your @ shows up.',
      namePlaceholder: 'What the table calls you',
      nameSave: 'Save name',
      nameSaved: 'Name saved',
      accessTitle: 'Statistics access',
      accessOn: 'Granted',
      accessOff: 'Not granted yet',
      accessUntil: 'Valid until {date}',
      accessOffText: 'Your matches keep being saved. During testing, access is granted manually, account by account.',
      recheck: 'I already have access, check',
      stillLocked: 'No access yet for this account.',
      stats: 'See statistics',
      install: 'Install the app',
      openApp: 'Open the app',
      signOut: 'Sign out',
      tip: 'Open the app in this same browser and you are already signed in.',
    },
  },

  stats: {
    title: 'Your statistics',
    signedOutTitle: 'Sign in to see your statistics',
    signedOutText: 'The statistics come from the matches saved in your account.',
    signedOutButton: 'Sign in or create an account',
    checking: 'Checking your access…',
    loading: 'Loading matches…',
    lockedTitle: 'Statistics live in your account',
    lockedText: 'Your matches are safely stored the moment they end. Once access is granted, the full history shows up on every device of yours.',
    recheck: 'I already have access, check',
    stillLocked: 'No access yet for this account.',
    earlyAccess: 'During testing, access is granted manually, one by one.',
    emptyTitle: 'No matches in the cloud yet',
    emptyText: 'Play in the app with your account signed in: each match goes up when it ends.',
    openApp: 'Open the app',
    noHandle: 'Pick your @ so we know which matches are yours.',
    noHandleButton: 'Pick @',
    notFound: 'Your @ does not show up in any match yet. Ask whoever sets up the table to tag you by your @. Meanwhile, here is a summary of every match in the account.',
    error: 'Could not load the matches. Check your internet and try again.',
    retry: 'Try again',
    refresh: 'Refresh',
    kpis: {
      games: 'Matches',
      wins: 'Wins',
      winrate: 'Win rate',
      avgPlace: 'Average placement',
      avgDamage: 'Damage per match',
      kills: 'Eliminations',
      avgTurn: 'Average turn time',
      avgMatch: 'Average length',
    },
    decksTitle: 'Your decks',
    decksText: 'How you do with each commander.',
    playersTitle: 'Players',
    playersText: 'Everyone who shows up in the account\'s matches.',
    gamesOne: '1 match',
    gamesMany: '{n} matches',
    winsShort: '{n}W',
    placeValue: '{n}',
    avgPlace: 'avg. place {n}',
    rivalsTitle: 'Who you play with the most',
    rivalsText: 'Matches together and who finished ahead.',
    rivalScore: 'You {a} × {b}',
    recentTitle: 'Recent matches',
    place: '#{n}',
    youWon: 'You won',
    winner: 'Won: {name}',
    noWinner: 'No winner',
    players: '{n} players',
    moreInApp: 'The timeline of each match, the votes and the full rivalries are in the app.',
    openAppStats: 'Open in the app',
  },
};
