/**
 * Service worker: the app has to open without internet, because a Commander
 * table happens anywhere.
 *
 * Strategy:
 *  - the app itself (HTML/CSS/JS) comes from the cache first, updated in the
 *    background - instant opening, new version next time;
 *  - Scryfall art goes to a separate cache, served from disk when already
 *    known;
 *  - calls to the Scryfall API are never cached here (the app already keeps
 *    its own search cache in localStorage).
 */

// The same string as APP_VERSION in src/version.js - a worker does not import
// modules. If it changes there, change it here; check-syntax.js compares both.
const VERSION = '1.9.0';

/**
 * Production and beta share the same origin, and Cache Storage is per origin.
 * The channel comes from this very file's path: /hit-easy/sw.js versus
 * /hit-easy/beta/sw.js. Without this the two channels would fight over the
 * same names.
 *
 * Production keeps the short prefix it always had; only beta gets a mark.
 * 'producao' is the stored channel name (see src/channel.js): do not translate.
 */
const CHANNEL = /(^|\/)beta(\/|$)/.test(self.location.pathname) ? 'beta' : 'producao';
const PREFIX = CHANNEL === 'beta' ? 'hiteasy-beta-' : 'hiteasy-';
const SHELL = PREFIX + 'shell-' + VERSION;
const ART = PREFIX + 'art-' + VERSION;

/**
 * Whose cache this is. The same rule as channelOfCache() in src/channel.js -
 * the worker does not import modules, so it lives in both places. If it
 * changes there, change it here.
 */
function channelOfCache(name) {
  const n = String(name || '');
  if (n.startsWith('hiteasy-beta-')) return 'beta';
  if (n.startsWith('hiteasy-')) return 'producao';
  return null;
}

/**
 * What goes into the cache before the internet runs out.
 *
 * An explicit list because the worker needs to know what to download BEFORE
 * going offline - it cannot discover module by module on the spot. There are
 * 60+ files, and a missing entry gives no error: the app just does not open
 * without internet, and that is found out at the table.
 *
 * `npm test` checks that every .js and .css in src/ is here.
 */
