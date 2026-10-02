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
  playerColor,
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
  return el('div', { class: 'deck-filter' }, [
    el('div', { class: 'select-row' }, [
      campo,
      el('span', { class: 'select-caret' }, [icon('arrow')]),
    ]),
  ]);
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

      if (agg.players.length > 1) panel.append(filtroDeJogador(agg.players, paint));
      if (!escolhidos.length) panel.append(semDecksDoJogador());
      else escolhidos.forEach((row) => panel.append(deckCard(row, recarregar)));
    } else if (activeTab === 'players') {
      agg.players.forEach((row) => panel.append(playerCard(row, recarregar, corDe)));
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
