/**
 * Drawing the table from the state.
 *
 * `sync()` is called after every change and receives nothing: it reads
 * `table.state` and adjusts whatever is different. It does not decide anything
 * - it only shows.
 */

import { el, clear, icon, toast } from '../../ui.js';
import { accentOf, identityGradient, withAlpha } from '../../colors.js';
import {
  canUndo, standings, deckNameOf, CMD_LETHAL, POISON_LETHAL,
} from '../../engine.js';
import * as store from '../../store.js';
import { tableRotation, hasFinePointer } from '../../orientation.js';
import { t, ordinal } from '../../i18n.js';
import { COUNT_MS, COUNT_MIN_STEP } from './constants.js';

/**
 * Did the user ask for less motion? Then the number switches at once.
 *
 * The global CSS rule for `prefers-reduced-motion` zeroes transitions and
 * animations, but it does not reach a count done in JavaScript - this one has
 * to refuse on its own.
 */
function reducedMotion() {
  try {
    return Boolean(matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

/** Stops the count in progress, if any, and clears the direction mark. */
function stopCount(target) {
  clearTimeout(target.counting);
  target.counting = null;
  target.classList.remove('is-falling', 'is-rising');
}

/**
 * Counts the life number up to the new value.
 *
 * Step by step through the integers, because life IS an integer: there is no
 * half life to interpolate between frames. That is also why the count runs on
 * setTimeout and not on requestAnimationFrame - there is nothing to smooth,
 * and this way the tests' controlled clock reaches the animation. Visual
 * feedback without a test is exactly what breaks without anyone noticing.
 */
function countTo(target, from, to) {
  stopCount(target);

  const distance = Math.abs(to - from);
  if (!distance) {
    target.textContent = String(to);
    return;
  }

  const direction = to > from ? 1 : -1;
  const step = Math.max(
    COUNT_MIN_STEP,
    Math.round(COUNT_MS / distance),
  );
  let current = from;

  // The direction is written in the class: from afar, in the middle of the
  // table, the color says whether it went up or down before the number stops.
  target.classList.add(direction < 0 ? 'is-falling' : 'is-rising');

  const advance = () => {
    current += direction;
    target.textContent = String(current);
    if (current === to) {
      stopCount(target);
      return;
    }
    target.counting = setTimeout(advance, step);
  };
  target.counting = setTimeout(advance, step);
}

/**
 * Puts the number on screen: at once, or counting.
 *
 * Counting is the exception, not the rule. Edge taps and the -/+ buttons
 * already show the number moving on each tap, and counting on top would fight
 * "hold to repeat" - that is why the count is requested by the pad, once, and
 * not by every redraw.
 */
function showLife(target, to, counting) {
  const from = Number(target.textContent);
  if (!counting || !Number.isFinite(from) || from === to || reducedMotion()) {
    stopCount(target);
    target.textContent = String(to);
    return;
  }
  countTo(target, from, to);
}

export function createPainter(table) {
  function sync() {
    // The placing comes from the same source as the end screen: with ties by
    // turn, two different calculations would disagree on the same match.
    const placeAtTable = new Map(standings(table.match, table.state).map((x) => [x.seatId, x.place]));

    for (const seat of table.match.seats) {
      const p = table.state.players[seat.id];
      const tile = table.tiles.get(seat.id);
      const extra = table.pending.get(seat.id);
      const shown = p.life + (extra ? extra.delta : 0);

      showLife(tile.life, shown, table.countOnNextSync);
      tile.life.classList.toggle('is-low', shown <= 5 && !p.dead);

      if (extra && extra.delta) {
        tile.delta.textContent = (extra.delta > 0 ? '+' : '') + extra.delta;
        tile.delta.classList.add('is-on');
      } else {
        tile.delta.classList.remove('is-on');
      }

      tile.root.classList.toggle('is-active', seat.id === table.state.activeSeatId && !table.state.finished);
      tile.root.classList.toggle('is-dead', p.dead);

      const worstCmd = Math.max(0, ...Object.values(p.cmd), 0);
      const badges = [];
      if (worstCmd > 0) badges.push({ k: 'cmd', v: worstCmd + '/' + CMD_LETHAL, hot: worstCmd >= CMD_LETHAL - 4 });
      if (p.poison > 0) badges.push({ k: 'poison', v: p.poison + '/' + POISON_LETHAL, hot: p.poison >= POISON_LETHAL - 2 });
      clear(tile.badges);
      badges.forEach((b) => tile.badges.append(
        el('span', { class: 'badge badge-' + b.k + (b.hot ? ' is-hot' : ''), text: b.v }),
      ));

      clear(tile.status);
      if (p.dead) {
        tile.status.append(
          icon('skull'),
          el('span', {
            // The same placing as the end screen.
            //
            // It used to come from elim.place, which is the ORDER of exit - and
            // with ties by turn the two numbers would start to disagree: the
            // panel would say 3rd and the summary 4th for the same person, in
            // the same match.
            text: placeAtTable.has(seat.id)
              ? t('table.place', { n: ordinal(placeAtTable.get(seat.id)) })
              : t('table.eliminated'),
          }),
        );
      }
    }

    table.wrap.classList.toggle('is-paused', table.state.paused);
    table.pauseView.root.classList.toggle('is-open', table.state.paused);
    if (table.state.paused) table.startPauseClock(); else table.stopPauseClock();

    table.syncManaBtn();

    table.hub.turn.textContent = String(table.state.turn);
    const active = table.state.players[table.state.activeSeatId];
    table.hub.ring.style.setProperty(
      '--accent',
      active ? accentOf(active.commanders[0] ? active.commanders[0].colors : []) : 'var(--text-dim)',
    );
    table.hub.undoBtn.disabled = !canUndo(table.match) && !table.pending.size;

    // The count request is good for ONE redraw. Leaving it on would make the
    // next edge tap count too, and there the number already moves by itself.
    table.countOnNextSync = false;

    // The victory poster shows up once per outcome. If an "undo" brings
    // someone back to life, it is armed again.
    if (!table.state.finished) table.victoryShown = false;
    else if (!table.victoryShown) {
      table.victoryShown = true;
      setTimeout(table.showVictory, 420);
    }
  }

  function buildTile(seat, spec) {
    const commander = seat.commanders[0];
    const colors = commander ? commander.colors : [];
    const accent = accentOf(colors);

    const life = el('div', { class: 'tile-life' });
    const delta = el('div', { class: 'tile-delta' });
    const badges = el('div', { class: 'tile-badges' });
    const status = el('div', { class: 'tile-status' });

    // The strips only mark territory: what listens to the pointer is the whole
    // panel, in bindTile. That is why they are divs and not buttons.
    const minus = el('div', { class: 'tap tap-minus', 'aria-hidden': 'true' }, [
      el('span', { class: 'tap-glyph' }, [icon('minus')]),
    ]);
    const plus = el('div', { class: 'tap tap-plus', 'aria-hidden': 'true' }, [
      el('span', { class: 'tap-glyph' }, [icon('plus')]),
    ]);

    const header = el('div', { class: 'tile-head' }, [
      el('span', { class: 'tile-player', text: seat.name }),
      el('span', { class: 'tile-deck', text: deckNameOf(seat.commanders) }),
    ]);

    const band = el('div', { class: 'tile-drag' });

    // Its own name: `root` in the outer scope is the root of the SCREEN. The
    // returned key is still `root`, so whoever uses tile.root does not change.
    const panel = el('div', {
      class: 'tile',
      dataset: { seat: seat.id },
      style: {
        gridRow: spec.cs ? String(spec.r) : String(spec.r),
        gridColumn: spec.cs ? spec.c + ' / span ' + spec.cs : String(spec.c),
        // Same rule as the damage pad: at a computer nobody sits on the other
        // side of the monitor, and the rotation left half the names, lives and
        // commanders upside down.
        transform: 'rotate(' + tableRotation(spec.rot, hasFinePointer()) + ')',
        '--accent': accent,
        '--tint': identityGradient(colors, 0.16),
        '--glow': withAlpha(accent, 0.34),
      },
    }, [
      commander && commander.art
        ? el('div', { class: 'tile-art', style: { backgroundImage: 'url(' + commander.art + ')' } })
        : null,
      el('div', { class: 'tile-tint' }),
      minus,
      plus,
      band,
      el('div', { class: 'tile-face' }, [header, life, badges, status]),
      delta,
    ]);

    table.bindTile(panel, seat);
    return { root: panel, life, delta, badges, status };
  }

  /** One hint, once in a lifetime: the drag needs to be discovered. */
  function hintOnce() {
    if (store.getDB().settings.dragHintSeen) return;
    store.setSetting('dragHintSeen', true);
    setTimeout(() => toast(t('table.dragHint')), 1000);
  }

  return { sync, buildTile, hintOnce };
}
