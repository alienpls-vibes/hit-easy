/**
 * Match engine - pure event sourcing.
 *
 * No mutable state scattered around: the match IS the list of events, and the
 * visible state is always `replay(match)`. That gives three things for free:
 *   1. undo/redo = remove/put back the last event and reprocess;
 *   2. exact statistics, because the history is the source of truth;
 *   3. no chance of the scoreboard diverging from the log.
 *
 * `sourceId` is never guessed: either the gesture declared the direction
 * (dragging from the dealer to the target), or it stays null. Life lost with
 * no source is life paid by the player themselves - fetchland, Necropotence,
 * ability costs - which is a different thing from damage taken and counts
 * separately in the statistics.
 *
 * Events (all with id, ts, turn, activeSeatId):
 *   life    { targetId, delta, sourceId, gain? }          negative delta = loss
 *   cmd     { targetId, sourceId, cmdKey, delta, gain? }  commander damage (also takes life)
 *   poison  { targetId, delta, sourceId, gain? }
 *   sweep   { sourceId, amount, gain, targets }           hits several at once
 *
 * `gain` is lifelink: how much life the dealer gained IN THE SAME event.
 * Together, and not as a separate `life` event, so that undo reverts both at
 * once - and so that the healing does not look, in the statistics, like life
 * that came out of nowhere. In sweep it always existed: it is the drain.
 *
 * The targets of a sweep may include whoever fired it ("damage to every
 * player"). Dying from your own sweep does not credit the kill to anyone.
 *   turn    {}                                     passes the turn
 *   pause   {} / resume {}                         clock stopped
 *   vote    { question, kind, options, ballots }  secret vote (record only)
 *   concede { targetId }
 *   win     { targetId, reason }                   winner declared by hand
 *
 * `sweep` stores the list of targets instead of recomputing "who was alive":
 * the event describes exactly what it did, so undo is a single event, the
 * statistics do not need to rebuild state, and the history stays readable
 * years later.
 *
 * Several match fields have Portuguese names (`assentos`, `ausenteDesde`,
 * `ausencias`, `passadaEm`, `passadaCodigo`, `desvioDeRelogio`). They are
 * stored on devices, in backups and in the cloud, so they keep those names.
 */

import { t } from './i18n.js';

export const DEFAULT_LIFE = 40;
export const POISON_LETHAL = 10;
export const CMD_LETHAL = 21;

let seq = 0;
export function uid(prefix = 'id') {
  seq += 1;
  return prefix + '_' + Date.now().toString(36) + '_' + seq.toString(36);
}

/** Stable key of a commander - partners count separately for commander damage. */
export function cmdKeyOf(seatId, commander) {
  return seatId + ':' + commander.oracleId;
}

/**
 * Merges lists of decks without repeats, from most recent to oldest.
 *
 * The same deck in two lists keeps the newest date: the local list knows when
 * the person brought that deck ON THIS device, and the account's list knows
 * when they brought it on any device. The most recent one answers "which deck
 * have they been playing".
 */
