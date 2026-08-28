/**
 * Montagem da mesa: vida inicial, jogadores, comandantes e a ordem em que
 * sentam - que e a ordem dos turnos.
 *
 * A partida so comeca quando todo assento tem comandante: e o comandante que
 * amarra a estatistica ao deck.
 */

import {
  el, clear, icon, brandMark, openSheet, openFlow, closeSheet, buzz, toast, setHaptics,
} from '../ui.js';
import { accentOf, pips } from '../colors.js';
import { searchCommanders, isOffline } from '../scryfall.js';
import * as store from '../store.js';
import { uid, deckNameOf, pessoaRepetida } from '../engine.js';
import { variantsFor, layoutFor } from '../seating.js';
import { MODES, currentMode, applyTheme } from '../theme.js';
import { t, tn, LANGS, currentLang, setLang } from '../i18n.js';
import { state as installState, promptInstall, onInstallChange } from '../install.js';
import * as cloud from '../cloud.js';
import { handleValido, exibirHandle, normalizarHandle } from '../cloud.js';
import { cloudEnabled, CHECKOUT_URL } from '../config.js';
import { formatDate } from '../stats.js';

const LIFE_PRESETS = [20, 30, 40, 60];
const MIN_SEATS = 2;
const MAX_SEATS = 6;

let draft = null;

function freshSeat(index) {
  // Chave propria, e nao o titulo da secao: 'Players' + numero dava
  // "Players 1" em ingles. Interpolar tambem deixa a ordem livre em
  // linguas onde o numero nao vem depois.
  return { id: uid('seat'), name: t('setup.playerN', { n: index + 1 }), commanders: [] };
}

function ensureDraft() {
  if (draft) return draft;
  const settings = store.getDB().settings;
  draft = {
    startingLife: settings.startingLife || 40,
    seats: [freshSeat(0), freshSeat(1), freshSeat(2), freshSeat(3)],
    layoutId: null,
    firstSeatId: null,
  };
  return draft;
}

/** Reaproveita a mesa anterior mantendo jogadores, decks e disposicao. */
export function seedDraftFrom(match) {
  draft = {
    startingLife: match.startingLife,
    seats: match.seats.map((s) => ({
      id: uid('seat'),
      name: s.name,
      commanders: s.commanders.map((c) => ({ ...c })),
    })),
    layoutId: match.layoutId || null,
    firstSeatId: null, // quem comeca se decide de novo a cada partida
  };
}

export function renderSetup(root, { onStart, onStats, onRefresh }) {
  const d = ensureDraft();
  clear(root);

  const seatList = el('div', { class: 'seat-list' });
  const startBtn = el('button', { class: 'btn primary block', onClick: () => openPreGame(d, onStart) }, []);

  const refresh = () => {
    clear(seatList);
    d.seats.forEach((seat, i) => seatList.append(seatCard(seat, i, refresh)));
    if (d.seats.length < MAX_SEATS) {
      seatList.append(
        el('button', { class: 'seat-add', onClick: () => {
          d.seats.push(freshSeat(d.seats.length));
          d.layoutId = null; // a disposicao muda com a quantidade de gente
          refresh();
        } }, [icon('plus'), t('setup.addPlayer')]),
      );
    }
    bindReorder(seatList, d, refresh);

    const faltam = d.seats.filter((s) => !s.commanders.length).length;
    startBtn.disabled = faltam > 0;
    startBtn.textContent = faltam
      ? (faltam === 1 ? t('setup.missingCommander') : t('setup.missingCommanders', { n: faltam }))
      : t('setup.startMatch');
  };

  root.append(
    el('div', { class: 'setup' }, [
      el('header', { class: 'setup-head' }, [
        el('div', { class: 'brand' }, [
          brandMark(),
          el('div', { class: 'brand-words' }, [
            el('span', { class: 'brand-text' }, ['Hit Easy']),
            el('span', { class: 'brand-tag', text: t('brand.tag') }),
          ]),
        ]),
        el('div', { class: 'head-actions' }, [
          // Só aparece quando o navegador diz que dá para instalar agora.
          installState().mode === 'pronto'
            ? el('button', {
                class: 'icon-btn is-install',
                'aria-label': t('setup.installApp'),
                onClick: async () => {
                  const r = await promptInstall();
                  if (r === 'accepted') toast(t('settings.installDone'));
                  if (onRefresh) onRefresh();
                },
              }, [icon('download')])
            : null,
          el('button', { class: 'icon-btn', 'aria-label': t('common.settings'), onClick: () => openSettings(onRefresh) }, [icon('gear')]),
          el('button', { class: 'icon-btn', 'aria-label': t('common.stats'), onClick: onStats }, [icon('chart')]),
        ]),
      ]),

      el('div', { class: 'field-row setup-life' }, [
        el('span', { class: 'label' }, [t('setup.startingLife')]),
        el('div', { class: 'chips' }, LIFE_PRESETS.map((v) =>
          el('button', {
            class: 'chip' + (d.startingLife === v ? ' is-on' : ''),
            onClick: (e) => {
              d.startingLife = v;
              e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-on'));
              e.currentTarget.classList.add('is-on');
              buzz();
            },
          }, [String(v)]),
        )),
      ]),

      el('div', { class: 'field-row setup-players' }, [
        el('span', { class: 'label' }, [t('setup.players')]),
        el('span', { class: 'hint', text: t('setup.dragToReorder') }),
      ]),
      seatList,
      el('div', { class: 'setup-foot' }, [
        startBtn,
        // Dentro do rodapé de propósito: ele já tem área no grid da versão
        // deitada, então a assinatura acompanha sem mexer no layout.
        // Não entra no dicionário de idiomas — apelido não se traduz.
        el('p', { class: 'signature', text: 'designed by @AlienPls' }),
      ]),
    ]),
  );

  refresh();
}

