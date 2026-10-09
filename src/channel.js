/**
 * Which channel this app is running on.
 *
 * Production and beta live on the SAME origin, only the path differs:
 *
 *   https://alienpls-vibes.github.io/hit-easy/        production
 *   https://alienpls-vibes.github.io/hit-easy/beta/   beta
 *
 * That makes publishing easy, but the browser does not help at all:
 * localStorage and Cache Storage are per ORIGIN, not per path. Without
 * separating them by hand, beta would write to the same `mtglc.db.v1` as the
 * real app - and a broken build would take down the match history of whoever
 * trusted it.
 *
 * That is why every piece of stored data goes through storageKey() before it
 * touches the disk.
 *
 * The channel names themselves ('producao' and 'beta') are stored values: they
 * go into the `canal` column of the database and into cache names. They stay
 * exactly as they are, even though the code around them is in English.
 */

/** Production channel, as stored in the database. Do not translate. */
export const PRODUCTION = 'producao';
export const BETA = 'beta';

/** Channel of a path. Exported apart from `location` so it can be tested. */
export function channelOf(path) {
  return /(^|\/)beta(\/|$)/.test(String(path || '')) ? BETA : PRODUCTION;
}

export function channel() {
  return channelOf(typeof location === 'undefined' ? '' : location.pathname);
}

export function isBeta() {
  return channel() === BETA;
}

/**
 * The name a piece of data is written under.
 *
 * Production keeps the EXACT key it always had - on purpose. Any suffix here
 * would wipe the history of everyone already using the app, and a test channel
 * that starts by destroying production data is worthless.
 */
export function storageKey(base) {
  return channel() === BETA ? base + '.beta' : base;
}

/**
 * Which channel a service worker cache belongs to.
 *
 * `null` for a name that is not ours: the worker must not delete anybody
 * else's cache, and before this it deleted everything it came across.
 *
 * This rule also lives inside sw.js, written the same way. A worker does not
 * import modules, and turning on `{type:'module'}` at registration would cost
 * compatibility in an app that must open offline. It is four lines; if it
 * changes here, change it there.
 */
export function channelOfCache(name) {
  const n = String(name || '');
  if (n.startsWith('hiteasy-beta-')) return BETA;
  if (n.startsWith('hiteasy-')) return PRODUCTION;
  return null;
}
