/**
 * Aggregation: the match history turned into numbers per deck and per player.
 *
 * A single pass over the log of every match. Nothing here is stored - every
 * number comes from the log, always, and that is why fixing an old match fixes
 * the whole statistics without any migration.
 */

import {
  replay, standings, deckKeyOf, deckNameOf, elapsedOf,
} from '../engine.js';
import { KIND_NUMBER } from '../vote.js';
import { voteCategory } from './votes.js';

function blank(key, label, extra = {}) {
  return {
    key,
    label,
    games: 0,
    wins: 0,
    damageDealt: 0,
    damageTaken: 0,
    lifePaid: 0, // life lost with no dealer: a cost paid by the player themselves
    healed: 0,
    cmdDealt: 0,
    cmdTaken: 0,
    poisonDealt: 0,
    poisonTaken: 0,
    kills: 0,
    deaths: 0,
    turnsTaken: 0,
    survivedTurns: 0,
    placeSum: 0,
    timeOnTurn: 0,
    matchTime: 0,
    winReasons: {},  // declared reason -> how many wins that way
    votes: 0,        // how many secret votes this player took part in
    voteChoices: {}, // category -> { chosen label: how many times }
    ...extra,
  };
}

function finalize(row) {
  const g = row.games || 1;
  return {
    ...row,
    winrate: row.games ? row.wins / row.games : 0,
    avgDamageDealt: row.damageDealt / g,
    avgDamageTaken: row.damageTaken / g,
    avgLifePaid: row.lifePaid / g,
    avgHealed: row.healed / g,
    avgKills: row.kills / g,
    avgTurns: row.turnsTaken / g,
    avgSurvived: row.survivedTurns / g,
    avgPlace: row.placeSum / g,
    avgTurnTime: row.turnsTaken ? row.timeOnTurn / row.turnsTaken : 0,
    avgMatchTime: row.matchTime / g,
  };
}

/**
 * The identity of a seat, stable across tables.
 *
 * The statistics used to use the typed NAME, lowercased. That meant "Alex" one
 * Thursday and "Alexandre" the next became two different people, with two
 * rows, two colors and two stories - and the rivalry between them was counted
 * as if they were strangers. The name is what the table calls someone that
 * day; it is not who the person is.
 *
 * When there is a linked account, it is what counts, and the name becomes just
 * a label. The `@` prefix keeps an account called `ana` from colliding with
 * someone who typed "ana" with no account at all - they are different people
 * until proven otherwise.
 *
 * `aliases` is what the DEVICE already knows: name (lowercase) -> handle. It
 * serves matches recorded before @ existed, which then join the right account
 * instead of staying orphaned forever.
 */
