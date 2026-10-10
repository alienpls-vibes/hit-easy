/**
 * Choices in a secret vote, grouped by QUESTION.
 *
 * Grouping by question is what keeps "Silence" from Prisoner's Dilemma from
 * mixing with "Sim" from some other vote.
 */

import { t } from '../i18n.js';
import { KIND_NUMBER } from '../vote.js';

/**
 * The key that groups a vote in the history.
 *
 * It must NOT be translated text. The grouping used to use the on-screen
 * label, and "Número secreto" in Portuguese and "Secret number" in English
 * became two different questions: switching the app language split the
 * person's vote history into two piles, without anything having changed at the
 * table.
 *
 * Internal keys start with `#` so they never collide with a question someone
 * typed.
 *
 * When nobody named the vote, the options themselves identify the card better
 * than any generic label: "Silence / Snitch" is recognizable at once.
 */
export function voteKey(ev) {
  const typed = ((ev && ev.question) || '').trim();
  if (typed) return typed;
  if (ev && ev.kind === KIND_NUMBER) return '#numero';
  const options = ((ev && ev.options) || []).filter(Boolean);
  return options.length ? options.join(' / ') : '#semtitulo';
}

/**
 * The CATEGORY of a vote: the model used, not the written question.
 *
 * Grouping by free-form question scattered the same thing over several rows -
 * each way of writing "who rats out whom?" became its own category - and at
 * the same time merged different things that happened to share a title. The
 * category is what answers "does this person usually snitch?".
 *
 * Votes recorded before this field existed have no model on record. The
 * essentials can be recovered from `kind`, and the rest becomes a generic
 * category - inventing which model was used would be worse than admitting it
 * is unknown.
 *
 * The categories match the stored preset ids ('duas', 'dilema', 'numero',
 * 'jogador') plus 'opcoes' for the unknown case.
 */
export function voteCategory(ev) {
  if (ev && ev.preset) return ev.preset;
  if (ev && ev.kind === KIND_NUMBER) return 'numero';
  return 'opcoes';
}

/** The category name, in the current language. */
export function categoryLabel(key) {
  if (key === 'dilema') return "Prisoner's Dilemma"; // a card name, not translated
  if (key === 'duas') return t('vote.preset.two');
  if (key === 'numero') return t('vote.preset.number');
  if (key === 'jogador') return t('vote.preset.player');
  return t('vote.preset.other');
}

/** The text of a key, in the current language. */
export function voteKeyLabel(key) {
  if (key === '#numero') return t('vote.preset.number');
  if (key === '#semtitulo') return t('vote.untitled');
  return key;
}

/** How a vote shows up in the timeline. */
export function voteTitle(ev) {
  return voteKeyLabel(voteKey(ev));
}
