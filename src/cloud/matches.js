/**
 * Matches on the server: upload, download, list ids and delete.
 *
 * It does not decide who can read what - that belongs to the database
 * (sql/schema.sql). This side only asks; Postgres and its policies answer.
 */

import { sendParticipants } from './invites.js';
import { currentUser } from './account.js';
import { request } from './http.js';
import { channel } from '../channel.js';
import { fromRow, toRow } from './rules.js';

/**
 * Uploads a match. Repeating the same one does not duplicate: the id is the
 * primary key, and `resolution=ignore-duplicates` turns the conflict into
 * silence - which is what you want when the network drops in the middle of an
 * upload and the app tries again.
 */
export async function uploadMatch(match) {
  const owner = currentUser();
  if (!owner) throw new Error('no session');
  await request('/rest/v1/matches', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(toRow(match, owner.id, channel())),
  });
  // A match without its participants is a lost invite: whoever played on
  // someone else's device would never find out. Failing here does not undo
  // the upload above - the match is already saved, and the invites come back
  // next time.
  try {
    await sendParticipants(match);
  } catch {
    /* tries again on the next sync */
  }
}

/**
 * Brings the history down. Without a subscription, the database returns an
 * empty list - not an error. From the RLS point of view, those rows simply do
 * not exist for non-subscribers.
 */
export async function downloadMatches() {
  // Only this app's channel. Without the filter, production downloaded the
  // test matches and added them to the real statistics.
  const rows = await request('/rest/v1/matches?select=*&canal=eq.'
    + channel() + '&order=started_at.desc');
  return (rows || []).map(fromRow);
}

/**
 * How many ids the server returns at once before it becomes suspicious.
 *
 * It is not pagination: it is a detector of incomplete answers. If the full
 * limit comes back, there are probably more - and an incomplete list used to
 * decide what to DELETE would be disastrous.
 */
const ID_LIMIT = 5000;

/**
 * Only the ids of the matches that are in the cloud.
 *
 * Serves to find out what was deleted on another device. Brings only the ids
 * because the decision does not need the content, and because the list has to
 * fit whole - half a list here becomes an undue deletion there.
 */
export async function remoteIds() {
  // Filters by channel here too. The local uploaded list is per channel
  // (localStorage with a suffix), so comparing with the ids of BOTH channels
  // would spend the 5000 limit on rows that will never be compared - and the
  // limit is the incomplete-answer detector, which decides what to DELETE.
  const rows = await request('/rest/v1/matches?select=id&canal=eq.'
    + channel() + '&limit=' + ID_LIMIT);
  const ids = (rows || []).map((l) => l && l.id).filter(Boolean);
  return { ids, complete: ids.length < ID_LIMIT };
}

export async function deleteRemoteMatch(id) {
  await request('/rest/v1/matches?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
}
