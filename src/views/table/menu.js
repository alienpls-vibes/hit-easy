/**
 * The match menu: pause, mana, vote, declare a winner, leave.
 */

import { el, openSheet, confirmAction } from '../../ui.js';
import { elapsedOf } from '../../engine.js';
import { formatDuration } from '../../stats.js';
import { t } from '../../i18n.js';

export function createMenu(table) {
  function openMenu() {
    table.commitAll();
    openSheet({
      title: t('table.match'),
      subtitle: 'Turno ' + table.state.turn + ' · ' + formatDuration(elapsedOf(table.match, table.state)),
      build: (body, close) => {
        const item = (label, sub, fn, cls = '') =>
          el('button', { class: 'menu-item ' + cls, onClick: () => { close(); fn(); } }, [
            el('span', { class: 'menu-label', text: label }),
            sub ? el('span', { class: 'menu-sub', text: sub }) : null,
          ]);

        body.append(el('div', { class: 'menu' }, [
          item(
            table.state.paused ? t('table.resume') : t('table.pause'),
            table.state.paused ? t('table.resumeSub') : t('table.pauseSub'),
            table.togglePause,
          ),
          item(t('table.passTurn'), t('table.passTurnSub'), table.passTurn),
          item(t('common.undo'), '', table.doUndo),
          item(t('common.redo'), '', table.doRedo),
          item(t('mana.marker'), t('mana.markerSub'), table.openMana),
          item(t('vote.title'), t('vote.menuSub'), table.openVote),
          item(t('table.declareWinner'), t('table.declareWinnerSub'), table.pickWinner),
          item(t('common.stats'), '', table.ctx.onStats),
          // Above discard, and away from it: both take the table off this
          // device, but one keeps the game and the other throws it away.
          item(t('pass.menu'), t('pass.menuSub'), table.ctx.onPassTable),
          item(t('table.discard'), t('table.discardSub'), async () => {
            const ok = await confirmAction({
              title: t('table.discardTitle'),
              message: t('table.discardMsg'),
              confirmLabel: t('table.discard'),
            });
            if (ok) table.ctx.onDiscard();
          }, 'is-danger'),
        ]));
      },
    });
  }

  return { openMenu };
}
