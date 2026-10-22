/**
 * Seat arrangement at the table.
 *
 * Kept apart from the view on purpose: it is pure data, no DOM, and that is why
 * the property that really matters can be TESTED - the seat order, which is
 * the turn order, has to run clockwise seen from above.
 *
 * Clockwise is right because in Commander the turn passes to the neighbor on
 * the left, and since everyone looks at the center of the table, "each one's
 * left" draws a clockwise turn seen from above.
 *
 * The round starts at the top left, with the device lying down: it is where
 * reading starts, and where whoever set up the table looks for player 1. Until
 * 1.8 it started at the bottom left - see LEGACY_SEATS.
 *
 * With 2, 3 and 5 the lying-down shape comes first, and it is the default: the
 * table was designed for the device lying in the middle of the group.
 *
 * With 2, 3 and 5 players the choice is the person's, and the question it
 * answers is concrete: will the device STAND UP or LIE DOWN in the middle of
 * the table? That was the real decision all along - "2 below, 1 above"
 * described the consequence of a choice nobody had made yet. Each of these
 * variants declares `orient`, and the match then requests that orientation.
 *
 * With 4 and 6 there is nothing to choose: four is symmetric, and six is three
 * on each side. Those two keep adapting by themselves to the screen ratio, and
 * that is why they still use `land` - the 2x3 grid that serves portrait
 * becomes three columns by two rows in landscape, otherwise the panels end up
 * tall and narrow and the life number does not fit.
 *
 * Whoever is on the other side of the table shows up upside down (rot 180) to
 * read their own panel without rotating the device. The upright three- and
 * five-player tables also turn panels a quarter: there one person sits at the
 * head and the others along the two long sides of the device, so the left
 * side reads at 90 and the right side at 270. Everywhere else it is only 0
 * and 180 - a panel turned sideways for someone sitting at an end would leave
 * the name and the number lying down.
 *
 * The variant ids ('paisagem', 'retrato', 'padrao', 'cabeceira', the legacy
 * ones in LEGACY_IDS and the retired ones in RETIRED) are stored in each match
 * as `layoutId`, so they keep their Portuguese names.
 */

export const LAYOUTS = {
  2: [{
    id: 'paisagem',
    orient: 'landscape',
    labelKey: 'layout.landscape',
    // A stack of two, wide and short. Two people facing each other end up on
    // opposite sides of the device anyway; what changes between the variants
    // is the shape of each one's panel.
    cols: 1, rows: 2,
    seats: [{ r: 1, c: 1, rot: 180 }, { r: 2, c: 1, rot: 0 }],
  }, {
    id: 'retrato',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    cols: 1, rows: 2,
    seats: [{ r: 1, c: 1, rot: 180 }, { r: 2, c: 1, rot: 0 }],
  }],

  3: [{
    id: 'paisagem',
    orient: 'landscape',
    labelKey: 'layout.landscape',
    // Lying down, there is width to spare: two on the far side, one taking
    // the whole near strip.
    cols: 2, rows: 2,
    seats: [
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 1, cs: 2, rot: 0 },
    ],
  }, {
    id: 'retrato',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    // Standing up, there is height to spare: one person at the head, one on
    // each long side - each reading their panel from where they sit.
    cols: 2, rows: 2,
    // The central core lies across the device too, like the seats screen
    // draws this table: turned a quarter to the left side.
    hubRot: 90,
    seats: [
      { r: 1, c: 1, cs: 2, rot: 180 },
      { r: 2, c: 2, rot: 270 },
      { r: 2, c: 1, rot: 90 },
    ],
  }],

  4: [{
    id: 'padrao',
    labelKey: 'layout.pairs',
    cols: 2, rows: 2,
    seats: [
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 2, c: 1, rot: 0 },
    ],
  }],

  5: [{
    id: 'paisagem',
    orient: 'landscape',
    labelKey: 'layout.landscape',
    // Three on the far side, two on the near side - each of the two takes
    // half the width. Six columns are what let three and two share the same
    // edge without leaving a hole: until 1.12.1 it was a 3x2 grid with the
    // near middle cell empty, and on the seats screen it looked the same as
    // the upright option. Standing up this shape would give tall, narrow
    // panels, and the life number would not fit - that is why it only exists
    // lying down.
    cols: 6, rows: 2,
    seats: [
      { r: 1, c: 1, cs: 2, rot: 180 },
      { r: 1, c: 3, cs: 2, rot: 180 },
      { r: 1, c: 5, cs: 2, rot: 180 },
      { r: 2, c: 4, cs: 3, rot: 0 },
      { r: 2, c: 1, cs: 3, rot: 0 },
    ],
  }, {
    // Stored in each match: do not translate. "Cabeceira" is the head of the
    // table, where player 1 sits. A new id and not 'retrato', which drew
    // another table - see RETIRED.
    id: 'cabeceira',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    // One person at the head of the table, taking the whole far edge, and two
    // on each long side, reading from that side (left 90, right 270).
    cols: 2, rows: 3,
    // The central core goes where the four side panels meet, two thirds down.
    // At the middle of the screen it would sit on the life of the two panels
    // of the middle row - the old shape left an empty cell there for it.
    hubY: 2 / 3,
    // Lying across the device, like the seats screen draws this table; along
    // the gap between the two side columns it also covers less of them.
    hubRot: 90,
    seats: [
      { r: 1, c: 1, cs: 2, rot: 180 },
      { r: 2, c: 2, rot: 270 },
      { r: 3, c: 2, rot: 270 },
      { r: 3, c: 1, rot: 90 },
      { r: 2, c: 1, rot: 90 },
    ],
  }],

  6: [{
    id: 'padrao',
    labelKey: 'layout.threes',
    cols: 2, rows: 3,
    seats: [
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 3, c: 2, rot: 0 },
      { r: 3, c: 1, rot: 0 },
      { r: 2, c: 1, rot: 0 },
    ],
    land: {
      cols: 3, rows: 2,
      seats: [
        { r: 1, c: 1, rot: 180 },
        { r: 1, c: 2, rot: 180 },
        { r: 1, c: 3, rot: 180 },
        { r: 2, c: 3, rot: 0 },
        { r: 2, c: 2, rot: 0 },
        { r: 2, c: 1, rot: 0 },
      ],
    },
  }],
};

