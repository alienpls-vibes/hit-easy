/**
 * The last stop before the table: who opens the match and, when there is more
 * than one possible arrangement, how the table is laid out.
 *
 * "Random" is the default because that is how the table really decides - and
 * the draw happens on Start, not here, to give a new result every time.
 *
 * The thumbnail exists because the order of the list says the turn order, but
 * not the PLACE - and with 5 or 6 people "third on the list" helps nobody find
 * themselves around the table.
 */

import { el, clear, icon, openSheet, buzz, toast } from '../../ui.js';
import { accentOf } from '../../colors.js';
import * as store from '../../store.js';
import { deckNameOf } from '../../engine.js';
import { variantsFor, layoutFor } from '../../seating.js';
import { t } from '../../i18n.js';
import { ensureDraft } from './draft.js';

export function openPreGame(d, onStart) {
  if (!d.seats.every((s) => s.commanders.length)) return;

  const variants = variantsFor(d.seats.length);
  let whoStarts = 'random';
  let layoutId = layoutFor(d.seats.length, d.layoutId).id;

  openSheet({
    title: t('pregame.title'),
    subtitle: t('pregame.sub', { n: d.seats.length, life: d.startingLife }),
    build: (pane, close) => {
      pane.append(el('p', { class: 'sheet-legend', text: t('pregame.whoStarts') }));
      const whoList = el('div', { class: 'result-list' });

      const paintWho = () => {
        clear(whoList);
        const options = [
          { id: 'random', name: t('pregame.random'), sub: t('pregame.randomSub'), dice: true },
          ...d.seats.map((s) => ({
            id: s.id,
            name: s.name,
            sub: deckNameOf(s.commanders),
            accent: accentOf(s.commanders[0] ? s.commanders[0].colors : []),
          })),
        ];
        options.forEach((o) => {
          whoList.append(el('button', {
            class: 'pick-row' + (whoStarts === o.id ? ' is-on' : ''),
            style: o.accent ? { '--accent': o.accent } : {},
            onClick: () => { whoStarts = o.id; paintWho(); buzz(); },
          }, [
            o.dice
              ? el('span', { class: 'pick-dice' }, [icon('dice')])
              : el('span', { class: 'player-avatar', text: o.name.slice(0, 1).toUpperCase() }),
            el('span', { class: 'player-text' }, [
              el('span', { class: 'player-name', text: o.name }),
              el('span', { class: 'player-sub', text: o.sub }),
            ]),
            el('span', { class: 'pick-mark' }),
          ]));
        });
      };
      paintWho();
      pane.append(whoList);

      // The arrangement choice only exists where there is more than one way to sit.
      if (variants.length > 1) {
        pane.append(el('p', { class: 'sheet-legend', text: t('pregame.layout') }));
        const grid = el('div', { class: 'layout-picker' });
        const paintLayout = () => {
          clear(grid);
          variants.forEach((v) => {
            grid.append(el('button', {
              class: 'layout-option' + (layoutId === v.id ? ' is-on' : ''),
              onClick: () => { layoutId = v.id; paintLayout(); buzz(); },
            }, [
              layoutPreview(v),
              el('span', { class: 'layout-label', text: t(v.labelKey) }),
            ]));
          });
        };
        paintLayout();
        pane.append(grid);
      }

      pane.append(el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', onClick: close }, [t('common.back')]),
        el('button', {
          class: 'btn primary',
          onClick: () => {
            const first = whoStarts === 'random'
              ? d.seats[Math.floor(Math.random() * d.seats.length)]
              : d.seats.find((s) => s.id === whoStarts);

            d.layoutId = layoutId;
            d.firstSeatId = first.id;
            d.seats.forEach((s) => {
              store.rememberPlayer(s.name);
              s.commanders.forEach(store.rememberCommander);
            });
            store.setSetting('startingLife', d.startingLife);

            close();
            onStart(d);
            toast(t('pregame.startsToast', { name: first.name }));
          },
        }, [t('common.start')]),
      ]));
    },
  });
}

/**
 * Where this player is going to sit.
 *
 * The order of the list already says the turn order, but not the PLACE - and
 * with 5 or 6 people, "third on the list" helps nobody find themselves around
 * the table. The thumbnail shows the chair lit up in the real arrangement that
 * will be used.
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

/** A thumbnail of the table, with the number showing the turn order. */
function layoutPreview(layout) {
  // The preview takes on the DEVICE proportion, not just the grid's.
  //
  // With two players both options have the same grid - a stack of two - and
  // without this they would look identical on screen, as if it were a defect.
  // What really changes is the shape of the device on the table, so that is
  // the shape the thumbnail needs to show.
  const shape = layout.orient === 'landscape' ? ' is-land'
    : layout.orient === 'portrait' ? ' is-port' : '';
  return el('div', {
    class: 'layout-mini' + shape,
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
