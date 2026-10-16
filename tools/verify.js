/**
 * The gate before anything is published: `npm run verify`.
 *
 * Runs every layer, cheapest first, and stops at the first red one - there is
 * no point in driving a browser through an app that does not parse:
 *
 *   1. syntax      every module, the service worker and the inline <script>s
 *                  in the HTML pages parse; versions, release notes, cache list
 *                  and icons agree (tools/check-syntax.js)
 *   2. unit        the engine, statistics, store and panels (tests/cases.js)
 *   3. modules     every import, re-export and `namespace.member` points to a
 *                  real export; delimiters; CSS cascade (tools/check_modules.py)
 *   4. journeys    what a person does, in a real headless browser, from setup
 *                  to the cloud, offline and across an update (tests/e2e/)
 *
 * The CI runs the same four (.github/workflows/publish.yml), and the pre-push
 * hook runs this before a push to beta or main (tools/hooks/pre-push).
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function python() {
  for (const exe of ['python3', 'python']) {
    const r = spawnSync(exe, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return exe;
  }
  return null;
}

const py = python();
const layers = [
  { name: 'syntax', cmd: process.execPath, args: ['tools/check-syntax.js'] },
  { name: 'unit', cmd: process.execPath, args: ['tests/run-node.js'] },
  { name: 'modules', cmd: py, args: ['tools/check_modules.py'], missing: 'Python 3 is needed for tools/check_modules.py' },
  { name: 'journeys', cmd: process.execPath, args: ['tests/e2e/run.js'] },
];

const results = [];
for (const layer of layers) {
  console.log('\x1b[1m\n== ' + layer.name + ' ==\x1b[0m');
  if (!layer.cmd) {
    console.error('\x1b[31m ' + layer.missing + '\x1b[0m');
    results.push({ ...layer, ok: false, secs: 0 });
    break;
  }
  const started = Date.now();
  const r = spawnSync(layer.cmd, layer.args, { cwd: ROOT, stdio: 'inherit' });
  const ok = r.status === 0;
  results.push({ ...layer, ok, secs: (Date.now() - started) / 1000 });
  if (!ok) break;
}

console.log('\x1b[1m\n== verify ==\x1b[0m');
for (const layer of layers) {
  const r = results.find((x) => x.name === layer.name);
  const mark = !r ? '\x1b[2m-\x1b[0m' : r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✕\x1b[0m';
  console.log(' ' + mark + ' ' + layer.name.padEnd(9) + (r ? '\x1b[2m' + r.secs.toFixed(1) + 's\x1b[0m' : '\x1b[2mnot run\x1b[0m'));
}
const failed = results.find((r) => !r.ok);
console.log(failed
  ? '\n\x1b[31m Not ready to publish: ' + failed.name + ' failed.\x1b[0m\n'
  : '\n\x1b[32m Ready to publish: every layer passed.\x1b[0m\n');
process.exit(failed ? 1 : 0);
