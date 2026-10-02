/**
 * Estatisticas - a porta do subsistema.
 *
 * Nada aqui toca o DOM, e e de proposito: se um dia isto virar React ou React
 * Native, este subsistema vai junto sem alteracao. E tambem por isso que e a
 * parte que os testes alcancam inteira.
 *
 * As pecas vivem em src/stats/:
 *
 *   agregar.js       o historico virando numero por deck e por jogador
 *   partida.js       uma partida so: resumo, linha do tempo, dano total
 *   rivalidades.js   o mesmo log lido por par de jogadores
 *   votacoes.js      escolhas em votacao, agrupadas por pergunta
 *   ordenar.js       por qual numero a lista se ordena
  cores.js         a cor de cada pessoa
 *   formatar.js      numero e data como cada idioma escreve
 */

export {
  aggregate, identityOf, labelOf, nomeRegistrado,
} from './stats/agregar.js';
export { ORDENACOES, ordenacaoPorId, ordenarLinhas } from './stats/ordenar.js';
export {
  summarize, timeline, totalDamage,
} from './stats/partida.js';
export {
  orientarRival, rivalBetween, rivalPeople, rivalries,
} from './stats/rivalidades.js';
export {
  categoriaDaVotacao, chaveDaVotacao, rotuloDaCategoria, rotuloDaVotacao,
  tituloDaVotacao,
} from './stats/votacoes.js';
export { playerColor, playerColorOrder } from './stats/cores.js';
export { formatDate, formatDuration, num, pct } from './stats/formatar.js';
