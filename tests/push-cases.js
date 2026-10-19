/**
 * Cases for the daily notice sent by the server.
 *
 *   supabase/functions/daily-push/webpush.js   encryption and VAPID, checked
 *                                              against RFC 8291's own example
 *                                              and by decrypting as a browser
 *   src/daily/notify.js                        the page side: subscribing,
 *                                              re-subscribing, telling the
 *                                              server, turning it off
 *
 * Spliced into the suite by tests/cases.js. No network: the push manager,
 * the worker and the server are fakes that record what they were asked.
 */

import {
  encrypt, vapidHeader, sendPush, generateVapidKeys, b64urlDecode, b64urlEncode,
} from '../supabase/functions/daily-push/webpush.js';
import * as notify from '../src/daily/notify.js';
import { VAPID_PUBLIC_KEY, SUPABASE_URL } from '../src/config.js';

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((what || 'value') + ': expected ' + e + ', got ' + a);
}

function ok(cond, what) {
  if (!cond) throw new Error(what || 'false condition');
}

const enc = new TextEncoder();

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** What the browser does with a push body (RFC 8291), written independently. */
async function decryptAsBrowser(body, uaPair, uaPublic, authSecret) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const sealed = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPair.privateKey, 256));
  const prkKey = await hmac(authSecret, secret);
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic, 1]);
  const prk = await hmac(salt, await hmac(prkKey, info));
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, sealed));
  ok(plain[plain.length - 1] === 2, 'the record ends with the last-record delimiter');
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function browserKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { pair, raw, auth, p256dh: b64urlEncode(raw), authText: b64urlEncode(auth) };
}

/* ---------------- a fake browser for notify.js ---------------- */

/**
 * Installs a worker registration with a push manager, Notification, and a
 * fetch that records the server calls. `pushManager: false` is a browser
 * without push; `ready: false` a worker that never comes up; `existing`
 * ({ endpoint, key }) a subscription the device already has.
 */
function fakeBrowser({ perm = 'granted', pushManager = true, ready = true, existing = null } = {}) {
  const calls = [];
  const subscribed = [];
  let current = null;
  const makeSub = (endpoint, key) => ({
    endpoint,
    options: { applicationServerKey: key.buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) } }),
    unsubscribe: async () => { calls.push(['unsubscribe', endpoint]); current = null; return true; },
  });
  if (existing) current = makeSub(existing.endpoint, existing.key);
  const reg = {
    pushManager: pushManager ? {
      getSubscription: async () => current,
      subscribe: async (opts) => {
        subscribed.push(opts);
        current = makeSub('https://fcm.googleapis.com/fcm/send/new-' + subscribed.length, opts.applicationServerKey);
        return current;
      },
    } : undefined,
    periodicSync: {
      register: async () => { calls.push(['periodic-register']); },
      unregister: async () => { calls.push(['periodic-unregister']); },
    },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push([String(url).replace(SUPABASE_URL, ''), JSON.parse(init.body)]);
    return { ok: true, status: 204 };
  };
  const hadNotification = 'Notification' in globalThis;
  const realNotification = globalThis.Notification;
  globalThis.Notification = { permission: perm, requestPermission: async () => perm };
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { ready: ready ? Promise.resolve(reg) : new Promise(() => {}) },
    configurable: true,
  });
  Object.defineProperty(globalThis.navigator, 'permissions', {
    value: { query: async () => ({ state: 'granted' }) },
    configurable: true,
  });
  return {
    calls,
    subscribed,
    rpcs: () => calls.filter((c) => c[0].startsWith('/rest/v1/rpc/')).map((c) => [c[0].slice(13), c[1]]),
    restore() {
      globalThis.fetch = realFetch;
      if (hadNotification) globalThis.Notification = realNotification;
      else delete globalThis.Notification;
      delete globalThis.navigator.serviceWorker;
      delete globalThis.navigator.permissions;
    },
  };
}

const TEXTS = { title: 'Hit Easy · Cor do dia', body: 'Carta nova disponível.' };

