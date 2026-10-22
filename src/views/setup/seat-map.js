/**
 * Where everyone sits: the table drawn as it will be, with the players in it.
 *
 * The list on the home screen already says the turn order, and the order IS
 * the seating - but a list does not look like a table. With five or six people
 * nobody checks "fourth on the list" against the chair they are in, and the
 * mistake only shows up once the match is on screen, with the panels facing the
 * wrong people. Here the table is drawn the way the device will lie on it, each
 * player in their chair, and a wrong chair is fixed by dragging the player to
 * the right one.
 *
 * Moving someone is a SWAP: on a drawing of chairs, dropping a player on an
 * occupied chair means "these two trade places" - sliding everyone in between
 * one step, as the list does, would move people nobody touched. Tapping two
 * players does the same, for whoever finds dragging fiddly and for keyboards.
 *
 * The arrangement choice (device upright or sideways) lives here too, and not
 * in the next step: it changes the drawing, so it has to be chosen where the
 * drawing is.
 */

import { el, clear, buzz } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { deckNameOf } from '../../engine.js';
import {
  variantsFor, sidewaysLayout, pickableId,
} from '../../seating.js';
import { t } from '../../i18n.js';
import { hasFinePointer } from '../../orientation.js';

/** How far a finger travels before a press becomes a drag, in pixels. */
const DRAG_SLOP = 6;

/**
 * The first step of the pre-game flow. `next` builds the step that follows,
 * so this file does not need to know what comes after it.
 */
export function seatMapStep(d, next) {
  return {
    title: t('pregame.seatsTitle'),
    subtitle: t('pregame.seatsSub'),
    build: (pane, api) => {
      const variants = variantsFor(d.seats.length);
      // Settled on the draft at once: the home cards draw their chair from it,
      // and they should match this drawing when the person comes back.
      d.layoutId = pickableId(d.seats.length, d.layoutId);

      const device = deviceShape();
      const board = el('div', {
        class: 'seat-map is-' + device.kind,
        style: { aspectRatio: String(device.ratio), '--ratio': String(device.ratio) },
      });
      let picked = null;
      let swapped = [];

      const swap = (a, b) => {
        [d.seats[a], d.seats[b]] = [d.seats[b], d.seats[a]];
        picked = null;
        swapped = [a, b];
        buzz(14);
        paintBoard();
      };

      const paintBoard = () => {
        // Always drawn with the phone on its side - see sidewaysLayout.
        const layout = sidewaysLayout(d.seats.length, d.layoutId);
        clear(board);
        board.style.gridTemplateColumns = 'repeat(' + layout.cols + ', 1fr)';
        board.style.gridTemplateRows = 'repeat(' + layout.rows + ', 1fr)';

        layout.seats.forEach((spec, i) => {
          const seat = d.seats[i];
          const commander = seat.commanders[0];
          board.append(el('button', {
            class: 'seat-map-cell'
              + (picked === i ? ' is-picked' : '')
              + (swapped.includes(i) ? ' is-swapped' : ''),
            dataset: { index: String(i) },
            style: {
              gridRow: spec.rs ? spec.r + ' / span ' + spec.rs : String(spec.r),
              gridColumn: spec.cs ? spec.c + ' / span ' + spec.cs : String(spec.c),
              '--accent': accentOf(commander ? commander.colors : []),
            },
            'aria-pressed': String(picked === i),
            onClick: (e) => {
              const cell = e.currentTarget;
              // The click that ends a drag is not a tap.
              if (cell._dragged) { cell._dragged = false; return; }
              if (picked === null) {
                picked = i;
                swapped = [];
                buzz();
                paintBoard();
              } else if (picked === i) {
                picked = null;
                paintBoard();
              } else {
                swap(picked, i);
              }
            },
          }, [
            el('span', { class: 'seat-map-turn', text: String(i + 1) }),
            el('span', { class: 'seat-map-name', text: seat.name }),
            el('span', { class: 'seat-map-deck', text: deckNameOf(seat.commanders) }),
          ]));
        });
        bindSeatDrag(board, swap);
        // The highlight of a swap is shown once; the next paint is calm again.
        swapped = [];
      };

      if (variants.length > 1) {
        pane.append(el('p', { class: 'sheet-legend', text: t('pregame.layout') }));
        const picker = el('div', { class: 'layout-picker' });
        const paintPicker = () => {
          clear(picker);
          variants.forEach((v) => {
            picker.append(el('button', {
              class: 'layout-option' + (d.layoutId === v.id ? ' is-on' : ''),
              onClick: () => {
                d.layoutId = v.id;
                paintPicker();
                paintBoard();
                buzz();
              },
            }, [
              layoutPreview(sidewaysLayout(d.seats.length, v.id), device),
              el('span', { class: 'layout-label', text: t(v.labelKey) }),
            ]));
          });
        };
        paintPicker();
        pane.append(picker);
      }

      paintBoard();
      pane.append(
        el('p', { class: 'sheet-legend', text: t('pregame.seatsLegend') }),
        board,
        el('p', { class: 'seat-map-hint', text: t('pregame.seatsHint') }),
        el('div', { class: 'sheet-actions' }, [
          el('button', { class: 'btn ghost', onClick: api.close }, [t('common.back')]),
          el('button', { class: 'btn primary', onClick: () => api.next(next()) }, [t('pregame.continue')]),
        ]),
      );
    },
  };
}

