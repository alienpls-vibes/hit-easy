# Hit Easy

**commander made simple**

Life counter for Commander tables, with statistics tied to the deck.
Installable PWA, works offline, no build and no dependencies — only native ES
modules.

## Running

```bash
python serve.py
```

Opens at `http://localhost:8000/`. ES modules do not load on double click
(`file://` is blocked by CORS), so the server is needed even locally.

The server is **dual-stack (IPv6 + IPv4)** with one thread per connection, and
that is not a detail. On Windows `localhost` resolves to `::1` before
`127.0.0.1`; listening only on IPv4, the browser tries IPv6, waits ~2 s for the
timeout and only then falls back to IPv4 — **for every file**. With ~20 modules,
half a minute per reload. Measured: 38.5 s to load everything before, 0.22 s
after.

If the port is already taken, the script **refuses to start** and says how to
fix it. That is on purpose: on Windows, `SO_REUSEADDR` does not mean "reuse the
port in TIME_WAIT" as on Linux — it lets **two** processes listen on the same
port, and the system hands the connection to either of them. With an old server
stuck, the new one starts "successfully", the browser lands on the dead one and
the page never loads.

The network IP **changes** when the machine switches Wi-Fi or renews DHCP. If
the phone stopped opening it, run `python serve.py` again and use the IP it
prints.

The script also prints the machine's network IP, to open it from the phone.
Through the IP the app works, but it **does not install as a PWA**: browsers
only register a service worker on `https://` or `localhost`. To really install
it on the phone, publish the folder on any static host (GitHub Pages, Netlify,
Vercel) — there is no build step, it is just uploading the files.

## The version number

**It only moves when a production release ships.** A trip to beta does not
spend a number: `main` and `beta` stay on the same number until the promotion,
and whatever piles up in beta goes into a single entry of
`src/release-notes.js`.

This is not cosmetic. One number per trip to beta produces a version history
nobody used, and the notes get chopped into one-item entries — whoever opens the
what's-new screen after updating reads five headers to understand one change.

**What the bump did technically**, and why it is not needed: `VERSION` makes up
the service worker cache name (`hiteasy-beta-shell-<version>`), so changing it
forces a new, empty cache. But `fetch` is *stale-while-revalidate* — it answers
from the cache and revalidates behind, storing whatever comes. Beta reaches the
testers on the second open with no bump at all; the bump only brought that
forward by one open.

**What would be lost without compensating:** knowing which code is on the
device. With the version frozen, the settings screen would say the same thing
before and after publishing. That is why CI writes `build.json` into `/beta/`
with the short commit SHA, and the version line shows `1.7.0 · beta · 3a6915f`.
The service worker lets that file go straight to the network: serving it from
the cache would answer with the previous build, which is the only useless
answer.

In production there is no stamp, on purpose: there the number already answers,
because that is exactly where it changes.

### When promoting

1. The number goes up once, in `src/version.js` **and** in `sw.js` — `npm test`
   refuses if they diverge.
2. The matching entry exists in `src/release-notes.js` — `npm test` also
   refuses without it.
3. Which digit: `new` or `changed` in the notes bumps the middle one; only
   `fixed` bumps the last one.

## Publishing

The app is static — no build, no server, no database. Publishing is copying the
folder to any file host. **Every path is relative**, so it works both at the
root of a domain and in a subfolder (`user.github.io/hit-easy/`), which is how
free hosts serve it.

**HTTPS is not optional:** service workers and installing as an app only work
on `https://` or `localhost`. Every option below already gives HTTPS.

### GitHub Pages (recommended)

```bash
git init -b main
git add .
git commit -m "Hit Easy"
git remote add origin https://github.com/YOUR-USER/hit-easy.git
git push -u origin main
```

Then, in the repository: **Settings → Pages → Source: Deploy from a branch →
`main` / `(root)`**. In about a minute the app is at
`https://YOUR-USER.github.io/hit-easy/`.

Publishing again after changing something is `git add . && git commit -m "..."
&& git push` — Pages updates by itself.

### Alternative without git

Netlify, Cloudflare Pages and Vercel accept dragging the folder onto the site
and give back an HTTPS URL right away. Good for a quick test; to maintain it,
git pays off because of the history.

### What the data does NOT do

Each device keeps the history in its own browser (`localStorage`). Publishing
makes the **app** available everywhere, but **matches do not sync** between
phone, tablet and computer — each one has its own.

To carry data from one to another, use **Statistics → menu → Export JSON** and
**Import JSON** on the destination (the import merges with the existing history,
without duplicating). Real sync would require a server with accounts and a
database, which changes the nature of the project and stops being free.

## How it is used

**Setting up the table.** Starting life, from 2 to 6 players, and one commander
per seat.

Tapping the name opens a two-screen flow that slides sideways: first **who
plays** — the list of whoever has already played on this device, or a new name
— and, once the player is chosen, straight to **their deck**. Whoever is already
seated goes to the end of the list, under the label *Already at the table*: the
list exists to find who has **not** sat down yet, and unclickable names in the
way spoil the aim. There the picker first shows the decks that person has
already brought, then the others used on the device, and only then the Scryfall
search. In practice people repeat decks, so the choice is almost always on the
first row, and that works without internet. The arrow at the top (or dragging
the screen to the right) goes back one step.

Dragging by the handle reorders the players, and **the list order is the turn
order** — the number in the corner of each card shows the position.

Whoever has a partner adds the second one. The match only starts with every seat
filled, because the commander is what ties the statistic to the deck.

**Before starting.** The button opens one last screen with two choices:

- **who opens the match** — any player, or *Random*, which is the default
  because that is how the table really decides (the draw runs on Start, so it
  gives a new result every time);
- **the table layout**, when there is more than one possible arrangement — only
  for tables of 3 and 5, where there is no obvious arrangement. The thumbnail
  shows the arrangement with the turn order numbered.

Each card carries a **thumbnail of the table with that player's seat lit**. The
list order already says the turn order; the thumbnail says the *place* — which
is what is missing when there are 5 or 6 people around.

Whoever opens does not need to be the first on the list: the physical table is
one thing, whoever won the die roll is another. The table's round closes when it
gets back to whoever started — and keeps closing correctly even after that
person is eliminated.

**Playing.** The whole panel is a gesture area, and the **duration** of the
touch decides what it is:

| gesture | what it does |
|---|---|
| quick tap on the left edge | takes 1 life, no author |
| quick tap on the right edge | adds 1 life |
| **hold on the edge** | takes or adds repeatedly, accelerating |
| quick tap in the center | opens the player's panel |
| **double tap in the center** | area action: damage to all players, only to opponents, or drain |
| **hold in the center, or drag** | arms the attack — the only way out is dealing damage |

On the edges, holding repeats — the same grammar as the mana counter, where
holding also repeats. It starts after 380 ms, in 110 ms steps, and speeds up to
55 ms after eight steps: whoever goes from 40 to 12 should not need twenty-eight
taps. Below those 380 ms nothing changed — a slow tap is still worth exactly 1.

That is why **holding still on the edge no longer arms the attack**. Dragging
from the edge arms it, as long as the finger starts moving before the repeat
begins — then no life point moves along the way; once the repeat has applied a
step, the gesture is already a life adjustment and no longer becomes an attack.
(The direction of the gesture is the declaration of authorship, and it is still
there.) And holding in the center arms it — no attack became unreachable, only
where you start holding still changed.

