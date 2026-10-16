/**
 * The rules of the color guess.
 *
 * A guess is a set of colors: any mix of W, U, B, R, G, or just C for
 * colorless. Three tries. After each miss the player learns HOW MANY of the
 * colors they picked are on the card - never which ones, which made three
 * tries too easy - and after the first miss also how many colors the card
 * has, without which a three-color card is nearly impossible to land.
 *
 * Pure: the screen keeps the state, this only judges it.
 */

import { normalizeColors } from './card.js';

export const MAX_TRIES = 3;
export const COLORLESS = 'C';
export const CHOICES = ['W', 'U', 'B', 'R', 'G', COLORLESS];

/** A guess as stored: WUBRG order, or ['C'] alone. Empty means "nothing picked". */
export function normalizeGuess(guess) {
  const list = guess || [];
  if (list.includes(COLORLESS)) return [COLORLESS];
  return normalizeColors(list);
}

/** The card's answer in the same shape as a guess. */
export function answerOf(colors) {
  const c = normalizeColors(colors);
  return c.length ? c : [COLORLESS];
}

/**
 * Judges one guess.
 *
 * `hits` is how many of the picked colors the card has, out of `picked`.
 * Which ones is deliberately left out: telling it color by color let a
 * player rule colors in and out one at a time, and three tries became easy.
 */
export function judge(guess, colors) {
  const g = normalizeGuess(guess);
  const answer = answerOf(colors);
  const hits = g.filter((c) => answer.includes(c)).length;
  const exact = g.length === answer.length && hits === answer.length;
  return { exact, hits, picked: g.length };
}

/**
 * Where a day stands, from its guesses.
 *
 * `status`: 'playing' | 'won' | 'lost'. `colorCount` only appears once a miss
 * earned the hint.
 */
export function progress(guesses, colors) {
  const list = (guesses || []).map(normalizeGuess).filter((g) => g.length);
  const results = list.map((g) => ({ guess: g, ...judge(g, colors) }));
  const won = results.some((r) => r.exact);
  const status = won ? 'won' : (results.length >= MAX_TRIES ? 'lost' : 'playing');
  const misses = results.filter((r) => !r.exact).length;
  return {
    status,
    results,
    triesLeft: Math.max(0, MAX_TRIES - results.length),
    colorCount: misses > 0 ? answerOf(colors).filter((c) => c !== COLORLESS).length : null,
  };
}

/**
 * Picking a color on the board: colorless is exclusive with the five colors.
 * Returns the new selection.
 */
export function toggleChoice(selection, choice) {
  const set = new Set(selection || []);
  if (set.has(choice)) {
    set.delete(choice);
  } else if (choice === COLORLESS) {
    set.clear();
    set.add(COLORLESS);
  } else {
    set.delete(COLORLESS);
    set.add(choice);
  }
  return CHOICES.filter((c) => set.has(c));
}

/**
 * Totals across every day played: games, wins, current and best streak.
 *
 * The current streak counts consecutive won days ending today - or yesterday,
 * when today has not been played yet: opening the app in the morning should
 * not show the streak as broken before the person even tried.
 */
export function totals(days, today, previousDay) {
  const keys = Object.keys(days || {}).filter((k) => days[k] && days[k].done).sort();
  const played = keys.length;
  const wins = keys.filter((k) => days[k].won).length;

  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    const consecutive = prev && previousDay(k) === prev;
    run = days[k].won ? (consecutive ? run + 1 : 1) : 0;
    best = Math.max(best, run);
    prev = k;
  }

  let current = 0;
  let cursor = days[today] && days[today].done ? today : previousDay(today);
  while (days[cursor] && days[cursor].done && days[cursor].won) {
    current += 1;
    cursor = previousDay(cursor);
  }

  return { played, wins, current, best };
}
