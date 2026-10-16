/**
 * The journey the app exists for: a table sets up and plays a match.
 *
 * On a phone, with touch, from a device that never opened the app: pick a
 * commander for every seat by searching, Start, change a life total, survive
 * a reload in the middle of the game, declare a winner, save, and find the
 * match in the statistics. If this journey is red, nobody can play.
 */

import {
  openHome, pickAllCommanders, startMatch, lifeOf, tapLife, declareWinnerAndSave,
  readDb, openStats, waitControlled,
} from './app.js';
import { SEARCHES } from '../fixtures/commanders.js';

export default {
  name: 'a first match on a phone, from setup to statistics',
  live: true,
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('open the app on a fresh device', () => openHome(page, ctx.base));

    await ctx.step('Start is disabled until every seat has a commander', async () => {
      const disabled = await page.eval(`document.querySelector('.setup .btn.primary.block').disabled`);
      if (!disabled) throw new Error('Start was enabled with no commander chosen');
    });

    const seats = await ctx.step('choose a commander for every seat by searching', () => pickAllCommanders(page, SEARCHES));

    await ctx.step('Start, then Start on the pre-game panel, opens the table', () => startMatch(page));

    await ctx.step('the match is stored as the match in progress', async () => {
      const db = await readDb(page, ctx.base);
      if (!db || !db.current || db.current.seats.length !== seats) {
        throw new Error('no match in progress on the device after Start');
      }
    });

    await ctx.step('every player starts at 40', async () => {
      for (let i = 0; i < seats; i += 1) {
        const life = await lifeOf(page, i);
        if (life !== 40) throw new Error('player ' + (i + 1) + ' starts at ' + life);
      }
    });

    await ctx.step('tapping + and - changes a life total', async () => {
      await tapLife(page, 0, '+');
      await page.waitFor(`document.querySelectorAll('.tile .tile-life')[0].textContent.trim() === '41'`, 'player 1 at 41');
      await tapLife(page, 1, '-');
      await tapLife(page, 1, '-');
      await page.waitFor(`document.querySelectorAll('.tile .tile-life')[1].textContent.trim() === '38'`, 'player 2 at 38');
    });

    await ctx.step('locking the phone right after a tap keeps the tap', async () => {
      // A tap waits 900 ms to become an event. Hiding the page inside that
      // window used to leave it only in memory, where a discarded tab loses it.
      const lifeEvents = async () => (await readDb(page, ctx.base)).current.events.filter((e) => e.type === 'life').length;
      await new Promise((r) => setTimeout(r, 1200)); // the earlier taps settle into events
      const before = await lifeEvents();
      await tapLife(page, 2, '-');
      await page.eval(`(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        return true;
      })()`);
      const stored = await lifeEvents();
      await page.eval(`(() => {
        delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
        return true;
      })()`);
      if (stored !== before + 1) {
        throw new Error('hiding the page did not store the tap at once (life events: ' + before + ' -> ' + stored + ')');
      }
      await page.waitFor(`document.querySelectorAll('.tile .tile-life')[2].textContent.trim() === '39'`, 'player 3 at 39');
    });

    await ctx.step('a reload in the middle of the game comes back to the same table', async () => {
      await waitControlled(page);
      await page.reload();
      await page.waitFor(`document.querySelectorAll('.tile').length === ${seats}`, 'the table after reloading', 15000);
      await page.waitFor(`document.querySelectorAll('.tile .tile-life')[0].textContent.trim() === '41'`, 'player 1 still at 41');
      await page.waitFor(`document.querySelectorAll('.tile .tile-life')[1].textContent.trim() === '38'`, 'player 2 still at 38');
    });

    await ctx.step('declare a winner and save the match', () => declareWinnerAndSave(page, 0));

    await ctx.step('the saved match is in the history and nothing is left in progress', async () => {
      const db = await readDb(page, ctx.base);
      if (db.current) throw new Error('a match is still in progress after saving');
      if (!db.history || db.history.length !== 1) throw new Error('history has ' + (db.history || []).length + ' matches, expected 1');
      if (!db.history[0].events.some((e) => e.type === 'win')) throw new Error('the saved match has no winner');
    });

    await ctx.step('the statistics screen opens', () => openStats(page));
  },
};
