/**
 * The small pieces several tabs reuse: a number with a label, the empty state,
 * the win bar, the grid of numbers and the hide button.
 *
 * They live together because none belongs to a single tab - and splitting them
 * into six ten-line files would make the one you look for harder to find.
 */

import { el, icon, confirmAction } from '../../ui.js';
import { formatDuration, num } from '../../stats.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';

export function miniStat(value, label) {
  return el('div', { class: 'mini-stat' }, [
    el('span', { class: 'mini-value', text: value }),
    el('span', { class: 'mini-label', text: label }),
  ]);
}

export function emptyState() {
  return el('div', { class: 'empty' }, [
    el('p', { class: 'empty-title', text: t('stats.empty') }),
    el('p', { class: 'empty-sub', text: t('stats.emptySub') }),
  ]);
}

export function winBar(rate) {
  return el('div', { class: 'winbar' }, [
    el('div', { class: 'winbar-fill', style: { width: Math.round(rate * 100) + '%' } }),
  ]);
}

export function statGrid(row) {
  // Damage dealt and taken already include commander damage; "life paid" is
  // the cost the player covered alone, and that is why it counts as nobody's
  // damage.
  const cells = [
    [t('stats.damageDealt'), num(row.avgDamageDealt, 0), t('stats.perMatch')],
    [t('stats.damageTaken'), num(row.avgDamageTaken, 0), t('stats.perMatch')],
    [t('stats.lifePaid'), num(row.avgLifePaid, 0), t('stats.perMatch')],
    [t('stats.healed'), num(row.avgHealed, 0), t('stats.perMatch')],
    [t('stats.kills'), num(row.avgKills, 1), t('stats.perMatch')],
    [t('stats.turns'), num(row.avgTurns, 1), t('stats.played')],
    [t('stats.place'), num(row.avgPlace, 1), t('stats.average')],
    [t('stats.turnTime'), formatDuration(row.avgTurnTime), t('stats.average')],
  ];
  return el('div', { class: 'stat-grid' }, cells.map(([label, value, sub]) =>
    el('div', { class: 'stat-cell' }, [
      el('span', { class: 'cell-value', text: value }),
      el('span', { class: 'cell-label', text: label }),
      el('span', { class: 'cell-sub', text: sub }),
    ]),
  ));
}

/**
 * Hide from the list, with a confirmation that makes clear what does NOT
 * happen. "Delete" scares people; they need to know the matches stay whole.
 */
export function hideButton(kind, row, reload) {
  return el('button', {
    class: 'card-hide',
    'aria-label': t('stats.hide'),
    onClick: async () => {
      const ok = await confirmAction({
        title: t('stats.hideTitle', { name: row.label }),
        message: t('stats.hideMsg'),
        confirmLabel: t('stats.hide'),
        danger: false,
      });
      if (!ok) return;
      if (kind === 'deck') store.hideDeck(row.key);
      // The IDENTITY, not the label: with the label, hiding undid itself when
      // the person got an account and the label became the @.
      else store.hidePlayer(row.key);
      if (reload) reload();
    },
  }, [icon('close')]);
}
