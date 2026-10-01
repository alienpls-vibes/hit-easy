/**
 * O cartao de um jogador.
 *
 * Cor pela pessoa, e nao pela identidade do deck: a inicial vira a marca dela,
 * a mesma em toda aba que fala de gente.
 */

import { el } from '../../ui.js';
import { pct } from '../../stats.js';
import { t } from '../../i18n.js';
import { hideButton, statGrid, winBar } from './pecas.js';
import { winReasonBlock } from './vitoria.js';
import { voteBlock } from './votacoes.js';
import { openAssociarPessoa, podeMarcar } from './marcar-conta.js';

export function playerCard(row, recarregar, corDe) {
  // A identidade comeca com '@' quando ha conta vinculada (ver identityOf).
  const temConta = String(row.key || '').startsWith('@');

  return el('article', { class: 'card', style: { '--accent': corDe(row.key) } }, [
    el('header', { class: 'card-head' }, [
      el('div', {
        class: 'card-avatar is-tinted',
        text: (row.label || '?').slice(0, 1).toUpperCase(),
      }),
      el('div', { class: 'card-titles' }, [
        el('h3', { class: 'card-name', text: row.label }),
        el('span', { class: 'card-sub', text: row.games + ' ' + t(row.games === 1 ? 'stats.match' : 'stats.matchesLower') }),
        // Sem conta: oferece ligar esta pessoa a uma.
        //
        // E o conserto do cenario de dois aparelhos, feito onde o problema
        // APARECE - voce ve duas linhas que sao a mesma gente, porque cada
        // aparelho digitou um nome, e resolve na linha. Marcar aqui reescreve
        // todas as partidas dela, e o outro aparelho aprende ao sincronizar.
        temConta || !podeMarcar() ? null : el('button', {
          class: 'card-link',
          onClick: () => openAssociarPessoa(row.nomes && row.nomes[0]
            ? row.nomes[0] : row.label, recarregar),
        }, [t('stats.linkAccount')]),
      ]),
      el('div', { class: 'card-winrate' }, [
        el('span', { class: 'winrate-value', text: pct(row.winrate) }),
        el('span', { class: 'winrate-label', text: row.wins + 'V' }),
      ]),
      hideButton('player', row, recarregar),
    ]),
    winBar(row.winrate),
    statGrid(row),
    winReasonBlock(row),
    voteBlock(row),
  ]);
}
