/**
 * "Tell me when there is a new card" - the page side.
 *
 * Two ways for the notice to reach a closed app, best first:
 *
 *   'push'   Web Push from the server. The device hands its push
 *            subscription to Supabase (sql/012-daily-notice.sql), and the
 *            Edge Function daily-push sends the notice at 09:00 on the
 *            device's clock, unless today's card was played. Chrome, Edge,
 *            Firefox, Safari on Mac, and the iPhone with the app on the
 *            Home Screen (iOS 16.4+).
 *   'on'     Periodic Background Sync, the fallback when there is no push
 *            or no server: the BROWSER wakes the worker when it likes (at
 *            most every 12 hours in Chrome, and only for sites it finds
 *            engaging), so on many days nothing comes. Kept only for that.
 *   'limited' notifications are allowed, but neither path exists here.
 *
 * Both are only promises until the next opening: a subscription can be lost
 * (app reinstalled, browser data cleared, the push service rotating it), and
 * the switch was once left "on" with nothing registered behind it. So every
 * app opening calls refresh(), which re-subscribes if needed and tells the
 * server again - with today's language and time zone.
 *
 * The worker cannot read localStorage, so the switch, the texts and "already
 * played today" also go to IndexedDB, which both sides can reach. One
 * database per channel, like everything else.
 */

import { isBeta, channel } from '../channel.js';
import {
  SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY, cloudEnabled,
} from '../config.js';

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

/* ---------------- the server path ---------------- */

function keyBytes(b64url) {
  const s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function timeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/** The RPCs of sql/012-daily-notice.sql. Anonymous, like the challenge. */
async function rpc(name, body) {
  const res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('server responded ' + res.status);
}

function pushAvailable(reg) {
  return Boolean(VAPID_PUBLIC_KEY && cloudEnabled() && reg && reg.pushManager);
}

/**
 * This device's push subscription, created if missing. One made with
 * another key (the VAPID pair was rotated) cannot be pushed to: replaced.
 */
async function pushSubscription(reg) {
  const wanted = keyBytes(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options && sub.options.applicationServerKey) {
    const had = new Uint8Array(sub.options.applicationServerKey);
    if (had.length !== wanted.length || had.some((b, i) => b !== wanted[i])) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });
}

/** Tells the server about this device. Resolves false when it could not. */
async function sendSubscription(sub, texts, playedOn) {
  const json = sub.toJSON();
  try {
    await rpc('inscrever_aviso', {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      c: channel(),
      fuso: timeZone(),
      titulo: texts.title,
      corpo: texts.body,
      jogado: playedOn || null,
    });
    return true;
  } catch {
    return false; // offline, or the server is down: the next opening retries
  }
}

/** Subscribes and registers with the server. 'push', or null if push is not here. */
async function enablePush(reg, texts, playedOn) {
  if (!pushAvailable(reg)) return null;
  let sub;
  try { sub = await pushSubscription(reg); } catch { return null; }
  await sendSubscription(sub, texts, playedOn);
  // The worker needs these to subscribe again by itself (pushsubscriptionchange).
  await updateConfig({
    mode: 'push',
    server: { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, vapid: VAPID_PUBLIC_KEY, channel: channel() },
  });
  // One path at a time: a periodic wake-up on top of the push would be a
  // second notice the same day (the worker's lastNotified stops most of
  // them, but not one that lands before the push).
  try { if (reg.periodicSync) await reg.periodicSync.unregister(SYNC_TAG); } catch { /* none */ }
  return 'push';
}

/* ---------------- the browser path ---------------- */

async function registerPeriodic(reg) {
  try {
    if (!reg.periodicSync) return false;
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
 * null when the worker did not come up in time (first opening, a slow
 * phone): nothing is known then, and nothing is overwritten.
 */
async function enableWith(texts, playedOn) {
  await updateConfig({ enabled: true, ...texts, ...(playedOn ? { playedOn } : {}) });
  const reg = await registration();
  if (!reg) return null;
  const pushed = await enablePush(reg, texts, playedOn);
  if (pushed) return pushed;
  const mode = (await registerPeriodic(reg)) ? 'on' : 'limited';
  await updateConfig({ mode });
  return mode;
}

/**
 * Turns the notice on. Must run inside a tap: browsers only ask for the
 * permission from a gesture.
 *
 * Resolves 'push', 'on' (periodic sync only), 'limited' (permission granted
 * but no way to reach a closed app), 'denied' or 'unsupported'.
 */
export async function enable(texts, playedOn = null) {
  if (permission() === 'unsupported') return 'unsupported';
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; }
  }
  if (perm !== 'granted') return 'denied';
  return (await enableWith(texts, playedOn)) || 'limited';
}

/**
 * Re-checks a notice that is already on - on every app opening. No gesture
 * needed: with the permission granted, subscribing again asks nothing.
 * Resolves like enable(), with 'denied' when the permission was taken away
 * in the browser's settings, and null when the worker was not up yet.
 */
export async function refresh(texts, playedOn = null) {
  const perm = permission();
  if (perm === 'unsupported') return 'unsupported';
  if (perm !== 'granted') return 'denied';
  return enableWith(texts, playedOn);
}

/** Today's card was finished: no notice today, here or from the server. */
export async function markPlayed(day) {
  await updateConfig({ playedOn: day });
  try {
    const reg = await registration();
    const sub = reg && reg.pushManager && cloudEnabled() ? await reg.pushManager.getSubscription() : null;
    if (sub) await rpc('aviso_jogado', { endpoint: sub.endpoint, dia: day });
  } catch { /* offline: the next refresh() sends the day along */ }
}

export async function disable() {
  await updateConfig({ enabled: false, mode: null });
  try {
    const reg = await registration();
    if (reg && reg.periodicSync) await reg.periodicSync.unregister(SYNC_TAG);
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      if (cloudEnabled()) await rpc('cancelar_aviso', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
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