export function identityOf(seat, aliases) {
  if (!seat) return '?';
  const h = String(seat.handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (h) return '@' + currentHandle(h, aliases);

  const name = String(seat.name || '').trim().toLowerCase();
  if (name && aliases) {
    const remembered = aliases[name] || (aliases.get ? aliases.get(name) : null);
    if (remembered) {
      return '@' + currentHandle(String(remembered).trim().replace(/^@+/, '').toLowerCase(), aliases);
    }
  }
  return name || seat.id || '?';
}

/**
 * Where the device keeps what it knows about changed @s: `@old -> @current`.
 *
 * It travels INSIDE `aliases`, under a Symbol key, and not as one more
 * parameter: every place that computes identity already receives `aliases`
 * (aggregation, rivalries, colors, the match screen, the people list), and a
 * new parameter would have to be remembered in each of them - whichever one
 * forgot it would split the person again. A Symbol does not show up in
 * Object.keys or in JSON, so whoever walks the aliases as "name -> @" does not
 * trip over it.
 */
export const CURRENT_HANDLES = Symbol('currentHandles');

/**
 * Today's @ of whoever used this @.
 *
 * The history is NOT rewritten: the match keeps the @ the seat had that day,
 * and a match recorded by another host is not even this device's to change.
 * Consolidation happens here, on read - so changing @ does not split anyone
 * into two rows, two colors and two rivalries.
 *
 * Follows the chain (a -> b -> c, someone who changed twice) with a limit, so
 * a map with a cycle does not freeze the screen.
 */
export function currentHandle(handle, aliases) {
  const map = aliases && aliases[CURRENT_HANDLES];
  let h = handle;
  if (!map) return h;
  for (let i = 0; i < 10 && map[h] && map[h] !== h; i += 1) h = map[h];
  return h;
}

/**
 * How this person shows up on screen.
 *
 * With a linked account, the @ - not the typed name. The @ is the only label
 * that means the same thing on every device: the name is what SOMEONE typed
 * that day, and two devices type differently. While the name won here, the
 * same person showed up as "Alex" on one row and "Alexandre" on another even
 * with the identity underneath already unified.
 *
 * `aliases` comes in because the account may not be on the seat but in the
 * device's map (a match recorded before @ existed). In that case the row also
 * shows the @, otherwise the same person would have two labels again.
 *
 * Without an account, the typed name - in its original case, which is how the
 * table writes it.
 */
export function labelOf(seat, aliases) {
  const identity = identityOf(seat, aliases);
  if (identity.startsWith('@')) return identity;

  const name = String((seat && seat.name) || '').trim();
  return name || 'Sem nome';
}

/**
 * The typed name, when it says something the label does not.
 *
 * It feeds the "recorded as" line in the match details: with an account, the
 * screen shows @alex, and this answers "but at that table they wrote
 * Alexandre". Empty when the label already IS the name, because repeating it
 * tells nothing.
 */
export function recordedName(seat, aliases) {
  const name = String((seat && seat.name) || '').trim();
  if (!name) return '';
  return labelOf(seat, aliases) === name ? '' : name;
}

/**
 * Walks the matches a single time and accumulates into two slices:
 * per deck (combination of commanders) and per player (identity).
 */
export function aggregate(matches, aliases = null) {
  const decks = new Map();
  const players = new Map();

  for (const match of matches) {
    if (!match || !match.seats || !match.seats.length) continue;
    const state = replay(match);
    const places = new Map(standings(match, state).map((s) => [s.seatId, s.place]));
    const duration = elapsedOf(match, state, lastTs(match));

    // A seat contributes to its deck's row AND to its player's row.
    const targets = {};
    for (const seat of match.seats) {
      const dKey = deckKeyOf(seat.commanders);
      if (!decks.has(dKey)) {
        decks.set(dKey, blank(dKey, deckNameOf(seat.commanders), {
          commanders: seat.commanders,
          // Who brought this deck. The row aggregates everyone, which is
          // right - in Commander the same deck passes from hand to hand - but
          // without this list there is no answering "which decks does Bruno
          // play".
          playerKeys: [],
        }));
      }
      // The first match found sets the label, and the history comes from the
      // most recent to the oldest - so the row shows the name the person used
      // last, which is the one the table will recognize.
      const pKey = identityOf(seat, aliases);
      if (!players.has(pKey)) {
        players.set(pKey, blank(pKey, labelOf(seat, aliases), { names: [] }));
      }
      // The typed names this person has had, from most recent to oldest. With
      // an account the label is the @, and without this there would be no way
      // to say "it is the same person you used to call Alexandre".
      const pRow = players.get(pKey);
      const typedName = String(seat.name || '').trim();
      if (typedName && !pRow.names.includes(typedName)) pRow.names.push(typedName);

      const dRow = decks.get(dKey);
      if (!dRow.playerKeys.includes(pKey)) dRow.playerKeys.push(pKey);
      targets[seat.id] = [dRow, pRow];
    }

    const bump = (seatId, field, amount) => {
      const rows = targets[seatId];
      if (rows) rows.forEach((r) => { r[field] += amount; });
    };

    /**
     * Choices in a secret vote.
     *
     * Grouped by QUESTION and not only by label: "Silence" from Prisoner's
     * Dilemma and "Sim" from some other vote do not tell the same story, and
     * mixing both in one pile would say nothing about either.
     */
    const recordVote = (seatId, question, labels) => {
      const rows = targets[seatId];
      if (!rows) return;
      rows.forEach((r) => {
        r.votes += 1;
        const group = r.voteChoices[question] || (r.voteChoices[question] = {});
        labels.forEach((l) => { group[l] = (group[l] || 0) + 1; });
      });
    };

    for (const seat of match.seats) {
      const p = state.players[seat.id];
      bump(seat.id, 'games', 1);
      bump(seat.id, 'turnsTaken', p.turnsTaken);
      bump(seat.id, 'timeOnTurn', p.timeOnTurn);
      bump(seat.id, 'matchTime', duration);
      bump(seat.id, 'placeSum', places.get(seat.id) || match.seats.length);
      bump(seat.id, 'survivedTurns', p.elim ? p.elim.turn : state.turn);
      if (p.dead) bump(seat.id, 'deaths', 1);
      if (state.winnerId === seat.id) bump(seat.id, 'wins', 1);
      // A reason only exists when the table declared it by hand; a win by
      // being the last one alive does not invent any cause.
      const declared = (match.events || []).find(
        (e) => e.type === 'win' && e.targetId === seat.id && e.reason,
      );
      if (declared) {
        const rows = targets[seat.id];
        if (rows) {
          rows.forEach((r) => {
            r.winReasons[declared.reason] = (r.winReasons[declared.reason] || 0) + 1;
          });
        }
      }
      if (p.elim && p.elim.byId) bump(p.elim.byId, 'kills', 1);
    }

    for (const ev of match.events) {
      // Lifelink: the healing of whoever dealt the damage, recorded in the
      // same event. The sweep handles its own further down, with the rest of
      // the drain.
      if (ev.gain && ev.sourceId && ev.type !== 'sweep') bump(ev.sourceId, 'healed', ev.gain);

      switch (ev.type) {
        case 'life':
          // With a dealer it is damage taken; without one it is life the
          // person paid on their own (fetchland, Necropotence, ability cost).
          if (ev.delta < 0) {
            if (ev.sourceId) {
              bump(ev.targetId, 'damageTaken', -ev.delta);
              bump(ev.sourceId, 'damageDealt', -ev.delta);
            } else {
              bump(ev.targetId, 'lifePaid', -ev.delta);
            }
          } else if (ev.delta > 0) {
            bump(ev.targetId, 'healed', ev.delta);
          }
          break;
        case 'cmd':
          if (ev.delta > 0) {
            bump(ev.targetId, 'cmdTaken', ev.delta);
            bump(ev.targetId, 'damageTaken', ev.delta);
            if (ev.sourceId) {
              bump(ev.sourceId, 'cmdDealt', ev.delta);
              bump(ev.sourceId, 'damageDealt', ev.delta);
            }
          }
          break;
        case 'poison':
          if (ev.delta > 0) {
            bump(ev.targetId, 'poisonTaken', ev.delta);
            if (ev.sourceId) bump(ev.sourceId, 'poisonDealt', ev.delta);
          }
          break;
        case 'vote': {
          // Groups by CATEGORY: that is what says what the person usually
          // picks. Translation only happens on screen.
          const question = voteCategory(ev);
          for (const ballot of ev.ballots || []) {
            const labels = (ballot.choices || []).map((c) => (
              ev.kind === KIND_NUMBER ? String(c) : (ev.options || [])[c]
            )).filter((x) => x !== undefined && x !== '');
            if (labels.length) recordVote(ballot.seatId, question, labels);
          }
          break;
        }
        case 'sweep':
          // The event already carries who was hit, so the sum does not depend
          // on rebuilding who was alive at that moment.
          for (const id of ev.targets || []) {
            bump(id, 'damageTaken', ev.amount);
            // "Damage to every player" hits whoever fired it too. That is
            // damage taken by them, but not damage dealt - nobody brags about
            // having hit themselves.
            if (ev.sourceId && ev.sourceId !== id) bump(ev.sourceId, 'damageDealt', ev.amount);
          }
          if (ev.gain && ev.sourceId) bump(ev.sourceId, 'healed', ev.gain);
          break;
        default:
          break;
      }
    }
  }

  return {
    decks: [...decks.values()].map(finalize).sort(byRelevance),
    players: [...players.values()].map(finalize).sort(byRelevance),
  };
}

/**
 * The default order: win rate, matches as the tiebreaker.
 *
 * Exported because sort.js breaks ties with it. With a copy there, changing the
 * tiebreak in one place would leave the two lists in different orders, both
 * claiming to be "by relevance".
 */
export function byRelevance(a, b) {
  if (b.winrate !== a.winrate) return b.winrate - a.winrate;
  return b.games - a.games;
}

export function lastTs(match) {
  return match.events.length ? match.events[match.events.length - 1].ts : match.startedAt;
}