/**
 * Variants no longer offered, kept so a match that started with one keeps its
 * table.
 *
 * The app updates in the middle of a game, and redrawing a match in progress
 * with another shape would move people without warning. Until 1.12.1 the
 * upright five-player table was two columns by three rows with an empty cell
 * - two at the head - and it went by 'retrato'. Its replacement, with one
 * person at the head, took a new id ('cabeceira'), so this one keeps meaning
 * what it meant. `successor` is what a NEW match picks in its place.
 */
const RETIRED = {
  5: [{
    id: 'retrato',
    successor: 'cabeceira',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    cols: 2, rows: 3,
    seats: [
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 3, c: 2, rot: 0 },
      { r: 3, c: 1, rot: 0 },
    ],
  }],
};

/**
 * Where each seat sat until 1.8: player 1 at the bottom left.
 *
 * Only a match that started before the change uses this - it has no
 * `assentos` - and it exists for the same reason as LEGACY_IDS: the app updates
 * in the middle of a game, and redrawing the table in the new order would swap
 * everyone's places without warning. The rotation is the same; only the seat
 * where the round starts changes.
 *
 * Key `n:id`, and `n:id:land` for the lying-down shape.
 */
const LEGACY_SEATS = {
  '2:paisagem': [[2, 1, 0], [1, 1, 180]],
  '2:retrato': [[2, 1, 0], [1, 1, 180]],
  '3:paisagem': [[2, 1, 0, 2], [1, 1, 180], [1, 2, 180]],
  '3:retrato': [[2, 1, 90], [1, 1, 180, 2], [2, 2, 270]],
  '4:padrao': [[2, 1, 0], [1, 1, 180], [1, 2, 180], [2, 2, 0]],
  '5:paisagem': [[2, 1, 0, 3], [1, 1, 180, 2], [1, 3, 180, 2], [1, 5, 180, 2], [2, 4, 0, 3]],
  '5:retrato': [[3, 1, 0], [1, 1, 180], [1, 2, 180], [2, 2, 0], [3, 2, 0]],
  '6:padrao': [[3, 1, 0], [2, 1, 0], [1, 1, 180], [1, 2, 180], [2, 2, 0], [3, 2, 0]],
  '6:padrao:land': [[2, 1, 0], [1, 1, 180], [1, 2, 180], [1, 3, 180], [2, 3, 0], [2, 2, 0]],
};

/**
 * How the match records that it was born with player 1 at the top left. The
 * value is stored in the match's `assentos` field: do not translate.
 */
export const SEATS_FROM_TOP = 'topo';

function legacySeats(key) {
  const list = LEGACY_SEATS[key];
  if (!list) return null;
  return list.map(([r, c, rot, cs]) => (cs ? { r, c, cs, rot } : { r, c, rot }));
}

/** All the variants for this number of players. */
export function variantsFor(seatCount) {
  return LAYOUTS[seatCount] || LAYOUTS[4];
}

/**
 * Old variant names.
 *
 * A saved match - and a match IN PROGRESS - keeps the id that existed when it
 * started. Without this, updating the app in the middle of a three-player game
 * would throw the table into the default and swap people's places, without
 * warning.
 *
 * Three of the four cases land on the exact same arrangement as before; only
 * five-player '3-2' has no exact equivalent, and goes to the lying-down shape,
 * which is the closest.
 */
const LEGACY_IDS = {
  '2-1': 'retrato',    // 3: two below, one above - same drawing
  '1-2': 'paisagem',   // 3: one below, two above - same drawing
  volta: 'retrato',    // 5: two columns by three rows - same drawing (now RETIRED)
  '3-2': 'paisagem',   // 5: no exact equivalent; lying down is the closest
};

