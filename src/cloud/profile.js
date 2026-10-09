/**
 * The public profile: the name and the @ friends use to tag you at their table.
 *
 * The @ lookup is an exact match, on the server side: it can confirm an @ you
 * already know, never discover who has an account in the app.
 */

import { channel } from '../channel.js';
import { notify, account, currentUser } from './account.js';
import { headers, request, url } from './http.js';
import {
  isHandleValid, normalizeHandle, normalizeName, handleStatus,
} from './rules.js';

export function myProfile() {
  return account.profile;
}

export async function loadProfile() {
  if (!account.session) { account.profile = null; return null; }
  const rows = await request('/rest/v1/profiles?select=*&limit=1');
  const next = Array.isArray(rows) && rows.length ? rows[0] : null;
  // Like the invites: notifying without a change makes whoever redraws on
  // notice fetch again, and fetching again notify again.
  const changed = JSON.stringify(next) !== JSON.stringify(account.profile);
  account.profile = next;
  if (changed) notify();
  return account.profile;
}

/**
 * Picks or changes your own @.
 *
 * Postgres' 409 (unique key) is the only reliable answer about a taken @:
 * asking first and acting later leaves a window between the two in which
 * someone else takes the same name. Let the database decide and handle the
 * conflict.
 */
export async function saveHandle(handle, name) {
  const owner = currentUser();
  if (!owner) throw new Error('no session');
  const h = normalizeHandle(handle);
  if (!isHandleValid(h)) throw new Error('invalid handle');

  const res = await fetch(url('/rest/v1/profiles'), {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    // No `display_name` when no name came: the upsert only updates the columns
    // sent, and sending null here erased the name in matches on every @
    // change.
    body: JSON.stringify(name
      ? { id: owner.id, handle: h, display_name: normalizeName(name) || null }
      : { id: owner.id, handle: h }),
  });
  if (res.status === 409) throw new Error('handle taken');
  if (!res.ok) {
    // HE015: changed less than 15 days ago (sql/009). The database sends the
    // unlock date in `details`, so the screen can say when - and not just
    // "it did not work".
    let body = null;
    try { body = await res.json(); } catch { /* no readable body */ }
    if (body && body.code === 'HE015') {
      const err = new Error('handle too soon');
      err.unlockedAt = Date.parse(body.details) || null;
      throw err;
    }
    throw new Error('server responded ' + res.status);
  }
  const rows = await res.json();
  account.profile = Array.isArray(rows) && rows.length
    ? rows[0]
    : { id: owner.id, handle: h, handle_trocado_em: new Date().toISOString() };
  notify();
  return account.profile;
}

/**
 * The profile column for the decks of a channel: `decks` in production,
 * `decks_beta` in beta.
 */
export function decksColumn(whichChannel) {
  return whichChannel === 'beta' ? 'decks_beta' : 'decks';
}

/**
 * Writes the decks I keep playing to my profile.
 *
 * Only your own account: the "manage own profile" policy is
 * `using (auth.uid() = id)`, so there is no way to write to someone else's
 * profile - and there should not be. The host records friends' decks on their
 * own device, but what goes into someone's profile is that person's call.
 *
 * Requires the column from sql/004-account-decks.sql. Without it the server
 * refuses, and the caller treats it as "next time" - the app keeps working
 * with the decks from the local history, as it did before.
 */
export async function saveMyDecks(decks) {
  const owner = currentUser();
  if (!owner) throw new Error('no session');
  if (!Array.isArray(decks)) return null;

  // One column per channel. Without this, a test table with made-up
  // commanders would get into the deck picker of the real app - and the
  // feature exists precisely so the picker knows the person's decks.
  const column = decksColumn(channel());

  const slim = decks.slice(0, 200).map((d) => ({
    commanders: (d.commanders || []).map((c) => ({
      oracleId: c.oracleId, name: c.name, colors: c.colors, art: c.art || '',
    })),
    lastUsed: d.lastUsed || 0,
  }));

  await request('/rest/v1/profiles?id=eq.' + encodeURIComponent(owner.id), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ [column]: slim }),
  });
  if (account.profile) account.profile[column] = slim;
  return slim;
}

/** Looks up an @. Exact match: it confirms who you already know, it does not explore. */
export async function findHandle(handle) {
  const h = normalizeHandle(handle);
  if (!isHandleValid(h)) return null;
  const rows = await request('/rest/v1/rpc/buscar_handle', {
    method: 'POST',
    body: JSON.stringify({ h }),
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/**
 * Which of these @s changed name: `{ old: current }`.
 *
 * Asks in batches of 500 (the database limit, sql/010) and returns only those
 * that changed. This is what lets the statistics consolidate a friend who
 * changed @ - see currentHandle in stats.
 */
export async function currentHandles(list) {
  const map = {};
  const unique = [...new Set((list || []).map(normalizeHandle).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 500) {
    const rows = await request('/rest/v1/rpc/handles_atuais', {
      method: 'POST',
      body: JSON.stringify({ hs: unique.slice(i, i + 500) }),
    });
    // The RPC answers `{ pedido, atual }`: the requested @ and its current one.
    for (const l of rows || []) {
      if (l && l.pedido && l.atual && l.pedido !== l.atual) map[l.pedido] = l.atual;
    }
  }
  return map;
}

/**
 * What this @ is to me: 'current', 'free' or 'taken' (see rules.js).
 *
 * This is a QUERY, not a reservation: between the answer and the save someone
 * may take the same name. The database is what really decides - the unique
 * index and the trigger that keeps every @ ever used (sql/008) - and
 * saveHandle() handles the 409. This is only so the person does not type a
 * taken name and find out only at the end.
 */
export async function handleStatusNow(h) {
  const found = await findHandle(h);
  const mine = myProfile();
  return handleStatus(h, found, mine && mine.id);
}

/**
 * Saves the name shown in matches. Empty erases it - and the table goes back
 * to using the @.
 *
 * It only exists with a profile: the `profiles` row is born with the @, and
 * that is where the name lives.
 */
export async function saveName(text) {
  const owner = currentUser();
  if (!owner || !account.profile) throw new Error('no profile');
  const name = normalizeName(text) || null;
  await request('/rest/v1/profiles?id=eq.' + encodeURIComponent(owner.id), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ display_name: name }),
  });
  account.profile = { ...account.profile, display_name: name };
  notify();
  return name;
}
