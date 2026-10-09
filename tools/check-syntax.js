/**
 * Runs `node --check` on every module of the project, plus the cross-file
 * checks nothing in the language enforces.
 *
 * The cases in tests/ only exercise engine, stats and seating - the rest
 * depends on the DOM and does not run in Node. This check reaches the rest: it
 * does not prove the interface works, but it guarantees it at least PARSES,
 * which is the silliest error and the easiest one to let through in a project
 * with no build.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** The same, for the stylesheets. */
function walkCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (name.endsWith('.css')) out.push(full);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'tests')),
  ...walk(join(ROOT, 'tools')),
  join(ROOT, 'sw.js'),
].sort();

const failures = [];
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failures.push({ file, why: String(err.stderr || err.message).trim() });
  }
}

if (failures.length) {
  console.error('\n\x1b[31m Syntax error:\x1b[0m');
  for (const f of failures) console.error('  ' + relative(ROOT, f.file) + '\n' + f.why + '\n');
  process.exit(1);
}

/*
 * The @ format lives in two places that do not see each other: the client
 * regex (src/cloud/rules.js) and the Postgres constraint
 * (sql/002-participants.sql). Nothing in the language forces the two to agree,
 * and when they diverge the symptom is awful: the app accepts what the person
 * typed, sends it to the database, and the database returns an unexplained
 * 400. Here the two texts are really compared.
 */
function checkHandle() {
  // Searches all of src/ instead of opening a fixed path: the rule is "the @
  // format lives in some client module", not "lives in this file". Moving the
  // constant to another folder is a legitimate refactor and cannot break the
  // build.
  let inClient = null;
  let clientFile = null;
  for (const file of walk(join(ROOT, 'src'))) {
    const found = readFileSync(file, 'utf8').match(/HANDLE_RE\s*=\s*\/\^(.+?)\$\//);
    if (found) {
      inClient = found;
      clientFile = relative(ROOT, file).split(sep).join('/');
      break;
    }
  }
  const sql = readFileSync(join(ROOT, 'sql/002-participants.sql'), 'utf8');
  const inDatabase = sql.match(/handle\s*~\s*'\^(.+?)\$'/);

  if (!inClient) return 'HANDLE_RE vanished from src/: no module defines the @ format';
  if (!inDatabase) return 'the handle_formato constraint vanished from the SQL';
  if (inClient[1] !== inDatabase[1]) {
    return 'the @ format diverges:\n'
      + '    client:   ^' + inClient[1] + '$   (' + clientFile + ')\n'
      + '    database: ^' + inDatabase[1] + '$   (sql/002-participants.sql)\n'
      + '    Diverging here makes the app accept an @ the database refuses with a 400.';
  }
  return null;
}

const badHandle = checkHandle();
if (badHandle) {
  console.error('\n\x1b[31m @ format:\x1b[0m\n  ' + badHandle + '\n');
  process.exit(1);
}

/*
 * An RLS policy cannot query ANOTHER protected table directly.
 *
 * When A's policy queries B and B's policy queries A, Postgres evaluates one
 * inside the other endlessly and takes both down with 42P17, "infinite
 * recursion detected in policy". The symptom is brutal: even the read that
 * already worked disappears, because the error is in the policy EVALUATION,
 * not the query.
 *
 * It happened here between matches and match_players. The way out is a
 * `security definer` function, which runs as the table owner and so does not
 * trigger RLS again. Since nothing in the language enforces it, the rule is
 * written here.
 */
function checkPolicies() {
  const sqlFiles = readdirSync(join(ROOT, 'sql'))
    .filter((n) => n.endsWith('.sql'))
    .map((n) => join(ROOT, 'sql', n));

  const problems = [];
  for (const sqlFile of sqlFiles) {
    const text = readFileSync(sqlFile, 'utf8');
    // Each "create policy" up to the semicolon that closes the statement.
    const parts = text.split(/create policy/i).slice(1);
    for (const raw of parts) {
      const body = raw.split(/;\s*(?:\n|$)/)[0];
      const target = body.match(/\bon\s+public\.(\w+)/i);
      if (!target) continue;
      const table = target[1];

      // Everything after "on public.X for ..." is the policy condition.
      const condition = body.slice(target.index + target[0].length);
      const refs = [...condition.matchAll(/\b(?:from|join)\s+public\.(\w+)/gi)]
        .map((m) => m[1])
        .filter((t) => t !== table);

      for (const other of new Set(refs)) {
        problems.push(
          relative(ROOT, sqlFile) + ': policy on public.' + table
          + ' queries public.' + other + ' directly.\n'
          + '    If public.' + other + ' has a policy citing public.' + table
          + ', Postgres takes both down with 42P17.\n'
          + '    Go through a `security definer` function.',
        );
      }
    }
  }
  return problems;
}

const badPolicies = checkPolicies();
if (badPolicies.length) {
  console.error('\n\x1b[31m Possible RLS recursion:\x1b[0m');
  for (const x of badPolicies) console.error('  ' + x + '\n');
  process.exit(1);
}

/*
 * The install prompt has to be captured BEFORE the modules.
 *
 * Chrome fires `beforeinstallprompt` as soon as it decides the page is
 * installable, and that can happen before src/install.js is evaluated. When it
 * did, the event was lost and the install button only showed sometimes - the
 * same app, the same page, a different result on every open.
 *
 * The order in the HTML is the whole fix, and nothing in the code defends it:
 * one day someone moves the "loose" block next to the rest and the defect
 * comes back, with no test complaining.
 */
function checkInstall() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const capture = html.indexOf('beforeinstallprompt');
  const module = html.indexOf('type="module"');
  const install = readFileSync(join(ROOT, 'src/install.js'), 'utf8');

  if (capture === -1) {
    return 'index.html does not capture beforeinstallprompt: the install button becomes intermittent';
  }
  if (module === -1) return 'index.html does not load the app module';
  if (capture > module) {
    return 'the beforeinstallprompt capture comes AFTER the module in index.html. '
      + 'In that order the event is lost when Chrome fires it early.';
  }
  if (!install.includes('__hitEasyInstall')) {
    return 'src/install.js does not read the window.__hitEasyInstall drawer that index.html fills';
  }
  return null;
}

