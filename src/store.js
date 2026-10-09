/**
 * Local persistence (localStorage) + change notification.
 *
 * We keep the match in progress apart from the history: closing the browser
 * in the middle of a game cannot cost the table. Every write is synchronous
 * and cheap because the volume is small (a few hundred events per match).
 *
 * STORED NAMES. Everything in `EMPTY` below is written to the device, exported
 * in backups and read back by older versions of the app. Several fields have
 * Portuguese names (`enviadas`, `decksDeConta`, `handlesAtuais`,
 * `versaoVista`, `versaoAnterior`) and the theme values are Portuguese
 * ('sistema', 'claro', 'escuro'). Those names are data, not code: renaming
 * them would make every existing device lose that data. Keep them.
 */

import { storageKey } from './channel.js';
import { identityOf, CURRENT_HANDLES, currentHandle } from './stats.js';
import {
  isValidMatch, mergeDecks, handOffTable, receiveTable, reclaimTable, isHandedOff,
} from './engine.js';

const KEY = storageKey('mtglc.db.v1');

const EMPTY = {
  version: 1,
  current: null,
  history: [],
  // Ids of matches that have already gone to the cloud.
  //
  // It exists because non-subscribers CAN upload but cannot download: without
  // this note, on every open the device would think the cloud was empty and
  // resend the whole history, forever.
  enviadas: [],
  commanders: {}, // oracleId -> commander (offline reuse)
  playerNames: [],
  // Player name -> their account's @. A Commander group plays every week with
  // the same people: typing the @ again at every table would be the kind of
  // friction that makes a feature go unused.
  playerHandles: {},
  // @ -> decks that follow that account, from the profile on the server.
  //
  // Only the account itself writes its own list (see
  // sql/004-account-decks.sql), so this caches one thing only: the decks of
  // whoever is signed in. It serves the new device, where the local history
  // is empty.
  decksDeConta: {},
  // Hidden from the statistics, and only from them: the matches stay whole,
  // with every event and the complete timeline.
  hiddenDecks: [],
  hiddenPlayers: [],
  // Old @ -> current @, for whoever changed @. See currentHandle in stats.
  handlesAtuais: {},
  settings: {
    startingLife: 40,
    lang: null,           // null = follow the browser
    theme: 'sistema',     // 'sistema' | 'claro' | 'escuro' (system | light | dark)
    haptics: true,
    keepAwake: true,
    autoRotate: true,     // tries fullscreen + locking landscape during the match
    dragHintSeen: false,
    versaoVista: null,    // last version whose release notes were seen
    // Which version the person came from on the last update.
    //
    // Separate from `versaoVista` because that one is overwritten at startup:
    // without the previous one, opening the notes from the menu would have no
    // way to tell what came in.
    versaoAnterior: null,
  },
};

let db = read();
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    // settings come in through a shallow merge, not a replacement: whoever
    // used the app before a preference existed must inherit its default.
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
      // Heals what already got in.
      //
      // Filtering the entry door protects from here on, but does not clean the
      // device of whoever synced before the fix - and a record without seats
      // takes the screen down every time it opens. Discarding here is safe
      // because a match with no seats or events has nothing to lose: nobody
      // can read it anymore.
      history: (parsed.history || []).filter(isValidMatch),
      // Hidden players become keyed by IDENTITY (see migrateHidden).
      hiddenPlayers: migrateHidden(parsed.hiddenPlayers, parsed.playerHandles),
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

/**
 * Hidden players become keyed by identity, not by the displayed name.
 *
 * The screen hid the label, which was the typed name. When the person got an
 * account their identity became `@handle`, the key stopped matching and the
 * row came back - "hide" undid itself, without anyone asking.
 *
 * Rewrites once, on read. For whoever has no account the identity ALREADY is
 * the lowercase name, so the vast majority of old entries pass through
 * unchanged.
 */
