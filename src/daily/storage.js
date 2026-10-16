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
  const s = read(STATE_KEY, null) || fresh();
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
  } catch { /* nothing stored */ }
}