function seatCard(seat, index, refresh) {
  const commander = seat.commanders[0];
  const accent = commander ? accentOf(commander.colors) : 'var(--line)';

  const art = el('button', {
    class: 'seat-art' + (commander ? '' : ' is-empty'),
    style: commander && commander.thumb ? { backgroundImage: 'url(' + commander.thumb + ')' } : {},
    onClick: () => openFlow(commanderStep(seat, 0, refresh)),
    'aria-label': t('setup.chooseCommander'),
  }, commander ? [] : [icon('plus')]);

  // Tocar no nome abre o fluxo completo: jogador e, em seguida, o deck dele.
  const nameBtn = el('button', {
    class: 'seat-name',
    onClick: () => openFlow(playerStep(seat, refresh)),
  }, [
    el('span', { class: 'seat-name-text', text: seat.name }),
    el('span', { class: 'seat-name-caret' }, [icon('arrow')]),
  ]);

  const deckLine = commander
    ? el('button', { class: 'seat-deck', onClick: () => openFlow(commanderStep(seat, 0, refresh)) }, [
        el('span', { class: 'seat-deck-name', text: deckNameOf(seat.commanders) }),
        el('span', { class: 'seat-pips', style: { color: accent }, text: pips(commander.colors) }),
      ])
    : el('button', { class: 'seat-deck is-empty', onClick: () => openFlow(commanderStep(seat, 0, refresh)) }, [
        t('setup.chooseCommander'),
      ]);

  const partnerBtn = commander
    ? el('button', {
        class: 'seat-partner',
        onClick: () => {
          if (seat.commanders[1]) {
            seat.commanders.splice(1, 1);
            refresh();
          } else openFlow(commanderStep(seat, 1, refresh));
        },
      }, [seat.commanders[1] ? t('setup.removePartner') : t('setup.partner')])
    : null;

  return el('div', {
    class: 'seat-card',
    dataset: { index: String(index) },
    style: { '--accent': accent },
  }, [
    el('div', { class: 'seat-grip', 'aria-label': t('setup.reorder') }, [icon('grip')]),
    seatSpot(index),
    art,
    el('div', { class: 'seat-info' }, [nameBtn, handleLine(seat, refresh), deckLine, partnerBtn]),
    el('button', {
      class: 'seat-remove',
      'aria-label': t('setup.removePlayer'),
      onClick: () => {
        const d = ensureDraft();
        if (d.seats.length <= MIN_SEATS) {
          toast(t('setup.needTwoPlayers'));
          return;
        }
        d.seats.splice(d.seats.indexOf(seat), 1);
        d.layoutId = null;
        refresh();
      },
    }, [icon('close')]),
  ]);
}

/* ------------------------------------------------------------------ */
/* Reordenar assentos                                                  */
/* ------------------------------------------------------------------ */

/**
 * Arrastar pela alca reordena a lista.
 *
 * A ordem dos assentos E a ordem dos turnos, entao isso nao e enfeite: e como
 * se diz ao app quem senta ao lado de quem. Os cartoes tem altura igual, o que
 * deixa a conta simples - o indice de destino e so a distancia percorrida
 * dividida pelo passo.
 */
function bindReorder(list, d, refresh) {
  const cards = [...list.querySelectorAll('.seat-card')];
  if (cards.length < 2) return;

  cards.forEach((card, index) => {
    const grip = card.querySelector('.seat-grip');
    if (!grip) return;

    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);

      const alturas = cards.map((c) => c.offsetHeight);
      const gap = cards.length > 1 ? cards[1].offsetTop - cards[0].offsetTop - alturas[0] : 0;
      const passo = alturas[0] + gap;
      const y0 = e.clientY;
      let destino = index;

      list.classList.add('is-reordering');
      card.classList.add('is-dragging');
      buzz(12);

      const move = (ev) => {
        const dy = ev.clientY - y0;
        card.style.transform = 'translateY(' + dy + 'px)';

        const alvo = Math.max(0, Math.min(cards.length - 1, index + Math.round(dy / passo)));
        if (alvo === destino) return;
        destino = alvo;
        buzz(6);

        // Abre espaço: quem está entre a origem e o destino anda um passo.
        cards.forEach((outro, i) => {
          if (i === index) return;
          let shift = 0;
          if (destino > index && i > index && i <= destino) shift = -passo;
          if (destino < index && i < index && i >= destino) shift = passo;
          outro.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
        });
      };

      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        list.classList.remove('is-reordering');
        cards.forEach((c) => { c.style.transform = ''; c.classList.remove('is-dragging'); });

        if (destino !== index) {
          const [movido] = d.seats.splice(index, 1);
          d.seats.splice(destino, 0, movido);
          buzz(14);
        }
        refresh();
      };

      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Telas do fluxo jogador -> deck                                      */
/* ------------------------------------------------------------------ */

/**
 * Quem vai sentar neste assento.
 *
 * Quem ja jogou neste aparelho aparece na lista - digitar o nome de novo a
 * cada partida seria o tipo de atrito que ninguem aguenta na terceira semana.
 * O nome tambem e a chave das estatisticas, entao escolher da lista evita que
 * "Alex" e "alex" virem dois jogadores diferentes.
 *
 * Escolher alguem nao fecha o painel: desliza direto para o deck dele.
 */
function playerStep(seat, refresh) {
  return {
    title: t('player.whoPlays'),
    subtitle: t('player.whoPlaysSub'),
    build: (pane, api) => {
      const d = ensureDraft();
      const emUso = new Set(
        d.seats.filter((s) => s !== seat).map((s) => s.name.trim().toLowerCase()),
      );

      const escolher = (nome) => {
        if (nomeNaMesa(seat, nome)) { toast(t('player.nameTaken')); return; }
        seat.name = nome;
        store.rememberPlayer(nome);
        // Se ja se soube a que conta este nome pertence, nao pergunta de novo.
        const lembrado = store.handleOf(nome);
        if (lembrado) { seat.handle = lembrado; seat.userId = null; }
        else if (seat.handle) { seat.handle = ''; seat.userId = null; }
        buzz(12);
        refresh();
        api.next(commanderStep(seat, 0, refresh));
      };

      const input = el('input', {
        class: 'search-input',
        placeholder: t('player.namePlaceholder'),
        maxlength: '18',
        'aria-label': t('player.namePlaceholder'),
        onKeyDown: (e) => {
          if (e.key === 'Enter' && e.target.value.trim()) escolher(e.target.value.trim());
        },
      });

      pane.append(el('p', { class: 'sheet-legend', text: t('player.createNew') }));
      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', {
          class: 'btn primary',
          onClick: () => { if (input.value.trim()) escolher(input.value.trim()); },
        }, [t('player.use')]),
      ]));

      // O outro caminho: em vez de digitar um nome solto, achar a CONTA da
      // pessoa. A partida ja nasce ligada a ela, e a estatistica dela recebe
      // esta mesa sem ninguem precisar lembrar de vincular depois.
      if (podeVincular()) {
        pane.append(el('button', {
          class: 'player-row is-find',
          onClick: () => api.next(buscaHandleStep(seat, refresh, {
            adotarNome: true,
            aoFim: 'deck',
          })),
        }, [
          el('span', { class: 'player-avatar', text: '@' }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: t('player.findUser') }),
            el('span', { class: 'player-sub', text: t('player.findUserSub') }),
          ]),
        ]));
      }

      const salvos = store.knownPlayers();
      if (!salvos.length) {
        pane.append(el('p', { class: 'search-status', text: t('player.noneSaved') }));
        setTimeout(() => input.focus(), 160);
        return;
      }

      const linha = (nome, ocupado) => {
        const decks = store.decksOfPlayer(nome, store.handleOf(nome));
        return el('button', {
          class: 'player-row' + (ocupado ? ' is-busy' : ''),
          disabled: ocupado,
          onClick: () => escolher(nome),
        }, [
          el('span', { class: 'player-avatar', text: nome.slice(0, 1).toUpperCase() }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: nome }),
            el('span', {
              class: 'player-sub',
              text: ocupado
                ? t('player.isAtTable')
                : decks.length
                  ? tn(decks.length, 'player.deckSaved', 'player.decksSaved')
                  : t('player.noMatches'),
            }),
          ]),
          el('span', {
            class: 'player-forget',
            role: 'button',
            'aria-label': t('common.remove') + ' ' + nome,
            onClick: (e) => {
              e.stopPropagation(); // nao selecionar o jogador ao remove-lo
              store.forgetPlayer(nome);
              clear(pane);
              playerStep(seat, refresh).build(pane, api);
              api.remeasure();
            },
          }, [icon('close')]),
        ]);
      };

      // Quem ja esta sentado vai para o fim: a lista existe para escolher quem
      // AINDA nao esta na mesa, e nomes inclicaveis no meio do caminho so
      // atrapalham a mira.
      const disponiveis = salvos.filter((n) => !emUso.has(n.trim().toLowerCase()));
      const naMesa = salvos.filter((n) => emUso.has(n.trim().toLowerCase()));
      const lista = el('div', { class: 'result-list' });

      if (disponiveis.length) {
        pane.append(el('p', { class: 'sheet-legend', text: t('player.playedHere') }));
        disponiveis.forEach((nome) => lista.append(linha(nome, false)));
      } else {
        pane.append(el('p', {
          class: 'search-status',
          text: t('player.allAtTable'),
        }));
      }

      if (naMesa.length) {
        lista.append(el('p', { class: 'sheet-legend', text: t('player.atTable') }));
        naMesa.forEach((nome) => lista.append(linha(nome, true)));
      }

      pane.append(lista);
    },
  };
}

