/**
 * The daily color challenge, lost.
 *
 * Three wrong guesses on a phone: the result says the answer, and the share
 * buttons are there and reachable exactly as after a win - a lost day is
 * shared too ("Will you guess it?").
 */

import { openHome } from './app.js';
import { DAILY_COLORS } from '../fixtures/daily-card.js';

const BOARD = ['W', 'U', 'B', 'R', 'G', 'C'];

export default {
  name: 'the daily color challenge lost: the answer, and the result can still be shared',
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('open the app on a fresh device', () => openHome(page, ctx.base));

    await ctx.step('open the challenge', async () => {
      await page.tap('.daily-entry');
      await page.waitFor(`document.querySelector('.daily-screen.is-open .daily-board')`, 'the board', 10000);
    });

    await ctx.step('three wrong guesses lose the day', async () => {
      const wrong = BOARD.filter((c) => c !== 'C' && !DAILY_COLORS.includes(c)).slice(0, 3);
      for (const c of wrong) {
        await page.tap('.daily-pick', { index: BOARD.indexOf(c) });
        await page.tap('.daily-board .btn.primary');
      }
      await page.waitFor(`document.querySelector('.daily-result.is-lost')`, 'the lost result');
    });

    await ctx.step('the share buttons are on the lost result, and can be scrolled to', async () => {
      const seen = await page.eval(`(() => {
        const btn = document.querySelector('.daily-result .daily-share-whatsapp');
        if (!btn) return 'missing';
        btn.scrollIntoView({ block: 'center' });
        const r = btn.getBoundingClientRect();
        const style = getComputedStyle(btn);
        if (style.display === 'none' || style.visibility === 'hidden' || r.width < 1 || r.height < 1) return 'hidden';
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top && btn.contains(top) ? 'ok' : 'covered by ' + (top ? top.className : 'nothing');
      })()`);
      if (seen !== 'ok') throw new Error('the WhatsApp button is ' + seen);
    });

    await ctx.step('sharing a lost day says X and asks instead of daring', async () => {
      await page.eval(`(() => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; return true; })()`);
      await page.tap('.daily-share-whatsapp');
      const opened = await page.eval('window.__opened');
      if (opened.length !== 1) throw new Error('WhatsApp was not opened: ' + JSON.stringify(opened));
      const text = decodeURIComponent(opened[0].slice('https://wa.me/?text='.length));
      if (!text.includes(' X/3')) throw new Error('the lost line is missing: ' + text);
      const dare = await page.eval(`import('./src/daily/i18n.js').then((m) => m.dt('daily.shareDareLost'))`);
      if (!text.includes(dare)) throw new Error('the lost day does not ask "will you guess it": ' + text);
    });
  },
};
