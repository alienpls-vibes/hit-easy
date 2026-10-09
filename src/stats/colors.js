/**
 * Each person's color.
 *
 * It comes from their position in a queue ordered by FIRST APPEARANCE in the
 * history, spread over the color wheel with the golden angle (137.5 degrees) -
 * so each new color falls into the largest gap left and they never cluster.
 *
 * By first appearance, not alphabetical, because adding an "Ana" would change
 * the color of everyone after her - and the whole point of the color is
 * recognizing the same person across matches.
 */

import { seriesColor } from '../colors.js';
import { identityOf } from './aggregate.js';

/**
 * Each player's position in the color queue, by FIRST APPEARANCE in the
 * history.
 *
 * The order has to be stable: if it were alphabetical, adding an "Ana" would
 * change the color of everyone after her, and the whole point of the color is
 * recognizing the same person across matches. By first appearance, whoever
 * arrives later just gets the next number in the queue and nobody before them
 * moves.
 */
export function playerColorOrder(matches, aliases = null) {
  const order = new Map();
  const oldestFirst = [...(matches || [])].sort(
    (a, b) => (a.startedAt || 0) - (b.startedAt || 0),
  );
  for (const match of oldestFirst) {
    for (const seat of match.seats || []) {
      const key = identityOf(seat, aliases);
      if (key && key !== '?' && !order.has(key)) order.set(key, order.size);
    }
  }
  return order;
}

/**
 * Shortcut: the color of an identity, given the order already computed.
 *
 * It takes the KEY, not the name shown on screen - if it took the name, the
 * same person would change color when added under another name, which is
 * exactly what we want to avoid.
 */
export function playerColor(order, key) {
  const k = String(key || '').trim().toLowerCase();
  return seriesColor(order.has(k) ? order.get(k) : 0);
}
