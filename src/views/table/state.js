/**
 * Whoever changes the match state.
 *
 * Every event comes in through `apply()`: it writes to the log, runs
 * `replay()` again and repaints. Nothing here touches the scoreboard by hand -
 * the scoreboard IS the replay of the log, and that is the guarantee that it
 * never diverges from the history.
 *
 * Quick taps in a row merge into a single event after ~0.9s: seven taps become
 * one line in the history, not seven. That is what `commit()` does.
 */

import { buzz, toast } from '../../ui.js';
import { replay, push, undo, redo, canUndo, canRedo } from '../../engine.js';
import { formatDuration } from '../../stats.js';
import { t } from '../../i18n.js';
import { COMMIT_MS } from './constants.js';

export function createState(table) {
  function commit(seatId) {
    const p = table.pending.get(seatId);
    if (!p) return;
    clearTimeout(p.timer);
    table.pending.delete(seatId);
    if (!p.delta) { table.sync(); return; }

    // The panel edge changes life with no source: it is the player paying.
    // Damage with a dealer comes from the drag, never from here.
    push(table.match, { type: 'life', targetId: seatId, delta: p.delta, sourceId: null });
    table.ctx.onChange();
    table.state = replay(table.match);
    // Leaving the table: save, but do not announce anything else.
    if (table.destroyed) return;
    table.sync();

    const who = table.match.seats.find((s) => s.id === seatId);
    toast(
      who.name + ' ' + (p.delta > 0 ? '+' : '') + p.delta,
      { label: t('common.undo'), onClick: () => doUndo() },
    );
  }

  function commitAll() {
    [...table.pending.keys()].forEach(commit);
  }

  function nudge(seatId, step) {
    if (table.state.finished || table.state.paused) return;
    const p = table.pending.get(seatId) || { delta: 0, timer: null };
    p.delta += step;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => commit(seatId), COMMIT_MS);
    table.pending.set(seatId, p);
    buzz(6);
    table.sync();
  }

  function doUndo() {
    // Cancelling what has not become an event yet comes first.
    if (table.pending.size) {
      table.pending.forEach((p) => clearTimeout(p.timer));
      table.pending.clear();
      table.sync();
      return;
    }
    if (!canUndo(table.match)) { toast(t('common.nothingToUndo')); return; }
    undo(table.match);
    table.ctx.onChange();
    table.state = replay(table.match);
    table.sync();
    buzz(10);
  }

  function doRedo() {
    if (!canRedo(table.match)) { toast(t('common.nothingToRedo')); return; }
    redo(table.match);
    table.ctx.onChange();
    table.state = replay(table.match);
    table.sync();
  }

  function passTurn() {
    if (table.state.finished || table.state.paused) return;
    commitAll();
    table.clearMana(); // floating mana does not cross the turn
    push(table.match, { type: 'turn' });
    table.ctx.onChange();
    table.state = replay(table.match);
    table.sync();
    buzz(14);
    const next = table.match.seats.find((s) => s.id === table.state.activeSeatId);
    if (next) {
      toast(t('table.turnToast', { n: table.state.turn, name: next.name }));
    }
  }

  function apply(partial) {
    if (table.state.paused && partial.type !== 'resume') return;
    push(table.match, partial);
    table.ctx.onChange();
    table.state = replay(table.match);
    table.sync();
    buzz(8);
  }

  /**
   * Pauses the table clock.
   *
   * It is not just cosmetic: while paused, the time does not count toward the
   * match duration nor anyone's turn time. A trip to the bathroom should not
   * become "the longest turn of the night" in the statistics.
   */
  function togglePause() {
    commitAll();
    push(table.match, { type: table.state.paused ? 'resume' : 'pause' });
    table.ctx.onChange();
    table.state = replay(table.match);
    table.sync();
    buzz(14);
  }

  function startPauseClock() {
    if (table.pauseTimer) return;
    const tick = () => {
      table.pauseView.clock.textContent = formatDuration(Date.now() - (table.state.pausedSince || Date.now()));
    };
    tick();
    table.pauseTimer = setInterval(tick, 1000);
  }

  function stopPauseClock() {
    clearInterval(table.pauseTimer);
    table.pauseTimer = null;
  }

  return {
    commit, commitAll, nudge, doUndo, doRedo, passTurn, apply, togglePause,
    startPauseClock, stopPauseClock,
  };
}
