/**
 * A mesa - a porta da tela.
 *
 * Event sourcing: a partida E a lista de eventos, e o estado visivel e sempre
 * `replay(match)`. Dai saem de graca o desfazer, as estatisticas exatas e a
 * garantia de que o placar nunca diverge do historico.
 *
 * As pecas vivem em src/views/table/:
 *
 *   contexto.js    o que todas compartilham (antes era o closure)
 *   mesa.js        monta a tela e liga as pecas
 *   constantes.js  as medidas do gesto, e as cores de mana
 *   pecas.js       rotulo/numero, a linha com - e +, o "segurar repete"
 *   estado.js      quem muda a partida: apply, desfazer, passar a vez, pausa
 *   pintar.js      desenhar a mesa a partir do estado
 *   gestos.js      a duracao do toque decide o que ele e
 *   dano.js        a seta direcional e o teclado do dano
 *   area.js        dano em todos, e dreno
 *   mana.js        o marcador de mana
 *   votacao.js     votacao secreta, passando o aparelho de mao em mao
 *   jogador.js     o painel de um jogador
 *   hub.js         o nucleo central, e a cobertura da pausa
 *   menu.js        o menu da partida
 *   vitoria.js     quem ganhou, como ganhou, e o cartaz
 *
 * Um nome atravessa essa porta.
 */

export { renderTable } from './table/mesa.js';
