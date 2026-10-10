/**
 * The mana marker.
 *
 * Floating mana for the turn. It resets when the turn passes - it is floating
 * mana, not a permanent resource.
 *
 * It does NOT go into the event log, and that is a decision, not an oversight:
 * mana is ephemeral, vanishes when the turn passes and says nothing about the
 * match afterwards. Each tap would become a line in the history and dirty the
 * statistics forever.
 *
 * It is stored with the match (outside the events, in `match.mana`), so it
 * survives reloading the browser in the middle of the turn - but `replay`
 * ignores it completely, and the scoreboard keeps coming only from the log.
 */

import { el, icon, openSheet, buzz } from '../../ui.js';
import { colorHex } from '../../colors.js';
import { t } from '../../i18n.js';
import { MANA, MANA_ZERO } from './constants.js';
import { bindHold } from './widgets.js';

export function createMana(table) {
  function manaPool() {
    if (!table.match.mana) table.match.mana = { ...MANA_ZERO };
    return table.match.mana;
  }

  function clearMana() {
    table.match.mana = { ...MANA_ZERO };
  }

  function manaTotal() {
    return Object.values(manaPool()).reduce((a, b) => a + b, 0);
  }

  /** The shortcut appears and disappears with the mana; the number is its label. */
  function syncManaBtn() {
    const total = manaTotal();
    table.hub.manaCount.textContent = String(total);
    table.hub.manaBtn.hidden = total === 0;
  }

  function saveManaSoon() {
    clearTimeout(table.manaSaveTimer);
    table.manaSaveTimer = setTimeout(() => table.ctx.onChange(), 400);
  }

  function openMana() {
    const pool = manaPool();
    const active = table.match.seats
      .find((s) => s.id === table.state.activeSeatId);
    const refs = {};
    const total = el('span', { class: 'mana-total-value' });

    const paint = () => {
      MANA.forEach((k) => {
        refs[k].num.textContent = String(pool[k]);
        refs[k].tile.classList.toggle('is-on', pool[k] > 0);
      });
      total.textContent = String(manaTotal());
      syncManaBtn();
    };

    const change = (k, d) => {
      pool[k] = Math.max(0, Math.min(99, pool[k] + d));
      paint();
      buzz(6);
      saveManaSoon();
    };

    openSheet({
      title: t('mana.title'),
      subtitle: (active ? active.name + ' · ' : '') + t('mana.sub'),
      build: (pane, close) => {
        // Its own name: the TABLE grid is also called grid in the outer scope,
        // and the two in the same file confused the reading.
        const manaGrid = el('div', { class: 'mana-grid' });

        MANA.forEach((k) => {
          const num = el('span', { class: 'mana-count' });

          // Same grammar as the life panel: left half takes off, right half
          // adds, holding repeats. Nothing new to learn.
          const less = el('div', { class: 'mana-tap mana-minus', 'aria-hidden': 'true' }, [
            el('span', { class: 'tap-glyph' }, [icon('minus')]),
          ]);
          const more = el('div', { class: 'mana-tap mana-plus', 'aria-hidden': 'true' }, [
            el('span', { class: 'tap-glyph' }, [icon('plus')]),
          ]);
          bindHold(less, () => change(k, -1));
          bindHold(more, () => change(k, +1));

          const tile = el('div', {
            class: 'mana-tile',
            style: { '--accent': colorHex(k) },
          }, [
            less,
            more,
            el('div', { class: 'mana-face' }, [
              el('span', { class: 'mana-pip', text: k }),
              el('span', { class: 'mana-name', text: t('mana.' + k) }),
              num,
            ]),
          ]);
          refs[k] = { num, tile };
          manaGrid.append(tile);
        });

        pane.append(
          manaGrid,
          el('div', { class: 'mana-total' }, [
            el('span', { class: 'mana-total-label', text: t('mana.available') }),
            total,
          ]),
          el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn ghost',
              onClick: () => { clearMana(); paint(); table.ctx.onChange(); buzz(12); },
            }, [t('mana.clear')]),
            el('button', { class: 'btn primary', onClick: close }, [t('common.done')]),
          ]),
        );

        paint();
      },
      onClose: () => { clearTimeout(table.manaSaveTimer); table.ctx.onChange(); },
    });
  }

  return {
    manaPool, clearMana, manaTotal, syncManaBtn, saveManaSoon, openMana,
  };
}
