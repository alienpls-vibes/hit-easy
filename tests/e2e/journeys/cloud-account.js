/**
 * With an account, a match is never lost - the bank-grade promise.
 *
 * 1. Signed in, a saved match goes up to the cloud and leaves the device.
 * 2. A second device signing into the same account finds it.
 * 3. With the cloud down, a saved match stays on the device, and goes up by
 *    itself when the cloud is back - nothing in between may drop it.
 */

import {
  openHome, pickAllCommanders, startMatch, declareWinnerAndSave, readDb, openStats,
} from './app.js';
import { sleep } from '../lib/page.js';

const ANA = { email: 'ana@example.com', password: 'segredo-forte-123', handle: 'ana', name: 'Ana', subscribed: true };

async function signIn(page, { email, password }) {
  await page.tap('.head-actions > .icon-btn', { index: 0 }); // settings
  await page.tap('.sheet-scrim .set-account');
  await page.type('.sheet-scrim .account-login input[type="email"]', email);
  await page.type('.sheet-scrim .account-login input[type="password"]', password);
  await page.tap('.sheet-scrim .account-login .btn.primary');
  await page.waitFor(`Boolean(localStorage.getItem('mtglc.session.v1'))`, 'a session after signing in', 10000);
  await page.tap('.sheet-scrim .sheet-head > .icon-btn:last-child'); // close
  await page.waitFor(`!document.querySelector('.sheet-scrim')`, 'the settings panel to close');
}

async function playAndSave(page, terms) {
  await pickAllCommanders(page, terms);
  await startMatch(page);
  await declareWinnerAndSave(page, 0);
}

async function until(check, what, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error('timed out waiting for ' + what);
}

export default {
  name: 'with an account, a match reaches the cloud and is never lost',
  cloud: { users: [ANA] },
  async run(ctx) {
    const phone = await ctx.open(ctx.PHONE);

    await ctx.step('sign in on the phone', async () => {
      await openHome(phone, ctx.base);
      await signIn(phone, ANA);
    });

    await ctx.step('play and save a match', () => playAndSave(phone, ['atraxa', 'krenko']));

    await ctx.step('the match reaches the cloud and leaves the device', async () => {
      await until(() => ctx.cloud.matchIds().length === 1, 'the match in the cloud');
      await phone.waitFor(
        `(JSON.parse(localStorage.getItem('mtglc.db.v1')).history || []).length === 0`,
        'the uploaded match to leave the device',
      );
      const row = [...ctx.cloud.db.matches.values()][0];
      if (row.canal !== 'producao') throw new Error('production uploaded the match to channel ' + row.canal);
    });

    await ctx.step('the statistics show the match from the cloud', async () => {
      await openStats(phone);
      await phone.waitFor(`document.querySelector('.stats') && document.querySelector('.stats').textContent.includes('Atraxa')`,
        'the winning deck in the statistics', 10000);
    });

    await ctx.step('a second device signs in and finds the match', async () => {
      const tablet = await ctx.newDevice(ctx.DESKTOP);
      await openHome(tablet, ctx.base);
      await signIn(tablet, ANA);
      await openStats(tablet);
      await tablet.waitFor(`document.querySelector('.stats') && document.querySelector('.stats').textContent.includes('Atraxa')`,
        'the match on the second device', 15000);
    });

    await ctx.step('with the cloud down, a saved match stays on the device', async () => {
      ctx.cloud.down(true);
      await openHome(phone, ctx.base);
      await playAndSave(phone, ['edgar', 'kenrith']);
      await sleep(1500); // the upload attempt runs and fails
      const db = await readDb(phone, ctx.base);
      if ((db.history || []).length !== 1) {
        throw new Error('the match saved while the cloud was down is not on the device (history: '
          + (db.history || []).length + ')');
      }
      if (ctx.cloud.matchIds().length !== 1) throw new Error('the cloud changed while it was down');
    });

    await ctx.step('when the cloud is back, it goes up by itself', async () => {
      ctx.cloud.down(false);
      await phone.reload(); // opening the app again is what triggers a sync
      await until(() => ctx.cloud.matchIds().length === 2, 'the second match in the cloud', 15000);
      await phone.waitFor(
        `(JSON.parse(localStorage.getItem('mtglc.db.v1')).history || []).length === 0`,
        'the device to let go of the uploaded match',
      );
    });
  },
};