/** Escolha do comandante: decks do jogador, depois recentes, depois Scryfall. */
function commanderStep(seat, slot, refresh) {
  return {
    title: slot === 0 ? t('commander.title') : t('commander.partnerTitle'),
    subtitle: t('commander.sub', { name: seat.name }),
    build: (pane, api) => {
      let controller = null;
      let debounce = null;

      const input = el('input', {
        class: 'search-input',
        type: 'search',
        placeholder: t('commander.searchPlaceholder'),
        autocomplete: 'off',
        'aria-label': t('commander.search'),
      });
      const status = el('p', { class: 'search-status' });
      const results = el('div', { class: 'result-list' });

      const choose = (commander) => {
        seat.commanders[slot] = commander;
        store.rememberCommander(commander);
        buzz(12);
        api.close();
        refresh();
      };

      const showSaved = () => {
        clear(results);
        const meus = store.decksOfPlayer(seat.name, seat.handle);
        const jaListados = new Set();

        if (meus.length) {
          results.append(el('p', { class: 'sheet-legend', text: t('commander.decksOf', { name: seat.name }) }));
          meus.forEach(({ commanders }) => {
            const c = commanders[slot] || commanders[0];
            if (!c || jaListados.has(c.oracleId)) return;
            jaListados.add(c.oracleId);
            results.append(resultRow(c, choose));
          });
        }

        const outros = store.recentCommanders(12).filter((c) => !jaListados.has(c.oracleId));
        if (outros.length) {
          results.append(el('p', {
            class: 'sheet-legend',
            text: meus.length ? t('commander.otherDecks') : t('commander.recentDecks'),
          }));
          outros.forEach((c) => results.append(resultRow(c, choose)));
        }

        status.textContent = (meus.length || outros.length)
          ? t('commander.savedHere')
          : (isOffline() ? t('commander.offline') : t('commander.typeTwo'));
        api.remeasure();
      };

      const run = async (q) => {
        if (controller) controller.abort();
        controller = new AbortController();
        status.textContent = t('commander.searching');
        try {
          const list = await searchCommanders(q, { signal: controller.signal });
          clear(results);
          status.textContent = list.length
            ? tn(list.length, 'commander.result', 'commander.results')
            : t('commander.noResults');
          list.forEach((c) => results.append(resultRow(c, choose)));
        } catch (err) {
          if (err.name === 'AbortError') return;
          clear(results);
          status.textContent = t('commander.searchFailed');
          store.recentCommanders(12).forEach((c) => results.append(resultRow(c, choose)));
        }
        api.remeasure();
      };

      input.addEventListener('input', () => {
        const q = input.value.trim();
        clearTimeout(debounce);
        if (q.length < 2) { showSaved(); return; }
        debounce = setTimeout(() => run(q), 280);
      });

      pane.append(input, status, results);
      showSaved();
    },
  };
}

