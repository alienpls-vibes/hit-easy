/**
 * The app version.
 *
 * It serves two purposes: showing up in the settings (so whoever reports a
 * problem can say WHICH app broke) and naming the service worker caches -
 * bumping the version invalidates the old cache, which is exactly what you
 * want when there is new code.
 *
 * sw.js repeats this number by hand, because a worker does not import modules.
 * An automatic check in tools/check-syntax.js compares the two.
 */
export const APP_VERSION = '1.9.0';
