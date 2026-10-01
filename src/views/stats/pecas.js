/**
 * As pecas pequenas que varias abas reusam: numero com rotulo, estado vazio,
 * barra de vitoria, grade de numeros e o botao de ocultar.
 *
 * Estao juntas porque nenhuma pertence a uma aba so - e separa-las em seis
 * arquivos de dez linhas tornaria mais dificil achar a que se procura.
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
  // Dano causado e recebido já incluem o de comandante; "vida paga" é o custo
  // que o jogador bancou sozinho, e por isso não conta como dano de ninguém.
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
 * Ocultar da lista, com confirmacao que deixa claro o que NAO acontece.
 * "Excluir" assusta; a pessoa precisa saber que as partidas ficam inteiras.
 */
export function hideButton(tipo, row, recarregar) {
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
      if (tipo === 'deck') store.hideDeck(row.key);
      // A IDENTIDADE, e nao o rotulo: com o rotulo, ocultar se desfazia
      // quando a pessoa ganhava conta e o rotulo virava o @.
      else store.hidePlayer(row.key);
      if (recarregar) recarregar();
    },
  }, [icon('close')]);
}
