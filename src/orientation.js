/**
 * Screen orientation.
 *
 * The table wants the device LYING DOWN, in the middle of the group. The vote
 * wants it STANDING UP, because it passes from hand to hand and is held like a
 * normal phone.
 *
 * What can really be done, and what cannot:
 *
 *   - locking the orientation only works in fullscreen, and only in
 *     Chrome/Android. iPhone Safari implements neither.
 *   - that is why everything here is a "request", not an order: it fails
 *     silently where unsupported, and the CSS must keep working in the wrong
 *     orientation.
 *
 * On tablets and computers we touch nothing: the screen is large enough for
 * both things to fit lying down, and rotating a propped tablet would be worse.
 */

import * as store from './store.js';

/** The short side of the screen. A phone is below this in any orientation. */
const SMALL_SIDE = 560;

export function isSmallScreen() {
  if (typeof window === 'undefined') return false;
  return Math.min(window.innerWidth, window.innerHeight) < SMALL_SIDE;
}

export function isWide() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= window.innerHeight;
}

function allowed() {
  try {
    return store.getDB().settings.autoRotate !== false;
  } catch {
    return false;
  }
}

/**
 * The last request, so it can be repeated.
 *
 * Leaving the app drops fullscreen, and the orientation lock goes with it: on
 * return the device obeys the sensor and the table shows up standing. Nothing
 * at the table changes route at that moment, so nobody would ask again -
 * resumeOrientation() is what repeats it, with this record.
 */
let lastRequest = { mode: null, explicit: false };

/**
 * Fullscreen came in and even so the lock was refused: this device does not
 * lock (iPad, computer). Insisting on every tap would only throw the person
 * back into the fullscreen they just closed.
 */
let unsupported = false;

/**
 * Requests an orientation. `mode` is 'landscape', 'portrait' or null (release).
 *
 * Entering fullscreen is a condition for locking, so the landscape request
 * (made when opening the table) is what opens fullscreen; the others only
 * switch the lock, without leaving and coming back in - which would flash the
 * screen on every vote.
 */
export async function preferOrientation(mode, explicit = false) {
  if (typeof window === 'undefined') return;
  lastRequest = { mode, explicit };
  if (!allowed()) return;

  // Automatic portrait only makes sense on a phone: on a propped tablet,
  // rotating the screen by itself to vote would be more hindrance than help.
  //
  // But when the person CHOSE to stand the device up for this table, that
  // holds at any size - tablets included, which is exactly where a table of
  // two or three propped upright makes the most sense.
  if (mode === 'portrait' && !explicit && !isSmallScreen()) return;

  try {
    if (mode === null) {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      return;
    }

    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock(mode);
  } catch {
    /* unsupported or denied: the CSS copes in both orientations */
    if (document.fullscreenElement) unsupported = true;
  }
}

/**
 * Is the device IN THE MIDDLE of the table, or FACING a single person?
 *
 * Phones and tablets lie between the players: each one looks from one side,
 * and rotating the damage pad toward the seat of whoever attacks is what makes
 * it readable. At a computer nobody sits around the monitor - it stands up,
 * facing one person - and then the same rotation shows the screen upside down,
 * which is what was happening.
 *
 * The signal is the pointer, not the screen size: a large tablet in landscape
 * is as wide as a laptop, and guessing by pixels would be wrong both ways. A
 * mouse or trackpad means someone sitting in front of it. A touchscreen laptop
 * also has a mouse, and should not rotate either - which gives the right
 * result. An iPad with keyboard and trackpad counts as a computer, and then it
 * really is propped like a laptop.
 */
export function hasFinePointer(mm) {
  const media = mm || (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia.bind(window)
    : null);
  if (!media) return false;
  try {
    return Boolean(media('(hover: hover) and (pointer: fine)').matches);
  } catch {
    return false;
  }
}

/** Pure decision, so it can be tested both ways. */
export function rotatesWithSeat(finePointer) {
  return !finePointer;
}

/** Should the game pads rotate toward the seat of whoever acts? */
export function rotatesToSeat() {
  return rotatesWithSeat(hasFinePointer());
}

/**
 * How much a table element rotates, already in the format the CSS expects.
 *
 * It applies to each player's panel AND to the damage pad: same rule, same
 * reason. Lying on the table, each panel points to its owner; on an upright
 * monitor, the one "on the other side" does not exist - there is a single
 * person looking, and half the screen ended up upside down.
 *
 * It exists as a function so the test reaches the whole decision - including
 * the suffix, which is the part that breaks silently: `transform: rotate(0)`
 * without a unit is invalid, and the browser would discard the whole rule.
 */
export function tableRotation(degrees, finePointer) {
  return (rotatesWithSeat(finePointer) ? (degrees || 0) : 0) + 'deg';
}

/**
 * Did the lock drop, so it needs to be requested again?
 *
 * Only when there is a lock request in force and fullscreen is no longer
 * active - fullscreen is the condition for the lock to exist.
 */
export function lockLost() {
  if (typeof document === 'undefined') return false;
  return Boolean(lastRequest.mode)
    && !unsupported
    && allowed()
    // Mouse or trackpad: nobody rotates a computer, and asking for fullscreen
    // on every click would fight whoever just left it.
    && !hasFinePointer()
    && !document.fullscreenElement;
}

/**
 * Requests the last orientation again.
 *
 * Entering fullscreen requires a recent tap by the person, so calling this
 * when returning to the app usually fails; what guarantees it is the first tap
 * after the return, which calls this again (see app.js).
 */
export function resumeOrientation() {
  if (!lockLost()) return Promise.resolve();
  return preferOrientation(lastRequest.mode, lastRequest.explicit);
}
