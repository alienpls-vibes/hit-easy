/**
 * The daily color challenge, from the home screen and back.
 *
 * On a phone: the home button carries a dot, the card shows with its name
 * and colored mana hidden, a miss says how many picked colors hit (no hint),
 * the right colors win and
 * reveal the card, the result is stored apart from the matches, the back
 * gesture closes the challenge without leaving the app, the card language
 * switch fetches the translated print (and falls back to English when there
 * is none) - and after all of it a match still starts at 40. That last step
 * is the promise the feature makes: it never gets in the way of the table.
 */

import {
  openHome, waitHome, readDb, pickAllCommanders, startMatch, lifeOf, t,
} from './app.js';
import { sleep } from '../lib/page.js';
import { SEARCHES } from '../fixtures/commanders.js';
import { DAILY_COLORS, PRINTED_NAME } from '../fixtures/daily-card.js';

const BOARD = ['W', 'U', 'B', 'R', 'G', 'C'];
const dailyKey = (base) => (/\/beta\/$/.test(base) ? 'mtglc.daily.v1.beta' : 'mtglc.daily.v1');

/** Picks the card language in the challenge options, like the native picker does. */
function chooseCardLang(page, lang) {
  return page.eval(`(() => {
    const field = document.querySelector('.sheet-scrim.is-open .daily-card-lang select');
    field.value = ${JSON.stringify(lang)};
    field.dispatchEvent(new Event('change'));
    return true;
  })()`);
}

