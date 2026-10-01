/**
 * O nucleo central - turno, desfazer e menu - e a cobertura da pausa.
 *
 * O botao de passar a vez e grande de proposito: e a acao mais repetida da
 * partida, muitas vezes com a mao ocupada. A pausa cobre a mesa e nao aceita
 * toque: uma pausa que deixa mexer no placar com o relogio parado nao e pausa.
 */

import { el, icon } from '../../ui.js';
import { t } from '../../i18n.js';

export function criarHub(mesa) {
  function buildHub() {
    const turn = el('span', { class: 'hub-turn' });
    const ring = el('button', {
      class: 'hub-ring',
      'aria-label': t('table.passTurn'),
      onClick: mesa.passTurn,
    }, [el('span', { class: 'hub-label', text: t('table.turn') }), turn]);

    const undoBtn = el('button', { class: 'hub-btn', 'aria-label': t('common.undo'), onClick: mesa.doUndo }, [icon('undo')]);

    /*
     * Atalho da mana. So existe enquanto ha mana marcada, e ai vale dois
     * papeis de uma vez: lembra que sobrou mana antes de passar a vez, e leva
     * direto ao contador - que e o caminho de ida e volta o tempo todo quando
     * se gasta parte da mana, resolve a magia e volta para acertar o resto.
     */
    const manaCount = el('span', { class: 'hub-mana-count' });
    const manaBtn = el('button', {
      class: 'hub-btn is-mana',
      'aria-label': t('mana.marker'),
      hidden: true,
      onClick: mesa.openMana,
    }, [manaCount]);

    const menuBtn = el('button', {
      class: 'hub-btn', 'aria-label': t('common.menu'), onClick: mesa.openMenu,
    }, [icon('more')]);

    return {
      root: el('div', { class: 'hub' }, [undoBtn, ring, manaBtn, menuBtn]),
      turn, ring, undoBtn, manaBtn, manaCount,
    };
  }

  /**
   * Cobertura da pausa. Bloqueia mesmo - uma pausa que deixa tocar nao e
   * pausa, e o placar andaria com o relogio parado.
   */
  function buildPause() {
    const clock = el('span', { class: 'pause-clock', text: '0s' });
    return {
      clock,
      root: el('div', { class: 'pause' }, [
        el('div', { class: 'pause-card' }, [
          el('span', { class: 'pause-eyebrow', text: t('table.paused') }),
          clock,
          el('p', { class: 'pause-note', text: t('table.pausedNote') }),
          el('button', { class: 'btn primary', onClick: mesa.togglePause }, [t('table.resume')]),
        ]),
      ]),
    };
  }

  return { buildHub, buildPause };
}
