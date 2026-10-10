/**
 * The table: builds the screen and wires the pieces.
 *
 * This file does not draw panels, does not handle gestures and does not change
 * state - it only builds the context, hangs the pieces on it and builds the DOM
 * tree in the right order. Order matters: the hub needs the pieces already
 * hung, `wrap` needs the hub, and `sync()` needs everything.
 *
 * No piece calls another through an import. They all find each other through
 * `table.<name>`, and that is what lets gestures call the damage pad, which
 * calls `apply`, which calls `sync` - without any of the four files importing
 * another.
 */

import { el, clear, closeSheet } from '../../ui.js';
import { createContext, createDragLayer } from './context.js';
import { createState } from './state.js';
import { createPainter } from './paint.js';
import { createGestures } from './gestures.js';
import { createDamage } from './damage.js';
import { createSweep } from './sweep.js';
import { createMana } from './mana.js';
import { createVote } from './vote.js';
import { createPlayerSheet } from './player.js';
import { createHub } from './hub.js';
import { createMenu } from './menu.js';
import { createVictory } from './victory.js';

export function renderTable(root, ctx) {
  const table = createContext(root, ctx);

  // The pieces before the DOM: buildTile() and buildHub() already need them.
  Object.assign(
    table,
    createState(table),
    createPainter(table),
    createGestures(table),
    createDamage(table),
    createSweep(table),
    createMana(table),
    createVote(table),
    createPlayerSheet(table),
    createHub(table),
    createMenu(table),
    createVictory(table),
  );

  clear(root);

  table.grid = el('div', {
    class: 'table-grid',
    style: {
      gridTemplateColumns: 'repeat(' + table.layout.cols + ', 1fr)',
      gridTemplateRows: 'repeat(' + table.layout.rows + ', 1fr)',
    },
  });

  table.match.seats.forEach((seat, i) => {
    const spec = table.layout.seats[i];
    table.rotOf.set(seat.id, spec.rot);
    const tile = table.buildTile(seat, spec);
    table.tiles.set(seat.id, tile);
    table.grid.append(tile.root);
  });

  createDragLayer(table);

  table.hub = table.buildHub();
  table.pauseView = table.buildPause();
  table.wrap = el('div', { class: 'table-wrap' }, [
    table.grid, table.hub.root, table.fx, table.pauseView.root,
  ]);
  root.append(table.wrap);
  table.sync();
  table.hintOnce();

  return {
    destroy: () => {
      table.destroyed = true;
      table.stopPauseClock();
      table.commitAll(); // never lose the last tap when switching screens
      closeSheet();
    },
  };
}