Holding applies while the finger is down, and that reopens a door the previous
design had closed: before, nothing was applied on touch — life only changed when
the finger **lifted** —, and a finger lingering on the edge did not take life
along. What keeps the mistake cheap is the coalescing that already existed: the
whole hold goes in as **one** event, so one tap on *undo* brings back the
twenty-eight points at once, not one by one. The number on the panel shows the
result before the event exists, otherwise holding would look frozen.

Quick taps in a row merge into a single event after ~0.9s — seven taps become
one line in the history, not seven. The central circle shows the turn and passes
it; next to it are undo and menu. It is big on purpose: passing the turn is the
most repeated action of the match, often with a busy hand.

**Pausing.** In the match menu. While paused, the table is covered and does not
accept touches — a pause that lets you change the score with the clock stopped
is not a pause. The stopped time **goes nowhere**: it leaves the match duration
and the turn time of whoever was playing. A trip to the bathroom does not become
"the longest turn of the night" in the statistics.

**And the clock stops by itself when nobody is at the table.** Leaving for the
statistics or the home screen, switching apps, locking the phone, closing the
app — all of that stops the count, and coming back resumes it. Without asking,
and without the manual pause's cover: a pause nobody asked for should not
require someone to undo it.

Before, the duration was **wall** time (`now − startedAt − pauses`), so closing
the app for eight hours added eight hours to the match — and, when passing the
turn, to the turn of whoever was playing.

The time away from the table is stored **next to** the log, not inside it, as
mana already is. Two reasons, and both are about not breaking what works:
`undo` removes the last event whatever it is, so an automatic pause would become
the target of "undo" on coming back; and `timeline()` draws `pause` and
`resume`, so every look at the statistics would add two lines to that match's
history.

The concession is that `replay` now reads a field that is not an event — the
log alone no longer determines turn time. The **score** still comes only from
the log: no life, counter or placement depends on it.

Closing the app is best effort: it uses `pagehide`, and a shutdown forced by the
system may fire nothing. In that case that time counts — there is no event the
browser guarantees. But the period is recorded **open**, so if `pagehide` runs,
the next start closes the account and discounts all of it.

## Mana counter

In the match menu. One piece per color (WUBRG + colorless), and each one is a
miniature life panel: left half takes, right half adds, holding repeats. Same
grammar as the table, nothing new to learn.

The table also holds to repeat, on the panel edges, so the grammar is the same
both ways.

**It resets when passing the turn** — it is floating mana, not a permanent
resource. While there is mana marked, a **shortcut on the central hub** shows
up, next to the menu, showing the total. It does two jobs: it reminds you there
is mana left before passing the turn, and it takes you straight to the counter —
which is the round trip you make all the time when you spend part of the mana,
resolve the spell and come back to settle the rest. It disappears by itself when
the pool empties.

It does not go into the event log, and that is a decision, not an oversight:
mana is ephemeral and says nothing about the match afterwards. Every tap would
become a line in the history and dirty the statistics forever. It is stored
alongside the match, outside the events, so it survives reloading the browser
mid-turn — but `replay` ignores it completely, and the score still comes only
from the log.

## Area actions

Double tap in the center of the panel of whoever will act (or the *Area damage ·
Drain* button, inside their panel). Three modes, because cards speak in three
ways:

- **Everyone** — each living player loses N, **including whoever cast it**
  (Earthquake, Pestilence). Dying from your own damage credits the elimination to
  nobody, and the damage a person takes from themselves counts as damage taken,
  not dealt.
- **Opponents** — each living opponent loses N. It is the default.
- **Drain** — each opponent loses N and whoever drained gains life. Cards use
  two different readings, so both are there: gain **the total** taken (the Gray
  Merchant case) or gain **the same amount** each one lost.

**Vote orientation.** On a phone it asks for the screen **upright** — the device
leaves the middle of the table and goes into each person's hand. On tablet and
computer the request is ignored on purpose (rotating a tablet lying on the
table would be worse) and the panel shows up **centered**, instead of stuck to
the bottom edge. On closing, the table asks for landscape again.

Rotating the screen rebuilds the table, and rebuilding would close the open
panel — so, with a vote in progress, the redraw **waits** for it to finish.

It becomes **one** `sweep` event, not one per target. That way undo brings back
the whole drain in one tap, and the timeline tells the play as it happened — a
single thing — instead of three loose lines. The event stores the list of who
was hit, so the statistics do not need to rebuild who was alive at that
instant, and the history stays readable years later.

**The table's round is clockwise**, seen from above — which is the same as
passing the turn to the neighbor on the left, since everyone faces the center.
This is pure data in `src/seating.js` and has a test: the angle of each seat
relative to the center must always grow, and the round must close at exactly
360°.

**Player 1 sits at the top left**, with the device lying flat — that is where
reading starts, and where whoever set up the table looks for the first on the
list. With 2, 3 and 5 players the landscape table is the default. Up to 1.8 the
round started at the bottom left; a match opened before the change does not have
the `assentos: 'topo'` mark and keeps being drawn in the old order
(`LEGACY_SEATS` in `seating.js`), otherwise updating the app mid-game would move
everyone around.

Elimination is automatic — life ≤ 0, 21 damage from the same commander or 10
poison. With one left alive, the victory banner shows up.

**Seeing the data.** Win rate per deck and per player, damage dealt and taken,
healing, eliminations, turns, average placement, time per turn. Whoever has gone
through a secret vote also gets a **Choices in votes** block — how many times
they chose Silence and how many chose Snitch, for example. It only shows up for
whoever took part: an empty block on every card would be noise, and most decks
never touched one of those cards. The choices are grouped by question, so
"Silence" from Prisoner's Dilemma does not mix with "Sim" from some random vote.
Each match keeps the full timeline. Exports and imports JSON.

**Settings** (gear on the home screen), in groups in the style of the phone's
settings — a short title and a card of rows:

- **Account** — a single row (the `@`, the subscription, invites waiting), that
  opens its own screen with @, sync, password, subscription and sign out. Before,
  it came whole at the top and pushed language and theme to the end of the
  scroll;
- **Appearance** — language and theme;
- **At the table** — vibration, screen on and lock to landscape (this one
  disappears on iPhone, where Safari locks nothing);
- **App** — install or update (one row that changes depending on the device),
  what's new, see the damage tip again and privacy.

Text only where it changes the decision: "vibration" needs no caption; locking
to landscape needs to warn that it goes full screen. The pieces live in
`src/views/setup/rows.js`. Starting life and table layout stay out of here on
purpose — they change every game, so they live on the home screen and on the
before-starting screen.

## Win reason

When declaring a winner by hand (match menu), the app asks **how** they won:
combat, commander, combo, poison, empty deck, alternate win, table concession or
other. The reason is optional — the table does not always agree on the label,
and a screen that does not let you leave would be worse than a missing data
point.

A last-one-standing win does **not** go through there and invents no cause, so
the *How they won* block only shows up for whoever has a recorded reason.

## Who is who

The name is what the table calls someone **that day**. It is not who the person
is. Whoever has an account is identified by the **@**, which is the only label
that means the same thing on every device — and it is the one that shows up in
the statistics, in player selection and on every screen. The typed name stays
stored on the seat and shows up again in the match detail, as *recorded as
Alexandre*.

