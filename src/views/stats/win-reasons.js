/**
 * How the wins were won.
 *
 * It only shows when someone declared a reason - a win by being the last one
 * alive has no recorded cause, and an empty block on every card would be
 * noise.
 */

import { el } from '../../ui.js';
import { t } from '../../i18n.js';

/** Stored reason id (see views/table/victory.js) -> translation key. */
const REASON_LABELS = {
  combate: 'win.combat', comandante: 'win.commander', combo: 'win.combo',
  veneno: 'win.poison', mill: 'win.mill', alternativa: 'win.alt',
  concessao: 'win.concede', outro: 'win.other',
};

export function winReasonBlock(row) {
  const reasons = Object.entries(row.winReasons || {});
  if (!reasons.length) return null;

  return el('div', { class: 'vote-history' }, [
    el('span', { class: 'vote-history-title' }, [
      t('stats.winReasons'),
      el('span', {
        class: 'vote-history-count',
        text: String(reasons.reduce((a, [, n]) => a + n, 0)),
      }),
    ]),
    el('div', { class: 'win-reason-tags' }, reasons
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => el('span', {
        class: 'win-reason-tag',
        text: t(REASON_LABELS[id] || 'win.other') + (n > 1 ? ' ×' + n : ''),
      }))),
  ]);
}