function migrateHidden(hidden, aliases) {
  const seen = new Set();
  for (const entry of hidden || []) {
    const name = String(entry || '').trim().toLowerCase();
    if (!name) continue;
    if (name.startsWith('@')) { seen.add(name); continue; }
    const handle = aliases && aliases[name];
    seen.add(handle ? '@' + String(handle).toLowerCase() : name);
  }
  return [...seen];
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Failed to save local data', err);
  }
  listeners.forEach((fn) => fn(db));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDB() {
  return db;
}

/**
 * The table that can be played right now.
 *
 * A table handed off to another device does NOT count, and that is why this
 * null exists: the baton had to be enforced, and enforcing it with an `if` in
 * the router put the rule on a line someone could delete without anything
 * breaking - the mutation test deleted it and the whole suite passed.
 *
 * This way every path that already handled "there is no open table" handles
 * this case for free, without any of them needing to know the concept.
 * Whoever wants the handed-off table - the home screen, to warn about it -
 * asks through `storedTable()`.
 */
export function getCurrent() {
  return db.current && db.current.passadaEm ? null : db.current;
}

/**
 * The table that is here, handed off or not.
 *
 * Only the home screen uses it, for the warning and for taking it back.
 * Separate from `getCurrent()` because asking for "the table right now" and
 * asking for "the table stored here" are different questions, and mixing the
 * two is what required the guard in the router.
 */
export function storedTable() {
  return db.current;
}

export function setCurrent(match) {
  db.current = match;
  save();
}

export function clearCurrent() {
  db.current = null;
  save();
}

/** Moves the match to the history and frees the table slot. */
export function archive(match) {
  const already = db.history.findIndex((m) => m.id === match.id);
  const record = { ...match, redo: [] };
  if (already >= 0) db.history[already] = record;
  else db.history.unshift(record);
  db.current = null;
  save();
}

/**
 * The history, with only what has the shape of a match.
 *
 * The ENTRY door already filters and reading from disk also heals what got
 * through before. This is the third layer, and it exists because the first two
 * cover known paths: a broken record through a path that does not exist yet
 * would take the whole screen down, and a black screen tells nobody anything.
 * Whoever READS the history to draw it should use this.
 */
export function matches() {
  return (db.history || []).filter(isValidMatch);
}

/** Ids already uploaded to the cloud. */
export function uploadedIds() {
  return [...(db.enviadas || [])];
}

export function markUploaded(matchId) {
  if (!matchId) return;
  if (!db.enviadas) db.enviadas = [];
  if (!db.enviadas.includes(matchId)) {
    db.enviadas.push(matchId);
    save();
  }
}

/** The match was deleted: the mark goes too, otherwise it would never upload again. */
export function forgetUploaded(matchId) {
  if (!db.enviadas || !db.enviadas.includes(matchId)) return;
  db.enviadas = db.enviadas.filter((x) => x !== matchId);
  save();
}

/**
 * Merges matches coming from the cloud into the local history.
 *
 * By id, and without overwriting what already exists: a finished match is
 * immutable, and the local copy may have something the remote one does not if
 * some upload failed halfway. When in doubt, what is already here wins.
 */
export function mergeMatches(list) {
  const here = new Set(db.history.map((m) => m && m.id));
  // Discards what does not have the shape of a match. The history is read by
  // replay() and by the statistics, which assume seats and events - a broken
  // row in here does not sit quietly, it takes the screen down.
  const fresh = (list || []).filter((m) => isValidMatch(m) && !here.has(m.id));
  if (!fresh.length) return 0;
  db.history = [...db.history, ...fresh]
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  save();
  return fresh.length;
}

/**
 * Writes back a match from the history, without touching the match in
 * progress.
 *
 * archive() is for FINISHING - it clears `current` as part of the job. Using
 * archive to edit an old record would wipe the table happening right now,
 * which would be silent and absurd damage.
 */
export function updateMatch(match) {
  if (!isValidMatch(match)) return false;
  const at = db.history.findIndex((m) => m.id === match.id);
  if (at < 0) return false;
  db.history[at] = match;
  save();
  return true;
}

