/**
 * The account rules, with no network and no state.
 *
 * Everything here is a function from input to output: what state the account
 * is in, whether the subscription is valid, whether the session expires, how a
 * match becomes a database row and back. That is why it is the part the tests
 * reach without any server - and the reason it lives in its own file, rather
 * than at the end of another.
 *
 * Nothing here imports http.js or account.js. If it ever does, it stopped
 * being a rule and became behavior.
 *
 * Database names (tables, columns, values such as 'producao' or the invite
 * statuses) are Portuguese in the schema and stay that way here.
 */

import { PRODUCTION } from '../channel.js';

/**
 * Which state the account is in. The whole interface is drawn from this.
 *
 *   'off'           cloud not configured - the app runs locally, as before
 *   'signed-out'    there is a cloud, but nobody signed in
 *   'unsubscribed'  signed in, but not subscribed: saves matches, cannot read
 *   'subscriber'    full access
 */
export function accountState({ enabled, session, subscription }) {
  if (!enabled) return 'off';
  if (!session || !session.access_token) return 'signed-out';
  return isSubscriptionActive(subscription) ? 'subscriber' : 'unsubscribed';
}

/**
 * Can this person open the statistics?
 *
 * Without a configured cloud the app runs as it always did - local, no
 * account, no billing - and locking there would protect nothing: the data is
 * on the device of whoever is looking.
 *
 * With a cloud, the answer is the subscription. There is no "signed-out sees
 * what is theirs" case: signing out would be enough to open the door, and a
 * gate that opens when avoided is no gate.
 *
 * This is the SCREEN. The real gate is the Postgres RLS, which returns an
 * empty list to non-subscribers - deleting this function through devtools
 * hands over no match at all.
 */
export function canSeeStats(enabled, state) {
  if (!enabled) return true;
  return state === 'subscriber';
}

/**
 * A subscription is valid until one day after the end of the period.
 *
 * The grace exists because cards fail: Stripe retries within a few hours, and
 * dropping access in the meantime would punish someone in good standing for a
 * problem at the issuing bank.
 */
export function isSubscriptionActive(subscription, now = Date.now()) {
  if (!subscription || subscription.status !== 'active') return false;
  if (!subscription.current_period_end) return true;
  const end = new Date(subscription.current_period_end).getTime();
  return Number.isFinite(end) && end > now - 24 * 60 * 60 * 1000;
}

/** An expired session is as useless as none. */
export function isSessionValid(session, now = Date.now()) {
  if (!session || !session.access_token) return false;
  if (!session.expires_at) return true;
  return session.expires_at * 1000 > now;
}

/** The match the way the database stores it. */
export function toRow(match, ownerId, channel) {
  return {
    id: match.id,
    owner: ownerId,
    started_at: new Date(match.startedAt).toISOString(),
    // Which channel this match was played on. A column, and not something
    // inside the payload: reads filter by it, and the database does not index
    // what is buried in a jsonb.
    //
    // With no explicit value the database would default to 'producao', which
    // is right for the old rows and exactly wrong for a test match: beta would
    // upload stamped as real.
    canal: channel || PRODUCTION,
    // `redo` is screen state, not history. `owner` is a column: storing it
    // again inside the payload would create a second truth about who recorded
    // it.
    payload: { ...match, redo: [], owner: undefined },
  };
}

/**
 * The way back.
 *
 * Brings `owner` along, from the COLUMN. Whoever recorded the match decides
 * whether something can be learned from it (see learnedAliases in sync.js):
 * from your own match and from a trusted host, yes; from a stranger, no.
 * Without this field there would be no way to ask that question.
 */
export function fromRow(row) {
  return { ...row.payload, id: row.id, owner: row.owner || null };
}

/**
 * What still needs to go up.
 *
 * A finished match is immutable, so comparing by id is enough - there is no
 * version and no conflict to resolve. That is what makes this sync so simple.
 */
export function pendingUploads(local, remoteIds) {
  const remote = new Set(remoteIds || []);
  return (local || []).filter((m) => m && m.id && !remote.has(m.id));
}

/**
 * Does this session need to be refreshed now?
 *
 * The margin exists because the token can expire BETWEEN the decision and the
 * request reaching the server. One minute covers a slow network and a device
 * clock that is off, which is common enough to matter.
 */
export function needsRefresh(s, now = Date.now(), margin = 60000) {
  if (!s || !s.refresh_token) return false;
  if (!s.expires_at) return false;
  return s.expires_at * 1000 - margin <= now;
}

/**
 * Is the session still good for anything?
 *
 * Expired WITH a refresh_token is not a lost session - it is a session to
 * refresh. Treating the two as the same thing is what made a sign-in last one
 * hour and then demand a new email.
 */
export function isSessionUsable(s, now = Date.now()) {
  if (!s || !s.access_token) return false;
  return isSessionValid(s, now) || Boolean(s.refresh_token);
}