**The selection list is of people, not names.** With raw names, whoever was
registered as "Alex" one Thursday and "Alexandre" the next showed up twice, each
row with half the decks — and picking one or the other decided, without warning,
which half today's match would fall into.

### The two-device case

The scenario the design exists to solve: two devices registered the same person
**without** an account, each typing a name, and the link comes later.

Linking rewrites the **whole history**, not the seat you were looking at: the
`@` is written into every local match where that person shows up, and the ones
already in the cloud are uploaded again. The link now lives in the **data**, and
not in a map that only exists on that device — that is what makes it travel.

On the other side, when downloading a match whose seat has a name **and** an
`@`, the device learns by itself that the name is that account, and its **own**
matches converge without anyone tagging anything again. There is no new table
for this: the data already traveled, it just was not being read.

Two rules protect this learning:

- **Only from your own match, or from a host you trusted.** Learning from any
  match would let any host name people on your device: it would be enough to seat
  a chair called "Alexandre" with their own `@` for your Alexandre history to
  start adding up on the wrong account. It is the same trust list that already
  decides the invite auto-accept.
- **What arrives never overwrites what you decided.** Two different people can
  have the same name at different tables. A divergence is not solved by guessing:
  it stays as it is, and you tag it by hand if you want.

When the devices typed **different** names, you still need to say it once per
name — the app does not guess that "Alex" is "Alexandre" by text similarity,
because that would get it wrong with two siblings at the same table. The fix is
made where the problem shows up: on the **Players** tab you see two rows that are
the same person and use *Link to an account* there. From the second name on, the
app already merges both — and even reaches the matches that arrive from the other
device **afterwards**.

### What it refuses to do

Three refusals, and each one avoids a different kind of damage:

| situation | what it does |
|---|---|
| the seat already has another `@` | does not overwrite — the earlier decision rules |
| that `@` is already on another seat of that table | does not write: it would put the same person twice in the same match, and the statistics would add up their damage against themselves |
| two names of the set seated at the **same** table | does not guess; leaves the match out and reports it |

Assigning is not the same as **inviting**. Writing the `@` on a seat is a claim
by the host; the match only goes into that person's history when they accept.
Nobody can author someone else's record — see `sql/002-participants.sql`.

## Two color families

The app uses color on two different axes, and mixing them was confusing:

- **commander identity (WUBRG)** — identifies the *deck*. Applies at the table
  and on the Decks tab.
- **color per player** — identifies the *person*. Applies on the Players and
  Rivalries tabs, where what you want to track is who, not with what. The same
  player switches commanders and is still them — and, with a linked account,
  switches names and is still them too (see *Who is who*).

The **Matches** tab has no color at all: the list of placements and the date
already say what it needs to say, and color on top of that would be decoration.

Each person's color comes from their position in a queue ordered by **first
appearance in the history**, spread around the color wheel with the golden angle
(137.5°) — that way each new color lands in the largest gap left and they never
cluster. The order is by first appearance, and not alphabetical, because
registering an "Ana" would change the color of everyone after her, and the point
of the color is precisely recognizing the same person across matches.

## The device's back button

In the statistics, the system back goes back **inside** the app. Before, it
closed it: the app had no navigation history at all — no `pushState`, no
`popstate` —, so the gesture found no entry to consume, and a full-screen PWA
exits. Precisely on the screen where the gesture is most natural.

An entry is pushed when entering the statistics and consumed when leaving, **by
the arrow or by the gesture**. Both lead to the same place, on purpose: two
things on the same screen called "back" cannot disagree. In practice that is the
home screen, which is where the statistics are opened from; coming from the
table, it goes back to the table.

**An open panel has priority:** back closes the panel and gives the entry back,
instead of navigating behind it. That was the worst possible effect of the
feature — leaving the screen with the sheet still standing over the new screen.

The home screen is still the base: from there back exits the app, which is what
is expected. And the table stays as it was — there is no entry pushed on it, and
changing that would deserve its own decision, because "back" in a match in
progress has no obvious destination.

## The @ belongs to whoever took it; the name is free

Two different things, which used to get confused:

- **The `@`** is the identity — how friends find and tag the person. Lowercase
  only, letters, digits and `_`, so `@Alex` and `@alex` are never two people.
- **The match name** (`profiles.display_name`) is how the person shows up on the
  seat when someone tags them. Free in form — "Alê", "Dr. Strange", "MARIA",
  emoji —, capped only in length (18, what fits on the table panel). Without a
  name, the table uses the `@`. It lives in Settings → Account.

**Every `@` an account has ever used stays theirs, forever.** The unique index
on `profiles.handle` only protected the `@` in use *now*: changing released the
old one, and another account could take it — and with it the invites of whoever
still tagged the old `@`, precisely the people who trusted that name. Now
`handles_usados` keeps each `@` with its owner, and the `guardar_handle` trigger
refuses (with 23505, which PostgREST returns as 409 and the app already
understands as "taken") any `@` that already belonged to another account. The
person can change and go back to an old one; nobody else takes any of them.
Deleting the account releases its `@`s.

And the old `@` still finds the person: `buscar_handle` and the invite trigger
resolve through `dono_do_handle`, which looks at the current one and then the
old ones, and the search returns the current `@` — the seat starts being tagged
with it.

Checking your own `@` now says "it is already your @" instead of "it is free",
with no save button (`handleStatus` in `rules.js`: `current`, `free` or
`taken`). And changing the `@` stopped erasing the name: the upsert used to send
`display_name: null` along.

**And it only changes every 15 days** (`sql/009`). With every `@` reserved
forever, changing without a limit would become a way to hoard names — ten
changes in an afternoon would reserve ten `@`s —, and an `@` that changes every
week does not help friends find anyone. The clock starts on the **choice**, not
only on the change: choosing and changing the next day is exactly the case the
rule prevents, and the screen warns before saving. Whoever already had an `@`
before the rule has no date and can change.

The date (`profiles.handle_trocado_em`) belongs to the server: the policy lets
the person edit their whole row, so the trigger rewrites that column on
**every** profile write, and not only when the `@` changes — otherwise a PATCH
with an old date before changing would be enough. The refusal comes out with
its own code `HE015` and the unlock date in `details`; the `@` row already shows
"next change on …" and does not open the change screen within the waiting
period.

**Changing @ does not split anyone in the statistics.** The history **is not
rewritten**: each match keeps the `@` the seat had that day — it is the record
of what happened, and a match recorded by another host does not even belong to
whoever changed. Consolidation happens on read. The device keeps an
`@old → @current` map (`handlesAtuais` in the local database), and `identityOf`
goes through it (`currentHandle`, which follows the chain of whoever changed
several times): statistics, rivalries, colors, the people list and "hide" start
seeing a single person, called by today's `@`.

The map travels inside the `aliases` object, under a `Symbol` key, and not as a
new parameter — every place that computes identity already receives `aliases`,
and one more parameter forgotten in one of them would split the person again.

The map learns in two ways:

- **your own `@`**, at the moment of the change;
- **friends who changed**, on sync: the app sends the history's `@`s to
  `handles_atuais` (`sql/010`), which returns only the ones that changed — in
  batch, only for whoever is signed in, the same thing `buscar_handle` already
  reveals.