export function deleteMatch(matchId) {
  db.history = db.history.filter((m) => m.id !== matchId);
  save();
}

export function rememberCommander(commander) {
  if (!commander || !commander.oracleId) return;
  db.commanders[commander.oracleId] = { ...commander, lastUsed: Date.now() };
  save();
}

/** Commanders already used, from most recent to oldest. */
export function recentCommanders(limit = 24) {
  return Object.values(db.commanders)
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, limit);
}

export function rememberPlayer(name) {
  const clean = String(name || '').trim();
  if (!clean) return;
  db.playerNames = [clean, ...db.playerNames.filter((n) => n !== clean)].slice(0, 30);
  save();
}

/** Remembers which account a player name corresponds to. */
export function rememberHandle(name, handle) {
  const clean = String(name || '').trim();
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!clean) return;
  if (!db.playerHandles) db.playerHandles = {};
  if (h) db.playerHandles[clean.toLowerCase()] = h;
  else delete db.playerHandles[clean.toLowerCase()];
  save();
}

/** This player's known @, if any. */
export function handleOf(name) {
  const clean = String(name || '').trim().toLowerCase();
  return (db.playerHandles && db.playerHandles[clean]) || '';
}

export function forgetPlayer(name) {
  // The @ goes with the name: forgetting halfway would leave someone else's
  // account attached to a player who is no longer on the list.
  if (db.playerHandles) delete db.playerHandles[String(name || '').trim().toLowerCase()];
  const clean = String(name || '').trim();
  db.playerNames = db.playerNames.filter((n) => n !== clean);
  save();
}

/**
 * Stores the decks that came from that account's profile.
 *
 * By handle, and not in a single list: signing in with another account on the
 * same device cannot mix two people's decks.
 */
export function saveAccountDecks(handle, decks) {
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!h || !Array.isArray(decks)) return;
  if (!db.decksDeConta) db.decksDeConta = {};
  db.decksDeConta[h] = decks
    .filter((d) => d && Array.isArray(d.commanders) && d.commanders.length)
    .slice(0, 200);
  save();
}

/** The decks that follow that account, from what this device already downloaded. */
export function accountDecks(handle) {
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  return (db.decksDeConta && db.decksDeConta[h]) || [];
}

/** Name (lowercase) -> handle, from what this device has already seen. */
export function knownHandles() {
  const aliases = { ...(db.playerHandles || {}) };
  aliases[CURRENT_HANDLES] = { ...(db.handlesAtuais || {}) };
  return aliases;
}

/**
 * Learns that these @s changed: `{ old: current }`.
 *
 * Besides the map the statistics read, it fixes what this device STORES with
 * the old @ - otherwise the next seat tagged through a remembered name would
 * come out with the old @, and hiding someone before the change would stop
 * working after it:
 *
 *   - the aliases (name -> @) start pointing to the current one;
 *   - whoever was hidden as @old stays hidden as @current.
 *
 * Returns how many entries changed. Only saves if something changed.
 */
export function learnCurrentHandles(pairs) {
  const clean = (h) => String(h || '').trim().replace(/^@+/, '').toLowerCase();
  const map = { ...(db.handlesAtuais || {}) };
  let changed = 0;

  for (const [oldRaw, currentRaw] of Object.entries(pairs || {})) {
    const old = clean(oldRaw);
    const current = clean(currentRaw);
    if (!old || !current || old === current || map[old] === current) continue;
    // Whoever switched back to an old @: that @ is no longer "old".
    delete map[current];
    map[old] = current;
    // Whatever pointed to the old one now points straight to the current one.
    for (const k of Object.keys(map)) if (map[k] === old) map[k] = current;
    changed += 1;
  }
  if (!changed) return 0;

  db.handlesAtuais = map;
  const currentOf = (h) => {
    let x = clean(h);
    for (let i = 0; i < 10 && map[x]; i += 1) x = map[x];
    return x;
  };
  const aliases = db.playerHandles || {};
  for (const name of Object.keys(aliases)) {
    if (aliases[name]) aliases[name] = currentOf(aliases[name]);
  }
  db.hiddenPlayers = [...new Set((db.hiddenPlayers || []).map((k) => (
    k.startsWith('@') ? '@' + currentOf(k) : k
  )))];
  save();
  return changed;
}

