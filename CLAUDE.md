# Hit Easy — working conventions

## Language: English for everything developers read

All code and project text is written in **English**:

- file and folder names, identifiers (variables, functions, classes, CSS
  classes, test names), code comments and JSDoc;
- docs (`README.md`, `docs/`), SQL comments in `sql/`, tooling output in
  `tools/` and `tests/`;
- commit messages and PR descriptions.

**What stays in Portuguese** (or in the user's language), because users read it:

- UI text — always through the i18n dictionaries in `src/i18n/` (`pt.js` is the
  fallback; `en.js`, `es.js`, `de.js` must have exactly the same keys). Never
  hardcode a user-facing string in a view; add a key instead.
- Release-note text in `src/release-notes.js` (`title` and `text`), and the
  crash-screen text in `index.html`.
- `privacidade.html` (its URL is public).

## Stored names are a data contract — never rename them

The English rename deliberately kept every name that is persisted on devices or
in Supabase. Renaming any of these breaks existing users' data or old clients:

- **localStorage keys**: `mtglc.db.v1`, `mtglc.session.v1`,
  `mtglc.scryfallCache.v1` (beta adds `.beta` via `storageKey()` in
  `src/channel.js`).
- **Local db fields**: `enviadas`, `decksDeConta`, `handlesAtuais`; settings
  `versaoVista`, `versaoAnterior`; theme values `'sistema' | 'claro' | 'escuro'`.
- **Match fields**: `assentos: 'topo'`, `ausenteDesde`, `ausencias`,
  `passadaEm`, `passadaCodigo`, `desvioDeRelogio`, `mana`; layout ids
  `paisagem | retrato | padrao` and legacy `2-1, 1-2, volta, 3-2`.
- **Votes**: `kind` `'opcoes' | 'numero'`; presets `duas | dilema | numero |
  jogador`.
- **Win reasons**: `combate, comandante, combo, veneno, mill, alternativa,
  concessao, outro`.
- **Table hand-off**: envelope `{ formato: 'hit-easy/mesa', versao, em, partida }`,
  link parameter `?mesa=`, file name `mesa-hit-easy-<id>.json`.
- **Channel values** `'producao' | 'beta'`; service-worker cache prefix
  `hiteasy-`; `build.json` fields `build`, `quando`; `window.__hitEasyInstall`;
  `user_metadata.has_password`.
- **Supabase**: every table, column, policy, constraint, trigger, RPC and its
  parameters/results (`canal`, `confia`, `handle_trocado_em`, `buscar_handle`,
  `enviar_mesa`, `pegar_mesa`, `situacao_mesa` → `esperando | recebida |
  inexistente | cancelada`, error `HE015`, …). Migrations are append-only: add a
  new numbered file in `sql/`, never edit the meaning of a live one.

When code needs one of these, keep the stored value and give it an English
constant or comment (for example `SEATS_FROM_TOP = 'topo'`,
`KIND_OPTIONS = 'opcoes'`).

## Checks

```bash
npm run verify   # the full gate: syntax, unit, modules, browser journeys
npm test         # syntax check + all unit cases (fast)
npm run check    # imports/exports, namespace members, delimiters, CSS cascade
npm run e2e      # browser journeys in headless Chrome/Edge (tests/e2e/)
```

`npm run verify` must pass before every push to `beta` or `main` - the
pre-push hook enforces it once enabled with `git config core.hooksPath
tools/hooks`, and the CI runs the same layers before publishing. No build, no
dependencies.

Rules that came from shipping a broken release (1.10.1, Start threw):

- Removing or renaming an export: grep for `.name` too, not only for the
  import - `import * as store` uses it as `store.name`. `npm run check` now
  catches it, but search without filtering the results.
- A change to a flow a person uses (setup, table, finishing, sync, update)
  needs a journey that walks it, or an existing one extended. Break the thing
  once and watch the journey go red before trusting it.
- Never publish with a red layer, and never "fix" a journey by loosening it
  until the app's behavior is understood.

## Releases

- Working branch is `beta`; pushing it publishes the beta channel.
- The version number only changes for a production release (`src/version.js`
  and `sw.js` together, plus a `src/release-notes.js` entry). See README,
  "The version number".
