/**
 * Estatisticas - a porta da tela.
 *
 * As pecas vivem em src/views/stats/, uma por elemento:
 *
 *   tela.js           as abas, e qual esta aberta
 *   pecas.js          as pecas pequenas que varias abas reusam
 *   deck.js           o cartao de um deck (cor pela identidade WUBRG)
 *   jogador.js        o cartao de um jogador (cor pela pessoa)
 *   rivalidades.js    o par de jogadores, e quem persegue quem
 *   partida.js        o cartao de uma partida e a linha do tempo
 *   vitoria.js        como as vitorias foram ganhas
 *   votacoes.js       escolhas em votacoes secretas
 *   backup.js         exportar e importar JSON
 *   marcar-conta.js   marcar a conta de uma cadeira depois do jogo
 *   paywall.js        o que se ve sem assinatura
 *
 * Dois nomes atravessam essa porta, e so eles.
 */

export { renderStats } from './stats/tela.js';
export { renderPaywall } from './stats/paywall.js';
