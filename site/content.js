/**
 * The languages of the site - the same four the app offers (src/i18n/).
 *
 * The texts live in content/<lang>.js. Portuguese (content/pt.js) is the
 * base: it holds every text plus the links, icons, colors and art. The other
 * files hold only their texts, and are laid over Portuguese:
 *
 *   - objects merge key by key;
 *   - arrays merge BY POSITION, so en.js can write
 *     `links: [{ label: 'Features' }, ...]` and keep the href from pt.js;
 *   - anything a translation leaves out shows in Portuguese, so a missing
 *     key never breaks the page (the app does the same).
 *
 * Adding a language: a new content/<lang>.js, one line in LANGS and one in
 * LOCALES.
 */

/** Order of the language picker, with each language's name in itself. */
export const LANGS = [
  ['pt', 'Português'],
  ['en', 'English'],
  ['es', 'Español'],
  ['de', 'Deutsch'],
];

/** Locale for dates and numbers, and the <html lang> of each language. */
export const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', de: 'de-DE' };

export const BASE_LANG = 'pt';

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** `over` laid on `base`: see the rules at the top of this file. */
export function layer(base, over) {
  if (over === undefined) return base;
  if (Array.isArray(base) && Array.isArray(over)) {
    const out = base.map((item, i) => (i < over.length ? layer(item, over[i]) : item));
    for (let i = base.length; i < over.length; i += 1) out.push(over[i]);
    return out;
  }
  if (isObject(base) && isObject(over)) {
    const out = {};
    Object.keys(base).forEach((k) => { out[k] = layer(base[k], over[k]); });
    Object.keys(over).forEach((k) => { if (!(k in base)) out[k] = over[k]; });
    return out;
  }
  return over;
}

/** The full content of a language, already laid over Portuguese. */
export async function loadContent(lang) {
  const base = (await import('./content/pt.js')).CONTENT;
  if (lang === BASE_LANG) return base;
  try {
    const own = (await import('./content/' + lang + '.js')).CONTENT;
    return layer(base, own);
  } catch (error) {
    console.error('[site] language "' + lang + '" did not load, showing Portuguese:', error);
    return base;
  }
}
