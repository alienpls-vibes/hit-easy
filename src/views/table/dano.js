/**
 * Dano direcional: a seta que liga atacante e alvo, e o teclado do quanto foi.
 *
 * A direcao do gesto E a declaracao de autoria - nada e inferido. O teclado
 * gira junto com o assento de quem atacou, porque e ele que esta mexendo.
 */

import { el, clear, icon, buzz, toast, dismissOnBackdrop } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { cmdKeyOf } from '../../engine.js';
import { t } from '../../i18n.js';
import { bindHold } from './pecas.js';

export function criarDano(mesa) {
  function drawArrow(x, y) {
    const box = mesa.wrap.getBoundingClientRect();
    const origem = mesa.tiles.get(mesa.gesture.seatId).root;
    const from = origem.getBoundingClientRect();
    const sx = from.left + from.width / 2 - box.left;
    const sy = from.top + from.height / 2 - box.top;
    const tx = x - box.left;
    const ty = y - box.top;

    // Arco leve: uma reta fica dura e ambigua, a curva mostra o sentido.
    const cx = (sx + tx) / 2 - (ty - sy) * 0.12;
    const cy = (sy + ty) / 2 + (tx - sx) * 0.12;
    mesa.fxPath.setAttribute('d', 'M ' + sx + ' ' + sy + ' Q ' + cx + ' ' + cy + ' ' + tx + ' ' + ty);
    mesa.fxDot.setAttribute('cx', sx);
    mesa.fxDot.setAttribute('cy', sy);

    // Ponta alinhada com a tangente final da curva, nao com a reta origem-destino.
    const ang = Math.atan2(ty - cy, tx - cx);
    const h = 14;
    const w = 0.44;
    mesa.fxHead.setAttribute(
      'd',
      'M ' + tx + ' ' + ty + ' L ' + (tx - h * Math.cos(ang - w)) + ' ' + (ty - h * Math.sin(ang - w)) +
      ' M ' + tx + ' ' + ty + ' L ' + (tx - h * Math.cos(ang + w)) + ' ' + (ty - h * Math.sin(ang + w)),
    );
    mesa.fx.classList.add('is-on');
  }

  function clearArrow() {
    mesa.fx.classList.remove('is-on');
    mesa.wrap.classList.remove('is-dragging');
    mesa.tiles.forEach((t) => {
      t.root.classList.remove('is-source', 'is-target');
    });
  }

  /**
   * Teclado do dano. O arraste ja disse a direcao; aqui so falta o quanto.
   * Os atalhos (1, 2, 3, 5, 7) confirmam no mesmo toque, entao o caso comum
   * fecha em dois gestos. O painel gira junto com o assento de quem atacou,
   * porque quem esta mexendo e ele.
   */
  function openDamagePad(sourceId, targetId) {
    const source = mesa.match.seats.find((s) => s.id === sourceId);
    const target = mesa.match.seats.find((s) => s.id === targetId);
    const accent = accentOf(source.commanders[0] ? source.commanders[0].colors : []);

    let amount = 1;
    let mode = 'dano';
    let slot = 0;

    const big = el('span', { class: 'pad-amount', text: '1' });
    const modeRow = el('div', { class: 'pad-modes' });
    const partnerRow = el('div', { class: 'pad-partners' });

    const setAmount = (n) => {
      amount = Math.max(1, Math.min(999, n));
      big.textContent = String(amount);
    };

    const labels = {
      dano: t('damage.damage'), cmd: t('damage.commander'), veneno: t('damage.poison'),
    };

    const send = () => {
      close();
      if (mode === 'cmd') {
        const c = source.commanders[slot] || source.commanders[0];
        mesa.apply({ type: 'cmd', targetId, sourceId, cmdKey: cmdKeyOf(sourceId, c), delta: amount });
      } else if (mode === 'veneno') {
        mesa.apply({ type: 'poison', targetId, sourceId, delta: amount });
      } else {
        mesa.apply({ type: 'life', targetId, delta: -amount, sourceId });
      }
      toast(
        t('damage.toast', {
          from: source.name, to: target.name, n: amount, kind: labels[mode].toLowerCase(),
        }),
        { label: t('common.undo'), onClick: mesa.doUndo },
      );
    };

    const paintModes = () => {
      clear(modeRow);
      [['dano', t('damage.damage')], ['cmd', t('damage.commander')], ['veneno', t('damage.poison')]].forEach(([id, text]) => {
        modeRow.append(el('button', {
          class: 'pad-mode' + (mode === id ? ' is-on' : ''),
          onClick: () => { mode = id; paintModes(); paintPartners(); buzz(); },
        }, [text]));
      });
    };

    // So aparece quando quem atacou tem parceiro: sao dois contadores de 21.
    const paintPartners = () => {
      clear(partnerRow);
      if (mode !== 'cmd' || source.commanders.length < 2) return;
      source.commanders.forEach((c, i) => {
        partnerRow.append(el('button', {
          class: 'pad-partner' + (slot === i ? ' is-on' : ''),
          onClick: () => { slot = i; paintPartners(); },
        }, [c.name]));
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
        el('span', { class: 'pad-to', text: target.name }),
      ]),
      modeRow,
      partnerRow,
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
    paintPartners();
    mesa.root.append(scrim);
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    buzz(14);
  }

  return { drawArrow, clearArrow, openDamagePad };
}
