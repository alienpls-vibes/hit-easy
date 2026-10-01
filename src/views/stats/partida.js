/**
 * O cartao de uma partida, e o detalhe dela com a linha do tempo inteira.
 *
 * A aba de Partidas fica sem cor nenhuma de proposito: a lista de colocacoes e
 * a data ja dizem o que ela precisa dizer, e cor em cima disso virava enfeite.
 */

import { el, icon, openSheet, confirmAction } from '../../ui.js';
import {
  summarize, timeline, formatDuration, formatDate, labelOf, nomeRegistrado,
} from '../../stats.js';
import { deckNameOf } from '../../engine.js';
import * as store from '../../store.js';
import * as sync from '../../sync.js';
import { t, locale, ordinal } from '../../i18n.js';
import { openMarcar, podeMarcar } from './marcar-conta.js';

export function matchCard(match, refresh) {
  const s = summarize(match);
  // O que este aparelho sabe sobre quem e quem. Sem isto, uma pessoa marcada em
  // OUTRA partida apareceria aqui pelo nome digitado, e a mesma pessoa teria
  // dois rotulos em duas telas do mesmo app.
  const apelidos = store.knownHandles();

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
    // Marcar depois: esquecer na hora é o caso comum, e sem isto a partida
    // ficava perdida para aquela pessoa para sempre.
    ...(podeMarcar() ? [el('button', {
      class: 'match-tag',
      onClick: () => openMarcar(match, refresh),
    }, [t('stats.tagPlayer')])] : []),
    el('ol', { class: 'placings' }, s.standings.map(({ seatId, place }) => {
      const seat = match.seats.find((x) => x.id === seatId);
      // O @ como rotulo, e o nome daquele dia embaixo. Este e o unico lugar
      // onde os dois aparecem juntos: em toda outra tela a pessoa se chama pelo
      // @, e aqui e onde se responde "quem era o Alexandre daquela mesa".
      const registrado = nomeRegistrado(seat, apelidos);
      return el('li', { class: 'placing' }, [
        el('span', { class: 'placing-pos', text: ordinal(place) }),
        el('span', { class: 'placing-text' }, [
          el('span', { class: 'placing-name', text: labelOf(seat, apelidos) }),
          registrado
            ? el('span', {
              class: 'placing-alias',
              text: t('stats.recordedAs', { name: registrado }),
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
              // Apaga tambem da nuvem. A politica de privacidade promete que
              // apagar nao depende de assinatura, e o banco permite - mas a
              // promessa so vale se o aplicativo de fato pedir.
              sync.apagarPartida(match.id);
              refresh();
            }
          },
        }, [t('stats.deleteMatch')]),
      ]));
    },
  });
}
