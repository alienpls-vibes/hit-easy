/**
 * Acoes em area: dano em todos os jogadores, dano so nos oponentes, e dreno.
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
   * Acao em area, a partir de um jogador.
   *
   * Tres modos, porque as cartas falam de tres jeitos: "cada jogador" (um
   * Terremoto pega quem lancou tambem), "cada oponente", e o dreno - que tira
   * dos oponentes e cura quem lancou. O padrao e so oponentes, que era o que
   * "dano em todos" fazia antes de existir a opcao de incluir a si mesmo.
   *
   * Vira UM evento `sweep`, nao um por alvo. Assim desfazer volta o dreno
   * inteiro num toque, e a linha do tempo conta a jogada como ela aconteceu -
   * uma unica coisa - em vez de tres linhas soltas.
   *
   * O dreno oferece as duas leituras que as cartas usam: ganhar o TOTAL tirado
   * (o caso Gray Merchant) ou ganhar o mesmo tanto que cada um perdeu.
   *
   * Comeca em 0, pelo mesmo motivo do teclado de dano direto (ver dano.js).
   */
  function openSweepPad(sourceId) {
    if (mesa.state.finished || mesa.state.paused) return;
    const source = mesa.match.seats.find((s) => s.id === sourceId);
    const oponentes = mesa.state.order.filter((id) => id !== sourceId && !mesa.state.players[id].dead);
    if (!oponentes.length) { toast(t('damage.noOpponents')); return; }

    const accent = accentOf(source.commanders[0] ? source.commanders[0].colors : []);
    let amount = 0;
    let mode = 'oponentes';
    let ganho = 'total';

    // Quem toma o dano depende do modo. Na ordem da mesa, com quem lancou no
    // proprio lugar dela.
    const alvosDoModo = () => (mode === 'todos'
      ? mesa.state.order.filter((id) => id === sourceId || oponentes.includes(id))
      : oponentes);

    /** "3 oponentes" ou "4 jogadores": o cabecalho diz quem vai apanhar. */
    const quemApanha = () => {
      const n = alvosDoModo().length;
      return mode === 'todos'
        ? tn(n, 'damage.player', 'damage.players')
        : tn(n, 'damage.opponent', 'damage.opponents');
    };

    const gainOf = () => {
      if (mode !== 'dreno') return 0;
      return ganho === 'total' ? amount * oponentes.length : amount;
    };

    const big = el('span', { class: 'pad-amount', text: '0' });
    const modeRow = el('div', { class: 'pad-modes' });
    const gainRow = el('div', { class: 'pad-gain' });
    const destino = el('span', { class: 'pad-to', text: quemApanha() });

    const setAmount = (n) => {
      amount = Math.max(0, Math.min(999, n));
      big.textContent = String(amount);
      paintGain();
    };

    const send = () => {
      close();
      // Zero nao e dano: nao vira evento, nem linha no historico.
      if (!amount) return;
      // A vida do alvo conta em vez de saltar: a tela fecha e o numero anda,
      // que e o unico retorno visual de que o dano saiu.
      mesa.contarNoProximoSync = true;
      const gain = gainOf();
      mesa.apply({
        type: 'sweep', sourceId, amount, gain, targets: alvosDoModo(),
      });
      toast(
        t('damage.sweepToast', {
          name: source.name,
          n: amount,
          count: quemApanha(),
        }) + (gain ? ' · +' + gain : ''),
        { label: t('common.undo'), onClick: mesa.doUndo },
      );
    };

    const paintModes = () => {
      clear(modeRow);
      [
        ['todos', t('damage.sweepAll')],
        ['oponentes', t('damage.sweepOpponents')],
        ['dreno', t('damage.drain')],
      ].forEach(([id, text]) => {
        modeRow.append(el('button', {
          class: 'pad-mode' + (mode === id ? ' is-on' : ''),
          onClick: () => {
            mode = id;
            destino.textContent = quemApanha();
            paintModes();
            paintGain();
            buzz();
          },
        }, [text]));
      });
    };

    const paintGain = () => {
      clear(gainRow);
      if (mode !== 'dreno') return;
      gainRow.append(el('span', { class: 'pad-gain-label', text: t('damage.youGain') }));
      [['total', amount * oponentes.length], ['unit', amount]].forEach(([id, valor]) => {
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
        destino,
      ]),
      modeRow,
      gainRow,
      el('div', { class: 'pad-dial' }, [minus, big, plus]),
      el('div', { class: 'pad-quick' }, [1, 2, 3, 5, 7].map((n) =>
        el('button', { class: 'pad-chip', onClick: () => { setAmount(n); send(); } }, [String(n)]),
      )),
      el('div', { class: 'pad-actions' }, [
        el('button', { class: 'btn ghost', onClick: () => close() }, [t('common.cancel')]),
        el('button', { class: 'btn primary', onClick: send }, [t('common.confirm')]),
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