export function mergeDecks(...lists) {
  const byKey = new Map();

  for (const list of lists) {
    for (const deck of list || []) {
      const key = deckKeyOf(deck && deck.commanders);
      if (!key) continue;
      const current = byKey.get(key);
      if (!current || (deck.lastUsed || 0) > (current.lastUsed || 0)) {
        byKey.set(key, deck);
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
}

/** Deck key: the combination of commanders, regardless of order. */
export function deckKeyOf(commanders) {
  return (commanders || []).map((c) => c.oracleId).sort().join('+');
}

export function deckNameOf(commanders) {
  return (commanders || []).map((c) => c.name).join(' // ') || t('tl.noCommander');
}

export function createMatch(seats, startingLife = DEFAULT_LIFE, options = {}) {
  const built = seats.map((s) => ({
    id: s.id || uid('seat'),
    name: s.name,
    commanders: s.commanders.map((c) => ({ ...c })),
    // The linked account is part of the seat, not of the setup screen.
    //
    // Without these two fields here, the @ chosen at the table died in the
    // draft: the saved match knew nothing about any account, participantsOf()
    // never found a seat to invite, and the statistics only had the typed
    // name - which is exactly what does not identify anyone.
    handle: s.handle || null,
    userId: s.userId || null,
  }));
  const first = built.find((s) => s.id === options.firstSeatId);

  return {
    id: uid('match'),
    startedAt: Date.now(),
    endedAt: null,
    startingLife,
    seats: built,
    // Who opens the match. Not necessarily the first seat: the physical
    // table is one thing, who won the die roll is another.
    firstSeatId: first ? first.id : built[0] && built[0].id,
    layoutId: options.layoutId || null,
    // Player 1 sits at the top left. A match without this mark started before
    // that, and its table keeps the old order - see seating.js. Stored value:
    // the field name and 'topo' stay as they are.
    assentos: 'topo',
    events: [],
    redo: [],
  };
}

/**
 * Rebuilds the full state from the log.
 * Pure function: same match, same result, always.
 */
export function replay(match) {
  const order = match.seats.map((s) => s.id);
  const players = {};
  for (const seat of match.seats) {
    players[seat.id] = {
      id: seat.id,
      name: seat.name,
      commanders: seat.commanders,
      life: match.startingLife,
      poison: 0,
      cmd: {}, // commander damage RECEIVED, by source cmdKey
      conceded: false,
      dead: false,
      elim: null, // { turn, ts, byId, place }
      turnsTaken: 0,
      timeOnTurn: 0,
    };
  }

  const firstIdx = Math.max(0, order.indexOf(match.firstSeatId));
  let turn = 1;
  // `turn` counts ROUNDS of the table; this one counts PLAYER turns.
  //
  // For the standings the difference matters: dying on my turn and dying on
  // my neighbor's turn are different things, and the round is too coarse to
  // tell them apart. It only serves to know who fell together with whom.
  let playerTurn = 0;
  let activeIdx = firstIdx;
  let turnStart = match.startedAt;
  const elimOrder = [];
  let declaredWinner = null;

  // Stopped clock: the time between pause and resume counts nowhere.
  let paused = false;
  let pauseStart = 0;
  let pausedTotal = 0;  // over the whole match
  let pausedInTurn = 0; // since the start of the current turn

  /** Settles the open pause up to `ts`, without closing it. */
  const settlePause = (ts) => {
    if (!paused) return;
    const d = Math.max(0, ts - pauseStart);
    pausedTotal += d;
    pausedInTurn += d;
    pauseStart = ts;
  };

  const settleDeaths = (ev) => {
    for (const id of order) {
      const p = players[id];
      const cmdValues = Object.values(p.cmd);
      const worstCmd = cmdValues.length ? Math.max.apply(null, cmdValues) : 0;
      const shouldBeDead =
        p.conceded || p.life <= 0 || p.poison >= POISON_LETHAL || worstCmd >= CMD_LETHAL;

      if (shouldBeDead && !p.dead) {
        p.dead = true;
        // We only credit the death to whoever caused the event that brought
        // it about - and a sweep kills all of its targets on behalf of
        // whoever fired it.
        const hit = ev
          && (ev.targetId === id || (ev.targets && ev.targets.includes(id)));
        const byId = hit && ev.sourceId !== id ? ev.sourceId || null : null;
        p.elim = { turn, seq: playerTurn, ts: ev ? ev.ts : Date.now(), byId, place: 0 };
        elimOrder.push(id);
      } else if (!shouldBeDead && p.dead) {
        p.dead = false;
        p.elim = null;
        const at = elimOrder.indexOf(id);
        if (at >= 0) elimOrder.splice(at, 1);
      }
    }
    elimOrder.forEach((id, i) => {
      if (players[id].elim) players[id].elim.place = i + 1;
    });
  };

  const advanceTurn = (ev) => {
    const current = players[order[activeIdx]];
    if (current) {
      // Turn time discounts what the table spent paused within it, and also
      // the time nobody was at the table - otherwise locking the phone in the
      // middle of a turn would make it the longest of the night.
      const awayInTurn = awayBetween(match, turnStart, ev.ts);
      current.timeOnTurn += Math.max(
        0,
        ev.ts - turnStart - pausedInTurn - awayInTurn,
      );
      current.turnsTaken += 1;
    }
    pausedInTurn = 0;
    turnStart = ev.ts;

    const aliveNow = order.filter((id) => !players[id].dead);
    if (aliveNow.length === 0) return;

    // Walks to the next living seat. The round closes when the path CROSSES
    // the seat that opened the match - even if it is already dead, otherwise
    // the turn count would slip with the first eliminated player.
    let next = activeIdx;
    let newRound = false;
    for (let i = 1; i <= order.length; i += 1) {
      const cand = (activeIdx + i) % order.length;
      if (cand === firstIdx) newRound = true;
      if (!players[order[cand]].dead) {
        next = cand;
        break;
      }
    }
    if (newRound) turn += 1;
    playerTurn += 1;
    activeIdx = next;
  };

  for (const ev of match.events) {
    settlePause(ev.ts); // any event settles the pause up to here
    const p = players[ev.targetId];
    switch (ev.type) {
      case 'life':
        if (p) p.life += ev.delta;
        if (ev.gain && players[ev.sourceId]) players[ev.sourceId].life += ev.gain;
        break;
      case 'sweep':
        for (const id of ev.targets || []) {
          if (players[id]) players[id].life -= ev.amount;
        }
        if (ev.gain && players[ev.sourceId]) players[ev.sourceId].life += ev.gain;
        break;
      case 'pause':
        if (!paused) { paused = true; pauseStart = ev.ts; }
        break;
      case 'resume':
        paused = false;
        break;
      case 'cmd':
        if (p) {
          p.cmd[ev.cmdKey] = Math.max(0, (p.cmd[ev.cmdKey] || 0) + ev.delta);
          p.life -= ev.delta; // commander damage also comes out of life
        }
        if (ev.gain && players[ev.sourceId]) players[ev.sourceId].life += ev.gain;
        break;
      case 'poison':
        if (p) p.poison = Math.max(0, p.poison + ev.delta);
        if (ev.gain && players[ev.sourceId]) players[ev.sourceId].life += ev.gain;
        break;
      case 'turn':
        advanceTurn(ev);
        break;
      case 'concede':
        if (p) p.conceded = true;
        break;
      case 'win':
        declaredWinner = ev.targetId;
        break;
      default:
        break;
    }
    settleDeaths(ev);
  }

  // If the active seat died, the turn belongs to the next living one.
  if (players[order[activeIdx]] && players[order[activeIdx]].dead) {
    let nextAlive = -1;
    for (let i = activeIdx + 1; i < order.length; i += 1) {
      if (!players[order[i]].dead) { nextAlive = i; break; }
    }
    if (nextAlive < 0) nextAlive = order.findIndex((id) => !players[id].dead);
    activeIdx = nextAlive < 0 ? 0 : nextAlive;
  }

  const alive = order.filter((id) => !players[id].dead);
  let winnerId = declaredWinner;
  if (!winnerId && order.length > 1 && alive.length === 1) winnerId = alive[0];

  const lastTs = match.events.length ? match.events[match.events.length - 1].ts : match.startedAt;
  settlePause(lastTs); // a pause still open counts up to the last event in the log

  return {
    players,
    order,
    turn,
    activeIdx,
    activeSeatId: order[activeIdx],
    turnStart,
    elimOrder,
    alive,
    finished: Boolean(winnerId) || (order.length > 1 && alive.length === 0),
    winnerId: winnerId || null,
    endedAt: winnerId ? lastTs : null,
    startedAt: match.startedAt,
    paused,
    // `pausedSince` lets the UI show the pause running without replay ceasing
    // to be pure: the current clock is the drawer's business, not the engine's.
    pausedSince: paused ? pauseStart : null,
    pausedTotal,
  };
}

/**
 * Opens an away period: nobody is at the table from now on.
 *
 * It does not open if the clock is ALREADY stopped - with a manual pause in
 * progress the time does not count anyway, and opening here would discount
 * the same period twice. Nor if the match is over, which is when the clock
 * stops moving.
 *
 * Returns whether it opened, so the caller knows whether to save.
 */
export function leaveTable(match, now = Date.now()) {
  if (!match || match.ausenteDesde) return false;
  const st = replay(match);
  if (st.paused || st.finished) return false;
  match.ausenteDesde = now;
  return true;
}

/** Closes the open period, if any. Returns whether it closed. */
export function returnToTable(match, now = Date.now()) {
  if (!match || !match.ausenteDesde) return false;
  const from = match.ausenteDesde;
  match.ausenteDesde = null;
  if (now > from) match.ausencias = [...(match.ausencias || []), [from, now]];
  return true;
}

/**
 * How much away time falls inside [from, to].
 *
 * By overlap, not by total, because turn time must discount only what
 * happened INSIDE that turn. The period still open counts up to `to`, which is
 * the "now" of whoever asked.
 */
export function awayBetween(match, from, to) {
  const ranges = [...((match && match.ausencias) || [])];
  if (match && match.ausenteDesde) ranges.push([match.ausenteDesde, to]);

  let total = 0;
  for (const [a, b] of ranges) {
    total += Math.max(0, Math.min(b, to) - Math.max(a, from));
  }
  return total;
}

/** Match time with what was paused already discounted, including right now. */
export function elapsedOf(match, state, now = Date.now()) {
  const st = state || replay(match);
  const end = st.endedAt || now;
  const runningPause = st.paused && !st.endedAt ? Math.max(0, now - st.pausedSince) : 0;
  // The away time is clipped to [startedAt, end]: after the end the clock no
  // longer moves, so leaving the table with the match over cannot shorten how
  // long it lasted.
  const away = awayBetween(match, match.startedAt, end);
  return Math.max(
    0,
    end - match.startedAt - st.pausedTotal - runningPause - away,
  );
}

/**
 * What time it is, for this table.
 *
 * The device clock plus the offset the table carries. It is zero in the
 * normal case; it is only non-zero on a table that came from another device
 * whose clock was ahead.
 *
 * It exists because an event with a `ts` earlier than the previous event
 * breaks the duration math: `elapsedOf` and `advanceTurn` subtract instants,
 * and time running backwards turns into a negative number on the table.
 */
export function tableNow(match, now = Date.now()) {
  return now + ((match && match.desvioDeRelogio) || 0);
}

/** Appends an event, stamping the turn/active seat of the moment. */
export function push(match, partial) {
  const state = replay(match);
  const ev = {
    id: uid('ev'),
    ts: tableNow(match),
    turn: state.turn,
    activeSeatId: state.activeSeatId,
    sourceId: null,
    ...partial,
  };
  match.events.push(ev);
  match.redo = [];
  return ev;
}

export function undo(match) {
  if (!match.events.length) return null;
  const ev = match.events.pop();
  match.redo = match.redo || [];
  match.redo.push(ev);
  return ev;
}

export function redo(match) {
  if (!match.redo || !match.redo.length) return null;
  const ev = match.redo.pop();
  match.events.push(ev);
  return ev;
}

export function canUndo(match) {
  return match.events.length > 0;
}

export function canRedo(match) {
  return Boolean(match.redo && match.redo.length);
}

/**
 * The table's standings, with ties by turn.
 *
 * Whoever dies on the SAME turn falls together. If someone eliminates all
 * three opponents at once, there is nothing that separates those three - they
 * did not outlive each other, and the order in which the engine processed the
 * events is an internal detail that means nothing at the table. Breaking the
 * tie there would be inventing a result.
 *
 * The tied group gets the WORST placing it occupies: three dying together at a
 * table of four all end up 4th, not 2nd. That is what the table understands by
 * "we all came last" - saying two of them were 2nd and 3rd would give them a
 * place nobody earned.
 *
 * Overall order: winner, then whoever stayed alive without winning, then the
 * dead from the most recent turn to the oldest.
 */
export function standings(match, state) {
  const st = state || replay(match);

  // The higher, the better placed.
  const weight = (id) => {
    if (id === st.winnerId) return Infinity;
    const e = st.players[id] && st.players[id].elim;
    return e ? (e.seq || 0) : Number.MAX_SAFE_INTEGER; // alive ranks above dead
  };

  // Who ties with whom. The winner never ties; the living who did not win tie
  // among themselves; the dead tie with whoever fell on the same player turn.
  const group = (id) => {
    if (id === st.winnerId) return 'winner';
    const e = st.players[id] && st.players[id].elim;
    return e ? 'turn:' + (e.seq || 0) : 'alive';
  };

  const ranked = [...st.order].sort((a, b) => weight(b) - weight(a));

  const out = [];
  let i = 0;
  while (i < ranked.length) {
    const g = group(ranked[i]);
    let j = i;
    while (j < ranked.length && group(ranked[j]) === g) j += 1;
    // Positions i+1 to j; the whole group takes the last of them.
    for (let k = i; k < j; k += 1) out.push({ seatId: ranked[k], place: j });
    i = j;
  }
  return out;
}

/**
 * Is this person already in another seat?
 *
 * A match rule, not a screen rule: a table with someone duplicated spoils
 * everything that comes after - damage against yourself, a rivalry with
 * yourself, and standings that do not match what happened.
 *
 * It checks both identities, because they are two different ways of reaching
 * the same person: the typed name and the linked account. There used to be
 * only half a lock - the saved players list disabled whoever was already
 * seated, but typing the same name by hand got through, and the same ACCOUNT
 * in two seats was not checked anywhere.
 *
 * Returns 'account', 'name' or null.
 */
export function duplicatePerson(seats, seat, { name, handle } = {}) {
  const others = (seats || []).filter((s) => s && s !== seat);

  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (h && others.some((s) => String(s.handle || '').trim().replace(/^@+/, '').toLowerCase() === h)) {
    return 'account';
  }

  const n = String(name || '').trim().toLowerCase();
  if (n && others.some((s) => String(s.name || '').trim().toLowerCase() === n)) {
    return 'name';
  }

  return null;
}

/**
 * Hands the table off: this device stops being in charge of it.
 *
 * It stamps, and that is all. The stamp is the baton: while it exists, the
 * table is a record to look at, not a game to continue. It does not delete the
 * match on purpose - if the handoff fails (the file never arrived, the friend
 * gave up), the game has to be here to be taken back.
 *
 * Returns false when there is nothing to hand off: no table, or already
 * handed off.
 */
export function handOffTable(match, now = Date.now(), code = null) {
  if (!match || match.passadaEm) return false;
  match.passadaEm = now;
  // Handed off by code, the table remembers which one: with it, taking back
  // cancels the handoff in the cloud, and the home screen asks whether the
  // other device has picked it up yet.
  if (code) match.passadaCodigo = code;
  return true;
}

/**
 * Undoes the handoff, when it did not work out.
 *
 * It is the only way back, and it is deliberately an ACTION - two live copies
 * of the same match is exactly what the handoff prevents, so taking back has
 * to be someone deciding, never the app thinking it should.
 */
export function reclaimTable(match) {
  if (!match || !match.passadaEm) return false;
  delete match.passadaEm;
  delete match.passadaCodigo;
  return true;
}

/** Is the table in another device's hands? */
export function isHandedOff(match) {
  return Boolean(match && match.passadaEm);
}

/**
 * Prepares a table that arrived from another device.
 *
 * Removes the handed-off stamp - it arrived to be played - and fixes the clock.
 *
 * The fix only looks forward: if the clock here is already past the last
 * event, there is nothing to do. The offset exists for the opposite case, in
 * which carrying on would produce events earlier than the ones that already
 * happened.
 *
 * The one-minute margin is not superstition: without it, two devices with
 * practically equal clocks would tie on the same millisecond, and the first
 * new event would be born with the same `ts` as the last old one.
 */
export function receiveTable(match, now = Date.now()) {
  if (!isValidMatch(match)) return null;

  const received = { ...match, redo: [] };
  delete received.passadaEm;
  delete received.passadaCodigo;

  const last = received.events.length
    ? received.events[received.events.length - 1].ts
    : received.startedAt;

  const lag = (last || 0) - now;
  received.desvioDeRelogio = lag > 0 ? lag + 60000 : 0;

  return received;
}

/**
 * Does this really look like a match?
 *
 * Everything that comes from outside the engine - from the cloud, from an
 * imported file, from a localStorage someone edited - must pass through here
 * before entering the history. A malformed row does not sit quietly in a
 * corner: replay() and the statistics assume the shape, and the first missing
 * piece takes down the WHOLE SCREEN. That is what happened - a test row with
 * `payload: {t:1}` left behind in the database turned the statistics tab
 * black.
 *
 * It checks only the skeleton, not the content. It is not this function's job
 * to judge whether the events make sense: replay() is deterministic and copes
 * with an odd log. What it cannot cope with is missing lists.
 */
export function isValidMatch(m) {
  return Boolean(m)
    && typeof m.id === 'string' && m.id.length > 0
    && Array.isArray(m.seats) && m.seats.length > 0
    && m.seats.every((s) => s && typeof s.id === 'string')
    && Array.isArray(m.events)
    && Number.isFinite(m.startedAt);
}
