/**
 * Montagem da mesa - a porta da tela.
 *
 * As pecas vivem em src/views/setup/, uma por elemento da home:
 *
 *   rascunho.js           a mesa sendo montada (vida, assentos, disposicao)
 *   home.js               a tela em si
 *   cartao-jogador.js     o cartao de um assento, e o arraste que reordena
 *   escolher-jogador.js   quem senta aqui
 *   escolher-deck.js      qual deck ele leva
 *   antes-de-comecar.js   quem abre a partida, e o layout da mesa
 *   configuracoes.js      as preferencias do app
 *   instalar.js           o bloco de instalacao
 *   conta.js              entrar, criar conta, assinatura
 *   handle.js             o proprio @
 *   convites.js           partidas em que alguem diz que voce estava
 *   sincronizacao.js      o que subiu e o que falta
 *   notas-de-versao.js    o que mudou nesta versao
 *
 * Tres nomes atravessam essa porta, e so eles: e o que app.js conhece da tela
 * inteira. Dividir as pecas de outro jeito amanha nao toca em app.js.
 */

export { renderSetup } from './setup/home.js';
export { seedDraftFrom } from './setup/rascunho.js';
export { abrirNovidades } from './setup/notas-de-versao.js';
export {
  passarMesa, receberMesa, mesaPassadaBanner, receberMesaBotao,
  continuarMesaBanner, nomeDoArquivo,
} from './setup/passar-mesa.js';
