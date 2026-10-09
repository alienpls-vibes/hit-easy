/**
 * Statistics - the entry point of the screen.
 *
 * The pieces live in src/views/stats/, one per element:
 *
 *   screen.js         the tabs, and which one is open
 *   widgets.js        the small pieces several tabs reuse
 *   deck.js           a deck's card (color by WUBRG identity)
 *   player.js         a player's card (color by person)
 *   rivalries.js      the pair of players, and who chases whom
 *   match.js          a match's card and the timeline
 *   win-reasons.js    how the wins were won
 *   votes.js          choices in secret votes
 *   backup.js         exporting and importing JSON
 *   link-account.js   tagging a seat's account after the game
 *   paywall.js        what is seen without a subscription
 *
 * Two names go through this door, and only those.
 */

export { renderStats } from './stats/screen.js';
export { renderPaywall } from './stats/paywall.js';
