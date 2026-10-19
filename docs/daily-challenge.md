# The daily color challenge

Once a day, the home screen offers one card with its **name and colored mana
hidden**, and the player guesses its **color**. Three tries; after a miss the
game tells only **how many** of the picked colors are on the card - never
which ones, and no hint with the card's number of colors. A win or a loss reveals the full card, the artist and a link to Scryfall, plus
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

## Settings panel

The gear on the challenge's header opens a bottom panel built like the home
screen's Settings, with the same rows:

- **App language** - the same setting as Settings > Language on the home
  screen. Switching it redraws the challenge, the home screen underneath and
  the panel itself (by reopening it, as the home settings do).
- **Card language** - see below.
- **Notifications**: see below.

With the panel open, the phone's back gesture closes only the panel.
`src/daily/back.js` makes that work: app.js closes any open panel on
popstate before other listeners run, so the challenge registers its own
listener at startup, ahead of app.js, to learn whether a panel was open.

## Card language

The panel picks the card language among the eleven Scryfall has: the app
language by default. The card is searched as
`!"<name>" lang:<code>`, newest translated print first; a card never printed
in that language falls back to English and says so. Each answer is cached on
the device for the day (`mtglc.dailyCard.v1`), so reopening works offline.

## Notifications

The switch is in the settings panel, plus a "send a test notification" row
once it is on.

### Server notice (Web Push)

The notice comes from the server: at **09:00 on the device's own clock**, once
a day, and only if today's card was not played.

```
app (notify.js)  --subscription, language, time zone-->  Supabase: avisos_diarios
pg_cron, every hour  -->  Edge Function daily-push  -->  push service  -->  sw-daily.js
```

- `src/daily/notify.js` subscribes with `VAPID_PUBLIC_KEY` (`src/config.js`)
  and calls `inscrever_aviso`. **Every app opening** calls `refresh()`, which
  re-subscribes if the subscription was lost and sends the texts again in
  today's language. Finishing the card calls `aviso_jogado`. Turning the
  switch off calls `cancelar_aviso` and unsubscribes.
- `sql/012-daily-notice.sql` has the table and the functions. Anonymous, like
  the challenge. Only real push-service hosts are accepted as endpoints, so
  nobody can point the server at a URL of their choice. `avisos_a_enviar()`
  claims what is due and marks it sent in the same step, so a second run
  sends nothing twice.
- `supabase/functions/daily-push/` encrypts and sends. `webpush.js` is RFC
  8291 + VAPID on WebCrypto, with no library, and is checked in
  `tests/push-cases.js` against the RFC's own example. A 404/410 from the push
  service deletes the row.
- `sql/013-daily-notice-schedule.sql` is the hourly pg_cron job.
- `sw-daily.js` shows whatever the push carries. It must show something on
  every push, because Chrome penalizes silent pushes. It also handles
  `pushsubscriptionchange`.

| Where | Daily notice |
| --- | --- |
| Chrome / Edge / Samsung on Android (installed or not) | yes |
| Chrome / Edge / Firefox on desktop | yes, while the browser is running |
| iPhone / iPad, app added to the Home Screen (iOS 16.4+) | yes |
| Safari tab on iPhone (not added to the Home Screen) | no; the switch says how to get it |

Verified on 2026-10-19: a real Chrome subscribed at `fcm.googleapis.com` and
a real Edge at `*.notify.windows.com`. Both got a notice sealed by
`webpush.js` (push service answered 201), and the app's worker decrypted and
showed it.

### Fallback: Periodic Background Sync

Without a VAPID key or push support, the switch falls back to Periodic
Background Sync (mode `'on'`). In that mode the browser wakes the worker
whenever it chooses (at most every 12 hours in Chrome, and only for sites it
finds engaging), and the worker shows the notice between 08:00 and 22:00. This
was the only path up to 1.11.0, and it is why the notice almost never came.

### Turning the server on (once)

Everything below happens in the Supabase project and needs your login.

1. **SQL Editor**: run `sql/012-daily-notice.sql`.
2. **Edge Function**: from the repo root,
   `npx supabase login`, then
   `npx supabase functions deploy daily-push --project-ref <ref> --no-verify-jwt`.
3. **Function secrets**: `VAPID_PUBLIC_KEY` (the same as in `src/config.js`),
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`https://alienpls-vibes.github.io/hit-easy/`)
   and `CRON_SECRET` (any long random string):
   `npx supabase secrets set --project-ref <ref> --env-file <file>`.
   The private key never goes into the repo.
4. **SQL Editor**: create the two Vault secrets listed at the top of
   `sql/013-daily-notice-schedule.sql`, then run that file.
5. Check: **Edge Functions → daily-push → Logs** shows one line an hour,
   such as `{"due":0,"sent":0,"gone":0,"failed":0}`.

Rotating the VAPID pair: change both places. Each device replaces its old
subscription on its next opening (`pushSubscription()` compares the key).

### Testing it locally

1. `npm start`, open the app, open the challenge, gear, turn the switch on and
   allow notifications. "Send a test notification" proves the worker can show
   notices.
2. Journeys run in off-the-record contexts, where Chrome refuses push. The
   daily journey therefore replaces `PushManager` and checks the app's side:
   the switch, the `inscrever_aviso` call with texts, channel and day, and
   `cancelar_aviso` when the switch goes off.

## Isolation from the life counter

- **Own folder, own door.** Everything is in `src/daily/` plus
  `src/styles/daily.css` (every class starts with `daily-`). The app imports
  one file, `src/daily/entry.js`, in two places: the header button in
  `views/setup/home.js` and `initDaily()` in `app.js`.
- **Code loads on the tap.** `entry.js` imports only `day.js`, `storage.js`,
  `i18n.js` and `back.js` (the back-gesture listener, which must exist from
  startup); the screen, the calendar and the network code come through a
  dynamic `import()`. A typo in `calendar.js` or Scryfall being down costs the
  challenge, never the home screen. A unit case checks these imports.
- **Not a route.** The screen is a full-screen layer over the home screen, so
  the router, the match clock and the wake lock never see it. It only opens
  from the home screen. It owns one history entry, so the back gesture closes
  it instead of leaving the app.
- **Own storage.** `mtglc.daily.v1` (settings and results) and
  `mtglc.dailyCard.v1` (card cache), both through `storageKey()`, plus the
  IndexedDB `hiteasy-daily` for the worker. Playing never reads or writes the
  match database; the browser journey asserts it is byte-identical after
  playing. The one shared write is the app language from the settings panel,
  the same `settings.lang` the home settings save.
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
  looping, name and mana masking in English and Portuguese, judging (no hint),
  streaks, the fetch with language fallback and cache, storage apart from the
  matches, the four dictionaries, the home button dot, the isolation of
  `entry.js`, and a full day played on the simulated DOM.
- `tests/e2e/journeys/daily-challenge.js` (in `npm run e2e`): on a phone, the
  dot, the hidden card, a miss and a win, storage apart, the back gesture, the
  language switch with Portuguese print and English fallback, and a match
  still starting at 40 afterwards. The fake Scryfall answers any name with a
  green card built around it (`tests/e2e/fixtures/daily-card.js`).
