/**
 * A tela de estatisticas: as abas, e qual delas esta aberta.
 *
 * Cada aba desenha com pecas de arquivos proprios desta pasta. A aba ativa
 * vive aqui porque e estado da TELA, nao do conteudo: trocar de aba nao
 * recarrega dado nenhum, so troca o que se desenha.
 */

import { el, clear, icon } from '../../ui.js';
import {
  aggregate, rivalries, summarize, formatDuration, playerColorOrder,
  playerColor, ORDENACOES, ordenarLinhas,
} from '../../stats.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';
import { openData } from './backup.js';
import { deckCard } from './deck.js';
import { playerCard } from './jogador.js';
import { matchCard } from './partida.js';
import { emptyState, miniStat } from './pecas.js';
import { emptyRivals, rivalsTab } from './rivalidades.js';

const TABS = [
  { id: 'decks', key: 'stats.decks' },
  { id: 'players', key: 'stats.players' },
  { id: 'rivals', key: 'stats.rivals' },
  { id: 'matches', key: 'stats.matches' },
];

let activeTab = 'decks';

/**
 * Por quem a aba de Decks esta filtrada. 'todos' e o padrao.
 *
 * Fora da funcao, como a aba ativa: trocar de aba e voltar nao deve desfazer o
 * filtro que a pessoa acabou de escolher.
 */
let filtroDeDeck = 'todos';

/**
 * Por qual numero as listas de Decks e de Jogadores estao ordenadas.
 *
 * Uma variavel para as duas abas, e nao uma por aba: as linhas das duas saem da
 * mesma agregacao e tem os mesmos campos, entao "ordenado por partidas" quer
 * dizer a mesma coisa nas duas. Com uma por aba, trocar de aba mudaria a ordem
 * sem ninguem ter pedido.
 */
let ordem = ORDENACOES[0].id;

/**
 * O seletor de jogador da aba de Decks.
 *
 * `<select>` nativo, e nao chips lado a lado: a lista cresce com o grupo, e
 * dez nomes nao cabem numa linha de celular. De quebra entrega o seletor que o
 * aparelho ja usa em todo lugar - mesmo argumento do campo de idioma.
 *
 * So aparece com mais de uma pessoa no historico: filtrar entre um nao filtra
 * nada, e o controle seria enfeite.
 */
function filtroDeJogador(jogadores, repintar) {
  const campo = el('select', {
    class: 'select-input',
    'aria-label': t('stats.filterByPlayer'),
    onChange: (e) => { filtroDeDeck = e.target.value; repintar(); },
  }, [
    el('option', {
      value: 'todos',
      text: t('stats.allPlayers'),
      selected: filtroDeDeck === 'todos' ? 'selected' : null,
    }),
    ...jogadores.map((p) => el('option', {
      value: p.key,
      text: p.label,
      selected: filtroDeDeck === p.key ? 'selected' : null,
    })),
  ]);

  campo.value = filtroDeDeck;
  return controle(t('stats.filterByPlayer'), campo);
}

/**
 * Por qual numero ordenar.
 *
 * Mesmo argumento do filtro para o `<select>` nativo. So aparece com mais de
 * uma linha: ordenar uma lista de um nao ordena nada.
 *
 * A opcao de taxa de vitoria tem a armadilha de sempre - um deck de uma partida
 * ganha vem antes de um de dez com oito vitorias. O desempate por partidas
 * ameniza entre iguais, mas 100% de uma partida continua sendo 100%; e o que a
 * pessoa pediu ao escolher taxa, e a coluna de partidas esta no cartao ao lado
 * do numero para quem for ler com cuidado.
 */
function seletorDeOrdem(repintar) {
  const campo = el('select', {
    class: 'select-input',
    'aria-label': t('stats.sortBy'),
    onChange: (e) => { ordem = e.target.value; repintar(); },
  }, ORDENACOES.map((o) => el('option', {
    value: o.id,
    text: t(o.rotulo),
    selected: ordem === o.id ? 'selected' : null,
  })));

  campo.value = ordem;
  return controle(t('stats.sortBy'), campo);
}

/** Um `<select>` com rotulo visivel, do tamanho da coluna que couber. */
function controle(rotulo, campo) {
  return el('label', { class: 'stats-control' }, [
    el('span', { class: 'control-label', text: rotulo }),
    el('span', { class: 'select-row' }, [
      campo,
      el('span', { class: 'select-caret' }, [icon('arrow')]),
    ]),
  ]);
}

/** A faixa de controles acima da lista. Vazia nao e desenhada. */
function barraDeControles(partes) {
  const uteis = partes.filter(Boolean);
  if (!uteis.length) return null;
  return el('div', { class: 'stats-controls' }, uteis);
}

