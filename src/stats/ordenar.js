/**
 * Por qual número a lista de decks ou de jogadores se ordena.
 *
 * Uma regra é `{ id, chave, maior, rotulo }`: o campo da linha agregada, se o
 * topo é o valor maior ou o menor, e a chave de tradução do nome. Ter os quatro
 * juntos é o que impede o caso que já aconteceu em outra lista: a tela mostrando
 * "melhor colocação" e ordenando do pior para o melhor, porque o rótulo e a
 * direção moravam em arquivos diferentes.
 *
 * Colocação é a única que sobe: primeiro lugar é 1, então o melhor é o MENOR.
 *
 * O desempate é sempre a relevância, e não a ordem em que a agregação devolveu.
 * Com `games`, metade do grupo empata em duas partidas; sem desempate explícito
 * a lista dependia da ordem de inserção do Map, que muda quando se apaga uma
 * partida antiga - a pessoa veria a lista se reorganizar sozinha sem nada ter
 * mudado naquele número.
 */

import { porRelevancia } from './agregar.js';

export const ORDENACOES = [
  // O padrão é o que a tela sempre fez: taxa primeiro, partidas no empate.
  { id: 'relevancia', chave: null, maior: true, rotulo: 'stats.sortRelevance' },
  { id: 'partidas', chave: 'games', maior: true, rotulo: 'stats.sortMatches' },
  { id: 'vitorias', chave: 'wins', maior: true, rotulo: 'stats.sortWins' },
  { id: 'taxa', chave: 'winrate', maior: true, rotulo: 'stats.sortWinrate' },
  { id: 'dano', chave: 'avgDamageDealt', maior: true, rotulo: 'stats.sortDamage' },
  { id: 'eliminacoes', chave: 'avgKills', maior: true, rotulo: 'stats.sortKills' },
  { id: 'colocacao', chave: 'avgPlace', maior: false, rotulo: 'stats.sortPlace' },
];

/** A regra de um id, ou o padrão quando o id não existe mais. */
export function ordenacaoPorId(id) {
  return ORDENACOES.find((o) => o.id === id) || ORDENACOES[0];
}

/**
 * Ordena uma lista de linhas agregadas por uma das regras.
 *
 * Devolve uma lista nova: a tela chama isto a cada repintura, e ordenar no
 * lugar embaralharia o `agg` que as outras abas estão lendo.
 */
export function ordenarLinhas(linhas, id) {
  const regra = ordenacaoPorId(id);
  const copia = [...(linhas || [])];
  if (!regra.chave) return copia.sort(porRelevancia);

  return copia.sort((a, b) => {
    const va = Number(a[regra.chave]) || 0;
    const vb = Number(b[regra.chave]) || 0;
    if (va !== vb) return regra.maior ? vb - va : va - vb;
    return porRelevancia(a, b);
  });
}
