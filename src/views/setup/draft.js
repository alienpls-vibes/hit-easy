/**
 * The table being set up, before it becomes a match.
 *
 * A single draft, alive while the home screen is open: starting life, the
 * seats in the order they sit - which is the turn order - and the chosen
 * arrangement. Every home screen piece receives this draft as a parameter;
 * nobody reaches `draft` from outside, and that is what keeps "who is at the
 * table" with a single source of truth.
 */

import * as store from '../../store.js';
import { uid, duplicatePerson } from '../../engine.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { cloudEnabled } from '../../config.js';

export const LIFE_PRESETS = [20, 30, 40, 60];

export const MIN_SEATS = 2;

export const MAX_SEATS = 6;

let draft = null;

export function freshSeat(index) {
  // Its own key, and not the section title: 'Players' + number gave
  // "Players 1" in English. Interpolating also frees the order in languages
  // where the number does not come after.
  return { id: uid('seat'), name: t('setup.playerN', { n: index + 1 }), commanders: [] };
}

export function ensureDraft() {
  if (draft) return draft;
  const settings = store.getDB().settings;
  draft = {
    startingLife: settings.startingLife || 40,
    seats: [freshSeat(0), freshSeat(1), freshSeat(2), freshSeat(3)],
    layoutId: null,
    firstSeatId: null,
  };
  return draft;
}

/** Reuses the previous table, keeping players, decks and arrangement. */
export function seedDraftFrom(match) {
  draft = {
    startingLife: match.startingLife,
    seats: match.seats.map((s) => ({
      id: uid('seat'),
      name: s.name,
      commanders: s.commanders.map((c) => ({ ...c })),
    })),
    layoutId: match.layoutId || null,
    firstSeatId: null, // who starts is decided again for every match
  };
}

/** Shortcuts over the draft; the rule itself lives in the engine. */
export function nameAtTable(seat, name) {
  return duplicatePerson(ensureDraft().seats, seat, { name }) === 'name';
}

export function accountAtTable(seat, handle) {
  return duplicatePerson(ensureDraft().seats, seat, { handle }) === 'account';
}

/** Offering to link only makes sense for someone who is in an account. */
export function canLinkAccounts() {
  return cloudEnabled() && cloud.state() !== 'signed-out';
}
