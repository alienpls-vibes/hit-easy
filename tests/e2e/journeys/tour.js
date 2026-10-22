/**
 * The guided tour: it opens by itself on a device's first open, and only then;
 * it can be walked by swiping and by the buttons; and it opens again from the
 * settings and from the table menu - from the table, at the gestures.
 */

import {
  waitHome, waitNoSheet, readDb, pickAllCommanders, startMatch, openTableMenu, t,
} from './app.js';
import { SEARCHES } from '../fixtures/commanders.js';

const tourInfo = (page) => page.eval(`import('./src/views/tour.js').then((m) => ({ total: m.SLIDES.length, table: m.TABLE_START }))`);

async function waitSlide(page, n, total) {
  const want = await t(page, 'tour.step', { n, total });
  await page.waitFor(`(document.querySelector('.tour.is-open .tour-count') || {}).textContent === ${JSON.stringify(want)}`, 'slide ' + n + ' of the tour');
}

export default {
  name: 'the guided tour opens once by itself, and again from settings and the table',
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('a device that never opened the app gets the tour by itself', async () => {
      await page.goto(ctx.base);
      await waitHome(page);
      await page.waitFor(`document.querySelector('.tour.is-open')`, 'the tour to open by itself', 5000);
    });

    const { total, table } = await tourInfo(page);

    await ctx.step('it starts at the first slide, and a swipe turns the page', async () => {
      await waitSlide(page, 1, total);
      const box = await page.eval(`(() => {
        const r = document.querySelector('.tour-viewport').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
      })()`);
      await page.swipe({ x: box.x + box.w * 0.3, y: box.y }, { x: box.x - box.w * 0.3, y: box.y });
      await waitSlide(page, 2, total);
      // A person lifts the finger and then reaches for the button. Chrome
      // reads a touch that comes ~100 ms after a quick swipe as stopping that
      // swipe, and sends no click for it.
      await new Promise((r) => setTimeout(r, 600));
    });

    await ctx.step('next walks to the last slide, and finishing closes it', async () => {
      for (let n = 3; n <= total; n += 1) {
        await page.tap('.tour .tour-next');
        await waitSlide(page, n, total);
      }
      const done = await t(page, 'tour.done');
      await page.tap('.tour .tour-next', { text: done });
      await page.waitFor(`!document.querySelector('.tour')`, 'the tour to close');
      const db = await readDb(page, ctx.base);
      if (db.settings.tourDue) throw new Error('the tour is still due after finishing it');
    });

    await ctx.step('reopening the app does not show it again', async () => {
      await page.reload();
      await waitHome(page);
      await new Promise((r) => setTimeout(r, 900));
      if (await page.count('.tour')) throw new Error('the tour opened by itself a second time');
    });

    await ctx.step('the settings open it from the start, and back closes it', async () => {
      await page.tap('.head-actions > .icon-btn', { index: 0 });
      await page.waitFor(`document.querySelector('.sheet-scrim.is-open .set-row')`, 'the settings panel');
      await page.tap('.sheet-scrim .set-row', { text: await t(page, 'settings.tour') });
      await waitSlide(page, 1, total);
      await waitNoSheet(page);
      // The phone's back gesture.
      await page.eval('history.back(), true');
      await page.waitFor(`!document.querySelector('.tour')`, 'back to close the tour');
      await waitHome(page);
    });

    await ctx.step('the table menu opens it at the gestures, and the table is still there after', async () => {
      await pickAllCommanders(page, SEARCHES);
      await startMatch(page);
      await openTableMenu(page);
      await page.tap('.sheet-scrim .menu-item', { text: await t(page, 'tour.menu') });
      await waitSlide(page, table + 1, total);
      await page.tap('.tour .tour-skip');
      await page.waitFor(`!document.querySelector('.tour')`, 'the tour to close');
      await page.tap('.tile .tap-plus', { index: 0 });
      await page.waitFor(`document.querySelectorAll('.tile .tile-life')[0].textContent.trim() === '41'`, 'a tap on the table after the tour');
    });
  },
};
