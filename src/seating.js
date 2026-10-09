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
 * read their own panel without rotating the device. We only use 0 and 180:
 * turning a panel sideways would leave the name and the number lying down.
 *
 * The variant ids ('paisagem', 'retrato', 'padrao', and the legacy ones in
 * LEGACY_IDS) are stored in each match as `layoutId`, so they keep their
 * Portuguese names.
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
    // Standing up, there is height to spare: one person on the far side, two
    // on the near side.
    cols: 2, rows: 2,
    seats: [
      { r: 1, c: 1, cs: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 2, c: 1, rot: 0 },
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
    // Three columns by two rows: three on the far side, two on the near side.
    // Standing up this shape would give tall, narrow panels, and the life
    // number would not fit - that is why it only exists lying down.
    cols: 3, rows: 2,
    seats: [
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 1, c: 3, rot: 180 },
      { r: 2, c: 3, rot: 0 },
      { r: 2, c: 1, rot: 0 },
    ],
  }, {
    id: 'retrato',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    // Two columns by three rows. The empty cell is where the central core goes.
    cols: 2, rows: 3,
    seats: [
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 3, c: 2, rot: 0 },
      { r: 3, c: 1, rot: 0 },
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
  '3:retrato': [[2, 1, 0], [1, 1, 180, 2], [2, 2, 0]],
  '4:padrao': [[2, 1, 0], [1, 1, 180], [1, 2, 180], [2, 2, 0]],
  '5:paisagem': [[2, 1, 0], [1, 1, 180], [1, 2, 180], [1, 3, 180], [2, 3, 0]],
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
  volta: 'retrato',    // 5: two columns by three rows - same drawing
  '3-2': 'paisagem',   // 5: no exact equivalent; lying down is the closest
};

/** The chosen variant, falling back to the first when the id no longer exists. */
export function variant(seatCount, id) {
  const list = variantsFor(seatCount);
  const target = LEGACY_IDS[id] || id;
  return list.find((l) => l.id === target) || list[0];
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

/** The shapes of a variant (one or two), to sweep in the tests. */
export function shapesOf(v) {
  return v.land
    ? [{ name: 'portrait', shape: v }, { name: 'landscape', shape: v.land }]
    : [{ name: 'single', shape: v }];
}

/** Center of the seat in the grid, as a fraction from 0 to 1. */
export function seatCenter(spec, layout) {
  const colSpan = spec.cs || 1;
  return {
    x: (spec.c - 1 + colSpan / 2) / layout.cols,
    y: (spec.r - 1 + 0.5) / layout.rows,
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
