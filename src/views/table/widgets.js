/**
 * Small pieces the table reuses: the label/number pair, the row with - and +,
 * and the "hold to repeat" of the adjustment buttons.
 */

import { el } from '../../ui.js';
import {
  HOLD_DELAY, REPEAT_ACCEL_AFTER, REPEAT_FAST_MS, REPEAT_MS,
} from './constants.js';

export function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-value', text: value }),
    el('span', { class: 'stat-label', text: label }),
  ]);
}

/**
 * Adjustment row: label, number and the step buttons.
 *
 * `value` accepts a function, not only a number: with `holdRepeats` the number
 * changes while the finger is on it, and rebuilding the row would destroy the
 * very button being held. The caller uses `row.refresh()` after each step.
 *
 * `holdRepeats` turns on "hold to repeat" for ONE-unit steps only. Not for the
 * fives: at the fast cadence that would be ninety points per second, and the
 * target would always be overshot - the step of five already is the quick
 * shortcut of the tap.
 */
export function stepperRow({
  label, sub, value, steps, onStep, accent, hot, holdRepeats,
}) {
  const read = () => String(typeof value === 'function' ? value() : value);
  const valueEl = el('span', { class: 'stepper-value', text: read() });

  const buttons = steps.map((n) => {
    const button = el('button', {
      class: 'step-btn' + (n > 0 ? ' is-plus' : ''),
    }, [(n > 0 ? '+' : '') + n]);
    if (holdRepeats && Math.abs(n) === 1) bindHold(button, () => onStep(n));
    else button.addEventListener('click', () => onStep(n));
    return button;
  });

  const row = el('div', {
    class: 'stepper' + (hot ? ' is-hot' : ''),
    style: accent ? { '--accent': accent } : {},
  }, [
    el('div', { class: 'stepper-text' }, [
      el('span', { class: 'stepper-label', text: label }),
      sub ? el('span', { class: 'stepper-sub', text: sub }) : null,
    ]),
    valueEl,
    el('div', { class: 'stepper-btns' }, buttons),
  ]);

  /** Updates the number without rebuilding the row. */
  row.refresh = () => { valueEl.textContent = read(); };
  return row;
}

/**
 * Holding repeats, and speeds up while the finger stays.
 *
 * A single place for the cadence, because it is used in two: the adjustment
 * buttons (damage pad, mana marker) and the panel edges at the table. If the
 * two diverge, holding starts to mean different speeds at the same table.
 *
 * `stepRightAway` says whether a step fires when the delay completes. The
 * adjustment buttons already fired once on the touch itself, so there it is
 * `false`; the panel edge fires nothing before release, so there it is `true` -
 * otherwise the first step of the "hold" would only appear 110ms later, and
 * the edge would feel stuck.
 *
 * Returns the function that stops everything. Calling it twice does no harm.
 */
export function repeatWhileHeld(fn, options = {}) {
  const { delay = HOLD_DELAY, stepRightAway = false, onStart } = options;
  let wait = null;
  let repeat = null;
  let steps = 0;

  wait = setTimeout(() => {
    if (onStart) onStart();
    if (stepRightAway) fn();
    repeat = setInterval(() => {
      steps += 1;
      fn();
      if (steps === REPEAT_ACCEL_AFTER) {
        clearInterval(repeat);
        repeat = setInterval(fn, REPEAT_FAST_MS);
      }
    }, REPEAT_MS);
  }, delay);

  return () => {
    clearTimeout(wait);
    clearInterval(repeat);
    wait = null;
    repeat = null;
  };
}

/** A simple tap fires once; holding repeats and speeds up. */
export function bindHold(node, fn) {
  let stopRepeat = null;

  const stop = () => {
    if (stopRepeat) stopRepeat();
    stopRepeat = null;
    node.classList.remove('is-held');
  };

  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    fn();
    stopRepeat = repeatWhileHeld(fn, {
      onStart: () => node.classList.add('is-held'),
    });
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) =>
    node.addEventListener(evt, stop),
  );
  node.addEventListener('contextmenu', (e) => e.preventDefault());
}