/** Every @ that shows up on this device - to ask the server which ones changed. */
export function allKnownHandles() {
  const clean = (h) => String(h || '').trim().replace(/^@+/, '').toLowerCase();
  const all = new Set();
  for (const m of db.history || []) {
    for (const s of m.seats || []) if (s && s.handle) all.add(clean(s.handle));
  }
  for (const s of (db.current && db.current.seats) || []) if (s && s.handle) all.add(clean(s.handle));
  for (const h of Object.values(db.playerHandles || {})) if (h) all.add(clean(h));
  for (const k of db.hiddenPlayers || []) if (k.startsWith('@')) all.add(clean(k));
  all.delete('');
  return [...all];
}

/**
 * Stores a LEARNED alias, without overwriting what this device decided.
 *
 * Different from rememberHandle, which is the person tagging by hand. This one
 * comes in through what arrives from the cloud, and then the rule is
 * different: a downloaded match may say "Alexandre" is @alex, but if this
 * device already has "Alexandre" pointing to another account, whoever is here
 * decides. A disagreement is not resolved by guessing - it stays as it is,
 * and the person tags by hand if they want.
 *
 * Returns whether, in the end, the name points to that handle.
 */
export function learnAlias(name, handle) {
  const clean = String(name || '').trim().toLowerCase();
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!clean || !h) return false;
  if (!db.playerHandles) db.playerHandles = {};

  const current = db.playerHandles[clean];
  if (current) return current === h;

  db.playerHandles[clean] = h;
  // Learning the account of someone this device never typed also adds them to
  // the picker list: it is a person the table already knows.
  if (!db.playerNames.some((n) => String(n).trim().toLowerCase() === clean)) {
    db.playerNames = [...db.playerNames, name].slice(0, 30);
  }
  save();
  return true;
}

/**
 * The PEOPLE this device knows - one row per person, not per name.
 *
 * The picker list showed raw `playerNames`, so whoever was typed as "Alex" one
 * Thursday and "Alexandre" the next showed up twice, each with half the decks.
 * Here the names that point to the same account are merged, and the row is
 * called by the @.
 *
 * The order of `playerNames` (most recent first) is preserved: the person
 * inherits the position of their most recent name.
 *
 * Each entry is `{ key, handle, label, names }`.
 */
export function knownPeople() {
  const aliases = knownHandles(); // with the map of changed @s, like the statistics
  const byKey = new Map();

  for (const name of db.playerNames) {
    const clean = String(name || '').trim();
    if (!clean) continue;
    // Same key rule as the statistics, on purpose: if the two diverge, the
    // picker list and the player list talk about different people with the
    // same name on screen.
    const key = identityOf({ name: clean }, aliases);
    if (!byKey.has(key)) {
      const handle = key.startsWith('@') ? key.slice(1) : '';
      byKey.set(key, {
        key,
        handle,
        label: handle ? '@' + handle : clean,
        names: [],
      });
    }
    byKey.get(key).names.push(clean);
  }

  return [...byKey.values()];
}

/** The names this device has already linked to this account. */
export function namesOfPerson(handle) {
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!h) return [];
  const aliases = db.playerHandles || {};
  const withMap = knownHandles();
  const current = currentHandle(h, withMap);
  return Object.keys(aliases).filter((name) => currentHandle(aliases[name], withMap) === current);
}

/**
 * Forgets the PERSON, not one of their names.
 *
 * Forgetting just one name would leave the same person half on the list: the
 * @ would still be known through the other names, and the row would come back
 * on the next open.
 */
