/**
 * Rivalidades: cada linha e um PAR de jogadores.
 *
 * Nada disto precisou ser gravado. Desde que o dano virou direcional, cada
 * evento ja carrega quem causou e quem levou - a agregacao so le o mesmo log
 * por par, em vez de por pessoa. Dano sem autor (vida paga) nao cria
 * rivalidade com ninguem.
 */

import { el } from '../../ui.js';
import { rivalPeople, rivalBetween, orientarRival } from '../../stats.js';
import { t, tn } from '../../i18n.js';

// Quem esta selecionado nos filtros de rivalidade. Fora do render porque a
// tela se redesenha inteira ao ocultar um jogador ou apagar uma partida, e
// perder a comparacao escolhida a cada mexida seria insuportavel.
let rivalA = null;

let rivalB = null;

/**
 * A aba de rivalidades: escolhe-se o par, e so ele aparece.
 *
 * Antes a aba despejava TODAS as duplas. Numa mesa de cinco isso ja da dez
 * cartoes, e depois de algumas noites a comparacao que interessa esta perdida
 * no meio de outras nove que ninguem pediu. Rivalidade e uma pergunta sobre
 * duas pessoas especificas - a tela agora pergunta quais.
 */
export function rivalsTab(pares, corDe, repintar) {
  const gente = rivalPeople(pares);

  // Sem escolha ainda: comeca pelo par de cima, que e o de maior atrito. Uma
  // tela que abre vazia obrigaria a mexer em dois campos antes de ver qualquer
  // coisa.
  //
  // A condicao e "esta pessoa ainda existe?", e nao "esta combinacao tem
  // grafico?". Resetar por combinacao vazia desfazia a escolha no meio do
  // caminho: ao trocar o campo da esquerda para quem ja estava na direita, os
  // dois campos voltavam sozinhos ao par inicial - e era impossivel chegar ao
  // par invertido, que e justamente o que se queria ver.
  const conhecido = (k) => gente.some((g) => g.key === k);
  if (!conhecido(rivalA) || !conhecido(rivalB)) {
    rivalA = pares[0].keyA;
    rivalB = pares[0].keyB;
  }

  const caixa = el('div', { class: 'rival-filters' });

  const campo = (qual, escolhido, aoTrocar) => {
    const sel = el('select', { class: 'rival-select', 'aria-label': qual });
    gente.forEach((g) => {
      const op = el('option', { value: g.key, text: g.label });
      if (g.key === escolhido) op.setAttribute('selected', '');
      sel.append(op);
    });
    sel.addEventListener('change', (e) => { aoTrocar(e.target.value); repintar(); });
    return el('label', { class: 'rival-field' }, [
      el('span', { class: 'menu-sub', text: qual }),
      sel,
    ]);
  };

  caixa.append(
    campo(t('stats.rivalA'), rivalA, (v) => { rivalA = v; }),
    el('span', { class: 'rival-vs', text: 'vs' }),
    campo(t('stats.rivalB'), rivalB, (v) => { rivalB = v; }),
  );

  const fora = el('div', { class: 'rival-tab' }, [caixa]);

  if (rivalA === rivalB) {
    fora.append(el('p', { class: 'search-status', text: t('stats.rivalSame') }));
    return fora;
  }

  const par = rivalBetween(pares, rivalA, rivalB);
  if (!par) {
    // Existir na lista nao garante ter cruzado com todo mundo.
    fora.append(el('p', { class: 'search-status', text: t('stats.rivalNone') }));
    return fora;
  }

  // O campo da esquerda manda no lado esquerdo do gráfico.
  fora.append(rivalCard(orientarRival(par, rivalA), corDe));
  return fora;
}

/**
 * Um par e o que aconteceu entre os dois.
 *
 * A barra do meio mostra o desequilibrio: quem bateu mais ocupa mais espaco.
 * E o numero que responde "quem persegue quem" de relance.
 */
function rivalCard(r, corDe) {
  const total = r.total || 1;
  const ladoA = Math.round((r.aToB.damage / total) * 100);

  const coluna = (nome, chave, lado, alinhar) => el('div', {
    class: 'rival-side' + (alinhar === 'end' ? ' is-end' : ''),
    style: { '--accent': corDe(chave) },
  }, [
    el('span', { class: 'rival-name', text: nome }),
    el('span', { class: 'rival-damage', text: String(lado.damage) }),
    el('span', {
      class: 'rival-extra',
      text: [
        lado.kills ? tn(lado.kills, 'stats.rivalKill', 'stats.rivalKills') : '',
        lado.cmdDamage ? t('stats.rivalCmd', { n: lado.cmdDamage }) : '',
        lado.poison ? t('stats.rivalPoison', { n: lado.poison }) : '',
      ].filter(Boolean).join(' · '),
    }),
  ]);

  return el('article', {
    class: 'card rival-card',
    style: { '--rival-b': corDe(r.keyB) },
  }, [
    el('div', { class: 'rival-head' }, [
      coluna(r.a, r.keyA, r.aToB),
      el('span', { class: 'rival-vs', text: 'vs' }),
      coluna(r.b, r.keyB, r.bToA, 'end'),
    ]),
    el('div', { class: 'rival-bar' }, [
      el('div', {
        class: 'rival-bar-a',
        style: { width: ladoA + '%', background: corDe(r.keyA) },
      }),
    ]),
    el('span', {
      class: 'rival-foot',
      text: t(r.games === 1 ? 'stats.rivalGame' : 'stats.rivalGames', {
        n: r.games, damage: r.total,
      }),
    }),
  ]);
}

export function emptyRivals() {
  return el('div', { class: 'empty' }, [
    el('p', { class: 'empty-title', text: t('stats.noRivals') }),
    el('p', {
      class: 'empty-sub',
      text: t('stats.noRivalsSub'),
    }),
  ]);
}