/**
 * Dragging a player onto another chair swaps the two.
 *
 * The chairs are measured once, when the drag starts: nothing else moves on
 * the board while a finger holds a player, so the drop target is just the
 * chair whose box contains the finger.
 */
function bindSeatDrag(board, swap) {
  const cells = [...board.querySelectorAll('.seat-map-cell')];

  cells.forEach((cell, index) => {
    cell.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      cell._dragged = false;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const rects = cells.map((c) => c.getBoundingClientRect());
      let dragging = false;
      let target = null;

      const move = (ev) => {
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (!dragging) {
          if (Math.hypot(dx, dy) < DRAG_SLOP) return;
          dragging = true;
          cell.setPointerCapture(ev.pointerId);
          board.classList.add('is-dragging');
          cell.classList.add('is-lifted');
          buzz(12);
        }
        cell.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';

        const over = rects.findIndex((r, i) => i !== index
          && ev.clientX >= r.left && ev.clientX <= r.right
          && ev.clientY >= r.top && ev.clientY <= r.bottom);
        const next = over < 0 ? null : over;
        if (next === target) return;
        if (target !== null) cells[target].classList.remove('is-target');
        target = next;
        if (target !== null) {
          cells[target].classList.add('is-target');
          buzz(6);
        }
      };

      const up = () => {
        cell.removeEventListener('pointermove', move);
        cell.removeEventListener('pointerup', up);
        cell.removeEventListener('pointercancel', cancel);
        if (!dragging) return;
        // The browser may still send a click for this press - on a touch
        // screen, a short drag can be read as a tap. It must not pick the
        // player up. The next press clears the mark if no click came.
        cell._dragged = true;
        board.classList.remove('is-dragging');
        cell.classList.remove('is-lifted');
        cell.style.transform = '';
        if (target !== null) swap(index, target);
      };

      const cancel = () => {
        target = null;
        up();
      };

      cell.addEventListener('pointermove', move);
      cell.addEventListener('pointerup', up);
      cell.addEventListener('pointercancel', cancel);
    });
  });
}

/**
 * The device the drawing shows: what kind it is and its proportion, long side
 * over short side.
 *
 * The board draws the very screen the match will be played on. A phone
 * outline on a tablet or a computer told the person the wrong shape: a tablet
 * is much squarer than a phone, and a monitor does not lie on the table. The
 * proportion comes from the screen, clamped so an odd value (a window in a
 * test, a foldable half open) still draws something readable.
 *
 * A mouse or trackpad means a computer, the same rule the table uses to stop
 * turning panels upside down (hasFinePointer). Without one, a short side of
 * 600 px or more is a tablet.
 */
export function deviceShape(win = typeof window !== 'undefined' ? window : null) {
  const scr = win && win.screen;
  const long = scr ? Math.max(scr.width, scr.height) : 0;
  const short = scr ? Math.min(scr.width, scr.height) : 0;
  const ratio = long && short ? Math.min(2.3, Math.max(1.25, long / short)) : 19 / 9;
  const kind = hasFinePointer(win && win.matchMedia ? win.matchMedia.bind(win) : null)
    ? 'computer'
    : short >= 600 ? 'tablet' : 'phone';
  return { kind, ratio: Math.round(ratio * 1000) / 1000 };
}

/**
 * A thumbnail of the table, with the number showing the turn order.
 *
 * Drawn on its side like the big board, upright option included: what tells
 * the two apart is how the players sit, and each number is turned the way
 * that player reads their panel - upside down on the far side, sideways at the
 * ends of an upright table drawn lying down.
 */
function layoutPreview(layout, device) {
  return el('div', {
    class: 'layout-mini is-' + device.kind,
    style: {
      aspectRatio: String(device.ratio),
      gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)',
      gridTemplateRows: 'repeat(' + layout.rows + ', 1fr)',
    },
  }, layout.seats.map((s, i) => el('span', {
    class: 'layout-cell',
    style: {
      gridRow: s.rs ? s.r + ' / span ' + s.rs : String(s.r),
      gridColumn: s.cs ? s.c + ' / span ' + s.cs : String(s.c),
    },
  }, [el('span', {
    class: 'layout-num',
    style: s.rot ? { transform: 'rotate(' + s.rot + 'deg)' } : {},
    text: String(i + 1),
  })])));
}
