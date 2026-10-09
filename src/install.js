/**
 * Installing the app from the browser.
 *
 * Chrome (Android and desktop) fires `beforeinstallprompt` when the page is
 * installable; we keep the event and fire it back when the user asks. There is
 * only one prompt per visit, and it only shows up if:
 *
 *   - the page is on https:// or localhost (over the network IP, it does not);
 *   - there is a valid manifest and a registered service worker;
 *   - the app is not installed yet.
 *
 * iPhone Safari implements none of this: there it is Share > Add to Home
 * Screen, by hand. That is why `state()` returns the reason, and not just a
 * boolean - the screen has to say what to do in each case, instead of hiding
 * the option and leaving the person with no way out.
 */

/**
 * The event may have arrived before this module existed.
 *
 * index.html keeps `beforeinstallprompt` in a drawer from the page's very
 * first instant, precisely because Chrome tends to fire it before the modules
 * finish loading. Reading the drawer here is what turns the install button
 * from intermittent into reliable.
 */
let deferred = (typeof window !== 'undefined' && window.__hitEasyInstall) || null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // the prompt is ours, when the person asks for it
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    window.__hitEasyInstall = null;
    notify();
  });
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The tests mount the views without a browser: none of these checks can blow
// up where `window` or `navigator` do not exist.
function detectIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // A modern iPad announces itself as a Mac; touch is what gives it away.
  return /iphone|ipad|ipod/i.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Which iPhone browser the page is open in.
 *
 * It matters because the path changes: in Safari it is Share > Add to Home
 * Screen; in Chrome and Edge from iOS 16.4 on it also exists, through the
 * address bar's share; and inside another app (Instagram, Facebook, the
 * Google app's browser) it does not exist at all - the person has to go out to
 * a real browser, and the screen has to say so instead of sending them to look
 * for a button that is not there.
 *
 * Returns 'safari' | 'other' | 'in-app'. Takes the user agent for the test.
 */
export function iosBrowser(ua) {
  const agent = ua !== undefined ? ua
    : (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|TikTok|musical_ly|Snapchat|GSA\/|Twitter/i.test(agent)) {
    return 'in-app';
  }
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|YaBrowser/i.test(agent)) return 'other';
  return 'safari';
}

/** iPhone or iPad? Exported so screens can hide what does not exist there. */
export function isIOS() {
  return detectIOS();
}

function isInstalled() {
  return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
    || (typeof navigator !== 'undefined' && navigator.standalone === true);
}

function isSecure() {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/**
 * The current install situation.
 * `mode` is one of: 'installed' | 'ready' | 'ios' | 'insecure' | 'unavailable'.
 */
export function state() {
  if (isInstalled()) return { mode: 'installed' };
  if (deferred) return { mode: 'ready' };
  if (detectIOS()) return { mode: 'ios' };
  if (!isSecure()) return { mode: 'insecure' };
  return { mode: 'unavailable' };
}

/** Returns 'accepted', 'dismissed' or 'unavailable'. */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const event = deferred;
  deferred = null; // it only works once, even if the person declines
  // The drawer too: otherwise a screen reload would read an already spent
  // event again and offer a button that does nothing.
  if (typeof window !== 'undefined') window.__hitEasyInstall = null;
  notify();
  try {
    event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return 'dismissed';
  }
}

/**
 * Which beta build is running.
 *
 * The file is written by CI on publish, and only exists in /beta/. In
 * production it returns null: there the version number already answers the
 * question, because it only changes when there is a release.
 *
 * Its fields (`build`, `quando`) are written by the workflow of whichever
 * branch publishes, so they stay as they are.
 *
 * `no-store` and the service worker letting it through: serving this from the
 * cache would answer with the previous build, the only useless answer.
 */
export async function betaBuild() {
  try {
    const res = await fetch('./build.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.build ? data : null;
  } catch {
    return null; // no network, or production, which has no such file
  }
}

/**
 * Fetches a new version of the installed app.
 *
 * The service worker already replaces itself (skipWaiting on install), but the
 * open PAGE keeps running the old code until it is reloaded - and an installed
 * app often goes days without ever being closed. Without this button, the
 * person reports an already fixed defect and there is no way to ask them to
 * "update".
 *
 * The detail that makes this work or not: `reg.update()` resolves when the
 * CHECK finishes, not when the installation ends. Reloading there reloads with
 * the old worker still in charge, which serves the old shell from the cache -
 * the app comes back identical and it looks like the button did nothing. That
 * is why we wait for `controllerchange`, which only fires when the new worker
 * really takes over.
 *
 * Returns 'updating' when there is a new version, 'current' when there is not.
 */
export async function updateApp(maxWait = 10000) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    if (typeof location !== 'undefined') location.reload();
    return 'updating';
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { location.reload(); return 'updating'; }

    await reg.update();

    // Neither installing nor waiting: no new code came.
    if (!reg.installing && !reg.waiting) return 'current';

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });

      // A worker stuck in "waiting" from an earlier attempt does not leave by
      // itself: a nudge solves it. install already calls skipWaiting, so this
      // only matters for the stuck case.
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

      // A bad network cannot leave the person stuck on a frozen screen: past
      // the limit, reload anyway. At worst they tap again.
      setTimeout(finish, maxWait);
    });

    location.reload();
    return 'updating';
  } catch {
    return 'current';
  }
}

/**
 * Which version the service worker says it is.
 *
 * The screen shows APP_VERSION, which comes from the module - and the module
 * comes from the cache. If the cache is stale, the screen lies with all the
 * confidence in the world. The worker is the only part the browser updates
 * from outside, so asking it reveals the mismatch.
 *
 * Returns null when there is no worker or it does not answer in time.
 */
export function workerVersion(maxWait = 1500) {
  if (typeof navigator === 'undefined'
    || !navigator.serviceWorker
    || !navigator.serviceWorker.controller) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let done = false;
    const answer = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => answer(e.data || null);
      navigator.serviceWorker.controller.postMessage({ type: 'VERSION' }, [channel.port2]);
      setTimeout(() => answer(null), maxWait);
    } catch {
      answer(null);
    }
  });
}
