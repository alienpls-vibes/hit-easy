# Hit Easy — promotional site

The public site of the app: landing page, download/install guide, account
(sign up, sign in, @, password recovery) and the person's statistics.

Published with the app, by the same workflow, at
`https://alienpls-vibes.github.io/hit-easy/site/` (and `/hit-easy/beta/site/`
on the beta channel). No build and no dependencies, like the app: edit a file,
push, done.

## Pages

| file            | `data-page` | what it shows |
|-----------------|-------------|---------------|
| `index.html`    | `home`      | landing page |
| `download.html` | `download`  | install guide per device |
| `account.html`  | `account`   | sign up / sign in / profile (`#criar` opens on sign-up, `?next=stats` goes to the statistics after signing in) |
| `stats.html`    | `stats`     | the signed-in person's statistics |

Each HTML file is only the `<head>` (title, description, share preview) and an
empty `<div id="site">`. `main.js` draws the page from its sections.

## Where to change what

| I want to change…                     | edit |
|---------------------------------------|------|
| any text                              | `content/pt.js` and the same key in `content/en.js`, `es.js`, `de.js` |
| a link, icon, color or commander art  | `content/pt.js` only — the other languages inherit it |
| which sections a page shows, in which order | `pages.js` |
| colors, fonts, spacing, corner radius | `styles/tokens.css` |
| the layout of one section             | `sections/<name>.js` (markup) and `styles/sections/<name>.css` |
| where the app / privacy page are, contact e-mail, social links, Google sign-in | `config.js` |
| title and share preview of a page     | the `<head>` of that `.html` |
| an icon                               | `lib/icons.js` (content refers to icons by name) |

### Examples

- **Change the headline**: `hero.title` in each `content/<lang>.js`.
- **Add a FAQ question**: `faq.items` in `content/pt.js`, add
  `{ q: '…', a: '…' }`; then the same position in `en.js`, `es.js` and
  `de.js`. An optional `link: { label, href }` adds a link under the answer
  (the `href` only in `pt.js`).
- **Remove the "Como funciona" block from the home page**: `pages.js` → delete
  `'how'` from `home`.
- **Add a footer link to Instagram**: `config.js` → `social: [{ label: 'Instagram', href: 'https://instagram.com/…' }]`.
- **Change the accent of the whole site**: `styles/tokens.css`.

### Creating a section

1. `sections/my-section.js`:

   ```js
   import { html } from '../lib/dom.js';

   export default function render({ text }) {
     return html`
       <section class="section my-section">
         <div class="container">
           <h2 class="section-title">${text.title}</h2>
         </div>
       </section>`;
   }

   // Optional: behavior once it is on the page.
   export function mount(node, ctx) {}
   ```

2. Its texts under the same key in `content/pt.js` (`'my-section': { title: '…' }`)
   and in the other languages.
3. `styles/sections/my-section.css` and one `@import` line in `styles/site.css`.
4. Its name in the page list in `pages.js`.

`render` returns markup written with the `html` tag: every `${value}` is
escaped (safe for names typed at the table), arrays are joined, and `null` /
`false` print nothing. `ctx` is `{ site, content, page, text }`, where `text`
is the section's own group in the visitor's language, plus `lang` and
`locale` (for dates and numbers).

Links in the content accept `{app}` and `{privacy}`, resolved from
`config.js`, so the copy never hardcodes where the app lives.

## The table screenshot

The phone on the home page shows the app's real table screen
(`assets/table.webp`, plus `assets/table.jpg` for browsers without WebP),
taken from a simulated match: 4 players with Atraxa, Krenko, Edgar Markov and
Meren, turn 7, Ana to play, Davi with 8 commander damage.

How it was made, to redo it when the table screen changes:

1. build the match with the app's own engine (`createMatch` + `push` from
   `src/engine.js`) and store it as `current` in the app's `mtglc.db.v1`, with
   `dragHintSeen: true` and `versaoVista` = the app version, so no tip or
   release notes cover the table;
2. open the app in a browser emulating a phone lying flat - 844 × 390 at
   device scale 3 - and take a screenshot;
3. save it at 1688 × 780 as WebP and JPEG.

To use another picture, replace the two files (same names) or point
`hero.screenshot` in `content/pt.js` to new ones, with their `width` and
`height`. The description read by screen readers is `hero.screenshot.alt`, in
each language.

## Languages

The same four as the app: Portuguese, English, Spanish and German.

- `content/pt.js` is the base: every text, plus links, icons, colors, art and
  sample numbers.
- `content/en.js`, `es.js`, `de.js` hold **only texts**, laid over `pt.js`:
  objects merge key by key and arrays merge **by position** — `en.js` writes
  `links: [{ label: 'Features' }, ...]` and keeps the `href` from `pt.js`.
  Whatever a translation leaves out shows in Portuguese, so a missing text
  never breaks a page.
- `content.js` lists the languages (`LANGS`, `LOCALES`) and does the merge.
  A new language is a new file plus one line in each list.

Which language a visitor sees (`lib/lang.js`), first match wins: `?lang=en`
in the address, the site's own picker (globe in the top bar), the language
chosen in the app on that browser, the browser's languages, Portuguese. The
picker's choice is kept under the site's own key and never written into the
app's data. Dates and numbers follow the language, and so do the tab title
and description (`meta.pages`). The HTML files keep the Portuguese title,
for search engines and link previews.

The privacy policy is the app's, in Portuguese only.

## How the account and the statistics work

The site does **not** reimplement either. `lib/app.js` (accounts, install) and
`lib/app-stats.js` (match engine, aggregation) import the app's own modules
from `../src/`. Consequences:

- it is the **same account** as the app (same Supabase, same RLS);
- the numbers on the site are computed by the same functions as on the phone;
- same origin, same storage key: signing in on the site signs the app in on
  that browser, and the other way around (an app installed on iPhone keeps its
  own storage, so there it signs in on its own);
- the statistics gate is the database's: without access, `matches` returns an
  empty list and the page shows the lock.

Sign-up goes through `signUp()` in `lib/app.js` and not the app's
`createAccount()`, only to send `redirect_to`: the confirmation e-mail has to
bring the person back to the site, not to the app. The address must be covered
by **Authentication → URL Configuration → Redirect URLs** in Supabase;
`https://alienpls-vibes.github.io/hit-easy/**` already covers `/site/`.

If the site ever moves to its own domain or repository, `config.js`
(`appUrl`, `privacyUrl`, `logo`) and the import paths in `lib/app.js` and
`lib/app-stats.js` are what changes — they can point to absolute URLs of the
published app. The Supabase Redirect URLs list then needs the new address.

## Installing ("download")

The app is a PWA, so the download button installs it from the browser. The
site pages link the **app's** manifest (`../manifest.webmanifest`), so where
the browser offers a native prompt (Chrome, Edge, Samsung Internet) the
"Instalar o Hit Easy" button installs the app straight from the site.
Elsewhere — iPhone, Firefox, Mac Safari — the guide walks through opening the
app and adding it to the home screen. `lib/platform.js` picks the guide; the
steps per browser are in `install.guides` of each `content/<lang>.js`.

The app's service worker ignores `/site/` (see `sw.js`), so a site edit shows
up on the next visit instead of being served from the app's offline cache.

## Running locally

From the repository root: `python serve.py`, then open
`http://localhost:8000/site/`. Account e-mails sent from localhost fall back to
the Supabase Site URL, since localhost is not in the Redirect URLs list.