When it learns a change, the device also fixes what it keeps under the old `@`:
remembered names start pointing to the current one, and whoever was hidden stays
hidden.

> **Needs a migration.** Run in Supabase, in this order:
> `sql/008-reserved-handle-and-name.sql` (without it, the old `@` can be taken
> by another account and the name has no length rule),
> `sql/009-handle-every-15-days.sql` (without it, the `@` changes at any time)
> and `sql/010-current-handles.sql` (without it, consolidation works for your
> own `@`, but not for friends who changed).

## Decks follow the account

Someone's deck list is **derived** from the local history — nothing is stored
separately, and that is what avoids a second truth about what the person plays.
But on a new device that history is empty: whoever had just signed in did not
find their own deck and had to search Scryfall for the commander the app already
knows.

Now the decks of **whoever is signed in** go to their profile on the server, and
come back on the next device. In the picker they join the ones from the local
history, without repeating, from most recent to oldest.

**Only yours.** The database policy lets each person write only their own
profile row, so the host records friends' decks on their device but cannot write
them into their profiles. It is the same rule that prevents someone from
authoring someone else's record — see `sql/002-participants.sql`.

**And they are private.** The `@` search explicitly selects id, handle and
display_name: adding `decks` there would turn confirming an `@` into a dig
through what the person plays.

It only uploads when the **set** changes. `lastUsed` changes every match, so
comparing the whole lists would make every sync write to the profile to say the
same thing.

> **Needs a migration.** Run `sql/004-account-decks.sql` in Supabase. Without it
> the server refuses the write, the app treats it as "next time" and keeps
> working with the decks from the local history — as it was before. Nothing
> breaks, but the feature stays dormant.

## Sorting the lists

Decks and Players always came out in the same order: win rate, matches as the
tiebreak. It is a good order, and it does not answer "who plays the most" nor
"who hits the hardest".

Now both tabs have a picker. The options come from `src/stats/sort.js`, where
each rule carries the field, the direction and the translation key together —
the three in the same place is what prevents the screen from saying "best
placement" and sorting from worst to best, because placement is the only one
that goes up: first place is 1, so the best is the **lowest**.

The tiebreak is always relevance, and not the order the aggregation returned.
With `matches`, half the group ties at two; without an explicit tiebreak the list
came out in the `Map` insertion order, which changes when an old match is
deleted — and the person would see the list rearrange itself without that number
having changed.

**Win rate has the usual trap.** A deck with one match won shows up ahead of one
with ten and eight wins. There is no minimum number of matches: it is what the
person asked for when choosing win rate, and the match count is on the card next
to the number. The test records this order as intentional, so nobody "fixes" it
later thinking it is a defect.

It sorts **after** filtering. Sorting before would spend the comparison on rows
the screen will not show, and the top of the list would be the top of the whole
group instead of the top of what is on screen.

## The notes show what came in

The what's-new screen used to open the whole history. The three new lines sat
below nine versions already read, and what you learn from that is to close the
screen without reading.

Now the default cut is the difference since the version the app was on. That
required storing where the person came from: `versaoVista` is overwritten at
startup, before any screen opens, so the only reference had already been erased
when the menu needed it. `versaoAnterior` is only written when the version
changed — reopening the app on the same version cannot reset the cut.

Three situations, in this order: came from an earlier version, show the
difference; just installed, show only this version's notes; this version has no
notes, fall back to the history (it is a safety net, because `npm test` does not
let it publish without them).

The history is still one tap away, at the end of the list. Hiding is not the
same as deleting, and whoever went looking for the change from three versions
ago needs to find it.

`announceVersion()` is named and exported because it used to be an IIFE that ran
on import: it happened once, before any test, and deleting the line for the
previous version went through the whole suite without a failure. The mutation
test is what told.

## The update button shows that it is updating

`updateApp()` checks the network and then waits for the new worker to really
take over — up to ten seconds. The button was only disabled, and a button that
dims and stays still is indistinguishable from a button that did not work. That
was exactly the doubt that came up in use: "did the button do anything?".

Now the label swaps for a spinner and "Updating…", and comes back if there is no
new version. The spinner goes in **before** the wait, not after: the feedback
has to be immediate, otherwise it does not answer the question it exists to
answer.

Whoever asks for less motion gets a pulse instead of a spin. Removing the
animation would leave a still ring, which is indistinguishable from a stuck
button — the opposite of what this exists to say.

A failed update puts the button back in its normal state. Without that the
spinner would spin forever, and the person would be staring at a wait that
already ended.

## Passing the table to another device

The case is concrete: the battery of the phone keeping the life count is running
out mid-match, and someone at the table has a charged device. The match changes
hands without ending.

**By file, not through the cloud.** It requires nobody's account, no
subscription, and works without network — which matters, because a table at a
friend's house has bad wi-fi and the dying phone is no time to depend on an
upload. The match becomes a file, goes through WhatsApp or AirDrop, and the
other device receives it.

Event sourcing makes the transfer almost nothing: the match **is** its event
list, so sending the list is sending the game. There is no partial state.

### The baton

The real work is not transporting. It is that after the hand-off there are two
copies with the same id, and the upload uses `ignore-duplicates`: the first one
to go up wins and the other quietly vanishes. If the old device went back to
playing and uploaded the abandoned half, that would be the one that stayed.

That is why the table is not copied, it is passed. `packTable()` stamps and
packs in the same act — packing without releasing would leave both alive.

**And the stamp is not enforced by an `if`.** The first version had the guard in
the router, and the mutation test deleted that line with the whole suite passing
— the same class of defect that already bit this project, the right function
existing and nobody consulting it. Now the invariant lives in the accessor:
`getCurrent()` returns `null` for a handed-off table. Every path that already
handled "there is no open table" handles this case for free, without any of them
knowing the concept. Whoever needs the handed-off table — the home screen, to
warn — asks for `storedTable()`.

Taking back exists for when the hand-off did not work, and it is an action with
confirmation: two live copies is precisely what the hand-off avoids.

### The clock

Events carry the `ts` of the device that recorded them. If the receiver's clock
is behind, the next event is born **before** the previous one — and `elapsedOf`
and `advanceTurn` subtract instants, so time running backwards becomes a
negative duration on the table.

`receiveTable()` measures the lag and stores the offset in the match itself;
`push()` starts using `tableNow()`. The correction only looks forward: a clock
that is ahead gets no correction, because pushing it would inflate the duration.
The one-minute slack prevents two nearly equal clocks from tying on the same
millisecond.

### Three defects only real use found

**Receiving only took effect after reloading the page.** The table was installed
and the screen stayed on the home screen: `onRefresh` redraws the current route,
and the initial route is the only one that looks at `getCurrent()` by itself. An
action that changes which match is the current one has to take the screen along.

**Taking back left the person stuck.** The table was valid again and there was no
way to get into it — the table menu, where passing lives, was unreachable. The
home screen got `resumeTableBanner`: if there is an open match, you can get in.
It normally does not show up, because the app opens straight on the table when
there is a match; it exists so that any future path that creates this state does
not trap anyone.

**The file had a fixed name**, so two tables in the downloads folder became
`mesa-hit-easy (1).json` and nobody knew which was which. Now it carries the
match id, filtered to what every file system accepts.