export const PUSH_CASES = [
  ['push: the encryption matches the example in RFC 8291, byte for byte', async () => {
    const body = await encrypt(
      'When I grow up, I want to be a watermelon',
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      'BTBZMqHH6r4Tts7J_aSIgg',
      {
        asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
        asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
        salt: 'DGv6ra1nlYgDCS1FRnbzlw',
      },
    );
    eq(b64urlEncode(body),
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
      'the body of RFC 8291, appendix A');
  }],

  ['push: a browser opens what the server seals, with fresh keys every time', async () => {
    const b = await browserKeys();
    const payload = JSON.stringify({ title: 'Hit Easy · Farbe des Tages', body: 'Eine neue Karte ist da. Welche Farbe hat sie?' });
    const one = await encrypt(payload, b.p256dh, b.authText);
    const two = await encrypt(payload, b.p256dh, b.authText);
    eq(await decryptAsBrowser(one, b.pair, b.raw, b.auth), payload, 'decrypted');
    ok(b64urlEncode(one.slice(0, 16)) !== b64urlEncode(two.slice(0, 16)), 'the salt repeats');
    ok(b64urlEncode(one.slice(21, 86)) !== b64urlEncode(two.slice(21, 86)), 'the sender key repeats');
  }],

  ['push: the VAPID header is a valid ES256 token for that push service', async () => {
    const keys = await generateVapidKeys();
    eq(b64urlDecode(keys.publicKey).length, 65, 'public key size');
    eq(b64urlDecode(keys.privateKey).length, 32, 'private key size');
    const now = Date.UTC(2026, 9, 19, 12);
    const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', { ...keys, subject: 'https://example.org/' }, now);
    const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
    ok(m, 'header shape: ' + header);
    eq(m[4], keys.publicKey, 'k is the public key');
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2])));
    eq(claims.aud, 'https://fcm.googleapis.com', 'aud is the push service origin');
    eq(claims.sub, 'https://example.org/', 'sub');
    ok(claims.exp > now / 1000 && claims.exp <= now / 1000 + 24 * 3600, 'exp within 24 hours');
    const pub = await crypto.subtle.importKey('raw', b64urlDecode(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(m[3]), enc.encode(m[1] + '.' + m[2])),
      'the signature verifies with the public key');
  }],

  ['push: sendPush posts the sealed body with the headers push services require', async () => {
    const b = await browserKeys();
    const keys = await generateVapidKeys();
    let seen = null;
    const status = await sendPush(
      { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', p256dh: b.p256dh, auth: b.authText },
      { title: 'T', body: 'B', day: '2026-10-19' },
      { ...keys, subject: 'https://example.org/' },
      { fetchImpl: async (url, init) => { seen = { url, init }; return { status: 410 }; } },
    );
    eq(status, 410, 'the status comes back as is');
    eq(seen.init.headers['Content-Encoding'], 'aes128gcm', 'content encoding');
    ok(Number(seen.init.headers.TTL) > 0, 'a TTL');
    ok(seen.init.headers.Authorization.startsWith('vapid t='), 'VAPID authorization');
    eq(JSON.parse(await decryptAsBrowser(seen.init.body, b.pair, b.raw, b.auth)), { title: 'T', body: 'B', day: '2026-10-19' }, 'payload');
  }],

  ['push: turning the notice on subscribes with the app key and tells the server', async () => {
    const f = fakeBrowser();
    try {
      eq(await notify.enable(TEXTS, '2026-10-19'), 'push', 'mode');
      eq(f.subscribed.length, 1, 'subscribed once');
      eq(b64urlEncode(f.subscribed[0].applicationServerKey), VAPID_PUBLIC_KEY, 'with the app VAPID key');
      ok(f.subscribed[0].userVisibleOnly, 'userVisibleOnly');
      const [[name, body]] = f.rpcs();
      eq(name, 'inscrever_aviso', 'rpc');
      eq([body.titulo, body.corpo, body.jogado, body.c], [TEXTS.title, TEXTS.body, '2026-10-19', 'producao'], 'texts, day, channel');
      ok(/^https:\/\/fcm\.googleapis\.com\//.test(body.endpoint), 'endpoint');
      ok(typeof body.fuso === 'string' && body.fuso.length > 0, 'a time zone');
      ok(f.calls.some((c) => c[0] === 'periodic-unregister'), 'the periodic fallback is dropped');
    } finally { f.restore(); }
  }],

  ['push: an opening re-subscribes a lost subscription, without asking anything', async () => {
    const f = fakeBrowser();
    try {
      eq(await notify.refresh(TEXTS), 'push', 'mode');
      eq(f.subscribed.length, 1, 'a new subscription was made');
      eq(f.rpcs().map((r) => r[0]), ['inscrever_aviso'], 'and sent to the server');
    } finally { f.restore(); }
  }],

  ['push: an opening keeps a good subscription and replaces one made with an old key', async () => {
    let f = fakeBrowser({ existing: { endpoint: 'https://fcm.googleapis.com/fcm/send/kept', key: b64urlDecode(VAPID_PUBLIC_KEY) } });
    try {
      await notify.refresh(TEXTS);
      eq(f.subscribed.length, 0, 'no new subscription');
      eq(f.rpcs()[0][1].endpoint, 'https://fcm.googleapis.com/fcm/send/kept', 'the same endpoint, sent again');
    } finally { f.restore(); }

    f = fakeBrowser({ existing: { endpoint: 'https://fcm.googleapis.com/fcm/send/old', key: new Uint8Array(65).fill(4) } });
    try {
      await notify.refresh(TEXTS);
      ok(f.calls.some((c) => c[0] === 'unsubscribe' && c[1].endsWith('/old')), 'the old one was dropped');
      eq(f.subscribed.length, 1, 'a new one was made');
    } finally { f.restore(); }
  }],

  ['push: without push the switch falls back, and a revoked permission is reported', async () => {
    let f = fakeBrowser({ pushManager: false });
    try {
      eq(await notify.enable(TEXTS), 'on', 'periodic sync');
      eq(f.rpcs().length, 0, 'no server call');
    } finally { f.restore(); }
    f = fakeBrowser({ perm: 'denied' });
    try {
      eq(await notify.refresh(TEXTS), 'denied', 'permission taken away');
    } finally { f.restore(); }
  }],

  ['push: finishing the card tells the server; turning off cancels and unsubscribes', async () => {
    const f = fakeBrowser({ existing: { endpoint: 'https://fcm.googleapis.com/fcm/send/mine', key: b64urlDecode(VAPID_PUBLIC_KEY) } });
    try {
      await notify.markPlayed('2026-10-19');
      eq(f.rpcs(), [['aviso_jogado', { endpoint: 'https://fcm.googleapis.com/fcm/send/mine', dia: '2026-10-19' }]], 'played');
      await notify.disable();
      eq(f.rpcs()[1], ['cancelar_aviso', { endpoint: 'https://fcm.googleapis.com/fcm/send/mine' }], 'cancelled');
      ok(f.calls.some((c) => c[0] === 'unsubscribe'), 'unsubscribed');
    } finally { f.restore(); }
  }],
];
