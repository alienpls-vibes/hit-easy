/**
 * A vitoria: quem ganhou, como ganhou, e o cartaz.
 *
 * Vitoria por ultimo vivo NAO pergunta o motivo e nao inventa causa nenhuma. O
 * motivo e opcional tambem quando se declara na mao: a mesa nem sempre concorda
 * no rotulo, e uma tela que nao deixa sair seria pior que um dado faltando.
 */

import { el, icon, openFlow, closeSheet, buzz } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { elapsedOf, deckNameOf } from '../../engine.js';
import { formatDuration, totalDamage } from '../../stats.js';
import { t } from '../../i18n.js';
import { stat } from './pecas.js';

export function criarVitoria(mesa) {
  /**
   * Vitoria declarada na mao: quem venceu e, depois, COMO.
   *
   * O motivo e opcional de proposito - a mesa nem sempre concorda no rotulo, e
   * uma tela que nao deixa sair seria pior que um dado faltando. Vitoria por
   * ultimo vivo nao passa por aqui e nao inventa causa nenhuma.
   */
  function pickWinner() {
    openFlow({
      title: t('table.whoWon'),
      build: (pane, api) => {
        pane.append(el('div', { class: 'menu' }, mesa.match.seats.map((seat) =>
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
    const MOTIVOS = [
      ['combate', 'win.combat'], ['comandante', 'win.commander'],
      ['combo', 'win.combo'], ['veneno', 'win.poison'],
      ['mill', 'win.mill'], ['alternativa', 'win.alt'],
      ['concessao', 'win.concede'], ['outro', 'win.other'],
    ];

    return {
      title: t('win.reasonTitle', { name: seat.name }),
      subtitle: t('win.reasonSub'),
      build: (pane, api) => {
        const fechar = (motivo) => {
          api.close();
          mesa.apply({ type: 'win', targetId: seat.id, reason: motivo });
        };

        pane.append(el('div', { class: 'win-reasons' }, MOTIVOS.map(([id, chave]) =>
          el('button', { class: 'win-reason', onClick: () => fechar(id) }, [t(chave)]),
        )));

        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn ghost block',
            onClick: () => fechar(null),
          }, [t('win.skip')]),
        ]));
      },
    };
  }

  function showVictory() {
    const winner = mesa.match.seats.find((s) => s.id === mesa.state.winnerId);
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
            stat(t('victory.turns'), String(mesa.state.turn)),
            stat(t('victory.duration'), formatDuration(elapsedOf(mesa.match, mesa.state))),
            stat(t('victory.totalDamage'), String(totalDamage(mesa.match))),
          ]),
          el('div', { class: 'victory-actions' }, [
            el('button', { class: 'btn ghost', onClick: () => overlay.remove() }, [t('victory.backToTable')]),
            el('button', { class: 'btn primary', onClick: () => { overlay.remove(); mesa.ctx.onFinish(); } }, [t('victory.saveMatch')]),
          ]),
        ]),
      ]),
    ]);
    mesa.root.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    buzz(24);
  }

  return {
    destroy: () => {
      mesa.destroyed = true;
      mesa.stopPauseClock();
      mesa.commitAll(); // nada de perder o ultimo toque na troca de tela
      closeSheet();
    },
  };

  return { pickWinner, winReasonStep, showVictory };
}