### Why the suite did not catch it

The first two escaped eleven mutations, and not for lack of tests: for the
**impossibility** of testing. Both paths go through `await confirmAction`, and
the runner was synchronous — nothing after an `await` could be observed, so
those lines were unreachable.

`runAll()` now returns a promise and awaits each case, one at a time (the cases
share `document` and `store`; two in parallel would step on each other).
Synchronous cases stay synchronous. The stub got `click()`, which was missing
and made `field.click()` — code that runs in production — blow up in the test.

With that both mutations started being caught, and the receive path has an
end-to-end test: tap, file, confirmation, table installed and open.

### The file carries one table

The backup exporter sends the whole database. Using it here would hand the
friend the entire match history of whoever passed, the `@`s the device knows and
the preferences. It is the easiest mistake to make and the most expensive one,
and there is a test that fails if the history leaks into the file.

The file is refused with a reason — unreadable, not a table, came from a newer
version, incomplete table — because they are four different errors and deserve
four different answers.

### By code, since 1.9

The file failed the first real test: sent through WhatsApp, the receiver's phone
could not open the `.json`. Now, with the cloud configured, passing the table
**uploads the match and shows a code** of six characters (`K7M 2QX`). Whoever
is going to continue taps *Receive a table* and types the code — or taps the
link that goes along in the message, which opens the app with the code already
filled in. Nobody needs an account.

- **Valid for 24 hours and only once.** Taking marks the table as received; the
  second device that tries the same code takes nothing. It is the same baton as
  the file: the table is not copied, it is passed.
- **The table only leaves here after uploading.** Without network, it stays open
  on this device and the screen offers the file, which works offline. The file is
  also still in *Receive → I have a file*.
- **View, confirm, take.** Whoever receives first *views* the table (without
  consuming the code), confirms it can replace the open match, and only then
  *takes* it. Taking first would burn the code of whoever gave up midway.
- **Whoever passed sees that it arrived.** The code panel asks the database
  every 3 s and says "received on the other device". The home notice shows the
  code while nobody has taken it, and taking back **cancels the code** first; if
  the other device already took it, taking back warns that there will be two
  live copies.
- **Bound to the channel**: a beta code does not open in production.
- The link opens the app in the **browser**. On iPhone, whoever uses the
  installed app should type the code inside it — Safari stores data separately
  from the installed app, and the table would end up in the wrong place. That is
  why the message carries both.

Security, since the functions are granted to `anon`: the `mesas_em_transito`
table has no policy at all, so nobody reads it through the API — only the
`security definer` functions answer, and only to whoever has the code. The code
comes from `gen_random_uuid()` in a 31-character alphabet without the ones that
get mixed up (0/O, 1/I/L): close to 900 million combinations for a few dozen
alive. A table over 1 MB and more than 2000 live tables are refused, so the
public key does not become a storage bin.

> **Needs a migration.** Run `sql/007-table-by-code.sql` in Supabase. Without
> it, passing the table fails on upload and falls back to the file, as before.

## Whoever already played with you does not ask again

Trusting stopped being a step. If two accounts already played a match together
and it was accepted, the next ones come in by themselves — in either direction,
because playing together is symmetric and who records the table changes from
week to week.

The decision belongs to the server, in the `preparar_participante` trigger, and
not to the app: the receiving client may be closed for days. Deciding on the
server makes the invite be born accepted; deciding on the client would make the
person see "1 invite waiting" that vanishes by itself when they open the app.

**Only accepted counts as proof.** A seat tagged with my `@` that I never
accepted does not say we played: it says someone typed my `@`. Accepting is the
only act that came from me.

Bound to the channel: a test table does not create trust that counts in real
life.

### Being able to say no

This is the part that cannot be forgotten. With the accept derived from history,
playing a single time with a stranger at a tournament would count forever, and
deleting the trust row would undo nothing — the rule rebuilds itself from the
matches.

That is why `trusted_hosts.confia` instead of mere presence: the row with
`false` is the "do not accept anything else from this person", and it beats any
history. `untrustHost` writes that refusal instead of deleting the row, and the
invite got "never accept from this person" as a low-key action next to decline.

> **Needs a migration.** Run `sql/006-played-together.sql` in Supabase. Without
> it nothing breaks — auto-accept stays only for whoever was trusted by hand, as
> before —, but the feature stays dormant.

## Rivalries

Its own tab in the statistics. Each row is a **pair of players**, with the damage
each one dealt to the other, eliminations, commander damage and poison — and a
bar showing the imbalance, which answers "who hunts whom" at a glance.

None of this needed to be recorded: since damage became directional, each event
already carries who dealt it and who took it. The aggregation just reads the
same log from another angle — per pair, instead of per person. Damage **with no
author** (paid life) creates no rivalry with anyone, and an area action counts
for every target.

## Hiding decks and players

A button in the corner of each deck or player card. It removes the **row** from
the lists — not the data: the matches stay whole, the timeline keeps counting
everything, and the damage that person dealt keeps adding up for whoever took
it. It can be brought back in *Statistics → menu → Hidden*.

That is why hiding and deleting are separate things: deleting a match (also
available, in its detail) really changes the history.

## Beta does not write to the real data

Production and beta live on the same origin, and that was already solved for the
DISK: `storageKey()`, in [src/channel.js](src/channel.js), adds a `.beta` suffix
to everything that goes to localStorage.

The cloud did not know what a channel was. A match played in beta went up to the
same `matches` table, and the production app downloaded it as real: a test match
in the history, in the statistics, in the average damage, in a deck's win rate.

Worse than noise. `learnWhoIsWho` learns aliases from what it downloads, and a
test seat tagged with a friend's `@` became an invite for the real person — the
test channel writing into third parties' lives.

Now every write carries the `canal` column and every read filters by it. They
are the two ends of the same rule, and failing on one cancels the other: stamping
without filtering leaves production downloading what beta uploaded; filtering
without stamping makes beta upload with the `'producao'` default and poison the
database.

The same goes for `profiles.decks`, which 1.6.0 created: beta writes to
`decks_beta`. Without that, a test table with made-up commanders would get into
the deck picker of the real app, undoing the feature that exists precisely so the
picker knows the person's decks.

**The channel is not a security boundary, it is data separation.** The policies
decide by owner, and the channel does not change who owns what. Whoever wants to
see their own beta matches by querying the database by hand can — they are
theirs. What the column guarantees is that the app never mixes the two by itself.

Through a column, and not a separate Supabase project: the account, the
subscription and the `@`s need to be the same on both channels. With two
projects, testing sign-in would be testing another sign-in, and the person would
have to create an account again to try beta. Nobody tests like that.

> **Needs a migration.** Run `sql/005-channel.sql` in Supabase. Until then the
> new app asks for `canal=eq.producao` from a table without that column, and
> PostgREST refuses with 400 — the whole sync fails and the app stays local only.
> Nothing is lost, but nothing goes up or down.

### What the uploads stamp

Coverage of this separation almost stayed at half: the tests checked `toRow` and
`decksColumn`, which are pure and receive the channel ready-made, and nothing
went through the point where `channel()` is actually called. Swapping that call
for `'producao'` inside `uploadMatch` passed the whole suite — the mutation that
means, in one line, "beta poisons the real database". The mutation test is what
told; the end-to-end case captures `fetch` and reads the body that goes out.

