/**
 * Taking the matches to the cloud, and bringing them back.
 *
 * The design in one sentence: the device keeps only what has not reached the
 * cloud yet. A finished match waits on the device until there is an account
 * to send it to; once the server confirms it, it leaves the device, and the
 * statistics read the account's history from the cloud.
 *
 * The reason is the borrowed phone. Commander is played on whoever's device
 * is at hand, and a history that stays behind after signing out is someone
 * else's data on that phone. Nothing is lost on the way: a match only leaves
 * after the server said it has it, and without an account it stays, however
 * long that takes.
 *
 * The resend queue does not exist as a separate structure. It is the local
 * history itself: what is still here is, by definition, what still needs to
 * go up.
 *
 * Non-subscribers CAN upload (the database allows inserting without a
 * subscription, on purpose) but cannot download - the read returns an empty
 * list. Their matches are safe in the cloud and show up the day they
 * subscribe.
 */

import * as store from './store.js';
import * as cloud from './cloud.js';
import { cloudEnabled } from './config.js';
import { channel } from './channel.js';
import { deckKeyOf } from './engine.js';

/* ------------------------------------------------------------------ */
/* Pure decisions                                                      */
/* ------------------------------------------------------------------ */

/**
 * What still needs to go up.
 *
 * Discards what this device already uploaded AND what the server already has -
 * the second part covers the new device that downloaded everything and does
 * not need to send anything back.
 */
export function toUpload(local, uploaded, remoteIds) {
  const done = new Set([...(uploaded || []), ...(remoteIds || [])]);
  return (local || []).filter((m) => m && m.id && !done.has(m.id));
}

/** What the cloud has and this device does not yet. */
export function toDownload(local, remote) {
  const here = new Set((local || []).map((m) => m && m.id).filter(Boolean));
  return (remote || []).filter((m) => m && m.id && !here.has(m.id));
}

/**
 * Which seats get the handle, when linking a person to an account.
 *
 * Pure on purpose: it is the rule that decides "this is the same person", and
 * a rule like that has to be checkable without localStorage and without a
 * network.
 *
 * `names` are the (lowercase) names known to belong to this person: the one
 * just tagged, plus the ones the device already linked to that @.
 *
 * Three refusals, each preventing a different kind of damage:
 *
 *   already has another @   The seat was tagged before, with another account.
 *                           A previous decision is not overwritten because of
 *                           an equal name.
 *
 *   the @ is already seated Another seat of that match already is this
 *                           person. Writing again would put the same person
 *                           twice at the same table, and the statistics would
 *                           add up their damage against themselves.
 *
 *   two candidates          Two names of the set seated at the SAME table.
 *                           Either they are two different people, or an alias
 *                           is wrong - and neither is solved by guessing. The
 *                           match is left out and reported.
 */
export function seatsToLink(matches, names, handle) {
  const target = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  const nameSet = new Set(
    [...(names || [])].map((n) => String(n || '').trim().toLowerCase()).filter(Boolean),
  );
  const targets = [];
  const ambiguous = [];
  if (!target || !nameSet.size) return { targets, ambiguous };

  for (const match of matches || []) {
    const seats = (match && match.seats) || [];
    const alreadySeated = seats.some(
      (s) => String(s.handle || '').trim().replace(/^@+/, '').toLowerCase() === target,
    );
    if (alreadySeated) continue;

    const candidates = seats.filter((s) => {
      if (String(s.handle || '').trim()) return false; // the previous decision wins
      return nameSet.has(String(s.name || '').trim().toLowerCase());
    });

    if (candidates.length > 1) { ambiguous.push(match.id); continue; }
    if (candidates.length === 1) {
      targets.push({ matchId: match.id, seatId: candidates[0].id });
    }
  }

  return { targets, ambiguous };
}