/**
 * The chosen variant, falling back to the first when the id no longer exists.
 * A retired id still finds its own table - a match keeps the shape it started
 * with.
 */
export function variant(seatCount, id) {
  const list = variantsFor(seatCount);
  const target = LEGACY_IDS[id] || id;
  return list.find((l) => l.id === target)
    || (RETIRED[seatCount] || []).find((l) => l.id === target)
    || list[0];
}

/**
 * The id a NEW match uses for this choice: one of the options offered today.
 * A table set up again from an old match must not start on a retired shape.
 */
export function pickableId(seatCount, id) {
  const v = variant(seatCount, id);
  if (variantsFor(seatCount).includes(v)) return v.id;
  return v.successor || variantsFor(seatCount)[0].id;
}

/**
 * The concrete shape to draw: the same variant, in its standing or lying-down
 * version. `wide` comes from the real screen ratio, not the device angle -
 * what matters is whether there is more width than height to distribute.
 */
export function layoutFor(seatCount, id, wide = false, seatOrder = SEATS_FROM_TOP) {
  const v = variant(seatCount, id);
  // A variant that ALREADY declares an orientation does not change shape with
  // the screen: the person said how the device sits on the table, and the app
  // must follow that choice - not guess from the ratio and contradict what
  // they asked for.
  const lyingDown = !v.orient && wide && v.land;
  const shape = lyingDown ? v.land : v;
  const legacy = seatOrder === SEATS_FROM_TOP
    ? null
    : legacySeats(seatCount + ':' + v.id + (lyingDown ? ':land' : ''));
  return {
    id: v.id,
    labelKey: v.labelKey,
    orient: v.orient || null,
    cols: shape.cols,
    rows: shape.rows,
    seats: legacy || shape.seats,
    // Where the central core sits, as a fraction of the height; null = the
    // middle. And how much it turns (degrees; 0 = as usual).
    hubY: shape.hubY || null,
    hubRot: shape.hubRot || 0,
  };
}

/**
 * The shape this match's table draws.
 *
 * A match without `assentos` started before player 1 moved to the top, and
 * keeps the order it started with.
 */
export function layoutOfMatch(match, wide = false) {
  return layoutFor(match.seats.length, match.layoutId, wide, match.assentos || 'legacy');
}

/**
 * How the device should sit at this table.
 *
 * `null` when the variant does not care - with 4 or 6 the shape adapts by
 * itself, and locking the orientation there would only take freedom away from
 * the players.
 */
export function orientOf(seatCount, id) {
  return variant(seatCount, id).orient || null;
}

/**
 * The table as drawn on the seats screen: always with the device on its side.
 *
 * That screen draws a phone, and a phone lying sideways fits the panel without
 * a tall, narrow drawing. A variant that does not pick an orientation (4 and
 * 6) draws the shape the match itself uses on a wide screen. One that asks
 * for the device UPRIGHT is the same table seen from another chair: the
 * drawing turns a quarter to the left - the top edge goes to the left - and
 * everyone keeps their neighbors, so the round is still clockwise.
 *
 * A turned seat that spanned columns spans rows instead (`rs`), and its `rot`
 * turns too - 90 and 270 exist only in this drawing, never on the table.
 */
export function sidewaysLayout(seatCount, id) {
  const v = variant(seatCount, id);
  if (v.orient !== 'portrait') return layoutFor(seatCount, id, true);
  const upright = layoutFor(seatCount, id);
  return {
    ...upright,
    cols: upright.rows,
    rows: upright.cols,
    seats: upright.seats.map((spec) => {
      const span = spec.cs || 1;
      // The rotation turns with the drawing: whoever read upright now reads
      // facing left (270), and the far side facing right (90).
      const turned = { r: upright.cols - spec.c - span + 2, c: spec.r, rot: (spec.rot + 270) % 360 };
      return span > 1 ? { ...turned, rs: span } : turned;
    }),
  };
}

/** The shapes of a variant (one or two), to sweep in the tests. */
export function shapesOf(v) {
  return v.land
    ? [{ name: 'portrait', shape: v }, { name: 'landscape', shape: v.land }]
    : [{ name: 'single', shape: v }];
}

/** Center of the seat in the grid, as a fraction from 0 to 1. */
export function seatCenter(spec, layout) {
  const colSpan = spec.cs || 1;
  const rowSpan = spec.rs || 1;
  return {
    x: (spec.c - 1 + colSpan / 2) / layout.cols,
    y: (spec.r - 1 + rowSpan / 2) / layout.rows,
  };
}

/**
 * Angle of the seat relative to the center of the table, in degrees from 0 to
 * 360. Screen coordinates have Y pointing down, so an INCREASING angle =
 * clockwise - which is exactly the property we want to check.
 */
export function seatAngle(spec, layout) {
  const { x, y } = seatCenter(spec, layout);
  const deg = (Math.atan2(y - 0.5, x - 0.5) * 180) / Math.PI;
  return (deg + 360) % 360;
}