const badInstall = checkInstall();
if (badInstall) {
  console.error('\n\x1b[31m Install prompt:\x1b[0m\n  ' + badInstall + '\n');
  process.exit(1);
}

/*
 * Code after a `return`, in the same block, never runs.
 *
 * This was born from a real and expensive defect: splitting table.js left a
 * stray `return` inside `createVictory`, the `return` that installed the
 * functions became unreachable, and `table.showVictory` and
 * `table.pickWinner` were never hung on the context. At the table, the match
 * did not end by itself with one player alive and the declare-winner button
 * did nothing.
 *
 * Nothing reported it: `node --check` passes, because unreachable code is
 * valid syntax; the import check passes; the references check passes, because
 * they all exist. And the suite had 150 green cases.
 *
 * The heuristic is indentation, which is consistent in this project: given a
 * `return` with N spaces, the next line with EXACTLY N spaces has to close the
 * block. Anything else there is unreachable.
 */
/**
 * The line without its trailing comment, and without what is inside strings.
 *
 * `return null; // because` did not end with a semicolon for the test below,
 * so the search for the end of the statement went on and ended up inside the
 * NEXT function - flagging code that runs. A guard that lies is worse than no
 * guard: it teaches people to ignore the alarm.
 *
 * Skipping the content of quotes serves the same end by another path: a brace
 * or a `//` inside a string is not code, and it used to count as if it were.
 */
function withoutComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '/' && line[i + 1] === '/') return line.slice(0, i).trimEnd();
  }
  return line;
}

