/**
 * A deck's card.
 *
 * Colored by the commander's identity (WUBRG): what is tracked here is the
 * DECK. Color by person applies on the Players and Rivals tabs, which track
 * who - the same player switches commanders and is still themselves.
 */

import { el } from '../../ui.js';
import { accentOf, identityGradient, pips } from '../../colors.js';
import { pct } from '../../stats.js';
import { deckNameOf } from '../../engine.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';
import { hideButton, statGrid, winBar } from './widgets.js';
import { winReasonBlock } from './win-reasons.js';
import { voteBlock } from './votes.js';

export function deckCard(row, reload) {
  const commander = row.commanders && row.commanders[0];
  const colors = commander ? commander.colors : [];
  const accent = accentOf(colors);

  return el('article', {
    class: 'card',
    style: { '--accent': accent, '--tint': identityGradient(colors, 0.13) },
  }, [
    el('div', { class: 'card-tint' }),
    el('header', { class: 'card-head' }, [
      commander && commander.thumb
        ? el('div', { class: 'card-art', style: { backgroundImage: 'url(' + commander.thumb + ')' } })
        : null,
      el('div', { class: 'card-titles' }, [
        el('h3', { class: 'card-name', text: row.label }),
        el('span', { class: 'card-sub' }, [
          el('span', { class: 'card-pips', text: pips(colors) }),
          row.games + ' ' + t(row.games === 1 ? 'stats.match' : 'stats.matchesLower'),
        ]),
      ]),
      el('div', { class: 'card-winrate' }, [
        el('span', { class: 'winrate-value', text: pct(row.winrate) }),
        el('span', { class: 'winrate-label', text: row.wins + 'V' }),
      ]),
      hideButton('deck', row, reload),
    ]),
    winBar(row.winrate),
    statGrid(row),
    winReasonBlock(row),
    voteBlock(row),
  ]);
}

/** Readable name of a hidden deck, looked up in the history by its key. */
export function deckNameByKey(key) {
  for (const match of store.getDB().history || []) {
    for (const seat of match.seats || []) {
      const k = (seat.commanders || []).map((c) => c.oracleId).sort().join('+');
      if (k === key) return deckNameOf(seat.commanders);
    }
  }
  return key;
}
