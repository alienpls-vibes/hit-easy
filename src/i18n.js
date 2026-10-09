/**
 * Languages - the entry point of the subsystem.
 *
 * The pieces live in src/i18n/: one language per file, the registry of which
 * languages exist, the `t()` mechanics and the ordinal rule. This file exists
 * so that whoever translates a screen imports ONE path and does not need to
 * know any of that - and so that splitting the pieces differently tomorrow
 * does not touch any of the modules that depend on it.
 *
 * Keys follow the screen: setup.*, table.*, vote.*, stats.*, common.*.
 */

export { LANGS, DICTS } from './i18n/dictionaries.js';
export {
  setLang, currentLang, locale, t, tn, detectLang,
} from './i18n/translate.js';
export { ordinal } from './i18n/ordinal.js';
