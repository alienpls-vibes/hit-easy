/**
 * Every screen opens, in every language, on a computer.
 *
 * A screen nobody opened in the release cycle is where a thrown error waits.
 * This walks them all on the desktop profile (landscape, mouse): the home
 * screen in each of the four languages - with no raw translation key or
 * unfilled {placeholder} on screen - every settings row, the what's-new
 * panel in the app's language, the install guide, the statistics, a full
 * match with the mouse, and the privacy policy in each language.
 */

import {
  openHome, waitHome, waitNoSheet, pickAllCommanders, startMatch, tapLife, declareWinnerAndSave, openStats, dbKey,
  waitControlled,
} from './app.js';

const LANGS = ['pt', 'en', 'es', 'de'];

// What an untranslated key looks like on screen: "setup.startMatch".
const RAW_KEY = /\b(setup|commander|player|pregame|table|stats|settings|install|account|win|victory|vote|mana|pass|handle|invites|data|paywall|common|brand|news|tl|tour)\.[a-z][A-Za-z0-9]+\b/;

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
      // The notes follow the app language (the language loop above left it on
      // the last one): the newest title on screen is the one in that language.
      const titles = await page.eval(`Promise.all([import('./src/release-notes.js'), import('./src/i18n.js')])
        .then(([n, i]) => ({ want: n.RELEASE_NOTES[0].title[i.currentLang()], shown: [...document.querySelectorAll('.sheet-scrim .news-title')].map((e) => e.textContent) }))`);
      if (!titles.want || !titles.shown.includes(titles.want)) {
        throw new Error("what's new is not in the app language: wanted " + titles.want + ', saw ' + JSON.stringify(titles.shown));
      }
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

    const shown = () => page.eval(`({
      visible: [...document.querySelectorAll('article[data-lang]')].filter((a) => !a.hidden).map((a) => a.dataset.lang),
      lang: document.documentElement.lang,
    })`);

    await ctx.step('the privacy policy opens in each language, and in the app language by default', async () => {
      for (const lang of LANGS) {
        await page.goto(ctx.base + 'privacidade.html?lang=' + lang);
        const s = await shown();
        if (s.visible.length !== 1 || s.visible[0] !== lang || !s.lang.startsWith(lang)) {
          throw new Error('privacy policy for ' + lang + ' showed ' + JSON.stringify(s));
        }
      }
      // With no ?lang=, the language saved in the app (the loop left 'de').
      await page.goto(ctx.base + 'privacidade.html');
      const saved = await shown();
      if (saved.visible.join() !== 'de') throw new Error('without ?lang= the policy ignored the app language: ' + JSON.stringify(saved));
    });

    await ctx.step('a stale copy in the app cache is not what a returning user reads', async () => {
      // What a device that had the previous release kept: an old policy in the
      // shell cache. It used to be served first, and ?lang= did nothing.
      await page.goto(ctx.base);
      await waitControlled(page);
      await page.eval(`caches.keys().then(async (keys) => {
        const shell = keys.find((k) => k.includes('-shell-'));
        const cache = await caches.open(shell);
        // Only the old copy: earlier steps left fresh ones under ?lang= keys,
        // and any of them would answer for it.
        for (const req of await cache.keys()) {
          if (req.url.includes('privacidade.html')) await cache.delete(req);
        }
        await cache.put(new URL('privacidade.html', location.href).href,
          new Response('<!doctype html><title>old</title><p>OLD COPY</p>', { headers: { 'Content-Type': 'text/html' } }));
        return shell;
      })`);
      await page.goto(ctx.base + 'privacidade.html?lang=en');
      const s = await shown();
      if (s.visible.join() !== 'en') throw new Error('the cached old policy was served: ' + JSON.stringify(s));
    });
  },
};
