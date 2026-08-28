/**
 * Estatisticas: decks, jogadores e historico de partidas.
 * Tudo derivado do log de eventos - nenhum numero aqui e gravado em disco.
 */

import { el, clear, icon, openSheet, toast, confirmAction } from '../ui.js';
import { accentOf, identityGradient, pips } from '../colors.js';
import {
  aggregate, rivalries, summarize, timeline, formatDuration, formatDate, pct, num,
  playerColorOrder, playerColor,
  rotuloDaCategoria, rivalPeople, rivalBetween, orientarRival,
} from '../stats.js';
import { deckNameOf } from '../engine.js';
import * as store from '../store.js';
import * as cloud from '../cloud.js';
import { cloudEnabled } from '../config.js';
import { t, tn, locale } from '../i18n.js';

const TABS = [
  { id: 'decks', key: 'stats.decks' },
  { id: 'players', key: 'stats.players' },
  { id: 'rivals', key: 'stats.rivals' },
  { id: 'matches', key: 'stats.matches' },
];

let activeTab = 'decks';

// Quem esta selecionado nos filtros de rivalidade. Fora do render porque a
// tela se redesenha inteira ao ocultar um jogador ou apagar uma partida, e
// perder a comparacao escolhida a cada mexida seria insuportavel.
let rivalA = null;
let rivalB = null;

