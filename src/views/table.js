/**
 * The table - the entry point of the screen.
 *
 * Event sourcing: the match IS the list of events, and the visible state is
 * always `replay(match)`. From that come, for free, undo, exact statistics and
 * the guarantee that the scoreboard never diverges from the history.
 *
 * The pieces live in src/views/table/:
 *
 *   context.js     what they all share (it used to be the closure)
 *   table.js       builds the screen and wires the pieces
 *   constants.js   the gesture measurements, and the mana colors
 *   widgets.js     label/number, the row with - and +, "hold to repeat"
 *   state.js       whoever changes the match: apply, undo, pass turn, pause
 *   paint.js       drawing the table from the state
 *   gestures.js    the length of the touch decides what it is
 *   damage.js      the directional arrow and the damage pad
 *   sweep.js       damage to everyone, and drain
 *   mana.js        the mana marker
 *   vote.js        secret vote, passing the device from hand to hand
 *   player.js      a player's panel
 *   hub.js         the central core, and the pause cover
 *   menu.js        the match menu
 *   victory.js     who won, how they won, and the poster
 *
 * One name goes through this door.
 */

export { renderTable } from './table/table.js';
