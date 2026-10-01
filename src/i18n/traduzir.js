/**
 * A mecanica da traducao: idioma corrente, `t()` e interpolacao.
 *
 * Nao sabe quais linguas existem - isso e de dicionarios.js. Aqui fica so a
 * regra de como uma chave vira texto.
 */

import { DICTS, LOCALES, FALLBACK } from './dicionarios.js';

let lang = 'pt';

export function setLang(next) {
  lang = DICTS[next] ? next : 'pt';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function currentLang() {
  return lang;
}

export function locale() {
  return LOCALES[lang] || 'pt-BR';
}

/**
 * Traduz. Chave faltando cai no portugues, e so entao na propria chave - o
 * usuario ve texto de verdade mesmo se uma traducao ficar para tras.
 */
export function t(key, vars) {
  const texto = (DICTS[lang] && DICTS[lang][key]) || FALLBACK[key] || key;
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (todo, nome) => (
    Object.prototype.hasOwnProperty.call(vars, nome) ? String(vars[nome]) : todo
  ));
}

/** Plural simples: as linguas aqui so precisam de um e muitos. */
export function tn(n, chaveUm, chaveMuitos, vars) {
  return t(n === 1 ? chaveUm : chaveMuitos, { n, ...vars });
}

/** Idioma sugerido pelo navegador, se for um dos nossos. */
export function detectLang() {
  if (typeof navigator === 'undefined') return 'pt';
  for (const tag of navigator.languages || [navigator.language || '']) {
    const base = String(tag).slice(0, 2).toLowerCase();
    if (DICTS[base]) return base;
  }
  return 'pt';
}
