/**
 * Statistics - the entry point of the subsystem.
 *
 * Nothing here touches the DOM, on purpose: if this ever becomes React or
 * React Native, this subsystem goes along unchanged. That is also why it is
 * the part the tests reach entirely.
 *
 * The pieces live in src/stats/:
 *
 *   aggregate.js   the history turned into numbers per deck and per player
 *   match.js       a single match: summary, timeline, total damage
 *   rivalries.js   the same log read per pair of players
 *   votes.js       choices in votes, grouped by question
 *   sort.js        which number the list is sorted by
 *   colors.js      each person's color
 *   format.js      numbers and dates the way each language writes them
 */

export {
  aggregate, identityOf, labelOf, recordedName, CURRENT_HANDLES, currentHandle, DISPLAY_NAMES, displayNameOf, seatName,
} from './stats/aggregate.js';
export { SORTS, sortById, sortRows } from './stats/sort.js';
export {
  summarize, timeline, totalDamage,
} from './stats/match.js';
export {
  orientRival, rivalBetween, rivalPeople, rivalries,
} from './stats/rivalries.js';
export {
  voteCategory, voteKey, categoryLabel, voteKeyLabel, voteTitle,
} from './stats/votes.js';
export { playerColor, playerColorOrder } from './stats/colors.js';
export { formatDate, formatDuration, num, pct } from './stats/format.js';
