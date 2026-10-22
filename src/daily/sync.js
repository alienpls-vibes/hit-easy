/**
 * The daily progress, kept with the account (sql/014-daily-progress.sql).
 *
 * The progress used to live only in this browser, and in 1.12.0 a phone
 * came back with the challenge at zero while the matches - which live in the
 * cloud - were all there. With an account, a copy of every day now sits on
 * the server, and a new or wiped device gets the streak back.
 *
 * One call does both directions: the device sends all its days, the server
 * merges them into its copy (the better record of each day wins, see
 * betterDay() in storage.js) and answers with the whole, which is merged
 * back here. Nothing on either side is ever replaced by less.
 *
 * It runs on every opening, on signing in, and when a day is finished.
 * Free for every account, like the challenge: there is no subscription check.
 * Loaded on demand from entry.js and screen.js, so a failure here costs only
 * the copy, never the game.
 */

import { request } from '../cloud/http.js';
import { account, onAccountChange } from '../cloud/account.js';
import { cloudEnabled } from '../config.js';
import { channel } from '../channel.js';
import * as storage from './storage.js';

let running = null;
let pending = false;
let changedFn = null;

function userId() {
  return (account.session && account.session.user && account.session.user.id) || null;
}

async function once() {
  const merged = await request('/rest/v1/rpc/juntar_progresso_diario', {
    method: 'POST',
    body: JSON.stringify({ c: channel(), dias: storage.allDays() }),
  });
  if (storage.mergeDays(merged) && changedFn) changedFn();
}

/**
 * Sends and receives the days. One at a time: a call made while another is
 * on its way runs once more right after it, with what changed meanwhile.
 * Resolves false when there is no account or the server could not be
 * reached (the next opening tries again).
 */
export function syncDaily() {
  if (!cloudEnabled() || !userId()) return Promise.resolve(false);
  if (running) { pending = true; return running; }
  running = (async () => {
    try {
      do {
        pending = false;
        await once();
      } while (pending);
      return true;
    } catch {
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

let started = false;

/**
 * Startup: syncs now, and again whenever someone signs in (the account
 * changes to another user). `onChanged` runs when days came from the server,
 * so the home button can redraw its dot.
 */
export function startDailySync(onChanged) {
  changedFn = onChanged || null;
  if (started) return syncDaily();
  started = true;
  let last = userId();
  onAccountChange(() => {
    const now = userId();
    if (now && now !== last) syncDaily();
    last = now;
  });
  return syncDaily();
}