## The icon

Three files in `icons/`, and the same art in all three: the five WUBRG pips on an
almost black background. It is the same mark the home header draws in
`brandMark()`, and the two need to keep being the same thing — they are separate
in the code and one and the same to whoever looks.

`icon-maskable.png` is a circle with the content pulled inward. Android does not
show the PNG: it crops it to the shape the launcher uses, circle, squircle or
rounded square, and whatever is outside the central 80% circle may be cut.

**It has a known defect:** it is a circle on transparency, with 94% of the edge
pixels translucent. On a circular-mask launcher nobody sees it; on a square mask
the corners are hollow, showing the wallpaper. Fixing it means making the image
opaque from edge to edge, without touching the drawing.

### The guard

`checkIcons()`, in [tools/check-syntax.js](tools/check-syntax.js), requires every
referenced icon to exist and every PNG in `icons/` to be referenced.

Three files point to the icons — `manifest.webmanifest`, `index.html` and the
`ASSETS` list of `sw.js` — and getting one wrong broke no test. Each one fails in
a different way: a manifest with a dead path only shows up at install time, on
someone else's device; `cache.addAll()` rejects **everything** if a single
request fails, so a dead path in the list takes the whole app down offline; and
in `index.html` the tab is left without a favicon.

### What was already tried and undone

A gradient identity with the silhouette of a table made it to beta and came
back. It is worth recording what the measurement said, so the attempt is not
repeated blindly:

- **It weighed 444 KB against 19 KB.** A smooth gradient is the worst case for
  PNG. A 256-color palette would cut 79% and bands visibly; recompressing gains
  nothing.
- **The silhouette did not read at 16 and 32px** — it becomes a dark smudge in
  the middle of the color, and that is where the tab favicon lives.
- **In the header mark, the gradient disappears.** Rasterizing at 14, 26 and 52px
  in both themes, below 26px it becomes a dark blot that vanishes into the
  background. This project had already been through this: the mark was a little
  square with a gradient, it blurred when small, and became five pips because of
  that.

The method also stays, and it works for any new art: measure the maskable safe
zone, the edge opacity, the weight and the legibility at real sizes — and not
just look at the big file.

## Installing

Settings → *Install*. When the browser offers installation, a download button
also shows up at the top of the home screen.

On iPhone and iPad the button shows up **always** (while the app is not
installed) and opens a step-by-step: Safari → Share (on newer iOS, inside the
••• button) → *Add to Home Screen* → *Add*. Apple does not let any page ask for
installation, so that is the most the app can do — and before, the explanation
was only inside the settings, where nobody found it. The screen recognizes the
browser: in Chrome and Edge on iPhone it also works, through the address bar's
share; inside Instagram, Facebook and other apps it does not work at all, and the
screen says to open it in Safari, with a button to copy the address.

Installation is only offered on `https://` or `localhost`, with a manifest and
service worker — **through the network IP it does not show up**, and that is why
the screen explains the reason instead of hiding the option. On iPhone and iPad
Safari does not let the app ask for it by itself: there it is *Share → Add to
Home Screen*, and the screen says exactly that.

## Languages

Portuguese, English, Spanish and German, in a select field in Settings — four
language names do not fit side by side on a phone, and the native `<select>`
also opens the picker the device already uses everywhere. Switching redraws the
home screen **and reopens the panel** in the new language; without that it would
stay in Portuguese until closed by hand. Dates and times follow the chosen
language's locale; the default comes from the browser.

The texts live in a flat dictionary, one language per file in `src/i18n/`
(`pt.js`, `en.js`, `es.js`, `de.js`), and three tests protect it: the four
languages have **exactly** the same keys, no translation loses an interpolation
variable (`{name} venceu` without the `{name}` would become a sentence with no
subject) and no text is empty. A fourth test draws the home screen and the table
in the four languages, because a complete dictionary does not prevent a
misspelled `t()` inside a screen.

A missing key falls back to Portuguese instead of showing the raw key to the
user.

## Orientation and theme

The home screen is made for the device **upright**: it is where the match is set
up, in a vertical list of players. The table is made for **landscape**, which is
how it sits in the middle of the group — with 5 or 6 players the 2×3 portrait
grid becomes 3×2 in landscape, otherwise the panels get tall and narrow and the
life number does not fit. Each arrangement carries both shapes, and both are
tested.

The victory banner also changes shape: stacked (art on top) upright, and
**landscape** (art on the left, content on the right) on a short screen — with
the phone lying down there are ~390px of height left and the stacked version did
not fit. If it still does not fit, it scrolls whole instead of cutting the top.

Text fields in a panel rise together with the **phone keyboard**: the panel is
fixed to the bottom edge, which is precisely where the keyboard shows up. It
applies to all of them — commander search, player name, `@` search and the
secret vote number.

`visualViewport` says how much the keyboard took, the cover shrinks by the same
amount and the panel rises. The math is `layout − visible − offset`, because a
fixed element with `bottom: B` has its base at `layout − B`.

**Without touching the page layout, and that is a requirement.**
`interactive-widget=` `resizes-content` in the viewport meta would solve Android
without JS, and it did go in — but it makes the **layout** viewport change, and
this app's screens are `height: 100%` in a chain (`html`, `#app`, `.stats`).
Changing the layout during scrolling re-lays out the chain and moves the scroll
anchor: the statistics list scrolled and jumped back to the top. It came out, and
the `--kb` math already solved both systems by itself — the meta was belt and
braces.

**`--kb` only applies with a focused text field**, because a keyboard only
exists then. Without that condition the math reported a keyboard where there was
none: the phone's URL bar also shrinks the visual viewport, and the difference
came out as some 60px of "keyboard" pushing every panel up.

The `layout` in that math has to be `documentElement.clientHeight` — the same
reference `position: fixed` and `100%` resolve against. With
`window.innerHeight` it **broke**, and in a way that raised no error: in a
browser where `innerHeight` follows the visual viewport, the math became
`visible − visible − 0`, that is, zero. Full-size cover, panel stuck to the
bottom edge, behind the keyboard — whoever was looking for an `@` typed without
seeing. There is a test for exactly that browser (`simulateKeyboard` in
`tests/dom-stub.js`), because the arithmetic was right and the defect was the
reference: a test of the pure function would pass without proving anything.

Scrolling does **not** fix this, and it is worth knowing why: the panel is
`position: fixed` and has no scrollable ancestor, so `scrollIntoView` has nothing
to move when the whole panel is behind the keyboard. It still exists, for the
different case of a tall panel whose field sits at the end — and it runs when the
viewport changes, not on a timer after focus, otherwise it would measure the
screen before the panel had risen.

None of the screens *breaks* in the wrong orientation: the home screen becomes
two columns when in landscape, with the player list scrolling by itself, and the
table shrinks labels and the hub when upright. Locking would be worse — the
browser only allows locking the orientation in full screen, and iPhone Safari
**not even that**. That is why the "full screen and rotate" option tries, fails
silently where it cannot, and a discreet tip suggests turning the device.

