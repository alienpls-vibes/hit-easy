/**
 * The central core - turn, undo and menu - and the pause cover.
 *
 * The pass-turn button is big on purpose: it is the most repeated action of
 * the match, often with a busy hand. The pause covers the table and accepts no
 * touch: a pause that lets you change the score with the clock stopped is no
 * pause.
 */

import { el, icon } from '../../ui.js';
import { t } from '../../i18n.js';

export function createHub(table) {
  function buildHub() {
    const turn = el('span', { class: 'hub-turn' });
    const ring = el('button', {
      class: 'hub-ring',
      'aria-label': t('table.passTurn'),
      onClick: table.passTurn,
    }, [el('span', { class: 'hub-label', text: t('table.turn') }), turn]);

    const undoBtn = el('button', { class: 'hub-btn', 'aria-label': t('common.undo'), onClick: table.doUndo }, [icon('undo')]);

    /*
     * Mana shortcut. It only exists while there is marked mana, and then it
     * plays two roles at once: it reminds that mana is left before passing the
     * turn, and it goes straight to the counter - which is the round trip made
     * all the time when spending part of the mana, resolving the spell and
     * coming back to settle the rest.
     */
    const manaCount = el('span', { class: 'hub-mana-count' });
    const manaBtn = el('button', {
      class: 'hub-btn is-mana',
      'aria-label': t('mana.marker'),
      hidden: true,
      onClick: table.openMana,
    }, [manaCount]);

    const menuBtn = el('button', {
      class: 'hub-btn', 'aria-label': t('common.menu'), onClick: table.openMenu,
    }, [icon('more')]);

    return {
      root: el('div', { class: 'hub' }, [undoBtn, ring, manaBtn, menuBtn]),
      turn, ring, undoBtn, manaBtn, manaCount,
    };
  }

  /**
   * The pause cover. It really blocks - a pause that allows touching is no
   * pause, and the score would move with the clock stopped.
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
          el('button', { class: 'btn primary', onClick: table.togglePause }, [t('table.resume')]),
        ]),
      ]),
    };
  }

  return { buildHub, buildPause };
}
