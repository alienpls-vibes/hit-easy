/**
 * Light/dark theme.
 *
 * Three modes: 'sistema' (system) follows the device preference, 'claro'
 * (light) and 'escuro' (dark) override it. These mode values are stored in the
 * settings, so they keep their Portuguese names. The effective theme goes to
 * the <html> dataset, and the CSS switches the tokens from there.
 *
 * The WUBRG palette switches too: the accents go into the DOM as fixed values
 * in the style, so whoever calls applyTheme has to redraw the screen afterwards
 * - which is what onChange is there to signal.
 */

import { setPalette } from './colors.js';

// The second item is the translation KEY, not the text: the label has to
// change along with the chosen language.
export const MODES = [
  ['sistema', 'settings.themeSystem'],
  ['claro', 'settings.themeLight'],
  ['escuro', 'settings.themeDark'],
];

const BG = { light: '#f4f4f2', dark: '#08080a' };

const query = typeof matchMedia === 'function'
  ? matchMedia('(prefers-color-scheme: light)')
  : null;

let mode = 'sistema';
let onChange = null;

/** The theme actually in effect now: 'light' or 'dark'. */
export function effective(which = mode) {
  if (which === 'claro') return 'light';
  if (which === 'escuro') return 'dark';
  return query && query.matches ? 'light' : 'dark';
}

export function currentMode() {
  return mode;
}

export function applyTheme(next) {
  mode = next || 'sistema';
  const eff = effective(mode);

  document.documentElement.dataset.theme = eff;
  setPalette(eff);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BG[eff]);
}

/** Signals when the effective theme changes - including through a system change. */
export function watchTheme(fn) {
  onChange = fn;
  if (!query) return;
  query.addEventListener('change', () => {
    if (mode !== 'sistema') return; // the user chose, the system no longer decides
    applyTheme(mode);
    if (onChange) onChange();
  });
}
