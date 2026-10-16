/**
 * The browser journeys: `npm run e2e` (or `node tests/e2e/run.js [name...]`).
 *
 * Each journey is what a person does with the app, end to end, in a real
 * headless Chromium: real taps, a real service worker, real localStorage,
 * served from the same paths as GitHub Pages. The unit cases prove the pieces;
 * these prove the app - the 1.10.1 Start button passed 225 unit cases and
 * could not start a match.
 *
 * Isolation: every journey gets its own server (its own origin, so its own
 * storage and service worker) and its own browser context. Nothing leaks from
 * one journey into the next.
 *
 * A journey fails when a step throws, when the page or its service worker
 * logs any error, or when the app talks to a host network.js does not know.
 * On failure, a screenshot of every open tab goes to tests/e2e/artifacts/.
 *
 * Environment:
 *   CHROME_PATH        which browser (otherwise Chrome/Edge is found)
 *   E2E_BASE_URL       run the journeys marked `live` against a deployed site
 *                      instead of a local server (post-deploy smoke)
 *   E2E_BASELINE_REF   the release the upgrade journey starts from
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.js';
import { startServer } from './lib/server.js';
import { installNetwork } from './lib/network.js';
import { fakeCloud } from './lib/fake-cloud.js';
import { Page, PHONE, DESKTOP } from './lib/page.js';
import { JOURNEYS } from './journeys/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
const ARTIFACTS = path.join(HERE, 'artifacts');
const JOURNEY_TIMEOUT = 150000;

const dim = (s) => '\x1b[2m' + s + '\x1b[0m';
const green = (s) => '\x1b[32m' + s + '\x1b[0m';
const red = (s) => '\x1b[31m' + s + '\x1b[0m';

const live = process.env.E2E_BASE_URL ? process.env.E2E_BASE_URL.replace(/\/?$/, '/') : null;
const wanted = process.argv.slice(2);
const selected = JOURNEYS.filter((j) => (!wanted.length || wanted.some((w) => j.name.includes(w)))
  && (!live || j.live));

if (!selected.length) {
  console.error(red('No journey matches: ' + wanted.join(' ')));
  process.exit(2);
}

fs.rmSync(ARTIFACTS, { recursive: true, force: true });

const { conn, close, exe } = await launch();
console.log(dim('\n browser: ' + exe + (live ? '\n target:  ' + live : '') + '\n'));

// Errors thrown inside a service worker never reach the page console. Every
// worker the browser starts is attached, and its errors are charged to the
// journey running at the time.
let current = null;
conn.on(async (m) => {
  if (m.method === 'Target.targetCreated' && m.params.targetInfo.type === 'service_worker') {
    try {
      const { sessionId } = await conn.send('Target.attachToTarget', { targetId: m.params.targetInfo.targetId, flatten: true });
      await conn.send('Runtime.enable', {}, sessionId);
      if (current) current.workers.add(sessionId);
    } catch { /* the worker already stopped */ }
  }
  if (!current || !current.workers.has(m.sessionId)) return;
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    current.workerErrors.push('service worker exception: ' + ((d.exception && d.exception.description) || d.text));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    current.workerErrors.push('service worker console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
});
await conn.send('Target.setDiscoverTargets', { discover: true });
await conn.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });

