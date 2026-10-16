/**
 * A phone that has been updating since the early versions still opens.
 *
 * The device database is written before the app loads (see
 * fixtures/legacy-db.js): old field names, an old seat order, a junk record,
 * and a match in progress from that era. The app must open that match on
 * today's table, keep playing it, heal the junk, keep the history, and show
 * the notes of everything that changed since the version it last saw.
 */

import { LEGACY_DB } from '../fixtures/legacy-db.js';
import { dbKey, readDb, declareWinnerAndSave, openStats, tapLife } from './app.js';

export default {
  name: 'data left by older versions opens, plays and is kept',
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('the device holds an old database', async () => {
      // An empty page on the app's origin, so the storage is the app's.
      await page.goto(ctx.base + 'manifest.webmanifest');
      await page.eval(`localStorage.setItem(${JSON.stringify(dbKey(ctx.base))}, ${JSON.stringify(JSON.stringify(LEGACY_DB))}); true`);
    });

    await ctx.step('the app opens straight into the old match in progress', async () => {
      await page.goto(ctx.base);
      await page.waitFor(`document.querySelectorAll('.tile').length === 3`, 'the old match on the table', 15000);
      const lives = await page.eval(`[...document.querySelectorAll('.tile .tile-life')].map((e) => Number(e.textContent.trim())).sort((a, b) => a - b)`);
      if (lives.join(',') !== '33,40,40') throw new Error('the old match shows lives ' + lives.join(', ') + ', expected 33, 40, 40');
    });

    await ctx.step("it shows what's new since 1.5.0, and closing it reaches the table", async () => {
      await page.waitFor(`document.querySelector('.sheet-scrim.is-open .news-group-label')`, "the what's-new panel", 10000);
      await page.tap('.sheet-scrim .sheet-head > .icon-btn:last-child');
      await page.waitFor(`!document.querySelector('.sheet-scrim')`, "the what's-new panel to close");
    });

    await ctx.step('the junk record is healed, the rest is kept', async () => {
      const db = await readDb(page, ctx.base);
      const ids = (db.history || []).map((m) => m.id);
      if (ids.includes('match-broken')) throw new Error('the record with no seats is still in the history');
      if (!ids.includes('match-old-1')) throw new Error('the old finished match was lost');
      if (!db.current || db.current.id !== 'match-old-live') throw new Error('the old match in progress was lost');
    });

    await ctx.step('the old match keeps playing and can be finished', async () => {
      await tapLife(page, 0, '-');
      await page.waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(dbKey(ctx.base))})).current.events.length === 2`,
        'the new tap to be stored on the old match', 5000);
      await declareWinnerAndSave(page, 1);
      const db = await readDb(page, ctx.base);
      const ids = (db.history || []).map((m) => m.id);
      if (!ids.includes('match-old-live') || !ids.includes('match-old-1')) throw new Error('history after finishing: ' + ids.join(', '));
    });

    await ctx.step('the statistics open over the old history', () => openStats(page));
  },
};
