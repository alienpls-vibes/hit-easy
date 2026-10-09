/**
 * Rivalries: the same log read per PAIR of players.
 *
 * None of this had to be stored. Ever since damage became directional, each
 * event already carries who dealt it and who took it - here the aggregation
 * just looks from another angle. Damage with no dealer (life paid) creates no
 * rivalry with anyone.
 */

import { replay } from '../engine.js';
import { identityOf, labelOf } from './aggregate.js';

function emptySide() {
  return { damage: 0, cmdDamage: 0, poison: 0, kills: 0, hits: 0 };
}

/**
 * Who hits whom, added up per pair of PLAYERS across every match.
 *
 * None of it needs to be stored: every damage event has carried who dealt it
 * and who took it since damage became directional. Here we just read the log
 * from another angle - per pair, not per person.
 *
 * The pair is kept in alphabetical order so that A-B and B-A land on the same
 * row, and each direction adds up on its own side.
 */
export function rivalries(matches, aliases = null) {
  const pairs = new Map();

  const keyOf = (a, b) => (a < b ? a + '\u0000' + b : b + '\u0000' + a);

  for (const match of matches) {
    if (!match || !match.seats) continue;

    // A rivalry is between PEOPLE. Pairing by name would make "Alex vs Bruno"
    // and "Alexandre vs Bruno" two separate rivalries, each counting half the
    // story.
    const who = {};
    const label = {};
    for (const seat of match.seats) {
      who[seat.id] = identityOf(seat, aliases);
      label[seat.id] = labelOf(seat, aliases);
    }

    const pairFor = (fromId, toId) => {
      const from = who[fromId];
      const to = who[toId];
      if (!from || !to || from === to) return null;

      const k = keyOf(from, to);
      if (!pairs.has(k)) {
        const [ka, kb] = from < to ? [from, to] : [to, from];
        const [first, second] = from < to
          ? [label[fromId], label[toId]]
          : [label[toId], label[fromId]];
        pairs.set(k, {
          a: first, b: second, keyA: ka, keyB: kb,
          games: 0, total: 0,
          aToB: emptySide(), bToA: emptySide(),
          _matches: new Set(),
        });
      }
      const row = pairs.get(k);
      row._matches.add(match.id);
      return { row, side: from === row.keyA ? row.aToB : row.bToA };
    };

    const add = (fromId, toId, field, amount) => {
      const target = pairFor(fromId, toId);
      if (!target) return;
      target.side[field] += amount;
      target.side.hits += 1;
      if (field !== 'kills') target.row.total += amount;
    };

    for (const ev of match.events || []) {
      switch (ev.type) {
        case 'life':
          if (ev.sourceId && ev.delta < 0) add(ev.sourceId, ev.targetId, 'damage', -ev.delta);
          break;
        case 'cmd':
          if (ev.sourceId && ev.delta > 0) {
            add(ev.sourceId, ev.targetId, 'damage', ev.delta);
            const target = pairFor(ev.sourceId, ev.targetId);
            if (target) target.side.cmdDamage += ev.delta;
          }
          break;
        case 'poison':
          if (ev.sourceId && ev.delta > 0) add(ev.sourceId, ev.targetId, 'poison', ev.delta);
          break;
        case 'sweep':
          for (const id of ev.targets || []) {
            if (ev.sourceId) add(ev.sourceId, id, 'damage', ev.amount);
          }
          break;
        default:
          break;
      }
    }

    // Eliminations: who dealt the final blow to whom.
    const state = replay(match);
    for (const seat of match.seats) {
      const p = state.players[seat.id];
      if (p.elim && p.elim.byId) add(p.elim.byId, seat.id, 'kills', 1);
    }
  }

  return [...pairs.values()]
    .map((row) => {
      const { _matches, ...rest } = row;
      return { ...rest, games: _matches.size };
    })
    .sort((x, y) => y.total - x.total);
}

/**
 * Who shows up in some rivalry, to populate the filters.
 *
 * It comes from the rivalries THEMSELVES and not from the player list:
 * offering someone who never crossed paths with anyone would only produce
 * empty combinations, and the person would be hunting for an existing pair
 * among options that lead nowhere.
 */
export function rivalPeople(pairs) {
  const seen = new Map();
  for (const r of pairs || []) {
    if (!seen.has(r.keyA)) seen.set(r.keyA, { key: r.keyA, label: r.a });
    if (!seen.has(r.keyB)) seen.set(r.keyB, { key: r.keyB, label: r.b });
  }
  return [...seen.values()].sort((x, y) => x.label.localeCompare(y.label));
}

/** The rivalry between two people, in either order. */
export function rivalBetween(pairs, a, b) {
  if (!a || !b || a === b) return null;
  return (pairs || []).find(
    (r) => (r.keyA === a && r.keyB === b) || (r.keyA === b && r.keyB === a),
  ) || null;
}

/**
 * The same pair, seen with a specific person on the left.
 *
 * The rivalry is stored in an internal order (smaller key first), which is
 * what makes "A vs B" and "B vs A" the same row. But on screen the filter is in
 * charge: if the person picked Bruno in the left field, Bruno has to show up
 * on the left side of the chart - otherwise the drawing contradicts the
 * control right above it, and the bar seems to say the opposite of what it
 * says.
 *
 * It swaps both sides entirely: name, key and what each did to the other.
 * Swapping only the name would invert the reading of the damage, which is
 * worse than not swapping.
 */
export function orientRival(pair, leftKey) {
  if (!pair) return null;
  if (!leftKey || pair.keyA === leftKey) return pair;
  if (pair.keyB !== leftKey) return pair; // not from this pair: leave it as is
  return {
    ...pair,
    a: pair.b, keyA: pair.keyB, aToB: pair.bToA,
    b: pair.a, keyB: pair.keyA, bToA: pair.aToB,
  };
}
