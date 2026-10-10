/**
 * Which languages exist, and where each one lives.
 *
 * Kept apart from the translation on purpose: adding a language means touching
 * THIS file - a new file, one line in LANGS, one in LOCALES and one in DICTS -
 * without touching the `t()` mechanics.
 */

import { PT } from './pt.js';
import { EN } from './en.js';
import { ES } from './es.js';
import { DE } from './de.js';

/** Order in which they appear in the Settings picker. */
export const LANGS = [
  ['pt', 'Português'],
  ['en', 'English'],
  ['es', 'Español'],
  ['de', 'Deutsch'],
];

/** Locale for dates and numbers, per language. */
export const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', de: 'de-DE' };

export const DICTS = { pt: PT, en: EN, es: ES, de: DE };

/** The fallback when a key is missing: see src/i18n/pt.js. */
export const FALLBACK = PT;