function checkUnreachable() {
  const problems = [];

  for (const file of walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'tools')))) {
    const lines = readFileSync(file, 'utf8').split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^(\s+)return\b/);
      if (!m) continue;
      const indent = m[1].length;

      // A `return` may open an object or a list and close lines later. Walk to
      // the end of the statement itself before looking at what comes next.
      //
      // Counting DEPTH, and not "the first line ending in a semicolon": in a
      // `return { destroy: () => { ...; } };` that rule stops inside the arrow,
      // and the check starts looking at the wrong place - that is how the
      // first version of this did not fire on the defect that motivated it.
      let j = i;
      let depth = 0;
      for (; j < lines.length; j += 1) {
        const code = withoutComment(lines[j]);
        for (const ch of code) {
          if (ch === '{' || ch === '(' || ch === '[') depth += 1;
          else if (ch === '}' || ch === ')' || ch === ']') depth -= 1;
        }
        if (depth <= 0 && /;\s*$/.test(code)) break;
      }

      // The next line that matters: skips blank lines and comments.
      for (let k = j + 1; k < lines.length; k += 1) {
        const line = lines[k];
        if (!line.trim()) continue;
        if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;

        const own = line.match(/^(\s*)/)[1].length;
        // Smaller indent: the block ended, nothing to say.
        if (own < indent) break;
        // Same indent and it does not close the block: unreachable.
        if (own === indent && !/^\s*[}\)\]]/.test(line)) {
          problems.push(
            relative(ROOT, file).split(sep).join('/') + ':' + (k + 1)
            + ': code after `return` (line ' + (i + 1) + ') never runs.'
            + '\n    ' + line.trim().slice(0, 70),
          );
        }
        break;
      }
    }
  }

  return problems;
}

const unreachable = checkUnreachable();
if (unreachable.length) {
  console.error('\n\x1b[31m Unreachable code:\x1b[0m');
  for (const x of unreachable) console.error('  ' + x);
  console.error('');
  process.exit(1);
}

/*
 * Every module and every stylesheet has to be in the service worker list.
 *
 * The list in sw.js is explicit because the worker has to know what to
 * download BEFORE the internet runs out - it cannot discover import by import
 * on the spot. There are more than eighty files, and nothing in the language
 * links one to the other: creating a new module and forgetting the line in
 * sw.js gives no error, breaks no test and does not show in a browser with a
 * network. The app simply stops opening offline, and that is found out at the
 * table, the only place where it matters.
 *
 * It also checks the reverse - a list entry pointing to a file that no longer
 * exists - because `cache.addAll()` rejects EVERYTHING if a single request
 * fails: a dead path in the list keeps anything from being cached.
 */
function checkCache() {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const block = sw.match(/const ASSETS = \[([\s\S]*?)\n\];/);
  if (!block) return ['the ASSETS list vanished from sw.js'];

  const listed = new Set(
    [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
  );

  const onDisk = walk(join(ROOT, 'src'))
    .concat(walkCss(join(ROOT, 'src')))
    .map((f) => './' + relative(ROOT, f).split(sep).join('/'));

  const problems = [];
  for (const path of onDisk.sort()) {
    if (!listed.has(path)) {
      problems.push(path + ' exists in src/ and is NOT in the ASSETS list of '
        + 'sw.js: the app would not open offline.');
    }
  }
  for (const path of [...listed].sort()) {
    if (!path.startsWith('./src/')) continue;
    if (!existsSync(join(ROOT, path))) {
      problems.push(path + ' is in the ASSETS list of sw.js and no longer '
        + 'exists: addAll() rejects everything if one request fails.');
    }
  }
  return problems;
}

/**
 * Does every referenced icon exist on disk?
 *
 * Three files point to the icons - manifest.webmanifest, index.html and the
 * ASSETS list of sw.js - so changing the art means fixing all three. Getting
 * one wrong breaks no test, and each one fails in a different way:
 *
 *   - manifest with a dead path: only shows at install time, on someone
 *     else's device, and the system falls back to a generic icon silently;
 *   - sw.js with a dead path: `cache.addAll()` rejects EVERYTHING if a single
 *     request fails, so the whole app stops working offline;
 *   - index.html with a dead path: the tab gets no favicon.
 *
 * It also checks the reverse: a PNG in icons/ nobody references. Old art left
 * there keeps being downloaded by whoever clones the repository and becomes a
 * doubt about which one is current.
 */
function checkIcons() {
  const problems = [];
  const cited = new Set();

  const sources = [
    ['manifest.webmanifest', /"src"\s*:\s*"\.\/(icons\/[^"]+)"/g],
    ['index.html', /href="\.\/(icons\/[^"]+)"/g],
    ['sw.js', /'\.\/(icons\/[^']+)'/g],
  ];

  for (const [file, re] of sources) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const m of text.matchAll(re)) {
      cited.add(m[1]);
      if (!existsSync(join(ROOT, m[1]))) {
        problems.push(file + ' points to ' + m[1] + ', which does not exist.');
      }
    }
  }

  if (!cited.size) problems.push('no icon referenced anywhere');

  for (const f of readdirSync(join(ROOT, 'icons'))) {
    if (!f.endsWith('.png')) continue;
    if (!cited.has('icons/' + f)) {
      problems.push('icons/' + f + ' is referenced by nobody: '
        + 'old art left behind becomes a doubt about which one is current.');
    }
  }

  return problems;
}

