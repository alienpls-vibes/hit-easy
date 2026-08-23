/**
 * Paleta de identidade de cor (WUBRG), em duas versoes.
 *
 * A mesma cor nao serve aos dois temas: no escuro os tons sao claros e
 * dessaturados, para brilhar sobre o quase-preto sem competir com os numerais.
 * No claro eles precisam ESCURECER - branco (#E8DCBE) sobre fundo claro
 * simplesmente some, e o acento e o unico sinal da identidade do deck.
 *
 * Trocar a paleta e uma chamada de setPalette; quem ja desenhou com a antiga
 * precisa ser redesenhado, porque o acento vai como valor fixo no style.
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
let modo = 'dark';

/** `mode` e 'light' ou 'dark'. */
export function setPalette(mode) {
  active = PALETTES[mode] || PALETTES.dark;
  modo = PALETTES[mode] ? mode : 'dark';
}

/**
 * Cor de serie: uma por posicao, o mais separadas possivel entre si.
 *
 * O angulo aureo (137.5 graus) e o truque classico para isso - por mais itens
 * que existam, cada novo cai no maior vao que sobrou, e nunca se agrupam. Nao
 * ha paleta fixa para acabar.
 *
 * Isto NAO e identidade de cor de Magic: serve para reconhecer a mesma PESSOA
 * em partidas diferentes, que e outro eixo. O comandante identifica o deck; o
 * mesmo jogador troca de deck e continua sendo ele.
 */
export function seriesColor(index) {
  const hue = ((Number(index) || 0) * 137.508) % 360;
  return modo === 'light'
    ? 'hsl(' + hue.toFixed(1) + ' 58% 36%)'   // escurece para ler sobre branco
    : 'hsl(' + hue.toFixed(1) + ' 55% 68%)';  // clareia para ler sobre quase-preto
}

export function colorHex(letter) {
  return active[letter] || active.C;
}

const ORDER = ['W', 'U', 'B', 'R', 'G'];

/** Normaliza e ordena a identidade de cor no padrão WUBRG. */
export function normalizeIdentity(colors) {
  const set = new Set((colors || []).filter((c) => ORDER.includes(c)));
  const out = ORDER.filter((c) => set.has(c));
  return out.length ? out : ['C'];
}

/** Cor sólida principal — usada em bordas, realces e textos de acento. */
export function accentOf(colors) {
  const id = normalizeIdentity(colors);
  if (id.length === 1) return colorHex(id[0]);
  // Multicolorido: mistura as pontas do gradiente para um acento único e estável.
  return mix(colorHex(id[0]), colorHex(id[id.length - 1]), 0.5);
}

/** Gradiente da identidade, com alpha, para o tingimento de fundo do painel. */
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

/** Pips de mana em texto, para listas densas onde não cabe arte. */
export function pips(colors) {
  return normalizeIdentity(colors).join('');
}
