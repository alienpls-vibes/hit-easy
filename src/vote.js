/**
 * Secret, simultaneous voting.
 *
 * It was born from Prisoner's Dilemma ("each opponent secretly chooses silence
 * or snitch"), but the space of cards is larger and has two families:
 *
 *   SECRET CHOICE  Prisoner's Dilemma, Call to the Void, Menacing Ogre,
 *                  Wheel of Misfortune, Itazura. Everyone chooses at the same
 *                  time and reveals together. Sometimes the choice is a named
 *                  OPTION, sometimes it is any NUMBER - and then what matters
 *                  is who got the highest and the lowest.
 *
 *   VOTING         will of the council / council's dilemma: Coercive Portal,
 *                  Council Guardian, Council's Judgment and company. By the
 *                  rules the vote is open and in turn order, but at the table
 *                  almost everyone prefers simultaneous - and some effects give
 *                  one player EXTRA VOTES (Brago's Representative).
 *
 * Hence the three axes of this module: `kind` (options or number), who takes
 * part (not always the whole table - Prisoner's Dilemma is opponents only) and
 * how many votes each one has.
 *
 * No DOM on purpose: the tally is the part that has to be right, and it is
 * testable on its own.
 *
 * The `kind` values and the preset ids are written into vote events, which are
 * stored with the match. They keep their original (Portuguese) values.
 */

import { t } from './i18n.js';

/** Stored `kind` values. Do not translate. */
export const KIND_OPTIONS = 'opcoes';
export const KIND_NUMBER = 'numero';

/**
 * Ready-made models for the most common cards.
 *
 * `label` is a getter because the language can change after the module has
 * loaded - fixed text here would stay frozen in the language of the first load.
 *
 * The ids ('duas', 'dilema', 'numero', 'jogador') are stored in vote events as
 * `preset`. The 'Sim'/'Não' options are stored too, and shown as written.
 */
export const PRESETS = [
  {
    id: 'duas',
    get label() { return t('vote.preset.two'); },
    kind: KIND_OPTIONS,
    options: ['Sim', 'Não'],
    excludeActive: false,
  },
  {
    id: 'dilema',
    label: "Prisoner's Dilemma",
    // Fills in the question by itself: without a title, the statistics later
    // become a pile of identical, indistinguishable rows.
    title: "Prisoner's Dilemma",
    kind: KIND_OPTIONS,
    options: ['Silence', 'Snitch'],
    excludeActive: true, // "each opponent", not the whole table
  },
  {
    id: 'numero',
    get label() { return t('vote.preset.number'); },
    kind: KIND_NUMBER,
    options: [],
    excludeActive: false,
  },
  {
    id: 'jogador',
    get label() { return t('vote.preset.player'); },
    kind: KIND_OPTIONS,
    options: [], // filled with the names at the table
    fromPlayers: true,
    excludeActive: false,
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

/**
 * `voters` is [{ id, name, votes }]. `votes` covers the effects that grant
 * extra votes; the default is 1.
 */
export function createSession({
  question = '', preset = '', kind = KIND_OPTIONS, options = [], voters = [],
}) {
  return {
    question,
    preset,
    kind,
    options: [...options],
    voters: voters.map((v) => ({ id: v.id, name: v.name, votes: Math.max(1, v.votes || 1) })),
    ballots: {}, // voterId -> array of choices
  };
}

/** Records someone's vote. For a number vote, `choices` is [n]. */
export function cast(session, voterId, choices) {
  session.ballots[voterId] = [...choices];
  return session;
}

/** Who has not voted yet, in the order they should receive the device. */
export function pending(session) {
  return session.voters.filter((v) => !session.ballots[v.id]);
}

export function isComplete(session) {
  return pending(session).length === 0;
}

/**
 * The tally.
 *
 * For options it returns the options sorted by votes, who voted for each one,
 * and two derived facts the cards actually ask about: was there a TIE at the
 * top, and was the choice UNANIMOUS (Prisoner's Dilemma asks exactly that -
 * "if each opponent chose silence...").
 *
 * For numbers it returns the values per player with the highest and the
 * lowest, ties included - which is what Menacing Ogre and Wheel of Misfortune
 * need.
 */
export function tally(session) {
  if (session.kind === KIND_NUMBER) return tallyNumbers(session);

  const rows = session.options.map((label, index) => ({
    index,
    label,
    votes: 0,
    voters: [],
  }));

  let total = 0;
  for (const voter of session.voters) {
    for (const choice of session.ballots[voter.id] || []) {
      const row = rows[choice];
      if (!row) continue;
      row.votes += 1;
      total += 1;
      if (!row.voters.includes(voter.name)) row.voters.push(voter.name);
    }
  }

  const sorted = [...rows].sort((a, b) => b.votes - a.votes || a.index - b.index);
  const mostVotes = sorted.length ? sorted[0].votes : 0;
  const top = sorted.filter((r) => r.votes === mostVotes && mostVotes > 0).map((r) => r.index);

  return {
    kind: KIND_OPTIONS,
    rows: sorted,
    total,
    top,
    tie: top.length > 1,
    unanimous: top.length === 1 && mostVotes === total && total > 0,
  };
}

function tallyNumbers(session) {
  const rows = session.voters.map((v) => ({
    voterId: v.id,
    name: v.name,
    value: Number((session.ballots[v.id] || [0])[0]) || 0,
  }));

  const values = rows.map((r) => r.value);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;

  return {
    kind: KIND_NUMBER,
    rows: [...rows].sort((a, b) => b.value - a.value),
    highest: rows.filter((r) => r.value === max).map((r) => r.voterId),
    lowest: rows.filter((r) => r.value === min).map((r) => r.voterId),
    max,
    min,
    // Everyone on the same number: there is no real highest or lowest.
    allEqual: max === min && rows.length > 1,
  };
}

/** One-line summary, for the history and the timeline. */
export function describe(session, result) {
  const r = result || tally(session);
  if (r.kind === KIND_NUMBER) {
    return r.rows.map((x) => x.name + ' ' + x.value).join(' · ');
  }
  // 'sem votos' is shown to the user and stored in the event summary.
  return r.rows.filter((x) => x.votes > 0).map((x) => x.label + ' ' + x.votes).join(' × ')
    || 'sem votos';
}