function resultRow(commander, choose) {
  return el('button', {
    class: 'result-row',
    style: { '--accent': accentOf(commander.colors) },
    onClick: () => choose(commander),
  }, [
    el('span', {
      class: 'result-art',
      style: commander.thumb ? { backgroundImage: 'url(' + commander.thumb + ')' } : {},
    }),
    el('span', { class: 'result-text' }, [
      el('span', { class: 'result-name', text: commander.name }),
      el('span', { class: 'result-type', text: commander.typeLine }),
    ]),
    el('span', { class: 'result-pips', text: pips(commander.colors) }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Antes de comecar                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ultima parada antes da mesa: quem abre a partida e, quando ha mais de um
 * arranjo possivel, como a mesa fica disposta.
 *
 * "Sortear" e o padrao porque e assim que a mesa decide de verdade - e o
 * sorteio acontece no Comecar, nao aqui, para dar um resultado novo a cada vez.
 */
function openPreGame(d, onStart) {
  if (!d.seats.every((s) => s.commanders.length)) return;

  const variantes = variantsFor(d.seats.length);
  let quemComeca = 'sorteio';
  let layoutId = layoutFor(d.seats.length, d.layoutId).id;

  openSheet({
    title: t('pregame.title'),
    subtitle: t('pregame.sub', { n: d.seats.length, life: d.startingLife }),
    build: (pane, close) => {
      pane.append(el('p', { class: 'sheet-legend', text: t('pregame.whoStarts') }));
      const quemLista = el('div', { class: 'result-list' });

      const pintarQuem = () => {
        clear(quemLista);
        const opcoes = [
          { id: 'sorteio', nome: t('pregame.random'), sub: t('pregame.randomSub'), dado: true },
          ...d.seats.map((s) => ({
            id: s.id,
            nome: s.name,
            sub: deckNameOf(s.commanders),
            accent: accentOf(s.commanders[0] ? s.commanders[0].colors : []),
          })),
        ];
        opcoes.forEach((o) => {
          quemLista.append(el('button', {
            class: 'pick-row' + (quemComeca === o.id ? ' is-on' : ''),
            style: o.accent ? { '--accent': o.accent } : {},
            onClick: () => { quemComeca = o.id; pintarQuem(); buzz(); },
          }, [
            o.dado
              ? el('span', { class: 'pick-dice' }, [icon('dice')])
              : el('span', { class: 'player-avatar', text: o.nome.slice(0, 1).toUpperCase() }),
            el('span', { class: 'player-text' }, [
              el('span', { class: 'player-name', text: o.nome }),
              el('span', { class: 'player-sub', text: o.sub }),
            ]),
            el('span', { class: 'pick-mark' }),
          ]));
        });
      };
      pintarQuem();
      pane.append(quemLista);

      // A escolha de arranjo só existe onde há mais de um jeito de sentar.
      if (variantes.length > 1) {
        pane.append(el('p', { class: 'sheet-legend', text: t('pregame.layout') }));
        const grid = el('div', { class: 'layout-picker' });
        const pintarLayout = () => {
          clear(grid);
          variantes.forEach((v) => {
            grid.append(el('button', {
              class: 'layout-option' + (layoutId === v.id ? ' is-on' : ''),
              onClick: () => { layoutId = v.id; pintarLayout(); buzz(); },
            }, [
              layoutPreview(v),
              el('span', { class: 'layout-label', text: t(v.labelKey) }),
            ]));
          });
        };
        pintarLayout();
        pane.append(grid);
      }

      pane.append(el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', onClick: close }, [t('common.back')]),
        el('button', {
          class: 'btn primary',
          onClick: () => {
            const sorteado = quemComeca === 'sorteio'
              ? d.seats[Math.floor(Math.random() * d.seats.length)]
              : d.seats.find((s) => s.id === quemComeca);

            d.layoutId = layoutId;
            d.firstSeatId = sorteado.id;
            d.seats.forEach((s) => {
              store.rememberPlayer(s.name);
              s.commanders.forEach(store.rememberCommander);
            });
            store.setSetting('startingLife', d.startingLife);

            close();
            onStart(d);
            toast(t('pregame.startsToast', { name: sorteado.name }));
          },
        }, [t('common.start')]),
      ]));
    },
  });
}

/**
 * Onde este jogador vai sentar.
 *
 * A ordem da lista ja diz a ordem dos turnos, mas nao diz o LUGAR - e com 5 ou
 * 6 pessoas, "terceiro da lista" nao ajuda ninguem a se achar em volta da mesa.
 * A miniatura mostra a cadeira acesa no arranjo real que vai ser usado.
 */
function seatSpot(index) {
  const d = ensureDraft();
  const layout = layoutFor(d.seats.length, d.layoutId);
  const spec = layout.seats[index];
  if (!spec) return null;

  return el('div', {
    class: 'seat-spot',
    'aria-hidden': 'true',
    style: {
      gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)',
      gridTemplateRows: 'repeat(' + layout.rows + ', 1fr)',
    },
  }, layout.seats.map((s, i) => el('span', {
    class: 'layout-cell' + (i === index ? ' is-here' : ''),
    style: {
      gridRow: String(s.r),
      gridColumn: s.cs ? s.c + ' / span ' + s.cs : String(s.c),
    },
    text: i === index ? String(i + 1) : '',
  })));
}

/** Miniatura da mesa, com o número mostrando a ordem dos turnos. */
function layoutPreview(layout) {
  // A previa assume a proporcao do APARELHO, nao so a da grade.
  //
  // Com dois jogadores as duas opcoes tem a mesma grade - uma pilha de dois -,
  // e sem isto elas ficariam identicas na tela, parecendo defeito. O que muda
  // de verdade e o formato do aparelho na mesa, entao e o formato que a
  // miniatura precisa mostrar.
  const forma = layout.orient === 'landscape' ? ' is-land'
    : layout.orient === 'portrait' ? ' is-port' : '';
  return el('div', {
    class: 'layout-mini' + forma,
    style: {
      gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)',
      gridTemplateRows: 'repeat(' + layout.rows + ', 1fr)',
    },
  }, layout.seats.map((s, i) => el('span', {
    class: 'layout-cell' + (s.rot ? ' is-flipped' : ''),
    style: {
      gridRow: String(s.r),
      gridColumn: s.cs ? s.c + ' / span ' + s.cs : String(s.c),
    },
    text: String(i + 1),
  })));
}

/* ------------------------------------------------------------------ */
/* Configuracoes                                                       */
/* ------------------------------------------------------------------ */

/**
 * Preferencias do aplicativo - o que vale para todas as partidas. Ajuste de
 * vida inicial e da mesa fica na home mesmo, porque muda a cada jogo.
 */
function openSettings(onRefresh) {
  const s = store.getDB().settings;

  openSheet({
    title: t('settings.title'),
    subtitle: t('settings.sub'),
    build: (pane) => {
      if (cloudEnabled()) {
        pane.append(el('p', { class: 'sheet-legend', text: t('account.title') }));
        pane.append(accountBlock(onRefresh));
      }

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.language') }));

      /*
       * Dropdown, e nao quatro chips: "Português / English / Español / Deutsch"
       * nao cabe numa linha de celular, e quebrar em duas fileiras dava um
       * bloco desalinhado. O <select> nativo ainda abre o seletor do proprio
       * sistema, que e o controle que a pessoa ja conhece.
       */
      pane.append(selectRow(currentLang(), LANGS, (codigo) => {
        store.setSetting('lang', codigo);
        setLang(codigo);
        buzz(12);

        // Cada texto foi lido na hora de desenhar, entao os dois precisam ser
        // refeitos: a home por baixo, e este painel - que continuaria em
        // portugues ate ser fechado na mao.
        if (onRefresh) onRefresh();
        openSettings(onRefresh);
      }));

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.theme') }));

      const temaLinha = el('div', { class: 'chips chips-fill' });
      const pintarTema = () => {
        clear(temaLinha);
        MODES.forEach(([id, chave]) => {
          temaLinha.append(el('button', {
            class: 'chip' + (currentMode() === id ? ' is-on' : ''),
            onClick: () => {
              store.setSetting('theme', id);
              applyTheme(id);
              pintarTema();
              buzz();
              // A paleta WUBRG mudou: o resto da tela precisa ser redesenhado.
              if (onRefresh) onRefresh();
            },
          }, [t(chave)]));
        });
      };
      pintarTema();
      pane.append(temaLinha);

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.onTable') }));
      pane.append(
        toggleRow(t('settings.haptics'), t('settings.hapticsSub'), s.haptics, (v) => {
          store.setSetting('haptics', v);
          setHaptics(v);
        }),
        toggleRow(t('settings.keepAwake'), t('settings.keepAwakeSub'), s.keepAwake, (v) => {
          store.setSetting('keepAwake', v);
        }),
        toggleRow(
          t('settings.autoRotate'),
          t('settings.autoRotateSub'),
          s.autoRotate,
          (v) => store.setSetting('autoRotate', v),
        ),
      );

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.install') }));
      pane.append(installBlock(onRefresh));

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.help') }));
      pane.append(el('div', { class: 'menu' }, [
        el('button', {
          class: 'menu-item',
          onClick: () => {
            store.setSetting('dragHintSeen', false);
            toast(t('settings.hintBack'));
          },
        }, [
          el('span', { class: 'menu-label', text: t('settings.showHint') }),
          el('span', { class: 'menu-sub', text: t('settings.showHintSub') }),
        ]),
      ]));

      pane.append(el('p', {
        class: 'settings-note',
        text: t('settings.dataNote'),
      }));
    },
  });
}

