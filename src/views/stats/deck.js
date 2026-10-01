/**
 * O cartao de um deck.
 *
 * Cor pela identidade do comandante (WUBRG): aqui o que se rastreia e o DECK.
 * A cor por pessoa vale nas abas de Jogadores e Rivalidades, que rastreiam
 * quem - o mesmo jogador troca de comandante e continua sendo ele.
 */

import { el } from '../../ui.js';
import { accentOf, identityGradient, pips } from '../../colors.js';
import { pct } from '../../stats.js';
import { deckNameOf } from '../../engine.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';
import { hideButton, statGrid, winBar } from './pecas.js';
import { winReasonBlock } from './vitoria.js';
import { voteBlock } from './votacoes.js';

export function deckCard(row, recarregar) {
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
      hideButton('deck', row, recarregar),
    ]),
    winBar(row.winrate),
    statGrid(row),
    winReasonBlock(row),
    voteBlock(row),
  ]);
}

/** Nome legivel de um deck oculto, procurado no historico pela chave. */
export function nomeDoDeck(chave) {
  for (const match of store.getDB().history || []) {
    for (const seat of match.seats || []) {
      const k = (seat.commanders || []).map((c) => c.oracleId).sort().join('+');
      if (k === chave) return deckNameOf(seat.commanders);
    }
  }
  return chave;
}
