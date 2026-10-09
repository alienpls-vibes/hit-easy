/**
 * A match's card, and its details with the whole timeline.
 *
 * The Matches tab has no color at all on purpose: the list of placings and the
 * date already say what it needs to say, and color on top of that would be
 * decoration. Player color still applies where the axis is the person -
 * Players and Rivals.
 */

import { el, icon, openSheet, confirmAction } from '../../ui.js';
import {
  summarize, timeline, formatDuration, formatDate, labelOf, recordedName,
} from '../../stats.js';
import { deckNameOf } from '../../engine.js';
import * as store from '../../store.js';
import * as sync from '../../sync.js';
import { t, locale, ordinal } from '../../i18n.js';
import { openTagPlayer, canTag } from './link-account.js';

export function matchCard(match, refresh) {
  const s = summarize(match);
  // What this device knows about who is who. Without it, a person tagged in
  // ANOTHER match would show up here by the typed name, and the same person
  // would have two labels on two screens of the same app.
  const aliases = store.knownHandles();

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
    // Tagging later: forgetting at the time is the common case, and without
    // this the match was lost to that person forever.
    ...(canTag() ? [el('button', {
      class: 'match-tag',
      onClick: () => openTagPlayer(match, refresh),
    }, [t('stats.tagPlayer')])] : []),
    el('ol', { class: 'placings' }, s.standings.map(({ seatId, place }) => {
      const seat = match.seats.find((x) => x.id === seatId);
      // The @ as the label, and that day's name below. This is the only place
      // where the two show up together: on every other screen the person is
      // called by the @, and here is where "who was the Alexandre of that
      // table" is answered.
      const recorded = recordedName(seat, aliases);
      return el('li', { class: 'placing' }, [
        el('span', { class: 'placing-pos', text: ordinal(place) }),
        el('span', { class: 'placing-text' }, [
          el('span', { class: 'placing-name', text: labelOf(seat, aliases) }),
          recorded
            ? el('span', {
              class: 'placing-alias',
              text: t('stats.recordedAs', { name: recorded }),
            })
            : null,
        ]),
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
            if (ok) {
              // Deletes from the cloud too. The privacy policy promises that
              // deleting does not depend on a subscription, and the database
              // allows it - but the promise only holds if the app actually
              // asks.
              sync.deleteMatchEverywhere(match.id);
              refresh();
            }
          },
        }, [t('stats.deleteMatch')]),
      ]));
    },
  });
}
