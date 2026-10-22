/**
 * The last stops before the table: where everyone sits, then who opens the
 * match.
 *
 * Two steps of one flow. The first draws the table with the players in their
 * chairs, so a wrong seat is fixed before the panels face the wrong people
 * (see seat-map.js); the arrangement choice lives there too, because it changes
 * that drawing. The second asks who starts.
 *
 * "Random" is the default because that is how the table really decides - and
 * the draw happens on Start, not here, to give a new result every time.
 */

import { el, clear, icon, openFlow, buzz, toast } from '../../ui.js';
import { accentOf } from '../../colors.js';
import * as store from '../../store.js';
import { deckNameOf } from '../../engine.js';
import { layoutFor, pickableId } from '../../seating.js';
import { t } from '../../i18n.js';
import { ensureDraft } from './draft.js';
import { seatMapStep } from './seat-map.js';

/**
 * `onClose` runs whenever the flow closes - started or not: the seats may have
 * changed places, and the home list has to show the new order.
 */
export function openPreGame(d, onStart, onClose) {
  if (!d.seats.every((s) => s.commanders.length)) return;
  openFlow(seatMapStep(d, () => whoStartsStep(d, onStart)), { onClose });
}

function whoStartsStep(d, onStart) {
  let whoStarts = 'random';

  return {
    title: t('pregame.title'),
    subtitle: t('pregame.sub', { n: d.seats.length, life: d.startingLife }),
    build: (pane, api) => {
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

      pane.append(el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', onClick: () => api.back() }, [t('common.back')]),
        el('button', {
          class: 'btn primary',
          onClick: () => {
            const first = whoStarts === 'random'
              ? d.seats[Math.floor(Math.random() * d.seats.length)]
              : d.seats.find((s) => s.id === whoStarts);

            d.layoutId = pickableId(d.seats.length, d.layoutId);
            d.firstSeatId = first.id;
            d.seats.forEach((s) => store.rememberPlayer(s.name));
            store.setSetting('startingLife', d.startingLife);

            api.close();
            onStart(d);
            toast(t('pregame.startsToast', { name: first.name }));
          },
        }, [t('common.start')]),
      ]));
    },
  };
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
