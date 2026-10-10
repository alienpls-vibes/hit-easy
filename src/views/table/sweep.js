/**
 * Area actions: damage to every player, damage to opponents only, and drain.
 *
 * It becomes ONE `sweep` event, not one per target. That way undo brings back
 * the whole drain in one tap, and the timeline tells the play the way it
 * happened - a single thing - instead of three loose lines.
 */

import { el, clear, icon, buzz, toast, dismissOnBackdrop } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { t, tn } from '../../i18n.js';
import { bindHold } from './widgets.js';

export function createSweep(table) {
  /**
   * An area action, from one player.
   *
   * Three modes, because cards speak in three ways: "each player" (an
   * Earthquake hits the caster too), "each opponent", and the drain - which
   * takes from the opponents and heals the caster. The default is opponents
   * only, which is what "damage to everyone" did before the option to include
   * yourself existed.
   *
   * The drain offers the two readings cards use: gaining the TOTAL taken (the
   * Gray Merchant case) or gaining as much as each one lost.
   *
   * It starts at 0, for the same reason as the direct damage pad (see
   * damage.js).
   */
  function openSweepPad(sourceId) {
    if (table.state.finished || table.state.paused) return;
    const source = table.match.seats.find((s) => s.id === sourceId);
    const opponents = table.state.order.filter((id) => id !== sourceId && !table.state.players[id].dead);
    if (!opponents.length) { toast(t('damage.noOpponents')); return; }

    const accent = accentOf(source.commanders[0] ? source.commanders[0].colors : []);
    let amount = 0;
    let mode = 'opponents';
    let gainMode = 'total';

    // Who takes the damage depends on the mode. In table order, with the
    // caster in their own place.
    const targetsOfMode = () => (mode === 'all'
      ? table.state.order.filter((id) => id === sourceId || opponents.includes(id))
      : opponents);

    /** "3 opponents" or "4 players": the header says who gets hit. */
    const whoGetsHit = () => {
      const n = targetsOfMode().length;
      return mode === 'all'
        ? tn(n, 'damage.player', 'damage.players')
        : tn(n, 'damage.opponent', 'damage.opponents');
    };

    const gainOf = () => {
      if (mode !== 'drain') return 0;
      return gainMode === 'total' ? amount * opponents.length : amount;
    };

    const big = el('span', { class: 'pad-amount', text: '0' });
    const modeRow = el('div', { class: 'pad-modes' });
    const gainRow = el('div', { class: 'pad-gain' });
    const destination = el('span', { class: 'pad-to', text: whoGetsHit() });

    const setAmount = (n) => {
      amount = Math.max(0, Math.min(999, n));
      big.textContent = String(amount);
      paintGain();
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
      const gain = gainOf();
      table.apply({
        type: 'sweep', sourceId, amount, gain, targets: targetsOfMode(),
      });
      toast(
        t('damage.sweepToast', {
          name: source.name,
          n: amount,
          count: whoGetsHit(),
        }) + (gain ? ' · +' + gain : ''),
        { label: t('common.undo'), onClick: table.doUndo },
      );
    };

    const paintModes = () => {
      clear(modeRow);
      [
        ['all', t('damage.sweepAll')],
        ['opponents', t('damage.sweepOpponents')],
        ['drain', t('damage.drain')],
      ].forEach(([id, text]) => {
        modeRow.append(el('button', {
          class: 'pad-mode' + (mode === id ? ' is-on' : ''),
          onClick: () => {
            mode = id;
            destination.textContent = whoGetsHit();
            paintModes();
            paintGain();
            buzz();
          },
        }, [text]));
      });
    };

    const paintGain = () => {
      clear(gainRow);
      if (mode !== 'drain') return;
      gainRow.append(el('span', { class: 'pad-gain-label', text: t('damage.youGain') }));
      [['total', amount * opponents.length], ['unit', amount]].forEach(([id, value]) => {
        gainRow.append(el('button', {
          class: 'pad-gain-opt' + (gainMode === id ? ' is-on' : ''),
          onClick: () => { gainMode = id; paintGain(); buzz(); },
        }, [
          el('span', { class: 'pad-gain-value', text: '+' + value }),
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
      style: { '--accent': accent, '--rot': table.padRotation(sourceId) },
    }, [
      el('div', { class: 'pad-head' }, [
        el('span', { class: 'pad-from', text: source.name }),
        icon('arrow'),
        destination,
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
    table.root.append(scrim);
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    buzz(14);
  }

  return { openSweepPad };
}
