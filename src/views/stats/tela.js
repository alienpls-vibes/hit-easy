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
      agg.decks.forEach((row) => panel.append(deckCard(row, recarregar)));
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
