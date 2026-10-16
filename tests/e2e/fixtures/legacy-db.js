/**
 * A device database the way older releases left it.
 *
 * Written by hand from the history of src/store.js and src/engine.js, so it
 * carries what a phone that has been updating since the early versions has:
 *
 * - matches without `assentos: 'topo'` (the old seat order), with the legacy
 *   layout id '2-1', and seats without `handle`/`userId`;
 * - `commanders` (the old picker cache) and `enviadas` (the old "uploaded"
 *   list), which newer versions no longer write;
 * - hidden players stored by NAME, before they were keyed by identity;
 * - settings from before `keepAwake`, `autoRotate`, `versaoAnterior` existed;
 * - one record with no seats - the kind of junk an old sync let in, which the
 *   store must heal instead of crashing on;
 * - a match IN PROGRESS from that era, which must open on today's table.
 *
 * STORED NAMES: every key here is a data contract (see CLAUDE.md). This file
 * must only ever grow - never "fix" a field name in it.
 */

const atraxa = {
  oracleId: 'oracle-atraxa', scryfallId: 'd0d33d52-3d28-4635-b985-51e126289259',
  name: "Atraxa, Praetors' Voice", typeLine: 'Legendary Creature', colors: ['W', 'U', 'B', 'G'],
  art: 'https://cards.scryfall.io/art_crop/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1',
  thumb: 'https://cards.scryfall.io/art_crop/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1',
};
const krenko = {
  oracleId: 'oracle-krenko', scryfallId: 'k', name: 'Krenko, Mob Boss', typeLine: 'Legendary Creature',
  colors: ['R'], art: 'https://cards.scryfall.io/art_crop/front/a/b/k.jpg?1', thumb: 'https://cards.scryfall.io/art_crop/front/a/b/k.jpg?1',
};
const edgar = {
  oracleId: 'oracle-edgar', scryfallId: 'e', name: 'Edgar Markov', typeLine: 'Legendary Creature',
  colors: ['W', 'B', 'R'], art: 'https://cards.scryfall.io/art_crop/front/a/b/e.jpg?1', thumb: 'https://cards.scryfall.io/art_crop/front/a/b/e.jpg?1',
};

const T0 = Date.UTC(2026, 6, 1, 20, 0, 0); // a Thursday night in July

const ev = (n, turn, partial) => ({ id: 'ev-old-' + n, ts: T0 + n * 60000, turn, activeSeatId: 's0', sourceId: null, ...partial });

const oldFinished = {
  id: 'match-old-1',
  startedAt: T0,
  endedAt: T0 + 3600000,
  startingLife: 40,
  layoutId: '2-1',
  seats: [
    { id: 's0', name: 'Ana', commanders: [atraxa] },
    { id: 's1', name: 'Bruno', commanders: [krenko] },
    { id: 's2', name: 'Carla', commanders: [edgar] },
  ],
  firstSeatId: 's0',
  events: [
    ev(1, 1, { type: 'cmd', targetId: 's1', delta: 21, sourceId: 's0', cmdKey: 's0:oracle-atraxa' }),
    ev(2, 2, { type: 'life', targetId: 's1', delta: -19, sourceId: 's0' }),
    ev(3, 3, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' }),
    ev(4, 4, { type: 'win', targetId: 's0', reason: 'comandante' }),
  ],
  redo: [],
};

const oldInProgress = {
  id: 'match-old-live',
  startedAt: T0 + 86400000 * 7,
  endedAt: null,
  startingLife: 40,
  layoutId: '2-1',
  seats: [
    { id: 's0', name: 'Ana', commanders: [atraxa] },
    { id: 's1', name: 'Bruno', commanders: [krenko] },
    { id: 's2', name: 'Carla', commanders: [edgar] },
  ],
  firstSeatId: 's1',
  events: [
    { id: 'ev-live-1', ts: T0 + 86400000 * 7 + 60000, turn: 1, activeSeatId: 's1', sourceId: null, type: 'life', targetId: 's2', delta: -7 },
  ],
  redo: [],
};

export const LEGACY_DB = {
  version: 1,
  current: oldInProgress,
  history: [
    oldFinished,
    { id: 'match-broken', startedAt: T0 - 1000, events: [] }, // no seats: must be healed, not crash
  ],
  enviadas: ['match-that-left-long-ago'],
  commanders: {
    'oracle-atraxa': { ...atraxa, lastUsed: T0 },
    'oracle-krenko': { ...krenko, lastUsed: T0 },
  },
  playerNames: ['Ana', 'Bruno', 'Carla'],
  playerHandles: {},
  hiddenDecks: [],
  hiddenPlayers: ['Bruno'],
  settings: {
    startingLife: 40,
    lang: null,
    theme: 'escuro',
    haptics: true,
    dragHintSeen: true,
    versaoVista: '1.5.0',
  },
};
