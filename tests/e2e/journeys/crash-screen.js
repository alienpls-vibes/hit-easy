/**
 * When something breaks while opening, the person sees why - not a black screen.
 *
 * The crash screen in index.html is the safety net for every other defect, and
 * a safety net is only tested on the day it is needed. From 1.9.0 to 1.10.1 it
 * was itself a SyntaxError and nobody knew. Here the app's entry module is
 * replaced by one that throws, on a device that never opened the app, and the
 * screen must say what broke and offer the two ways out.
 */

export default {
  name: 'a module that throws shows the crash screen, not a black screen',
  // The thrown error IS the scenario.
  allowErrors: [/injected failure for the crash-screen journey/],
  async run(ctx) {
    const entry = new URL(ctx.base).pathname + 'src/app.js';
    ctx.server.override(entry, "throw new Error('injected failure for the crash-screen journey');\n");
    const page = await ctx.open(ctx.PHONE);

    await ctx.step('open the app with a broken entry module', () => page.goto(ctx.base));

    await ctx.step('the crash screen says what broke', async () => {
      await page.waitFor(`document.querySelector('.crash')`, 'the crash screen', 10000);
      const detail = await page.text('.crash .crash-detail');
      if (!detail.includes('injected failure')) throw new Error('the crash screen does not show the error: ' + JSON.stringify(detail));
    });

    await ctx.step('it offers reloading and clearing the cache', async () => {
      if (!(await page.count('#crash-reload')) || !(await page.count('#crash-reset'))) {
        throw new Error('the crash screen has no way out');
      }
      // Once the module is fixed, "clear cache and reload" brings the app back.
      ctx.server.override(entry, null);
      await page.tap('#crash-reset');
      await page.waitFor(`document.querySelectorAll('.seat-card').length >= 2`, 'the app after clearing the cache', 15000);
    });
  },
};
