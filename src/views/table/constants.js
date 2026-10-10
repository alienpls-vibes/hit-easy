/**
 * The gesture measurements, and the mana colors.
 *
 * The timings are the heart of the table's touch grammar, and changing them
 * changes what each gesture MEANS - that is why they live together, in a file
 * you open to tune exactly that.
 */

export const COMMIT_MS = 900;

// In the CENTER of the panel, above this the touch stops being a tap and
// becomes an attack. At the edges HOLD_DELAY rules, because there holding
// repeats.
export const TAP_MAX = 260;

// How long to hold before the repetition starts. Larger than TAP_MAX on
// purpose: between the two, a slow tap is still a tap.
export const HOLD_DELAY = 380;

// Cadence of "hold to repeat". It applies to the adjustment buttons (damage
// pad, mana marker) and to the panel edges at the table - holding has to mean
// the same speed in both, otherwise the same table answers in two ways.
export const REPEAT_MS = 110;
export const REPEAT_FAST_MS = 55;

// How many steps at the slow cadence before speeding up. Eight gives time to
// let go when it was an accident, and does not make anyone who wants to take
// off 40 at once wait.
export const REPEAT_ACCEL_AFTER = 8;

export const DRAG_THRESHOLD = 14; // px before a touch becomes a drag

// double-tap window, which opens the area action
export const DOUBLE_TAP_MS = 280;

// Life counting up to the new value, when the damage comes from a pad.
//
// Fixed total duration: taking off 28 counts fast and taking off 2 counts
// slowly, which is what makes the animation always last the same. The minimum
// step exists so the small change is SEEN - without it, taking off 2 would be a
// blink.
export const COUNT_MS = 420;
export const COUNT_MIN_STEP = 26;

export const SVG_NS = 'http://www.w3.org/2000/svg';

// WUBRG order, and colorless last - the same every card uses.
export const MANA = [
  'W', 'U', 'B', 'R', 'G', 'C',
];

export const MANA_ZERO = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
