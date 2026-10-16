/**
 * Which card is today's challenge.
 *
 * The day turns at the device's local midnight: a person in Brazil expects
 * the new challenge when their own day starts, not at 21:00 because UTC said
 * so. Two friends in different time zones can see different cards for a few
 * hours, which is fine for a game nobody ranks.
 *
 * Pure on purpose - every function takes the date and the calendar as
 * arguments, so the tests can walk any day without touching the clock.
 */

import { CALENDAR } from './calendar.js';
import { daysBetween } from './day.js';

export {
  dayKey, isDayKey, daysBetween, previousDay, msUntilNextDay,
} from './day.js';

/**
 * Turns a calendar line into the entry the game uses.
 * A line is `['YYYY-MM-DD', "Card name"]`, optionally with a third item: a
 * list of extra words to hide (see calendar.js).
 */
function entryOf(line) {
  return {
    date: line[0],
    name: line[1],
    hide: Array.isArray(line[2]) ? line[2] : [],
  };
}

/**
 * The challenge of a day.
 *
 * A date listed in the calendar gets its own card. A date outside it - before
 * the first line, or after the list runs out - still gets one: the list is
 * walked in a loop, counting days from the first line. The game never shows
 * "no challenge today" because someone forgot to extend the list; it repeats
 * a card from months ago instead, and the tests warn when the end is near.
 *
 * `number` is the challenge's running number (#1 is the first line's day), the
 * label people use to talk about "today's" card.
 */
export function challengeFor(key, calendar = CALENDAR) {
  if (!calendar.length) return null;
  const first = calendar[0][0];
  const listed = calendar.find((line) => line[0] === key);
  const offset = daysBetween(first, key);
  const line = listed
    || calendar[((offset % calendar.length) + calendar.length) % calendar.length];
  return { ...entryOf(line), date: key, number: offset + 1, listed: Boolean(listed) };
}

/** The last date the calendar covers, so the tests can warn before it ends. */
export function lastListedDay(calendar = CALENDAR) {
  return calendar.length ? calendar[calendar.length - 1][0] : null;
}
