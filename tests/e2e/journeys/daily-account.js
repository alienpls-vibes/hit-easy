/**
 * The daily progress follows the account (sql/014-daily-progress.sql).
 *
 * A phone lost its whole challenge history on the way to 1.12.0 while the
 * matches, kept in the cloud, came through. This walks the promise that fixes
 * it: signed in, a won day reaches the server; a device with nothing - a new
 * phone, or the same one after its data was cleared - signs in and finds the
 * day already played, with the stats counting it. No subscription: the
 * account here has none, and the challenge is free.
 */

import { openHome } from './app.js';
import { signIn } from './cloud-account.js';
import { sleep } from '../lib/page.js';
import { DAILY_COLORS } from '../fixtures/daily-card.js';

const BOARD = ['W', 'U', 'B', 'R', 'G', 'C'];
const BIA = { email: 'bia@example.com', password: 'outra-senha-forte-9', handle: 'bia', name: 'Bia', subscribed: false };

export default {
  name: 'the daily progress follows the account to a wiped device, free',
  cloud: { users: [BIA] },
  async run(ctx) {
    const phone = await ctx.open(ctx.PHONE);
    const channel = /\/beta\/$/.test(ctx.base) ? 'beta' : 'producao';
    const today = () => phone.eval(`import('./src/daily/day.js').then((m) => m.dayKey())`);

    await ctx.step('sign in on the phone, without a subscription', async () => {
      await openHome(phone, ctx.base);
      await signIn(phone, BIA);
    });

    await ctx.step('win the day', async () => {
      await phone.tap('.daily-entry');
      await phone.waitFor(`document.querySelector('.daily-screen.is-open .daily-board')`, 'the board', 10000);
      for (const c of DAILY_COLORS) await phone.tap('.daily-pick', { index: BOARD.indexOf(c) });
      await phone.tap('.daily-board .btn.primary');
      await phone.waitFor(`document.querySelector('.daily-result.is-won')`, 'the win');
    });

    await ctx.step('the won day reaches the account on the server', async () => {
      const key = await today();
      const deadline = Date.now() + 10000;
      let days = null;
      while (Date.now() < deadline) {
        days = ctx.cloud.dailyOf(BIA.email, channel);
        if (days && days[key] && days[key].won) break;
        await sleep(100);
      }
      if (!days || !days[key] || !days[key].done || !days[key].won) {
        throw new Error('the server copy does not have today as won: ' + JSON.stringify(days));
      }
    });

    await ctx.step('a device with nothing signs in and finds the day played', async () => {
      const fresh = await ctx.newDevice(ctx.PHONE);
      await openHome(fresh, ctx.base);
      if (!(await fresh.count('.daily-entry.has-news'))) throw new Error('a fresh device should start with today unplayed');
      await signIn(fresh, BIA);
      await fresh.waitFor(`!document.querySelector('.daily-entry.has-news')`, 'the dot to go once the day comes from the account', 10000);
      await fresh.tap('.daily-entry');
      await fresh.waitFor(`document.querySelector('.daily-screen.is-open .daily-result.is-won')`, 'the won day, not the board', 10000);
      const played = await fresh.text('.daily-stats .daily-stat:first-child .daily-stat-value');
      if (played !== '1') throw new Error('the stats count ' + played + ' days played on the new device');
    });
  },
};
