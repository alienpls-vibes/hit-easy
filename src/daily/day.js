/**
 * Day arithmetic for the daily challenge, on 'YYYY-MM-DD' keys.
 *
 * Apart from schedule.js on purpose: the home button needs "what day is it"
 * to draw its dot, and importing schedule.js would pull in calendar.js - the
 * file people edit by hand. A typo there must break the challenge, never the
 * home screen.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' of a moment, in the device's local time. */
export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** Is this a real calendar date written as 'YYYY-MM-DD'? */
export function isDayKey(key) {
  const m = DATE_RE.exec(String(key || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Whole days from one key to another (negative when `to` is earlier). */
export function daysBetween(from, to) {
  const at = (key) => {
    const m = DATE_RE.exec(key);
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  };
  return Math.round((at(to) - at(from)) / DAY_MS);
}

/** The key of the day before. */
export function previousDay(key) {
  const m = DATE_RE.exec(key);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - DAY_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

/** Milliseconds until the next local midnight - when the next card arrives. */
export function msUntilNextDay(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