**Screen on in Safari.** Safari (iPhone and iPad) only grants the screen wake lock
right after a touch from the person. Asking when coming back to the app, or when
reopening straight on the table, is refused silently — and the screen started
turning off by itself mid-match. The request is redone on the first `pointerup`
on the table without a lock, which also recovers the lock the system releases
when the phone is locked. (In the app installed from the Home Screen, the lock
only works from iOS 18.4 on — before that it was a defect in iOS itself.)

**Full screen on iPhone only when installed.** iPhone Safari has no full screen
for pages, only for video: in a tab, the address bar stays and no code removes
it. Opened from the Home Screen, the app runs without a bar. That is why the
table, opened in Safari on an iPhone, shows once per session the notice with the
shortcut to the installation step-by-step.

**Leaving the app drops the lock.** Android takes the app out of full screen when
it goes to the background, and the landscape lock falls along with it: on coming
back, the table showed up upright. The app keeps the last orientation request and
redoes it on coming back — and, since entering full screen requires a touch from
the person, redoes it again on the first `pointerup` after coming back. Where the
lock never works (iPhone, iPad, computer) this does nothing: on the computer the
mouse turns the attempt off, and on iPad a refusal with full screen already
active marks the device as unsupported.

The theme has three modes: system (default), light and dark. Every interface
color comes from tokens in `:root` — no component knows which theme it is in.
The WUBRG palette also changes: in light mode the tones **darken**, because a
creamy white on a light background simply disappears, and the accent is the only
signal of the deck's identity. An inline script in `index.html` applies the theme
before the first paint, so there is no flash of the wrong color.

## Damage is directional

Drag from the panel of whoever hits to the panel of whoever gets hit. The
direction of the gesture **is** the declaration of authorship — nothing is
inferred. While the finger is on the table, an arrow in the attacker's deck color
links the two panels and the target lights up.

On release, the damage pad opens: how much it was. The shortcuts (1, 2, 3, 5, 7)
confirm on the same tap, so the common case closes in two gestures. The pad
rotates along with the seat of whoever attacked, because they are the one
handling it. The dial starts at **0** — whoever uses + counts from zero anyway —,
and confirming at 0 just closes, recording nothing.

**Lifelink** is a toggle on the pad: on, whoever dealt the damage gains the same
life. It applies to damage, commander damage and poison (infect with lifelink
also heals). It goes in as `gain` in the **same** damage event, and not as a
separate `life`: undo brings both things back together, and the healing shows up
in the statistics as healing by whoever attacked.

**The target's life counts up to the new value** when the screen closes, instead
of jumping. It applies to the four cases that come from a panel: drag damage,
damage to everyone, drain (which makes the opponents go down and whoever drained
go up) and healing. Without it the number swapped all at once and nothing said
something had happened — and it is precisely when the damage was big that this
matters.

Step by step through the integers, because life *is* an integer: there is no
half life to interpolate. The total duration is fixed, so taking 28 counts fast
and taking 2 counts slowly; the step has a minimum so a small change is still
seen, instead of blinking. The color marks the direction while it moves, because
from afar, in the middle of the table, the number alone does not say whether it
went up or down before it stops.

**The panel edge and the −/+ buttons do not count**, on purpose: there the
number already moves on each tap, and counting on top would fight with "hold
repeats". Whoever asks for the count is the panel, once — not the redraw, always.

Whoever asked for `prefers-reduced-motion` gets the number at once. The global
CSS rule zeroes transitions and animations, but does not reach a count done in
JavaScript: it refuses by itself, and there is a test for that.

Three modes, all directional through the same gesture:

- **Damage** — takes life, credited to the attacker;
- **Commander** — also takes life, and also adds to the 21 counter of that
  specific commander (if the attacker has a partner, you choose which);
- **Poison** — adds counters toward 10.

**The panel edges are not damage.** They change life with no author, which is
exactly the case of whoever pays their own life: fetchland, Necropotence, ability
costs. That is why the statistics separate **damage taken** (has an author) from
**life paid** (does not) — adding both into a single number would hide the
difference between a deck that gets beaten and a deck that burns itself.

Corrections stay in the player panel (tap in the center): fine life adjustment,
commander counters per opponent, poison and conceding.

## How it is organized

Event sourcing: the match **is** the event list, and the visible state is always
`replay(match)`. From that come for free undo, exact statistics and the guarantee
that the score never diverges from the history.

**One folder per subsystem, with a gateway file.** When a subject grows past a
few hundred lines, it becomes a folder — and the file with its name keeps
existing, now only re-exporting what is public. That way `src/cloud.js` is still
what the other modules import, while inside there are ten files; splitting the
pieces another way tomorrow does not touch whoever depends on them. The gateway
also **documents the boundary**: `src/views/setup.js` has three `export` lines,
and they are exactly the three names the whole screen exposes.

After the split, the largest behavior module in `src/` had 449 lines (`ui.js`),
and the largest screen module had 386 (`views/table/vote.js`). The four language
dictionaries stayed at ~470 each, and they stay: there are ~460 keys per
language, and breaking a dictionary up by subject would scatter the same
translation across six files. **There is no import cycle** anywhere — `npm run
check` warns if one shows up.

```
index.html            page
tests.html            in-browser self-test
serve.py              local server
sw.js                 offline cache — explicit list, checked by npm test
package.json          only so Node runs the tests — zero dependencies
src/
  app.js              routing and saving
  engine.js           events, replay, elimination, placement   ← core
  stats.js            gateway — 25 names
  stats/
    aggregate.js      the history turned into numbers per deck and per player
    match.js          a single match: summary, timeline, total damage
    rivalries.js      the same log read per pair of players
    votes.js          vote choices, grouped by question
    sort.js           which number the list sorts by, and in which direction
    colors.js         each person's color (golden angle, by first appearance)
    format.js         numbers and dates as each language writes them
  store.js            localStorage, history, backup
  scryfall.js         commander search + cache
  colors.js           WUBRG identity palette (light and dark)
  seating.js          seat arrangement, upright and landscape — pure data
  theme.js            light/dark/system
  ui.js               DOM helpers, sheet, toast
  vote.js             secret vote
  install.js          installing as a PWA
  orientation.js      upright / landscape
  sync.js             upload queue to the cloud
  channel.js          production or beta
  release-notes.js    release notes (data)
  version.js          the version number

  i18n.js             gateway — 9 names
  i18n/
    pt.js en.js es.js de.js    one language per file (~460 keys each)
    dictionaries.js            which languages exist, and where they live
    translate.js               the mechanics of t() and interpolation
    ordinal.js                 1º, 1st, 1. — one rule per language

  cloud.js            gateway — 59 names
  cloud/              layers that only look down
    rules.js          pure functions — the part tests reach without network
    account.js        what is remembered about who signed in
    http.js           one request, with token renewal around it
    auth.js           sign in and sign out
    subscription.js   whether the subscription is valid
    matches.js        upload, download and delete matches
    profile.js        the name and the @
    invites.js        matches in which someone says you were there
    table-by-code.js  passing the table by code
    boot.js           startup, in order

  views/
    setup.js          gateway — 3 names
    setup/            one file per element of the home screen
      draft.js               the table being set up
      home.js                the screen itself
      seat-card.js           the card of a seat, and the drag
      pick-player.js         who sits here
      pick-deck.js           which deck they bring
      pre-game.js            who opens, and the table layout
      settings.js            the app preferences
      rows.js                the rows the settings are built from
      install.js             the installation block
      account.js             sign in, create account, subscription
      handle.js              your own @
      invites.js             matches waiting for you
      sync.js                what went up and what is missing
      pass-table.js          passing the table to another device
      release-notes.js       what changed in this version

    table.js          gateway — 1 name
    table/
      context.js      what all the pieces share
      table.js        builds the screen and wires the pieces
      constants.js    the gesture measures, and the mana colors
      widgets.js      label/number, the row with − and +, "hold repeats"
      state.js        whoever changes the match: apply, undo, turn, pause
      paint.js        drawing the table from the state
      gestures.js     the duration of the touch decides what it is
      damage.js       the directional arrow and the damage pad
      sweep.js        damage to everyone, and drain
      mana.js         the mana counter
      vote.js         secret vote, from hand to hand
      player.js       a player's panel
      hub.js          the central hub, and the pause cover
      menu.js         the match menu
      victory.js      who won, how they won, and the banner

    stats.js          gateway — 2 names
    stats/
      screen.js       the tabs, and which one is open
      widgets.js      the small pieces several tabs reuse
      deck.js         a deck card (color by WUBRG identity)
      player.js       a player card (color by person)
      rivalries.js    the pair of players, and who hunts whom
      match.js        a match card and the timeline
      win-reasons.js  how the wins were won
      votes.js        choices in secret votes
      backup.js       export and import JSON
      link-account.js link someone to an account (and merge the history)
      paywall.js      what you see without a subscription

  styles.css          entry point — only @import, and **that order is the cascade**
  styles/             20 sheets, one per area (tokens, home, table, damage,
                      core, panel, stats, mana, vote, account...)
tests/
  cases.js            engine cases, no DOM — single source
  dom-stub.js         minimal DOM to test the panels outside the browser
  run-node.js         terminal runner
tools/
  make_icons.py       generates the PWA icons
  check-syntax.js     node --check, version, @, RLS, install and SW cache
  check_modules.py    imports, exports, re-exports, delimiters and CSS cascade
sql/                  Supabase migrations, run in numeric order (see docs/cloud.md)
docs/                 cloud setup and the publishing channels
```

