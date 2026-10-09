/**
 * Choices in secret votes - how many times Silence was chosen, how many times
 * Snitch.
 *
 * It only shows for whoever took part in one: a block saying "0 votes" would
 * be noise on every card in the list, and most decks never touched one of
 * these cards. The choices are grouped by QUESTION, so "Silence" from
 * Prisoner's Dilemma does not mix with "Sim" from some other vote.
 */

import { el } from '../../ui.js';
import { categoryLabel } from '../../stats.js';
import { t } from '../../i18n.js';

export function voteBlock(row) {
  const categories = Object.entries(row.voteChoices || {});
  if (!row.votes || !categories.length) return null;

  // Left: what KIND of vote it was. Right: what the person chose, and how many
  // times. The left used to carry the written question, which changes from
  // one night to the next and says nothing about anyone's behavior.
  return el('div', { class: 'vote-history' }, [
    el('span', { class: 'vote-history-title' }, [
      t('stats.voteChoices'),
      el('span', { class: 'vote-history-count', text: String(row.votes) }),
    ]),
    ...categories
      .map(([key, choices]) => {
        const items = Object.entries(choices).sort((a, b) => b[1] - a[1]);
        const total = items.reduce((sum, [, n]) => sum + n, 0);
        return { key, items, total };
      })
      // Most used category first: it is the one that best describes the person.
      .sort((a, b) => b.total - a.total)
      .map(({ key, items, total }) => el('div', { class: 'vote-history-row' }, [
        el('span', { class: 'vote-history-q', text: categoryLabel(key) }),
        el('span', { class: 'vote-history-a' }, [
          el('span', {
            class: 'vote-history-picks',
            text: items.map(([label, n]) => (n > 1 ? label + ' ×' + n : label)).join(' · '),
          }),
          el('span', { class: 'vote-history-total', text: String(total) }),
        ]),
      ])),
  ]);
}
