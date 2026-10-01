/**
 * Acoes em area: dano em todos, e dreno.
 *
 * Vira UM evento `sweep`, nao um por alvo. Assim desfazer volta o dreno inteiro
 * num toque, e a linha do tempo conta a jogada como ela aconteceu - uma coisa
 * so - em vez de tres linhas soltas.
 */

import { el, clear, icon, buzz, toast, dismissOnBackdrop } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { t, tn } from '../../i18n.js';
import { bindHold } from './pecas.js';

export function criarArea(mesa) {
  /**
   * Acao em area, a partir de um jogador: dano em todos ou dreno.
   *
   * Vira UM evento `sweep`, nao um por alvo. Assim desfazer volta o dreno
   * inteiro num toque, e a linha do tempo conta a jogada como ela aconteceu -
   * uma unica coisa - em vez de tres linhas soltas.
   *
   * O dreno oferece as duas leituras que as cartas usam: ganhar o TOTAL tirado
   * (o caso Gray Merchant) ou ganhar o mesmo tanto que cada um perdeu.
   */
  function openSweepPad(sourceId) {
    if (mesa.state.finished || mesa.state.paused) return;
    const source = mesa.match.seats.find((s) => s.id === sourceId);
    const alvos = mesa.state.order.filter((id) => id !== sourceId && !mesa.state.players[id].dead);
    if (!alvos.length) { toast(t('damage.noOpponents')); return; }

    const accent = accentOf(source.commanders[0] ? source.commanders[0].colors : []);
    let amount = 1;
    let mode = 'dano';
    let ganho = 'total';

    const gainOf = () => {
      if (mode !== 'dreno') return 0;
      return ganho === 'total' ? amount * alvos.length : amount;
    };

    const big = el('span', { class: 'pad-amount', text: '1' });
    const modeRow = el('div', { class: 'pad-modes' });
    const gainRow = el('div', { class: 'pad-gain' });

    const setAmount = (n) => {
      amount = Math.max(1, Math.min(999, n));
      big.textContent = String(amount);
      paintGain();
    };

    const send = () => {
      close();
      const gain = gainOf();
      mesa.apply({ type: 'sweep', sourceId, amount, gain, targets: alvos });
      toast(
        t('damage.sweepToast', {
          name: source.name,
          n: amount,
          count: tn(alvos.length, 'damage.opponent', 'damage.opponents'),
        }) + (gain ? ' · +' + gain : ''),
        { label: t('common.undo'), onClick: mesa.doUndo },
      );
    };

    const paintModes = () => {
      clear(modeRow);
      [['dano', t('damage.damageAll')], ['dreno', t('damage.drain')]].forEach(([id, text]) => {
        modeRow.append(el('button', {
          class: 'pad-mode' + (mode === id ? ' is-on' : ''),
          onClick: () => { mode = id; paintModes(); paintGain(); buzz(); },
        }, [text]));
      });
    };

    const paintGain = () => {
      clear(gainRow);
      if (mode !== 'dreno') return;
      gainRow.append(el('span', { class: 'pad-gain-label', text: t('damage.youGain') }));
      [['total', amount * alvos.length], ['unit', amount]].forEach(([id, valor]) => {
        gainRow.append(el('button', {
          class: 'pad-gain-opt' + (ganho === id ? ' is-on' : ''),
          onClick: () => { ganho = id; paintGain(); buzz(); },
        }, [
          el('span', { class: 'pad-gain-value', text: '+' + valor }),
          el('span', { class: 'pad-gain-sub', text: id === 'total' ? t('damage.gainTotal') : t('damage.gainEach') }),
        ]));
      });
    };

    const minus = el('button', { class: 'pad-step', 'aria-label': t('table.less') }, [icon('minus')]);
    const plus = el('button', { class: 'pad-step', 'aria-label': t('table.more') }, [icon('plus')]);
    bindHold(minus, () => setAmount(amount - 1));
    bindHold(plus, () => setAmount(amount + 1));

    const pad = el('div', {
      class: 'pad',
      style: { '--accent': accent, '--rot': mesa.rotDoPad(sourceId) },
    }, [
      el('div', { class: 'pad-head' }, [
        el('span', { class: 'pad-from', text: source.name }),
        icon('arrow'),
        el('span', {
          class: 'pad-to',
          text: tn(alvos.length, 'damage.opponent', 'damage.opponents'),
        }),
      ]),
      modeRow,
      gainRow,
      el('div', { class: 'pad-dial' }, [minus, big, plus]),
      el('div', { class: 'pad-quick' }, [1, 2, 3, 5, 7].map((n) =>
        el('button', { class: 'pad-chip', onClick: () => { setAmount(n); send(); } }, [String(n)]),
      )),
      el('div', { class: 'pad-actions' }, [
        el('button', { class: 'btn ghost', onClick: () => close() }, ['Cancelar']),
        el('button', { class: 'btn primary', onClick: send }, ['Confirmar']),
      ]),
    ]);

    const scrim = el('div', { class: 'pad-scrim' }, [pad]);
    dismissOnBackdrop(scrim, () => close());

    function close() {
      scrim.classList.remove('is-open');
      setTimeout(() => scrim.remove(), 200);
    }

    paintModes();
    paintGain();
    mesa.root.append(scrim);
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    buzz(14);
  }

  return { openSweepPad };
}