const results = [];
for (const journey of selected) {
  const started = Date.now();
  const record = { name: journey.name, ok: true, steps: [], why: '' };
  results.push(record);
  process.stdout.write(' ' + dim('…') + ' ' + journey.name + '\r');

  const server = live ? null : await startServer();
  if (server) {
    server.mount('/hit-easy/', REPO);
    server.mount('/hit-easy/beta/', REPO);
  }
  const base = live || server.origin + '/hit-easy/';
  const { browserContextId } = await conn.send('Target.createBrowserContext', { disposeOnDetach: false });
  // Every journey has a cloud: the app asks Supabase for its settings even
  // signed out. Journeys that sign in describe their accounts in `cloud`.
  const cloud = fakeCloud(journey.cloud || {});
  const net = installNetwork(conn, { localOrigin: new URL(base).origin, cloud });
  const pages = [];
  const extraContexts = [];
  current = { workers: new Set(), workerErrors: [] };

  const ctx = {
    base,
    server,
    net,
    cloud,
    repo: REPO,
    live: Boolean(live),
    PHONE,
    DESKTOP,
    /** Another tab on the SAME device: shares storage and service worker. */
    async open(device = PHONE) {
      const page = await Page.open(conn, browserContextId, device);
      pages.push(page);
      return page;
    },
    /** A tab on ANOTHER device: its own storage, cache and service worker. */
    async newDevice(device = PHONE) {
      const { browserContextId: id } = await conn.send('Target.createBrowserContext', { disposeOnDetach: false });
      extraContexts.push(id);
      const page = await Page.open(conn, id, device);
      pages.push(page);
      return page;
    },
    async step(name, fn) {
      record.steps.push(name);
      return fn();
    },
  };

  try {
    await Promise.race([
      journey.run(ctx),
      new Promise((_, reject) => setTimeout(() => reject(new Error('journey took over ' + JOURNEY_TIMEOUT / 1000 + 's')), JOURNEY_TIMEOUT)),
    ]);
    const errors = [...pages.flatMap((p) => p.errors), ...current.workerErrors]
      .filter((e) => !(journey.allowErrors || []).some((re) => re.test(e)));
    if (errors.length) throw new Error('the app logged errors:\n       ' + errors.join('\n       '));
    if (cloud.unknown.length) {
      throw new Error('the app called cloud endpoints the fake cloud does not know '
        + '(add them to tests/e2e/lib/fake-cloud.js):\n       ' + [...new Set(cloud.unknown)].join('\n       '));
    }
    if (net.stray.length) throw new Error('the app called hosts nobody listed:\n       ' + [...new Set(net.stray)].join('\n       '));
  } catch (err) {
    record.ok = false;
    record.why = err.message;
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const slug = journey.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    for (const [i, page] of pages.entries()) {
      try { fs.writeFileSync(path.join(ARTIFACTS, `${slug}-${i}.png`), await page.screenshot()); } catch { /* tab gone */ }
    }
    fs.writeFileSync(path.join(ARTIFACTS, `${slug}.txt`), [
      'journey: ' + journey.name,
      'failed at step: ' + record.steps[record.steps.length - 1],
      '', err.stack || err.message,
      '', 'page errors:', ...pages.flatMap((p) => p.errors), ...current.workerErrors,
      '', 'external requests:', ...net.log,
    ].join('\n'));
  } finally {
    for (const page of pages) await page.close();
    net.dispose();
    current = null;
    for (const id of [browserContextId, ...extraContexts]) {
      try { await conn.send('Target.disposeBrowserContext', { browserContextId: id }); } catch { /* gone */ }
    }
    if (server) await server.close();
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1) + 's';
  console.log(' ' + (record.ok ? green('✓') : red('✕')) + ' ' + journey.name + dim('  ' + secs));
  if (!record.ok) {
    console.log('   ' + red('at step: ' + record.steps[record.steps.length - 1]));
    console.log('   ' + red(record.why));
  }
}

await close();

const failed = results.filter((r) => !r.ok);
console.log();
if (failed.length) {
  console.log(red(' Failed journeys:'));
  for (const r of failed) console.log('   ' + red('✕') + ' ' + r.name + dim(' - at: ' + r.steps[r.steps.length - 1]));
  console.log(dim('\n screenshots and logs: tests/e2e/artifacts/'));
}
console.log(failed.length
  ? red(` ${failed.length} of ${results.length} journeys failed`)
  : green(` ${results.length} journeys, all passed`) + dim('  (real browser)'));
console.log();
process.exit(failed.length ? 1 : 0);