/**
 * Campo de escolha unica, com o seletor nativo do sistema.
 *
 * Para tres ou quatro opcoes de texto longo, chips lado a lado nao cabem no
 * celular. O <select> resolve o espaco e, de quebra, entrega o seletor que o
 * aparelho ja usa em todo lugar.
 */
function selectRow(valor, opcoes, onChange) {
  const campo = el('select', { class: 'select-input', 'aria-label': t('settings.language') },
    opcoes.map(([v, rotulo]) => el('option', { value: v, text: rotulo })));

  campo.value = valor;
  campo.addEventListener('change', () => onChange(campo.value));

  return el('div', { class: 'select-row' }, [campo, el('span', { class: 'select-caret' }, [icon('arrow')])]);
}

/** Linha com interruptor. O estado vive no proprio botao. */
function toggleRow(label, sub, initial, onChange) {
  let value = initial !== false;
  const knob = el('span', { class: 'switch' + (value ? ' is-on' : '') });

  return el('button', {
    class: 'toggle-row',
    'aria-pressed': String(value),
    onClick: (e) => {
      value = !value;
      knob.classList.toggle('is-on', value);
      e.currentTarget.setAttribute('aria-pressed', String(value));
      onChange(value);
      buzz();
    },
  }, [
    el('span', { class: 'toggle-text' }, [
      el('span', { class: 'toggle-label', text: label }),
      sub ? el('span', { class: 'toggle-sub', text: sub }) : null,
    ]),
    knob,
  ]);
}

/**
 * Bloco de instalacao. Cada situacao ganha uma resposta util - esconder a opcao
 * quando ela nao esta disponivel so deixaria a pessoa procurando.
 */
function installBlock(onRefresh) {
  const box = el('div', { class: 'menu' });

  const paint = () => {
    clear(box);
    const { mode } = installState();

    if (mode === 'instalado') {
      box.append(el('div', { class: 'install-note is-done' }, [
        el('span', { class: 'menu-label', text: t('settings.installed') }),
        el('span', { class: 'menu-sub', text: t('settings.installedSub') }),
      ]));
      return;
    }

    if (mode === 'pronto') {
      box.append(el('button', {
        class: 'menu-item install-cta',
        onClick: async () => {
          const r = await promptInstall();
          if (r === 'accepted') toast(t('settings.installDone'));
          paint();
          if (onRefresh) onRefresh();
        },
      }, [
        el('span', { class: 'menu-label' }, [icon('download'), t('settings.installNow')]),
        el('span', { class: 'menu-sub', text: t('settings.installNowSub') }),
      ]));
      return;
    }

    if (mode === 'ios') {
      box.append(el('div', { class: 'install-note' }, [
        el('span', { class: 'menu-label' }, [icon('share'), t('settings.installIOS')]),
        el('span', { class: 'menu-sub', text: t('settings.installIOSSub') }),
      ]));
      return;
    }

    box.append(el('div', { class: 'install-note' }, [
      el('span', { class: 'menu-label', text: t('settings.installNo') }),
      el('span', {
        class: 'menu-sub',
        text: mode === 'inseguro' ? t('settings.installInsecure') : t('settings.installUnsupported'),
      }),
    ]));
  };

  paint();
  onInstallChange(paint); // o convite pode chegar depois da tela já aberta
  return box;
}

/* ------------------------------------------------------------------ */
/* Conta                                                               */
/* ------------------------------------------------------------------ */

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
}

/**
 * Conta e assinatura.
 *
 * Redesenha sozinho quando o estado muda - entrar, sair, assinatura carregada -
 * porque o login por link magico volta de FORA do app: a pessoa sai para o
 * e-mail e retorna pela URL, e a tela precisa refletir isso sem recarregar.
 */
function accountBlock(onRefresh) {
  const caixa = el('div', { class: 'account' });

  const pintar = () => {
    clear(caixa);
    const estado = cloud.state();

    if (estado === 'deslogado') {
      caixa.append(loginBlock(pintar, onRefresh));
      return;
    }

    const usuario = cloud.currentUser();
    caixa.append(el('div', { class: 'account-row' }, [
      el('span', {
        class: 'account-email',
        text: t('account.signedInAs', { email: (usuario && usuario.email) || '' }),
      }),
      el('button', {
        class: 'account-out',
        onClick: async () => { await cloud.sair(); pintar(); if (onRefresh) onRefresh(); },
      }, [t('account.signOut')]),
    ]));

    caixa.append(senhaBlock());
    caixa.append(handleBlock());
    caixa.append(invitesBlock());

    const assinatura = cloud.subscription();
    if (estado === 'assinante') {
      caixa.append(el('div', { class: 'account-sub is-on' }, [
        el('span', { class: 'menu-label', text: t('account.subActive') }),
        assinatura && assinatura.current_period_end
          ? el('span', {
            class: 'menu-sub',
            text: t('account.subUntil', { date: formatDate(assinatura.current_period_end) }),
          })
          : null,
      ]));
    } else {
      caixa.append(el('div', { class: 'account-sub' }, [
        el('span', { class: 'menu-label', text: t('account.subInactive') }),
        el('span', { class: 'menu-sub', text: t('paywall.body') }),
      ]));
      caixa.append(el('button', {
        class: 'btn primary block',
        onClick: () => {
          if (!CHECKOUT_URL) { toast(t('account.subSoon')); return; }
          location.assign(CHECKOUT_URL);
        },
      }, [t('account.subscribe')]));
    }
  };

  pintar();
  cloud.onAccountChange(pintar);
  return caixa;
}


/* ------------------------------------------------------------------ */
/* Vinculo com uma conta                                               */
/* ------------------------------------------------------------------ */

/** Atalhos sobre o rascunho; a regra em si mora no motor. */
function nomeNaMesa(seat, nome) {
  return pessoaRepetida(ensureDraft().seats, seat, { name: nome }) === 'nome';
}

function contaNaMesa(seat, handle) {
  return pessoaRepetida(ensureDraft().seats, seat, { handle }) === 'conta';
}

