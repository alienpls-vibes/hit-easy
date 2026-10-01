/**
 * O menu da partida: pausar, mana, votacao, declarar vencedor, sair.
 */

import { el, openSheet, confirmAction } from '../../ui.js';
import { elapsedOf } from '../../engine.js';
import { formatDuration } from '../../stats.js';
import { t } from '../../i18n.js';

export function criarMenu(mesa) {
  function openMenu() {
    mesa.commitAll();
    openSheet({
      title: t('table.match'),
      subtitle: 'Turno ' + mesa.state.turn + ' · ' + formatDuration(elapsedOf(mesa.match, mesa.state)),
      build: (body, close) => {
        const item = (label, sub, fn, cls = '') =>
          el('button', { class: 'menu-item ' + cls, onClick: () => { close(); fn(); } }, [
            el('span', { class: 'menu-label', text: label }),
            sub ? el('span', { class: 'menu-sub', text: sub }) : null,
          ]);

        body.append(el('div', { class: 'menu' }, [
          item(
            mesa.state.paused ? t('table.resume') : t('table.pause'),
            mesa.state.paused ? t('table.resumeSub') : t('table.pauseSub'),
            mesa.togglePause,
          ),
          item(t('table.passTurn'), t('table.passTurnSub'), mesa.passTurn),
          item(t('common.undo'), '', mesa.doUndo),
          item(t('common.redo'), '', mesa.doRedo),
          item(t('mana.marker'), t('mana.markerSub'), mesa.openMana),
          item(t('vote.title'), t('vote.menuSub'), mesa.openVote),
          item(t('table.declareWinner'), t('table.declareWinnerSub'), mesa.pickWinner),
          item(t('common.stats'), '', mesa.ctx.onStats),
          item(t('table.discard'), t('table.discardSub'), async () => {
            const ok = await confirmAction({
              title: t('table.discardTitle'),
              message: t('table.discardMsg'),
              confirmLabel: t('table.discard'),
            });
            if (ok) mesa.ctx.onDiscard();
          }, 'is-danger'),
        ]));
      },
    });
  }

  return { openMenu };
}
