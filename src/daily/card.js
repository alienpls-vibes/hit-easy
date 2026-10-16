/**
 * A Scryfall card turned into a puzzle: everything that does not give the
 * color away stays, and what does is hidden.
 *
 * Hidden:
 *   - the name, everywhere it appears (rules text, type line, flavor text) -
 *     both the English name and the printed name in the card's language, plus
 *     the short form legendary cards use to refer to themselves ("Whenever
 *     Krenko attacks"), plus any word the calendar line asks to hide;
 *   - the mana cost, and every COLORED mana symbol inside the text - {G},
 *     {2/W}, {B/P}, {U/R}. Generic and other symbols ({2}, {X}, {C}, {T})
 *     stay: they say nothing about the color.
 *
 * Kept: type line, mana value, rules text, flavor text, power/toughness,
 * loyalty and defense.
 *
 * Pure: no network, no DOM. The screen draws the segments this returns.
 */

const ORDER = ['W', 'U', 'B', 'R', 'G'];
const COLORED = new Set(ORDER);
const SYMBOL_PART = new Set([...ORDER, 'P', 'C', 'H', '2']);

// Built from strings: the module checker (tools/check_modules.py) counts
// braces, and a `{` inside a regex literal reads to it as an open block.
const SYMBOL = new RegExp('^\\{[^\\}]+\\}$');
const SYMBOL_SPLIT = new RegExp('(\\{[^\\}]+\\}|\\u0001)');
const BRACES = new RegExp('^\\{|\\}$', 'g');

/** WUBRG order; an empty list means colorless. */
export function normalizeColors(colors) {
  const set = new Set((colors || []).filter((c) => COLORED.has(c)));
  return ORDER.filter((c) => set.has(c));
}

/**
 * The card's colors - what the player has to guess.
 *
 * `colors`, not `color_identity`: a mono-green creature with a {W} activated
 * ability is a green card. A double-faced card keeps its colors on the faces;
 * the guess is about the front face, which is the one the puzzle shows.
 */
export function colorsOf(card) {
  if (!card) return [];
  if (Array.isArray(card.colors)) return normalizeColors(card.colors);
  const front = card.card_faces && card.card_faces[0];
  return normalizeColors(front && front.colors);
}

/**
 * Is a mana symbol colored? `{G}`, `{W/U}`, `{2/W}`, `{B/P}`, `{G/U/P}`,
 * `{C/W}` are; `{2}`, `{X}`, `{C}`, `{T}`, `{S}`, `{E}`, `{PW}`, `{CHAOS}` are
 * not.
 */
export function isColoredSymbol(symbol) {
  const inner = String(symbol || '').replace(BRACES, '').toUpperCase();
  const parts = inner.split('/');
  if (!parts.every((p) => SYMBOL_PART.has(p))) return false;
  return parts.some((p) => COLORED.has(p));
}

/**
 * Every form of the name worth hiding, longest first - so "Krenko, Mob Boss"
 * is hidden whole before "Krenko" gets a chance to leave ", Mob Boss" behind.
 */
export function nameForms(names, { legendary = false } = {}) {
  const forms = new Set();
  for (const raw of names || []) {
    const name = String(raw || '').trim();
    if (!name) continue;
    // Double-faced and split cards: each face is a name of its own.
    for (const part of name.split(/\s*\/\/\s*/)) {
      if (!part) continue;
      forms.add(part);
      const comma = part.indexOf(',');
      if (comma >= 3) forms.add(part.slice(0, comma).trim());
      // "Gwaihir the Windlord" calls itself "Gwaihir" in its own text.
      if (legendary && comma < 0) {
        const short = part.match(/^(\S{4,})\s+(the|of|der|die|das|des|du|de|del|la|el|o|a|do|da)\s/i);
        if (short) forms.add(short[1]);
      }
    }
  }
  return [...forms].sort((a, b) => b.length - a.length);
}

const LETTER = /[\p{L}\p{N}]/u;

