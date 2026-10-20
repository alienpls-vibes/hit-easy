/**
 * daily-push: sends the daily challenge's notice. Called every hour by
 * pg_cron (sql/013-daily-notice-schedule.sql).
 *
 * The database decides WHO is due (sql/012-daily-notice.sql,
 * avisos_a_enviar: past 09:00 on their clock, nothing sent today, today's
 * card not played) and marks them as sent in the same step, so running this
 * twice never sends twice. This file only encrypts and delivers.
 *
 * Plain JavaScript in a .ts file, so the Supabase CLI and the dashboard
 * editor take it as is. No imports from outside this folder: the dashboard
 * deploys the folder alone.
 *
 * Secrets (supabase secrets set ...):
 *   VAPID_PUBLIC_KEY   the same key as VAPID_PUBLIC_KEY in src/config.js
 *   VAPID_PRIVATE_KEY  its private half - only here, never in the repo
 *   VAPID_SUBJECT      mailto: address push services can write to
 *   CRON_SECRET        shared with the pg_cron job through Vault
 * SUPABASE_URL and the secret key come with every Edge Function.
 *
 * Deploy with JWT verification off (--no-verify-jwt): pg_cron sends the
 * CRON_SECRET header instead, and this file checks it.
 */

import { sendPush } from './webpush.js';

const env = (name) => Deno.env.get(name) || '';

/** The project's secret key, whichever generation of keys the project uses. */
function secretKeyHeaders() {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    const key = keys.default || Object.values(keys)[0];
    if (key) return { apikey: key };
  } catch { /* fall back to the legacy key */ }
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: legacy, Authorization: 'Bearer ' + legacy };
}

async function rpc(name, body = {}) {
  const res = await fetch(env('SUPABASE_URL').replace(/\/+$/, '') + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { ...secretKeyHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(name + ' answered ' + res.status + ': ' + await res.text());
  return res.status === 204 ? null : res.json();
}

/** Equal-time comparison, so the secret cannot be guessed by timing. */
function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!sameSecret(req.headers.get('x-cron-secret') || '', env('CRON_SECRET'))) {
    return new Response('forbidden', { status: 403 });
  }

  const vapid = {
    publicKey: env('VAPID_PUBLIC_KEY'),
    privateKey: env('VAPID_PRIVATE_KEY'),
    subject: env('VAPID_SUBJECT'),
  };
  const due = (await rpc('avisos_a_enviar')) || [];
  const result = { due: due.length, sent: 0, gone: 0, failed: 0 };

  // A few at a time: push services are fast, and this keeps the run well
  // inside the function's time limit without opening hundreds of sockets.
  for (let i = 0; i < due.length; i += 20) {
    await Promise.all(due.slice(i, i + 20).map(async (row) => {
      try {
        const status = await sendPush(row, { title: row.titulo, body: row.corpo, day: row.dia }, vapid);
        if (status === 404 || status === 410) {
          result.gone += 1;
          await rpc('aviso_expirado', { endpoint: row.endpoint });
        } else if (status >= 200 && status < 300) {
          result.sent += 1;
        } else {
          result.failed += 1;
          console.error('push answered', status, new URL(row.endpoint).host);
        }
      } catch (e) {
        result.failed += 1;
        console.error('push failed', String(e));
      }
    }));
  }

  console.log(JSON.stringify(result));
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
