/**
 * Every screen opens, in every language, on a computer.
 *
 * A screen nobody opened in the release cycle is where a thrown error waits.
 * This walks them all on the desktop profile (landscape, mouse): the home
 * screen in each of the four languages - with no raw translation key or
 * unfilled {placeholder} on screen - every settings row, the what's-new
 * panel, the install guide, the statistics, and a full match with the mouse.
 */

import {
  openHome, waitHome, waitNoSheet, pickAllCommanders, startMatch, tapLife, declareWinnerAndSave, openStats, dbKey,
} from './app.js';

const LANGS = ['pt', 'en', 'es', 'de'];

// What an untranslated key looks like on screen: "setup.startMatch".
const RAW_KEY = /\b(setup|commander|player|pregame|table|stats|settings|install|account|win|victory|vote|mana|pass|handle|invites|data|paywall|common|brand|news|tl)\.[a-z][A-Za-z0-9]+\b/;

export default {
  name: 'every screen opens in every language, and a match plays with a mouse',
  async run(ctx) {
    const page = await ctx.open(ctx.DESKTOP);
    await ctx.step('open the app on a computer', () => openHome(page, ctx.base));

    for (const lang of LANGS) {
      await ctx.step('the home screen in ' + lang + ' has no raw keys', async () => {
        await page.eval(`(() => {
          const k = ${JSON.stringify(dbKey(ctx.base))};
          const db = JSON.parse(localStorage.getItem(k) || '{}');
          db.settings = { ...(db.settings || {}), lang: ${JSON.stringify(lang)} };
          localStorage.setItem(k, JSON.stringify(db));
          return true;
        })()`);
        await page.reload();
        await waitHome(page);
        const text = await page.eval('document.body.innerText');
        const raw = text.match(RAW_KEY);
        if (raw) throw new Error('raw key on the ' + lang + ' home screen: ' + raw[0]);
        if (/\{[a-z]+\}/.test(text)) throw new Error('unfilled placeholder on the ' + lang + ' home screen: ' + text.match(/\{[a-z]+\}/)[0]);
      });
    }

    await ctx.step('every settings row opens or toggles without an error', async () => {
      await page.tap('.head-actions > .icon-btn', { index: 0 });
      await page.waitFor(`document.querySelector('.sheet-scrim.is-open .set-row')`, 'the settings panel');
      // Theme: every option, back to "system".
      const segments = await page.count('.sheet-scrim .set-segment');
      for (let i = segments - 1; i >= 0; i -= 1) await page.tap('.sheet-scrim .set-segment', { index: i });
      // Toggles, twice each: on and off again.
      const toggles = await page.count('.sheet-scrim .set-row.is-toggle');
      for (let i = 0; i < toggles; i += 1) {
        await page.tap('.sheet-scrim .set-row.is-toggle', { index: i });
        await page.tap('.sheet-scrim .set-row.is-toggle', { index: i });
      }
    });

    await ctx.step("the what's-new panel opens from the settings", async () => {
      const whatsNew = await page.eval(`import('./src/i18n.js').then((m) => m.t('news.title'))`);
      await page.tap('.sheet-scrim .set-row', { text: whatsNew });
      await page.waitFor(`document.querySelector('.sheet-scrim .news-group-label')`, "the what's-new panel");
      await page.tap('.sheet-scrim .sheet-head > .icon-btn:last-child');
      await waitNoSheet(page);
    });

    await ctx.step('the install guide opens from the header', async () => {
      await page.tap('.head-actions .is-install');
      await page.waitFor(`document.querySelector('.sheet-scrim.is-open .install-steps')`, 'the install guide');
      await page.tap('.sheet-scrim .sheet-actions .btn.primary');
      await waitNoSheet(page);
    });

    await ctx.step('a match plays with the mouse, in landscape', async () => {
      await pickAllCommanders(page, ['atraxa', 'krenko', 'edgar', 'esika']);
      await startMatch(page);
      await tapLife(page, 2, '+');
      await page.waitFor(`document.querySelectorAll('.tile .tile-life')[2].textContent.trim() === '41'`, 'player 3 at 41');
      await declareWinnerAndSave(page, 2);
    });

    await ctx.step('the statistics open with the match in them', async () => {
      await openStats(page);
    });
  },
};
