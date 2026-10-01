/**
 * Escolhas em votacoes secretas - quantas vezes escolheu Silence, quantas
 * escolheu Snitch.
 *
 * So aparece para quem participou de alguma: a maioria dos decks nunca encostou
 * numa carta dessas, e um bloco vazio em todo cartao seria ruido. As escolhas
 * ficam agrupadas por PERGUNTA, entao "Silence" do Prisoner's Dilemma nao se
 * mistura com "Sim" de um voto qualquer.
 */

import { el } from '../../ui.js';
import { rotuloDaCategoria } from '../../stats.js';
import { t } from '../../i18n.js';

/**
 * Escolhas em votacao secreta.
 *
 * So aparece para quem ja passou por uma: um bloco vazio dizendo "0 votacoes"
 * seria ruido em todo cartao da lista, e a maioria dos decks nunca encostou
 * numa carta dessas.
 */
export function voteBlock(row) {
  const categorias = Object.entries(row.voteChoices || {});
  if (!row.votes || !categorias.length) return null;

  // Esquerda: que TIPO de votação era. Direita: o que a pessoa escolheu, e
  // quantas vezes. Antes a esquerda trazia a pergunta escrita, que muda de
  // uma noite para a outra e não diz nada sobre o comportamento de ninguém.
  return el('div', { class: 'vote-history' }, [
    el('span', { class: 'vote-history-title' }, [
      t('stats.voteChoices'),
      el('span', { class: 'vote-history-count', text: String(row.votes) }),
    ]),
    ...categorias
      .map(([chave, escolhas]) => {
        const itens = Object.entries(escolhas).sort((a, b) => b[1] - a[1]);
        const total = itens.reduce((soma, [, n]) => soma + n, 0);
        return { chave, itens, total };
      })
      // Categoria mais usada primeiro: é a que descreve melhor a pessoa.
      .sort((a, b) => b.total - a.total)
      .map(({ chave, itens, total }) => el('div', { class: 'vote-history-row' }, [
        el('span', { class: 'vote-history-q', text: rotuloDaCategoria(chave) }),
        el('span', { class: 'vote-history-a' }, [
          el('span', {
            class: 'vote-history-picks',
            text: itens.map(([rotulo, n]) => (n > 1 ? rotulo + ' ×' + n : rotulo)).join(' · '),
          }),
          el('span', { class: 'vote-history-total', text: String(total) }),
        ]),
      ])),
  ]);
}
