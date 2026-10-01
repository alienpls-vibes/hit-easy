/**
 * A cor de cada pessoa.
 *
 * Vem da posicao dela numa fila ordenada por PRIMEIRA APARICAO no historico,
 * espalhada pelo circulo cromatico com o angulo aureo (137,5 graus) - assim
 * cada cor nova cai no maior vao que sobrou e nunca se agrupam.
 *
 * Por primeira aparicao, e nao alfabetica, porque cadastrar uma "Ana" mudaria a
 * cor de todo mundo depois dela - e o ponto da cor e justamente reconhecer a
 * mesma pessoa entre partidas.
 */

import { seriesColor } from '../colors.js';
import { identityOf } from './agregar.js';

/**
 * Posicao de cada jogador na fila de cores, por PRIMEIRA APARICAO no historico.
 *
 * A ordem precisa ser estavel: se fosse alfabetica, cadastrar uma "Ana" mudaria
 * a cor de todo mundo depois dela, e o ponto da cor e justamente reconhecer a
 * mesma pessoa entre partidas. Por primeira aparicao, quem chega depois so
 * ganha o proximo numero da fila e ninguem antes se mexe.
 */
export function playerColorOrder(matches, apelidos = null) {
  const ordem = new Map();
  const antigas = [...(matches || [])].sort(
    (a, b) => (a.startedAt || 0) - (b.startedAt || 0),
  );
  for (const match of antigas) {
    for (const seat of match.seats || []) {
      const chave = identityOf(seat, apelidos);
      if (chave && chave !== '?' && !ordem.has(chave)) ordem.set(chave, ordem.size);
    }
  }
  return ordem;
}

/**
 * Atalho: a cor de uma identidade, dada a ordem ja calculada.
 *
 * Recebe a CHAVE, nao o nome que aparece na tela - se recebesse o nome, a
 * mesma pessoa mudaria de cor ao ser cadastrada com outro nome, que e
 * exatamente o que se quer evitar.
 */
export function playerColor(ordem, chave) {
  const k = String(chave || '').trim().toLowerCase();
  return seriesColor(ordem.has(k) ? ordem.get(k) : 0);
}
