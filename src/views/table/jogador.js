/**
 * O painel de um jogador: ajuste fino de vida, contadores de comandante,
 * veneno e desistir.
 *
 * E onde se corrige o que o gesto na mesa nao alcanca.
 */

import { el, clear, openSheet, confirmAction } from '../../ui.js';
import { accentOf } from '../../colors.js';
import {
  replay, cmdKeyOf, deckNameOf, CMD_LETHAL, POISON_LETHAL,
} from '../../engine.js';
import { t } from '../../i18n.js';
import { stepperRow } from './pecas.js';

export function criarPainelDoJogador(mesa) {
  // ---------- paineis ----------

  function openPlayerSheet(seat) {
    mesa.commitAll();
    const p = mesa.state.players[seat.id];

    openSheet({
      title: seat.name,
      subtitle: deckNameOf(seat.commanders),
      build: (body, close) => {
        const rebuild = () => {
          mesa.state = replay(mesa.match);
          clear(body);
          paint();
        };

        const paint = () => {
          const me = mesa.state.players[seat.id];

          // Ajuste sem origem: correcao de erro ou vida paga pelo proprio
          // jogador. Dano com autor entra pelo arraste.
          body.append(stepperRow({
            label: t('table.life'),
            value: me.life,
            steps: [-5, -1, +1, +5],
            onStep: (n) => {
              mesa.apply({ type: 'life', targetId: seat.id, delta: n, sourceId: null });
              rebuild();
            },
          }));

          // Dano de comandante: uma linha por comandante adversario.
          const foes = [];
          for (const other of mesa.match.seats) {
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
                  mesa.apply({ type: 'cmd', targetId: seat.id, sourceId: other.id, cmdKey: key, delta: n });
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
              mesa.apply({ type: 'poison', targetId: seat.id, delta: n, sourceId: null });
              rebuild();
            },
          }));

          // Caminho descoberto para a acao em area - e o lugar onde o atalho
          // do duplo toque fica escrito, ja que gesto nenhum se anuncia.
          body.append(el('button', {
            class: 'menu-item area-shortcut',
            onClick: () => { close(); mesa.openSweepPad(seat.id); },
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
                if (ok) mesa.apply({ type: 'concede', targetId: seat.id });
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
