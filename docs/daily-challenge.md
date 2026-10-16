# The daily color challenge

Once a day, the home screen offers one card with its **name and colored mana
hidden**, and the player guesses its **color**. Three tries; after a miss the
game tells which picked colors are on the card and how many colors it has. A
win or a loss reveals the full card, the artist and a link to Scryfall, plus
played / wins / streak / best.

The header button (a card with a question mark, left of Settings) carries a
dot while today's card is unplayed.

## Editing the calendar

Everything editorial is in **`src/daily/calendar.js`**, one line per day:

```js
['2026-11-03', "Sigarda's Vanguard"],          // W  EDHREC 8780  Creature
['2026-12-28', "Skyshroud Ranger", ['Skyshroud']],  // optional words to hide
```

- English name exactly as on Scryfall; double quotes so apostrophes need no
  escape. The comment is a note for you; the answer always comes from
  Scryfall.
- Dates in order, no gaps. After the last line the list starts over, so the
  game never runs dry; `npm test` prints a warning when fewer than 14 days
  are left.
- Check an edit against Scryfall (needs internet, about 3 s per card):

  ```bash
  node tools/daily-calendar.js            # the whole list
  node tools/daily-calendar.js 2026-12    # one month
  ```

  It confirms each name exists, prints colors, EDHREC rank and which of
  pt / es / de have a print, totals per color, and lists cards whose rules or
  flavor text still shows a word of the name (hide it with the third item
  when it would let someone search the card).

`npm test` also checks the list offline: valid dates, consecutive days, no
card twice.

### How the starting list was picked

92 days, 2026-10-16 to 2027-01-15, from Scryfall cards that are legal in
Commander, single-faced, not lands, with a Portuguese print, ranked about
**4,000 to 18,000 on EDHREC** (played, not staples; half below 9,000, half
above), rules text between 90 and 360 characters that does not name its own
color or basic land type, and no "partner with", devoid or color indicator.
Each week holds the five colors plus a multicolor day and a wildcard
(multicolor or colorless): W 13, U 13, B 13, R 13, G 13, multicolor 20,
colorless 7.

## What is hidden

`src/daily/card.js`, pure and unit-tested:

- the name, in rules text, type line and flavor text: the English name, the
  printed name in the card's language, each face of a two-faced card, the
  short form legendary cards use ("Krenko" for "Krenko, Mob Boss"; "Gwaihir"
  for "Gwaihir the Windlord"), and any word from the line's third item. Whole
  words only, any case, accents included;
- the mana cost, and every colored symbol in the text (`{G}`, `{2/W}`,
  `{B/P}`, `{U/R}`), shown as a dashed `?`. `{2}`, `{X}`, `{C}`, `{T}` stay.

Shown: type line, mana value, rules and flavor text, power/toughness, loyalty,
defense. The colors to guess are the card's `colors`, not its color identity.

## Card language

The challenge options (gear on its header) pick the card language among the
eleven Scryfall has: the app language by default. The card is searched as
`!"<name>" lang:<code>`, newest translated print first; a card never printed
in that language falls back to English and says so. Each answer is cached on
the device for the day (`mtglc.dailyCard.v1`), so reopening works offline.

## Notifications

The switch is in the challenge options, plus a "send a test notification" row
once it is on.

Hit Easy is a static site with no server, so there is nothing to push from.
What works without one is **Periodic Background Sync**: the browser wakes the
service worker about once or twice a day (its choice), and
`src/daily/sw-daily.js` shows **one** notice per day, between 08:00 and 22:00
on the device clock, only if today's card was not played. Tapping it opens the
app straight into the challenge (`?daily=1`).

| Where | Daily notice |
| --- | --- |
| Chrome / Edge on Android, app installed | yes |
| Chrome / Edge on desktop, app installed | yes |
| Safari (iPhone, Mac), Firefox | no — the switch says so; the test notice works where notifications do |

A notice at a fixed time on every system, iPhone included, needs **Web Push**
from a server: VAPID keys, the push subscription stored in Supabase, and a
scheduled function sending at, say, 09:00. `src/daily/notify.js` is where it
would plug in. Not built yet.

### Testing it locally

1. `npm start`, open the app, open the challenge, gear, turn the switch on and
   allow notifications. "Send a test notification" proves the path.
2. To fire the real daily path without waiting for the browser: Chrome DevTools
   → Application → Service workers → **Periodic sync**, tag `hiteasy-daily`,
   *Periodic sync*. (Registering needs the app installed; outside 08:00–22:00,
   or with today played, the worker correctly shows nothing.)

## Isolation from the life counter

- **Own folder, own door.** Everything is in `src/daily/` plus
  `src/styles/daily.css` (every class starts with `daily-`). The app imports
  one file, `src/daily/entry.js`, in two places: the header button in
  `views/setup/home.js` and `initDaily()` in `app.js`.
- **Code loads on the tap.** `entry.js` imports only `day.js`, `storage.js` and
  `i18n.js`; the screen, the calendar and the network code come through a
  dynamic `import()`. A typo in `calendar.js` or Scryfall being down costs the
  challenge, never the home screen. A unit case checks these imports.
- **Not a route.** The screen is a full-screen layer over the home screen, so
  the router, the match clock and the wake lock never see it. It only opens
  from the home screen. It owns one history entry, so the back gesture closes
  it instead of leaving the app.
- **Own storage.** `mtglc.daily.v1` (settings and results) and
  `mtglc.dailyCard.v1` (card cache), both through `storageKey()`, plus the
  IndexedDB `hiteasy-daily` for the worker. The match database is never read
  or written; the browser journey asserts it is byte-identical after playing.
- **Header order kept.** The button sits in a `display: contents` slot, so the
  header's own buttons keep their positions.
- **Service worker.** `sw.js` gains the files in `ASSETS` and one guarded
  `importScripts('./src/daily/sw-daily.js')`: if it ever failed to load, the
  worker would still install and the app would still open offline.

To remove the feature: delete `src/daily/`, `src/styles/daily.css`,
`tests/daily-cases.js`, `tests/e2e/journeys/daily-challenge.js`,
`tests/e2e/fixtures/daily-card.js`, `tools/daily-calendar.js`, and the lines
that mention them in `home.js`, `app.js`, `styles.css`, `sw.js`,
`tests/cases.js`, `tests/e2e/lib/network.js` and `tests/e2e/journeys/index.js`.

## Tests

- `tests/daily-cases.js` (in `npm test`): calendar structure, schedule and
  looping, name and mana masking in English and Portuguese, judging, hints,
  streaks, the fetch with language fallback and cache, storage apart from the
  matches, the four dictionaries, the home button dot, the isolation of
  `entry.js`, and a full day played on the simulated DOM.
- `tests/e2e/journeys/daily-challenge.js` (in `npm run e2e`): on a phone, the
  dot, the hidden card, a miss and a win, storage apart, the back gesture, the
  language switch with Portuguese print and English fallback, and a match
  still starting at 40 afterwards. The fake Scryfall answers any name with a
  green card built around it (`tests/e2e/fixtures/daily-card.js`).