/** A pessoa filtrada nao levou deck nenhum que ainda esteja na lista. */
function semDecksDoJogador() {
  return el('p', { class: 'search-status', text: t('stats.noDecksForPlayer') });
}

export function renderStats(root, { onBack }) {
  clear(root);
  const matches = store.partidas();

  // O aparelho sabe a que conta cada nome pertence; isso junta partidas
  // gravadas antes de o @ existir com a conta certa.
  const apelidos = store.knownHandles();
  const bruto = aggregate(matches, apelidos);
  const recarregar = () => renderStats(root, { onBack });

  // Ocultar tira a LINHA da lista, nao os dados: o dano que essa pessoa causou
  // continua somando para quem levou, e a linha do tempo segue completa.
  const agg = {
    decks: bruto.decks.filter((d) => !store.isDeckHidden(d.key)),
    players: bruto.players.filter((p) => !store.isPlayerHidden(p.key)),
  };
  // Uma cor por pessoa, estável entre partidas: é isso que deixa reconhecer
  // o mesmo jogador de relance. Deck continua com a identidade do comandante.
  const ordemCores = playerColorOrder(matches, apelidos);
  const corDe = (chave) => playerColor(ordemCores, chave);

  const rivais = rivalries(matches, apelidos).filter(
    (r) => !store.isPlayerHidden(r.keyA) && !store.isPlayerHidden(r.keyB),
  );

  const panel = el('div', { class: 'stats-panel' });

  const tabBar = el('div', { class: 'tabs' }, TABS.map((tab) =>
    el('button', {
      class: 'tab' + (activeTab === tab.id ? ' is-on' : ''),
      onClick: (e) => {
        activeTab = tab.id;
        tabBar.querySelectorAll('.tab').forEach((x) => x.classList.remove('is-on'));
        e.currentTarget.classList.add('is-on');
        paint();
      },
    }, [t(tab.key)]),
  ));

  function paint() {
    clear(panel);
    if (!matches.length) {
      panel.append(emptyState());
      return;
    }
    if (activeTab === 'decks') {
      // Um jogador que saiu do filtro (oculto, ou apagado com a partida) nao
      // pode deixar a aba vazia e sem explicacao: o filtro volta para Todos.
      if (filtroDeDeck !== 'todos'
        && !agg.players.some((p) => p.key === filtroDeDeck)) {
        filtroDeDeck = 'todos';
      }

      const escolhidos = filtroDeDeck === 'todos'
        ? agg.decks
        : agg.decks.filter((d) => (d.jogadores || []).includes(filtroDeDeck));

      // Ordenar DEPOIS de filtrar: ordenar antes gastaria a comparacao em
      // linhas que a tela nao vai mostrar, e o topo da lista seria o topo do
      // grupo inteiro em vez do topo do que esta na tela.
      const barra = barraDeControles([
        agg.players.length > 1 ? filtroDeJogador(agg.players, paint) : null,
        escolhidos.length > 1 ? seletorDeOrdem(paint) : null,
      ]);
      if (barra) panel.append(barra);

      if (!escolhidos.length) panel.append(semDecksDoJogador());
      else ordenarLinhas(escolhidos, ordem).forEach((row) => panel.append(deckCard(row, recarregar)));
    } else if (activeTab === 'players') {
      if (agg.players.length > 1) {
        panel.append(barraDeControles([seletorDeOrdem(paint)]));
      }
      ordenarLinhas(agg.players, ordem)
        .forEach((row) => panel.append(playerCard(row, recarregar, corDe)));
    } else if (activeTab === 'rivals') {
      if (!rivais.length) panel.append(emptyRivals());
      else panel.append(rivalsTab(rivais, corDe, paint));
    } else {
      matches.forEach((m) => panel.append(matchCard(m, recarregar)));
    }
  }

  root.append(el('div', { class: 'stats' }, [
    el('header', { class: 'stats-head' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onClick: onBack }, [icon('back')]),
      el('h1', { class: 'stats-title', text: t('stats.title') }),
      el('button', { class: 'icon-btn', 'aria-label': t('data.title'), onClick: () => openData(root, onBack, () => renderStats(root, { onBack })) }, [icon('more')]),
    ]),
    el('div', { class: 'stats-summary' }, [
      miniStat(String(matches.length), t(matches.length === 1 ? 'stats.match' : 'stats.matchesLower')),
      miniStat(String(agg.decks.length), t(agg.decks.length === 1 ? 'stats.deck' : 'stats.decksLower')),
      miniStat(String(agg.players.length), t('stats.playersLower')),
      miniStat(
        formatDuration(matches.reduce((s, m) => s + summarize(m).duration, 0)),
        t('stats.onTable'),
      ),
    ]),
    tabBar,
    panel,
  ]));

  paint();
}
