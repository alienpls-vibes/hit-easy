/**
 * Which number the deck or player list is sorted by.
 *
 * A rule is `{ id, field, descending, label }`: the field of the aggregated
 * row, whether the top is the largest or the smallest value, and the
 * translation key of the name. Keeping all four together is what prevents the
 * case that already happened in another list: the screen showing "best
 * placing" and sorting from worst to best, because the label and the direction
 * lived in different files.
 *
 * Placing is the only one that goes up: first place is 1, so the best is the
 * SMALLEST.
 *
 * The tiebreaker is always relevance, not the order the aggregation returned.
 * With `games`, half the group ties on two matches; without an explicit
 * tiebreaker the list depended on the Map's insertion order, which changes
 * when an old match is deleted - the person would see the list reshuffle on
 * its own without anything having changed in that number.
 */

import { byRelevance } from './aggregate.js';

export const SORTS = [
  // The default is what the screen always did: rate first, matches on a tie.
  { id: 'relevance', field: null, descending: true, label: 'stats.sortRelevance' },
  { id: 'matches', field: 'games', descending: true, label: 'stats.sortMatches' },
  { id: 'wins', field: 'wins', descending: true, label: 'stats.sortWins' },
  { id: 'winrate', field: 'winrate', descending: true, label: 'stats.sortWinrate' },
  { id: 'damage', field: 'avgDamageDealt', descending: true, label: 'stats.sortDamage' },
  { id: 'kills', field: 'avgKills', descending: true, label: 'stats.sortKills' },
  { id: 'place', field: 'avgPlace', descending: false, label: 'stats.sortPlace' },
];

/** The rule for an id, or the default when the id no longer exists. */
export function sortById(id) {
  return SORTS.find((o) => o.id === id) || SORTS[0];
}

/**
 * Sorts a list of aggregated rows by one of the rules.
 *
 * Returns a new list: the screen calls this on every repaint, and sorting in
 * place would shuffle the `agg` the other tabs are reading.
 */
export function sortRows(rows, id) {
  const rule = sortById(id);
  const copy = [...(rows || [])];
  if (!rule.field) return copy.sort(byRelevance);

  return copy.sort((a, b) => {
    const va = Number(a[rule.field]) || 0;
    const vb = Number(b[rule.field]) || 0;
    if (va !== vb) return rule.descending ? vb - va : va - vb;
    return byRelevance(a, b);
  });
}
