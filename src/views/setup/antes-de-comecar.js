/**
 * Ultima parada antes da mesa: quem abre a partida e como a mesa fica disposta.
 *
 * "Sortear" e o padrao porque e assim que a mesa decide de verdade - e o
 * sorteio acontece no Comecar, nao aqui, para dar um resultado novo a cada vez.
 *
 * A miniatura existe porque a ordem da lista diz a ordem dos turnos, mas nao
 * diz o LUGAR - e com 5 ou 6 pessoas "terceiro da lista" nao ajuda ninguem a se
 * achar em volta da mesa.
 */

import { el, clear, icon, openSheet, buzz, toast } from '../../ui.js';
import { accentOf } from '../../colors.js';
import * as store from '../../store.js';
import { deckNameOf } from '../../engine.js';
import { variantsFor, layoutFor } from '../../seating.js';
import { t } from '../../i18n.js';
import { ensureDraft } from './rascunho.js';

/**
 * Ultima parada antes da mesa: quem abre a partida e, quando ha mais de um
 * arranjo possivel, como a mesa fica disposta.
 *
 * "Sortear" e o padrao porque e assim que a mesa decide de verdade - e o
 * sorteio acontece no Comecar, nao aqui, para dar um resultado novo a cada vez.
 */
export function openPreGame(d, onStart) {
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
export function seatSpot(index) {
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
