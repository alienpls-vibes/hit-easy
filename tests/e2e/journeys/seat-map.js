/**
 * Filling a seat and fixing where everyone sits, on a touch phone - and the
 * drag with a mouse, on a board drawn as the device the app detected.
 *
 * The empty + box asks who plays and then their deck - the same path as the
 * name. Start opens the table drawn with the players in their chairs; a
 * player dragged onto another chair trades places with them, and so do two
 * taps. The match has to start in the order the drawing ended with, because
 * that order is the turn order.
 */

import {
  openHome, waitNoSheet, pickCommander, openSeatMap, continueToTable, readDb, t,
} from './app.js';

/** The names on the drawing, in turn order. */
const namesOnMap = (page) => page.eval(`[...document.querySelectorAll('.sheet-scrim .seat-map-cell .seat-map-name')].map((e) => e.textContent)`);

/** The centre of a chair on the drawing. */
const chairAt = (page, i) => page.eval(`(() => {
  const r = document.querySelectorAll('.sheet-scrim .seat-map-cell')[${i}].getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

export default {
  name: 'the + box asks who plays, and players are dragged to their seats',
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('open the app on a fresh device', () => openHome(page, ctx.base));

    await ctx.step('the + box asks who plays first, then the commander', async () => {
      await page.tap('.seat-card .seat-art.is-empty', { index: 0 });
      const whoPlays = await t(page, 'player.whoPlays');
      await page.waitFor(`(document.querySelector('.sheet-scrim.is-open .sheet-title') || {}).textContent === ${JSON.stringify(whoPlays)}`, 'the player step');
      await page.type('.sheet-scrim .flow-pane:last-child .search-input', 'Ana');
      await page.tap('.sheet-scrim .flow-pane:last-child .name-row .btn.primary');
      await page.waitFor(`document.querySelectorAll('.sheet-scrim .flow-pane').length === 2 && document.querySelector('.sheet-scrim .flow-pane:last-child .search-input')`, 'the commander step after the player');
      await page.type('.sheet-scrim .flow-pane:last-child .search-input', 'atraxa');
      await page.waitFor(`document.querySelectorAll('.sheet-scrim .flow-pane:last-child .result-row').length > 0`, 'search results');
      await page.tap('.sheet-scrim .flow-pane:last-child .result-row', { index: 0 });
      await waitNoSheet(page);
      const seat = await page.eval(`({
        name: document.querySelectorAll('.seat-card .seat-name-text')[0].textContent,
        empty: document.querySelectorAll('.seat-card .seat-art')[0].classList.contains('is-empty'),
      })`);
      if (seat.name !== 'Ana' || seat.empty) throw new Error('the first seat ended as ' + JSON.stringify(seat));
    });

    const terms = ['krenko', 'edgar', 'kenrith'];
    for (let i = 1; i < 4; i += 1) {
      await ctx.step('a commander for seat ' + (i + 1), () => pickCommander(page, i, { term: terms[i - 1] }));
    }

    let names = null;
    await ctx.step('Start shows the table with every player in their chair', async () => {
      await openSeatMap(page);
      names = await namesOnMap(page);
      const listed = await page.eval(`[...document.querySelectorAll('.seat-card .seat-name-text')].map((e) => e.textContent)`);
      if (names.join() !== listed.join()) throw new Error('the drawing ' + JSON.stringify(names) + ' differs from the list ' + JSON.stringify(listed));
    });

    await ctx.step('dragging the first player onto the third swaps the two', async () => {
      await page.swipe(await chairAt(page, 0), await chairAt(page, 2), { steps: 12, ms: 300 });
      const want = [names[2], names[1], names[0], names[3]];
      await page.waitFor(`[...document.querySelectorAll('.sheet-scrim .seat-map-cell .seat-map-name')].map((e) => e.textContent).join() === ${JSON.stringify(want.join())}`, 'the drag to swap players 1 and 3');
      names = want;
      if (await page.count('.sheet-scrim .seat-map-cell.is-picked')) throw new Error('the drag left a player picked up, as if it were a tap');
      await new Promise((r) => setTimeout(r, 400)); // see the tour journey: a tap right after a swipe gets no click
    });

    await ctx.step('tapping two players swaps them too', async () => {
      await page.tap('.sheet-scrim .seat-map-cell', { index: 1 });
      await page.waitFor(`document.querySelectorAll('.sheet-scrim .seat-map-cell')[1].classList.contains('is-picked')`, 'the first tap to pick the player');
      await page.tap('.sheet-scrim .seat-map-cell', { index: 3 });
      const want = [names[0], names[3], names[2], names[1]];
      await page.waitFor(`[...document.querySelectorAll('.sheet-scrim .seat-map-cell .seat-map-name')].map((e) => e.textContent).join() === ${JSON.stringify(want.join())}`, 'the taps to swap players 2 and 4');
      names = want;
    });

    await ctx.step('the match starts in the order the drawing ended with', async () => {
      await continueToTable(page, 4);
      const db = await readDb(page, ctx.base);
      const order = db.current.seats.map((s) => s.name);
      if (order.join() !== names.join()) throw new Error('the match seats ' + JSON.stringify(order) + ', the drawing said ' + JSON.stringify(names));
    });

    const desk = await ctx.newDevice(ctx.DESKTOP);
    await ctx.step('with a mouse, the board is drawn as the device the app sees, and a drag swaps', async () => {
      await openHome(desk, ctx.base);
      for (let i = 0; i < 4; i += 1) await pickCommander(desk, i, { term: ['atraxa', 'krenko', 'edgar', 'kenrith'][i] });
      await openSeatMap(desk);
      // Which device it is depends on what the browser reports: headless
      // Chrome on Windows says it has a mouse, on the Linux CI it says none
      // (so the app draws a phone there, rightly). The kinds themselves are
      // unit cases; here the board must follow whatever the app detected.
      const kind = await desk.eval(`import('./src/views/setup/seat-map.js').then((m) => m.deviceShape().kind)`);
      if (!(await desk.count('.sheet-scrim .seat-map.is-' + kind))) throw new Error('the board is not drawn as the detected ' + kind);
      const before = await namesOnMap(desk);
      await desk.swipe(await chairAt(desk, 1), await chairAt(desk, 3), { steps: 10, ms: 250 });
      const want = [before[0], before[3], before[2], before[1]];
      await desk.waitFor(`[...document.querySelectorAll('.sheet-scrim .seat-map-cell .seat-map-name')].map((e) => e.textContent).join() === ${JSON.stringify(want.join())}`, 'the mouse drag to swap players 2 and 4');
    });
  },
};
