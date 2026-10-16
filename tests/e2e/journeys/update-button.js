/**
 * The installed app's "Update" button tells the truth.
 *
 * It used to say "already the newest" whenever no worker was installing at
 * the moment of the tap - but the worker installs and takes over by itself in
 * the background, so the usual case was a NEW worker in charge of a page still
 * running OLD code, and the button denied the update the version number
 * already showed. Three cases, each the way it happens on a phone:
 *
 *   1. nothing new                     -> "already the newest", no reload
 *   2. a beta push: files changed, same version, same sw.js -> reloads into
 *      the new files
 *   3. a release took over in the background, the page is behind -> reloads
 *      into the new version
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHome, runningVersion, waitControlled, waitNoSheet, t } from './app.js';
import { sleep } from '../lib/page.js';

const NEXT = '99.0.0-e2e';

/** A copy of this tree with a new version number - the next release. */
function nextRelease(repo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-easy-next-'));
  const skip = new Set(['.git', 'site', 'tests', 'node_modules']);
  fs.cpSync(repo, dir, { recursive: true, filter: (src) => !skip.has(path.basename(src)) || path.dirname(src) !== repo });
  for (const [file, re] of [['sw.js', /const VERSION = '[^']+'/], ['src/version.js', /APP_VERSION = '[^']+'/]]) {
    const full = path.join(dir, file);
    const text = fs.readFileSync(full, 'utf8');
    if (!re.test(text)) throw new Error('no version in ' + file);
    fs.writeFileSync(full, text.replace(re, (m) => m.replace(/'[^']+'/, "'" + NEXT + "'")));
  }
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Opens the settings and taps Update - with the service worker STOPPED first.
 *
 * Phones stop an idle worker within seconds, so the person who taps Update
 * after the app sat open meets a worker that has to start before it can
 * answer. A first version of the fix asked the worker its version with a
 * 1.5 s deadline, which a waking worker on a slow CI machine missed: check 2
 * was skipped and the button said "already the newest" - intermittently.
 */
async function tapUpdate(page) {
  await page.send('ServiceWorker.enable');
  await page.send('ServiceWorker.stopAllWorkers');
  await page.tap('.head-actions > .icon-btn', { index: 0 }); // settings
  await page.tap('.sheet-scrim .set-row.is-update');
}

/** Marks the current document; a reload replaces it and the mark is gone. */
const mark = (page) => page.eval('window.__beforeUpdate = true');
const reloaded = (page) => page.eval('!window.__beforeUpdate');

export default {
  name: "the installed app's update button finds what was published",
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);
    // Installed: the update button only exists in the installed app.
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });",
    });

    await ctx.step('open the installed app', async () => {
      await openHome(page, ctx.base);
      await waitControlled(page);
      if (!(await page.eval(`import('./src/install.js').then((m) => m.state().mode)`)).startsWith('installed')) {
        throw new Error('the app does not consider itself installed');
      }
    });

    await ctx.step('with nothing new, it says so and stays', async () => {
      await mark(page);
      await tapUpdate(page);
      const none = await t(page, 'settings.updateNone');
      await page.waitFor(`[...document.querySelectorAll('.toast-msg')].some((e) => e.textContent.includes(${JSON.stringify(none)}))`,
        '"already the newest"', 25000);
      if (await reloaded(page)) throw new Error('it reloaded with nothing new');
      await page.tap('.sheet-scrim .sheet-head > .icon-btn:last-child');
      await waitNoSheet(page);
    });

    await ctx.step('a beta push (same version, new files) is found and loaded', async () => {
      const appJs = new URL(ctx.base).pathname + 'src/app.js';
      const original = fs.readFileSync(path.join(ctx.repo, 'src/app.js'), 'utf8');
      ctx.server.override(appJs, original + '\n// published after the device loaded the app\n');
      try {
        await mark(page);
        await tapUpdate(page);
        await page.waitFor(`!window.__beforeUpdate && document.querySelectorAll('.seat-card').length >= 2`,
          'the app to reload into the new files', 25000);
        const cached = await page.eval(`caches.keys().then(async (ks) => {
          const shell = ks.find((k) => /shell-/.test(k) && !/beta/.test(k));
          const res = await (await caches.open(shell)).match('./src/app.js', { ignoreSearch: true });
          return res ? res.text() : '';
        })`);
        if (!cached.includes('published after the device loaded the app')) throw new Error('the new file is not in the cache after updating');
      } finally {
        ctx.server.override(appJs, null);
      }
    });

    await ctx.step('a release that took over in the background is loaded, not denied', async () => {
      const next = nextRelease(ctx.repo);
      try {
        ctx.server.mount('/hit-easy/', next.dir);
        // The browser's own update check: the new worker installs, skips
        // waiting and claims this page - which keeps running the old code.
        await page.eval('navigator.serviceWorker.getRegistration().then((r) => r.update()).then(() => true)');
        // Waits on the registration alone, without messaging the worker.
        //
        // Chrome only activates a skip-waiting worker once the active one has
        // no event in flight. This used to ask the active worker its version
        // every ~60 ms, which on a slow CI machine kept it permanently busy:
        // the new worker sat in "waiting" until the timeout, so the test
        // blocked the very takeover it was waiting for. Proven by messaging it
        // every 5 ms - 3 of 3 runs failed with the CI's exact message. The
        // update() above already started the install, so "nothing installing
        // or waiting, an activated worker and a controller" means the new one
        // took over; its version is asked once, afterwards.
        await page.waitFor(`navigator.serviceWorker.getRegistration().then((r) => {
          const state = (w) => (w ? w.state : '-');
          window.__swShape = 'installing ' + state(r.installing) + ', waiting ' + state(r.waiting)
            + ', active ' + state(r.active) + (navigator.serviceWorker.controller ? '' : ', no controller');
          return !r.installing && !r.waiting && Boolean(r.active) && r.active.state === 'activated'
            && Boolean(navigator.serviceWorker.controller);
        })`, 'the new worker to take over in the background', 30000)
          .catch(async (err) => { throw new Error(err.message + ' - ' + await page.eval('window.__swShape')); });
        const inCharge = await page.eval(`new Promise((ok) => {
          const ch = new MessageChannel();
          ch.port1.onmessage = (e) => ok(e.data);
          navigator.serviceWorker.controller.postMessage({ type: 'VERSION' }, [ch.port2]);
          setTimeout(() => ok('no answer'), 10000);
        })`);
        if (inCharge !== NEXT) throw new Error('the worker in charge answers ' + inCharge + ', not ' + NEXT);
        const before = await runningVersion(page);
        if (before === NEXT) throw new Error('the page already ran the new code; the scenario did not happen');

        await mark(page);
        await tapUpdate(page);
        await page.waitFor(`!window.__beforeUpdate && document.querySelectorAll('.seat-card').length >= 2`,
          'the app to reload into the new release', 25000);
        await sleep(300);
        const after = await runningVersion(page);
        if (after !== NEXT) throw new Error('after updating the page runs ' + after + ', not ' + NEXT);
      } finally {
        ctx.server.mount('/hit-easy/', ctx.repo);
        next.cleanup();
      }
    });

    await ctx.step('with no connection, it says it could not check - not "already the newest"', async () => {
      ctx.server.offline(true);
      ctx.net.setOnline(false);
      try {
        await mark(page);
        await tapUpdate(page);
        const failed = await t(page, 'settings.updateFailed');
        await page.waitFor(`[...document.querySelectorAll('.toast-msg')].some((e) => e.textContent.includes(${JSON.stringify(failed)}))`,
          'the "no connection" message', 25000);
        if (await reloaded(page)) throw new Error('it reloaded with no connection');
      } finally {
        ctx.server.offline(false);
        ctx.net.setOnline(true);
      }
    });
  },
};