/** So faz sentido oferecer vinculo para quem esta numa conta. */
function podeVincular() {
  return cloudEnabled() && cloud.state() !== 'deslogado';
}

/**
 * O @ logo abaixo do nome, na mesma coluna do deck.
 *
 * Antes era um chip solto no canto do cartao: ficava longe do nome a que se
 * referia e disputava espaco com a alca de arrastar. Aqui ele le como o que e -
 * uma segunda linha do jogador, do lado do deck que tambem descreve a cadeira.
 */
function handleLine(seat, refresh) {
  if (!podeVincular()) return null;

  const vinculado = handleValido(seat.handle);
  return el('button', {
    class: 'seat-handle' + (vinculado ? ' is-on' : ''),
    'aria-label': vinculado ? exibirHandle(seat.handle) : t('handle.link'),
    onClick: () => openFlow(buscaHandleStep(seat, refresh, {
      adotarNome: false,
      aoFim: 'fechar',
    })),
  }, [vinculado ? exibirHandle(seat.handle) : t('handle.link')]);
}

/**
 * Procura a conta pelo @ e prende a cadeira nela.
 *
 * A busca e por igualdade exata, do lado do servidor. Nao existe lista nem
 * sugestao por prefixo: da para confirmar um @ que voce ja conhece, nunca para
 * descobrir quem tem conta no app.
 *
 * Serve aos dois caminhos, porque sao a mesma tela com dois destinos:
 *
 *   adotarNome  a pessoa esta ESCOLHENDO quem senta aqui, entao o nome da
 *               cadeira passa a ser o nome da conta encontrada;
 *   aoFim       'deck' segue para o comandante (veio do fluxo de montar a
 *               mesa), 'fechar' so fecha (veio do cartao, para editar).
 */
function buscaHandleStep(seat, refresh, { adotarNome = false, aoFim = 'fechar' } = {}) {
  return {
    title: adotarNome ? t('player.findUser') : t('handle.title'),
    subtitle: adotarNome ? t('player.findUserSub') : t('handle.sub', { name: seat.name }),
    build: (pane, api) => {
      const achado = el('div', { class: 'handle-result' });

      const adiante = () => {
        if (aoFim === 'deck') api.next(commanderStep(seat, 0, refresh));
        else closeSheet();
      };

      const soltar = () => {
        seat.handle = '';
        seat.userId = null;
        store.rememberHandle(seat.name, '');
        refresh();
        adiante();
      };

      const prender = (perfilAchado) => {
        if (contaNaMesa(seat, perfilAchado.handle)) {
          clear(achado);
          achado.append(el('p', { class: 'account-erro is-on', text: t('handle.accountTaken') }));
          return;
        }
        if (adotarNome) {
          // O nome da conta e o que o resto da mesa reconhece. Sem isto a
          // cadeira ficaria com "Jogador 2" enquanto a estatistica registra
          // outra pessoa - dois nomes para a mesma cadeira.
          const nome = (perfilAchado.display_name || perfilAchado.handle).slice(0, 18);
          seat.name = nome;
          store.rememberPlayer(nome);
        }
        seat.handle = perfilAchado.handle;
        seat.userId = perfilAchado.id;
        store.rememberHandle(seat.name, perfilAchado.handle);
        buzz(12);
        refresh();
        adiante();
      };

      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        value: !adotarNome && seat.handle ? exibirHandle(seat.handle) : '',
        'aria-label': t('handle.title'),
      });

      const procurar = async () => {
        const bruto = input.value;
        clear(achado);
        if (!handleValido(bruto)) {
          achado.append(el('p', { class: 'account-note', text: t('handle.invalid') }));
          return;
        }
        achado.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const perfilAchado = await cloud.buscarHandle(bruto);
          clear(achado);
          if (!perfilAchado) {
            achado.append(el('p', {
              class: 'account-note',
              text: t('handle.notFound', { handle: exibirHandle(bruto) }),
            }));
            return;
          }
          achado.append(el('div', { class: 'handle-found' }, [
            el('span', { class: 'menu-label', text: exibirHandle(perfilAchado.handle) }),
            perfilAchado.display_name
              ? el('span', { class: 'menu-sub', text: perfilAchado.display_name })
              : null,
          ]));
          achado.append(el('button', {
            class: 'btn primary block',
            onClick: () => prender(perfilAchado),
          }, [t('handle.use')]));
        } catch {
          clear(achado);
          achado.append(el('p', { class: 'account-note', text: t('account.failed') }));
        }
      };

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') procurar(); });

      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', { class: 'btn primary', onClick: procurar }, [t('handle.search')]),
      ]));
      pane.append(achado);
      pane.append(el('p', { class: 'account-note', text: t('handle.why') }));

      if (!adotarNome && handleValido(seat.handle)) {
        pane.append(el('button', { class: 'btn ghost block', onClick: soltar },
          [t('handle.unlink')]));
      }
    },
  };
}

/**
 * O proprio @: como amigos marcam voce na mesa deles.
 *
 * Quem nao escolher um @ continua usando o app inteiro normalmente - so nao
 * pode ser convidado. E opcional de proposito.
 */
function handleBlock() {
  const caixa = el('div', { class: 'account-handle' });
  const perfil = cloud.meuPerfil();

  caixa.append(el('p', { class: 'sheet-legend', text: t('account.yourHandle') }));

  if (perfil && perfil.handle) {
    // Ja criado: nao e um campo de texto.
    //
    // O @ e por onde os amigos marcam a pessoa na mesa deles. Deixar isso como
    // um input com botao de salvar convida a trocar sem querer - e trocar de @
    // quebra a marcacao que os outros ja tinham guardado. Trocar continua
    // possivel, mas por uma porta separada, que confere se o nome esta livre
    // antes de deixar salvar.
    caixa.append(el('div', { class: 'account-row' }, [
      el('span', { class: 'account-handle-fixo', text: exibirHandle(perfil.handle) }),
      el('button', {
        class: 'account-out',
        onClick: () => openFlow(trocarHandleStep()),
      }, [t('account.handleChange')]),
    ]));
    caixa.append(el('p', { class: 'account-note', text: t('account.handleLocked') }));
    return caixa;
  }

  caixa.append(el('button', {
    class: 'btn primary block',
    onClick: () => openFlow(trocarHandleStep()),
  }, [t('account.handleCreate')]));
  caixa.append(el('p', { class: 'account-note', text: t('account.handleHint') }));
  return caixa;
}

/**
 * Escolher ou trocar o proprio @, conferindo antes se esta livre.
 *
 * A conferencia e uma consulta, nao uma reserva: entre a resposta e o
 * salvamento alguem pode pegar o mesmo nome. Quem decide de verdade e o indice
 * unico do banco. O valor disto e nao deixar a pessoa digitar, confirmar e so
 * entao descobrir que o nome era de outro.
 */
