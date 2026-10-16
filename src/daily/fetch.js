/**
 * Today's card, from Scryfall, in the language the player chose.
 *
 * The calendar holds English names only. A translated print is found by
 * exact name plus `lang:` - the newest print in that language that carries
 * translated rules text wins. A card never printed in that language falls
 * back to English, and the screen says so: showing nothing would be worse
 * than showing the original.
 *
 * Each answer is kept on the device (storage.js), so reopening the challenge
 * later in the day works without signal.
 */

import { cachedCard, cacheCard } from './storage.js';

const API = 'https://api.scryfall.com';

/**
 * The languages Scryfall has prints in, each written in itself - whoever
 * looks for their own language finds it in their own alphabet.
 */
export const CARD_LANGS = [
  ['en', 'English'],
  ['pt', 'Português'],
  ['es', 'Español'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['it', 'Italiano'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['ru', 'Русский'],
  ['zhs', '简体中文'],
  ['zht', '繁體中文'],
];

export function isCardLang(code) {
  return CARD_LANGS.some(([c]) => c === code);
}

/** Only the fields the puzzle reads - the full object is several KB. */
const FACE_FIELDS = [
  'name', 'printed_name', 'oracle_text', 'printed_text', 'type_line', 'printed_type_line',
  'flavor_text', 'power', 'toughness', 'loyalty', 'defense', 'colors', 'image_uris',
];
const CARD_FIELDS = [...FACE_FIELDS, 'lang', 'cmc', 'artist', 'scryfall_uri', 'image_status'];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
}

export function slim(card) {
  const out = pick(card, CARD_FIELDS);
  if (Array.isArray(card.card_faces)) out.card_faces = card.card_faces.map((f) => pick(f, FACE_FIELDS));
  return out;
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Scryfall responded ' + res.status);
  return res.json();
}

/** The best print among a language's results: the one that is really translated. */
export function bestPrint(prints) {
  const list = prints || [];
  const scanned = (c) => c.image_status !== 'placeholder' && c.image_status !== 'missing';
  return list.find((c) => c.printed_text && c.printed_type_line && scanned(c))
    || list.find((c) => c.printed_text && c.printed_type_line)
    || list.find((c) => c.printed_text)
    || list[0]
    || null;
}

async function fromNetwork(name, lang, signal) {
  if (lang !== 'en') {
    const q = '!"' + name.split('"').join('\\"') + '" lang:' + lang;
    const url = API + '/cards/search?unique=prints&order=released&dir=desc&q=' + encodeURIComponent(q);
    const list = await getJson(url, signal);
    const print = bestPrint(list && list.data);
    if (print) {
      const card = slim(print);
      // Many translated prints were never scanned: Scryfall serves a
      // "Localized image not available" placeholder. The reveal borrows the
      // English scan instead - one more request, only for those cards.
      if (card.image_status === 'placeholder' || card.image_status === 'missing') {
        const english = await getJson(API + '/cards/named?exact=' + encodeURIComponent(name), signal);
        if (english) {
          const scan = slim(english);
          if (scan.image_uris) card.image_uris = scan.image_uris;
          if (scan.card_faces && card.card_faces) {
            card.card_faces.forEach((f, i) => { if (scan.card_faces[i]) f.image_uris = scan.card_faces[i].image_uris; });
          }
        }
      }
      return { card, fallback: false };
    }
  }
  const card = await getJson(API + '/cards/named?exact=' + encodeURIComponent(name), signal);
  if (!card) throw new Error('Card not found on Scryfall: ' + name);
  return { card: slim(card), fallback: lang !== 'en' };
}

/**
 * The card of a day, in a language. Answers from the device when it can,
 * and from the network otherwise.
 *
 * Resolves `{ card, fallback }`: `fallback` is true when the language had no
 * print and English came instead.
 */
export async function loadCard(date, name, lang, { signal } = {}) {
  const hit = cachedCard(date, lang);
  if (hit && hit.card && hit.card.name === name) return hit;

  const found = await fromNetwork(name, lang, signal);
  cacheCard(date, lang, found);
  return found;
}
