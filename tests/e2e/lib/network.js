/**
 * Everything the browser asks the outside world, answered here.
 *
 * The journeys must not depend on the internet: Scryfall rate limits, the
 * Supabase project's data, a flaky Wi-Fi - any of them would turn a red run
 * into "probably the network" and teach everyone to ignore red runs. So every
 * request that is not to the local server is intercepted:
 *
 *   api.scryfall.com     a fixed commander catalog (see fixtures/commanders.js)
 *   cards.scryfall.io    a real tiny JPEG, so art loads, caches and paints
 *   *.supabase.co        a fake cloud (see fake-cloud.js) or "no network"
 *   anything else        refused, and RECORDED: the app talking to a host
 *                        nobody listed is a finding, not noise
 *
 * Interception is on the browser target, so it also covers what the service
 * worker fetches (card art, the precache) - a per-page rule would miss it.
 */

import { searchResponse } from '../fixtures/commanders.js';
import { dailyResponse } from '../fixtures/daily-card.js';

// A real 1x1 image. Browsers decode images by their bytes, not by the
// declared type, so it stands in for Scryfall's JPEGs.
const JPEG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const CORS = [
  { name: 'Access-Control-Allow-Origin', value: '*' },
  { name: 'Access-Control-Allow-Headers', value: '*' },
  { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
];

export function installNetwork(conn, { localOrigin, cloud }) {
  const stray = [];       // hosts nobody listed
  const log = [];         // every external request, for failure reports
  let online = true;      // false: external hosts behave like no signal

  const fulfill = (sessionId, requestId, status, body, headers = []) => conn.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [...CORS, ...headers],
    body: Buffer.from(body || '').toString('base64'),
  }, sessionId);

  const json = (sessionId, requestId, status, data) => fulfill(
    sessionId, requestId, status, JSON.stringify(data),
    [{ name: 'Content-Type', value: 'application/json' }],
  );

  const off = conn.on(async (msg) => {
    if (msg.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = msg.params;
    const s = msg.sessionId || null;
    const url = new URL(request.url);
    try {
      if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:'
        // The browser's own built-in extensions, not the app.
        || url.protocol === 'chrome-extension:') {
        await conn.send('Fetch.continueRequest', { requestId }, s);
        return;
      }
      log.push(request.method + ' ' + request.url);
      if (!online) {
        await conn.send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' }, s);
        return;
      }
      if (request.method === 'OPTIONS') { await fulfill(s, requestId, 204, ''); return; }

      if (url.hostname === 'api.scryfall.com') {
        // The daily challenge asks by exact name (see fixtures/daily-card.js).
        const daily = dailyResponse(url);
        if (daily) { await json(s, requestId, daily.status, daily.body); return; }
        const q = (url.searchParams.get('q') || '').replace(/\s*is:commander\s*/i, '');
        const data = searchResponse(q);
        if (!data.data.length) await json(s, requestId, 404, { object: 'error', code: 'not_found' });
        else await json(s, requestId, 200, data);
        return;
      }
      if (url.hostname.endsWith('scryfall.io')) {
        await fulfill(s, requestId, 200, JPEG, [
          { name: 'Content-Type', value: 'image/jpeg' },
          { name: 'Cache-Control', value: 'public, max-age=31556952' },
        ]);
        return;
      }
      if (url.hostname.endsWith('.supabase.co')) {
        const answer = cloud
          ? await cloud.handle(request.method, url, request.postData ? JSON.parse(request.postData) : null, request.headers)
          : { status: 503, body: { message: 'cloud unavailable in this journey' } };
        await json(s, requestId, answer.status, answer.body);
        return;
      }
      stray.push(request.url);
      await conn.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, s);
    } catch {
      // The request may have died with its page (navigation, closed tab).
    }
  });

  return {
    dispose: off,
    setOnline(on) { online = Boolean(on); },
    stray,
    log,
  };
}
