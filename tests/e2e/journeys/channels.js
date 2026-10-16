/**
 * Beta and production share one origin and must never share data.
 *
 * Both live on alienpls-vibes.github.io, so localStorage and Cache Storage are
 * one pool. src/channel.js keeps them apart by key suffix and cache prefix; a
 * mistake there would put test matches into real statistics, or have one
 * channel's service worker delete the other's cache.
 */

import { openHome, pickAllCommanders, startMatch, waitControlled } from './app.js';

export default {
  name: 'beta and production on the same site keep their data apart',
  async run(ctx) {
    const beta = ctx.base + 'beta/';
    const tester = await ctx.open(ctx.PHONE);

    await ctx.step('a match starts on the beta channel', async () => {
      await openHome(tester, beta);
      await waitControlled(tester);
      await pickAllCommanders(tester, ['atraxa', 'krenko', 'edgar', 'kenrith']);
      await startMatch(tester);
    });

    await ctx.step('the beta match is stored under the beta key only', async () => {
      const keys = await tester.eval('Object.keys(localStorage)');
      if (!keys.includes('mtglc.db.v1.beta')) throw new Error('beta did not use its own key: ' + keys.join(', '));
      const prod = await tester.eval(`JSON.parse(localStorage.getItem('mtglc.db.v1') || 'null')`);
      if (prod && prod.current) throw new Error('the beta match leaked into production storage');
    });

    const user = await ctx.open(ctx.PHONE);
    await ctx.step('production on the same device opens on its own home screen', async () => {
      await openHome(user, ctx.base);
      await waitControlled(user);
      if (await user.count('.tile')) throw new Error('production opened the beta table');
    });

    await ctx.step('each channel has its own caches, and neither deleted the other', async () => {
      const names = await user.eval('caches.keys()');
      const betaShell = names.filter((n) => n.startsWith('hiteasy-beta-shell-'));
      const prodShell = names.filter((n) => /^hiteasy-shell-/.test(n));
      if (!betaShell.length || !prodShell.length) throw new Error('caches: ' + names.join(', '));
    });

    await ctx.step('the beta table is still there after production ran', async () => {
      await tester.reload();
      await tester.waitFor(`document.querySelectorAll('.tile').length === 4`, 'the beta table after production ran', 15000);
    });
  },
};