`engine.js` and all of `stats/` do not touch the DOM. If one day this becomes
React or React Native, they go along unchanged — and that is also why they are
the part the tests reach entirely.

### The order of the @imports is the cascade

`src/styles.css` has no rule at all: it is twenty `@import`s, and each one is a
**contiguous** slice of the old sheet, in the same sequence it was in. Swapping
two of them changes who wins a specificity tie, and the symptom is visual and
silent. The last sheets are adjustments born later that override the ones above
on purpose — moving them up the list would make them lose to what they came to
fix.

`npm run check` follows those `@import`s and checks the cascade **across**
sheets, not only within each one.

### The table: from closure to context

`src/views/table.js` was the hard case, and it is worth knowing why. The other
splits were a change of address: take a top-level declaration and move it to
another file. Here there were no top-level declarations — `renderTable()` was
**one function** of ~1500 lines, with 39 nested functions sharing a closure of
22 values (`state`, `tiles`, `fx`, `hub`, `gesture`, `pauseTimer`…).

A closure is convenient while it is one file, and intractable afterwards: any
piece that leaves it loses everything at once, and nothing warns — the code
compiles, the tests pass, and a gesture stops responding with no error in the
console.

So what was invisible became written down. `context.js` returns a `table`
object, each piece receives it, and the pieces hang themselves on it:

```js
const table = createContext(root, ctx);
Object.assign(table, createState(table), createGestures(table), createDamage(table), …);
```

So `gestures.js` calls `table.openDamagePad()`, which calls `table.apply()`,
which calls `table.sync()` — **without any of the four files importing another**.
Zero import cycles, and each piece opens on its own.

An object, and not exported variables, because an exported `let` is read-only
from outside: `table.state = …` needs to work from seven different files, and
assigning to a *property* is legal where assigning to the *binding* is a
`TypeError`.

Two local names had to be renamed first, because they repeated names from the
outer scope and the rewrite would hit them: the grid of mana pieces became
`manaGrid`, and the panel root in `buildTile` became `panel` (the returned key is
still `root`, so `tile.root` did not change).

**What the tests do not reach still does not reach.** Short touch versus held
touch, drag, target, the slide between screens — only a finger verifies that.
The build tests cover the table coming up in the four languages and in both
orientations, and that is what there is. Before publishing, it is worth playing a
match.

## When something breaks

If the app cannot start, an **error screen** shows up with the message and the
stack — not a black screen. It has two buttons: reload, and clear the service
worker cache and reload (the match history is not touched). It exists because on
a phone there is no console to open, and an empty dark screen tells nobody
anything.

## Verification

```bash
npm test         # node --check on every module, then the test cases
npm run check    # imports, exports, delimiters, CSS and cascade collisions
```

`npm test` runs `node --check` on each module before the tests. The cases only
exercise engine, stats and seating — the rest depends on the DOM —, but the
syntax check reaches the whole interface, which is where the silliest error lives
in a project without a build.

The cases live in `tests/cases.js` and do not touch the DOM, so they run in both
places from the same source: in the terminal with `npm test`, and in the browser
at `http://localhost:8000/tests.html`. A test that only passes in one of the two
is not worth much.

They cover replay, undo, elimination by poison and by 21 commander damage
(including the case of two different commanders that do **not** add up), turn
order skipping the dead, final placement, damage attribution, the separation
between life paid and damage taken, aggregation of the same deck across several
matches, replay determinism, the clockwise direction of **every variant** of the
table upright and landscape, the round count when the match opens with a player
who is not the first seat, area actions (damage, drain, elimination credit,
atomic undo) and the pause leaving the duration and the turn time.

Four cases run on a minimal simulated DOM (`tests/dom-stub.js`): the state
machine of the sliding panels and the **build** of the table and the home screen.
Both groups were born from real regressions — a panel whose first screen opened
invisible, and a `let` declared after its first use that took down the whole table
and left the screen black. In both cases the syntax was valid, the imports right
and all the other tests green. In the browser those four show up as skipped.

Three cases cover **holding on the edge**, with the clock swapped for a
controlled one (the cases run synchronously, so really waiting is not an option):
the cadence and the acceleration, the release that cannot charge a step on top of
what the repeat already applied, and the whole hold becoming a single event. The
last one matters more than it seems — without it, *undo* would go back point by
point.

What the tests do **not** reach: the rest of the gesture, and the look. Short
touch versus held touch in the center, drag, target, the slide between screens
and how the light theme really looks — only the finger and the eye verify that.

`npm run check` also warns when two classes used **on the same element** define
the same CSS property — a tie only the file order resolves. Not every warning is
a defect (a modifier after the base is the right pattern), but that is how the
home screen broke once: `class: 'seat-spot layout-mini'`, both defining `width`,
and the generic one was 950 lines below.

**`package.json` brings no dependency at all** — it exists only so Node treats
the `.js` files as ES modules when running the tests. There is no `npm install`,
there is no build: the app is still static files served directly.

## Data

Everything stays in `localStorage`, on this device. There is no server and
nothing is sent anywhere — the only external call is the card search on
Scryfall. Clearing the site data erases the history, so use **Export JSON** in
Statistics → menu to keep a backup.
