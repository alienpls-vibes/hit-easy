/**
 * A mesa: monta a tela e liga as pecas.
 *
 * Este arquivo nao desenha painel, nao trata gesto e nao muda estado - ele so
 * monta o contexto, pendura as pecas nele e constroi a arvore do DOM na ordem
 * certa. A ordem importa: o hub precisa das pecas ja penduradas, `wrap` precisa
 * do hub, e `sync()` precisa de tudo.
 *
 * Nenhuma peca chama outra por import. Todas se acham por `mesa.<nome>`, e e o
 * que permite que gestos chame o teclado de dano, que chama `apply`, que chama
 * `sync` - sem que nenhum dos quatro arquivos importe outro.
 */

import { el, clear, closeSheet } from '../../ui.js';
import { criarContexto, criarCamadaDeArraste } from './contexto.js';
import { criarEstado } from './estado.js';
import { criarPintura } from './pintar.js';
import { criarGestos } from './gestos.js';
import { criarDano } from './dano.js';
import { criarArea } from './area.js';
import { criarMana } from './mana.js';
import { criarVotacao } from './votacao.js';
import { criarPainelDoJogador } from './jogador.js';
import { criarHub } from './hub.js';
import { criarMenu } from './menu.js';
import { criarVitoria } from './vitoria.js';

export function renderTable(root, ctx) {
  const mesa = criarContexto(root, ctx);

  // As pecas antes do DOM: buildTile() e buildHub() ja precisam delas.
  Object.assign(
    mesa,
    criarEstado(mesa),
    criarPintura(mesa),
    criarGestos(mesa),
    criarDano(mesa),
    criarArea(mesa),
    criarMana(mesa),
    criarVotacao(mesa),
    criarPainelDoJogador(mesa),
    criarHub(mesa),
    criarMenu(mesa),
    criarVitoria(mesa),
  );

  clear(root);

  mesa.grid = el('div', {
    class: 'table-grid',
    style: {
      gridTemplateColumns: 'repeat(' + mesa.layout.cols + ', 1fr)',
      gridTemplateRows: 'repeat(' + mesa.layout.rows + ', 1fr)',
    },
  });

  mesa.match.seats.forEach((seat, i) => {
    const spec = mesa.layout.seats[i];
    mesa.rotOf.set(seat.id, spec.rot);
    const tile = mesa.buildTile(seat, spec);
    mesa.tiles.set(seat.id, tile);
    mesa.grid.append(tile.root);
  });

  criarCamadaDeArraste(mesa);

  mesa.hub = mesa.buildHub();
  mesa.pauseView = mesa.buildPause();
  mesa.wrap = el('div', { class: 'table-wrap' }, [
    mesa.grid, mesa.hub.root, mesa.fx, mesa.pauseView.root,
  ]);
  root.append(mesa.wrap);
  mesa.sync();
  mesa.hintOnce();

  return {
    destroy: () => {
      mesa.destroyed = true;
      mesa.stopPauseClock();
      mesa.commitAll(); // nada de perder o ultimo toque na troca de tela
      closeSheet();
    },
  };
}
