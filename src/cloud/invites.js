/**
 * Invites: matches someone recorded saying you were at the table.
 *
 * A seat tagged with an @ becomes an invite to the owner of that @. Accepting
 * brings the match into the history of whoever accepted; trusting a host makes
 * whatever comes from them come in on its own.
 *
 * The database values are Portuguese and stay so: invite `status` is
 * 'pendente' | 'aceito' | 'recusado', and `trusted_hosts.confia` is the trust
 * flag.
 */

import { channel } from '../channel.js';
import { notify, account, currentUser } from './account.js';
import { request } from './http.js';
import { participantsOf } from './rules.js';

/**
 * Records who sat in each tagged seat.
 *
 * Runs after the match is already in the database - there is a foreign key,
 * and without the match there is no seat. Failing here does not lose the
 * match: it already went up, and only the invites wait for the next attempt.
 */
export async function sendParticipants(match) {
  const rows = participantsOf(match, channel());
  if (!rows.length) return 0;
  await request('/rest/v1/match_players', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  return rows.length;
}

/**
 * Open invites, as this device knows them.
 *
 * Kept around because the home screen needs to know whether something is
 * waiting without hitting the network on every draw - and the home screen
 * redraws all the time.
 */
export function openInvites() {
  return account.invites;
}

/** Invites addressed to me that I have not answered yet. */
export async function pendingInvites() {
  const owner = currentUser();
  if (!owner) { account.invites = []; return []; }
  // By channel: an invite born at a test table cannot show up in the real
  // app, neither for whoever recorded it nor for whoever was tagged.
  const rows = (await request(
    '/rest/v1/match_players?select=*&status=eq.pendente'
    + '&canal=eq.' + channel()
    + '&user_id=eq.' + encodeURIComponent(owner.id),
  )) || [];
  // Only notifies if the list CHANGED. Always notifying closed a loop: the
  // account screen redraws on every notice, redrawing builds the invites
  // block, the block fetches the invites, and the fetch notified again -
  // forever, one network trip per round. The buttons were recreated nonstop
  // under the mouse: they flickered, and the click landed on a button that no
  // longer existed.
  const changed = invitesSignature(rows) !== invitesSignature(account.invites);
  account.invites = rows;
  if (changed) notify();
  return rows;
}

function invitesSignature(list) {
  return (list || []).map((c) => c.match_id + ':' + c.seat_id + ':' + c.status).sort().join('|');
}

/** Who recorded the match this invite refers to. */
export async function inviteHost(matchId) {
  const rows = await request('/rest/v1/rpc/anfitriao_do_convite', {
    method: 'POST',
    body: JSON.stringify({ mid: matchId }),
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function answerInvite(matchId, seatId, accept) {
  await request(
    '/rest/v1/match_players?match_id=eq.' + encodeURIComponent(matchId)
    + '&seat_id=eq.' + encodeURIComponent(seatId),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: accept ? 'aceito' : 'recusado' }),
    },
  );
}

/**
 * The hosts I trust.
 *
 * The policy only returns your own rows, so this never reveals anyone else's
 * list. It serves two uses: auto-accepting invites (which the server resolves
 * on its own) and learning who is who when downloading matches.
 */
export async function trustedHosts() {
  const owner = currentUser();
  if (!owner) return [];
  const rows = await request(
    '/rest/v1/trusted_hosts?select=host_id&confia=is.true&user_id=eq.'
    + encodeURIComponent(owner.id),
  );
  return (rows || []).map((l) => l.host_id).filter(Boolean);
}

/**
 * Whom this person explicitly refused.
 *
 * It exists because auto-accept is now born from the history: playing together
 * once is enough. Without a way to say no, one table with a stranger at a
 * tournament would count forever - and the refused list is what the screen
 * needs to show that decision and allow undoing it.
 */
export async function refusedHosts() {
  const owner = currentUser();
  if (!owner) return [];
  const rows = await request(
    '/rest/v1/trusted_hosts?select=host_id&confia=is.false&user_id=eq.'
    + encodeURIComponent(owner.id),
  );
  return (rows || []).map((l) => l.host_id).filter(Boolean);
}

/**
 * Decides about a host: accept on its own, or never again.
 *
 * `merge-duplicates` and not `ignore-duplicates`: the row may already exist
 * with the opposite decision, and ignoring the conflict would leave the person
 * tapping a button that does nothing. Changing your mind has to count.
 */
async function decideAbout(hostId, trusts) {
  const owner = currentUser();
  if (!owner || !hostId) throw new Error('no session');
  await request('/rest/v1/trusted_hosts', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: owner.id, host_id: hostId, confia: trusts }),
  });
}

/** Starts accepting on its own whatever comes from this host. */
export function trustHost(hostId) {
  return decideAbout(hostId, true);
}

/**
 * Never again accept on its own whatever comes from this person.
 *
 * Writes `confia = false` instead of deleting the row. Deleting undoes
 * nothing: the trigger rebuilds the auto-accept from the matches the two have
 * already played together, and the person would tap the button again every
 * month without understanding why it has no effect.
 */
export function untrustHost(hostId) {
  return decideAbout(hostId, false);
}