export function renderStats(root, { onBack }) {
  clear(root);
  const db = store.getDB();
  const matches = db.history || [];

  // O aparelho sabe a que conta cada nome pertence; isso junta partidas
  // gravadas antes de o @ existir com a conta certa.
  const apelidos = store.knownHandles();
  const bruto = aggregate(matches, apelidos);
  const recarregar = () => renderStats(root, { onBack });

  // Ocultar tira a LINHA da lista, nao os dados: o dano que essa pessoa causou
  // continua somando para quem levou, e a linha do tempo segue completa.
  const agg = {
    decks: bruto.decks.filter((d) => !store.isDeckHidden(d.key)),
    players: bruto.players.filter((p) => !store.isPlayerHidden(p.label)),
  };
  // Uma cor por pessoa, estável entre partidas: é isso que deixa reconhecer
  // o mesmo jogador de relance. Deck continua com a identidade do comandante.
  const ordemCores = playerColorOrder(matches, apelidos);
  const corDe = (chave) => playerColor(ordemCores, chave);

  const rivais = rivalries(matches, apelidos).filter(
    (r) => !store.isPlayerHidden(r.a) && !store.isPlayerHidden(r.b),
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
      el('button', { class: 'icon-btn', 'aria-label': t('data.title'), onClick: () => openData(root, onBack) }, [icon('more')]),
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

function miniStat(value, label) {
  return el('div', { class: 'mini-stat' }, [
    el('span', { class: 'mini-value', text: value }),
    el('span', { class: 'mini-label', text: label }),
  ]);
}

function emptyState() {
  return el('div', { class: 'empty' }, [
    el('p', { class: 'empty-title', text: t('stats.empty') }),
    el('p', { class: 'empty-sub', text: t('stats.emptySub') }),
  ]);
}

function deckCard(row, recarregar) {
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

function playerCard(row, recarregar, corDe) {
  return el('article', { class: 'card', style: { '--accent': corDe(row.key) } }, [
    el('header', { class: 'card-head' }, [
      el('div', {
        class: 'card-avatar is-tinted',
        text: (row.label || '?').slice(0, 1).toUpperCase(),
      }),
      el('div', { class: 'card-titles' }, [
        el('h3', { class: 'card-name', text: row.label }),
        el('span', { class: 'card-sub', text: row.games + ' ' + t(row.games === 1 ? 'stats.match' : 'stats.matchesLower') }),
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

/**
 * Como as vitorias foram ganhas.
 *
 * So aparece quando alguem declarou motivo - vitoria por ultimo vivo nao tem
 * causa registrada, e um bloco vazio em todo cartao seria ruido.
 */
function winReasonBlock(row) {
  const motivos = Object.entries(row.winReasons || {});
  if (!motivos.length) return null;

  const ROTULOS = {
    combate: 'win.combat', comandante: 'win.commander', combo: 'win.combo',
    veneno: 'win.poison', mill: 'win.mill', alternativa: 'win.alt',
    concessao: 'win.concede', outro: 'win.other',
  };

  return el('div', { class: 'vote-history' }, [
    el('span', { class: 'vote-history-title' }, [
      t('stats.winReasons'),
      el('span', {
        class: 'vote-history-count',
        text: String(motivos.reduce((a, [, n]) => a + n, 0)),
      }),
    ]),
    el('div', { class: 'win-reason-tags' }, motivos
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => el('span', {
        class: 'win-reason-tag',
        text: t(ROTULOS[id] || 'win.other') + (n > 1 ? ' ×' + n : ''),
      }))),
  ]);
}

/**
 * Ocultar da lista, com confirmacao que deixa claro o que NAO acontece.
 * "Excluir" assusta; a pessoa precisa saber que as partidas ficam inteiras.
 */
function hideButton(tipo, row, recarregar) {
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
      else store.hidePlayer(row.label);
      if (recarregar) recarregar();
    },
  }, [icon('close')]);
}

function emptyRivals() {
  return el('div', { class: 'empty' }, [
    el('p', { class: 'empty-title', text: t('stats.noRivals') }),
    el('p', {
      class: 'empty-sub',
      text: t('stats.noRivalsSub'),
    }),
  ]);
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

/**
 * Escolhas em votacao secreta.
 *
 * So aparece para quem ja passou por uma: um bloco vazio dizendo "0 votacoes"
 * seria ruido em todo cartao da lista, e a maioria dos decks nunca encostou
 * numa carta dessas.
 */
function voteBlock(row) {
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

function winBar(rate) {
  return el('div', { class: 'winbar' }, [
    el('div', { class: 'winbar-fill', style: { width: Math.round(rate * 100) + '%' } }),
  ]);
}

function statGrid(row) {
  // Dano causado e recebido já incluem o de comandante; "vida paga" é o custo
  // que o jogador bancou sozinho, e por isso não conta como dano de ninguém.
  const cells = [
    [t('stats.damageDealt'), num(row.avgDamageDealt, 0), t('stats.perMatch')],
    [t('stats.damageTaken'), num(row.avgDamageTaken, 0), t('stats.perMatch')],
    [t('stats.lifePaid'), num(row.avgLifePaid, 0), t('stats.perMatch')],
    [t('stats.healed'), num(row.avgHealed, 0), t('stats.perMatch')],
    [t('stats.kills'), num(row.avgKills, 1), t('stats.perMatch')],
    [t('stats.turns'), num(row.avgTurns, 1), t('stats.played')],
    [t('stats.place'), num(row.avgPlace, 1) + 'º', t('stats.average')],
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

function matchCard(match, refresh) {
  const s = summarize(match);

  // Sem cor por aqui de propósito: a lista de colocações e a data ja dizem tudo
  // que esta aba precisa dizer, e cor em cima disso virava enfeite. Cor de
  // jogador continua valendo onde o eixo é a pessoa - Jogadores e Rivalidades.
  const card = el('article', { class: 'card is-match' }, [
    el('header', { class: 'card-head' }, [
      el('div', { class: 'card-titles' }, [
        el('h3', { class: 'card-name', text: s.winner ? t('stats.wonBy', { name: s.winner.name }) : t('stats.noWinner') }),
        el('span', {
          class: 'card-sub',
          text: formatDate(s.startedAt) + ' · ' + formatDuration(s.duration)
            + ' · ' + s.turns + ' ' + t('stats.turns').toLowerCase(),
        }),
      ]),
      el('button', {
        class: 'icon-btn',
        'aria-label': t('stats.details'),
        onClick: () => openMatchDetail(match, refresh),
      }, [icon('arrow')]),
    ]),
    el('ol', { class: 'placings' }, s.standings.map(({ seatId, place }) => {
      const seat = match.seats.find((x) => x.id === seatId);
      return el('li', { class: 'placing' }, [
        el('span', { class: 'placing-pos', text: place + 'º' }),
        el('span', { class: 'placing-name', text: seat.name }),
        el('span', { class: 'placing-deck', text: deckNameOf(seat.commanders) }),
      ]);
    })),
  ]);
  return card;
}

function openMatchDetail(match, refresh) {
  const s = summarize(match);
  openSheet({
    title: formatDate(s.startedAt),
    subtitle: t('stats.matchSub', { turns: s.turns, time: formatDuration(s.duration), damage: s.totalDamage }),
    build: (body) => {
      body.append(el('p', { class: 'sheet-legend', text: t('stats.timeline') }));
      const log = el('ol', { class: 'timeline' });
      let lastTurn = null;
      for (const ev of timeline(match)) {
        if (ev.turn !== lastTurn) {
          lastTurn = ev.turn;
          log.append(el('li', { class: 'timeline-turn', text: t('tl.turnLabel', { n: ev.turn }) }));
        }
        if (ev.type === 'turn') continue;
        log.append(el('li', { class: 'timeline-row' }, [
          el('span', { class: 'timeline-time', text: new Date(ev.ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) }),
          el('span', { class: 'timeline-text', text: ev.text }),
        ]));
      }
      if (!match.events.length) {
        log.append(el('li', { class: 'timeline-row' }, [el('span', { class: 'timeline-text', text: t('stats.noEvents') })]));
      }
      body.append(log);
      body.append(el('div', { class: 'sheet-actions' }, [
        el('button', {
          class: 'btn danger',
          onClick: async () => {
            const ok = await confirmAction({
              title: t('stats.deleteMatchTitle'),
              message: t('stats.deleteMatchMsg'),
              confirmLabel: t('common.delete'),
            });
            if (ok) { store.deleteMatch(match.id); refresh(); }
          },
        }, [t('stats.deleteMatch')]),
      ]));
    },
  });
}

/** Backup: exportar/importar tudo em JSON. */
function openData(root, onBack) {
  openSheet({
    title: t('data.title'),
    subtitle: t('data.sub'),
    build: (body, close) => {
      const fileInput = el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          store.importJSON(await file.text());
          close();
          toast(t('data.imported'));
          renderStats(root, { onBack });
        } catch {
          toast(t('data.importFailed'));
        }
      });

      const escondidos = store.hiddenCount();
      if (escondidos) {
        body.append(el('p', { class: 'sheet-legend', text: t('stats.hidden') }));
        const lista = el('div', { class: 'menu' });
        const db = store.getDB();

        db.hiddenPlayers.forEach((nome) => {
          lista.append(el('button', {
            class: 'menu-item',
            onClick: () => { store.unhidePlayer(nome); close(); renderStats(root, { onBack }); },
          }, [
            el('span', { class: 'menu-label', text: nome }),
            el('span', { class: 'menu-sub', text: t('stats.hiddenPlayer') }),
          ]));
        });
        db.hiddenDecks.forEach((chave) => {
          lista.append(el('button', {
            class: 'menu-item',
            onClick: () => { store.unhideDeck(chave); close(); renderStats(root, { onBack }); },
          }, [
            el('span', { class: 'menu-label', text: nomeDoDeck(chave) }),
            el('span', { class: 'menu-sub', text: t('stats.hiddenDeck') }),
          ]));
        });
        body.append(lista);
        body.append(el('p', { class: 'sheet-legend', text: t('data.backup') }));
      }

      body.append(el('div', { class: 'menu' }, [
        el('button', {
          class: 'menu-item',
          onClick: () => {
            const blob = new Blob([store.exportJSON()], { type: 'application/json' });
            const a = el('a', {
              href: URL.createObjectURL(blob),
              download: 'commander-stats-' + new Date().toISOString().slice(0, 10) + '.json',
            });
            document.body.append(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
            close();
          },
        }, [
          el('span', { class: 'menu-label', text: t('data.export') }),
          el('span', { class: 'menu-sub', text: t('data.exportSub') }),
        ]),
        el('button', { class: 'menu-item', onClick: () => fileInput.click() }, [
          el('span', { class: 'menu-label', text: t('data.import') }),
          el('span', { class: 'menu-sub', text: t('data.importSub') }),
        ]),
        el('button', {
          class: 'menu-item is-danger',
          onClick: async () => {
            close();
            const ok = await confirmAction({
              title: t('data.wipeTitle'),
              message: t('data.wipeMsg'),
              confirmLabel: t('data.wipe'),
            });
            if (ok) { store.wipe(); renderStats(root, { onBack }); }
          },
        }, [
          el('span', { class: 'menu-label', text: t('data.wipe') }),
          el('span', { class: 'menu-sub', text: t('data.wipeSub') }),
        ]),
        fileInput,
      ]));
    },
  });
}

/** Nome legivel de um deck oculto, procurado no historico pela chave. */
function nomeDoDeck(chave) {
  for (const match of store.getDB().history || []) {
    for (const seat of match.seats || []) {
      const k = (seat.commanders || []).map((c) => c.oracleId).sort().join('+');
      if (k === chave) return deckNameOf(seat.commanders);
    }
  }
  return chave;
}


/**
 * A aba de rivalidades: escolhe-se o par, e so ele aparece.
 *
 * Antes a aba despejava TODAS as duplas. Numa mesa de cinco isso ja da dez
 * cartoes, e depois de algumas noites a comparacao que interessa esta perdida
 * no meio de outras nove que ninguem pediu. Rivalidade e uma pergunta sobre
 * duas pessoas especificas - a tela agora pergunta quais.
 */
function rivalsTab(pares, corDe, repintar) {
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
 * A tela de quem ainda nao tem acesso.
 *
 * Ela conta quantas partidas ja estao guardadas de proposito. Nao e enfeite: e
 * a diferenca entre "pague para usar" e "o que e seu esta aqui, esperando".
 * Continuar jogando e continuar gravando nunca foi bloqueado - so a leitura do
 * historico e.
 *
 * O botao de conferir de novo existe porque a liberacao acontece FORA do app,
 * na mao. Sem ele, a pessoa liberada teria de fechar e abrir o aplicativo para
 * a assinatura ser relida, sem nenhuma pista de que era isso que faltava.
 */
export function renderPaywall(root, { onBack, onUnlock }) {
  clear(root);
  const quantas = (store.getDB().history || []).length;
  const repintar = () => (onUnlock ? onUnlock() : null);
  const estado = cloud.state();

  const conferir = el('button', { class: 'btn ghost block' }, [t('paywall.recheck')]);
  conferir.addEventListener('click', async () => {
    conferir.disabled = true;
    conferir.textContent = t('paywall.checking');
    try {
      await cloud.carregarAssinatura();
    } catch {
      /* sem rede: o estado continua o que era */
    }
    if (cloud.podeVerEstatisticas(cloudEnabled(), cloud.state())) { repintar(); return; }
    conferir.disabled = false;
    conferir.textContent = t('paywall.recheck');
    toast(t('paywall.stillLocked'));
  });

  const corpo = el('div', { class: 'paywall' }, [
    el('h2', { class: 'paywall-title', text: t('paywall.title') }),
    el('p', { class: 'paywall-body', text: t('paywall.body') }),
    quantas
      ? el('p', {
        class: 'paywall-count',
        text: quantas === 1 ? t('paywall.savedOne') : t('paywall.savedCount', { n: quantas }),
      })
      : null,
    estado === 'deslogado'
      ? el('button', {
        class: 'btn primary block',
        onClick: () => { toast(t('paywall.signInHint')); if (onBack) onBack(); },
      }, [t('paywall.signInFirst')])
      : conferir,
    el('p', { class: 'account-note', text: t('paywall.earlyAccess') }),
  ]);

  root.append(el('div', { class: 'stats' }, [
    el('header', { class: 'stats-head' }, [
      el('button', {
        class: 'icon-btn',
        'aria-label': t('common.back'),
        onClick: () => onBack && onBack(),
      }, [icon('arrow')]),
      el('h1', { class: 'stats-title', text: t('stats.title') }),
    ]),
    corpo,
  ]));
}
