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
| any text, link or list item           | `content.js` — grouped by section name |
| which sections a page shows, in which order | `pages.js` |
| colors, fonts, spacing, corner radius | `styles/tokens.css` |
| the layout of one section             | `sections/<name>.js` (markup) and `styles/sections/<name>.css` |
| where the app / privacy page are, contact e-mail, social links, Google sign-in | `config.js` |
| title and share preview of a page     | the `<head>` of that `.html` |
| an icon                               | `lib/icons.js` (content refers to icons by name) |

### Examples

- **Change the headline**: `content.js` → `hero.title`.
- **Add a FAQ question**: `content.js` → `faq.items`, add `{ q: '…', a: '…' }`.
  An optional `link: { label, href }` adds a link under the answer.
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

2. Its texts in `content.js` under the same key: `'my-section': { title: '…' }`.
3. `styles/sections/my-section.css` and one `@import` line in `styles/site.css`.
4. Its name in the page list in `pages.js`.

`render` returns markup written with the `html` tag: every `${value}` is
escaped (safe for names typed at the table), arrays are joined, and `null` /
`false` print nothing. `ctx` is `{ site, content, page, text }`, where `text`
is the section's own group in `content.js`.

Links in `content.js` accept `{app}` and `{privacy}`, resolved from
`config.js`, so the copy never hardcodes where the app lives.

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
steps per browser are in `content.js` → `install.guides`.

The app's service worker ignores `/site/` (see `sw.js`), so a site edit shows
up on the next visit instead of being served from the app's offline cache.

## Running locally

From the repository root: `python serve.py`, then open
`http://localhost:8000/site/`. Account e-mails sent from localhost fall back to
the Supabase Site URL, since localhost is not in the Redirect URLs list.
