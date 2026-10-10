/**
 * A player's panel: fine life adjustment, commander counters, poison and
 * conceding.
 *
 * It is where you fix what the gesture at the table does not reach.
 */

import { el, clear, openSheet, confirmAction } from '../../ui.js';
import { accentOf } from '../../colors.js';
import {
  replay, cmdKeyOf, deckNameOf, CMD_LETHAL, POISON_LETHAL,
} from '../../engine.js';
import { t } from '../../i18n.js';
import { stepperRow } from './widgets.js';

export function createPlayerSheet(table) {
  function openPlayerSheet(seat) {
    table.commitAll();

    openSheet({
      title: seat.name,
      subtitle: deckNameOf(seat.commanders),
      build: (body, close) => {
        const rebuild = () => {
          table.state = replay(table.match);
          clear(body);
          paint();
        };

        const paint = () => {
          const me = table.state.players[seat.id];

          // Adjustment with no source: fixing a mistake or life paid by the
          // player themselves. Damage with a dealer comes in through the drag.
          //
          // Holding -1 or +1 repeats, speeding up - the same grammar as the
          // panel edge and the mana marker.
          const life = stepperRow({
            label: t('table.life'),
            // A function: with the finger holding, the number changes without
            // the panel being rebuilt - and rebuilding would destroy the
            // button being held.
            value: () => {
              const pending = table.pending.get(seat.id);
              return table.state.players[seat.id].life + (pending ? pending.delta : 0);
            },
            steps: [-5, -1, +1, +5],
            holdRepeats: true,
            onStep: (n) => {
              // nudge, not apply: the whole hold goes in as ONE event, just
              // like the edge. With apply there would be forty events, and
              // undo would take forty taps to bring one gesture back.
              table.nudge(seat.id, n);
              life.refresh();
            },
          });
          body.append(life);

          // Commander damage: one row per opposing commander.
          const foes = [];
          for (const other of table.match.seats) {
            if (other.id === seat.id) continue;
            for (const c of other.commanders) foes.push({ other, c, key: cmdKeyOf(other.id, c) });
          }
          if (foes.length) {
            body.append(el('p', { class: 'sheet-legend', text: t('table.cmdDamageTaken') }));
            foes.forEach(({ other, c, key }) => {
              const val = me.cmd[key] || 0;
              body.append(stepperRow({
                label: c.name,
                sub: other.name,
                value: val + ' / ' + CMD_LETHAL,
                accent: accentOf(c.colors),
                hot: val >= CMD_LETHAL - 4,
                steps: [-1, +1],
                onStep: (n) => {
                  if (val + n < 0) return;
                  table.apply({ type: 'cmd', targetId: seat.id, sourceId: other.id, cmdKey: key, delta: n });
                  rebuild();
                },
              }));
            });
          }

          body.append(stepperRow({
            label: t('table.poison'),
            value: me.poison + ' / ' + POISON_LETHAL,
            hot: me.poison >= POISON_LETHAL - 2,
            steps: [-1, +1],
            onStep: (n) => {
              if (me.poison + n < 0) return;
              table.apply({ type: 'poison', targetId: seat.id, delta: n, sourceId: null });
              rebuild();
            },
          }));

          // A discoverable path to the area action - and the place where the
          // double-tap shortcut is written down, since no gesture announces
          // itself.
          body.append(el('button', {
            class: 'menu-item area-shortcut',
            onClick: () => { close(); table.openSweepPad(seat.id); },
          }, [
            el('span', { class: 'menu-label', text: t('table.areaShortcut') }),
            el('span', { class: 'menu-sub', text: t('table.areaShortcutSub') }),
          ]));

          body.append(el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn ghost',
              onClick: async () => {
                close();
                const ok = await confirmAction({
                  title: t('table.concedeTitle'),
                  message: t('table.concedeMsg', { name: seat.name }),
                  confirmLabel: t('table.concede'),
                });
                if (ok) table.apply({ type: 'concede', targetId: seat.id });
              },
            }, [t('table.concede')]),
            el('button', { class: 'btn primary', onClick: close }, [t('common.done')]),
          ]));
        };

        paint();
      },
    });
  }

  return { openPlayerSheet };
}
