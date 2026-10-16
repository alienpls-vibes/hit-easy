/**
 * No signal at the table - which is most game stores.
 *
 * After one visit the app must open from the service worker alone, offer the
 * decks the players already used (the history is on the device while signed
 * out) and start a match, with the server unreachable and every external host
 * failing like a dead connection.
 */

import {
  openHome, waitHome, pickAllCommanders, pickCommander, startMatch, declareWinnerAndSave, waitControlled,
} from './app.js';

export default {
  name: 'with no signal, the app opens and a table plays from the history',
  async run(ctx) {
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('first visit online, one match played', async () => {
      await openHome(page, ctx.base);
      await waitControlled(page);
      await pickAllCommanders(page, ['atraxa', 'krenko', 'edgar', 'kenrith']);
      await startMatch(page);
      await declareWinnerAndSave(page, 0);
    });

    await ctx.step('the connection drops', async () => {
      ctx.server.offline(true);
      ctx.net.setOnline(false);
      await page.send('Network.enable');
      await page.send('Network.emulateNetworkConditions', {
        offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
      });
    });

    await ctx.step('reopening the app works offline', async () => {
      await page.reload();
      await waitHome(page);
    });

    await ctx.step('each seat picks its deck from the history, offline', async () => {
      const seats = await page.count('.seat-card');
      for (let i = 0; i < seats; i += 1) await pickCommander(page, i, { fromHistory: true });
    });

    await ctx.step('the match starts with no connection', () => startMatch(page));
  },
};