export function forgetPerson(key) {
  const target = String(key || '').trim().toLowerCase();
  const person = knownPeople().find((x) => x.key === target);
  for (const name of (person ? person.names : [target])) forgetPlayer(name);
}

/**
 * The decks of this PERSON, not of this name.
 *
 * Decks this player has brought, from most recent to oldest. Derived from the
 * history instead of stored separately: what they played is already written in
 * the saved matches, and duplicating it would only create a second truth to
 * fall out of sync later.
 *
 * With a linked account, the commanders follow the account: whoever was added
 * as "Alex" one Thursday and "Alexandre" the next keeps seeing their own
 * decks, because the lookup is by identity and not by the text someone typed.
 */
export function decksOfPlayer(name, handle) {
  const aliases = knownHandles(); // with the map of changed @s, like the statistics
  const key = identityOf({ name, handle }, aliases);
  if (!key || key === '?') return [];

  const local = [];
  for (const match of db.history) { // history already comes most recent first
    for (const seat of match.seats || []) {
      if (identityOf(seat, aliases) !== key) continue;
      if (!(seat.commanders || []).length) continue;
      local.push({ commanders: seat.commanders, lastUsed: match.startedAt });
    }
  }

  // With an account, the decks that follow the account come along. On a new
  // device the local history is empty, and without this the person cannot
  // find their own deck - having to search Scryfall for a commander the app
  // already knows.
  const fromAccount = key.startsWith('@') ? accountDecks(key.slice(1)) : [];
  return mergeDecks(local, fromAccount);
}

/**
 * Removes a deck or player from the statistics.
 *
 * It does NOT delete any match: the history stays the same, the timeline keeps
 * telling what happened, and the damage this person dealt keeps adding up in
 * the statistics of whoever took it. Only their ROW stops showing - and it can
 * be brought back at any time.
 *
 * That is why this lives here, and not in deleteMatch: they are different
 * things.
 */
export function hideDeck(deckKey) {
  if (!deckKey || db.hiddenDecks.includes(deckKey)) return;
  db.hiddenDecks.push(deckKey);
  save();
}

/**
 * Hides a person from the lists. Takes the IDENTITY, not the label.
 *
 * With the label, hiding undid itself: the person got an account, the label
 * became @alex, the stored key was still "alexandre" and the row came back.
 */
export function hidePlayer(identity) {
  const key = String(identity || '').trim().toLowerCase();
  if (!key || db.hiddenPlayers.includes(key)) return;
  db.hiddenPlayers.push(key);
  save();
}

export function unhideDeck(deckKey) {
  db.hiddenDecks = db.hiddenDecks.filter((k) => k !== deckKey);
  save();
}

export function unhidePlayer(identity) {
  const key = String(identity || '').trim().toLowerCase();
  db.hiddenPlayers = db.hiddenPlayers.filter((k) => k !== key);
  save();
}

export function isDeckHidden(deckKey) {
  return db.hiddenDecks.includes(deckKey);
}

export function isPlayerHidden(identity) {
  return db.hiddenPlayers.includes(String(identity || '').trim().toLowerCase());
}

export function hiddenCount() {
  return db.hiddenDecks.length + db.hiddenPlayers.length;
}

export function setSetting(key, value) {
  db.settings[key] = value;
  save();
}

/**
 * What identifies a handed-off table file.
 *
 * The version is for the day the format changes: an old device receiving a new
 * file needs to say "update the app", not open it halfway.
 *
 * The envelope is shared between devices that may run different versions, so
 * its field names (`formato`, `versao`, `em`, `partida`) and the format string
 * stay exactly as they are.
 */
export const TABLE_FORMAT = 'hit-easy/mesa';
export const TABLE_FORMAT_VERSION = 1;

