/**
 * Que idiomas existem, e onde cada um mora.
 *
 * Separado da traducao de proposito: acrescentar uma lingua e mexer AQUI - um
 * arquivo novo, uma linha em LANGS, uma em LOCALES e uma em DICTS - sem
 * encostar na mecanica do `t()`.
 */

import { PT } from './pt.js';
import { EN } from './en.js';
import { ES } from './es.js';
import { DE } from './de.js';

/** Ordem em que aparecem no seletor de Configuracoes. */
export const LANGS = [
  ['pt', 'Português'],
  ['en', 'English'],
  ['es', 'Español'],
  ['de', 'Deutsch'],
];

/** Locale para datas e numeros, por idioma. */
export const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', de: 'de-DE' };

export const DICTS = { pt: PT, en: EN, es: ES, de: DE };

/** O retorno quando uma chave falta: ver src/i18n/pt.js. */
export const FALLBACK = PT;
