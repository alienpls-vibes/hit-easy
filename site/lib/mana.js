/**
 * Magic color identity (WUBRG), with the same tones and the same rules the
 * app uses on dark (src/colors.js):
 *
 *   accentOf()     one solid color per deck - bars, borders, highlights;
 *                  multicolor mixes the two ends of the identity
 *   identityTint() the faint identity wash behind a deck or a table panel
 *
 * A deck is colored by its commander; a PERSON is colored by their own color
 * (playerColor in the app's statistics). The two never mix.
 */

export const MANA = {
  W: '#E8DCBE',
  U: '#5C9FD6',
  B: '#9B82B8',
  R: '#D9604C',
  G: '#4FA97C',
  C: '#8E949B',
};

const ORDER = ['W', 'U', 'B', 'R', 'G'];

/** The identity in WUBRG order; colorless when empty. */
export function normalizeIdentity(colors) {
  const set = {};
  (colors || []).forEach((c) => { set[c] = true; });
  const out = ORDER.filter((c) => set[c]);
  return out.length ? out : ['C'];
}

/** Identity of a deck: the union of its commanders' colors. */
export function deckIdentity(commanders) {
  const all = [];
  (commanders || []).forEach((c) => (c.colors || []).forEach((x) => all.push(x)));
  return normalizeIdentity(all);
}

function toRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function mix(a, b, t) {
  const x = toRgb(a);
  const y = toRgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function withAlpha(hex, alpha) {
  const [r, g, b] = toRgb(hex);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

/** The deck's single solid color, as the app computes it. */
export function accentOf(colors) {
  const id = normalizeIdentity(colors);
  if (id.length === 1) return MANA[id[0]];
  return mix(MANA[id[0]], MANA[id[id.length - 1]], 0.5);
}

/** The faint identity wash (the app's identityGradient with alpha). */
export function identityTint(colors, alpha, angle = '145deg') {
  const id = normalizeIdentity(colors);
  const stops = id.map((c) => withAlpha(MANA[c], alpha));
  if (stops.length === 1) stops.push(withAlpha(MANA[id[0]], alpha * 0.35));
  return 'linear-gradient(' + angle + ', ' + stops.join(', ') + ')';
}

/** Mana pips as text ("WUBG"), for dense lists - same as the app. */
export function pips(colors) {
  return normalizeIdentity(colors).join('');
}

/**
 * A commander's art as a CSS url(), or '' when there is none.
 *
 * `thumb` first, like the app's statistics, then `art`. The address comes from
 * match data, so it is quoted and stripped of anything that could close the
 * quote - any https address works, including Scryfall's `?123` suffix.
 */
export function artUrl(commanders) {
  const list = commanders || [];
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i] || {};
    const src = [c.thumb, c.art].find((a) => typeof a === 'string' && /^https:\/\//.test(a));
    if (src) return 'url("' + src.replace(/["\\\n\r]/g, encodeURIComponent) + '")';
  }
  return '';
}
