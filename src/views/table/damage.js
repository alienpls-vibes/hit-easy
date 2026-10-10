/**
 * Directional damage: the arrow linking attacker and target, and the pad for
 * how much it was.
 *
 * The direction of the gesture IS the declaration of authorship - nothing is
 * inferred. The pad rotates with the seat of whoever attacked, because they
 * are the one operating it.
 */

import { el, clear, icon, buzz, toast, dismissOnBackdrop } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { cmdKeyOf } from '../../engine.js';
import { t } from '../../i18n.js';
import { bindHold } from './widgets.js';

export function createDamage(table) {
  function drawArrow(x, y) {
    const box = table.wrap.getBoundingClientRect();
    const origin = table.tiles.get(table.gesture.seatId).root;
    const from = origin.getBoundingClientRect();
    const sx = from.left + from.width / 2 - box.left;
    const sy = from.top + from.height / 2 - box.top;
    const tx = x - box.left;
    const ty = y - box.top;

    // A light arc: a straight line feels stiff and ambiguous, the curve shows
    // the direction.
    const cx = (sx + tx) / 2 - (ty - sy) * 0.12;
    const cy = (sy + ty) / 2 + (tx - sx) * 0.12;
    table.fxPath.setAttribute('d', 'M ' + sx + ' ' + sy + ' Q ' + cx + ' ' + cy + ' ' + tx + ' ' + ty);
    table.fxDot.setAttribute('cx', sx);
    table.fxDot.setAttribute('cy', sy);

    // Arrowhead aligned with the curve's final tangent, not with the
    // source-target line.
    const ang = Math.atan2(ty - cy, tx - cx);
    const h = 14;
    const w = 0.44;
    table.fxHead.setAttribute(
      'd',
      'M ' + tx + ' ' + ty + ' L ' + (tx - h * Math.cos(ang - w)) + ' ' + (ty - h * Math.sin(ang - w)) +
      ' M ' + tx + ' ' + ty + ' L ' + (tx - h * Math.cos(ang + w)) + ' ' + (ty - h * Math.sin(ang + w)),
    );
    table.fx.classList.add('is-on');
  }

  function clearArrow() {
    table.fx.classList.remove('is-on');
    table.wrap.classList.remove('is-dragging');
    table.tiles.forEach((tile) => {
      tile.root.classList.remove('is-source', 'is-target');
    });
  }

  /**
   * The damage pad. The drag already told the direction; only the amount is
   * missing here. The shortcuts (1, 2, 3, 5, 7) confirm on the same tap, so the
   * common case closes in two gestures. The pad rotates with the seat of
   * whoever attacked, because they are the one operating it.
   *
   * It starts at 0, not 1: whoever uses the dial counts from zero anyway, and
   * starting at 1 turned every damage of 3 into two taps on plus instead of
   * three - and every mistake into one too many. Confirming at 0 just closes.
   *
   * Lifelink is a mark on the SAME event, not a separate event: undo brings
   * back the damage and the healing together, which is how the card works -
   * a single thing.
   */
  function openDamagePad(sourceId, targetId) {
    const source = table.match.seats.find((s) => s.id === sourceId);
    const target = table.match.seats.find((s) => s.id === targetId);
    const accent = accentOf(source.commanders[0] ? source.commanders[0].colors : []);

    let amount = 0;
    let mode = 'damage';
    let slot = 0;
    let lifelink = false;

    const big = el('span', { class: 'pad-amount', text: '0' });
    const modeRow = el('div', { class: 'pad-modes' });
    const partnerRow = el('div', { class: 'pad-partners' });
    const lifelinkBtn = el('button', { class: 'pad-tag' });

    const paintLifelink = () => {
      lifelinkBtn.classList.toggle('is-on', lifelink);
      lifelinkBtn.setAttribute('aria-pressed', lifelink ? 'true' : 'false');
      clear(lifelinkBtn);
      lifelinkBtn.append(el('span', { class: 'pad-tag-mark' }));
      lifelinkBtn.append(el('span', { class: 'pad-tag-text', text: t('damage.lifelink') }));
      if (lifelink && amount > 0) {
        lifelinkBtn.append(el('span', {
          class: 'pad-tag-gain', text: t('damage.lifelinkGain', { n: amount, name: source.name }),
        }));
      }
    };
    lifelinkBtn.addEventListener('click', () => { lifelink = !lifelink; paintLifelink(); buzz(); });

    const setAmount = (n) => {
      amount = Math.max(0, Math.min(999, n));
      big.textContent = String(amount);
      paintLifelink();
    };

    const labels = {
      damage: t('damage.damage'), cmd: t('damage.commander'), poison: t('damage.poison'),
    };

    const send = () => {
      close();
      // Zero is not damage: it does not become an event, nor a line in the
      // history.
      if (!amount) return;
      // The target's life counts instead of jumping: the screen closes and the
      // number moves, which is the only visual feedback that the damage went
      // out.
      table.countOnNextSync = true;
      // It only goes into the event when there is healing, so the log stays
      // the same as always in the common case.
      const extra = lifelink ? { gain: amount } : {};
      if (mode === 'cmd') {
        const c = source.commanders[slot] || source.commanders[0];
        table.apply({
          type: 'cmd', targetId, sourceId, cmdKey: cmdKeyOf(sourceId, c), delta: amount, ...extra,
        });
      } else if (mode === 'poison') {
        table.apply({ type: 'poison', targetId, sourceId, delta: amount, ...extra });
      } else {
        table.apply({ type: 'life', targetId, delta: -amount, sourceId, ...extra });
      }
      toast(
        t('damage.toast', {
          from: source.name, to: target.name, n: amount, kind: labels[mode].toLowerCase(),
        }) + (lifelink ? ' · +' + amount : ''),
        { label: t('common.undo'), onClick: table.doUndo },
      );
    };

    const paintModes = () => {
      clear(modeRow);
      [['damage', t('damage.damage')], ['cmd', t('damage.commander')], ['poison', t('damage.poison')]].forEach(([id, text]) => {
        modeRow.append(el('button', {
          class: 'pad-mode' + (mode === id ? ' is-on' : ''),
          onClick: () => { mode = id; paintModes(); paintPartners(); buzz(); },
        }, [text]));
      });
    };

    // Only shows up when the attacker has a partner: there are two 21 counters.
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
      style: { '--accent': accent, '--rot': table.padRotation(sourceId) },
    }, [
      el('div', { class: 'pad-head' }, [
        el('span', { class: 'pad-from', text: source.name }),
        icon('arrow'),
        el('span', { class: 'pad-to', text: target.name }),
      ]),
      modeRow,
      partnerRow,
      lifelinkBtn,
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
    paintLifelink();
    table.root.append(scrim);
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    buzz(14);
  }

  return { drawArrow, clearArrow, openDamagePad };
}