function trocarHandleStep() {
  const perfil = cloud.meuPerfil();
  return {
    title: perfil && perfil.handle ? t('handle.changeTitle') : t('handle.chooseTitle'),
    subtitle: t('account.handleHint'),
    build: (pane) => {
      const recado = el('div', { class: 'handle-result' });
      let livre = null;   // o @ conferido e aprovado, se houver

      const usar = el('button', { class: 'btn primary block' }, [t('handle.useThis')]);
      usar.disabled = true;

      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        'aria-label': t('account.yourHandle'),
      });

      // Qualquer letra nova invalida a conferencia anterior: sem isto daria
      // para conferir um nome livre, digitar outro e salvar o segundo sem
      // nunca ter perguntado nada sobre ele.
      input.addEventListener('input', () => {
        livre = null;
        usar.disabled = true;
        clear(recado);
      });

      const conferir = async () => {
        clear(recado);
        livre = null;
        usar.disabled = true;
        const bruto = normalizarHandle(input.value);
        if (!handleValido(bruto)) {
          recado.append(el('p', { class: 'account-note', text: t('handle.invalid') }));
          return;
        }
        recado.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const ok = await cloud.handleDisponivel(bruto);
          clear(recado);
          recado.append(el('p', {
            class: ok ? 'account-sent' : 'account-note',
            text: ok
              ? t('handle.free', { handle: exibirHandle(bruto) })
              : t('handle.taken', { handle: exibirHandle(bruto) }),
          }));
          if (ok) { livre = bruto; usar.disabled = false; }
        } catch {
          clear(recado);
          recado.append(el('p', { class: 'account-note', text: t('account.failed') }));
        }
      };

      usar.addEventListener('click', async () => {
        if (!livre) return;
        usar.disabled = true;
        try {
          const novo = await cloud.salvarHandle(livre, null);
          toast(t('account.handleSaved', { handle: exibirHandle(novo.handle) }));
          closeSheet();
        } catch (err) {
          usar.disabled = false;
          // O 409 do banco e a unica resposta confiavel: alguem pode ter pegado
          // o nome entre a conferencia e o salvamento.
          toast(String(err && err.message) === 'handle ocupado'
            ? t('account.handleTaken')
            : t('account.failed'));
        }
      });

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') conferir(); });

      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', { class: 'btn primary', onClick: conferir }, [t('handle.check')]),
      ]));
      pane.append(recado);
      pane.append(usar);
      pane.append(el('p', { class: 'account-note', text: t('account.handleWarn') }));
    },
  };
}

/**
 * Convites: partidas que alguem registrou dizendo que voce estava na mesa.
 *
 * Aparece SEM assinatura, de proposito - e o portao funcionando, nao um furo.
 * Quem nao assina precisa poder ver que ha partidas esperando, senao nunca
 * aceita e nunca soube que existiam. O convite e livre; o conteudo e que e
 * pago, e "3 partidas esperando por voce" e o melhor argumento que o app tem.
 */
function invitesBlock() {
  const caixa = el('div', { class: 'account-invites' });

  const pintar = async () => {
    clear(caixa);
    let convites = [];
    try {
      convites = await cloud.convitesPendentes();
    } catch {
      return; // sem rede: a secao simplesmente nao aparece
    }
    if (!convites.length) return;

    caixa.append(el('p', { class: 'sheet-legend', text: t('invites.title') }));
    caixa.append(el('p', {
      class: 'account-note',
      text: convites.length === 1
        ? t('invites.one')
        : t('invites.many', { n: convites.length }),
    }));

    for (const convite of convites) caixa.append(inviteRow(convite, pintar));
  };

  pintar();
  return caixa;
}

function inviteRow(convite, recarregar) {
  const linha = el('div', { class: 'invite' });
  const quem = el('span', { class: 'menu-sub', text: t('invites.locked') });

  // Quem convidou so o servidor sabe dizer sem entregar a partida inteira.
  cloud.anfitriaoDoConvite(convite.match_id).then((anfitriao) => {
    if (!anfitriao) return;
    quem.textContent = exibirHandle(anfitriao.handle)
      + (anfitriao.display_name ? ' - ' + anfitriao.display_name : '');
    confiar.hidden = false;
    confiar.dataset.host = anfitriao.id;
  }).catch(() => {});

  const responder = async (aceitar) => {
    try {
      await cloud.responderConvite(convite.match_id, convite.seat_id, aceitar);
      buzz(12);
      recarregar();
    } catch {
      toast(t('account.failed'));
    }
  };

  const confiar = el('button', { class: 'btn ghost block' }, [t('invites.trust')]);
  confiar.hidden = true;
  confiar.addEventListener('click', async () => {
    try {
      await cloud.confiarEm(confiar.dataset.host);
      await responder(true);
    } catch {
      toast(t('account.failed'));
    }
  });

  linha.append(el('div', { class: 'invite-who' }, [
    el('span', {
      class: 'menu-label',
      text: t('invites.seat', { handle: exibirHandle(convite.handle) }),
    }),
    quem,
  ]));
  linha.append(el('div', { class: 'invite-acts' }, [
    el('button', { class: 'btn primary', onClick: () => responder(true) },
      [t('invites.accept')]),
    el('button', { class: 'btn ghost', onClick: () => responder(false) },
      [t('invites.decline')]),
  ]));
  linha.append(confiar);
  return linha;
}


/* ------------------------------------------------------------------ */
/* Entrar                                                              */
/* ------------------------------------------------------------------ */

/**
 * Traduz o que o servidor reclamou.
 *
 * "servidor respondeu 400" nao ajuda ninguem a entrar. Os codigos que importam
 * sao poucos e cada um tem uma saida diferente: senha errada se corrige
 * digitando de novo, conta existente se corrige entrando em vez de criar.
 */
function motivoDoErro(err) {
  const c = String((err && err.codigo) || '');
  const m = String((err && err.message) || '').toLowerCase();
  if (c === 'invalid_credentials' || m.includes('invalid login')) return t('account.wrongCredentials');
  if (c === 'user_already_exists' || m.includes('already registered')) return t('account.accountExists');
  if (c === 'weak_password' || m.includes('password')) return t('account.passwordShort');
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return t('account.notConfirmed');
  return t('account.failed');
}

/**
 * Entrar com e-mail e senha.
 *
 * O link por e-mail continua ali embaixo, e continua sendo importante: e o
 * caminho de quem esqueceu a senha e o unico que nao exige lembrar de nada. So
 * deixou de ser o caminho de todo dia - abrir a caixa de entrada para entrar no
 * proprio aparelho e atrito demais, e num aparelho emprestado, pior ainda.
 */
