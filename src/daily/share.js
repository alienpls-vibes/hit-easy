/**
 * Sharing the day's result without giving the card away.
 *
 * The text says how the day went and nothing about the answer: no card
 * name, no colors, and not even how many colors the card has. One square
 * per try:
 *
 *   🟩  the right colors
 *   🟨  wrong, but some of the picked colors are on the card
 *   ⬛  wrong, and none of the picked colors are on the card
 *
 * A miss shows only "some" or "none", never the count the screen gave
 * ("1 of 2"). The count would hint how many colors were picked, and the
 * winning row would say how many colors the card has. Someone who has not
 * played yet can read the message in the group without losing the game.
 *
 * WhatsApp first, because that is where the tables talk: wa.me opens the
 * app on the phone and WhatsApp Web on a computer. The share sheet and the
 * clipboard are there for everything else.
 */

import { toast } from '../ui.js';
import { dt } from './i18n.js';

export const SQUARE_WON = '🟩';
export const SQUARE_SOME = '🟨';
export const SQUARE_NONE = '⬛';

/** One square per try, from progress().results. */
export function squares(results) {
  return results.map((r) => {
    if (r.exact) return SQUARE_WON;
    return r.hits > 0 ? SQUARE_SOME : SQUARE_NONE;
  }).join('');
}

/**
 * The message, in the app's language:
 *
 *   Hit Easy · Guess the Colors #5
 *   🟩 1/3
 *   Can you guess it too?
 *   Play here: https://.../?daily=1
 *
 * The third line dares the friend: "too" after a win, a plain question after
 * a loss.
 */
export function resultText({
  number, results, status, max, link,
}, t = dt) {
  const won = status === 'won';
  const tries = won ? String(results.findIndex((r) => r.exact) + 1) : 'X';
  return [
    'Hit Easy · ' + t('daily.title') + ' #' + number,
    squares(results) + ' ' + tries + '/' + max,
    t(won ? 'daily.shareDareWon' : 'daily.shareDareLost'),
    t('daily.shareInvite', { link }),
  ].join('\n');
}

/** The link friends get: this channel's app, straight into the challenge. */
export function challengeLink(loc = location) {
  return loc.origin + loc.pathname.replace(/[^/]*$/, '') + '?daily=1';
}

export function whatsappUrl(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

export function shareToWhatsapp(text) {
  window.open(whatsappUrl(text), '_blank', 'noopener');
}

/** The phone's share sheet, or the clipboard where there is none. */
export async function shareElsewhere(text) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // the person closed the sheet
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(dt('daily.shareCopied'));
  } catch {
    toast(text);
  }
}
