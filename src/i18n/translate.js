/**
 * The translation mechanics: current language, `t()` and interpolation.
 *
 * It does not know which languages exist - that belongs to dictionaries.js.
 * This file only holds the rule for how a key becomes text.
 */

import { DICTS, LOCALES, FALLBACK } from './dictionaries.js';

let lang = 'pt';

export function setLang(next) {
  lang = DICTS[next] ? next : 'pt';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function currentLang() {
  return lang;
}

export function locale() {
  return LOCALES[lang] || 'pt-BR';
}

/**
 * Translates. A missing key falls back to Portuguese, and only then to the key
 * itself - the user sees real text even if a translation falls behind.
 */
export function t(key, vars) {
  const text = (DICTS[lang] && DICTS[lang][key]) || FALLBACK[key] || key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  ));
}

/** Simple plural: the languages here only need one and many. */
export function tn(n, keyOne, keyMany, vars) {
  return t(n === 1 ? keyOne : keyMany, { n, ...vars });
}

/** The language the browser suggests, if it is one of ours. */
export function detectLang() {
  if (typeof navigator === 'undefined') return 'pt';
  for (const tag of navigator.languages || [navigator.language || '']) {
    const base = String(tag).slice(0, 2).toLowerCase();
    if (DICTS[base]) return base;
  }
  return 'pt';
}
