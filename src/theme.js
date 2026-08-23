/**
 * Tema claro/escuro.
 *
 * Tres modos: 'sistema' segue a preferencia do aparelho, 'claro' e 'escuro'
 * mandam nela. O modo escolhido vai para o dataset do <html>, e o CSS troca os
 * tokens a partir dali.
 *
 * A paleta WUBRG tambem troca: os acentos vao para o DOM como valor fixo no
 * style, entao quem chama applyTheme precisa redesenhar a tela depois - e o
 * que o onChange serve para avisar.
 */

import { setPalette } from './colors.js';

// Segundo item e a CHAVE de traducao, nao o texto: o rotulo tem que mudar
// junto com o idioma escolhido.
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

/** O tema que vale de fato agora: 'light' ou 'dark'. */
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

/** Avisa quando o tema efetivo mudar - inclusive por mudanca do sistema. */
export function watchTheme(fn) {
  onChange = fn;
  if (!query) return;
  query.addEventListener('change', () => {
    if (mode !== 'sistema') return; // o usuario mandou, o sistema nao manda mais
    applyTheme(mode);
    if (onChange) onChange();
  });
}
