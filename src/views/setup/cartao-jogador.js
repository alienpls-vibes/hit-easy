/**
 * O cartao de um assento na home, e o arraste que reordena a lista.
 *
 * O cartao mostra o numero do turno, o nome, o @ e o deck. A alca arrasta, e a
 * ordem da lista E a ordem dos turnos - por isso o arraste nao e enfeite: e
 * como se diz ao app quem senta ao lado de quem.
 */

import { el, icon, openFlow, buzz, toast } from '../../ui.js';
import { accentOf, pips } from '../../colors.js';
import { deckNameOf } from '../../engine.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { handleValido, exibirHandle } from '../../cloud.js';
import { seatSpot } from './antes-de-comecar.js';
import { commanderStep } from './escolher-deck.js';
import { buscaHandleStep, playerStep } from './escolher-jogador.js';
import { MIN_SEATS, ensureDraft, podeVincular } from './rascunho.js';

export function seatCard(seat, index, refresh) {
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

/**
 * Arrastar pela alca reordena a lista.
 *
 * A ordem dos assentos E a ordem dos turnos, entao isso nao e enfeite: e como
 * se diz ao app quem senta ao lado de quem. Os cartoes tem altura igual, o que
 * deixa a conta simples - o indice de destino e so a distancia percorrida
 * dividida pelo passo.
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


