# Promotional site — working conventions

Read `README.md` in this folder first: it maps every kind of change to the one
file that holds it.

- **Copy lives in `content.js`, never in `sections/*.js`.** A request to change
  a text is an edit to `content.js`; a section file changes only for layout or
  behavior. Site copy is Portuguese (users read it); code, comments and docs
  are English, like the rest of the repo.
- One section = `sections/<name>.js` + `styles/sections/<name>.css` + a key in
  `content.js` + an `@import` in `styles/site.css`. Page composition is
  `pages.js`.
- Colors and measures come from `styles/tokens.css`; do not hardcode a color
  in a section stylesheet (the light theme would miss it).
- Markup goes through the `html` tag from `lib/dom.js`, which escapes values.
  Use `raw()` only for markup written in the code, never for data.
- The site imports the app's modules only through `lib/app.js` and
  `lib/app-stats.js`. Do not import `../src/...` anywhere else, and do not
  copy app logic into the site.
- It must work on old phone browsers too: no build step, no dependencies, no
  syntax newer than what the app itself uses (no `?.` / `??`).
- Check after editing: from the repo root, `npm test` (the app) and open
  `http://localhost:8000/site/` with `python serve.py` running.
