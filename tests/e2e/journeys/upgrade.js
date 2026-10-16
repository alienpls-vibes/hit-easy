/**
 * Publishing a new version must not cost anyone their table or their history.
 *
 * The device starts on the release that is live today, with a match in
 * progress and one in the history - written by THAT release's own code, so the
 * data has exactly the shape real phones have. Then the deploy happens: the
 * same URL starts serving this tree. The service worker has to bring the new
 * code in by itself, within a few openings, and the new code has to read the
 * old data, continue the same match and finish it.
 *
 * Also checked: the old release's caches are gone afterwards. A cache that
 * survives an update is how a phone keeps serving yesterday's app.
 */

import fs from 'node:fs';
import path from 'node:path';
import { extractBaseline } from '../lib/baseline.js';
import { readDb, runningVersion, waitControlled, declareWinnerAndSave } from './app.js';

const SEED = `(async () => {
  const engine = await import('./src/engine.js');
  const store = await import('./src/store.js');
  const cmd = (id, name, colors) => ({
    oracleId: id, scryfallId: id, name, typeLine: 'Legendary Creature', colors,
    art: 'https://cards.scryfall.io/art_crop/front/a/b/' + id + '.jpg?1',
    thumb: 'https://cards.scryfall.io/art_crop/front/a/b/' + id + '.jpg?1',
  });
  const seats = () => [
    { id: 's0', name: 'Ana', commanders: [cmd('oracle-atraxa', "Atraxa, Praetors' Voice", ['W', 'U', 'B', 'G'])] },
    { id: 's1', name: 'Bruno', commanders: [cmd('oracle-krenko', 'Krenko, Mob Boss', ['R'])] },
    { id: 's2', name: 'Carla', commanders: [cmd('oracle-edgar', 'Edgar Markov', ['W', 'B', 'R'])] },
  ];

  const finished = engine.createMatch(seats(), 40);
  finished.id = 'upgrade-finished';
  engine.push(finished, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
  engine.push(finished, { type: 'win', targetId: 's0', reason: 'combate' });
  store.archive(finished);

  const live = engine.createMatch(seats(), 40);
  live.id = 'upgrade-live';
  engine.push(live, { type: 'life', targetId: 's0', delta: -5, sourceId: null });
  engine.push(live, { type: 'life', targetId: 's2', delta: -3, sourceId: 's1' });
  store.setCurrent(live);
  return true;
})()`;

export default {
  name: 'updating from the live release keeps the table and the history',
  async run(ctx) {
    const baseline = extractBaseline(ctx.repo);
    const current = fs.readFileSync(path.join(ctx.repo, 'src/version.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/)[1];
    try {
      ctx.server.mount('/hit-easy/', baseline.dir);
      const page = await ctx.open(ctx.PHONE);

      await ctx.step('the device is on the live release (' + baseline.ref + ')', async () => {
        await page.goto(ctx.base);
        await page.waitFor(`document.querySelector('#app').children.length > 0`, 'the old release to draw', 15000);
        await waitControlled(page);
        const v = await runningVersion(page);
        if (v !== baseline.version) throw new Error('expected ' + baseline.version + ', running ' + v);
      });

      await ctx.step('that release writes a finished match and one in progress', async () => {
        await page.eval(SEED);
        await page.reload();
        await page.waitFor(`document.querySelectorAll('.tile').length === 3`, 'the old release showing the table', 15000);
      });

      // What the old release logged is the old release's business - it is
      // already live and cannot be fixed from here. From now on every error
      // counts against the new version.
      page.errors.length = 0;

      await ctx.step('the new version is deployed and reaches the device by itself', async () => {
        ctx.server.mount('/hit-easy/', ctx.repo);
        // A person reopening the app: a short pause between openings, which
        // is when the new service worker installs. Measured: the new code
        // runs from the 3rd opening. Six is the ceiling before it is a bug.
        let v = null;
        let openings = 0;
        while (v !== current && openings < 6) {
          await page.reload();
          openings += 1;
          await page.waitFor(`document.querySelector('#app').children.length > 0`, 'the app to draw after reloading', 15000);
          await new Promise((r) => setTimeout(r, 1500));
          v = await runningVersion(page);
        }
        if (v !== current) throw new Error('after ' + openings + ' openings the device still runs ' + v + ', not ' + current);
        // The openings before the switch ran the OLD shell from the cache.
        page.errors.length = 0;
      });

      await ctx.step("the update announces what's new", async () => {
        await page.waitFor(`document.querySelector('.sheet-scrim.is-open .news-group-label')`,
          "the what's-new panel after updating", 10000);
        await page.tap('.sheet-scrim .sheet-head > .icon-btn:last-child');
        await page.waitFor(`!document.querySelector('.sheet-scrim')`, "the what's-new panel to close");
      });

      await ctx.step('the match in progress survived, with every point', async () => {
        await page.waitFor(`document.querySelectorAll('.tile').length === 3`, 'the same table on the new version', 15000);
        const lives = await page.eval(`[...document.querySelectorAll('.tile .tile-life')].map((e) => Number(e.textContent.trim()))`);
        const db = await readDb(page, ctx.base);
        if (!db.current || db.current.id !== 'upgrade-live') throw new Error('the match in progress is gone after the update');
        if (!lives.includes(35) || !lives.includes(37)) throw new Error('life totals changed in the update: ' + lives.join(', '));
        if (!(db.history || []).some((m) => m.id === 'upgrade-finished')) throw new Error('the history lost a match in the update');
      });

      await ctx.step("the old release's caches are gone", async () => {
        const names = await page.eval('caches.keys()');
        const stale = names.filter((n) => n.includes(baseline.version) && baseline.version !== current);
        if (stale.length) throw new Error('caches of the old release are still here: ' + stale.join(', '));
      });

      await ctx.step('the new version finishes the old match and saves it', async () => {
        await waitControlled(page);
        await declareWinnerAndSave(page, 0);
        const db = await readDb(page, ctx.base);
        if (db.current) throw new Error('the match is still in progress after saving');
        const ids = (db.history || []).map((m) => m.id);
        if (!ids.includes('upgrade-live') || !ids.includes('upgrade-finished')) {
          throw new Error('history after finishing: ' + ids.join(', '));
        }
      });
    } finally {
      baseline.cleanup();
    }
  },
};
