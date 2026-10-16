/**
 * "Tell me when there is a new card" - the page side.
 *
 * Hit Easy is a static site with no server of its own, so there is nothing
 * to send a push from. What the browsers offer without a server is
 * Periodic Background Sync: the browser wakes the service worker now and then
 * (roughly once or twice a day, its own choice), and the worker decides
 * whether to show the notice - see sw-daily.js. Where it exists:
 *
 *   Chrome / Edge on Android, with the app INSTALLED     works
 *   Chrome / Edge on desktop, with the app installed      works
 *   Safari (iPhone, Mac), Firefox                          no periodic sync:
 *                                                          only the test notice
 *
 * A guaranteed notice at a set time, on every system, needs Web Push from a
 * server (a scheduled Supabase function, for example). That is a later step,
 * and this file is where it would plug in.
 *
 * The worker cannot read localStorage, so the switch, the texts in the
 * person's language and "already played today" go to IndexedDB, which both
 * sides can reach. One database per channel, like everything else.
 */

import { isBeta } from '../channel.js';

export const SYNC_TAG = 'hiteasy-daily';
const DB_NAME = 'hiteasy-daily' + (isBeta() ? '-beta' : '');
const STORE = 'kv';
const KEY = 'notify';
const MIN_INTERVAL = 6 * 60 * 60 * 1000; // the browser stretches it as it likes

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readConfig() {
  const db = await openDb();
  return new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => resolve({});
  });
}

/** Merges into the config the worker reads. Never throws: a notice is a nicety. */
export async function updateConfig(patch) {
  try {
    const current = await readConfig();
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...current, ...patch }, KEY);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch { /* private mode or no IndexedDB: the switch just does nothing */ }
}

/** 'unsupported' | 'default' | 'granted' | 'denied' */
export function permission() {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/** The worker's registration, or null if it does not come up in a few seconds. */
async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

async function registerPeriodic() {
  try {
    const reg = await registration();
    if (!reg || !reg.periodicSync) return false;
    if (navigator.permissions) {
      const state = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (state.state !== 'granted') return false;
    }
    await reg.periodicSync.register(SYNC_TAG, { minInterval: MIN_INTERVAL });
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns the notice on. Must run inside a tap: browsers only ask for the
 * permission from a gesture.
 *
 * Resolves 'on' (periodic sync registered), 'limited' (permission granted
 * but this browser cannot wake the worker by itself), 'denied' or
 * 'unsupported'.
 */
export async function enable(texts) {
  if (permission() === 'unsupported') return 'unsupported';
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; }
  }
  if (perm !== 'granted') return 'denied';
  await updateConfig({ enabled: true, ...texts });
  return (await registerPeriodic()) ? 'on' : 'limited';
}

export async function disable() {
  await updateConfig({ enabled: false });
  try {
    const reg = await registration();
    if (reg && reg.periodicSync) await reg.periodicSync.unregister(SYNC_TAG);
  } catch { /* nothing registered */ }
}

/** Shows the notice right now, to prove the path works on this device. */
export async function sendTest(texts) {
  if (permission() !== 'granted') return false;
  const reg = await registration();
  if (!reg) return false;
  await reg.showNotification(texts.title, {
    body: texts.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: SYNC_TAG,
    data: { url: './?daily=1' },
  });
  return true;
}
