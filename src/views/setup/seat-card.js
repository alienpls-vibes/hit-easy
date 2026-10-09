/**
 * A seat's card on the home screen, and the drag that reorders the list.
 *
 * The card shows the turn number, the name, the @ and the deck. The handle
 * drags, and the order of the list IS the turn order - that is why the drag is
 * not decoration: it is how you tell the app who sits next to whom.
 */

import { el, icon, openFlow, buzz, toast } from '../../ui.js';
import { accentOf, pips } from '../../colors.js';
import { deckNameOf } from '../../engine.js';
import { t } from '../../i18n.js';
import { isHandleValid, displayHandle } from '../../cloud.js';
import { seatSpot } from './pre-game.js';
import { commanderStep } from './pick-deck.js';
import { findHandleStep, playerStep } from './pick-player.js';
import { MIN_SEATS, ensureDraft, canLinkAccounts } from './draft.js';

export function seatCard(seat, index, refresh) {
  const commander = seat.commanders[0];
  const accent = commander ? accentOf(commander.colors) : 'var(--line)';

  const art = el('button', {
    class: 'seat-art' + (commander ? '' : ' is-empty'),
    style: commander && commander.thumb ? { backgroundImage: 'url(' + commander.thumb + ')' } : {},
    onClick: () => openFlow(commanderStep(seat, 0, refresh)),
    'aria-label': t('setup.chooseCommander'),
  }, commander ? [] : [icon('plus')]);

  // Tapping the name opens the full flow: the player and, next, their deck.
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

/**
 * Dragging by the handle reorders the list.
 *
 * The seat order IS the turn order, so this is not decoration: it is how you
 * tell the app who sits next to whom. The cards have equal height, which keeps
 * the math simple - the target index is just the distance traveled divided by
 * the step.
 */
export function bindReorder(list, d, refresh) {
  const cards = [...list.querySelectorAll('.seat-card')];
  if (cards.length < 2) return;

  cards.forEach((card, index) => {
    const grip = card.querySelector('.seat-grip');
    if (!grip) return;

    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);

      const heights = cards.map((c) => c.offsetHeight);
      const gap = cards.length > 1 ? cards[1].offsetTop - cards[0].offsetTop - heights[0] : 0;
      const step = heights[0] + gap;
      const y0 = e.clientY;
      let target = index;

      list.classList.add('is-reordering');
      card.classList.add('is-dragging');
      buzz(12);

      const move = (ev) => {
        const dy = ev.clientY - y0;
        card.style.transform = 'translateY(' + dy + 'px)';

        const next = Math.max(0, Math.min(cards.length - 1, index + Math.round(dy / step)));
        if (next === target) return;
        target = next;
        buzz(6);

        // Makes room: whoever is between the origin and the target moves one step.
        cards.forEach((other, i) => {
          if (i === index) return;
          let shift = 0;
          if (target > index && i > index && i <= target) shift = -step;
          if (target < index && i < index && i >= target) shift = step;
          other.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
        });
      };

      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        list.classList.remove('is-reordering');
        cards.forEach((c) => { c.style.transform = ''; c.classList.remove('is-dragging'); });

        if (target !== index) {
          const [moved] = d.seats.splice(index, 1);
          d.seats.splice(target, 0, moved);
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

/**
 * The @ right below the name, in the same column as the deck.
 *
 * It used to be a loose chip in the corner of the card: it sat far from the
 * name it referred to and fought for space with the drag handle. Here it reads
 * as what it is - a second line about the player, next to the deck that also
 * describes the seat.
 */
function handleLine(seat, refresh) {
  if (!canLinkAccounts()) return null;

  const linked = isHandleValid(seat.handle);
  return el('button', {
    class: 'seat-handle' + (linked ? ' is-on' : ''),
    'aria-label': linked ? displayHandle(seat.handle) : t('handle.link'),
    onClick: () => openFlow(findHandleStep(seat, refresh, {
      adoptName: false,
      then: 'close',
    })),
  }, [linked ? displayHandle(seat.handle) : t('handle.link')]);
}
