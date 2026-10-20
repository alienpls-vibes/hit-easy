/**
 * Web Push without a library: payload encryption (RFC 8291, aes128gcm) and
 * the VAPID signature (RFC 8292), on WebCrypto alone.
 *
 * WebCrypto is the same in Deno (where the Supabase Edge Function runs) and
 * in Node (where tests/push-cases.js checks this file against the RFC's own
 * example), so one file serves both and the repo stays without dependencies.
 * The npm `web-push` package leans on node:crypto's ECDH, which is exactly
 * the part of Node that Deno only half imitates.
 *
 * Keys travel the way the browser hands them over: base64url, the public
 * ones as an uncompressed P-256 point (65 bytes), the VAPID private key as
 * the bare 32-byte scalar `d`.
 */

const enc = new TextEncoder();

export function b64urlDecode(text) {
  const s = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function b64urlEncode(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** A P-256 key pair from its raw parts, as a JWK WebCrypto can import. */
function jwkOf(publicRaw, privateD) {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(publicRaw.slice(1, 33)),
    y: b64urlEncode(publicRaw.slice(33, 65)),
    ...(privateD ? { d: b64urlEncode(privateD) } : {}),
  };
}

/**
 * Encrypts `plaintext` for one subscription.
 *
 * `fixed` exists only for the RFC 8291 example: it pins the sender's key pair
 * and the salt, which are random in real use.
 */
export async function encrypt(plaintext, p256dh, auth, fixed = null) {
  const uaPublic = b64urlDecode(p256dh);
  const authSecret = b64urlDecode(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('bad p256dh');
  if (authSecret.length !== 16) throw new Error('bad auth');

  let asPrivate;
  let asPublic;
  if (fixed) {
    asPublic = b64urlDecode(fixed.asPublic);
    asPrivate = await crypto.subtle.importKey(
      'jwk', jwkOf(asPublic, b64urlDecode(fixed.asPrivate)), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'],
    );
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }
  const salt = fixed ? b64urlDecode(fixed.salt) : crypto.getRandomValues(new Uint8Array(16));

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

  // RFC 8291 section 3.4, written out: HKDF with a single block each time.
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);

  // One record, so it ends with the last-record delimiter 0x02.
  const record = concat(typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record));

  const rs = 4096;
  const header = concat(salt, new Uint8Array([rs >>> 24, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255, 65]), asPublic);
  return concat(header, sealed);
}

/** The `Authorization: vapid t=..., k=...` header for one push service. */
export async function vapidHeader(endpoint, vapid, now = Date.now()) {
  const publicRaw = b64urlDecode(vapid.publicKey);
  const key = await crypto.subtle.importKey(
    'jwk', jwkOf(publicRaw, b64urlDecode(vapid.privateKey)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const head = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64urlEncode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  })));
  // WebCrypto signs ECDSA as r||s, which is already the JWS form.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64urlEncode(sig) + ', k=' + vapid.publicKey;
}

/**
 * Sends one notice. Resolves to the push service's HTTP status: 201 is
 * delivered, 404 and 410 mean the subscription is gone for good.
 */
export async function sendPush(subscription, payload, vapid, { ttl = 12 * 60 * 60, fetchImpl = fetch } = {}) {
  const body = await encrypt(JSON.stringify(payload), subscription.p256dh, subscription.auth);
  const res = await fetchImpl(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(subscription.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body,
  });
  return res.status;
}

/** A fresh VAPID key pair, in the form this file and the browser use. */
export async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey: b64urlEncode(raw), privateKey: jwk.d };
}
