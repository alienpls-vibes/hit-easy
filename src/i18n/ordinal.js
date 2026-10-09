/**
 * The number of a placing, written the way each language writes it.
 *
 * Its own file because it is not a translation: it does not come from any
 * dictionary key, it is one rule per language written in code.
 */

import { currentLang } from './translate.js';

/**
 * The number of a placing, written the way each language writes it.
 *
 * The `º` is the ordinal indicator of Portuguese and Spanish - English and
 * German do not have it, and it was showing up anyway. English was worse than
 * that: the translation was "{n}th place", which produces "1th place", "2th
 * place", "3th place".
 *
 * The English exceptions are not decorative: 11, 12 and 13 take "th" even
 * though they end in 1, 2 and 3 - and so does 111, because the rule looks at
 * the last two digits. That never happens at a Commander table, but the
 * function does not know where it is called from, and a half rule is the one
 * that breaks when someone reuses it.
 */
export function ordinal(n, lang = currentLang()) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);

  if (lang === 'de') return num + '.';

  if (lang === 'en') {
    const lastTwo = Math.abs(num) % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return num + 'th';
    const last = Math.abs(num) % 10;
    if (last === 1) return num + 'st';
    if (last === 2) return num + 'nd';
    if (last === 3) return num + 'rd';
    return num + 'th';
  }

  return num + 'º'; // Portuguese and Spanish
}
