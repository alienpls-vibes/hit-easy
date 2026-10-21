/**
 * What the daily challenge keeps on the device.
 *
 * Its own localStorage keys, apart from the app's database (`mtglc.db.v1`):
 * the challenge never reads or writes the matches, and wiping its keys can
 * never touch a life total. Both keys go through storageKey(), so beta and
 * production keep separate progress, like everything else.
 *
 *   mtglc.daily.v1       settings and the result of each day played
 *   mtglc.dailyCard.v1   the last cards fetched, so a reopen works offline
 *
 * These names are now a stored contract, like the ones listed in CLAUDE.md:
 * renaming them resets everyone's streak.
 */

import { storageKey } from '../channel.js';

const STATE_KEY = storageKey('mtglc.daily.v1');
const CARD_KEY = storageKey('mtglc.dailyCard.v1');
const UNREADABLE_KEY = STATE_KEY + '.unreadable';
const MAX_DAYS = 400;  // a bit over a year of history
const MAX_CARDS = 6;   // today's card in a few languages

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * A stored state that cannot be read is put aside, never written over.
 *
 * load() falls back to a fresh state, and the next save would replace the
 * old one for good - a whole history lost to one bad read. The raw text goes
 * to a key of its own first (only once: a second bad read must not replace
 * the first copy), so it can still be recovered by hand.
 */
function keepUnreadable() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw === null) return;
    let ok = false;
    try { const v = JSON.parse(raw); ok = Boolean(v && typeof v === 'object'); } catch { /* not JSON */ }
    if (!ok && localStorage.getItem(UNREADABLE_KEY) === null) localStorage.setItem(UNREADABLE_KEY, raw);
  } catch { /* storage blocked: nothing to keep */ }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage full or blocked: the game goes on, unsaved
  }
}

function fresh() {
  return { settings: { cardLang: null, notify: false }, days: {} };
}

/** The whole state, always with both branches present. */
export function load() {
  const stored = read(STATE_KEY, null);
  if (!stored) keepUnreadable();
  const s = stored || fresh();
  if (!s.settings || typeof s.settings !== 'object') s.settings = fresh().settings;
  if (!s.days || typeof s.days !== 'object') s.days = {};
  return s;
}

function save(s) {
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete s.days[k];
  return write(STATE_KEY, s);
}

export function settings() {
  return load().settings;
}

export function setSetting(name, value) {
  const s = load();
  s.settings[name] = value;
  save(s);
}

/** The record of one day, or null when it was never opened. */
export function day(key) {
  return load().days[key] || null;
}

/** Writes one day's record, merged over what is there. */
export function saveDay(key, record) {
  const s = load();
  s.days[key] = { ...(s.days[key] || {}), ...record };
  save(s);
  return s.days[key];
}

export function allDays() {
  return load().days;
}

/**
 * Which of two records of the same day to keep: a finished day beats an
 * unfinished one, and between two unfinished ones, the one with more tries.
 * Between two finished ones, the one already here (a day is played once).
 */
export function betterDay(mine, theirs) {
  if (!theirs || typeof theirs !== 'object') return mine || null;
  if (!mine || typeof mine !== 'object') return theirs;
  if (mine.done) return mine;
  if (theirs.done) return theirs;
  const tries = (r) => (Array.isArray(r.guesses) ? r.guesses.length : 0);
  return tries(theirs) > tries(mine) ? theirs : mine;
}

/**
 * Joins days from elsewhere (a backup file, the account) into this device.
 * Nothing here is ever lost: each day keeps the better record. Returns
 * how many days changed.
 */
export function mergeDays(incoming) {
  if (!incoming || typeof incoming !== 'object') return 0;
  const s = load();
  let changed = 0;
  for (const [key, record] of Object.entries(incoming)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !record || typeof record !== 'object') continue;
    const kept = betterDay(s.days[key], record);
    if (kept !== s.days[key]) { s.days[key] = kept; changed += 1; }
  }
  if (changed) save(s);
  return changed;
}

/** Was today's challenge already finished? The home button uses it for its dot. */
export function isDone(key) {
  const d = day(key);
  return Boolean(d && d.done);
}

/* ---------------------------------------------------------------- */
/* The cards                                                         */
/* ---------------------------------------------------------------- */

const cardId = (date, lang) => date + '|' + lang;

export function cachedCard(date, lang) {
  const all = read(CARD_KEY, {});
  const hit = all[cardId(date, lang)];
  return hit ? hit.card : null;
}

export function cacheCard(date, lang, card) {
  const all = read(CARD_KEY, {});
  all[cardId(date, lang)] = { ts: Date.now(), card };
  const kept = Object.entries(all).sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_CARDS);
  write(CARD_KEY, Object.fromEntries(kept));
}

/** Test helper and "start over": forgets the progress, never the matches. */
export function reset() {
  try {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(CARD_KEY);
    localStorage.removeItem(UNREADABLE_KEY);
  } catch { /* nothing stored */ }
}
