/**
 * O numero de uma colocacao, escrito como cada lingua escreve.
 *
 * Arquivo proprio porque nao e traducao: nao sai de chave nenhuma do
 * dicionario, e uma regra por lingua escrita em codigo.
 */

import { currentLang } from './traduzir.js';

/**
 * O numero de uma colocacao, escrito como cada lingua escreve.
 *
 * O `º` e indicador ordinal do portugues e do espanhol - em ingles e alemao ele
 * nao existe, e estava aparecendo assim mesmo. O ingles era pior que isso: a
 * traducao era "{n}th place", que produz "1th place", "2th place", "3th place".
 *
 * As excecoes do ingles nao sao decorativas: 11, 12 e 13 levam "th" apesar de
 * terminarem em 1, 2 e 3 - e 111 tambem, porque a regra olha os dois ultimos
 * digitos. Numa mesa de Commander isso nunca acontece, mas a funcao nao sabe de
 * onde e chamada, e uma regra pela metade e a que quebra quando alguem a reusa.
 */
export function ordinal(n, lang = currentLang()) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);

  if (lang === 'de') return num + '.';

  if (lang === 'en') {
    const dois = Math.abs(num) % 100;
    if (dois >= 11 && dois <= 13) return num + 'th';
    const um = Math.abs(num) % 10;
    if (um === 1) return num + 'st';
    if (um === 2) return num + 'nd';
    if (um === 3) return num + 'rd';
    return num + 'th';
  }

  return num + '\u00ba'; // portugues e espanhol
}
