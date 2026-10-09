/**
 * The whole panel is a gesture area, and the LENGTH of the touch decides what
 * it is.
 *
 * At the EDGES, a short tap changes your own life by 1, with no dealer, and
 * holding repeats, speeding up - the same grammar as the mana marker, where
 * holding also repeats. Whoever gets to 40 life should not need forty taps.
 *
 * In the CENTER, holding (or dragging from any point) arms the attack, and
 * from then on no life point moves by itself.
 *
 * WHAT IT COSTS: before, nothing was applied on touch - life only changed when
 * the finger was RELEASED - and that eliminated by construction the mistake of
 * the finger lingering on the edge and the life going along. With repetition
 * that mistake can happen again. What keeps it cheap is the coalescing that
 * already existed: the whole hold goes into ONE event (see commit() in
 * state.js), so one tap on "undo" brings back the forty points at once, not
 * one by one. That is why the repetition starts at HOLD_DELAY and not at
 * TAP_MAX: between the two, a slow tap is still worth 1.
 */

import { buzz } from '../../ui.js';
import {
  DOUBLE_TAP_MS, DRAG_THRESHOLD, HOLD_DELAY, TAP_MAX,
} from './constants.js';
import { repeatWhileHeld } from './widgets.js';

export function createGestures(table) {
  function zoneOf(target) {
    if (!target || !target.closest) return 'center';
    if (target.closest('.tap-minus')) return 'minus';
    if (target.closest('.tap-plus')) return 'plus';
    return 'center';
  }

  /** Which panel is under the finger. It works in screen coordinates, so the
   *  180 rotation of the seats on the other side of the table does not get in
   *  the way. */
  function tileUnder(x, y) {
    const node = document.elementFromPoint(x, y);
    const tile = node && node.closest ? node.closest('.tile') : null;
    const id = tile && tile.dataset.seat;
    const p = id && table.state.players[id];
    if (!p || p.dead) return null;
    return id;
  }

  function bindTile(node, seat) {
    let holdTimer = null;
    let pressed = null;  // strip highlighted while the finger is on it
    let tapTimer = null; // single tap on hold, until we know if it becomes a double
    let lastTap = null;
    // Holding on the edge: keeps the function that stops it, so non-null means
    // 'a repetition is in progress' - which is what the guards ask.
    let repeating = null;

    const unpress = () => {
      if (pressed) {
        pressed.classList.remove('is-pressed');
        pressed.classList.remove('is-held');
      }
      pressed = null;
    };

    /** Stops the repetition. Calling it with none in progress does no harm. */
    const stopRepeating = () => {
      if (repeating) repeating();
      repeating = null;
    };

    /**
     * Holding on the edge: repeats the same step, speeding up.
     *
     * Marks `repeated` on the gesture so the release does not add another step
     * on top - the edge applies on release when it was a short tap, and here it
     * already applied.
     */
    const repeatOnEdge = (zone) => {
      const step = zone === 'minus' ? -1 : +1;
      repeating = repeatWhileHeld(
        () => {
          // The gesture may have ended between a tick and the clearInterval.
          if (!table.gesture) return;
          table.gesture.repeated = true;
          table.nudge(seat.id, step);
        },
        {
          delay: HOLD_DELAY,
          stepRightAway: true,
          onStart: () => { if (pressed) pressed.classList.add('is-held'); },
        },
      );
    };

    /**
     * Switches the gesture to attack mode. From here on the player's own life
     * no longer moves - the only way out is releasing over an opponent (or
     * outside, cancelling).
     */
    const arm = () => {
      if (!table.gesture || table.gesture.active) return;
      // A repetition in progress is a life adjustment, not an attack. The
      // pointermove already blocks it, and this is the safety net: calling
      // arm() through another path in the future cannot leave the table with
      // life going out and the arrow on screen.
      if (repeating) return;
      clearTimeout(holdTimer);
      clearTimeout(tapTimer);
      lastTap = null;
      unpress();
      // Closes previous quick taps before starting the attack.
      table.commitAll();
      table.gesture.active = true;
      table.wrap.classList.add('is-dragging');
      const from = table.tiles.get(table.gesture.seatId).root;
      from.classList.add('is-source');
      table.fx.style.setProperty('--accent', getComputedStyle(from).getPropertyValue('--accent'));
      // Shows the source before there is a target.
      table.drawArrow(table.gesture.x0, table.gesture.y0);
      buzz(14);
    };

    node.addEventListener('pointerdown', (e) => {
      if (table.gesture
        || table.state.finished
        || table.state.players[seat.id].dead) return;
      e.preventDefault();
      try { node.setPointerCapture(e.pointerId); } catch { /* carry on without capture */ }

      table.gesture = {
        seatId: seat.id,
        pointerId: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        zone: zoneOf(e.target),
        active: false,
        targetId: null,
      };

      pressed = e.target.closest('.tap');
      if (pressed) pressed.classList.add('is-pressed');

      // No life happens now. On the edge, holding starts repeating; in the
      // center, holding arms the attack. The two clocks differ on purpose -
      // see this file's header.
      const zone = table.gesture.zone;
      if (zone === 'minus' || zone === 'plus') {
        repeatOnEdge(zone);
      } else {
        holdTimer = setTimeout(arm, TAP_MAX);
      }
    });

    node.addEventListener('pointermove', (e) => {
      if (!table.gesture || table.gesture.pointerId !== e.pointerId) return;

      // Moving arms right away, without waiting for the tap time.
      if (!table.gesture.active) {
        // Once the repetition applied a step the gesture IS a life adjustment
        // already, and cannot turn into an attack halfway: the life already
        // went out, and converting now would leave the player with the
        // adjustment applied and an attack armed.
        if (table.gesture.repeated) return;
        if (Math.hypot(e.clientX - table.gesture.x0, e.clientY - table.gesture.y0) < DRAG_THRESHOLD) return;
        // Before that, no point went out: the finger touched + or - only
        // because the panel is small, and it is already dragging to attack.
        // The repetition that was waiting to start is cancelled, and the
        // gesture becomes the attack the person wanted - with no life touched
        // on the way.
        stopRepeating();
        arm();
      }

      const hit = tileUnder(e.clientX, e.clientY);
      const over = hit && hit !== table.gesture.seatId ? hit : null;
      if (over !== table.gesture.targetId) {
        if (table.gesture.targetId) table.tiles.get(table.gesture.targetId).root.classList.remove('is-target');
        table.gesture.targetId = over;
        if (over) {
          table.tiles.get(over).root.classList.add('is-target');
          buzz(7); // confirms on the finger that the target caught
        }
      }
      table.drawArrow(e.clientX, e.clientY);
    });

    node.addEventListener('pointerup', (e) => {
      if (!table.gesture || table.gesture.pointerId !== e.pointerId) return;
      try { node.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      clearTimeout(holdTimer);
      stopRepeating();
      unpress();
      const { seatId, zone, active, targetId, repeated } = table.gesture;
      table.gesture = null;

      if (active) {
        table.clearArrow();
        if (targetId) table.openDamagePad(seatId, targetId);
        return;
      }

      // The repetition already changed the life while the finger was on it:
      // adding a step now would charge the tap twice.
      if (repeated) return;

      // A quick tap on the edge: one step, applied only now.
      if (zone === 'minus') { table.nudge(seatId, -1); return; }
      if (zone === 'plus') { table.nudge(seatId, +1); return; }

      // In the center, a tap may be the start of a double: we hold the action
      // for the double-tap window before deciding. Only the center pays that
      // wait - the edges have to answer at once.
      const now = Date.now();
      const close = lastTap
        && now - lastTap.t < DOUBLE_TAP_MS
        && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 36;

      if (close) {
        clearTimeout(tapTimer);
        lastTap = null;
        table.openSweepPad(seat.id);
        return;
      }

      lastTap = { t: now, x: e.clientX, y: e.clientY };
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { lastTap = null; table.openPlayerSheet(seat); }, DOUBLE_TAP_MS);
    });

    node.addEventListener('pointercancel', (e) => {
      if (!table.gesture || table.gesture.pointerId !== e.pointerId) return;
      clearTimeout(holdTimer);
      clearTimeout(tapTimer);
      stopRepeating();
      unpress();
      const wasActive = table.gesture.active;
      table.gesture = null;
      if (wasActive) table.clearArrow();
    });

    node.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return { zoneOf, tileUnder, bindTile };
}
