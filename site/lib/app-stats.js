/**
 * The bridge to the app's statistics: the match engine and the aggregation.
 *
 * Apart from lib/app.js so the pages that do not show statistics never
 * download the engine. Same rule: only this file and lib/app.js know where
 * the app lives.
 */

export {
  aggregate, identityOf, labelOf, seatName, CURRENT_HANDLES, DISPLAY_NAMES,
  formatDuration, formatDate, pct, num, summarize,
} from '../../src/stats.js';

export { deckKeyOf, deckNameOf } from '../../src/engine.js';