function loginBlock(repintar, onRefresh) {
  const caixa = el('div', { class: 'account-login' });

  const email = el('input', {
    class: 'search-input',
    type: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    placeholder: t('account.emailLabel'),
    'aria-label': t('account.emailLabel'),
  });
  const senha = el('input', {
    class: 'search-input',
    type: 'password',
    autocomplete: 'current-password',
    placeholder: t('account.password'),
    'aria-label': t('account.password'),
  });

  // O erro de login precisa ser visto.
  //
  // Antes era um parágrafo cinza depois dos dois botões: quem errava a senha
  // apertava "Entrar", nada visível acontecia, e a explicação ficava fora do
  // campo de visão. `role="alert"` faz o leitor de tela anunciar, e o lugar
  // dele agora é logo abaixo dos campos que precisam ser corrigidos.
  const recado = el('p', { class: 'account-erro', role: 'alert' });
  const limparRecado = () => { recado.textContent = ''; recado.classList.remove('is-on'); };
  const erro = (texto) => {
    recado.textContent = texto;
    recado.classList.add('is-on');
    toast(texto);
  };
  const entrar = el('button', { class: 'btn primary block' }, [t('account.signIn')]);
  const criar = el('button', { class: 'btn ghost block' }, [t('account.createAccount')]);

  const ocupado = (ligado, botao, rotulo) => {
    entrar.disabled = ligado;
    criar.disabled = ligado;
    botao.textContent = ligado ? t('account.sending') : rotulo;
  };

  const pronto = () => {
    if (onRefresh) onRefresh();
    repintar();
  };

  entrar.addEventListener('click', async () => {
    limparRecado();
    if (!emailValido(email.value)) { erro(t('account.invalidEmail')); return; }
    ocupado(true, entrar, t('account.signIn'));
    try {
      await cloud.entrarComSenha(email.value, senha.value);
      buzz(12);
      pronto();
    } catch (err) {
      ocupado(false, entrar, t('account.signIn'));
      erro(motivoDoErro(err));
    }
  });

  criar.addEventListener('click', async () => {
    limparRecado();
    if (!emailValido(email.value)) { erro(t('account.invalidEmail')); return; }
    if (!cloud.senhaValida(senha.value)) {
      erro(t('account.passwordShort'));
      return;
    }
    ocupado(true, criar, t('account.createAccount'));
    try {
      const r = await cloud.criarConta(email.value, senha.value);
      // Com confirmacao de e-mail ligada o servidor nao devolve sessao. Dizer
      // "entrou" ali seria mentira, e a pessoa ficaria esperando algo acontecer.
      if (r.entrou) { buzz(12); pronto(); return; }
      clear(caixa);
      caixa.append(
        el('p', { class: 'account-sent', text: t('account.confirmEmail', { email: email.value.trim() }) }),
        el('p', { class: 'account-note', text: t('account.linkSentHint') }),
      );
    } catch (err) {
      ocupado(false, criar, t('account.createAccount'));
      erro(motivoDoErro(err));
    }
  });

  // Mexer num campo apaga o erro: ele fala do que estava ali antes.
  email.addEventListener('input', limparRecado);
  senha.addEventListener('input', limparRecado);

  caixa.append(email, senha, recado, entrar, criar);

  if (cloud.provedores().includes('google')) {
    caixa.append(el('button', {
      class: 'btn ghost block',
      onClick: () => cloud.entrarCom('google'),
    }, [t('account.withGoogle')]));
  }

  // O link por e-mail: discreto, sempre disponivel, sem exigir senha nenhuma.
  caixa.append(el('button', {
    class: 'account-link',
    onClick: async () => {
      if (!emailValido(email.value)) { erro(t('account.invalidEmail')); return; }
      limparRecado();
      try {
        await cloud.enviarLink(email.value);
        clear(caixa);
        caixa.append(
          el('p', { class: 'account-sent', text: t('account.linkSent', { email: email.value.trim() }) }),
          el('p', { class: 'account-note', text: t('account.linkSentHint') }),
        );
      } catch {
        erro(t('account.failed'));
      }
    },
  }, [t('account.orMagicLink')]));

  caixa.append(el('p', { class: 'account-note', text: t('account.why') }));
  return caixa;
}

/**
 * Definir senha depois de ja estar dentro.
 *
 * E o passo que fecha o problema para quem entrou por link magico: uma senha,
 * uma vez, e nunca mais e-mail em aparelho nenhum.
 */
function senhaBlock() {
  const caixa = el('div', { class: 'account-senha' });
  caixa.append(el('p', { class: 'sheet-legend', text: t('account.password') }));

  // Ja tem senha: trocar passa pelo e-mail.
  //
  // Definir a PRIMEIRA senha estando logado e seguro - quem esta dentro ja
  // provou ser o dono. Trocar e outra coisa: um contador de vida de mesa vive
  // emprestado, e quem pegasse o aparelho destravado poderia trocar a senha e
  // tomar a conta. O e-mail e o que prova que o pedido e do dono.
  if (cloud.temSenha()) {
    const usuario = cloud.currentUser();
    const email = (usuario && usuario.email) || '';
    const trocar = el('button', { class: 'btn ghost block' }, [t('account.changePassword')]);

    trocar.addEventListener('click', async () => {
      trocar.disabled = true;
      trocar.textContent = t('account.sending');
      try {
        await cloud.pedirTrocaDeSenha(email);
        clear(caixa);
        caixa.append(
          el('p', { class: 'sheet-legend', text: t('account.password') }),
          el('p', { class: 'account-sent', text: t('account.recoverSent', { email }) }),
          el('p', { class: 'account-note', text: t('account.linkSentHint') }),
        );
      } catch {
        trocar.disabled = false;
        trocar.textContent = t('account.changePassword');
        toast(t('account.failed'));
      }
    });

    caixa.append(trocar);
    caixa.append(el('p', { class: 'account-note', text: t('account.changePasswordHint') }));
    return caixa;
  }

  const campo = el('input', {
    class: 'search-input',
    type: 'password',
    autocomplete: 'new-password',
    placeholder: t('account.newPassword'),
    'aria-label': t('account.newPassword'),
  });
  const salvar = el('button', { class: 'btn primary' }, [t('account.setPassword')]);

  salvar.addEventListener('click', async () => {
    if (!cloud.senhaValida(campo.value)) { toast(t('account.passwordShort')); return; }
    salvar.disabled = true;
    try {
      await cloud.definirSenha(campo.value);
      campo.value = '';
      toast(t('account.passwordSaved'));
      // A secao inteira muda de forma: daqui em diante so existe trocar.
      const nova = senhaBlock();
      if (caixa.parentElement) caixa.parentElement.replaceChild(nova, caixa);
    } catch {
      toast(t('account.failed'));
    } finally {
      salvar.disabled = false;
    }
  });

  caixa.append(el('div', { class: 'name-row' }, [campo, salvar]));
  caixa.append(el('p', { class: 'account-note', text: t('account.setPasswordHint') }));
  return caixa;
}
