# Browser journeys

What a person does with Hit Easy, end to end, in a real headless Chromium:

```bash
npm run e2e                 # every journey
node tests/e2e/run.js cloud # only journeys whose name contains "cloud"
```

No dependencies: `lib/cdp.js` speaks the Chrome DevTools Protocol over Node's
built-in WebSocket. Any Chrome, Chromium or Edge works; `CHROME_PATH` picks one.

## Why they exist

1.10.1 shipped with a Start button that threw on tap: the pre-game panel called
a store function that had been removed. Syntax, imports and 225 unit cases
were green, because none of them pressed Start in a browser. These do.

## What makes a journey trustworthy

- **Real input.** A tap is a touch event at the element's centre (phone
  profile) or a mouse click (desktop profile), and it only happens once the
  element is the topmost thing there and has stopped moving. An overlay that
  swallows taps fails here, as it does on a phone.
- **Zero errors.** Any uncaught exception, rejected promise, `console.error` or
  native dialog - on the page or in its service worker - fails the journey,
  even if every step "worked".
- **No internet.** Scryfall and Supabase are faked (`fixtures/commanders.js`,
  `lib/fake-cloud.js`). A request to any other host fails the journey; so does
  a cloud endpoint the fake does not implement - add it there.
- **Real paths.** A local server shaped like GitHub Pages: production at
  `/hit-easy/`, beta at `/hit-easy/beta/`, `Cache-Control: max-age=600`.
- **Isolation.** Each journey gets its own server (origin) and browser context.
  `ctx.newDevice()` opens a second device with its own storage.

## The journeys

| Journey | What it guards |
| --- | --- |
| `first-match` | setup → commanders by search → Start → life taps → reload mid-game → winner → saved → statistics. Marked `live`: also runs against the published site after each deploy. |
| `offline` | after one visit, no signal: the app opens from the service worker and a table plays from the history |
| `upgrade` | the release that is live today (newest `v*` tag) writes a match in progress and a history; this tree is deployed over it; the update arrives by itself, keeps every point, announces what's new and cleans old caches |
| `update-button` | the installed app's Update button: nothing new → "already the newest" without reloading; a beta push (same version, changed files) → reloads into them; a release that took over in the background while the page ran old code → reloads into it; no connection → "could not check", never "already the newest" |
| `legacy-data` | a database in the shape early releases left (`fixtures/legacy-db.js`) opens, plays, heals junk and keeps the history |
| `crash-screen` | a module that throws shows the crash screen with the error and a way out, not a black screen |
| `channels` | beta and production on one origin never share storage or caches |
| `screens` | the home screen in pt/en/es/de without raw keys, every settings row, what's new, the install guide, a match with the mouse in landscape |
| `cloud-account` | signed in: the match reaches the cloud and leaves the device, a second device finds it, a cloud outage keeps the match on the device until it is back |

## On failure

`tests/e2e/artifacts/` gets a screenshot of every open tab and a log with the
step that failed, the page errors and every external request. In CI they are
attached to the run as `e2e-artifacts`.

## Adding a journey

1. A file in `journeys/` exporting `{ name, run(ctx) }` (plus `live: true` if
   it is safe to run against the published site, `cloud: { users }` for
   accounts, `allowErrors: [/re/]` only when the error is the scenario).
2. Use the steps in `journeys/app.js`; add new ones there, not in the journey.
   Match text through `t(page, key)`, never a hardcoded language.
3. List it in `journeys/index.js`.
4. Prove it: break the thing it guards and watch it go red before trusting it.
