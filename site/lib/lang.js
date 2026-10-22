/**
 * Which language to show, and switching it.
 *
 * In order, the first that names a language the site has:
 *
 *   1. `?lang=en` in the address - a link shared in a language opens in it;
 *   2. the choice made on the site's own picker;
 *   3. the language chosen in the app (same origin, same localStorage - the
 *      app keeps it in `settings.lang` of its database);
 *   4. the browser's languages;
 *   5. Portuguese.
 *
 * The site never writes into the app's database: its own choice goes under
 * a key of its own.
 */

const PICK_KEY = 'hiteasy.site.lang';

function appLang() {
  try {
    // Beta keeps its data under a suffix, like the app (src/channel.js).
    const beta = /(^|\/)beta(\/|$)/.test(location.pathname);
    const db = JSON.parse(localStorage.getItem('mtglc.db.v1' + (beta ? '.beta' : '')));
    return db && db.settings ? db.settings.lang : null;
  } catch {
    return null;
  }
}

export function pickLang(available) {
  const ok = (l) => (l && available.indexOf(String(l).slice(0, 2).toLowerCase()) >= 0
    ? String(l).slice(0, 2).toLowerCase() : null);

  let fromUrl = null;
  try { fromUrl = new URLSearchParams(location.search).get('lang'); } catch { /* old browser */ }
  let picked = null;
  try { picked = localStorage.getItem(PICK_KEY); } catch { /* blocked storage */ }

  const candidates = [fromUrl, picked, appLang()]
    .concat(Array.prototype.slice.call(navigator.languages || [navigator.language || '']));
  for (let i = 0; i < candidates.length; i += 1) {
    const lang = ok(candidates[i]);
    if (lang) return lang;
  }
  return 'pt';
}

/**
 * Switches language and redraws the page in it.
 *
 * The choice is remembered for the next pages. A `?lang=` in the address
 * would override it, so it leaves; and where storage is blocked (private
 * mode), the address is the only memory left, so it stays.
 */
export function switchLang(lang) {
  let saved = false;
  try {
    localStorage.setItem(PICK_KEY, lang);
    saved = true;
  } catch { /* blocked storage */ }
  const url = new URL(location.href);
  if (saved) url.searchParams.delete('lang');
  else url.searchParams.set('lang', lang);
  location.replace(url.href);
}