/**
 * Replaces each whole-word occurrence of the forms with `mark`.
 *
 * Whole word, checked by hand instead of with a lookbehind: lookbehind in a
 * regex literal is a SyntaxError on iPhones older than iOS 16.4, and a syntax
 * error in a module takes down every module that imports it.
 */
export function hideNames(text, forms, mark) {
  let out = String(text || '');
  for (const form of forms) {
    const pattern = new RegExp(form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
    out = out.replace(pattern, (match, at, whole) => {
      const before = at > 0 ? whole[at - 1] : '';
      const after = whole[at + match.length] || '';
      if ((before && LETTER.test(before)) || (after && LETTER.test(after))) return match;
      return mark;
    });
  }
  return out;
}

/** The sentinel that stands for the hidden name until the screen draws it. */
export const NAME_MARK = '\u0001';

/**
 * Splits text into what the screen draws:
 *   { kind: 'text', text }      plain text
 *   { kind: 'name' }            the hidden name
 *   { kind: 'mana' }            a hidden colored mana symbol
 *   { kind: 'symbol', text }    a symbol that stays, like {T} or {2}
 */
export function segments(text, forms) {
  const hidden = hideNames(text, forms, NAME_MARK);
  const out = [];
  for (const piece of hidden.split(SYMBOL_SPLIT)) {
    if (!piece) continue;
    if (piece === NAME_MARK) out.push({ kind: 'name' });
    else if (SYMBOL.test(piece)) {
      out.push(isColoredSymbol(piece)
        ? { kind: 'mana' }
        : { kind: 'symbol', text: piece.slice(1, -1) });
    } else out.push({ kind: 'text', text: piece });
  }
  return out;
}

/** The face the puzzle shows: the whole card, or the front of a two-faced one. */
function frontOf(card) {
  return card.card_faces && card.card_faces.length && !card.oracle_text && !card.printed_text
    ? card.card_faces[0]
    : card;
}

function imageOf(card) {
  const uris = card.image_uris
    || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris)
    || {};
  return uris.normal || uris.large || uris.small || null;
}

/**
 * The puzzle of a card, as fetched from Scryfall (any language).
 *
 * A translated print carries `printed_text`, `printed_type_line` and
 * `printed_name`; some old or promotional prints lack one of them, and then
 * the English text fills the gap - `mixed` tells the screen so.
 *
 * `extraHide` comes from the calendar line, for the rare card that calls
 * itself something the rules above do not catch.
 */
export function buildPuzzle(card, { extraHide = [] } = {}) {
  const face = frontOf(card);
  const english = card.lang === 'en' || !card.lang;

  const printedText = english ? null : (face.printed_text || null);
  const printedType = english ? null : (face.printed_type_line || null);
  const text = printedText || face.oracle_text || '';
  const typeLine = printedType || face.type_line || card.type_line || '';
  const mixed = !english && (!printedText || !printedType);

  const legendary = /legendary/i.test(face.type_line || card.type_line || '');
  const forms = nameForms(
    [card.name, face.name, card.printed_name, face.printed_name, ...extraHide],
    { legendary },
  );

  return {
    lang: card.lang || 'en',
    mixed,
    typeLine: segments(typeLine, forms),
    text: text.split('\n').filter(Boolean).map((line) => segments(line, forms)),
    flavor: face.flavor_text ? segments(face.flavor_text, forms) : null,
    manaValue: typeof card.cmc === 'number' ? card.cmc : null,
    power: face.power != null ? face.power : null,
    toughness: face.toughness != null ? face.toughness : null,
    loyalty: face.loyalty != null ? face.loyalty : null,
    defense: face.defense != null ? face.defense : null,
    colors: colorsOf(card),
    reveal: {
      name: card.printed_name || card.name,
      englishName: card.name,
      image: imageOf(card),
      artist: card.artist || null,
      link: card.scryfall_uri || null,
    },
  };
}