/**
 * Aliases (name -> @) that can be learned from what came from the cloud.
 *
 * A seat with a name AND a handle is, by itself, the information that that
 * name is that account. Reading it, the device that never tagged anything
 * discovers the link the other one made, and its OWN matches converge.
 *
 * The gate is about trust, and it is not a formality. Learning from any match
 * would let any host name people on your device: seating a chair called
 * "Alexandre" with their @ would be enough for your history of Alexandre to
 * start adding up on the wrong account. So: your own match, or one from a host
 * you trusted - the same list that decides auto-accept.
 *
 * store.learnAlias is what applies them, and it never overwrites what this
 * device already decided by hand.
 */
export function learnedAliases(matches, myId, trusted) {
  const trust = new Set((trusted || []).filter(Boolean));
  const found = [];

  for (const match of matches || []) {
    const owner = match && match.owner;
    if (!owner) continue; // a match with no owner: nobody to vouch for it
    if (owner !== myId && !trust.has(owner)) continue;

    for (const seat of (match.seats || [])) {
      const name = String(seat.name || '').trim();
      const handle = String(seat.handle || '')
        .trim().replace(/^@+/, '').toLowerCase();
      if (name && handle) found.push({ name, handle });
    }
  }

  return found;
}

/**
 * Is it worth writing the decks to the profile?
 *
 * Only when the SET changed. `lastUsed` changes with every match, so comparing
 * the whole lists would make every sync write to the profile to say the same
 * thing.
 */
export function decksChanged(mine, inProfile) {
  const keys = (list) => (list || [])
    .map((d) => deckKeyOf(d && d.commanders))
    .filter(Boolean)
    .sort()
    .join('|');
  return keys(mine) !== keys(inProfile);
}

/** Is it worth syncing now? */
export function canSync(enabled, state) {
  return Boolean(enabled) && state !== 'off' && state !== 'signed-out';
}

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

let running = null;

/** Asks which @s in the history changed, and teaches the device. */
export async function refreshHandles() {
  const known = store.allKnownHandles();
  if (!known.length) return { handles: 0, names: 0, table: false };
  let found;
  try {
    found = await cloud.profilesByHandle(known);
  } catch {
    // Database without sql/011 yet: 010 still answers the @ changes.
    found = { current: await cloud.currentHandles(known), names: {} };
  }
  const handles = store.learnCurrentHandles(found.current);
  const { changed, table } = store.learnDisplayNames(found.names);
  return { handles, names: changed, table };
}

/**
 * One complete pass: uploads what is missing, downloads what is not here.
 *
 * Uploads BEFORE downloading, so the history that comes down already has
 * what this device just sent.
 *
 * An error in one match does not interrupt the others: a bar table's network
 * drops in the middle of anything, and a match that failed today goes up
 * tomorrow on its own, because it is still on the device.
 *
 * One run at a time. The app calls this at startup, when archiving a match,
 * when someone signs in and from the settings button - two at the same time
 * would upload the same match twice and fight over writing to the disk.
 */
