/**
 * A player's card.
 *
 * Colored by the person, not by the deck identity: the initial becomes their
 * mark, the same on every tab that talks about people.
 */

import { el } from '../../ui.js';
import { pct } from '../../stats.js';
import { t } from '../../i18n.js';
import { hideButton, statGrid, winBar } from './widgets.js';
import { winReasonBlock } from './win-reasons.js';
import { voteBlock } from './votes.js';
import { openLinkPerson, canTag } from './link-account.js';

export function playerCard(row, reload, colorOf) {
  // The identity starts with '@' when there is a linked account (see identityOf).
  const hasAccount = String(row.key || '').startsWith('@');

  return el('article', { class: 'card', style: { '--accent': colorOf(row.key) } }, [
    el('header', { class: 'card-head' }, [
      el('div', {
        class: 'card-avatar is-tinted',
        text: (row.label || '?').slice(0, 1).toUpperCase(),
      }),
      el('div', { class: 'card-titles' }, [
        el('h3', { class: 'card-name', text: row.label }),
        el('span', { class: 'card-sub', text: row.games + ' ' + t(row.games === 1 ? 'stats.match' : 'stats.matchesLower') }),
        // No account: offers to link this person to one.
        //
        // It is the fix for the two-device scenario, done where the problem
        // SHOWS - you see two rows that are the same person, because each
        // device typed a name, and you solve it on the row. Tagging here
        // rewrites all their matches, and the other device learns it on sync.
        hasAccount || !canTag() ? null : el('button', {
          class: 'card-link',
          onClick: () => openLinkPerson(row.names && row.names[0]
            ? row.names[0] : row.label, reload),
        }, [t('stats.linkAccount')]),
      ]),
      el('div', { class: 'card-winrate' }, [
        el('span', { class: 'winrate-value', text: pct(row.winrate) }),
        el('span', { class: 'winrate-label', text: row.wins + 'V' }),
      ]),
      hideButton('player', row, reload),
    ]),
    winBar(row.winrate),
    statGrid(row),
    winReasonBlock(row),
    voteBlock(row),
  ]);
}
