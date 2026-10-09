/**
 * Color identity palette (WUBRG), in two versions.
 *
 * The same color does not serve both themes: in dark the tones are light and
 * desaturated, to shine over the near-black without competing with the
 * numerals. In light they have to DARKEN - white (#E8DCBE) over a light
 * background simply disappears, and the accent is the only sign of the deck's
 * identity.
 *
 * Switching the palette is one setPalette call; whatever was already drawn
 * with the old one has to be redrawn, because the accent goes as a fixed value
 * in the style.
 */
const PALETTES = {
  dark: {
    W: '#E8DCBE',
    U: '#5C9FD6',
    B: '#9B82B8',
    R: '#D9604C',
    G: '#4FA97C',
    C: '#8E949B',
  },
  light: {
    W: '#9A7B28',
    U: '#2A6BA6',
    B: '#674A82',
    R: '#B03B27',
    G: '#2B7550',
    C: '#666C74',
  },
};

let active = PALETTES.dark;
let paletteMode = 'dark';

/** `mode` is 'light' or 'dark'. */
export function setPalette(mode) {
  active = PALETTES[mode] || PALETTES.dark;
  paletteMode = PALETTES[mode] ? mode : 'dark';
}

/**
 * Series color: one per position, as far apart from each other as possible.
 *
 * The golden angle (137.5 degrees) is the classic trick for this - however
 * many items there are, each new one falls into the largest gap left, and they
 * never cluster. There is no fixed palette to run out of.
 *
 * This is NOT Magic color identity: it serves to recognize the same PERSON
 * across different matches, which is another axis. The commander identifies
 * the deck; the same player switches decks and is still themselves.
 */
export function seriesColor(index) {
  const hue = ((Number(index) || 0) * 137.508) % 360;
  return paletteMode === 'light'
    ? 'hsl(' + hue.toFixed(1) + ' 58% 36%)'   // darkens to read on white
    : 'hsl(' + hue.toFixed(1) + ' 55% 68%)';  // lightens to read on near-black
}

export function colorHex(letter) {
  return active[letter] || active.C;
}

const ORDER = ['W', 'U', 'B', 'R', 'G'];

/** Normalizes and sorts the color identity in WUBRG order. */
export function normalizeIdentity(colors) {
  const set = new Set((colors || []).filter((c) => ORDER.includes(c)));
  const out = ORDER.filter((c) => set.has(c));
  return out.length ? out : ['C'];
}

/** Main solid color - used in borders, highlights and accent text. */
export function accentOf(colors) {
  const id = normalizeIdentity(colors);
  if (id.length === 1) return colorHex(id[0]);
  // Multicolor: mixes the ends of the gradient into a single, stable accent.
  return mix(colorHex(id[0]), colorHex(id[id.length - 1]), 0.5);
}

/** The identity gradient, with alpha, for tinting the panel background. */
export function identityGradient(colors, alpha = 1, angle = '145deg') {
  const id = normalizeIdentity(colors);
  const stops = id.map((c) => withAlpha(colorHex(c), alpha));
  if (stops.length === 1) stops.push(withAlpha(colorHex(id[0]), alpha * 0.35));
  return `linear-gradient(${angle}, ${stops.join(', ')})`;
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

export function mix(hexA, hexB, t) {
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  const ch = (x, y) => Math.round(x + (y - x) * clamp01(t));
  return rgbToHex(ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b));
}

function toRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/** Mana pips as text, for dense lists where art does not fit. */
export function pips(colors) {
  return normalizeIdentity(colors).join('');
}
