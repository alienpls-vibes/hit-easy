/**
 * The table context: what all the pieces share.
 *
 * It used to be nineteen `const`/`let`s inside renderTable(), seen for free by
 * thirty-nine nested functions. That is convenient while it is one file, and
 * impossible to split later: any piece that leaves the closure loses
 * everything at once, without anything warning.
 *
 * Now it is an object. Each piece receives `table` and reads `table.state`,
 * `table.tiles`, `table.hub` - what used to be invisible is now written down.
 * The pieces also hang themselves here (`table.sync`, `table.apply`), and that
 * is how one calls another without the two needing to import each other.
 *
 * An object, and not exported variables: an exported `let` is read-only from
 * outside, and `table.state = ...` has to work from seven different files.
 */

import { layoutOfMatch } from '../../seating.js';
import { replay } from '../../engine.js';
import { SVG_NS } from './constants.js';
import { tableRotation, hasFinePointer } from '../../orientation.js';

export function createContext(root, ctx) {
  const { match } = ctx;
  const rotOf = new Map(); // seatId -> degrees, to orient the damage pad

  const table = {
    root,
    ctx,
    match,

    /** seatId -> that seat's panel. */
    tiles: new Map(),
    /** seatId -> { delta, timer }: what has not become an event yet. */
    pending: new Map(),
    rotOf,

    /**
     * How much the damage pad rotates.
     *
     * Lying on the table, it follows the seat of whoever is acting - that is
     * how the person can read their own attack. At a computer the monitor
     * stands facing a single person, and the same rotation turned the screen
     * upside down.
     */
    padRotation: (seatId) => tableRotation(rotOf.get(seatId), hasFinePointer()),

    /** The visible state is ALWAYS replay(match) - never edited by hand. */
    state: replay(match),
    victoryShown: false,
    destroyed: false,
    pauseTimer: null, // the first sync() already checks it
    manaSaveTimer: null,
    /** The gesture in progress, or null. */
    gesture: null,

    /**
     * The next redraw COUNTS the life instead of switching at once.
     *
     * Set by the damage and area-action pads, right before applying. A
     * boolean, and not the list of affected seats: on the next redraw the only
     * lives that changed are the ones the pad touched, so the list would be
     * repeated work - and would poorly cover the drain, which hurts several
     * and heals one.
     */
    countOnNextSync: false,

    layout: layoutOfMatch(match),

    // Filled in by table.js when building the screen.
    grid: null,
    fx: null,
    fxPath: null,
    fxDot: null,
    fxHead: null,
    hub: null,
    pauseView: null,
    wrap: null,
  };

  return table;
}

/**
 * The drag layer.
 *
 * It sits OUTSIDE the panels because they rotate, and the arrow has to be drawn
 * in screen coordinates.
 */
export function createDragLayer(table) {
  const fx = document.createElementNS(SVG_NS, 'svg');
  fx.setAttribute('class', 'attack-fx');
  const fxPath = document.createElementNS(SVG_NS, 'path');
  const fxDot = document.createElementNS(SVG_NS, 'circle');
  fxDot.setAttribute('r', '5');
  const fxHead = document.createElementNS(SVG_NS, 'path');
  fx.append(fxPath, fxDot, fxHead);

  table.fx = fx;
  table.fxPath = fxPath;
  table.fxDot = fxDot;
  table.fxHead = fxHead;
}