const ASSETS = [
  './',
  './index.html',
  './privacidade.html',
  './manifest.webmanifest',
  './src/app.js',
  './src/channel.js',
  './src/cloud.js',
  './src/cloud/subscription.js',
  './src/cloud/auth.js',
  './src/cloud/invites.js',
  './src/cloud/account.js',
  './src/cloud/http.js',
  './src/cloud/boot.js',
  './src/cloud/table-by-code.js',
  './src/cloud/matches.js',
  './src/cloud/profile.js',
  './src/cloud/rules.js',
  './src/colors.js',
  './src/config.js',
  './src/engine.js',
  './src/styles/base.css',
  './src/styles/settings.css',
  './src/styles/account.css',
  './src/styles/damage.css',
  './src/styles/error.css',
  './src/styles/home.css',
  './src/styles/mana.css',
  './src/styles/table.css',
  './src/styles/win-reasons.css',
  './src/styles/core.css',
  './src/styles/hide-rivalries.css',
  './src/styles/panel.css',
  './src/styles/stats-votes.css',
  './src/styles/stats.css',
  './src/styles/screen.css',
  './src/styles/wide-screens.css',
  './src/styles/tokens.css',
  './src/styles/victory-short-screens.css',
  './src/styles/victory.css',
  './src/styles/vote.css',
  './src/i18n.js',
  './src/i18n/de.js',
  './src/i18n/dictionaries.js',
  './src/i18n/en.js',
  './src/i18n/es.js',
  './src/i18n/ordinal.js',
  './src/i18n/pt.js',
  './src/i18n/translate.js',
  './src/install.js',
  './src/release-notes.js',
  './src/orientation.js',
  './src/scryfall.js',
  './src/seating.js',
  './src/stats.js',
  './src/stats/aggregate.js',
  './src/stats/colors.js',
  './src/stats/format.js',
  './src/stats/sort.js',
  './src/stats/match.js',
  './src/stats/rivalries.js',
  './src/stats/votes.js',
  './src/store.js',
  './src/styles.css',
  './src/sync.js',
  './src/theme.js',
  './src/ui.js',
  './src/version.js',
  './src/views/setup.js',
  './src/views/setup/pre-game.js',
  './src/views/setup/seat-card.js',
  './src/views/setup/settings.js',
  './src/views/setup/account.js',
  './src/views/setup/invites.js',
  './src/views/setup/pick-deck.js',
  './src/views/setup/pick-player.js',
  './src/views/setup/handle.js',
  './src/views/setup/home.js',
  './src/views/setup/install.js',
  './src/views/setup/rows.js',
  './src/views/setup/release-notes.js',
  './src/views/setup/pass-table.js',
  './src/views/setup/draft.js',
  './src/views/setup/sync.js',
  './src/views/stats.js',
  './src/views/stats/backup.js',
  './src/views/stats/deck.js',
  './src/views/stats/player.js',
  './src/views/stats/link-account.js',
  './src/views/stats/match.js',
  './src/views/stats/paywall.js',
  './src/views/stats/widgets.js',
  './src/views/stats/rivalries.js',
  './src/views/stats/screen.js',
  './src/views/stats/win-reasons.js',
  './src/views/stats/votes.js',
  './src/views/table.js',
  './src/views/table/sweep.js',
  './src/views/table/constants.js',
  './src/views/table/context.js',
  './src/views/table/damage.js',
  './src/views/table/state.js',
  './src/views/table/gestures.js',
  './src/views/table/hub.js',
  './src/views/table/player.js',
  './src/views/table/mana.js',
  './src/views/table/menu.js',
  './src/views/table/table.js',
  './src/views/table/widgets.js',
  './src/views/table/paint.js',
  './src/views/table/victory.js',
  './src/views/table/vote.js',
  './src/vote.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/**
 * A request that does NOT accept an answer from the browser cache.
 *
 * `cache.add(url)` does a regular fetch, and a regular fetch goes through the
 * HTTP cache. GitHub Pages sends `max-age=600` on everything, so a new worker
 * installed and filled the new cache with the OLD files the browser still
 * kept: new worker version, old content. The app "updated" and stayed exactly
 * the same - for up to ten minutes, with no visible explanation.
 *
 * `cache: 'reload'` forces going to the network.
 */
function fromNetwork(url) {
  return new Request(url, { cache: 'reload' });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll fails entirely if one item is missing; item by item is more tolerant.
      .then((cache) => Promise.allSettled(ASSETS.map((url) => cache.add(fromNetwork(url)))))
      .then(() => self.skipWaiting()),
  );
});

/**
 * Unsticking a worker stopped in "waiting".
 *
 * install already calls skipWaiting, so normally nobody is waiting. But if an
 * earlier update got stuck - the tab stayed open during the swap, for example
 * - the update button sends this message and the new worker takes over
 * instead of waiting for every tab to close.
 */
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  // Diagnostics: the screen shows the MODULE version, which comes from the
  // cache. If the worker answers another one, it is a sign of a stale cache
  // serving old code - exactly what happened and could not be seen from
  // outside.
  if (event.data.type === 'VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage(VERSION);
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        // Only our own channel, and only what went stale. A loose
        // `k !== SHELL` used to leave from here, deleting EVERYTHING -
        // including the other channel's offline cache and that of any other
        // page on this origin.
        keys
          .filter((k) => channelOfCache(k) === CHANNEL && k !== SHELL && k !== ART)
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Card search: always network. The app handles the failure and falls back
  // to the saved decks.
  if (url.hostname === 'api.scryfall.com') return;

  // Card art: cache-first, it is immutable.
  if (url.hostname.endsWith('scryfall.io')) {
    event.respondWith(
      caches.open(ART).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => Response.error()),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // The build stamp: always network, never cache.
  //
  // It exists precisely to say WHICH code is on the device, and serving it
  // from the cache would answer with the previous build - the only answer
  // that is useless. `ignoreSearch` below would also block busting it with ?v=.
  if (url.pathname.endsWith('/build.json')) return;

  // The app: answers from the cache and revalidates behind it.
  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const hit = await cache.match(request, { ignoreSearch: true });
      // Without the browser cache too: revalidating against it revalidates
      // nothing, it just copies again what was already stale.
      const fresh = fetch(new Request(request, { cache: 'reload' }))
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit || cache.match('./index.html'));
      return hit || fresh;
    }),
  );
});