export async function sync({ onProgress } = {}) {
  if (!canSync(cloudEnabled(), cloud.state())) {
    return { uploaded: 0, downloaded: 0, failed: 0, skipped: true };
  }
  if (running) return running;

  running = (async () => {
    const summary = { uploaded: 0, downloaded: 0, failed: 0, skipped: false };
    const report = () => { if (onProgress) onProgress({ ...summary }); };

    // 0. What an older version uploaded and kept on the device goes now: the
    //    server already has it.
    store.dropUploaded();

    // 1. Upload. Each confirmed match leaves the device right away, so a
    //    network that drops halfway leaves the rest waiting here, intact.
    const pending = toUpload(store.getDB().history, store.uploadedIds(), []);
    for (const match of pending) {
      try {
        await cloud.uploadMatch(match);
        store.moveToCloud(match);
        summary.uploaded += 1;
      } catch {
        summary.failed += 1; // stays on the device: tries again next time
      }
      report();
    }

    // 2. Download, into memory only. Without a subscription the server
    //    returns an empty list - it is not an error, it is the gate working.
    //
    //    The whole list replaces the previous one, so a match deleted on
    //    another device simply stops coming: there is no local copy left to
    //    reconcile.
    if (store.cloudStatus() !== 'ok') store.setCloudStatus('loading');
    try {
      const remote = await cloud.downloadMatches();
      summary.downloaded = toDownload(store.matches(), remote).length;
      store.setCloudMatches(remote);

      // The account's own decks, in both directions.
      await syncMyDecks();

      // Learning who is who from what came in.
      //
      // Runs over ALL the remote matches, not only the new ones: a match this
      // device already had may have been tagged on the other one LATER, and
      // that is precisely the information we want.
      await learnWhoIsWho(remote);
    } catch {
      if (store.cloudStatus() !== 'ok') store.setCloudStatus('failed');
      summary.failed += 1;
    }

    // 2b. Who changed @. The matches keep the @ the seat had that day; the
    //     server says which one it is today, and the statistics start seeing a
    //     single person. Failing here (no network, database without sql/010)
    //     only postpones the consolidation to the next pass.
    try {
      const learned = await refreshHandles();
      // Someone's chosen name or @ changed: the screens that show people
      // need a redraw (see the caller in app.js).
      summary.people = learned.handles + learned.names;
    } catch {
      /* next time */
    }

    report();
    return summary;
  })();

  try {
    return await running;
  } finally {
    running = null;
  }
}

/**
 * My decks follow my account.
 *
 * Downloads first: the device keeps no history of its own once it is in the
 * cloud, and before the first download this is the only source. Then uploads what this device saw, already merged with
 * what came down - the union is what stays in the profile.
 *
 * Failing here does not take down the sync. The most likely failure is the
 * column not existing (sql/004-account-decks.sql not run), and in that case
 * the app carries on as before: decks from the local history.
 */
async function syncMyDecks() {
  const profile = cloud.myProfile();
  if (!profile || !profile.handle) return;

  // This app channel's column: `decks` in production, `decks_beta` in beta.
  // Reading the wrong column would mix the two lists in the deck picker,
  // which is exactly what separating the channels exists to prevent.
  const column = cloud.decksColumn(channel());
  const inProfile = profile[column];

  if (Array.isArray(inProfile)) {
    store.saveAccountDecks(profile.handle, inProfile);
  }

  const mine = store.decksOfPlayer(null, profile.handle);
  if (!mine.length) return;
  if (!decksChanged(mine, inProfile)) return;

  try {
    await cloud.saveMyDecks(mine);
  } catch { /* missing column or network: next pass */ }
}

/**
 * Applies the aliases learned from what came from the cloud.
 *
 * Failing to read the trust list cannot take down the sync: without it, the
 * device can still learn from its own matches - which is the case of whoever
 * uses two devices with the same account, the most common scenario of all.
 */
async function learnWhoIsWho(remote) {
  const me = cloud.currentUser();
  let trusted = [];
  try {
    trusted = await cloud.trustedHosts();
  } catch { /* carries on with only our own */ }

  const learned = learnedAliases(remote, me && me.id, trusted);
  for (const { name, handle } of learned) {
    store.learnAlias(name, handle);
  }
}

/**
 * Deletes a match here AND there.
 *
 * The privacy policy promises that deleting does not depend on a
 * subscription, and the database allows it - but the promise only holds if the
 * app actually asks. Deleting only on the device would leave the cloud copy
 * alive, contradicting the text.
 *
 * The local one goes first - the waiting copy or the one in memory: if the
 * network fails, the person sees the result they asked for, and the cloud row
 * waits for the next attempt instead of blocking the action.
 */
