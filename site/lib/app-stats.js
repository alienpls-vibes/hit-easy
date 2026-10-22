/**
 * The bridge to the app's statistics: the match engine and the aggregation.
 *
 * Apart from lib/app.js so the pages that do not show statistics never
 * download the engine. Same rule: only this file and lib/app.js know where
 * the app lives.
 */

export {
  aggregate, identityOf, labelOf, seatName, CURRENT_HANDLES, DISPLAY_NAMES,
  formatDuration, formatDate, pct, num, summarize, playerColor, playerColorOrder,
} from '../../src/stats.js';

export { deckKeyOf, deckNameOf } from '../../src/engine.js';

/** 'light' | 'dark': each person's color is lightened or darkened to read on the theme. */
export { setPalette } from '../../src/colors.js';

/** The app's language: dates and the few words the engine writes ("Sem comandante"). */
export { setLang } from '../../src/i18n.js';