/**
 * Packs the current table for another device.
 *
 * ONLY the table. The backup exporter sends the whole database, and using it
 * here would hand the friend the whole match history, the @s this device
 * knows and the preferences of whoever passed it. Passing the table is passing
 * a table.
 *
 * Stamps the match as handed off in the same act: packing without letting go
 * would leave two live copies of the same match, which is the only way to lose
 * data here - the upload uses ignore-duplicates, so the first one up wins and
 * the other vanishes without warning.
 */
export function packTable(now = Date.now()) {
  const table = db.current;  // stored: handing off a table already handed off is refused below
  if (!isValidMatch(table)) return null;
  if (!handOffTable(table, now)) return null;
  save();

  return JSON.stringify(envelope(table, now), null, 2);
}

function envelope(table, now) {
  return {
    formato: TABLE_FORMAT,
    versao: TABLE_FORMAT_VERSION,
    em: now,
    partida: table,
  };
}

/**
 * The open table, in the handoff envelope, WITHOUT letting go.
 *
 * The code path happens in two steps, unlike the file: the table goes up, and
 * only if it went up does it leave here (releaseTable). Letting go first
 * would leave the person with no table at all when the network fails - and a
 * bad network is exactly what a table at a friend's house tends to have.
 */
export function tableToSend(now = Date.now()) {
  const table = db.current;
  if (!isValidMatch(table) || isHandedOff(table)) return null;
  return envelope(structuredClone(table), now);
}

/** The table went up with this code: it leaves this device. */
export function releaseTable(code, now = Date.now()) {
  if (!handOffTable(db.current, now, code)) return false;
  save();
  return true;
}

/**
 * Receives an envelope that came from the cloud.
 *
 * Goes through the SAME reading as the file: what comes down from the
 * database was written by any client holding the public key, and deserves the
 * same distrust.
 */
export function readReceivedTable(data) {
  return readTable(JSON.stringify(data));
}

/**
 * Reads a table file, without installing anything.
 *
 * Separate from `installTable` on purpose: the screen needs to know whose
 * table it is and how many turns it has BEFORE asking whether it can replace
 * the match open here.
 *
 * Throws with a readable reason - a file that is not from this app, a whole
 * backup picked by mistake, or a format version this app does not understand
 * are three different errors and deserve three different answers.
 */
export function readTable(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('unreadable');
  }
  if (!data || data.formato !== TABLE_FORMAT) throw new Error('not-a-table');
  if (Number(data.versao) > TABLE_FORMAT_VERSION) throw new Error('newer-version');
  if (!isValidMatch(data.partida)) throw new Error('invalid-table');
  return data;
}

/**
 * Installs the received table as this device's match.
 *
 * Whatever is open here is lost, and the caller has already confirmed that -
 * that is why the confirmation lives on the screen and not here: a function
 * that asks cannot be tested, and one that decides on its own swallows
 * someone's table.
 */
export function installTable(data, now = Date.now()) {
  const received = receiveTable(data.partida, now);
  if (!received) return null;
  db.current = received;
  save();
  return received;
}

/** Undoes the handoff: the table is valid on this device again. */
export function takeTableBack() {
  if (!reclaimTable(db.current)) return false;
  save();
  return true;
}

export function exportJSON() {
  return JSON.stringify(db, null, 2);
}

/** Imports a backup. Merges the history by id, without duplicating matches. */
export function importJSON(text) {
  const incoming = JSON.parse(text);
  if (!incoming || typeof incoming !== 'object') throw new Error('Invalid file');

  const byId = new Map();
  for (const m of [...(db.history || []), ...(incoming.history || [])]) {
    if (isValidMatch(m)) byId.set(m.id, m);
  }
  db = {
    ...structuredClone(EMPTY),
    ...db,
    ...incoming,
    history: [...byId.values()].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)),
    commanders: { ...(db.commanders || {}), ...(incoming.commanders || {}) },
    current: db.current || incoming.current || null,
  };
  save();
  return db;
}

export function wipe() {
  db = structuredClone(EMPTY);
  save();
}
