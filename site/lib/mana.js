/**
 * Magic color identity (WUBRG), the same tones the app uses on dark
 * (src/colors.js). Used to tint decks and the table illustration.
 */

export const MANA = {
  W: '#E8DCBE',
  U: '#5C9FD6',
  B: '#9B82B8',
  R: '#D9604C',
  G: '#4FA97C',
  C: '#8E949B',
};

export function manaColors(colors) {
  const list = (colors || []).filter((c) => MANA[c]);
  return list.length ? list.map((c) => MANA[c]) : [MANA.C];
}

/** A CSS gradient across the identity colors, for a background or a bar. */
export function identityGradient(colors, angle = '135deg') {
  const list = manaColors(colors);
  if (list.length === 1) return 'linear-gradient(' + angle + ', ' + list[0] + ', ' + list[0] + ')';
  return 'linear-gradient(' + angle + ', ' + list.join(', ') + ')';
}