const badIcons = checkIcons();
if (badIcons.length) {
  console.error('\n\x1b[31m Icons:\x1b[0m');
  for (const x of badIcons) console.error('  ' + x);
  console.error('');
  process.exit(1);
}

const badCache = checkCache();
if (badCache.length) {
  console.error('\n\x1b[31m Service worker cache:\x1b[0m');
  for (const x of badCache) console.error('  ' + x);
  console.error('');
  process.exit(1);
}

/*
 * The version lives in two places that do not see each other: src/version.js
 * and sw.js.
 *
 * A worker does not import modules, so the string is repeated by hand. If they
 * diverge there is a real consequence: the cache name comes from the WORKER
 * version, and the screen shows the module's. Someone would report "I'm on
 * 1.2.0" while running the 1.1.0 cache, and the investigation would start in
 * the wrong place.
 */
function checkVersion() {
  const mod = readFileSync(join(ROOT, 'src/version.js'), 'utf8');
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

  const inModule = mod.match(/APP_VERSION\s*=\s*'([^']+)'/);
  const inWorker = sw.match(/const VERSION\s*=\s*'([^']+)'/);

  if (!inModule) return 'APP_VERSION vanished from src/version.js';
  if (!inWorker) return 'VERSION vanished from sw.js';
  if (inModule[1] !== inWorker[1]) {
    return 'the version diverges: src/version.js says ' + inModule[1]
      + ' and sw.js says ' + inWorker[1]
      + '. The cache comes from the worker and the screen from the module.';
  }
  return null;
}

const badVersion = checkVersion();
if (badVersion) {
  console.error('\n\x1b[31m App version:\x1b[0m\n  ' + badVersion + '\n');
  process.exit(1);
}

/*
 * The privacy policy has fields only the person responsible can fill in:
 * controller name, contact email, server region.
 *
 * This WARNS and does not break the build, on purpose. Breaking it would
 * block publishing to the test channel, which is precisely where the text
 * should be reviewed before going to production. But publishing a policy with
 * a gap is worse than having no policy, so the warning is loud.
 */
function checkPrivacy() {
  const html = readFileSync(join(ROOT, 'privacidade.html'), 'utf8');
  const gaps = html.match(/class="falta"/g);
  return gaps ? gaps.length : 0;
}

const gaps = checkPrivacy();
if (gaps) {
  console.error('\n\x1b[33m Privacy policy:\x1b[0m '
    + gaps + ' field(s) still to fill in (controller name, contact, region).'
    + '\n  Do not publish to production like this.\n');
}

/*
 * The current version needs release notes.
 *
 * Notes written "later" are not written: the memory of what changed lasts
 * hours, not days, and whoever reads the note has no way to know it is
 * incomplete. Tying this to the build is the only way for the note to go
 * along with the release instead of depending on discipline.
 *
 * It breaks the build on purpose, unlike the privacy policy warning: that
 * field needs a human decision and would block the test channel, this one is
 * just writing down what was just done.
 */
function checkReleaseNotes() {
  const version = readFileSync(join(ROOT, 'src/version.js'), 'utf8')
    .match(/APP_VERSION\s*=\s*'([^']+)'/);
  if (!version) return null; // the version check already complains about this

  const notes = readFileSync(join(ROOT, 'src/release-notes.js'), 'utf8');
  const hasEntry = new RegExp("version:\\s*'" + version[1].replace(/\./g, '\\.') + "'")
    .test(notes);

  if (!hasEntry) {
    return 'version ' + version[1] + ' has no entry in src/release-notes.js. '
      + 'Write what changed before publishing.';
  }
  return null;
}

const badNotes = checkReleaseNotes();
if (badNotes) {
  console.error('\n\x1b[31m Release notes:\x1b[0m\n  ' + badNotes + '\n');
  process.exit(1);
}

console.log(` \x1b[2m${files.length} modules with valid syntax\x1b[0m`);