export default {
  name: 'the daily color challenge: hidden card, guesses, reveal, and the table still works',
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('open the app on a fresh device', () => openHome(page, ctx.base));

    const before = await ctx.step('the home screen offers the challenge, with a dot', async () => {
      await page.waitFor(`document.querySelector('.setup-head .daily-entry.has-news')`, 'the daily button with its dot');
      return readDb(page, ctx.base);
    });

    await ctx.step('tapping it shows the card without its name or colored mana', async () => {
      await page.tap('.daily-entry');
      await page.waitFor(`document.querySelector('.daily-screen.is-open .daily-card')`, 'the daily card', 10000);
      const name = await page.eval(`import('./src/daily/schedule.js').then((m) => m.challengeFor(m.dayKey()).name)`);
      const text = await page.text('.daily-card');
      if (text.toLowerCase().includes(name.toLowerCase())) throw new Error('the card name is on screen: ' + text);
      if (await page.count('.daily-card .daily-sym.is-hidden') < 1) throw new Error('the {G} in the cost was not hidden');
      if (await page.count('.daily-card .daily-redacted') < 2) throw new Error('the name was not replaced in the text');
    });

    await ctx.step('the home screen stays underneath, on its route', async () => {
      const route = await page.eval('document.body.dataset.route');
      if (route !== 'setup') throw new Error('the route changed to ' + route);
      if (await page.count('.seat-card') < 2) throw new Error('the home screen was taken down');
    });

    await ctx.step('a half-right guess says how many, never which, and gives no hint', async () => {
      // Red is wrong and green is right: the row must read "1 of 2" and
      // nothing on screen may tell the two apart.
      await page.tap('.daily-pick', { index: BOARD.indexOf('R') });
      await page.tap('.daily-pick', { index: BOARD.indexOf(DAILY_COLORS[0]) });
      await page.tap('.daily-board .btn.primary');
      await page.waitFor(`document.querySelector('.daily-guess-hits')`, 'the miss');
      if (await page.count('.daily-hint')) throw new Error('a hint is on screen');
      const hits = await page.text('.daily-guess-hits');
      if (!/^\D*1\D+2\D*$/.test(hits)) throw new Error('the miss should read 1 of 2, got: ' + hits);
      if (!(await page.count('.daily-guess.is-wrong .daily-guess-icon svg'))
        || !(await page.text('.daily-guess.is-wrong .daily-guess-verdict') || '').trim()) {
        throw new Error('the wrong guess has no icon or no "wrong" text');
      }
      const looks = await page.eval(`[...document.querySelectorAll('.daily-guess .daily-pip')]
        .map((p) => p.className + ' ' + getComputedStyle(p).opacity)`);
      if (looks.length !== 2 || new Set(looks).size !== 1) {
        throw new Error('the picked colors are drawn differently: ' + JSON.stringify(looks));
      }
    });

    await ctx.step('the right colors win and reveal the card', async () => {
      for (const c of DAILY_COLORS) await page.tap('.daily-pick', { index: BOARD.indexOf(c) });
      await page.tap('.daily-board .btn.primary');
      await page.waitFor(`document.querySelector('.daily-result.is-won .daily-reveal-img')`, 'the win and the revealed card');
    });

    await ctx.step('the result is stored apart, and the matches are untouched', async () => {
      const today = await page.eval(`import('./src/daily/day.js').then((m) => m.dayKey())`);
      const daily = await page.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(dailyKey(ctx.base))}))`);
      const rec = daily && daily.days && daily.days[today];
      if (!rec || !rec.done || !rec.won || rec.guesses.length !== 2) {
        throw new Error('the day was not stored as won in two tries: ' + JSON.stringify(rec));
      }
      const after = await readDb(page, ctx.base);
      if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('playing the challenge changed the app database');
    });

    await ctx.step('the back gesture closes the challenge and stays in the app', async () => {
      await page.eval('history.back()');
      await page.waitFor(`!document.querySelector('.daily-screen')`, 'the challenge to close');
      await waitHome(page);
      if (await page.count('.daily-entry.has-news')) throw new Error('the dot is still there after playing');
    });

    await ctx.step('the gear opens the settings panel, and back closes only the panel', async () => {
      await page.tap('.daily-entry');
      await page.waitFor(`document.querySelector('.daily-screen.is-open .daily-result')`, 'the finished day on reopening');
      await page.tap('.daily-head .icon-btn', { index: 1 });
      await page.waitFor(`document.querySelector('.sheet-scrim.is-open .daily-app-lang select') && document.querySelector('.sheet-scrim.is-open .daily-card-lang select')`, 'the panel with both languages');
      await page.eval('history.back()');
      await page.waitFor(`!document.querySelector('.sheet-scrim')`, 'the panel to close');
      await sleep(300);
      if (!(await page.count('.daily-screen.is-open'))) throw new Error('back closed the challenge along with the panel');
    });

    await ctx.step('the app language in the panel switches the challenge and the home screen', async () => {
      await page.tap('.daily-head .icon-btn', { index: 1 });
      await page.waitFor(`document.querySelector('.sheet-scrim.is-open .daily-app-lang select')`, 'the panel');
      const before = await page.text('.daily-title');
      const other = (await page.eval('document.documentElement.lang')) === 'de' ? 'es' : 'de';
      await page.eval(`(() => {
        const field = document.querySelector('.sheet-scrim.is-open .daily-app-lang select');
        field.value = ${JSON.stringify(other)};
        field.dispatchEvent(new Event('change'));
        return true;
      })()`);
      await page.waitFor(`document.documentElement.lang === ${JSON.stringify(other)}`, 'the app language to switch');
      const title = await page.text('.daily-title');
      const expected = await page.eval(`import('./src/daily/i18n.js').then((m) => m.dt('daily.title'))`);
      if (title === before || title !== expected) throw new Error('the challenge title did not follow: ' + title);
      const gear = await page.eval(`document.querySelector('.head-actions > .icon-btn').getAttribute('aria-label')`);
      if (gear !== await t(page, 'common.settings')) throw new Error('the home screen underneath kept the old language');
      await page.waitFor(`document.querySelector('.sheet-scrim.is-open .daily-card-lang select')`, 'the panel back in the new language');
    });

    await ctx.step('the card language switch brings the translated print, or English', async () => {
      await chooseCardLang(page, 'pt');
      await page.waitFor(`(document.querySelector('.daily-reveal strong') || {}).textContent === ${JSON.stringify(PRINTED_NAME)}`, 'the Portuguese print');
      await chooseCardLang(page, 'de');
      await page.waitFor(`document.querySelector('.daily-note') && document.querySelector('.daily-reveal-img')`, 'the English fallback, announced');
      await page.tap('.sheet-scrim .sheet-head > .icon-btn:last-child'); // close the panel
      await page.waitFor(`!document.querySelector('.sheet-scrim')`, 'the panel to close');
    });

    await ctx.step('the arrow closes it too', async () => {
      await page.tap('.daily-head .icon-btn', { index: 0 });
      await page.waitFor(`!document.querySelector('.daily-screen')`, 'the challenge to close');
      await waitHome(page);
    });

    await ctx.step('a match still starts at 40 after playing', async () => {
      const seats = await pickAllCommanders(page, SEARCHES);
      await startMatch(page);
      for (let i = 0; i < seats; i += 1) {
        const life = await lifeOf(page, i);
        if (life !== 40) throw new Error('player ' + (i + 1) + ' starts at ' + life);
      }
    });
  },
};