export async function deleteMatchEverywhere(matchId) {
  store.deleteMatch(matchId);
  store.forgetUploaded(matchId);
  if (!canSync(cloudEnabled(), cloud.state())) return false;
  try {
    await cloud.deleteRemoteMatch(matchId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Links a NAME to an account, and rewrites the whole history.
 *
 * It is the heart of attribution. Before, tagging the account wrote the handle
 * into one seat of one match and the rest of the history leaned on the
 * device's alias map - which fixed the statistics here and did not travel: on
 * the other device those matches stayed orphaned, because the map is local and
 * their payload never got the handle.
 *
 * Now the handle is written into EVERY match where the person shows up, and
 * the ones already in the cloud are resent. The link moves into the data,
 * and the data travels - and the other device learns it when downloading (see
 * learnedAliases).
 *
 * It also takes the other names this device already linked to that @: whoever
 * tagged "Alexandre" yesterday and tags "Alex" today sees both halves join
 * now, and not only from here on.
 *
 * Tagging later is the common case: the table is playing, nobody wants to
 * fiddle with settings. Two things happen, and it is worth knowing which is
 * which:
 *
 *   - the invite IS sent. That is the part that matters: the person receives
 *     the match and decides whether to accept. It works even for old matches;
 *   - the mark in the match BODY lasts only this session for matches that are
 *     already in the cloud - the device's alias map is what keeps joining
 *     them in the statistics. The matches table has no update policy, on
 *     purpose - a finished match is not rewritten, and that is what makes the
 *     statistics trustworthy. Opening an exception for a label would open it
 *     for the rest.
 */
export async function linkAccount(name, profile) {
  if (!profile || !profile.handle) return { ok: false };
  const clean = String(name || '').trim();
  if (!clean) return { ok: false };

  // The device learns that this name is this account. Comes BEFORE the
  // backfill because it is what gathers the other names that already pointed
  // to the same @.
  store.rememberHandle(clean, profile.handle);

  const names = new Set([
    clean.toLowerCase(),
    ...store.namesOfPerson(profile.handle),
  ]);

  // The match in progress comes along: leaving it out would record today's
  // table with the old identity, and it would be the first to diverge.
  const inProgress = store.getCurrent();
  const history = store.matches();
  const all = inProgress ? [inProgress, ...history] : history;

  const { targets, ambiguous } = seatsToLink(all, names, profile.handle);

  const changed = [];
  for (const { matchId, seatId } of targets) {
    const m = all.find((x) => x.id === matchId);
    const seat = m && (m.seats || []).find((x) => x.id === seatId);
    if (!seat) continue;
    seat.handle = profile.handle;
    seat.userId = profile.id || null;
    if (inProgress && m.id === inProgress.id) store.setCurrent(m);
    else store.updateMatch(m);
    changed.push(m);
  }

  const result = {
    ok: true,
    invited: false,
    changed: changed.length,
    ambiguous: ambiguous.length,
  };
  if (!canSync(cloudEnabled(), cloud.state())) return result;

  // Resends what changed. `uploadMatch` covers both cases: the match already
  // being there (ignored as a duplicate) and not being there yet. Without it
  // existing, there is nothing to attach the invite to - there is a foreign
  // key.
  //
  // One failure per match cannot take down the others: what does not go up
  // now stays on the device, and the next sync picks it up.
  let invited = false;
  for (const m of changed) {
    if (inProgress && m.id === inProgress.id) continue; // table not finished
    try {
      await cloud.uploadMatch(m);
      store.moveToCloud(m);
      invited = true;
    } catch { /* next sync */ }
  }

  return { ...result, invited };
}

/**
 * Tags the account of a seat, from a match's details.
 *
 * Checks what only makes sense in the context of that table - the same
 * account cannot take two seats - and delegates the rest to linkAccount, which
 * handles the person and not the seat.
 */
export async function tagPlayer(match, seatId, profile) {
  if (!match || !profile || !profile.handle) return { ok: false };
  const seat = (match.seats || []).find((s) => s.id === seatId);
  if (!seat) return { ok: false };

  const alreadyHere = (match.seats || []).some(
    (s) => s !== seat
      && String(s.handle || '').toLowerCase() === String(profile.handle).toLowerCase(),
  );
  if (alreadyHere) return { ok: false, reason: 'duplicate' };

  return linkAccount(seat.name, profile);
}
