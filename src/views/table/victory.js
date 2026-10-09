/**
 * The victory: who won, how they won, and the poster.
 *
 * A win by being the last one alive does NOT ask for the reason and invents no
 * cause. The reason is optional also when declared by hand: the table does not
 * always agree on the label, and a screen that does not let you out would be
 * worse than a missing piece of data.
 */

import { el, icon, openFlow, buzz } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { elapsedOf, deckNameOf } from '../../engine.js';
import { formatDuration, totalDamage } from '../../stats.js';
import { t } from '../../i18n.js';
import { stat } from './widgets.js';

/**
 * The win reasons. The ids go into the `win` event as `reason` and are stored
 * with the match, so they keep their Portuguese values.
 */
const WIN_REASONS = [
  ['combate', 'win.combat'], ['comandante', 'win.commander'],
  ['combo', 'win.combo'], ['veneno', 'win.poison'],
  ['mill', 'win.mill'], ['alternativa', 'win.alt'],
  ['concessao', 'win.concede'], ['outro', 'win.other'],
];

export function createVictory(table) {
  /**
   * A win declared by hand: who won and, then, HOW.
   *
   * The reason is optional on purpose - the table does not always agree on
   * the label, and a screen that does not let you out would be worse than a
   * missing piece of data. A win by being the last one alive does not come
   * through here and invents no cause.
   */
  function pickWinner() {
    openFlow({
      title: t('table.whoWon'),
      build: (pane, api) => {
        pane.append(el('div', { class: 'menu' }, table.match.seats.map((seat) =>
          el('button', {
            class: 'menu-item',
            style: { '--accent': accentOf(seat.commanders[0] ? seat.commanders[0].colors : []) },
            onClick: () => api.next(winReasonStep(seat)),
          }, [
            el('span', { class: 'menu-label', text: seat.name }),
            el('span', { class: 'menu-sub', text: deckNameOf(seat.commanders) }),
          ]),
        )));
      },
    });
  }

  function winReasonStep(seat) {
    return {
      title: t('win.reasonTitle', { name: seat.name }),
      subtitle: t('win.reasonSub'),
      build: (pane, api) => {
        const finish = (reason) => {
          api.close();
          table.apply({ type: 'win', targetId: seat.id, reason });
        };

        pane.append(el('div', { class: 'win-reasons' }, WIN_REASONS.map(([id, key]) =>
          el('button', { class: 'win-reason', onClick: () => finish(id) }, [t(key)]),
        )));

        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn ghost block',
            onClick: () => finish(null),
          }, [t('win.skip')]),
        ]));
      },
    };
  }

  function showVictory() {
    const winner = table.match.seats.find((s) => s.id === table.state.winnerId);
    const commander = winner && winner.commanders[0];
    const overlay = el('div', { class: 'victory' }, [
      el('div', {
        class: 'victory-card',
        style: { '--accent': commander ? accentOf(commander.colors) : '#fff' },
      }, [
        commander && commander.art
          ? el('div', { class: 'victory-art', style: { backgroundImage: 'url(' + commander.art + ')' } })
          : null,
        el('div', { class: 'victory-body' }, [
          el('span', { class: 'victory-eyebrow' }, [icon('crown'), winner ? t('victory.title') : t('victory.gameOver')]),
          el('h1', { class: 'victory-name', text: winner ? winner.name : t('victory.tableWiped') }),
          el('p', { class: 'victory-deck', text: winner ? deckNameOf(winner.commanders) : '' }),
          el('div', { class: 'victory-stats' }, [
            stat(t('victory.turns'), String(table.state.turn)),
            stat(t('victory.duration'), formatDuration(elapsedOf(table.match, table.state))),
            stat(t('victory.totalDamage'), String(totalDamage(table.match))),
          ]),
          el('div', { class: 'victory-actions' }, [
            el('button', { class: 'btn ghost', onClick: () => overlay.remove() }, [t('victory.backToTable')]),
            el('button', { class: 'btn primary', onClick: () => { overlay.remove(); table.ctx.onFinish(); } }, [t('victory.saveMatch')]),
          ]),
        ]),
      ]),
    ]);
    table.root.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    buzz(24);
  }

  return { pickWinner, winReasonStep, showVictory };
}