/**
 * What was stored on disk becomes a session - or not.
 *
 * Separate from whoever reads localStorage so the test reaches the DECISION,
 * not just the loose rule. This is exactly where the session used to die: the
 * old version required isSessionValid() and threw away anything that had
 * expired, refresh_token included. A correct rule kept somewhere nobody
 * consults fixes nothing, and a test that only exercises the rule would not
 * have noticed.
 */
export function sessionFromStorage(raw, now = Date.now()) {
  try {
    const s = raw ? JSON.parse(raw) : null;
    return isSessionUsable(s, now) ? s : null;
  } catch {
    return null;
  }
}

/** A password that is too short does not even leave the device: the server would refuse it anyway. */
export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordValid(v) {
  return String(v == null ? '' : v).length >= MIN_PASSWORD_LENGTH;
}

/**
 * The format of an @.
 *
 * It must match EXACTLY the handle_formato constraint in
 * sql/002-participants.sql. If they diverge, the database refuses with a raw
 * 400 and the person is left looking at an error that explains nothing. An
 * automatic check in tools/check-syntax.js compares the two.
 */
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/** Everything lowercase, no @ and no spaces - "@Alex" and "alex" are the same person. */
export function normalizeHandle(h) {
  return String(h == null ? '' : h).trim().replace(/^@+/, '').toLowerCase();
}

export function isHandleValid(h) {
  return HANDLE_RE.test(normalizeHandle(h));
}

/** How the @ shows on screen. */
export function displayHandle(h) {
  const n = normalizeHandle(h);
  return n ? '@' + n : '';
}

/**
 * What an @ is to me: the one I already use, a free one, or another account's.
 *
 * `found` is what the search returned (or null). The search resolves an OLD @
 * to its current owner, so "found an account" is not enough to say taken:
 *
 *   found me, with the same @       'current' - the one I already use; nothing to change
 *   found me, with another @        'free'    - an old @ of mine, I can go back to it
 *   found another account           'taken'   - current or old, it is someone else's
 *   found nothing                   'free'
 *
 * The first case used to say "free", and the person saw their own @ offered
 * as if it were a new name.
 */
export function handleStatus(requested, found, myId) {
  if (!found) return 'free';
  if (!myId || found.id !== myId) return 'taken';
  return normalizeHandle(found.handle) === normalizeHandle(requested) ? 'current' : 'free';
}

/** How many days apart the @ can change. The rule is enforced in the database (sql/009). */
export const HANDLE_CHANGE_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When this profile can change @ again: the instant, or null if it already can.
 *
 * A copy of the database rule only so the screen can warn ahead - the trigger
 * is what decides. A profile with no date (someone who had an @ before the
 * rule) can change.
 */
export function nextHandleChange(profile, now = Date.now()) {
  const since = profile && profile.handle && profile.handle_trocado_em
    ? Date.parse(profile.handle_trocado_em)
    : NaN;
  if (!Number.isFinite(since)) return null;
  const unlocked = since + HANDLE_CHANGE_DAYS * DAY_MS;
  return now < unlocked ? unlocked : null;
}

/** The size that fits in a player's panel at the table - the same as the typed name. */
export const NAME_MAX = 18;

/**
 * The name shown in matches, the way the person wrote it.
 *
 * Free in form: capitals, accents, punctuation, emoji. Only what is not
 * writing is removed - control characters, extra spaces, invisible characters
 * that reverse or hide text - and it is cut to size, counting by code point,
 * like the database's `char_length`. U+200D stays: it is what joins composed
 * emojis.
 */
export function normalizeName(text) {
  const clean = String(text == null ? '' : text)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u2028-\u202e\u2060-\u206f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...clean].slice(0, NAME_MAX).join('').trim();
}

/**
 * The seats that become invites.
 *
 * Only seats tagged with an @ count. The others stay free text, as they always
 * were: the vast majority of tables will never create an account, and the app
 * cannot get worse for them.
 */
export function participantsOf(match, channel) {
  if (!match || !match.id) return [];
  return (match.seats || [])
    .filter((s) => s && s.id && isHandleValid(s.handle))
    .map((s) => ({
      match_id: match.id,
      seat_id: s.id,
      user_id: s.userId || null,
      handle: normalizeHandle(s.handle),
      // The same channel as the match. Without this, a seat tagged at a test
      // table would become an invite visible in the real app - the test
      // channel writing into someone else's life.
      canal: channel || PRODUCTION,
    }));
}

/**
 * Joins the invite with the match it refers to.
 *
 * The invite always arrives; the match only comes if the person subscribes.
 * That is why `match` can be null here - and it is not an error, it is the
 * gate working. A non-subscriber sees that three matches are waiting, without
 * seeing what is inside them.
 */
export function buildInvites(rows, matches) {
  const byId = new Map((matches || []).map((m) => [m.id, m]));
  return (rows || [])
    .filter((l) => l && l.match_id)
    .map((l) => ({
      matchId: l.match_id,
      seatId: l.seat_id,
      status: l.status,
      handle: l.handle,
      match: byId.get(l.match_id) || null,
    }));
}
